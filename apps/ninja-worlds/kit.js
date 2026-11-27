// Level container + builder kit (colliders are axis-aligned boxes; visuals are free-form)
import * as THREE from 'three';
import { mat, glowSprite, runeTex, cloudTex, textSprite } from './fx.js';
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
  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.userData.own) o.material.dispose(); });
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
    const b = { min: new V(x - w / 2, y - h, z - d / 2), max: new V(x + w / 2, y, z + d / 2), run, ledge, beam: Math.min(w, d) < 0.8, active: !hidden, mesh, base: new V(x, y, z), center: new V(x, y, z), delta: new V(), meshBase: mesh.position.clone(), crumble: crumble ? { t: 0, state: 0 } : null, move, kind: o.kind };
    if (rock && h < 4) {
      const r = new THREE.Mesh(rockUnder(w, d, o.rockDepth || Math.max(2.4, Math.min(w, d) * 0.75)), mat('rock', { flatShading: true }));
      r.position.y = -h / 2; r.castShadow = true; r.receiveShadow = true; mesh.add(r);
    }
    if (crumble) { mesh.material = own(mesh.material.clone()); mesh.material.color.setHex(0xd8c6ff); const c = glowSprite(0xb794f6, Math.max(w, d) * 0.9, 0.35); c.position.y = h / 2 + 0.05; mesh.add(c); }
    if (run) K.runes(mesh, w, h, d, runFaces);
    if (hidden) mesh.visible = false;
    L.boxes.push(b); L.camMeshes.push(mesh); if (move || crumble) L.dyn.push(b);
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
    const f1 = glowSprite(color, 1.3, 0.9), f2 = glowSprite(0xfff1c1, 0.6, 0.9); f1.position.y = f2.position.y = 1.55; g.add(f1, f2);
    if (light && L.lights < 6) { const pl = new THREE.PointLight(color, 8, 10, 2); pl.position.y = 1.8; g.add(pl); L.lights++; }
    const ph = Math.random() * 9; L.anim.push((dt, t) => { const k = 1 + 0.15 * Math.sin(t * 13 + ph) + 0.1 * Math.sin(t * 7.3); f1.scale.setScalar(1.3 * k); f1.position.y = 1.55 + 0.05 * Math.sin(t * 9 + ph); });
    K.plat({ x, y: y + 1.35, z, w: 0.6, d: 0.6, h: 1.35, rock: false, hidden: true }).active = true;
    return g;
  };
  K.tree = ({ x, y, z, s = 1, color = 0xf9a8d4 }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); L.add(g);
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
      const c = new THREE.Mesh(new THREE.ConeGeometry(hh * 0.7, hh, 7, 3), mm); c.position.set(Math.cos(a) * r, y + hh / 2, Math.sin(a) * r + 80); c.rotation.y = Math.random() * 3; L.add(c);
    }
  };
  K.clouds = ({ y = -30, n = 70, color = 0xffffff, spread = 340, opacity = 0.85 }) => {
    const tex = cloudTex();
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false })));
      s.position.set((Math.random() - 0.5) * spread, y + Math.random() * 10, (Math.random() - 0.5) * spread + 70); s.scale.setScalar(50 + Math.random() * 70); L.add(s);
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
      L.add(g); const ph = Math.random() * 6, y0 = g.position.y; L.anim.push((dt, t) => { g.position.y = y0 + Math.sin(t * 0.4 + ph) * 1.2; });
    }
  };

  /* -------- interactables -------- */
  K.shard = (id, x, y, z, taken) => {
    if (taken) return;
    const mm = own(new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb020, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.2, flatShading: true }));
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), mm); m.scale.y = 1.5; g.add(m);
    g.add(glowSprite(0xffc94d, 1.6, 0.7));
    const s = { id, g, pos: new V(x, y, z), taken: false }; L.shards.push(s);
    const ph = Math.random() * 6; L.anim.push((dt, t) => { m.rotation.y += dt * 2.5; g.position.y = y + Math.sin(t * 2 + ph) * 0.12; });
  };
  K.checkpoint = (x, y, z, yaw = 0) => {
    const g = new THREE.Group(); g.position.set(x, y, z); L.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.3, 8), mat('dark')); base.position.y = 0.15; base.receiveShadow = true; g.add(base);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.3, 8), mat('dark')); post.position.y = 0.95; post.castShadow = true; g.add(post);
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), own(new THREE.MeshStandardMaterial({ color: 0x64748b, emissive: 0x000000, flatShading: true, roughness: 0.3 }))); cap.position.y = 1.85; g.add(cap);
    const gl = glowSprite(0x7dd3fc, 2.2, 0); gl.position.y = 1.85; g.add(gl);
    const c = { pos: new V(x, y, z), yaw, on: false, cap, gl, g }; L.checkpoints.push(c);
    L.anim.push((dt, t) => { cap.rotation.y += dt * (c.on ? 2 : 0.3); if (c.on) gl.material.opacity = 0.7 + 0.2 * Math.sin(t * 4); });
    return c;
  };
  K.item = ({ id, kind = 'crystal', x, y, z, color = 0x67e8f9 }) => {
    const g = new THREE.Group(); g.position.set(x, y + 0.6, z); L.add(g);
    const mm = own(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.95 }));
    const core = new THREE.Mesh(kind === 'orb' ? new THREE.IcosahedronGeometry(0.3, 1) : new THREE.OctahedronGeometry(0.34, 0), mm); core.castShadow = true; if (kind !== 'orb') core.scale.y = 1.4; g.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.03, 8, 32), own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }))); g.add(ring);
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
    const gate = { b, open: false, sign };
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
  K.trigger = (o) => { L.triggers.push({ r: 3, dy: 4, once: true, fired: false, ...o, pos: new V(o.x, o.y ?? 0, o.z) }); };
  K.enemy = (o) => { L.enemyDefs.push(o); };
  return K;
}
