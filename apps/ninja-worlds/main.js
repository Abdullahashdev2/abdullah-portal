import * as THREE from 'three';
import { Sky } from 'sky';
import { Particles, Sound } from './fx.js';
import { buildHero, blendPose, BASE, Scarf, Trail } from './hero.js';
import { Player } from './player.js';
import { Enemies } from './enemies.js';
import { Level, makeKit } from './kit.js';
import { WORLDS } from './worlds.js';
import { remote, openTV, closeTV, sendTV } from './tv.js';
import { Skin, saveSkinFile, loadSkinFile, clearSkinFile } from './skin.js';
const V = THREE.Vector3, $ = (s) => document.querySelector(s);
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

/* ---------------- save ---------------- */
const SKEY = 'ninja_worlds_v1';
let SAVE = { done: {}, shards: [], falls: 0, best: {} };
try { Object.assign(SAVE, JSON.parse(localStorage.getItem(SKEY)) || {}); } catch (e) {}
function persist() {
  try { localStorage.setItem(SKEY, JSON.stringify(SAVE)); } catch (e) {}
  const n = SAVE.shards.length, w = Object.keys(SAVE.done).filter((k) => SAVE.done[k]).length;
  try { window.Game && Game.save('ninja-worlds', { ...SAVE, score: n, scores: { 'ninja-worlds': n }, summary: `🌍 ${w}/6 عوالم • 💎 ${n}/60` }); } catch (e) {}
}
(async () => { try { const c = window.Game && (await Game.load('ninja-worlds')); if (c && c.shards && c.shards.length > SAVE.shards.length) { SAVE = { ...SAVE, ...c }; hudUpdate(); } } catch (e) {} })();

