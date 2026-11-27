// Stealth kit for the ship world: tranquilizer pistol + sniper scope, alert phases, radar, lockers, dragging bodies, searchlights
import * as THREE from 'three';
const V = THREE.Vector3;
const PHASE = {
  normal: { label: '', color: '' },
  alert: { label: '⚠️ إنذار!', color: '#ff3b3b', time: 10 },
  evasion: { label: '🔍 يدوّرون عليك', color: '#fb923c', time: 18 },
  caution: { label: '⚡ حذر', color: '#facc15', time: 25 },
};
const ZOOMS = { pistol: [1, 2], sniper: [4, 8, 12, 20] };
export class Stealth {
  constructor(c) {
    this.c = c; this.on = false; this.aiming = false; this.weapon = 'pistol'; this.ammo = { pistol: 0, sniper: 0 };
    this.aimPitch = 0; this.noiseT = 0; this.radarT = 0; this.tracers = [];
    this.zoomI = { pistol: 0, sniper: 0 }; this.breath = 1; this.tired = 0; this.recoil = 0; this.boltT = 0; this.pickT = 0; this.pick = null; this.touchBreath = false;
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
    this.radio = false; this.radioSus = 0; this.radioCd = 0; this.chatT = 18; this.setDisguise(false, true); this.closeRadio(true);
    const d = this.c.upg().darts || 0;
    this.ammo = { pistol: 8 + 4 * d, sniper: 3 + 2 * d };
    level.phase = 'normal'; level.phaseT = 0; level.lastSeen = null;
    document.body.classList.toggle('shipmode', this.on); this.hud(true);
  }
  /* ---------- input ---------- */
  preInput(inp) {
    if (!this.on) { inp.aimP = false; return; }
    const P = this.c.player;
    if (inp.spP && !this.aiming && !this.holding && this.gadget()) inp.spP = false;
    if (this.holding) { // ماسك حارس من الخلف
      if (inp.atkP) { inp.atkP = false; this.choke(); }
      if (inp.actP) { inp.actP = false; if (!this.throwBody(this.holding)) this.c.say('🌊 قرّب من حافة السفينة (السطح المكشوف) عشان ترميه في البحر — أو اضغط ⚔️ عشان تخنقه لين يغمى عليه'); }
      if (inp.rollP) { inp.rollP = false; this.release(false, true); }
      inp.jumpP = false; inp.aimP = false; inp.spP = false;
    }
    if (inp.aimP && !P.carry && !this.dragging && !this.holding && !P.inLocker) { this.aiming ? this.exitAim() : this.enterAim(); }
    if (this.aiming) {
      this.holdBreath = !!(inp.jumpH || this.touchBreath);
      if (inp.atkP) { inp.atkP = false; this.shoot(); }
      if (inp.actP) { inp.actP = false; this.weapon = this.weapon === 'pistol' ? 'sniper' : 'pistol'; this.c.sfx.tone(500, 700, 0.08, 'square', 0.05); this.hud(); }
      if (inp.rollP) { inp.rollP = false; this.exitAim(); }
      inp.jumpP = false;
    }
  }
  enterAim() { this.aiming = true; this.aimPitch = 0; this.c.player.aiming = true; this.c.cam.yaw = this.c.player.yaw; this.hud(); }
  zoomStep(d) {
    if (!this.aiming) return; const w = this.weapon, Z = ZOOMS[w], i = Math.max(0, Math.min(Z.length - 1, this.zoomI[w] + d));
    if (i === this.zoomI[w]) return; this.zoomI[w] = i; this.c.sfx.tone(d > 0 ? 1400 : 1100, d > 0 ? 1700 : 900, 0.04, 'square', 0.03);
  }
  get zoomX() { return ZOOMS[this.weapon][this.zoomI[this.weapon]]; }
  optics(on) { // داخل المنظار: الضباب يخف والحراس البعيدين ينرسمون
    const sc = this.c.scene, E = this.c.enemies;
    if (on) { if (this.fogSave == null && sc.fog && sc.fog.density != null) { this.fogSave = sc.fog.density; this.fogObj = sc.fog; sc.fog.density *= 0.32; } if (this.cullSave == null && E) { this.cullSave = E.cullR; E.cullR = E.cullR ? 1e9 : E.cullR; } }
    else { if (this.fogSave != null && this.fogObj) this.fogObj.density = this.fogSave; this.fogSave = null; this.fogObj = null; if (this.cullSave != null && E) E.cullR = this.cullSave; this.cullSave = null; }
  }
  exitAim() { if (!this.aiming && this.c.player) { this.c.player.aiming = false; } this.aiming = false; this.optics(false); { const glc = document.getElementById('gl'); if (glc) glc.style.filter = ''; document.body.classList.remove('scoped'); } this.holdBreath = false; this.touchBreath = false; if (this.farSave) { this.c.camera.far = this.farSave; this.farSave = 0; } if (this.c.player) this.c.player.aiming = false; this.c.camera.fov = innerWidth < innerHeight ? 72 : 62; this.c.camera.updateProjectionMatrix(); this.gun.visible = false; this.hud(); }
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
      const capOK = e.captain && (e.reloadT > 0 || e.st === 'drowsy' || (this.L.waveHit > 0));
      if (!e.ship || !e.alive || (e.alert && !capOK) || e.hidden || ['sleep', 'dragged', 'held', 'dying', 'radio'].includes(e.st) || (e.st === 'drowsy' && !e.captain)) continue;
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
    if (e.captain) { this.c.say('💪 القائد أقوى من إنك تخنقه! جرّه لحافة السفينة وارمه في البحر 🌊 — بسرعة قبل يفلت!'); return; }
    e.choke = Math.min(1, e.choke + 0.17 + (this.c.upg().dmg || 0) * 0.04); e.flash = 0.08;
    this.c.sfx.tone(140 + e.choke * 80, 110, 0.12, 'sawtooth', 0.05);
    if (e.choke >= 1) {
      const P = this.c.player; this.holding = null; P.holding = false;
      this.c.enemies.sleep(e, true); e.sleepT = 150; e.choke = 0;
      this.c.sfx.tone(300, 90, 0.5, 'sine', 0.12); this.c.addCoins(4, e.pos); this.takeRadio();
      if (!this.L._chokeTip) { this.L._chokeTip = true; this.c.say('😵 أغمى عليه — بس بيصحى بعد شوي. اسحبه (✋) لخزانة أو ارمه في البحر عشان محد يلقاه.'); }
    }
  }
  release(silent, shove) {
    const e = this.holding, P = this.c.player; this.holding = null; if (P) P.holding = false; if (!e || silent) return;
    if (shove) { this.c.enemies.sleep(e, true); e.sleepT = 3.5; this.c.sfx.hit(); } // دفّة قوية: يطيح ثواني
    else if (e.captain) { e.st = 'idle'; e.reloadT = 0; e.ammo = 3; e.cd = 0.4; }
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
    if (e.captain) { this.c.onCaptainDown && this.c.onCaptainDown(e, 'sea'); return true; }
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
  /* ---------- أداة خاصة (زر ✴️): البس زي حارس نايم / افتح الراديو ---------- */
  nearBody() { const P = this.c.player; return this.c.enemies.list.find((x) => x.ship && x.alive && x.st === 'sleep' && !x.hidden && !x.stripped && x.pos.distanceTo(P.pos) < 1.9); }
  gadgetLabel() {
    if (!this.on || this.aiming) return null;
    if (!this.holding && !this.dragging && !this.disguise && this.nearBody()) return '🧥 البس زيّه';
    if (this.radio) return '📻 راديو';
    return null;
  }
  gadget() {
    if (!this.on) return false;
    if (!this.dragging && !this.disguise) { const e = this.nearBody(); if (e) { e.stripped = true; this.setDisguise(true); this.takeRadio(true); this.c.sfx.noise(0.3, 800, 0.8, 0.12, 'bandpass'); this.c.say('🧥 لبست زي الحارس! من بعيد يحسبونك منهم — بس لا تقرّب منهم كثير، ولا تركض، ولا تضرب قدّامهم، ولا تسحب جثث.'); return true; } }
    if (this.radio) { this.openRadio(); return true; }
    return false;
  }
  setDisguise(on, silent) { this.disguise = on; const h = this.c.hero; if (h && h.mats && (on || h.disguised)) this.c.setDisguise && this.c.setDisguise(on); }
  disguisedInfo() {
    if (!this.disguise) return null; const P = this.c.player, hs = Math.hypot(P.vel.x, P.vel.z);
    return { reveal: hs > 5.2 || P.state === 'attack' || P.state === 'roll' || P.state === 'hug' || this.holding || this.dragging || this.aiming };
  }
  /* ---------- 📻 الراديو: تنصّت + انتحال صوت القائد ---------- */
  takeRadio(silent) { if (this.radio) return; this.radio = true; this.log = ['«…كل الوحدات، بلّغوا عن مواقعكم كل خمس دقايق.»']; this.chatT = 12; if (!silent) this.c.say('📻 أخذت الراديو حقه! اضغط زر 📻 — تتنصّت عليهم وتقدر تقلّد صوت القائد وتعطيهم أوامر غلط.'); }
  openRadio() {
    const el = document.getElementById('radio'); if (!el) return; this.radioOpen = true;
    el.querySelector('#rSus').style.width = Math.round(Math.min(1, this.radioSus) * 100) + '%';
    el.querySelector('#rCd').textContent = this.radioCd > 0 ? `⏳ لازم تنتظر ${Math.ceil(this.radioCd)} ثانية قبل أمر جديد (عشان ما يشكّون)` : '🎙️ اختر أمر — بصوت القائد';
    el.querySelectorAll('.rcmd').forEach((b) => (b.disabled = this.radioCd > 0));
    el.querySelector('#rLog').innerHTML = (this.log || []).slice(-4).map((t) => '<div>' + t + '</div>').join('') || '<div>… ما فيه كلام حالياً</div>';
    el.classList.add('on'); this.c.pauseFor && this.c.pauseFor(true); this.c.sfx.noise(0.25, 3000, 0.5, 0.06, 'highpass');
  }
  closeRadio(silent) { const el = document.getElementById('radio'); if (el) el.classList.remove('on'); if (this.radioOpen && !silent) this.c.pauseFor && this.c.pauseFor(false); this.radioOpen = false; }
  chatter(t) { this.log = this.log || []; this.log.push(t); if (this.log.length > 12) this.log.shift(); if (this.radio) this.c.say('📻 ' + t); }
  command(kind) {
    if (this.radioCd > 0) return; const E = this.c.enemies, P = this.c.player, L = this.L;
    this.closeRadio(); this.radioCd = 20; this.radioSus += kind === 'calm' ? 0.55 : 0.38;
    this.c.sfx.tone(700, 500, 0.15, 'square', 0.05);
    if (this.radioSus > 1) { this.radioSus = 0.5; this.c.say('📻 «هذا مو صوت القائد!! في دخيل معه راديو!» — انكشفت الخدعة!'); this.setPhase('alert'); L.lastSeen = P.pos.clone(); return; }
    const guards = E.list.filter((e) => e.ship && e.alive && !e.hidden && !['sleep', 'dragged', 'held', 'thrown', 'dying'].includes(e.st));
    if (kind === 'stern' || kind === 'bow') {
      const z = kind === 'stern' ? 8 : 232; let n = 0;
      for (const e of guards) if (!e.alert && Math.abs(e.pos.z - P.pos.z) < 70) { e.st = 'inv'; e.invPos = new V(e.pos.x * 0.3, e.pos.y, z); e.invT = -8; n++; }
      this.c.say(`📻 (بصوتك): «كل الوحدات، تجمّعوا عند ${kind === 'stern' ? 'المؤخرة' : 'المقدمة'} فوراً!» — ${n} حارس يمشون هناك 🚶`);
    } else if (kind === 'calm') {
      if (L.phase === 'normal') { this.c.say('📻 «القائد: ليش تعلن هدوء والوضع هادي أصلاً؟» 🤔 (ما كان فيه إنذار)'); return; }
      this.setPhase('caution'); for (const e of guards) { e.alert = false; e.sus = 0; if (e.st === 'chase' || e.st === 'inv') e.st = 'idle'; }
      this.c.say('📻 (بصوتك): «انتهى الإنذار، ارجعوا لمواقعكم.» — صدّقوا! بس صاروا حذرين ⚡');
    } else if (kind === 'rest') {
      let n = 0; for (const e of guards) if (!e.alert && e.pos.distanceTo(P.pos) < 45) { e.st = 'idle'; e.wait = 22; e.sus = 0; n++; }
      this.c.say(`📻 (بصوتك): «استراحة ٢٠ ثانية للجميع.» — ${n} حارس وقفوا مكانهم ☕`);
    }
  }
  drop() { if (this.dragging) { this.dragging.st = 'sleep'; this.dragging = null; } if (this.c.player) this.c.player.dragging = false; }
  nearLocker(r) { const P = this.c.player; let best = null, bd = r; for (const lk of this.L.lockers || []) { const d = Math.hypot(lk.front.x - P.pos.x, lk.front.z - P.pos.z); if (d < bd && Math.abs(lk.pos.y - P.pos.y) < 1) { bd = d; best = lk; } } return best; }
  enterLocker(lk) { const P = this.c.player; this.exitAim(); lk.openT = 1; P.inLocker = lk; lk.player = true; P.vel.set(0, 0, 0); P.lockerBack = P.pos.clone(); P.pos.copy(lk.front); this.c.sfx.tone(140, 110, 0.25, 'square', 0.1); this.c.say('🗄️ مختبئ بالخزانة — الحرّاس ما يشوفونك. اضغط ✋ تطلع.'); }
  leaveLocker(silent) { const P = this.c.player; if (!P || !P.inLocker) return; P.inLocker.openT = 1; P.inLocker.player = false; P.inLocker = null; if (!silent) this.c.sfx.tone(140, 180, 0.2, 'square', 0.08); }
  /* ---------- shooting ---------- */
  shoot() {
    const w = this.weapon;
    if (this.ammo[w] <= 0) { this.c.sfx.tone(300, 300, 0.05, 'square', 0.06); this.c.say(w === 'pistol' ? '🎯 خلصت أسهم المسدس — دوّر صناديق زرقاء' : '🎯 خلصت أسهم القنّاصة — دوّر صناديق خضراء'); return; }
    if (w === 'sniper' && this.boltT > 0) return; // لسا يلقّم
    this.ammo[w]--; this.hud(); this.recoil += w === 'sniper' ? 0.055 : 0.02; if (w === 'sniper') { this.boltT = 1.15; setTimeout(() => { this.c.sfx.noise(0.08, 2200, 3, 0.1, 'bandpass'); this.c.sfx.noise(0.07, 1600, 3, 0.1, 'bandpass', 0.18); }, 480); }
    const cam = this.c.camera, o = cam.getWorldPosition(new V()), dir = cam.getWorldDirection(new V());
    this.c.sfx.noise(0.12, w === 'sniper' ? 900 : 1500, 1.2, 0.22, 'bandpass', 0, 300); this.c.sfx.tone(w === 'sniper' ? 180 : 260, 90, 0.1, 'triangle', 0.08);
    const far = w === 'sniper' ? 420 : 200, ray = new THREE.Raycaster(o, dir, 0.1, far), hits = ray.intersectObjects(this.L.camMeshes, false), wall = hits.length ? hits[0].distance : far;
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
    const end = o.clone().addScaledVector(dir, Math.min(bt, far));
    this.tracer(o.clone().addScaledVector(dir, 0.6).add(new V(0, -0.08, 0)), end);
    if (best) {
      const e = best.e;
      if (e.ship) { this.c.enemies.tranq(e, best.isHead); const dm = Math.round(bt); if (best.isHead) this.c.say(dm > 25 ? `🎯 رأس من ${dm} متر! نام على طول 😴` : '🎯 في الراس! نام على طول 😴'); this.hitMark = { t: 0.6, head: best.isHead }; }
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
    this.radioCd = Math.max(0, this.radioCd - dt); this.radioSus = Math.max(0, this.radioSus - dt * 0.012);
    if (this.radio && (this.chatT -= dt) <= 0) {
      this.chatT = 26 + Math.random() * 18; const E = this.c.enemies.list, asleep = E.filter((e) => e.ship && (e.st === 'sleep')).length, gone = (L.thrown || 0);
      const lines = ['«الوحدة ٢: المخزن هادي. باقي على تبديل النوبة شوي.»', '«الجسر: الكشافات شغّالة. محد يقرّب من مهبط المقدمة.»', '«المحركات: سمعت صوت حديد قبل شوي… يمكن الموج.»', '«القائد: بطاقة القيادة في مكتب المشرف — لا أحد يدخله.»'];
      if (asleep) lines.push(`«وين ${asleep > 1 ? 'الوحدات ' + asleep : 'الوحدة ٤'}؟ ما ترد على الراديو…»`);
      if (gone) lines.push(`«سمعت شي طاح في البحر؟ لا لا… أكيد الموج.»`);
      if (L.phase !== 'normal') lines.push('«كل الوحدات: فتّشوا الممرات، الدخيل قريب!»');
      this.chatter(lines[Math.floor(Math.random() * lines.length)]);
    }
    if (this.holding) {
      const e = this.holding, fwd = new V(Math.sin(P.yaw), 0, Math.cos(P.yaw)), tgt = P.pos.clone().addScaledVector(fwd, 0.5);
      e.pos.lerp(tgt, Math.min(1, dt * 14)); e.pos.y = P.pos.y; e.yaw = P.yaw; e.heldT += dt; e.choke = Math.max(0, e.choke - dt * 0.06);
      if (!e.alive || P.state === 'hurt' || P.state === 'air' || P.inLocker) this.release(true);
      else if (e.heldT > (e.captain ? 3.4 : 6.5 + (this.c.upg().dmg || 0))) { this.c.say('😠 فلت منك!'); this.release(false); this.c.sfx.tone(500, 900, 0.2, 'square', 0.1); }
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
  spotted(e, fromSearch) { if (this.disguise) { this.setDisguise(false); this.c.say('😱 انكشف تنكّرك! خلعوا عنك الزي — اهرب!'); } if (fromSearch || this.L.phase === 'evasion') { this.setPhase('alert'); this.L.lastSeen = this.c.player.pos.clone(); } }
  radioDone() { this.setPhase('alert'); this.L.lastSeen = this.c.player.pos.clone(); }
  bodyFound() { if (this.L.phase === 'normal') { this.setPhase('caution'); this.c.say('😲 لقوا زميلهم نايم! صاروا حذرين — خبّ الأجسام بالخزائن.'); } }
  guardWoke() { if (this.L.phase === 'normal') this.setPhase('caution'); }
  /* ---------- camera ---------- */
  camera(dt, look) {
    if (!this.aiming) { if (this.scopeCv && this.scopeCv.style.display !== 'none') this.scopeCv.style.display = 'none'; return false; }
    const cam = this.c.cam, camera = this.c.camera, P = this.c.player, sn = this.weapon === 'sniper', zx = this.zoomX;
    const fov = (innerWidth < innerHeight ? 72 : 62) / zx * (sn ? 1 : 0.9);
    this.optics(sn);
    // التنفّس: حبس النفس يثبّت المنظار، والنفس يخلص — وإذا خلص ترجف يدك شوي
    this.boltT = Math.max(0, this.boltT - dt); this.recoil *= Math.exp(-dt * 7); this.hitMark && (this.hitMark.t -= dt);
    const holding = this.holdBreath && this.breath > 0 && this.tired <= 0;
    if (holding) { this.breath = Math.max(0, this.breath - dt / 4.5); if (this.breath <= 0) { this.tired = 2.2; this.c.sfx.tone(300, 200, 0.4, 'sine', 0.06); } }
    else this.breath = Math.min(1, this.breath + dt / (this.tired > 0 ? 6 : 3)); this.tired = Math.max(0, this.tired - dt);
    const k = (fov / 62) * (sn ? 0.95 : 1) * (this.pick && this.pick.target ? 0.55 : 1); // يبطّئ لما تكون على هدف (أسهل بالجوال)
    if (look.dx || look.dy) { cam.yaw -= look.dx * 0.0035 * k; this.aimPitch = Math.max(-1.2, Math.min(1.2, this.aimPitch - look.dy * 0.003 * k)); look.dx = look.dy = 0; }
    const t = performance.now() / 1000, base = sn ? 0.0017 : 0.0012, sway = base * (holding ? 0.12 : this.tired > 0 ? 2.2 : 1) * (P.vel && Math.hypot(P.vel.x, P.vel.z) > 0.5 ? 2.5 : 1);
    const yaw = cam.yaw + (Math.sin(t * 0.7) + Math.sin(t * 1.3 + 1) * 0.4) * sway, pitch = this.aimPitch + this.recoil + (Math.sin(t * 0.9) * 0.8 + Math.sin(t * 0.4) * 0.5) * sway;
    camera.position.copy(P.pos).add(new V(0, 1.62, 0));
    const dir = new V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(camera.position.clone().add(dir));
    if (camera.far < 600) { this.farSave = camera.far; camera.far = 600; camera.updateProjectionMatrix(); }
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
    // ماذا تحت مركز المنظار؟ (مسافة + هدف) — كل ١٠٠ مللي
    this.pickT -= dt; if (this.pickT <= 0) { this.pickT = 0.1; this.pick = this.pickAt(camera.position.clone(), dir.clone().normalize(), sn ? 420 : 200); }
    if (sn) this.drawScope(holding); else if (this.scopeCv) this.scopeCv.style.display = 'none';
    document.body.classList.toggle('scoped', sn);
    const glc = document.getElementById('gl'); if (glc) { const f = sn ? 'brightness(1.35) contrast(1.12) saturate(1.1)' : ''; if (glc.style.filter !== f) glc.style.filter = f; } // عدسة صافية
    return true;
  }
  pickAt(o, dir, far) {
    const ray = new THREE.Raycaster(o, dir, 0.1, far), hits = ray.intersectObjects(this.L.camMeshes, false); let bt = hits.length ? hits[0].distance : Infinity, best = null;
    for (const e of this.c.enemies.list) {
      if (!e.alive || e.st === 'dying' || e.hidden) continue; const s = e.big ? 1.55 : 1;
      for (const [c2, r, isHead] of [[e.pos.clone().add(new V(0, 1.65 * s, 0.1 * s)), 0.3 * s, true], [e.pos.clone().add(new V(0, 1.0 * s, 0)), 0.58 * s, false]]) {
        const tv = o.clone().sub(c2), b = tv.dot(dir), cc = tv.lengthSq() - r * r, disc = b * b - cc; if (disc < 0) continue;
        const tt = -b - Math.sqrt(disc); if (tt > 0 && tt < bt) { bt = tt; best = { e, isHead }; }
      }
    }
    return { dist: bt, target: best };
  }
  drawScope(holding) {
    let cv = this.scopeCv;
    if (!cv) { cv = this.scopeCv = document.createElement('canvas'); cv.id = 'scopeCv'; cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:6;pointer-events:none'; document.body.appendChild(cv); }
    cv.style.display = 'block';
    const dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d'), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.46, u = R / 100;
    g.clearRect(0, 0, W, H);
    // الإطار الأسود + ظل العدسة
    g.fillStyle = '#000'; g.beginPath(); g.rect(0, 0, W, H); g.arc(cx, cy, R, 0, Math.PI * 2, true); g.fill();
    const vg = g.createRadialGradient(cx, cy, R * 0.72, cx, cy, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.85, 'rgba(0,0,0,.35)'); vg.addColorStop(1, 'rgba(0,0,0,.9)');
    g.fillStyle = vg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    const tgt = this.pick && this.pick.target, onHead = tgt && tgt.isHead, ink = onHead ? '#ff3b3b' : '#050505';
    // الخطوط السميكة من الأطراف + الرفيعة في الوسط
    g.fillStyle = ink; const th = 4 * u, gap = 32 * u;
    g.fillRect(cx - R, cy - th / 2, R - gap, th); g.fillRect(cx + gap, cy - th / 2, R - gap, th); g.fillRect(cx - th / 2, cy + gap, th, R - gap); g.fillRect(cx - th / 2, cy - R, th, R - gap);
    g.fillRect(cx - gap, cy - 0.5 * u, gap * 2, 1 * u); g.fillRect(cx - 0.5 * u, cy - gap, 1 * u, gap * 2);
    // نقاط القياس (mil-dots)
    for (let i = 1; i <= 4; i++) { const d = i * 7.5 * u, r = 1.3 * u; [[cx + d, cy], [cx - d, cy], [cx, cy + d], [cx, cy - d]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }); }
    // علامات تعويض المسافة تحت المركز
    g.font = `${Math.round(5 * u)}px system-ui`; g.textAlign = 'left'; g.textBaseline = 'middle';
    [[45, 6], [55, 4.5], [64, 3.2], [72, 2.2]].forEach(([y, w]) => g.fillRect(cx - w * u, cy + y * u, w * 2 * u, 0.9 * u)); // خطوط قياس الارتفاع
    // النقطة المضيئة في المركز
    g.fillStyle = onHead ? '#ff2a2a' : tgt ? '#ff8a00' : '#e11d48'; g.beginPath(); g.arc(cx, cy, 1.4 * u, 0, Math.PI * 2); g.fill();
    // النصوص: التكبير، المسافة، الهدف، التلقيم
    g.textAlign = 'center'; g.font = `800 ${Math.round(6 * u)}px system-ui`; g.fillStyle = 'rgba(190,255,190,.92)';
    g.fillText('×' + this.zoomX, cx + R * 0.62, cy - R * 0.62);
    const d = this.pick && isFinite(this.pick.dist) ? Math.round(this.pick.dist) + ' م' : '— م'; g.fillText('📏 ' + d, cx - R * 0.62, cy - R * 0.62);
    if (tgt) { const e = tgt.e, st = e.st === 'sleep' ? 'نايم 😴' : e.alert ? 'منتبه ⚠️' : e.st === 'inv' ? 'يفتّش ❓' : 'ما انتبه'; g.fillStyle = onHead ? 'rgba(255,120,120,.95)' : 'rgba(255,230,160,.95)'; g.fillText((onHead ? '🎯 رأس • ' : '👤 جسم • ') + st, cx, cy - R * 0.8); }
    if (this.boltT > 0) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText('🔄 يلقّم…', cx, cy + R * 0.36); }
    if (this.hitMark && this.hitMark.t > 0) { g.strokeStyle = this.hitMark.head ? 'rgba(255,60,60,' + this.hitMark.t + ')' : 'rgba(255,255,255,' + this.hitMark.t + ')'; g.lineWidth = 2 * u; const a = 6 * u, b = 11 * u; [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sy]) => { g.beginPath(); g.moveTo(cx + sx * a, cy + sy * a); g.lineTo(cx + sx * b, cy + sy * b); g.stroke(); }); }
    // عدّاد النفس (قوس يسار)
    g.lineWidth = 3 * u; g.strokeStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(cx, cy, R * 0.93, Math.PI * 0.8, Math.PI * 1.2); g.stroke();
    g.strokeStyle = this.tired > 0 ? 'rgba(248,113,113,.9)' : holding ? 'rgba(125,211,252,.95)' : 'rgba(255,255,255,.6)';
    g.beginPath(); g.arc(cx, cy, R * 0.93, Math.PI * 1.2 - Math.PI * 0.4 * this.breath, Math.PI * 1.2); g.stroke();
    g.font = `${Math.round(4.6 * u)}px system-ui`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(this.tired > 0 ? 'تلهث…' : holding ? 'حابس نفسك' : '🫁', cx - R * 0.93, cy + R * 0.28);
  }
  /* ---------- HUD ---------- */
  hud(force) {
    const $ = (s) => document.querySelector(s);
    $('#ammo').textContent = this.on ? (this.weapon === 'pistol' ? `▶ مسدس ${this.ammo.pistol}  ·  قنّاصة ${this.ammo.sniper}` : `▶ قنّاصة ${this.ammo.sniper}  ·  مسدس ${this.ammo.pistol}`) : '';
    $('#cross').classList.toggle('on', this.aiming && this.weapon === 'pistol');
    $('#scope').classList.remove('on'); const zb = $('#zoomBtns'); if (zb) { zb.classList.toggle('on', this.aiming); zb.classList.toggle('sn', this.weapon === 'sniper'); }
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
