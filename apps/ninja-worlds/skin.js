// Custom 3D character: load a rigged .glb (Meshy / Tripo / Mixamo…) and drive its animation clips from the player state
import * as THREE from 'three';
import { GLTFLoader } from 'gltf';
import { BASE, applyPose } from './hero.js';

const PICK = {
  idle: /idle|stand|breath|wait/i, walk: /walk/i, run: /run|sprint|jog/i, jump: /jump/i, fall: /fall|air/i,
  attack: /attack|slash|sword|punch|strike|combo|kick|hit_?1|melee/i, roll: /roll|dodge|evade/i, swim: /swim/i,
  climb: /climb|hang|ledge/i, hurt: /hurt|damage|react|hit(?!_?1)/i, spin: /spin|whirl|special/i,
};
const DB = 'nw_skin', STORE = 'files';
function idb() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
export async function saveSkinFile(buf) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(buf, 'hero'); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
export async function loadSkinFile() { try { const db = await idb(); return await new Promise((res) => { const t = db.transaction(STORE, 'readonly'); const r = t.objectStore(STORE).get('hero'); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); } catch (e) { return null; } }
export async function clearSkinFile() { try { const db = await idb(); const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete('hero'); } catch (e) {} }

export class Skin {
  constructor(hero) { this.hero = hero; this.wrap = null; this.mixer = null; this.clips = {}; this.cur = null; this.curName = ''; this.atkKey = ''; this.swordHome = hero.sword.parent; }
  get active() { return !!this.wrap; }
  async load(buf) {
    const gltf = await new GLTFLoader().parseAsync(buf, '');
    this.set(gltf.scene, gltf.animations || []);
    return this.mode === 'clips' ? Object.keys(this.clips) : [];
  }
  set(model, animations) {
    this.clear();
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), h = Math.max(0.01, box.max.y - box.min.y), s = 1.78 / h;
    const wrap = new THREE.Group(), inner = new THREE.Group(); wrap.add(inner); inner.add(model);
    inner.scale.setScalar(s); inner.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material && 'envMapIntensity' in o.material) o.material.envMapIntensity = 0.6; } });
    this.hero.root.add(wrap); this.wrap = wrap; this.hero.body.visible = false;
    // animations (root motion stripped so the controller stays in charge of movement)
    this.mixer = new THREE.AnimationMixer(model); this.clips = {};
    const all = animations.map((c) => { c = c.clone(); c.tracks = c.tracks.filter((t) => !(/\.position$/.test(t.name) && /hips|root|pelvis|armature/i.test(t.name))); return c; });
    for (const [k, re] of Object.entries(PICK)) { const c = all.find((a) => re.test(a.name)); if (c) this.clips[k] = c; }
    const good = ['walk', 'run'].some((k) => this.clips[k]);
    if (!this.clips.idle && all[0]) this.clips.idle = all[0];
    // ✨ «النفخ بالحياة»: إذا الملف ما فيه حركات كافية — نحرّكه بنفس حركات النينجا (نكتشف العظام، أو نبني هيكل تلقائياً لو ما فيه)
    this.mode = 'clips'; this.map = null;
    if (!good) { const ok = this.rigLife(model); if (ok) { this.mode = 'life'; this.mixer = null; } }
    // put the sword in the right hand if the rig has one
    let hand = null; model.traverse((o) => { if (!hand && o.isBone && /right.?hand|hand.?r(\b|_)|r_?hand/i.test(o.name)) hand = o; });
    if (hand) {
      hand.add(this.hero.sword); hand.updateMatrixWorld(true);
      const ws = new THREE.Vector3(); hand.getWorldScale(ws); this.hero.sword.scale.setScalar(1 / Math.max(1e-4, ws.x) * 0.9);
      this.hero.sword.position.set(0, 0, 0); this.hero.sword.rotation.set(Math.PI / 2, 0, 0);
    }
    if (this.mode === 'clips') this.play('idle', 0);
  }
  clear() {
    if (!this.wrap) return;
    if (this.hero.sword.parent !== this.swordHome) { this.swordHome.add(this.hero.sword); this.hero.sword.scale.setScalar(1); this.hero.sword.position.set(0, -0.02, 0.02); this.hero.sword.rotation.set(0, 0, 0); }
    this.wrap.removeFromParent(); this.wrap.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.wrap = null; this.mixer = null; this.clips = {}; this.mode = null; this.map = null; this.cur = null; this.curName = ''; this.hero.body.visible = true;
  }
  /* ---------- ✨ النفخ بالحياة ---------- */
  rigLife(model) {
    model.updateMatrixWorld(true);
    let skinned = null; model.traverse((o) => { if (!skinned && o.isSkinnedMesh && o.skeleton) skinned = o; });
    let bones = skinned ? this.findBones(skinned.skeleton.bones) : null;
    if (!bones || !bones.upperArmL || !bones.thighL) bones = this.autoRig(model); // ما فيه هيكل مفهوم = نبني واحد
    if (!bones) return false;
    this.bindLife(bones); this.autoRigged = !skinned || bones._auto; return true;
  }
  findBones(list) {
    const N = (b) => b.name.toLowerCase().replace(/mixamorig[:_]?|armature[|:_]?|bip0?1[ _]?|def[-_]|cc_base_|[:]/g, '');
    const side = (n) => /(^|[^a-z])l([^a-z]|$)|left|\.l$|_l$/.test(n) ? 'L' : /(^|[^a-z])r([^a-z]|$)|right|\.r$|_r$/.test(n) ? 'R' : '';
    const out = {}, put = (k, b) => { if (!out[k]) out[k] = b; };
    for (const b of list) {
      const n = N(b); if (/finger|thumb|index|middle|ring|pinky|toe_end|end$|twist|ik|pole|target/.test(n)) continue;
      const sd = side(n);
      if (/hips|pelvis/.test(n)) put('hips', b);
      else if (/neck/.test(n)) put('neck', b);
      else if (/head(?!.*top)/.test(n)) put('head', b);
      else if (/chest|spine.?0?2|upperchest/.test(n)) put('chest', b);
      else if (/spine/.test(n)) put('spine', b);
      else if (sd && /fore.?arm|lower.?arm|elbow/.test(n)) put('foreArm' + sd, b);
      else if (sd && /hand/.test(n)) put('hand' + sd, b);
      else if (sd && /up.?leg|thigh/.test(n)) put('thigh' + sd, b);
      else if (sd && /calf|shin|lower.?leg|knee|(^|[^p])leg/.test(n)) put('shin' + sd, b);
      else if (sd && /foot|ankle/.test(n)) put('foot' + sd, b);
      else if (sd && /upper.?arm|arm/.test(n)) put('upperArm' + sd, b);
    }
    return out;
  }
  /* هيكل تلقائي لمجسّم بدون عظام: نحلّل الشكل (الطول، الكتوف، اليدين، الرجلين) ونبني العظام ونوزّع الأوزان */
  autoRig(model) {
    const meshes = []; model.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.geometry && o.geometry.attributes.position) meshes.push(o); });
    if (!meshes.length) return null;
    const inv = new THREE.Matrix4().copy(model.matrixWorld).invert(), geos = meshes.map((m) => { const g = m.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); return g; });
    const box = new THREE.Box3(); geos.forEach((g) => { g.computeBoundingBox(); box.union(g.boundingBox); });
    const H = box.max.y - box.min.y, y0 = box.min.y, cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, Y = (f) => y0 + f * H;
    // وين اليدين؟ أبعد نقاط يمين ويسار بين الصدر والورك (T-pose / A-pose / يدين نازلة)
    let hl = null, hr = null; const v = new THREE.Vector3();
    for (const g of geos) { const p = g.attributes.position; for (let i = 0; i < p.count; i += 3) { v.fromBufferAttribute(p, i); if (v.y < Y(0.35) || v.y > Y(0.86)) continue; if (!hl || v.x > hl.x) hl = v.clone(); if (!hr || v.x < hr.x) hr = v.clone(); } }
    const span = Math.max(Math.abs(hl.x - cx), Math.abs(hr.x - cx)), armsOut = span > 0.24 * H;
    const shY = Y(0.81), shX = 0.11 * H;
    const handL = armsOut ? new THREE.Vector3(cx + (hl.x - cx) * 0.93, hl.y, cz) : new THREE.Vector3(cx + 0.16 * H, Y(0.5), cz);
    const handR = armsOut ? new THREE.Vector3(cx + (hr.x - cx) * 0.93, hr.y, cz) : new THREE.Vector3(cx - 0.16 * H, Y(0.5), cz);
    const P = { hips: [cx, Y(0.53), cz], spine: [cx, Y(0.62), cz], chest: [cx, Y(0.72), cz], neck: [cx, Y(0.83), cz], head: [cx, Y(0.88), cz], top: [cx, Y(1.0), cz],
      upperArmL: [cx + shX, shY, cz], upperArmR: [cx - shX, shY, cz], handL: handL.toArray(), handR: handR.toArray(),
      thighL: [cx + 0.055 * H, Y(0.5), cz], thighR: [cx - 0.055 * H, Y(0.5), cz], shinL: [cx + 0.055 * H, Y(0.27), cz], shinR: [cx - 0.055 * H, Y(0.27), cz], footL: [cx + 0.055 * H, Y(0.05), cz], footR: [cx - 0.055 * H, Y(0.05), cz] };
    for (const sd of ['L', 'R']) { const a = new THREE.Vector3(...P['upperArm' + sd]), h = new THREE.Vector3(...P['hand' + sd]); P['foreArm' + sd] = a.clone().lerp(h, 0.5).toArray(); P['toe' + sd] = [P['foot' + sd][0], Y(0.0), cz + 0.08 * H]; P['finger' + sd] = h.clone().add(h.clone().sub(a).setY(0).normalize().multiplyScalar(0.06 * H)).toArray(); }
    const tree = { hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', top: 'head', upperArmL: 'chest', foreArmL: 'upperArmL', handL: 'foreArmL', fingerL: 'handL', upperArmR: 'chest', foreArmR: 'upperArmR', handR: 'foreArmR', fingerR: 'handR',
      thighL: 'hips', shinL: 'thighL', footL: 'shinL', toeL: 'footL', thighR: 'hips', shinR: 'thighR', footR: 'shinR', toeR: 'footR' };
    const names = Object.keys(tree), B = {}, list = [];
    for (const k of names) { const b = new THREE.Bone(); b.name = 'auto_' + k; B[k] = b; list.push(b); }
    for (const k of names) { const par = tree[k], w = new THREE.Vector3(...P[k]); if (par) { B[par].add(B[k]); B[k].position.copy(w.sub(new THREE.Vector3(...P[par]))); } else B[k].position.copy(w); }
    const skel = new THREE.Skeleton(list), root = B.hips; model.add(root); root.updateMatrixWorld(true);
    // الأوزان: كل نقطة تتبع أقرب «عظمتين» (مسافة لخط العظمة) بنعومة
    const segs = names.filter((k) => tree[k]).map((k) => ({ i: names.indexOf(tree[k]), a: new THREE.Vector3(...P[tree[k]]), b: new THREE.Vector3(...P[k]), k: tree[k] }));
    const ab = new THREE.Vector3(), ap = new THREE.Vector3();
    const dseg = (p, sg) => { ab.subVectors(sg.b, sg.a); ap.subVectors(p, sg.a); const t = Math.max(0, Math.min(1, ap.dot(ab) / Math.max(1e-6, ab.lengthSq()))); return ap.sub(ab.multiplyScalar(t)).length(); };
    geos.forEach((g, mi) => {
      const p = g.attributes.position, n = p.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(p, i); let b1 = -1, d1 = 1e9, b2 = -1, d2 = 1e9;
        for (const sg of segs) { // منع الخلط: اليد/الذراع ما تمسك نقاط الجسم في النص، والرجل ما تمسك الطرف الثاني
          if (/Arm|hand|finger/.test(sg.k) && Math.abs(v.x - cx) < shX * 0.85) continue;
          if (/L$/.test(sg.k) && v.x < cx - 0.01 * H && /thigh|shin|foot/.test(sg.k)) continue; if (/R$/.test(sg.k) && v.x > cx + 0.01 * H && /thigh|shin|foot/.test(sg.k)) continue;
          const d = dseg(v, sg); if (d < d1) { b2 = b1; d2 = d1; b1 = sg.i; d1 = d; } else if (d < d2 && sg.i !== b1) { b2 = sg.i; d2 = d; } }
        const w1 = 1 / Math.pow(d1 + 1e-3, 4), w2 = b2 >= 0 ? 1 / Math.pow(d2 + 1e-3, 4) : 0, t = w1 + w2;
        si[i * 4] = Math.max(0, b1); si[i * 4 + 1] = Math.max(0, b2); sw[i * 4] = w1 / t; sw[i * 4 + 1] = w2 / t;
      }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      const m = meshes[mi], sm = new THREE.SkinnedMesh(g, m.material); sm.castShadow = true; sm.frustumCulled = false; model.add(sm); model.updateMatrixWorld(true); sm.bind(skel);
      m.visible = false; m.removeFromParent();
    });
    const out = {}; for (const k of names) out[k] = B[k]; out._auto = true; return out;
  }
  bindLife(bones) {
    const h = this.hero, root = h.root, rq = new THREE.Quaternion();
    // نصفّر النينجا على الوضع الأساسي عشان نحسب «فرق الدوران» للجذع والراس
    const save = { ...h.cur }; applyPose(h, BASE); root.updateMatrixWorld(true);
    root.getWorldQuaternion(rq); const rqi = rq.clone().invert(), localQ = (o) => o.getWorldQuaternion(new THREE.Quaternion()).premultiply(rqi);
    const ours = { hips: h.hips, spine: h.spine, chest: h.chest, neck: h.neck, head: h.head };
    // الأطراف: نخلي العظمة تأشر بنفس اتجاه طرف النينجا (يشتغل مهما كان وضع الملف T أو A)
    const LIMB = [['upperArmL', 'foreArmL', h.shL, h.elL], ['foreArmL', 'handL', h.elL, h.handL], ['upperArmR', 'foreArmR', h.shR, h.elR], ['foreArmR', 'handR', h.elR, h.handR],
      ['thighL', 'shinL', h.thL, h.knL], ['shinL', 'footL', h.knL, h.ftL], ['thighR', 'shinR', h.thR, h.knR], ['shinR', 'footR', h.knR, h.ftR]];
    const map = { rot: [], limb: [] };
    for (const k of ['hips', 'spine', 'chest', 'neck', 'head']) if (bones[k]) map.rot.push({ b: bones[k], o: ours[k], bq: localQ(bones[k]), oq: localQ(ours[k]) });
    const wp = (o) => root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
    for (const [a, c, oa, oc] of LIMB) if (bones[a] && bones[c]) map.limb.push({ b: bones[a], bq: localQ(bones[a]), bd: wp(bones[c]).sub(wp(bones[a])).normalize(), oa, oc });
    // الترتيب من الجذع للأطراف (الأب قبل الابن)
    const depth = (o) => { let n = 0; for (let p = o.parent; p; p = p.parent) n++; return n; }; map.limb.sort((x, y) => depth(x.b) - depth(y.b));
    applyPose(h, save); Object.assign(h.cur, save); this.map = map; this.rqi = rqi;
    if (h.sword.parent !== this.swordHome && !bones.handR) { this.swordHome.add(h.sword); }
    if (bones.handR && h.sword.parent === this.swordHome) { bones.handR.add(h.sword); const ws = new THREE.Vector3(); bones.handR.getWorldScale(ws); h.sword.scale.setScalar(0.9 / Math.max(1e-4, ws.x)); h.sword.position.set(0, 0, 0); h.sword.rotation.set(Math.PI / 2, 0, 0); }
  }
  lifeUpdate() {
    const M = this.map, h = this.hero, root = h.root; if (!M) return; root.updateMatrixWorld(true);
    const rq = root.getWorldQuaternion(new THREE.Quaternion()), rqi = rq.clone().invert(), lq = (o) => o.getWorldQuaternion(new THREE.Quaternion()).premultiply(rqi);
    const setRootQ = (b, q) => { const pq = b.parent ? lq(b.parent) : new THREE.Quaternion(); b.quaternion.copy(pq.invert().multiply(q)); b.updateMatrixWorld(true); };
    for (const r of M.rot) { const d = lq(r.o).multiply(r.oq.clone().invert()); setRootQ(r.b, d.multiply(r.bq)); } // نفس فرق دوران الجذع/الراس
    const pa = new THREE.Vector3(), pc = new THREE.Vector3(), q = new THREE.Quaternion();
    for (const L of M.limb) { root.worldToLocal(L.oa.getWorldPosition(pa)); root.worldToLocal(L.oc.getWorldPosition(pc)); const now = pc.sub(pa).normalize(); q.setFromUnitVectors(L.bd, now); setRootQ(L.b, q.multiply(L.bq)); }
  }
  play(name, fade = 0.18, restart = false) {
    const order = { walk: ['walk', 'run', 'idle'], run: ['run', 'walk', 'idle'], jump: ['jump', 'fall', 'idle'], fall: ['fall', 'jump', 'idle'], attack: ['attack', 'idle'], spin: ['spin', 'attack', 'idle'], roll: ['roll', 'jump', 'idle'], swim: ['swim', 'walk', 'idle'], climb: ['climb', 'idle'], hurt: ['hurt', 'idle'], idle: ['idle'] }[name] || ['idle'];
    const key = order.find((k) => this.clips[k]); if (!key || !this.mixer) return;
    if (key === this.curName && !restart) return;
    const a = this.mixer.clipAction(this.clips[key]);
    const once = key === 'attack' || key === 'roll' || key === 'hurt' || key === 'spin' || (key === 'jump' && name !== 'swim');
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once; a.reset().play();
    if (this.cur && this.cur !== a) this.cur.crossFadeTo(a, fade, false); else a.fadeIn(fade);
    this.cur = a; this.curName = key;
  }
  update(dt, P) {
    if (this.mode === 'life') return this.lifeUpdate();
    if (!this.mixer) return;
    const hs = Math.hypot(P.vel.x, P.vel.z), st = P.state;
    let want = 'idle', restart = false;
    if (st === 'ground') want = hs > 4.2 ? 'run' : hs > 0.6 ? 'walk' : 'idle';
    else if (st === 'air') want = P.vel.y > 0 ? 'jump' : 'fall';
    else if (st === 'wallrun') want = 'run';
    else if (st === 'wallup' || st === 'hang' || st === 'climb' || st === 'swing') want = 'climb';
    else if (st === 'roll') want = 'roll';
    else if (st === 'attack' || st === 'slam') { want = 'attack'; const k = P.combo + ':' + Math.round(P.st.aT > 0.05 ? 1 : 0); if (P.st.aT < 0.05 && this.atkKey !== P.combo + '@' + P.t.toFixed(1)) { restart = true; this.atkKey = P.combo + '@' + P.t.toFixed(1); } }
    else if (st === 'spin') want = 'spin';
    else if (st === 'swim') want = 'swim';
    else if (st === 'hurt') want = 'hurt';
    this.play(want, 0.16, restart);
    if (this.cur && (this.curName === 'run' || this.curName === 'walk')) this.cur.timeScale = Math.max(0.6, Math.min(1.6, hs / (this.curName === 'run' ? 7 : 3)));
    else if (this.cur) this.cur.timeScale = 1;
    this.mixer.update(dt);
  }
}
