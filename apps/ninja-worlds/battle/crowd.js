// ⚔️ نظام الحشود — مئات الجنود بأوامر رسم قليلة (InstancedMesh لكل قطعة جسم)
// الجيش المنطقي (الاحتياط) أكبر بكثير من المرسوم: كل ما يطيح جندي، يطلع بداله واحد من معسكر جيشه
import * as THREE from 'three';
const V = THREE.Vector3, PI = Math.PI;
const angDiff = (a, b) => { let d = (b - a) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; return d; };
const TEAM = [{ body: 0x1e3a8a, flag: 0x2563eb, hat: 0x0f172a }, { body: 0x7f1d1d, flag: 0xdc2626, hat: 0x1c1917 }];
const ST = { MARCH: 0, FIGHT: 1, STAGGER: 2, FLY: 3, DEAD: 4, WIND: 5, IDLE: 6 };

export class Crowd {
  constructor(game, scene) {
    this.g = game; this.scene = scene; this.on = false; this.n = 0; this.group = null;
    this._m = new THREE.Matrix4(); this._p = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._s = new V(1, 1, 1); this._v = new V(); this._c = new THREE.Color();
  }
  /* opts: { max, camps:[{x,z,team}], goals:[{x,z}], reserve:[ally, enemy], ui } */
  setup(o) {
    this.clear(); this.on = true; const N = this.n = o.max || 200;
    this.camps = o.camps; this.goals = o.goals; this.obst = o.obst || []; this.pens = o.pens || []; this.reserve = o.reserve.slice(); this.total = o.reserve.slice(); this.ko = 0; this.combo = 0; this.comboT = 0; this.windups = 0;
    const F = (k) => new Float32Array(N), I = (k) => new Int16Array(N);
    Object.assign(this, { rt: F(), x: F(), z: F(), y: F(), vx: F(), vy: F(), vz: F(), yaw: F(), hp: F(), t: F(), cd: F(), ph: F(), spin: F(), team: I(), st: I(), tgt: I(), lod: I() });
    const g = this.group = new THREE.Group(); g.userData.dyn = true; this.scene.add(g);
    const M = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const mk = (geo, mat, colored) => { const im = new THREE.InstancedMesh(geo, mat, N); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; if (colored) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); g.add(im); return im; };
    const torso = new THREE.BoxGeometry(0.44, 0.52, 0.28); torso.translate(0, 1.18, 0);
    const skirt = new THREE.CylinderGeometry(0.2, 0.31, 0.34, 8, 1, true); skirt.translate(0, 0.86, 0);
    const head = new THREE.SphereGeometry(0.13, 10, 8); head.translate(0, 1.58, 0.01);
    const hat = new THREE.ConeGeometry(0.32, 0.16, 12); hat.translate(0, 1.72, 0);
    const leg = new THREE.BoxGeometry(0.13, 0.62, 0.15); leg.translate(0, -0.31, 0);
    const arm = new THREE.BoxGeometry(0.11, 0.5, 0.12); arm.translate(0, -0.25, 0);
    const spear = new THREE.CylinderGeometry(0.018, 0.018, 2.4, 5); spear.translate(0, 0.6, 0); const tip = new THREE.ConeGeometry(0.045, 0.24, 5); tip.translate(0, 1.92, 0);
    const spearG = mergeTwo(spear, tip);
    const flag = new THREE.PlaneGeometry(0.3, 0.55); flag.translate(0, 2.05, -0.2);
    const pole = new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4); pole.translate(0, 1.8, -0.18);
    const flagG = mergeTwo(flag, pole);
    this.parts = {
      torso: mk(torso, M(0xffffff, 0.55, 0.25), true), skirt: mk(skirt, M(0xffffff, 0.6, 0.2), true), head: mk(head, M(0xd6a77a, 0.8)), hat: mk(hat, M(0x1c1917, 0.5, 0.2)),
      legL: mk(leg, M(0x1f2937, 0.85)), legR: mk(leg, M(0x1f2937, 0.85)), armL: mk(arm, M(0xffffff, 0.6, 0.2), true), armR: mk(arm, M(0xffffff, 0.6, 0.2), true),
      spear: mk(spearG, M(0x6b4a2b, 0.5, 0.3)), flag: mk(flagG, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 }), true),
    };
    this.parts.torso.castShadow = true;
    for (let i = 0; i < N; i++) { this.team[i] = i < N * (o.allyShare ?? 0.35) ? 0 : 1; this.reserve[this.team[i]]--; this.spawnAt(i, true); }
    this.grid = new Map(); this.frame = 0;
    this.ui = o.ui; this.hud();
  }
  clear() { if (this.group) { this.group.removeFromParent(); this.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); } this.group = null; this.on = false; this.n = 0; }
  tint(i) {
    const T = TEAM[this.team[i]], c = this._c;
    c.setHex(T.body); this.parts.torso.setColorAt(i, c); this.parts.armL.setColorAt(i, c); this.parts.armR.setColorAt(i, c); c.multiplyScalar(0.7); this.parts.skirt.setColorAt(i, c);
    c.setHex(T.flag); this.parts.flag.setColorAt(i, c);
    for (const k of ['torso', 'skirt', 'armL', 'armR', 'flag']) this.parts[k].instanceColor.needsUpdate = true;
  }
  spawnAt(i, initial) {
    const tm = this.team[i];
    if (!initial) { if (this.reserve[tm] <= 0) { this.st[i] = ST.DEAD; this.t[i] = -1e9; return; } this.reserve[tm]--; }
    const camps = this.camps.filter((c) => c.team === tm), c = camps[Math.floor(Math.random() * camps.length)] || { x: 0, z: 0 };
    const a = Math.random() * PI * 2, r = initial ? Math.random() * (c.r || 30) : Math.random() * 8;
    this.x[i] = c.x + Math.cos(a) * r; this.z[i] = c.z + Math.sin(a) * r; this.y[i] = 0; this.vx[i] = this.vy[i] = this.vz[i] = 0;
    this.yaw[i] = tm ? PI : 0; this.hp[i] = tm ? 2 : 3; this.st[i] = ST.MARCH; this.t[i] = 0; this.cd[i] = Math.random() * 2; this.ph[i] = Math.random() * 10; this.tgt[i] = -1; this.spin[i] = 0;
    this.tint(i);
  }
  alive(i) { const s = this.st[i]; return s !== ST.FLY && s !== ST.DEAD; }
  /* ---------- شبكة مكانية بخلايا ٣م ---------- */
  buildGrid() {
    const G = this.grid; G.clear();
    for (let i = 0; i < this.n; i++) { if (!this.alive(i)) continue; const k = ((Math.floor(this.x[i] / 3) + 512) << 10) | (Math.floor(this.z[i] / 3) + 512); let a = G.get(k); if (!a) G.set(k, (a = [])); a.push(i); }
  }
  near(x, z, r, fn) {
    const G = this.grid, c0 = Math.floor((x - r) / 3), c1 = Math.floor((x + r) / 3), d0 = Math.floor((z - r) / 3), d1 = Math.floor((z + r) / 3);
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) { const a = G.get(((cx + 512) << 10) | (cz + 512)); if (a) for (const j of a) fn(j); }
  }
  /* ---------- ضربات اللاعب ---------- */
  hurt(i, dmg, from, knock) {
    if (!this.alive(i) || this.team[i] === 0) return false;
    this.hp[i] -= dmg; const dx = this.x[i] - from.x, dz = this.z[i] - from.z, l = Math.hypot(dx, dz) || 1;
    const hp = this._v.set(this.x[i], 1.2, this.z[i]);
    this.g.fx.emit(hp, { color: 0xffffff, count: 6, speed: 6, life: 0.2, size: 0.16, grav: 4 });
    if (this.hp[i] <= 0) {
      const k = 0.7 + knock * 0.75;
      this.st[i] = ST.FLY; this.t[i] = 0; this.vx[i] = (dx / l) * k; this.vz[i] = (dz / l) * k; this.vy[i] = 3.5 + knock * 0.35; this.spin[i] = (Math.random() - 0.5) * 14;
      this.g.fx.emit(hp, { color: 0xff3b2f, count: 10, speed: 4, life: 0.45, size: 0.26, grav: 6 });
      this.ko++; this.addCombo(); if (this.g.onCrowdKO) this.g.onCrowdKO(this.ko);
    } else { this.st[i] = ST.STAGGER; this.t[i] = 0; this.vx[i] = (dx / l) * knock * 0.6; this.vz[i] = (dz / l) * knock * 0.6; this.addCombo(); }
    return true;
  }
  addCombo() { this.combo++; this.comboT = 2.2; this._hudDirty = true; }
  hitArc(p, yaw, range, cosMin, dmg, knock) {
    if (!this.on) return 0; let n = 0; const fx = Math.sin(yaw), fz = Math.cos(yaw), R = range + 0.35;
    this.near(p.x, p.z, R, (i) => { const dx = this.x[i] - p.x, dz = this.z[i] - p.z, d = Math.hypot(dx, dz); if (d > R || Math.abs(this.y[i] - p.y) > 2.2) return; if (d > 0.5 && (dx * fx + dz * fz) / d < cosMin) return; if (this.hurt(i, dmg, p, knock)) n++; });
    return n;
  }
  hitRadius(p, r, dmg, knock) { if (!this.on) return 0; let n = 0; this.near(p.x, p.z, r + 0.35, (i) => { if (Math.hypot(this.x[i] - p.x, this.z[i] - p.z) < r + 0.35 && Math.abs(this.y[i] - p.y) < 2.5 && this.hurt(i, dmg, p, knock)) n++; }); return n; }
  nearest(p, maxD) {
    if (!this.on) return null; let best = -1, bd = maxD;
    this.near(p.x, p.z, maxD, (i) => { if (this.team[i] !== 1) return; const d = Math.hypot(this.x[i] - p.x, this.z[i] - p.z); if (d < bd) { bd = d; best = i; } });
    return best < 0 ? null : { pos: new V(this.x[best], this.y[best], this.z[best]), d: bd };
  }
  /* ---------- الذكاء ---------- */
  update(dt, pl) {
    if (!this.on) return;
    this.frame++; if (this.frame % 2 === 0) this.buildGrid();
    if (this.comboT > 0 && (this.comboT -= dt) <= 0) { this.combo = 0; this._hudDirty = true; }
    const px = pl.pos.x, pz = pl.pos.z; let onPl = 0, wind = 0;
    for (let i = 0; i < this.n; i++) if (this.team[i] === 1 && this.tgt[i] === -2 && this.alive(i)) { onPl++; if (this.st[i] === ST.WIND) wind++; }
    for (let i = 0; i < this.n; i++) {
      const s = this.st[i]; this.t[i] += dt; this.cd[i] -= dt;
      if (s === ST.DEAD) { if (this.t[i] > 4.5) this.spawnAt(i); continue; }
      if (s === ST.FLY) {
        this.vy[i] -= 22 * dt; this.x[i] += this.vx[i] * dt; this.z[i] += this.vz[i] * dt; this.y[i] += this.vy[i] * dt;
        if (this.y[i] <= 0 && this.vy[i] < 0) { this.y[i] = 0; this.st[i] = ST.DEAD; this.t[i] = 0; if (Math.random() < 0.3) this.g.dust && this.g.dust(this._v.set(this.x[i], 0, this.z[i]), 4); }
        continue;
      }
      if (s === ST.STAGGER) { this.x[i] += this.vx[i] * dt; this.z[i] += this.vz[i] * dt; this.vx[i] *= Math.exp(-8 * dt); this.vz[i] *= Math.exp(-8 * dt); if (this.t[i] > 0.4) { this.st[i] = ST.FIGHT; this.t[i] = 0; } continue; }
      const far = (this.x[i] - px) ** 2 + (this.z[i] - pz) ** 2;
      // البعيدين: نحدّث ذكاءهم كل ٤ إطارات
      if (far > 3600 && (i + this.frame) % 4) continue;
      const tm = this.team[i], dtx = far > 3600 ? dt * 4 : dt;
      // اختيار الهدف
      if ((this.rt[i] -= dtx) <= 0 || this.tgt[i] === -1) {
        this.rt[i] = 0.5 + Math.random() * 0.3;
        if (tm === 1 && far < 196 && (onPl < 9 || this.tgt[i] === -2)) { if (this.tgt[i] !== -2) onPl++; this.tgt[i] = -2; }
        else { let best = -1, bd = 11; this.near(this.x[i], this.z[i], 11, (j) => { if (this.team[j] === tm) return; const d = Math.hypot(this.x[j] - this.x[i], this.z[j] - this.z[i]); if (d < bd) { bd = d; best = j; } }); this.tgt[i] = best >= 0 ? best : -3; }
      }
      let tx, tz, ring = 1.4;
      if (this.tgt[i] === -2) { tx = px; tz = pz; ring = 1.7 + (i % 5) * 0.28; }
      else if (this.tgt[i] >= 0 && this.alive(this.tgt[i])) { tx = this.x[this.tgt[i]]; tz = this.z[this.tgt[i]]; }
      else { const gl = this.goals[tm]; tx = gl.x + Math.sin(i * 2.4) * 22; tz = gl.z + Math.cos(i * 1.7) * 12; ring = 3; this.tgt[i] = -3; }
      // داخل المعسكر والهدف برّا؟ يطلع من البوابة أول (والعكس)
      for (const P of this.pens) { const inS = this.x[i] > P.x0 && this.x[i] < P.x1 && this.z[i] > P.z0 && this.z[i] < P.z1, inT = tx > P.x0 && tx < P.x1 && tz > P.z0 && tz < P.z1;
        if (inS !== inT) { const g = P.gates.reduce((b, q) => (Math.hypot(q[0] - tx, q[1] - tz) < Math.hypot(b[0] - tx, b[1] - tz) ? q : b)); const gz = g[1] + (inS ? (g[1] > (P.z0 + P.z1) / 2 ? 2 : -2) : (g[1] > (P.z0 + P.z1) / 2 ? -2 : 2));
          if (Math.hypot(this.x[i] - g[0], this.z[i] - gz) > 1.5) { tx = g[0] + ((i % 5) - 2) * 0.9; tz = gz; ring = 0.5; } break; } }
      const dx = tx - this.x[i], dz = tz - this.z[i], d = Math.hypot(dx, dz) || 1;
      this.yaw[i] += angDiff(this.yaw[i], Math.atan2(dx, dz)) * Math.min(1, dt * 7);
      if (s === ST.WIND) { // رفع الرمح… ثم طعنة
        if (this.t[i] > 0.62) {
          this.st[i] = ST.FIGHT; this.t[i] = 0; this.cd[i] = 2.2 + Math.random() * 2.2;
          if (this.tgt[i] === -2 && d < 2.6 && pl.hp > 0 && pl.state !== 'roll') { if (Math.random() < 0.5) pl.damage(1, this._v.set(this.x[i], 0, this.z[i])); else this.g.fx.emit(this._v.set((this.x[i] + px) / 2, 1.2, (this.z[i] + pz) / 2), { color: 0xffe08a, count: 6, speed: 5, life: 0.2, size: 0.14, grav: 3 }); }
          else if (this.tgt[i] >= 0 && d < 2.2 && Math.random() < 0.3) { const j = this.tgt[i]; if (--this.hp[j] <= 0) { this.st[j] = ST.FLY; this.t[j] = 0; this.vx[j] = dx / d * 2; this.vz[j] = dz / d * 2; this.vy[j] = 3; this.spin[j] = 3; } }
        }
        continue;
      }
      if (d > ring) { this.st[i] = ST.MARCH; const sp = (this.tgt[i] === -3 ? 2.4 : 3.6) * (1 + (i % 7) * 0.04); this.x[i] += (dx / d) * sp * dtx; this.z[i] += (dz / d) * sp * dtx; }
      else {
        this.st[i] = ST.FIGHT;
        if (this.cd[i] <= 0) {
          if (this.tgt[i] === -2) { if (wind < 2 && pl.hp > 0) { wind++; this.st[i] = ST.WIND; this.t[i] = 0; } else this.cd[i] = 0.5 + Math.random(); }
          else { this.st[i] = ST.WIND; this.t[i] = 0; }
        }
      }
      // تباعد (ما يتراكبون)
      this.near(this.x[i], this.z[i], 1.2, (j) => { if (j === i) return; const ex = this.x[i] - this.x[j], ez = this.z[i] - this.z[j], e2 = ex * ex + ez * ez; if (e2 < 0.7 && e2 > 1e-4) { const e = Math.sqrt(e2), k = (0.84 - e) * 0.5; this.x[i] += ex / e * k; this.z[i] += ez / e * k; } });
      // تصادم مع السياج والتلال والقلعة: يندفع لأقرب حافة (ويمشي على طولها لين يلقى البوابة)
      for (const r of this.obst) { const x = this.x[i], z = this.z[i]; if (x > r[0] && x < r[1] && z > r[2] && z < r[3]) { const a = x - r[0], b = r[1] - x, c = z - r[2], d2 = r[3] - z, m = Math.min(a, b, c, d2); if (m === a) this.x[i] = r[0]; else if (m === b) this.x[i] = r[1]; else if (m === c) this.z[i] = r[2]; else this.z[i] = r[3]; } }
      // ما يدخلون جوّا اللاعب
      const qx = this.x[i] - px, qz = this.z[i] - pz, q = Math.hypot(qx, qz); if (q < 0.95 && q > 1e-3) { this.x[i] = px + qx / q * 0.95; this.z[i] = pz + qz / q * 0.95; }
    }
    if (this._hudDirty || this.frame % 20 === 0) this.hud();
  }
  /* ---------- الرسم ---------- */
  render(t, cam) {
    if (!this.on) return;
    const P = this.parts, m = this._m, p = this._p, q = this._q, e = this._e, s = this._s, cx = cam.position.x, cz = cam.position.z;
    const set = (im, i, ox, oy, oz, rx, ry, rz) => { e.set(rx, ry, rz); q.setFromEuler(e); p.compose(this._v.set(ox, oy, oz), q, s); im.setMatrixAt(i, p.premultiply(m)); };
    for (let i = 0; i < this.n; i++) {
      const st = this.st[i], dead = st === ST.DEAD;
      if (dead && this.t[i] < -1e8) { m.makeScale(0, 0, 0); for (const k in P) P[k].setMatrixAt(i, m); continue; }
      const far = (this.x[i] - cx) ** 2 + (this.z[i] - cz) ** 2;
      if (far > 32400 && (i + this.frame) % 3) continue; // بعيد جداً: نحدّث رسمه أقل
      const sink = dead ? Math.max(0, this.t[i] - 3) * 0.6 : 0;
      e.set(dead ? -PI / 2 : st === ST.FLY ? -this.t[i] * 5 : st === ST.STAGGER ? -0.35 : 0, this.yaw[i] + (st === ST.FLY ? this.t[i] * this.spin[i] : 0), 0); q.setFromEuler(e);
      m.compose(this._v.set(this.x[i], this.y[i] + (dead ? 0.2 : 0) - sink, this.z[i]), q, s);
      const mv = st === ST.MARCH ? 1 : 0, w = Math.sin(t * 9 + this.ph[i]) * 0.6 * mv, bob = Math.abs(Math.cos(t * 9 + this.ph[i])) * 0.05 * mv;
      if (bob) m.multiply(p.makeTranslation(0, bob, 0));
      P.torso.setMatrixAt(i, m); P.skirt.setMatrixAt(i, m); P.head.setMatrixAt(i, m); P.hat.setMatrixAt(i, m); P.flag.setMatrixAt(i, m);
      set(P.legL, i, -0.11, 0.72, 0, w, 0, 0); set(P.legR, i, 0.11, 0.72, 0, -w, 0, 0);
      const wk = st === ST.WIND ? Math.min(1, this.t[i] / 0.5) : 0, thrust = st === ST.FIGHT && this.t[i] < 0.18 && this.cd[i] > 1.5 ? 1 : 0;
      const ax = -0.5 - wk * 0.6 + thrust * 1.4 - w * 0.3;
      set(P.armR, i, 0.27, 1.4, 0.02, ax, 0, 0.15); set(P.armL, i, -0.27, 1.4, 0.05, ax * 0.8 - 0.3, 0, -0.15);
      set(P.spear, i, 0.24, 1.0 + wk * 0.25, 0.25 + thrust * 0.6, 1.25 - wk * 0.5 + thrust * 0.25, 0, 0);
    }
    for (const k in P) P[k].instanceMatrix.needsUpdate = true;
  }
  hud() {
    this._hudDirty = false; const el = this.ui; if (!el) return;
    const h = `<b>⚔️ ${this.ko}</b>${this.combo > 1 ? `<i>${this.combo} ضربة!</i>` : ''}<span>🟦 ${this.reserve[0] + this.countAlive(0)}  ·  🟥 ${this.reserve[1] + this.countAlive(1)}</span>`; if (h !== this._last) { this._last = h; el.innerHTML = h; }
  }
  countAlive(tm) { let c = 0; for (let i = 0; i < this.n; i++) if (this.team[i] === tm && this.alive(i)) c++; return c; }
}
function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry(), A = a.toNonIndexed(), B = b.toNonIndexed();
  for (const k of ['position', 'normal']) { const x = A.attributes[k].array, y = B.attributes[k].array, z = new Float32Array(x.length + y.length); z.set(x); z.set(y, x.length); g.setAttribute(k, new THREE.BufferAttribute(z, 3)); }
  return g;
}
