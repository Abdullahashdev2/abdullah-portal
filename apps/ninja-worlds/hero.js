// The blindfolded ninja (and the calm hero NPC): jointed procedural body + pose blending, physics scarf, sword trail
import * as THREE from 'three';
import { mergeGeometries } from '../saeq-albatal/lib/utils/BufferGeometryUtils.js';

const M = (c, r = 0.6, m = 0, e, ei = 1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...(e != null ? { emissive: e, emissiveIntensity: ei } : {}) });

export function buildHero(variant = 'ninja') {
  const calm = variant === 'calm';
  const skin = M(0xf2c9a8, 0.55), suit = M(calm ? 0x16161c : 0x1c2442, 0.72), suit2 = M(calm ? 0x0c0c10 : 0x10162a, 0.8);
  const trim = M(calm ? 0x9ca3af : 0x60a5fa, 0.35, 0.2, calm ? 0x000000 : 0x1d4ed8, 0.6), hair = M(calm ? 0x111114 : 0xf8fafc, 0.45);
  const band = M(0x08080c, 0.4), red = M(0xdc2626, 0.55), steel = M(0xe9f1f8, 0.18, 0.95), gold = M(0xfbbf24, 0.3, 0.85);
  const G = () => new THREE.Group();
  const cap = (r, len, mat, seg = 10) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, seg), mat); m.castShadow = true; return m; };
  const add = (p, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); p.add(m); m.castShadow = true; return m; };

  const root = G(), body = G(); root.add(body); body.position.y = 0.55;
  const hips = G(); hips.position.y = 0.4; body.add(hips);
  const pel = add(hips, cap(0.15, 0.14, suit)); pel.rotation.z = Math.PI / 2; pel.scale.set(1, 1, 0.85);
  const beltM = add(hips, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 18), calm ? suit2 : red), 0, 0.06, 0);
  const spine = G(); spine.position.y = 0.08; hips.add(spine);
  const torso = add(spine, cap(0.19, 0.26, suit, 14), 0, 0.22, 0); torso.scale.set(1.05, 1, 0.78);
  if (calm) { const coat = add(spine, new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.3, 0.75, 16, 1, true), suit2), 0, -0.05, 0); coat.material.side = THREE.DoubleSide; }
  // chest straps / plate
  const strap = add(spine, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.33), trim), 0, 0.24, 0); strap.rotation.z = 0.55;
  const chest = G(); chest.position.y = 0.4; spine.add(chest);
  add(chest, new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.1, 16), suit2), 0, 0.06, 0);
  const neck = G(); neck.position.y = 0.12; chest.add(neck);
  const head = G(); head.position.y = 0.16; neck.add(head);
  add(head, new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 18), skin)).scale.set(0.95, 1.05, 1);
  // hair
  if (calm) {
    add(head, new THREE.Mesh(new THREE.SphereGeometry(0.158, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hair), 0, 0.012, -0.008);
    add(head, new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), hair), 0, 0.12, -0.11);
    const fringe = add(head, new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 6), hair), 0.07, -0.02, 0.12); fringe.rotation.x = 0.3;
    [-0.055, 0.055].forEach((x) => add(head, new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), band), x, 0.01, 0.135));
    [-1, 1].forEach((s) => add(head, new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 12), gold), s * 0.152, -0.04, 0));
  } else {
    add(head, new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hair), 0, 0.02, -0.01);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + (i % 2) * 0.15, el = 0.35 + (i % 3) * 0.28, len = 0.16 + ((i * 7) % 5) * 0.025;
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, len, 6), hair);
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el) + 0.25, Math.sin(a) * Math.cos(el)).normalize();
      if (dir.z > 0.55) dir.y += 0.5; // keep the face clear
      dir.normalize(); c.position.copy(dir).multiplyScalar(0.13).add(new THREE.Vector3(0, 0.04, -0.01));
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); c.castShadow = true; head.add(c);
    }
    const bf = add(head, new THREE.Mesh(new THREE.CylinderGeometry(0.156, 0.156, 0.065, 28, 1, true), band), 0, 0.015, 0); bf.material.side = THREE.DoubleSide;
    [0.25, -0.25].forEach((r, i) => { const t = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.012), band), (i ? -1 : 1) * 0.03, -0.06, -0.16); t.rotation.z = r; t.rotation.x = 0.4; });
  }
  add(head, new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.01), M(0x9a5a4a)), 0, -0.075, 0.142);
  // arms
  const arm = (side) => {
    const sh = G(); sh.position.set(side * 0.255, 0.02, 0); chest.add(sh);
    add(sh, new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), calm ? suit2 : trim));
    add(sh, cap(0.062, 0.2, suit), 0, -0.15, 0);
    const el = G(); el.position.y = -0.3; sh.add(el);
    add(el, cap(0.056, 0.18, suit), 0, -0.13, 0);
    add(el, new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.07, 12), calm ? suit2 : trim), 0, -0.2, 0);
    const hand = G(); hand.position.y = -0.28; el.add(hand);
    add(hand, new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), skin)).scale.set(1, 1.1, 1.2);
    return { sh, el, hand };
  };
  const L = arm(1), Rr = arm(-1);
  // sword in right hand (blade along hand +z)
  const sword = G(); Rr.hand.add(sword); sword.position.set(0, -0.02, 0.02);
  if (!calm) {
    const grip = add(sword, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 8), M(0x1f1f2e, 0.7))); grip.rotation.x = Math.PI / 2; grip.position.z = -0.02;
    add(sword, new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.035), gold), 0, 0, 0.11);
    const blade = add(sword, new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.86), steel), 0, 0, 0.56);
    const tip = add(sword, new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.12, 4), steel), 0, 0, 1.04); tip.rotation.x = Math.PI / 2; tip.scale.set(1, 1, 0.35);
    const edge = add(sword, new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.84), new THREE.MeshBasicMaterial({ color: 0x9be7ff })), 0.024, 0, 0.56);
    edge.castShadow = false; blade.userData.blade = true;
  } else sword.visible = false;
  // legs
  const leg = (side) => {
    const th = G(); th.position.set(side * 0.11, -0.02, 0); hips.add(th);
    add(th, cap(0.08, 0.27, suit), 0, -0.21, 0);
    const kn = G(); kn.position.y = -0.45; th.add(kn);
    add(kn, cap(0.066, 0.27, suit2), 0, -0.21, 0);
    add(kn, new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.12, 12), calm ? suit2 : trim), 0, -0.3, 0);
    const ft = G(); ft.position.y = -0.45; kn.add(ft);
    add(ft, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), suit2), 0, -0.01, 0.05);
    return { th, kn, ft };
  };
  const LL = leg(1), RL = leg(-1);
  if (!calm) {
    var sheath = add(spine, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.07), M(0x111827, 0.5)), 0.08, 0.28, -0.2); sheath.rotation.z = 0.7;
    add(sheath, new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.085), gold), 0, 0.45, 0);
    const seam = add(head, new THREE.Mesh(new THREE.TorusGeometry(0.158, 0.005, 6, 40), new THREE.MeshBasicMaterial({ color: 0x7dd3fc })), 0, 0.012, 0); seam.rotation.x = Math.PI / 2; seam.castShadow = false;
    [L.sh, Rr.sh].forEach((s2, i) => { const pad = add(s2, new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0x334155, 0.35, 0.6)), 0, 0.02, 0); pad.scale.set(1.1, 0.7, 1.1); });
  }
  const scarfAnchor = G(); scarfAnchor.position.set(0, 0.07, -0.13); chest.add(scarfAnchor);
  const collar = calm ? null : add(chest, new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 8, 20), red), 0, 0.07, 0); if (collar) collar.rotation.x = Math.PI / 2;
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  const h = { root, body, hips, spine, chest, neck, head, shL: L.sh, elL: L.el, shR: Rr.sh, elR: Rr.el, handR: Rr.hand, handL: L.hand, sword, thL: LL.th, knL: LL.kn, ftL: LL.ft, thR: RL.th, knR: RL.kn, ftR: RL.ft, scarfAnchor, cur: { ...BASE } };
  h.mats = { suit, suit2, trim, red }; h.sheath = calm ? null : sheath; h.collar = collar; h.beltM = beltM;
  return h;
}

