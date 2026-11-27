import * as THREE from 'three';
import { Sky } from 'sky';
import { Particles, Sound } from './fx.js';
import { buildHero, blendPose, BASE, Scarf, Trail } from './hero.js';
import { Player } from './player.js';
import { Enemies } from './enemies.js';
import { Level, makeKit } from './kit.js';
import { WORLDS } from './worlds.js';
const V = THREE.Vector3, $ = (s) => document.querySelector(s);
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

/* ---------------- save ---------------- */
const SKEY = 'ninja_worlds_v1';
let SAVE = { done: {}, shards: [], falls: 0, best: {} };
try { Object.assign(SAVE, JSON.parse(localStorage.getItem(SKEY)) || {}); } catch (e) {}
function persist() {
  try { localStorage.setItem(SKEY, JSON.stringify(SAVE)); } catch (e) {}
  const n = SAVE.shards.length, w = Object.keys(SAVE.done).filter((k) => SAVE.done[k]).length;
  try { window.Game && Game.save('ninja-worlds', { ...SAVE, score: n, scores: { 'ninja-worlds': n }, summary: `🌍 ${w}/2 عوالم • 💎 ${n}/20` }); } catch (e) {}
}
(async () => { try { const c = window.Game && (await Game.load('ninja-worlds')); if (c && c.shards && c.shards.length > SAVE.shards.length) { SAVE = { ...SAVE, ...c }; hudUpdate(); } } catch (e) {} })();

/* ---------------- renderer / scene ---------------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const LOW = /Android|iPhone|iPad/i.test(navigator.userAgent) && Math.min(screen.width, screen.height) < 500;
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.4 : 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 6000);
const sky = new Sky(); sky.scale.setScalar(4500); scene.add(sky);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; scene.add(sun); scene.add(sun.target);
sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 140 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null;
const sunDir = new V(), lightDir = new V();
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 72 : 62; camera.updateProjectionMatrix(); sparks.mat.uniforms.scale.value = dust.mat.uniforms.scale.value = motes.mat.uniforms.scale.value = h * 0.6 * renderer.getPixelRatio(); }

const sparks = new Particles(900, true), dust = new Particles(400, false), motes = new Particles(500, true);
scene.add(sparks.points, dust.points, motes.points);
const sfx = new Sound();
addEventListener('resize', resize); resize();

/* ---------------- game object shared with modules ---------------- */
let level = null, player, enemies, hero, scarf, trail, npc = null, worldId = 'hub';
let shakeAmt = 0, stopT = 0, fading = false, startTime = 0, worldFalls = 0;
const G = {
  scene, sfx,
  get level() { return level; },
  get enemies() { return enemies; },
  fx: { emit: (p, o) => sparks.emit(p, o) },
  shake: (a) => { shakeAmt = Math.max(shakeAmt, a); if (a > 0.25 && navigator.vibrate) try { navigator.vibrate(30); } catch (e) {} },
  hitstop: (t) => { stopT = Math.max(stopT, t); },
  dust: (p, n) => dust.emit(new V(p.x, p.y + 0.1, p.z), { color: 0xd9c8aa, count: n, speed: 2.2, life: 0.6, size: 0.55, grav: -0.8, drag: 3, spread: 0.5, up: 0.4 }),
  flashHurt: () => { const f = $('#hurt'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); },
  hud: () => hudUpdate(),
  onFall: () => respawn('fall'),
  onDeath: () => respawn('death'),
  onEnemyKilled: (e) => { G.hitstop(0.08); if (Math.random() < (player.hp <= 2 ? 0.7 : 0.35)) enemies.dropHeart(e.pos); },
  dropItem: (forced) => dropItem(forced),
};
hero = buildHero('ninja'); scene.add(hero.root);
player = new Player(G, hero); enemies = new Enemies(G);
scarf = new Scarf(scene, 0xdc2626); trail = new Trail(scene, 0x9be7ff);

