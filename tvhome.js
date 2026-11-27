/* واجهة التلفزيون (كونسول): بطاقات كبيرة يمين/يسار بالريموت، OK يفتح، رجوع يقفل.
   تشتغل تلقائياً على متصفحات التلفزيون، أو من زر 🕹️، أو ?tv=1 — وتنطبق على كل التطبيقات. */
(function () {
  const C = window.PORTAL; if (!C) return;
  const TVUA = /SMART-?TV|SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|HbbTV|Android ?TV|AFT[A-Z]|CrKey|GoogleTV|VIDAA|Hisense|TCL|TV Safari|Opera TV|Viera|AQUOS|Philips|Roku/i.test(navigator.userAgent);
  const get = (k) => { try { return localStorage.getItem('portal:' + k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem('portal:' + k, v); } catch (e) {} };
  const q = new URLSearchParams(location.search).get('tv');
  let on = q != null ? q !== '0' : get('tvhome') != null ? get('tvhome') === '1' : TVUA;
  let idx = +(get('tvhomeIdx') || 0), row = 0; // row 0 = البطاقات، row -1 = الأزرار العلوية

  const css = document.createElement('style');
  css.textContent = `
  body.tvmode{overflow:hidden}
  body.tvmode>header,body.tvmode>main,body.tvmode>footer,body.tvmode>.blobs,body.tvmode>.toast{display:none!important}
  #tvHome{position:fixed;inset:0;z-index:40;display:none;flex-direction:column;color:#fff;font-family:"Tajawal",system-ui,sans-serif;background:#07070d;overflow:hidden}
  body.tvmode #tvHome{display:flex}
  #tvHome .bg{position:absolute;inset:-10%;background:radial-gradient(60% 70% at 70% 30%,var(--tc,#4f8cff) 0%,transparent 70%),radial-gradient(50% 60% at 20% 80%,var(--tc2,#8e7cf0) 0%,transparent 70%),#07070d;opacity:.55;filter:blur(30px);transition:background .5s}
  #tvHome .top{position:relative;display:flex;align-items:center;gap:18px;padding:3.5vh 5vw 0}
  #tvHome .top h1{font-size:2.6vw;margin:0;font-weight:800;flex:1;color:#fff;text-align:right}
  #tvHome .clock{font-size:2vw;opacity:.85;font-variant-numeric:tabular-nums}
  #tvHome .tb{font:inherit;font-size:1.5vw;color:#fff;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.2);border-radius:999px;padding:.6vw 1.4vw;cursor:pointer}
  #tvHome .tb.f{background:#fff;color:#111;border-color:#fff;transform:scale(1.08)}
  #tvHome .hero{position:relative;padding:5vh 5vw 0;min-height:24vh;text-align:right}
  #tvHome .hero h2{font-size:4.4vw;margin:0 0 1vh;font-weight:800;text-shadow:0 4px 30px rgba(0,0,0,.6)}
  #tvHome .hero p{font-size:1.7vw;margin:0;opacity:.85;max-width:60vw;line-height:1.5}
  #tvHome .hero .meta{margin-top:1.2vh;font-size:1.3vw;opacity:.75}
  #tvHome .rowwrap{position:relative;flex:1;display:flex;align-items:center;overflow:hidden}
  #tvHome .tiles{display:flex;gap:2.2vw;padding:3vw 6vw;transition:transform .35s cubic-bezier(.2,.8,.2,1);will-change:transform}
  #tvHome .tile{flex:0 0 auto;width:15vw;height:15vw;border-radius:1.8vw;border:0;padding:0;cursor:pointer;display:grid;place-items:center;font-size:7vw;color:#fff;background:linear-gradient(135deg,#2a2f4a,#161a2e);box-shadow:0 10px 30px rgba(0,0,0,.5);transition:transform .25s,box-shadow .25s;position:relative;overflow:hidden}
  #tvHome .tile img{width:100%;height:100%;object-fit:cover}
  #tvHome .tile.f{transform:scale(1.18);box-shadow:0 0 0 .35vw #fff,0 20px 60px rgba(0,0,0,.7);z-index:2}
  #tvHome .tile .nm{position:absolute;inset:auto 0 0 0;font-size:1.1vw;font-weight:700;padding:.5vw;background:linear-gradient(transparent,rgba(0,0,0,.75));opacity:0;transition:opacity .2s}
  #tvHome .tile.f .nm{opacity:1}
  #tvHome .hint{position:relative;padding:0 5vw 3.5vh;font-size:1.3vw;opacity:.7;display:flex;gap:3vw}
  #tvHome .hint b{background:rgba(255,255,255,.15);border-radius:.4vw;padding:0 .6vw}
  @media (max-aspect-ratio:1/1){#tvHome .tile{width:34vw;height:34vw;font-size:16vw}#tvHome .hero h2{font-size:8vw}#tvHome .hero p,#tvHome .tb,#tvHome .hint{font-size:3.6vw}#tvHome .top h1{font-size:5vw}#tvHome .clock{font-size:4vw}#tvHome .tile .nm{font-size:3vw}}`;
  document.head.appendChild(css);

  const el = document.createElement('div'); el.id = 'tvHome'; el.dir = 'rtl';
  el.innerHTML = `<div class="bg"></div>
   <div class="top"><h1></h1><button class="tb" data-a="cast">📺 الجوال يد تحكم</button><button class="tb" data-a="exit">🏡 الواجهة العادية</button><span class="clock"></span></div>
   <div class="hero"><h2></h2><p></p><div class="meta"></div></div>
   <div class="rowwrap"><div class="tiles"></div></div>
   <div class="hint"><span><b>◀ ▶</b> تنقّل</span><span><b>OK</b> افتح</span><span><b>رجوع</b> اقفل اللعبة</span><span><b>▲</b> الأزرار</span></div>`;
  document.body.appendChild(el);
  el.querySelector('h1').textContent = C.title || 'برامج وتطبيقات عبدالله';
  const tilesEl = el.querySelector('.tiles'), tbs = [...el.querySelectorAll('.tb')];
  let apps = [], tiles = [];
  const isImg = (i) => /\.(png|jpe?g|svg|webp|gif)$/i.test(i || '') || /^https?:/.test(i || '');

  function build() {
    apps = C.apps.filter((a) => !a.hidden).sort((a, b) => (b.id === 'ninja-worlds') - (a.id === 'ninja-worlds'));
    tilesEl.innerHTML = '';
    tiles = apps.map((a, i) => {
      const b = document.createElement('button'); b.className = 'tile'; b.type = 'button';
      if (a.color) b.style.background = a.color;
      if (isImg(a.icon)) { const im = document.createElement('img'); im.src = a.icon; im.alt = ''; b.appendChild(im); } else b.appendChild(document.createTextNode(a.icon || '🎮'));
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = a.name; b.appendChild(nm);
      b.onclick = () => { idx = i; row = 0; paint(); openApp(); };
      tilesEl.appendChild(b); return b;
    });
    if (idx >= apps.length) idx = 0;
  }
  function colors(c) { const m = (c || '').match(/#[0-9a-f]{3,8}/gi); return m && m.length ? [m[0], m[1] || m[0]] : ['#4f8cff', '#8e7cf0']; }
  function paint() {
    tiles.forEach((t, i) => t.classList.toggle('f', row === 0 && i === idx));
    tbs.forEach((t, i) => t.classList.toggle('f', row === -1 && i === tbFocus));
    const a = apps[idx]; if (!a) return;
    el.querySelector('.hero h2').textContent = a.name;
    el.querySelector('.hero p').textContent = a.description || '';
    let meta = a.version ? 'الإصدار ' + a.version : '';
    try { const s = JSON.parse(localStorage.getItem('portal:save:' + a.id) || 'null'); if (s && s.summary) meta += (meta ? ' · ' : '') + '🏆 ' + s.summary; } catch (e) {}
    el.querySelector('.hero .meta').textContent = meta;
    const [c1, c2] = colors(a.color); el.style.setProperty('--tc', c1); el.style.setProperty('--tc2', c2);
    // RTL: البطاقات تبدأ من اليمين؛ نزحلق الصف بحيث المختارة تكون قريبة من البداية
    const t = tiles[idx]; if (t) { const w = t.offsetWidth + parseFloat(getComputedStyle(tilesEl).gap || 0); const shift = Math.max(0, idx - 1) * w; tilesEl.style.transform = `translateX(${shift}px)`; }
    set('tvhomeIdx', String(idx));
  }
  let tbFocus = 0;
  function openApp() { const a = apps[idx]; if (a && window.PortalLaunch) { window.PortalLaunch(a); setTimeout(focusFrame, 400); } }
  function focusFrame() { const f = document.getElementById('frame'); try { f.focus(); f.contentWindow && f.contentWindow.focus(); } catch (e) {} }
  function act(a) { if (a === 'exit') setOn(false); else if (a === 'cast') document.getElementById('castBtn')?.click(); }
  tbs.forEach((b) => (b.onclick = () => act(b.dataset.a)));
  function setOn(v) { on = v; set('tvhome', v ? '1' : '0'); document.body.classList.toggle('tvmode', v); if (v) { build(); paint(); } }
  function tick() { const d = new Date(); el.querySelector('.clock').textContent = d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }); }
  setInterval(tick, 15000); tick();

  const typing = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
  const BACK = (e) => !typing(e) && ( e.key === 'Backspace' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.key === 'Escape' || e.keyCode === 10009 || e.keyCode === 461 || e.keyCode === 8);
  const viewerOpen = () => window.PortalViewerOpen && window.PortalViewerOpen();
  const sheetOpen = () => { const c = document.getElementById('castSheet'); return (c && !c.hidden) || !!document.querySelector('.sheet.open,.sheet[aria-hidden="false"]'); };
  function closeViewer() { if (viewerOpen()) history.back(); setTimeout(() => { try { window.focus(); } catch (e) {} }, 100); }

  addEventListener('keydown', (e) => {
    if (!on) return;
    if (viewerOpen()) { if (BACK(e)) { e.preventDefault(); closeViewer(); } return; }
    if (sheetOpen()) { if (BACK(e)) { e.preventDefault(); document.getElementById('castClose')?.click(); document.getElementById('sheetBackdrop')?.click(); } return; }
    const k = e.key;
    if (k === 'ArrowLeft') { if (row === 0) idx = Math.min(apps.length - 1, idx + 1); else tbFocus = (tbFocus + 1) % tbs.length; }
    else if (k === 'ArrowRight') { if (row === 0) idx = Math.max(0, idx - 1); else tbFocus = (tbFocus + tbs.length - 1) % tbs.length; }
    else if (k === 'ArrowUp') row = -1;
    else if (k === 'ArrowDown') row = 0;
    else if (k === 'Enter' || e.keyCode === 13) { if (row === 0) openApp(); else act(tbs[tbFocus].dataset.a); }
    else return;
    e.preventDefault(); paint();
  }, true);

  // رجوع من داخل التطبيق (نفس الموقع): ضغطتين سريعتين على رجوع = اقفل؛ والتطبيقات اللي ما تستخدم الرجوع تقفل من ضغطة وحدة
  const frame = document.getElementById('frame');
  let lastBack = 0;
  frame && frame.addEventListener('load', () => {
    let w; try { w = frame.contentWindow; if (!w || !w.document || w.location.href === 'about:blank') return; } catch (e) { return; }
    w.addEventListener('keydown', (e) => {
      if (!on || !BACK(e) || e.key === 'Escape') return;
      const now = Date.now();
      if (now - lastBack < 1200) { e.preventDefault(); e.stopImmediatePropagation(); lastBack = 0; closeViewer(); return; }
      lastBack = now;
      setTimeout(() => { if (!e.defaultPrevented && lastBack === now) closeViewer(); }, 0);
    }, true);
  });

  document.getElementById('tvHomeBtn')?.addEventListener('click', () => setOn(true));
  addEventListener('popstate', () => { if (on) setTimeout(paint, 50); });
  addEventListener('resize', () => on && paint());
  window.PortalTVHome = { on: () => setOn(true), off: () => setOn(false) };
  if (on) setOn(true);
})();
