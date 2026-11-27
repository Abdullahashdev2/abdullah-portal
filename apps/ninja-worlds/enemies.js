// Shadow creatures: telegraphed attacks (eyes flare + raised claws), stagger, knockback, dissolve on death
import * as THREE from 'three';
import { glowSprite } from './fx.js';
const V = THREE.Vector3;
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

function buildShade(big, archer) {
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
  if (big) g.scale.setScalar(1.55);
  if (archer) { bodyM.color.setHex(0x0f2a2e); bodyM.emissive.setHex(0x0e7490); const orb = glowSprite(0x22d3ee, 0.9, 0.9); orb.position.set(0.55, 0.62, 0.3); inner.add(orb); }
  return { g, inner, body, head, arms, eyes, bodyM, aura };
}

export class Enemies {
  constructor(game) { this.g = game; this.list = []; this.pickups = []; this.shots = []; }
  clear() { for (const e of this.list) e.m.g.removeFromParent(); for (const p of this.pickups) p.s.removeFromParent(); for (const b of this.shots) b.m.removeFromParent(); this.list = []; this.pickups = []; this.shots = []; }
  spawn(def, rise = false) {
    const big = def.type === 'brute', archer = def.type === 'archer', m = buildShade(big, archer);
    m.g.position.set(def.x, def.y, def.z); this.g.scene.add(m.g);
    const zone = def.zone || { x0: def.x - 5, x1: def.x + 5, z0: def.z - 5, z1: def.z + 5 };
    const e = { def, m, big, pos: m.g.position, yaw: Math.PI, hp: big ? 9 : 3, maxHp: big ? 9 : 3, st: rise ? 'rise' : 'idle', t: 0, kb: new V(), flash: 0, zone, group: def.group || null, reach: big ? 2.7 : 1.9, speed: big ? 3.0 : 3.9, alive: true, cd: Math.random() + (archer ? 1 : 0), archer };
    if (archer) { e.hp = e.maxHp = 2; e.speed = 2.6; }
    if (rise) { m.inner.position.y = -2.2; this.g.fx.emit(new V(def.x, def.y + 0.3, def.z), { color: 0x8b5cf6, count: 40, speed: 4, up: 1, life: 0.9, size: 0.4, grav: -1 }); }
    this.list.push(e); return e;
  }
  alive(group) { return this.list.filter((e) => e.alive && (!group || e.group === group)).length; }
  nearest(p, maxD) { let best = null, bd = maxD; for (const e of this.list) { if (!e.alive || e.st === 'rise') continue; const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z); if (d < bd && Math.abs(e.pos.y - p.y) < 2.5) { bd = d; best = e; } } return best; }
  hurt(e, dmg, from, knock) {
    if (!e.alive || e.st === 'rise' || e.st === 'dying') return false;
    e.hp -= dmg; e.flash = 0.18;
    const dx = e.pos.x - from.x, dz = e.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
    e.kb.set((dx / l) * knock / (e.big ? 2.2 : 1), 0, (dz / l) * knock / (e.big ? 2.2 : 1));
    const hitP = e.pos.clone(); hitP.y += e.big ? 1.6 : 1.1;
    this.g.fx.emit(hitP, { color: 0xffffff, count: 14, speed: 7, life: 0.25, size: 0.18, grav: 4 });
    this.g.fx.emit(hitP, { color: e.big ? 0xff6a3d : 0xc084fc, count: 18, speed: 4, life: 0.5, size: 0.3, grav: 2 });
    if (e.hp <= 0) { e.st = 'dying'; e.t = 0; e.alive = false; this.g.sfx.enemyDie(); this.g.onEnemyKilled(e); }
    else if (!e.big || dmg >= 2) { e.st = 'stagger'; e.t = 0; }
    return true;
  }
  hitArc(p, yaw, range, cosMin, dmg, knock) {
    let n = 0; const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const e of this.list) {
      if (!e.alive) continue; const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz), rr = range + (e.big ? 0.6 : 0);
      if (d > rr || Math.abs(e.pos.y - p.y) > 2) continue;
      if (d > 0.6 && (dx * fx + dz * fz) / d < cosMin) continue;
      if (this.hurt(e, dmg, p, knock)) n++;
    }
    return n;
  }
  hitRadius(p, r, dmg, knock) { let n = 0; for (const e of this.list) { if (!e.alive) continue; if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < r + (e.big ? 0.6 : 0) && Math.abs(e.pos.y - p.y) < 2) if (this.hurt(e, dmg, p, knock)) n++; } return n; }
  update(dt, pl) {
    const attackers = this.list.filter((e) => e.st === 'windup' || e.st === 'strike').length;
    for (const e of this.list) {
      e.t += dt; e.cd -= dt;
      const m = e.m, dx = pl.pos.x - e.pos.x, dz = pl.pos.z - e.pos.z, d = Math.hypot(dx, dz), dy = pl.pos.y - e.pos.y;
      const seen = d < 15 && Math.abs(dy) < 2.6 && pl.hp > 0, toYaw = Math.atan2(dx, dz);
      // knockback + zone clamp
      e.pos.x += e.kb.x * dt; e.pos.z += e.kb.z * dt; e.kb.multiplyScalar(Math.exp(-7 * dt));
      let anim = 'idle';
      switch (e.st) {
        case 'rise': m.inner.position.y = Math.min(0, -2.2 + e.t * 2.6); if (e.t > 0.9) { e.st = 'idle'; m.inner.position.y = 0; } break;
        case 'idle': case 'chase':
          if (seen && e.archer) {
            e.yaw += angDiff(e.yaw, toYaw) * Math.min(1, dt * 6);
            if (d < 5.5) { e.pos.x -= (dx / d) * e.speed * dt; e.pos.z -= (dz / d) * e.speed * dt; anim = 'walk'; }
            else if (d > 12) { e.pos.x += (dx / d) * e.speed * dt; e.pos.z += (dz / d) * e.speed * dt; anim = 'walk'; }
            if (e.cd <= 0 && d < 16) { e.st = 'windup'; e.t = 0; this.g.sfx.enemyAtk(); }
          } else if (seen) {
            e.yaw += angDiff(e.yaw, toYaw) * Math.min(1, dt * 6);
            if (d > e.reach * 0.85) { const sp = e.speed * (d > 6 ? 1 : 0.85); e.pos.x += (dx / d) * sp * dt; e.pos.z += (dz / d) * sp * dt; anim = 'walk'; }
            else if (e.cd <= 0 && attackers < 2 && Math.abs(dy) < 1.6) { e.st = 'windup'; e.t = 0; this.g.sfx.enemyAtk(); }
          } else { e.yaw += Math.sin(e.t * 0.5) * dt * 0.3; }
          break;
        case 'windup': e.yaw += angDiff(e.yaw, toYaw) * Math.min(1, dt * 3); if (e.t > (e.big ? 0.75 : 0.55)) { e.st = 'strike'; e.t = 0; e.hit = false; } anim = 'windup'; break;
        case 'strike': {
          anim = 'strike';
          if (!e.big && !e.archer) { e.pos.x += Math.sin(e.yaw) * 6 * dt * (e.t < 0.12 ? 1 : 0); e.pos.z += Math.cos(e.yaw) * 6 * dt * (e.t < 0.12 ? 1 : 0); }
          if (!e.hit && e.t > 0.08 && e.archer) { e.hit = true; this.fire(e, pl); }
          else if (!e.hit && e.t > 0.08) {
            e.hit = true;
            const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), inFront = d < 0.5 || (dx * fx + dz * fz) / d > 0.35;
            if (e.big) { const c = e.pos.clone(); c.x += fx * 1.4; c.z += fz * 1.4; this.g.fx.emit(c, { color: 0xff7b3d, count: 40, speed: 6, flat: true, life: 0.5, size: 0.35, grav: 1 }); this.g.shake(0.25); this.g.sfx.slam(); if (Math.hypot(pl.pos.x - c.x, pl.pos.z - c.z) < 2.6 && Math.abs(dy) < 1.2) pl.damage(2, e.pos); }
            else if (d < e.reach + 0.3 && inFront && Math.abs(dy) < 1.4) pl.damage(1, e.pos);
          }
          if (e.t > 0.25) { e.st = 'recover'; e.t = 0; }
          break;
        }
        case 'recover': anim = 'idle'; if (e.t > (e.big ? 1.0 : 0.75)) { e.st = 'idle'; e.cd = e.archer ? 1.6 + Math.random() : 0.4 + Math.random() * 0.8; } break;
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
      for (const o of this.list) { if (o === e || !o.alive) continue; const sx = e.pos.x - o.pos.x, sz = e.pos.z - o.pos.z, sd = Math.hypot(sx, sz), md = (e.big || o.big) ? 2 : 1.2; if (sd < md && sd > 1e-3) { e.pos.x += (sx / sd) * (md - sd) * 0.5; e.pos.z += (sz / sd) * (md - sd) * 0.5; } }
      if (e.alive && d < 0.75 && Math.abs(dy) < 1.5) { e.pos.x -= (dx / (d || 1)) * (0.75 - d); e.pos.z -= (dz / (d || 1)) * (0.75 - d); }
      // visuals
      m.g.rotation.y = e.yaw;
      if (e.st !== 'dying' && e.st !== 'rise') m.inner.position.y = Math.sin(e.t * 3 + e.def.x) * 0.06;
      const [aL, aR] = m.arms, tw = e.t;
      let armX = 0.2 + Math.sin(tw * 2) * 0.1, lean = 0;
      if (anim === 'walk') { armX = Math.sin(tw * 8) * 0.5; lean = 0.25; }
      if (anim === 'windup') { armX = -2.4; lean = -0.25; }
      if (anim === 'strike') { armX = 1.2; lean = 0.45; }
      if (anim === 'stagger') { armX = -0.6; lean = -0.45; }
      aL.rotation.x += (armX * (anim === 'walk' ? -1 : 1) - aL.rotation.x) * Math.min(1, dt * 18);
      aR.rotation.x += (armX - aR.rotation.x) * Math.min(1, dt * 18);
      m.inner.rotation.x += (lean - m.inner.rotation.x) * Math.min(1, dt * 12);
      const flare = e.st === 'windup' ? 1.6 + Math.sin(e.t * 40) * 0.4 : 0.6;
      m.eyes.forEach((s) => s.scale.setScalar(flare));
      e.flash = Math.max(0, e.flash - dt); m.bodyM.emissive.setHex(e.flash > 0 ? 0xffffff : e.big ? 0x6b0f0f : 0x3b0d66); m.bodyM.emissiveIntensity = e.flash > 0 ? 1.2 : e.st === 'windup' ? 1.0 : 0.55;
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
  fire(e, pl) {
    const from = e.pos.clone().add(new V(Math.sin(e.yaw) * 0.6, 1.3, Math.cos(e.yaw) * 0.6)), to = pl.pos.clone().add(new V(0, 1.1, 0));
    const vel = to.sub(from).normalize().multiplyScalar(9.5);
    const m = new THREE.Group(); m.add(glowSprite(0x22d3ee, 1.1, 1)); m.add(glowSprite(0xffffff, 0.4, 1)); m.position.copy(from); this.g.scene.add(m);
    this.shots.push({ m, vel, life: 3.5, mine: false });
  }
  updateShots(dt, pl) {
    const chest = pl.pos.clone().add(new V(0, 1.1, 0)), boxes = this.g.level.boxes;
    for (const b of this.shots) {
      b.life -= dt; b.m.position.addScaledVector(b.vel, dt);
      if (Math.random() < 0.5) this.g.fx.emit(b.m.position, { color: b.mine ? 0xffd166 : 0x22d3ee, count: 1, speed: 0.4, life: 0.3, size: 0.2, grav: 0 });
      const p = b.m.position;
      if (!b.mine) {
        if ((pl.state === 'attack' || pl.state === 'slam') && p.distanceTo(chest) < 2.1) {
          const tgt = this.list.filter((e) => e.alive && e.archer).sort((a, c) => a.pos.distanceTo(p) - c.pos.distanceTo(p))[0];
          b.vel = tgt ? tgt.pos.clone().add(new V(0, 1.1, 0)).sub(p).normalize().multiplyScalar(15) : b.vel.multiplyScalar(-1.5);
          b.mine = true; b.life = 2; this.g.sfx.hit(); this.g.hitstop(0.05); this.g.fx.emit(p, { color: 0xffd166, count: 16, speed: 5, life: 0.3 }); continue;
        }
        if (p.distanceTo(chest) < 0.6) { pl.damage(1, p); b.life = 0; }
      } else for (const e of this.list) if (e.alive && e.pos.clone().add(new V(0, 1.1, 0)).distanceTo(p) < 1.0) { this.hurt(e, 2, p, 5); b.life = 0; break; }
      for (const x of boxes) if (x.active && p.x > x.min.x && p.x < x.max.x && p.y > x.min.y && p.y < x.max.y && p.z > x.min.z && p.z < x.max.z) { b.life = 0; break; }
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