/* ---------------- worlds ---------------- */
function applyAtmo(c) {
  const u = sky.material.uniforms; u.turbidity.value = c.sky.turb; u.rayleigh.value = c.sky.ray; u.mieCoefficient.value = c.sky.mie; u.mieDirectionalG.value = c.sky.mieG;
  sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - c.sky.elev), THREE.MathUtils.degToRad(c.sky.azim)); u.sunPosition.value.copy(sunDir);
  lightDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(c.sky.elev, 38)), THREE.MathUtils.degToRad(c.sky.azim));
  renderer.toneMappingExposure = c.exposure; scene.fog = new THREE.FogExp2(c.fog[0], c.fog[1]);
  sun.color.set(c.sun[0]); sun.intensity = c.sun[1]; hemi.color.set(c.hemi[0]); hemi.groundColor.set(c.hemi[1]); hemi.intensity = c.hemi[2];
  const es = new THREE.Scene(), s2 = new Sky(); s2.scale.setScalar(1000); for (const k in u) if (s2.material.uniforms[k]) s2.material.uniforms[k].value = u[k].value.clone ? u[k].value.clone() : u[k].value;
  es.add(s2); if (envRT) envRT.dispose(); envRT = pmrem.fromScene(es, 0.02); scene.environment = envRT.texture; s2.geometry.dispose(); s2.material.dispose();
}
let checkpoint = null, cfg = null;
function loadWorld(id, from) {
  if (level) level.dispose(); enemies.clear(); sparks.clear(); dust.clear(); motes.clear();
  if (npc) { npc.root.removeFromParent(); npc = null; }
  level = new Level(scene); worldId = id; SAVE._from = from;
  level.say = (t) => say(t); level.sfx = (n) => sfx[n] && sfx[n](); level.shake = (a) => G.shake(a); level.spawnGroup = spawnGroup; level.spawned = {};
  const K = makeKit(level); cfg = level.cfg = WORLDS[id](K, level, SAVE);
  level.onCrumble = (b) => { sfx.crumble(); dust.emit(b.center.clone(), { color: 0xc4b5fd, count: 20, speed: 3, life: 0.8, size: 0.5, grav: 3, spread: 1.5 }); };
  for (const d of level.enemyDefs) if (!d.group) enemies.spawn(d);
  for (const it of level.items) it.origin = it.home.clone();
  applyAtmo(cfg);
  if (level.npcDef) { const d = level.npcDef; npc = buildHero('calm'); npc.root.position.set(d.x, d.y, d.z); npc.root.rotation.y = d.yaw; scene.add(npc.root); npc.line = 0; }
  checkpoint = level.checkpoints[0] ? { pos: level.checkpoints[0].pos, yaw: level.checkpoints[0].yaw } : null;
  player.spawn(cfg.spawn.pos, cfg.spawn.yaw); player.hp = player.maxHp; player.carry = null;
  if (!checkpoint) checkpoint = { pos: cfg.spawn.pos.clone(), yaw: cfg.spawn.yaw };
  cam.yaw = cfg.spawn.yaw; cam.pitch = 0.32; cam.target.copy(player.pos).add(new V(0, 1.5, 0)); cam.dist = cam.want;
  scarf.init = false; startTime = performance.now(); worldFalls = 0;
  tuneEnv(); banner(cfg.name, cfg.sub); hudUpdate();
  if (started) sfx.music(cfg.music);
}
function spawnGroup(g) { if (level.spawned[g]) return; level.spawned[g] = true; for (const d of level.enemyDefs) if (d.group === g) enemies.spawn(d, true); tuneEnv(); }
function tuneEnv() { const k = (cfg && cfg.env) ?? 0.35; scene.traverse((o) => { if (o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = k; }); }

/* ---------------- UI ---------------- */
let toastT = 0, bannerT = 0, started = false, paused = false;
function say(text) { $('#toastText').textContent = text; $('#toast').classList.add('on'); toastT = Math.min(11, 3.5 + text.length * 0.055); }
function banner(name, sub) { $('#bName').textContent = name; $('#bSub').textContent = sub || ''; const b = $('#banner'); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
function hudUpdate() {
  if (!player) return;
  $('#hearts').innerHTML = Array.from({ length: player.maxHp }, (_, i) => `<span class="${i < player.hp ? 'h on' : 'h'}">❤</span>`).join('');
  if (!cfg) return;
  if (cfg.shardTotal) { const n = SAVE.shards.filter((s) => s.startsWith(cfg.id + '-')).length; $('#shards').textContent = `💎 ${n}/${cfg.shardTotal}`; }
  else $('#shards').textContent = `💎 ${SAVE.shards.length}/20`;
  $('#wname').textContent = cfg.name;
}
function showDone() {
  const n = SAVE.shards.filter((s) => s.startsWith(cfg.id + '-')).length, sec = Math.round((performance.now() - startTime) / 1000);
  $('#doneTitle').textContent = `🏆 خلّصت «${cfg.name}»`;
  $('#doneStats').innerHTML = `<div><b>💎 ${n}/${cfg.shardTotal}</b><span>شظايا</span></div><div><b>⏱️ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</b><span>الوقت</span></div><div><b>🪂 ${worldFalls}</b><span>سقطات</span></div>`;
  $('#doneMsg').textContent = n < cfg.shardTotal ? 'باقي شظايا مخبّية — تقدر ترجع لهالعالم وتدوّرها 👀' : 'جمعت كل الشظايا! أسطورة 🌟';
  $('#done').classList.add('on'); paused = true;
}
$('#doneBtn').onclick = () => { $('#done').classList.remove('on'); paused = false; fadeTo(() => loadWorld('hub', cfg.id)); };
function fadeTo(fn) { const f = $('#fade'); f.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 80); }, 380); }
function togglePause(v) { if (!started || $('#done').classList.contains('on')) return; paused = v ?? !paused; $('#pause').classList.toggle('on', paused); $('#pHub').hidden = worldId === 'hub'; }
$('#pauseBtn').onclick = () => togglePause(true);
$('#pResume').onclick = () => togglePause(false);
$('#pCheck').onclick = () => { togglePause(false); respawn('manual'); };
$('#pHub').onclick = () => { togglePause(false); fadeTo(() => loadWorld('hub', null)); };
$('#pSound').onclick = () => { $('#pSound').textContent = sfx.toggle() ? '🔊 الصوت: شغّال' : '🔇 الصوت: مطفي'; };
$('#pHelp').onclick = () => $('#help').classList.toggle('on');
$('#startBtn').onclick = () => {
  sfx.init(); started = true; $('#title').classList.add('off'); setTimeout(() => $('#title').remove(), 900);
  sfx.music(cfg.music); $('#hudWrap').classList.add('on'); if (TOUCH) $('#touch').classList.add('on');
  try { if (TOUCH && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
  setTimeout(() => { const t = level.triggers.find((t) => !t.fired && Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z) < t.r); if (t) { t.fired = true; say(t.text); } }, 900);
};

/* ---------------- items ---------------- */
function nearItem() { let best = null, bd = 1.7; for (const it of level.items) { if (it.carried || it.placed) continue; const d = Math.hypot(it.pos.x - player.pos.x, it.pos.z - player.pos.z); if (d < bd && Math.abs(it.pos.y - 0.6 - player.pos.y) < 1.6) { bd = d; best = it; } } return best; }
function nearPed() { if (!player.carry) return null; for (const p of level.pedestals) { if (p.filled >= p.need || p.accept !== player.carry.kind) continue; if (Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) < 2.6 && Math.abs(p.pos.y - player.pos.y) < 1.5) return p; } return null; }
function nearNpc() { return npc && player.pos.distanceTo(npc.root.position) < 3 ? npc : null; }
function interact() {
  if (player.carry) { const p = nearPed(); if (p) placeItem(p); else dropItem(false); return; }
  const it = nearItem(); if (it && player.onGround) { it.carried = true; it.follow = null; player.carry = it; sfx.pickup(); sparks.emit(it.pos, { color: it.color, count: 20, speed: 3, life: 0.5 }); if (it.onPick) it.onPick(); return; }
  if (nearNpc()) talk();
}
function placeItem(p) {
  const it = player.carry; player.carry = null; it.carried = false; it.placed = true; const s = p.sockets[p.filled++];
  const from = it.pos.clone(); let k = 0; level.anim.push((dt) => { if (k >= 1) return; k = Math.min(1, k + dt / 0.5); it.pos.lerpVectors(from, s, 1 - Math.pow(1 - k, 3)); });
  sfx.place(); sparks.emit(s, { color: it.color, count: 40, speed: 5, life: 0.8, size: 0.35 });
  if (p.filled >= p.need) { let w = 0; level.anim.push((dt) => { if (w < 0) return; w += dt; if (w > 0.55) { w = -1; p.onFill && p.onFill(); } }); } else say(`باقي ${p.need - p.filled} — كمّل! ✨`);
}
function dropItem(forced) {
  const it = player.carry; if (!it) return; player.carry = null; it.carried = false;
  if (!forced && player.onGround) it.home.copy(player.pos).add(new V(0, 0.6, 0)); else { it.home.copy(it.origin); sparks.emit(it.origin, { color: it.color, count: 20, speed: 3 }); }
  it.pos.copy(it.home);
}
const NPC_LINES = () => SAVE.done.w2 ? ['ما توقعت تخلّص العالمين بهالسرعة! 🏆', 'العوالم الجاية بتكون أكبر… جهّز نفسك 😏', 'ارجع لأي عالم وجمّع الشظايا اللي فاتتك 💎'] :
  SAVE.done.w1 ? ['الجزر السماوية أصعب: صخور تتحرك وبلاط يتكسّر 🌌', 'تذكّر: وأنت على الجدار، اضغط قفز تنط للجدار اللي قدامك.', 'الكبار يضربون الأرض — ابعد ثم اضرب ⚔️'] :
  ['أنا البطل الهادئ 🧘 — بكون معك بصوتي في كل عالم.', 'الجدار المضيء بالرونات = تقدر تركض عليه أو تطلع عليه.', 'أي حافة تقدر تتمسك فيها — اقفز وأنت لاصق فيها.', 'لما تشيل شي، ما تقدر تضرب. نزّله أول (✋).', 'وأنت في الهوا اضغط ضرب = ضربة قوية للأرض ⬇️'];
