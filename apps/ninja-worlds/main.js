import * as THREE from 'three';
import { Sky } from 'sky';
import { Particles, Sound } from './fx.js';
import { buildHero, blendPose, BASE, Scarf, Trail, setSpy, setDisguise } from './hero.js';
import { Player } from './player.js';
import { Enemies } from './enemies.js';
import { Level, makeKit } from './kit.js';
import { WORLDS } from './worlds.js';
import { Stealth } from './stealth.js';
import { icon } from './icons.js';
import { remote, openTV, closeTV, sendTV, attachPortal } from './tv.js';
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
  try { window.Game && Game.save('ninja-worlds', { ...SAVE, score: n, scores: { 'ninja-worlds': n }, summary: `🌍 ${w} عوالم • 💎 ${n} • 🪙 ${SAVE.coins || 0}` }); } catch (e) {}
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
/* لو الجوال طيّح الرسم (WebGL context lost) — كانت تطلع شاشة سوداء والصوت شغال: نعيد التحميل بجودة أخف ونرجّعه لنفس العالم */
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  try { localStorage.setItem('nw_safe', '1'); if (typeof worldId === 'string') localStorage.setItem('nw_resume', worldId); } catch (er) {}
  try { sfx && sfx.music && sfx.music(null); } catch (er) {}
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:99;display:grid;place-items:center;background:#0b0b16;color:#fff;font:700 20px system-ui;text-align:center;padding:20px';
  d.textContent = '⚙️ الجوال تعب من الرسم… نعيد التحميل بجودة أخف'; document.body.appendChild(d);
  setTimeout(() => location.reload(), 1200);
}, false);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 6000);
const sky = new Sky(); sky.scale.setScalar(4500); scene.add(sky);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; scene.add(sun); scene.add(sun.target); scene.add(camera);
sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 140 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null;
const sunDir = new V(), lightDir = new V();
const BREATH = 12; let breath = 12, normalFog = null; const waterFog = new THREE.FogExp2(0x0b5f7a, 0.06);
/* ---------- lightweight bloom (HDR glow) ---------- */
let post = null, HQ = !LOW, bloomSamples = 2;
/* ---------- 📺 TV mode: built for weak smart-TV browsers (render small + upscale, cheap materials, no sky/shadows/glow, 30 fps lock) ---------- */
const TVUA = /SMART-?TV|SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|HbbTV|Android ?TV|AFT[A-Z]|CrKey|GoogleTV|VIDAA|Hisense|TV Safari|Opera TV|Viera|AQUOS|Philips|Roku/i.test(navigator.userAgent);
const STREAM_MODE = new URLSearchParams(location.search).has('stream');
let LITE = TVUA && !STREAM_MODE; try { const v = localStorage.getItem('nw_tv'); if (v != null && !STREAM_MODE) LITE = v === '1'; } catch (e) {}
const LITE_W = [960, 800, 680, 560, 440]; let liteLvl = 1, lock30 = false, skipFrame = false;
const liteCache = new Map();
function liteMat(m) {
  if (!m || !m.isMeshStandardMaterial) return m; let l = liteCache.get(m); if (l) return l;
  l = new THREE.MeshLambertMaterial({ color: m.color, map: m.map, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, transparent: m.transparent, opacity: m.opacity, side: m.side, flatShading: m.flatShading, depthWrite: m.depthWrite, vertexColors: m.vertexColors });
  liteCache.set(m, l); return l;
}
function liteify(root) {
  if (!LITE) return;
  root.traverse((o) => { if (o.userData && o.userData.far) o.visible = false; if (o.isMesh && o.material) { o.material = Array.isArray(o.material) ? o.material.map(liteMat) : liteMat(o.material); o.castShadow = o.receiveShadow = false; } if (o.isPointLight) o.visible = false; });
}
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
let RESUME = null; try { if (localStorage.getItem('nw_safe') === '1') { localStorage.removeItem('nw_safe'); if (qMode === 'auto') qLevel = Math.max(qLevel, 3); RESUME = localStorage.getItem('nw_resume'); localStorage.removeItem('nw_resume'); } } catch (e) {}
function applyLite() {
  document.body.classList.toggle('lite', LITE);
  if (!LITE) return;
  HQ = false; post = null; sun.castShadow = false; renderer.shadowMap.enabled = false; sky.visible = false; scene.environment = null;
  camera.far = 260; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, LITE_W[liteLvl] / Math.max(320, innerWidth)));
  if (level) liteify(level.group); if (hero) liteify(hero.root); if (scarf) liteify(scarf.mesh); if (npc) liteify(npc.root);
  for (const e of (enemies && enemies.list) || []) { liteify(e.m.g); if (e.m.bodyM) e.m.bodyM = liteMat(e.m.bodyM); }
  qLabel();
}
function applyQuality(i) {
  if (LITE) { liteLvl = Math.max(0, Math.min(LITE_W.length - 1, i)); applyLite(); qChanged = performance.now(); resize(); return; }
  qLevel = Math.max(0, Math.min(QL.length - 1, i)); const q = QL[qLevel];
  renderer.setPixelRatio(STREAM_MODE ? (q.dpr >= 1.6 ? 1.5 : q.dpr >= 1.3 ? 1.2 : 1) : Math.min(devicePixelRatio, q.dpr)); HQ = q.bloom; bloomSamples = q.msaa;
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
function qLabel() { const t = document.getElementById('pTVmode'); if (t) t.textContent = LITE ? `📺 وضع التلفزيون: شغّال (${LITE_W[liteLvl]}p${lock30 ? ' · ٣٠ إطار' : ''})` : '📺 وضع التلفزيون (للشاشات الضعيفة): طافي'; const b = document.getElementById('pHQ'); if (LITE && b) { b.textContent = `🎮 ${Math.round(fpsAvg)} إطار`; return; } if (b) b.textContent = `🎮 الجودة: ${qMode === 'auto' ? 'تلقائي (' + QL[qLevel].name + ')' : QL[qLevel].name} · ${Math.round(fpsAvg)} إطار`; }
function qTick(dt) {
  ftAcc += dt; ftN++;
  if (ftAcc < 1.2) return;
  fpsAvg = ftN / ftAcc; ftAcc = 0; ftN = 0;
  if (qMode !== 'auto' || !started || paused || document.hidden) return;
  const since = performance.now() - qChanged;
  if (LITE) {
    // prefer a steady 60 at a lower internal resolution; if even that fails, lock to a steady 30
    if (since < 2500) return;
    if (!lock30) { if (fpsAvg < 50) { if (liteLvl < 3) applyQuality(liteLvl + 1); else { lock30 = true; qLabel(); } } else if (fpsAvg > 59 && liteLvl > 0 && since > 9000) applyQuality(liteLvl - 1); }
    else if (fpsAvg < 55 && liteLvl < LITE_W.length - 1) applyQuality(liteLvl + 1);
    return;
  }
  if (fpsAvg < 50 && qLevel < QL.length - 1 && since > 2500) { qBlock[qLevel - 1] = performance.now(); applyQuality(qLevel + 1); }
  else if (fpsAvg > 58 && qLevel > 0 && since > 7000 && !(performance.now() - (qBlock[qLevel - 1] || -1e9) < 30000)) applyQuality(qLevel - 1);
}
function freezeStatic(root) { root.traverse((o) => { if (o.userData.dyn) return; o.updateMatrix(); o.matrixAutoUpdate = false; }); root.updateMatrixWorld(true); }
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
  onEnemyKilled: (e) => { G.hitstop(0.08); addCoins(e.boss ? 150 : e.big ? 20 : e.archer ? 8 : e.guard ? 6 : 5, e.pos); if (Math.random() < (player.hp <= 1 ? 0.45 : 0.18)) enemies.dropHeart(e.pos); },
  dropItem: (forced) => dropItem(forced),
  liteify: (r) => liteify(r), liteMat: (m) => liteMat(m),
  upg: {},
  waterAt: (p) => { if (!level || !level.waters) return null; for (const W of level.waters) if (p.x > W.x0 && p.x < W.x1 && p.z > W.z0 && p.z < W.z1 && p.y > W.y0 - 1 && p.y < W.y1 + 0.5) return W; return null; },
  splash: (p) => { sfx.noise(0.35, 900, 0.6, 0.22, 'bandpass', 0, 300); sparks.emit(p, { color: 0xd8f6ff, count: 26, speed: 4, up: 1.5, life: 0.6, size: 0.25, grav: 9 }); },
  playerHidden: () => { if (player.inLocker) return 'locker'; if (!level.shadows) return false; const p = player.pos, hs = Math.hypot(player.vel.x, player.vel.z); return hs < 4.8 && level.shadows.some((z) => p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1 && Math.abs(p.y - z.y) < 0.6); },
  onAlarm: () => { level.alarms = (level.alarms || 0) + 1; sfx.tone(880, 660, 0.25, 'square', 0.12); sfx.tone(880, 660, 0.25, 'square', 0.12, 0.3); if (level.alarms <= 3) say('🚨 انكشفت! الحارس شافك — حاربه أو اهرب للظل.'); },
  onRadio: (e) => stealth.radioDone(e),
  tryGrab: () => stealth.tryGrab(),
  onEdgeHang: () => { if (!level._edgeTip) { level._edgeTip = true; say('🧗 متعلّق برّا السفينة — الحراس ما يشوفونك! تحرّك يمين/يسار على طول الحافة، واقفز (أو ادفع للجدار) عشان تطلع.'); } },
  say: (t) => say(t),
  onCaptainDown: (e, how) => captainDown(e, how),
  disguised: () => stealth.disguisedInfo(),
  onSpotted: (e, search) => { sfx.tone(980, 980, 0.18, 'square', 0.12); stealth.spotted(e, search); },
  onBodyFound: () => stealth.bodyFound(),
  onGuardWoke: () => stealth.guardWoke(),
  onGuardSlept: (e) => { if (!e.sleptOnce) { e.sleptOnce = true; addCoins(4, e.pos); } },
  onTakedown: (e) => { level.takedowns = (level.takedowns || 0) + 1; sfx.tone(300, 120, 0.3, 'triangle', 0.15); sparks.emit(e.pos.clone().add(new V(0, 1.2, 0)), { color: 0xa78bfa, count: 30, speed: 4, life: 0.6 }); if (level.takedowns <= 2) say('🤫 ضربة صامتة! محد سمع شي.'); },
  onBossPhase: (ph) => { G.shake(0.5); say(ph === 2 ? '🔥 العملاق عصّب! صار يرمي كرات نار — ردّها عليه بالسيف!' : '🌋 المرحلة الأخيرة! يستدعي ظلال — ركّز وخلّصه!'); },
};
/* ---------- economy: coins are earned, upgrades are bought (nothing comes free) ---------- */
const SHOP = [
  { key: 'hearts', name: 'قلب إضافي ❤', desc: 'قلب زيادة بشريط حياتك', prices: [80, 160, 280, 450, 700] },
  { key: 'dmg', name: 'سيف أقوى 🔥', desc: '+١ ضرر لكل ضربة', prices: [220, 550] },
  { key: 'spin', name: 'الضربة الدوّامة ✴️', desc: 'زر ✴️ (أو L): لفّة سيف تضرب كل اللي حولك', prices: [250] },
  { key: 'dash', name: 'الاندفاع الجوي 💨', desc: 'وأنت في الهوا اضغط تدحرج = تندفع لقدّام', prices: [300] },
  { key: 'bolt', name: 'شحن البرق ⚡', desc: 'الدوّامة تشحن بنص الوقت', prices: [420], need: 'spin' },
  { key: 'darts', name: 'جعبة أسهم أكبر 🎯', desc: '+٤ أسهم مسدس و+٢ قنّاصة', prices: [120, 260] },
];
if (SAVE.coins == null) SAVE.coins = SAVE.shards.length * 15;
SAVE.upg = Object.assign({ hearts: 0, dmg: 0, spin: 0, dash: 0, bolt: 0, darts: 0 }, SAVE.upg || {});
const BASE_HP = 3;
function computeUpg() {
  const u = SAVE.upg;
  Object.assign(G.upg, { spin: u.spin > 0, fire: u.dmg > 0, dash: u.dash > 0, fastSpin: u.bolt > 0, dmg: u.dmg, hearts: u.hearts, darts: u.darts });
  if (player) { player.maxHp = BASE_HP + u.hearts; player.hp = Math.min(player.hp, player.maxHp); }
  if (trail) trail.c.setHex(G.upg.fastSpin ? 0x7df9ff : G.upg.fire ? 0xffa040 : 0x9be7ff);
  if (hero) hero.sword.traverse((o) => { if (o.material && o.material.color && o.geometry && o.geometry.parameters && o.geometry.parameters.depth > 0.8) { o.material.emissive && o.material.emissive.setHex(G.upg.fastSpin ? 0x0891b2 : G.upg.fire ? 0xc2410c : 0x000000); if (o.material.emissive) o.material.emissiveIntensity = 0.8; } });
  const sp = document.getElementById('spBtn'); if (sp) sp.dataset.v = ''; // يتحدّث كل فريم حسب الأداة/الدوّامة
}
function addCoins(n, at) {
  if (!n) return; SAVE.coins = Math.max(0, (SAVE.coins || 0) + n); persist(); hudUpdate();
  if (n > 0) { sfx.tone(1320, 1760, 0.12, 'square', 0.05); if (at) sparks.emit(at.clone().add(new V(0, 1.2, 0)), { color: 0xffd23f, count: Math.min(30, 6 + n), speed: 3, up: 1.5, life: 0.6, size: 0.22, grav: 5 }); }
  const c = $('#coins'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
}
function renderShop() {
  const u = SAVE.upg;
  $('#upgList').innerHTML = `<div class="shopHead">🪙 عندك ${SAVE.coins} عملة — تجمعها من الأعداء والشظايا وإنهاء العوالم</div>` + SHOP.map((it) => {
    const lv = u[it.key] | 0, price = it.prices[lv], max = price == null, locked = it.need && !(u[it.need] > 0);
    const tag = it.prices.length > 1 ? ` (${lv}/${it.prices.length})` : lv ? ' ✅' : '';
    return `<div class="u ${lv ? 'on' : ''}"><b>${it.name}${tag}</b><span>${it.desc}</span>${max ? '<em>✅ مكتمل</em>' : locked ? '<em>🔒 يحتاج الدوّامة أول</em>' : `<button class="buy" data-k="${it.key}" ${SAVE.coins < price ? 'data-poor="1"' : ''}>اشترِ — ${price} 🪙</button>`}</div>`;
  }).join('');
  $('#upgList').querySelectorAll('.buy').forEach((b) => (b.onclick = () => buy(b.dataset.k)));
}
function buy(key) {
  const it = SHOP.find((x) => x.key === key), lv = SAVE.upg[key] | 0, price = it.prices[lv];
  if (price == null) return;
  if (SAVE.coins < price) { say(`🪙 تحتاج ${price - SAVE.coins} عملة زيادة — حارب واجمع الشظايا!`); sfx.tone(200, 150, 0.2, 'square', 0.08); return; }
  SAVE.coins -= price; SAVE.upg[key] = lv + 1; computeUpg(); if (key === 'hearts') player.hp = Math.min(player.maxHp, player.hp + 1);
  persist(); hudUpdate(); renderShop(); sfx.win(); say('🎁 اشتريت: ' + it.name);
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
  es.add(s2); if (envRT) envRT.dispose(); envRT = pmrem.fromScene(es, 0.02); scene.environment = LITE ? null : envRT.texture; if (LITE) { sky.visible = false; scene.background = new THREE.Color(c.fog[0]); } s2.geometry.dispose(); s2.material.dispose();
}
let checkpoint = null, cfg = null, radioPaused = false;
function loadWorld(id, from) {
  if (level) level.dispose(); enemies.clear(); sparks.clear(); dust.clear(); motes.clear();
  if (npc) { npc.root.removeFromParent(); npc = null; }
  level = new Level(scene); worldId = id; SAVE._from = from; $('#timer').classList.remove('on');
  level.say = (t) => say(t); level.sfx = (n) => sfx[n] && sfx[n](); level.shake = (a) => G.shake(a); level.spawnGroup = spawnGroup; level.spawned = {};
  const K = makeKit(level); cfg = level.cfg = WORLDS[id](K, level, SAVE);
  // السفينة أثقل عالم: على الجوال نبدأ فيها بجودة «متوسطة» (بدون bloom وMSAA) والتلقائي يرفعها لو الجوال قدر
  setSpy(hero, !!cfg.ship); player.spy = !!cfg.ship; // في السفينة: بدلة تجسس وقتال بالأيدي
  if (cfg.ship && matchMedia('(pointer: coarse)').matches && qMode === 'auto' && !LITE && qLevel < 2) applyQuality(2);
  level.emit = (p, o) => sparks.emit(p, o); level.alarms = 0;
  level.onCrumble = (b) => { sfx.crumble(); dust.emit(b.center.clone(), { color: 0xc4b5fd, count: 20, speed: 3, life: 0.8, size: 0.5, grav: 3, spread: 1.5 }); };
  enemies.cullR = cfg.ship ? 55 : 0; for (const d of level.enemyDefs) if (!d.group) enemies.spawn(d);
  for (const it of level.items) it.origin = it.home.clone();
  applyAtmo(cfg);
  if (level.npcDef) { const d = level.npcDef; npc = buildHero('calm'); npc.root.position.set(d.x, d.y, d.z); npc.root.rotation.y = d.yaw; scene.add(npc.root); npc.line = 0; }
  checkpoint = level.checkpoints[0] ? { pos: level.checkpoints[0].pos, yaw: level.checkpoints[0].yaw } : null;
  computeUpg(); player.spawn(cfg.spawn.pos, cfg.spawn.yaw); player.hp = player.maxHp; breath = BREATH; normalFog = scene.fog; player.carry = null;
  if (!checkpoint) checkpoint = { pos: cfg.spawn.pos.clone(), yaw: cfg.spawn.yaw };
  cam.yaw = cfg.spawn.yaw; cam.pitch = 0.32; cam.target.copy(player.pos).add(new V(0, 1.5, 0)); cam.dist = cam.want;
  scarf.init = false; startTime = performance.now(); worldFalls = 0;
  level.useLights = QL[qLevel].lights; level.group.traverse((o) => { if (o.isPointLight) o.visible = QL[qLevel].lights; });
  level.buildGrid(); level.keys = {}; liteify(level.group); if (cfg.ship || cfg.batch) { try { level.batch(); } catch (e) { console.warn('batch failed', e); } } freezeStatic(level.group); tuneEnv(); banner(cfg.name, cfg.sub); hudUpdate(); stealth.setup(level, cfg); stormT = 4;
  if (started) sfx.music(cfg.music);
}
function spawnGroup(g) { if (level.spawned[g]) return; level.spawned[g] = true; for (const d of level.enemyDefs) if (d.group === g) enemies.spawn(d, true); tuneEnv(); }
function tuneEnv() { const k = (cfg && cfg.env) ?? 0.35; scene.traverse((o) => { if (o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = k; }); }

/* ---------------- UI ---------------- */
let toastT = 0, bannerT = 0, started = false, paused = false;
/* ---------- 📡 stream mode: this device (the phone) renders, the TV only plays it as live video ---------- */
const STREAM = new URLSearchParams(location.search).has('stream');
let streamCv = null, streamG = null, bannerShowT = 0, streamFps = 30, streamLast = 0;
if (STREAM) {
  streamCv = document.createElement('canvas'); streamCv.width = 1280; streamCv.height = 720; streamG = streamCv.getContext('2d');
  window.__getStream = () => { const ms = streamCv.captureStream(); if (sfx.streamDest) sfx.streamDest.stream.getAudioTracks().forEach((t) => ms.addTrack(t)); return ms; };
  window.__setStream = (w, h, fps) => { if (streamCv.width !== w) { streamCv.width = w; streamCv.height = h; } streamFps = fps; };
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, text, maxW) { const words = String(text).split(' '), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
function streamDraw() {
  const g = streamG, W = streamCv.width, H = streamCv.height, s = H / 720, F = (px, w = 800) => `${w} ${Math.round(px * s)}px system-ui, "Segoe UI", Tahoma, sans-serif`;
  g.drawImage(renderer.domElement, 0, 0, W, H);
  g.save(); g.direction = 'rtl'; g.textBaseline = 'middle';
  const pill = (x, y, w, h, txt, col = '#fff') => { g.fillStyle = 'rgba(10,12,28,.62)'; rr(g, x, y, w, h, h / 2); g.fill(); g.fillStyle = col; g.font = F(17); g.textAlign = 'center'; g.fillText(txt, x + w / 2, y + h / 2 + 1); };
  if (started) {
    // top bar (right side in RTL)
    g.font = F(30); g.textAlign = 'right'; let x = W - 24 * s;
    for (let i = 0; i < player.maxHp; i++) { g.fillStyle = i < player.hp ? '#ff4d6d' : 'rgba(255,255,255,.25)'; g.fillText('❤', x, 40 * s); x -= 34 * s; }
    x -= 10 * s; const pills = [[$('#shards').textContent, '#fff'], [$('#coins').textContent, '#ffd23f'], [$('#wname').textContent, '#e2e8f0']];
    for (const [t, c] of pills) { g.font = F(17); const w = g.measureText(t).width + 34 * s; pill(x - w, 22 * s, w, 36 * s, t, c); x -= w + 10 * s; }
    if (document.body.classList.contains('shipmode')) { const rc = $('#radar'); g.drawImage(rc, 20 * s, 70 * s, 132 * s, 132 * s); g.font = F(18, 900); g.textAlign = 'left'; g.fillStyle = '#fff'; g.direction = 'ltr'; g.fillText($('#ammo').textContent, 22 * s, 222 * s); g.direction = 'rtl'; }
    const ph = $('#phase'); if (ph.classList.contains('on')) { g.font = F(28, 900); g.textAlign = 'center'; g.fillStyle = ph.style.color || '#ff3b3b'; g.fillText(ph.textContent, W / 2, 92 * s); }
    const tm = $('#timer'); if (tm.classList.contains('on')) { g.font = F(34, 900); g.textAlign = 'center'; g.fillStyle = '#ffd166'; g.fillText(tm.textContent, W / 2, 92 * s); }
    if ($('#toast').classList.contains('on')) { g.font = F(19, 700); const lines = wrap(g, $('#toastText').textContent, 700 * s), bw = 780 * s, bh = (34 + lines.length * 28) * s, bx = (W - bw) / 2, by = 118 * s; g.fillStyle = 'rgba(20,24,60,.88)'; rr(g, bx, by, bw, bh, 18 * s); g.fill(); g.strokeStyle = 'rgba(125,211,252,.45)'; g.lineWidth = 2 * s; g.stroke(); g.fillStyle = '#7dd3fc'; g.font = F(14, 800); g.textAlign = 'right'; g.fillText('🧘 البطل الهادئ', bx + bw - 20 * s, by + 18 * s); g.fillStyle = '#fff'; g.font = F(19, 700); lines.forEach((l, i) => g.fillText(l, bx + bw - 20 * s, by + (44 + i * 28) * s)); }
    if ($('#prompt').classList.contains('on')) pill(W / 2 - 110 * s, H - 120 * s, 220 * s, 44 * s, $('#prompt').textContent.replace('[E] ', '✋ '), '#231600');
    if ($('#breath').classList.contains('on')) { const f = parseFloat($('#breathFill').style.width) / 100 || 0; g.fillStyle = 'rgba(0,0,0,.5)'; rr(g, W / 2 - 130 * s, 150 * s, 260 * s, 14 * s, 7 * s); g.fill(); g.fillStyle = f < 0.33 ? '#f87171' : '#7dd3fc'; rr(g, W / 2 - 130 * s, 150 * s, 260 * s * f, 14 * s, 7 * s); g.fill(); }
    if ($('#bossbar').classList.contains('on')) { const f = parseFloat($('#bossFill').style.width) / 100 || 0; g.fillStyle = 'rgba(0,0,0,.55)'; rr(g, W / 2 - 260 * s, H - 40 * s, 520 * s, 16 * s, 8 * s); g.fill(); g.fillStyle = '#ff6a00'; rr(g, W / 2 - 260 * s, H - 40 * s, 520 * s * f, 16 * s, 8 * s); g.fill(); g.font = F(15, 900); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('🌋 عملاق الحمم', W / 2, H - 56 * s); }
    if ($('#cross').classList.contains('on')) { g.strokeStyle = '#ff3030'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(W / 2 - 16 * s, H / 2); g.lineTo(W / 2 + 16 * s, H / 2); g.moveTo(W / 2, H / 2 - 16 * s); g.lineTo(W / 2, H / 2 + 16 * s); g.stroke(); }
    if ($('#scope').classList.contains('on')) { const R = H * 0.32; g.fillStyle = 'rgba(0,0,0,.96)'; g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, R, 0, Math.PI * 2, true); g.fill(); g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(W / 2 - R, H / 2); g.lineTo(W / 2 + R, H / 2); g.moveTo(W / 2, H / 2 - R); g.lineTo(W / 2, H / 2 + R); g.stroke(); }
    if (bannerShowT > 0) { bannerShowT -= 1 / 60; const a = Math.min(1, bannerShowT, 3.4 - bannerShowT); g.globalAlpha = Math.max(0, a); g.textAlign = 'center'; g.fillStyle = '#7dd3fc'; g.font = F(16, 800); g.fillText($('#bSub').textContent, W / 2, H * 0.24); g.fillStyle = '#fff'; g.font = F(52, 900); g.fillText($('#bName').textContent, W / 2, H * 0.3); g.globalAlpha = 1; }
    if ($('#fade').classList.contains('on')) { g.fillStyle = 'rgba(5,5,12,.85)'; g.fillRect(0, 0, W, H); }
  }
  // menus (title / pause / done) drawn as a panel with the focused button highlighted
  const menu = activeMenu();
  if (menu) {
    const title = menu.id === 'title', bs = menuButtons(menu), head = title ? 'النينجا المعصوب' : (menu.querySelector('h2') || {}).textContent || '';
    g.fillStyle = title ? 'rgba(5,5,15,.55)' : 'rgba(3,4,12,.66)'; g.fillRect(0, 0, W, H);
    const bw = 560 * s, bh = (140 + bs.length * 62) * s, bx = (W - bw) / 2, by = Math.max(20 * s, (H - bh) / 2);
    g.fillStyle = 'rgba(20,26,51,.95)'; rr(g, bx, by, bw, bh, 26 * s); g.fill();
    g.textAlign = 'center'; g.fillStyle = title ? '#ffd166' : '#fff'; g.font = F(title ? 46 : 30, 900); g.fillText(head, W / 2, by + 56 * s);
    bs.forEach((b, i) => { const y = by + (100 + i * 62) * s, foc = b.classList.contains('navfocus'); g.fillStyle = foc ? '#f59e0b' : 'rgba(255,255,255,.08)'; rr(g, bx + 30 * s, y, bw - 60 * s, 50 * s, 14 * s); g.fill(); if (foc) { g.strokeStyle = '#ffd166'; g.lineWidth = 3 * s; g.stroke(); } g.fillStyle = foc ? '#1a1200' : '#fff'; g.font = F(20, 800); g.fillText(b.textContent.trim().slice(0, 40), W / 2, y + 26 * s); });
  }
  g.restore();
}
function say(text) { $('#toastText').textContent = text; $('#toast').classList.add('on'); toastT = Math.min(11, 3.5 + text.length * 0.055); }
function banner(name, sub) { bannerShowT = 3.4; $('#bName').textContent = name; $('#bSub').textContent = sub || ''; const b = $('#banner'); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
function hudUpdate() {
  if (!player) return;
  $('#coins').textContent = '🪙 ' + (SAVE.coins || 0);
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
$('#doneBtn').onclick = () => { $('#done').classList.remove('on'); paused = false; goWorld('hub', cfg.id); };
/* ---------- شاشة التحميل: رسمة للعالم + اسم + جملة تشويقية + شريط — بدل الشاشة السوداء ---------- */
const WMETA = {
  hub: { sub: 'مركز العوالم', tease: 'البوابات تنتظرك… أي عالم بتدخل اليوم؟', sky: ['#1e1b4b', '#7c3aed', '#f59e0b'] },
  w1: { sub: 'العالم الأول', tease: 'مكتبة قديمة… بلّوراتها تهمس بأسرار الظلال', sky: ['#1c1917', '#b45309', '#fde68a'] },
  w2: { sub: 'العالم الثاني', tease: 'جزر معلّقة فوق الغيوم… لا تطالع تحت', sky: ['#0c4a6e', '#38bdf8', '#e0f2fe'] },
  w3: { sub: 'العالم الثالث', tease: 'حصن رملي ذهبي… والفخاخ مدفونة تحت الرمل', sky: ['#451a03', '#d97706', '#fde68a'] },
  w4: { sub: 'العالم الرابع', tease: 'تحت الماء… نفسك محدود، والأعماق ما ترحم', sky: ['#082f49', '#0e7490', '#67e8f9'] },
  w5: { sub: 'العالم الخامس', tease: 'قلعة الظلال… الحراس ما ينامون، والقمر يفضحك', sky: ['#020617', '#1e3a8a', '#a5b4fc'] },
  w6: { sub: 'العالم الأخير', tease: 'قلب البركان… العملاق صاحي', sky: ['#1c0a04', '#9a3412', '#fb923c'] },
  w7: { sub: 'عالم التسلّل', tease: 'ليلة عاصفة… سفينة مليانة حراس، وبوصلة الظل مخبّاة فوق الجسر', sky: ['#020617', '#1e293b', '#64748b'] },
};
const WORLD_NAMES = { hub: '🌀 ساحة البوابات', w1: '📚 أطلال المكتبة البلورية', w2: '☁️ الجزر السماوية', w3: '🏜️ حصن الرمال الذهبية', w4: '🌊 الأعماق الزرقاء', w5: '🌙 قلعة الظلال الليلية', w6: '🌋 قلب البركان', w7: '🚢 سفينة العاصفة' };
const TIPS = ['💡 الجدار المضيء بالرونات تقدر تركض عليه.', '💡 اضغط قفز قدّام الجدار = تطلع عليه.', '💡 في السفينة: ادفع للجدار = تلتصق فيه وتطل من الزاوية.', '💡 السفينة: اقفز جنب الحاجز = تتعلّق برّا والحراس ما يشوفونك.', '💡 امسك الحارس من الخلف ⚔️ وارمه في البحر عند الحافة 🌊.', '💡 القنّاصة: احبس نفسك 🫁 عشان يثبت المنظار.', '💡 الموجة الكبيرة = الحراس يتمسكون وما يشوفون — استغلها!', '💡 اخنق حارس = تاخذ الراديو، وتقلّد صوت القائد 📻.', '💡 الكوينز تشتري فيها ترقيات من 🛒 المتجر.', '💡 لا تطوّل وأنت ماسك الحارس — بيفلت ويعلن الإنذار!'];
function drawLoaderArt(id) {
  const cv = $('#ldArt'), dpr = Math.min(2, devicePixelRatio || 1), W = cv.width = Math.round(innerWidth * dpr), H = cv.height = Math.round(innerHeight * dpr), g = cv.getContext('2d');
  const m = WMETA[id] || WMETA.hub, R = (a, b) => a + Math.random() * (b - a);
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, m.sky[0]); sky.addColorStop(0.65, m.sky[1]); sky.addColorStop(1, m.sky[2]); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const hz = H * 0.66, sil = 'rgba(2,4,10,.92)';
  if (id === 'w7') {
    g.fillStyle = 'rgba(148,163,184,.25)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(R(0, W), R(0, H * 0.35), R(W * 0.15, W * 0.35), R(H * 0.05, H * 0.12), 0, 0, 7); g.fill(); }
    // برق
    g.strokeStyle = 'rgba(224,242,254,.95)'; g.lineWidth = 3 * dpr; g.shadowColor = '#bae6fd'; g.shadowBlur = 25 * dpr; g.beginPath(); let x = W * 0.72, y = 0; g.moveTo(x, y); while (y < hz * 0.8) { x += R(-40, 40) * dpr; y += R(25, 55) * dpr; g.lineTo(x, y); } g.stroke(); g.shadowBlur = 0;
    // بحر
    g.fillStyle = '#020617'; g.fillRect(0, hz, W, H - hz); g.strokeStyle = 'rgba(148,163,184,.35)'; g.lineWidth = 2 * dpr; for (let i = 0; i < 14; i++) { const yy = hz + i * (H - hz) / 14; g.beginPath(); for (let xx = 0; xx <= W; xx += 20 * dpr) g.lineTo(xx, yy + Math.sin(xx * 0.01 + i) * 6 * dpr); g.stroke(); }
    // السفينة
    const sx = W * 0.12, sw = W * 0.72, sy = hz - H * 0.02; g.fillStyle = sil; g.beginPath(); g.moveTo(sx, sy - H * 0.08); g.lineTo(sx + sw, sy - H * 0.08); g.lineTo(sx + sw + W * 0.08, sy - H * 0.13); g.lineTo(sx + sw - W * 0.02, sy + H * 0.03); g.lineTo(sx + W * 0.02, sy + H * 0.03); g.closePath(); g.fill();
    for (let i = 0; i < 9; i++) { const cw = sw * 0.06, ch = H * (0.03 + (i % 3) * 0.025); g.fillRect(sx + sw * 0.08 + i * cw * 1.15, sy - H * 0.08 - ch, cw, ch); }
    g.fillRect(sx + sw * 0.62, sy - H * 0.26, sw * 0.13, H * 0.18); g.fillRect(sx + sw * 0.66, sy - H * 0.33, sw * 0.03, H * 0.08);
    g.fillStyle = '#fde68a'; for (let i = 0; i < 4; i++) g.fillRect(sx + sw * (0.635 + i * 0.03), sy - H * 0.22, sw * 0.018, H * 0.02);
    // كشّاف
    const lg = g.createLinearGradient(sx + sw * 0.7, sy - H * 0.3, W * 0.2, H * 0.05); lg.addColorStop(0, 'rgba(254,249,195,.45)'); lg.addColorStop(1, 'rgba(254,249,195,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(sx + sw * 0.7, sy - H * 0.3); g.lineTo(W * 0.05, H * 0.02); g.lineTo(W * 0.3, -H * 0.05); g.closePath(); g.fill();
    // مطر
    g.strokeStyle = 'rgba(203,213,225,.35)'; g.lineWidth = 1.2 * dpr; for (let i = 0; i < 260; i++) { const rx = R(0, W), ry = R(0, H); g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 6 * dpr, ry + 22 * dpr); g.stroke(); }
  } else {
    g.fillStyle = 'rgba(255,255,255,.7)'; if (id === 'w5' || id === 'hub') for (let i = 0; i < 120; i++) g.fillRect(R(0, W), R(0, hz * 0.8), 1.5 * dpr, 1.5 * dpr);
    if (id === 'w5') { g.fillStyle = '#e0e7ff'; g.beginPath(); g.arc(W * 0.75, H * 0.22, H * 0.09, 0, 7); g.fill(); }
    if (id === 'w4') { g.fillStyle = 'rgba(224,242,254,.35)'; for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(R(0, W), R(0, H), R(2, 9) * dpr, 0, 7); g.fill(); } }
    g.fillStyle = sil;
    if (id === 'w6') { g.beginPath(); g.moveTo(W * 0.15, hz); g.lineTo(W * 0.42, H * 0.25); g.lineTo(W * 0.58, H * 0.25); g.lineTo(W * 0.85, hz); g.fill(); g.fillStyle = '#f97316'; g.shadowColor = '#fb923c'; g.shadowBlur = 40 * dpr; g.fillRect(W * 0.44, H * 0.24, W * 0.12, H * 0.02); g.shadowBlur = 0; g.fillStyle = sil; }
    else if (id === 'w2') { for (let i = 0; i < 5; i++) { const cx = W * (0.12 + i * 0.19), cy = H * R(0.35, 0.6), r = W * R(0.05, 0.09); g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r * 1.3); g.fill(); g.fillRect(cx - r, cy - H * 0.015, r * 2, H * 0.015); } }
    else { // أبراج/بوابات/أطلال
      for (let i = 0; i < 9; i++) { const w = W * R(0.05, 0.11), h = H * R(0.12, 0.34), x = (i / 9) * W + R(-10, 10); g.fillRect(x, hz - h, w, h + 2); if (id === 'hub' && i % 2) { g.fillStyle = m.sky[2]; g.globalAlpha = 0.5; g.beginPath(); g.ellipse(x + w / 2, hz - h * 0.55, w * 0.32, h * 0.32, 0, 0, 7); g.fill(); g.globalAlpha = 1; g.fillStyle = sil; } }
    }
    g.fillRect(0, hz, W, H - hz);
  }
}
let loading = false;
function goWorld(id, from) {
  if (loading) return; loading = true;
  const L = $('#loader'), m = WMETA[id] || WMETA.hub, name = WORLD_NAMES[id] || '';
  L.classList.remove('boot', 'out'); drawLoaderArt(id);
  $('#ldSub').textContent = m.sub; $('#ldTitle').textContent = name; $('#ldTease').textContent = m.tease; $('#ldTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  const bar = (p, t) => { $('#ldFill').style.width = p + '%'; $('#ldPct').textContent = t; };
  bar(8, 'تجهيز العالم…'); L.classList.add('on'); const t0 = performance.now();
  const raf2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));
  setTimeout(() => raf2(() => {
    bar(35, 'بناء المكان…');
    raf2(() => {
      try { loadWorld(id, from); } catch (e) { console.error(e); }
      bar(75, 'تجهيز الإضاءة والظلال…');
      raf2(() => {
        try { renderer.compile(scene, camera); } catch (e) {}
        bar(100, 'جاهز!');
        const wait = Math.max(0, 1100 - (performance.now() - t0));
        setTimeout(() => { L.classList.add('out'); setTimeout(() => { L.classList.remove('on', 'out'); loading = false; }, 460); }, wait);
      });
    });
  }), 60);
}
function fadeTo(fn) { const f = $('#fade'); f.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 80); }, 380); }
function togglePause(v) { if (!started || $('#done').classList.contains('on')) return; paused = v ?? !paused; $('#pause').classList.toggle('on', paused); $('#pHub').hidden = worldId === 'hub'; navIdx = 0; if (paused) setTimeout(() => menuNav(0), 30); }
/* ---------- console-style menu navigation (phone controller / gamepad): stick moves, jump selects, roll goes back ---------- */
let navIdx = 0, navCool = 0;
function activeMenu() {
  for (const s of ['#radio', '#tv', '#done', '#pause']) { const e = $(s); if (e && e.classList.contains('on')) return e; }
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
function menuBack() { if ($('#radio').classList.contains('on')) stealth.closeRadio(); else if ($('#tv').classList.contains('on')) closeTV(); else if (paused && $('#pause').classList.contains('on')) togglePause(false); }
let gpPrev = {};
function menuPoll(dt) {
  navCool = Math.max(0, navCool - dt);
  const m = activeMenu(); if (!m) { document.querySelectorAll('.navfocus').forEach((b) => b.classList.remove('navfocus')); return; }
  let y = remote.on ? remote.my : 0;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g) : null;
  if (gp && !gpAwake) { gpAwake = true; window.KeepAwake && window.KeepAwake.on(); }
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
$('#pHub').onclick = () => { togglePause(false); goWorld('hub', null); };
$('#pSound').onclick = () => { $('#pSound').textContent = sfx.toggle() ? '🔊 الصوت: شغّال' : '🔇 الصوت: مطفي'; };
$('#pHelp').onclick = () => $('#help').classList.toggle('on');
/* ---------- big-screen mode: this device renders, a phone is the controller ---------- */
const tvHooks = {
  press: (k, n) => {
    if (k === 'pause') { if ($('#tv').classList.contains('on')) closeTV(); else if (started) togglePause(); return; }
    if (activeMenu()) { if (k === 'jump' || k === 'act' || k === 'atk') menuSelect(); else if (k === 'roll') menuBack(); return; }
    if (k === 'zin' || k === 'zout') { stealth.zoomStep(k === 'zin' ? 1 : -1); return; }
    vin[k] = (vin[k] || 0) + n;
  },
  look: (dx, dy) => { cam.dx += dx; cam.dy += dy; },
  onConnect: () => { window.KeepAwake && window.KeepAwake.on(); autoTV(); document.body.classList.add('tvmode'); $('#touch').classList.remove('on'); $('#tvBadge').classList.add('on'); say('📱 الجوال صار يد التحكم! الشاشة هذي للعرض بس 📺'); sendTV({ hp: player.hp, max: player.maxHp, sh: $('#shards').textContent, sp: !!G.upg.spin }); },
  onDisconnect: () => { window.KeepAwake && window.KeepAwake.off(); $('#tvBadge').classList.remove('on'); say('⚠️ انقطع اتصال الجوال — افتح ⏸ ← 📺 عشان تربطه مرة ثانية.'); },
};
function autoTV() {
  let pref = null; try { pref = localStorage.getItem('nw_tv'); } catch (e) {}
  if (false && !LITE && pref !== '0') { LITE = true; applyQuality(1); setTimeout(() => say('📺 فعّلت «وضع التلفزيون» عشان تكون اللعبة سلسة على الشاشة — تقدر تطفيه من ⏸'), 1500); }
}
let MIRROR = false; try { MIRROR = localStorage.getItem('nw_mirror') === '1'; } catch (e) {}
function applyMirror() {
  document.body.classList.toggle('mirror', MIRROR);
  $('#pMirror').textContent = '🪞 وضع المرآة (لما تبث شاشة الجوال للتلفزيون): ' + (MIRROR ? 'شغّال ✅' : 'طافي');
  if (MIRROR) { if (LITE) { LITE = false; try { localStorage.setItem('nw_tv', '0'); } catch (e) {} } try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }
}
applyMirror();
$('#pMirror').onclick = () => { MIRROR = !MIRROR; try { localStorage.setItem('nw_mirror', MIRROR ? '1' : '0'); } catch (e) {} applyMirror(); if (MIRROR) say('🪞 وضع المرآة: الأزرار صارت شفافة عشان الصورة تطلع نظيفة على التلفزيون — اللعبة بأعلى جودة الجوال'); };
$('#pTVmode').onclick = () => { LITE = !LITE; try { localStorage.setItem('nw_tv', LITE ? '1' : '0'); } catch (e) {} if (LITE) applyQuality(1); else location.reload(); };
const openBig = () => { sfx.init(); try { if (window.parent !== window && window.parent.PortalCast) { window.parent.PortalCast.open(); return; } } catch (e) {} openTV(tvHooks); };
const ninjaLayout = () => ({ title: 'النينجا المعصوب', stick: true, look: true, pause: true, buttons: [{ id: 'jump', label: stealth.aiming ? '🫁 احبس نفسك (مطوّل)' : player && player.hullEdge && player.hullEdge() ? '🧗 تعلّق برّا' : '🦘 قفز' }, { id: 'atk', label: stealth.aiming ? '🎯 أطلق' : stealth.holding ? '😵 اخنق' : player && player.spy ? '👊 ضرب' : '⚔️ ضرب' }, { id: 'roll', label: '🌀 تدحرج' }, { id: 'act', label: stealth.aiming ? '🔁 سلاح' : stealth.holding ? '🌊 ارمِ' : player && player.state === 'hug' ? '🤜 طق' : '✋ شيل' }].concat(cfg && cfg.ship ? [{ id: 'aim', label: stealth.aiming ? '❌ إلغاء التصويب' : '🔫 مسدس' }] : []).concat(stealth.aiming ? [{ id: 'zin', label: '🔍＋' }, { id: 'zout', label: '🔍－' }] : []).concat(stealth.gadgetLabel() ? [{ id: 'sp', label: stealth.gadgetLabel() }] : G.upg.spin ? [{ id: 'sp', label: '✴️ دوّامة' }] : []) });
attachPortal(tvHooks, ninjaLayout);
if (STREAM) attachPortal(tvHooks, ninjaLayout, true);
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
$('#pUpg').onclick = () => { renderShop(); $('#upgList').classList.toggle('on'); };
$('#startBtn').onclick = () => {
  if (STREAM) { let pc = null; try { pc = window.parent.__padAudio; } catch (e) {} sfx.init(pc || undefined, true); } else sfx.init(); started = true; $('#title').classList.add('off'); setTimeout(() => $('#title').remove(), 900);
  sfx.music(cfg.music); $('#hudWrap').classList.add('on'); if (TOUCH) $('#touch').classList.add('on');
  try { if (TOUCH && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
  if (RESUME && RESUME !== worldId) { const r = RESUME; RESUME = null; setTimeout(() => goWorld(r, null), 300); }
  setTimeout(() => { const t = level.triggers.find((t) => !t.fired && Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z) < t.r); if (t) { t.fired = true; say(t.text); } }, 900);
};

/* ---------------- items ---------------- */
function nearItem() { let best = null, bd = 1.7; for (const it of level.items) { if (it.carried || it.placed) continue; const d = Math.hypot(it.pos.x - player.pos.x, it.pos.z - player.pos.z); if (d < bd && Math.abs(it.pos.y - 0.6 - player.pos.y) < 1.6) { bd = d; best = it; } } return best; }
function nearPed() { if (!player.carry) return null; for (const p of level.pedestals) { if (p.filled >= p.need || p.accept !== player.carry.kind) continue; if (Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) < 2.6 && Math.abs(p.pos.y - player.pos.y) < 1.5) return p; } return null; }
function nearNpc() { return npc && player.pos.distanceTo(npc.root.position) < 3 ? npc : null; }
/* طَرق على الجدار: صوت معدني يجذب أقرب حارس يفتّش مكان الطرق — تكتيك تسلل */
let knockCd = 0;
/* أزرار اللمس تتغيّر حسب الوضع (ضرب/أطلق/اخنق…) */
const PISTOL_SVG = '<svg viewBox="0 0 64 40" width="34" height="22" aria-hidden="true"><path fill="#e5e7eb" d="M4 8h44l4-4h8v10h-6l-2 3H30l-3 4h-6l-4 15H7l5-17H4z"/><rect x="48" y="9" width="12" height="3" fill="#9ca3af"/><circle cx="24" cy="16" r="3" fill="#111827"/></svg>';
const touchCache = {};
function setBtn(id, html) { if (touchCache[id] === html) return; touchCache[id] = html; const b = document.getElementById(id); if (b) b.innerHTML = html; }
const lab = (ic, t) => icon(ic) + '<small>' + t + '</small>';
function touchLabels() {
  const bc = document.body.classList; bc.toggle('m-aim', !!stealth.aiming); bc.toggle('m-hold', !!stealth.holding); bc.toggle('m-hang', player.state === 'hang' && !!player.edgeHang); bc.toggle('m-hug', player.state === 'hug'); bc.toggle('m-radio', !!stealth.radioOpen);
  const sh = cfg && cfg.ship, aim = stealth.aiming, hold = stealth.holding, hang = player.state === 'hang' && player.edgeHang, edge = sh && !aim && player.hullEdge && player.hullEdge();
  setBtn('atkBtn', aim ? lab('fire', 'أطلق') : hold ? lab('choke', 'اخنق') : sh ? (canGrab() ? lab('grab', 'امسكه') : lab('fist', 'ضرب')) : lab('sword', 'ضرب'));
  setBtn('aimBtn', aim ? lab('cancel', 'إلغاء') : lab('pistol', 'مسدس'));
  setBtn('actBtn', aim ? lab(stealth.weapon === 'pistol' ? 'sniper' : 'pistol', stealth.weapon === 'pistol' ? 'قنّاصة' : 'مسدس') : hold ? lab('wave', 'ارمِ') : player.state === 'hug' ? lab('knock', 'طق') : hang ? lab('none', '—') : lab('hand', 'شيل'));
  setBtn('jumpBtn', aim ? lab('breath', 'احبس نفسك') : edge ? lab('climb', 'تعلّق برّا') : hang ? lab('up', 'اطلع') : lab('jump', 'قفز'));
  setBtn('rollBtn', aim ? lab('back', 'رجوع') : hold ? lab('shove', 'دفّه') : hang ? lab('none', '—') : player.state === 'hang' ? lab('back', 'نزول') : lab(G.upg.dash ? 'dash' : 'roll', 'تدحرج'));
  const gl = stealth.gadgetLabel(); setBtn('spBtn', gl ? lab(gl.includes('📻') ? 'radio' : 'disguise', gl.replace(/^\S+\s/, '')) : lab('spin', 'دوّامة'));
}
function canGrab() {
  for (const e of enemies.list) {
    if (!e.ship || !e.alive || e.alert || e.hidden || ['sleep', 'dragged', 'held', 'dying', 'radio', 'drowsy'].includes(e.st)) continue;
    const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z, d = Math.hypot(dx, dz);
    if (d < 1.6 && Math.abs(player.pos.y - e.pos.y) < 1 && (dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / (d || 1) < -0.25) return true;
  }
  return false;
}
function knockWall() {
  if (knockCd > 0) return; knockCd = 0.6;
  const H = player.hug, at = player.pos.clone().addScaledVector(H.n, 0.4); at.y = player.pos.y;
  for (let i = 0; i < 2; i++) { sfx.tone(180 - i * 20, 120, 0.07, 'square', 0.12, i * 0.13); sfx.noise(0.06, 700, 2, 0.22, 'bandpass', i * 0.13); }
  enemies.noise(at, 10); sparks.emit(player.pos.clone().add(new V(0, 1.1, 0)).addScaledVector(H.n, -0.3), { color: 0xcbd5e1, count: 6, speed: 1.5, life: 0.3, size: 0.15 });
  if (!level._knockTip) { level._knockTip = true; say('🤜 طقّيت على الحديد — أقرب حارس بيجي يشوف وش الصوت. اختبئ واستغل اللحظة!'); }
}
/* «حاسة الأرض»: النينجا المعصوب ملزوق على الحديد يحس بخطوات الحراس — نبضات تبيّن من ورا الجدران */
const senseMarks = new Map();
function wallSense(dt) {
  knockCd = Math.max(0, knockCd - dt);
  const on = player.state === 'hug' && player.hug && player.hug.still > 0.35;
  for (const e of enemies.list) {
    let mk = senseMarks.get(e);
    const d = e.pos.distanceTo(player.pos), want = on && e.alive && !e.hidden && d < 16;
    if (!mk) { if (!want) continue; mk = makeSenseMark(); scene.add(mk); senseMarks.set(e, mk); }
    mk.userData.k = Math.max(0, Math.min(1, mk.userData.k + (want ? dt * 2.5 : -dt * 3)));
    mk.visible = mk.userData.k > 0.01; if (!mk.visible) continue;
    const walking = e.st !== 'sleep' && e.st !== 'idle' || e.wait <= 0, beat = 0.55 + 0.45 * Math.max(0, Math.sin(tNow * (walking ? 9 : 3) + e.pos.x));
    mk.position.set(e.pos.x, e.pos.y + 1.0, e.pos.z); mk.material.opacity = mk.userData.k * beat * (1 - d / 18);
    mk.material.color.setHex(e.alert ? 0xff4d4d : e.st === 'sleep' ? 0x60a5fa : e.st === 'inv' ? 0xfacc15 : 0xf8fafc);
  }
  for (const [e, mk] of senseMarks) if (!enemies.list.includes(e)) { mk.removeFromParent(); senseMarks.delete(e); }
  if (on && !level._senseTip) { level._senseTip = true; say('👂 وأنت ملزوق بالحديد تحس بخطوات الحراس: أبيض = يمشي عادي، أصفر = يفتّش، أحمر = منتبه، أزرق = نايم.'); }
}
let senseTex = null;
function makeSenseMark() {
  if (!senseTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 20, 0, Math.PI * 2); x.stroke(); senseTex = new THREE.CanvasTexture(c); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: senseTex, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  s.scale.set(1.6, 2.6, 1); s.renderOrder = 999; s.userData.k = 0; s.visible = false; return s;
}
function interact() {
  for (const P of level.panels || []) if (!P.done && Math.hypot(P.front.x - player.pos.x, P.front.z - player.pos.z) < 1.5 && Math.abs(P.pos.y - player.pos.y) < 1.2) {
    P.done = true; P.scr.material.color.setHex(0xef4444); P.gl.material.color.setHex(0xef4444); sfx.tone(600, 200, 0.4, 'sawtooth', 0.1); sparks.emit(P.pos.clone().add(new V(0, 1.1, 0)), { color: 0xfde68a, count: 30, speed: 4, life: 0.5 });
    const all = level.panels.filter((x) => x.group === P.group), left = all.filter((x) => !x.done).length;
    say(left ? `⚙️ ${P.label} — باقي ${left}` : `⚙️ ${P.label} — خلصت الكل!`); if (!left && level.onPanels && level.onPanels[P.group]) level.onPanels[P.group]();
    return;
  }
  if (player.state === 'hug' && player.hug && !stealth.dragging) { knockWall(); return; }
  if (stealth.interact()) return;
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
    if (why === 'death') { player.hp = player.maxHp; const lost = Math.floor((SAVE.coins || 0) * 0.2); if (lost) addCoins(-lost); say(lost ? `💀 طحت! خسرت ${lost} 🪙 ورجعت لآخر نقطة — ركّز أكثر.` : '💀 طحت! رجعت لآخر نقطة.'); }
    else if (why === 'fall' && worldFalls % 4 === 3) say('السقوط جزء من التدريب 🥷 — خذ نفس وجرّب مرة ثانية.');
    cam.yaw = checkpoint.yaw; scarf.init = false; hudUpdate();
    setTimeout(() => { f.classList.remove('on'); fading = false; }, 120);
  }, why === 'death' ? 700 : 380);
}

