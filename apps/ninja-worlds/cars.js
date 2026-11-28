// 🚗 سيارات مدينة النيون: شكل + سواقة أركيد + زحمة تمشي في الشوارع + تصادم + قفزات المنحدرات
import * as THREE from 'three';
const V = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const COLORS = [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e, 0xa855f7, 0xf97316, 0xe5e7eb, 0x0ea5e9, 0xec4899, 0x111827];

/* أشكال السيارات منقولة من «الرحّال» (بدون علامات تجارية): مقصورة مائلة بزجاج، شبك، جناح، صندوق بيك أب… */
const CARX = {
  family: { Wd: .93, Lh: 2.42, H1: .82, H2: 1.45, bz0: -.62, bz1: .47, tz0: -.4, tz1: .08, tw: .8, grille: [.62, .64, .68], gw: .55 },
  luxsuv: { Wd: 1.03, Lh: 2.55, H1: 1.15, H2: 2.0, bz0: -.68, bz1: .42, tz0: -.64, tz1: .27, tw: .86, grille: [.75, .77, .8], gw: .7, rails: true, rideH: .42 },
  pickup: { Wd: .98, Lh: 2.65, H1: 1.02, H2: 1.86, bz0: -.12, bz1: .42, tz0: -.1, tz1: .25, tw: .84, grille: [.2, .21, .23], gw: .62, bed: true, rideH: .4 },
  hatch: { Wd: .84, Lh: 1.95, H1: .8, H2: 1.52, bz0: -.93, bz1: .42, tz0: -.8, tz1: .1, tw: .8, grille: [.08, .08, .09], gw: .45 },
  ev: { Wd: .95, Lh: 2.45, H1: .8, H2: 1.44, bz0: -.86, bz1: .48, tz0: -.34, tz1: .06, tw: .78, grille: null, bar: true, roof: [.06, .07, .09] },
  crossover: { Wd: .95, Lh: 2.25, H1: .98, H2: 1.72, bz0: -.7, bz1: .44, tz0: -.5, tz1: .2, tw: .8, grille: [.12, .12, .14], gw: .62, roof: [.07, .07, .08], rideH: .38 },
  sport: { Wd: .97, Lh: 2.3, H1: .66, H2: 1.14, bz0: -.78, bz1: .5, tz0: -.28, tz1: .02, tw: .72, grille: [.06, .06, .07], gw: .6, spoiler: true, rideH: .26, bar: true },
};
export const BODY_KINDS = Object.keys(CARX);
function MB() {
  const G = {}, put = (k, pts, col) => { const g = G[k] || (G[k] = { p: [], c: [] }); for (const v of pts) { g.p.push(v[0], v[1], v[2]); g.c.push(col[0], col[1], col[2]); } };
  const W = [1, 1, 1];
  const quad = (a, b, c, d, col, k) => put(k, [a, b, c, a, c, d], col || W);
  const box = (x0, y0, z0, x1, y1, z1, col, k) => {
    const P = (x, y, z) => [x, y, z];
    quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), col, k); quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), col, k);
    quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), col, k); quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), col, k);
    quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), col, k); quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), col, k);
  };
  return { G, quad, box };
}
function buildCar(color, kind) {
  const police = kind === 'police', body = police ? 'family' : (CARX[kind] ? kind : 'family'), o = CARX[body];
  const b = MB(), p = (x, y, z) => [x, y, z], { Wd, Lh, H1, H2 } = o, y0 = o.rideH || .32, dk = [.07, .07, .08], W = [1, 1, 1];
  b.box(-Wd, y0, -Lh, Wd, H1, Lh, W, 'paint');
  const bz0 = Lh * o.bz0, bz1 = Lh * o.bz1, tz0 = Lh * o.tz0, tz1 = Lh * o.tz1, bw = Wd * .94, tw = Wd * o.tw;
  b.quad(p(-bw, H1, bz1), p(bw, H1, bz1), p(tw, H2, tz1), p(-tw, H2, tz1), W, 'glass'); b.quad(p(bw, H1, bz0), p(-bw, H1, bz0), p(-tw, H2, tz0), p(tw, H2, tz0), W, 'glass');
  b.quad(p(bw, H1, bz1), p(bw, H1, bz0), p(tw, H2, tz0), p(tw, H2, tz1), W, 'glass'); b.quad(p(-bw, H1, bz0), p(-bw, H1, bz1), p(-tw, H2, tz1), p(-tw, H2, tz0), W, 'glass');
  if (o.roof) b.quad(p(-tw, H2 + .005, tz1), p(tw, H2 + .005, tz1), p(tw, H2 + .005, tz0), p(-tw, H2 + .005, tz0), o.roof, 'dark'); else b.quad(p(-tw, H2, tz1), p(tw, H2, tz1), p(tw, H2, tz0), p(-tw, H2, tz0), W, 'paint');
  if (o.bed) { b.box(-Wd, H1, -Lh, -Wd + .08, H1 + .32, bz0 - .05, W, 'paint'); b.box(Wd - .08, H1, -Lh, Wd, H1 + .32, bz0 - .05, W, 'paint'); b.box(-Wd, H1, -Lh, Wd, H1 + .32, -Lh + .08, W, 'paint'); b.box(-Wd + .08, H1 - .02, -Lh + .08, Wd - .08, H1 + .01, bz0 - .05, dk, 'dark'); }
  if (o.rails) for (const sx of [-1, 1]) b.box(sx * tw * .86 - .04, H2, tz0 + .1, sx * tw * .86 + .04, H2 + .07, tz1 - .1, [.55, .57, .6], 'dark');
  if (o.spoiler) { b.box(-Wd * .85, H1 + .18, -Lh + .05, Wd * .85, H1 + .23, -Lh + .38, dk, 'dark'); for (const sx of [-1, 1]) b.box(sx * Wd * .6 - .03, H1, -Lh + .15, sx * Wd * .6 + .03, H1 + .19, -Lh + .25, dk, 'dark'); }
  b.box(-Wd * 1.01, y0 - .04, -Lh - .07, Wd * 1.01, y0 + .2, -Lh + .25, dk, 'dark'); b.box(-Wd * 1.01, y0 - .04, Lh - .25, Wd * 1.01, y0 + .18, Lh + .07, dk, 'dark');
  if (o.bar) { b.quad(p(-Wd * .92, H1 - .13, -Lh - .012), p(Wd * .92, H1 - .13, -Lh - .012), p(Wd * .92, H1 - .07, -Lh - .012), p(-Wd * .92, H1 - .07, -Lh - .012), W, 'tail'); b.quad(p(-Wd * .9, H1 - .11, Lh + .012), p(Wd * .9, H1 - .11, Lh + .012), p(Wd * .9, H1 - .07, Lh + .012), p(-Wd * .9, H1 - .07, Lh + .012), W, 'head'); }
  else { for (const [a1, a2] of [[-.95, -.45], [.45, .95]]) b.quad(p(Wd * a1, H1 - .24, -Lh - .012), p(Wd * a2, H1 - .24, -Lh - .012), p(Wd * a2, H1 - .06, -Lh - .012), p(Wd * a1, H1 - .06, -Lh - .012), W, 'tail'); for (const [a1, a2] of [[-.92, -.55], [.55, .92]]) b.quad(p(Wd * a1, H1 - .2, Lh + .012), p(Wd * a2, H1 - .2, Lh + .012), p(Wd * a2, H1 - .07, Lh + .012), p(Wd * a1, H1 - .07, Lh + .012), W, 'head'); }
  if (o.grille) { const gh = (o.rideH || .32) > .35 ? .32 : .18; b.quad(p(-Wd * o.gw, H1 - .08 - gh, Lh + .01), p(Wd * o.gw, H1 - .08 - gh, Lh + .01), p(Wd * o.gw, H1 - .08, Lh + .01), p(-Wd * o.gw, H1 - .08, Lh + .01), o.grille, 'dark'); }
  b.box(-.27, y0 + .24, -Lh - .09, .27, y0 + .38, -Lh - .07, [.95, .95, .95], 'dark'); // لوحة
  b.box(-Wd - .12, H1 - .05, bz1 - .15, -Wd, H1 + .12, bz1, W, 'paint'); b.box(Wd, H1 - .05, bz1 - .15, Wd + .12, H1 + .12, bz1, W, 'paint'); // مرايات
  const g = new THREE.Group(), bodyG = new THREE.Group(); g.add(bodyG);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.65, vertexColors: true, side: THREE.DoubleSide });
  const MATS = { paint, glass: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.05, metalness: 0.9, emissive: 0x0a1630, emissiveIntensity: 0.6, side: THREE.DoubleSide }), dark: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }), head: new THREE.MeshBasicMaterial({ color: 0xfffbe6, side: THREE.DoubleSide }), tail: new THREE.MeshBasicMaterial({ color: 0xff1f3d, side: THREE.DoubleSide }) };
  for (const k in b.G) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(b.G[k].p, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(b.G[k].c, 3)); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, MATS[k]); m.castShadow = k !== 'head' && k !== 'tail'; bodyG.add(m); }
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 }), rim = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.9 });
  const wr = (o.rideH || .32) > .35 ? .4 : (o.rideH || .32) < .3 ? .33 : .35, wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Group(); w.position.set(sx * (Wd - .08), wr, sz * Lh * .64); bodyG.add(w);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, .28, 16), tyre); t.rotation.z = Math.PI / 2; t.castShadow = true; w.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(wr * .55, wr * .55, .3, 8), rim); r.rotation.z = Math.PI / 2; w.add(r); wheels.push(w);
  }
  if (police) { const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, .12, .28), MATS.dark); bar.position.set(0, H2 + .07, (tz0 + tz1) / 2); bodyG.add(bar); const b1 = new THREE.Mesh(new THREE.BoxGeometry(.42, .13, .26), new THREE.MeshBasicMaterial({ color: 0x2563eb })), b2 = new THREE.Mesh(new THREE.BoxGeometry(.42, .13, .26), new THREE.MeshBasicMaterial({ color: 0xef4444 })); b1.position.set(-.27, H2 + .15, bar.position.z); b2.position.set(.27, H2 + .15, bar.position.z); bodyG.add(b1, b2); g.userData.siren = [b1, b2]; }
  // إضاءة نيون تحت السيارة
  const glowC = document.createElement('canvas'); glowC.width = glowC.height = 64; const x = glowC.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(Wd * 3.3, Lh * 2.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowC), color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.03; g.add(glow);
  return { g, body: bodyG, wheels, paint, Lh };
}

