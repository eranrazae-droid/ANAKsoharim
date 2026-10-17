/* צ׳אט ה-AI של הטלפון — כל השיחה בתוך האפליקציה.
   מזהה את הרכב במשרד התחבורה ומציג כרטיס רכב, מצרף תמונות וסרטונים, ושולח
   את השאלה לשרת (vehicleAI → Gemini במסלול החינמי). המפתח בשרת בלבד. */
(function () {
  'use strict';
  const URL_AI = 'https://europe-west1-anak-soharim.cloudfunctions.net/vehicleAI';
  const cards = new Map();   // רישוי -> כרטיס (או null כשלא נמצא) — רק לזמן העבודה הנוכחי
  let shownFor = '', idCtrl = null, owner = '';

  const who = () => (typeof currentUser !== 'undefined' && currentUser?.name) || '';
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

  /* ── שאלה: נשלחת לשרת (Gemini, מסלול חינמי) והתשובה מוצגת כאן בתוך האפליקציה ── */
  let pending = [];   // קבצים שצורפו לשאלה הבאה: { mime, data(base64), url(תצוגה) }
  async function ask({ plate, message, history, signal }) {
    const media = pending; pending = []; paintPending();
    // ההקשר לשאלת המשך נלקח מהשיחה השמורה (גם אחרי פתיחה מההיסטוריה)
    if (!session || session.plate !== plate) startSession(plate);
    history = session.msgs.map(m => ({ role: m.role, content: m.content }));
    logMsg({ role: 'user', content: message || '(תמונה / סרטון)', media: media.length });
    if (media.length) showSent(media);
    const dots = typing();
    let status, j;
    try { ({ status, j } = await call({ action: 'ask', plate, message, history, media: media.map(m => ({ mime: m.mime, data: m.data })) }, signal, 115000)); }
    finally { dots.remove(); }
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (status === 429 && j.detail) console.warn('AI limit:', j.detail);
    if (j.vehicle) { cards.set(plate, j.vehicle); paint(); }
    if (status === 503) return { answer: 'שירות ה-AI עוד לא הוגדר בשרת. פנה למנהל המערכת.', sources: [] };
    if (status === 429) return { answer: j.answer || 'הגעת למגבלת השאלות היומית. אפשר להמשיך מחר.', sources: [] };
    if (status === 413) return { answer: 'הקבצים גדולים מדי. נסה סרטון קצר יותר או פחות תמונות.', sources: [] };
    if (status !== 200 || typeof j.answer !== 'string') throw new Error('ai ' + status);
    setTimeout(() => { if (Array.isArray(j.media) && j.media.length) showMedia(j.media); const m = $('ui2m-messages'); if (m) m.lastElementChild?.scrollIntoView({ block: 'nearest' }); }, 60);
    const src = Array.isArray(j.sources) ? j.sources : [];
    logMsg({ role: 'assistant', content: j.answer, sources: src.slice(0, 6), media: (j.media || []).filter(x => x.type !== 'image') });
    return { answer: j.answer, sources: src };
  }

  /* תמונות וסרטונים שהעוזר מצרף לתשובה — מוצגים ומתנגנים בתוך השיחה */
  function showMedia(list) {
    const m = $('ui2m-messages'); if (!m) return;
    const box = document.createElement('div'); box.className = 'u2m-media';
    list.forEach(x => {
      if (x.type === 'youtube' && /^[\w-]{11}$/.test(x.id)) {
        const f = document.createElement('div'); f.className = 'u2m-yt';
        const ifr = document.createElement('iframe');
        ifr.src = 'https://www.youtube-nocookie.com/embed/' + x.id; ifr.title = x.title || 'סרטון';
        ifr.allow = 'encrypted-media; picture-in-picture; fullscreen'; ifr.allowFullscreen = true; ifr.loading = 'lazy';
        const cap = document.createElement('small'); cap.textContent = '▶ ' + (x.title || 'סרטון הדרכה');
        f.append(ifr, cap); box.appendChild(f);
      } else if (x.type === 'ytsearch' && /^https:\/\/www\.youtube\.com\//.test(x.url)) {
        const a = document.createElement('a'); a.className = 'u2m-ytsearch'; a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.textContent = '▶ סרטוני הדרכה ביוטיוב: ' + x.q; box.appendChild(a);
      } else if (x.type === 'image' && /^https:\/\//.test(x.src)) {
        const a = document.createElement('a'); a.className = 'u2m-img'; a.href = /^https:\/\//.test(x.page) ? x.page : x.src; a.target = '_blank'; a.rel = 'noopener noreferrer';
        const img = document.createElement('img'); img.src = x.src; img.alt = x.title || ''; img.loading = 'lazy';
        a.appendChild(img); box.appendChild(a);
      }
    });
    if (box.childElementCount) m.appendChild(box);
  }

  /* סימן "מקליד…" — שלוש נקודות בבועה עד שהתשובה מגיעה */
  function typing() {
    const m = $('ui2m-messages');
    const e = document.createElement('div'); e.className = 'u2m-message u2m-typing'; e.setAttribute('aria-label', 'העוזר מקליד');
    e.innerHTML = '<i></i><i></i><i></i>';
    if (m) { m.appendChild(e); e.scrollIntoView({ block: 'nearest' }); }
    return e;
  }

  /* ── צירוף תמונות וסרטונים ── */
  const MAX_VIDEO = 9 * 1024 * 1024;   // Gemini מקבל עד ~20MB לבקשה אחרי קידוד
  function toBase64(blob) {
    return new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = bad; r.readAsDataURL(blob); });
  }
  function shrink(file) {   // תמונה עד 1600 פיקסלים, JPEG — חוסך זמן ומקום
    return new Promise(ok => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => { URL.revokeObjectURL(url); ok(b || file); }, 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); ok(file); };
      img.src = url;
    });
  }
  async function addFiles(files) {
    const status = $('ui2m-chat-status');
    for (const f of [...files].slice(0, 4 - pending.length)) {
      try {
        if (f.type.startsWith('image/')) {
          const b = await shrink(f);
          pending.push({ mime: 'image/jpeg', data: await toBase64(b), url: URL.createObjectURL(b), kind: 'image' });
        } else if (f.type.startsWith('video/')) {
          if (f.size > MAX_VIDEO) { if (status) status.textContent = 'הסרטון ארוך מדי — עד כ-20 שניות (9MB). אפשר לצלם קטע קצר יותר.'; continue; }
          pending.push({ mime: f.type, data: await toBase64(f), url: URL.createObjectURL(f), kind: 'video' });
        }
      } catch (e) { if (status) status.textContent = 'לא הצלחתי לצרף את הקובץ.'; }
    }
    paintPending();
  }
  function paintPending() {
    const box = $('ui2m-attach-list'); if (!box) return;
    box.replaceChildren(...pending.map((m, i) => {
      const d = document.createElement('div'); d.className = 'u2m-att';
      const v = document.createElement(m.kind === 'video' ? 'video' : 'img'); v.src = m.url; if (m.kind === 'video') v.muted = true;
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'הסר קובץ');
      x.onclick = () => { pending.splice(i, 1); paintPending(); };
      d.append(v, x); return d;
    }));
    box.hidden = !pending.length;
  }
  function showSent(media) {   // הקבצים שנשלחו מוצגים בשיחה, מתחת לשאלה
    const m = $('ui2m-messages'); if (!m) return;
    const row = document.createElement('div'); row.className = 'u2m-sent-media';
    media.forEach(x => { const v = document.createElement(x.kind === 'video' ? 'video' : 'img'); v.src = x.url; if (x.kind === 'video') { v.controls = true; v.muted = true; } row.appendChild(v); });
    const mine = [...m.querySelectorAll('.u2m-mine')].pop();
    (mine ? mine.after(row) : m.appendChild(row));
  }
  /* ── היסטוריית שיחות: נשמרת בטלפון, לכל משתמש בנפרד (טקסט, מקורות וסרטונים) ── */
  let session = null;
  const histKey = () => 'anak_ai_hist:' + who();
  function loadHist() { try { return JSON.parse(localStorage.getItem(histKey()) || '[]'); } catch (e) { return []; } }
  function saveHist(list) {
    for (let n = Math.min(list.length, 40); n > 0; n -= 5) {   // אם אין מקום — שומרים פחות שיחות
      try { localStorage.setItem(histKey(), JSON.stringify(list.slice(0, n))); return; } catch (e) {}
    }
  }
  function startSession(plate) {
    session = { id: Date.now().toString(36), at: Date.now(), plate: plate || '', car: '', msgs: [] };
  }
  function logMsg(m) {
    if (!session) startSession('');
    const c = session.plate && cards.get(session.plate);
    if (c) session.car = [c.maker, c.model, c.year].filter(Boolean).join(' ');
    session.msgs.push({ ...m, content: String(m.content || '').slice(0, 4000) });
    session.at = Date.now();
    const list = loadHist().filter(x => x.id !== session.id);
    list.unshift(session); saveHist(list);
  }
  function newChat() {
    session = null;
    const ms = $('ui2m-messages'); if (ms) ms.replaceChildren();
    const pl = $('ui2m-plate'); if (pl) pl.value = '';
    pending = []; paintPending();
    closeHist(); $('ui2m-message')?.focus();
  }
  function bubble(text, mine) {
    const e = document.createElement('div'); e.className = 'u2m-message' + (mine ? ' u2m-mine' : ''); e.textContent = text; return e;
  }
  function openSession(id) {
    const s = loadHist().find(x => x.id === id); if (!s) return;
    session = s;
    const pl = $('ui2m-plate'); if (pl) pl.value = s.plate || '';
    const ms = $('ui2m-messages'); if (!ms) return;
    ms.replaceChildren();
    s.msgs.forEach(m => {
      ms.appendChild(bubble(m.content + (m.role === 'user' && m.media ? ' 📎' : ''), m.role === 'user'));
      (m.sources || []).forEach(x => {
        try { const u = new URL(x.url); if (u.protocol !== 'https:') return;
          const a = document.createElement('a'); a.href = u.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = String(x.title || u.hostname); ms.appendChild(a); } catch (e) {}
      });
      if (m.media && m.media.length) { showMedia(m.media); }
    });
    closeHist();
    ms.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }
  function closeHist() { const h = $('ui2m-hist'); if (h) h.hidden = true; }
  function openHist() {
    const h = $('ui2m-hist'); if (!h) return;
    const list = loadHist();
    const body = h.querySelector('.u2m-hist-list');
    body.replaceChildren(...(list.length ? list.map(x => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'u2m-hist-row'; b.dataset.id = x.id;
      const t = document.createElement('b'); t.textContent = (x.msgs.find(m => m.role === 'user')?.content || 'שיחה').slice(0, 70);
      const sub = document.createElement('small');
      sub.textContent = [x.plate && ('🚗 ' + (x.car || x.plate)), new Date(x.at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }),
        Math.ceil(x.msgs.length / 2) + ' שאלות'].filter(Boolean).join(' · ');
      b.append(t, sub); return b;
    }) : [Object.assign(document.createElement('p'), { textContent: 'עוד אין שיחות שמורות.' })]));
    const hd = document.querySelector('#ui2m-chat .u2m-chat-sheet > header');
    if (hd) h.style.top = (hd.offsetTop + hd.offsetHeight) + 'px';
    h.hidden = false;
  }
  function histUi() {
    const sheet = document.querySelector('#ui2m-chat .u2m-chat-sheet'); if (!sheet || $('ui2m-hist-btn')) return;
    const close = sheet.querySelector('header [data-u2m-action="close-chat"]');
    const mk = (id, txt, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'u2m-hbtn'; b.textContent = txt; b.setAttribute('aria-label', label); b.title = label; b.onclick = fn; return b; };
    close?.before(mk('ui2m-new-btn', '＋', 'שיחה חדשה', newChat), mk('ui2m-hist-btn', '🕘', 'היסטוריית שיחות', openHist));
    const h = document.createElement('div'); h.id = 'ui2m-hist'; h.className = 'u2m-hist'; h.hidden = true;
    h.innerHTML = '<div class="u2m-hist-head"><b>היסטוריית שיחות</b><button type="button" data-x aria-label="חזרה לשיחה">חזרה</button></div><div class="u2m-hist-list"></div>' +
      '<button type="button" class="u2m-hist-clear">מחיקת כל ההיסטוריה</button>';
    h.addEventListener('click', e => {
      if (e.target.closest('[data-x]')) return closeHist();
      if (e.target.closest('.u2m-hist-clear')) { if (confirm('למחוק את כל השיחות השמורות?')) { saveHist([]); session = null; openHist(); } return; }
      const row = e.target.closest('.u2m-hist-row'); if (row) openSession(row.dataset.id);
    });
    sheet.appendChild(h);
  }

  function aiUi() {
    histUi();
    const form = $('ui2m-chat-form'); if (!form || $('ui2m-attach')) return;
    const row = form.querySelector('div');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'ui2m-attach'; btn.className = 'u2m-attach-btn'; btn.textContent = '📷';
    btn.setAttribute('aria-label', 'צירוף תמונה או סרטון');
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*,video/*'; inp.multiple = true; inp.hidden = true;
    inp.onchange = () => { addFiles(inp.files); inp.value = ''; };
    btn.onclick = () => inp.click();
    row.prepend(btn, inp);
    const list = document.createElement('div'); list.id = 'ui2m-attach-list'; list.className = 'u2m-attach-list'; list.hidden = true;
    form.prepend(list);
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
    if (me !== owner) { owner = me; cards.clear(); shownFor = ''; idCtrl?.abort(); pending = []; paintPending(); session = null; closeHist(); }
    aiUi();
    const inp = $('ui2m-plate'); if (!inp) return;
    const plate = inp.value.replace(/\D/g, '');
    if (plate === shownFor) return;
    shownFor = plate;
    paint();
    if (/^\d{7,8}$/.test(plate) && !cards.has(plate)) identify(plate);
  }, 400);
})();