function talk() { const L = NPC_LINES(); say('🧘 ' + L[npc.line % L.length]); npc.line++; }

/* ---------------- respawn ---------------- */
function respawn(why) {
  if (fading) return; fading = true;
  if (why === 'fall') { SAVE.falls++; worldFalls++; }
  if (player.carry) dropItem(true);
  const f = $('#fade'); f.classList.add('on');
  setTimeout(() => {
    player.spawn(checkpoint.pos.clone().add(new V(0, 0.05, 0)), checkpoint.yaw); player.inv = 1;
    if (why === 'death') { player.hp = player.maxHp; say('لا تشيل هم 💪 رجعناك لآخر نقطة بكامل قلوبك.'); }
    else if (why === 'fall' && worldFalls % 4 === 3) say('السقوط جزء من التدريب 🥷 — خذ نفس وجرّب مرة ثانية.');
    cam.yaw = checkpoint.yaw; scarf.init = false; hudUpdate();
    setTimeout(() => { f.classList.remove('on'); fading = false; }, 120);
  }, why === 'death' ? 700 : 380);
}

/* ---------------- input ---------------- */
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const keys = {}, prev = {};
const vin = { jump: 0, atk: 0, roll: 0, act: 0 }, held = { jump: false };
const virt = { mx: 0, my: 0 }; // joystick
const cam = { yaw: 0, pitch: 0.32, dist: 6.4, want: 6.4, target: new V(), lastManual: -9, dx: 0, dy: 0 };
addEventListener('keydown', (e) => { keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); if (e.code === 'Escape' || e.code === 'KeyP') togglePause(); if (e.code === 'Enter' && !started) $('#startBtn').click(); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
let mouse = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') { mouse = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; canvas.setPointerCapture(e.pointerId); return; }
  touchDown(e);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') { if (!mouse) return; const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y; mouse.moved += Math.abs(dx) + Math.abs(dy); mouse.x = e.clientX; mouse.y = e.clientY; cam.dx += dx; cam.dy += dy; return; }
  touchMove(e);
});
canvas.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') { if (mouse && mouse.moved < 8 && performance.now() - mouse.t < 300 && e.button === 0) vin.atk++; mouse = null; return; } touchUp(e); });
canvas.addEventListener('pointercancel', touchUp);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
let joy = null, look = null;
function touchDown(e) {
  if (!started) return;
  if (e.clientX < innerWidth * 0.45 && !joy) { joy = { id: e.pointerId, x: e.clientX, y: e.clientY }; const j = $('#joy'); j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; j.classList.add('on'); $('#knob').style.transform = 'translate(-50%,-50%)'; }
  else if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY };
}
function touchMove(e) {
  if (joy && e.pointerId === joy.id) { let dx = e.clientX - joy.x, dy = e.clientY - joy.y; const l = Math.hypot(dx, dy), m = 58; if (l > m) { dx = (dx / l) * m; dy = (dy / l) * m; } virt.mx = dx / m; virt.my = -dy / m; $('#knob').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; }
  else if (look && e.pointerId === look.id) { cam.dx += (e.clientX - look.x) * 1.4; cam.dy += (e.clientY - look.y) * 1.4; look.x = e.clientX; look.y = e.clientY; }
}
function touchUp(e) { if (joy && e.pointerId === joy.id) { joy = null; virt.mx = virt.my = 0; $('#joy').classList.remove('on'); } if (look && e.pointerId === look.id) look = null; }
document.querySelectorAll('[data-btn]').forEach((b) => {
  const k = b.dataset.btn;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); vin[k]++; if (k === 'jump') held.jump = true; b.classList.add('down'); });
  const up = () => { if (k === 'jump') held.jump = false; b.classList.remove('down'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
});
const edge = (name, down) => { const p = prev[name]; prev[name] = down; return down && !p; };
function readInput() {
  let ix = 0, iy = 0;
  if (keys.KeyW || keys.ArrowUp) iy += 1; if (keys.KeyS || keys.ArrowDown) iy -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
  ix += virt.mx; iy += virt.my;
  let gj = false, ga = false, gr = false, gx = false;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g) : null;
  if (gp) {
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    ix += dz(gp.axes[0]); iy -= dz(gp.axes[1]); cam.dx += dz(gp.axes[2] || 0) * 14; cam.dy += dz(gp.axes[3] || 0) * 10;
    const B = (i) => gp.buttons[i] && gp.buttons[i].pressed; gj = B(0); ga = B(2) || B(5); gr = B(1) || B(4); gx = B(3);
    if (edge('gstart', B(9))) togglePause();
  }
  if (__virt) { ix += __virt.mx || 0; iy += __virt.my || 0; }
  const m = Math.min(1, Math.hypot(ix, iy)); if (m > 0 && Math.hypot(ix, iy) > 1) { const k = 1 / Math.hypot(ix, iy); ix *= k; iy *= k; }
  const f = new V(Math.sin(cam.yaw), 0, Math.cos(cam.yaw)), r = new V(-Math.cos(cam.yaw), 0, Math.sin(cam.yaw));
  const mv = f.multiplyScalar(iy).add(r.multiplyScalar(ix));
  const inp = {
    mx: mv.x, mz: mv.z,
    jumpP: edge('jump', !!keys.Space) || edge('gj', gj) || vin.jump > 0,
    atkP: edge('atk', !!(keys.KeyJ || keys.KeyX)) || edge('ga', ga) || vin.atk > 0,
    rollP: edge('roll', !!(keys.KeyK || keys.ShiftLeft || keys.ShiftRight || keys.KeyC)) || edge('gr', gr) || vin.roll > 0,
    actP: edge('act', !!(keys.KeyE || keys.KeyF)) || edge('gx', gx) || vin.act > 0,
  };
  vin.jump = vin.atk = vin.roll = vin.act = 0;
  return inp;
}
let __virt = null;

