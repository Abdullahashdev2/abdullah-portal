/* ============================================================
   تنظيف الرسمة: يحوّل صورة رسمة بالرصاص على ورق إلى "قناع" شخصية
   - يشيل لون الورق والظلال (تقدير الخلفية بتمويه كبير)
   - يطلّع خطوط الرصاص بقوة (R = الخط)
   - يعبّي داخل الشخصية (G = الجسم) عشان تصير شكل صلب يتحوّل 3D
   - يقص على حدود الشخصية
   النتيجة: صورة PNG فيها R=الخط و G=الجسم و A=الجسم أو الخط
   ============================================================ */
(function (root) {
  const MAXW = 512;

  function toCanvas(img, maxSide) {
    const s = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(8, Math.round(img.width * s)), h = Math.max(8, Math.round(img.height * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c;
  }

  // background estimate: heavy blur of a "max" filtered image, so pencil lines don't darken it
  function background(gray, w, h) {
    const k = Math.max(6, Math.round(Math.min(w, h) / 40));
    const mx = maxFilter(gray, w, h, k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), im = x.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = mx[i]; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0);
    const sw = Math.max(4, Math.round(w / 24)), sh = Math.max(4, Math.round(h / 24));
    const s = document.createElement('canvas'); s.width = sw; s.height = sh;
    const sx = s.getContext('2d'); sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high'; sx.drawImage(c, 0, 0, sw, sh);
    x.clearRect(0, 0, w, h); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(s, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, out = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) out[i] = d[i * 4];
    return out;
  }

  function maxFilter(src, w, h, r) { // separable max (dilate) on Float32/Uint8
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; const a = Math.max(0, x - r), b = Math.min(w - 1, x + r); for (let k = a; k <= b; k++) { const v = src[y * w + k]; if (v > m) m = v; } tmp[y * w + x] = m; }
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { let m = 0; const a = Math.max(0, y - r), b = Math.min(h - 1, y + r); for (let k = a; k <= b; k++) { const v = tmp[k * w + x]; if (v > m) m = v; } out[y * w + x] = m; }
    return out;
  }

  function process(img, opts) {
    opts = Object.assign({ fill: true, strength: 1 }, opts || {});
    const c = toCanvas(img, 900), w = c.width, h = c.height;
    const d = c.getContext('2d').getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    const colored = new Uint8Array(w * h); // pencil is grey; carpets, tables, fingers are coloured -> treat as background
    for (let i = 0; i < w * h; i++) { const r = d[i * 4], g = d[i * 4 + 1], bl = d[i * 4 + 2]; gray[i] = .299 * r + .587 * g + .114 * bl;
      const ch = Math.max(r, g, bl) - Math.min(r, g, bl); if (ch > 38 || (ch > 24 && gray[i] < 90)) colored[i] = 1; }
    const bg = background(gray, w, h);
    // ink = how much darker than the local paper (contrast-normalised)
    const ink = new Float32Array(w * h);
    let sum = 0, cnt = 0;
    for (let i = 0; i < w * h; i++) { const v = Math.max(0, (bg[i] - gray[i]) / Math.max(30, bg[i])); ink[i] = v; if (v > .02) { sum += v; cnt++; } }
    const ref = cnt ? (sum / cnt) * 2.2 : .2; // adaptive: faint pencil gets boosted, heavy shading doesn't explode
    const nearColor = maxFilter(colored, w, h, 3);
    for (let i = 0; i < w * h; i++) { let v = ink[i] / ref * opts.strength; v = v < .18 || nearColor[i] ? 0 : Math.min(1, Math.pow((v - .18) / .82, .75)); ink[i] = v; }
    // remove specks: keep pixels that have inked neighbours
    const clean = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (!ink[i]) continue; let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ink[i + dy * w + dx] > .15) n++; clean[i] = n >= 3 ? ink[i] : 0; }
    // body: close gaps in the outline, flood the outside from the borders, inside = body
    const lineMask = new Float32Array(w * h); for (let i = 0; i < w * h; i++) lineMask[i] = clean[i] > .25 ? 1 : 0;
    const gap = Math.max(3, Math.round(Math.min(w, h) / 70));
    const closed = maxFilter(lineMask, w, h, gap);
    const outside = new Uint8Array(w * h), q = new Int32Array(w * h); let qh = 0, qt = 0;
    const push = i => { if (!outside[i] && !closed[i]) { outside[i] = 1; q[qt++] = i; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (qh < qt) { const i = q[qh++], x = i % w, y = (i / w) | 0; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w); }
    // shrink the body back by the gap we added, so it hugs the drawing
    const body = new Float32Array(w * h); for (let i = 0; i < w * h; i++) body[i] = outside[i] ? 0 : 1;
    const inv = new Float32Array(w * h); for (let i = 0; i < w * h; i++) inv[i] = 1 - body[i];
    const grown = maxFilter(inv, w, h, Math.max(1, gap - 1));
    for (let i = 0; i < w * h; i++) body[i] = opts.fill ? Math.max(clean[i] > .2 ? 1 : 0, 1 - grown[i]) : (clean[i] > .2 ? 1 : 0);
    // keep only the biggest piece (drops stray marks from the page)
    const lab = new Int32Array(w * h); let best = 0, bestN = 0, id = 0;
    for (let s = 0; s < w * h; s++) { if (!body[s] || lab[s]) continue; id++; let n = 0; qh = qt = 0; q[qt++] = s; lab[s] = id;
      while (qh < qt) { const i = q[qh++]; n++; const x = i % w, y = (i / w) | 0; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && body[j] && !lab[j]) { lab[j] = id; q[qt++] = j; } }
      if (n > bestN) { bestN = n; best = id; } }
    // a drawing is often several pieces (hair strokes etc.): keep every piece that is big enough
    const sizes = new Map(); for (let i = 0; i < w * h; i++) if (lab[i]) sizes.set(lab[i], (sizes.get(lab[i]) || 0) + 1);
    const keep = new Set([...sizes].filter(([k, n]) => k === best || n > bestN * .02).map(([k]) => k));
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let i = 0; i < w * h; i++) { if (!keep.has(lab[i])) { body[i] = 0; clean[i] = 0; continue; } const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0 || y1 <= y0) return null;
    const m = Math.round(Math.max(x1 - x0, y1 - y0) * .04); x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, s = Math.min(1, MAXW / Math.max(cw, ch));
    const full = document.createElement('canvas'); full.width = cw; full.height = ch;
    const fx = full.getContext('2d'), fim = fx.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const i = (y + y0) * w + (x + x0), o = (y * cw + x) * 4; const L = clean[i], B = body[i];
      fim.data[o] = Math.round(L * 255); fim.data[o + 1] = Math.round(B * 255); fim.data[o + 2] = 0; fim.data[o + 3] = Math.round(Math.max(B, L) * 255); }
    fx.putImageData(fim, 0, 0);
    const out = document.createElement('canvas'); out.width = Math.max(4, Math.round(cw * s)); out.height = Math.max(4, Math.round(ch * s));
    const ox = out.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(full, 0, 0, out.width, out.height);
    return { canvas: out, url: out.toDataURL('image/png'), w: out.width, h: out.height, ink: cnt / (w * h) };
  }

  root.AliProcess = { process };
})(window);
