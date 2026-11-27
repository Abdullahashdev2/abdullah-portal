/* 📺 «الشاشة الكبيرة» للبوابة كلها
   الجهاز هذا (لابتوب/تلفزيون) يعرض، والجوال يصير يد تحكم لاسلكية لأي لعبة.
   - ألعاب تدعمه مباشرة: تعرّف window.__castInput(d) و window.__castLayout (مثل النينجا المعصوب)
   - أي لعبة ثانية: أزرار الجوال تتحول لأزرار كيبورد حسب cast في config.js (أو الافتراضي)
   - «وضع القوائم»: العصا تتنقّل بين الأزرار وA يختار — يشتغل على البوابة وعلى أي لعبة */
(function () {
  const $ = (s) => document.querySelector(s);
  const KEYS = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, ' ': 32, Enter: 13, Escape: 27, Shift: 16, Tab: 9 };
  const codeOf = (k) => (k === ' ' ? 'Space' : k.length === 1 ? (/\d/.test(k) ? 'Digit' + k : 'Key' + k.toUpperCase()) : k);
  const kcOf = (k) => KEYS[k] || (k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0);
  const DEFAULT = { stick: 'arrows', buttons: [{ id: 'a', label: 'A', key: ' ' }, { id: 'b', label: 'B', key: 'Enter' }] };
  const loadScript = (src) => new Promise((res, rej) => { if (document.querySelector(`script[data-src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.dataset.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });

  let lastPacket = null, gotFirst = false, peer = null, conn = null, code = '', last = {}, held = {}, dirs = {}, layoutStr = '', menuMode = false, focusEl = null, navCool = 0, curApp = null;
  const frame = () => $('#frame'), appOpen = () => !$('#viewer').hidden && frame().contentWindow;
  const gameWin = () => { try { return appOpen() ? frame().contentWindow : null; } catch (e) { return null; } };
  const status = (t) => { $('#castStatus').textContent = t; };

  /* ---------- connection ---------- */
  async function open() {
    $('#castSheet').hidden = false;
    if (peer && !peer.destroyed && code) return;
    status('⏳ جاري التجهيز…');
    try { await loadScript('lib/peerjs.min.js'); await loadScript('lib/qrcode.js'); } catch (e) { status('تعذّر تحميل أداة الاتصال — تأكد من الإنترنت'); return; }
    create();
  }
  function create() {
    code = String(1000 + Math.floor(Math.random() * 9000));
    peer = new window.Peer('abdcast-' + code, { debug: 0 });
    peer.on('open', () => {
      const url = new URL('pad.html?c=' + code, location.href).href;
      $('#castCode').textContent = code; $('#castUrl').textContent = url.replace(/^https?:\/\//, '');
      try { const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make(); $('#castQr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) {}
      status('📱 امسح الرمز بكاميرا الجوال، أو افتح الرابط واكتب الكود');
    });
    peer.on('error', (e) => { if (e.type === 'unavailable-id') { peer.destroy(); create(); } else if (/network|server|socket/.test(e.type)) status('⚠️ انقطع الاتصال بخادم الربط — سكّر وجرّب مرة ثانية'); });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
    // 📡 the phone renders the game and streams it here as live video (smooth even on weak TVs)
    peer.on('call', (call) => { call.answer(); call.on('stream', (st) => showVideo(st, call)); call.on('close', hideVideo); call.on('error', hideVideo); });
    peer.on('connection', (c) => {
      if (conn) try { conn.close(); } catch (e) {}
      conn = c; last = {}; gotFirst = false; held = {}; dirs = {}; layoutStr = '';
      c.on('open', () => { try { c.send({ hello: { v: 3, stream: true } }); } catch (e) {} window.KeepAwake && window.KeepAwake.on(); status('✅ الجوال متصل! 🎮'); $('#castBtn').classList.add('on'); $('#castViewerBtn').classList.add('on'); setTimeout(() => ($('#castSheet').hidden = true), 1200); pushLayout(true); });
      c.on('data', onData);
      c.on('close', () => { if (conn !== c) return; conn = null; window.KeepAwake && window.KeepAwake.off(); releaseAll(); $('#castBtn').classList.remove('on'); $('#castViewerBtn').classList.remove('on'); clearFocus(); try { const w = gameWin(); w && w.__castLeave && w.__castLeave(); } catch (e) {} });
    });
  }
  const send = (o) => { if (conn && conn.open) try { conn.send(o); } catch (e) {} };

  /* ---------- what the phone should show for the current screen ---------- */
  function currentLayout() {
    const w = gameWin();
    if (!w) return { title: 'برامج وتطبيقات عبدالله', menuOnly: true, buttons: [] };
    let native = null; try { native = w.__castLayout || null; } catch (e) {}
    if (native) return { ...native, native: true, title: native.title || (curApp && curApp.name) };
    const cfg = (curApp && curApp.cast) || DEFAULT;
    if (cfg.menu && !cfg.buttons) return { title: curApp && curApp.name, menuOnly: true, buttons: [] };
    return { title: curApp && curApp.name, stick: !!cfg.stick, buttons: (cfg.buttons || []).map((b) => ({ id: b.id, label: b.label })) };
  }
  function pushLayout(force) {
    if (!conn || !conn.open) return;
    const L = currentLayout(), s = JSON.stringify(L);
    if (force || s !== layoutStr) { layoutStr = s; send({ layout: L }); if (L.menuOnly) menuMode = true;
      // give a natively supported game the current press counters first, so the next press is counted
      if (L.native && lastPacket) try { gameWin().__castInput({ ...lastPacket, x: 0, y: 0, h: {}, dx: 0, dy: 0 }); } catch (e) {} }
  }
  setInterval(() => pushLayout(false), 900);

  /* ---------- phone → keyboard ---------- */
  function key(type, k) {
    const w = gameWin(); if (!w) return;
    try {
      const d = w.document, ev = new w.KeyboardEvent(type, { key: k, code: codeOf(k), bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'keyCode', { get: () => kcOf(k) }); Object.defineProperty(ev, 'which', { get: () => kcOf(k) });
      (d.activeElement && d.activeElement !== d.body ? d.activeElement : d.body || d).dispatchEvent(ev);
    } catch (e) {}
  }
  function setKey(id, k, down) { if (!k) return; if (!!held[id] === !!down) return; held[id] = !!down; key(down ? 'keydown' : 'keyup', k); }
  function releaseAll() { const cfg = (curApp && curApp.cast) || DEFAULT; for (const id in held) if (held[id]) { const b = (cfg.buttons || []).find((x) => x.id === id); const k = b ? b.key : dirs[id]; if (k) key('keyup', k); } held = {}; }
  const STICK = { arrows: { l: 'ArrowLeft', r: 'ArrowRight', u: 'ArrowUp', d: 'ArrowDown' }, wasd: { l: 'a', r: 'd', u: 'w', d: 's' } };

  function onData(d) {
    if (!d || typeof d !== 'object') return;
    if (d.streamStart) { $('#castSheet').hidden = false; status('📡 الجوال يجهّز البث… ثواني'); return; }
    lastPacket = d;
    const L = currentLayout();
    if (typeof d.m === 'boolean' && !L.menuOnly) { if (d.m !== menuMode) { menuMode = d.m; if (!menuMode) clearFocus(); else releaseAll(); } }
    if (L.menuOnly) menuMode = true;
    const counts = d.c || {}, fresh = {};
    for (const k in counts) { const v = counts[k] | 0, p = last[k] != null ? last[k] : (gotFirst ? 0 : null); if (p != null && v > p && v - p < 20) fresh[k] = v - p; last[k] = v; }
    gotFirst = true;
    // universal: «back» closes the open game
    if (fresh.__back) { if (appOpen()) history.back(); return; }
    if (menuMode) { menuInput(d, fresh); return; }
    const w = gameWin();
    if (L.native && w && w.__castInput) { try { w.__castInput(d); } catch (e) {} return; }
    const cfg = (curApp && curApp.cast) || DEFAULT, map = STICK[cfg.stick] || null, x = +d.x || 0, y = +d.y || 0;
    if (map) {
      const want = { l: x < -0.5, r: x > 0.5, u: y > 0.5, dn: y < -0.5 }, keep = { l: x < -0.3, r: x > 0.3, u: y > 0.3, dn: y < -0.3 };
      for (const [dir, k] of [['l', map.l], ['r', map.r], ['u', map.u], ['dn', map.d]]) { const id = '__' + dir; dirs[id] = k; const on = held[id] ? keep[dir] : want[dir]; setKey(id, k, on); }
    }
    const h = d.h || {};
    for (const b of cfg.buttons || []) {
      if (fresh[b.id] && !h[b.id] && !held[b.id]) { key('keydown', b.key); key('keyup', b.key); continue; }
      setKey(b.id, b.key, !!h[b.id]);
    }
  }

  /* ---------- menu mode: spatial navigation over clickable things ---------- */
  function navDoc() { const w = gameWin(); return w ? w.document : document; }
  function candidates() {
    const d = navDoc(), W = d.defaultView, vw = W.innerWidth, vh = W.innerHeight;
    const sel = 'button,a[href],[role=button],input,select,textarea,.card,[onclick],[tabindex]:not([tabindex="-1"])';
    return [...d.querySelectorAll(sel)].filter((el) => {
      if (el.disabled || el.closest('[hidden]') || el.closest('#viewer') && d === document) return false;
      const r = el.getBoundingClientRect(); if (r.width < 6 || r.height < 6) return false;
      if (r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) return false;
      const st = W.getComputedStyle(el); return st.visibility !== 'hidden' && st.display !== 'none' && +st.opacity > 0.05;
    });
  }
  function ensureStyle(d) { if (d.getElementById('__castStyle')) return; const s = d.createElement('style'); s.id = '__castStyle'; s.textContent = '.__castfocus{outline:4px solid #ffd166!important;outline-offset:3px!important;box-shadow:0 0 26px rgba(255,209,102,.85)!important;transition:outline .1s}'; (d.head || d.body).appendChild(s); }
  function clearFocus() { try { if (focusEl) focusEl.classList.remove('__castfocus'); } catch (e) {} focusEl = null; }
  function setFocus(el) { clearFocus(); if (!el) return; ensureStyle(el.ownerDocument); focusEl = el; el.classList.add('__castfocus'); try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} }
  function move(dx, dy) {
    const els = candidates(); if (!els.length) return;
    if (!focusEl || !els.includes(focusEl)) { setFocus(els[0]); return; }
    const a = focusEl.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = Infinity;
    for (const el of els) {
      if (el === focusEl) continue; const r = el.getBoundingClientRect(), x = r.left + r.width / 2 - ax, y = r.top + r.height / 2 - ay;
      const along = x * dx + y * dy; if (along <= 4) continue;
      const side = Math.abs(x * dy - y * dx), score = along + side * 2.2; if (score < bs) { bs = score; best = el; }
    }
    if (best) setFocus(best);
  }
  function menuInput(d, fresh) {
    const x = +d.x || 0, y = +d.y || 0, mag = Math.hypot(x, y), now = performance.now();
    if (mag > 0.6 && now > navCool) {
      const rtl = navDoc().dir === 'rtl' || navDoc().documentElement.dir === 'rtl';
      if (Math.abs(x) > Math.abs(y)) move(Math.sign(x), 0); else move(0, -Math.sign(y));
      navCool = now + 230; void rtl;
    }
    if (mag < 0.3) navCool = 0;
    if (fresh.__ok) { const els = candidates(); if (!focusEl || !els.includes(focusEl)) setFocus(els[0]); else { const el = focusEl; if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.focus(); else el.click(); setTimeout(() => { if (focusEl && !candidates().includes(focusEl)) clearFocus(); }, 80); } }
  }

  /* ---------- live video from the phone ---------- */
  let vbox = null;
  function showVideo(stream, call) {
    hideVideo();
    if (!$('#viewer').hidden) history.back(); // free the TV: nothing else renders while streaming
    $('#castSheet').hidden = true;
    vbox = document.createElement('div');
    vbox.style.cssText = 'position:fixed;inset:0;z-index:500;background:#000;display:flex;align-items:center;justify-content:center';
    const v = document.createElement('video'); v.autoplay = true; v.playsInline = true; v.srcObject = stream;
    v.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000';
    const tip = document.createElement('div'); tip.textContent = '📡 بث مباشر من الجوال — الجوال يشغّل اللعبة والشاشة تعرضها';
    tip.style.cssText = 'position:absolute;bottom:18px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.6);color:#fff;padding:8px 16px;border-radius:999px;font:700 15px system-ui;transition:opacity 1s';
    const btn = document.createElement('button'); btn.textContent = '🔊 اضغط هنا (أو OK بالريموت) لتشغيل الصوت'; btn.hidden = true;
    btn.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);padding:14px 22px;border-radius:14px;border:0;background:#f59e0b;color:#1a1200;font:900 18px system-ui;cursor:pointer';
    btn.onclick = () => { v.muted = false; v.play().catch(() => {}); btn.hidden = true; };
    vbox.append(v, tip, btn); document.body.appendChild(vbox);
    const ack = (s2) => send({ tv: s2 });
    // diagnostics + real frame-rate reports so the phone can adapt the stream
    const diag = document.createElement('div'); diag.style.cssText = 'position:absolute;top:10px;left:10px;background:rgba(0,0,0,.55);color:#a7f3d0;padding:6px 10px;border-radius:10px;font:700 13px monospace;direction:ltr';
    vbox.appendChild(diag);
    const frames = () => { try { const q = v.getVideoPlaybackQuality && v.getVideoPlaybackQuality(); if (q) return q.totalVideoFrames - q.droppedVideoFrames; } catch (e) {} return v.webkitDecodedFrameCount || 0; };
    let lastF = frames(), lastT = performance.now(), shown = 0;
    vbox.statsTimer = setInterval(() => {
      const f = frames(), t = performance.now(), fps = ((f - lastF) * 1000) / Math.max(1, t - lastT); lastF = f; lastT = t; shown += 2;
      send({ tv: 'stats', fps, w: v.videoWidth, h: v.videoHeight });
      diag.textContent = `${v.videoWidth}x${v.videoHeight} · ${fps.toFixed(0)} fps${v.muted ? ' · 🔇' : ''}`;
      diag.style.opacity = shown < 30 || fps < 15 ? '1' : '0';
    }, 2000);
    const unmute = () => { if (v.muted) { v.muted = false; v.play().catch(() => {}); btn.hidden = true; } };
    vbox.keyH = unmute; document.addEventListener('keydown', unmute); vbox.addEventListener('click', unmute);
    v.addEventListener('playing', () => ack('playing'), { once: true });
    v.play().catch(() => { v.muted = true; v.play().catch(() => ack('error')); btn.hidden = false; btn.focus(); ack('muted'); });
    setTimeout(() => (tip.style.opacity = '0'), 5000);
    try { vbox.requestFullscreen && vbox.requestFullscreen().catch(() => {}); } catch (e) {}
    window.KeepAwake && window.KeepAwake.on();
  }
  function hideVideo() { if (vbox) { clearInterval(vbox.statsTimer); document.removeEventListener('keydown', vbox.keyH); try { const v = vbox.querySelector('video'); v.srcObject = null; } catch (e) {} vbox.remove(); vbox = null; try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {} } }
  /* ---------- hooks for the portal ---------- */
  window.PortalCast = {
    open, send: (o) => send(o),
    setApp(a) { curApp = a; releaseAll(); clearFocus(); menuMode = false; setTimeout(() => pushLayout(true), 700); },
    clearApp() { releaseAll(); clearFocus(); curApp = null; menuMode = true; setTimeout(() => pushLayout(true), 100); },
    get connected() { return !!(conn && conn.open); },
  };
  $('#castBtn').onclick = open; $('#castViewerBtn').onclick = open;
  $('#castClose').onclick = () => ($('#castSheet').hidden = true);
})();