export const BASE = { hipY: 0, rootPitch: 0, rootRoll: 0, hipX: 0, hipYaw: 0, spineX: 0.05, spineY: 0, chestX: 0, headX: 0, headY: 0, shLx: 0, shLz: 0.15, elL: 0.3, shRx: 0.35, shRz: 0.15, elR: 0.7, thLx: 0, thLz: 0.06, knL: 0.1, thRx: 0, thRz: 0.06, knR: 0.1 };
const KEYS = Object.keys(BASE);

export function blendPose(h, target, dt, rate = 14, fast) {
  const c = h.cur;
  for (const k of KEYS) {
    let tv = target[k] ?? BASE[k];
    if (k === 'rootPitch' || k === 'rootRoll') { while (c[k] - tv > Math.PI) c[k] -= Math.PI * 2; while (tv - c[k] > Math.PI) c[k] += Math.PI * 2; }
    const r = fast && fast[k] ? fast[k] : rate;
    c[k] += (tv - c[k]) * (1 - Math.exp(-r * dt));
  }
  applyPose(h, c);
}
export function applyPose(h, p) {
  h.body.position.y = 0.55 + p.hipY;
  h.body.rotation.set(p.rootPitch, 0, p.rootRoll);
  h.hips.rotation.set(p.hipX, p.hipYaw, 0);
  h.spine.rotation.set(p.spineX, p.spineY, 0);
  h.chest.rotation.x = p.chestX;
  h.head.rotation.set(p.headX, p.headY, 0);
  h.shL.rotation.set(-p.shLx, 0, p.shLz); h.elL.rotation.x = -p.elL;
  h.shR.rotation.set(-p.shRx, 0, -p.shRz); h.elR.rotation.x = -p.elR;
  h.thL.rotation.set(-p.thLx, 0, p.thLz); h.knL.rotation.x = p.knL; h.ftL.rotation.x = -p.knL * 0.4 + p.thLx * 0.2;
  h.thR.rotation.set(-p.thRx, 0, -p.thRz); h.knR.rotation.x = p.knR; h.ftR.rotation.x = -p.knR * 0.4 + p.thRx * 0.2;
}

