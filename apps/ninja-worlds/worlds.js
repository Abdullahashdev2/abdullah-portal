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
    spawn: from === 'w7' ? { pos: new V(-8, 0, -16), yaw: -Math.PI / 2 } : from === 'w8' ? { pos: new V(8, 0, -16), yaw: Math.PI / 2 } : (from === 'w4' || from === 'w5' || from === 'w6') ? { pos: new V({ w4: -7, w5: 0, w6: 7 }[from], 0, -19), yaw: 0 } : from === 'w3' ? { pos: new V(6.5, 0.3, 0), yaw: -Math.PI / 2 } : from === 'w1' ? { pos: new V(0, 0.3, 6.5), yaw: Math.PI } : from === 'w2' ? { pos: new V(-6.5, 0.3, 0), yaw: Math.PI / 2 } : { pos: new V(0, 0, -7), yaw: 0 },
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
  K.plat({ x: 0, y: 0, z: -18, w: 24, d: 12, h: 1.5, m: 'marble', tile: 3, rockDepth: 14 });
  [[-7, 'w4', 'الأعماق الزرقاء', 0x22d3ee, 'w3'], [0, 'w5', 'قلعة الظلال الليلية', 0xa78bfa, 'w4'], [7, 'w6', 'قلب البركان', 0xff7a1a, 'w5']].forEach(([x, id, nm, col, need]) => {
    const open = !!S.done[need];
    K.plat({ x, y: 0.3, z: -22.2, w: 4, d: 3, h: 0.3, m: 'gold', rock: false });
    K.portal({ x, y: 0.3, z: -22.6, rot: Math.PI, to: id, label: open ? (S.done[id] ? '✓ ' : '') + nm : '🔒 ' + nm, color: col, active: open, locked: !open && 'هالبوابة تنفتح بعد ما تخلّص العالم اللي قبله 🔒' });
  });
  const w7open = !!S.done.w1;
  const w8open = !!S.done.w1;
  K.plat({ x: 10.4, y: 0.3, z: -16, w: 3, d: 4, h: 0.3, m: 'gold', rock: false });
  K.portal({ x: 10.9, y: 0.3, z: -16, rot: -Math.PI / 2, to: 'w8', label: w8open ? (S.done.w8 ? '✓ ' : '') + 'مدينة النيون 🚗' : '🔒 مدينة النيون', color: 0xf472b6, active: w8open, locked: !w8open && 'خلّص «أطلال المكتبة» أول عشان تنفتح بوابة المدينة 🔒' });
  K.plat({ x: -10.4, y: 0.3, z: -16, w: 3, d: 4, h: 0.3, m: 'gold', rock: false });
  K.portal({ x: -10.9, y: 0.3, z: -16, rot: Math.PI / 2, to: 'w7', label: w7open ? (S.done.w7 ? '✓ ' : '') + 'سفينة العاصفة 🌧️' : '🔒 سفينة العاصفة', color: 0x38bdf8, active: w7open, locked: !w7open && 'خلّص «أطلال المكتبة» أول عشان تنفتح بوابة السفينة 🔒' });
  K.banner({ x: -11, y: 4, z: -23.4, color: 0x0e7490 }); K.banner({ x: 11, y: 4, z: -23.4, color: 0x9a3412 });
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
  K.trigger({ x: 0, z: -7, r: 3, text: S.done.w6 ? 'بطل العوالم الستة! 🏆 ارجع لأي عالم تجمع الشظايا الناقصة، وكل شظية تقرّبك لترقية.' : S.done.w3 ? '🌟 انفتحت منصة البوابات الثانية وراك (للخلف): الأعماق ← القلعة ← البركان!' : S.done.w3 ? 'خلّصت العوالم الثلاثة! 🏆 تقدر ترجع لأي عالم تجمع الشظايا الناقصة — وعوالم جديدة جاية.' : S.done.w2 ? 'البوابة الذهبية يمين انفتحت: حصن الرمال 🏜️ — فيه حركة جديدة: التأرجح على الأعمدة!' : S.done.w2 ? 'خلّصت العالمين! 🏆 عوالم جديدة قادمة… تقدر ترجع لأي عالم تجمع الشظايا الناقصة.' : S.done.w1 ? 'رجعت بطل! 🌟 البوابة البنفسجية (يسار) انفتحت: الجزر السماوية.' : 'هلا! 👋 قدّامك البوابة الذهبية — بس أول جرّب الحركات: يسارك جدار مضيء تركض عليه، ويمينك صخرة تتسلقها.' });
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