/* ---------------- input ---------------- */
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const keys = {}, prev = {};
const vin = { jump: 0, atk: 0, roll: 0, act: 0, sp: 0, aim: 0 }, held = { jump: false, roll: false };
const virt = { mx: 0, my: 0 }; // joystick
const cam = { yaw: 0, pitch: 0.32, dist: 6.4, want: 6.4, target: new V(), lastManual: -9, dx: 0, dy: 0 };
const stealth = new Stealth({ onCaptainDown: (e, how) => captainDown(e, how), setDisguise: (on) => setDisguise(hero, on), pauseFor: (v) => { if (v) { if (!paused) { paused = true; radioPaused = true; } } else if (radioPaused) { paused = false; radioPaused = false; } }, camera, cam, scene, sfx, sparks, say: (t) => say(t), addCoins: (n, at) => addCoins(n, at), level: () => level, upg: () => G.upg, get player() { return player; }, get enemies() { return enemies; }, get hero() { return hero; } });
let stormT = 4, flash = 0;
addEventListener('keydown', (e) => {
  /* TV remote / keyboard menu navigation: arrows move, OK/Enter selects, Back returns */
  const kc = e.keyCode, isBack = e.code === 'Backspace' || kc === 10009 || kc === 461 || e.key === 'GoBack' || e.key === 'BrowserBack';
  const m = activeMenu();
  if (m) {
    const k = e.code || e.key;
    if (k === 'ArrowUp' || k === 'ArrowLeft') { menuNav(-1); e.preventDefault(); return; }
    if (k === 'ArrowDown' || k === 'ArrowRight') { menuNav(1); e.preventDefault(); return; }
    if (k === 'Enter' || k === 'NumpadEnter' || kc === 13) { menuSelect(); e.preventDefault(); return; }
    if (isBack) { menuBack(); e.preventDefault(); return; }
  } else if (isBack && started) { togglePause(true); e.preventDefault(); return; }
  if (stealth.aiming) { if (['Equal', 'NumpadAdd', 'BracketRight', 'PageUp'].includes(e.code)) { stealth.zoomStep(1); e.preventDefault(); return; } if (['Minus', 'NumpadSubtract', 'BracketLeft', 'PageDown'].includes(e.code)) { stealth.zoomStep(-1); e.preventDefault(); return; } }
  keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); if (e.code === 'Escape' || e.code === 'KeyP') togglePause(); if (e.code === 'Enter' && !started) $('#startBtn').click(); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
let mouse = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button === 2) { vin.aim++; return; }
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
try { $('#zIn').innerHTML = icon('zin'); $('#zOut').innerHTML = icon('zout'); $('#zBreath').innerHTML = icon('breath') + '<small>مطوّل</small>'; } catch (e) {}
/* ---------- 📲 تثبيت كتطبيق (ملء الشاشة، بالعرض، أيقونة) ---------- */
const IN_FRAME = window.parent !== window, IS_APP = matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone;
try { if ('serviceWorker' in navigator && !IN_FRAME) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#installBtn').hidden = false; if (new URLSearchParams(location.search).get('install')) showInstall(); });
addEventListener('appinstalled', () => { $('#installBtn').hidden = true; say('📲 تم التثبيت! افتح «النينجا المعصوب» من الشاشة الرئيسية — بيفتح ملء الشاشة 🎮'); });
if (!IS_APP && !STREAM && /Android|iPhone|iPad/i.test(navigator.userAgent)) $('#installBtn').hidden = false;
function showInstall() {
  if (IN_FRAME) { try { window.top.location.href = new URL('./?install=1', location.href).href; } catch (e) { location.href = './?install=1'; } return; } // التثبيت لازم يكون من صفحة اللعبة نفسها
  if (installEvt) { $('#installSteps').innerHTML = '<div style="text-align:center">🥷 أيقونة على الشاشة الرئيسية • ملء الشاشة • بالعرض • التحديثات تنزل تلقائياً</div>'; $('#installGo').textContent = '📲 ثبّت الآن'; $('#installSheet').classList.add('on'); return; }
  const ios = /iPhone|iPad/i.test(navigator.userAgent);
  $('#installSteps').innerHTML = ios ? '<ol><li>اضغط زر المشاركة ⬆️ تحت في سفاري</li><li>اختر «إضافة إلى الشاشة الرئيسية»</li><li>افتح «النينجا المعصوب» من الأيقونة 🥷</li></ol>'
    : '<ol><li>اضغط ⋮ (الثلاث نقاط) فوق في كروم</li><li>اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»</li><li>افتح «النينجا المعصوب» من الأيقونة 🥷 — تفتح ملء الشاشة وبالعرض</li></ol><div>💡 التحديثات توصلك تلقائياً، ما تحتاج تنزّل شي من جديد.</div>';
  $('#installSheet').classList.add('on');
}
$('#installBtn').onclick = (e) => { e.stopPropagation(); showInstall(); };
$('#installGo').onclick = () => { $('#installSheet').classList.remove('on'); if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; }); } $('#installGo').textContent = 'تمام 👍'; };
if (IS_APP) document.body.classList.add('isApp');
document.querySelectorAll('#radio .rcmd').forEach((b) => (b.onclick = () => stealth.command(b.dataset.cmd))); $('#rClose').onclick = () => stealth.closeRadio();
// قرص بإصبعين على الشاشة وقت التصويب = تكبير/تصغير
{ let pd = 0; const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  addEventListener('touchstart', (e) => { if (stealth.aiming && e.touches.length === 2) pd = dist(e.touches); }, { passive: true });
  addEventListener('touchmove', (e) => { if (!stealth.aiming || e.touches.length !== 2 || !pd) return; const d = dist(e.touches); if (d / pd > 1.35) { stealth.zoomStep(1); pd = d; } else if (pd / d > 1.35) { stealth.zoomStep(-1); pd = d; } }, { passive: true });
  addEventListener('touchend', (e) => { if (e.touches.length < 2) pd = 0; }, { passive: true }); }
