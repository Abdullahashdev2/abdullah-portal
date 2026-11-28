// Level container + builder kit (colliders are axis-aligned boxes; visuals are free-form)
import * as THREE from 'three';
import { mat, glowSprite, runeTex, cloudTex, textSprite } from './fx.js';
import { mergeGeometries } from '../saeq-albatal/lib/utils/BufferGeometryUtils.js';
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
const V = THREE.Vector3;

export class Level {
  constructor(scene) {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group);
    this.boxes = []; this.dyn = []; this.camMeshes = []; this.anim = []; this.runeMats = [];
    this.shards = []; this.items = []; this.pedestals = []; this.checkpoints = []; this.portals = []; this.triggers = []; this.enemyDefs = []; this.npcs = []; this.groupsDone = {}; this.onClear = {};
    this.lights = 0; this.t = 0;
  }
  add(o) { this.group.add(o); return o; }
  update(dt, player) {
    this.t += dt;
    for (const b of this.dyn) {
      b.delta.set(0, 0, 0);
      if (b.move) {
        const m = b.move, off = m.amp * Math.sin(this.t * m.speed + (m.phase || 0)), nc = b.base.clone(); nc[m.axis] += off;
        const cur = b.center; b.delta.subVectors(nc, cur); cur.copy(nc);
        b.min.add(b.delta); b.max.add(b.delta); b.mesh.position.add(b.delta);
      }
      if (b.sink) {
        const k = b.sink; k.off = player.ground === b ? Math.max(-k.depth, k.off - dt * k.rate) : Math.min(0, k.off + dt * 0.6);
        const ny = b.base.y + k.off, dy = ny - b.center.y; b.delta.y = dy; b.center.y = ny; b.min.y += dy; b.max.y += dy; b.mesh.position.y += dy;
      }
      if (b.slide && b.slide.go && b.slide.k < 1) { // حاوية/جسر ينزلق لمكان جديد مرة وحدة
        const sl = b.slide; sl.k = Math.min(1, sl.k + dt / sl.dur); const e = sl.k < 0.5 ? 2 * sl.k * sl.k : 1 - Math.pow(-2 * sl.k + 2, 2) / 2;
        const nc = sl.from.clone().lerp(sl.to, e); b.delta.subVectors(nc, b.center); b.center.copy(nc); b.min.add(b.delta); b.max.add(b.delta); b.mesh.position.add(b.delta);
        if (sl.k >= 1 && sl.done) sl.done();
      }
      if (b.crumble) {
        const c = b.crumble;
        if (c.state === 0) {
          if (player.ground === b) c.t += dt; else c.t = Math.max(0, c.t - dt * 0.5);
          b.mesh.position.x = b.meshBase.x + (c.t > 0.1 ? (Math.random() - 0.5) * 0.08 * c.t : 0);
          if (c.t > 0.75) { c.state = 1; c.timer = 0; c.v = 0; b.active = false; this.onCrumble && this.onCrumble(b); }
        } else {
          c.timer += dt; c.v += 20 * dt; b.mesh.position.y -= c.v * dt; b.mesh.rotation.x += dt * 0.8;
          if (c.timer > 3.4) { c.state = 0; c.t = 0; b.active = true; b.mesh.position.copy(b.meshBase); b.mesh.rotation.set(0, 0, 0); }
        }
      }
    }
    for (const f of this.anim) f(dt, this.t);
    const pulse = 0.55 + 0.45 * Math.sin(this.t * 2.4);
    for (const m of this.runeMats) m.opacity = 0.35 + pulse * 0.6;
  }
  /* spatial grid so physics and line-of-sight only test nearby boxes */
  buildGrid(cell = 6) {
    this.cell = cell; this.grid = new Map(); this.dynAll = this.boxes.filter((b) => this.dyn.includes(b) || b.door);
    for (const b of this.boxes) {
      if (this.dynAll.includes(b)) continue;
      const x0 = Math.floor(b.min.x / cell), x1 = Math.floor(b.max.x / cell), z0 = Math.floor(b.min.z / cell), z1 = Math.floor(b.max.z / cell);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = x * 100003 + z; let a = this.grid.get(k); if (!a) this.grid.set(k, (a = [])); a.push(b); }
    }
    this._q = 0;
  }
  near(x0, z0, x1, z1) {
    if (!this.grid) return this.boxes;
    const c = this.cell, out = this.dynAll.slice(), q = ++this._q;
    for (let x = Math.floor(Math.min(x0, x1) / c); x <= Math.floor(Math.max(x0, x1) / c); x++) for (let z = Math.floor(Math.min(z0, z1) / c); z <= Math.floor(Math.max(z0, z1) / c); z++) {
      const a = this.grid.get(x * 100003 + z); if (!a) continue; for (const b of a) if (b._q !== q) { b._q = q; out.push(b); }
    }
    return out;
  }
  nearR(x, z, r) { return this.near(x - r, z - r, x + r, z + r); }
  segBoxes(a, b) { return this.near(Math.min(a.x, b.x) - 0.5, Math.min(a.z, b.z) - 0.5, Math.max(a.x, b.x) + 0.5, Math.max(a.z, b.z) + 0.5); }
  /* دمج القطع الثابتة (نفس نوع الخامة + نفس المنطقة) في قطعة وحدة — يقلّل أوامر الرسم من آلاف لعشرات.
     الأمان: نأخذ بس القطع المباشرة تحت المرحلة (وأبناءها من القطع)، ونتجنّب أي شي يتحرك/يختفي/خامته خاصة. */
  batch(cell = 24) {
    const OK = (m) => m && (m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial) && !m.isShaderMaterial;
    const cand = [];
    const walk = (o) => {
      for (const c of o.children) {
        if (c.isGroup && c.userData.batchable && !c.userData.dyn && c.visible) { walk(c); continue; }
        if (!c.isMesh || c.isSkinnedMesh || c.isInstancedMesh || c.userData.dyn || c.userData.nobatch || !c.visible) continue; // groups/sprites/lights are skipped entirely
        if (!Array.isArray(c.material) && OK(c.material) && c.geometry && c.geometry.attributes.position && !c.morphTargetInfluences) cand.push(c);
        walk(c);
      }
    };
    walk(this.group);
    if (cand.length < 50) return 0;
    this.group.updateMatrixWorld(true);
    const groups = new Map(), _v = new THREE.Vector3();
    for (const o of cand) {
      const m = o.material; o.geometry.computeBoundingSphere(); _v.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld);
      const key = [m.type, m.map ? m.map.uuid : '', m.emissive ? m.emissive.getHex() : '', m.emissiveIntensity, m.roughness, m.metalness, m.flatShading, m.side, m.transparent, m.opacity, m.depthWrite, m.blending, m.vertexColors, m.fog, o.castShadow, o.receiveShadow, Math.floor(_v.x / cell), Math.floor(_v.z / cell), Math.floor(_v.y / (cell * 2))].join('|');
      let g = groups.get(key); if (!g) groups.set(key, (g = [])); g.push(o);
    }
    let merged = 0;
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geos = [];
      for (const o of list) {
        const g = o.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
        const n = g.attributes.position.count;
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
        if (!g.index) { const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
        g.morphAttributes = {}; g.clearGroups();
        g.applyMatrix4(o.matrixWorld);
        const c = o.material.color || new THREE.Color(1, 1, 1), col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geos.push(g);
      }
      const big = mergeGeometries(geos, false); geos.forEach((g) => g.dispose());
      if (!big) continue;
      const m0 = list[0].material, bm = m0.clone(); if (bm.color) bm.color.setRGB(1, 1, 1); bm.vertexColors = true; bm.userData.own = true;
      const mesh = new THREE.Mesh(big, bm); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow; mesh.userData.batched = true;
      this.group.add(mesh);
      // القطع الأصلية تنشال من الرسم بس تبقى للفيزياء/الكاميرا (مصفوفاتها مثبتة)
      for (const o of list) { o.material = HIDDEN; o.castShadow = o.receiveShadow = false; o.userData.batchedInto = mesh; o.userData.batchedOut = true; }
      merged += list.length;
    }
    // القطع المخفية اللي كل أبنائها مدموجين: نشيلها من شجرة الرسم كلياً (تبقى للكاميرا والتصويب بمصفوفاتها الثابتة)
    const allOut = (o) => o.userData.batchedOut && o.children.every(allOut);
    this.detached = this.detached || [];
    for (const o of cand) if (o.parent === this.group && allOut(o)) { o.removeFromParent(); this.detached.push(o); }
    return merged;
  }
  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.userData.own) o.material.dispose(); });
    (this.detached || []).forEach((d) => d.traverse((o) => { if (o.geometry) o.geometry.dispose(); }));
    this.group.removeFromParent();
  }
}