export class Cars {
  constructor(game) { this.g = game; this.list = []; this.driving = null; this.runners = []; }
  clear() { this.stopEngine(); for (const c of this.list) c.g.removeFromParent(); for (const r of this.runners) r.m.removeFromParent(); this.list = []; this.runners = []; this.driving = null; }
  spawn(o) {
    const kind = o.kind || BODY_KINDS[(this.list.length * 3 + 1) % BODY_KINDS.length], color = o.color ?? COLORS[this.list.length % COLORS.length], m = buildCar(color, kind);
    m.g.position.set(o.x, 0, o.z); this.g.scene.add(m.g);
    const c = { ...m, kind: o.kind || 'car', pos: m.g.position, yaw: o.yaw || 0, speed: 0, vy: 0, air: false, steer: 0, path: o.path || null, pi: o.pi || 0, driver: !!o.path, color, nitro: 1, spin: 0, cool: 0 };
    if (c.path) { const p = c.path[c.pi % c.path.length]; c.pos.set(p[0], 0, p[1]); }
    this.list.push(c); return c;
  }
  nearest(p, r = 3.2) { let best = null, bd = r; for (const c of this.list) { const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z); if (d < bd && Math.abs(c.pos.y - p.y) < 2) { bd = d; best = c; } } return best; }
  enter(c, player) {
    if (c.driver) { // سحب السائق
      c.driver = false; c.path = null; this.runner(c);
      this.g.say && this.g.say('🚗 سحبت السائق وركبت مكانه! 😅'); this.g.sfx.noise(0.25, 600, 1, 0.15, 'bandpass');
      this.g.onCarjack && this.g.onCarjack(c);
    }
    this.driving = c; c.speed = c.speed * 0.3; player.driving = c; player.vel.set(0, 0, 0);
    this.g.sfx.tone(90, 140, 0.5, 'sawtooth', 0.08); // تشغيل المكينة
  }
  exit(player) {
    const c = this.driving; if (!c) return false;
    const side = new V(Math.cos(c.yaw), 0, -Math.sin(c.yaw)); // يمين السيارة
    for (const s of [-1, 1]) { const p = c.pos.clone().addScaledVector(side, s * 2.0); p.y = c.pos.y; if (player.bodyFree ? player.bodyFree(p) : true) { player.spawn(p, c.yaw); break; } }
    this.driving = null; player.driving = null; c.speed *= 0.5; this.stopEngine(); return true;
  }
  runner(c) { // السائق يهرب يركض
    const m = new THREE.Group(); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.9, 4, 8), new THREE.MeshStandardMaterial({ color: 0x64748b })); b.position.y = 0.8; m.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf2c9a8 })); h.position.y = 1.55; m.add(h);
    const side = new V(Math.cos(c.yaw), 0, -Math.sin(c.yaw)); m.position.copy(c.pos).addScaledVector(side, -1.8); this.g.scene.add(m);
    const ang = Math.random() * Math.PI * 2; this.runners.push({ m, dir: new V(Math.sin(ang), 0, Math.cos(ang)), t: 0 });
  }
  /* -------- تصادم مع المباني (صناديق) -------- */
  collide(c) {
    const L = this.g.level, R = 1.7; let hit = 0;
    for (const b of L.nearR(c.pos.x, c.pos.z, 4)) {
      if (!b.active || b.max.y < c.pos.y + 0.5 || b.min.y > c.pos.y + 1.4) continue;
      const cx = clamp(c.pos.x, b.min.x, b.max.x), cz = clamp(c.pos.z, b.min.z, b.max.z), dx = c.pos.x - cx, dz = c.pos.z - cz, d = Math.hypot(dx, dz);
      if (d >= R) continue;
      if (d < 1e-4) { c.pos.x += Math.sin(c.yaw) * -0.5; c.pos.z += Math.cos(c.yaw) * -0.5; hit = Math.max(hit, 1); continue; }
      const push = R - d; c.pos.x += (dx / d) * push; c.pos.z += (dz / d) * push; hit = Math.max(hit, push);
      // مركبة السرعة الداخلة في الجدار تنعكس
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), into = -(fx * dx + fz * dz) / d;
      if (into > 0.3 && Math.abs(c.speed) > 3) { const s = Math.abs(c.speed); c.speed *= -0.25; this.crash(c, s); }
    }
    for (const o of this.list) {
      if (o === c) continue; const dx = c.pos.x - o.pos.x, dz = c.pos.z - o.pos.z, d = Math.hypot(dx, dz);
      if (d < 3.4 && d > 1e-4 && Math.abs(c.pos.y - o.pos.y) < 1.5) { const p = (3.4 - d) / 2; c.pos.x += (dx / d) * p; c.pos.z += (dz / d) * p; o.pos.x -= (dx / d) * p; o.pos.z -= (dz / d) * p; if (Math.abs(c.speed) > 6 && c === this.driving) { this.crash(c, Math.abs(c.speed)); o.speed += c.speed * 0.4; c.speed *= 0.5; o.bumped = 2; } }
    }
    return hit;
  }
  crash(c, s) { if (c.cool > 0) return; c.cool = 0.4; if (this.g.sfx.crash) this.g.sfx.crash(Math.min(1, s / 25), c.pos); else this.g.sfx.noise(0.3, 300, 0.7, Math.min(0.4, s / 60), 'lowpass'); if (c === this.driving) this.g.shake(Math.min(0.5, s / 40)); this.g.fx.emit(c.pos.clone().add(new V(0, 0.8, 0)), { color: 0xfde68a, count: Math.min(30, s | 0), speed: 4, life: 0.4, size: 0.18 }); }
  /* -------- سواقة اللاعب -------- */
  drive(c, dt, inp) {
    const thr = inp.iy || 0, st = inp.ix || 0, hand = inp.jumpH, nitro = inp.rollH && c.nitro > 0.02;
    const max = nitro ? 40 : 27, acc = nitro ? 26 : 15;
    if (!c.air) {
      if (thr > 0.1) c.speed += (c.speed < 0 ? acc * 2 : acc) * thr * dt;
      else if (thr < -0.1) c.speed += (c.speed > 0.5 ? -acc * 2.2 : -acc * 0.7) * -thr * dt;
      else c.speed *= Math.exp(-dt * 0.55);
      if (hand) c.speed *= Math.exp(-dt * 1.6);
      c.speed = clamp(c.speed, -9, max);
      const grip = clamp(Math.abs(c.speed) / 7, 0, 1), rate = (hand ? 2.9 : 1.9) * grip * Math.sign(c.speed || 1);
      c.steer += (-st - c.steer) * Math.min(1, dt * 8); c.yaw += c.steer * rate * dt;
      c.spin += (hand && Math.abs(c.speed) > 8 ? c.steer * 0.5 : 0 - c.spin) * Math.min(1, dt * 4); // ميلان التفحيط
    }
    if (nitro && !c.nitroOn && this.g.sfx.nitro) this.g.sfx.nitro(); c.nitroOn = nitro;
    if (nitro) { c.nitro = Math.max(0, c.nitro - dt / 3.5); if (Math.random() < 0.6) this.g.fx.emit(c.pos.clone().add(new V(-Math.sin(c.yaw) * 2.3, 0.5, -Math.cos(c.yaw) * 2.3)), { color: 0x7dd3fc, count: 3, speed: 2, life: 0.3, size: 0.35 }); }
    else c.nitro = Math.min(1, c.nitro + dt / 9);
    if (hand && Math.abs(c.speed) > 10 && Math.abs(c.steer) > 0.4 && Math.random() < 0.5) this.g.fx.emit(c.pos.clone().add(new V(0, 0.2, 0)), { color: 0x9ca3af, count: 2, speed: 1.5, life: 0.8, size: 0.6, grav: -0.5 });
    this.engine(c, dt);
  }
  engine(c, dt) { // صوت محرك متواصل: يرتفع مع السرعة، مع «تغيير قير» كل ٣٠ كم
    const sx = this.g.sfx; if (!sx || !sx.ctx) return;
    if (!this.eng) { const ctx = sx.ctx, o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(g); g.connect(sx.sfxBus || ctx.destination); o1.start(); o2.start(); this.eng = { o1, o2, f, g }; }
    const s = Math.abs(c.speed), gearSpan = 8.5, inGear = (s % gearSpan) / gearSpan, base = 45 + inGear * 70 + Math.min(4, Math.floor(s / gearSpan)) * 8, t = sx.ctx.currentTime;
    this.eng.o1.frequency.setTargetAtTime(base, t, 0.05); this.eng.o2.frequency.setTargetAtTime(base * 0.5, t, 0.05); this.eng.f.frequency.setTargetAtTime(400 + s * 40, t, 0.08); this.eng.g.gain.setTargetAtTime(0.05 + Math.min(0.05, s / 600), t, 0.08);
  }
  stopEngine() { if (this.eng) { try { const t = this.g.sfx.ctx.currentTime; this.eng.g.gain.setTargetAtTime(0, t, 0.1); const e = this.eng; setTimeout(() => { try { e.o1.stop(); e.o2.stop(); } catch (x) {} }, 400); } catch (x) {} this.eng = null; } }
  /* -------- زحمة: تمشي على المسار وتوقف لو قدّامها شي -------- */
  traffic(c, dt, player) {
    if (!c.path) { c.speed *= Math.exp(-dt * 2); return; }
    const p = c.path[c.pi % c.path.length], vx = p[0] - c.pos.x, vz = p[1] - c.pos.z, l = Math.hypot(vx, vz);
    if (l < 3) { c.pi++; return; }
    c.yaw += angDiff(c.yaw, Math.atan2(vx, vz)) * Math.min(1, dt * 2.5);
    let want = 9; const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const ahead = (q, r) => { const dx = q.x - c.pos.x, dz = q.z - c.pos.z, a = dx * fx + dz * fz, s = Math.abs(dx * fz - dz * fx); return a > 0 && a < r && s < 2.2; };
    for (const o of this.list) if (o !== c && ahead(o.pos, 9)) want = 0;
    if (player && !player.driving && ahead(player.pos, 7)) { want = 0; if ((c.honk = (c.honk || 0) - dt) <= 0) { c.honk = 2.5; this.g.sfx.tone(390, 390, 0.25, 'square', 0.05); this.g.sfx.tone(470, 470, 0.25, 'square', 0.04); } }
    if (c.bumped > 0) { c.bumped -= dt; want = 0; }
    c.speed += (want - c.speed) * Math.min(1, dt * (want < c.speed ? 4 : 1.2));
  }
  update(dt, player, inp) {
    for (const c of this.list) {
      c.cool = Math.max(0, c.cool - dt);
      if (c === this.driving) this.drive(c, dt, inp); else this.traffic(c, dt, player);
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      c.pos.x += fx * c.speed * dt; c.pos.z += fz * c.speed * dt;
      // منحدرات القفز
      if (!c.air) for (const r of this.g.level.ramps || []) {
        if (c.pos.x > r.x0 && c.pos.x < r.x1 && c.pos.z > r.z0 && c.pos.z < r.z1 && (fx * r.dx + fz * r.dz) * c.speed > 14) { c.air = true; c.vy = Math.abs(c.speed) * 0.6; this.g.sfx.noise(0.3, 500, 0.8, 0.12, 'bandpass'); if (c === this.driving) this.g.say && !this.g.level._rampTip && (this.g.level._rampTip = true, this.g.say('🛫 طيران! دوّر الشظايا المعلّقة فوق المنحدرات')); }
      }
      if (c.air) { c.vy -= 24 * dt; c.pos.y += c.vy * dt; if (c.pos.y <= 0) { c.pos.y = 0; c.air = false; this.crash(c, Math.min(30, -c.vy * 1.5)); c.vy = 0; } }
      this.collide(c);
      // شكل: دوران العجلات + ميلان
      c.g.rotation.y = c.yaw; const roll = c.wheels; for (const w of roll) w.rotation.x += c.speed * dt / 0.38;
      roll[0].rotation.y = roll[1].rotation.y = c === this.driving ? c.steer * 0.45 : 0;
      c.body.rotation.z = (c === this.driving ? -c.steer * clamp(c.speed / 25, -1, 1) * 0.06 : 0) + (c.spin || 0) * 0.1;
      c.body.rotation.x = c.air ? clamp(-c.vy * 0.02, -0.25, 0.25) : 0;
      if (c.g.userData.siren) { const on = Math.floor(performance.now() / 180) % 2; c.g.userData.siren[0].visible = !!on; c.g.userData.siren[1].visible = !on; }
      // دعس الأعداء
      if (c === this.driving && Math.abs(c.speed) > 7) for (const e of this.g.enemies.list) if (e.alive && Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < 2.0 && Math.abs(e.pos.y - c.pos.y) < 2) this.g.enemies.hurt(e, 3, c.pos, 8);
    }
    for (const r of this.runners) { r.t += dt; r.m.position.addScaledVector(r.dir, 6 * dt); r.m.rotation.y = Math.atan2(r.dir.x, r.dir.z); r.m.position.y = Math.abs(Math.sin(r.t * 12)) * 0.15; if (r.t > 5) r.m.removeFromParent(); }
    this.runners = this.runners.filter((r) => r.t <= 5);
  }
}