/* ===================== WORLD 4 — underwater ===================== */
export function w4(K, L, S) {
  const cfg = {
    id: 'w4', name: 'الأعماق الزرقاء', sub: 'العالم الرابع', music: 'w4', killY: -30, motes: 0xbff7ff, shardTotal: 10,
    sky: { elev: 42, azim: 140, turb: 3, ray: 1, mie: 0.003, mieG: 0.8 }, exposure: 0.5, env: 0.4, fog: [0xa8e0f0, 0.004], sun: [0xfffaf0, 3.2], hemi: [0xd6f6ff, 0x3a6a6a, 0.9],
    spawn: { pos: new V(0, 0.5, 0), yaw: 0 },
  };
  const sh = (n, x, y, z) => K.shard('w4-' + n, x, y, z, S.shards.includes('w4-' + n));
  K.plat({ x: 0, y: 0.5, z: 2, w: 14, d: 10, h: 1.5, rockDepth: 6 });
  K.checkpoint(-4, 0.5, -1, 0).on = true;
  K.palm({ x: -5.5, y: 0.5, z: 4.5 }); K.palm({ x: 5.4, y: 0.5, z: -1.5, s: 1.1 });
  sh(10, 0, 1.3, -2.2);
  K.trigger({ x: 0, z: 1, y: 0.5, r: 3, text: '🌊 الأعماق الزرقاء! بالماء: قفز = تطلع، تدحرج 🌀 = تغطس. راقب شريط الهوا 🫧 — والفقاعات تعطيك هوا.' });
  K.water({ x0: -14, x1: 14, z0: 7, z1: 92, y0: -14, y1: 0 });
  K.plat({ x: 0, y: -14, z: 49.5, w: 28, d: 85, h: 2, rock: false });
  [-1, 1].forEach((sd) => K.wall({ x: sd * 14.5, y: 3, z: 49.5, w: 1, d: 85, h: 17, m: 'rock', ledge: false }));
  K.plat({ x: 5, y: 0.4, z: 15, w: 3, d: 3, h: 14.4, rock: false, m: 'rock' }); sh(1, 5, 1.2, 15);
  K.plat({ x: -5, y: 0.4, z: 23, w: 3, d: 3, h: 14.4, rock: false, m: 'rock' }); K.checkpoint(-5, 0.4, 23, 0);
  sh(2, -8, -12.5, 18);
  K.wall({ x: 0, y: 3, z: 30.5, w: 28, d: 1, h: 9, m: 'rock', ledge: false });
  K.bubble(0, -8.5, 28.5); K.bubble(2, -9, 32.8);
  K.trigger({ x: 0, z: 27, y: -1.3, r: 6, dy: 6, text: '🧱 الجدار يسكّر فوق — اغطس تحته (تدحرج 🌀 مطوّل) وعدّي من الأسفل!' });
  sh(3, 6, -11, 33);
  K.current({ x0: -14, x1: 14, z0: 40, z1: 54, fx: 4.5, fz: 0 });
  [[8, -3, 44, 2, 'y', 0], [10, -6, 49, 2, 'y', 1], [4, -2, 51, 3, 'x', 0.5], [-4, -6, 46, 2.5, 'y', 1.5], [0, -4, 52.5, 3, 'x', 2]].forEach(([x, y, z, amp, ax, phase]) => K.jelly({ x, y, z, amp, ax, phase, speed: 1.1 }));
  K.trigger({ x: 0, z: 38, y: -1.3, r: 8, dy: 6, text: '⚠️ تيار قوي يسحبك يمين لقناديل البحر — اسبح عكسه!' });
  sh(4, 9, -5, 47);
  K.plat({ x: 0, y: 2, z: 63, w: 28, d: 14, h: 3.5, m: 'rock', rock: false, ledge: false });
  K.bubble(0, -6, 62); K.bubble(-6, -7, 66);
  sh(5, 0, -5, 64); sh(6, -10, -4, 60);
  K.plat({ x: 6, y: 0.4, z: 75, w: 3, d: 3, h: 14.4, rock: false, m: 'rock' }); K.checkpoint(6, 0.4, 75, 0);
  sh(7, 8, -12, 79);
  for (let i = 0; i < 46; i++) K.kelp({ x: (Math.random() - 0.5) * 26, y: -13, z: 10 + Math.random() * 78, h: 3 + Math.random() * 6, color: i % 3 ? 0x2f9e44 : 0x15803d });
  for (let i = 0; i < 22; i++) K.coral({ x: (Math.random() - 0.5) * 24, y: -13, z: 10 + Math.random() * 78, color: [0xfb7185, 0xf59e0b, 0xa78bfa, 0x22d3ee][i % 4], s: 0.8 + Math.random() });
  K.fish({ x: -6, y: -8, z: 20, color: 0xfbbf24 }); K.fish({ x: 6, y: -5, z: 60, color: 0x38bdf8, n: 18 }); K.fish({ x: 0, y: -10, z: 78, color: 0xf472b6, r: 4 });
  K.crystal({ x: -9, y: -13, z: 40, color: 0x22d3ee, s: 1.4, light: true }); K.crystal({ x: 9, y: -13, z: 70, color: 0xa78bfa, s: 1.2, light: true });
  K.plat({ x: 0, y: 0.6, z: 86, w: 16, d: 10, h: 3, rock: false });
  K.palm({ x: -6, y: 0.6, z: 88 }); sh(8, 6, 1.4, 88);
  K.plat({ x: 0, y: 0.6, z: 100, w: 18, d: 16, h: 3, rockDepth: 8 });
  K.checkpoint(-6, 0.6, 93.5, 0);
  const rz = { x0: -8, x1: 8, z0: 93, z1: 107, y: 0.6 };
  K.enemy({ x: -3, y: 0.6, z: 99, zone: rz, group: 'reef' }); K.enemy({ x: 3, y: 0.6, z: 100, zone: rz, group: 'reef' }); K.enemy({ x: 0, y: 0.6, z: 103, zone: rz, group: 'reef', type: 'brute' });
  K.enemy({ x: -6, y: 0.6, z: 105, zone: rz, group: 'reef', type: 'archer' }); K.enemy({ x: 6, y: 0.6, z: 105, zone: rz, group: 'reef' });
  K.trigger({ x: 0, z: 95, y: 0.6, r: 4, group: 'reef', text: '🦀 حرّاس الشعاب! خلّصهم عشان تنفتح البوابة.' });
  sh(9, 8, 1.4, 106.5);
  const exit = K.portal({ x: 0, y: 0.6, z: 106, rot: Math.PI, to: 'hub', label: 'رجوع للساحة', color: 0x22d3ee, active: false });
  L.onClear.reef = () => { exit.setActive(true); L.say('الأعماق تحررت! 🌊🏆 البوابة فتحت.'); L.sfx('win'); L.complete = true; };
  K.mountains({ color: 0x6fa8a0, y: -40, hmin: 40, hmax: 100 }); K.clouds({ y: 50, n: 30, opacity: 0.6 });
  return cfg;
}

/* ===================== WORLD 5 — night castle (stealth) ===================== */
export function w5(K, L, S) {
  const cfg = {
    id: 'w5', name: 'قلعة الظلال الليلية', sub: 'العالم الخامس', music: 'w5', killY: -10, motes: 0x9fb4ff, shardTotal: 10, stars: true,
    sky: { elev: -3, azim: 200, turb: 2, ray: 0.6, mie: 0.002, mieG: 0.8 }, exposure: 0.6, env: 0.5, fog: [0x0d1530, 0.011], sun: [0x9db4ff, 1.5], hemi: [0x4a5a8a, 0x0a0a14, 0.75],
    spawn: { pos: new V(0, 0, -5), yaw: 0 },
  };
  const sh = (n, x, y, z) => K.shard('w5-' + n, x, y, z, S.shards.includes('w5-' + n));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshBasicMaterial({ color: 0xf1f5ff, fog: false })); moon.position.set(-260, 260, 700); moon.lookAt(0, 0, 0); L.add(moon);
  K.stars();
  K.plat({ x: 0, y: 0, z: 2, w: 20, d: 22, h: 1.5, m: 'dark', rockDepth: 8 });
  K.checkpoint(-6, 0, -6, 0).on = true;
  K.tree({ x: -8, y: 0, z: -7, color: 0x6d28d9 }); K.tree({ x: 8, y: 0, z: -4, color: 0x4c1d95 });
  K.shadowZone({ x: -7.5, z: 5, w: 3, d: 6 });
  sh(1, -8, 0.8, -8.6);
  K.trigger({ x: 0, z: -5, r: 3, text: '🌙 قلعة الظلال — الحرّاس يشوفون بضوء الكشاف. ابعد عن الضوء، اختبئ بالعشب، واضربهم من ورا = ضربة صامتة 🤫. وإذا ما انكشفت أبد = جايزة!' });
  K.wall({ x: 0, y: 5.5, z: 12, w: 20, d: 2, h: 5.5, m: 'dark', run: true, runFaces: ['-z'] });
  K.enemy({ x: -7, y: 5.5, z: 12, type: 'guard', path: [[-7, 12], [7, 12]], zone: { x0: -9.5, x1: 9.5, z0: 11.4, z1: 12.6 } });
  K.trigger({ x: 0, z: 8.5, r: 3, text: '⬆️ اطلع على السور المضيء وتمسّك بالحافة — وانتظر الحارس يعطيك ظهره!' });
  sh(2, 9.2, 6.3, 12);
  K.plat({ x: 0, y: 0, z: 27, w: 20, d: 28, h: 1.5, m: 'dark', rock: false });
  K.enemy({ x: -6, y: 0, z: 18, type: 'guard', path: [[-6, 18], [6, 18]], zone: { x0: -9, x1: 9, z0: 14, z1: 40 } });
  K.enemy({ x: 6, y: 0, z: 33, type: 'guard', path: [[6, 33], [6, 24], [-6, 24], [-6, 33]], zone: { x0: -9, x1: 9, z0: 14, z1: 40 } });
  K.shadowZone({ x: -8.5, z: 21, w: 2.5, d: 10 }); K.shadowZone({ x: 8.5, z: 30, w: 2.5, d: 12 });
  [[-2, 21], [2.5, 29], [-3, 35]].forEach(([x, z]) => K.plat({ x, y: 1.2, z, w: 1.6, d: 1.6, h: 1.2, m: 'wood', rock: false }));
  sh(3, 8.5, 0.8, 36); sh(4, -3, 2, 35);
  K.plat({ x: 3, y: 1.2, z: 37.5, w: 2, d: 2, h: 1.2, m: 'wood', rock: false }); K.plat({ x: 3, y: 2.4, z: 40, w: 2, d: 2, h: 2.4, m: 'wood', rock: false });
  K.brazier({ x: -9, y: 0, z: 15, color: 0x93c5fd, light: true }); K.brazier({ x: 9, y: 0, z: 39, color: 0x93c5fd });
  K.plat({ x: 0, y: 6, z: 45, w: 10, d: 8, h: 6, m: 'dark', rock: false });
  K.checkpoint(-4, 6, 42.5, 0);
  K.enemy({ x: -3, y: 6, z: 44, type: 'guard', path: [[-3, 44], [3, 44], [3, 47.5], [-3, 47.5]], zone: { x0: -4.5, x1: 4.5, z0: 41.5, z1: 48.5 } });
  sh(5, 4.4, 6.8, 48.4);
  K.bar({ x: 0, y: 8.8, z: 52.2, len: 4 }); K.bar({ x: 0, y: 9.0, z: 56.8, len: 4 }); sh(6, 0, 8.3, 54.5);
  K.plat({ x: 0, y: 6, z: 68.5, w: 12, d: 17, h: 3, m: 'dark', rockDepth: 6 });
  K.checkpoint(4.5, 6, 61.5, 0);
  K.enemy({ x: -4, y: 6, z: 63, type: 'guard', path: [[-4, 63], [4, 63]], zone: { x0: -5.5, x1: 5.5, z0: 60.5, z1: 71.5 } });
  K.enemy({ x: 4, y: 6, z: 70, type: 'guard', path: [[4, 70], [-4, 70]], zone: { x0: -5.5, x1: 5.5, z0: 60.5, z1: 71.5 } });
  K.shadowZone({ x: -4.8, z: 66.5, w: 2.2, d: 5, y: 6 });
  sh(7, -5.5, 6.8, 75.5);
  K.wall({ x: -1.8, y: 15.5, z: 74.5, w: 0.6, d: 5, h: 9.5, m: 'dark', run: true });
  K.wall({ x: 1.8, y: 15.5, z: 74.5, w: 0.6, d: 5, h: 9.5, m: 'dark', run: true });
  sh(8, 0, 11, 75);
  K.plat({ x: 0, y: 15.5, z: 86, w: 12, d: 18, h: 9.5, m: 'dark', rock: false });
  K.checkpoint(-4.5, 15.5, 79, 0);
  const relic = K.relic({ x: 0, y: 15.5, z: 89 });
  const ez = { x0: -5.5, x1: 5.5, z0: 78, z1: 94.5 };
  [[-4, 92], [4, 92], [0, 84]].forEach(([x, z]) => K.enemy({ x, y: 15.5, z, type: 'guard', alert: true, zone: ez, group: 'elite' }));
  K.enemy({ x: 0, y: 15.5, z: 93, type: 'brute', zone: ez, group: 'elite' });
  K.trigger({ x: 0, z: 89, y: 15.5, r: 1.4, group: 'elite', fn: () => { relic.visible = false; }, text: '📜 أخذت لفافة الظلال! انطلق الإنذار — حرّاس النخبة جايين! ⚔️' });
  sh(9, 5.5, 16.3, 94.5);
  const exit = K.portal({ x: 0, y: 15.5, z: 93.5, rot: Math.PI, to: 'hub', label: 'رجوع للساحة', color: 0xa78bfa, active: false });
  L.onClear.elite = () => { exit.setActive(true); L.say('القلعة تحررت! 🌙🏆 البوابة فتحت.'); L.sfx('win'); L.complete = true; };
  K.mountains({ color: 0x1e2440, y: -40 }); K.floaters({ center: new V(0, 0, 50), r: 110, color: 0x2a2f4a, n: 10 });
  return cfg;
}

