# 🏡 برامج وتطبيقات عبدالله

بوابة عائلية لعرض الألعاب والبرامج — تُستضاف على Vercel.

## ➕ إضافة لعبة أو برنامج
1. افتح `config.js` وأضف عنصر جديد داخل `apps`.
2. لو اللعبة ملف HTML عندك: حط مجلدها داخل `apps/` (مثل `apps/my-game/index.html`) واكتب `url: "apps/my-game/"`.
3. لو رابط خارجي: اكتب الرابط واختر `open: "tab"` (بعض المواقع ما تسمح تنفتح داخل البوابة).
4. ارفع التعديل لـ GitHub ← Vercel ينشره تلقائياً خلال ثواني.

## 🚀 النشر أول مرة
1. أنشئ مستودع **خاص (Private)** في GitHub وارفع هذا المجلد.
2. ادخل vercel.com ← Add New Project ← اختر المستودع ← Deploy (بدون أي إعدادات).

## 🔒 الحماية
- ما أحد يقدر يعدّل أو يحذف إلا صاحب حساب GitHub/Vercel.
- الزوار يقدرون يخصصون الألوان والخط والوضع لأنفسهم فقط (تُحفظ في أجهزتهم).
- منع الزر الأيمن والسحب والحفظ (Ctrl+S) وأدوات المطوّر — ردع للمستخدم العادي.

## 👤 الحسابات وحفظ التقدم (Firebase)
1. console.firebase.google.com ← Create a project (بدون Analytics).
2. **Build ← Authentication ← Get started** ← فعّل: **Google** و **Email/Password**.
3. **Authentication ← Settings ← Authorized domains** ← أضف رابط موقعك (مثل `abdullah-apps.netlify.app`).
4. **Build ← Firestore Database ← Create database** ← اختر أقرب منطقة ← Production mode.
5. **Firestore ← Rules** ← الصق محتوى ملف `firestore.rules` ← Publish.
6. **Project settings ⚙️ ← Your apps ← أيقونة الويب `</>`** ← سجّل التطبيق ← انسخ القيم إلى `firebase` في `config.js`.
   (هذه القيم مو سرية — عادي تكون في الموقع، الحماية من القواعد في الخطوة 5.)

## 🎮 إضافة الحفظ لأي لعبة جديدة
```html
<script src="../portal-sdk.js"></script>
<script>
  Game.load("game-id").then(data => { /* كمّل من حيث وقف */ });
  Game.save("game-id", { level: 3, summary: "المرحلة 3" });
</script>
```
