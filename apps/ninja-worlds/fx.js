// Procedural textures, particles and synthesized audio — everything is generated in code (no downloads)
import * as THREE from 'three';

/* ---------------- tileable noise ---------------- */
const imul = Math.imul;
function hash(x, y, s) { let h = imul(x, 374761393) ^ imul(y, 668265263) ^ imul(s, 1442695041); h = imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, P, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = (a) => ((a % P) + P) % P;
  const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s), c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, S, s, oct = 5, base = 4) { let t = 0, a = 0.5, n = 0; for (let o = 0; o < oct; o++) { const P = base << o; t += a * vnoise((x / S) * P, (y / S) * P, P, s + o * 31); n += a; a *= 0.5; } return t / n; }

const SURF = {
  sand: { c: [200, 164, 116], mortar: [112, 90, 66], bricks: [4, 2], moss: [96, 120, 60], mossAmt: 0.25 },
  dark: { c: [108, 114, 134], mortar: [52, 54, 66], bricks: [4, 2], moss: [72, 104, 86], mossAmt: 0.18 },
  rock: { c: [124, 108, 96], rock: true, moss: [88, 116, 62], mossAmt: 0.4 },
  marble: { c: [220, 220, 234], tiles: 2, vein: [150, 138, 196] },
  gold: { c: [186, 146, 76], tiles: 4, vein: [246, 210, 120] },
  wood: { c: [120, 78, 44], wood: true },
  metal: { c: [92, 100, 108], tiles: 2, vein: [70, 76, 84] },
  deck: { c: [70, 82, 74], tiles: 4, vein: [58, 66, 60] },
};
const texCache = {};
export function surface(kind) {
  if (texCache[kind]) return texCache[kind];
  const k = SURF[kind], S = 256, hm = new Float32Array(S * S), col = new Uint8ClampedArray(S * S * 4), seed = kind.length * 97 + kind.charCodeAt(0);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = fbm(x, y, S, seed), n2 = fbm(x, y, S, seed + 5, 3, 2);
    let h = n, r = k.c[0], g = k.c[1], b = k.c[2], f = 0.72 + 0.5 * n;
    if (k.bricks) {
      const rows = k.bricks[0], cols = k.bricks[1], rh = S / rows, bw = S / cols, row = Math.floor(y / rh), off = (row % 2) * bw / 2;
      const bx = ((x + off) % bw + bw) % bw, by = y % rh, e = Math.min(bx, bw - bx, by, rh - by);
      const tint = hash(Math.floor((x + off) / bw) % cols, row, seed) * 0.3 - 0.15;
      if (e < 2.5) { h = 0.05 + n * 0.1; [r, g, b] = k.mortar; f = 0.8 + 0.4 * n; }
      else { h = Math.min(1, e / 7) * 0.55 + n * 0.45; f *= 1 + tint; }
    } else if (k.tiles) {
      const t = S / k.tiles, tx = x % t, ty = y % t, e = Math.min(tx, t - tx, ty, t - ty);
      const vein = Math.pow(1 - Math.abs(Math.sin(x * 0.03 + y * 0.018 + n * 9)), 12);
      r += (k.vein[0] - r) * vein * 0.7; g += (k.vein[1] - g) * vein * 0.7; b += (k.vein[2] - b) * vein * 0.7; f = 0.9 + 0.2 * n;
      h = e < 1.5 ? 0.1 : Math.min(1, e / 4) * 0.6 + n * 0.2; if (e < 1.5) f *= 0.6;
    } else if (k.rock) {
      const rid = 1 - Math.abs(fbm(x, y, S, seed + 9, 4, 2) * 2 - 1); h = n * 0.6 + rid * 0.4; f = 0.6 + 0.7 * h;
    } else if (k.wood) {
      const gr = Math.sin((x * 0.05 + n * 6) * 6) * 0.5 + 0.5; h = gr * 0.5 + n * 0.5; f = 0.7 + 0.45 * h;
    }
    if (k.moss) { const m = Math.min(1, Math.max(0, (n2 - 0.55) / 0.2) * k.mossAmt * 2); if (m > 0) { r += (k.moss[0] - r) * m; g += (k.moss[1] - g) * m; b += (k.moss[2] - b) * m; } }
    const i = y * S + x; hm[i] = h; col[i * 4] = r * f; col[i * 4 + 1] = g * f; col[i * 4 + 2] = b * f; col[i * 4 + 3] = 255;
  }
  const nrm = new Uint8ClampedArray(S * S * 4), st = kind === 'marble' ? 2 : 4, at = (a, b) => hm[((b + S) % S) * S + ((a + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x - 1, y) - at(x + 1, y)) * st, dy = (at(x, y + 1) - at(x, y - 1)) * st, l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    nrm[i] = (dx / l * 0.5 + 0.5) * 255; nrm[i + 1] = (dy / l * 0.5 + 0.5) * 255; nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
  }
  const tex = (data, srgb) => {
    const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d').putImageData(new ImageData(data, S, S), 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  return (texCache[kind] = { map: tex(col, true), normalMap: tex(nrm, false) });
}
const matCache = {};
export function mat(kind, opt = {}) {
  const key = kind + JSON.stringify(opt);
  if (matCache[key]) return matCache[key];
  const s = surface(kind);
  return (matCache[key] = new THREE.MeshStandardMaterial({
    map: s.map, normalMap: s.normalMap, normalScale: new THREE.Vector2(1.3, 1.3),
    roughness: kind === 'marble' ? 0.35 : kind === 'gold' ? 0.4 : 0.9, metalness: kind === 'gold' ? 0.5 : 0, ...opt,
  }));
}

