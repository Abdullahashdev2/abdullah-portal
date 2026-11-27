// World layouts. Units: metres. Jump ≈ 2 m high / 5 m long; wall-run ≈ 10 m; wall-climb ≈ 4 m then ledge-grab.
import * as THREE from 'three';
const V = THREE.Vector3;
const zone = (x, z, w, d, y, pad = 1) => ({ x0: x - w / 2 + pad, x1: x + w / 2 - pad, z0: z - d / 2 + pad, z1: z + d / 2 - pad, y });

/* ===================== HUB ===================== */
export function hub(K, L, S) {
  const from = S._from;
  const cfg = {
    id: 'hub', name: 'ساحة البوابات', sub: 'مركز العوالم', music: 'hub', killY: -25, motes: 0xfff3c4,
    sky: { elev: 26, azim: 160, turb: 5, ray: 1.4, mie: 0.004, mieG: 0.8 }, exposure: 0.5, env: 0.3, fog: [0xb4cbe6, 0.0035], sun: [0xfff1d6, 2.8], hemi: [0xcfe8ff, 0x6b5a4a, 0.9],
    spawn: from === 'w3' ? { pos: new V(6.5, 0.3, 0), yaw: -Math.PI / 2 } : from === 'w1' ? { pos: new V(0, 0.3, 6.5), yaw: Math.PI } : from === 'w2' ? { pos: new V(-6.5, 0.3, 0), yaw: Math.PI / 2 } : { pos: new V(0, 0, -7), yaw: 0 },
  };
  K.plat({ x: 0, y: 0, z: 0, w: 24, d: 24, h: 1.5, m: 'marble', tile: 3, rockDepth: 18 });
  K.plat({ x: 0, y: 0.3, z: 9.5, w: 6, d: 4, h: 0.3, m: 'gold', rock: false });
  K.plat({ x: -9.5, y: 0.3, z: 0, w: 4, d: 6, h: 0.3, m: 'gold', rock: false });
  K.plat({ x: 9.5, y: 0.3, z: 0, w: 4, d: 6, h: 0.3, m: 'gold', rock: false });
  K.portal({ x: 0, y: 0.3, z: 10.4, rot: 0, to: 'w1', label: S.done.w1 ? '✓ أطلال المكتبة البلورية' : 'أطلال المكتبة البلورية', color: 0xffc94d });
  const w2open = !!S.done.w1;
  K.portal({ x: -10.4, y: 0.3, z: 0, rot: Math.PI / 2, to: 'w2', label: w2open ? (S.done.w2 ? '✓ الجزر السماوية' : 'الجزر السماوية') : '🔒 الجزر السماوية', color: 0xc084fc, active: w2open, locked: !w2open && 'خلّص «أطلال المكتبة» أول عشان تنفتح هالبوابة 🔒' });
  const w3open = !!S.done.w2;
  K.portal({ x: 10.4, y: 0.3, z: 0, rot: -Math.PI / 2, to: 'w3', label: w3open ? (S.done.w3 ? '✓ حصن الرمال الذهبية' : 'حصن الرمال الذهبية') : '🔒 حصن الرمال الذهبية', color: 0xffb020, active: w3open, locked: !w3open && 'خلّص «الجزر السماوية» أول عشان تنفتح هالبوابة 🔒' });
  // centre monument
  K.plat({ x: 0, y: 0.5, z: 0, w: 3.2, d: 3.2, h: 0.5, m: 'dark', rock: false });
  K.crystal({ x: 0, y: 0.5, z: 0, color: 0x7dd3fc, s: 1.6, light: true, n: 7 });
  // practice corner (wall-run + wall-climb + ledge)
  K.wall({ x: -9.6, y: 4.5, z: -6.5, w: 0.6, d: 8, h: 4.5, m: 'dark', run: true });
  K.plat({ x: 8, y: 3.8, z: -8.5, w: 3, d: 3, h: 3.8, m: 'dark', rock: false, run: true, runFaces: ['-x', '-z'] });
  K.crystal({ x: 8, y: 3.8, z: -8.5, color: 0xfacc15, s: 0.7 });
  K.plat({ x: 8, y: 3.4, z: -3.5, w: 3, d: 2.6, h: 3.4, m: 'sand', rock: false });
  K.banner({ x: 8, y: 3.3, z: -2.15, color: 0x1d4ed8, h: 2.2 });
  // dressing
  [[-10.5, -10.5], [10.5, 10.5], [-10.5, 10.5], [10.5, -10.5]].forEach(([x, z]) => K.tree({ x, y: 0, z, s: 1.1 }));
  [[-4, -10.8], [4, -10.8], [-11, -2], [11, 3.5]].forEach(([x, z]) => K.brazier({ x, y: 0, z, light: x === -4 }));
  [[-3.6, 7.5], [3.6, 7.5]].forEach(([x, z]) => K.column({ x, y: 0, z, h: 4.2 }));
  K.mountains({ color: 0x8fa3c4, y: -60, hmin: 90, hmax: 190 }); K.clouds({ y: -26, n: 60 }); K.floaters({ center: new V(0, 0, 0), r: 140, color: 0x8a8097 });
  L.npcDef = { x: 3.2, y: 0, z: -4.5, yaw: -2.5 };
  K.trigger({ x: 0, z: -7, r: 3, text: S.done.w3 ? 'خلّصت العوالم الثلاثة! 🏆 تقدر ترجع لأي عالم تجمع الشظايا الناقصة — وعوالم جديدة جاية.' : S.done.w2 ? 'البوابة الذهبية يمين انفتحت: حصن الرمال 🏜️ — فيه حركة جديدة: التأرجح على الأعمدة!' : S.done.w2 ? 'خلّصت العالمين! 🏆 عوالم جديدة قادمة… تقدر ترجع لأي عالم تجمع الشظايا الناقصة.' : S.done.w1 ? 'رجعت بطل! 🌟 البوابة البنفسجية (يسار) انفتحت: الجزر السماوية.' : 'هلا! 👋 قدّامك البوابة الذهبية — بس أول جرّب الحركات: يسارك جدار مضيء تركض عليه، ويمينك صخرة تتسلقها.' });
  K.trigger({ x: -8.4, z: -6.5, r: 2.6, text: '🧱 اركض بمحاذاة الجدار المضيء واقفز — بتركض عليه! (وأنت عليه اضغط قفز عشان تنط بعيد)' });
  K.trigger({ x: 6, z: -7.5, r: 2.4, text: '⬆️ واجه الجدار المضيء واقفز — تطلع عليه وتتمسك بالحافة. بعدين اضغط لقدّام أو قفز عشان تطلع فوق.' });
  return cfg;
}

