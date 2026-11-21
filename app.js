(function () {
  const C = window.PORTAL;
  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;

  // ---------- تخزين آمن في الجهاز ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("portal:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("portal:" + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem("portal:" + k); } catch {} },
  };

  // معرّف لكل تطبيق (من id أو من الرابط)
  C.apps.forEach((a) => {
    if (!a.id) a.id = (a.url || a.name).replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || a.name;
  });

  // ---------- حفظ التقدم (الجهاز + الحساب) ----------
  const PortalSave = {
    cloud: null, // يتعبّى من auth.js عند تسجيل الدخول
    async load(id) {
      const local = store.get("save:" + id, null);
      if (this.cloud) {
        try { const c = await this.cloud.get(id); if (c) { store.set("save:" + id, c); return c; } } catch {}
      }
      return local;
    },
    async save(id, data) {
      data = { ...data, updatedAt: Date.now() };
      store.set("save:" + id, data);
      renderGrid(); renderProgress();
      if (this.cloud) {
        try { await this.cloud.set(id, data); } catch (e) { console.warn("cloud save failed", e); }
        if (typeof data.score === "number") { try { await this.cloud.submitScore(id, data.score); } catch (e) { console.warn("score failed", e); } }
      }
    },
  };
  window.PortalSave = PortalSave;

  const THEMES = {
    sunset: ["#ff8a65", "#ffb74d"], ocean: ["#4f8cff", "#4dd0e1"], mint: ["#26a69a", "#9ccc65"],
    lavender: ["#8e7cf0", "#f48fb1"], candy: ["#ec5c9a", "#ffca5f"],
  };

  let prefs = {
    theme: store.get("theme", C.defaultTheme || "sunset"),
    mode: store.get("mode", "auto"),
    size: store.get("size", "md"),
    layout: store.get("layout", "grid"),
    name: store.get("name", ""),
  };
  let accountName = null;
  let favs = new Set(store.get("favs2", []));
  let filter = "all";
  let query = "";

  // ---------- تطبيق التفضيلات ----------
  const darkMQ = matchMedia("(prefers-color-scheme: dark)");
  function applyPrefs() {
    root.dataset.theme = prefs.theme;
    root.dataset.mode = prefs.mode === "auto" ? (darkMQ.matches ? "dark" : "light") : prefs.mode;
    root.dataset.size = prefs.size;
    $("#grid").classList.toggle("list", prefs.layout === "list");
    document.querySelectorAll(".swatch").forEach((b) => b.classList.toggle("active", b.dataset.theme === prefs.theme));
    [["#modeSeg", "mode"], ["#sizeSeg", "size"], ["#layoutSeg", "layout"]].forEach(([sel, key]) =>
      document.querySelectorAll(sel + " button").forEach((b) => b.classList.toggle("active", b.dataset[key] === prefs[key])));
    greet();
  }
  darkMQ.addEventListener?.("change", applyPrefs);

  function greet() {
    const h = new Date().getHours();
    const t = h < 12 ? "صباح الخير" : h < 18 ? "مساء الخير" : "مساء النور";
    const n = accountName || prefs.name;
    $("#greeting").textContent = `${t}${n ? " يا " + n : ""} 👋`;
  }

  // ---------- المحتوى ----------
  document.title = C.title;
  $("#title").textContent = C.title;
  $("#subtitle").textContent = C.subtitle;
  $("#footer").textContent = `صُنع بحب ❤️ بواسطة ${C.owner} · ${new Date().getFullYear()}`;

  function renderChips() {
    const cats = { all: "✨ الكل", fav: "⭐ المفضلة", ...C.categories };
    $("#chips").innerHTML = "";
    Object.entries(cats).forEach(([id, label]) => {
      if (id !== "all" && id !== "fav" && !C.apps.some((a) => a.category === id)) return;
      const b = document.createElement("button");
      b.className = "chip" + (filter === id ? " active" : "");
      b.textContent = label;
      b.onclick = () => { filter = id; renderChips(); renderGrid(); };
      $("#chips").appendChild(b);
    });
  }

  function iconEl(a) {
    const isImg = /\.(png|jpe?g|svg|webp|gif)$/i.test(a.icon || "") || /^https?:/.test(a.icon || "");
    const el = document.createElement("div");
    el.className = "app-icon";
    if (a.color) el.style.background = a.color;
    if (isImg) { const img = document.createElement("img"); img.src = a.icon; img.alt = ""; el.appendChild(img); }
    else el.textContent = a.icon || "📦";
    return el;
  }

  function renderGrid() {
    const q = query.trim().toLowerCase();
    const list = C.apps.filter((a) => {
      if (filter === "fav" && !favs.has(a.id)) return false;
      if (filter !== "all" && filter !== "fav" && a.category !== filter) return false;
      return !q || (a.name + " " + (a.description || "")).toLowerCase().includes(q);
    });
    const grid = $("#grid");
    grid.innerHTML = "";
    list.forEach((a, n) => {
      const card = document.createElement("article");
      card.className = "card";
      card.style.animationDelay = n * 0.05 + "s";
      card.appendChild(iconEl(a));
      const info = document.createElement("div");
      info.className = "info";
      info.innerHTML = "<h3></h3><p></p>";
      info.querySelector("h3").textContent = a.name;
      info.querySelector("p").textContent = a.description || "";
      const saved = store.get("save:" + a.id, null);
      if (saved && saved.summary) {
        const pr = document.createElement("div");
        pr.className = "progress"; pr.textContent = "🏆 " + saved.summary;
        info.appendChild(pr);
      }
      card.appendChild(info);
      if (a.isNew) { const s = document.createElement("span"); s.className = "badge"; s.textContent = "جديد"; card.appendChild(s); }
      const open = document.createElement("button");
      open.className = "open"; open.setAttribute("aria-label", "افتح " + a.name);
      open.onclick = () => launch(a);
      card.appendChild(open);
      const fav = document.createElement("button");
      fav.className = "fav" + (favs.has(a.id) ? " on" : "");
      fav.textContent = "⭐"; fav.setAttribute("aria-label", "مفضلة");
      fav.onclick = (e) => {
        e.stopPropagation();
        favs.has(a.id) ? favs.delete(a.id) : favs.add(a.id);
        store.set("favs2", [...favs]); renderGrid();
      };
      card.appendChild(fav);
      grid.appendChild(card);
    });
    $("#empty").hidden = list.length > 0;
  }

  function renderProgress() {
    const box = $("#progressList");
    if (!box) return;
    box.innerHTML = "";
    const items = C.apps.map((a) => [a, store.get("save:" + a.id, null)]).filter(([, s]) => s && s.summary);
    if (!items.length) { box.innerHTML = '<p class="muted">لسا ما لعبت شي — ابدأ وبيتحفظ تقدمك هنا 🎮</p>'; return; }
    items.forEach(([a, s]) => {
      const row = document.createElement("div");
      row.className = "prow";
      row.innerHTML = "<span class='pi'></span><b></b><span class='ps'></span>";
      row.querySelector(".pi").textContent = /^[^./]{1,4}$/.test(a.icon) ? a.icon : "🎮";
      row.querySelector("b").textContent = a.name;
      row.querySelector(".ps").textContent = s.summary;
      box.appendChild(row);
    });
  }

  // ---------- فتح التطبيقات ----------
  function launch(a) {
    if (a.open === "tab") { window.open(a.url, "_blank", "noopener"); return; }
    $("#viewerTitle").textContent = a.name;
    $("#frame").src = a.url;
    $("#viewer").hidden = false;
    document.body.style.overflow = "hidden";
    history.pushState({ viewer: true }, "");
  }
  function closeViewer() {
    $("#viewer").hidden = true; $("#frame").src = "about:blank";
    document.body.style.overflow = "";
  }
  $("#closeViewer").onclick = () => history.back();
  window.addEventListener("popstate", () => { if (!$("#viewer").hidden) closeViewer(); });
  $("#fullViewer").onclick = () => $("#viewer").requestFullscreen?.();

  // ---------- اللوحات ----------
  function openSheet(id) {
    closeSheets();
    const s = $(id); s.scrollTop = 0; s.classList.add("open"); s.setAttribute("aria-hidden", "false");
    $("#sheetBackdrop").hidden = false;
  }
  function closeSheets() {
    document.querySelectorAll(".sheet").forEach((s) => { s.classList.remove("open"); s.setAttribute("aria-hidden", "true"); });
    $("#sheetBackdrop").hidden = true;
  }
  $("#settingsBtn").onclick = () => openSheet("#sheet");
  $("#accountBtn").onclick = () => { renderProgress(); openSheet("#authSheet"); };
  $("#lbBtn").onclick = () => { openSheet("#lbSheet"); window.Portal.onLeaderboardOpen?.(); };
  $("#closeSheet").onclick = $("#sheetBackdrop").onclick = closeSheets;
  document.querySelectorAll("[data-close]").forEach((b) => b.onclick = closeSheets);

  Object.entries(THEMES).forEach(([id, [a, b]]) => {
    const s = document.createElement("button");
    s.className = "swatch"; s.dataset.theme = id; s.setAttribute("aria-label", id);
    s.style.background = `linear-gradient(135deg, ${a}, ${b})`;
    s.onclick = () => { prefs.theme = id; store.set("theme", id); applyPrefs(); };
    $("#themes").appendChild(s);
  });
  [["#modeSeg", "mode"], ["#sizeSeg", "size"], ["#layoutSeg", "layout"]].forEach(([sel, key]) =>
    document.querySelectorAll(sel + " button").forEach((b) => b.onclick = () => {
      prefs[key] = b.dataset[key]; store.set(key, prefs[key]); applyPrefs();
    }));
  $("#nameInput").value = prefs.name;
  $("#nameInput").oninput = (e) => { prefs.name = e.target.value.trim(); store.set("name", prefs.name); greet(); };

  $("#search").oninput = (e) => { query = e.target.value; renderGrid(); };

  // ---------- واجهة لـ auth.js ----------
  window.Portal = {
    appIds: () => C.apps.map((a) => a.id),
    localSave: (id) => store.get("save:" + id, null),
    setLocalSave: (id, d) => store.set("save:" + id, d),
    clearLocalSaves: () => C.apps.forEach((a) => store.del("save:" + a.id)),
    setUserName: (n) => { accountName = n; $("#nameField").hidden = !!n; greet(); },
    renderGrid, renderProgress, closeSheets, openSheet,
  };

  // ---------- حماية من النسخ والتحميل (ردع) ----------
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && ["s", "u", "p"].includes(k)) e.preventDefault();
    if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k))) e.preventDefault();
  });

  renderChips(); renderGrid(); applyPrefs();
})();