addEventListener('wheel', (e) => { if (!stealth.aiming) return; e.preventDefault(); stealth.zoomStep(e.deltaY < 0 ? 1 : -1); }, { passive: false });
{ const zi = $('#zIn'), zo = $('#zOut'), zb = $('#zBreath');
  const tap = (el, fn) => el && el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
  tap(zi, () => stealth.zoomStep(1)); tap(zo, () => stealth.zoomStep(-1));
  if (zb) { const on = (v) => (e) => { e.preventDefault(); e.stopPropagation(); stealth.touchBreath = v; zb.classList.toggle('held', v); }; zb.addEventListener('pointerdown', on(true)); ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => zb.addEventListener(t, on(false))); } }
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
  let gj = false, ga = false, gr = false, gx = false, gs = false, gaim = false;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g) : null;
  if (remote.on) { ix += remote.mx; iy += remote.my; }
  if (gp) {
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    ix += dz(gp.axes[0]); iy -= dz(gp.axes[1]); cam.dx += dz(gp.axes[2] || 0) * 14; cam.dy += dz(gp.axes[3] || 0) * 10;
    const B = (i) => gp.buttons[i] && gp.buttons[i].pressed; gj = B(0); ga = B(2) || B(5); gr = B(1) || B(4); gx = B(3); gs = B(7); gaim = B(6);
    if (edge('gstart', B(9))) togglePause();
    if (stealth.aiming) { if (edge('gzi', B(12))) stealth.zoomStep(1); if (edge('gzo', B(13))) stealth.zoomStep(-1); }
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
    aimP: edge('aim', !!keys.KeyR) || edge('gaim', gaim) || vin.aim > 0,
    jumpH: !!keys.Space || held.jump || gj || remote.jumpH || !!(__virt && __virt.jumpH),
    rollH: !!(keys.KeyK || keys.ShiftLeft || keys.ShiftRight || keys.KeyC) || held.roll || gr || remote.rollH || !!(__virt && __virt.rollH),
  };
  vin.jump = vin.atk = vin.roll = vin.act = vin.sp = vin.aim = 0;
  return inp;
}
let __virt = null, gpAwake = false;