/* physics scarf: verlet chain rendered as a ribbon */
export class Scarf {
  constructor(scene, color = 0xdc2626, n = 9, seg = 0.13) {
    this.n = n; this.seg = seg; this.p = []; this.o = [];
    for (let i = 0; i < n; i++) { this.p.push(new THREE.Vector3()); this.o.push(new THREE.Vector3()); }
    const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 2 * 3), idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    this.geo = g; this.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }));
    this.mesh.castShadow = true; this.mesh.frustumCulled = false; scene.add(this.mesh); this.init = false;
  }
  reset(a) { for (let i = 0; i < this.n; i++) { this.p[i].copy(a); this.p[i].y -= i * 0.05; this.o[i].copy(this.p[i]); } this.init = true; }
  update(dt, anchor, right, vel, t) {
    if (!this.init || this.p[this.n - 1].distanceTo(anchor) > this.seg * this.n * 1.6) this.reset(anchor);
    const P = this.p, O = this.o, g = -9 * dt * dt;
    P[0].copy(anchor); O[0].copy(anchor);
    for (let i = 1; i < this.n; i++) {
      const p = P[i], o = O[i], vx = (p.x - o.x) * 0.92, vy = (p.y - o.y) * 0.92, vz = (p.z - o.z) * 0.92;
      o.copy(p); p.x += vx - vel.x * dt * dt * 6; p.y += vy + g; p.z += vz - vel.z * dt * dt * 6;
      p.x += Math.sin(t * 5 + i) * 0.0015; p.z += Math.cos(t * 4.3 + i * 1.7) * 0.0015;
    }
    for (let it = 0; it < 4; it++) for (let i = 1; i < this.n; i++) {
      const a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-6, k = (d - this.seg) / d;
      if (i === 1) { b.x -= dx * k; b.y -= dy * k; b.z -= dz * k; } else { a.x += dx * k * 0.5; a.y += dy * k * 0.5; a.z += dz * k * 0.5; b.x -= dx * k * 0.5; b.y -= dy * k * 0.5; b.z -= dz * k * 0.5; }
      P[0].copy(anchor);
    }
    const arr = this.geo.attributes.position.array;
    for (let i = 0; i < this.n; i++) {
      const w = 0.075 * (1 - (i / this.n) * 0.35), p = P[i];
      arr[i * 6] = p.x + right.x * w; arr[i * 6 + 1] = p.y + right.y * w; arr[i * 6 + 2] = p.z + right.z * w;
      arr[i * 6 + 3] = p.x - right.x * w; arr[i * 6 + 4] = p.y - right.y * w; arr[i * 6 + 5] = p.z - right.z * w;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
  }
}

