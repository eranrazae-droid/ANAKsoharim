/* ── הצלבת חשבונית הגרר ─────────────────────────────────────────────
   פעם בחודש מגיעה חשבונית מהגרר עם מספרי הרכב שנגררו. המסך הזה קורא
   אותה, מצליב מול הרכבים שעברו אצלנו באיסוף, ומתריע על רכב שכבר
   חויב בחשבונית של חודש קודם.

   למה דווקא סריקת ספרות: מספרי הרישוי מודפסים בתוך שורות בעברית,
   וכיוון הכתיבה מימין לשמאל הופך חלק מהם על המסך. סריקה שמכירה רק
   ספרות ומקפים מתעלמת מהעברית לגמרי, ולכן מחזירה את המספר בסדר
   הנכון גם בשורות האלה. נבדק מול חשבונית אמיתית: 30 מתוך 30.        */

const _TOW_INV_COL = 'tow_invoices';
let _towInv = null;   // { rows:[{plate,cands,raw,found,src,desc}], label, note }

/* ההצלבה יושבת בתוך מסך האיסוף ולא בחלונית קופצת, כדי שאפשר
   יהיה לבדוק רכב בארכיון שמתחת בלי לאבד את מה שנקרא. היא נסגרת
   רק בשמירה או בלחיצה על ✕ — יציאה מהמסך וחזרה ממשיכה מאותה נקודה. */
/* החשבוניות שנשמרו — שורה לכל חודש, ולחיצה פותחת את רשימת
   הרכבים של אותה חשבונית. זה גם המקור של התג "כבר חויב" בהצלבה. */
let _towSaved = [];
let _towSavedOpen = '';

function _towListenSaved() {
  _reSnapReset('towInv');
  _reSnap('towInv', _colRef(_TOW_INV_COL), snap => {
    _towSaved = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _towRenderSaved();
  }, err => console.error('tow invoices listen', err));
}

function towSavedToggle(id) {
  _towSavedOpen = (_towSavedOpen === id) ? '' : id;
  _towRenderSaved();
}
window.towSavedToggle = towSavedToggle;

async function towSavedDelete(id) {
  const inv = _towSaved.find(x => x.id === id);
  if (!inv) return;
  if (!confirm(`למחוק את חשבונית ${inv.label || ''}? היא לא תסמן יותר רכבים כ"כבר חויב".`)) return;
  if (!_requireNet('מחיקת החשבונית')) return;
  try {
    const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(doc(window._db, _TOW_INV_COL, id));
    showToast('החשבונית נמחקה');
  } catch (e) {
    console.error('tow invoice delete', e);
    showToast('המחיקה נכשלה');
  }
}
window.towSavedDelete = towSavedDelete;

