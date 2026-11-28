// Shadow creatures: telegraphed attacks (eyes flare + raised claws), stagger, knockback, dissolve on death
import * as THREE from 'three';
import { glowSprite, textSprite } from './fx.js';
import { buildSoldier, blendPose, BASE } from './hero.js';
const V = THREE.Vector3;
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

function buildHumanGuard(seed) {
  const h = buildSoldier(seed), g = new THREE.Group(); g.add(h.root);
  const geo = new THREE.ConeGeometry(Math.tan(0.62) * 11, 11, 28, 1, true); geo.translate(0, -5.5, 0); geo.rotateX(-Math.PI / 2);
  const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending }));
  cone.position.set(0, 1.62, 0.2); cone.rotation.x = 0.1; g.add(cone);
  const d = () => new THREE.Object3D();
  return { g, inner: h.root, body: h.root, head: h.head, arms: [d(), d()], eyes: [], bodyM: h.suitMat, aura: d(), cone, human: true, h, ph: 0 };
}
function buildShade(big, archer, guard, boss) {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const bodyM = new THREE.MeshStandardMaterial({ color: big ? 0x2a1012 : 0x1c1433, roughness: 0.35, metalness: 0.25, emissive: big ? 0x6b0f0f : 0x3b0d66, emissiveIntensity: 0.55, flatShading: true });
  const eyeC = big ? 0xffa31a : 0xff4fd8, eyeM = new THREE.MeshBasicMaterial({ color: eyeC });
  const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; inner.add(me); return me; };
  const body = add(new THREE.IcosahedronGeometry(0.5, 1), bodyM, 0, 1.0, 0); body.scale.set(1, 1.15, 0.85);
  const head = add(new THREE.IcosahedronGeometry(0.3, 1), bodyM, 0, 1.62, 0.14);
  [-1, 1].forEach((s) => { const h = add(new THREE.ConeGeometry(0.07, 0.42, 6), bodyM, s * 0.17, 1.9, 0.05); h.rotation.z = -s * 0.5; h.rotation.x = -0.3; });
  const eyes = [];
  [-1, 1].forEach((s) => { const e = add(new THREE.SphereGeometry(0.055, 8, 6), eyeM, s * 0.11, 1.66, 0.4); const gl = glowSprite(eyeC, 0.6, 0.9); gl.position.copy(e.position); inner.add(gl); eyes.push(gl); });
  const skirt = add(new THREE.ConeGeometry(0.5, 0.9, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x0b0614, roughness: 0.6, transparent: true, opacity: 0.85, side: THREE.DoubleSide, emissive: bodyM.emissive, emissiveIntensity: 0.25 }), 0, 0.45, 0); skirt.rotation.x = Math.PI;
  const arms = [-1, 1].map((s) => {
    const a = new THREE.Group(); a.position.set(s * 0.52, 1.28, 0.05); inner.add(a);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.45, 3, 8), bodyM); up.position.y = -0.3; up.castShadow = true; a.add(up);
    for (let k = -1; k <= 1; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.24, 5), eyeM); c.position.set(k * 0.06, -0.66, 0.05); c.rotation.x = Math.PI; a.add(c); }
    return a;
  });
  const aura = glowSprite(big ? 0xff3b1f : 0x8b5cf6, big ? 3.4 : 2.6, 0.35); aura.position.y = 1.1; inner.add(aura);
  if (big) g.scale.setScalar(boss ? 3.1 : 1.55);
  if (boss) { bodyM.color.setHex(0x1a0d08); bodyM.emissive.setHex(0xff4500); bodyM.emissiveIntensity = 0.9; aura.material.color.setHex(0xff5a1f); aura.scale.setScalar(4.5); }
  let cone = null;
  if (guard) {
    bodyM.color.setHex(0x1f2937); bodyM.emissive.setHex(0x3f3f00); const lan = glowSprite(0xffe08a, 0.8, 1); lan.position.set(-0.55, 0.7, 0.35); inner.add(lan);
    const geo = new THREE.ConeGeometry(Math.tan(0.62) * 9, 9, 28, 1, true); geo.translate(0, -4.5, 0); geo.rotateX(-Math.PI / 2);
    cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending }));
    cone.position.set(0, 1.62, 0.3); cone.rotation.x = 0.12; inner.add(cone);
  }
  if (archer) { bodyM.color.setHex(0x0f2a2e); bodyM.emissive.setHex(0x0e7490); const orb = glowSprite(0x22d3ee, 0.9, 0.9); orb.position.set(0.55, 0.62, 0.3); inner.add(orb); }
  return { g, inner, body, head, arms, eyes, bodyM, aura, cone };
}

