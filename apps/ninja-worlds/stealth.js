// Stealth kit for the ship world: tranquilizer pistol + sniper scope, alert phases, radar, lockers, dragging bodies, searchlights
import * as THREE from 'three';
const V = THREE.Vector3;
const PHASE = {
  normal: { label: '', color: '' },
  alert: { label: '⚠️ إنذار!', color: '#ff3b3b', time: 10 },
  evasion: { label: '🔍 يدوّرون عليك', color: '#fb923c', time: 18 },
  caution: { label: '⚡ حذر', color: '#facc15', time: 25 },
};
export class Stealth {
  constructor(c) {
    this.c = c; this.on = false; this.aiming = false; this.weapon = 'pistol'; this.ammo = { pistol: 0, sniper: 0 };
    this.aimPitch = 0; this.noiseT = 0; this.radarT = 0; this.tracers = [];
    // first-person tranquilizer pistol held in front of the camera
    const g = new THREE.Group(), M = (c2, m = 0.5) => new THREE.MeshStandardMaterial({ color: c2, roughness: 0.4, metalness: m });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.32), M(0x1f2937)); g.add(body);
    const sil = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 12), M(0x111827, 0.7)); sil.rotation.x = Math.PI / 2; sil.position.z = -0.26; g.add(sil);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.07), M(0x3f2a1d, 0.1)); grip.position.set(0, -0.09, 0.1); grip.rotation.x = 0.25; g.add(grip);
    const laser = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.06), new THREE.MeshBasicMaterial({ color: 0xff2020 })); laser.position.set(0, -0.06, -0.1); g.add(laser);
    g.position.set(0.16, -0.15, -0.42); g.visible = false; this.gun = g; c.camera.add(g);
  }
  get L() { return this.c.level(); }
  setup(level, cfg) {
    this.on = !!cfg.ship; this.exitAim(); this.drop(); this.release(true); this.leaveLocker(true); this.flying = [];
    const d = this.c.upg().darts || 0;
    this.ammo = { pistol: 8 + 4 * d, sniper: 3 + 2 * d };
    level.phase = 'normal'; level.phaseT = 0; level.lastSeen = null;
    document.body.classList.toggle('shipmode', this.on); this.hud(true);
  }
  /* ---------- input ---------- */
  preInput(inp) {
    if (!this.on) { inp.aimP = false; return; }
    const P = this.c.player;
    if (this.holding) { // ماسك حارس من الخلف
      if (inp.atkP) { inp.atkP = false; this.choke(); }
      if (inp.actP) { inp.actP = false; if (!this.throwBody(this.holding)) this.c.say('🌊 قرّب من حافة السفينة (السطح المكشوف) عشان ترميه في البحر — أو اضغط ⚔️ عشان تخنقه لين يغمى عليه'); }
      if (inp.rollP) { inp.rollP = false; this.release(false, true); }
      inp.jumpP = false; inp.aimP = false; inp.spP = false;
    }
    if (inp.aimP && !P.carry && !this.dragging && !this.holding && !P.inLocker) { this.aiming ? this.exitAim() : this.enterAim(); }
    if (this.aiming) {
      if (inp.atkP) { inp.atkP = false; this.shoot(); }
      if (inp.actP) { inp.actP = false; this.weapon = this.weapon === 'pistol' ? 'sniper' : 'pistol'; this.c.sfx.tone(500, 700, 0.08, 'square', 0.05); this.hud(); }
      if (inp.rollP) { inp.rollP = false; this.exitAim(); }
      inp.jumpP = false;
    }
  }
  enterAim() { this.aiming = true; this.aimPitch = 0; this.c.player.aiming = true; this.c.cam.yaw = this.c.player.yaw; this.hud(); }
  exitAim() { if (!this.aiming && this.c.player) { this.c.player.aiming = false; } this.aiming = false; if (this.c.player) this.c.player.aiming = false; this.c.camera.fov = innerWidth < innerHeight ? 72 : 62; this.c.camera.updateProjectionMatrix(); this.gun.visible = false; this.hud(); }
  interact() {
    if (!this.on) return false;
    const P = this.c.player, L = this.L;
    if (P.inLocker) { this.leaveLocker(); return true; }
    if (this.dragging) {
      if (this.throwBody(this.dragging)) return true;
      const lk = this.nearLocker(1.9);
      if (lk && !lk.body) { const e = this.dragging; lk.body = e; lk.openT = 1; e.hidden = true; e.m.g.visible = false; e.st = 'sleep'; e.sleepT = 1e9; this.dragging = null; P.dragging = false; this.c.sfx.tone(160, 90, 0.4, 'square', 0.12); this.c.say('🗄️ خبّيته بالخزانة — محد بيلقاه.'); this.c.addCoins(5, P.pos); return true; }
      this.drop(); return true;
    }
    const e = this.c.enemies.list.find((x) => x.ship && x.alive && x.st === 'sleep' && !x.hidden && x.pos.distanceTo(P.pos) < 1.8);
    if (e) { this.dragging = e; e.st = 'dragged'; P.dragging = true; this.c.sfx.tone(220, 180, 0.2, 'triangle', 0.08); return true; }
    const lk = this.nearLocker(1.4);
    if (lk && !lk.body && !lk.player) { this.enterLocker(lk); return true; }
    return false;
  }
  /* ---------- القبض من الخلف (CQC): خنق لين يغمى عليه، أو رمي في البحر ---------- */
  tryGrab() {
    if (!this.on || this.holding || this.dragging || this.aiming) return false;
    const P = this.c.player;
    for (const e of this.c.enemies.list) {
      if (!e.ship || !e.alive || e.alert || e.hidden || ['sleep', 'dragged', 'held', 'dying', 'radio', 'drowsy'].includes(e.st)) continue;
      const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.6 || Math.abs(P.pos.y - e.pos.y) > 1) continue;
      if ((dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / (d || 1) > -0.25) continue; // لازم تكون وراه
      this.holding = e; e.st = 'held'; e.heldT = 0; e.choke = 0; P.holding = true; P.yaw = e.yaw;
      this.c.sfx.tone(200, 120, 0.25, 'triangle', 0.12); this.c.sfx.noise(0.15, 400, 1, 0.12, 'lowpass');
      if (!this.L._grabTip) { this.L._grabTip = true; this.c.say('🤫 مسكته من الخلف! ⚔️ اضغط بسرعة = خنق لين يغمى عليه • ✋ عند حافة السفينة = ترميه في البحر • 🌀 = تفكّه. لا تطوّل — بيفلت!'); }
      return true;
    }
    return false;
  }
  choke() {
    const e = this.holding; if (!e) return;
    e.choke = Math.min(1, e.choke + 0.17 + (this.c.upg().dmg || 0) * 0.04); e.flash = 0.08;
    this.c.sfx.tone(140 + e.choke * 80, 110, 0.12, 'sawtooth', 0.05);
    if (e.choke >= 1) {
      const P = this.c.player; this.holding = null; P.holding = false;
      this.c.enemies.sleep(e, true); e.sleepT = 150; e.choke = 0;
      this.c.sfx.tone(300, 90, 0.5, 'sine', 0.12); this.c.addCoins(4, e.pos);
      if (!this.L._chokeTip) { this.L._chokeTip = true; this.c.say('😵 أغمى عليه — بس بيصحى بعد شوي. اسحبه (✋) لخزانة أو ارمه في البحر عشان محد يلقاه.'); }
    }
  }
  release(silent, shove) {
    const e = this.holding, P = this.c.player; this.holding = null; if (P) P.holding = false; if (!e || silent) return;
    if (shove) { this.c.enemies.sleep(e, true); e.sleepT = 3.5; this.c.sfx.hit(); } // دفّة قوية: يطيح ثواني
    else { e.st = 'inv'; e.invPos = P.pos.clone(); e.invT = 0; e.sus = 1; }
  }
  seaEdge() {
    const P = this.c.player, f = this.L.seaEdge; return f ? f(P.pos) : null;
  }
  throwBody(e) {
    const n = this.seaEdge(); if (!n || !e) return false;
    const P = this.c.player;
    if (e === this.holding) { this.holding = null; P.holding = false; }
    if (e === this.dragging) { this.dragging = null; P.dragging = false; }
    e.st = 'thrown'; e.alive = false; e.thrownT = 0; e.cone && (e.cone.visible = false);
    const from = e.pos.clone(), to = P.pos.clone().addScaledVector(n, 5.5); to.y = -3.2;
    this.flying.push({ e, from, to, t: 0, n });
    this.c.sfx.noise(0.35, 600, 0.8, 0.2, 'bandpass', 0, 200); this.c.sfx.tone(260, 140, 0.3, 'triangle', 0.1);
    this.L.thrown = (this.L.thrown || 0) + 1; this.c.addCoins(8, P.pos);
    this.c.say(this.L.thrown === 1 ? '🌊 رميته في البحر! محد بيلقى جثته ولا بيصحى — بس انتبه: الحارس اللي يشوفك ترمي، بيعلن الإنذار.' : '🌊 للبحر! (' + this.L.thrown + ')');
    return true;
  }
  updateThrown(dt) {
    for (const f of this.flying) {
      f.t += dt; const k = Math.min(1, f.t / 0.95), e = f.e;
      e.pos.lerpVectors(f.from, f.to, k); e.pos.y = f.from.y + (f.to.y - f.from.y) * k + Math.sin(k * Math.PI) * 2.6;
      e.yaw += dt * 6; if (e.m && e.m.inner) e.m.inner.rotation.x = k * 4;
      if (k >= 1 && !f.done) {
        f.done = true; const sp = e.pos.clone(); sp.y = -3;
        this.c.sparks.emit(sp, { color: 0xe0f2fe, count: 40, speed: 6, up: 6, life: 0.9, size: 0.35, grav: 9 });
        this.c.sparks.emit(sp, { color: 0x7dd3fc, count: 20, speed: 3, up: 3, life: 1.2, size: 0.5, grav: 6 });
        this.c.sfx.noise(0.6, 300, 0.6, 0.3, 'lowpass'); this.c.sfx.noise(0.4, 1400, 0.8, 0.12, 'bandpass', 0.08);
        e.m.g.removeFromParent(); e.gone = true;
      }
    }
    this.flying = this.flying.filter((f) => !f.done);
  }
  drop() { if (this.dragging) { this.dragging.st = 'sleep'; this.dragging = null; } if (this.c.player) this.c.player.dragging = false; }
  nearLocker(r) { const P = this.c.player; let best = null, bd = r; for (const lk of this.L.lockers || []) { const d = Math.hypot(lk.front.x - P.pos.x, lk.front.z - P.pos.z); if (d < bd && Math.abs(lk.pos.y - P.pos.y) < 1) { bd = d; best = lk; } } return best; }
  enterLocker(lk) { const P = this.c.player; this.exitAim(); lk.openT = 1; P.inLocker = lk; lk.player = true; P.vel.set(0, 0, 0); P.lockerBack = P.pos.clone(); P.pos.copy(lk.front); this.c.sfx.tone(140, 110, 0.25, 'square', 0.1); this.c.say('🗄️ مختبئ بالخزانة — الحرّاس ما يشوفونك. اضغط ✋ تطلع.'); }
  leaveLocker(silent) { const P = this.c.player; if (!P || !P.inLocker) return; P.inLocker.openT = 1; P.inLocker.player = false; P.inLocker = null; if (!silent) this.c.sfx.tone(140, 180, 0.2, 'square', 0.08); }
  /* ---------- shooting ---------- */
  shoot() {
    const w = this.weapon;
    if (this.ammo[w] <= 0) { this.c.sfx.tone(300, 300, 0.05, 'square', 0.06); this.c.say(w === 'pistol' ? '🎯 خلصت أسهم المسدس — دوّر صناديق زرقاء' : '🎯 خلصت أسهم القنّاصة — دوّر صناديق خضراء'); return; }
    this.ammo[w]--; this.hud();
    const cam = this.c.camera, o = cam.getWorldPosition(new V()), dir = cam.getWorldDirection(new V());
    this.c.sfx.noise(0.12, w === 'sniper' ? 900 : 1500, 1.2, 0.22, 'bandpass', 0, 300); this.c.sfx.tone(w === 'sniper' ? 180 : 260, 90, 0.1, 'triangle', 0.08);
    const ray = new THREE.Raycaster(o, dir, 0.1, 200), hits = ray.intersectObjects(this.L.camMeshes, false), wall = hits.length ? hits[0].distance : 200;
    let best = null, bt = wall;
    for (const e of this.c.enemies.list) {
      if (!e.alive || e.st === 'dying') continue;
      const s = e.big ? 1.55 : 1, head = e.pos.clone().add(new V(0, 1.65 * s, 0.1 * s)), body = e.pos.clone().add(new V(0, 1.0 * s, 0));
      if (e.st === 'sleep' || e.st === 'dragged') continue;
      for (const [c2, r, isHead] of [[head, 0.3 * s, true], [body, 0.58 * s, false]]) {
        const t = ray.ray.origin.clone().sub(c2), b = t.dot(dir), cc = t.lengthSq() - r * r, disc = b * b - cc;
        if (disc < 0) continue; const tt = -b - Math.sqrt(disc); if (tt > 0 && tt < bt) { bt = tt; best = { e, isHead }; }
      }
    }
    const end = o.clone().addScaledVector(dir, Math.min(bt, 80));
    this.tracer(o.clone().addScaledVector(dir, 0.6).add(new V(0, -0.08, 0)), end);
    if (best) {
      const e = best.e;
      if (e.ship) { this.c.enemies.tranq(e, best.isHead); if (best.isHead) this.c.say('🎯 في الراس! نام على طول 😴'); }
      else this.c.enemies.hurt(e, best.isHead ? 2 : 1, this.c.player.pos, 2);
      this.c.sparks.emit(end, { color: 0x93c5fd, count: 10, speed: 3, life: 0.3 });
    } else if (bt < 200) { this.c.sparks.emit(end, { color: 0xfde68a, count: 8, speed: 2, life: 0.25 }); this.c.enemies.noise(end, 4); }
  }
  tracer(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]), l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.8 }));
    this.c.scene.add(l); this.tracers.push({ l, t: 0.15 });
  }
  /* ---------- per frame ---------- */
  update(dt) {
    for (const t of this.tracers) { t.t -= dt; t.l.material.opacity = Math.max(0, t.t / 0.15); if (t.t <= 0) { t.l.removeFromParent(); t.l.geometry.dispose(); } }
    this.tracers = this.tracers.filter((t) => t.t > 0);
    if (!this.on) return;
    const P = this.c.player, L = this.L, E = this.c.enemies;
    if (this.aiming) { P.yaw = this.c.cam.yaw; }
    this.updateThrown(dt);
    if (this.holding) {
      const e = this.holding, fwd = new V(Math.sin(P.yaw), 0, Math.cos(P.yaw)), tgt = P.pos.clone().addScaledVector(fwd, 0.5);
      e.pos.lerp(tgt, Math.min(1, dt * 14)); e.pos.y = P.pos.y; e.yaw = P.yaw; e.heldT += dt; e.choke = Math.max(0, e.choke - dt * 0.06);
      if (!e.alive || P.state === 'hurt' || P.state === 'air' || P.inLocker) this.release(true);
      else if (e.heldT > 6.5 + (this.c.upg().dmg || 0)) { this.c.say('😠 فلت منك!'); this.release(false); this.c.sfx.tone(500, 900, 0.2, 'square', 0.1); }
    }
    // dragged body follows behind the player
    if (this.dragging) {
      const e = this.dragging, back = new V(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), tgt = P.pos.clone().addScaledVector(back, 1.15);
      e.pos.lerp(tgt, Math.min(1, dt * 10)); e.pos.y = P.pos.y; e.yaw = P.yaw;
      if (!e.alive) this.drop();
    }
    if (P.inLocker) { P.pos.copy(P.inLocker.front); P.vel.set(0, 0, 0); }
    // footsteps make noise when running
    this.noiseT -= dt; const hs = Math.hypot(P.vel.x, P.vel.z);
    if (P.onGround && hs > 5.4 && this.noiseT <= 0 && !P.inLocker) { this.noiseT = 0.45; E.noise(P.pos, 6.5); }
    // searchlights
    for (const S of L.searchlights || []) {
      const dir = new V(Math.sin(S.yaw) * Math.cos(S.tilt), -Math.sin(S.tilt), Math.cos(S.yaw) * Math.cos(S.tilt)), chest = P.pos.clone().add(new V(0, 1, 0)), to = chest.clone().sub(S.pos), d = to.length();
      const lit = !P.inLocker && d < S.range && to.normalize().dot(dir) > S.cos && this.clear(S.pos, chest);
      S.cone.material.color.setHex(lit ? 0xff4040 : 0xfffbe0); S.cone.material.opacity = lit ? 0.16 : 0.07;
      if (lit && L.phase !== 'alert') { this.c.say('🔦 الكشاف كشفك!'); this.setPhase('alert'); L.lastSeen = P.pos.clone(); }
    }
    // alert phase machine: alert → evasion → caution → normal
    if (L.phase === 'alert') { if (E.anySees(P)) { L.phaseT = PHASE.alert.time; L.lastSeen = P.pos.clone(); } else { L.phaseT -= dt; if (L.phaseT <= 0) this.setPhase('evasion'); } }
    else if (L.phase === 'evasion' || L.phase === 'caution') { L.phaseT -= dt; if (L.phaseT <= 0) this.setPhase(L.phase === 'evasion' ? 'caution' : 'normal'); }
    // dart pickups
    for (const A of L.ammo || []) if (!A.taken && A.pos.distanceTo(P.pos.clone().add(new V(0, 0.6, 0))) < 1.3) { A.taken = true; A.g.removeFromParent(); this.ammo[A.kind] += A.kind === 'sniper' ? 2 : 4; this.c.sfx.pickup(); this.c.say(A.kind === 'sniper' ? '🎯 +٢ أسهم قنّاصة' : '🔫 +٤ أسهم مسدس'); this.hud(); }
    this.c.hero.root.visible = this.c.hero.root.visible && !this.aiming && !P.inLocker;
    this.gun.visible = this.aiming && this.weapon === 'pistol';
    this.radarT -= dt; if (this.radarT <= 0) { this.radarT = 0.05; this.radar(); }
    this.phaseHud();
  }
  clear(a, b) { const n = Math.ceil(a.distanceTo(b) / 0.6), BX = this.L.segBoxes(a, b); for (let i = 1; i < n; i++) { const p = a.clone().lerp(b, i / n); for (const x of BX) if (x.active && p.x > x.min.x && p.x < x.max.x && p.y > x.min.y && p.y < x.max.y && p.z > x.min.z && p.z < x.max.z) return false; } return true; }
  setPhase(ph) {
    const L = this.L, prev = L.phase; L.phase = ph; L.phaseT = PHASE[ph].time || 0;
    if (ph === 'alert' && prev !== 'alert') {
      L.alarms = (L.alarms || 0) + 1; const s = this.c.sfx; s.tone(880, 880, 0.12, 'square', 0.14); s.tone(1175, 1175, 0.12, 'square', 0.14, 0.13); s.tone(880, 880, 0.12, 'square', 0.14, 0.26);
      // reinforcements
      for (const r of L.reinforce || []) if (!r.used) { r.used = true; for (const p of r.points) this.c.enemies.spawn({ x: p[0], y: r.y, z: p[1], type: 'guard', alert: true, zone: r.zone }, true); this.c.say('📻 طلبوا دعم! فرقة جديدة جاية — اختفِ!'); break; }
    }
    if (ph === 'normal' && prev !== 'normal') this.c.say('😮‍💨 هدأت الأوضاع — رجعوا لدورياتهم.');
  }
  // hooks from enemies
  spotted(e, fromSearch) { if (fromSearch || this.L.phase === 'evasion') { this.setPhase('alert'); this.L.lastSeen = this.c.player.pos.clone(); } }
  radioDone() { this.setPhase('alert'); this.L.lastSeen = this.c.player.pos.clone(); }
  bodyFound() { if (this.L.phase === 'normal') { this.setPhase('caution'); this.c.say('😲 لقوا زميلهم نايم! صاروا حذرين — خبّ الأجسام بالخزائن.'); } }
  guardWoke() { if (this.L.phase === 'normal') this.setPhase('caution'); }
  /* ---------- camera ---------- */
  camera(dt, look) {
    if (!this.aiming) return false;
    const cam = this.c.cam, camera = this.c.camera, P = this.c.player, sn = this.weapon === 'sniper';
    const k = sn ? 0.3 : 1;
    if (look.dx || look.dy) { cam.yaw -= look.dx * 0.0035 * k; this.aimPitch = Math.max(-1.2, Math.min(1.2, this.aimPitch - look.dy * 0.003 * k)); look.dx = look.dy = 0; }
    const t = performance.now() / 1000, sway = sn ? 0.006 : 0.0015;
    const yaw = cam.yaw + Math.sin(t * 1.3) * sway + Math.sin(t * 2.7) * sway * 0.5, pitch = this.aimPitch + Math.sin(t * 1.7) * sway;
    camera.position.copy(P.pos).add(new V(0, 1.62, 0));
    camera.lookAt(camera.position.clone().add(new V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))));
    const fov = sn ? 15 : 55; if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 12); camera.updateProjectionMatrix(); }
    return true;
  }
  /* ---------- HUD ---------- */
  hud(force) {
    const $ = (s) => document.querySelector(s);
    $('#ammo').textContent = this.on ? `${this.weapon === 'pistol' ? '🔫' : '🎯'} ${this.ammo[this.weapon]}  ·  ${this.weapon === 'pistol' ? '🎯 ' + this.ammo.sniper : '🔫 ' + this.ammo.pistol}` : '';
    $('#cross').classList.toggle('on', this.aiming && this.weapon === 'pistol');
    $('#scope').classList.toggle('on', this.aiming && this.weapon === 'sniper');
    $('#aimHint').classList.toggle('on', this.aiming);
    if (force) $('#phase').classList.remove('on');
  }
  phaseHud() {
    const L = this.L, el = document.getElementById('phase'), ph = PHASE[L.phase];
    if (!ph || !ph.label) { el.classList.remove('on'); return; }
    el.classList.add('on'); el.style.color = ph.color; el.textContent = `${ph.label}  ${Math.max(0, L.phaseT).toFixed(1)}`;
  }
  radar() {
    const cv = document.getElementById('radar'); if (!cv) return; const g = cv.getContext('2d'), W = cv.width, R = W / 2, sc = R / 22;
    const P = this.c.player, yaw = this.aiming ? this.c.cam.yaw : this.c.cam.yaw, L = this.L;
    g.clearRect(0, 0, W, W); g.save(); g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(6,30,22,.82)'; g.fillRect(0, 0, W, W);
    if (L.phase === 'alert') { for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,${80 + Math.random() * 80 | 0},80,${Math.random() * 0.5})`; g.fillRect(Math.random() * W, Math.random() * W, 2, 2); } g.restore(); g.fillStyle = '#ff4040'; g.font = '900 26px system-ui'; g.textAlign = 'center'; g.fillText('!', R, R + 9); return; }
    const toR = (x, z) => { const dx = x - P.pos.x, dz = z - P.pos.z, c = Math.cos(-yaw), s = Math.sin(-yaw); const rx = dx * c + dz * s, rz = -dx * s + dz * c; return [R - rx * sc, R - rz * sc]; };
    g.strokeStyle = 'rgba(74,222,128,.18)'; for (let r = 1; r <= 3; r++) { g.beginPath(); g.arc(R, R, (R / 3) * r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(148,163,184,.35)';
    for (const b of L.nearR(P.pos.x, P.pos.z, 30)) { if (!b.active || b.max.y - b.min.y < 1 || b.max.y < P.pos.y + 0.4 || b.min.y > P.pos.y + 2) continue; const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2; if (Math.hypot(cx - P.pos.x, cz - P.pos.z) > 30) continue; const c = [toR(b.min.x, b.min.z), toR(b.max.x, b.min.z), toR(b.max.x, b.max.z), toR(b.min.x, b.max.z)]; g.beginPath(); g.moveTo(...c[0]); c.slice(1).forEach((p) => g.lineTo(...p)); g.closePath(); g.fill(); }
    for (const e of this.c.enemies.list) {
      if (!e.alive || e.hidden || Math.abs(e.pos.y - P.pos.y) > 4) continue; const [x, y] = toR(e.pos.x, e.pos.z);
      if (e.st !== 'sleep' && e.st !== 'dragged' && e.guard) { const a = Math.atan2(...(() => { const f = toR(e.pos.x + Math.sin(e.yaw), e.pos.z + Math.cos(e.yaw)); return [f[1] - y, f[0] - x]; })()); g.fillStyle = e.st === 'inv' ? 'rgba(250,204,21,.35)' : 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, 11 * sc, a - 0.6, a + 0.6); g.closePath(); g.fill(); }
      g.fillStyle = e.st === 'sleep' || e.st === 'dragged' ? '#64748b' : e.alert ? '#ff4040' : '#f8fafc'; g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
    }
    for (const S of L.searchlights || []) { const [x, y] = toR(S.pos.x, S.pos.z); g.fillStyle = '#fde68a'; g.fillRect(x - 2, y - 2, 4, 4); }
    g.fillStyle = '#4ade80'; g.beginPath(); g.moveTo(R, R - 7); g.lineTo(R - 5, R + 5); g.lineTo(R + 5, R + 5); g.closePath(); g.fill();
    g.restore(); g.strokeStyle = 'rgba(74,222,128,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.stroke();
  }
}
