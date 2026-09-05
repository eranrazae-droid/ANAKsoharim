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

function openTowInvoice() {
  _towInv = null;
  const f = document.getElementById('tow-inv-file'); if (f) f.value = '';
  _towSet('tow-inv-status', '');
  _towSet('tow-inv-summary', '');
  _towSet('tow-inv-rows', '');
  const lbl = document.getElementById('tow-inv-label');
  if (lbl) lbl.value = _towDefaultLabel();
  const save = document.getElementById('tow-inv-save');
  if (save) save.style.display = 'none';
  closeModal('modal-pickup-actions');
  openModal('modal-tow-invoice');
}
window.openTowInvoice = openTowInvoice;

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

    worker = await Tesseract.createWorker('eng', 1);
    await worker.setParameters({ tessedit_pageseg_mode: '4', tessedit_char_whitelist: '0123456789-/' });

    let text = '';
    for (let i = 0; i < imgs.length; i++) {
      _towSet('tow-inv-status', `⏳ קורא עמוד ${i + 1} מתוך ${imgs.length}...`);
      const prep = await _prepRegion(imgs[i], null, 2);
      text += '\n' + (await worker.recognize(prep)).data.text;
    }

    _towSet('tow-inv-status', '⏳ מצליב מול המערכת...');
    const runs = _towPlateCandidates(text);
    if (!runs.length) {
      _towSet('tow-inv-status', '<span style="color:#dc2626">לא נמצאו מספרי רכב בקובץ. ודא שזו החשבונית ושהסריקה ברורה.</span>');
      return;
    }
    _towInv = { label: (document.getElementById('tow-inv-label')?.value || '').trim(), rows: [] };
    for (const r of runs) _towInv.rows.push(await _towResolve(r));
    await _towRender();
  } catch (e) {
    console.error('tow invoice', e);
    _towSet('tow-inv-status', `<span style="color:#dc2626">קריאת הקובץ נכשלה: ${esc(e.message || e)}</span>`);
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

  let sum = box('#0f766e', 'var(--surface2)', `📄 נקראו ${rows.length} רכבים מהחשבונית`,
    `<div style="font-size:12.5px;color:var(--muted)">השווה את המספר הזה לסך הרכבים שכתוב בחשבונית. אם הוא נמוך — הוסף למטה את מה שחסר.</div>`);

  sum += missing.length
    ? box('#dc2626', '#fef2f2', `🔴 ${missing.length} רכבים בחשבונית שלא נמצאו אצלנו באיסוף`,
        `<div style="font-size:12.5px;color:#7f1d1d">אלה הרכבים לבדיקה מול הגרר — לא מצאנו שהם עברו אצלנו.</div>`)
    : box('#16a34a', '#f0fdf4', '✅ כל הרכבים בחשבונית נמצאו אצלנו באיסוף', '');

  if (dups.size) {
    sum += box('#b45309', '#fffbeb', `⚠️ ${dups.size} רכבים כבר הופיעו בחשבונית קודמת`,
      `<div style="font-size:12.5px;color:#78350f">בדוק שאינך משלם פעמיים על אותה גרירה.</div>`);
  }
  _towSet('tow-inv-summary', sum);

  _towSet('tow-inv-rows', rows.map((r, i) => {
    const dup = dups.get(r.plate);
    const border = !r.found ? '#dc2626' : dup ? '#b45309' : 'var(--border)';
    const tag = !r.found
      ? '<span style="background:#dc2626;color:#fff;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:900">לא נמצא אצלנו</span>'
      : `<span style="background:#16a34a;color:#fff;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:900">${esc(r.src)}</span>`;
    const dupTag = dup
      ? `<span style="background:#b45309;color:#fff;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:900;margin-right:5px">כבר חויב · ${esc(dup)}</span>` : '';
    return `<div style="border:2px solid ${border};border-radius:12px;padding:9px 11px;margin-bottom:7px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-weight:900;font-size:16px;direction:ltr">${_towFmt(r.plate)}</span>
      <span style="flex:1;min-width:120px;font-size:12.5px;color:var(--muted)">${esc(r.desc || '—')}</span>
      ${dupTag}${tag}
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
    closeModal('modal-tow-invoice');
  } catch (e) {
    console.error('tow invoice save', e);
    showToast('השמירה נכשלה: ' + (e.code || e.message), 6000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 שמור את החשבונית'; }
  }
}
window.towInvSave = towInvSave;