/* glowing ribbon that follows the sword blade */
export class Trail {
  constructor(scene, color = 0x9be7ff, n = 16) {
    this.n = n; this.base = []; this.tip = [];
    const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 2 * 3), col = new Float32Array(n * 2 * 3), idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    this.geo = g; this.c = new THREE.Color(color);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; scene.add(this.mesh); this.strength = 0;
  }
  update(base, tip, on, dt) {
    this.strength += ((on ? 1 : 0) - this.strength) * (1 - Math.exp(-dt * (on ? 30 : 10)));
    this.base.unshift(base.clone()); this.tip.unshift(tip.clone()); if (this.base.length > this.n) { this.base.pop(); this.tip.pop(); }
    const P = this.geo.attributes.position.array, C = this.geo.attributes.color.array;
    for (let i = 0; i < this.n; i++) {
      const b = this.base[Math.min(i, this.base.length - 1)], t = this.tip[Math.min(i, this.tip.length - 1)], k = (1 - i / (this.n - 1)) * this.strength;
      P[i * 6] = b.x; P[i * 6 + 1] = b.y; P[i * 6 + 2] = b.z; P[i * 6 + 3] = t.x; P[i * 6 + 4] = t.y; P[i * 6 + 5] = t.z;
      C[i * 6] = this.c.r * k * 0.25; C[i * 6 + 1] = this.c.g * k * 0.25; C[i * 6 + 2] = this.c.b * k * 0.25; C[i * 6 + 3] = this.c.r * k; C[i * 6 + 4] = this.c.g * k; C[i * 6 + 5] = this.c.b * k;
    }
    this.geo.attributes.position.needsUpdate = this.geo.attributes.color.needsUpdate = true; this.mesh.visible = this.strength > 0.02;
  }
}

