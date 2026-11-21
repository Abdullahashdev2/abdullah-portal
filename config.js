/* ============================================================
   ⚙️ ملف الإعدادات — هذا الملف الوحيد اللي تحتاج تعدّله
   لإضافة لعبة أو برنامج: انسخ أي عنصر داخل apps وعدّل بياناته
   ============================================================ */
window.PORTAL = {
  // اسم البوابة والترحيب
  title: "برامج وتطبيقات عبدالله",
  subtitle: "ألعاب وبرامج مفيدة لكل العائلة 💛",
  owner: "عبدالله",

  /* 🔐 إعدادات Firebase (للحسابات وحفظ التقدم)
     انسخها من: Firebase Console ← Project settings ← Your apps ← Config
     إذا تركتها فاضية: البوابة تشتغل عادي والحفظ يكون في الجهاز فقط */
  firebase: {
    apiKey: "AIzaSyDji29RllwH-IjsXMGRAIFlwekD-tJdRNU",
    authDomain: "abdullah-apps-dev2.firebaseapp.com",
    projectId: "abdullah-apps-dev2",
    appId: "1:649786113734:web:a0ba215f0a71cf260c21c7",
  },

  // الثيم الافتراضي: sunset | ocean | mint | lavender | candy
  defaultTheme: "sunset",

  // التصنيفات (id: الاسم الظاهر)
  categories: {
    games: "🎮 ألعاب",
    learn: "📚 تعليم",
    tools: "🛠️ أدوات",
    kids: "🧸 للأطفال",
  },

  /* التطبيقات
     - id: معرّف ثابت للتطبيق (لا تغيّره بعدين — عليه يتحفظ التقدم)
     - icon: إيموجي أو رابط صورة (مثل "assets/myicon.png")
     - url: رابط خارجي، أو مسار داخل المشروع مثل "apps/memory-game/"
     - open: "inside" يفتح داخل البوابة | "tab" يفتح في تبويب جديد
     - color: لون خلفية الأيقونة (اختياري)
     - isNew: true يظهر شارة "جديد"
     - leaderboard: يفعّل لوحة المتصدرين للعبة
         { unit: "نقطة" }                       ← الأعلى أفضل
         { unit: "محاولة", lowerIsBetter: true } ← الأقل أفضل
         { boards: [{ id, name, unit }, ...] } ← أكثر من لوحة للعبة وحدة
           (اللعبة ترسل Game.save(id, { scores: { boardId: رقم } }))
  */
  apps: [
    {
      id: "saeq-albatal",
      name: "السائق البطل",
      description: "قُد من داخل السيارة 3D، أو العب الكلاسيكية، أو روّق في وضع الروقان 🚗",
      icon: "🚗",
      color: "#fde68a",
      category: "games",
      url: "apps/saeq-albatal/",
      open: "inside",
      isNew: true,
      leaderboard: {
        boards: [
          { id: "saeq-3d", name: "🎮 السائق 3D", unit: "نقطة" },
          { id: "saeq-classic", name: "🚗 السائق الكلاسيكي", unit: "نقطة" },
        ],
      },
    },
    {
      id: "memory-game",
      name: "لعبة الذاكرة",
      description: "اقلب البطاقات وطابق الأزواج — تقوّي الذاكرة وممتعة للصغار والكبار",
      icon: "🧠",
      color: "#ffd6e0",
      category: "games",
      url: "apps/memory-game/",
      open: "inside",
      leaderboard: { unit: "محاولة", lowerIsBetter: true },
    },
    {
      id: "calculator",
      name: "آلة حاسبة",
      description: "حاسبة بسيطة وسريعة",
      icon: "🧮",
      color: "#d6f0ff",
      category: "tools",
      url: "https://www.desmos.com/scientific?lang=ar",
      open: "tab",
    },
    {
      id: "autodraw",
      name: "تعلّم الرسم",
      description: "ارسم ولوّن بحرية",
      icon: "🎨",
      color: "#e4ffd6",
      category: "kids",
      url: "https://www.autodraw.com/",
      open: "tab",
    },
  ],
};