function _towRenderSaved() {
  const host = document.getElementById('tow-saved-list');
  const cnt = document.getElementById('tow-saved-count');
  if (!host) return;
  const rows = [..._towSaved].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (cnt) cnt.textContent = rows.length ? `(${rows.length})` : '';
  if (!rows.length) {
    host.innerHTML = '<div style="font-size:12.5px;color:var(--muted);font-weight:700">עדיין לא נשמרה אף חשבונית</div>';
    return;
  }
  host.innerHTML = rows.map(inv => {
    const open = _towSavedOpen === inv.id;
    const dt = inv.createdAt?.seconds
      ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) : '';
    const miss = (inv.missing || []).length;
    const plates = inv.plates || [];
    const missSet = new Set(inv.missing || []);
    const body = open ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:5px">${
      plates.map(p => `<span style="background:${missSet.has(p) ? '#fef2f2' : 'var(--surface2)'};color:${missSet.has(p) ? '#dc2626' : 'var(--text)'};border:1px solid ${missSet.has(p) ? '#fecaca' : 'var(--border)'};border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:800;direction:ltr">${_towFmt(p)}</span>`).join('')
      || '<span style="font-size:12px;color:var(--muted)">אין רכבים</span>'}</div>` : '';
    return `<div style="border:1.5px solid var(--border);border-radius:12px;padding:9px 11px;background:var(--surface2)">
      <div onclick="towSavedToggle('${esc(inv.id)}')" style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <span style="font-weight:900;font-size:14px;flex-shrink:0">${esc(inv.label || 'ללא חודש')}</span>
        <span style="font-size:12px;color:var(--muted);font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${
          inv.count || plates.length} רכבים${miss ? ` · <span style="color:#dc2626;font-weight:800">${miss} לא נמצאו</span>` : ''}${
          inv.createdBy ? ` · ${esc(inv.createdBy)}` : ''}${dt ? ` · ${dt}` : ''}</span>
        <span style="flex-shrink:0;font-size:12px;color:var(--muted)">${open ? '▲' : '▼'}</span>
        <button type="button" onclick="event.stopPropagation();towSavedDelete('${esc(inv.id)}')" title="מחיקת החשבונית"
          style="flex-shrink:0;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:3px 8px;font-size:12px;cursor:pointer">🗑️</button>
      </div>${body}
    </div>`;
  }).join('');
}

// עמוד נפרד: חוזרים למסך האיסוף. ההצלבה עצמה נשארת בזיכרון עד ✕ או שמירה
function _towLeave() {
  if (typeof openPickupScreen === 'function') openPickupScreen(); else showScreen('pickup');
}
function backFromTow() { _towLeave(); }
window.backFromTow = backFromTow;

function _towClear() {
  _towInv = null;
  const f = document.getElementById('tow-inv-file'); if (f) f.value = '';
  _towSet('tow-inv-status', '');
  _towSet('tow-inv-summary', '');
  _towSet('tow-inv-rows', '');
  const lbl = document.getElementById('tow-inv-label');
  if (lbl) lbl.value = _towDefaultLabel();
  const save = document.getElementById('tow-inv-save');
  if (save) save.style.display = 'none';
}

function openTowInvoice() {
  if (!_towInv) _towClear();            // הצלבה שכבר רצה — ממשיכים אותה, לא מאפסים
  closeModal('modal-pickup-actions');
  const badge = document.getElementById('tow-user-badge');
  if (badge) badge.textContent = currentUser?.name || '';
  showScreen('tow');                    // עמוד נפרד, רק להצלבה
  _towListenSaved();
  window.scrollTo(0, 0);
}
window.openTowInvoice = openTowInvoice;

function closeTowInvoice() {
  if (_towInv && _towInv.rows && _towInv.rows.length
      && !confirm('לסגור את ההצלבה? מה שנקרא מהחשבונית יימחק.')) return;
  _towClear();
  _reSnapReset('towInv');
  _towLeave();
}
window.closeTowInvoice = closeTowInvoice;

function _towSet(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }

function _towDefaultLabel() {
  // ברירת מחדל: החודש שעבר, כי החשבונית מגיעה בתחילת החודש העוקב
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/* רצף של ספרות עם שני מקפים. ה-OCR מדביק לקצוות ספרות שכנות (מספר
   הסעיף, הסכום), ולכן חותכים את הקצה החיצוני לפי אורך האמצע:
   אמצע בן 2 ספרות = 3-2-3, אמצע בן 3 = 2-3-2. כשהחשבונית מקצרת רכב
   בן 7 ספרות לתבנית של 8, נשמרת גם האפשרות הקצרה — ההצלבה מול
   הנתונים שלנו היא שתכריע איזו מהן נכונה. */
function _towPlateCandidates(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/\d+-\d+-\d+/g)) {
    const [a, b, c] = m[0].split('-');
    const cands = [];
    if (b.length === 2)      { cands.push(a.slice(-3) + b + c.slice(0, 3), a.slice(-3) + b + c.slice(0, 2)); }
    else if (b.length === 3) { cands.push(a.slice(-2) + b + c.slice(0, 2)); }
    const ok = [...new Set(cands)].filter(p => p.length === 7 || p.length === 8);
    if (ok.length) out.push({ raw: m[0], cands: ok });
  }
  return out;
}
window._towPlateCandidates = _towPlateCandidates;

/* ── קריאה מלאה: או שכל הרכבים נקראו, או שהתהליך נעצר ────────────────
   בחשבונית הגרר כל פריט נפתח בשורה "הובלת רכב …" או "הובלת N רכבים …", ומתחתיו
   (או באותה שורה) מספרי הרכבים. מזהים כל פריט, קוראים כמה רכבים הוא אמור להכיל,
   וסופרים כמה מספרים נקראו בפועל. פריט שהספירה בו לא מתאימה נקרא שוב מקרוב, ספרות בלבד.
   אם גם אז הספירה לא מתאימה — לא מציגים תוצאה חלקית, אלא הודעת שגיאה ועוצרים. */

// כותרת של פריט: מופיעה בה המילה "רכב/ים" ואחת ממילות ההובלה, ולא שורת "רכב: 08..." של העסקה
function _towIsItemHeader(t) {
  if (/ד?רכב\s*:/.test(t) || /עיסקה|פתיחה|שרותי|גרירה|חשבונית|לכבוד/.test(t)) return false;
  return /רכב/.test(t) && /הובל|הלת|הוגל|הובלוג|עבור|ראשל|מפ.ת|מגלילות|מירושלים/.test(t);
}
function _towExpected(t) {
  const m = t.match(/(\d+)\s*רכבים/);
  return m ? Number(m[1]) : 1;
}
// מועמדי מספר מתוך טקסט של פריט: דבוק לפי מקפים, או רצף ספרות של 7–8; רצף ארוך יותר נבדק לפי הסיומת (7 או 8 ספרות)
function _towItemPlates(text) {
  const out = [];
  const dashed = [...String(text).matchAll(/\d+-\d+-\d+/g)];
  for (const m of dashed) out.push(..._towPlateCandidates(m[0]));
  const rest = String(text).replace(/\d+-\d+-\d+/g, ' ');
  for (const tok of rest.split(/[^\d]+/)) {
    if (tok.length === 7 || tok.length === 8) out.push({ raw: tok, cands: [tok] });
    else if (tok.length > 8 && tok.length <= 12) out.push({ raw: tok, cands: [...new Set([tok.slice(-8), tok.slice(-7)])] });
  }
  return out;
}

async function _towReadFull(imgs, worker, setStatus) {
  let engWorker = null;
  const items = [];
  try {
    for (let pi = 0; pi < imgs.length; pi++) {
      setStatus(`⏳ קורא עמוד ${pi + 1} מתוך ${imgs.length}...`);
      const im = await _loadImg(imgs[pi]);
      const { data } = await worker.recognize(imgs[pi]);
      const lines = (data.lines || []).map(l => ({ t: String(l.text || '').replace(/\s+/g, ' ').trim(), b: l.bbox })).filter(l => l.t);
      let cur = null;
      const close = () => { if (cur) { items.push(cur); cur = null; } };
      for (const l of lines) {
        if (_towIsItemHeader(l.t)) {
          close();
          cur = { page: pi, img: im, src: imgs[pi], expect: _towExpected(l.t), text: l.t, lines: [l], y0: l.b.y0, y1: l.b.y1, W: im.width, H: im.height };
        } else if (cur && /פתיחה|עיסקה|סה.כ|ילכ/.test(l.t)) {
          close();
        } else if (cur) {
          cur.text += ' \n' + l.t; cur.lines.push(l); cur.y1 = Math.max(cur.y1, l.b.y1);
        }
      }
      close();
    }
    if (!items.length) return { legacy: true };

    // מספר תקף: קיים אצלנו, או קיים במרשם הרכב. בלי רשת אי אפשר לאמת — לא פוסלים
    const validRun = async run => {
      const ours = _towOurPlates();
      for (const p of run.cands) if (ours.has(p)) return true;
      let unknown = !!window._plateRegistryEmpty;
      for (const p of run.cands) {
        try { if (await _plateLookup(p)) return true; } catch (e) { unknown = true; }
      }
      return unknown;
    };
    const good = async (rs, expect) => rs.length === expect && (await Promise.all(rs.map(validRun))).every(Boolean);

    // ניסיונות קריאה חוזרים של פריט, כל שורה לחוד: ספרות בלבד, ואחר כך עברית+ספרות, ברזולוציות שונות
    const attempts = [['dig', 2], ['heb', 2], ['dig', 3], ['heb', 3]];
    const reread = async (it, kind, scale) => {
      let w = worker;
      if (kind === 'dig') {
        if (!engWorker) engWorker = await Tesseract.createWorker('eng', 1);
        w = engWorker;
        await w.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789,-' });
      } else await w.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '' });
      let txt = '';
      for (const l of it.lines) {
        const pad = 8;
        const box = { x0: 0, x1: 1, y0: Math.max(0, (l.b.y0 - pad) / it.H), y1: Math.min(1, (l.b.y1 + pad) / it.H) };
        txt += ' \n' + (await w.recognize(await _prepRegion(it.src, box, scale))).data.text;
      }
      await worker.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: '' });
      return txt;
    };

    const failed = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let runs = _towItemPlates(it.text);
      if (!(await good(runs, it.expect))) {
        setStatus(`⏳ בודק שוב פריט ${i + 1} מתוך ${items.length}...`);
        for (const [kind, scale] of attempts) {
          const alt = _towItemPlates(await reread(it, kind, scale));
          if (await good(alt, it.expect)) { runs = alt; break; }
        }
      }
      if (await good(runs, it.expect)) it.runs = runs;
      else {
        const oks = await Promise.all(runs.map(validRun));
        failed.push({ n: i + 1, expect: it.expect, got: runs.length, head: it.text.split('\n')[0].slice(0, 60),
          bad: runs.filter((_, k) => !oks[k]).map(r => r.raw) });
      }
    }
    return { items, failed };
  } finally {
    if (engWorker) { try { await engWorker.terminate(); } catch (e) {} }
  }
}

function _towFail(html) {
  _towInv = null;
  const save = document.getElementById('tow-inv-save'); if (save) save.style.display = 'none';
  _towSet('tow-inv-summary', ''); _towSet('tow-inv-rows', '');
  _towSet('tow-inv-status', `<div style="border:2px solid #dc2626;background:#fef2f2;border-radius:12px;padding:12px 14px;color:#7f1d1d;font-weight:800;line-height:1.6">
      <div style="font-size:15px;font-weight:900;color:#dc2626;margin-bottom:4px">⛔ ההצלבה נעצרה — לא כל הרכבים נקראו</div>${html}
      <div style="margin-top:8px;font-weight:700;font-size:12.5px">לא מוצגת תוצאה חלקית, כדי לא להסתמך על הצלבה שחסרים בה רכבים. סרוק שוב בקובץ ברור יותר, או בדוק את הקובץ ונסה שוב.</div></div>`);
  try { showToast('⛔ לא כל הרכבים נקראו — ההצלבה נעצרה', 8000); } catch (e) {}
}

async function towInvoiceFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!window.Tesseract) { _towSet('tow-inv-status', '<span style="color:#dc2626">מנוע הקריאה לא נטען. רענן את הדף ונסה שוב.</span>'); return; }
  _towSet('tow-inv-summary', ''); _towSet('tow-inv-rows', '');
  const save = document.getElementById('tow-inv-save'); if (save) save.style.display = 'none';

  let worker = null;
  try {
    _towSet('tow-inv-status', '⏳ פותח את הקובץ...');
    const imgs = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name)
      ? await _pdfFileToImages(file)
      : [await _fileToDataUrl(file)];

    const setStatus = t => _towSet('tow-inv-status', t);
    worker = await Tesseract.createWorker('heb+eng', 1);
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    const res = await _towReadFull(imgs, worker, setStatus);

    let runs;
    let expectedTotal = null;
    if (res.legacy) {
      // פורמט ישן: אין שורות "הובלת רכב" — קוראים מספרים עם מקפים, כמו שהיה. אין לנו ספירה לאימות
      await worker.terminate(); worker = await Tesseract.createWorker('eng', 1);
      await worker.setParameters({ tessedit_pageseg_mode: '4', tessedit_char_whitelist: '0123456789-/' });
      let text = '';
      for (let i = 0; i < imgs.length; i++) {
        setStatus(`⏳ קורא עמוד ${i + 1} מתוך ${imgs.length}...`);
        text += '\n' + (await worker.recognize(await _prepRegion(imgs[i], null, 2))).data.text;
      }
      runs = _towPlateCandidates(text);
      if (!runs.length) { _towFail('<div>לא נמצאו מספרי רכב בקובץ. ודא שזו חשבונית הגרר ושהסריקה ברורה.</div>'); return; }
    } else {
      expectedTotal = res.items.reduce((t, it) => t + it.expect, 0);
      if (res.failed.length) {
        const got = res.items.reduce((t, it) => t + (it.runs ? it.runs.length : 0), 0);
        _towFail(`<div>נקראו ${got} מתוך ${expectedTotal} רכבים שכתובים בחשבונית.</div><ul style="margin:6px 18px 0;padding:0;font-weight:700;font-size:12.5px">${
          res.failed.map(f => `<li>פריט ${f.n}: ${f.got === f.expect && f.bad.length
            ? `נקרא מספר שלא קיים במרשם הרכב (${f.bad.map(x => esc(x)).join(', ')}) — כנראה ספרה שנקראה לא נכון`
            : `צפויים ${f.expect} ${f.expect === 1 ? 'רכב' : 'רכבים'}, נקראו ${f.got}`} — ${esc(f.head)}</li>`).join('')}</ul>`);
        return;
      }
      runs = res.items.flatMap(it => it.runs);
    }
    setStatus('⏳ מצליב מול המערכת...');
    _towInv = { label: (document.getElementById('tow-inv-label')?.value || '').trim(), rows: [], expectedTotal };
    for (const r of runs) _towInv.rows.push(await _towResolve(r));
    await _towRender();
  } catch (e) {
    console.error('tow invoice', e);
    _towFail(`<div>קריאת הקובץ נכשלה: ${esc(e.message || e)}</div>`);
  } finally {
    if (worker) { try { await worker.terminate(); } catch (e) {} }
  }
}
window.towInvoiceFile = towInvoiceFile;

// מפת כל הרכבים שעברו אצלנו באיסוף — הפתוחים והארכיון גם יחד
function _towOurPlates() {
  const map = new Map();
  for (const c of (typeof _pickupAllCars !== 'undefined' ? _pickupAllCars : []))     map.set(_normPlate(c.plate), { where: 'ברשימת האיסוף', car: c });
  for (const c of (typeof _pickupArchiveCars !== 'undefined' ? _pickupArchiveCars : [])) if (!map.has(_normPlate(c.plate))) map.set(_normPlate(c.plate), { where: 'בארכיון האיסוף', car: c });
  return map;
}

/* מבין המועמדים של אותו מספר נבחר זה שקיים אצלנו; אם אף אחד לא קיים,
   נבחר זה שקיים במרשם הרכב; ואם גם זה לא — הראשון, ומסומן באדום. */
async function _towResolve(run) {
  const ours = _towOurPlates();
  for (const p of run.cands) {
    const hit = ours.get(p);
    if (hit) {
      const c = hit.car;
      return { plate: p, raw: run.raw, found: true, src: hit.where,
               ..._towWhoCollected(c),
               desc: [c.type, c.year, c.color].filter(Boolean).join(' · ') };
    }
  }
  for (const p of run.cands) {
    let rec = null;
    try { rec = await _plateLookup(p); } catch (e) { /* אין רשת — נמשיך בלי פרטי הרכב */ }
    if (rec) return { plate: p, raw: run.raw, found: false, src: '',
                      desc: [rec.maker, rec.model, rec.year, rec.color].filter(Boolean).join(' · ') };
  }
  return { plate: run.cands[0], raw: run.raw, found: false, src: '', desc: '' };
}

/* רכב שנמצא בארכיון לא בהכרח נאסף על ידי הגרר. לפעמים נהג שלנו
   נסע והביא אותו, ואז אין סיבה שהוא יופיע בחשבונית הגרר. שני סימנים
   מעידים על גרר: הרכב נשלח לגרר, או נכתב "גרר" בשדה מי אסף.
   בלי שניהם — זה רכב לבדיקה מול החשבונית. */
function _towWhoCollected(c) {
  const by = String(c.collectedByText || '').trim();
  const toTow = c.assignedDriver === _TOW_NAME || by.includes(_TOW_NAME);
  // רכב שעדיין ברשימת האיסוף עוד לא נאסף — אין מה לבדוק עליו
  if (!c.collectedAt) return { byTow: true, by: '' };
  return { byTow: toTow, by };
}

function _towFmt(p) {
  const d = String(p || '');
  return d.length === 8 ? `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`
       : d.length === 7 ? `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}` : d;
}

async function _towRender() {
  const rows = _towInv.rows;
  const missing = rows.filter(r => !r.found);
  const dups = await _towPastDuplicates(rows.map(r => r.plate));

  const box = (color, bg, title, body) =>
    `<div style="border:2px solid ${color};background:${bg};border-radius:12px;padding:10px 12px;margin-bottom:10px">
       <div style="font-weight:900;font-size:14px;color:${color};margin-bottom:4px">${title}</div>${body}</div>`;

  const notTow0 = rows.filter(r => r.found && r.byTow === false);
  const ok = rows.length - missing.length;
  const prevCounts = _towSaved.map(x => x.count || (x.plates || []).length).filter(Boolean);
  const avgPrev = prevCounts.length ? prevCounts.reduce((t, n) => t + n, 0) / prevCounts.length : 0;
  const few = avgPrev >= 5 && rows.length < avgPrev * 0.6;
  const stat = (n, label, color) => `<div style="flex:1;min-width:92px;text-align:center;border:1.5px solid ${color};border-radius:10px;padding:7px 4px">
      <div style="font-size:22px;font-weight:900;color:${color};line-height:1.1">${n}</div>
      <div style="font-size:11.5px;font-weight:800;color:var(--muted)">${label}</div></div>`;
  let sum = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      ${stat(rows.length, 'נקראו מהחשבונית', '#0f766e')}
      ${stat(ok, 'נמצאו אצלנו באיסוף', '#16a34a')}
      ${stat(missing.length, 'לא נמצאו אצלנו', missing.length ? '#dc2626' : '#9ca3af')}
      ${notTow0.length ? stat(notTow0.length, 'נאספו ע״י נהג שלנו', '#b45309') : ''}
      ${dups.size ? stat(dups.size, 'כבר חויבו בעבר', '#b45309') : ''}
    </div>`;
  if (_towInv.expectedTotal) sum += `<div style="font-size:12.5px;font-weight:800;color:#0f766e;margin:-4px 0 10px">✔ נקראו כל הרכבים שכתובים בחשבונית: ${rows.length} מתוך ${_towInv.expectedTotal}</div>`;
  // קריאה שפספסה: מעט מאוד רכבים לעומת חשבוניות קודמות
  if (few) {
    sum += box('#b45309', '#fffbeb', `⚠️ נקראו רק ${rows.length} רכבים — כנראה הקריאה פספסה`,
      `<div style="font-size:12.5px;color:#78350f">בחשבוניות קודמות היו בממוצע כ-${Math.round(avgPrev)} רכבים. סרוק שוב בקובץ ברור יותר, או הוסף ידנית עם ➕ למטה.</div>`);
  }
  sum += `<div style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-bottom:10px;padding:8px 10px;background:var(--surface2);border-radius:10px">
      <b>איך לקרוא:</b> כל שורה למטה היא רכב שכתוב בחשבונית הגרר.
      <span style="color:#16a34a;font-weight:800">ירוק</span> — הרכב נמצא אצלנו באיסוף (ברשימה או בארכיון), כלומר החיוב מוצדק.
      <span style="color:#dc2626;font-weight:800">אדום</span> — אין לנו תיעוד שאספנו אותו: בדוק מול הגרר לפני תשלום.
      <span style="color:#b45309;font-weight:800">כתום</span> — נאסף על ידי נהג שלנו, או שכבר חויב בחשבונית קודמת.
      השווה את "נקראו מהחשבונית" למספר הרכבים שכתוב בחשבונית עצמה; אם הוא נמוך — הוסף את החסרים עם ➕.
    </div>`;

  sum += missing.length
    ? box('#dc2626', '#fef2f2', `🔴 ${missing.length} רכבים בחשבונית שלא נמצאו אצלנו באיסוף`,
        `<div style="font-size:12.5px;color:#7f1d1d">אלה הרכבים לבדיקה מול הגרר — לא מצאנו שהם עברו אצלנו.</div>`)
    : box('#16a34a', '#f0fdf4', '✅ כל הרכבים שנקראו נמצאו אצלנו באיסוף', '');

  const notTow = rows.filter(r => r.found && r.byTow === false);
  if (notTow.length) {
    sum += box('#b45309', '#fffbeb', `🚩 ${notTow.length} רכבים נאספו על ידי נהג שלנו ולא על ידי הגרר`,
      `<div style="font-size:12.5px;color:#78350f">הם מסומנים למטה עם שם האוסף — בדוק למה הגרר מחייב עליהם.</div>`);
  }

  if (dups.size) {
    sum += box('#b45309', '#fffbeb', `⚠️ ${dups.size} רכבים כבר הופיעו בחשבונית קודמת`,
      `<div style="font-size:12.5px;color:#78350f">בדוק שאינך משלם פעמיים על אותה גרירה.</div>`);
  }
  _towSet('tow-inv-summary', sum);

  _towSet('tow-inv-rows', rows.map((r, i) => {
    const dup = dups.get(r.plate);
    const border = !r.found ? '#dc2626' : (dup || r.byTow === false) ? '#b45309' : 'var(--border)';
    const tag = !r.found
      ? '<span style="background:#dc2626;color:#fff;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:900">לא נמצא אצלנו</span>'
      : `<span style="background:#16a34a;color:#fff;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:900">${esc(r.src)}</span>`;
    const dupTag = dup
      ? `<span style="background:#b45309;color:#fff;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:900;margin-right:5px">כבר חויב · ${esc(dup)}</span>` : '';
    // נאסף אצלנו אבל לא על ידי הגרר — הערה עם שם מי שאסף בפועל
    const whoTag = (r.found && r.byTow === false)
      ? `<span style="background:#f59e0b;color:#fff;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:900;margin-right:5px">🚩 נאסף ע״י ${esc(r.by || 'נהג שלנו')}</span>` : '';
    return `<div style="border:2px solid ${border};border-radius:12px;padding:9px 11px;margin-bottom:7px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-weight:900;font-size:16px;direction:ltr">${_towFmt(r.plate)}</span>
      <span style="flex:1;min-width:120px;font-size:12.5px;color:var(--muted)">${esc(r.desc || '—')}</span>
      ${whoTag}${dupTag}${tag}
      <button onclick="towInvEdit(${i})" style="background:var(--surface2);border:1.5px solid var(--border);border-radius:9px;padding:4px 10px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer">✏️</button>
      <button onclick="towInvDrop(${i})" style="background:var(--surface2);border:1.5px solid var(--border);border-radius:9px;padding:4px 10px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer">🗑️</button>
    </div>`;
  }).join('') +
  `<button onclick="towInvAdd()" style="width:100%;margin-top:4px;background:var(--surface2);border:1.5px dashed var(--border);border-radius:10px;padding:9px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;color:var(--muted);cursor:pointer">➕ הוסף רכב שהקריאה פספסה</button>`);

  _towSet('tow-inv-status', '');
  const save = document.getElementById('tow-inv-save');
  if (save) save.style.display = '';
}

