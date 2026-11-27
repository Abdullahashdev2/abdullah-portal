/* =====================================================================
   🧍 الشخصية الكاملة: جسم كرتوني بهيكل عظمي (مثل شخصيات الألعاب والأنمي)
   ورأسها هو رسمة علي نفسها (نكتشف الرقبة في الرسمة ونأخذ اللي فوقها).
   - تظليل كرتوني (toon) بثلاث درجات + حدود سوداء مثل الرسم اليدوي
   - هيكل: ورك ← عمود فقري ← صدر ← رقبة ← رأس / كتف ← عضد ← كوع ← ساعد ← يد / فخذ ← ركبة ← ساق ← كاحل ← قدم
   - حركة مبنية على دورة المشي الكلاسيكية (تلامس، نزول، مرور، صعود) + جري، وقوف، نط، تلويح، رقص
   ===================================================================== */
export function createFullKit(THREE, { Character, SHADOW_TEX }) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const TOON = (() => { const d = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
  const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x111827, side: THREE.BackSide });

  const OUTFITS = {
    casual: { name: '👕 كاجوال', shirt: '#3b82f6', pants: '#1e293b', shoes: '#f8fafc', sleeves: 'short' },
    thobe: { name: '🤍 ثوب', shirt: '#f8fafc', pants: '#f8fafc', shoes: '#8b5a2b', sleeves: 'long', robe: true },
    sport: { name: '🏃 رياضي', shirt: '#16a34a', pants: '#14532d', shoes: '#f8fafc', sleeves: 'long', stripe: '#f8fafc' },
    ninja: { name: '🥷 نينجا', shirt: '#1f2937', pants: '#111827', shoes: '#111827', sleeves: 'long', belt: '#dc2626' },
    hero: { name: '🦸 بطل خارق', shirt: '#dc2626', pants: '#1d4ed8', shoes: '#dc2626', sleeves: 'long', belt: '#facc15', cape: '#facc15' },
  };

  // tapered capsule hanging down from its joint (joint at y=0, limb goes to -len)
  function limbGeo(len, rt, rb) {
    const r = Math.max(rt, rb), g = new THREE.CapsuleGeometry(r, len, 6, 16), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = clamp((y + len / 2 + r) / (len + 2 * r), 0, 1), s = lerp(rb, rt, t) / r; p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); }
    g.translate(0, -len / 2, 0); g.computeVertexNormals(); return g;
  }
  const toon = c => new THREE.MeshToonMaterial({ color: new THREE.Color(c), gradientMap: TOON });
  function part(geo, mat, parent, outline = 1.045) {
    const m = new THREE.Mesh(geo, mat); parent.add(m);
    if (outline) { const o = new THREE.Mesh(geo, OUTLINE); o.scale.setScalar(outline); m.add(o); }
    return m;
  }

  // find the neck in the drawing: the narrowest row below the widest part of the head
  function findNeck(img) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data, w = c.width, h = c.height, wid = new Float32Array(h);
    for (let y = 0; y < h; y++) { let a = -1, b = -1; for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 1] > 128) { if (a < 0) a = i; b = i; } wid[y] = a < 0 ? 0 : b - a; }
    const sm = wid.map((_, y) => { let s = 0, n = 0; for (let k = -3; k <= 3; k++) { const v = wid[y + k]; if (v != null) { s += v; n++; } } return s / n; });
    let best = -1, bw = 1e9, headMax = 0;
    for (let y = 0; y < h; y++) { if (y < h * .3) { headMax = Math.max(headMax, sm[y]); continue; } if (y > h * .88) break; headMax = Math.max(headMax, y < h * .5 ? sm[y] : headMax); if (sm[y] < bw) { bw = sm[y]; best = y; } }
    return best > 0 && bw < headMax * .78 ? best / h : 1;
  }
  function headTexture(img, cut) {
    const h = Math.max(8, Math.round(img.height * clamp(cut + .03, .25, 1))), c = document.createElement('canvas'); c.width = img.width; c.height = h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    // soften the cut so the chin blends into the neck (fade the line/body channels the shader reads)
    if (cut < .99) { const im = x.getImageData(0, 0, c.width, h), d = im.data, y0 = Math.floor(h * .88);
      for (let y = y0; y < h; y++) { const k = 1 - (y - y0) / Math.max(1, h - y0); for (let i = 0; i < c.width; i++) { const o = (y * c.width + i) * 4; d[o] *= k; d[o + 1] *= k; d[o + 3] *= k; } }
      x.putImageData(im, 0, 0); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
  }

  class FullBody {
    constructor(def, maskImg, cfg) {
      this.def = def; this.cfg = cfg; this.full = true; this.maskImg = maskImg;
      this.group = new THREE.Group(); this.inner = new THREE.Group(); this.group.add(this.inner);
      this.vel = new THREE.Vector3(); this.y = 0; this.vy = 0; this.face = 1; this.yaw = 0; this.phase = 0; this.dance = 0; this.wave = 0; this.land = 0; this.crouch = 0; this.t = 0;
      const sh = new THREE.Mesh(new THREE.CircleGeometry(.5, 32), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false, opacity: .55 }));
      sh.rotation.x = -Math.PI / 2; sh.position.y = .01; this.shadow = sh; this.group.add(sh);
      this.build();
    }
    build() {
      if (this.rig) { this.inner.remove(this.rig.root); this.rig.root.traverse(o => { if (o.geometry && o.geometry !== this.headGeo) o.geometry.dispose(); }); if (this.head) this.head.dispose(); }
      const c = this.cfg, O = OUTFITS[c.outfit] || OUTFITS.casual, bw = c.build || 1, legK = c.legs || 1;
      const skin = toon(c.skin || c.fill), shirt = toon(c.shirt || O.shirt), pants = toon(c.pants || O.pants), shoes = toon(c.shoes || O.shoes);
      this.mats = [skin, shirt, pants, shoes];
      const R = {}; const root = new THREE.Group(); R.root = root;
      const TH = .34 * legK, SH = .32 * legK, hipY = TH + SH + .085;
      R.hips = new THREE.Group(); R.hips.position.y = hipY; root.add(R.hips);
      R.spine = new THREE.Group(); R.hips.add(R.spine);
      // torso (lathe profile: hips -> waist -> chest -> shoulders)
      const prof = [[0, -.03], [.135, -.01], [.15, .06], [.13, .15], [.155, .25], [.18, .33], [.165, .41], [.07, .45], [0, .46]].map(([r, y]) => new THREE.Vector2(r * bw, y));
      const tg = new THREE.LatheGeometry(prof, 24); tg.scale(1, 1, .72); part(tg, shirt, R.spine);
      if (O.belt) { const b = new THREE.Mesh(new THREE.TorusGeometry(.142 * bw, .022, 8, 32), toon(O.belt)); b.rotation.x = Math.PI / 2; b.scale.set(1, .72, 1); b.position.y = .03; R.spine.add(b); }
      if (O.stripe) { for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(.02, .36, .02), toon(O.stripe)); st.position.set(s * .1 * bw, .2, .12 * .72 * bw + .005); R.spine.add(st); } }
      R.chest = new THREE.Group(); R.chest.position.y = .3; R.spine.add(R.chest);
      // neck + head (Ali's drawing on a cut-out head with depth)
      R.neck = new THREE.Group(); R.neck.position.y = .14; R.chest.add(R.neck);
      part(limbGeo(.06, .045, .05), skin, R.neck).position.y = .07;
      R.headJ = new THREE.Group(); R.headJ.position.y = .07; R.neck.add(R.headJ);
      const cut = c.headCut != null ? c.headCut : findNeck(this.maskImg); this.cut = cut;
      const ht = headTexture(this.maskImg, cut), asp = ht.image.width / ht.image.height;
      const headH = .5 * (c.headK || 1.35), headW = Math.min(.95, headH * asp);
      this.head = new Character({ cfg: c }, ht); this.head.cfg = Object.assign({}, c, { size: headW / asp, sw: 1, sh: 1, thick: .45 });
      this.head.aspect = asp; this.head.apply(); this.head.setThick(1); this.head.shadow.visible = false;
      this.head.group.position.set(0, -.04, .05); R.headJ.add(this.head.group);
      // the drawn head keeps its own depth (layered cut-out), so no extra skull is needed
      // arms
      for (const s of [-1, 1]) {
        const sh = new THREE.Group(); sh.position.set(s * .185 * bw, .09, 0); R.chest.add(sh);
        part(new THREE.SphereGeometry(.058 * bw, 14, 10), shirt, sh);
        part(limbGeo(.24, .056 * bw, .046 * bw), shirt, sh);
        const el = new THREE.Group(); el.position.y = -.25; sh.add(el);
        part(limbGeo(.22, .045 * bw, .038 * bw), O.sleeves === 'long' ? shirt : skin, el);
        const wr = new THREE.Group(); wr.position.y = -.235; el.add(wr);
        const hand = part(new THREE.SphereGeometry(.05, 14, 10), skin, wr); hand.scale.set(.9, 1.15, .75); hand.position.y = -.045;
        const th = part(new THREE.SphereGeometry(.02, 8, 6), skin, wr, 1.08); th.position.set(-s * .035, -.03, .025);
        R[s < 0 ? 'shL' : 'shR'] = sh; R[s < 0 ? 'elL' : 'elR'] = el; R[s < 0 ? 'wrL' : 'wrR'] = wr;
      }
      // legs
      for (const s of [-1, 1]) {
        const hp = new THREE.Group(); hp.position.set(s * .085 * bw, 0, 0); R.hips.add(hp);
        part(limbGeo(TH, .075 * bw, .058 * bw), pants, hp);
        const kn = new THREE.Group(); kn.position.y = -TH; hp.add(kn);
        part(limbGeo(SH, .058 * bw, .045 * bw), pants, kn);
        const an = new THREE.Group(); an.position.y = -SH; kn.add(an);
        const shoe = part(new THREE.CapsuleGeometry(.052, .12, 6, 12), shoes, an); shoe.rotation.x = Math.PI / 2; shoe.scale.set(1, 1, .75); shoe.position.set(0, -.045, .045);
        R[s < 0 ? 'hipL' : 'hipR'] = hp; R[s < 0 ? 'knL' : 'knR'] = kn; R[s < 0 ? 'anL' : 'anR'] = an;
      }
      // Saudi thobe: a long robe from the chest to the ankles, legs move underneath
      if (O.robe) { const rp = [[.0, -hipY + .07], [.24, -hipY + .07], [.2, -hipY * .5], [.16, 0], [.16, .2], [.185, .33], [.17, .41], [.08, .45], [0, .46]].map(([r, y]) => new THREE.Vector2(r * bw, y));
        const rg = new THREE.LatheGeometry(rp, 28); rg.scale(1, 1, .8); R.robe = part(rg, shirt, R.spine, 1.03); }
      if (O.cape) { const cg = new THREE.PlaneGeometry(.38 * bw, .75, 6, 10); cg.translate(0, -.375, 0); const cm = toon(O.cape); cm.side = THREE.DoubleSide;
        R.cape = new THREE.Mesh(cg, cm); R.cape.position.set(0, .43, -.12 * bw); R.spine.add(R.cape); R.capeBase = cg.attributes.position.array.slice(); }
      this.rig = R; this.inner.add(root);
      this.hipY = hipY; this.H = hipY + .3 + .14 + .07 + headH; this.W = .45 * bw;
      const s = (c.size || 1.4) / 1.4 * 1.15; this.scaleK = s; root.scale.setScalar(s); this.H *= s; this.W *= s; this.headH = headH * s;
      this.shadow.scale.setScalar(Math.max(.6, this.W * 1.6));
    }
    apply() { this.build(); }
    setThick() { }
    steer(dt) { const v = this.vel; if (v.length() > .3) { const want = Math.atan2(v.x, v.z); let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * 10); } this.inner.rotation.y = this.yaw; }
    // keep the drawn face readable: the head turns toward the camera (within a natural range)
    lookAt(camPos) { const hp = new THREE.Vector3(); this.rig.headJ.getWorldPosition(hp); const want = Math.atan2(camPos.x - hp.x, camPos.z - hp.z); let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.rig.headJ.rotation.y = lerp(this.rig.headJ.rotation.y, clamp(d, -1.35, 1.35), .2); }
    update(dt, t, moving, speed) {
      const R = this.rig; this.t = t; this.head.update(dt, t, false, 0);
      const run = clamp((speed - 3.2) / 2.5, 0, 1), walk = moving ? 1 : 0;
      this.w = lerp(this.w || 0, walk, dt * 8); this.r = lerp(this.r || 0, run * walk, dt * 6);
      const w = this.w, r = this.r; this.phase += dt * (moving ? 5.2 + speed * 1.15 : 0); const p = this.phase;
      const A = lerp(.48, .95, r), Ak = lerp(.95, 1.55, r), Aa = lerp(.45, 1.05, r);
      // legs: classic cycle — thigh swing, knee folds on the passing pose, foot stays flat
      for (const [s, ph] of [['L', 0], ['R', Math.PI]]) {
        const q = p + ph, th = Math.sin(q) * A * w, kn = (Math.max(0, Math.sin(q - 1.2)) * Ak + .08) * w;
        R['hip' + s].rotation.x = -th; R['kn' + s].rotation.x = kn; R['an' + s].rotation.x = (th * .45 - kn * .55) * w;
      }
      // arms swing opposite to the legs, elbows bend more when running
      for (const [s, ph, side] of [['L', Math.PI, -1], ['R', 0, 1]]) {
        const sw = Math.sin(p + ph) * Aa * w; R['sh' + s].rotation.x = sw; R['sh' + s].rotation.z = side * (.12 + .05 * Math.sin(t * 1.6) * (1 - w));
        R['el' + s].rotation.x = -(.25 + Math.max(0, sw) * .35 + r * 1.1) * Math.max(w, .4);
      }
      // body: bob twice per cycle, hip/chest counter-twist, lean when running, breathe when idle
      const bob = (Math.cos(p * 2) * .5 + .5) * lerp(.035, .07, r) * w;
      R.hips.position.y = this.hipY - bob - this.crouch * .18; R.hips.rotation.y = Math.sin(p) * .12 * w; R.chest.rotation.y = -Math.sin(p) * .18 * w; R.hips.rotation.z = Math.sin(p) * .04 * w;
      R.spine.rotation.x = r * .22 + this.crouch * .3; R.chest.scale.setScalar(1 + .012 * Math.sin(t * 2.2) * (1 - w)); R.neck.rotation.x = -r * .15;
      if (this.crouch > 0) { for (const s of ['L', 'R']) { R['hip' + s].rotation.x -= this.crouch * .9; R['kn' + s].rotation.x += this.crouch * 1.6; R['an' + s].rotation.x -= this.crouch * .6; } this.crouch = Math.max(0, this.crouch - dt * 6); }
      // in the air: tuck legs, arms up
      if (this.y > .05) { const k = clamp(this.y, 0, 1); for (const s of ['L', 'R']) { R['kn' + s].rotation.x = lerp(R['kn' + s].rotation.x, 1.1, k); R['hip' + s].rotation.x = lerp(R['hip' + s].rotation.x, s === 'L' ? -.7 : -.2, k); }
        R.shL.rotation.z = lerp(R.shL.rotation.z, -1.2, k); R.shR.rotation.z = lerp(R.shR.rotation.z, 1.2, k); }
      // wave hello (right arm) and dance
      if (this.wave > 0) { this.wave -= dt; const k = Math.min(1, this.wave * 3, 1); R.shR.rotation.z = lerp(R.shR.rotation.z, 2.6, k); R.shR.rotation.x = 0; R.elR.rotation.z = Math.sin(t * 14) * .5 * k; R.elR.rotation.x = 0; }
      else R.elR.rotation.z = lerp(R.elR.rotation.z, 0, dt * 8);
      if (this.dance > 0) { this.dance -= dt; const k = Math.sin(t * 9); R.hips.rotation.y = k * .5; R.shL.rotation.z = -1.6 - k * .6; R.shR.rotation.z = 1.6 - k * .6; R.elL.rotation.x = R.elR.rotation.x = -1; R.hips.position.y += Math.abs(k) * .05; this.inner.rotation.y += dt * 4; this.yaw = this.inner.rotation.y; }
      // landing squash
      let sq = 1; if (this.land > 0) { this.land -= dt; sq = 1 - .16 * Math.sin(clamp(1 - this.land / .25, 0, 1) * Math.PI); }
      R.root.scale.set(this.scaleK / Math.sqrt(sq), this.scaleK * sq, this.scaleK / Math.sqrt(sq));
      if (R.robe) R.robe.rotation.x = Math.sin(p) * .04 * w + r * .05;
      if (R.cape) { const a = R.cape.geometry.attributes.position, b = R.capeBase; for (let i = 0; i < a.count; i++) { const y = b[i * 3 + 1], k = -y / .75; a.array[i * 3 + 2] = b[i * 3 + 2] - k * k * (.15 + .5 * r + .25 * w) + Math.sin(t * 6 + b[i * 3] * 8 + y * 6) * .03 * k; } a.needsUpdate = true; }
      this.shadow.material.opacity = .5 * clamp(1 - this.y / 4, .15, 1); this.shadow.scale.setScalar(Math.max(.6, this.W * 1.6) * clamp(1 - this.y / 6, .5, 1));
    }
    setGlow(k, color) { for (const m of this.mats) { m.emissive = new THREE.Color(color); m.emissiveIntensity = k; } }
    dispose() { this.rig.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.head.dispose(); this.shadow.geometry.dispose(); }
  }
  return { FullBody, OUTFITS, findNeck };
}