/* ---------------- renderer / scene ---------------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const LOW = /Android|iPhone|iPad/i.test(navigator.userAgent) && Math.min(screen.width, screen.height) < 500;
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.3 : 1.6));
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
const BREATH = 12; let breath = 12, normalFog = null; const waterFog = new THREE.FogExp2(0x0b5f7a, 0.06);
/* ---------- lightweight bloom (HDR glow) ---------- */
let post = null, HQ = !LOW, bloomSamples = 2;
/* ---------- adaptive quality: keeps ~60 fps at the sharpest settings the device can hold ---------- */
const QL = [
  { name: 'فائقة', dpr: 2.0, bloom: true, msaa: 4, shadow: 2048, soft: true, lights: true },
  { name: 'عالية', dpr: 1.6, bloom: true, msaa: 2, shadow: 2048, soft: true, lights: true },
  { name: 'متوسطة', dpr: 1.3, bloom: false, msaa: 0, shadow: 1024, soft: true, lights: true },
  { name: 'سريعة', dpr: 1.0, bloom: false, msaa: 0, shadow: 1024, soft: false, lights: false },
  { name: 'أسرع', dpr: 0.8, bloom: false, msaa: 0, shadow: 0, soft: false, lights: false },
];
let qMode = 'auto', qLevel = LOW ? 2 : 1, qChanged = 0, qBlock = {}, fpsAvg = 60, ftAcc = 0, ftN = 0;
try { const m = localStorage.getItem('nw_q'); if (m != null && m !== 'auto') { qMode = +m; qLevel = +m; } } catch (e) {}
function applyQuality(i) {
  qLevel = Math.max(0, Math.min(QL.length - 1, i)); const q = QL[qLevel];
  renderer.setPixelRatio(Math.min(devicePixelRatio, q.dpr)); HQ = q.bloom; bloomSamples = q.msaa;
  const wantShadow = q.shadow > 0;
  if (sun.castShadow !== wantShadow || (wantShadow && sun.shadow.mapSize.x !== q.shadow) || renderer.shadowMap.type !== (q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap)) {
    sun.castShadow = wantShadow; if (wantShadow) sun.shadow.mapSize.set(q.shadow, q.shadow);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    renderer.shadowMap.type = q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true)); });
  }
  if (level) { level.useLights = q.lights; level.group.traverse((o) => { if (o.isPointLight) o.visible = q.lights; }); }
  qChanged = performance.now(); resize(); qLabel();
}
function qLabel() { const b = document.getElementById('pHQ'); if (b) b.textContent = `🎮 الجودة: ${qMode === 'auto' ? 'تلقائي (' + QL[qLevel].name + ')' : QL[qLevel].name} · ${Math.round(fpsAvg)} إطار`; }
function qTick(dt) {
  ftAcc += dt; ftN++;
  if (ftAcc < 1.2) return;
  fpsAvg = ftN / ftAcc; ftAcc = 0; ftN = 0;
  if (qMode !== 'auto' || !started || paused || document.hidden) return;
  const since = performance.now() - qChanged;
  if (fpsAvg < 50 && qLevel < QL.length - 1 && since > 2500) { qBlock[qLevel - 1] = performance.now(); applyQuality(qLevel + 1); }
  else if (fpsAvg > 58 && qLevel > 0 && since > 7000 && !(performance.now() - (qBlock[qLevel - 1] || -1e9) < 30000)) applyQuality(qLevel - 1);
}
function freezeStatic(root) { root.traverse((o) => { if (o.userData.dyn) return; o.updateMatrix(); o.matrixAutoUpdate = false; }); }
function makePost() {
  if (post) { post.rt.dispose(); post.lv.forEach((l) => l.forEach((r) => r.dispose())); post = null; }
  if (!HQ) return;
  try {
    const pr = renderer.getPixelRatio(), w = Math.max(2, Math.floor(innerWidth * pr)), h = Math.max(2, Math.floor(innerHeight * pr)), o = { type: THREE.HalfFloatType };
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: bloomSamples });
    const lv = [4, 8, 16, 32].map((d) => [new THREE.WebGLRenderTarget(Math.max(1, (w / d) | 0), Math.max(1, (h / d) | 0), o), new THREE.WebGLRenderTarget(Math.max(1, (w / d) | 0), Math.max(1, (h / d) | 0), o)]);
    const vs = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
    const mk = (fs, u) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: vs, fragmentShader: fs, depthTest: false, depthWrite: false });
    const bright = mk('uniform sampler2D tex;varying vec2 vUv;void main(){vec3 c=texture2D(tex,vUv).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(1.,2.2,l),1.);}', { tex: { value: null } });
    bright.toneMapped = false;
    const blur = mk('uniform sampler2D tex;uniform vec2 dir;varying vec2 vUv;void main(){vec3 c=texture2D(tex,vUv).rgb*.227;c+=texture2D(tex,vUv+dir*1.385).rgb*.316;c+=texture2D(tex,vUv-dir*1.385).rgb*.316;c+=texture2D(tex,vUv+dir*3.23).rgb*.07;c+=texture2D(tex,vUv-dir*3.23).rgb*.07;gl_FragColor=vec4(c,1.);}', { tex: { value: null }, dir: { value: new THREE.Vector2() } });
    blur.toneMapped = false;
    const comp = mk('uniform sampler2D tex,b0,b1,b2,b3;uniform float k;varying vec2 vUv;void main(){vec3 c=texture2D(tex,vUv).rgb+k*(texture2D(b0,vUv).rgb*.5+texture2D(b1,vUv).rgb*.4+texture2D(b2,vUv).rgb*.35+texture2D(b3,vUv).rgb*.3);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      { tex: { value: rt.texture }, b0: { value: lv[0][0].texture }, b1: { value: lv[1][0].texture }, b2: { value: lv[2][0].texture }, b3: { value: lv[3][0].texture }, k: { value: 0.9 } });
    const qs = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; qs.add(quad);
    post = { rt, lv, bright, blur, comp, qs, quad, qc: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  } catch (e) { post = null; }
}
function pass(m, target) { post.quad.material = m; renderer.setRenderTarget(target); renderer.render(post.qs, post.qc); }
function renderFrame() {
  if (!post) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
  renderer.setRenderTarget(post.rt); renderer.render(scene, camera);
  post.bright.uniforms.tex.value = post.rt.texture; pass(post.bright, post.lv[0][0]);
  for (let i = 0; i < post.lv.length; i++) {
    const [a, b] = post.lv[i], src = i === 0 ? a.texture : post.lv[i - 1][0].texture;
    post.blur.uniforms.tex.value = src; post.blur.uniforms.dir.value.set(1 / a.width, 0); pass(post.blur, b);
    post.blur.uniforms.tex.value = b.texture; post.blur.uniforms.dir.value.set(0, 1 / a.height); pass(post.blur, a);
  }
  pass(post.comp, null);
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 72 : 62; camera.updateProjectionMatrix(); makePost(); sparks.mat.uniforms.scale.value = dust.mat.uniforms.scale.value = motes.mat.uniforms.scale.value = h * 0.6 * renderer.getPixelRatio(); }

const sparks = new Particles(900, true), dust = new Particles(400, false), motes = new Particles(500, true);
scene.add(sparks.points, dust.points, motes.points);
const sfx = new Sound();
addEventListener('resize', resize); resize();