function tiledBox(w, h, d, t = 2) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, (uv.getX(i) * dims[f][0]) / t, (uv.getY(i) * dims[f][1]) / t); }
  return g;
}
function rockUnder(w, d, depth) {
  const g = new THREE.ConeGeometry(0.5, 1, 9, 4); g.rotateX(Math.PI); g.translate(0, -0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i); if (y > -0.02) continue;
    const s = Math.sin(i * 12.9898) * 43758.5453, r = s - Math.floor(s);
    p.setX(i, p.getX(i) * (0.8 + r * 0.45)); p.setZ(i, p.getZ(i) * (0.8 + ((r * 7) % 1) * 0.45)); p.setY(i, y * (0.85 + r * 0.3));
  }
  g.scale(w * 1.18, depth, d * 1.18); g.computeVertexNormals(); return g;
}
const own = (m) => { m.userData.own = true; return m; };

export function makeKit(L) {
  const K = {};
  K.plat = (o) => {
    const { x = 0, y = 0, z = 0, w = 4, d = 4, h = 1, m = 'sand', rock = true, run = false, ledge = true, crumble = false, move = null, hidden = false, runFaces, tile = 2 } = o;
    const mesh = new THREE.Mesh(tiledBox(w, h, d, tile), typeof m === 'string' ? mat(m) : m);
    mesh.position.set(x, y - h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true; L.add(mesh);
    const b = { min: new V(x - w / 2, y - h, z - d / 2), max: new V(x + w / 2, y, z + d / 2), run, ledge, beam: Math.min(w, d) < 0.8, active: !hidden, mesh, base: new V(x, y, z), center: new V(x, y, z), delta: new V(), meshBase: mesh.position.clone(), crumble: crumble ? { t: 0, state: 0 } : null, move, kind: o.kind, sink: o.sink ? { off: 0, rate: o.sink.rate || 0.8, depth: o.sink.depth || 4 } : null };
    if (rock && h < 4) {
      const r = new THREE.Mesh(rockUnder(w, d, o.rockDepth || Math.max(2.4, Math.min(w, d) * 0.75)), mat('rock', { flatShading: true }));
      r.position.y = -h / 2; r.castShadow = true; r.receiveShadow = true; mesh.add(r);
    }
    if (crumble) { mesh.material = own(mesh.material.clone()); mesh.material.color.setHex(0xd8c6ff); const c = glowSprite(0xb794f6, Math.max(w, d) * 0.9, 0.35); c.position.y = h / 2 + 0.05; mesh.add(c); }
    if (run) K.runes(mesh, w, h, d, runFaces);
    if (hidden) mesh.visible = false;
    if (move || crumble || o.sink || hidden) mesh.userData.dyn = true;
    L.boxes.push(b); L.camMeshes.push(mesh); if (move || crumble || o.sink) L.dyn.push(b);
    return b;
  };
  K.wall = (o) => K.plat({ rock: false, ...o });
  K.runes = (mesh, w, h, d, faces) => {
    if (!faces) faces = w < d ? ['+x', '-x'] : d < w ? ['+z', '-z'] : ['+x', '-x', '+z', '-z'];
    const mm = own(new THREE.MeshBasicMaterial({ map: runeTex(), color: 0x67e8f9, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    L.runeMats.push(mm);
    for (const f of faces) {
      const along = f[1] === 'x' ? d : w, hh = Math.min(h * 0.75, 6), rows = Math.max(1, Math.floor(hh / 1.4));
      for (let r = 0; r < rows; r++) {
        const geo = new THREE.PlaneGeometry(along * 0.92, 0.42); geo.attributes.uv.array.forEach((v, i, a) => { if (i % 2 === 0) a[i] = v * along / 3.5; });
        const p = new THREE.Mesh(geo, mm), s = f[0] === '+' ? 1 : -1, yy = h / 2 - 0.9 - r * 1.4;
        if (f[1] === 'x') { p.position.set(s * (w / 2 + 0.02), yy, 0); p.rotation.y = s * Math.PI / 2; } else { p.position.set(0, yy, s * (d / 2 + 0.02)); p.rotation.y = s > 0 ? 0 : Math.PI; }
        mesh.add(p);
      }
      const edge = new THREE.Mesh(new THREE.BoxGeometry(f[1] === 'x' ? 0.05 : w * 0.98, 0.06, f[1] === 'x' ? d * 0.98 : 0.05), mm);
      edge.position.set(f[1] === 'x' ? (f[0] === '+' ? 1 : -1) * (w / 2 + 0.03) : 0, h / 2 - 0.08, f[1] === 'z' ? (f[0] === '+' ? 1 : -1) * (d / 2 + 0.03) : 0); mesh.add(edge);
    }
  };
  K.column = ({ x, y, z, h = 4, r = 0.42, m = 'sand', broken = false, solid = true, rot = 0 }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; L.add(g);
    const hh = broken ? h * (0.45 + Math.random() * 0.3) : h;
    const add = (geo, yy) => { const me = new THREE.Mesh(geo, mat(m)); me.position.y = yy; me.castShadow = me.receiveShadow = true; g.add(me); return me; };
    add(new THREE.BoxGeometry(r * 2.6, 0.3, r * 2.6), 0.15);
    add(new THREE.CylinderGeometry(r, r * 1.08, hh, 14), 0.3 + hh / 2);
    if (!broken) add(new THREE.BoxGeometry(r * 2.7, 0.35, r * 2.7), hh + 0.47);
    else { const ch = add(new THREE.CylinderGeometry(r, r, 1.1, 14), 0.4); ch.position.set(r * 2.2, r, 0.4); ch.rotation.z = Math.PI / 2; ch.rotation.y = 0.6; }
    if (solid) K.plat({ x, y: y + hh + 0.3, z, w: r * 2, d: r * 2, h: hh + 0.3, rock: false, hidden: true }).active = true;
    return g;
  };
  K.crystal = ({ x, y, z, color = 0x67e8f9, s = 1, light = false, n = 5 }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const mm = own(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92, flatShading: true }));
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 * s, 0), mm), a = (i / n) * Math.PI * 2;
      const tall = (1.4 + Math.random() * 1.6) * (i === 0 ? 1.5 : 1);
      c.scale.set(0.55, tall, 0.55); c.position.set(i ? Math.cos(a) * 0.32 * s : 0, tall * 0.25 * s, i ? Math.sin(a) * 0.32 * s : 0);
      c.rotation.set(i ? Math.cos(a) * 0.5 : 0, a, i ? Math.sin(a) * 0.5 : 0); g.add(c);
    }
    const gl = glowSprite(color, 3.2 * s, 0.6); gl.position.y = 0.6 * s; g.add(gl);
    if (light && L.lights < 6) { const pl = new THREE.PointLight(color, 6 * s, 9 * s, 2); pl.position.y = 1 * s; g.add(pl); L.lights++; }
    const ph = Math.random() * 6; L.anim.push((dt, t) => { gl.material.opacity = 0.45 + 0.2 * Math.sin(t * 2 + ph); });
    return g;
  };
  K.brazier = ({ x, y, z, color = 0xffa24a, light = false }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.1, 8), mat('dark')); st.position.y = 0.55; st.castShadow = true; g.add(st);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.22, 0.3, 12, 1, true), mat('gold')); bowl.position.y = 1.2; bowl.material.side = THREE.DoubleSide; g.add(bowl);
    const f1 = glowSprite(color, 1.3, 0.9), f2 = glowSprite(0xfff1c1, 0.6, 0.9); f1.userData.dyn = true; f1.position.y = f2.position.y = 1.55; g.add(f1, f2);
    if (light && L.lights < 6) { const pl = new THREE.PointLight(color, 8, 10, 2); pl.position.y = 1.8; g.add(pl); L.lights++; }
    const ph = Math.random() * 9; L.anim.push((dt, t) => { const k = 1 + 0.15 * Math.sin(t * 13 + ph) + 0.1 * Math.sin(t * 7.3); f1.scale.setScalar(1.3 * k); f1.position.y = 1.55 + 0.05 * Math.sin(t * 9 + ph); });
    K.plat({ x, y: y + 1.35, z, w: 0.6, d: 0.6, h: 1.35, rock: false, hidden: true }).active = true;
    return g;
  };
  K.tree = ({ x, y, z, s = 1, color = 0xf9a8d4 }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); L.add(g); g.userData.batchable = true; // شجرة ثابتة = تندمج
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 2.4, 7), own(new THREE.MeshStandardMaterial({ color: 0x5b3a29, roughness: 0.9 }))); trunk.position.y = 1.2; trunk.rotation.z = 0.08; trunk.castShadow = true; g.add(trunk);
    const lm = own(new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, emissive: color, emissiveIntensity: 0.12 }));
    [[0, 2.8, 0, 1.3], [0.8, 2.5, 0.3, 0.9], [-0.7, 2.6, -0.2, 1], [0.1, 3.4, -0.4, 0.8]].forEach(([a, b, c, r]) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), lm); m.position.set(a, b, c); m.castShadow = true; g.add(m); });
    L.petalTrees = L.petalTrees || []; L.petalTrees.push({ pos: new V(x, y + 3 * s, z), color });
    K.plat({ x, y: y + 2, z, w: 0.5 * s, d: 0.5 * s, h: 2, rock: false, hidden: true }).active = true;
    return g;
  };
  K.arch = ({ x, y, z, w = 6, h = 5, rot = 0, m = 'sand' }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; L.add(g);
    [-1, 1].forEach((s) => { const c = new THREE.Mesh(tiledBox(0.9, h, 0.9), mat(m)); c.position.set(s * w / 2, h / 2, 0); c.castShadow = c.receiveShadow = true; g.add(c); });
    const top = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.42, 8, 24, Math.PI), mat(m)); top.position.y = h; top.castShadow = true; g.add(top);
    const ks = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.95), mat('gold')); ks.position.y = h + w / 2; g.add(ks);
    if (Math.abs(rot) < 0.01 || Math.abs(Math.abs(rot) - Math.PI) < 0.01) [-1, 1].forEach((s) => K.plat({ x: x + s * w / 2, y: y + h, z, w: 0.9, d: 0.9, h, rock: false, hidden: true }).active = true);
    return g;
  };
  K.banner = ({ x, y, z, color = 0xb91c1c, rot = 0, h = 3 }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; L.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), mat('gold')); pole.rotation.z = Math.PI / 2; g.add(pole);
    const geo = new THREE.PlaneGeometry(1.3, h, 1, 10); const cm = own(new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 }));
    const cloth = new THREE.Mesh(geo, cm); cloth.position.y = -h / 2; cloth.castShadow = true; g.add(cloth);
    const em = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 6), own(new THREE.MeshBasicMaterial({ color: 0xfcd34d, side: THREE.DoubleSide }))); em.position.set(0, -h * 0.35, 0.01); g.add(em);
    const p = geo.attributes.position, base = Float32Array.from(p.array), ph = Math.random() * 6;
    L.anim.push((dt, t) => { for (let i = 0; i < p.count; i++) { const yy = base[i * 3 + 1], k = (h / 2 - yy) / h; p.array[i * 3 + 2] = Math.sin(t * 2.2 + yy * 2 + ph) * 0.12 * k; } p.needsUpdate = true; });
  };
  K.chain = ({ x, y, z, len = 6 }) => {
    const mm = mat('dark', { metalness: 0.6, roughness: 0.4 });
    for (let i = 0; i < len * 3; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 10), mm); l.position.set(x, y - i * 0.18, z); l.rotation.y = (i % 2) * Math.PI / 2; L.add(l); }
  };
  K.monolith = ({ x, y, z, h = 4, color = 0x67e8f9, rot = 0 }) => {
    const m = new THREE.Mesh(tiledBox(1.2, h, 0.6), mat('dark')); m.position.set(x, y + h / 2, z); m.rotation.y = rot; m.castShadow = m.receiveShadow = true; L.add(m);
    K.runes(m, 1.2, h, 0.6, ['+z', '-z']);
    const gl = glowSprite(color, 2, 0.4); gl.position.set(x, y + h + 0.3, z); L.add(gl);
    if (Math.abs(rot) < 0.01) K.plat({ x, y: y + h, z, w: 1.2, d: 0.6, h, rock: false, hidden: true }).active = true;
  };

  /* -------- scenery -------- */
  K.mountains = ({ color = 0x8a7bb0, r0 = 260, n = 16, hmin = 60, hmax = 160, y = -40 }) => {
    const mm = own(new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2, r = r0 + Math.random() * 120, hh = hmin + Math.random() * (hmax - hmin);
      const c = new THREE.Mesh(new THREE.ConeGeometry(hh * 0.7, hh, 7, 3), mm); c.userData.far = true; c.position.set(Math.cos(a) * r, y + hh / 2, Math.sin(a) * r + 80); c.rotation.y = Math.random() * 3; L.add(c);
    }
  };
  K.clouds = ({ y = -30, n = 70, color = 0xffffff, spread = 340, opacity = 0.85 }) => {
    const tex = cloudTex();
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false })));
      s.position.set((Math.random() - 0.5) * spread, y + Math.random() * 10, (Math.random() - 0.5) * spread + 70); s.scale.setScalar(50 + Math.random() * 70); s.userData.far = true; L.add(s);
    }
  };
  K.stars = (n = 1800) => {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * Math.PI * 2, v = Math.random() * 0.48 * Math.PI + 0.04; p[i * 3] = Math.cos(u) * Math.cos(v) * 1600; p[i * 3 + 1] = Math.sin(v) * 1600; p[i * 3 + 2] = Math.sin(u) * Math.cos(v) * 1600; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const s = new THREE.Points(g, own(new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false }))); L.add(s);
  };
  K.floaters = ({ n = 14, color = 0x7c6f9a, center = new V(0, 0, 60), r = 120 }) => {
    for (let i = 0; i < n; i++) {
      const w = 3 + Math.random() * 8, g = new THREE.Group(), a = Math.random() * Math.PI * 2, rr = r * (0.55 + Math.random() * 0.6);
      g.position.set(center.x + Math.cos(a) * rr, center.y - 10 + Math.random() * 40, center.z + Math.sin(a) * rr);
      const rk = new THREE.Mesh(rockUnder(w, w, w * 0.9), own(new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }))); g.add(rk);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.55, w * 0.6, 0.5, 9), own(new THREE.MeshStandardMaterial({ color: 0x6aa85a, roughness: 1, flatShading: true }))); top.position.y = 0.2; g.add(top);
      L.add(g); g.userData.dyn = true; g.userData.far = true; const ph = Math.random() * 6, y0 = g.position.y; L.anim.push((dt, t) => { g.position.y = y0 + Math.sin(t * 0.4 + ph) * 1.2; });
    }
  };

  /* -------- interactables -------- */
  K.shard = (id, x, y, z, taken) => {
    if (taken) return;
    const mm = own(new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb020, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.2, flatShading: true }));
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), mm); m.scale.y = 1.5; g.add(m); g.userData.dyn = m.userData.dyn = true;
    g.add(glowSprite(0xffc94d, 1.6, 0.7));
    const s = { id, g, pos: new V(x, y, z), taken: false }; L.shards.push(s);
    const ph = Math.random() * 6; L.anim.push((dt, t) => { m.rotation.y += dt * 2.5; g.position.y = y + Math.sin(t * 2 + ph) * 0.12; });
  };
  K.checkpoint = (x, y, z, yaw = 0) => {
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.3, 8), mat('dark')); base.position.y = 0.15; base.receiveShadow = true; g.add(base);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.3, 8), mat('dark')); post.position.y = 0.95; post.castShadow = true; g.add(post);
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), own(new THREE.MeshStandardMaterial({ color: 0x64748b, emissive: 0x000000, flatShading: true, roughness: 0.3 }))); cap.position.y = 1.85; g.add(cap); cap.userData.dyn = true;
    const gl = glowSprite(0x7dd3fc, 2.2, 0); gl.position.y = 1.85; g.add(gl);
    const c = { pos: new V(x, y, z), yaw, on: false, cap, gl, g }; L.checkpoints.push(c);
    L.anim.push((dt, t) => { cap.rotation.y += dt * (c.on ? 2 : 0.3); if (c.on) gl.material.opacity = 0.7 + 0.2 * Math.sin(t * 4); });
    return c;
  };
  K.item = ({ id, kind = 'crystal', x, y, z, color = 0x67e8f9 }) => {
    const g = new THREE.Group(); g.position.set(x, y + 0.6, z); L.add(g);
    const mm = own(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.95 }));
    const core = new THREE.Mesh(kind === 'orb' ? new THREE.IcosahedronGeometry(0.3, 1) : new THREE.OctahedronGeometry(0.34, 0), mm); core.castShadow = true; if (kind !== 'orb') core.scale.y = 1.4; g.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.03, 8, 32), own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }))); g.add(ring); g.userData.dyn = core.userData.dyn = ring.userData.dyn = true;
    g.add(glowSprite(color, 2.4, 0.7));
    const it = { id, kind, g, home: new V(x, y + 0.6, z), pos: g.position, carried: false, placed: false, color };
    L.items.push(it);
    L.anim.push((dt, t) => { core.rotation.y += dt * 1.5; ring.rotation.x = t * 1.3; ring.rotation.y = t * 0.9; if (!it.carried && !it.placed) g.position.y = it.home.y + Math.sin(t * 2) * 0.1; });
    return it;
  };
  K.pedestal = ({ x, y, z, accept = 'crystal', need = 1, onFill, color = 0x67e8f9 }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(need > 1 ? 1.4 : 0.7, need > 1 ? 1.6 : 0.85, 0.5, 10), mat('dark')); base.position.y = 0.25; base.castShadow = base.receiveShadow = true; g.add(base);
    const sockets = [];
    for (let i = 0; i < need; i++) {
      const a = (i / need) * Math.PI * 2, sx = need > 1 ? Math.cos(a) * 0.85 : 0, sz = need > 1 ? Math.sin(a) * 0.85 : 0;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 8), mat('gold')); col.position.set(sx, 0.95, sz); col.castShadow = true; g.add(col);
      const gl = glowSprite(color, 1.4, 0.35); gl.position.set(sx, 1.5, sz); g.add(gl);
      sockets.push(new V(x + sx, y + 1.95, z + sz));
    }
    K.plat({ x, y: y + 0.5, z, w: need > 1 ? 2.4 : 1.2, d: need > 1 ? 2.4 : 1.2, h: 0.5, rock: false, hidden: true }).active = true;
    const p = { pos: new V(x, y, z), accept, need, filled: 0, sockets, onFill }; L.pedestals.push(p); return p;
  };
  K.gate = ({ x, y, z, w = 10, h = 6, d = 1, m = 'dark' }) => {
    const b = K.wall({ x, y: y + h, z, w, h, d, m, ledge: false });
    const bars = new THREE.Group(); b.mesh.add(bars);
    const mm = own(new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.2 }));
    for (let i = 0; i < Math.floor(w / 1.2); i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.8, 0.05), mm); r.position.set(-w / 2 + 0.6 + i * 1.2, 0, -d / 2 - 0.03); bars.add(r); }
    const sign = textSprite('🔒 يحتاج البلّورة', { scale: 1.2 }); sign.position.set(0, h / 2 + 0.9, 0); b.mesh.add(sign);
    b.mesh.userData.dyn = true; const gate = { b, open: false, sign };
    gate.openGate = () => {
      if (gate.open) return; gate.open = true; b.active = false; sign.visible = false; let k = 0; const y0 = b.mesh.position.y;
      L.anim.push((dt) => { if (k >= 1) return; k = Math.min(1, k + dt / 2.2); b.mesh.position.y = y0 - h * (1 - Math.pow(1 - k, 2)); });
    };
    return gate;
  };
  K.portal = ({ x, y, z, rot = 0, to, label, color = 0xffc94d, active = true, locked }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; L.add(g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.16, 12, 48), mat('gold')); ring.position.y = 1.7; ring.castShadow = true; g.add(ring);
    [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.6), mat('dark')); p.position.set(s * 1.45, 0.3, 0); g.add(p); });
    const step = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, 0.2, 16), mat('dark')); step.position.y = 0.1; step.receiveShadow = true; g.add(step);
    const um = own(new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, c: { value: new THREE.Color(color) }, on: { value: active ? 1 : 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv;uniform float t;uniform vec3 c;uniform float on;void main(){vec2 p=vUv-.5;float r=length(p)*2.;float a=atan(p.y,p.x);float s=sin(a*6.+t*3.-r*10.)*.5+.5;float core=1.-r;vec3 col=mix(c*.7,vec3(1.),pow(max(core,0.),3.));col*=.8+s*.6;float al=smoothstep(1.,.9,r)*(.35+.5*s*core+.25);vec3 off=vec3(.25,.27,.33)*(.6+.4*s);gl_FragColor=vec4(mix(off,col,on),al*mix(.55,1.,on));}',
    }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.32, 48), um); disc.position.y = 1.7; g.add(disc);
    const gl = glowSprite(color, 5, active ? 0.6 : 0.1); gl.position.y = 1.7; g.add(gl);
    const lab = textSprite(label, { scale: 0.85, glow: '#' + new THREE.Color(color).getHexString() }); lab.position.y = 3.75; g.add(lab);
    const P = { pos: new V(x, y, z), to, active, locked, um, gl, label: lab, color };
    P.setActive = (v) => { P.active = v; um.uniforms.on.value = v ? 1 : 0; gl.material.opacity = v ? 0.6 : 0.1; };
    L.portals.push(P);
    L.anim.push((dt, t) => { um.uniforms.t.value = t; });
    // pillars are solid
    [-1, 1].forEach((s) => K.plat({ x: x + Math.cos(rot) * s * 1.45, y: y + 0.6, z: z - Math.sin(rot) * s * 1.45, w: 0.5, d: 0.5, h: 0.6, rock: false, hidden: true }).active = true);
    return P;
  };
  /* -------- swing bars, traps, timed gates -------- */
  K.bar = ({ x, y, z, len = 4, axis = 'x' }) => {
    L.bars = L.bars || [];
    const g = new THREE.Group(); g.position.set(x, y, z); if (axis === 'z') g.rotation.y = Math.PI / 2; L.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 12), mat('gold')); pole.rotation.z = Math.PI / 2; pole.castShadow = true; g.add(pole);
    [-1, 1].forEach((s) => {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat('gold')); cap.position.x = s * len / 2; g.add(cap);
      for (let i = 0; i < 10; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 10), mat('dark', { metalness: 0.6, roughness: 0.4 })); l.position.set(s * len / 2, 0.15 + i * 0.15, 0); l.rotation.y = (i % 2) * Math.PI / 2; g.add(l); }
    });
    const gl = glowSprite(0xffd166, 1.4, 0.45); g.add(gl);
    L.bars.push({ p: new V(x, y, z), axis, half: len / 2 - 0.1 });
  };
  K.blade = ({ x, y, z, len = 3.6, amp = 1.1, speed = 2.2, phase = 0, plane = 'x' }) => {
    L.hazards = L.hazards || [];
    const g = new THREE.Group(); g.position.set(x, y, z); if (plane === 'z') g.rotation.y = Math.PI / 2; L.add(g);
    const arm = new THREE.Group(); g.add(arm); arm.userData.dyn = true;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), mat('dark', { metalness: 0.7, roughness: 0.35 })); rod.position.y = -len / 2; rod.castShadow = true; arm.add(rod);
    const sh = new THREE.Shape(); sh.absarc(0, 0, 0.9, Math.PI * 1.05, Math.PI * 1.95, false); sh.lineTo(0, -0.1); sh.closePath();
    const bl = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }), own(new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 0.95, roughness: 0.15, emissive: 0x7f1d1d, emissiveIntensity: 0.25 })));
    bl.position.set(0, -len + 0.35, -0.025); bl.castShadow = true; arm.add(bl);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), mat('dark')); g.add(cap);
    const hz = { kind: 'blade', tip: new V(), mid: new V() };
    L.anim.push((dt, t) => {
      const a = amp * Math.sin(t * speed + phase); arm.rotation.z = a;
      const ox = Math.sin(a) * (len - 0.6), oy = -Math.cos(a) * (len - 0.6), mx = Math.sin(a) * (len - 1.3), my = -Math.cos(a) * (len - 1.3);
      if (plane === 'x') { hz.tip.set(x + ox, y + oy, z); hz.mid.set(x + mx, y + my, z); } else { hz.tip.set(x, y + oy, z - ox); hz.mid.set(x, y + my, z - mx); }
    });
    L.hazards.push(hz);
  };
  K.spikes = ({ x, y, z, w = 4, d = 2, period = 2.6, phase = 0, upFor = 1.1 }) => {
    L.hazards = L.hazards || [];
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), own(new THREE.MeshStandardMaterial({ color: 0x3b2a1a, roughness: 0.9 }))); base.position.y = 0.02; base.receiveShadow = true; g.add(base);
    const nx = Math.max(2, Math.round(w / 0.5)), nz = Math.max(2, Math.round(d / 0.5)), cone = new THREE.ConeGeometry(0.1, 0.55, 6);
    const im = new THREE.InstancedMesh(cone, mat('dark', { metalness: 0.8, roughness: 0.3 }), nx * nz); im.castShadow = true; g.add(im);
    const hz = { kind: 'spikes', x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y, up: false };
    const m4 = new THREE.Matrix4();
    L.anim.push((dt, t) => {
      const ph = ((t + phase) % period + period) % period, warn = ph > period - 0.45 && ph < period;
      const k = ph < upFor ? Math.min(1, ph / 0.08) : ph < upFor + 0.25 ? 1 - (ph - upFor) / 0.25 : 0;
      hz.up = ph < upFor; base.material.emissive.setHex(warn ? 0x7a1a00 : 0x000000);
      let i = 0; for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) { m4.makeTranslation(-w / 2 + (a + 0.5) * w / nx, -0.3 + k * 0.55, -d / 2 + (b + 0.5) * d / nz); im.setMatrixAt(i++, m4); }
      im.instanceMatrix.needsUpdate = true;
    });
    L.hazards.push(hz);
  };
  K.timedGate = ({ x, y, z, w = 10, h = 6, d = 1, plate, time = 8 }) => {
    const b = K.wall({ x, y: y + h, z, w, h, d, m: 'sand', ledge: false });
    const bars = own(new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff7a00, emissiveIntensity: 1 }));
    for (let i = 0; i < Math.floor(w / 1.2); i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.1, h * 0.8, 0.05), bars); r.position.set(-w / 2 + 0.6 + i * 1.2, 0, -d / 2 - 0.03); b.mesh.add(r); }
    const pg = new THREE.Group(); pg.position.set(plate.x, plate.y, plate.z); L.add(pg);
    const pm = own(new THREE.MeshStandardMaterial({ color: 0xd4a24a, emissive: 0xffb020, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.4 }));
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.12, 20), pm); pad.position.y = 0.06; pad.receiveShadow = true; pg.add(pad);
    pg.add(Object.assign(glowSprite(0xffb020, 2.4, 0.4), {}));
    b.mesh.userData.dyn = pad.userData.dyn = true;
    const G = { b, h, y0: b.mesh.position.y, open: 0, left: 0, plate: new V(plate.x, plate.y, plate.z), time, pad };
    L.gates = L.gates || []; L.gates.push(G);
    L.anim.push((dt) => { const target = G.left > 0 ? 1 : 0; G.open += (target - G.open) * Math.min(1, dt * (target ? 6 : 3)); b.mesh.position.y = G.y0 - h * 0.97 * G.open; pad.position.y = G.left > 0 ? 0.02 : 0.06; });
    return G;
  };
  K.palm = ({ x, y, z, s = 1 }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); L.add(g); g.userData.batchable = true;
    const tm = own(new THREE.MeshStandardMaterial({ color: 0x8b6a43, roughness: 1, flatShading: true }));
    let px = 0, py = 0; for (let i = 0; i < 7; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.012, 0.2 - i * 0.012, 0.75, 7), tm); px += 0.08 * i * 0.25; py += 0.7; seg.position.set(px, py, 0); seg.rotation.z = -0.05 * i; seg.castShadow = true; g.add(seg); }
    const lm = own(new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.8, side: THREE.DoubleSide, flatShading: true }));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 4, 1, true), lm); leaf.scale.z = 0.25; leaf.position.set(px + Math.cos(a) * 1.0, py + 0.1, Math.sin(a) * 1.0); leaf.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25); leaf.castShadow = true; g.add(leaf); }
    K.plat({ x, y: y + 2, z, w: 0.45 * s, d: 0.45 * s, h: 2, rock: false, hidden: true }).active = true;
  };
  K.dunes = ({ n = 26, color = 0xe0b87a, y = -30 }) => {
    const mm = own(new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    for (let i = 0; i < n; i++) { const r = 40 + Math.random() * 60, m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mm); m.scale.y = 0.18 + Math.random() * 0.12; const a = Math.random() * Math.PI * 2, rr = 60 + Math.random() * 260; m.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr + 60); m.receiveShadow = true; m.userData.far = true; L.add(m); }
  };
  /* -------- water, lava, stealth -------- */
  K.water = ({ x0, x1, z0, z1, y0, y1, color = 0x1aa3c4 }) => {
    L.waters = L.waters || []; const W = { x0, x1, z0, z1, y0, y1 }; L.waters.push(W);
    const w = x1 - x0, d = z1 - z0, geo = new THREE.PlaneGeometry(w, d, Math.ceil(w / 1.5), Math.ceil(d / 1.5)); geo.rotateX(-Math.PI / 2);
    const um = own(new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, c: { value: new THREE.Color(color) }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: true,
      vertexShader: '#include <fog_pars_vertex>\nuniform float t;varying vec3 wp;void main(){vec3 p=position;p.y+=sin(p.x*.6+t*1.6)*.08+cos(p.z*.5+t*1.3)*.08;vec4 w=modelMatrix*vec4(p,1.);wp=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: '#include <fog_pars_fragment>\nuniform float t;uniform vec3 c;varying vec3 wp;void main(){float a=sin(wp.x*1.3+t*2.)*sin(wp.z*1.1-t*1.7);float s=smoothstep(.6,1.,a);vec3 col=mix(c,vec3(.85,1.,1.),s*.6);gl_FragColor=vec4(col,.62+s*.2);\n#include <fog_fragment>\n}',
    }));
    const m = new THREE.Mesh(geo, um); m.position.set((x0 + x1) / 2, y1, (z0 + z1) / 2); L.add(m);
    L.anim.push((dt, t) => { um.uniforms.t.value = t; });
    return W;
  };
  K.current = ({ x0, x1, z0, z1, fx = 0, fz = 0, y = -3 }) => {
    L.currents = L.currents || []; L.currents.push({ x0, x1, z0, z1, fx, fz });
    L.anim.push(() => { if (Math.random() < 0.5 && L.emit) L.emit(new V(x0 + Math.random() * (x1 - x0), y + (Math.random() - 0.5) * 8, z0 + Math.random() * (z1 - z0)), { color: 0xcffafe, count: 1, speed: 0.2, life: 1.6, size: 0.14, grav: -0.3, vel: new V(fx * 0.8, 0, fz * 0.8) }); });
  };
  K.bubble = (x, y, z) => {
    L.bubbles = L.bubbles || [];
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), own(new THREE.MeshStandardMaterial({ color: 0xe0ffff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, emissive: 0x66ccff, emissiveIntensity: 0.4 }))); g.add(m); m.userData.dyn = true;
    g.add(glowSprite(0xaeeaff, 1.6, 0.5));
    const B = { g, pos: new V(x, y, z), t: 0 }; L.bubbles.push(B);
    L.anim.push((dt, t) => { m.scale.setScalar(1 + Math.sin(t * 3 + x) * 0.08); });
  };
  K.jelly = ({ x, y, z, amp = 2, speed = 1, phase = 0, ax = 'y' }) => {
    L.hazards = L.hazards || [];
    const g = new THREE.Group(); L.add(g);
    const mm = own(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 0.9, transparent: true, opacity: 0.75, roughness: 0.2 }));
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mm); g.add(bell); g.userData.dyn = bell.userData.dyn = true;
    for (let i = 0; i < 6; i++) { const tn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 1.2, 4), mm); const a = i / 6 * Math.PI * 2; tn.position.set(Math.cos(a) * 0.3, -0.6, Math.sin(a) * 0.3); g.add(tn); }
    g.add(glowSprite(0xf472b6, 2.4, 0.5));
    const hz = { kind: 'orb', tip: new V(), r: 0.95 }; L.hazards.push(hz);
    L.anim.push((dt, t) => { const o = Math.sin(t * speed + phase) * amp; g.position.set(x + (ax === 'x' ? o : 0), y + (ax === 'y' ? o : 0), z + (ax === 'z' ? o : 0)); bell.scale.y = 1 + Math.sin(t * 4 + phase) * 0.15; hz.tip.copy(g.position); });
  };
  K.kelp = ({ x, y, z, h = 5, color = 0x2f9e44 }) => {
    const geo = new THREE.PlaneGeometry(0.5, h, 1, 8); geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, own(new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 }))); m.position.set(x, y, z); m.rotation.y = Math.random() * 3; L.add(m); m.userData.nobatch = true;
    const p = geo.attributes.position, base = Float32Array.from(p.array), ph = Math.random() * 6;
    L.anim.push((dt, t) => { for (let i = 0; i < p.count; i++) { const yy = base[i * 3 + 1]; p.array[i * 3] = base[i * 3] + Math.sin(t * 1.3 + yy * 0.6 + ph) * 0.25 * (yy / h); } p.needsUpdate = true; });
  };
  K.coral = ({ x, y, z, color = 0xfb7185, s = 1 }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); L.add(g); g.userData.batchable = true;
    const mm = own(new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.15, flatShading: true }));
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.8 + Math.random() * 0.8, 6), mm); c.position.set((Math.random() - 0.5) * 0.7, 0.4, (Math.random() - 0.5) * 0.7); c.rotation.set((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9); g.add(c); const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mm); b.position.copy(c.position).multiplyScalar(1.6); b.position.y = 0.9 + Math.random() * 0.5; g.add(b); }
  };
  K.fish = ({ x, y, z, n = 14, color = 0xfbbf24, r = 3 }) => {
    const geo = new THREE.ConeGeometry(0.12, 0.45, 5); geo.rotateX(Math.PI / 2);
    const im = new THREE.InstancedMesh(geo, own(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.4 })), n); L.add(im);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V(1, 1, 1), pv = new V();
    const seeds = Array.from({ length: n }, () => [Math.random() * 6, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 2]);
    L.anim.push((dt, t) => { seeds.forEach(([ph, sp, oy], i) => { const a = t * sp * 0.6 + ph; pv.set(x + Math.cos(a) * r, y + oy + Math.sin(t + ph) * 0.4, z + Math.sin(a) * r); e.set(0, -a, 0); q.setFromEuler(e); m4.compose(pv, q, sc); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; });
  };
  K.lava = ({ y = -2, size = 600, cz = 60 }) => {
    const geo = new THREE.PlaneGeometry(size, size, 1, 1); geo.rotateX(-Math.PI / 2);
    const um = own(new THREE.ShaderMaterial({ uniforms: { t: { value: 0 } },
      vertexShader: 'varying vec3 wp;void main(){vec4 w=modelMatrix*vec4(position,1.);wp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: 'uniform float t;varying vec3 wp;float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}void main(){vec2 p=wp.xz*.12;float v=n(p+t*.05)*.6+n(p*2.3-t*.08)*.3+n(p*5.+t*.2)*.1;float c=smoothstep(.35,.75,v);vec3 col=mix(vec3(.35,.03,0.),vec3(2.2,.75,.12),c);col+=vec3(1.5,.9,.3)*smoothstep(.8,.95,v);gl_FragColor=vec4(col,1.);}',
    }));
    const m = new THREE.Mesh(geo, um); m.position.set(0, y, cz); L.add(m);
    L.anim.push((dt, t) => { um.uniforms.t.value = t; });
    if (L.lights < 6) { const pl = new THREE.PointLight(0xff5a1f, 0, 0); L.lights++; }
  };
  K.geyser = ({ x, y, z, period = 3, phase = 0, on = 1.1 }) => {
    L.hazards = L.hazards || [];
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.25, 10), mat('dark')); vent.position.y = 0.12; g.add(vent);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 5, 12, 1, true), own(new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))); col.position.y = 2.5; g.add(col); col.userData.dyn = true;
    const gl = glowSprite(0xff6a00, 3, 0.8); gl.position.y = 0.4; g.add(gl);
    const hz = { kind: 'geyser', x, y, z, on: false }; L.hazards.push(hz);
    L.anim.push((dt, t) => { const ph = ((t + phase) % period + period) % period; hz.on = ph < on; const warn = ph > period - 0.6; col.visible = hz.on; col.scale.set(1, hz.on ? 1 + Math.sin(t * 30) * 0.05 : 1, 1); gl.material.opacity = hz.on ? 1 : warn ? 0.5 + 0.5 * Math.sin(t * 25) : 0.25;
      if (hz.on && L.emit && Math.random() < 0.6) L.emit(new V(x, y + 0.5, z), { color: 0xffa040, count: 2, speed: 3, up: 3, life: 0.8, size: 0.35, grav: -4 }); });
  };
  K.shadowZone = ({ x, z, y = 0, w = 3, d = 6 }) => {
    L.shadows = L.shadows || []; L.shadows.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y });
    const gm = own(new THREE.MeshStandardMaterial({ color: 0x1f3d2b, roughness: 1, flatShading: true }));
    for (let i = 0; i < Math.round(w * d * 1.6); i++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.1 + Math.random() * 0.5, 4), gm); b.position.set(x + (Math.random() - 0.5) * w, y + 0.55, z + (Math.random() - 0.5) * d); b.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 3, (Math.random() - 0.5) * 0.4); L.add(b); }
  };
  K.relic = ({ x, y, z, color = 0xa78bfa }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 14), own(new THREE.MeshStandardMaterial({ color: 0xf5e6c8, emissive: color, emissiveIntensity: 0.4 }))); scroll.rotation.z = Math.PI / 2; scroll.position.y = 1.3; g.add(scroll); scroll.userData.dyn = true;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1, 8), mat('dark')); ped.position.y = 0.5; g.add(ped);
    const gl = glowSprite(color, 2.6, 0.7); gl.position.y = 1.3; g.add(gl);
    L.anim.push((dt, t) => { scroll.position.y = 1.3 + Math.sin(t * 2) * 0.08; scroll.rotation.y = t; });
    return g;
  };
  /* -------- ship world: ocean, storm, containers, lockers, searchlights, ammo -------- */
  K.ocean = ({ y = -3, size = 900, cz = 40, hole = null }) => {
    const geo = new THREE.PlaneGeometry(size, size, 120, 120); geo.rotateX(-Math.PI / 2);
    const um = own(new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } }, fog: true,
      vertexShader: '#include <fog_pars_vertex>\nuniform float t;varying float h;varying vec3 wp;void main(){vec3 p=position;float a=sin(p.x*.05+t*.9)*1.1+sin(p.z*.07-t*1.2)*.9+sin((p.x+p.z)*.13+t*1.7)*.35;p.y+=a;h=a;vec4 w=modelMatrix*vec4(p,1.);wp=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: '#include <fog_pars_fragment>\nuniform float t;varying float h;varying vec3 wp;void main(){' + (hole ? `if(wp.x>${hole[0].toFixed(2)}&&wp.x<${hole[1].toFixed(2)}&&wp.z>${hole[2].toFixed(2)}&&wp.z<${hole[3].toFixed(2)})discard;` : '') + 'float f=smoothstep(1.2,2.3,h+sin(wp.x*.8+t*3.)*.3);vec3 c=mix(vec3(.02,.05,.08),vec3(.07,.15,.2),clamp(h*.3+.5,0.,1.));c=mix(c,vec3(.7,.8,.85),f*.6);gl_FragColor=vec4(c,1.);\n#include <fog_fragment>\n}',
    }));
    const m = new THREE.Mesh(geo, um); m.position.set(0, y, cz); L.add(m); L.anim.push((dt, t) => { um.uniforms.t.value = t; });
  };
  K.rain = () => {
    const n = 1400, g = new THREE.BufferGeometry(), p = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 50, y = Math.random() * 30, z = (Math.random() - 0.5) * 50; p.set([x, y, z, x + 0.15, y - 0.9, z + 0.1], i * 6); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const rm = new THREE.LineSegments(g, own(new THREE.LineBasicMaterial({ color: 0x9fb8c9, transparent: true, opacity: 0.35 }))); rm.frustumCulled = false; rm.userData.dyn = true; L.add(rm); L.rainMesh = rm;
    L.anim.push((dt) => { const a = g.attributes.position.array; for (let i = 0; i < a.length; i += 6) { a[i + 1] -= 26 * dt; a[i + 4] -= 26 * dt; if (a[i + 4] < -2) { a[i + 1] += 30; a[i + 4] += 30; } } g.attributes.position.needsUpdate = true; });
  };
  const CONT = [0x9b2c2c, 0x1e4e8c, 0x2f6b3a, 0xb7791f, 0x4a4e69, 0x7c2d12];
  K.container = ({ x, y = 0, z, rot = 0, color, stack = 1 }) => {
    for (let k = 0; k < stack; k++) {
      const w = rot ? 6 : 2.5, d = rot ? 2.5 : 6, h = 2.6, yy = y + h * (k + 1);
      const b = K.plat({ x, y: yy, z, w, d, h, rock: false, m: own(new THREE.MeshStandardMaterial({ color: color ?? CONT[(Math.abs(Math.round(x * 3 + z + k)) % CONT.length)], roughness: 0.55, metalness: 0.45 })) });
      // corrugation ribs
      const rib = own(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.35 }));
      const along = rot ? w : d; for (let i = -along / 2 + 0.4; i < along / 2; i += 0.55) { const r = new THREE.Mesh(new THREE.BoxGeometry(rot ? 0.06 : w + 0.02, h - 0.2, rot ? d + 0.02 : 0.06), rib); r.position.set(rot ? i : 0, 0, rot ? 0 : i); b.mesh.add(r); }
    }
  };
  K.railing = ({ x0, x1, z0, z1, y = 0 }) => {
    const len = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    K.plat({ x: cx, y: y + 1.1, z: cz, w: alongX ? len : 0.12, d: alongX ? 0.12 : len, h: 1.1, rock: false, hidden: true, ledge: false }).active = true;
    const mm = mat('dark', { metalness: 0.7, roughness: 0.4 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.08, 0.08, alongX ? 0.08 : len), mm); top.position.set(cx, y + 1.05, cz); L.add(top);
    const mid = top.clone(); mid.position.y = y + 0.55; L.add(mid);
    for (let i = 0; i <= len; i += 2) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.07), mm); post.position.set(alongX ? x0 + Math.sign(x1 - x0) * i : cx, y + 0.55, alongX ? cz : z0 + Math.sign(z1 - z0) * i); L.add(post); }
  };
  K.locker = ({ x, y = 0, z, rot = 0 }) => {
    L.lockers = L.lockers || [];
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; L.add(g); g.userData.batchable = true; // جسم الخزانة ثابت = يندمج (الباب متحرك ويبقى لحاله)
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.8), own(new THREE.MeshStandardMaterial({ color: 0x5b6b7a, roughness: 0.5, metalness: 0.6 }))); body.position.y = 1.05; body.castShadow = true; g.add(body);
    for (let i = 0; i < 4; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.02), mat('dark')); v.position.set(0, 1.6 + i * 0.08, 0.41); g.add(v); }
    const lab = textSprite('خزانة', { size: 40, scale: 0.35, glow: '#94a3b8' }); lab.position.y = 2.5; g.add(lab);
    const fwd = new V(Math.sin(rot), 0, Math.cos(rot));
    const b = K.plat({ x, y: y + 2.1, z, w: rot % Math.PI ? 0.8 : 1.1, d: rot % Math.PI ? 1.1 : 0.8, h: 2.1, rock: false, hidden: true }); b.active = true;
    const hinge = new THREE.Group(); hinge.position.set(-0.55, 0, 0.41); g.add(hinge); hinge.userData.dyn = true;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.08, 2.05, 0.04), own(new THREE.MeshStandardMaterial({ color: 0x6b7c8c, roughness: 0.45, metalness: 0.65 }))); door.position.set(0.54, 1.05, 0); hinge.add(door);
    const Lk = { pos: new V(x, y, z), front: new V(x, y, z).addScaledVector(fwd, 0.95), yaw: rot, body: null, g, openT: 0, hinge };
    L.anim.push((dt) => { Lk.openT = Math.max(0, Lk.openT - dt * 1.4); hinge.rotation.y = -Math.min(1, Lk.openT * 2) * 1.7; });
    L.lockers.push(Lk); return Lk;
  };
  K.searchlight = ({ x, y, z, from = -1, to = 1, speed = 0.5, range = 16, tilt = 0.45 }) => {
    L.searchlights = L.searchlights || [];
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.4, 10), mat('dark')); g.add(base);
    const head = new THREE.Group(); head.position.y = 0.45; g.add(head); head.userData.dyn = true;
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.6, 12), mat('dark', { metalness: 0.6 })); lamp.rotation.x = Math.PI / 2; head.add(lamp);
    const geo = new THREE.ConeGeometry(Math.tan(0.22) * range, range, 24, 1, true); geo.translate(0, -range / 2, 0); geo.rotateX(-Math.PI / 2);
    const cone = new THREE.Mesh(geo, own(new THREE.MeshBasicMaterial({ color: 0xfffbe0, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending }))); head.add(cone);
    const S = { pos: new V(x, y + 0.45, z), head, cone, yaw: 0, tilt, range, cos: Math.cos(0.22) };
    L.anim.push((dt, t) => { S.yaw = from + (to - from) * (0.5 + 0.5 * Math.sin(t * speed)); head.rotation.set(tilt, S.yaw, 0, 'YXZ'); });
    L.searchlights.push(S); return S;
  };
  K.ammo = (id, x, y, z, kind = 'pistol', taken) => {
    if (taken) return; L.ammo = L.ammo || [];
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g); g.userData.dyn = true;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), own(new THREE.MeshStandardMaterial({ color: kind === 'sniper' ? 0x14532d : 0x1e3a8a, roughness: 0.5, metalness: 0.4, emissive: kind === 'sniper' ? 0x16a34a : 0x2563eb, emissiveIntensity: 0.4 }))); g.add(box);
    g.add(glowSprite(kind === 'sniper' ? 0x4ade80 : 0x60a5fa, 1.4, 0.6));
    const A = { id, g, pos: new V(x, y, z), kind, taken: false }; L.ammo.push(A);
    L.anim.push((dt, t) => { g.rotation.y += dt; g.position.y = y + Math.sin(t * 2 + x) * 0.08; });
  };
  K.funnel = ({ x, y, z, r = 1.6, h = 7 }) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 20), own(new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6, metalness: 0.4 }))); m.position.set(x, y + h / 2, z); m.castShadow = true; L.add(m);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, 0.9, 20), own(new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.5 }))); band.position.set(x, y + h * 0.7, z); L.add(band);
    K.plat({ x, y: y + h, z, w: r * 1.6, d: r * 1.6, h, rock: false, hidden: true }).active = true;
  };
  /* -------- interiors: walls with doors, slabs, stairs, machines, consoles, keycards -------- */
  K.slab = ({ x0, x1, z0, z1, y, h = 0.4, m = 'metal', hidden = false }) => K.plat({ x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h, m, rock: false, hidden, ledge: false, tile: 3 });
  K.door = ({ x, y, z, axis, w = 1.7, h = 2.5, lock = null, color = 0x64748b }) => {
    L.doors = L.doors || [];
    const b = K.plat({ x, y: y + h, z, w: axis === 'x' ? w : 0.22, d: axis === 'x' ? 0.22 : w, h, rock: false, ledge: false, m: own(new THREE.MeshStandardMaterial({ color: lock ? 0x7f1d1d : color, roughness: 0.4, metalness: 0.7 })) });
    b.door = true; b.mesh.userData.dyn = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? w * 0.9 : 0.24, 0.12, axis === 'x' ? 0.24 : w * 0.9), own(new THREE.MeshBasicMaterial({ color: lock ? 0xff4d4d : 0xfacc15 }))); stripe.position.y = 0.2; b.mesh.add(stripe);
    if (lock) { const s2 = textSprite('🔒 ' + lock, { size: 38, scale: 0.4, glow: '#ff4d4d' }); s2.position.y = h / 2 + 0.35; b.mesh.add(s2); }
    const D = { b, base: b.mesh.position.y, h, open: 0, lock, pos: new V(x, y, z), stripe }; L.doors.push(D); return D;
  };
  K.wallLine = ({ axis, at, from, to, y = 0, h = 3, t = 0.3, doors = [], m = 'metal' }) => {
    // axis 'x': wall runs along x at z = at ; axis 'z': runs along z at x = at
    const cuts = doors.map((d) => ({ c: d.c, w: d.w || 1.7 })).sort((a, b) => a.c - b.c); let cur = from;
    const seg = (a, b2) => { if (b2 - a < 0.05) return; const c = (a + b2) / 2, len = b2 - a; K.plat(axis === 'x' ? { x: c, y: y + h, z: at, w: len, d: t, h, m, rock: false, ledge: false } : { x: at, y: y + h, z: c, w: t, d: len, h, m, rock: false, ledge: false }); };
    for (const c of cuts) { seg(cur, c.c - c.w / 2); cur = c.c + c.w / 2; }
    seg(cur, to);
    for (const d of doors) { const dh = Math.min(2.5, h - 0.2); if (h - dh > 0.05) K.plat(axis === 'x' ? { x: d.c, y: y + h, z: at, w: d.w || 1.7, d: t, h: h - dh, m, rock: false, ledge: false } : { x: at, y: y + h, z: d.c, w: t, d: d.w || 1.7, h: h - dh, m, rock: false, ledge: false });
      if (!d.open) K.door({ x: axis === 'x' ? d.c : at, y, z: axis === 'x' ? at : d.c, axis, w: (d.w || 1.7) - 0.05, h: dh, lock: d.lock }); }
  };
  K.stairs = ({ x, z, w = 2.4, y0, y1, dir = '+z', run = 0.42 }) => {
    const n = Math.ceil((y1 - y0) / 0.3), rise = (y1 - y0) / n, sx = dir === '+x' ? 1 : dir === '-x' ? -1 : 0, sz = dir === '+z' ? 1 : dir === '-z' ? -1 : 0;
    for (let i = 0; i < n; i++) { const top = y0 + rise * (i + 1), cx = x + sx * (i + 0.5) * run, cz = z + sz * (i + 0.5) * run; K.plat({ x: cx, y: top, z: cz, w: sx ? run : w, d: sz ? run : w, h: top - y0 + 0.05, m: 'metal', rock: false, ledge: false, tile: 1 }); }
    return { endX: x + sx * n * run, endZ: z + sz * n * run };
  };
  K.lamp = ({ x, y, z, color = 0xfff1c1, light = false }) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.3), own(new THREE.MeshBasicMaterial({ color }))); m.position.set(x, y, z); L.add(m);
    const g = glowSprite(color, 3.4, 0.45); g.position.set(x, y - 0.2, z); L.add(g);
    if (light && L.lights < 8) { const pl = new THREE.PointLight(color, 14, 14, 1.6); pl.position.set(x, y - 0.4, z); L.add(pl); L.lights++; }
  };
  K.machine = ({ x, y = 0, z, w = 3, d = 5, h = 2.6, color = 0x3b4a5a }) => {
    K.plat({ x, y: y + h, z, w, d, h, rock: false, m: own(new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.7 })) });
    const pm = mat('dark', { metalness: 0.8, roughness: 0.35 });
    for (let i = 0; i < 3; i++) { const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, h + 1.6, 10), pm); p2.position.set(x - w / 2 + 0.4 + i * (w - 0.8) / 2, y + (h + 1.6) / 2, z + d / 2 - 0.3); L.add(p2); }
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, h) * 0.42, Math.min(w, h) * 0.42, d * 0.9, 18), own(new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.35, metalness: 0.85 }))); cyl.rotation.x = Math.PI / 2; cyl.position.set(x, y + h + 0.05, z); L.add(cyl);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.05), own(new THREE.MeshBasicMaterial({ color: 0x22c55e }))); led.position.set(x, y + h * 0.6, z - d / 2 - 0.03); L.add(led);
  };
  K.steam = ({ x, y, z, period = 3.2, phase = 0 }) => {
    L.hazards = L.hazards || [];
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.2, 10), mat('metal')); vent.position.y = 0.1; g.add(vent);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, 3.2, 12, 1, true), own(new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }))); col.position.y = 1.6; col.userData.dyn = true; g.add(col);
    const hz = { kind: 'geyser', x, y, z, on: false, soft: true }; L.hazards.push(hz);
    L.anim.push((dt, t) => { const ph = ((t + phase) % period + period) % period; hz.on = ph < 1.0; col.visible = hz.on; col.scale.set(1, 1 + Math.sin(t * 20) * 0.05, 1); if (hz.on && L.emit && Math.random() < 0.5) L.emit(new V(x, y + 0.4, z), { color: 0xffffff, count: 2, speed: 2, up: 2.5, life: 0.9, size: 0.5, grav: -2 }); });
  };
  K.panel = ({ x, y, z, rot = 0, group, label = 'لوحة' }) => {
    L.panels = L.panels || [];
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; L.add(g);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.4), own(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.6 }))); box.position.y = 0.75; g.add(box);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), own(new THREE.MeshBasicMaterial({ color: 0x22d3ee }))); scr.position.set(0, 1.05, 0.21); g.add(scr);
    const gl = glowSprite(0x22d3ee, 1.6, 0.5); gl.position.set(0, 1.05, 0.4); g.add(gl);
    const P = { pos: new V(x, y, z), front: new V(x + Math.sin(rot) * 0.9, y, z + Math.cos(rot) * 0.9), done: false, group, label, scr, gl };
    L.panels.push(P); return P;
  };
  K.keycard = ({ x, y, z, id, name }) => {
    L.cards = L.cards || [];
    const g = new THREE.Group(); g.position.set(x, y + 0.7, z); L.add(g); g.userData.dyn = true;
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.03), own(new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.3 }))); g.add(c);
    g.add(glowSprite(0xfacc15, 1.5, 0.6));
    const C = { id, name, g, pos: new V(x, y + 0.7, z), taken: false }; L.cards.push(C);
    L.anim.push((dt, t) => { g.rotation.y += dt * 2; g.position.y = y + 0.7 + Math.sin(t * 2.5) * 0.08; });
  };
  K.crates = ({ x, y = 0, z, n = 3, s = 1.2 }) => { for (let i = 0; i < n; i++) { const ox = (i % 2) * s * 1.05 - s * 0.5, oz = Math.floor(i / 2) * s * 1.05, lvl = i >= 4 ? 1 : 0; K.plat({ x: x + ox, y: y + s * (lvl + 1), z: z + oz, w: s, d: s, h: s, m: 'wood', rock: false, tile: 1.2 }); } };
  /* ---------- ألغاز السفينة الكبيرة ---------- */
  K.valve = ({ x, y, z, rot = 0, group, seq, color = 0xef4444, label }) => { // صمّام: لوحة ضمن تسلسل
    const P = K.panel({ x, y, z, rot, group, label }); P.seq = seq; P.scr.material.color.setHex(color); P.baseColor = color; P.gl.material.color.setHex(color);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 8, 18), own(new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 }))); wheel.position.set(x + Math.sin(rot) * 0.32, y + 1.65, z + Math.cos(rot) * 0.32); wheel.rotation.y = rot; L.add(wheel); wheel.userData.dyn = true; P.wheel = wheel;
    return P;
  };
  K.laser = ({ x0, x1, z0, z1, y, h = 2.2, on = 2.2, off = 1.6, phase = 0, axis = 'x' }) => { // شبكة ليزر تشتغل وتطفي
    L.hazards = L.hazards || [];
    const g = new THREE.Group(); L.add(g); g.userData.dyn = true; const mm = own(new THREE.MeshBasicMaterial({ color: 0xff1f3d, transparent: true, opacity: 0.85 }));
    const len = axis === 'x' ? x1 - x0 : z1 - z0; for (let k = 0; k < 5; k++) { const beam = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? len : 0.04, 0.04, axis === 'x' ? 0.04 : len), mm); beam.position.set((x0 + x1) / 2, y + 0.25 + k * (h / 5), (z0 + z1) / 2); g.add(beam); }
    const hz = { kind: 'laser', x0, x1, z0, z1, y, h, on: true, dead: false, g }; L.hazards.push(hz); L.lasers = L.lasers || []; L.lasers.push(hz);
    L.anim.push((dt, t) => { if (hz.dead) { g.visible = false; hz.on = false; return; } const ph = ((t + phase) % (on + off)); hz.on = ph < on; g.visible = hz.on || (ph > on + off - 0.35 && Math.sin(t * 40) > 0); });
    return hz;
  };
  K.fusebox = ({ x, y, z, rot = 0, onShot }) => { // صندوق كهرباء — صوّب عليه بالمسدس
    L.shootables = L.shootables || [];
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.3), own(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 }))); box.position.set(x, y, z); box.rotation.y = rot; L.add(box); box.userData.dyn = true;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), own(new THREE.MeshBasicMaterial({ color: 0x22c55e }))); led.position.set(x + Math.sin(rot) * 0.17, y + 0.3, z + Math.cos(rot) * 0.17); L.add(led); led.userData.dyn = true;
    const glow = glowSprite(0x22c55e, 1.2, 0.6); glow.position.copy(led.position); L.add(glow);
    const S = { pos: new V(x, y, z), r: 0.55, done: false, fn: () => { if (S.done) return; S.done = true; led.material.color.setHex(0xef4444); glow.material.color.setHex(0xef4444); onShot && onShot(); } };
    L.shootables.push(S); return S;
  };
  K.keypad = ({ x, y, z, rot = 0, code, label = 'قفل رقمي', onOpen }) => { // لوحة أرقام — الكود من أوراق مخبّاة
    L.keypads = L.keypads || [];
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.12), own(new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.6 }))); b.position.set(x, y + 1.3, z); b.rotation.y = rot; L.add(b);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.14), own(new THREE.MeshBasicMaterial({ color: 0x22d3ee }))); scr.position.set(x + Math.sin(rot) * 0.07, y + 1.5, z + Math.cos(rot) * 0.07); scr.rotation.y = rot; L.add(scr); scr.userData.dyn = true;
    const KP = { pos: new V(x, y, z), front: new V(x + Math.sin(rot) * 0.9, y, z + Math.cos(rot) * 0.9), code: String(code), label, open: false, scr, onOpen }; L.keypads.push(KP); return KP;
  };
  K.note = ({ x, y, z, text, title = 'ورقة' }) => { // ورقة/لوح مكتوب — اقرأه
    L.notes = L.notes || [];
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.6), own(new THREE.MeshBasicMaterial({ color: 0xfef3c7, side: THREE.DoubleSide }))); p.position.set(x, y + 1.2, z); p.rotation.y = Math.random() * 6; L.add(p);
    const g = glowSprite(0xfde68a, 1.0, 0.5); g.position.set(x, y + 1.2, z); L.add(g);
    const lab = textSprite('📄 ' + title, { size: 34, scale: 0.32, glow: '#fde68a' }); lab.position.set(x, y + 1.85, z); L.add(lab);
    const N = { pos: new V(x, y, z), text, title, read: false }; L.notes.push(N); return N;
  };
  K.slider = (b, to, dur = 3.5, done) => { b.slide = { from: b.center.clone(), to: to.clone(), dur, k: 0, go: false, done }; b.mesh.userData.dyn = true; if (!L.dyn.includes(b)) L.dyn.push(b); return b; };
  K.trigger = (o) => { L.triggers.push({ r: 3, dy: 4, once: true, fired: false, ...o, pos: new V(o.x, o.y ?? 0, o.z) }); };
  K.enemy = (o) => { L.enemyDefs.push(o); };
  return K;
}