/* ===================== WORLD 6 — volcano + boss ===================== */
export function w6(K, L, S) {
  const cfg = {
    id: 'w6', name: 'قلب البركان', sub: 'العالم السادس — الأخير', music: 'w6', killY: -1.7, motes: 0xff9a4a, shardTotal: 10,
    sky: { elev: 4, azim: 180, turb: 20, ray: 0.4, mie: 0.02, mieG: 0.95 }, exposure: 0.5, env: 0.3, fog: [0x3a140c, 0.011], sun: [0xff9a5a, 2.4], hemi: [0xff8a5a, 0x2a0a05, 0.75],
    spawn: { pos: new V(0, 0, 0), yaw: 0 },
  };
  const sh = (n, x, y, z) => K.shard('w6-' + n, x, y, z, S.shards.includes('w6-' + n));
  K.lava({ y: -2 });
  K.plat({ x: 0, y: 0, z: 2, w: 12, d: 10, h: 3, m: 'dark' });
  K.checkpoint(-4, 0, -1, 0).on = true; sh(1, 0, 0.8, -2.4);
  K.trigger({ x: 0, z: 0, r: 3, text: '🌋 قلب البركان — الحمم = رجوع لآخر نقطة! الصخور السوداء تغرق لما توقف عليها، فلا توقف!' });
  [[0, 11], [2.5, 16.2], [-1.5, 21.4]].forEach(([x, z]) => K.plat({ x, y: 0, z, w: 3, d: 3, h: 1, m: 'dark', sink: { rate: 0.8, depth: 4 }, rockDepth: 1.5 }));
  sh(2, 2.5, 0.9, 16.2);
  K.plat({ x: 0, y: 0, z: 28, w: 10, d: 8, h: 3, m: 'dark' });
  K.checkpoint(-3.8, 0, 25, 0);
  K.geyser({ x: -2.5, y: 0, z: 27.2, period: 2.6, phase: 0 }); K.geyser({ x: 2.5, y: 0, z: 29.5, period: 2.6, phase: 0.9 }); K.geyser({ x: 0, y: 0, z: 31, period: 2.6, phase: 1.8 });
  K.trigger({ x: 0, z: 25.5, r: 3, text: '🔥 ينابيع نار! الفتحة تلمع قبل ما تنفجر — عدّي بعدها على طول.' });
  sh(3, 2.5, 1.2, 29.5);
  K.plat({ x: 0, y: 1.5, z: 35.5, w: 2.6, d: 2.6, h: 1, m: 'dark', move: { axis: 'y', amp: 1.5, speed: 1.1 }, rockDepth: 1.5 });
  K.plat({ x: 0, y: 3.6, z: 40, w: 2.6, d: 2.6, h: 1, m: 'dark', move: { axis: 'y', amp: 1.5, speed: 1.1, phase: Math.PI }, rockDepth: 1.5 });
  sh(4, 0, 3.8, 35.5);
  K.plat({ x: 0, y: 5, z: 48, w: 10, d: 8, h: 3, m: 'dark' });
  K.checkpoint(3.5, 5, 45, 0); sh(5, 4.4, 5.8, 51.4);
  K.wall({ x: -3.1, y: 10, z: 56.75, w: 0.6, d: 11.5, h: 12, m: 'dark', run: true });
  K.trigger({ x: -2, z: 50.5, y: 5, r: 2.2, text: '🧱 جري على الجدار فوق الحمم — لا تتأخر بالقفزة!' });
  sh(6, -2.2, 7, 57.5);
  K.plat({ x: 0, y: 5, z: 68, w: 10, d: 12, h: 3, m: 'dark' });
  K.checkpoint(3.5, 5, 63.5, 0);
  const pz = { x0: -4, x1: 4, z0: 63, z1: 73, y: 5 };
  K.enemy({ x: -2, y: 5, z: 68, zone: pz }); K.enemy({ x: 2, y: 5, z: 70, zone: pz }); K.enemy({ x: 0, y: 5, z: 72, zone: pz, type: 'archer' });
  sh(7, -4.4, 5.8, 73.4);
  [[-1.5, 76.2], [1.5, 79.7], [-1.5, 83.2]].forEach(([x, z]) => K.plat({ x, y: 5, z, w: 2.2, d: 2.2, h: 0.5, m: 'dark', crumble: true, rockDepth: 1.5 }));
  sh(8, 1.5, 5.8, 79.7);
  K.plat({ x: 0, y: 5, z: 99, w: 26, d: 26, h: 3, m: 'dark', rockDepth: 10 });
  K.checkpoint(-9, 5, 88.5, 0);
  [[-8, 95], [8, 95], [-8, 105], [8, 105]].forEach(([x, z], i) => K.geyser({ x, y: 5, z, period: 4.2, phase: i * 1.05 }));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; K.crystal({ x: Math.cos(a) * 12, y: 5, z: 99 + Math.sin(a) * 12, color: 0xff4500, s: 1.1, light: i % 3 === 0 }); }
  K.enemy({ x: 0, y: 5, z: 104, type: 'boss', zone: { x0: -11, x1: 11, z0: 88, z1: 110 }, group: 'boss' });
  K.trigger({ x: 0, z: 89, y: 5, r: 4, group: 'boss', text: '🌋 عملاق الحمم!! ٣ مراحل: ابعد لما يرفع يدينه، ردّ كرات ناره بالسيف، واستخدم الدوّامة ✴️ لو عندك!' });
  sh(9, 12, 5.8, 111); sh(10, -12, 5.8, 111);
  const exit = K.portal({ x: 0, y: 5, z: 109.5, rot: Math.PI, to: 'hub', label: 'رجوع للساحة', color: 0xff7a1a, active: false });
  L.onClear.boss = () => { exit.setActive(true); L.say('هزمت عملاق الحمم!!! 🌋🏆 أنت بطل العوالم الستة. البوابة فتحت.'); L.sfx('win'); L.complete = true; L.shake(0.6); };
  K.mountains({ color: 0x2a0f08, y: -30, hmin: 80, hmax: 220 });
  return cfg;
}