/* ===================== WORLD 1 ===================== */
export function w1(K, L, S) {
  const cfg = {
    id: 'w1', name: 'أطلال المكتبة البلورية', sub: 'العالم الأول', music: 'w1', killY: -14, motes: 0xffd59a, shardTotal: 10,
    sky: { elev: 5, azim: 195, turb: 9, ray: 2.6, mie: 0.006, mieG: 0.86 }, exposure: 0.5, env: 0.35, fog: [0xd99a74, 0.0055], sun: [0xffc58a, 3.2], hemi: [0xffd8b0, 0x40304a, 0.75],
    spawn: { pos: new V(0, 0, 0), yaw: 0 },
  };
  const sh = (n, x, y, z) => K.shard('w1-' + n, x, y, z, S.shards.includes('w1-' + n));
  // A — start
  K.plat({ x: 0, y: 0, z: 6, w: 14, d: 16, h: 1.2, rockDepth: 9 });
  K.checkpoint(-4, 0, 1, 0).on = true;
  K.arch({ x: 0, y: 0, z: 12, w: 7, h: 4.5 });
  K.column({ x: -6, y: 0, z: -1, h: 5 }); K.column({ x: 6, y: 0, z: -1, h: 5, broken: true }); K.column({ x: -6, y: 0, z: 8, h: 5, broken: true }); K.column({ x: 6, y: 0, z: 8, h: 5 });
  K.crystal({ x: -5.2, y: 0, z: 4, color: 0x67e8f9, light: true }); K.crystal({ x: 5.5, y: 0, z: 11, color: 0xc084fc, s: 0.8 });
  K.banner({ x: -6, y: 5.3, z: -0.55, color: 0x9f1239 }); K.banner({ x: 6, y: 5.3, z: 8.45, color: 0x9f1239 });
  K.tree({ x: 4.6, y: 0, z: 2.5, s: 0.9 });
  sh(1, 5, 0.8, 12.5); sh(8, 0, 0.8, -1.4);
  K.trigger({ x: 0, z: 0, r: 3, text: 'المكتبة القديمة سقطت في يد الظلال 🌑 — وصّلني لبوابتها الكبيرة! تحرّك واقفز بين الصخور.' });
  // B — stepping stones
  K.plat({ x: 0, y: 0, z: 19, w: 6, d: 6 });
  K.plat({ x: 3.7, y: 3.8, z: 19, w: 1.4, d: 1.4, h: 6, rock: false, m: 'dark' }); sh(3, 3.7, 4.5, 19);
  K.trigger({ x: 1.5, z: 19, r: 2.2, text: '🧗 العمود العالي: اقفز عليه وأنت لاصق فيه — بتتمسّك بالحافة، بعدين اطلع.' });
  K.plat({ x: 0, y: 0.8, z: 27, w: 5, d: 5 });
  K.plat({ x: 0, y: 1.6, z: 35, w: 5, d: 5 }); sh(2, 0, 3.0, 31);
  K.crystal({ x: -1.8, y: 1.6, z: 36.5, color: 0x67e8f9, s: 0.6 });
  // C — combat yard
  K.plat({ x: 0, y: 1.6, z: 50, w: 16, d: 18, h: 1.4, rockDepth: 10 });
  K.checkpoint(5.5, 1.6, 43, 0);
  K.column({ x: -7, y: 1.6, z: 45, h: 5 }); K.column({ x: 7, y: 1.6, z: 57, h: 5, broken: true }); K.brazier({ x: 6.5, y: 1.6, z: 47, light: true }); K.brazier({ x: -6.5, y: 1.6, z: 53 });
  K.trigger({ x: 0, z: 44, y: 1.6, r: 3.5, text: '⚔️ ظلال! اضرب بالسيف — ٣ ضربات ورا بعض = كومبو. عيونها تحمرّ قبل الهجمة: تدحرج 🌀 وقتها!' });
  const yz = zone(0, 50, 16, 18, 1.6);
  K.enemy({ x: -3, y: 1.6, z: 52, zone: yz }); K.enemy({ x: 3, y: 1.6, z: 54, zone: yz });
  sh(10, 7, 2.3, 42);
  // D — wall-run chasm
  K.wall({ x: -4.3, y: 6, z: 63, w: 0.6, d: 12, h: 12, m: 'dark', run: true });
  K.checkpoint(-2.6, 1.6, 55.5, 0);
  K.trigger({ x: -2.5, z: 56, y: 1.6, r: 2.8, text: '🧱 الفجوة كبيرة! اركض لاصق بالجدار المضيء واقفز — بتركض عليه لين الجهة الثانية.' });
  sh(4, -3.4, 3.4, 64);
  // E — tower climb
  K.plat({ x: 0, y: 1.6, z: 74, w: 10, d: 10, h: 1.2 });
  K.plat({ x: 0, y: 6.6, z: 82, w: 10, d: 6, h: 10.6, rock: false, run: true, runFaces: ['-z'] });
  K.crystal({ x: 3.5, y: 1.6, z: 71, color: 0xfacc15, s: 0.7, light: true });
  K.trigger({ x: 0, z: 76, y: 1.6, r: 3.5, text: '⬆️ الجدار عالي: واجهه واقفز — بتركض لفوق وتتمسك بالحافة، بعدين اضغط قفز تطلع.' });
  K.checkpoint(-3.5, 6.6, 83, 0); sh(9, 4.4, 7.4, 84.4);
  // F — narrow beams
  K.plat({ x: 0, y: 6.6, z: 88.5, w: 0.32, d: 7, h: 0.32, rock: false, m: 'wood' });
  K.plat({ x: 0, y: 6.6, z: 97.25, w: 0.32, d: 7.5, h: 0.32, rock: false, m: 'wood' });
  K.chain({ x: -1.6, y: 12, z: 90, len: 6 }); K.chain({ x: 1.6, y: 12.5, z: 96, len: 6 });
  K.crystal({ x: 2.5, y: -3, z: 93, color: 0xc084fc, s: 1.4 }); K.crystal({ x: -2.5, y: -4, z: 98, color: 0x67e8f9, s: 1.2 });
  K.trigger({ x: 0, z: 85.8, y: 6.6, r: 1.6, text: '🪵 ممر ضيق فوق الهاوية — امشِ بالنص وبالراحة… وفيه فتحة، اقفزها!' });
  sh(5, 0, 7.7, 97);
  // G — crystal & gate
  K.plat({ x: 0, y: 6.6, z: 110, w: 14, d: 18, h: 1.4, rockDepth: 10 });
  K.checkpoint(-4.5, 6.6, 103, 0);
  K.plat({ x: -11.5, y: 7.4, z: 108, w: 3, d: 3, h: 1 });
  const cr = K.item({ id: 'w1-crystal', kind: 'crystal', x: -11.5, y: 7.4, z: 107.6, color: 0x67e8f9 });
  sh(6, -11.5, 8.2, 109.3);
  const gate = K.gate({ x: 0, y: 6.6, z: 119.5, w: 22, h: 7, d: 1 });
  K.column({ x: -11.5, y: 6.6, z: 119.5, h: 8, r: 0.6 }); K.column({ x: 11.5, y: 6.6, z: 119.5, h: 8, r: 0.6 });
  K.pedestal({ x: 4, y: 6.6, z: 115, accept: 'crystal', onFill: () => { gate.openGate(); L.say('البوابة انفتحت! 🔓 بس حاس فيه شي ينتظرنا وراها…'); L.sfx('gate'); L.shake(0.4); } });
  K.trigger({ x: 0, z: 104, y: 6.6, r: 3.2, text: '🔒 البوابة مقفلة. شايف البلّورة اللي على الصخرة يسار؟ هاتها (زر ✋) وحطها على المنصة الذهبية.' });
  cr.onPick = () => { if (!L.ambushed) { L.ambushed = true; L.spawnGroup('ambush'); L.say('كمين! ⚠️ نزّل البلّورة (✋) وحارب، بعدين ارجع خذها.'); } };
  const gz = zone(0, 110, 14, 18, 6.6);
  K.enemy({ x: -3, y: 6.6, z: 113, zone: gz, group: 'ambush' }); K.enemy({ x: 3, y: 6.6, z: 106, zone: gz, group: 'ambush' });
  K.brazier({ x: -6, y: 6.6, z: 117.5, light: true }); K.brazier({ x: 6, y: 6.6, z: 117.5 });
  K.banner({ x: -11.5, y: 14.2, z: 118.85, color: 0x1e3a8a, h: 4 }); K.banner({ x: 11.5, y: 14.2, z: 118.85, color: 0x1e3a8a, h: 4 });
  // H — arena + exit portal
  K.plat({ x: 0, y: 6.6, z: 132, w: 20, d: 24, h: 1.4, m: 'dark', rockDepth: 12 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; K.column({ x: Math.cos(a) * 8.6, y: 6.6, z: 132 + Math.sin(a) * 10.4, h: 5, broken: i % 3 === 0 }); }
  K.crystal({ x: -7.5, y: 6.6, z: 142, color: 0xc084fc, s: 1.3, light: true }); K.crystal({ x: 7.5, y: 6.6, z: 122.5, color: 0x67e8f9, s: 1.1 });
  sh(7, 8.2, 7.4, 142.5);
  const az = zone(0, 132, 20, 24, 6.6);
  K.enemy({ x: -4, y: 6.6, z: 130, zone: az, group: 'arena' }); K.enemy({ x: 4, y: 6.6, z: 131, zone: az, group: 'arena' }); K.enemy({ x: 0, y: 6.6, z: 135, zone: az, group: 'arena' }); K.enemy({ x: 0, y: 6.6, z: 138, zone: az, group: 'arena', type: 'brute' });
  K.trigger({ x: 0, z: 124, y: 6.6, r: 4, group: 'arena', text: '👹 حارس المكتبة! الكبير يضرب الأرض — ابعد عنه لما يرفع يدينه، واضربه من الجنب.' });
  const exit = K.portal({ x: 0, y: 6.6, z: 141, rot: Math.PI, to: 'hub', label: 'رجوع للساحة', color: 0xffc94d, active: false });
  L.onClear.arena = () => { exit.setActive(true); L.say('سويتها!! 🏆 المكتبة رجعت لها الحياة. البوابة فتحت — ادخلها.'); L.sfx('win'); L.complete = true; };
  // scenery
  K.mountains({ color: 0x9a6a7a, y: -50 }); K.clouds({ y: -28, n: 80, color: 0xffd1b0 }); K.floaters({ center: new V(0, 0, 70), r: 110, color: 0x8a6d6d });
  return cfg;
}

/* ===================== WORLD 2 ===================== */
export function w2(K, L, S) {
  const cfg = {
    id: 'w2', name: 'الجزر السماوية', sub: 'العالم الثاني', music: 'w2', killY: -10, motes: 0xc4b5fd, shardTotal: 10, stars: true,
    sky: { elev: 1.2, azim: 120, turb: 12, ray: 3.5, mie: 0.01, mieG: 0.9 }, exposure: 0.5, env: 0.45, fog: [0x5a4a8a, 0.005], sun: [0xffb8e0, 2.2], hemi: [0xb7a6ff, 0x2a2440, 0.95],
    spawn: { pos: new V(0, 0, 0), yaw: 0 },
  };
  const sh = (n, x, y, z) => K.shard('w2-' + n, x, y, z, S.shards.includes('w2-' + n));
  // A — start island
  K.plat({ x: 0, y: 0, z: 4, w: 12, d: 12, h: 1.2, m: 'marble', tile: 3, rockDepth: 9 });
  K.checkpoint(-4, 0, 0, 0).on = true;
  K.monolith({ x: 4, y: 0, z: 1, color: 0xc084fc }); K.tree({ x: -4.5, y: 0, z: 7.5, color: 0xc4b5fd });
  K.crystal({ x: 4.5, y: 0, z: 8.5, color: 0xc084fc, light: true });
  K.trigger({ x: 0, z: 0, r: 3, text: 'الجزر السماوية 🌌 — الصخور هنا تتحرك. انتظر اللحظة الصح واقفز!' });
  sh(1, -5, 0.8, 9.2);
  // B — moving platforms
  K.plat({ x: 0, y: 0, z: 15, w: 4, d: 4, m: 'marble', move: { axis: 'x', amp: 3, speed: 0.75 } });
  K.plat({ x: 0, y: 0.6, z: 22.5, w: 4, d: 4, m: 'marble', move: { axis: 'x', amp: 3, speed: 0.75, phase: Math.PI } });
  K.plat({ x: 0, y: 1.2, z: 30, w: 4, d: 4, m: 'marble', move: { axis: 'x', amp: 2.5, speed: 0.9, phase: 1 } });
  sh(2, 0, 2.6, 26.2);
  // C — island 1 + crumbling path
  K.plat({ x: 0, y: 1.8, z: 38, w: 8, d: 8, m: 'marble', tile: 3 });
  K.checkpoint(-2.5, 1.8, 36, 0); K.brazier({ x: 3, y: 1.8, z: 40.5, color: 0xc084fc, light: true });
  K.trigger({ x: 0, z: 40, y: 1.8, r: 2.6, text: '⚠️ البلاط البنفسجي يتكسّر تحتك — لا توقف عليه!' });
  [[-1.5, 45], [1.5, 48.6], [-1.5, 52.2], [1.5, 55.8]].forEach(([x, z]) => K.plat({ x, y: 1.8, z, w: 2.2, d: 2.2, h: 0.5, m: 'marble', crumble: true, rockDepth: 1.5 }));
  sh(3, 1.5, 2.8, 48.6);
  // D — island 2 + enemies + chimney
  K.plat({ x: 0, y: 1.8, z: 64, w: 10, d: 10, m: 'marble', tile: 3, rockDepth: 9 });
  K.checkpoint(3.5, 1.8, 60.5, 0);
  const iz = zone(0, 64, 10, 10, 1.8);
  K.enemy({ x: -2.5, y: 1.8, z: 62, zone: iz }); K.enemy({ x: 3, y: 1.8, z: 63, zone: iz }); K.enemy({ x: 0, y: 1.8, z: 61, zone: iz });
  K.wall({ x: -1.8, y: 11.5, z: 66.5, w: 0.6, d: 5, h: 9.7, m: 'dark', run: true });
  K.wall({ x: 1.8, y: 11.5, z: 66.5, w: 0.6, d: 5, h: 9.7, m: 'dark', run: true });
  K.trigger({ x: 0, z: 64.5, y: 1.8, r: 1.8, text: '🧗 المدخنة: اطلع على جدار، واضغط قفز — بتنط للجدار الثاني وتطلع عليه. كرّر لين توصل الحافة فوق!' });
  sh(4, 0, 7.5, 67);
  // E — upper island
  K.plat({ x: 0, y: 11.5, z: 75, w: 10, d: 12, h: 9.7, m: 'marble', tile: 3, rock: false });
  K.checkpoint(3, 11.5, 72, 0); K.tree({ x: -3.5, y: 11.5, z: 77, color: 0xf9a8d4 });
  sh(5, 4, 12.3, 79.5);
  // F — wall-run chain
  K.wall({ x: -2.35, y: 18.5, z: 85.5, w: 0.6, d: 9, h: 12.5, m: 'dark', run: true });
  K.wall({ x: 2.35, y: 18.5, z: 92, w: 0.6, d: 10, h: 12.5, m: 'dark', run: true });
  K.wall({ x: -2.35, y: 18.5, z: 98, w: 0.6, d: 8, h: 12.5, m: 'dark', run: true });
  K.trigger({ x: 0, z: 79.5, y: 11.5, r: 2.5, text: '🔥 أصعب تحدي: اركض على الجدار، اقفز للجدار المقابل، وكمّل… ٣ جدران ورا بعض!' });
  sh(6, 0, 13.4, 89); sh(7, 0, 13.4, 95.5);
  // G — altar island + side islands
  K.plat({ x: 0, y: 11.5, z: 106, w: 10, d: 10, m: 'gold', tile: 3, rockDepth: 9 });
  K.checkpoint(-3.5, 11.5, 103, 0);
  const altar = K.pedestal({ x: 0, y: 11.5, z: 107.5, accept: 'orb', need: 3, color: 0xc084fc });
  K.plat({ x: -9, y: 12.3, z: 106, w: 3, d: 3, m: 'marble' }); K.item({ id: 'o1', kind: 'orb', x: -9, y: 12.3, z: 106, color: 0xc084fc });
  K.plat({ x: 9, y: 12.3, z: 106, w: 3, d: 3, m: 'marble', move: { axis: 'z', amp: 1.5, speed: 0.8 } });
  const o2 = K.item({ id: 'o2', kind: 'orb', x: 9, y: 12.3, z: 106, color: 0x67e8f9 }); o2.follow = L.boxes[L.boxes.length - 1];
  K.plat({ x: 3.4, y: 15.3, z: 103.2, w: 1.5, d: 1.5, h: 3.8, rock: false, m: 'dark' }); K.item({ id: 'o3', kind: 'orb', x: 3.4, y: 15.3, z: 103.2, color: 0xf9a8d4 });
  sh(8, -9, 13.1, 107.3);
  const gz = zone(0, 106, 10, 10, 11.5);
  K.enemy({ x: -2, y: 11.5, z: 109, zone: gz }); K.enemy({ x: 2.5, y: 11.5, z: 109.5, zone: gz });
  K.trigger({ x: 0, z: 103, y: 11.5, r: 3, text: '✨ المذبح يبي ٣ كرات: وحدة على الجزيرة اليسار، وحدة على الجزيرة المتحركة يمين، ووحدة فوق العمود. شيلها (✋) وحطها هنا.' });
  // H — light bridge + final arena
  const bridgeM = new THREE.MeshStandardMaterial({ color: 0xc4b5fd, emissive: 0x8b5cf6, emissiveIntensity: 1.2, transparent: true, opacity: 0.75, roughness: 0.2 }); bridgeM.userData.own = true;
  const bridge = K.plat({ x: 0, y: 11.5, z: 115.5, w: 2.2, d: 9, h: 0.3, m: bridgeM, rock: false, hidden: true });
  altar.onFill = () => { bridge.active = true; bridge.mesh.visible = true; bridge.mesh.scale.z = 0.01; let k = 0; L.anim.push((dt) => { if (k < 1) { k = Math.min(1, k + dt / 1.2); bridge.mesh.scale.z = k; } }); L.say('الجسر الضوئي ظهر! 🌉 الحارس الأخير ينتظرك.'); L.sfx('gate'); L.shake(0.3); };
  K.plat({ x: 0, y: 11.5, z: 128, w: 18, d: 16, m: 'marble', tile: 3, rockDepth: 12 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5; K.monolith({ x: Math.cos(a) * 7.5, y: 11.5, z: 128 + Math.sin(a) * 6.5, h: 3 + (i % 2), color: 0xc084fc, rot: 0 }); }
  K.checkpoint(-6.5, 11.5, 121.5, 0);
  const fz = zone(0, 128, 18, 16, 11.5);
  K.enemy({ x: -3, y: 11.5, z: 129, zone: fz, group: 'final', type: 'brute' }); K.enemy({ x: 3, y: 11.5, z: 131, zone: fz, group: 'final', type: 'brute' });
  K.enemy({ x: 0, y: 11.5, z: 126, zone: fz, group: 'final' }); K.enemy({ x: -5, y: 11.5, z: 133, zone: fz, group: 'final' }); K.enemy({ x: 5, y: 11.5, z: 125, zone: fz, group: 'final' });
  K.trigger({ x: 0, z: 121.5, y: 11.5, r: 3.5, group: 'final', text: '⚡ المعركة الأخيرة! حارسين كبار — استخدم الضربة من فوق: اقفز واضغط سيف ⬇️' });
  sh(9, 7.5, 12.3, 134.5); sh(10, -7.8, 12.3, 134.5);
  const exit = K.portal({ x: 0, y: 11.5, z: 134, rot: Math.PI, to: 'hub', label: 'رجوع للساحة', color: 0xc084fc, active: false });
  L.onClear.final = () => { exit.setActive(true); L.say('أسطوري!! 🏆 الجزر السماوية تحررت. البوابة فتحت.'); L.sfx('win'); L.complete = true; };
  // scenery
  K.stars(); K.mountains({ color: 0x4a3f78, y: -55 }); K.clouds({ y: -22, n: 90, color: 0xb9a3ff, opacity: 0.7 }); K.floaters({ center: new V(0, 0, 70), r: 100, color: 0x5e5480, n: 18 });
  return cfg;
}

/* ===================== WORLD 3 ===================== */
export function w3(K, L, S) {
  const cfg = {
    id: 'w3', name: 'حصن الرمال الذهبية', sub: 'العالم الثالث', music: 'w3', killY: -12, motes: 0xffe2a8, shardTotal: 10,
    sky: { elev: 30, azim: 230, turb: 7, ray: 1.2, mie: 0.005, mieG: 0.85 }, exposure: 0.48, env: 0.35, fog: [0xe6c08a, 0.0042], sun: [0xfff0d0, 3.4], hemi: [0xffe8c4, 0x7a5a3a, 0.8],
    spawn: { pos: new V(0, 0, 0), yaw: 0 },
  };
  const sh = (n, x, y, z) => K.shard('w3-' + n, x, y, z, S.shards.includes('w3-' + n));
  // A — oasis start + swing bars
  K.plat({ x: 0, y: 0, z: 4, w: 14, d: 12, h: 1.2, rockDepth: 9 });
  K.checkpoint(-4, 0, 0, 0).on = true;
  K.palm({ x: -5.5, y: 0, z: 8 }); K.palm({ x: 5.6, y: 0, z: 0.5, s: 1.15 }); K.brazier({ x: 5, y: 0, z: 8.5, light: true });
  K.banner({ x: -6, y: 4, z: -1.6, color: 0xb45309 });
  sh(10, 0, 0.8, -1.4);
  K.trigger({ x: 0, z: 0, r: 3, text: 'حصن الرمال 🏜️ — شايف الأعمدة الذهبية المعلّقة؟ اقفز عليها تتمسك وتتأرجح، واضغط قفز وأنت متأرجح عشان تنطلق للي بعده!' });
  K.bar({ x: 0, y: 3.3, z: 13.5, len: 4 }); K.bar({ x: 0, y: 3.5, z: 18.5, len: 4 }); K.bar({ x: 0, y: 3.3, z: 23.5, len: 4 });
  sh(1, 0, 2.6, 21);
  // B — courtyard: spikes + archers on towers
  K.plat({ x: 0, y: 0, z: 34, w: 12, d: 14, h: 1.2, rockDepth: 9 });
  K.checkpoint(4.5, 0, 28.6, 0);
  K.spikes({ x: 0, y: 0, z: 31.5, w: 12, d: 1.6, period: 2.4, phase: 0 }); K.spikes({ x: 0, y: 0, z: 35.5, w: 12, d: 1.6, period: 2.4, phase: 1.2 });
  K.plat({ x: -4.5, y: 1.6, z: 39.3, w: 2.4, d: 2.4, h: 1.6, rock: false }); K.plat({ x: 4.5, y: 1.6, z: 39.3, w: 2.4, d: 2.4, h: 1.6, rock: false });
  K.enemy({ x: -4.5, y: 1.6, z: 39.3, type: 'archer', zone: { x0: -5.2, x1: -3.8, z0: 38.6, z1: 40 } });
  K.enemy({ x: 4.5, y: 1.6, z: 39.3, type: 'archer', zone: { x0: 3.8, x1: 5.2, z0: 38.6, z1: 40 } });
  K.enemy({ x: 0, y: 0, z: 38.5, zone: { x0: -5, x1: 5, z0: 37.5, z1: 40.3 } });
  K.trigger({ x: 0, z: 29, r: 3, text: '🏹 رماة فوق الأبراج! كراتهم الضوئية تقدر تردّها عليهم بضربة سيف في الوقت الصح ⚔️ — وانتبه للأشواك لما تحمرّ الأرض!' });
  sh(2, -4.5, 2.4, 40.2);
  // C — blade bridge
  K.plat({ x: 0, y: 0, z: 51, w: 3.2, d: 20, h: 0.8, rockDepth: 3 });
  K.checkpoint(0, 0, 40.4, 0);
  [[45, 0], [50, 1.7], [55, 3.4]].forEach(([z, ph]) => { K.blade({ x: 0, y: 4.6, z, len: 3.8, amp: 1.05, speed: 2.1, phase: ph }); });
  K.trigger({ x: 0, z: 42.2, r: 1.8, text: '🪓 فؤوس متأرجحة! راقب الإيقاع وعدّي لما تبعد… وإذا انضربت، كمّل!' });
  sh(3, 0, 1.2, 52.5); sh(9, 1, 0.8, 60.4);
  // D — wall-run over the sand pit
  K.wall({ x: 2.3, y: 6, z: 66, w: 0.6, d: 12, h: 12, m: 'sand', run: true });
  K.trigger({ x: 0.8, z: 58.5, r: 2, text: '🧱 اركض لاصق بالجدار اليمين واقفز — نفس حركة المكتبة!' });
  sh(4, 1.4, 2.6, 66);
  // E — timed gate court
  K.plat({ x: 0, y: 0, z: 79, w: 14, d: 16, h: 1.2, rockDepth: 9 });
  K.checkpoint(-4, 0, 73, 0);
  K.plat({ x: 5, y: 3.8, z: 75, w: 3, d: 3, h: 3.8, rock: false, run: true, runFaces: ['-x', '-z'] });
  const gate = K.timedGate({ x: 0, y: 0, z: 86.6, w: 22, h: 6, d: 1, plate: { x: 5, y: 3.8, z: 75 }, time: 7 });
  K.column({ x: -11.4, y: 0, z: 86.6, h: 7, r: 0.6 }); K.column({ x: 11.4, y: 0, z: 86.6, h: 7, r: 0.6 });
  K.spikes({ x: 0, y: 0, z: 80.5, w: 14, d: 1.6, period: 2.0, phase: 0 }); K.spikes({ x: 0, y: 0, z: 84, w: 14, d: 1.6, period: 2.0, phase: 1.0 });
  K.trigger({ x: -2, z: 73.5, r: 3, text: '🟡 الزر الذهبي فوق الصخرة يفتح البوابة — بس ٧ ثواني بس! اطلع، دوس الزر، وانطلق بين الأشواك.' });
  sh(5, 5, 4.6, 76.2); sh(6, -6, 0.8, 85.5);
  // F — fortress roof arena
  K.plat({ x: 0, y: 0, z: 99, w: 22, d: 24, h: 1.4, m: 'gold', tile: 3, rockDepth: 12 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; K.column({ x: Math.cos(a) * 9.2, y: 0, z: 99 + Math.sin(a) * 10.4, h: 5.5, broken: i % 4 === 1 }); }
  K.palm({ x: -9.5, y: 0, z: 89 }); K.palm({ x: 9.5, y: 0, z: 89.5 }); K.brazier({ x: -4, y: 0, z: 108, light: true }); K.brazier({ x: 4, y: 0, z: 108 });
  const az = { x0: -10, x1: 10, z0: 88.5, z1: 109.5, y: 0 };
  K.enemy({ x: -3, y: 0, z: 99, zone: az, group: 'boss', type: 'brute' }); K.enemy({ x: 3, y: 0, z: 101, zone: az, group: 'boss', type: 'brute' });
  K.enemy({ x: -7, y: 0, z: 105, zone: az, group: 'boss', type: 'archer' }); K.enemy({ x: 7, y: 0, z: 105, zone: az, group: 'boss', type: 'archer' });
  K.enemy({ x: 0, y: 0, z: 95, zone: az, group: 'boss' }); K.enemy({ x: -4, y: 0, z: 93, zone: az, group: 'boss' });
  K.trigger({ x: 0, z: 90, r: 4, group: 'boss', text: '👑 حرّاس الحصن كلهم! ابدأ بالرماة، وتدحرج من ضربات الكبار.' });
  sh(7, 9.6, 0.8, 109.5); sh(8, -9.6, 0.8, 109.5);
  const exit = K.portal({ x: 0, y: 0, z: 108.5, rot: Math.PI, to: 'hub', label: 'رجوع للساحة', color: 0xffb020, active: false });
  L.onClear.boss = () => { exit.setActive(true); L.say('الحصن تحرر!! 👑🏆 أنت أسطورة الرمال. البوابة فتحت.'); L.sfx('win'); L.complete = true; };
  // scenery
  K.dunes({}); K.mountains({ color: 0xc9925a, y: -45, hmin: 50, hmax: 120 }); K.clouds({ y: 40, n: 30, color: 0xfff3e0, opacity: 0.5 });
  return cfg;
}

export const WORLDS = { hub, w1, w2, w3 };