/* ---------------- camera ---------------- */
const ray = new THREE.Raycaster(); let tNow = 0;
/* المطر ما ينزل داخل السرداب أو الغرف: نفحص فوق الكاميرا لين ٤٠م (كل ربع ثانية) */
let roofT = 0, roofV = false; const roofRay = new THREE.Raycaster();
function underRoof() {
  if (tNow - roofT < 0.25) return roofV; roofT = tNow;
  roofRay.set(camera.position, new V(0, 1, 0)); roofRay.far = 40; const a = roofRay.intersectObjects(level.camMeshes, false).length > 0;
  roofRay.set(player.pos.clone().add(new V(0, 1.6, 0)), new V(0, 1, 0)); const b = roofRay.intersectObjects(level.camMeshes, false).length > 0;
  return (roofV = a || b);
}
function updateCamera(dt) {
  if (stealth.camera(dt, cam)) { if (shakeAmt > 0) { camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.3; shakeAmt = Math.max(0, shakeAmt - dt * 1.6); } return; }
  const p = player.pos, tgt = new V(p.x, p.y + 1.5, p.z);
  if (player.state === 'hug' && player.hug) {
    // كاميرا الالتصاق: قدّام البطل تشوف الجدار ووجهه — ولما يطل، تنتقل فوق كتفه وتشوف ورا الزاوية
    const H = player.hug, n = H.n, pk = H.peek, e = H.edge || 0;
    const hugYaw = Math.atan2(-n.x, -n.z) + (e ? 0 : 0.35), look = e ? new V(H.t.x * e, 0, H.t.z * e) : null;
    const peekYaw = look ? Math.atan2(look.x, look.z) : hugYaw;
    let want = hugYaw + angDiff(hugYaw, peekYaw) * pk;
    if (tNow - cam.lastManual > 0.8) cam.yaw += angDiff(cam.yaw, want) * Math.min(1, dt * 5);
    tgt.addScaledVector(n, 0.35 + 0.5 * pk); if (look) tgt.addScaledVector(look, 0.55 * pk); tgt.y -= 0.15 * pk;
    cam.hugK = Math.min(1, (cam.hugK || 0) + dt * 3);
  } else cam.hugK = Math.max(0, (cam.hugK || 0) - dt * 3);
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
  // indoors: drop to shoulder height under low ceilings so the view is not just the floor
  ray.set(cam.target, new V(0, 1, 0)); ray.far = 3.2; const roof = ray.intersectObjects(level.camMeshes, false).length > 0;
  const restP = roof ? 0.1 : 0.32; cam.roof = roof;
  if (tNow - cam.lastManual > 2 || roof) cam.pitch += (restP - cam.pitch) * Math.min(1, dt * (roof ? 2.5 : 0.8));
  cam.want = innerWidth < innerHeight ? 7.6 : 6.4; if (cam.hugK) cam.want += (((player.hug && player.hug.peek > 0.3) ? 2.6 : 4.2) - cam.want) * cam.hugK;
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
/* ---------- 🌊 تمايل السفينة + الموجات الكبيرة ---------- */
let swellT = 0, waveNext = 40, waveWarn = 0, waveHit = 0;
function shipDeckOutdoor(p) { return p.y > -0.6 && p.y < 1.6 && !(p.z > 117 && p.z < 157 && Math.abs(p.x) < 9); }
function captainDown(e, how) {
  if (level.captainDown) return; level.captainDown = true; level.complete = true; if (level.exitPortal) level.exitPortal.setActive(true);
  addCoins(100, player.pos); sfx.win && sfx.win(); G.shake(0.4);
  say(how === 'sea' ? '⚓🌊 رميت القائد «عاصفة» في البحر!! السفينة صارت لك — المروحية تنتظرك على المهبط 🚁' : '⚓😴 القائد «عاصفة» نام! السفينة صارت لك — المروحية تنتظرك على المهبط 🚁');
}
function captainLogic() {
  if (!cfg || !cfg.captain || !level.relicTaken || level.capSpawned) return;
  if (player.pos.z > 200 && player.pos.y > -0.6 && player.pos.y < 2) {
    level.capSpawned = true; const c = cfg.captain;
    const e = enemies.spawn({ x: c.x, y: c.y, z: c.z, type: 'guard', alert: true, zone: c.zone, captain: true }); e.yaw = Math.PI;
    say('⚓ «عاصفة»: «توقّعتك تجي… محد يطلع من سفينتي.» — صوّب على راسه (٣ رؤوس تنيّمه)، ولما يعبّي سلاحه أو تضرب الموجة: امسكه من الخلف وارمه في البحر!');
    sfx.tone(110, 80, 1.2, 'sawtooth', 0.12); G.shake(0.3);
  }
}
function waveLogic(dt) {
  if (!cfg || !cfg.ship || !started) { level && (level.waveHit = 0); return; }
  swellT += dt;
  if (waveWarn > 0) { waveWarn -= dt; if (waveWarn <= 0) { waveHit = 1.8; G.shake(0.5); sfx.noise(1.6, 180, 0.5, 0.35, 'lowpass'); sfx.noise(1.2, 900, 0.4, 0.12, 'bandpass', 0.2);
      for (let i = 0; i < 4; i++) sparks.emit(new V(Math.sign(Math.random() - 0.5) * 15.5, 1.5, player.pos.z + (Math.random() - 0.5) * 20), { color: 0xe0f2fe, count: 30, speed: 7, up: 7, life: 1, size: 0.4, grav: 8 }); } }
  else if (waveHit > 0) waveHit -= dt;
  else if ((waveNext -= dt) <= 0) { waveNext = 45 + Math.random() * 30; waveWarn = 2.4; say('🌊 موجة كبيرة جاية! تمسّك… أو استغلها: الحراس على السطح بيتمسكون وما بيشوفون شي'); sfx.tone(90, 60, 2.2, 'sine', 0.12); }
  level.waveHit = waveHit;
  // تدفّك الموجة وأنت على السطح المكشوف
  if (waveHit > 0 && player.onGround && shipDeckOutdoor(player.pos) && !player.inLocker && player.state !== 'hug') {
    const side = Math.sin(swellT * 0.9) >= 0 ? 1 : -1, f = 5.5 * Math.min(1, waveHit / 0.5);
    player.vel.x += side * f * dt * 3; player.vel.z += Math.sin(swellT * 0.6) * f * dt;
  }
}
function applySwell(dt) {
  if (!cfg || !cfg.ship) return;
  const big = waveHit > 0 ? Math.min(1, waveHit / 0.5) : 0, warm = waveWarn > 0 ? 0.3 : 0;
  const roll = (0.022 + 0.07 * big + 0.02 * warm) * Math.sin(swellT * 0.9) + 0.012 * Math.sin(swellT * 0.37);
  const pitch = (0.012 + 0.03 * big) * Math.sin(swellT * 0.53 + 1);
  const k = stealth.aiming ? 0.35 : player.inLocker ? 0.5 : 1;
  camera.rotateZ(roll * k); camera.rotateX(pitch * k * 0.6);
}
function worldLogic(dt) {
  waveLogic(dt); captainLogic();
  const p = player.pos;
  stealth.update(dt); wallSense(dt);
  // automatic sliding doors (locked ones need the right keycard)
  for (const D of level.doors || []) {
    const dp = Math.hypot(D.pos.x - p.x, D.pos.z - p.z), near = dp < 2.4 && Math.abs(D.pos.y - p.y) < 2;
    const ok = !D.lock || level.keys[D.lock];
    let want = near && ok && !player.inLocker;
    if (!want) for (const e of enemies.list) if (e.alive && e.st !== 'sleep' && e.st !== 'dragged' && Math.abs(e.pos.y - D.pos.y) < 2 && Math.hypot(D.pos.x - e.pos.x, D.pos.z - e.pos.z) < 2.1) { want = true; break; }
    if (near && !ok && !D.warned) { D.warned = true; say('🔒 الباب مقفول — يحتاج «' + D.lock + '»'); sfx.tone(220, 180, 0.15, 'square', 0.08); }
    if (!near) D.warned = false;
    const was = D.open; D.open += ((want ? 1 : 0) - D.open) * Math.min(1, dt * 7);
    if ((was < 0.05 && D.open >= 0.05) || (was > 0.95 && D.open <= 0.95 && !want)) sfx.noise(0.35, 500, 0.8, 0.08, 'bandpass', 0, 1400);
    D.b.mesh.position.y = D.base + D.open * (D.h - 0.15); D.b.active = D.open < 0.55;
    if (ok && D.lock) D.stripe.material.color.setHex(0x4ade80);
  }
  // keycards
  for (const C of level.cards || []) if (!C.taken && C.pos.distanceTo(new V(p.x, p.y + 0.8, p.z)) < 1.3) { C.taken = true; C.g.removeFromParent(); level.keys[C.name] = true; sfx.pickup(); say('🗝️ أخذت «' + C.name + '»'); }
  if (cfg.storm) { stormT -= dt; if (stormT < 0) { stormT = 6 + Math.random() * 9; flash = 1; setTimeout(() => sfx.noise(2.2, 90, 0.4, 0.5, 'lowpass', 0, 40), 400 + Math.random() * 900); }
    flash = Math.max(0, flash - dt * 5); hemi.intensity = cfg.hemi[2] * (1 + 4 * flash * (flash > 0.6 || flash < 0.35 ? 1 : 0.3));
    if (level.rainMesh) { level.rainMesh.position.set(p.x, p.y - 4, p.z); level.rainMesh.visible = !cam.roof && !underRoof(); } }
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
  const boss = enemies.list.find((e) => (e.boss || e.captain) && e.alive && e.st !== 'sleep');
  $('#bossbar').classList.toggle('on', !!boss && boss.pos.distanceTo(p) < 35);
  if (boss) { $('#bossFill').style.width = (boss.captain ? boss.capHp / boss.capMax : boss.hp / boss.maxHp) * 100 + '%'; const nm = boss.captain ? '⚓ القائد «عاصفة»' + (boss.reloadT > 0 ? ' — يعبّي!' : '') : '🌋 عملاق الحمم'; const bb = $('#bossbar'); if (bb.firstChild.nodeValue !== nm) bb.firstChild.nodeValue = nm; }
  // special cooldown
  const spb = document.getElementById('spBtn'); if (spb && G.upg.spin) spb.classList.toggle('cool', tNow < (player.spinReady || 0) - 0.01 && player.t < (player.spinReady || 0));
  // traps
  if (level.hazards && player.hp > 0) {
    const chest = new V(p.x, p.y + 1.1, p.z);
    for (const hz of level.hazards) {
      if (hz.kind === 'blade') { if (hz.tip.distanceTo(chest) < 0.95 || hz.mid.distanceTo(chest) < 0.8) { if (player.damage(1, new V(p.x + Math.sin(player.yaw) * 0.8, p.y, p.z + Math.cos(player.yaw) * 0.8))) sparks.emit(chest, { color: 0xffffff, count: 14, speed: 6, life: 0.3 }); } }
      else if (hz.kind === 'orb') { if (hz.tip.distanceTo(chest) < hz.r) player.damage(1, hz.tip); }
      else if (hz.kind === 'geyser') { if (hz.on && Math.hypot(p.x - hz.x, p.z - hz.z) < 1.0 && p.y - hz.y < 5 && p.y - hz.y > -0.5) { if (player.damage(1, new V(hz.x, p.y, hz.z + 0.01)) && !hz.soft) player.vel.y = 13; } }
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
  { const spb = $('#spBtn'), want = !!(stealth.gadgetLabel() || G.upg.spin); if (spb && spb.dataset.v !== String(want)) { spb.dataset.v = String(want); spb.style.display = want ? '' : 'none'; } }
  touchLabels();
  const edgeN = stealth.on && stealth.seaEdge();
  if (stealth.holding) label = edgeN ? 'ارمه في البحر 🌊' : 'اخنقه ⚔️ • ارمه عند الحافة ✋';
  else if (stealth.dragging && edgeN) label = 'ارمه في البحر 🌊';
  else if (stealth.on && !stealth.dragging && canGrab()) label = 'امسكه من الخلف ⚔️';
  else if (stealth.on && !stealth.aiming && player.hullEdge && player.hullEdge()) label = 'اقفز 🦘 = تعلّق برّا السفينة وتختفي 🧗';
  else if (player.state === 'hang' && player.edgeHang) label = 'متعلّق برّا 🧗 — تحرّك يمين/يسار • اقفز = اطلع';
  else if (player.state === 'hug' && !player.carry) label = player.hug && player.hug.peek > 0.5 ? 'طق 🤜 (أنت تطل 👀)' : 'طق على الجدار 🤜';
  else if (player.carry) label = nearPed() ? 'ضع ✨' : 'نزّل';
  else if (nearItem() && player.onGround) label = 'شيل';
  else if (nearNpc()) label = 'كلّمه';
  if (label !== promptKind) { promptKind = label; $('#prompt').textContent = label ? (/⚔️|🌊|🧗/.test(label) ? '' : TOUCH ? '✋ ' : '[E] ') + label : ''; $('#prompt').classList.toggle('on', !!label); $('#actBtn').classList.toggle('hot', !!label); }
  // ambience
  if (Math.random() < dt * 18) { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 14; motes.emit(new V(p.x + Math.cos(a) * r, p.y + Math.random() * 6, p.z + Math.sin(a) * r), { color: cfg.motes, count: 1, speed: 0.3, life: 4, size: 0.12, grav: -0.06, drag: 0.2 }); }
  if (level.petalTrees && Math.random() < dt * 4) { const t = level.petalTrees[Math.floor(Math.random() * level.petalTrees.length)]; dust.emit(t.pos.clone().add(new V((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)), { color: t.color, count: 1, speed: 0.6, life: 4.5, size: 0.14, grav: 0.35, drag: 0.6 }); }
}
function unlockCheck() { addCoins(25, player.pos); }
function enterPortal(P) {
  sfx.portal(); sparks.emit(P.pos.clone().add(new V(0, 1.7, 0)), { color: P.color, count: 60, speed: 6, life: 0.9, size: 0.35 });
  if (P.to === 'hub') {
    if (cfg.ship && level.complete && !level.alarms) { addCoins(150); if (!SAVE.shards.includes('w7-10')) SAVE.shards.push('w7-10'); say('👻 شبح السفينة! ما انكشفت ولا مرة: +١٥٠ 🪙 وشظية الشبح 💎'); }
    if (cfg.id === 'w5' && !level.alarms && !SAVE.shards.includes('w5-10')) { const b = SAVE.shards.length; SAVE.shards.push('w5-10'); unlockCheck(b); say('🥷 تسلّلت بدون ولا إنذار! جايزة: شظية الظل 💎'); }
    const first = !SAVE.done[cfg.id]; if (level.complete) addCoins(first ? 100 : 25); SAVE.done[cfg.id] = true; const sec = Math.round((performance.now() - startTime) / 1000);
    if (!SAVE.best[cfg.id] || sec < SAVE.best[cfg.id]) SAVE.best[cfg.id] = sec; persist();
    if (level.complete) { fading = true; setTimeout(() => { fading = false; showDone(); }, 300); return; }
    goWorld('hub', cfg.id); return;
  }
  goWorld(P.to, 'hub');
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
let last = performance.now(), acc = 0, manual = false, tvSendT = 0; const STEP = LITE ? 1 / 60 : 1 / 120;
function simulate(dt) {
  if (stopT > 0) { stopT -= dt; dt *= 0.06; }
  tNow += dt;
  const inp = readInput();
  stealth.preInput(inp);
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
setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => { const L = $('#loader'); L.classList.add('out'); setTimeout(() => L.classList.remove('on', 'out', 'boot'), 460); })), 200);
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now; qTick(dt);
  if (!paused && started && !manual) simulate(dt);
  else if (!started) {
    // title: slow orbit around the plaza
    tNow += dt; cam.yaw += dt * 0.08; level.update(dt, player);
  }
  menuPoll(dt); player.animate(dt); animateNpc(dt);
  if (skin && skin.active) skin.update(dt, player); scarf.mesh.visible = !(skin && skin.active) && !hero.spy;
  if (stealth.aiming || player.inLocker) { hero.root.visible = false; scarf.mesh.visible = false; trail.mesh.visible = false; }
  hero.root.updateMatrixWorld(true);
  const r = new V(-Math.cos(player.yaw), 0, Math.sin(player.yaw));
  scarf.update(Math.min(dt, 1 / 30), hero.scarfAnchor.getWorldPosition(tmpA), r, player.vel, tNow);
  if (hero.sword.visible) { const b = hero.sword.localToWorld(tmpA.set(0, 0, 0.2)), t = hero.sword.localToWorld(tmpB.set(0, 0, 1.05)); trail.update(b, t, player.state === 'attack' || player.state === 'slam', dt); } else trail.update(tmpA, tmpA, false, dt);
  sparks.update(dt); dust.update(dt); motes.update(dt);
  updateCamera(dt); applySwell(dt);
  if (remote.on && (tvSendT -= dt) <= 0) { tvSendT = 0.35; sendTV({ hp: player.hp, max: player.maxHp, sh: $('#shards').textContent, sp: !!G.upg.spin }); }
  sun.position.copy(player.pos).addScaledVector(lightDir, 60); sun.target.position.copy(player.pos);
  sky.position.copy(camera.position);
  if (LITE && lock30) { skipFrame = !skipFrame; if (skipFrame) return; }
  // underwater look
  const cw = G.waterAt(camera.position), uw = !!(cw && camera.position.y < cw.y1);
  scene.fog = uw ? waterFog : normalFog; $('#uw').classList.toggle('on', uw);
  renderFrame();
  if (STREAM && now - streamLast >= 1000 / streamFps - 4) { streamLast = now; streamDraw(); }
}
requestAnimationFrame(frame);

/* ---------------- debug / test hooks ---------------- */
window.__G = { scene, renderer, wave: () => { waveNext = 0; },
  get player() { return player; }, setLite: (v) => { LITE = v; applyLite(); }, get lite() { return { on: LITE, lvl: liteLvl, lock30, fps: fpsAvg }; }, get skin() { return skin; }, THREE, get stealth() { return stealth; }, updateCam: () => { player.animate(1 / 60); updateCamera(1 / 60); camera.updateMatrixWorld(true); }, get level() { return level; }, get enemies() { return enemies; }, get cam() { return cam; }, SAVE: () => SAVE,
  load: (id) => loadWorld(id, null), tp: (x, y, z, yaw = 0) => { player.spawn(new V(x, y, z), yaw); cam.yaw = yaw; scarf.init = false; },
  virt: (v) => { __virt = v; },
  manual: (v) => { manual = v; },
  // run the simulation deterministically for `sec` seconds (or until fn() is true); returns true if fn fired
  sim: (sec, fn) => { for (let t = 0; t < sec; t += 1 / 60) { simulate(1 / 60); player.animate(1 / 60); if (fn && fn()) return true; } return !fn; }, press: (k) => { vin[k]++; }, start: () => $('#startBtn').click(), setCamYaw: (y) => { cam.yaw = y; cam.lastManual = tNow + 999; },
};