/* ---------------- camera ---------------- */
const ray = new THREE.Raycaster(); let tNow = 0;
function updateCamera(dt) {
  const p = player.pos, tgt = new V(p.x, p.y + 1.5, p.z);
  // keep the camera off the wall while wall-running / climbing
  const wallOff = (player.state === 'wallrun' || player.state === 'wallup' || player.state === 'hang') && (player.wall || player.hang);
  cam.off = cam.off || new V();
  const wantOff = wallOff ? (player.state === 'wallrun' ? player.wall.n.clone().multiplyScalar(1.6) : (player.state === 'hang' ? player.hang.n : player.wall.n).clone().multiplyScalar(0.9)) : new V();
  cam.off.lerp(wantOff, 1 - Math.exp(-dt * 5)); tgt.add(cam.off);
  cam.target.x += (tgt.x - cam.target.x) * (1 - Math.exp(-dt * 12)); cam.target.z += (tgt.z - cam.target.z) * (1 - Math.exp(-dt * 12));
  cam.target.y += (tgt.y - cam.target.y) * (1 - Math.exp(-dt * (player.onGround || player.state === 'hang' ? 8 : 3.5)));
  if (Math.abs(tgt.y - cam.target.y) > 4) cam.target.y = tgt.y - Math.sign(tgt.y - cam.target.y) * 4;
  if (cam.dx || cam.dy) { cam.yaw -= cam.dx * 0.0055; cam.pitch = Math.max(-0.35, Math.min(1.15, cam.pitch + cam.dy * 0.004)); cam.lastManual = tNow; cam.dx = cam.dy = 0; }
  const hs = Math.hypot(player.vel.x, player.vel.z);
  if ((player.state === 'hang' || player.state === 'wallup' || player.state === 'climb') && tNow - cam.lastManual > 0.6) cam.yaw += angDiff(cam.yaw, player.yaw) * Math.min(1, dt * 2.5);
  else if (tNow - cam.lastManual > 1.3 && hs > 1.5) {
    const d = angDiff(cam.yaw, player.yaw), k = player.state === 'wallrun' ? 3 : 1.4;
    if (Math.abs(d) < 2.3) cam.yaw += d * Math.min(1, dt * k * Math.min(1, hs / 5));
  }
  if (tNow - cam.lastManual > 2) cam.pitch += (0.32 - cam.pitch) * Math.min(1, dt * 0.8);
  cam.want = innerWidth < innerHeight ? 7.6 : 6.4;
  const dir = new V(-Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch));
  ray.set(cam.target, dir); ray.far = cam.want + 0.4;
  const hits = ray.intersectObjects(level.camMeshes, false);
  let want = cam.want; if (hits.length) want = Math.max(1.3, hits[0].distance - 0.35);
  cam.dist += (want - cam.dist) * (1 - Math.exp(-dt * (want < cam.dist ? 25 : 4)));
  camera.position.copy(cam.target).addScaledVector(dir, cam.dist);
  if (shakeAmt > 0) { camera.position.x += (Math.random() - 0.5) * shakeAmt; camera.position.y += (Math.random() - 0.5) * shakeAmt; shakeAmt = Math.max(0, shakeAmt - dt * 1.6); }
  camera.lookAt(cam.target);
}