export class Enemies {
  constructor(game) { this.g = game; this.list = []; this.pickups = []; this.shots = []; }
  clear() { for (const e of this.list) e.m.g.removeFromParent(); for (const p of this.pickups) p.s.removeFromParent(); for (const b of this.shots) b.m.removeFromParent(); this.list = []; this.pickups = []; this.shots = []; }
  spawn(def, rise = false) {
    const boss = def.type === 'boss', big = def.type === 'brute' || boss, archer = def.type === 'archer', guard = def.type === 'guard';
    const m = guard && this.g.level.cfg && this.g.level.cfg.ship ? buildHumanGuard(this.list.length) : buildShade(big, archer, guard, boss);
    m.g.position.set(def.x, def.y, def.z); this.g.scene.add(m.g);
    const zone = def.zone || { x0: def.x - 5, x1: def.x + 5, z0: def.z - 5, z1: def.z + 5 };
    const e = { def, m, big, pos: m.g.position, yaw: Math.PI, hp: big ? 9 : 3, maxHp: big ? 9 : 3, st: rise ? 'rise' : 'idle', t: 0, kb: new V(), flash: 0, zone, group: def.group || null, reach: big ? 2.7 : 1.9, speed: big ? 3.0 : 3.9, alive: true, cd: Math.random() + (archer ? 1 : 0), archer };
    if (archer) { e.hp = e.maxHp = 2; e.speed = 2.6; }
    if (guard) { Object.assign(e, { guard: true, alert: !!def.alert, sus: def.alert ? 1 : 0, pi: 0, wait: 0, speed: 3.6 }); e.yaw = def.yaw || 0; }
    if (def.yeti && m.bodyM) { m.bodyM.color.setHex(0xe2e8f0); m.bodyM.emissive.setHex(0x60a5fa); m.bodyM.emissiveIntensity = 0.35; }
    if (def.captain) { Object.assign(e, { captain: true, capHp: 6, capMax: 6, ammo: 3, reloadT: 0, cd: 1.5, alert: true, sus: 1 }); m.g.scale.setScalar(1.14); if (m.bodyM) m.bodyM.color.setHex(0x1e293b); }
    if (guard && this.g.level.cfg && this.g.level.cfg.ship) {
      Object.assign(e, { ship: true, archer: true, hp: 3, maxHp: 3, speed: 3.2 });
      const ex = textSprite('!', { size: 110, color: '#ff4040', glow: '#ff0000', scale: 0.55 }), qu = textSprite('?', { size: 110, color: '#ffd23f', glow: '#ffaa00', scale: 0.55 }), zz = textSprite('Zzz', { size: 70, color: '#bfdbfe', glow: '#3b82f6', scale: 0.45 });
      [ex, qu, zz].forEach((x) => { x.position.y = 2.45; x.visible = false; m.g.add(x); }); m.icons = { ex, qu, zz };
    }
    if (boss) { Object.assign(e, { boss: true, hp: 40, maxHp: 40, reach: 4.4, speed: 2.4, summonT: 8 }); }
    if (rise) { m.inner.position.y = -2.2; this.g.fx.emit(new V(def.x, def.y + 0.3, def.z), { color: 0x8b5cf6, count: 40, speed: 4, up: 1, life: 0.9, size: 0.4, grav: -1 }); }
    if (this.g.liteify) { this.g.liteify(m.g); if (m.bodyM) m.bodyM = this.g.liteMat(m.bodyM); }
    this.list.push(e); return e;
  }
  alive(group) { return this.list.filter((e) => e.alive && (!group || e.group === group)).length; }
  nearest(p, maxD) { let best = null, bd = maxD; for (const e of this.list) { if (!e.alive || e.st === 'rise') continue; const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z); if (d < bd && Math.abs(e.pos.y - p.y) < 2.5) { bd = d; best = e; } } if (this.g.crowd && this.g.crowd.on) { const c = this.g.crowd.nearest(p, bd); if (c) return c; } return best; }
  hurt(e, dmg, from, knock) {
    if (!e.alive || e.st === 'rise' || e.st === 'dying') return false;
    if (e.guard && !e.alert) {
      const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), dx0 = from.x - e.pos.x, dz0 = from.z - e.pos.z, l0 = Math.hypot(dx0, dz0) || 1;
      if ((dx0 * fx + dz0 * fz) / l0 < 0.35) { if (e.ship && e.st !== 'sleep') { this.sleep(e, true); this.g.onTakedown && this.g.onTakedown(e); return true; } dmg = 99; this.g.onTakedown && this.g.onTakedown(e); } else if (!e.ship) this.alarm(e);
    }
    e.hp -= dmg; e.flash = 0.18; e.hitT = 0.32; e.hitYaw = Math.atan2(e.pos.x - from.x, e.pos.z - from.z); // راسه يرتد للخلف من الضربة
    if (e.m.human && e.hp <= 0) { e.hp = e.maxHp; this.sleep(e); e.sleepT = 90; this.g.sfx.hit(); this.g.fx.emit(e.pos.clone().add(new V(0, 1.2, 0)), { color: 0xffffff, count: 16, speed: 5, life: 0.3 }); return true; }
    const dx = e.pos.x - from.x, dz = e.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
    const kr = e.boss ? 10 : e.big ? 2.2 : 1; e.kb.set((dx / l) * knock / kr, 0, (dz / l) * knock / kr);
    const hitP = e.pos.clone(); hitP.y += e.big ? 1.6 : e.m.human ? 1.5 : 1.1; if (e.m.human) { hitP.x -= Math.sin(e.hitYaw) * 0.2; hitP.z -= Math.cos(e.hitYaw) * 0.2; } // الشرارة على الوجه نفسه
    this.g.fx.emit(hitP, { color: 0xffffff, count: 14, speed: 7, life: 0.25, size: 0.18, grav: 4 });
    this.g.fx.emit(hitP, { color: e.big ? 0xff6a3d : 0xc084fc, count: 18, speed: 4, life: 0.5, size: 0.3, grav: 2 });
    if (e.hp <= 0) { e.st = 'dying'; e.t = 0; e.alive = false; this.g.sfx.enemyDie(); this.g.onEnemyKilled(e); }
    else if (!e.boss && (!e.big || dmg >= 2)) { e.st = 'stagger'; e.t = 0; }
    return true;
  }
  hitArc(p, yaw, range, cosMin, dmg, knock) {
    let n = 0; const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const e of this.list) {
      if (!e.alive) continue; const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz), rr = range + (e.boss ? 2 : e.big ? 0.6 : 0);
      if (d > rr || Math.abs(e.pos.y - p.y) > 2) continue;
      if (d > 0.6 && (dx * fx + dz * fz) / d < cosMin) continue;
      if (this.hurt(e, dmg, p, knock)) n++;
    }
    if (this.g.crowd && this.g.crowd.on) n += this.g.crowd.hitArc(p, yaw, range, cosMin, dmg, knock);
    return n;
  }
  hitRadius(p, r, dmg, knock) { let n = 0; for (const e of this.list) { if (!e.alive) continue; if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < r + (e.boss ? 2 : e.big ? 0.6 : 0) && Math.abs(e.pos.y - p.y) < 2.5) if (this.hurt(e, dmg, p, knock)) n++; } if (this.g.crowd && this.g.crowd.on) n += this.g.crowd.hitRadius(p, r, dmg, knock); return n; }
  update(dt, pl) {
    const attackers = this.list.filter((e) => e.st === 'windup' || e.st === 'strike').length;
    for (const e of this.list) {
      e.t += dt; e.cd -= dt;
      const m = e.m, dx = pl.pos.x - e.pos.x, dz = pl.pos.z - e.pos.z, d = Math.hypot(dx, dz), dy = pl.pos.y - e.pos.y;
      // الجندي البعيد ما ينرسم (يوفّر عشرات أوامر الرسم لكل جندي) — المنطق يكمّل عادي
      if (!e.hidden) { const far = this.cullR || 1e9; e.m.g.visible = d < far || e.st === 'alert' && d < far * 1.6; }
      if (this.cullR) { const sh = d < 22; if (e._sh !== sh) { e._sh = sh; e.m.g.traverse((o) => { if (o.isMesh && o !== e.m.cone) o.castShadow = sh; }); } } // ظل الجنود البعيدين ما يبين — نوفّره
      const seen = d < 15 && Math.abs(dy) < 2.6 && pl.hp > 0, toYaw = Math.atan2(dx, dz);
      // knockback + zone clamp
      e.pos.x += e.kb.x * dt; e.pos.z += e.kb.z * dt; e.kb.multiplyScalar(Math.exp(-7 * dt));
      let anim = 'idle';
      const shipAnim = e.ship && e.alive ? this.shipThink(e, dt, pl, d, dy, dx, dz, toYaw) : null;
      if (shipAnim) anim = shipAnim;
      else if (e.guard && !e.alert && e.alive && (e.st === 'idle' || e.st === 'chase')) { anim = this.patrol(e, dt, pl, d, dy, dx, dz); }
      else if (e.boss && e.alive && (e.st === 'idle' || e.st === 'chase') && seen) { anim = this.bossThink(e, dt, pl, d, dx, dz, toYaw); }
      else switch (e.st) {
        case 'rise': m.inner.position.y = Math.min(0, -2.2 + e.t * 2.6); if (e.t > 0.9) { e.st = 'idle'; m.inner.position.y = 0; } break;
        case 'idle': case 'chase':
          if (seen && e.archer) {
            e.yaw += angDiff(e.yaw, toYaw) * Math.min(1, dt * 6);
            if (e.ship) { // ينتشرون على قوس حولك — كل واحد بمكان (ما يتكدّسون في نقطة وحدة) ويوقفون لما يوصلون
              const k = ((this.list.indexOf(e) * 5) % 7) - 3, want = 6 + Math.abs(k) * 0.8, base = Math.atan2(-dx, -dz) + k * 0.38;
              const tx = pl.pos.x + Math.sin(base) * want, tz = pl.pos.z + Math.cos(base) * want, mx = tx - e.pos.x, mz = tz - e.pos.z, ml = Math.hypot(mx, mz);
              if (ml > 1.0) { const sp = e.speed * 0.75; e.pos.x += (mx / ml) * sp * dt; e.pos.z += (mz / ml) * sp * dt; anim = 'walk'; }
            }
            else if (d < 5.5) { e.pos.x -= (dx / d) * e.speed * dt; e.pos.z -= (dz / d) * e.speed * dt; anim = 'walk'; }
            else if (d > 12) { e.pos.x += (dx / d) * e.speed * dt; e.pos.z += (dz / d) * e.speed * dt; anim = 'walk'; }
            if (e.cd <= 0 && d < 16) { e.st = 'windup'; e.t = 0; this.g.sfx.enemyAtk(); }
          } else if (seen) {
            e.yaw += angDiff(e.yaw, toYaw) * Math.min(1, dt * 6);
            if (d > e.reach * 0.85) { const sp = e.speed * (d > 6 ? 1 : 0.85); e.pos.x += (dx / d) * sp * dt; e.pos.z += (dz / d) * sp * dt; anim = 'walk'; }
            else if (e.cd <= 0 && attackers < 2 && Math.abs(dy) < 1.6) { e.st = 'windup'; e.t = 0; this.g.sfx.enemyAtk(); }
          } else { e.yaw += Math.sin(e.t * 0.5) * dt * 0.3; }
          break;
        case 'windup': e.yaw += angDiff(e.yaw, toYaw) * Math.min(1, dt * 3); if (e.t > (e.boss ? (e.hp < 14 ? 0.7 : 0.95) : e.big ? 0.75 : 0.55)) { e.st = 'strike'; e.t = 0; e.hit = false; } anim = 'windup'; break;
        case 'strike': {
          anim = 'strike';
          if (!e.big && !e.archer) { e.pos.x += Math.sin(e.yaw) * 6 * dt * (e.t < 0.12 ? 1 : 0); e.pos.z += Math.cos(e.yaw) * 6 * dt * (e.t < 0.12 ? 1 : 0); }
          if (!e.hit && e.t > 0.08 && (e.archer || e.volley)) { e.hit = true; if (e.volley) { for (let k = -2; k <= 2; k++) this.fire(e, pl, k * 0.22, 0xff7a1a); e.volley = false; } else this.fire(e, pl); }
          else if (!e.hit && e.t > 0.08) {
            e.hit = true;
            const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), inFront = d < 0.5 || (dx * fx + dz * fz) / d > 0.35;
            if (e.big) { const R = e.boss ? 4.8 : 2.6, c = e.pos.clone(); c.x += fx * (e.boss ? 2.6 : 1.4); c.z += fz * (e.boss ? 2.6 : 1.4); if (e.boss) { this.g.fx.emit(c, { color: 0xff4500, count: 80, speed: 10, flat: true, life: 0.6, size: 0.5, grav: 0 }); this.g.shake(0.5); } this.g.fx.emit(c, { color: 0xff7b3d, count: 40, speed: 6, flat: true, life: 0.5, size: 0.35, grav: 1 }); this.g.shake(0.25); this.g.sfx.slam(); if (Math.hypot(pl.pos.x - c.x, pl.pos.z - c.z) < R && Math.abs(dy) < 1.5) pl.damage(2, e.pos); }
            else if (d < e.reach + 0.3 && inFront && Math.abs(dy) < 1.4) pl.damage(1, e.pos);
          }
          if (e.t > 0.25) { e.st = 'recover'; e.t = 0; }
          break;
        }
        case 'recover': anim = 'idle'; if (e.t > (e.big ? 1.0 : 0.75)) { e.st = 'idle'; e.cd = e.boss ? (e.hp < 14 ? 0.8 : 1.4) : e.archer ? 1.6 + Math.random() : 0.4 + Math.random() * 0.8; } break;
        case 'stagger': anim = 'stagger'; if (e.t > 0.42) { e.st = 'idle'; e.cd = 0.3; } break;
        case 'dying': {
          const k = e.t / 0.7; m.inner.scale.setScalar(Math.max(0.01, 1 - k)); m.inner.rotation.y += dt * 10; m.inner.position.y = k * 0.8;
          if (Math.random() < 0.6) this.g.fx.emit(new V(e.pos.x, e.pos.y + 1, e.pos.z), { color: e.big ? 0xff6a3d : 0xa78bfa, count: 3, speed: 2, life: 0.8, size: 0.3, grav: -2 });
          if (e.t > 0.7) { m.g.removeFromParent(); e.gone = true; }
          break;
        }
      }
      const z = e.zone; e.pos.x = Math.max(z.x0, Math.min(z.x1, e.pos.x)); e.pos.z = Math.max(z.z0, Math.min(z.z1, e.pos.z));
      // separation
      for (const o of this.list) { if (o === e || !o.alive || o.st === 'sleep' || o.st === 'dragged' || e.st === 'dragged' || o.st === 'held' || e.st === 'held') continue; const sx = e.pos.x - o.pos.x, sz = e.pos.z - o.pos.z, sd = Math.hypot(sx, sz), md = (e.boss || o.boss) ? 4 : (e.big || o.big) ? 2 : 1.2; if (sd < md && sd > 1e-3) { e.pos.x += (sx / sd) * (md - sd) * 0.5; e.pos.z += (sz / sd) * (md - sd) * 0.5; } }
      const pr = e.boss ? 2.4 : e.m.human ? 0.52 : 0.75; if (e.alive && e.st !== 'sleep' && e.st !== 'dragged' && e.st !== 'held' && d < pr && Math.abs(dy) < 1.5) { if (e.boss) { pl.pos.x += (dx / (d || 1)) * (pr - d); pl.pos.z += (dz / (d || 1)) * (pr - d); } else { e.pos.x -= (dx / (d || 1)) * (pr - d); e.pos.z -= (dz / (d || 1)) * (pr - d); } }
      // visuals
      m.g.rotation.y = e.yaw;
      if (e.st !== 'dying' && e.st !== 'rise') m.inner.position.y = Math.sin(e.t * 3 + e.def.x) * 0.06;
      const lying = e.st === 'sleep' || e.st === 'dragged';
      if (m.icons) { m.icons.ex.visible = e.st === 'radio' || (e.alert && e.t % 1 < 0.5 && this.g.level.phase === 'alert'); m.icons.qu.visible = e.st === 'inv' || (!e.alert && e.sus > 0.25 && e.st !== 'radio' && !lying); m.icons.zz.visible = e.st === 'sleep'; m.icons.zz.position.y = 1.2 + Math.sin(e.t * 2) * 0.1; }
      const [aL, aR] = m.arms, tw = e.t;
      let armX = 0.2 + Math.sin(tw * 2) * 0.1, lean = 0;
      if (anim === 'walk') { armX = Math.sin(tw * 8) * 0.5; lean = 0.25; }
      if (anim === 'windup') { armX = -2.4; lean = -0.25; }
      if (anim === 'strike') { armX = 1.2; lean = 0.45; }
      if (anim === 'stagger') { armX = -0.6; lean = -0.45; }
      aL.rotation.x += (armX * (anim === 'walk' ? -1 : 1) - aL.rotation.x) * Math.min(1, dt * 18);
      aR.rotation.x += (armX - aR.rotation.x) * Math.min(1, dt * 18);
      if (lying) { lean = -1.45; m.inner.position.y = 0.28; armX = -2.6; } if (e.st === 'radio') { aL.rotation.x = -2.2; } if (e.st === 'drowsy') { lean = -0.5 + Math.sin(e.t * 6) * 0.25; }
      m.inner.rotation.x += (lean - m.inner.rotation.x) * Math.min(1, dt * (lying ? 6 : 12));
      const flare = e.st === 'windup' ? 1.6 + Math.sin(e.t * 40) * 0.4 : 0.6;
      m.eyes.forEach((s) => s.scale.setScalar(flare));
      if (m.cone) { m.cone.visible = e.alive && !e.alert && !lying && e.st !== 'drowsy'; m.cone.material.color.setRGB(1, 0.88 - e.sus * 0.7, 0.54 - e.sus * 0.5); m.cone.material.opacity = 0.045 + e.sus * 0.1; }
      if (m.human) { m.inner.rotation.x = 0; m.inner.position.y = 0; this.humanPose(e, anim, dt); }
      e.flash = Math.max(0, e.flash - dt); if (m.human) { m.bodyM.emissive.setHex(e.flash > 0 ? 0x777777 : 0x000000); m.bodyM.emissiveIntensity = 1; } else m.bodyM.emissive.setHex(e.flash > 0 ? 0xffffff : e.big ? 0x6b0f0f : 0x3b0d66); m.bodyM.emissiveIntensity = e.flash > 0 ? 1.2 : e.st === 'windup' ? 1.0 : 0.55;
    }
    this.list = this.list.filter((e) => !e.gone);
    this.updateShots(dt, pl);
    // heart pickups
    for (const p of this.pickups) {
      p.t += dt; p.s.position.y = p.y + 0.6 + Math.sin(p.t * 3) * 0.12; p.s.rotation.y += dt * 2;
      if (!p.taken && Math.hypot(pl.pos.x - p.s.position.x, pl.pos.z - p.s.position.z) < 1.1 && Math.abs(pl.pos.y + 0.8 - p.s.position.y) < 1.4 && pl.hp < pl.maxHp) { p.taken = true; p.s.removeFromParent(); pl.hp = Math.min(pl.maxHp, pl.hp + 1); this.g.sfx.heart(); this.g.hud(); }
      if (p.t > 25) { p.taken = true; p.s.removeFromParent(); }
    }
    this.pickups = this.pickups.filter((p) => !p.taken);
  }
  fire(e, pl, spread = 0, color = 0x22d3ee) {
    const h = e.boss ? 3.5 : 1.3, from = e.pos.clone().add(new V(Math.sin(e.yaw) * 0.6, h, Math.cos(e.yaw) * 0.6)), to = pl.pos.clone().add(new V(0, 1.1, 0));
    const vel = to.sub(from).normalize().applyAxisAngle(new V(0, 1, 0), spread).multiplyScalar(e.boss ? 11 : e.ship ? 15 : 9.5);
    if (e.ship) color = 0xfff2a8;
    const m = new THREE.Group(); m.add(glowSprite(color, e.boss ? 1.8 : 1.1, 1)); m.add(glowSprite(0xffffff, 0.4, 1)); m.position.copy(from); this.g.scene.add(m);
    this.shots.push({ m, vel, life: 3.5, mine: false });
  }
  alarm(e) {
    if (e.alert) return; e.alert = true; e.sus = 1; e.st = 'idle'; e.cd = 0.6;
    this.g.onAlarm && this.g.onAlarm(e);
    for (const o of this.list) if (o.guard && !o.alert && o.alive && o.pos.distanceTo(e.pos) < 14) { o.alert = true; o.sus = 1; }
  }
  sees(e, pl, d, dy, dx, dz) {
    const hidden = this.g.playerHidden && this.g.playerHidden();
    if (hidden === 'locker') return 0;
    // متنكّر بزي حارس: من بعيد ما يشكّون — قريب منهم يتمعّنون فيك شوي شوي، والركض/الضرب/السحب يفضحك
    // وقت الموجة الكبيرة: حراس السطح المكشوف متمسكين بالحديد — ما يشوفون شي
    if (e.ship && this.g.level.waveHit > 0 && e.pos.y > -0.6 && e.pos.y < 1.6 && !(e.pos.z > 117 && e.pos.z < 157 && Math.abs(e.pos.x) < 9)) return 0;
    if (pl.state === 'hang' && pl.hang && pl.hang.b.hull && d > 1.4) return 0; // متعلّق برّا السفينة
    const dis = this.g.disguised && this.g.disguised();
    if (dis && !dis.reveal && !e.captain) { if (d > 3.4 || Math.abs(dy) > 2.5) return 0; if ((dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / (d || 1) < 0.5) return 0; return 0.16; }
    const hug = pl.state === 'hug' && pl.hug, flat = hug && !pl.hug.peek && pl.hug.still > 0.3;
    const range = hidden ? 2.4 : (e.captain ? 19 : e.ship ? 11 : 9) * (flat ? 0.6 : hug ? 0.8 : 1); // ملزوق بالجدار وساكن = أصعب تنشاف
    if (d < 1.3 && Math.abs(dy) < 1.6) return 2;
    if (d > range || Math.abs(dy) > 3.5) return 0;
    if ((dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / (d || 1) < 0.8) return 0;
    const a = e.pos.clone().add(new V(0, 1.6, 0)), b = pl.pos.clone().add(new V(0, 1.1, 0)), n = Math.ceil(a.distanceTo(b) / 0.5), BX = this.g.level.segBoxes(a, b);
    for (let i = 1; i < n; i++) { const p = a.clone().lerp(b, i / n); for (const x of BX) if (x.active && p.x > x.min.x && p.x < x.max.x && p.y > x.min.y && p.y < x.max.y && p.z > x.min.z && p.z < x.max.z) return 0; }
    return 1 + (9 - d) / 9;
  }
  patrol(e, dt, pl, d, dy, dx, dz) {
    const path = e.def.path || [[e.def.x, e.def.z]]; let anim = 'idle';
    if (e.wait > 0) { e.wait -= dt; e.yaw += Math.sin(e.t * 1.7) * dt * 1.2; }
    else {
      const [tx, tz] = path[e.pi % path.length], vx = tx - e.pos.x, vz = tz - e.pos.z, l = Math.hypot(vx, vz);
      if (l < 0.3) { e.pi++; e.wait = 1.1; } else { e.pos.x += (vx / l) * 1.8 * dt; e.pos.z += (vz / l) * 1.8 * dt; e.yaw += angDiff(e.yaw, Math.atan2(vx, vz)) * Math.min(1, dt * 5); anim = 'walk'; }
    }
    const s = pl.hp > 0 ? this.sees(e, pl, d, dy, dx, dz) : 0;
    if (s) { e.sus += dt * 1.6 * s; e.yaw += angDiff(e.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 2 * e.sus); e.wait = Math.max(e.wait, 0.3); }
    else e.sus = Math.max(0, e.sus - dt * 0.5);
    if (e.sus >= 1) { if (e.ship) { e.st = 'radio'; e.radioT = 1.5; e.t = 0; this.g.sfx.tone(980, 980, 0.18, 'square', 0.12); this.g.onSpotted && this.g.onSpotted(e); } else this.alarm(e); }
    if (e.ship && e.st !== 'radio') this.lookForBodies(e);
    return anim;
  }
  /* ---------- tanker-style stealth (ship world): sleep darts, radio calls, noise, bodies ---------- */
  tranq(e, head) {
    if (!e.alive || e.st === 'sleep' || e.st === 'dragged' || e.st === 'held' || e.st === 'dying') return false;
    if (e.captain) {
      e.capHp -= head ? 2 : 1; e.flash = 0.25; this.g.fx.emit(e.pos.clone().add(new V(0, head ? 1.9 : 1.2, 0)), { color: 0x93c5fd, count: 16, speed: 3, life: 0.5, size: 0.25 });
      if (e.capHp <= 0) { this.sleep(e); e.sleepT = 1e9; this.g.onCaptainDown && this.g.onCaptainDown(e, 'sleep'); }
      else { e.st = 'drowsy'; e.drowsyT = 0.9; e.t = 0; this.g.say && this.g.say(head ? `🎯 رأس! القائد يترنّح — باقي ${e.capHp}` : `💉 أصبته — باقي ${e.capHp} (الرأس يحسب ٢)`); }
      return true;
    }
    if (head || e.st === 'drowsy') this.sleep(e); else { e.st = 'drowsy'; e.drowsyT = 2.4; e.t = 0; }
    this.g.fx.emit(e.pos.clone().add(new V(0, head ? 1.7 : 1.1, 0)), { color: 0x93c5fd, count: 12, speed: 3, life: 0.4, size: 0.2 });
    return true;
  }
  sleep(e, quiet) {
    e.st = 'sleep'; e.sleepT = 60; e.alert = false; e.sus = 0; e.discovered = false; e.t = 0; e.kb.set(0, 0, 0);
    if (!quiet) this.g.sfx.tone(420, 160, 0.5, 'sine', 0.1);
    this.g.onGuardSlept && this.g.onGuardSlept(e);
  }
  noise(pos, r) {
    let first = null; for (const e of this.list) if (e.ship && e.alive && !e.alert && (e.st === 'idle' || e.st === 'chase' || e.st === 'inv') && e.pos.distanceTo(pos) < r) { if (e.st !== 'inv' && !first) first = e; e.st = 'inv'; e.invPos = pos.clone(); e.invT = 0; }
    if (first && this.g.onHeard) this.g.onHeard(first);
  }
  lookForBodies(e) {
    for (const o of this.list) {
      if (o === e || !o.alive || o.hidden || o.discovered || (o.st !== 'sleep' && o.st !== 'dragged')) continue;
      const dx = o.pos.x - e.pos.x, dz = o.pos.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d > 9 || Math.abs(o.pos.y - e.pos.y) > 2.5 || (dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / (d || 1) < 0.75) continue;
      o.discovered = true; o.sleepT = Math.min(o.sleepT, 4); e.st = 'inv'; e.invPos = o.pos.clone(); e.invT = 0;
      this.g.onBodyFound && this.g.onBodyFound(e, o); return;
    }
  }
  anySees(pl) {
    const chest = pl.pos.clone().add(new V(0, 1.1, 0));
    if (this.g.playerHidden && this.g.playerHidden() === 'locker') return false;
    for (const e of this.list) {
      if (!e.ship || !e.alive || !e.alert || e.st === 'sleep' || e.st === 'drowsy' || e.st === 'dragged') continue;
      const d = e.pos.distanceTo(pl.pos); if (d > 16) continue;
      const a = e.pos.clone().add(new V(0, 1.6, 0)), n = Math.ceil(a.distanceTo(chest) / 0.5), BX = this.g.level.segBoxes(a, chest); let blocked = false;
      for (let i = 1; i < n && !blocked; i++) { const p = a.clone().lerp(chest, i / n); for (const x of BX) if (x.active && p.x > x.min.x && p.x < x.max.x && p.y > x.min.y && p.y < x.max.y && p.z > x.min.z && p.z < x.max.z) { blocked = true; break; } }
      if (!blocked) return true;
    }
    return false;
  }
  shipThink(e, dt, pl, d, dy, dx, dz, toYaw) {
    const phase = this.g.level.phase || 'normal';
    if (e.st === 'dragged' || e.st === 'held') return 'idle';
    if (e.captain) return this.captainThink(e, dt, pl, d, dy, dx, dz, toYaw);
    if (this.g.level.waveHit > 0 && e.pos.y > -0.6 && e.pos.y < 1.6 && !['sleep', 'thrown'].includes(e.st) && !(e.pos.z > 117 && e.pos.z < 157 && Math.abs(e.pos.x) < 9)) return 'idle'; // متمسك بالحديد
    if (e.st === 'sleep') { e.sleepT -= dt; if (Math.random() < dt * 0.8) this.g.fx.emit(e.pos.clone().add(new V(0, 0.8, 0)), { color: 0xbfdbfe, count: 1, speed: 0.4, up: 1, life: 1.4, size: 0.18, grav: -0.6 });
      if (e.sleepT <= 0 && !e.hidden) { e.st = 'idle'; e.sus = 0; e.wait = 1.5; this.g.onGuardWoke && this.g.onGuardWoke(e); } return 'idle'; }
    if (e.st === 'drowsy') { e.drowsyT -= dt; e.yaw += Math.sin(e.t * 5) * dt; if (e.drowsyT <= 0) this.sleep(e); return 'stagger'; }
    if (e.st === 'radio') { e.radioT -= dt; e.yaw += angDiff(e.yaw, toYaw) * Math.min(1, dt * 4); if (e.radioT <= 0) { e.st = 'idle'; e.alert = true; e.cd = 0.5; this.g.onRadio && this.g.onRadio(e); } return 'windup'; }
    if (!e.alert && phase === 'alert') { e.alert = true; e.cd = 1; }
    if (e.alert && phase !== 'alert') {
      // search the last place the player was seen
      // 🔎 بحث واقعي: كل حارس ياخذ نقطة مختلفة حول آخر مكان شافوك فيه، يمشي لها بسرعته، يوقف ويتلفّت، ثم نقطة ثانية
      const lp = this.g.level.lastSeen || e.pos, idx = this.list.indexOf(e);
      if (!e.sp || e.spSrc !== lp || e.spT <= 0) {
        const first = e.spSrc !== lp, a = first ? idx * 2.399 + Math.random() * 0.6 : Math.random() * Math.PI * 2, r = first ? 1.2 + (idx % 4) * 1.3 : 2 + Math.random() * 4.5;
        e.sp = { x: lp.x + Math.sin(a) * r, z: lp.z + Math.cos(a) * r }; e.spSrc = lp; e.spT = 3 + Math.random() * 3; e.lookA = e.yaw; e.spd = 1.9 + (idx % 5) * 0.2;
        if (idx % 4 === 3 && first) { e.sp = { x: e.pos.x, z: e.pos.z }; e.spT = 6; } // واحد يبقى بمكانه ويراقب
      }
      const vx = e.sp.x - e.pos.x, vz = e.sp.z - e.pos.z, l = Math.hypot(vx, vz);
      if (l > 0.6) { e.pos.x += (vx / l) * e.spd * dt; e.pos.z += (vz / l) * e.spd * dt; e.yaw += angDiff(e.yaw, Math.atan2(vx, vz)) * Math.min(1, dt * 4); }
      else { e.spT -= dt; const tgt = e.lookA + Math.sin(e.t * 0.9 + idx) * 1.2; e.yaw += angDiff(e.yaw, tgt) * Math.min(1, dt * 2.2); } // يتلفّت يمين ويسار
      if (l > 0.6 && e.stuck !== undefined) { const moved = Math.hypot(e.pos.x - e.stuck.x, e.pos.z - e.stuck.z); if (moved < 0.01) e.spT = 0; }
      e.stuck = { x: e.pos.x, z: e.pos.z };
      if (phase === 'normal') { e.alert = false; e.sus = 0; e.wait = 1; }
      else if (this.sees(e, pl, d, dy, dx, dz)) this.g.onSpotted && this.g.onSpotted(e, true);
      return l > 0.6 ? 'walk' : 'idle';
    }
    if (e.st === 'inv' && !e.alert) {
      const vx = e.invPos.x - e.pos.x, vz = e.invPos.z - e.pos.z, l = Math.hypot(vx, vz); let anim = 'idle';
      if (l > 1) { e.pos.x += (vx / l) * 2.2 * dt; e.pos.z += (vz / l) * 2.2 * dt; e.yaw += angDiff(e.yaw, Math.atan2(vx, vz)) * Math.min(1, dt * 5); anim = 'walk'; }
      else { e.invT += dt; e.yaw += Math.sin(e.t * 1.3) * dt * 2; if (e.invT > 3.5) { e.st = 'idle'; e.wait = 0.5; } }
      const s2 = this.sees(e, pl, d, dy, dx, dz); if (s2) { e.sus += dt * 2 * s2; if (e.sus >= 1) { e.st = 'radio'; e.radioT = 1.3; this.g.onSpotted && this.g.onSpotted(e); } }
      this.lookForBodies(e);
      return anim;
    }
    return null;
  }
  humanPose(e, anim, dt) {
    const h = e.m.h, P = { ...BASE }, t = e.t, walking = anim === 'walk';
    e.m.ph += dt * (walking ? (e.alert ? 9 : 6.5) : 0);
    Object.assign(P, { shRx: 0.95, elR: 1.25, shRz: 0.1, shLx: 1.0, shLz: -0.25, elL: 1.45, spineX: 0.06, chestX: Math.sin(t * 1.8) * 0.02 });
    if (walking) { const ph = e.m.ph, A = e.alert ? 0.85 : 0.6; P.thLx = Math.sin(ph) * A; P.thRx = -Math.sin(ph) * A; P.knL = 0.15 + A * 1.1 * Math.max(0, Math.cos(ph)); P.knR = 0.15 + A * 1.1 * Math.max(0, -Math.cos(ph)); P.hipY = Math.abs(Math.cos(ph)) * 0.04 - 0.02; P.spineX = e.alert ? 0.2 : 0.06; }
    if ((anim === 'windup' && e.st !== 'radio') || (e.alert && !walking)) { P.shRx = 1.45; P.elR = 0.25; P.shLx = 1.55; P.elL = 0.35; P.shLz = -0.1; P.headX = 0.05; P.knL = P.knR = 0.25; }
    if (e.st === 'inv' && !walking) { P.headY = Math.sin(t * 1.3) * 0.6; }
    if (e.st === 'radio') { P.shLx = 2.5; P.shLz = 0.35; P.elL = 2.5; P.headY = 0.2; }
    if (anim === 'stagger' || e.st === 'drowsy') { P.spineX = -0.25 + Math.sin(t * 6) * 0.15; P.knL = P.knR = 0.6; P.headX = 0.4; P.shRx = 0.2; P.shLx = 0.2; P.elR = P.elL = 0.4; }
    if (e.ship && this.g.level.waveHit > 0 && e.alive && !['sleep', 'dragged', 'held', 'thrown'].includes(e.st) && e.pos.y > -0.6 && e.pos.y < 1.6) { P.knL = P.knR = 0.9; P.hipY = -0.25; P.spineX = 0.5; P.shLx = P.shRx = 1.2; P.elL = P.elR = 0.6; P.shLz = P.shRz = 0.6; }
    else if (e.st === 'held') { const sq = Math.sin(e.t * 18) * 0.25 * (1 - (e.choke || 0)); P.headX = -0.5; P.spineX = -0.2; P.shLx = 2.2 + sq; P.shRx = 2.0 - sq; P.elL = P.elR = 1.6; P.shLz = P.shRz = 0.3; P.knL = 0.3 + (e.choke || 0) * 0.6; P.knR = 0.2 + (e.choke || 0) * 0.6; P.thLx = 0.2 + sq * 0.5; }
    else if (e.st === 'thrown') { P.shLz = P.shRz = 2.2; P.thLx = 0.8; P.thRx = -0.6; P.knL = P.knR = 0.4; P.spineX = -0.4; }
    else if (e.st === 'sleep' || e.st === 'dragged') { P.rootPitch = -1.5; P.hipY = -0.42; P.shLz = 1.1; P.shRz = 1.1; P.shLx = P.shRx = 0.3; P.elL = P.elR = 0.3; P.knL = 0.3; P.knR = 0.1; P.headY = 0.4; }
    if (e.hitT > 0 && e.st !== 'sleep' && e.st !== 'held') { e.hitT -= dt; const k = e.hitT / 0.32, back = Math.cos(angDiff(e.yaw, e.hitYaw)); // ضربة من قدّام = الراس يرجع لورا
      P.headX = -0.75 * k * back; P.spineX = -0.35 * k * back; P.headY = 0.5 * k * Math.sin(angDiff(e.yaw, e.hitYaw)); P.knL = P.knR = 0.35 * k; P.shLx = P.shRx = 0.3; }
    blendPose(h, P, dt, e.hitT > 0 ? 30 : e.st === 'sleep' ? 5 : 12);
  }
  /* ⚓ القائد «عاصفة»: يصطادك على مهبط المقدمة — يطلق ٣ طلقات ثم يعبّي (فرصتك) — ما ينخنق، بس ينرمى في البحر أو ينام بالمهدّئ */
  captainThink(e, dt, pl, d, dy, dx, dz, toYaw) {
    const z = e.zone, L = this.g.level;
    if (e.st === 'drowsy') { e.drowsyT -= dt; e.yaw += Math.sin(e.t * 6) * dt; if (e.drowsyT <= 0) { e.st = 'idle'; } return 'stagger'; }
    if (L.waveHit > 0) return 'idle';
    e.alert = true; e.cd -= dt;
    if (e.reloadT > 0) { e.reloadT -= dt; if (e.reloadT <= 0) { e.ammo = 3; this.g.say && this.g.say('⚓ القائد خلّص تعبئة!'); } }
    const s = pl.hp > 0 ? this.sees(e, pl, d, dy, dx, dz) : 0;
    if (s) { e.lastP = pl.pos.clone(); e.yaw += angDiff(e.yaw, toYaw) * Math.min(1, dt * 6); }
    let anim = 'idle';
    // يحافظ على مسافة ٧-١٠م، ولو ما يشوفك يمشي لآخر مكان شافك فيه
    const tgt = e.lastP || new V((z.x0 + z.x1) / 2, e.pos.y, (z.z0 + z.z1) / 2), vx = tgt.x - e.pos.x, vz = tgt.z - e.pos.z, l = Math.hypot(vx, vz);
    const want = s ? (d < 6 ? -1 : d > 10 ? 1 : 0) : (l > 1.5 ? 1 : 0), sp = e.reloadT > 0 ? 1.4 : 2.6;
    if (want && l > 0.01) { const sx = s ? dx / (d || 1) : vx / l, sz = s ? dz / (d || 1) : vz / l; e.pos.x += sx * sp * want * dt; e.pos.z += sz * sp * want * dt; anim = 'walk'; if (!s) e.yaw += angDiff(e.yaw, Math.atan2(vx, vz)) * Math.min(1, dt * 4); }
    else if (!s) e.yaw += dt * 1.1;
    e.pos.x = Math.max(z.x0, Math.min(z.x1, e.pos.x)); e.pos.z = Math.max(z.z0, Math.min(z.z1, e.pos.z));
    if (s && e.reloadT <= 0 && e.cd <= 0) {
      e.cd = 0.85; e.ammo--; this.fire(e, pl, (Math.random() - 0.5) * 0.08, 0xffd166); this.g.sfx.tone(160, 70, 0.12, 'square', 0.12);
      if (e.ammo <= 0) { e.reloadT = 2.8; this.g.say && this.g.say('🔄 القائد يعبّي سلاحه! هذي فرصتك — صوّب على راسه أو امسكه من الخلف'); }
      anim = 'windup';
    }
    return anim;
  }
  bossThink(e, dt, pl, d, dx, dz, toYaw) {
    const phase = e.hp > 26 ? 1 : e.hp > 13 ? 2 : 3; let anim = 'idle';
    if (phase !== e.phase) { e.phase = phase; if (phase > 1) { this.g.onBossPhase && this.g.onBossPhase(phase); e.cd = 1.2; } }
    e.yaw += angDiff(e.yaw, toYaw) * Math.min(1, dt * 2.5);
    if (d > 4) { const sp = e.speed * (phase === 3 ? 1.3 : 1); e.pos.x += (dx / d) * sp * dt; e.pos.z += (dz / d) * sp * dt; anim = 'walk'; }
    if (phase === 3) { e.summonT -= dt; if (e.summonT <= 0) { e.summonT = 13; for (const k of [-1, 1]) this.spawn({ x: e.pos.x + k * 4, y: e.def.y, z: e.pos.z + 2, zone: e.zone, group: e.group }, true); } }
    if (e.cd <= 0) {
      if (d < 5.5) { e.st = 'windup'; e.t = 0; this.g.sfx.enemyAtk(); }
      else if (phase >= 2 && d < 20) { e.volley = true; e.st = 'windup'; e.t = 0.3; this.g.sfx.enemyAtk(); }
    }
    return anim;
  }
  updateShots(dt, pl) {
    const chest = pl.pos.clone().add(new V(0, 1.1, 0));
    for (const b of this.shots) {
      b.life -= dt; b.m.position.addScaledVector(b.vel, dt);
      if (Math.random() < 0.5) this.g.fx.emit(b.m.position, { color: b.mine ? 0xffd166 : 0x22d3ee, count: 1, speed: 0.4, life: 0.3, size: 0.2, grav: 0 });
      const p = b.m.position;
      if (!b.mine) {
        if ((pl.state === 'attack' || pl.state === 'slam') && p.distanceTo(chest) < 2.1) {
          const tgt = this.list.filter((e) => e.alive && (e.archer || e.boss)).sort((a, c) => a.pos.distanceTo(p) - c.pos.distanceTo(p))[0];
          b.vel = tgt ? tgt.pos.clone().add(new V(0, 1.1, 0)).sub(p).normalize().multiplyScalar(15) : b.vel.multiplyScalar(-1.5);
          b.mine = true; b.life = 2; this.g.sfx.hit(); this.g.hitstop(0.05); this.g.fx.emit(p, { color: 0xffd166, count: 16, speed: 5, life: 0.3 }); continue;
        }
        if (p.distanceTo(chest) < 0.6) { pl.damage(1, p); b.life = 0; }
      } else for (const e of this.list) if (e.alive && e.pos.clone().add(new V(0, e.boss ? 3 : 1.1, 0)).distanceTo(p) < (e.boss ? 2.6 : 1.0)) { this.hurt(e, 2, p, 5); b.life = 0; break; }
      for (const x of this.g.level.nearR(p.x, p.z, 1)) if (x.active && p.x > x.min.x && p.x < x.max.x && p.y > x.min.y && p.y < x.max.y && p.z > x.min.z && p.z < x.max.z) { b.life = 0; break; }
      if (b.life <= 0) { this.g.fx.emit(p, { color: 0x22d3ee, count: 10, speed: 3, life: 0.3 }); b.m.removeFromParent(); }
    }
    this.shots = this.shots.filter((b) => b.life > 0);
  }
  dropHeart(at) {
    const s = new THREE.Group(), mm = new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xff1f4b, emissiveIntensity: 0.9, roughness: 0.3 });
    const sh = new THREE.Shape(); sh.moveTo(0, -0.25); sh.bezierCurveTo(-0.35, 0, -0.3, 0.28, 0, 0.12); sh.bezierCurveTo(0.3, 0.28, 0.35, 0, 0, -0.25);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), mm); m.position.z = -0.05; s.add(m);
    s.add(glowSprite(0xff4d6d, 1.3, 0.6)); s.position.set(at.x, at.y + 0.6, at.z); this.g.scene.add(s);
    this.pickups.push({ s, y: at.y, t: 0, taken: false });
  }
}
