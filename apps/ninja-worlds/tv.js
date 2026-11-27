// «الشاشة الكبيرة»: the game runs on the TV/PC, a phone becomes a wireless controller (WebRTC via PeerJS)
const loadScript = (src) => new Promise((res, rej) => { if (document.querySelector(`script[data-src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.dataset.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const remote = { on: false, mx: 0, my: 0, jumpH: false, rollH: false };
let peer = null, conn = null, last = {}, hooks = null, code = '';
const $ = (s) => document.querySelector(s);
const status = (t) => { $('#tvStatus').textContent = t; };

export async function openTV(h) {
  hooks = h; $('#tv').classList.add('on');
  if (peer && !peer.destroyed && code) return;
  status('⏳ جاري التجهيز…');
  try { await loadScript('lib/peerjs.min.js'); await loadScript('lib/qrcode.js'); }
  catch (e) { status('تعذّر تحميل أداة الاتصال — تأكد من الإنترنت'); return; }
  create();
}
export function closeTV() { $('#tv').classList.remove('on'); }
function create() {
  code = String(1000 + Math.floor(Math.random() * 9000));
  peer = new window.Peer('abdnw-' + code, { debug: 0 });
  peer.on('open', () => render());
  peer.on('error', (e) => {
    if (e.type === 'unavailable-id') { peer.destroy(); create(); return; }
    if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') status('⚠️ انقطع الاتصال بخادم الربط — سكّر النافذة وجرّب مرة ثانية');
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  peer.on('connection', (c) => {
    if (conn) try { conn.close(); } catch (e) {}
    conn = c; last = {};
    c.on('open', () => { remote.on = true; status('✅ الجوال متصل! استمتع 🎮'); hooks.onConnect(); setTimeout(closeTV, 1400); });
    c.on('data', onData);
    c.on('close', () => { if (conn !== c) return; remote.on = false; remote.mx = remote.my = 0; remote.jumpH = remote.rollH = false; conn = null; hooks.onDisconnect(); });
  });
}
function render() {
  const url = new URL('pad.html?c=' + code, location.href).href;
  $('#tvCode').textContent = code; $('#tvUrl').textContent = url.replace(/^https?:\/\//, '');
  try { const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make(); $('#tvQr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) {}
  status('📱 امسح الرمز بكاميرا الجوال، أو افتح الرابط واكتب الكود');
}
function onData(d) {
  if (!d || typeof d !== 'object') return;
  remote.mx = clamp(+d.x || 0, -1, 1); remote.my = clamp(+d.y || 0, -1, 1); remote.jumpH = !!d.j; remote.rollH = !!d.r;
  if (d.c && typeof d.c === 'object') for (const k of ['jump', 'atk', 'roll', 'act', 'sp', 'pause']) {
    const v = d.c[k] | 0, p = last[k];
    if (p != null && v > p && v - p < 20) hooks.press(k, v - p);
    last[k] = v;
  }
  if (d.dx || d.dy) hooks.look(clamp(+d.dx || 0, -400, 400), clamp(+d.dy || 0, -400, 400));
}
export function sendTV(o) { if (conn && conn.open) try { conn.send(o); } catch (e) {} }
