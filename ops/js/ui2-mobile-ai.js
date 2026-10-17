/* צ׳אט ה-AI של הטלפון.
   מזהה את הרכב במשרד התחבורה דרך השרת (חינמי) ומציג כרטיס רכב, ומגדיר את
   window.AnakMobileAI.ask שפותח את השאלה בעוזר שהנהג בחר (Claude או ChatGPT). */
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

  /* העוזר שהנהג בחר (Claude / ChatGPT) — נשמר לכל משתמש במכשיר שלו.
     השאלה נפתחת אצל העוזר עצמו עם פרטי הרכב, בלי מפתח API ובלי עלות לעסק. */
  const AI = {
    claude:  { name: 'Claude',  url: q => 'https://claude.ai/new?q=' + q },
    chatgpt: { name: 'ChatGPT', url: q => 'https://chatgpt.com/?q=' + q },
  };
  const who = () => (typeof currentUser !== 'undefined' && currentUser?.name) || '';
  const pickKey = () => 'anak_ai_pick:' + who();
  function getPick() { try { const v = localStorage.getItem(pickKey()); return AI[v] ? v : ''; } catch (e) { return ''; } }
  function setPick(v) { try { localStorage.setItem(pickKey(), v); } catch (e) {} }
  const other = k => (k === 'claude' ? 'chatgpt' : 'claude');

  function prompt(plate, c, message) {
    const tail = '\n\nחפש מקורות יצרן, ספר הרכב, היבואן בישראל וקטלוגי התאמה (למשל VARTA, Bosch). ציין מקורות. ' +
      'אם התשובה תלויה בדגם, בגרסה או ברמת גימור ואין התאמה ודאית — אמור זאת ובקש פרט נוסף, אל תנחש. ענה בעברית, בקצרה.';
    if (!plate) return `שאלה על רכב (בישראל):\n${message}${tail}`;
    const car = c ? [
      `יצרן: ${c.maker}`, `דגם: ${c.model}`, c.modelCode && `קוד דגם: ${c.modelCode}`, c.trim && `רמת גימור: ${c.trim}`,
      `שנת ייצור: ${c.year}`, c.fuel && `דלק: ${c.fuel}`, c.engine && `דגם מנוע: ${c.engine}`,
    ].filter(Boolean).join('\n') : '(הרכב לא זוהה במרשם)';
    return `רכב בישראל, מספר רישוי ${plate}. פרטים ממאגר משרד התחבורה:\n${car}\n\nהשאלה: ${message}${tail}`;
  }
  // נקראת מתוך לחיצת "שלח" — פותחים מיד, לפני כל המתנה, כדי שהדפדפן לא יחסום
  function ask({ plate, message }) {
    const k = getPick() || 'claude', o = other(k);
    const q = encodeURIComponent(prompt(plate, cards.get(plate), message));
    let w = null;
    try { w = window.open(AI[k].url(q), '_blank'); if (w) w.opener = null; } catch (e) {}
    setTimeout(() => {
      const m = $('ui2m-messages'); if (!m) return;
      const links = m.querySelectorAll('a'); const alt = links[links.length - 1];
      if (alt && alt.href.startsWith(AI[o].url(''))) alt.classList.add('u2m-alt');
      m.scrollTop = m.scrollHeight; m.lastElementChild?.scrollIntoView({ block: 'nearest' });
    }, 60);
    return Promise.resolve({
      answer: w ? `נפתח ב-${AI[k].name} ✓ התשובה והמקורות מופיעים שם.` : `הדפדפן חסם את פתיחת ${AI[k].name} — לחץ על הכפתור כדי לפתוח.`,
      sources: [
        { title: `↗ פתח${w ? ' שוב' : ''} ב-${AI[k].name}`, url: AI[k].url(q) },
        { title: `או: שאל את אותה שאלה ב-${AI[o].name}`, url: AI[o].url(q) },
      ],
    });
  }

  /* בחירה ראשונה ומתג החלפה בראש החלונית */
  function note(text) {
    const m = $('ui2m-messages'); if (!m) return;
    const e = document.createElement('div'); e.className = 'u2m-message u2m-ai-note'; e.textContent = text;
    m.appendChild(e); e.scrollIntoView({ block: 'nearest' });
  }
  function aiUi() {
    const sheet = document.querySelector('#ui2m-chat .u2m-chat-sheet'); if (!sheet) return;
    let seg = $('ui2m-ai-seg'), pick = $('ui2m-ai-pick');
    if (!seg) {
      seg = document.createElement('div'); seg.id = 'ui2m-ai-seg'; seg.className = 'u2m-ai-seg'; seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', 'העוזר שלי');
      seg.innerHTML = '<button type="button" role="radio" data-ai="claude">Claude</button><button type="button" role="radio" data-ai="chatgpt">ChatGPT</button>';
      seg.addEventListener('click', e => {
        const b = e.target.closest('[data-ai]'); if (!b || b.dataset.ai === getPick()) return;
        setPick(b.dataset.ai); aiUi(); note(`מעכשיו השאלות ייפתחו ב-${AI[b.dataset.ai].name}`);
      });
      sheet.querySelector('header')?.after(seg);
    }
    if (!pick) {
      pick = document.createElement('div'); pick.id = 'ui2m-ai-pick'; pick.className = 'u2m-ai-pick';
      pick.innerHTML = '<b>באיזה עוזר תרצה להשתמש?</b><p>אפשר להחליף בכל רגע.<br>בפעם הראשונה תתבקש להתחבר אליו — ומאז זה נשמר.</p>' +
        '<button type="button" data-ai="claude" class="c">Claude</button><button type="button" data-ai="chatgpt" class="g">ChatGPT</button>';
      pick.addEventListener('click', e => { const b = e.target.closest('[data-ai]'); if (!b) return; setPick(b.dataset.ai); aiUi(); $('ui2m-plate')?.focus(); });
      sheet.appendChild(pick);
    }
    const cur = getPick();
    pick.hidden = !!cur;
    seg.querySelectorAll('[data-ai]').forEach(b => { const on = b.dataset.ai === cur; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
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
    const me = who();
    if (me !== owner) { owner = me; cards.clear(); shownFor = ''; idCtrl?.abort(); }
    aiUi();
    const inp = $('ui2m-plate'); if (!inp) return;
    const plate = inp.value.replace(/\D/g, '');
    if (plate === shownFor) return;
    shownFor = plate;
    paint();
    if (/^\d{7,8}$/.test(plate) && !cards.has(plate)) identify(plate);
  }, 400);
})();