/* ---------------- per-frame world logic ---------------- */
let promptKind = '';
function worldLogic(dt) {
  const p = player.pos;
  // checkpoints
  for (const c of level.checkpoints) if (!c.on && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 1.8 && Math.abs(c.pos.y - p.y) < 2) {
    level.checkpoints.forEach((o) => (o.cur = false)); c.on = true; c.cur = true; checkpoint = { pos: c.pos.clone(), yaw: c.yaw };
    c.cap.material.emissive.setHex(0x38bdf8); c.cap.material.emissiveIntensity = 1.5; c.gl.material.opacity = 0.8; sfx.checkpoint();
    sparks.emit(c.pos.clone().add(new V(0, 1.85, 0)), { color: 0x7dd3fc, count: 30, speed: 4, life: 0.8 });
  }
  // shards
  for (const s of level.shards) if (!s.taken && Math.hypot(s.g.position.x - p.x, s.g.position.z - p.z) < 1.1 && Math.abs(s.g.position.y - (p.y + 0.9)) < 1.3) {
    s.taken = true; s.g.removeFromParent(); if (!SAVE.shards.includes(s.id)) SAVE.shards.push(s.id); persist(); sfx.shard();
    sparks.emit(s.g.position, { color: 0xffd166, count: 36, speed: 5, life: 0.7, size: 0.3 }); hudUpdate();
    const n = SAVE.shards.filter((x) => x.startsWith(cfg.id + '-')).length; if (n === cfg.shardTotal) say('جمعت كل شظايا هالعالم! 💎🌟');
  }
  // triggers
  for (const t of level.triggers) if (!t.fired && Math.hypot(t.pos.x - p.x, t.pos.z - p.z) < t.r && Math.abs(t.pos.y - p.y) < t.dy && started) { t.fired = true; if (t.text) say(t.text); if (t.group) spawnGroup(t.group); }
  // groups cleared
  for (const g in level.onClear) if (level.spawned[g] && !level.groupsDone[g] && enemies.alive(g) === 0) { level.groupsDone[g] = true; level.onClear[g](); }
  // portals
  for (const P of level.portals) {
    const d = Math.hypot(P.pos.x - p.x, P.pos.z - p.z);
    if (P.active && d < 1.1 && p.y - P.pos.y > -0.5 && p.y - P.pos.y < 2.5 && !fading) { enterPortal(P); break; }
    if (!P.active && P.locked && d < 2.6) { if (!P.warned) { P.warned = true; say(P.locked); } } else if (d > 5) P.warned = false;
  }
  // items following moving platforms / carried
  for (const it of level.items) {
    if (it.follow && !it.carried && !it.placed) { it.home.add(it.follow.delta); it.pos.x = it.home.x; it.pos.z = it.home.z; }
    if (it.carried) { it.pos.set(p.x, p.y + 2.3 + Math.sin(tNow * 4) * 0.05, p.z); }
  }
  // prompt
  let label = '';
  if (player.carry) label = nearPed() ? 'ضع ✨' : 'نزّل';
  else if (nearItem() && player.onGround) label = 'شيل';
  else if (nearNpc()) label = 'كلّمه';
  if (label !== promptKind) { promptKind = label; $('#prompt').textContent = label ? (TOUCH ? '✋ ' : '[E] ') + label : ''; $('#prompt').classList.toggle('on', !!label); $('#actBtn').classList.toggle('hot', !!label); }
  // ambience
  if (Math.random() < dt * 18) { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 14; motes.emit(new V(p.x + Math.cos(a) * r, p.y + Math.random() * 6, p.z + Math.sin(a) * r), { color: cfg.motes, count: 1, speed: 0.3, life: 4, size: 0.12, grav: -0.06, drag: 0.2 }); }
  if (level.petalTrees && Math.random() < dt * 4) { const t = level.petalTrees[Math.floor(Math.random() * level.petalTrees.length)]; dust.emit(t.pos.clone().add(new V((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)), { color: t.color, count: 1, speed: 0.6, life: 4.5, size: 0.14, grav: 0.35, drag: 0.6 }); }
}
function enterPortal(P) {
  sfx.portal(); sparks.emit(P.pos.clone().add(new V(0, 1.7, 0)), { color: P.color, count: 60, speed: 6, life: 0.9, size: 0.35 });
  if (P.to === 'hub') {
    const first = !SAVE.done[cfg.id]; SAVE.done[cfg.id] = true; const sec = Math.round((performance.now() - startTime) / 1000);
    if (!SAVE.best[cfg.id] || sec < SAVE.best[cfg.id]) SAVE.best[cfg.id] = sec; persist();
    if (level.complete) { fading = true; setTimeout(() => { fading = false; showDone(); }, 300); return; }
    fadeTo(() => loadWorld('hub', cfg.id)); return;
  }
  fadeTo(() => loadWorld(P.to, 'hub'));
}

/* ---------------- animation helpers ---------------- */
const tmpA = new V(), tmpB = new V();
function animateNpc(dt) {
  if (!npc) return;
  const P = { ...BASE, shLx: 0.85, shLz: -0.25, elL: 1.95, shRx: 0.85, shRz: -0.25, elR: 1.95, chestX: Math.sin(tNow * 1.8) * 0.03, knL: 0.08, knR: 0.08, thLz: 0.1, thRz: 0.1 };
  const d = new V().subVectors(player.pos, npc.root.position); const want = Math.atan2(d.x, d.z);
  if (d.length() < 7) npc.root.rotation.y += angDiff(npc.root.rotation.y, want) * Math.min(1, dt * 2);
  blendPose(npc, P, dt, 6);
}

/* ---------------- main loop ---------------- */
let last = performance.now(), acc = 0, manual = false; const STEP = 1 / 120;
function simulate(dt) {
  if (stopT > 0) { stopT -= dt; dt *= 0.06; }
  tNow += dt;
  const inp = readInput();
  if (inp.actP) interact();
  acc += dt; let n = 0;
  while (acc >= STEP && n < 8) {
    level.update(STEP, player); player.update(STEP, inp); enemies.update(STEP, player);
    inp.jumpP = inp.atkP = inp.rollP = inp.actP = false; acc -= STEP; n++;
  }
  if (n === 8) acc = 0;
  worldLogic(dt);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('#toast').classList.remove('on'); }
}
loadWorld('hub', null);
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused && started && !manual) simulate(dt);
  else if (!started) {
    // title: slow orbit around the plaza
    tNow += dt; cam.yaw += dt * 0.08; level.update(dt, player);
  }
  player.animate(dt); animateNpc(dt);
  hero.root.updateMatrixWorld(true);
  const r = new V(-Math.cos(player.yaw), 0, Math.sin(player.yaw));
  scarf.update(Math.min(dt, 1 / 30), hero.scarfAnchor.getWorldPosition(tmpA), r, player.vel, tNow);
  if (hero.sword.visible) { const b = hero.sword.localToWorld(tmpA.set(0, 0, 0.2)), t = hero.sword.localToWorld(tmpB.set(0, 0, 1.05)); trail.update(b, t, player.state === 'attack' || player.state === 'slam', dt); } else trail.update(tmpA, tmpA, false, dt);
  sparks.update(dt); dust.update(dt); motes.update(dt);
  updateCamera(dt);
  sun.position.copy(player.pos).addScaledVector(lightDir, 60); sun.target.position.copy(player.pos);
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

/* ---------------- debug / test hooks ---------------- */
window.__G = {
  get player() { return player; }, get level() { return level; }, get enemies() { return enemies; }, get cam() { return cam; }, SAVE: () => SAVE,
  load: (id) => loadWorld(id, null), tp: (x, y, z, yaw = 0) => { player.spawn(new V(x, y, z), yaw); cam.yaw = yaw; scarf.init = false; },
  virt: (v) => { __virt = v; },
  manual: (v) => { manual = v; },
  // run the simulation deterministically for `sec` seconds (or until fn() is true); returns true if fn fired
  sim: (sec, fn) => { for (let t = 0; t < sec; t += 1 / 60) { simulate(1 / 60); player.animate(1 / 60); if (fn && fn()) return true; } return !fn; }, press: (k) => { vin[k]++; }, start: () => $('#startBtn').click(), setCamYaw: (y) => { cam.yaw = y; cam.lastManual = tNow + 999; },
};
