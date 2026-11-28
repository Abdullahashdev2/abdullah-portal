// ⚔️ قتال الساموراي (المرحلتان ٢ و٣): الضربات القوية C1..C6 + «الإعصار» (شريط الغضب والضربة الكاسحة)
import * as THREE from 'three';
const V = THREE.Vector3;

export class BattleCombat {
  constructor(G) { this.g = G; this.rage = 0; this.rT = 0; this.tick = 0; this.red = false; this.el = null; }
  reset(el) { this.rage = 0; this.rT = 0; this.el = el; this.draw(); }
  busy() { return this.rT > 0; }
  addRage(x) { if (this.rT > 0) return; const was = this.rage >= 100; this.rage = Math.min(100, this.rage + x); if (!was && this.rage >= 100) { this.g.say('🔥 الإعصار جاهز! اضغط △ / «إعصار»'); this.g.sfx.S && this.g.sfx.S('dg_power_up_11', 0.6); } this.draw(); }
  // كل ضربة وحدة تفرق: الضرب بالضبط بيئة واحدة — نستخدم نفس دوال الإصابة (تشمل الحشد والقادة)
  arc(pl, range, cosMin, dmg, knock, launch = 0) { const C = this.g.crowd; if (C) C.launch = launch; const n = this.g.enemies.hitArc(pl.pos, pl.yaw, range, cosMin, dmg, knock); if (C) C.launch = 0; return n; }
  ring(pl, r, dmg, knock, launch = 0) { const C = this.g.crowd; if (C) C.launch = launch; const n = this.g.enemies.hitRadius(pl.pos, r, dmg, knock); if (C) C.launch = 0; return n; }
  fx(p, o) { this.g.fx.emit(p, o); }
  hit(n, i, pl) {
    const G = this.g, up = G.upg.dmg || 0, P = pl.pos, f = new V(Math.sin(pl.yaw), 0, Math.cos(pl.yaw)), at = (d, y = 1) => P.clone().addScaledVector(f, d).add(new V(0, y, 0));
    let k = 0;
    switch (n) {
      case 0: k = this.arc(pl, 3.4, -0.1, 2 + up, 3, 10); this.fx(at(1.6), { color: 0xffe08a, count: 30, speed: 6, up: 6, life: 0.45, size: 0.3, grav: 4 }); break; // رفع للهوا
      case 1: k = this.arc(pl, 5.2, 0.86, 3 + up, 13); for (let d = 1; d <= 5; d++) this.fx(at(d), { color: 0x9be7ff, count: 6, speed: 2, life: 0.3, size: 0.25, grav: 0 }); break; // طعنة تخترق الصف
      case 2: k = this.ring(pl, 3.7, 2 + up, 8); this.fx(at(0, 1), { color: 0x9be7ff, count: 44, speed: 8, flat: true, life: 0.35, size: 0.3, grav: 0 }); break; // دوران
      case 3: k = this.arc(pl, 7.5, 0.5, 2 + up, 11); for (let d = 2; d <= 7; d += 1.5) this.fx(at(d, 0.4), { color: 0xffb35c, count: 14, speed: 4, flat: true, life: 0.4, size: 0.4, grav: 0 }); G.shake(0.3); break; // موجة أرضية
      case 4: k = this.arc(pl, 3.3, 0.25, 1 + up, i === 2 ? 9 : 2); this.fx(at(1.6, 1.2), { color: 0xffffff, count: 16, speed: 7, life: 0.2, size: 0.18, grav: 2 }); break; // سلسلة سريعة
      case 5: k = this.ring(pl, 5.8, 4 + up, 15, 7); this.fx(at(0.8, 0.1), { color: 0xff7b3d, count: 90, speed: 11, flat: true, life: 0.55, size: 0.45, grav: 0 }); G.shake(0.6); G.dust && G.dust(P, 30); break; // ضربة أرضية
    }
    if (k) { G.hitstop(n === 5 ? 0.12 : 0.07); G.sfx.hit(); this.addRage(k * 1.2); }
    G.sfx.slash(3);
  }
  /* 🔥 الإعصار: ٣ ثواني ما ينضرب، يقطع كل شي حوله، وفي الآخر انفجار. لو صحته قليلة = «الإعصار الأحمر» أقوى */
  tryRage(pl) {
    if (this.rage < 100 || this.rT > 0) { if (this.rage < 100) this.g.say('🔥 الإعصار يتعبّى بالضرب — باقي ' + Math.ceil(100 - this.rage) + '٪'); return false; }
    this.red = pl.hp <= 2; this.rT = 3.2; this.tick = 0; this.rage = 0; pl.state = 'charge'; pl.st.cT = 0; pl.st.cN = 99; pl.st.cD = 3.2; pl.st.cH = []; pl.st.cI = 0;
    this.g.shake(0.5); this.g.hitstop(0.25); this.g.say(this.red ? '🩸 الإعصار الأحمر!!' : '🌪️ الإعصار!!'); this.g.sfx.S && this.g.sfx.S('dg_power_up_11', 0.9, { rate: 0.7 });
    this.draw(); return true;
  }
  update(dt, pl) {
    if (this.rT <= 0) return;
    this.rT -= dt; pl.inv = Math.max(pl.inv, 0.3); if (pl.state !== 'charge') { pl.state = 'charge'; pl.st.cN = 99; pl.st.cD = 3.2; pl.st.cT = 3.2 - this.rT; pl.st.cH = []; }
    const R = this.red ? 5.2 : 4.2, col = this.red ? 0xff2d2d : 0xffd166;
    if ((this.tick -= dt) <= 0) {
      this.tick = 0.16; const k = this.ring(pl, R, 3, 9, 6.5); if (k) this.g.sfx.hit();
      const p = pl.pos.clone().add(new V(0, 1, 0)); this.fx(p, { color: col, count: 26, speed: 9, flat: true, life: 0.3, size: 0.32, grav: 0 }); this.fx(p, { color: 0xffb7c5, count: 8, speed: 4, up: 3, life: 0.9, size: 0.22, grav: -0.5 });
    }
    if (this.rT <= 0) { // الانفجار الأخير
      this.ring(pl, R * 1.7, 6, 18, 9); this.fx(pl.pos.clone().add(new V(0, 0.5, 0)), { color: col, count: 160, speed: 16, flat: true, life: 0.7, size: 0.55, grav: 0 });
      this.g.shake(0.9); this.g.hitstop(0.18); pl.state = 'ground'; this.g.sfx.slam && this.g.sfx.slam();
    }
    this.draw();
  }
  draw() {
    const el = this.el; if (!el) return; const full = this.rage >= 100, on = this.rT > 0;
    const s = `<i style="width:${on ? (this.rT / 3.2) * 100 : this.rage}%"></i><b>${on ? (this.red ? '🩸 الإعصار الأحمر' : '🌪️ الإعصار') : full ? '🔥 الإعصار جاهز!' : '🌪️ ' + Math.floor(this.rage) + '٪'}</b>`;
    if (s !== this._last) { this._last = s; el.innerHTML = s; el.classList.toggle('full', full || on); el.classList.toggle('red', on && this.red); }
  }
}
