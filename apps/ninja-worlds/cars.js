// 🚗 سيارات مدينة النيون: شكل + سواقة أركيد + زحمة تمشي في الشوارع + تصادم + قفزات المنحدرات
import * as THREE from 'three';
const V = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const COLORS = [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e, 0xa855f7, 0xf97316, 0xe5e7eb, 0x0ea5e9, 0xec4899, 0x111827];

function buildCar(color, kind) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.65 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0f17, roughness: 0.25, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.05, metalness: 0.9, emissive: 0x0a1630, emissiveIntensity: 0.6 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 }), rim = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.9 });
  const add = (geo, m, x, y, z, p = body) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; p.add(me); return me; };
  const sport = kind === 'sport', police = kind === 'police';
  add(new THREE.BoxGeometry(2.0, 0.55, 4.4), paint, 0, 0.62, 0);
  add(new THREE.BoxGeometry(1.96, 0.18, 4.3), dark, 0, 0.32, 0);
  const cab = add(new THREE.BoxGeometry(1.7, sport ? 0.48 : 0.62, sport ? 2.0 : 2.3), glass, 0, sport ? 1.12 : 1.2, sport ? -0.15 : -0.2);
  add(new THREE.BoxGeometry(1.74, 0.08, sport ? 1.7 : 2.0), paint, 0, cab.position.y + (sport ? 0.27 : 0.34), cab.position.z);
  if (sport) add(new THREE.BoxGeometry(1.9, 0.06, 0.35), dark, 0, 1.12, -2.05); // جناح
  const hl = new THREE.MeshBasicMaterial({ color: 0xfffbe6 }), tl = new THREE.MeshBasicMaterial({ color: 0xff1f3d });
  [-0.68, 0.68].forEach((x) => { add(new THREE.BoxGeometry(0.42, 0.14, 0.05), hl, x, 0.72, 2.21); add(new THREE.BoxGeometry(0.46, 0.13, 0.05), tl, x, 0.74, -2.21); });
  const wheels = [];
  for (const [x, z] of [[-0.98, 1.38], [0.98, 1.38], [-0.98, -1.38], [0.98, -1.38]]) {
    const w = new THREE.Group(); w.position.set(x, 0.38, z); body.add(w);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 16), tyre); t.rotation.z = Math.PI / 2; t.castShadow = true; w.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8), rim); r.rotation.z = Math.PI / 2; w.add(r);
    wheels.push(w);
  }
  if (police) { const bar = add(new THREE.BoxGeometry(1.0, 0.12, 0.28), dark, 0, 1.6, -0.2); const b1 = add(new THREE.BoxGeometry(0.42, 0.13, 0.26), new THREE.MeshBasicMaterial({ color: 0x2563eb }), -0.27, 1.68, -0.2); const b2 = add(new THREE.BoxGeometry(0.42, 0.13, 0.26), new THREE.MeshBasicMaterial({ color: 0xef4444 }), 0.27, 1.68, -0.2); g.userData.siren = [b1, b2]; bar.castShadow = false; }
  // إضاءة نيون تحت السيارة
  const glowC = document.createElement('canvas'); glowC.width = glowC.height = 64; const x = glowC.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowC), color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.03; g.add(glow);
  return { g, body, wheels, paint };
}

export class Cars {
  constructor(game) { this.g = game; this.list = []; this.driving = null; this.runners = []; }
  clear() { for (const c of this.list) c.g.removeFromParent(); for (const r of this.runners) r.m.removeFromParent(); this.list = []; this.runners = []; this.driving = null; }
  spawn(o) {
    const color = o.color ?? COLORS[this.list.length % COLORS.length], m = buildCar(color, o.kind);
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
    this.driving = null; player.driving = null; c.speed *= 0.5; return true;
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
  crash(c, s) { if (c.cool > 0) return; c.cool = 0.4; this.g.sfx.noise(0.3, 300, 0.7, Math.min(0.4, s / 60), 'lowpass'); this.g.sfx.tone(120, 60, 0.15, 'square', Math.min(0.12, s / 200)); if (c === this.driving) this.g.shake(Math.min(0.5, s / 40)); this.g.fx.emit(c.pos.clone().add(new V(0, 0.8, 0)), { color: 0xfde68a, count: Math.min(30, s | 0), speed: 4, life: 0.4, size: 0.18 }); }
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
    if (nitro) { c.nitro = Math.max(0, c.nitro - dt / 3.5); if (Math.random() < 0.6) this.g.fx.emit(c.pos.clone().add(new V(-Math.sin(c.yaw) * 2.3, 0.5, -Math.cos(c.yaw) * 2.3)), { color: 0x7dd3fc, count: 3, speed: 2, life: 0.3, size: 0.35 }); }
    else c.nitro = Math.min(1, c.nitro + dt / 9);
    if (hand && Math.abs(c.speed) > 10 && Math.abs(c.steer) > 0.4 && Math.random() < 0.5) this.g.fx.emit(c.pos.clone().add(new V(0, 0.2, 0)), { color: 0x9ca3af, count: 2, speed: 1.5, life: 0.8, size: 0.6, grav: -0.5 });
    this.engine(c, dt);
  }
  engine(c, dt) { c.engT = (c.engT || 0) - dt; if (c.engT <= 0) { c.engT = 0.11; const s = Math.abs(c.speed); this.g.sfx.tone(55 + s * 4.2, 50 + s * 4, 0.12, 'sawtooth', 0.018 + Math.min(0.03, s / 900)); } }
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
