/* ============================================================
   🎮 أداة حفظ التقدم للألعاب
   أضفها في أي لعبة داخل مجلد apps:
     <script src="../portal-sdk.js"></script>
   ثم:
     const data = await Game.load("my-game");   // يرجع آخر حفظ أو null
     Game.save("my-game", { level: 3, summary: "المرحلة 3" });
   - summary: نص قصير يظهر على بطاقة اللعبة في البوابة
   - score: رقم يدخل لوحة المتصدرين (لازم leaderboard مفعّل للعبة في config.js)
   - يحفظ في الحساب إذا سجّل الشخص دخول، وإلا في الجهاز
   ============================================================ */
(function () {
  function portal() {
    try { return window.parent !== window && window.parent.PortalSave ? window.parent.PortalSave : null; }
    catch (e) { return null; }
  }
  const key = (id) => "portal:save:" + id;
  window.Game = {
    load(id) {
      const p = portal();
      if (p) return p.load(id);
      try { return Promise.resolve(JSON.parse(localStorage.getItem(key(id)))); }
      catch (e) { return Promise.resolve(null); }
    },
    save(id, data) {
      const p = portal();
      if (p) return p.save(id, data);
      try { localStorage.setItem(key(id), JSON.stringify({ ...data, updatedAt: Date.now() })); } catch (e) {}
      return Promise.resolve();
    },
  };
})();