/* ===================== WORLD 7 — the storm ship (big multi-deck stealth level) =====================
   Route: stern deck → stairs down → ENGINE ROOM (sabotage 3 panels) → CARGO HOLD (office: command card)
          → stairs up → ACCOMMODATION BLOCK (3 floors, captain's cabin: bridge card) → roof → BRIDGE (compass)
          → BOW helideck (extraction). Coordinates: deck top y=0, lower deck floor y=-6, ship x∈[-15,15], z∈[0,240]. */
export function w7(K, L, S) {
  const cfg = {
    id: 'w7', name: 'سفينة العاصفة', sub: 'عالم التسلّل', music: 'w7', killY: -11, motes: 0x9fb8c9, shardTotal: 10, ship: true, storm: true,
    sky: { elev: 2, azim: 200, turb: 20, ray: 0.3, mie: 0.02, mieG: 0.9 }, exposure: 0.62, env: 0.45, fog: [0x0b1218, 0.014], sun: [0x9fb8d0, 1.3], hemi: [0x7d8fa3, 0x2a2f36, 1.55],
    spawn: { pos: new V(-8, 0, 4), yaw: 0 },
  };
  const sh = (n, x, y, z) => K.shard('w7-' + n, x, y, z, S.shards.includes('w7-' + n));
  const G = (x, y, z, path, zone, extra = {}) => K.enemy({ x, y, z, type: 'guard', path, zone, ...extra });
  const DECK = { x0: -14, x1: 14, z0: 1, z1: 239 }, ENG = { x0: -14, x1: 14, z0: 3, z1: 49 }, HOLD = { x0: -14, x1: 14, z0: 51, z1: 117 };
  K.ocean({ y: -3, cz: 120, hole: [-15.6, 15.6, -0.6, 240.6] }); K.rain(); // البحر ما يدخل جسم السفينة
  // حافة السطح المكشوف: من هنا ترمي الحراس في البحر (السطح الرئيسي y≈0 فقط)
  L.seaEdge = (p) => { if (p.y < -0.6 || p.y > 1.6) return null; if (p.x > 13.6) return new V(1, 0, 0); if (p.x < -13.6) return new V(-1, 0, 0); if (p.z < 2.4) return new V(0, 0, -1); if (p.z > 237.6) return new V(0, 0, 1); return null; };
  /* ---------- hull ---------- */
  const hullM = new THREE.MeshStandardMaterial({ color: 0x5a1d1d, roughness: 0.7, metalness: 0.3 }); hullM.userData.own = true;
  // الهيكل: قاع تحت أرضية السرداب + كسوة حمراء من برّا الجدران (قبل: صندوق كان سقفه يقطع السرداب على ارتفاع ٣م ويغطي الكاميرا)
  const hull = new THREE.Mesh(new THREE.BoxGeometry(31.4, 2.5, 241.4), hullM); hull.position.set(0, -7.76, 120); L.add(hull);
  [-1, 1].forEach((sd) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 8, 241.4), hullM); c.position.set(sd * 15.62, -5, 120); L.add(c); });
  [-0.62, 240.62].forEach((zz) => { const c = new THREE.Mesh(new THREE.BoxGeometry(31.4, 8, 0.12), hullM); c.position.set(0, -5, zz); L.add(c); });
  const bowM = new THREE.Mesh(new THREE.ConeGeometry(15.5, 18, 4, 1), hullM); bowM.rotation.set(Math.PI / 2, Math.PI / 4, 0); bowM.scale.set(1, 1, 0.3); bowM.position.set(0, -3.5, 249); L.add(bowM);
  [-1, 1].forEach((sd) => { K.wall({ x: sd * 15.25, y: 1.2, z: 120, w: 0.5, d: 240, h: 7.7, m: 'metal', ledge: false }).hull = true; }); // hull = تقدر تتعلّق من برّا
  K.wall({ x: 0, y: 1.2, z: -0.25, w: 31, d: 0.5, h: 7.7, m: 'metal', ledge: false }); K.wall({ x: 0, y: 1.2, z: 240.25, w: 31, d: 0.5, h: 7.7, m: 'metal', ledge: false });
  K.slab({ x0: -15, x1: 15, z0: 0, z1: 118, y: -6, h: 0.5 }); // lower deck floor
  // main deck with two stairwell holes (H1 stern: x 9.2..12.8, z 21.6..30 ; H2 cargo: x -12.8..-9.2, z 100..108.4)
  const deck = (x0, x1, z0, z1, h = 0.5) => K.slab({ x0, x1, z0, z1, y: 0, h, m: 'deck' });
  deck(-15, 15, 0, 21.6); deck(-15, 9.2, 21.6, 30); deck(12.8, 15, 21.6, 30); deck(-15, 15, 30, 100); deck(-15, -12.8, 100, 108.4); deck(-9.2, 15, 100, 108.4); deck(-15, 15, 108.4, 118); deck(-15, 15, 118, 240, 6);
  K.railing({ x0: 9.2, x1: 9.2, z0: 21.6, z1: 30 }); K.railing({ x0: 9.2, x1: 12.8, z0: 30, z1: 30 }); K.railing({ x0: 12.8, x1: 12.8, z0: 21.6, z1: 30 });
  K.railing({ x0: -9.2, x1: -9.2, z0: 100, z1: 108.4 }); K.railing({ x0: -12.8, x1: -9.2, z0: 100, z1: 100 }); K.railing({ x0: -12.8, x1: -12.8, z0: 100, z1: 108.4 });
  K.stairs({ x: 11, z: 30, w: 3.6, y0: -6, y1: 0, dir: '-z' });
  K.stairs({ x: -11, z: 100, w: 3.6, y0: -6, y1: 0, dir: '+z' });
  /* ---------- A: stern deck ---------- */
  K.checkpoint(-8, 0, 2.5, 0).on = true;
  K.trigger({ x: -8, z: 4, r: 3, text: '🌧️ سفينة العاصفة — مهمة طويلة: ١) عطّل المحركات تحت ٢) خذ بطاقة القيادة من مكتب المخزن ٣) اطلع لغرفة القبطان ثم الجسر وخذ «بوصلة الظل» ٤) اهرب من مهبط المقدمة. الدرج النازل يمين وراك ↘️' });
  K.trigger({ x: 6, z: 14, r: 3, text: '📻 الجنود يطلبون دعم بالراديو إذا شافوك — نوّمهم قبل يكمّلون. 🔫 R / زر تصويب. نوّم بالراس، اسحب (✋) وخبّ بالخزانة 🗄️ وتسكّر عليهم.' });
  [[-4, 6], [4, 8]].forEach(([x, z]) => { K.plat({ x, y: 1.2, z, w: 1.6, d: 1.6, h: 1.2, rock: false, m: 'dark' }); const dr = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.7, 16), new THREE.MeshStandardMaterial({ color: 0x8a6d1e, metalness: 0.6, roughness: 0.4 })); dr.material.userData.own = true; dr.rotation.z = Math.PI / 2; dr.position.set(x, 0.9, z); L.add(dr); });
  K.crates({ x: -12, z: 12, n: 4 }); K.crates({ x: 2, z: 16, n: 3 });
  [-1, 1].forEach((sd) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 5, 4, 12), new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.6 })); b.material.userData.own = true; b.rotation.x = Math.PI / 2; b.position.set(sd * 13.4, 3.2, 12); L.add(b); });
  K.locker({ x: -14.3, z: 18, rot: Math.PI / 2 }); K.locker({ x: 14.3, z: 6, rot: -Math.PI / 2 });
  G(5, 0, 4, [[5, 4], [5, 17], [-2, 17], [-2, 9]], DECK); G(-10, 0, 25, [[-10, 25], [-10, 14], [-3, 14]], DECK);
  K.ammo('a1', -13, 0.5, 9, 'pistol'); sh(1, 13.5, 0.8, 1.5); sh(2, -12, 3.2, 12.6);
  /* ---------- B: container deck ---------- */
  const lanes = [-10.5, -5.5, 0, 5.5, 10.5];
  [[0, 36, 1], [1, 36, 2], [3, 36, 1], [4, 36, 3], [0, 46, 2], [2, 44, 1], [3, 47, 2], [1, 56, 1], [2, 58, 3], [4, 55, 1], [0, 64, 3], [3, 66, 1], [1, 72, 2], [4, 74, 2], [0, 82, 1], [2, 80, 1], [3, 86, 3], [1, 90, 1], [4, 92, 1], [2, 94, 2]].forEach(([li, z, st]) => K.container({ x: lanes[li], z, stack: st }));
  K.crates({ x: -3.2, z: 33, n: 2 }); K.crates({ x: 8, z: 61, n: 2 }); K.crates({ x: -8, z: 79, n: 2 }); K.crates({ x: 13, z: 88, n: 2 });
  K.checkpoint(-13, 0, 32, 0);
  K.searchlight({ x: 0, y: 13, z: 62, from: -0.9, to: 0.9, speed: 0.4, range: 26, tilt: 0.42 });
  const crane = new THREE.Mesh(new THREE.BoxGeometry(1.2, 13, 1.2), new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.5, metalness: 0.5 })); crane.material.userData.own = true; crane.position.set(0, 6.5, 62); L.add(crane);
  K.plat({ x: 0, y: 13, z: 62, w: 1.2, d: 1.2, h: 13, rock: false, hidden: true }).active = true;
  G(-8, 0, 40, [[-8, 40], [-8, 95]], DECK); G(8, 0, 95, [[8, 95], [8, 40]], DECK); G(-3, 0, 52, [[-3, 52], [3, 52], [3, 70], [-3, 70]], DECK); G(13, 0, 50, [[13, 50], [13, 98]], DECK); G(-13, 0, 70, [[-13, 70], [-13, 96]], DECK);
  K.locker({ x: -14.3, z: 44, rot: Math.PI / 2 }); K.locker({ x: 14.3, z: 66, rot: -Math.PI / 2 }); K.locker({ x: -14.3, z: 88, rot: Math.PI / 2 });
  K.ammo('s1', 5.5, 8.4, 58, 'sniper'); K.ammo('a2', 13.5, 0.5, 76, 'pistol'); sh(3, 10.5, 8.4, 86); sh(4, -10.5, 8.4, 64); sh(5, 0, 0.8, 99);
  /* ---------- C: engine room (lower deck, stern) ---------- */
  K.wallLine({ axis: 'x', at: 50, from: -15, to: 15, y: -6, h: 5.5, doors: [{ c: 0, lock: 'تعطيل المحركات' }] });
  K.checkpoint(11, -6, 32.5, Math.PI);
  K.trigger({ x: 11, z: 32, y: -6, r: 3, text: '⚙️ غرفة المحركات — عطّل ٣ لوحات التحكم (✋ جنبها). البخار الحار يحرق، والممرات العلوية تطلّ على كل شي.' });
  K.machine({ x: -7, y: -6, z: 14, w: 5, d: 9 }); K.machine({ x: 3, y: -6, z: 14, w: 5, d: 9, color: 0x44403c }); K.machine({ x: -7, y: -6, z: 36, w: 5, d: 9, color: 0x1e3a5f }); K.machine({ x: 3, y: -6, z: 38, w: 4, d: 6 });
  K.slab({ x0: -14.5, x1: -11, z0: 4, z1: 40.9, y: -2.6, h: 0.25 }); K.stairs({ x: -12.75, z: 46, w: 3, y0: -6, y1: -2.6, dir: '-z' });
  K.steam({ x: -1.8, y: -6, z: 22 }); K.steam({ x: 6.8, y: -6, z: 26, phase: 1.1 }); K.steam({ x: -1.8, y: -6, z: 31, phase: 2 });
  K.panel({ x: -7, y: -6, z: 8.2, rot: Math.PI, group: 'engine', label: 'لوحة المولّد ١' });
  K.panel({ x: 12.6, y: -6, z: 14, rot: -Math.PI / 2, group: 'engine', label: 'لوحة الضغط ٢' });
  K.panel({ x: -12.75, y: -2.6, z: 10, rot: Math.PI / 2, group: 'engine', label: 'لوحة الوقود ٣ (فوق الممر)' });
  L.onPanels = { engine: () => { L.keys['تعطيل المحركات'] = true; L.say('⚙️ المحركات تعطّلت! 🔓 باب المخزن انفتح (قدّام). '); L.sfx('gate'); L.shake(0.35); } };
  for (let z = 6; z < 48; z += 8) { K.lamp({ x: -4, y: -0.9, z, light: z === 22 || z === 38 }); K.lamp({ x: 6, y: -0.9, z: z + 4, light: z === 6 }); }
  G(-1.5, -6, 8, [[-1.5, 8], [-1.5, 44], [9, 44], [9, 8]], ENG); G(9, -6, 26, [[9, 26], [-1, 26]], ENG); G(-10, -6, 30, [[-10, 30], [-10, 6]], ENG); G(-12.75, -2.6, 40, [[-12.75, 40], [-12.75, 6]], { x0: -14.4, x1: -11.1, z0: 4.5, z1: 40.5 }); G(6, -6, 46, [[6, 46], [-4, 46]], ENG);
  K.locker({ x: 14.3, z: 40, y: -6, rot: -Math.PI / 2 }); K.locker({ x: -9.5, z: 4.6, y: -6, rot: 0 }); K.locker({ x: 9.5, z: 4.6, y: -6, rot: 0 });
  K.ammo('a3', 13, -5.5, 44, 'pistol'); sh(6, -13, -1.8, 44);
  /* ---------- D: cargo hold (lower deck) ---------- */
  K.checkpoint(-2.5, -6, 52.5, 0);
  K.trigger({ x: 0, z: 53, y: -6, r: 3, text: '📦 مخزن الشحن الضخم — مكتب المشرف في آخره (يمين) وفيه «بطاقة القيادة». الدرج الطالع للسطح يسار آخر المخزن.' });
  [[-9, 60, 2], [-3, 64, 1], [4, 58, 2], [10, 66, 1], [-10, 76, 1], [-2, 80, 2], [5, 74, 1], [10, 84, 2], [-6, 92, 1], [2, 94, 2], [9, 98, 1]].forEach(([x, z, st]) => K.container({ x, y: -6, z, stack: st }));
  K.crates({ x: -12.5, z: 68, y: -6, n: 4 }); K.crates({ x: 0.5, z: 70, y: -6, n: 3 }); K.crates({ x: 12.5, z: 92, y: -6, n: 2 });
  for (let z = 56; z < 116; z += 9) { K.lamp({ x: -6, y: -0.9, z, light: z === 65 || z === 101 }); K.lamp({ x: 6, y: -0.9, z: z + 4, light: z === 83 }); }
  K.wallLine({ axis: 'z', at: 4.5, from: 108, to: 118, y: -6, h: 5.5, doors: [{ c: 111 }] }); K.wallLine({ axis: 'x', at: 108, from: 4.5, to: 15, y: -6, h: 5.5 });
  K.keycard({ x: 11, y: -6, z: 115, name: 'بطاقة القيادة' }); K.lamp({ x: 9.5, y: -0.9, z: 113, color: 0xa7f3d0 }); sh(7, 13.5, -5.2, 109.5);
  K.plat({ x: 8, y: -5, z: 116.5, w: 3, d: 1.2, h: 1, rock: false, m: 'wood' });
  G(-6, -6, 56, [[-6, 56], [-6, 100]], HOLD); G(7, -6, 100, [[7, 100], [7, 56]], HOLD); G(0, -6, 86, [[0, 86], [-12, 86], [-12, 70]], HOLD); G(13, -6, 60, [[13, 60], [13, 104]], HOLD);
  G(8, -6, 112, [[8, 112], [13, 112], [13, 116]], { x0: 5, x1: 14, z0: 108.6, z1: 117 });
  K.locker({ x: -14.3, z: 82, y: -6, rot: Math.PI / 2 }); K.locker({ x: 14.3, z: 78, y: -6, rot: -Math.PI / 2 }); K.locker({ x: 5.3, z: 116.5, y: -6, rot: Math.PI / 2 });
  K.ammo('s2', -10, -2.2, 76.5, 'sniper'); K.ammo('a4', -13.5, -5.5, 104, 'pistol');
  /* ---------- E: accommodation block (3 floors + roof bridge) ---------- */
  const BX0 = -12, BX1 = 12, BZ0 = 120, BZ1 = 150;
  K.wall({ x: 13.5, y: 3.5, z: 120, w: 3, d: 0.4, h: 3.5, m: 'metal', ledge: false }); K.wall({ x: -13.5, y: 3.5, z: 120, w: 3, d: 0.4, h: 3.5, m: 'metal', ledge: false });
  K.checkpoint(0, 0, 112, 0);
  K.trigger({ x: -11, z: 110, r: 3, text: '🏢 مبنى الطاقم: ٣ أدوار. الباب الأمامي يحتاج «بطاقة القيادة». الدرج للأدوار العليا من الخلف — وغرفة القبطان بالدور الثالث.' });
  for (let f = 0; f < 3; f++) {
    const y = f * 4, h = 3.6;
    if (f > 0) K.slab({ x0: BX0, x1: BX1, z0: BZ0, z1: BZ1, y, h: 0.4 });
    K.wallLine({ axis: 'x', at: BZ0, from: BX0, to: BX1, y, h, doors: f === 0 ? [{ c: 0, lock: 'بطاقة القيادة' }] : [] });
    K.wallLine({ axis: 'x', at: BZ1, from: BX0, to: BX1, y, h, doors: f === 0 ? [{ c: 0 }] : f === 1 ? [{ c: -2.5 }] : [{ c: 6.5 }] });
    K.wallLine({ axis: 'z', at: BX0, from: BZ0, to: BZ1, y, h }); K.wallLine({ axis: 'z', at: BX1, from: BZ0, to: BZ1, y, h });
    K.wallLine({ axis: 'z', at: -1.6, from: BZ0, to: BZ1, y, h, t: 0.2, doors: [{ c: 125 }, { c: 135 }, { c: 145 }] });
    K.wallLine({ axis: 'z', at: 1.6, from: BZ0, to: BZ1, y, h, t: 0.2, doors: [{ c: 125 }, { c: 135 }, { c: 145 }] });
    for (const zz of [130, 140]) { K.wallLine({ axis: 'x', at: zz, from: BX0, to: -1.6, y, h, t: 0.2 }); K.wallLine({ axis: 'x', at: zz, from: 1.6, to: BX1, y, h, t: 0.2 }); }
    for (let z = 123; z < 150; z += 6) K.lamp({ x: 0, y: y + 3.35, z, light: z === 135 && f !== 1 });
    [[-7, 125], [7, 135], [-7, 145], [7, 125]].forEach(([x, z], i) => { if ((i + f) % 2) { K.plat({ x: x + (x < 0 ? -2.5 : 2.5), y: y + 0.7, z: z - 2.6, w: 2, d: 1, h: 0.7, m: 'wood', rock: false }); K.lamp({ x, y: y + 3.35, z, color: 0xfde68a }); } });
  }
  K.slab({ x0: BX0, x1: BX1, z0: BZ0, z1: BZ1, y: 12, h: 0.4, m: 'deck' });
  K.locker({ x: -11.3, z: 133, rot: Math.PI / 2 }); K.locker({ x: 11.3, z: 143, y: 4, rot: -Math.PI / 2 }); K.locker({ x: -11.3, z: 136, y: 8, rot: Math.PI / 2 }); K.locker({ x: 11.3, z: 127, y: 4, rot: -Math.PI / 2 });
  const corr = (y) => ({ x0: -1.4, x1: 1.4, z0: 120.5, z1: 149.5, y });
  G(0, 0, 122, [[0, 122], [0, 148]], corr(0)); G(-6, 0, 145, [[-6, 145], [-6, 143]], { x0: -11.5, x1: -2, z0: 140.5, z1: 149.5 });
  G(0, 4, 148, [[0, 148], [0, 122]], corr(4)); G(6, 4, 125, [[6, 125], [9, 125]], { x0: 2, x1: 11.5, z0: 120.5, z1: 129.5 });
  G(0, 8, 130, [[0, 122], [0, 148]], corr(8)); G(-6, 8, 127, [[-9, 124], [-4, 128]], { x0: -11.5, x1: -2, z0: 120.5, z1: 129.5 });
  K.keycard({ x: -10, y: 8, z: 122, name: 'بطاقة الجسر' }); sh(8, -10.5, 8.8, 128.5); K.ammo('a5', 10, 4.5, 146, 'pistol');
  K.trigger({ x: -7, z: 125, y: 8, r: 2.5, text: '🧑‍✈️ غرفة القبطان! «بطاقة الجسر» على المكتب — بعدها اطلع للسطح من الدرج الخلفي.' });
  // exterior stairs at the back of the block
  K.stairs({ x: -10, z: 152, w: 2.4, y0: 0, y1: 4, dir: '+x' }); K.slab({ x0: -4.12, x1: -1, z0: 150.8, z1: 153.2, y: 4, h: 0.3 });
  K.stairs({ x: -1, z: 152, w: 2.4, y0: 4, y1: 8, dir: '+x' }); K.slab({ x0: 4.88, x1: 10.5, z0: 150.8, z1: 153.2, y: 8, h: 0.3 }); K.slab({ x0: 8.5, x1: 10.5, z0: 153.2, z1: 155.8, y: 8, h: 0.3 });
  K.stairs({ x: 8.5, z: 154.6, w: 2.4, y0: 8, y1: 12, dir: '-x' }); K.slab({ x0: -1, x1: 2.62, z0: 150, z1: 155.8, y: 12, h: 0.3 });
  K.slab({ x0: -3.4, x1: -1.6, z0: 150, z1: 150.8, y: 4, h: 0.3 }); K.slab({ x0: 5.6, x1: 7.4, z0: 150, z1: 150.8, y: 8, h: 0.3 });
  K.checkpoint(-9, 0, 155, 0);
  // roof + bridge house
  K.wallLine({ axis: 'x', at: 124, from: -8, to: 8, y: 12, h: 3.4 }); K.wallLine({ axis: 'x', at: 136, from: -8, to: 8, y: 12, h: 3.4, doors: [{ c: 0, lock: 'بطاقة الجسر' }] });
  K.wallLine({ axis: 'z', at: -8, from: 124, to: 136, y: 12, h: 3.4 }); K.wallLine({ axis: 'z', at: 8, from: 124, to: 136, y: 12, h: 3.4 });
  K.slab({ x0: -8.2, x1: 8.2, z0: 123.8, z1: 136.2, y: 15.8, h: 0.4 });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.4), new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x0e7490, emissiveIntensity: 0.6, transparent: true, opacity: 0.5 })); glass.material.userData.own = true; glass.position.set(0, 14.3, 123.7); glass.rotation.y = Math.PI; L.add(glass);
  [[-5, 127], [0, 127], [5, 127]].forEach(([x, z]) => K.plat({ x, y: 13.1, z, w: 2.4, d: 0.8, h: 1.1, m: 'metal', rock: false }));
  K.lamp({ x: 0, y: 15.4, z: 130, color: 0x7dd3fc });
  K.searchlight({ x: 10, y: 12, z: 148, from: Math.PI - 0.2, to: Math.PI + 1.0, speed: 0.5, range: 18, tilt: 0.5 });
  G(-9, 12, 140, [[-9, 140], [9, 140], [9, 148]], { x0: -11.5, x1: 11.5, z0: 136.5, z1: 149.5 });
  K.checkpoint(4, 12, 146, Math.PI);
  const relic = K.relic({ x: 0, y: 12, z: 131, color: 0x38bdf8 });
  const exit = K.portal({ x: 0, y: 0, z: 228, rot: Math.PI, to: 'hub', label: 'مهبط الهروب', color: 0x38bdf8, active: false });
  L.exitPortal = exit; cfg.captain = { x: 0, y: 0, z: 222, zone: { x0: -13, x1: 13, z0: 204, z1: 236 } };
  K.trigger({ x: 0, z: 131, y: 12, r: 1.3, group: 'bow', fn: () => { relic.visible = false; L.relicTaken = true; L.sfx('win'); }, text: '🧭 «بوصلة الظل» معك! المروحية تنتظرك عند مهبط المقدمة 🚁 — بس انتبه: القائد «عاصفة» بنفسه واقف على المهبط ⚓ وما ينخدع بأي تنكّر.' });
  sh(9, 6.5, 12.8, 125);
  /* ---------- F: bow + helideck ---------- */
  [[-9, 175, 1], [8, 182, 2], [-4, 195, 1], [10, 200, 1], [-11, 206, 2]].forEach(([x, z, st]) => K.container({ x, z, stack: st }));
  K.crates({ x: 2, z: 186, n: 3 }); K.crates({ x: -7, z: 214, n: 2 });
  const pad = new THREE.Mesh(new THREE.CircleGeometry(8, 40), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 })); pad.material.userData.own = true; pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.02, 226); L.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(6.6, 7.2, 40), new THREE.MeshBasicMaterial({ color: 0xfacc15 })); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.04, 226); L.add(ring);
  K.searchlight({ x: -13, y: 6, z: 192, from: 0.3, to: 1.8, speed: 0.55, range: 22, tilt: 0.38 });
  K.wall({ x: -13, y: 6, z: 192, w: 1, d: 1, h: 6, m: 'metal', ledge: false });
  G(-2, 0, 170, [[-2, 170], [-2, 210], [6, 210], [6, 170]], DECK); G(12, 0, 165, [[12, 165], [12, 215]], DECK); G(-12, 0, 215, [[-12, 215], [-12, 168]], DECK);
  G(4, 0, 220, [[4, 220], [-4, 220]], DECK, { group: 'bow' }); G(-6, 0, 232, [[-6, 232], [6, 232]], DECK, { group: 'bow' });
  K.locker({ x: 14.3, z: 190, rot: -Math.PI / 2 }); K.locker({ x: -14.3, z: 200, rot: Math.PI / 2 }); K.locker({ x: 14.3, z: 218, rot: -Math.PI / 2 });
  K.ammo('a6', 13.5, 0.5, 172, 'pistol'); K.ammo('s3', -11, 5.8, 206, 'sniper');
  K.checkpoint(9, 0, 162, 0);
  L.reinforce = [{ y: 0, zone: DECK, points: [[-3, 104], [3, 104]] }, { y: -6, zone: HOLD, points: [[0, 52], [2, 53]] }, { y: 0, zone: DECK, points: [[0, 168], [3, 168]] }, { y: 0, zone: DECK, points: [[-4, 212], [4, 212]] }];
  // deck lamps along the bulwarks
  for (let z = 10; z < 235; z += 16) { [-14.6, 14.6].forEach((x) => { const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0x86efac })); s2.position.set(x, 1.9, z); L.add(s2); }); }
  return cfg;
}