/* ---------------- game object shared with modules ---------------- */
let skin = null; let level = null, player, enemies, hero, scarf, trail, npc = null, worldId = 'hub';
let shakeAmt = 0, stopT = 0, fading = false, startTime = 0, worldFalls = 0;
const G = {
  scene, sfx,
  get level() { return level; },
  get enemies() { return enemies; },
  fx: { emit: (p, o) => sparks.emit(p, o) },
  shake: (a) => { shakeAmt = Math.max(shakeAmt, a); if (a > 0.25 && navigator.vibrate) try { navigator.vibrate(30); } catch (e) {} },
  hitstop: (t) => { stopT = Math.max(stopT, t); },
  dust: (p, n) => dust.emit(new V(p.x, p.y + 0.1, p.z), { color: 0xd9c8aa, count: n, speed: 2.2, life: 0.6, size: 0.55, grav: -0.8, drag: 3, spread: 0.5, up: 0.4 }),
  flashHurt: () => { sendTV({ vib: [70, 40, 70] }); const f = $('#hurt'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); },
  hud: () => hudUpdate(),
  onFall: () => respawn('fall'),
  onDeath: () => respawn('death'),
  onEnemyKilled: (e) => { G.hitstop(0.08); if (Math.random() < (player.hp <= 2 ? 0.7 : 0.35)) enemies.dropHeart(e.pos); },
  dropItem: (forced) => dropItem(forced),
  upg: {},
  waterAt: (p) => { if (!level || !level.waters) return null; for (const W of level.waters) if (p.x > W.x0 && p.x < W.x1 && p.z > W.z0 && p.z < W.z1 && p.y > W.y0 - 1 && p.y < W.y1 + 0.5) return W; return null; },
  splash: (p) => { sfx.noise(0.35, 900, 0.6, 0.22, 'bandpass', 0, 300); sparks.emit(p, { color: 0xd8f6ff, count: 26, speed: 4, up: 1.5, life: 0.6, size: 0.25, grav: 9 }); },
  playerHidden: () => { if (!level.shadows) return false; const p = player.pos, hs = Math.hypot(player.vel.x, player.vel.z); return hs < 4.8 && level.shadows.some((z) => p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1 && Math.abs(p.y - z.y) < 0.6); },
  onAlarm: () => { level.alarms = (level.alarms || 0) + 1; sfx.tone(880, 660, 0.25, 'square', 0.12); sfx.tone(880, 660, 0.25, 'square', 0.12, 0.3); if (level.alarms <= 3) say('🚨 انكشفت! الحارس شافك — حاربه أو اهرب للظل.'); },
  onTakedown: (e) => { level.takedowns = (level.takedowns || 0) + 1; sfx.tone(300, 120, 0.3, 'triangle', 0.15); sparks.emit(e.pos.clone().add(new V(0, 1.2, 0)), { color: 0xa78bfa, count: 30, speed: 4, life: 0.6 }); if (level.takedowns <= 2) say('🤫 ضربة صامتة! محد سمع شي.'); },
  onBossPhase: (ph) => { G.shake(0.5); say(ph === 2 ? '🔥 العملاق عصّب! صار يرمي كرات نار — ردّها عليه بالسيف!' : '🌋 المرحلة الأخيرة! يستدعي ظلال — ركّز وخلّصه!'); },
};
const UPG = [
  { n: 6, key: 'spin', name: 'الضربة الدوّامة', desc: 'زر ✴️ (أو L): لفّة سيف تضرب كل اللي حولك' },
  { n: 12, key: 'heart1', name: 'قلب إضافي ❤', desc: 'صار عندك ٦ قلوب' },
  { n: 18, key: 'fire', name: 'سيف اللهب 🔥', desc: 'ضرباتك صارت أقوى (+١ ضرر)' },
  { n: 24, key: 'heart2', name: 'قلب إضافي ❤', desc: 'صار عندك ٧ قلوب' },
  { n: 30, key: 'dash', name: 'الاندفاع الجوي 💨', desc: 'وأنت في الهوا اضغط تدحرج = تندفع لقدّام' },
  { n: 40, key: 'bolt', name: 'سيف البرق ⚡', desc: 'الدوّامة تشحن أسرع بمرتين' },
];
function computeUpg() {
  const n = SAVE.shards.length, has = (k) => n >= UPG.find((u) => u.key === k).n;
  Object.assign(G.upg, { spin: has('spin'), fire: has('fire'), dash: has('dash'), fastSpin: has('bolt'), dmg: has('fire') ? 1 : 0, hearts: (has('heart1') ? 1 : 0) + (has('heart2') ? 1 : 0) });
  if (player) player.maxHp = 5 + G.upg.hearts;
  if (trail) trail.c.setHex(G.upg.fastSpin ? 0x7df9ff : G.upg.fire ? 0xffa040 : 0x9be7ff);
  if (hero) hero.sword.traverse((o) => { if (o.material && o.material.color && o.geometry && o.geometry.parameters && o.geometry.parameters.depth > 0.8) { o.material.emissive && o.material.emissive.setHex(G.upg.fastSpin ? 0x0891b2 : G.upg.fire ? 0xc2410c : 0x000000); if (o.material.emissive) o.material.emissiveIntensity = 0.8; } });
  const sp = document.getElementById('spBtn'); if (sp) sp.style.display = G.upg.spin ? '' : 'none';
}
hero = buildHero('ninja'); scene.add(hero.root);
player = new Player(G, hero); enemies = new Enemies(G);
skin = null; scarf = new Scarf(scene, 0xdc2626); trail = new Trail(scene, 0x9be7ff);

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
  level = new Level(scene); worldId = id; SAVE._from = from; $('#timer').classList.remove('on');
  level.say = (t) => say(t); level.sfx = (n) => sfx[n] && sfx[n](); level.shake = (a) => G.shake(a); level.spawnGroup = spawnGroup; level.spawned = {};
  const K = makeKit(level); cfg = level.cfg = WORLDS[id](K, level, SAVE);
  level.emit = (p, o) => sparks.emit(p, o); level.alarms = 0;
  level.onCrumble = (b) => { sfx.crumble(); dust.emit(b.center.clone(), { color: 0xc4b5fd, count: 20, speed: 3, life: 0.8, size: 0.5, grav: 3, spread: 1.5 }); };
  for (const d of level.enemyDefs) if (!d.group) enemies.spawn(d);
  for (const it of level.items) it.origin = it.home.clone();
  applyAtmo(cfg);
  if (level.npcDef) { const d = level.npcDef; npc = buildHero('calm'); npc.root.position.set(d.x, d.y, d.z); npc.root.rotation.y = d.yaw; scene.add(npc.root); npc.line = 0; }
  checkpoint = level.checkpoints[0] ? { pos: level.checkpoints[0].pos, yaw: level.checkpoints[0].yaw } : null;
  computeUpg(); player.spawn(cfg.spawn.pos, cfg.spawn.yaw); player.hp = player.maxHp; breath = BREATH; normalFog = scene.fog; player.carry = null;
  if (!checkpoint) checkpoint = { pos: cfg.spawn.pos.clone(), yaw: cfg.spawn.yaw };
  cam.yaw = cfg.spawn.yaw; cam.pitch = 0.32; cam.target.copy(player.pos).add(new V(0, 1.5, 0)); cam.dist = cam.want;
  scarf.init = false; startTime = performance.now(); worldFalls = 0;
  level.useLights = QL[qLevel].lights; level.group.traverse((o) => { if (o.isPointLight) o.visible = QL[qLevel].lights; });
  freezeStatic(level.group); tuneEnv(); banner(cfg.name, cfg.sub); hudUpdate();
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
  else $('#shards').textContent = `💎 ${SAVE.shards.length}/60`;
  $('#wname').textContent = cfg.name;
}
function showDone() {
  const n = SAVE.shards.filter((s) => s.startsWith(cfg.id + '-')).length, sec = Math.round((performance.now() - startTime) / 1000);
  $('#doneTitle').textContent = `🏆 خلّصت «${cfg.name}»`;
  $('#doneStats').innerHTML = `<div><b>💎 ${n}/${cfg.shardTotal}</b><span>شظايا</span></div><div><b>⏱️ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</b><span>الوقت</span></div><div><b>🪂 ${worldFalls}</b><span>سقطات</span></div>`;
  $('#doneMsg').textContent = cfg.id === 'w6' ? '🏆 خلّصت العوالم الستة كلها — أنت بطل بوابات العوالم! ارجع جمّع اللي فاتك 💎' : n < cfg.shardTotal ? 'باقي شظايا مخبّية — تقدر ترجع لهالعالم وتدوّرها 👀' : 'جمعت كل الشظايا! أسطورة 🌟';
  $('#done').classList.add('on'); paused = true;
}
$('#doneBtn').onclick = () => { $('#done').classList.remove('on'); paused = false; fadeTo(() => loadWorld('hub', cfg.id)); };
function fadeTo(fn) { const f = $('#fade'); f.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 80); }, 380); }
function togglePause(v) { if (!started || $('#done').classList.contains('on')) return; paused = v ?? !paused; $('#pause').classList.toggle('on', paused); $('#pHub').hidden = worldId === 'hub'; navIdx = 0; if (paused) setTimeout(() => menuNav(0), 30); }
/* ---------- console-style menu navigation (phone controller / gamepad): stick moves, jump selects, roll goes back ---------- */
let navIdx = 0, navCool = 0;
function activeMenu() {
  for (const s of ['#tv', '#done', '#pause']) { const e = $(s); if (e && e.classList.contains('on')) return e; }
  const t = document.getElementById('title'); if (t && !t.classList.contains('off')) return t;
  return null;
}
const menuButtons = (m) => [...m.querySelectorAll('button')].filter((b) => b.offsetParent !== null && !b.hidden && b.style.display !== 'none');
function menuNav(dir) {
  const m = activeMenu(); if (!m) return; const bs = menuButtons(m); if (!bs.length) return;
  navIdx = ((navIdx + dir) % bs.length + bs.length) % bs.length;
  document.querySelectorAll('.navfocus').forEach((b) => b.classList.remove('navfocus'));
  bs[navIdx].classList.add('navfocus'); try { bs[navIdx].scrollIntoView({ block: 'nearest' }); } catch (e) {}
}
function menuSelect() { const m = activeMenu(); if (!m) return; const bs = menuButtons(m); const b = bs[Math.min(navIdx, bs.length - 1)]; if (b) { b.click(); setTimeout(() => { if (activeMenu()) menuNav(0); }, 60); } }
function menuBack() { if ($('#tv').classList.contains('on')) closeTV(); else if (paused && $('#pause').classList.contains('on')) togglePause(false); }
let gpPrev = {};
function menuPoll(dt) {
  navCool = Math.max(0, navCool - dt);
  const m = activeMenu(); if (!m) { document.querySelectorAll('.navfocus').forEach((b) => b.classList.remove('navfocus')); return; }
  let y = remote.on ? remote.my : 0;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g) : null;
  if (gp) {
    const B = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed), ed = (k, v) => { const p = gpPrev[k]; gpPrev[k] = v; return v && !p; };
    if (Math.abs(gp.axes[1]) > 0.5) y = -gp.axes[1]; if (B(12)) y = 1; if (B(13)) y = -1;
    if (ed('a', B(0))) menuSelect(); if (ed('b', B(1))) menuBack();
  }
  if (Math.abs(y) > 0.55 && navCool <= 0) { menuNav(y > 0 ? -1 : 1); navCool = 0.26; }
  if (Math.abs(y) < 0.3) navCool = 0;
  if (!m.querySelector('.navfocus') && (remote.on || gp)) menuNav(0);
}
$('#pauseBtn').onclick = () => togglePause(true);
$('#pResume').onclick = () => togglePause(false);
$('#pCheck').onclick = () => { togglePause(false); respawn('manual'); };
$('#pHub').onclick = () => { togglePause(false); fadeTo(() => loadWorld('hub', null)); };
$('#pSound').onclick = () => { $('#pSound').textContent = sfx.toggle() ? '🔊 الصوت: شغّال' : '🔇 الصوت: مطفي'; };
$('#pHelp').onclick = () => $('#help').classList.toggle('on');
/* ---------- big-screen mode: this device renders, a phone is the controller ---------- */
const tvHooks = {
  press: (k, n) => {
    if (k === 'pause') { if ($('#tv').classList.contains('on')) closeTV(); else if (started) togglePause(); return; }
    if (activeMenu()) { if (k === 'jump' || k === 'act' || k === 'atk') menuSelect(); else if (k === 'roll') menuBack(); return; }
    vin[k] = (vin[k] || 0) + n;
  },
  look: (dx, dy) => { cam.dx += dx; cam.dy += dy; },
  onConnect: () => { document.body.classList.add('tvmode'); $('#touch').classList.remove('on'); $('#tvBadge').classList.add('on'); say('📱 الجوال صار يد التحكم! الشاشة هذي للعرض بس 📺'); sendTV({ hp: player.hp, max: player.maxHp, sh: $('#shards').textContent, sp: !!G.upg.spin }); },
  onDisconnect: () => { $('#tvBadge').classList.remove('on'); say('⚠️ انقطع اتصال الجوال — افتح ⏸ ← 📺 عشان تربطه مرة ثانية.'); },
};
const openBig = () => { sfx.init(); openTV(tvHooks); };
$('#pTV').onclick = () => { togglePause(false); openBig(); };
$('#titleTV').onclick = (e) => { e.stopPropagation(); openBig(); };
$('#tvClose').onclick = () => closeTV();
/* ---------- custom 3D character (.glb) ---------- */
skin = new Skin(hero);
async function applySkin(buf, announce) {
  try {
    const clips = await skin.load(buf); $('#pSkinOff').hidden = false;
    if (announce) say('🧍 شخصيتك الجديدة جاهزة! الحركات اللي لقيتها: ' + (clips.length ? clips.join('، ') : 'ما فيه حركات — بتظهر واقفة') + ' 🎉');
    return true;
  } catch (e) { console.error(e); if (announce) say('⚠️ ما قدرت أقرأ الملف — لازم يكون GLB فيه هيكل (rig).'); return false; }
}
$('#pSkin').onclick = () => $('#skinFile').click();
$('#skinFile').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > 60 * 1024 * 1024) return say('⚠️ الملف كبير مرة (أكثر من ٦٠ ميقا).');
  const buf = await f.arrayBuffer(); togglePause(false);
  if (await applySkin(buf, true)) saveSkinFile(buf).catch(() => {});
};
$('#pSkinOff').onclick = () => { skin.clear(); clearSkinFile(); $('#pSkinOff').hidden = true; togglePause(false); say('↩️ رجع النينجا المعصوب الأصلي.'); };
loadSkinFile().then((buf) => { if (buf) applySkin(buf, false); });
$('#pHQ').onclick = () => { if (qMode === 'auto') qMode = 0; else if (qMode < QL.length - 1) qMode++; else qMode = 'auto'; try { localStorage.setItem('nw_q', String(qMode)); } catch (e) {} applyQuality(qMode === 'auto' ? (LOW ? 2 : 1) : qMode); };
$('#pUpg').onclick = () => { const n = SAVE.shards.length; $('#upgList').innerHTML = UPG.map((u) => `<div class="${n >= u.n ? 'u on' : 'u'}"><b>${n >= u.n ? '✅' : '🔒'} ${u.name}</b><span>${n >= u.n ? u.desc : 'تنفتح عند ' + u.n + ' 💎 (عندك ' + n + ')'}</span></div>`).join(''); $('#upgList').classList.toggle('on'); };
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
const NPC_LINES = () => SAVE.done.w6 ? ['هزمت عملاق الحمم؟! أنت أسطورة 🏆', 'جمّع كل الستين شظية عشان تفتح كل الترقيات 💎', 'سيف البرق ⚡ يحتاج ٤٠ شظية — قربت؟'] : SAVE.done.w3 ? ['البوابات الجديدة وراك فوق المنصة الثانية 👆', 'بالماء: تدحرج = تغطس، قفز = تطلع. وراقب الهوا 🫧', 'بالقلعة: الحارس ما يشوفك إذا كنت بالعشب وماشي بهدوء 🤫'] : SAVE.done.w3 ? ['ثلاث عوالم! ما بقى أحد يوقفك 🏆', 'العوالم الجاية بتكون أكبر… جهّز نفسك 😏', 'ارجع لأي عالم وجمّع الشظايا اللي فاتتك 💎'] : SAVE.done.w2 ? ['حصن الرمال فيه أعمدة تتأرجح عليها — اضغط قفز وأنت متأرجح عشان تنطلق 🤸', 'الرماة: اضرب كرتهم وهي قريبة منك ترجع عليهم ⚔️', 'الزر الذهبي يفتح البوابة ٧ ثواني بس!'] : SAVE.done.w2 ? ['ما توقعت تخلّص العالمين بهالسرعة! 🏆', 'العوالم الجاية بتكون أكبر… جهّز نفسك 😏', 'ارجع لأي عالم وجمّع الشظايا اللي فاتتك 💎'] :
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
    player.spawn(checkpoint.pos.clone().add(new V(0, 0.05, 0)), checkpoint.yaw); player.inv = 1; breath = BREATH;
    if (why === 'death') { player.hp = player.maxHp; say('لا تشيل هم 💪 رجعناك لآخر نقطة بكامل قلوبك.'); }
    else if (why === 'fall' && worldFalls % 4 === 3) say('السقوط جزء من التدريب 🥷 — خذ نفس وجرّب مرة ثانية.');
    cam.yaw = checkpoint.yaw; scarf.init = false; hudUpdate();
    setTimeout(() => { f.classList.remove('on'); fading = false; }, 120);
  }, why === 'death' ? 700 : 380);
}

