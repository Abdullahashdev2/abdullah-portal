/* الحسابات وحفظ التقدم في السحابة (Firebase)
   يشتغل فقط إذا عبّيت إعدادات firebase في config.js */
const cfg = (window.PORTAL || {}).firebase || {};
if (cfg.apiKey) init().catch((e) => console.error("Firebase:", e));

async function init() {
  const base = "https://www.gstatic.com/firebasejs/10.12.2/";
  const [{ initializeApp }, A, F] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-auth.js"),
    import(base + "firebase-firestore.js"),
  ]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  auth.languageCode = "ar";

  const P = window.Portal;
  const $ = (s) => document.querySelector(s);
  const msg = (t, ok) => { const m = $("#authMsg"); m.textContent = t || ""; m.className = "auth-msg" + (ok ? " ok" : ""); };

  const ERR = {
    "auth/invalid-email": "الإيميل غير صحيح",
    "auth/missing-password": "اكتب كلمة المرور",
    "auth/weak-password": "كلمة المرور لازم 6 أحرف أو أكثر",
    "auth/email-already-in-use": "هذا الإيميل مسجّل من قبل — اختر «دخول»",
    "auth/invalid-credential": "الإيميل أو كلمة المرور غلط",
    "auth/wrong-password": "كلمة المرور غلط",
    "auth/user-not-found": "ما فيه حساب بهذا الإيميل",
    "auth/too-many-requests": "محاولات كثيرة — انتظر شوي وجرّب",
    "auth/network-request-failed": "تأكد من الإنترنت",
    "auth/popup-closed-by-user": "",
    "auth/cancelled-popup-request": "",
  };
  const fail = (e) => msg(ERR[e.code] ?? "صار خطأ، جرّب مرة ثانية");

  // ---------- ربط الحفظ بالسحابة ----------
  const ref = (id) => F.doc(db, "users", auth.currentUser.uid, "progress", id);
  const cloud = {
    async get(id) { const s = await F.getDoc(ref(id)); return s.exists() ? s.data() : null; },
    set(id, data) { return F.setDoc(ref(id), data); },
    async submitScore(id, score) {
      const app = appById(id);
      if (!app || !app.leaderboard || !auth.currentUser) return;
      const u = auth.currentUser, r = F.doc(db, "leaderboards", id, "scores", u.uid);
      const cur = await F.getDoc(r);
      if (cur.exists() && !isBetter(app, score, cur.data().score)) return;
      await F.setDoc(r, { name: firstName(u), photo: u.photoURL || "", score, updatedAt: Date.now() });
    },
  };

  // ---------- المتصدرين ----------
  const appById = (id) => window.PORTAL.apps.find((a) => a.id === id);
  const lbApps = () => window.PORTAL.apps.filter((a) => a.leaderboard);
  const isBetter = (app, a, b) => (app.leaderboard.lowerIsBetter ? a < b : a > b);
  const firstName = (u) => (u.displayName || u.email.split("@")[0]).trim().split(/\s+/)[0].slice(0, 20);
  let lbCurrent = null;

  function avatarEl(name, photo) {
    const d = document.createElement("span");
    d.className = "lb-av";
    if (photo) { const i = new Image(); i.src = photo; i.alt = ""; i.referrerPolicy = "no-referrer"; d.appendChild(i); }
    else d.textContent = (name || "؟")[0];
    return d;
  }

  async function renderLeaderboard(id) {
    lbCurrent = id;
    const app = appById(id), lb = app.leaderboard, user = auth.currentUser;
    document.querySelectorAll("#lbTabs button").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
    const list = $("#lbList"), mine = $("#lbMine");
    list.innerHTML = ""; mine.hidden = true;
    $("#lbLogin").hidden = !!user;
    if (!user) { $("#lbHint").textContent = "سجّل دخول عشان تشوف المتصدرين وتدخل المنافسة 💪"; return; }
    $("#lbHint").textContent = lb.lowerIsBetter ? "الأقل " + lb.unit + " هو الأفضل" : "الأعلى هو الأفضل";
    list.innerHTML = '<li class="lb-loading">⏳ جاري التحميل...</li>';
    try {
      const col = F.collection(db, "leaderboards", id, "scores");
      const snap = await F.getDocs(F.query(col, F.orderBy("score", lb.lowerIsBetter ? "asc" : "desc"), F.limit(10)));
      if (lbCurrent !== id) return;
      list.innerHTML = "";
      let meInTop = false;
      const medals = ["🥇", "🥈", "🥉"];
      snap.docs.forEach((d, i) => {
        const v = d.data(), me = d.id === user.uid;
        if (me) meInTop = true;
        const li = document.createElement("li");
        li.className = "lb-row" + (me ? " me" : "") + (i < 3 ? " top" : "");
        const rank = document.createElement("span"); rank.className = "lb-rank"; rank.textContent = medals[i] || i + 1;
        const nm = document.createElement("span"); nm.className = "lb-name"; nm.textContent = v.name + (me ? " (أنت)" : "");
        const sc = document.createElement("span"); sc.className = "lb-score"; sc.textContent = v.score + " " + (lb.unit || "");
        li.append(rank, avatarEl(v.name, v.photo), nm, sc);
        list.appendChild(li);
      });
      if (!snap.docs.length) list.innerHTML = '<li class="lb-empty">ما أحد لعب لسا — كن الأول! 🚀</li>';
      if (!meInTop) {
        const my = await F.getDoc(F.doc(db, "leaderboards", id, "scores", user.uid));
        if (lbCurrent !== id) return;
        if (my.exists()) {
          const ahead = await F.getCountFromServer(F.query(col, F.where("score", lb.lowerIsBetter ? "<" : ">", my.data().score)));
          mine.textContent = `ترتيبك: #${ahead.data().count + 1} · ${my.data().score} ${lb.unit || ""} — قرّبت! 💪`;
        } else mine.textContent = "العب عشان يطلع اسمك هنا 🎮";
        mine.hidden = false;
      }
    } catch (e) {
      console.error(e);
      list.innerHTML = '<li class="lb-empty">تعذّر التحميل — تأكد من الإنترنت</li>';
    }
  }

  if (lbApps().length) {
    $("#lbBtn").hidden = false;
    lbApps().forEach((a) => {
      const b = document.createElement("button");
      b.type = "button"; b.dataset.id = a.id; b.textContent = a.name;
      b.onclick = () => renderLeaderboard(a.id);
      $("#lbTabs").appendChild(b);
    });
    P.onLeaderboardOpen = () => renderLeaderboard(lbCurrent || lbApps()[0].id);
    $("#lbLogin").onclick = () => { P.renderProgress(); P.openSheet("#authSheet"); };
  }

  async function sync() {
    // يرفع تقدم الجهاز إذا ما له نسخة بالحساب، أو ينزّل نسخة الحساب للجهاز
    await Promise.all(P.appIds().map(async (id) => {
      try {
        const c = await cloud.get(id), l = P.localSave(id);
        if (!c && l) await cloud.set(id, l);
        else if (c && (!l || (c.updatedAt || 0) >= (l.updatedAt || 0))) P.setLocalSave(id, c);
        else if (c && l) await cloud.set(id, l);
        const best = P.localSave(id);
        if (best && typeof best.score === "number") await cloud.submitScore(id, best.score);
      } catch (e) {}
    }));
    P.renderGrid();
  }

  // ---------- الواجهة ----------
  $("#accountBtn").hidden = false;
  let mode = "login";
  function setMode(m) {
    mode = m;
    $("#authTitle").textContent = m === "login" ? "👋 تسجيل الدخول" : "✨ حساب جديد";
    $("#nameRow").hidden = m === "login";
    $("#authSubmit").textContent = m === "login" ? "دخول" : "إنشاء الحساب";
    $("#authSwitch").textContent = m === "login" ? "ما عندك حساب؟ سجّل الآن" : "عندك حساب؟ ادخل";
    $("#forgot").hidden = m !== "login";
    msg("");
  }
  $("#authSwitch").onclick = () => setMode(mode === "login" ? "signup" : "login");

  $("#googleBtn").onclick = async () => {
    msg("");
    const prov = new A.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: "select_account" });
    try { await A.signInWithPopup(auth, prov); }
    catch (e) {
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")
        return A.signInWithRedirect(auth, prov);
      fail(e);
    }
  };

  $("#authForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim(), pass = $("#password").value;
    $("#authSubmit").disabled = true;
    try {
      if (mode === "login") await A.signInWithEmailAndPassword(auth, email, pass);
      else {
        const name = $("#signupName").value.trim();
        if (!name) { msg("اكتب اسمك"); return; }
        const { user } = await A.createUserWithEmailAndPassword(auth, email, pass);
        await A.updateProfile(user, { displayName: name });
        showAccount(user);
      }
    } catch (err) { fail(err); }
    finally { $("#authSubmit").disabled = false; }
  };

  $("#forgot").onclick = async () => {
    const email = $("#email").value.trim();
    if (!email) return msg("اكتب إيميلك أول، بعدين اضغط «نسيت كلمة المرور»");
    try { await A.sendPasswordResetEmail(auth, email); msg("أرسلنا لك رابط على الإيميل 📩", true); }
    catch (e) { fail(e); }
  };

  $("#logoutBtn").onclick = async () => {
    await A.signOut(auth);
    P.clearLocalSaves(); // ما يشوف الشخص اللي بعده تقدمك على نفس الجهاز
    P.renderGrid();
    P.closeSheets();
  };

  function showAccount(user) {
    const name = user.displayName || user.email.split("@")[0];
    $("#accountName").textContent = name;
    $("#accountEmail").textContent = user.email;
    const av = $("#avatar"), btn = $("#accountBtn");
    av.textContent = ""; btn.textContent = "";
    if (user.photoURL) {
      const img = new Image(); img.src = user.photoURL; img.alt = ""; img.referrerPolicy = "no-referrer";
      av.appendChild(img); btn.appendChild(img.cloneNode());
    } else { av.textContent = name[0]; btn.textContent = name[0]; }
    btn.classList.add("signed");
    P.setUserName(name);
  }

  A.getRedirectResult(auth).catch(fail);
  A.onAuthStateChanged(auth, async (user) => {
    $("#loginView").hidden = !!user;
    $("#accountView").hidden = !user;
    if (user) {
      showAccount(user);
      P.closeSheets();
      window.PortalSave.cloud = cloud;
      await sync();
      P.renderProgress();
    } else {
      window.PortalSave.cloud = null;
      const btn = $("#accountBtn");
      btn.classList.remove("signed"); btn.textContent = "👤";
      P.setUserName(null);
      setMode("login");
    }
  });
}
