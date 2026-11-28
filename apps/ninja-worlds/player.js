// Player controller: run / jump / wall-run / wall-climb / wall-jump / ledge hang + shimmy + climb / roll / 3-hit combo / plunge / carry
import * as THREE from 'three';
import { blendPose, BASE } from './hero.js';
const V = THREE.Vector3;
export const R = 0.32, RF = 0.2, H = 1.75, STEP = 0.38;
export const C = { run: 7.2, accel: 46, airAccel: 18, grav: 28, jump: 10.4, beam: 3.0, carry: 5.0, wr: 7.6, wrTime: 1.4, wrGrav: 0.15, wu: 7.2, wuTime: 0.55 };
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
const ATK = [0, 0.3, 0.3, 0.46];

export class Player {
  constructor(game, hero) {
    this.g = game; this.h = hero; this.pos = new V(); this.vel = new V(); this.yaw = 0;
    this.state = 'air'; this.onGround = false; this.ground = null; this.t = 0; this.coyote = 0; this.jumpBuf = 0; this.noGrab = 0;
    this.hp = 3; this.maxHp = 3; this.inv = 0; this.carry = null; this.combo = 0; this.lastAtkEnd = -9; this.lastWall = null;
    this.phase = 0; this.flip = 0; this.landT = 0; this.stepT = 0; this.contacts = []; this.st = {};
  }
  get fwd() { return new V(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  spawn(p, yaw) { this.pos.copy(p); this.vel.set(0, 0, 0); this.yaw = yaw; this.camYawHint = yaw; this.state = 'air'; this.onGround = false; this.ground = null; this.lastWall = null; this.flip = 0; this.inv = 0; }

  /* ---------- collision ---------- */
  boxes() { const L = this.g.level; return L.nearR ? L.nearR(this.pos.x, this.pos.z, 4) : L.boxes; }
  moveH(ax, d) {
    if (!d) return; const p = this.pos; p[ax] += d;
    for (const b of this.boxes()) {
      if (!b.active) continue;
      if (p.x + R <= b.min.x || p.x - R >= b.max.x || p.z + R <= b.min.z || p.z - R >= b.max.z || p.y + H <= b.min.y + 0.01 || p.y >= b.max.y - 0.01) continue;
      if (b.max.y <= p.y + STEP && (this.onGround || this.vel.y <= 0)) continue;
      p[ax] = d > 0 ? b.min[ax] - R : b.max[ax] + R; this.contacts.push({ b, ax, s: d > 0 ? 1 : -1 }); this.vel[ax] = 0;
    }
  }
  moveV(dt) {
    const p = this.pos, prevY = p.y, ny = prevY + this.vel.y * dt;
    if (this.vel.y <= 0) {
      const lo = this.onGround ? Math.min(ny, prevY - 0.45) : ny; let best = -1e9, bb = null;
      for (const b of this.boxes()) {
        if (!b.active) continue;
        if (p.x + RF <= b.min.x || p.x - RF >= b.max.x || p.z + RF <= b.min.z || p.z - RF >= b.max.z) continue;
        const top = b.max.y; if (top <= prevY + STEP && top >= lo - 0.001 && top > best) { best = top; bb = b; }
      }
      if (bb) { const was = this.onGround, fall = this.vel.y; p.y = best; this.vel.y = 0; this.onGround = true; this.ground = bb; if (!was) this.onLand(fall); return; }
    } else {
      for (const b of this.boxes()) {
        if (!b.active) continue;
        if (p.x + R <= b.min.x || p.x - R >= b.max.x || p.z + R <= b.min.z || p.z - R >= b.max.z) continue;
        if (b.min.y >= prevY + H - 0.05 && b.min.y < ny + H) { p.y = b.min.y - H; this.vel.y = 0; return; }
      }
    }
    p.y = ny; if (this.onGround) { this.onGround = false; this.ground = null; this.coyote = 0.11; }
  }
  phys(dt, gs = 1) { this.vel.y -= C.grav * gs * dt; if (this.vel.y < -40) this.vel.y = -40; this.contacts.length = 0; this.moveH('x', this.vel.x * dt); this.moveH('z', this.vel.z * dt); this.moveV(dt); }
  bodyFree(p) { for (const b of this.boxes()) { if (!b.active) continue; if (p.x + R > b.min.x && p.x - R < b.max.x && p.z + R > b.min.z && p.z - R < b.max.z && p.y + H > b.min.y + 0.02 && p.y < b.max.y - 0.02) return false; } return true; }
  nearWall(reach = R + 0.5) {
    const p = this.pos; let best = null, bd = reach;
    for (const b of this.boxes()) {
      if (!b.active || !b.run) continue; if (b.min.y > p.y + 0.6 || b.max.y < p.y + 1.3) continue;
      const cx = clamp(p.x, b.min.x, b.max.x), cz = clamp(p.z, b.min.z, b.max.z), dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d < 1e-4 || d >= bd) continue;
      const n = Math.abs(dx) > Math.abs(dz) ? new V(Math.sign(dx), 0, 0) : new V(0, 0, Math.sign(dz));
      if ((n.x ? b.max.z - b.min.z : b.max.x - b.min.x) < 1.2) continue; // the thin end of a wall is not a running surface
      const al = n.x ? 'z' : 'x'; if (p[al] < b.min[al] - 0.1 || p[al] > b.max[al] + 0.1) continue; // must be beside the face, not at its corner
      bd = d; best = { b, d, n };
    }
    return best;
  }
  /* أي جدار (حتى لو مو للركض) بمستوى الصدر: للالتصاق والطلّة */
  wallFace(pos = this.pos, reach = R + 0.15, wantN = null) {
    const p = pos; let best = null, bd = reach;
    for (const b of this.boxes()) {
      if (!b.active || b.door) continue; if (b.min.y > p.y + 0.5 || b.max.y < p.y + 1.5) continue;
      const cx = clamp(p.x, b.min.x, b.max.x), cz = clamp(p.z, b.min.z, b.max.z), dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d < 1e-4 || d >= bd) continue;
      const n = Math.abs(dx) > Math.abs(dz) ? new V(Math.sign(dx), 0, 0) : new V(0, 0, Math.sign(dz));
      if (wantN && (n.x !== wantN.x || n.z !== wantN.z)) continue;
      const al = n.x ? 'z' : 'x'; if (p[al] < b.min[al] - 0.02 || p[al] > b.max[al] + 0.02) continue;
      if (b.max[al] - b.min[al] < 0.5) continue;
      bd = d; best = { b, d, n };
    }
    return best;
  }
  /* حاجز السفينة (الهيكل): تقفز فوقه وتتعلّق من برّا — تختفي عن عيون الحراس */
  hullEdge() {
    if (!this.g.level.cfg.ship || !this.onGround || this.carry || this.dragging || this.holding || this.aiming) return null;
    const p = this.pos;
    for (const b of this.boxes()) {
      if (!b.hull || !b.active) continue; if (p.y < b.max.y - 1.8 || p.y > b.max.y - 0.6) continue;
      if (p.z < b.min.z + 0.5 || p.z > b.max.z - 0.5) continue;
      const inner = b.min.x > 0 ? b.min.x : b.max.x, d = Math.abs(p.x - inner); if (d > R + 0.45) continue;
      const out = new V(b.min.x > 0 ? 1 : -1, 0, 0); return { b, n: out, top: b.max.y };
    }
    return null;
  }
  startEdgeHang(E) { this.startHang(E); this.g.sfx.jump(); this.edgeHang = true; this.g.onEdgeHang && this.g.onEdgeHang(); }
  /* ---------- الالتصاق بالجدار (ظهرك على الحديد) + الطلّة من الزاوية ---------- */
  startHug(w) {
    this.state = 'hug'; this.hug = { n: w.n.clone(), t: new V(-w.n.z, 0, w.n.x), edge: 0, peek: 0, move: 0, still: 0 };
    this.vel.set(0, 0, 0); this.yaw = Math.atan2(w.n.x, w.n.z); this.hugIn = 0; this.g.sfx.land && this.g.sfx.land(0.35);
  }
  hugUpd(dt, inp) {
    const H = this.hug, { v, m } = this.moveInput(inp), vn = m > 0.1 ? v.dot(H.n) : 0;
    if (inp.jumpP || inp.rollP || inp.atkP || this.carry || this.dragging || this.aiming || (m > 0.3 && vn > 0.55)) { this.state = 'ground'; this.hug = null; this.locomotion(dt, inp); return; }
    const tin = m > 0.1 ? v.dot(H.t) : 0;
    H.move = 0;
    if (Math.abs(tin) > 0.15) {
      const step = H.t.clone().multiplyScalar(Math.sign(tin) * Math.min(1, Math.abs(tin)) * 2.1 * dt), np = this.pos.clone().add(step);
      // الجدار لازم يكمّل تحتك عند النقطة الجديدة (نفحص من الجسم + نص قطر للأمام عشان نوقف قبل الطرف)
      const probe = np.clone().addScaledVector(H.t, Math.sign(tin) * 0.22);
      const w = this.wallFace(probe, R + 0.35, H.n);
      if (w) { this.pos.copy(np); H.edge = 0; H.move = Math.sign(tin); H.peek = Math.max(0, H.peek - dt * 4); }
      else { H.edge = Math.sign(tin); H.peek = Math.min(1, H.peek + dt * 3.2); }
    } else H.peek = Math.max(0, H.peek - dt * 3);
    const w = this.wallFace(this.pos, R + 0.35, H.n);
    if (!w) { this.state = 'ground'; this.hug = null; return; }
    this.pos.addScaledVector(H.n, (R + 0.03) - w.d); // ظهرك ملزوق
    this.yaw += angDiff(this.yaw, Math.atan2(H.n.x, H.n.z)) * Math.min(1, dt * 12);
    H.still = H.move ? 0 : H.still + dt;
    this.vel.set(0, Math.min(0, this.vel.y), 0); this.phys(dt);
    if (!this.onGround) { this.state = 'air'; this.hug = null; }
  }
  findLedge() {
    const p = this.pos, f = this.fwd;
    for (const b of this.boxes()) {
      if (!b.active || !b.ledge) continue; const d = b.max.y - p.y; if (d < 1.35 || d > 2.15) continue;
      const cx = clamp(p.x, b.min.x, b.max.x), cz = clamp(p.z, b.min.z, b.max.z), dx = cx - p.x, dz = cz - p.z, dist = Math.hypot(dx, dz);
      if (dist > R + 0.2 || dist < 1e-4) continue; if ((dx * f.x + dz * f.z) / dist < 0.45) continue;
      const n = Math.abs(dx) > Math.abs(dz) ? new V(-Math.sign(dx), 0, 0) : new V(0, 0, -Math.sign(dz));
      const ext = n.x ? b.max.x - b.min.x : b.max.z - b.min.z; if (ext < 0.25) continue;
      return { b, n, top: b.max.y };
    }
    return null;
  }