// כל הרכבים ששמורים בחשבוניות קודמות, ומאיזו חשבונית הם
async function _towPastDuplicates(plates) {
  const hit = new Map();
  if (!window._onSnap) return hit;
  const snaps = await new Promise(res => {
    let un = null;
    const t = setTimeout(() => { try { un && un(); } catch (e) {} res([]); }, 8000);
    try {
      un = _onSnap(_colRef(_TOW_INV_COL), s => {
        clearTimeout(t); try { un && un(); } catch (e) {}
        res(s.docs.map(d => ({ id: d.id, ...d.data() })));
      }, () => { clearTimeout(t); res([]); });
    } catch (e) { clearTimeout(t); res([]); }
  });
  const want = new Set(plates);
  for (const inv of snaps) {
    if (_towInv && inv.id === _towInv.savedId) continue;
    for (const p of (inv.plates || [])) if (want.has(p) && !hit.has(p)) hit.set(p, inv.label || '');
  }
  return hit;
}

function towInvEdit(i) {
  const r = _towInv?.rows[i]; if (!r) return;
  const v = prompt(`מספר הרכב כפי שמופיע בחשבונית (ספרות בלבד):`, r.plate);
  if (v === null) return;
  const p = String(v).replace(/\D/g, '');
  if (p.length !== 7 && p.length !== 8) { showToast('מספר רכב חייב להיות 7 או 8 ספרות', 4000); return; }
  _towReplace(i, p);
}
window.towInvEdit = towInvEdit;

