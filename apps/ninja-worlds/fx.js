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
export class Sound {
  constructor() { this.ctx = null; this.on = true; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musBus = c.createGain(); this.musBus.gain.value = 0.42; this.musBus.connect(this.master);
    // generated reverb impulse
    const len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb = c.createConvolver(); this.verb.buffer = ir; const vg = c.createGain(); vg.gain.value = 0.55; this.verb.connect(vg); vg.connect(this.master);
    this.delay = c.createDelay(1); this.delay.delayTime.value = 0.36; const fb = c.createGain(); fb.gain.value = 0.32; this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.verb);
    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
  }
  toggle() { this.on = !this.on; if (this.master) this.master.gain.value = this.on ? 0.8 : 0; return this.on; }
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
  jump() { this.noise(0.18, 900, 0.8, 0.12, 'bandpass', 0, 2600); this.tone(220, 360, 0.12, 'triangle', 0.05); }
  land(h = 1) { this.noise(0.12, 300, 0.7, 0.14 * h, 'lowpass'); }
  step() { this.noise(0.05, 500 + Math.random() * 300, 1.2, 0.05, 'bandpass'); }
  slash(i = 1) { this.noise(0.22, 1800 + i * 500, 1.5, 0.22, 'bandpass', 0, 500 + i * 200); this.tone(900 + i * 120, 400, 0.12, 'sawtooth', 0.025); }
  hit() { this.noise(0.14, 260, 0.6, 0.35, 'lowpass'); this.tone(140, 60, 0.18, 'square', 0.12); this.tone(1400, 900, 0.08, 'triangle', 0.08); }
  enemyDie() { this.tone(500, 60, 0.6, 'sawtooth', 0.12); this.noise(0.5, 1200, 0.6, 0.15, 'bandpass', 0, 200); }
  enemyAtk() { this.tone(160, 320, 0.3, 'sawtooth', 0.06); }
  hurt() { this.tone(330, 160, 0.25, 'square', 0.12); this.noise(0.2, 600, 0.8, 0.2, 'lowpass'); }
  wallrun() { this.noise(0.4, 600, 0.6, 0.12, 'bandpass', 0, 1600); }
  roll() { this.noise(0.3, 400, 0.6, 0.12, 'lowpass', 0, 1400); }
  grab() { this.noise(0.08, 700, 1, 0.14, 'bandpass'); this.tone(300, 260, 0.08, 'triangle', 0.05); }
  shard() { [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(84 + s), 0, 0.5, 'triangle', 0.09, i * 0.06)); }
  heart() { [0, 7, 12].forEach((s, i) => this.tone(mtof(76 + s), 0, 0.35, 'sine', 0.1, i * 0.07)); }
  pickup() { this.tone(440, 880, 0.25, 'sine', 0.12); }
  place() { this.tone(330, 0, 0.5, 'triangle', 0.15); this.tone(495, 0, 0.6, 'triangle', 0.12, 0.08); this.tone(660, 0, 0.8, 'sine', 0.1, 0.16); }
  gate() { this.noise(1.6, 120, 0.5, 0.35, 'lowpass'); this.tone(80, 50, 1.6, 'sawtooth', 0.08); }
  checkpoint() { [0, 5, 9, 12].forEach((s, i) => this.tone(mtof(72 + s), 0, 0.6, 'sine', 0.08, i * 0.09)); }
  portal() { this.tone(200, 1200, 1.0, 'sine', 0.15); this.noise(1.0, 400, 2, 0.15, 'bandpass', 0, 3000); }
  slam() { this.noise(0.5, 180, 0.5, 0.5, 'lowpass'); this.tone(90, 40, 0.5, 'square', 0.18); }
  win() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(mtof(67 + s), 0, 0.8, 'triangle', 0.08, i * 0.1)); }
  crumble() { this.noise(0.6, 200, 0.5, 0.25, 'lowpass', 0, 80); }
  music(name) {
    this.stopMusic(); if (!this.ctx || !MUSIC[name]) return;
    const cfg = MUSIC[name], spb = 60 / cfg.bpm / 2; let step = 0, next = this.ctx.currentTime + 0.15;
    this.musTimer = setInterval(() => { if (!this.ctx) return; while (next < this.ctx.currentTime + 0.35) { this.mstep(cfg, step, next, spb); next += spb; step++; } }, 90);
  }
  stopMusic() { clearInterval(this.musTimer); }
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
