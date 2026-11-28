// 👥 اللعب مع صديق عن بعد (المرحلة ٣١): صاحب العالم (المضيف) يطلع كود ٤ أرقام، صديقه يدخل بالكود، والمضيف يسمح أو يرفض.
// المضيف هو «المرجع»: الحراس يتحركون ويفكرون عنده، والضيف يشوف نسخة منهم (دمى) ويرسل أفعاله (ضرب/تنويم/رمي/ضجيج) للمضيف.
import * as THREE from 'three';
import { buildHero, setSpy, blendPose, BASE } from './hero.js';
import { textSprite } from './fx.js';
const V = THREE.Vector3, KEYS = Object.keys(BASE);
const loadScript = (src) => new Promise((res, rej) => { if (window.Peer) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
const r2 = (v) => Math.round(v * 100) / 100;

export class Net {
  constructor(c) {
    this.c = c; this.role = null; this.peer = null; this.conn = null; this.code = ''; this.other = null; this.sendT = 0; this.pending = null; this.ctl = new Set();
    this.stub = { active: false, pos: new V(), vel: new V(), state: 'ground', prone: false, hp: 3, aiming: false, inLocker: null, hang: null, hug: null, onGround: true,
      damage: (n, from) => { if (this.stub.inv > 0) return false; this.stub.inv = 1.2; this.send({ t: 'dmg', n, f: [from.x, from.y, from.z] }); return true; }, inv: 0 };
  }
  get on() { return !!(this.conn && this.conn.open && this.other); }
  myName() { try { return localStorage.getItem('nw_name') || 'لاعب'; } catch (e) { return 'لاعب'; } }
  send(d) { try { if (this.conn && this.conn.open) this.conn.send(d); } catch (e) {} }
  async lib() { await loadScript('lib/peerjs.min.js'); }
  /* ---------- المضيف ---------- */
  async host() {
    await this.lib(); this.leave(true); this.role = 'host'; this.code = String(1000 + Math.floor(Math.random() * 9000));
    this.ui('host-wait');
    this.peer = new window.Peer('abdnw-room-' + this.code, { debug: 0 });
    this.peer.on('open', () => this.ui('host-ready'));
    this.peer.on('error', (e) => { if (e.type === 'unavailable-id') { this.host(); } else this.ui('err', e.type); });
    this.peer.on('connection', (cn) => {
      cn.on('data', (d) => this.onData(d, cn));
      cn.on('close', () => { if (cn === this.conn) this.drop('left'); if (this.pending && this.pending.cn === cn) { this.pending = null; this.ui('host-ready'); } });
    });
  }
  accept() {
    const p = this.pending; if (!p) return; this.pending = null; this.conn = p.cn;
    this.send({ t: 'welcome', world: this.c.worldId(), name: this.myName() });
    this.spawnOther(p.name); this.c.enemies.pl2 = this.stub; this.stub.active = true; this.ui('connected');
    this.c.say('👥 ' + p.name + ' دخل عالمك! تقدرون تلعبون مع بعض — والحراس يشوفونكم الاثنين');
  }
  deny() { const p = this.pending; if (!p) return; this.pending = null; try { p.cn.send({ t: 'deny' }); } catch (e) {} setTimeout(() => { try { p.cn.close(); } catch (e) {} }, 400); this.ui('host-ready'); }
  kick() { this.send({ t: 'kick' }); setTimeout(() => this.drop('kicked'), 200); }
  /* ---------- الضيف ---------- */
  async join(code) {
    await this.lib(); this.leave(true); this.role = 'guest'; this.code = code; this.ui('joining');
    this.peer = new window.Peer({ debug: 0 });
    const to = setTimeout(() => { if (!this.conn || !this.conn.open) { this.ui('err', 'timeout'); this.leave(true); } }, 15000);
    this.peer.on('open', () => {
      const cn = this.peer.connect('abdnw-room-' + code, { reliable: true });
      cn.on('open', () => { clearTimeout(to); this.conn = cn; cn.send({ t: 'hello', name: this.myName() }); this.ui('waiting'); });
      cn.on('data', (d) => this.onData(d, cn));
      cn.on('close', () => this.drop('host-left'));
    });
    this.peer.on('error', (e) => { clearTimeout(to); this.ui('err', e.type); });
  }
  /* ---------- الرسائل ---------- */
  onData(d, cn) {
    const c = this.c, E = c.enemies;
    switch (d.t) {
      case 'hello': // المضيف: أحد يبي يدخل
        if (this.conn && this.conn.open) { cn.send({ t: 'deny', why: 'full' }); return; }
        this.pending = { cn, name: String(d.name || 'لاعب').slice(0, 16) }; this.ui('request', this.pending.name); c.sfx.tone && c.sfx.tone(660, 880, 0.15, 'sine', 0.12); break;
      case 'welcome': this.otherName = d.name; this.spawnOther(d.name); this.ui('connected'); c.loadNet(d.world); c.say('👥 دخلت عالم ' + d.name + '! هو صاحب العالم — العب معه'); break;
      case 'deny': this.ui('denied', d.why); this.leave(true); break;
      case 'kick': this.drop('kicked'); break;
      case 'world': c.loadNet(d.id); break;
      case 'dmg': if (c.player.hp > 0) c.player.damage(d.n, new V(d.f[0], d.f[1], d.f[2])); break;
      case 'p': this.setOther(d); if (this.role === 'host') this.guestState(d); break;
      case 's': this.setOther(d); this.applySnap(d); break;
      case 'ev': if (this.role === 'host') this.applyEv(d); break;
    }
  }
  /* ---------- الشخصية الثانية ---------- */
  spawnOther(name) {
    if (this.other) this.other.h.root.removeFromParent();
    const h = buildHero('ninja'); h.mats && h.mats.trim && h.mats.trim.color.setHex(0x38bdf8);
    const tag = textSprite('👥 ' + name, { size: 44, color: '#e0f2fe', glow: '#0284c7', scale: 0.5 }); tag.position.y = 2.25; h.root.add(tag);
    this.c.scene.add(h.root); this.other = { h, tgt: null, name }; this.outfit();
  }
  outfit() { const o = this.other, cfg = this.c.cfg(); if (!o || !cfg) return; try { setSpy(o.h, !!(cfg.ship || cfg.city || cfg.outfit), cfg.outfit || (cfg.city ? 'street' : 'spy')); } catch (e) {} }
  setOther(d) { if (!this.other || !d.ps) return; this.other.tgt = d.ps; }
  myState() {
    const P = this.c.player, h = this.c.hero;
    return { x: r2(P.pos.x), y: r2(P.pos.y), z: r2(P.pos.z), yaw: r2(P.yaw), k: KEYS.map((k) => r2(h.cur[k] || 0)), st: P.state, pr: P.prone ? 1 : 0, hp: P.hp, vx: r2(P.vel.x), vz: r2(P.vel.z), hid: P.inLocker ? 1 : 0, dr: P.driving ? 1 : 0 };
  }
  /* ---------- المضيف ← الضيف: لقطة الحراس ---------- */
  snap() {
    const E = this.c.enemies, L = this.c.level();
    return { t: 's', ps: this.myState(), ph: L.phase, pt: r2(L.phaseT || 0), n: E.list.length,
      e: E.list.map((e) => [r2(e.pos.x), r2(e.pos.y), r2(e.pos.z), r2(e.yaw), e.st, (e.alive ? 1 : 0) | (e.alert ? 2 : 0) | (e.hidden ? 4 : 0), e.anim || 'idle']),
      defs: E.list.length > (this._sentDefs || 0) ? E.list.slice(this._sentDefs || 0).map((e, k) => [(this._sentDefs || 0) + k, e.def.x, e.def.y || 0, e.def.z, e.def.type, e.def.heavy ? 1 : 0, e.def.sniper ? 1 : 0, e.def.zone]) : null };
  }
  applySnap(d) {
    const E = this.c.enemies, L = this.c.level();
    if (d.defs) for (const [i, x, y, z, type, heavy, sniper, zone] of d.defs) if (!E.list[i]) E.spawn({ x, y, z, type, heavy: !!heavy, sniper: !!sniper, zone, path: [[x, z]] });
    d.e.forEach((a, i) => { const e = E.list[i]; if (!e) return; if (this.ctl.has(i) && (e.st === 'held' || e.st === 'dragged')) return; e.net = { x: a[0], y: a[1], z: a[2], yaw: a[3], st: a[4], alive: !!(a[5] & 1), alert: !!(a[5] & 2), hidden: !!(a[5] & 4), anim: a[6] }; });
    if (d.ph && L.phase !== d.ph) { L.phase = d.ph; } L.phaseT = d.pt;
  }
  /* ---------- الضيف ← المضيف: حالة الضيف + الحراس اللي ماسكهم ---------- */
  guestState(d) {
    const s = this.stub, ps = d.ps, E = this.c.enemies; s.pos.set(ps.x, ps.y, ps.z); s.vel.set(ps.vx || 0, 0, ps.vz || 0); s.state = ps.st; s.prone = !!ps.pr; s.hp = ps.hp; s.inLocker = ps.hid ? {} : null; s.hang = ps.st === 'hang' ? { b: { hull: true } } : null;
    const now = new Set();
    for (const [i, st, x, y, z] of d.ctl || []) { const e = E.list[i]; if (!e || !e.alive) continue; now.add(i); e.st = st; e.pos.set(x, y, z); }
    for (const i of this.ctl) if (!now.has(i)) { const e = E.list[i]; if (e && (e.st === 'held' || e.st === 'dragged')) { e.st = 'idle'; e.wait = 1; } }
    this.ctl = now;
  }
  ev(o) { this.send({ t: 'ev', ...o }); }
  applyEv(d) {
    const E = this.c.enemies, e = E.list[d.i], S = this.c.stealth;
    if (d.k === 'noise') { E.noise(new V(d.p[0], d.p[1], d.p[2]), d.r); return; }
    if (!e) return;
    switch (d.k) {
      case 'hurt': E.hurt(e, d.dmg, new V(d.f[0], e.pos.y, d.f[1]), d.kn); break;
      case 'tranq': E.tranq(e, d.head); break;
      case 'sleep': E.sleep(e, true); e.sleepT = d.long ? 150 : e.sleepT; break;
      case 'thrown': e.st = 'thrown'; e.alive = false; e.hidden = true; e.m.g.visible = false; break;
      case 'hide': e.hidden = true; e.m.g.visible = false; e.st = 'sleep'; e.sleepT = 1e9; break;
      case 'asked': e.asked = true; break;
    }
    if (S && S.L) S.L.thrown = S.L.thrown || 0;
  }
  /* ---------- الضيف: نحوّل أفعاله على الحراس لرسائل للمضيف ---------- */
  hookGuest() {
    const E = this.c.enemies, S = this.c.stealth; if (E._netHooked) return; E._netHooked = true; const idx = (e) => E.list.indexOf(e);
    const oH = E.hurt.bind(E), oT = E.tranq.bind(E), oS = E.sleep.bind(E), oN = E.noise.bind(E);
    E.hurt = (e, dmg, from, kn) => { if (this.role === 'guest' && this.on) this.ev({ k: 'hurt', i: idx(e), dmg, f: [r2(from.x), r2(from.z)], kn }); return oH(e, dmg, from, kn); };
    E.tranq = (e, head) => { if (this.role === 'guest' && this.on) this.ev({ k: 'tranq', i: idx(e), head: !!head }); return oT(e, head); };
    E.sleep = (e, q) => { if (this.role === 'guest' && this.on) this.ev({ k: 'sleep', i: idx(e), long: true }); return oS(e, q); };
    E.noise = (p, r) => { if (this.role === 'guest' && this.on) { this.ev({ k: 'noise', p: [r2(p.x), r2(p.y), r2(p.z)], r }); return; } return oN(p, r); };
    if (S) for (const fn of ['throwBody', 'pullOver']) { const o = S[fn].bind(S); S[fn] = (e, ...a) => { const res = o(e, ...a); if (this.role === 'guest' && this.on && e && e.st === 'thrown') this.ev({ k: 'thrown', i: idx(e) }); return res; }; }
  }
  /* ---------- كل فريم ---------- */
  update(dt) {
    if (!this.role) return;
    const o = this.other;
    if (o && o.tgt) { const t = o.tgt, r = o.h.root; r.visible = !t.hid && !t.dr; r.position.lerp(new V(t.x, t.y, t.z), Math.min(1, dt * 12));
      let dy = t.yaw - r.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; r.rotation.y += dy * Math.min(1, dt * 12);
      const P = {}; KEYS.forEach((k, i) => (P[k] = t.k[i])); blendPose(o.h, P, dt, 16); }
    this.stub.inv = Math.max(0, this.stub.inv - dt);
    if (!this.on) return;
    if ((this.sendT -= dt) > 0) return;
    if (this.role === 'host') { this.sendT = 1 / 12; const s = this.snap(); this.send(s); if (s.defs) this._sentDefs = this.c.enemies.list.length; }
    else { this.sendT = 1 / 15; const E = this.c.enemies, ctl = []; E.list.forEach((e, i) => { if (e.alive && (e.st === 'held' || e.st === 'dragged')) ctl.push([i, e.st, r2(e.pos.x), r2(e.pos.y), r2(e.pos.z)]); });
      E.list.forEach((e, i) => { if (e.hidden && e.net && !e.net.hidden && !e._hideSent) { e._hideSent = true; this.ev({ k: 'hide', i }); } });
      this.ctl = new Set(ctl.map((x) => x[0])); this.send({ t: 'p', ps: this.myState(), ctl }); }
  }
  onWorldLoaded(id) {
    this._sentDefs = 0; this.outfit();
    if (this.role === 'host' && this.on) { this.send({ t: 'world', id }); this.c.enemies.pl2 = this.stub; this.stub.active = true; }
    if (this.role === 'guest') { this.c.enemies.puppet = true; this.hookGuest(); }
  }
  drop(why) {
    const msg = { left: '👋 صديقك طلع من عالمك', 'host-left': '👋 صاحب العالم قفل اللعب', kicked: this.role === 'guest' ? '🚪 صاحب العالم طلّعك' : '🚪 طلّعت صديقك' }[why] || '👋 انقطع الاتصال';
    const wasGuest = this.role === 'guest'; this.c.say(msg); this.leave(true); this.ui('closed');
    if (wasGuest) this.c.loadNet(null);
  }
  leave(silent) {
    try { if (this.conn) { if (!silent) this.send({ t: 'bye' }); this.conn.close(); } } catch (e) {}
    try { if (this.peer) this.peer.destroy(); } catch (e) {}
    this.conn = null; this.peer = null; this.pending = null; this.ctl = new Set();
    if (this.other) { this.other.h.root.removeFromParent(); this.other = null; }
    const E = this.c.enemies; if (E) { E.puppet = false; E.pl2 = null; } this.stub.active = false; this.role = null;
  }
  ui(state, extra) { this.c.netUI && this.c.netUI(state, extra, this); }
}
