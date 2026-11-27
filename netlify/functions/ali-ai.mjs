/* =====================================================================
   🪄 «رسمات علي»: إعادة رسم الرسمة بالذكاء الاصطناعي (Google Gemini)
   - المفتاح محفوظ في متغيّر البيئة GEMINI_API_KEY في Netlify (ما يظهر للمتصفح)
   - ما يقبل إلا أفراد العائلة المسجّلين في البوابة (نتحقق من رمز Firebase)
   - اختياري: ALLOWED_EMAILS = قائمة إيميلات مسموحة (مفصولة بفواصل)
   - اختياري: GEMINI_IMAGE_MODEL لتغيير النموذج
   ===================================================================== */
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDji29RllwH-IjsXMGRAIFlwekD-tJdRNU';
const MODELS = [process.env.GEMINI_IMAGE_MODEL, 'gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview'].filter(Boolean);

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function verifyUser(idToken) {
  if (!idToken) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }) });
  if (!r.ok) return null;
  const d = await r.json(); const u = d.users && d.users[0];
  return u ? { uid: u.localId, email: (u.email || '').toLowerCase() } : null;
}

const PROMPT = (name, extra) => `Redraw this child's hand-drawn pencil sketch as a finished, full-colour anime / cartoon character illustration, like a character from a modern animated series or video game.
Keep the SAME character as in the sketch: the same face, hairstyle, eyes, expression, accessories and clothing details — stay faithful to the child's design and spirit, just finish it professionally.
Complete everything the sketch is missing so it becomes a full character: full body from the top of the head to the feet, standing upright, front view, arms held slightly away from the body, legs slightly apart, both hands and both feet clearly visible.
Clean confident line art, vibrant cel shading, friendly and family-appropriate.
Plain pure white background (#FFFFFF), no text, no logo, no frame, no ground shadow, no other objects or characters.${name ? `\nThe character is called "${name}".` : ''}${extra ? `\n${extra}` : ''}`;

async function callGemini(key, model, b64, mime, prompt, withRatio) {
  const body = { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }] }], generationConfig: { responseModalities: ['IMAGE'] } };
  if (withRatio) body.generationConfig.imageConfig = { aspectRatio: '2:3' };
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 55000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
    const text = await r.text(); let d = null; try { d = JSON.parse(text); } catch (e) { }
    if (!r.ok) return { error: (d && d.error && d.error.message) || text.slice(0, 300), status: r.status };
    const parts = (d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
    const img = parts.find(p => p.inlineData || p.inline_data);
    if (!img) { const why = (d && d.candidates && d.candidates[0] && d.candidates[0].finishReason) || (d && d.promptFeedback && d.promptFeedback.blockReason) || 'no image'; return { error: 'ما رجعت صورة: ' + why, status: 422 }; }
    const x = img.inlineData || img.inline_data; return { image: x.data, mime: x.mimeType || x.mime_type || 'image/png' };
  } finally { clearTimeout(tm); }
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(503, { error: 'المفتاح GEMINI_API_KEY مو مضاف في إعدادات Netlify بعد' });
  let body; try { body = await req.json(); } catch (e) { return json(400, { error: 'bad json' }); }
  const user = await verifyUser(body.idToken).catch(() => null);
  if (!user) return json(401, { error: 'سجّل دخول في البوابة أول' });
  const allow = (process.env.ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.includes(user.email)) return json(403, { error: 'هذي الميزة لأفراد العائلة المسموح لهم فقط' });
  const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(body.image || '');
  if (!m) return json(400, { error: 'الصورة غير صالحة' });
  if (m[3].length > 6_000_000) return json(413, { error: 'الصورة كبيرة' });
  const prompt = PROMPT(String(body.name || '').slice(0, 40), String(body.extra || '').slice(0, 200));
  let last = null;
  for (const model of MODELS) {
    for (const withRatio of [true, false]) {
      try { const r = await callGemini(key, model, m[3], m[1], prompt, withRatio); if (r.image) return json(200, { image: `data:${r.mime};base64,${r.image}`, model }); last = r;
        if (r.status === 404) break; if (r.status !== 400) return json(r.status || 502, { error: r.error }); }
      catch (e) { last = { error: e.name === 'AbortError' ? 'الذكاء الاصطناعي تأخر كثير، جرّب مرة ثانية' : String(e.message || e) }; return json(504, last); }
    }
  }
  return json(502, { error: (last && last.error) || 'فشل التوليد' });
};

export const config = { path: '/api/ali-ai' };