/* ===================== W8: مدينة النيون — سرقة سيارات + سواقة + بوابات لكل العوالم ===================== */
function windowTex(seed, tint) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#0b0f1c'; g.fillRect(0, 0, 128, 128); let s = seed * 9301 + 49297; const R = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let y = 6; y < 128; y += 16) for (let x = 5; x < 128; x += 15) { const on = R() < 0.42; g.fillStyle = on ? (R() < 0.75 ? tint : '#e0f2fe') : '#141a2e'; g.fillRect(x, y, 9, 10); if (on) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, y, 9, 2); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function w8(K, L, S) {
  const cfg = {
    id: 'w8', name: 'مدينة النيون', sub: 'عالم السيارات', music: 'w5', killY: -10, motes: 0xf0abfc, shardTotal: 10, city: true, batch: true,
    sky: { elev: -2, azim: 200, turb: 3, ray: 0.5, mie: 0.004, mieG: 0.8 }, exposure: 0.78, env: 0.45, fog: [0x1a1033, 0.0055], sun: [0xc4b5fd, 1.2], hemi: [0x7c6fd0, 0x120a24, 1.0],
    spawn: { pos: new V(0, 0, -6), yaw: Math.PI },
  };
  const sh = (n, x, y, z) => K.shard('w8-' + n, x, y, z, S.shards.includes('w8-' + n));
  // الأرض + الشوارع
  K.plat({ x: 0, y: 0, z: 0, w: 300, d: 300, h: 1, m: 'dark', rock: false, tile: 6, ledge: false });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x1b1f2a, roughness: 0.55, metalness: 0.2 }), walk = new THREE.MeshStandardMaterial({ color: 0x3a3f52, roughness: 0.9 });
  const lineM = new THREE.MeshBasicMaterial({ color: 0xfacc15 }), white = new THREE.MeshBasicMaterial({ color: 0xe5e7eb });
  const flat = (x, z, w, d, m, y = 0.012) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), m); me.position.set(x, y, z); me.receiveShadow = true; L.add(me); return me; };
  const ROADS = [-120, -72, -24, 24, 72, 120], RW = 14;
  for (const r of ROADS) { flat(r, 0, RW, 254, asphalt); flat(0, r, 254, RW, asphalt, 0.014); }
  for (const r of ROADS) for (let t = -122; t < 122; t += 8) { flat(r, t, 0.25, 3.2, lineM, 0.03); flat(t, r, 3.2, 0.25, lineM, 0.032); }
  for (const r of ROADS) for (const s of [-1, 1]) { flat(r + s * 6.6, 0, 0.18, 254, white, 0.03); flat(0, r + s * 6.6, 254, 0.18, white, 0.032); }
  // المباني (شبابيك مضيئة) + أشرطة نيون
  const TEX = [windowTex(3, '#fde68a'), windowTex(7, '#a5f3fc'), windowTex(11, '#f9a8d4')];
  const BM = TEX.map((t) => { const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.7, metalness: 0.2 }); m.userData.own = true; return m; });
  const NEON = [0xf472b6, 0x22d3ee, 0xa78bfa, 0xfacc15, 0x4ade80];
  const neonM = NEON.map((c) => new THREE.MeshBasicMaterial({ color: c }));
  let seed = 5; const R = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const lowRoofs = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    const x0 = ROADS[i] + RW / 2, x1 = ROADS[i + 1] - RW / 2, z0 = ROADS[j] + RW / 2, z1 = ROADS[j + 1] - RW / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    flat(cx, cz, x1 - x0, z1 - z0, walk, 0.02);
    if (i === 2 && j === 2) continue; // الساحة الوسطى للبوابات
    const lots = [[cx - 8.5, cz - 8.5], [cx + 8.5, cz - 8.5], [cx - 8.5, cz + 8.5], [cx + 8.5, cz + 8.5]];
    lots.forEach(([lx, lz], k) => {
      if ((i + j + k) % 5 === 0) return; // فراغ/زقاق
      const low = (i * 5 + j + k) % 7 === 0, h = low ? 6 : 10 + Math.floor(R() * 34), w = 13 + R() * 2.5, d = 13 + R() * 2.5;
      K.plat({ x: lx, y: h, z: lz, w, d, h, m: BM[(i + j + k) % 3], rock: false, tile: 8, ledge: low });
      if (low) lowRoofs.push([lx, h, lz, w]);
      const nc = neonM[(i * 3 + j + k) % 5];
      for (const yy of [h * 0.33, h * 0.66, h - 0.3]) { if (low && yy < h - 0.5) continue; const n1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.18, 0.12), nc); n1.position.set(lx, yy, lz - d / 2 - 0.05); L.add(n1); const n2 = n1.clone(); n2.position.z = lz + d / 2 + 0.05; L.add(n2); }
    });
  }
  // حدود المدينة (مرفأ وسور)
  for (const s of [-1, 1]) { K.wall({ x: s * 136, y: 4, z: 0, w: 2, d: 276, h: 5, m: 'metal', ledge: false }); K.wall({ x: 0, y: 4, z: s * 136, w: 276, d: 2, h: 5, m: 'metal', ledge: false }); }
  // أعمدة إنارة
  for (const r of [-72, 72]) for (let t = -110; t <= 110; t += 44) { K.lamp({ x: r + 7.5, y: 6, z: t, color: 0xfde68a, light: Math.abs(t) < 50 }); }
  // الساحة: بوابات لكل العوالم (تدخلها بالسيارة أو مشي)
  const prevOf = { w1: null, w2: 'w1', w3: 'w2', w4: 'w3', w5: 'w4', w6: 'w5', w7: 'w1' };
  const GATES = [['hub', 'ساحة البوابات 🌀', 0xffffff], ['w1', 'أطلال المكتبة', 0xffc94d], ['w2', 'الجزر السماوية', 0xc084fc], ['w3', 'حصن الرمال', 0xffb020], ['w4', 'الأعماق الزرقاء', 0x22d3ee], ['w5', 'قلعة الظلال', 0x818cf8], ['w6', 'قلب البركان', 0xff6a00], ['w7', 'سفينة العاصفة 🌧️', 0x38bdf8]];
  GATES.forEach(([id, nm, col], k) => {
    const a = (k / GATES.length) * Math.PI * 2, x = Math.sin(a) * 12.5, z = Math.cos(a) * 12.5, open = id === 'hub' || id === 'w1' || !!S.done[prevOf[id]];
    K.portal({ x, y: 0, z, rot: a + Math.PI, to: id, label: open ? (S.done[id] ? '✓ ' : '') + nm : '🔒 ' + nm, color: col, active: open, locked: !open && 'هالبوابة تنفتح بعد ما تخلّص العالم اللي قبله 🔒' });
  });
  // منحدرات القفز (بالسيارة) + شظايا في الهوا
  const rampM = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, metalness: 0.3 });
  L.ramps = [];
  const ramp = (x, z, dx, dz) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 7), rampM); me.position.set(x, 0.75, z); me.rotation.order = 'YXZ'; me.rotation.y = Math.atan2(dx, dz); me.rotation.x = -0.22; me.castShadow = true; L.add(me);
    const st = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.15, 0.4), new THREE.MeshBasicMaterial({ color: 0x111827 })); st.position.set(x + dx * 3.4, 1.5, z + dz * 3.4); st.rotation.y = me.rotation.y; L.add(st);
    L.ramps.push({ x0: x - 3, x1: x + 3, z0: z - 3, z1: z + 3, dx, dz });
  };
  ramp(-72, -40, 0, 1); sh(1, -72, 4.6, -18);
  ramp(72, 40, 0, -1); sh(2, 72, 4.6, 18);
  ramp(-40, 120, 1, 0); sh(3, -18, 4.6, 120);
  ramp(40, -120, -1, 0); sh(4, 18, 4.6, -120);
  // سطوح قصيرة: صناديق تتسلّقها + شظية فوق
  lowRoofs.slice(0, 4).forEach(([x, h, z, w], n) => { K.crates({ x: x - w / 2 - 1.4, z: z - 2, n: 5, s: 1.25 }); K.plat({ x: x - w / 2 - 1.2, y: 3.6, z: z + 1.5, w: 2.2, d: 2.2, h: 1.1, m: 'wood', rock: false }); sh(5 + n, x, h + 0.9, z); });
  // سقالات برج تحت الإنشاء: درج لين ١٦م
  const TX = 96, TZ = -96; let y = 0;
  for (let f = 0; f < 8; f++) { const ox = f % 2 ? 3 : -3; y += 2; K.plat({ x: TX + ox, y, z: TZ, w: 4, d: 4, h: 0.3, m: 'metal', rock: false }); }
  sh(9, TX - 3, y + 2.4, TZ);
  // زقاق خلفي
  sh(10, -96, 0.9, 96);
  // السيارات: زحمة + واقفة
  const loop = (a, dir) => { const p = [[-a, -a], [a, -a], [a, a], [-a, a]]; return dir > 0 ? p : p.reverse(); };
  L.carDefs = [];
  [[27.5, 1], [20.5, -1], [75.5, 1], [68.5, -1], [123.5, 1], [116.5, -1]].forEach(([a, d], k) => { for (let m = 0; m < 2; m++) L.carDefs.push({ path: loop(a, d), pi: m * 2 + (k % 2), x: 0, z: 0 }); });
  [[-75, -100, 0], [-69, -112, 0, 'sport', 0xfacc15], [75, 100, Math.PI], [69, 112, Math.PI], [100, -77, -Math.PI / 2], [-100, 77, Math.PI / 2, 'sport', 0xef4444], [6, -14, Math.PI, 'sport', 0x22d3ee], [-6, -14, Math.PI]].forEach(([x, z, yaw, kind, color]) => L.carDefs.push({ x, z, yaw, kind, color }));
  K.checkpoint(0, 0, -6, Math.PI);
  K.trigger({ x: 0, z: -6, r: 4, text: '🌃 مدينة النيون! تقدر تسرق أي سيارة: روح جنبها واضغط ✋ (لو فيها سائق تسحبه 😅). وبالسيارة تقدر تدخل أي بوابة في الساحة — المدينة مربوطة بكل العوالم!' });
  return cfg;
}

export const WORLDS = { hub, w1, w2, w3, w4, w5, w6, w7, w8 };
