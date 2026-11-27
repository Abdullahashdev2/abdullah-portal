/* يخلي الشاشة صاحية (ما تخفت ولا تقفل) وقت ما يكون فيه لعب عن بعد أو بيد تحكم.
   1) Screen Wake Lock API  2) احتياطي: فيديو صغير مكتوم يشتغل بالخلفية */
(function () {
  let lock = null, want = false, vid = null, timer = null;
  function fallback(on) {
    if (!on) { if (vid) { try { vid.pause(); } catch (e) {} } clearInterval(timer); return; }
    try {
      if (!vid) {
        const c = document.createElement('canvas'); c.width = c.height = 2; const g = c.getContext('2d');
        vid = document.createElement('video'); vid.muted = true; vid.playsInline = true; vid.setAttribute('playsinline', ''); vid.loop = true;
        Object.assign(vid.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0.01', pointerEvents: 'none', left: '0', bottom: '0' });
        vid.srcObject = c.captureStream ? c.captureStream(2) : null; document.body.appendChild(vid);
        let k = 0; timer = setInterval(() => { g.fillStyle = (k++ % 2) ? '#000' : '#010101'; g.fillRect(0, 0, 2, 2); }, 500);
      }
      vid.play().catch(() => {});
    } catch (e) {}
  }
  async function request() {
    if (!want || document.visibilityState !== 'visible') return;
    if ('wakeLock' in navigator) {
      try { if (!lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; if (want) setTimeout(request, 300); }); } return; } catch (e) {}
    }
    fallback(true);
  }
  window.KeepAwake = {
    on() { want = true; request(); },
    off() { want = false; try { lock && lock.release(); } catch (e) {} lock = null; fallback(false); },
    get active() { return want; },
  };
  document.addEventListener('visibilitychange', () => { if (want && document.visibilityState === 'visible') request(); });
  // some browsers only grant it after a tap/click — retry on the next interaction
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (want && !lock) request(); }, true));
  setInterval(() => { if (want && !lock) request(); }, 15000);
})();