function towInvDrop(i) {
  if (!_towInv?.rows[i]) return;
  _towInv.rows.splice(i, 1);
  _towRender();
}
window.towInvDrop = towInvDrop;

function towInvAdd() {
  const v = prompt('מספר הרכב שיש בחשבונית וחסר ברשימה (ספרות בלבד):', '');
  if (v === null) return;
  const p = String(v).replace(/\D/g, '');
  if (p.length !== 7 && p.length !== 8) { showToast('מספר רכב חייב להיות 7 או 8 ספרות', 4000); return; }
  _towInv.rows.push({ plate: p, raw: p, found: false, src: '', desc: '' });
  _towReplace(_towInv.rows.length - 1, p);
}
window.towInvAdd = towInvAdd;

async function _towReplace(i, plate) {
  _towSet('tow-inv-status', '⏳ בודק את הרכב...');
  _towInv.rows[i] = await _towResolve({ raw: _towInv.rows[i].raw, cands: [plate] });
  await _towRender();
}

async function towInvSave() {
  if (!_towInv || !_towInv.rows.length) return;
  const label = (document.getElementById('tow-inv-label')?.value || '').trim() || _towDefaultLabel();
  const btn = document.getElementById('tow-inv-save');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ שומר...'; }
  try {
    await _addDoc(_colRef(_TOW_INV_COL), {
      label,
      plates: _towInv.rows.map(r => r.plate),
      missing: _towInv.rows.filter(r => !r.found).map(r => r.plate),
      count: _towInv.rows.length,
      createdAt: _serverTs(),
      createdBy: currentUser?.name || '',
    });
    showToast(`✅ חשבונית ${label} נשמרה — ${_towInv.rows.length} רכבים`, 5000);
    _towClear();
    _reSnapReset('towInv');
    _towLeave();
  } catch (e) {
    console.error('tow invoice save', e);
    showToast('השמירה נכשלה: ' + (e.code || e.message), 6000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 שמור את החשבונית'; }
  }
}
window.towInvSave = towInvSave;