/* ---------------- input ---------------- */
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const keys = {}, prev = {};
const vin = { jump: 0, atk: 0, roll: 0, act: 0, sp: 0 }, held = { jump: false, roll: false };
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
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch (_) {} vin[k]++; held[k] = true; b.classList.add('down'); });
  const up = () => { held[k] = false; b.classList.remove('down'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
});
const edge = (name, down) => { const p = prev[name]; prev[name] = down; return down && !p; };
function readInput() {
  let ix = 0, iy = 0;
  if (keys.KeyW || keys.ArrowUp) iy += 1; if (keys.KeyS || keys.ArrowDown) iy -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
  ix += virt.mx; iy += virt.my;
  let gj = false, ga = false, gr = false, gx = false, gs = false;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g) : null;
  if (remote.on) { ix += remote.mx; iy += remote.my; }
  if (gp) {
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    ix += dz(gp.axes[0]); iy -= dz(gp.axes[1]); cam.dx += dz(gp.axes[2] || 0) * 14; cam.dy += dz(gp.axes[3] || 0) * 10;
    const B = (i) => gp.buttons[i] && gp.buttons[i].pressed; gj = B(0); ga = B(2) || B(5); gr = B(1) || B(4); gx = B(3); gs = B(7) || B(6);
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
    spP: edge('sp', !!(keys.KeyL || keys.KeyQ)) || edge('gs', gs) || vin.sp > 0,
    jumpH: !!keys.Space || held.jump || gj || remote.jumpH || !!(__virt && __virt.jumpH),
    rollH: !!(keys.KeyK || keys.ShiftLeft || keys.ShiftRight || keys.KeyC) || held.roll || gr || remote.rollH || !!(__virt && __virt.rollH),
  };
  vin.jump = vin.atk = vin.roll = vin.act = vin.sp = 0;
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
    s.taken = true; s.g.removeFromParent(); const before = SAVE.shards.length; if (!SAVE.shards.includes(s.id)) SAVE.shards.push(s.id); persist(); sfx.shard(); sendTV({ vib: [20, 30, 20] }); unlockCheck(before);
    sparks.emit(s.g.position, { color: 0xffd166, count: 36, speed: 5, life: 0.7, size: 0.3 }); hudUpdate();
    const n = SAVE.shards.filter((x) => x.startsWith(cfg.id + '-')).length; if (n === cfg.shardTotal) say('جمعت كل شظايا هالعالم! 💎🌟');
  }
  // triggers
  for (const t of level.triggers) if (!t.fired && Math.hypot(t.pos.x - p.x, t.pos.z - p.z) < t.r && Math.abs(t.pos.y - p.y) < t.dy && started) { t.fired = true; if (t.text) say(t.text); if (t.group) spawnGroup(t.group); if (t.fn) t.fn(); }
  // breath & bubbles
  if (level.waters) {
    const W = G.waterAt(p), under = player.state === 'swim' && W && p.y + 1.62 < W.y1;
    breath = under ? breath - dt : Math.min(BREATH, breath + dt * 5);
    if (breath <= 0) { breath = 1.4; player.damage(1, new V(p.x, p.y + 3, p.z)); say('🫧 خلص الهوا! اطلع فوق أو دوّر فقاعة هوا.'); }
    for (const B of level.bubbles || []) { if (!B.g.visible) { B.t -= dt; if (B.t <= 0) B.g.visible = true; continue; } if (B.pos.distanceTo(new V(p.x, p.y + 1, p.z)) < 1.3) { breath = BREATH; B.g.visible = false; B.t = 6; sfx.tone(600, 1200, 0.2, 'sine', 0.1); sparks.emit(B.pos, { color: 0xe0ffff, count: 20, speed: 3, life: 0.5 }); } }
    const bb = $('#breath'); bb.classList.toggle('on', breath < BREATH - 0.05); $('#breathFill').style.width = Math.max(0, (breath / BREATH) * 100) + '%'; $('#breathFill').style.background = breath < 4 ? '#f87171' : '#7dd3fc';
  }
  // boss bar
  const boss = enemies.list.find((e) => e.boss && e.alive);
  $('#bossbar').classList.toggle('on', !!boss && boss.pos.distanceTo(p) < 35);
  if (boss) $('#bossFill').style.width = (boss.hp / boss.maxHp) * 100 + '%';
  // special cooldown
  const spb = document.getElementById('spBtn'); if (spb && G.upg.spin) spb.classList.toggle('cool', tNow < (player.spinReady || 0) - 0.01 && player.t < (player.spinReady || 0));
  // traps
  if (level.hazards && player.hp > 0) {
    const chest = new V(p.x, p.y + 1.1, p.z);
    for (const hz of level.hazards) {
      if (hz.kind === 'blade') { if (hz.tip.distanceTo(chest) < 0.95 || hz.mid.distanceTo(chest) < 0.8) { if (player.damage(1, new V(p.x + Math.sin(player.yaw) * 0.8, p.y, p.z + Math.cos(player.yaw) * 0.8))) sparks.emit(chest, { color: 0xffffff, count: 14, speed: 6, life: 0.3 }); } }
      else if (hz.kind === 'orb') { if (hz.tip.distanceTo(chest) < hz.r) player.damage(1, hz.tip); }
      else if (hz.kind === 'geyser') { if (hz.on && Math.hypot(p.x - hz.x, p.z - hz.z) < 1.0 && p.y - hz.y < 5 && p.y - hz.y > -0.5) { if (player.damage(1, new V(hz.x, p.y, hz.z + 0.01))) player.vel.y = 13; } }
      else if (hz.kind === 'spikes' && hz.up && p.x > hz.x0 && p.x < hz.x1 && p.z > hz.z0 && p.z < hz.z1 && p.y - hz.y < 0.6) player.damage(1, new V(p.x - player.vel.x, p.y, p.z - player.vel.z - 0.01));
    }
  }
  // timed gates
  if (level.gates) for (const G of level.gates) {
    if (player.onGround && Math.hypot(G.plate.x - p.x, G.plate.z - p.z) < 1.0 && Math.abs(G.plate.y - p.y) < 0.4) {
      if (G.left <= 0) { sfx.gate(); say(`⏱️ البوابة انفتحت ${G.time} ثواني — اركض!!`); } G.left = G.time; G.b.active = false;
    }
    if (G.left > 0) {
      const before = Math.ceil(G.left); G.left -= dt; const after = Math.ceil(G.left);
      $('#timer').textContent = '⏱️ ' + Math.max(0, after); $('#timer').classList.add('on');
      if (after < before && after <= 3 && after > 0) sfx.tone(880, 0, 0.12, 'square', 0.06);
      if (G.left <= 0) {
        const b = G.b, inside = p.x + 0.32 > b.min.x && p.x - 0.32 < b.max.x && p.z + 0.32 > b.min.z && p.z - 0.32 < b.max.z;
        if (inside) G.left = 0.3; else { b.active = true; sfx.gate(); $('#timer').classList.remove('on'); }
      }
    }
  }
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
function unlockCheck(before) {
  const n = SAVE.shards.length, u = UPG.find((x) => before < x.n && n >= x.n);
  if (u) { computeUpg(); hudUpdate(); banner('✨ ترقية جديدة: ' + u.name, u.desc); say('🎁 ' + u.name + ' — ' + u.desc); sfx.win(); }
}
function enterPortal(P) {
  sfx.portal(); sparks.emit(P.pos.clone().add(new V(0, 1.7, 0)), { color: P.color, count: 60, speed: 6, life: 0.9, size: 0.35 });
  if (P.to === 'hub') {
    if (cfg.id === 'w5' && !level.alarms && !SAVE.shards.includes('w5-10')) { const b = SAVE.shards.length; SAVE.shards.push('w5-10'); unlockCheck(b); say('🥷 تسلّلت بدون ولا إنذار! جايزة: شظية الظل 💎'); }
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
let last = performance.now(), acc = 0, manual = false, tvSendT = 0; const STEP = 1 / 120;
function simulate(dt) {
  if (stopT > 0) { stopT -= dt; dt *= 0.06; }
  tNow += dt;
  const inp = readInput();
  if (inp.actP) interact();
  acc += dt; let n = 0;
  while (acc >= STEP && n < 14) {
    level.update(STEP, player); player.update(STEP, inp); enemies.update(STEP, player);
    inp.jumpP = inp.atkP = inp.rollP = inp.actP = inp.spP = false; acc -= STEP; n++;
  }
  if (n === 14) acc = 0;
  worldLogic(dt);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('#toast').classList.remove('on'); }
}
loadWorld('hub', null);
applyQuality(qLevel);
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now; qTick(dt);
  if (!paused && started && !manual) simulate(dt);
  else if (!started) {
    // title: slow orbit around the plaza
    tNow += dt; cam.yaw += dt * 0.08; level.update(dt, player);
  }
  menuPoll(dt); player.animate(dt); animateNpc(dt);
  if (skin && skin.active) skin.update(dt, player); scarf.mesh.visible = !(skin && skin.active);
  hero.root.updateMatrixWorld(true);
  const r = new V(-Math.cos(player.yaw), 0, Math.sin(player.yaw));
  scarf.update(Math.min(dt, 1 / 30), hero.scarfAnchor.getWorldPosition(tmpA), r, player.vel, tNow);
  if (hero.sword.visible) { const b = hero.sword.localToWorld(tmpA.set(0, 0, 0.2)), t = hero.sword.localToWorld(tmpB.set(0, 0, 1.05)); trail.update(b, t, player.state === 'attack' || player.state === 'slam', dt); } else trail.update(tmpA, tmpA, false, dt);
  sparks.update(dt); dust.update(dt); motes.update(dt);
  updateCamera(dt);
  if (remote.on && (tvSendT -= dt) <= 0) { tvSendT = 0.35; sendTV({ hp: player.hp, max: player.maxHp, sh: $('#shards').textContent, sp: !!G.upg.spin }); }
  sun.position.copy(player.pos).addScaledVector(lightDir, 60); sun.target.position.copy(player.pos);
  sky.position.copy(camera.position);
  // underwater look
  const cw = G.waterAt(camera.position), uw = !!(cw && camera.position.y < cw.y1);
  scene.fog = uw ? waterFog : normalFog; $('#uw').classList.toggle('on', uw);
  renderFrame();
}
requestAnimationFrame(frame);

/* ---------------- debug / test hooks ---------------- */
window.__G = {
  get player() { return player; }, get skin() { return skin; }, THREE, get level() { return level; }, get enemies() { return enemies; }, get cam() { return cam; }, SAVE: () => SAVE,
  load: (id) => loadWorld(id, null), tp: (x, y, z, yaw = 0) => { player.spawn(new V(x, y, z), yaw); cam.yaw = yaw; scarf.init = false; },
  virt: (v) => { __virt = v; },
  manual: (v) => { manual = v; },
  // run the simulation deterministically for `sec` seconds (or until fn() is true); returns true if fn fired
  sim: (sec, fn) => { for (let t = 0; t < sec; t += 1 / 60) { simulate(1 / 60); player.animate(1 / 60); if (fn && fn()) return true; } return !fn; }, press: (k) => { vin[k]++; }, start: () => $('#startBtn').click(), setCamYaw: (y) => { cam.yaw = y; cam.lastManual = tNow + 999; },
};