/* ---------- بدلة التجسس (عالم السفينة): بدون سيف ولا وشاح — بدلة رمادية ضيّقة، سماعة، قفازات، حزام تكتيكي ومسدس على الفخذ ---------- */
export function setSpy(h, on) {
  if (!h.mats) return;
  if (!h.spyGear) {
    h.spyOrig = {}; for (const k in h.mats) h.spyOrig[k] = { c: h.mats[k].color.getHex(), e: h.mats[k].emissive.getHex(), ei: h.mats[k].emissiveIntensity, r: h.mats[k].roughness, m: h.mats[k].metalness };
    const g = new THREE.Group(); g.name = 'spyGear'; const parts = [];
    const M2 = (c, r = 0.6, m = 0.2, e = 0, ei = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e, emissiveIntensity: ei });
    const black = M2(0x0f1115, 0.5, 0.35), strapM = M2(0x22262e, 0.75, 0.1), gunM = M2(0x15171b, 0.35, 0.8), led = new THREE.MeshBasicMaterial({ color: 0x34d399 });
    const put = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); parts.push(mesh); return mesh; };
    // سماعة + ميكروفون (على الأذن اليسار)
    put(h.head, new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14), black), 0.152, 0.0, 0.0).rotation.z = Math.PI / 2;
    const boom = put(h.head, new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 6), black), 0.13, -0.06, 0.07); boom.rotation.x = 1.1; boom.rotation.z = 0.35;
    put(h.head, new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), black), 0.095, -0.085, 0.13);
    put(h.head, new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), led), 0.172, 0.012, 0.012);
    // قفازات
    [h.handR, h.handL].forEach((hd) => put(hd, new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 10), black), 0, 0, 0).scale.set(1, 1.12, 1.25));
    // حزام تكتيكي + جيوب
    put(h.hips, new THREE.Mesh(new THREE.CylinderGeometry(0.207, 0.207, 0.06, 18), strapM), 0, 0.06, 0);
    [-0.13, 0.13, 0].forEach((x, i) => put(h.hips, new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.05), strapM), x, 0.05, i === 2 ? -0.2 : 0.17));
    // جراب على الفخذ اليمين + المسدس
    const hol = put(h.thR, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.1), strapM), -0.09, -0.15, 0.01);
    put(hol, new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.11), gunM), 0, 0.12, 0.0);
    [0.0, -0.12].forEach((y) => put(h.thR, new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 16), strapM), 0, -0.12 + y, 0).rotation.x = Math.PI / 2);
    // حمّالة على الظهر (حقيبة صغيرة) + سكين صغيرة على الصدر
    put(h.spine, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.09), strapM), 0, 0.26, -0.17);
    put(h.spine, new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.13, 0.02), black), -0.1, 0.3, 0.16).rotation.z = -0.4;
    h.spyGear = parts;
  }
  const S = h.mats, O = h.spyOrig;
  if (on) {
    S.suit.color.setHex(0x3a4250); S.suit.roughness = 0.55; S.suit.metalness = 0.15;
    S.suit2.color.setHex(0x22272f); S.suit2.roughness = 0.6;
    S.trim.color.setHex(0x4b5563); S.trim.emissive.setHex(0x0f766e); S.trim.emissiveIntensity = 0.35; S.trim.metalness = 0.4;
    S.red.color.setHex(0x1f2329); S.red.roughness = 0.8;
  } else for (const k in S) { const o = O[k]; S[k].color.setHex(o.c); S[k].emissive.setHex(o.e); S[k].emissiveIntensity = o.ei; S[k].roughness = o.r; S[k].metalness = o.m; }
  h.spyGear.forEach((m) => (m.visible = on));
  h.sword.visible = !on; if (h.sheath) h.sheath.visible = !on; if (h.collar) h.collar.visible = !on;
  h.spy = on;
}
/* ---------- زي الحارس (تنكّر): لون الزي الزيتي + قبعة + سترة ---------- */
export function setDisguise(h, on) {
  if (!h.mats) return;
  if (!h.disGear) {
    const parts = [], M2 = (c, r = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const put = (p2, m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; p2.add(m); parts.push(m); return m; };
    const capM = put(h.head, new THREE.Mesh(new THREE.SphereGeometry(0.172, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), M2(0x4b5340)), 0, 0.04, 0);
    put(capM, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.12), M2(0x4b5340)), 0, 0.03, 0.15);
    put(h.spine, new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.36, 0.31), M2(0x2f3a2b, 0.85)), 0, 0.26, 0.01);
    for (let i = -1; i <= 1; i++) put(h.spine, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.06), M2(0x26301f)), i * 0.12, 0.18, 0.18);
    h.disGear = parts;
  }
  h.disGear.forEach((m) => (m.visible = on));
  if (on) { h.mats.suit.color.setHex(0x4b5340); h.mats.suit2.color.setHex(0x23262b); h.mats.trim.color.setHex(0x2d3436); h.mats.trim.emissiveIntensity = 0; }
  else if (h.spy) setSpy(h, true);
  h.disguised = on;
}
/* human ship guard: the calm-hero body re-dressed as a soldier (balaclava, cap, vest, rifle) */
export function buildSoldier(seed = 0) {
  const h = buildHero('calm');
  const olive = [0x4b5340, 0x3f4a5a, 0x50483a][seed % 3];
  const recol = { 0x16161c: olive, 0x0c0c10: 0x23262b, 0x111114: 0x0d0d0f, 0x9ca3af: 0x2d3436 };
  const mats = [];
  h.root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone(); mats.push(o.material);
    const hx = o.material.color.getHex(); if (recol[hx] != null) o.material.color.setHex(recol[hx]);
    if (o.material.metalness > 0.7 && o.geometry.type === 'TorusGeometry') o.visible = false; // earrings
  });
  const M = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const add = (p, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
  // balaclava + eye slit + cap
  const bala = add(h.head, new THREE.Mesh(new THREE.SphereGeometry(0.163, 20, 16), M(0x111214)), 0, 0, 0); bala.scale.set(0.97, 1.06, 1.02);
  const slit = add(h.head, new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.045, 0.05), M(0xe0b89a, 0.6)), 0, 0.02, 0.145);
  add(h.head, new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), M(0x111111, 0.3)), -0.045, 0.022, 0.172); add(h.head, new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), M(0x111111, 0.3)), 0.045, 0.022, 0.172);
  const cap = add(h.head, new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), M(olive)), 0, 0.03, 0);
  add(cap, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.12), M(olive)), 0, 0.02, 0.15);
  // vest, radio, belt pouches
  const vest = add(h.spine, new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.3), M(0x2f3a2b, 0.8)), 0, 0.26, 0.01);
  for (let i = -1; i <= 1; i++) add(vest, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.06), M(0x26301f)), i * 0.12, -0.08, 0.16);
  const radio = add(h.chest, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.04), M(0x111111, 0.4, 0.3)), -0.17, 0.02, 0.15);
  add(radio, new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), M(0x111111)), 0.02, 0.1, 0);
  // rifle in the right hand
  const rifle = new THREE.Group(); h.handR.add(rifle); rifle.position.set(0, -0.03, 0.05);
  const gm = M(0x1b1d1f, 0.45, 0.6);
  add(rifle, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.62), gm), 0, 0.02, 0.18);
  add(rifle, new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 8), gm), 0, 0.04, 0.62).rotation.x = Math.PI / 2;
  add(rifle, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.07), gm), 0, -0.09, 0.26).rotation.x = 0.25;
  add(rifle, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.2), M(0x3b2a1a, 0.8)), 0, -0.01, -0.18);
  h.rifle = rifle; h.suitMat = mats.find((m) => m.color.getHex() === olive) || mats[0];
  h.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  compactRig(h.root); // ~50 قطعة ← ~15: كل عضو يصير قطعة وحدة (أخف بكثير على الجوال)
  h.flashMats = []; h.root.traverse((o) => { if (o.isMesh && o.visible && !h.flashMats.includes(o.material)) h.flashMats.push(o.material); });
  return h;
}

