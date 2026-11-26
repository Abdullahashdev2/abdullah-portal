# أدوات لعبة «رحّال» (apps/saeq-albatal)

ملف اللعبة الأصلي يجي من عبدالله، وعليه تعديلات من عندنا. إذا وصلت نسخة جديدة من اللعبة:

1. خذ كل شي من سطر `<script src="../portal-sdk.js"></script>` لين `</body>` من الملف الحالي
   (ربط البوابة + وضع النوم + الإصدارات + زر ✈️) وحطّه قبل `</body>` في النسخة الجديدة،
   وأضف سطر `window.__onGameResult` داخل `showResult` بعد `if(isBest)store.set(o.bestKey,lastScore);`.
2. `python3 tools/saeq_gfx_patch.py apps/saeq-albatal/index.html` — السماء والبحر وأشعة الشمس والجودة الفائقة.
3. `python3 tools/rahhal_cars_patch.py apps/saeq-albatal/index.html` — السيارات الجديدة والزحمة.
4. تعديلات يدوية (إذا ما كانت موجودة في النسخة الجديدة): القيادة الناعمة (`autopilot`)، طبقة سماء
   الخيال الناعمة في `render3D`، واسم «رحّال».

عالم السماء ملف مستقل: `apps/saeq-albatal/flight.html` (three.js في `lib/`).