  /* ---------- main update ---------- */
  update(dt, inp) {
    if (this.inLocker) { this.t += dt; this.vel.set(0, 0, 0); this.state = 'ground'; return; }
    this.t += dt; this.inv = Math.max(0, this.inv - dt); this.noGrab = Math.max(0, this.noGrab - dt); this.flip = Math.max(0, this.flip - dt); this.landT = Math.max(0, this.landT - dt);
    if (inp.jumpP) this.jumpBuf = 0.14; else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.inp = inp;
    if (this.ground && this.ground.active && (this.onGround || this.state === 'hang')) this.pos.add(this.ground.delta);
    const W = this.g.waterAt && this.g.waterAt(this.pos);
    if (W && this.state !== 'swim' && this.state !== 'climb' && this.state !== 'hang' && this.pos.y + 1.0 < W.y1 && this.vel.y <= 0 && this.t > (this.leapT || 0)) this.startSwim(W);
    if (inp.spP && !this.carry && (this.state === 'ground' || this.state === 'air' || this.state === 'attack')) this.startSpin();
    switch (this.state) {
      case 'ground': case 'air': this.locomotion(dt, inp); break;
      case 'wallrun': this.wallRun(dt); break;
      case 'wallup': this.wallUp(dt); break;
      case 'hang': this.hangUpd(dt, inp); break;
      case 'climb': this.climbUpd(dt); break;
      case 'roll': this.rollUpd(dt, inp); break;
      case 'attack': this.attackUpd(dt, inp); break;
      case 'slam': this.slamUpd(dt); break;
      case 'swing': this.swingUpd(dt, inp); break;
      case 'swim': this.swimUpd(dt, inp); break;
      case 'hug': this.hugUpd(dt, inp); break;
      case 'spin': this.spinUpd(dt); break;
      case 'hurt': this.st.hurtT -= dt; this.phys(dt); if (this.st.hurtT <= 0) this.state = this.onGround ? 'ground' : 'air'; break;
    }
    if (this.pos.y < this.g.level.cfg.killY) this.g.onFall();
  }
  moveInput(inp) { const v = new V(inp.mx, 0, inp.mz), m = Math.min(1, v.length()); return { v, m }; }
  steer(dt, want, acc) {
    const dvx = want.x - this.vel.x, dvz = want.z - this.vel.z, dl = Math.hypot(dvx, dvz), s = acc * dt;
    if (dl > s) { this.vel.x += (dvx / dl) * s; this.vel.z += (dvz / dl) * s; } else { this.vel.x = want.x; this.vel.z = want.z; }
  }
  locomotion(dt, inp) {
    const { v, m } = this.moveInput(inp);
    this.onBeam = this.onGround && this.ground && this.ground.beam;
    const max = this.carry ? C.carry : this.holding ? 1.5 : this.dragging ? 2.6 : this.aiming ? 2.4 : this.onBeam ? C.beam : C.run;
    this.airLock = Math.max(0, (this.airLock || 0) - dt);
    if (this.onGround) this.airLock = 0;
    if (this.airLock <= 0) this.steer(dt, v.clone().multiplyScalar(max), this.onGround ? C.accel : C.airAccel);
    if (this.dragging || this.aiming || this.holding) this.jumpBuf = 0;
    if (m > 0.1 && this.airLock <= 0 && !this.aiming && !(this.holding && v.dot(this.fwd) < -0.3)) this.yaw += angDiff(this.yaw, Math.atan2(v.x, v.z)) * Math.min(1, dt * (this.onGround ? 14 : 5));
    this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && this.onGround) { const E = this.hullEdge(); if (E && (m < 0.2 || v.clone().normalize().dot(E.n) > 0.5 || this.fwd.dot(E.n) > 0.5)) { this.jumpBuf = 0; return this.startEdgeHang(E); } }
    if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0)) {
      this.jumpBuf = 0; this.coyote = 0;
      const w = this.nearWall(R + 0.45);
      if (w && !this.carry) { const into = Math.max(this.fwd.dot(w.n) * -1, m > 0.2 ? v.clone().normalize().dot(w.n) * -1 : -1); if (into > 0.6) return this.startWallUp(w); }
      this.vel.y = C.jump * (this.carry ? 0.85 : 1); this.onGround = false; this.ground = null; this.g.sfx.jump(); this.g.dust(this.pos, 8);
    }
    if (!this.onGround && !this.carry) {
      const w = this.nearWall();
      if (w && w.b !== this.lastWall) {
        const vin = -(this.vel.x * w.n.x + this.vel.z * w.n.z), vp = new V(this.vel.x + w.n.x * vin, 0, this.vel.z + w.n.z * vin), sp = vp.length();
        if (sp >= 3 && this.vel.y > -7) return this.startWallRun(w, vp.normalize());
        if (-this.fwd.dot(w.n) > 0.6 && (vin > 1.2 || this.jumpBuf > 0) && this.vel.y > -4.5) return this.startWallUp(w);
      }
      if (this.vel.y < 2 && this.noGrab <= 0) { const L = this.findLedge(); if (L) return this.startHang(L); }
      const bar = this.findBar(); if (bar) return this.startSwing(bar);
    }
    if (this.onGround && this.g.level.cfg.ship && !this.carry && !this.dragging && !this.holding && !this.aiming && m > 0.45) {
      const wf = this.wallFace(this.pos, R + 0.18);
      if (wf && v.clone().normalize().dot(wf.n) < -0.8) { this.hugIn = (this.hugIn || 0) + dt; if (this.hugIn > 0.2) return this.startHug(wf); } else this.hugIn = 0;
    } else this.hugIn = 0;
    if (inp.atkP && !this.carry && !this.dragging && !this.aiming) { if (this.onGround || this.coyote > 0) return this.startAttack(); if (this.vel.y < 5) return this.startSlam(); }
    if (inp.rollP && this.onGround && !this.carry && !this.dragging) return this.startRoll(v, m);
    if (inp.rollP && !this.onGround && !this.carry && this.g.upg.dash && !this.dashed) {
      this.dashed = true; const d = m > 0.2 ? v.clone().normalize() : this.fwd; this.yaw = Math.atan2(d.x, d.z);
      this.vel.set(d.x * 15, 2, d.z * 15); this.airLock = 0.22; this.inv = Math.max(this.inv, 0.25); this.g.sfx.roll();
      this.g.fx.emit(this.pos.clone().add(new V(0, 1, 0)), { color: 0x9be7ff, count: 24, speed: 3, life: 0.35, size: 0.3, vel: d.clone().multiplyScalar(-4) });
    }
    this.phys(dt);
    if (this.onGround) {
      this.state = 'ground'; this.lastWall = null;
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (hs > 1) { this.stepT -= dt * hs; if (this.stepT <= 0) { this.stepT = 2.6; this.g.sfx.step(); if (hs > 5) this.g.dust(this.pos, 2); } }
    } else this.state = 'air';
  }
  onLand(fall) {
    if (fall < -9) { this.landT = 0.16; this.g.sfx.land(Math.min(1.5, -fall / 14)); this.g.dust(this.pos, 14); }
    this.lastWall = null; this.noGrab = 0; this.flip = 0; this.dashed = false;
  }
  /* ---------- wall run ---------- */
  startWallRun(w, dir) {
    this.state = 'wallrun'; this.wall = w; this.lastWall = w.b; this.st.wrT = 0; this.st.dir = dir;
    this.vel.y = clamp(this.vel.y, 3.2, 3.8); this.g.sfx.wallrun(); this.flip = 0;
  }
  stick(w) { const b = w.b, n = w.n; if (n.x) this.pos.x = n.x > 0 ? b.max.x + R + 0.01 : b.min.x - R - 0.01; else this.pos.z = n.z > 0 ? b.max.z + R + 0.01 : b.min.z - R - 0.01; }
  wallRun(dt) {
    const w = this.wall, b = w.b, n = w.n, dir = this.st.dir; this.st.wrT += dt;
    this.vel.x = dir.x * C.wr; this.vel.z = dir.z * C.wr; this.vel.y -= C.grav * C.wrGrav * dt;
    this.yaw += angDiff(this.yaw, Math.atan2(dir.x, dir.z)) * Math.min(1, dt * 20);
    const along = n.x ? 'z' : 'x'; this.contacts.length = 0; this.moveH(along, this.vel[along] * dt); this.stick(w); this.moveV(dt);
    if (this.onGround) { this.state = 'ground'; return; }
    if (Math.random() < 0.5) this.g.fx.emit(this.pos.clone().add(new V(-n.x * 0.3, 0.2, -n.z * 0.3)), { color: 0x9be7ff, count: 1, speed: 1, life: 0.4, size: 0.25, grav: 1 });
    const a = this.pos[along];
    if (this.jumpBuf > 0) { this.jumpBuf = 0; return this.wallJump(n, dir); }
    if (this.contacts.length || a < b.min[along] - 0.05 || a > b.max[along] + 0.05 || this.st.wrT > C.wrTime || this.pos.y > b.max.y - 0.4 || this.pos.y + 1.3 < b.min.y) {
      this.state = 'air'; this.vel.x += n.x * 1.2; this.vel.z += n.z * 1.2; this.noGrab = 0.05;
    }
  }
  wallJump(n, dir) {
    this.vel.set(n.x * (dir ? 7 : 6.5) + (dir ? dir.x * 5.5 : 0), 9.6, n.z * (dir ? 7 : 6.5) + (dir ? dir.z * 5.5 : 0));
    this.yaw = Math.atan2(this.vel.x, this.vel.z); this.state = 'air'; this.flip = 0.5; this.noGrab = 0.12; this.airLock = dir ? 0.42 : 0.38;
    this.g.sfx.jump(); this.g.fx.emit(this.pos.clone().add(new V(0, 1, 0)), { color: 0x9be7ff, count: 16, speed: 4, life: 0.4, size: 0.25 });
  }
  /* ---------- wall climb ---------- */
  startWallUp(w) { this.state = 'wallup'; this.wall = w; this.lastWall = w.b; this.st.wuT = 0; this.vel.set(0, C.wu, 0); this.yaw = Math.atan2(-w.n.x, -w.n.z); this.onGround = false; this.ground = null; this.g.sfx.wallrun(); }
  wallUp(dt) {
    const w = this.wall; this.st.wuT += dt;
    if (this.st.wuT < C.wuTime) this.vel.y = C.wu; else this.vel.y -= C.grav * dt;
    this.vel.x = this.vel.z = 0; this.stick(w); this.moveV(dt);
    if (this.onGround) { this.state = 'ground'; return; }
    const L = this.findLedge(); if (L) return this.startHang(L);
    if (this.jumpBuf > 0 && this.st.wuT > 0.08) { this.jumpBuf = 0; return this.wallJump(w.n, null); }
    if (this.st.wuT > 0.85 || this.pos.y > w.b.max.y) { this.state = 'air'; this.vel.x = w.n.x * 1.5; this.vel.z = w.n.z * 1.5; this.noGrab = 0.1; }
  }
  /* ---------- ledges ---------- */
  startHang(L) {
    this.state = 'hang'; this.hang = L; this.vel.set(0, 0, 0); this.pos.y = L.top - 2.0;
    const b = L.b, n = L.n; if (n.x) this.pos.x = n.x > 0 ? b.max.x + R + 0.02 : b.min.x - R - 0.02; else this.pos.z = n.z > 0 ? b.max.z + R + 0.02 : b.min.z - R - 0.02;
    this.yaw = Math.atan2(-n.x, -n.z); this.st.hT = 0; this.st.push = 0; this.g.sfx.grab(); this.flip = 0; this.ground = L.b;
  }
  hangUpd(dt, inp) {
    const L = this.hang, b = L.b, n = L.n; this.st.hT += dt; this.edgeHang = !!b.hull;
    if (!b.active) { this.state = 'air'; this.ground = null; return; }
    this.pos.y = L.top - 2.0 + (b.max.y - L.top); L.top = b.max.y;
    const { v, m } = this.moveInput(inp), t = new V(-n.z, 0, n.x), al = v.dot(t), into = -v.dot(n), ax = n.x ? 'z' : 'x';
    this.st.shim = Math.abs(al) > 0.3 ? al : 0;
    if (Math.abs(al) > 0.3) this.pos[ax] = clamp(this.pos[ax] + t[ax] * al * 1.9 * dt, b.min[ax] + 0.15, b.max[ax] - 0.15);
    if (into > 0.6) this.st.push += dt; else this.st.push = 0;
    if (this.jumpBuf > 0 && this.st.hT > 0.12) { this.jumpBuf = 0; if (-into > 0.5) { this.ground = null; return this.wallJump(n, null); } return this.startClimb(); }
    if (this.st.push > 0.28) return this.startClimb();
    if (-into > 0.7) this.st.pull = (this.st.pull || 0) + dt; else this.st.pull = 0;
    if (b.hull) return; // متعلّق برّا السفينة: ما نطيّحك في البحر بالغلط
    if ((inp.rollP || this.st.pull > 0.35) && this.st.hT > 0.2) { this.state = 'air'; this.ground = null; this.noGrab = 0.4; this.vel.set(n.x * 1.5, 0, n.z * 1.5); }
  }
  startClimb() {
    const L = this.hang, b = L.b, n = L.n, ext = n.x ? b.max.x - b.min.x : b.max.z - b.min.z, inward = Math.min(0.5, ext / 2);
    const dest = this.pos.clone(); dest.y = L.top;
    if (n.x) dest.x = n.x > 0 ? b.max.x - inward : b.min.x + inward; else dest.z = n.z > 0 ? b.max.z - inward : b.min.z + inward;
    if (!this.bodyFree(dest)) { this.st.push = 0; return; }
    this.state = 'climb'; this.st.cT = 0; this.st.from = this.pos.clone(); this.st.to = dest; this.g.sfx.grab();
  }
  climbUpd(dt) {
    this.st.cT += dt / 0.5; const k = clamp(this.st.cT, 0, 1), f = this.st.from, to = this.st.to;
    const ky = easeOut(k / 0.6), kh = clamp((k - 0.5) / 0.5, 0, 1);
    this.pos.y = f.y + (to.y - f.y) * ky; this.pos.x = f.x + (to.x - f.x) * kh; this.pos.z = f.z + (to.z - f.z) * kh;
    if (k >= 1) { this.pos.copy(to); this.state = 'ground'; this.onGround = true; this.ground = this.hang.b; this.vel.set(0, 0, 0); }
  }
  /* ---------- roll ---------- */
  startRoll(v, m) { this.state = 'roll'; this.st.rT = 0; const d = m > 0.2 ? v.clone().normalize() : this.fwd; this.st.rd = d; this.yaw = Math.atan2(d.x, d.z); this.inv = Math.max(this.inv, 0.4); this.g.sfx.roll(); this.g.dust(this.pos, 10); }
  rollUpd(dt, inp) {
    this.st.rT += dt; const k = this.st.rT / 0.46, sp = 10 * (1 - k * 0.45);
    this.vel.x = this.st.rd.x * sp; this.vel.z = this.st.rd.z * sp; this.phys(dt);
    if (k >= 1) { this.state = this.onGround ? 'ground' : 'air'; }
    else if (this.jumpBuf > 0 && k > 0.5 && this.onGround) { this.state = 'ground'; this.locomotion(dt, inp); }
  }
  /* ---------- combat ---------- */
  startAttack() {
    if (this.spy && this.g.tryGrab && this.g.tryGrab()) return; // وراه وما انتبه؟ امسكه
    this.combo = this.t - this.lastAtkEnd < 0.45 && this.combo < 3 ? this.combo + 1 : 1;
    this.state = 'attack'; this.st.aT = 0; this.st.hit = false; this.st.queued = false;
    const e = this.g.enemies.nearest(this.pos, 4.5); this.st.tgt = e || null; if (e) this.yaw = Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
    if (this.spy) { this.g.sfx.noise(0.08, 500, 1, 0.12, 'bandpass'); } else this.g.sfx.slash(this.combo);
  }
  attackUpd(dt, inp) {
    this.st.aT += dt; const dur = ATK[this.combo], k = this.st.aT / dur, f = this.fwd; this.atkK = k;
    let lunge = k < 0.35 ? (this.combo === 3 ? 7 : 5) * (1 - k / 0.35) * (this.spy ? 0.55 : 1) : 0;
    // 🎯 نقرّب للمسافة الصحيحة بالضبط عشان الضربة توصل للوجه/الصدر (مو في الهوا ولا داخل جسمه)
    const T = this.st.tgt;
    if (T && k < 0.4 && (T.alive !== false)) { const dx = T.pos.x - this.pos.x, dz = T.pos.z - this.pos.z, dd = Math.hypot(dx, dz), want = this.spy ? (this.combo === 3 ? 1.0 : 0.62) : 1.25;
      this.yaw += angDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 20); lunge = Math.max(-3, Math.min(16, (dd - want) / Math.max(1 / 60, dur * (0.36 - k)))); }
    this.vel.x = f.x * lunge; this.vel.z = f.z * lunge; this.phys(dt);
    if (!this.st.hit && k >= 0.38) {
      this.st.hit = true; const big = this.combo === 3;
      // بدلة التجسس: لكمة، لكمة، ركلة دوّارة — مدى أقصر من السيف
      const n = this.spy ? this.g.enemies.hitArc(this.pos, this.yaw, big ? 2.0 : 1.75, 0.35, big ? 2 : 1, big ? 7 : 1.2) : this.g.enemies.hitArc(this.pos, this.yaw, big ? 2.8 : 2.5, 0.25, (big ? 2 : 1) + this.g.upg.dmg, big ? 9 : 3.5);
      if (n) { this.g.hitstop(big ? 0.09 : 0.055); this.g.shake(big ? 0.3 : 0.14); this.g.sfx.hit(); }
    }
    if (inp.atkP) this.st.queued = true;
    if (this.jumpBuf > 0 && k > 0.45) { this.state = 'ground'; this.lastAtkEnd = this.t; return; }
    if (inp.rollP && k > 0.3) { this.lastAtkEnd = -9; const { v, m } = this.moveInput(inp); return this.startRoll(v, m); }
    if (k >= 1) { this.lastAtkEnd = this.t; if (this.st.queued && this.combo < 3) return this.startAttack(); this.state = this.onGround ? 'ground' : 'air'; if (this.combo >= 3) this.combo = 0; }
  }
  /* ---------- swing bars ---------- */
  findBar() {
    const bars = this.g.level.bars; if (!bars || this.noBar > this.t) return null;
    const hx = this.pos.x, hy = this.pos.y + 2.0, hz = this.pos.z;
    for (const b of bars) {
      if (b === this.lastBar && this.noBar + 0.5 > this.t) continue;
      const along = b.axis === 'x' ? hx - b.p.x : hz - b.p.z; if (Math.abs(along) > b.half) continue;
      const d = b.axis === 'x' ? Math.hypot(hy - b.p.y, hz - b.p.z) : Math.hypot(hy - b.p.y, hx - b.p.x);
      if (d < 0.8) return b;
    }
    return null;
  }
  startSwing(b) {
    const f = b.axis === 'x' ? new V(0, 0, 1) : new V(1, 0, 0), vf = this.vel.x * f.x + this.vel.z * f.z;
    if (vf < 0 || (Math.abs(vf) < 0.5 && this.fwd.dot(f) < 0)) f.negate();
    this.state = 'swing'; this.bar = b; this.lastBar = b; this.st.f = f;
    this.st.th = Math.atan2(this.pos.x * f.x + this.pos.z * f.z - (b.p.x * f.x + b.p.z * f.z), 2.0) * 0.6;
    this.st.om = Math.max(2.2, Math.abs(vf) / 2.0); this.vel.set(0, 0, 0); this.flip = 0;
    this.yaw = Math.atan2(f.x, f.z); this.g.sfx.grab(); this.ground = null; this.onGround = false;
  }
  swingUpd(dt, inp) {
    const b = this.bar, f = this.st.f, L = 2.0;
    const push = (inp.mx * f.x + inp.mz * f.z);
    this.st.om += (-(C.grav / L) * Math.sin(this.st.th) + push * 2.2 * Math.cos(this.st.th)) * dt; this.st.om *= Math.exp(-0.25 * dt);
    this.st.th += this.st.om * dt; this.st.th = clamp(this.st.th, -1.35, 1.35);
    const ax = b.axis === 'x' ? 'x' : 'z';
    const keep = this.pos[ax];
    this.pos.set(b.p.x + f.x * Math.sin(this.st.th) * L, b.p.y - Math.cos(this.st.th) * L, b.p.z + f.z * Math.sin(this.st.th) * L); this.pos[ax] = keep;
    if (this.jumpBuf > 0) {
      this.jumpBuf = 0; const tv = this.st.om * L, c = Math.cos(this.st.th), sn = Math.sin(this.st.th);
      const fwdBoost = Math.max(3.5, tv * c + 3);
      this.vel.set(f.x * fwdBoost, Math.max(6.5, tv * sn + 6.5), f.z * fwdBoost);
      this.state = 'air'; this.noBar = this.t; this.noGrab = 0.2; this.flip = 0.5; this.airLock = 0.25; this.g.sfx.jump(); return;
    }
    if (inp.rollP) { this.state = 'air'; this.noBar = this.t; this.vel.set(0, 0, 0); }
  }
  /* ---------- spin special (unlocked by shards) ---------- */
  startSpin() {
    if (!this.g.upg.spin || this.t < (this.spinReady || 0)) return false;
    this.state = 'spin'; this.st.spT = 0; this.st.hit = 0; this.spinReady = this.t + (this.g.upg.fastSpin ? 1.5 : 3);
    this.g.sfx.slash(3); this.g.sfx.wallrun(); this.g.hud(); return true;
  }
  spinUpd(dt) {
    this.st.spT += dt; this.vel.x *= Math.exp(-4 * dt); this.vel.z *= Math.exp(-4 * dt); this.phys(dt, this.onGround ? 1 : 0.4);
    if (this.st.hit < 2 && this.st.spT > 0.12 + this.st.hit * 0.2) {
      this.st.hit++; const n = this.g.enemies.hitRadius(this.pos, 3.3, 2 + this.g.upg.dmg, 9);
      if (n) { this.g.hitstop(0.07); this.g.shake(0.3); this.g.sfx.hit(); }
      this.g.fx.emit(this.pos.clone().add(new V(0, 1, 0)), { color: this.g.upg.fire ? 0xffa040 : 0x9be7ff, count: 40, speed: 7, flat: true, life: 0.35, size: 0.3, grav: 0 });
    }
    if (this.st.spT > 0.55) this.state = this.onGround ? 'ground' : 'air';
  }
  /* ---------- swimming ---------- */
  startSwim(W) {
    this.state = 'swim'; this.water = W; this.vel.y *= 0.25; this.flip = 0; this.onGround = false; this.ground = null; this.dashed = false;
    if (this.carry) this.g.dropItem(true);
    this.g.splash && this.g.splash(new V(this.pos.x, W.y1, this.pos.z));
  }
  swimUpd(dt, inp) {
    const W = this.g.waterAt(this.pos); if (!W || this.pos.y + 0.7 > W.y1 + 0.4) { this.state = 'air'; return; }
    this.water = W;
    const { v, m } = this.moveInput(inp); const sp = 4.8;
    this.steer(dt, v.clone().multiplyScalar(sp), 12);
    const surf = W.y1 - 1.35;
    const vyT = inp.jumpH ? 4 : inp.rollH ? -4.2 : Math.max(-1, Math.min(1.4, (surf - this.pos.y) * 2.2));
    this.vel.y += (vyT - this.vel.y) * Math.min(1, dt * 4);
    if (W.cur) { this.vel.x += W.cur.x * dt * 3; this.vel.z += W.cur.z * dt * 3; }
    let drx = 0, drz = 0; for (const c of this.g.level.currents || []) if (this.pos.x > c.x0 && this.pos.x < c.x1 && this.pos.z > c.z0 && this.pos.z < c.z1) { drx += c.fx * 0.6; drz += c.fz * 0.6; }
    if (m > 0.1) this.yaw += angDiff(this.yaw, Math.atan2(v.x, v.z)) * Math.min(1, dt * 6);
    // leap out of the water at the surface
    if (this.jumpBuf > 0 && this.pos.y > surf - 0.35) { this.jumpBuf = 0; this.vel.y = 10.5; this.state = 'air'; this.leapT = this.t + 0.5; this.g.sfx.jump(); this.g.splash && this.g.splash(new V(this.pos.x, W.y1, this.pos.z)); }
    this.contacts.length = 0; this.moveH('x', (this.vel.x + drx) * dt); this.moveH('z', (this.vel.z + drz) * dt);
    const wasG = this.onGround; this.moveV(dt); if (this.onGround && !wasG) this.vel.y = 0; this.onGround = false;
    if (inp.atkP && !this.carry) { this.startAttack(); }
  }
  startSlam() { this.state = 'slam'; this.vel.set(0, 4, 0); this.st.sT = 0; this.g.sfx.slash(3); }
  slamUpd(dt) {
    this.st.sT += dt; if (this.st.sT > 0.15) this.vel.y = -22; this.vel.x = this.vel.z = 0; this.phys(dt, this.st.sT > 0.15 ? 0 : 1);
    if (this.onGround) {
      const n = this.g.enemies.hitRadius(this.pos, 2.9, 2 + this.g.upg.dmg, 8); this.g.shake(0.35); this.g.sfx.slam(); if (n) this.g.hitstop(0.08);
      this.g.fx.emit(this.pos.clone().add(new V(0, 0.2, 0)), { color: 0x9be7ff, count: 50, speed: 8, flat: true, life: 0.45, size: 0.3, grav: 0 }); this.g.dust(this.pos, 20);
      this.state = 'attack'; this.combo = 3; this.st.aT = ATK[3] * 0.7; this.st.hit = true; this.st.queued = false;
    }
  }
  damage(n, from) {
    if (this.inv > 0 || this.state === 'climb' || this.hp <= 0) return false;
    this.hp -= n; this.inv = 1.2; if (this.carry) this.g.dropItem(true);
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / l) * 7, 5, (dz / l) * 7); this.state = 'hurt'; this.st.hurtT = 0.35; this.onGround = false; this.ground = null;
    this.g.sfx.hurt(); this.g.shake(0.3); this.g.flashHurt(); this.g.hud();
    if (this.hp <= 0) this.g.onDeath();
    return true;
  }

  /* ---------- animation ---------- */
  animate(dt) {
    const h = this.h, P = { ...BASE }, s = Math.min(1.2, Math.hypot(this.vel.x, this.vel.z) / C.run), t = this.t;
    let rate = 14; const fast = {};
    const run = (A, speedMul = 1) => {
      const ph = this.phase;
      P.thLx = Math.sin(ph) * 1.0 * A; P.thRx = -Math.sin(ph) * 1.0 * A;
      P.knL = 0.15 + A * 1.35 * Math.max(0, Math.cos(ph)); P.knR = 0.15 + A * 1.35 * Math.max(0, -Math.cos(ph));
      P.shLx = -Math.sin(ph) * 0.9 * A; P.shRx = 0.35 + Math.sin(ph) * 0.55 * A; P.elL = 0.4 + 0.8 * A; P.elR = 0.9;
      P.spineX = 0.06 + 0.32 * A; P.hipY = -0.05 * A + Math.abs(Math.cos(ph)) * 0.07 * A; P.spineY = Math.sin(ph) * 0.15 * A; P.hipYaw = -Math.sin(ph) * 0.12 * A; P.headX = -0.18 * A;
    };
    const st = this.state;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.phase += dt * (st === 'wallrun' ? 15 : st === 'wallup' ? 16 : st === 'hug' ? (this.hug && this.hug.move ? 9 : 1) : Math.max(2, hs * 1.45));
    if (st === 'ground' || (st === 'roll' && false)) {
      if (s > 0.06) run(Math.min(1, s * (this.onBeam ? 1.6 : 1)));
      else { P.chestX = Math.sin(t * 2) * 0.03; P.hipY = Math.sin(t * 2) * 0.012 - 0.04; P.knL = P.knR = 0.18; P.thLx = P.thRx = 0.06; P.shRx = 0.65; P.elR = 1.0; P.shRz = 0.25; P.shLz = 0.25; P.elL = 0.5; P.headY = Math.sin(t * 0.5) * 0.2; }
      if (this.holding) { P.shLx = P.shRx = 1.25; P.elL = P.elR = 1.7; P.shLz = P.shRz = -0.25; P.spineX = 0.18; P.headX = 0.15; } // ذراعين حول رقبة الحارس
      if (this.onBeam) { P.shLz = 1.35; P.shRz = 1.35; P.shLx = 0.1; P.shRx = 0.2; P.elL = P.elR = 0.2; P.rootRoll = Math.sin(t * 2.3) * 0.08; P.spineX = 0.15; }
    } else if (st === 'hug' && this.hug) {
      const H = this.hug, side = this.phase;
      P.spineX = -0.12; P.chestX = -0.06; P.headX = -0.1; P.knL = P.knR = 0.22; P.thLx = P.thRx = 0.08;
      P.shLz = 0.55; P.shRz = 0.55; P.shLx = -0.35; P.shRx = -0.35; P.elL = P.elR = 0.25; // كفوف على الحديد
      if (H.move) { P.thLx = 0.08 + Math.sin(side) * 0.35; P.thRx = 0.08 - Math.sin(side) * 0.35; P.knL = 0.25 + Math.max(0, Math.sin(side)) * 0.5; P.knR = 0.25 + Math.max(0, -Math.sin(side)) * 0.5; }
      // نحسب يمين/يسار الطرف بالنسبة لوجه البطل: الوجه = n
      const lr = H.edge ? Math.sign(H.t.x * H.n.z - H.t.z * H.n.x) * H.edge : 0;
      P.headY = -lr * 1.0 * H.peek; P.spineY = -lr * 0.25 * H.peek; P.hipYaw = -lr * 0.1 * H.peek;
    } else if (st === 'air' || st === 'hurt') {
      const up = clamp(this.vel.y / 8, -1, 1);
      if (up > 0) { P.thLx = 0.9; P.knL = 1.3; P.thRx = -0.25; P.knR = 0.5; P.shLx = 0.4; P.shLz = 0.7; P.shRx = 0.8; P.shRz = 0.5; P.spineX = 0.12; }
      else { P.thLx = 0.3 - up * 0.1; P.knL = 0.5; P.thRx = 0.05; P.knR = 0.7; P.shLz = 1.0; P.shRz = 0.9; P.shLx = 0.3; P.elL = 0.4; P.spineX = 0.02; }
      if (this.flip > 0) { P.rootPitch = -Math.PI * 2 * (1 - this.flip / 0.5); P.thLx = P.thRx = 1.8; P.knL = P.knR = 2.2; P.shLx = P.shRx = 1.0; P.elL = P.elR = 1.5; P.spineX = 0.5; fast.rootPitch = 60; }
      if (st === 'hurt') { P.spineX = -0.5; P.headX = 0.35; P.shLx = -0.4; P.shRx = -0.4; P.shLz = 0.9; P.shRz = 0.9; rate = 22; }
    } else if (st === 'wallrun') {
      run(1); const r = new V(-Math.cos(this.yaw), 0, Math.sin(this.yaw)), side = this.wall.n.dot(r) > 0 ? 1 : -1;
      P.rootRoll = side * 0.55; P.spineX = 0.2; if (side > 0) { P.shLz = 1.2; P.shLx = 0.4; } else { P.shRz = 1.2; P.shRx = 0.4; } rate = 18;
    } else if (st === 'wallup') {
      run(1); P.thLx *= 1.35; P.thRx *= 1.35; P.spineX = -0.12; P.headX = -0.4; rate = 20;
    } else if (st === 'hang') {
      const sh = this.st.shim || 0, w = Math.sin(t * 9) * (sh ? 0.25 : 0);
      P.shLx = P.shRx = 2.95; P.shLz = 0.28 + w; P.shRz = 0.28 - w; P.elL = P.elR = 0.15; P.spineX = 0.05; P.headX = -0.25;
      P.thLx = 0.25 + Math.sin(t * 1.6) * 0.06; P.knL = 0.35; P.thRx = 0.1; P.knR = 0.5; P.thLz = 0.06 + w * 0.4; P.thRz = 0.06 - w * 0.4; rate = 18;
    } else if (st === 'climb') {
      const k = clamp(this.st.cT, 0, 1), mid = Math.sin(k * Math.PI);
      P.shLx = P.shRx = 2.95 - k * 2.6; P.elL = P.elR = 0.15 + mid * 1.6; P.thLx = 0.2 + mid * 1.5; P.knL = 0.3 + mid * 1.9; P.thRx = mid * 0.6; P.knR = 0.4 + mid; P.spineX = 0.1 + mid * 0.6; P.hipY = -mid * 0.25; rate = 26;
    } else if (st === 'roll') {
      const k = clamp(this.st.rT / 0.46, 0, 1); P.rootPitch = k * Math.PI * 2; P.thLx = P.thRx = 1.9; P.knL = P.knR = 2.3; P.shLx = P.shRx = 0.9; P.elL = P.elR = 1.6; P.spineX = 0.6; P.hipY = -0.3; fast.rootPitch = 80; rate = 30;
    } else if (st === 'attack') {
      const k = clamp(this.st.aT / ATK[this.combo || 1], 0, 1), w = k < 0.25 ? k / 0.25 : 1, e = easeOut((k - 0.25) / 0.6);
      P.thLx = 0.55; P.knL = 0.55; P.thRx = -0.45; P.knR = 0.35; P.spineX = 0.2; P.shLx = 0.6; P.shLz = 0.5; P.elL = 1.2; P.hipY = -0.08;
      if (this.spy) { // قتال بالأيدي: جاب يمين، هوك يسار، ركلة
        P.shLz = 0.25; P.shRz = 0.25; P.shLx = 1.1; P.shRx = 1.1; P.elL = 1.9; P.elR = 1.9; P.spineX = 0.12; P.thLx = 0.35; P.knL = 0.4; P.thRx = -0.2; P.knR = 0.3; // حراسة
        if (this.combo === 1) { P.shRx = 1.1 + 0.45 * e; P.elR = 1.9 - 1.8 * e; P.spineY = -0.45 * e; P.shRz = 0.1; }
        else if (this.combo === 2) { P.shLx = 1.1 + 0.3 * e; P.elL = 1.9 - 1.2 * e; P.shLz = 0.25 + 0.6 * e; P.spineY = 0.55 * e; }
        else { P.thRx = k < 0.25 ? 0.6 * w : 0.6 + 1.0 * e; P.knR = k < 0.25 ? 1.6 : 1.6 - 1.5 * e; P.spineX = -0.15 - 0.2 * e; P.spineY = -0.5 * e; P.thLx = 0.05; P.knL = 0.25; }
      } else if (this.combo === 1) { P.shRz = k < 0.25 ? 1.4 * w : 1.4 - 1.9 * e; P.shRx = k < 0.25 ? 0.9 : 0.9 + 0.6 * e; P.elR = 0.25; P.spineY = k < 0.25 ? -0.6 * w : -0.6 + 1.3 * e; }
      else if (this.combo === 2) { P.shRz = k < 0.25 ? -0.4 : -0.4 + 1.9 * e; P.shRx = k < 0.25 ? 1.6 : 1.6 - 0.7 * e; P.elR = 0.3; P.spineY = k < 0.25 ? 0.7 * w : 0.7 - 1.3 * e; P.thLx = -0.3; P.thRx = 0.5; }
      else { P.shRx = k < 0.25 ? 3.0 : 3.0 - 2.5 * e; P.elR = k < 0.25 ? 0.5 : 0.1; P.spineX = k < 0.25 ? -0.2 : -0.2 + 0.75 * e; P.hipY = k < 0.25 ? 0.05 : -0.25 * e; P.knL = 0.4 + 0.6 * e; P.knR = 0.3 + 0.6 * e; P.shRz = 0.1; }
      rate = 30;
    } else if (st === 'swing') {
      P.shLx = P.shRx = 3.0; P.shLz = P.shRz = 0.2; P.elL = P.elR = 0.1; P.spineX = -0.1;
      const k = Math.sin(this.st.th); P.thLx = P.thRx = 0.4 + k * 0.9; P.knL = P.knR = 0.3 + Math.max(0, -k) * 1.2; P.hipX = 0; rate = 20;
    } else if (st === 'slam') {
      P.shRx = 3.0; P.elR = 0.4; P.thLx = P.thRx = 1.2; P.knL = P.knR = 1.8; P.spineX = 0.4; P.shLx = 2.0; rate = 25;
    }
    if (st === 'swim') {
      const sw = Math.sin(t * 7), mv = Math.min(1, hs / 3);
      P.shLx = 2.4 + sw * 0.9 * mv; P.shRx = 2.4 - sw * 0.9 * mv; P.shLz = P.shRz = 0.4 + 0.3 * (1 - mv); P.elL = P.elR = 0.4;
      P.thLx = Math.sin(t * 9) * 0.4; P.thRx = -Math.sin(t * 9) * 0.4; P.knL = P.knR = 0.3; P.spineX = 0.1; P.headX = -0.5 * mv; rate = 10;
    } else if (st === 'spin') { P.shRz = 1.5; P.shRx = 1.2; P.elR = 0.1; P.shLz = 1.3; P.thLz = P.thRz = 0.35; P.knL = P.knR = 0.5; P.hipY = -0.15; rate = 30; }
    if (this.aiming) { P.shRx = 1.5; P.elR = 0.1; P.shLx = 1.35; P.shLz = -0.25; P.elL = 0.5; P.spineY = 0; rate = 22; }
    if (this.dragging) { P.shLx = P.shRx = -0.7; P.elL = P.elR = 0.3; P.spineX = 0.4; P.hipY -= 0.12; }
    if (this.carry) { P.shLx = P.shRx = 2.75; P.elL = P.elR = 0.55; P.shLz = P.shRz = 0.25; P.spineY = 0; }
    if (this.landT > 0) { const k = this.landT / 0.16; P.hipY -= 0.22 * k; P.knL += 0.9 * k; P.knR += 0.9 * k; P.thLx += 0.5 * k; P.thRx += 0.5 * k; }
    blendPose(h, P, dt, rate, fast);
    h.root.position.copy(this.pos); h.root.rotation.order = 'YXZ'; h.root.rotation.y = this.yaw;
    const tiltT = this.state === 'swing' ? -this.st.th : this.state === 'swim' ? (hs > 1.2 ? 1.2 : 0.15) : 0;
    this.rootTilt = (this.rootTilt || 0) + (tiltT - (this.rootTilt || 0)) * (this.state === 'swing' ? 1 : Math.min(1, dt * (this.state === 'swim' ? 4 : 12)));
    if (this.state === 'swim') h.root.position.y += 0.9 * Math.sin(this.rootTilt);
    h.root.rotation.x = this.rootTilt; h.root.rotation.y += this.state === 'spin' ? (this.st.spT / 0.55) * Math.PI * 4 : 0;
    h.root.visible = !(this.inv > 0 && this.hp > 0 && this.state !== 'roll' && Math.floor(this.t * 16) % 2 === 0 && this.inv < 1.15);
    h.sword.visible = !this.carry && !h.spy;
  }
}
