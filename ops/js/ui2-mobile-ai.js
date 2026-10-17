/* חיבור צ׳אט ה-AI של הטלפון לשרת (פונקציה vehicleAI).
   מגדיר את window.AnakMobileAI.ask שהחלונית קוראת לו, ומציג בחלונית כרטיס
   של הרכב שזוהה במשרד התחבורה. בלי מפתחות בדפדפן: כל בקשה נושאת את אסימון
   ההזדהות של Firebase, והשרת מחזיק את המפתח ובודק מגבלות שימוש. */
(function () {
  'use strict';
  const URL_AI = 'https://europe-west1-anak-soharim.cloudfunctions.net/vehicleAI';
  const cards = new Map();   // רישוי -> כרטיס (או null כשלא נמצא) — רק לזמן העבודה הנוכחי
  let shownFor = '', idCtrl = null, owner = '';

  async function token() {
    try { const u = window._auth?.currentUser; return u ? await u.getIdToken() : ''; } catch (e) { return ''; }
  }
  async function call(body, signal, ms) {
    const ctrl = new AbortController();
    const stop = () => ctrl.abort();
    signal?.addEventListener('abort', stop, { once: true });
    const t = setTimeout(stop, ms);
    try {
      const res = await fetch(URL_AI, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token() },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      return { status: res.status, j };
    } finally { clearTimeout(t); signal?.removeEventListener('abort', stop); }
  }

  async function ask({ plate, message, history, signal }) {
    const { status, j } = await call({ action: 'ask', plate, message, history }, signal, 110000);
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (j.vehicle) { cards.set(plate, j.vehicle); paint(); }
    if (status === 503 && j.error === 'not-configured') return { answer: 'שירות ה-AI עדיין לא הוגדר בשרת. פנה למנהל המערכת.', sources: [] };
    if (status === 429) return { answer: j.answer || 'הגעת למגבלת השאלות היומית. אפשר להמשיך מחר.', sources: [] };
    if (status === 502) return { answer: 'מאגר משרד התחבורה לא זמין כרגע. נסה שוב בעוד כמה דקות.', sources: [] };
    if (status !== 200 || typeof j.answer !== 'string') throw new Error('ai ' + status);
    return { answer: j.answer, sources: Array.isArray(j.sources) ? j.sources : [] };
  }
  window.AnakMobileAI = { ask };

  /* ── כרטיס הרכב שזוהה ── */
  const $ = id => document.getElementById(id);
  function box() {
    let b = $('ui2m-vehicle');
    const form = $('ui2m-plate-form');
    if (!b && form) { b = document.createElement('div'); b.id = 'ui2m-vehicle'; b.className = 'u2m-vehicle'; b.setAttribute('aria-live', 'polite'); form.after(b); }
    return b;
  }
  function paint() {
    const b = box(); if (!b) return;
    const plate = ($('ui2m-plate')?.value || '').replace(/\D/g, '');
    if (!/^\d{7,8}$/.test(plate)) { b.hidden = true; b.replaceChildren(); return; }
    b.hidden = false;
    if (!cards.has(plate)) { b.textContent = '🔎 מזהה את הרכב במשרד התחבורה…'; b.className = 'u2m-vehicle wait'; return; }
    const c = cards.get(plate);
    if (!c) { b.textContent = '⚠️ המספר לא נמצא במרשם משרד התחבורה — בדוק את המספר.'; b.className = 'u2m-vehicle miss'; return; }
    b.className = 'u2m-vehicle ok';
    const line = (t) => { const d = document.createElement('div'); d.textContent = t; return d; };
    const title = document.createElement('b');
    title.textContent = [c.maker, c.model, c.year].filter(Boolean).join(' · ');
    const rows = [
      [c.trim && 'גימור: ' + c.trim, c.fuel && 'דלק: ' + c.fuel].filter(Boolean).join(' · '),
      [c.color && 'צבע: ' + c.color, c.engine && 'מנוע: ' + c.engine].filter(Boolean).join(' · '),
    ].filter(Boolean);
    const src = document.createElement('small');
    const when = c.fetchedAt ? new Date(c.fetchedAt).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    src.textContent = `מקור: משרד התחבורה${when ? ' · נשלף ' + when : ''} · השיחה מתייחסת לרכב הזה`;
    b.replaceChildren(title, ...rows.map(line), src);
  }
  async function identify(plate) {
    idCtrl?.abort(); idCtrl = new AbortController();
    const mine = idCtrl;
    try {
      const { status, j } = await call({ action: 'identify', plate }, mine.signal, 20000);
      if (mine.signal.aborted) return;
      if (status === 200) cards.set(plate, j.found ? j.vehicle : null);
      else { const b = box(); if (b && shownFor === plate) { b.textContent = status === 503 ? 'זיהוי הרכב עדיין לא הוגדר בשרת.' : 'לא ניתן לזהות את הרכב כרגע. אפשר לשאול בכל זאת.'; b.className = 'u2m-vehicle miss'; } return; }
    } catch (e) { if (!mine.signal.aborted) { const b = box(); if (b) { b.textContent = 'אין חיבור לזיהוי הרכב כרגע.'; b.className = 'u2m-vehicle miss'; } } return; }
    if (shownFor === plate) paint();
  }
  // מעקב אחרי מספר הרישוי שבחלונית; החלפת משתמש מנקה את הזיכרון
  setInterval(() => {
    const who = (typeof currentUser !== 'undefined' && currentUser?.name) || '';
    if (who !== owner) { owner = who; cards.clear(); shownFor = ''; idCtrl?.abort(); }
    const inp = $('ui2m-plate'); if (!inp) return;
    const plate = inp.value.replace(/\D/g, '');
    if (plate === shownFor) return;
    shownFor = plate;
    paint();
    if (/^\d{7,8}$/.test(plate) && !cards.has(plate)) identify(plate);
  }, 400);
})();
