// Custom 3D character: load a rigged .glb (Meshy / Tripo / Mixamo…) and drive its animation clips from the player state
import * as THREE from 'three';
import { GLTFLoader } from 'gltf';

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
    return Object.keys(this.clips);
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
    if (!this.clips.idle && all[0]) this.clips.idle = all[0];
    // put the sword in the right hand if the rig has one
    let hand = null; model.traverse((o) => { if (!hand && o.isBone && /right.?hand|hand.?r(\b|_)|r_?hand/i.test(o.name)) hand = o; });
    if (hand) {
      hand.add(this.hero.sword); hand.updateMatrixWorld(true);
      const ws = new THREE.Vector3(); hand.getWorldScale(ws); this.hero.sword.scale.setScalar(1 / Math.max(1e-4, ws.x) * 0.9);
      this.hero.sword.position.set(0, 0, 0); this.hero.sword.rotation.set(Math.PI / 2, 0, 0);
    }
    this.play('idle', 0);
  }
  clear() {
    if (!this.wrap) return;
    if (this.hero.sword.parent !== this.swordHome) { this.swordHome.add(this.hero.sword); this.hero.sword.scale.setScalar(1); this.hero.sword.position.set(0, -0.02, 0.02); this.hero.sword.rotation.set(0, 0, 0); }
    this.wrap.removeFromParent(); this.wrap.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.wrap = null; this.mixer = null; this.clips = {}; this.cur = null; this.curName = ''; this.hero.body.visible = true;
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
