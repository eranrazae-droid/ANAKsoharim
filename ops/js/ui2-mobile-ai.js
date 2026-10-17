/* צ׳אט ה-AI של הטלפון.
   מזהה את הרכב במשרד התחבורה דרך השרת (חינמי) ומציג כרטיס רכב, ומגדיר את
   window.AnakMobileAI.ask שפותח את השאלה ב-Claude של המשתמש עם פרטי הרכב. */
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

  /* השאלה נפתחת ב-Claude של המשתמש עצמו (אתר או אפליקציה), עם פרטי הרכב
     שזוהו — בלי מפתח API ובלי עלות לעסק. Claude מחפש ברשת ומציג מקורות. */
  function prompt(plate, c, message) {
    const car = c ? [
      `יצרן: ${c.maker}`, `דגם: ${c.model}`, c.modelCode && `קוד דגם: ${c.modelCode}`, c.trim && `רמת גימור: ${c.trim}`,
      `שנת ייצור: ${c.year}`, c.fuel && `דלק: ${c.fuel}`, c.engine && `דגם מנוע: ${c.engine}`,
    ].filter(Boolean).join('\n') : '(הרכב לא זוהה במרשם)';
    return `רכב בישראל, מספר רישוי ${plate}. פרטים ממאגר משרד התחבורה:\n${car}\n\n` +
      `השאלה: ${message}\n\n` +
      'חפש מקורות יצרן, ספר הרכב, היבואן בישראל וקטלוגי התאמה (למשל VARTA, Bosch). ציין מקורות. ' +
      'אם התשובה תלויה בגרסה או ברמת גימור ואין התאמה ודאית — אמור זאת ובקש פרט נוסף, אל תנחש. ענה בעברית, בקצרה.';
  }
  // נקראת מתוך לחיצת השליחה — פותחים את החלון מיד, לפני כל המתנה, כדי שהדפדפן לא יחסום
  function ask({ plate, message }) {
    const url = 'https://claude.ai/new?q=' + encodeURIComponent(prompt(plate, cards.get(plate), message));
    let w = null;
    try { w = window.open(url, '_blank'); if (w) w.opener = null; } catch (e) {}
    return Promise.resolve({
      answer: w ? 'השאלה נפתחה ב-Claude בחלון חדש, עם פרטי הרכב. התשובה והמקורות יופיעו שם.'
                : 'הדפדפן חסם פתיחת חלון. לחץ על הקישור למטה כדי לפתוח את השאלה ב-Claude.',
      sources: [{ title: '↗ פתח את השאלה ב-Claude', url }],
    });
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
