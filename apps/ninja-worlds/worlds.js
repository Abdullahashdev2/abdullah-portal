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
    spawn: (from === 'w4' || from === 'w5' || from === 'w6') ? { pos: new V({ w4: -7, w5: 0, w6: 7 }[from], 0, -19), yaw: 0 } : from === 'w3' ? { pos: new V(6.5, 0.3, 0), yaw: -Math.PI / 2 } : from === 'w1' ? { pos: new V(0, 0.3, 6.5), yaw: Math.PI } : from === 'w2' ? { pos: new V(-6.5, 0.3, 0), yaw: Math.PI / 2 } : { pos: new V(0, 0, -7), yaw: 0 },
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

export const WORLDS = { hub, w1, w2, w3, w4, w5, w6 };