/* دمج القطع الصلبة داخل كل مفصل: القطع "الورقية" (بدون أبناء) تحت نفس المفصل وبنفس نوع الخامة تصير قطعة وحدة،
   ولون كل قطعة ينحفظ داخل الرؤوس (vertex colors). المفاصل نفسها ما تتغير، فالحركة تبقى كما هي. */
export function compactRig(root) {
  const nodes = []; root.traverse((o) => nodes.push(o));
  for (const node of nodes) {
    const groups = new Map();
    for (const c of node.children) {
      if (!c.isMesh || c.children.length || c.isSkinnedMesh || Array.isArray(c.material) || !c.material.isMeshStandardMaterial) continue;
      if (!c.visible) { node.remove(c); continue; }
      const m = c.material, key = [m.map ? m.map.uuid : '', m.emissive.getHex(), m.emissiveIntensity, m.metalness > 0.5 ? 1 : 0, m.flatShading, m.side, m.transparent, m.opacity, c.castShadow].join('|'); // الخشونة تتقارب: فرقها ما يبين على جندي صغير
      let g = groups.get(key); if (!g) groups.set(key, (g = [])); g.push(c);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geos = list.map((c) => {
        c.updateMatrix(); const g = c.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
        const n = g.attributes.position.count;
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
        if (!g.index) { const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
        g.clearGroups(); g.applyMatrix4(c.matrix);
        const col = new Float32Array(n * 3), cc = c.material.color; for (let i = 0; i < n; i++) { col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
      });
      const big = mergeGeometries(geos, false); geos.forEach((g) => g.dispose());
      if (!big) continue;
      const bm = list[0].material.clone(); bm.color.setRGB(1, 1, 1); bm.vertexColors = true;
      const mesh = new THREE.Mesh(big, bm); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow; node.add(mesh);
      list.forEach((c) => node.remove(c));
    }
  }
}