/* ---------------- sprite textures ---------------- */
const spriteCache = {};
function canvasTex(key, w, h, draw) {
  if (spriteCache[key]) return spriteCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (spriteCache[key] = t);
}
export const glowTex = () => canvasTex('glow', 128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(0.6, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
export const cloudTex = () => canvasTex('cloud', 256, 256, (g, w) => {
  for (let i = 0; i < 26; i++) {
    const x = w * (0.2 + Math.random() * 0.6), y = w * (0.35 + Math.random() * 0.3), r = w * (0.1 + Math.random() * 0.16);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }
});
export const runeTex = () => {
  const t = canvasTex('rune', 512, 64, (g, w, h) => {
    g.strokeStyle = '#fff'; g.lineWidth = 3.5; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 6;
    for (let i = 0; i < 8; i++) {
      const cx = 32 + i * 64, cy = h / 2; g.beginPath();
      const k = i % 4;
      if (k === 0) { g.moveTo(cx - 14, cy + 18); g.lineTo(cx, cy - 18); g.lineTo(cx + 14, cy + 18); g.moveTo(cx - 8, cy + 4); g.lineTo(cx + 8, cy + 4); }
      if (k === 1) { g.arc(cx, cy, 15, 0.3, Math.PI * 1.7); g.moveTo(cx, cy - 20); g.lineTo(cx, cy + 20); }
      if (k === 2) { g.moveTo(cx - 14, cy - 16); g.lineTo(cx + 14, cy - 16); g.lineTo(cx - 14, cy + 16); g.lineTo(cx + 14, cy + 16); }
      if (k === 3) { g.moveTo(cx, cy - 20); g.lineTo(cx + 15, cy); g.lineTo(cx, cy + 20); g.lineTo(cx - 15, cy); g.closePath(); g.moveTo(cx - 5, cy); g.lineTo(cx + 5, cy); }
      g.stroke();
    }
  });
  t.wrapS = THREE.RepeatWrapping; return t;
};
export function textSprite(text, { size = 46, color = '#fff', glow = '#38bdf8', scale = 2.4 } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 768; c.height = 128;
  g.font = `900 ${size}px system-ui, "Segoe UI", Tahoma, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.shadowColor = glow; g.shadowBlur = 18; g.fillStyle = color; g.fillText(text, 384, 64); g.shadowBlur = 0; g.fillText(text, 384, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(scale * 6, scale, 1); return s;
}
export function glowSprite(color, scale = 1, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(scale); return s;
}

/* ---------------- particles ---------------- */
export class Particles {
  constructor(max = 900, additive = true) {
    this.max = max; this.p = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    const A = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', A(this.pos, 3)); g.setAttribute('color', A(this.col, 3)); g.setAttribute('size', A(this.size, 1)); g.setAttribute('alpha', A(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 400 } },
      vertexShader: 'attribute float size;attribute float alpha;attribute vec3 color;varying vec3 vC;varying float vA;uniform float scale;void main(){vC=color;vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*scale/max(.1,-mv.z);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying vec3 vC;varying float vA;void main(){vec2 d=gl_PointCoord-.5;float r=length(d);if(r>.5)discard;float a=smoothstep(.5,0.,r);gl_FragColor=vec4(vC,a*a*vA);}',
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.geo = g; this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; g.setDrawRange(0, 0);
    this._c = new THREE.Color();
  }
  emit(at, o = {}) {
    const c = this._c.set(o.color ?? 0xffffff), n = o.count ?? 10;
    for (let i = 0; i < n; i++) {
      if (this.p.length >= this.max) this.p.shift();
      let dx = Math.random() * 2 - 1, dy = Math.random() * 2 - 1, dz = Math.random() * 2 - 1; const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l; if (o.up != null) dy = Math.abs(dy) * o.up; if (o.flat) dy *= 0.15;
      const sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.6), sd = o.spread ?? 0;
      this.p.push({
        x: at.x + (Math.random() - 0.5) * sd, y: at.y + (Math.random() - 0.5) * sd * (o.flat ? 0.2 : 1), z: at.z + (Math.random() - 0.5) * sd,
        vx: dx * sp + (o.vel ? o.vel.x : 0), vy: dy * sp + (o.vel ? o.vel.y : 0), vz: dz * sp + (o.vel ? o.vel.z : 0),
        life: (o.life ?? 0.6) * (0.6 + Math.random() * 0.6), age: 0, s: (o.size ?? 0.25) * (0.6 + Math.random() * 0.8),
        r: c.r, g: c.g, b: c.b, grav: o.grav ?? 6, drag: o.drag ?? 1.5,
      });
    }
  }
  update(dt) {
    const P = this.p; let n = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i]; q.age += dt;
      if (q.age >= q.life) { P[i] = P[P.length - 1]; P.pop(); i--; continue; }
      q.vy -= q.grav * dt; const d = Math.exp(-q.drag * dt); q.vx *= d; q.vy *= d; q.vz *= d;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const k = 1 - q.age / q.life;
      this.pos[n * 3] = q.x; this.pos[n * 3 + 1] = q.y; this.pos[n * 3 + 2] = q.z;
      this.col[n * 3] = q.r; this.col[n * 3 + 1] = q.g; this.col[n * 3 + 2] = q.b;
      this.size[n] = q.s * Math.min(1, k * 3); this.alpha[n] = Math.min(1, k * 1.5); n++;
    }
    const a = this.geo.attributes; a.position.needsUpdate = a.color.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = true;
    this.geo.setDrawRange(0, n);
  }
  clear() { this.p.length = 0; this.geo.setDrawRange(0, 0); }
}

/* ---------------- synthesized sound + music ---------------- */
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MUSIC = {
  hub: { bpm: 76, chords: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 64]], scale: [69, 72, 74, 76, 79, 81], arp: 0.5, lead: 0.25 },
  w1: { bpm: 92, chords: [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]], scale: [62, 64, 65, 69, 70, 74, 76], arp: 0.8, lead: 0.35, drum: true },
  w3: { bpm: 96, chords: [[50, 57, 62, 66], [51, 58, 63, 67], [50, 57, 62, 66], [48, 55, 60, 63]], scale: [62, 63, 66, 67, 69, 70, 72, 74], arp: 0.75, lead: 0.45, drum: true },
  w4: { bpm: 68, chords: [[53, 60, 64, 67, 71], [55, 62, 66, 69], [52, 59, 64, 67, 71], [50, 57, 62, 66]], scale: [65, 67, 69, 71, 72, 74, 76], arp: 0.9, lead: 0.3 },
  w5: { bpm: 78, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 58], [40, 47, 52, 56]], scale: [57, 59, 60, 64, 65, 69], arp: 0.35, lead: 0.2, drum: true },
  w6: { bpm: 118, chords: [[40, 47, 52, 55], [41, 48, 53, 56], [43, 50, 55, 58], [38, 45, 50, 53]], scale: [52, 53, 55, 58, 59, 62, 64], arp: 0.95, lead: 0.5, drum: true },
  w7: { bpm: 86, chords: [[45, 52, 57, 60], [44, 51, 56, 59], [41, 48, 53, 57], [43, 50, 55, 58]], scale: [57, 59, 60, 62, 64, 65, 68], arp: 0.45, lead: 0.12, drum: true },
  w2: { bpm: 84, chords: [[52, 59, 64, 67], [48, 55, 60, 64], [55, 62, 67, 71], [50, 57, 62, 66]], scale: [64, 66, 67, 71, 74, 76, 79], arp: 0.7, lead: 0.3, drum: true },
};
const SFX_FILES = ["bell0", "bell1", "bell2", "bell3", "bell4", "belt_handle_1", "chop", "cloth1", "cloth2", "cloth3", "cloth4", "cloth_belt", "creak1", "creak2", "creak3", "dg_pep_sound_2", "dg_phase_jump_2", "dg_power_up_11", "dg_power_up_3", "dg_power_up_7", "dg_three_tone_1", "dg_tone_1", "dg_zap_two_tone", "door_c1", "door_c2", "door_c3", "door_o1", "door_o2", "door_o3", "drop_leather", "handle_coins", "handle_coins_2", "metal_click", "metal_h0", "metal_h1", "metal_h2", "metal_h3", "metal_h4", "metal_l0", "metal_l1", "metal_l2", "metal_l3", "metal_l4", "metal_latch", "metal_m0", "metal_m1", "metal_m2", "metal_m3", "metal_m4", "metal_pot_1", "mine0", "mine1", "mine2", "mine3", "mine4", "nf_big_kill", "nf_coin", "nf_confirm", "nf_dash", "nf_gem", "nf_hurt", "nf_kill", "nf_land", "nf_level_up", "punch_h0", "punch_h1", "punch_h2", "punch_h3", "punch_m0", "punch_m1", "punch_m2", "punch_m3", "sf_computer_noise_000", "sf_computer_noise_002", "sf_door_close_000", "sf_door_open_000", "sf_engine_circular_000", "sf_explosion_crunch_000", "sf_force_field_000", "sf_force_field_002", "sf_laser_small_000", "sf_low_frequency_explosion_000", "sf_space_engine_low_000", "sf_thruster_fire_000", "sf_thruster_fire_002", "soft_h0", "soft_h1", "soft_h2", "soft_h3", "soft_h4", "st_conc0", "st_conc1", "st_conc2", "st_conc3", "st_conc4", "st_grass0", "st_grass1", "st_grass2", "st_grass3", "st_grass4", "st_metal0", "st_metal1", "st_metal2", "st_metal3", "st_metal4", "st_snow0", "st_snow1", "st_snow2", "st_snow3", "st_snow4", "st_wood0", "st_wood1", "st_wood2", "st_wood3", "st_wood4", "swish0", "swish1", "swish2", "swish3", "swish4", "vo_call_for_backup", "vo_congratulations", "vo_cover_me", "vo_get_down", "vo_go", "vo_go_go_go", "vo_hold", "vo_look_out", "vo_medic", "vo_mission_completed", "vo_objective_achieved", "vo_power_up", "vo_ready", "vo_reloading", "vo_sniper", "vo_suppressing_fire", "vo_target_engaged", "vo_watch_my_back", "wood_h0", "wood_h1", "wood_h2", "wood_h3", "wood_h4"];
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.vol = { master: 0.85, music: 0.42, sfx: 0.9, amb: 0.45, voice: 1.3 }; try { Object.assign(this.vol, JSON.parse(localStorage.getItem('nw_vol') || '{}')); } catch (e) {} }
  init(extCtx, toStream) {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC && !extCtx) return;
    const c = (this.ctx = extCtx || new AC()); if (c.state === 'suspended') c.resume();
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); if (toStream) { this.streamDest = c.createMediaStreamDestination(); comp.connect(this.streamDest); } else comp.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musBus = c.createGain(); this.musBus.gain.value = 0.42; this.musBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.connect(this.master); this.voBus = c.createGain(); this.voBus.connect(this.master); this.applyVol();
    // generated reverb impulse
    const len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb = c.createConvolver(); this.verb.buffer = ir; const vg = c.createGain(); vg.gain.value = 0.55; this.verb.connect(vg); vg.connect(this.master);
    this.delay = c.createDelay(1); this.delay.delayTime.value = 0.36; const fb = c.createGain(); fb.gain.value = 0.32; this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.verb);
    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
    this.loadSamples();
  }
  /* ---------- أصوات حقيقية مسجّلة (CC0) ---------- */
  loadSamples() {
    if (this.buf) return; this.buf = {}; this.groups = {}; const c = this.ctx, base = new URL('sfx/', import.meta.url).href;
    const pr = ['st_', 'cloth', 'swish', 'punch', 'nf_', 'metal_', 'soft_h', 'dg_power_up', 'handle_coins', 'vo_', 'sf_door', 'creak', 'metal_latch', 'metal_click'], rank = (n) => { const k = pr.findIndex((p) => n.startsWith(p)); return k < 0 ? 99 : k; };
    const LIST = SFX_FILES.slice().sort((a, b) => rank(a) - rank(b));
    let i = 0; const next = () => { if (i >= LIST.length) return; const n = LIST[i++];
      fetch(base + n + '.ogg').then((r) => r.ok ? r.arrayBuffer() : Promise.reject()).then((ab) => new Promise((res, rej) => c.decodeAudioData(ab, res, rej))).then((b) => { this.buf[n] = b; const g = n.replace(/\d+$/, ''); (this.groups[g] = this.groups[g] || []).push(b); }).catch(() => {}).finally(next); };
    for (let k = 0; k < 6; k++) next();
  }
  has(n) { return !!(this.buf && (this.buf[n] || (this.groups && this.groups[n] && this.groups[n].length))); }
  // S('اسم أو مجموعة', الصوت, {rate, rv, verb, pan, delay, at})
  S(n, vol = 0.6, o = {}) {
    if (!this.ctx || !this.buf) return false; const g = this.groups[n], b = this.buf[n] || (g && g[Math.floor(Math.random() * g.length)]); if (!b) return false;
    const c = this.ctx, src = c.createBufferSource(), gn = c.createGain(); src.buffer = b;
    src.playbackRate.value = (o.rate || 1) * (1 + ((Math.random() - 0.5) * 2) * (o.rv ?? 0.06));
    let v = vol, pan = o.pan || 0;
    if (o.at && this.ear) { const e = this.ear, dx = o.at.x - e.position.x, dy = o.at.y - e.position.y, dz = o.at.z - e.position.z, d = Math.hypot(dx, dy, dz); v *= 1 / Math.pow(1 + d / 9, 1.25); if (v < 0.01) return true; const r = this._right || (this._right = new e.position.constructor()); r.set(1, 0, 0).applyQuaternion(e.quaternion); pan = Math.max(-1, Math.min(1, (dx * r.x + dz * r.z) / (d || 1))) * 0.8; }
    gn.gain.value = v; src.connect(gn);
    let out = gn; if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; gn.connect(p); out = p; }
    out.connect(o.bus || this.sfxBus); if (o.verb && this.verb) { const vs = c.createGain(); vs.gain.value = o.verb; out.connect(vs); vs.connect(this.verb); }
    src.start(c.currentTime + (o.delay || 0)); return true;
  }
  surfaceStep(v = 0.42, at) { return this.S('st_' + (this.surface || 'conc'), v, { at, verb: this.room || 0 }); }
  knock() { this.S('metal_h', 0.95, { verb: 0.25 }) || this.tone(180, 120, 0.07, 'square', 0.12); this.S('metal_h', 0.8, { delay: 0.14, verb: 0.25 }); }
  metal(v = 0.7, at) { this.S('metal_m', v, { at, verb: 0.2 }); }
  door(open = true, at) { this.S(open ? 'sf_door_open_' : 'sf_door_close_', 0.8, { at, rv: 0.03 }) || this.gate(); this.S('metal_h', 0.35, { at, rate: 0.6 }); }
  locker(at) { this.S('creak', 0.7, { at }); this.S('metal_latch', 0.6, { at, delay: 0.08 }); }
  click() { this.S('metal_click', 0.7) || this.tone(1400, 1200, 0.03, 'square', 0.05); }
  panel() { this.S('sf_computer_noise_', 0.6) ; this.S('dg_zap_two_tone', 0.4, { delay: 0.1 }); }
  keycard() { this.S('metal_click', 0.6); this.S('dg_power_up_3', 0.45, { delay: 0.05, verb: 0.2 }); }
  splash(at) { this.S('soft_h', 0.9, { rate: 0.6, at }); this.noise(0.7, 900, 0.5, 0.22, 'lowpass', 0.02); this.noise(0.4, 2400, 0.6, 0.1, 'bandpass', 0.08); }
  shot(sniper) { this.S('punch_m', sniper ? 0.9 : 0.7, { rate: sniper ? 1.1 : 1.6 }); this.noise(0.12, sniper ? 900 : 1600, 1.2, sniper ? 0.25 : 0.16, 'bandpass', 0, 300); }
  bolt() { this.S('metal_latch', 0.6, { rate: 1.1 }); this.S('metal_click', 0.55, { delay: 0.2 }); }
  coin() { this.S('nf_coin', 0.45) || this.pickup(); }
  crash(v = 0.6, at) { this.S('metal_h', Math.min(1, v), { at, rate: 0.85 }); this.S('soft_h', v * 0.6, { at }); }
  nitro() { this.S('sf_thruster_fire_', 0.5); }
  voice(n, at, vol = 1) { const t = performance.now(); if (t - (this._vt || 0) < 900) return; this._vt = t; this.S('vo_' + n, vol, { at, rv: 0.02, verb: this.room || 0.05, bus: this.voBus }); }
  // عربي من صوت الجوال نفسه (إذا متوفر)
  speak(text, o = {}) {
    try { const ss = window.speechSynthesis; if (!ss || !this.on) return; const t = performance.now(); if (t - (this._st || 0) < 1500) return; this._st = t;
      const u = new SpeechSynthesisUtterance(text); const vs = ss.getVoices(); const ar = vs.find((v) => /^ar/i.test(v.lang)); if (ar) u.voice = ar; u.lang = ar ? ar.lang : 'ar-SA';
      u.pitch = o.pitch ?? 0.75; u.rate = o.rate ?? 1.0; u.volume = Math.max(0, Math.min(1, (o.vol ?? 0.9) * (this.vol.voice / 1.3) * this.vol.master / 0.85)); ss.cancel(); ss.speak(u); } catch (e) {}
  }
  thunder() { this.noise(2.8, 220, 0.6, 0.55, 'lowpass'); this.noise(0.25, 1200, 0.8, 0.25, 'bandpass'); this.S('sf_low_frequency_explosion_', 0.5, { rate: 0.6, verb: 0.4 }); }
  /* ---------- أجواء العوالم (من «الرحّال») ---------- */
  amb(kind, vol = 0.35) {
    if (!this.ctx) return; const a = this.ctx;
    if (kind === this.ambKind) { if (this.ambGain) this.ambGain.gain.setTargetAtTime(vol, a.currentTime, 0.4); return; }
    this.ambStop(); this.ambKind = kind; if (!kind) return;
    const g = a.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(vol, a.currentTime, 0.9); g.connect(this.ambBus || this.master); this.ambGain = g; this.ambNodes = [];
    const noise = (type, freq, q, v) => { const s = a.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7; const gg = a.createGain(); gg.gain.value = v; s.connect(f); f.connect(gg); gg.connect(g); s.start(0, Math.random()); this.ambNodes.push(s); return { f, gg }; };
    const osc = (type, freq, v) => { const o = a.createOscillator(); o.type = type; o.frequency.value = freq; const gg = a.createGain(); gg.gain.value = v; o.connect(gg); gg.connect(g); o.start(); this.ambNodes.push(o); return { o, gg }; };
    const lfo = (param, rate, depth) => { const o = a.createOscillator(); o.frequency.value = rate; const gg = a.createGain(); gg.gain.value = depth; o.connect(gg); gg.connect(param); o.start(); this.ambNodes.push(o); };
    const wind = (v) => { const n = noise('lowpass', 480, 0.8, v); lfo(n.f.frequency, 0.13, 260); lfo(n.gg.gain, 0.09, v * 0.5); };
    const rain = (v) => { noise('bandpass', 1700, 0.5, v); noise('highpass', 4000, 0.5, v * 0.35); noise('lowpass', 350, 1, v * 0.4); };
    const sea = (v) => { const w1 = noise('lowpass', 650, 0.6, v); lfo(w1.gg.gain, 0.11, v * 0.8); const w2 = noise('bandpass', 1200, 0.4, v * 0.35); lfo(w2.gg.gain, 0.08, v * 0.3); };
    switch (kind) {
      case 'storm': rain(0.5); wind(0.35); sea(0.3); break;
      case 'rain': rain(0.45); break;
      case 'wind': wind(0.4); break;
      case 'breeze': wind(0.18); break;
      case 'night': wind(0.12); { const c1 = osc('sine', 4200, 0.004); lfo(c1.gg.gain, 7, 0.004); const c2 = osc('sine', 3800, 0.003); lfo(c2.gg.gain, 5.3, 0.003); } break; // صراصير خفيفة
      case 'dive': { const a1 = noise('lowpass', 220, 0.6, 0.45); lfo(a1.gg.gain, 0.07, 0.15); const b1 = noise('bandpass', 700, 0.8, 0.05); lfo(b1.gg.gain, 0.3, 0.04); } break;
      case 'fire': wind(0.3); noise('highpass', 2500, 0.5, 0.06); { const r = noise('lowpass', 90, 1, 0.35); lfo(r.gg.gain, 0.2, 0.15); } break;
      case 'scary': osc('sine', 55, 0.06); osc('sine', 58.3, 0.05); wind(0.25); break;
      case 'city': noise('lowpass', 140, 1, 0.45); osc('sine', 52, 0.03); noise('bandpass', 900, 0.4, 0.05); wind(0.12); break; // زحمة بعيدة
      default: wind(0.2);
    }
  }
  ambStop() { (this.ambNodes || []).forEach((n) => { try { n.stop(); } catch (e) {} }); this.ambNodes = []; if (this.ambGain) { try { this.ambGain.disconnect(); } catch (e) {} } this.ambGain = null; this.ambKind = null; }
  musicFile(n, vol = 0.5) {
    if (!this.ctx || !this.buf || !this.buf[n]) { if (this.buf && !this.buf[n] && !this._mf) { this._mf = true; fetch(new URL('sfx/' + n + '.ogg', import.meta.url).href).then((r) => r.arrayBuffer()).then((ab) => new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej))).then((b) => { this.buf[n] = b; this._mf = false; this.musicFile(n, vol); }).catch(() => { this._mf = false; }); } return; }
    this.stopMusic(); const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = this.buf[n]; s.loop = true; g.gain.value = vol; s.connect(g); g.connect(this.musBus); s.start(); this.musSrc = s;
  }
  setVol(k, v) { this.vol[k] = v; this.applyVol(); try { localStorage.setItem('nw_vol', JSON.stringify(this.vol)); } catch (e) {} }
  applyVol() { if (!this.master) return; const V = this.vol; this.master.gain.value = this.on ? V.master : 0; this.sfxBus.gain.value = V.sfx; this.musBus.gain.value = V.music; this.ambBus.gain.value = V.amb; this.voBus.gain.value = V.voice; }
  toggle() { this.on = !this.on; this.applyVol(); if (!this.on) try { speechSynthesis.cancel(); } catch (e) {} return this.on; }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  tone(f0, f1, dur, type = 'sine', vol = 0.2, when = 0, bus) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus); o.start(t); o.stop(t + dur + 0.05); return g;
  }
  noise(dur, freq = 1200, q = 1, vol = 0.2, type = 'bandpass', when = 0, f1) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  jump() { if (this.S('cloth', 0.32, { rate: 1.2 })) { this.surfaceStep(0.3); return; } this.noise(0.18, 900, 0.8, 0.12, 'bandpass', 0, 2600); this.tone(220, 360, 0.12, 'triangle', 0.05); }
  land(h = 1) { if (this.S('nf_land', 0.45 * h)) { this.surfaceStep(0.5 * h); return; } this.noise(0.12, 300, 0.7, 0.14 * h, 'lowpass'); }
  step() { if (this.surfaceStep(0.4)) return; this.noise(0.05, 500 + Math.random() * 300, 1.2, 0.05, 'bandpass'); }
  slash(i = 1) { if (this.S('swish', 0.5, { rate: 0.9 + i * 0.12 })) return; this.noise(0.22, 1800 + i * 500, 1.5, 0.22, 'bandpass', 0, 500 + i * 200); this.tone(900 + i * 120, 400, 0.12, 'sawtooth', 0.025); }
  hit() { if (this.S('punch_h', 0.85)) { this.S('punch_m', 0.4, { delay: 0.02 }); return; } this.noise(0.14, 260, 0.6, 0.35, 'lowpass'); this.tone(140, 60, 0.18, 'square', 0.12); this.tone(1400, 900, 0.08, 'triangle', 0.08); }
  enemyDie() { if (this.S('nf_kill', 0.55)) { this.S('soft_h', 0.7, { delay: 0.05 }); return; } this.tone(500, 60, 0.6, 'sawtooth', 0.12); this.noise(0.5, 1200, 0.6, 0.15, 'bandpass', 0, 200); }
  enemyAtk() { this.tone(160, 320, 0.3, 'sawtooth', 0.06); }
  hurt() { if (this.S('nf_hurt', 0.75)) { this.S('punch_m', 0.45); return; } this.tone(330, 160, 0.25, 'square', 0.12); this.noise(0.2, 600, 0.8, 0.2, 'lowpass'); }
  wallrun() { this.noise(0.4, 600, 0.6, 0.12, 'bandpass', 0, 1600); }
  roll() { if (this.S('cloth', 0.5, { rate: 0.8 })) return; this.noise(0.3, 400, 0.6, 0.12, 'lowpass', 0, 1400); }
  grab() { if (this.S('cloth_belt', 0.6)) return; this.noise(0.08, 700, 1, 0.14, 'bandpass'); this.tone(300, 260, 0.08, 'triangle', 0.05); }
  shard() { if (this.S('nf_gem', 0.7, { verb: 0.25 })) { this.S('dg_power_up_7', 0.3, { delay: 0.06, verb: 0.4 }); return; } [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(84 + s), 0, 0.5, 'triangle', 0.09, i * 0.06)); }
  heart() { if (this.S('dg_power_up_3', 0.5, { verb: 0.3 })) return; [0, 7, 12].forEach((s, i) => this.tone(mtof(76 + s), 0, 0.35, 'sine', 0.1, i * 0.07)); }
  pickup() { if (this.S('handle_coins', 0.55)) return; this.tone(440, 880, 0.25, 'sine', 0.12); }
  place() { if (this.S('bell', 0.4, { verb: 0.5 })) return; this.tone(330, 0, 0.5, 'triangle', 0.15); this.tone(495, 0, 0.6, 'triangle', 0.12, 0.08); this.tone(660, 0, 0.8, 'sine', 0.1, 0.16); }
  gate() { if (this.S('sf_door_open_', 0.8, { rate: 0.7 })) { this.S('metal_h', 0.5, { rate: 0.55, verb: 0.3 }); return; } this.noise(1.6, 120, 0.5, 0.35, 'lowpass'); this.tone(80, 50, 1.6, 'sawtooth', 0.08); }
  checkpoint() { if (this.S('dg_power_up_11', 0.45, { verb: 0.35 })) return; [0, 5, 9, 12].forEach((s, i) => this.tone(mtof(72 + s), 0, 0.6, 'sine', 0.08, i * 0.09)); }
  portal() { if (this.S('sf_force_field_', 0.7)) { this.S('dg_phase_jump_2', 0.45, { delay: 0.15, verb: 0.4 }); return; } this.tone(200, 1200, 1.0, 'sine', 0.15); this.noise(1.0, 400, 2, 0.15, 'bandpass', 0, 3000); }
  slam() { if (this.S('sf_low_frequency_explosion_', 0.8)) { this.S('mine', 0.6); return; } this.noise(0.5, 180, 0.5, 0.5, 'lowpass'); this.tone(90, 40, 0.5, 'square', 0.18); }
  win() { if (this.S('nf_level_up', 0.65, { verb: 0.3 })) { this.S('vo_mission_completed', 0.9, { delay: 0.9, rv: 0, bus: this.voBus }); return; } [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(mtof(67 + s), 0, 0.8, 'triangle', 0.08, i * 0.1)); }
  crumble() { if (this.S('mine', 0.7, { rate: 0.8 })) return; this.noise(0.6, 200, 0.5, 0.25, 'lowpass', 0, 80); }
  music(name) {
    this.stopMusic(); if (!this.ctx || !MUSIC[name]) return;
    const cfg = MUSIC[name], spb = 60 / cfg.bpm / 2; let step = 0, next = this.ctx.currentTime + 0.15;
    this.musTimer = setInterval(() => { if (!this.ctx) return; while (next < this.ctx.currentTime + 0.35) { this.mstep(cfg, step, next, spb); next += spb; step++; } }, 90);
  }
  stopMusic() { clearInterval(this.musTimer); if (this.musSrc) { try { this.musSrc.stop(); } catch (e) {} this.musSrc = null; } }
  mnote(m, t, dur, type, vol, dest, attack = 0.01) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  mstep(cfg, step, t, spb) {
    const c = this.ctx, bar = Math.floor(step / 16) % cfg.chords.length, ch = cfg.chords[bar], s16 = step % 16;
    if (s16 === 0) {
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; const pg = c.createGain(); pg.gain.value = 1; lp.connect(pg); pg.connect(this.musBus); pg.connect(this.verb);
      ch.forEach((m) => { [-6, 6].forEach((dt) => { const o = this.mnote(m, t, spb * 16 + 0.6, 'sawtooth', 0.018, lp, 0.9); o.detune.value = dt; }); });
      this.mnote(ch[0] - 12, t, spb * 7, 'triangle', 0.12, this.musBus, 0.02);
      this.mnote(ch[0] - 12, t + spb * 8, spb * 7, 'triangle', 0.1, this.musBus, 0.02);
    }
    if (step % 2 === 0 && Math.random() < cfg.arp) { const m = ch[(step / 2) % ch.length] + 12; const g = c.createGain(); g.gain.value = 1; g.connect(this.musBus); g.connect(this.delay); this.mnote(m, t, 0.5, 'triangle', 0.04, g); }
    if (s16 % 4 === 0 && Math.random() < cfg.lead) { const m = cfg.scale[Math.floor(Math.random() * cfg.scale.length)] + 12; const g = c.createGain(); g.connect(this.musBus); g.connect(this.verb); this.mnote(m, t, spb * 4, 'sine', 0.035, g, 0.05); }
    if (cfg.drum) {
      if (s16 === 0 || s16 === 10) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(this.musBus); o.start(t); o.stop(t + 0.35); }
      if (s16 % 4 === 2) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); s.connect(f); f.connect(g); g.connect(this.musBus); s.start(t, Math.random() * 0.5); s.stop(t + 0.08); }
      if (s16 === 8) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; f.type = 'bandpass'; f.frequency.value = 1500; g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); s.connect(f); f.connect(g); g.connect(this.musBus); g.connect(this.verb); s.start(t, Math.random() * 0.5); s.stop(t + 0.2); }
    }
  }
}
