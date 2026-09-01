/* קטלוג מצברים וקריאת לוחית מהמצלמה
   חלק 10 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
window.pcOpenCatalog = pcOpenCatalog;

/* ─── catalogue search guide ───────────────────────────
   Manufacturer catalogues are in English and name parts their own way — a
   tow-hook cover is filed as "CAP-REAR HOOK", not "cover". This maps the Hebrew
   name to the catalogue section and to the words worth typing there. */
const _PC_TERMS = [
  { he:'כיסוי וו גרירה אחורי', alt:['וו גרירה אחורי','כיסוי גרירה אחורי','פקק גרירה אחורי'],
    en:['CAP-REAR HOOK','COVER-TOWING HOOK','CAP REAR BUMPER'], sec:'Body → Rear Bumper',
    tip:'החלק מופיע בשרטוט הטמבון האחורי כעיגול/מכסה קטן בפינה. אצל חלק מהיצרנים הוא נקרא CAP ולא COVER — חפש את שניהם.' },
  { he:'כיסוי וו גרירה קדמי', alt:['וו גרירה קדמי','פקק גרירה קדמי'],
    en:['CAP-FRONT HOOK','COVER-TOW HOOK','CAP FRONT BUMPER'], sec:'Body → Front Bumper',
    tip:'אותו היגיון כמו מאחור, בשרטוט הטמבון הקדמי.' },
  { he:'משענת יד', alt:['משענת יד מרכזית','קונסולה משענת'],
    en:['ARMREST','ARM REST','CONSOLE ARMREST'], sec:'Interior Trim → Armrest & Visor / Console',
    tip:'משענת שבין המושבים נמצאת תחת Console; משענת בדלת נמצאת תחת Door Trim.' },
  { he:'סך שמש', alt:['סוכך שמש','מגן שמש'],
    en:['SUN VISOR','SUNVISOR'], sec:'Interior Trim → Armrest & Visor',
    tip:'שים לב אם הדגם עם מראה ותאורה — יש מק"ט שונה לגרסה עם מראה מוארת.' },
  { he:'כיסוי פנס ערפל', alt:['מכסה ערפל','אטם ערפל','כיסוי חור ערפל'],
    en:['COVER-FOG LAMP','CAP-FOG LAMP HOLE','COVER FRONT BUMPER FOG'], sec:'Body → Front Bumper',
    tip:'ברכב בלי ערפילים זה אטם עיוור — חפש BLANKING או COVER.' },
  { he:'פנס ערפל', alt:['ערפילית'], en:['FOG LAMP','FRONT FOG LAMP'], sec:'Electrical → Lamps', tip:'' },
  { he:'מראה חיצונית', alt:['מראת צד','מראה צד'],
    en:['OUTSIDE MIRROR','MIRROR ASSY-OUTSIDE REAR VIEW'], sec:'Body → Mirror',
    tip:'ודא צד — LH שמאל, RH ימין.' },
  { he:'כיסוי מראה', alt:['מכסה מראה','קונכייה מראה'],
    en:['COVER-OUTSIDE MIRROR','SCALP-OUTSIDE MIRROR','HOUSING MIRROR'], sec:'Body → Mirror',
    tip:'המונח SCALP נפוץ אצל היצרנים הקוריאניים.' },
  { he:'זכוכית מראה', alt:['ראי מראה'], en:['GLASS-OUTSIDE MIRROR','MIRROR GLASS'], sec:'Body → Mirror', tip:'' },
  { he:'ניקל', alt:['פס כרום','פס קישוט','ניקלים','גרניש'],
    en:['MOLDING','GARNISH','TRIM STRIP'], sec:'Body → Moulding / Garnish',
    tip:'GARNISH הוא המונח הנפוץ לפס קישוט חיצוני; MOLDING לפס לאורך הדלת או החלון.' },
  { he:'גריל', alt:['רשת קדמית','מסכה'], en:['RADIATOR GRILLE','FRONT GRILLE'], sec:'Body → Radiator Grille', tip:'' },
  { he:'ידית דלת חיצונית', alt:['ידית חיצונית','ידית פתיחה חיצונית'],
    en:['HANDLE-DOOR OUTSIDE','OUTSIDE HANDLE'], sec:'Body → Front Door / Rear Door',
    tip:'ודא צד, ואם הידית עם חיישן כניסה חכמה — יש מק"ט נפרד.' },
  { he:'ידית דלת פנימית', alt:['ידית פנימית'], en:['HANDLE-DOOR INSIDE','INSIDE HANDLE'], sec:'Interior Trim → Door Trim', tip:'' },
  { he:'ציפוי דלת', alt:['בטנה דלת','ריפוד דלת','פנל דלת'], en:['TRIM-DOOR','DOOR TRIM PANEL'], sec:'Interior Trim → Door Trim', tip:'' },
  { he:'טמבון קדמי', alt:['פגוש קדמי'], en:['BUMPER COVER FRONT','FRONT BUMPER'], sec:'Body → Front Bumper', tip:'' },
  { he:'טמבון אחורי', alt:['פגוש אחורי'], en:['BUMPER COVER REAR','REAR BUMPER'], sec:'Body → Rear Bumper', tip:'' },
  { he:'כיסוי מגב', alt:['מכסה זרוע מגב','פקק מגב'], en:['CAP-WIPER ARM','COVER WIPER'], sec:'Body → Windshield Wiper', tip:'' },
  { he:'מגב', alt:['להב מגב','זרוע מגב'], en:['WIPER BLADE','WIPER ARM'], sec:'Body → Windshield Wiper', tip:'' },
  { he:'פנס ראשי', alt:['פנס קדמי'], en:['HEAD LAMP','HEADLAMP ASSY'], sec:'Electrical → Lamps', tip:'ודא סוג תאורה — הלוגן או LED, המק"טים שונים.' },
  { he:'פנס אחורי', alt:['פנס אחורי ראשי'], en:['REAR COMBINATION LAMP','TAIL LAMP'], sec:'Electrical → Lamps', tip:'יש גרסה בדופן וגרסה בדלת התא — שתיהן בשרטוט.' },
  { he:'מכסה מנוע', alt:['קפוט'], en:['HOOD','BONNET'], sec:'Body → Hood', tip:'' },
  { he:'כנף', alt:['כנף קדמית','כנף אחורית'], en:['FENDER','QUARTER PANEL'], sec:'Body → Fender', tip:'' },
  { he:'מגן בוץ', alt:['מגן בוץ גלגל','בטנה גלגל'], en:['MUD GUARD','SPLASH SHIELD','FENDER LINER'], sec:'Body → Fender', tip:'' },
  { he:'צלחת גלגל', alt:['כיסוי גלגל','טאסה'], en:['WHEEL CAP','WHEEL COVER','CAP-WHEEL HUB'], sec:'Wheel & Tire', tip:'' },
  { he:'סמל', alt:['לוגו','אמבלם'], en:['EMBLEM','SYMBOL MARK'], sec:'Body → Emblem', tip:'' },
  { he:'ריפוד תא מטען', alt:['שטיח תא מטען','בטנה תא מטען'], en:['TRIM-LUGGAGE','COVER-LUGGAGE','TRUNK TRIM'], sec:'Interior Trim → Luggage Compartment', tip:'' },
  { he:'תפס', alt:['קליפס','מחזיק','פין'], en:['CLIP','RETAINER','FASTENER','GROMMET'], sec:'לפי המדור של החלק שהתפס מחזיק',
    tip:'תפסים לא מופיעים במדור נפרד — מצא את החלק עצמו בשרטוט, והתפס יופיע לידו עם מספר משלו.' },
  { he:'כיסוי בורג', alt:['פקק בורג','מכסה בורג'], en:['CAP-BOLT','COVER-SCREW','PLUG'], sec:'לפי מיקום החלק', tip:'' },
  { he:'מסילת גג', alt:['רכיב גג','ריל גג'], en:['ROOF RACK','ROOF RAIL'], sec:'Body → Roof', tip:'' },
  { he:'ספוילר', alt:['כנפון'], en:['SPOILER','REAR SPOILER'], sec:'Body → Roof / Rear', tip:'' },
  { he:'חיישן חניה', alt:['סנסור חניה','חיישן רוורס'], en:['SENSOR-ULTRASONIC','PARKING ASSIST SENSOR'], sec:'Electrical → Parking Assist',
    tip:'החיישן והטבעת שמסביבו הם שני מק"טים נפרדים.' },
  { he:'תושבת לוחית רישוי', alt:['מסגרת לוחית','בסיס לוחית רישוי'], en:['BRACKET-LICENSE PLATE','PLATE MOUNTING'], sec:'Body → Front Bumper / Rear Bumper', tip:'' },
  { he:'סף דלת', alt:['משקוף דלת','ספי דלתות'], en:['SIDE SILL','STEP TRIM','SCUFF PLATE'], sec:'Body → Side Sill', tip:'' },
  { he:'ידית הילוכים', alt:['כפתור הילוכים','ראש הילוכים'], en:['KNOB-GEAR SHIFT','SHIFT KNOB'], sec:'Interior Trim → Console', tip:'' },
  { he:'כיסוי מושב', alt:['ריפוד מושב'], en:['COVER-SEAT','SEAT COVER'], sec:'Seat', tip:'' },
];

function _pcNormHe(s) { return String(s || '').replace(/["'`׳״]/g, '').replace(/\s+/g, ' ').trim(); }

function _pcMatchTerms(qRaw) {
  const q = _pcNormHe(qRaw);
  if (q.length < 2) return [];
  const words = q.split(' ').filter(w => w.length >= 2);
  const scored = [];
  for (const t of _PC_TERMS) {
    const names = [t.he, ...(t.alt || [])].map(_pcNormHe);
    let score = 0;
    for (const n of names) {
      if (q === n) score = Math.max(score, 100);
      else if (q.includes(n) || n.includes(q)) score = Math.max(score, 60);
      else {
        // Partial match. A longer overlap must outrank a short exact phrase that
        // happens to sit inside the query — "כיסוי וו גרירה בטמבון אחורי" is the
        // hook cover, not the bumper. Short words count only as whole words, so
        // "יד" doesn't match "ידית".
        const nWords = n.split(' ');
        const hits = words.filter(w => nWords.includes(w) || (w.length >= 3 && n.includes(w))).length;
        if (hits) score = Math.max(score, hits * 20);
      }
    }
    if (score) scored.push({ t, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.t);
}

function pcGuideSearch() {
  const q = document.getElementById('pc-term').value;
  const box = document.getElementById('pc-guide');
  if (_pcNormHe(q).length < 2) { box.innerHTML = ''; return; }

  const hits = _pcMatchTerms(q);
  if (!hits.length) {
    box.innerHTML = `<div style="border:2px solid var(--border);border-radius:14px;padding:14px;background:var(--bg);font-size:13px;line-height:1.8;color:var(--text)">
      <div style="font-weight:800;margin-bottom:6px">לא מצאתי את החלק ברשימה</div>
      אתר את החלק בשרטוט לפי מיקומו ברכב במקום לחפש בשם: פתח את המדור המתאים (Body לחיצוני, Interior Trim לפנימי, Electrical לחשמל), ובחר את השרטוט של האזור — טמבון, דלת, מראה. כל חלק בשרטוט ממוספר, והמק"ט מופיע לצידו.
      <div style="margin-top:8px;color:var(--muted)">אם תגיד לי איזה חלק חיפשת, אוסיף אותו לרשימה.</div>
    </div>`;
    return;
  }

  box.innerHTML = hits.map((t, i) => `
    <div style="border:2px solid ${i===0?'var(--gold)':'var(--border)'};border-radius:14px;padding:14px;background:${i===0?'#fffaf0':'var(--card)'};margin-bottom:10px">
      <div style="font-weight:900;font-size:15px;margin-bottom:10px">${esc(t.he)}</div>
      <div style="font-size:12px;font-weight:700;color:var(--muted)">איפה בקטלוג</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:10px">${esc(t.sec)}</div>
      <div style="font-size:12px;font-weight:700;color:var(--muted)">מה להקליד בחיפוש</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px">
        ${t.en.map(w => `<button onclick="pcCopyTerm('${esc(w)}')" style="background:var(--bg);border:2px solid var(--border);border-radius:999px;padding:5px 11px;font-family:'Heebo',sans-serif;font-size:13px;font-weight:700;cursor:pointer;direction:ltr">${esc(w)} 📋</button>`).join('')}
      </div>
      ${t.tip ? `<div style="margin-top:10px;font-size:12px;color:var(--muted);line-height:1.7">💡 ${esc(t.tip)}</div>` : ''}
    </div>`).join('');
}

function pcCopyTerm(term) {
  _pcCopyFallback(term, () => showToast('📋 "' + term + '" הועתק — הדבק בחיפוש בקטלוג', 3000));
}

window.pcGuideSearch = pcGuideSearch;
window.pcCopyTerm = pcCopyTerm;

window.openInventoryScreen = openInventoryScreen;
window.handleInventoryFile = handleInventoryFile;
window.submitInventory = submitInventory;
window.openDriverInventoryScreen = openDriverInventoryScreen;
window.openDriverInvModal = openDriverInvModal;
window.dinvClick = dinvClick;
window.dinvMarkAll = dinvMarkAll;
window.submitDriverInv = submitDriverInv;

/* ══════════════════════════════════════════
   🔋 BATTERY CHECK
══════════════════════════════════════════ */
let _batteryHeaders = [];
let _batteryRows = [];  // [{cells:[...], battery:'', range:''}]
let _batteryUnsub = null;
let _batteryMode = 'live'; // 'live'=Firestore | 'preview'=new upload
let _batteryDocId = '';
let _batteryParsedFiles = [null, null];

function openBatteryScreen() {
  showScreen('battery');
  document.getElementById('battery-user-badge').textContent = currentUser.name;
  _batteryHeaders = [];
  _batteryRows = [];
  _batteryParsedFiles = [null, null];
  _batteryMode = 'live';
  _batteryDocId = '';
  document.getElementById('battery-table-wrap').innerHTML = '';
  document.getElementById('battery-submit-wrap').style.display = 'none';
  document.getElementById('batt-convert-wrap').style.display = 'none';
  document.getElementById('batt-file1-name').textContent = 'לחץ לבחירה';
  document.getElementById('batt-file2-name').textContent = 'לחץ לבחירה';
  ['batt-file1-zone','batt-file2-zone'].forEach(id => { const el = document.getElementById(id); if(el){el.style.borderColor='';el.style.background='transparent';} });
  _loadBatteryAssignments();
  _loadBatteryChargingTasks();
}

let _batteryChargingUnsub = null;
function _loadBatteryChargingTasks() {
  if (!window._CONFIG_DONE) return;
  if (_batteryChargingUnsub) _batteryChargingUnsub();
  const wrap = document.getElementById('battery-charging-tasks-wrap');
  _batteryChargingUnsub = _onSnap(_query(_colRef('charging_tasks'), _where('status','!=','deleted')), snap => {
    const visibleDocs = snap.docs.filter(d => d.data().status !== 'deleted');
    if (!visibleDocs.length) { wrap.innerHTML = ''; return; }
    let html = '';
    visibleDocs.forEach(d => {
      const data = d.data();
      const headers = data.headers || [];
      const cars = data.carsJson ? JSON.parse(data.carsJson) : [];
      // lowest battery % first (most urgent to charge); "מקדמה" status breaks ties
      const toCharge = cars.map((car,idx)=>({car,idx})).filter(x=>!x.car.charged).sort((a,b)=>{
        const ba = a.car.battery !== '' && a.car.battery != null ? parseInt(a.car.battery) : Infinity;
        const bb = b.car.battery !== '' && b.car.battery != null ? parseInt(b.car.battery) : Infinity;
        if (ba !== bb) return ba - bb;
        return (a.car.status==='מקדמה'?0:1)-(b.car.status==='מקדמה'?0:1);
      });
      const lowestToChargeBattery = toCharge.length
        ? Math.min(...toCharge.map(x => x.car.battery !== '' && x.car.battery != null ? parseInt(x.car.battery) : Infinity))
        : Infinity;
      const chargedFromList = cars.map((car,idx)=>({car,idx})).filter(x=> x.car.charged);
      const fullBatteryCars = data.fullBatteryCarsJson ? JSON.parse(data.fullBatteryCarsJson) : [];
      const charged = [
        ...fullBatteryCars.map(car => ({ car: { ...car, _full100: true }, idx: -1 })),
        ...chargedFromList,
      ];
      const ts = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('he-IL') : '';

      const baseCols = headers.length
        ? headers.map(h => {
            if (/דגם|יצרן/.test(h)) return 'minmax(80px,1.4fr)';
            if (/מספר|לוחית/.test(h)) return 'minmax(75px,1.2fr)';
            return 'minmax(60px,1fr)';
          })
        : ['1fr'];

      const colW        = [...baseCols, '58px', '80px'].join(' ');
      const colWCharged = [...baseCols, '60px', '72px'].join(' ');

      const headerRow = () => `<div style="display:grid;grid-template-columns:${colW};gap:3px;background:var(--dark);color:#fff;border-radius:10px 10px 0 0;padding:6px 8px;font-size:11px;font-weight:700;direction:rtl;min-width:max-content">
        ${headers.map(h=>`<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h)}</div>`).join('')}
        <div style="text-align:center;color:#86efac">אחוז<br>סוללה</div>
        <div style="text-align:center">פעולה</div>
      </div>`;

      const headerRowCharged = () => `<div style="display:grid;grid-template-columns:${colWCharged};gap:3px;background:var(--dark);color:#fff;border-radius:10px 10px 0 0;padding:6px 8px;font-size:11px;font-weight:700;direction:rtl;min-width:max-content">
        ${headers.map(h=>`<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h)}</div>`).join('')}
        <div style="text-align:center;color:#86efac">%<br>סוללה</div>
        <div style="text-align:center;color:#86efac">טווח<br>נסיעה</div>
      </div>`;

      const toChargeRow = ({car, idx}) => {
        const isMakdama = car.status === 'מקדמה';
        const isLowest = car.battery !== '' && car.battery != null && parseInt(car.battery) === lowestToChargeBattery;
        const bg     = isLowest ? '#cffafe' : (isMakdama ? '#fff1f2' : 'transparent');
        const border = isLowest ? '#06b6d4' : (isMakdama ? '#ef4444' : '#d1d5db');
        const btn = `<button onclick="markCarCharged('${d.id}',${idx})" style="background:#22c55e;color:#fff;border:none;border-radius:8px;padding:5px 10px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap">הוטען ✓</button>`;
        return `<div style="display:grid;grid-template-columns:${colW};gap:3px;align-items:center;background:${bg};border:1.5px solid ${border};border-top:none;padding:5px 8px;direction:rtl;min-width:max-content">
          ${car.cells.map((c,ci) => `<div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c)}${ci===0&&isMakdama?` <span style="font-size:9px;background:#ef4444;color:#fff;border-radius:4px;padding:1px 4px">מקדמה</span>`:''}</div>`).join('')}
          <div style="font-size:13px;font-weight:800;text-align:center;color:${isLowest?'#0e7490':'var(--dark)'}">${car.battery ? car.battery+'%' : '—'}</div>
          <div style="text-align:center">${btn}</div>
        </div>`;
      };

      const chargedRow = ({car}) => {
        return `<div style="display:grid;grid-template-columns:${colWCharged};gap:3px;align-items:center;background:#dcfce7;border:1.5px solid #22c55e;border-top:none;padding:5px 8px;direction:rtl;min-width:max-content">
          ${car.cells.map(c => `<div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c)}</div>`).join('')}
          <div style="font-size:13px;font-weight:800;text-align:center;color:#166534">${car.battery ? car.battery + '%' : '100%'}</div>
          <div style="font-size:13px;font-weight:800;text-align:center;color:#166534">${car.range ? car.range + ' קמ' : '—'}</div>
        </div>`;
      };

      html += `<div style="margin-bottom:24px">
        <div style="font-size:13px;font-weight:900;color:#5b21b6;margin-bottom:8px">🔌 משימת טעינה · ${ts} · נוצר ע"י ${esc(data.createdBy||'')}</div>`;

      if (toCharge.length) {
        html += `<div style="font-size:12px;font-weight:800;color:#374151;margin-bottom:4px">⚡ לטעינה — ${toCharge.length} רכבים</div>`;
        html += `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:12px">${headerRow()}${toCharge.map(x=>toChargeRow(x)).join('')}</div>`;
      }
      if (charged.length) {
        html += `<div style="font-size:12px;font-weight:800;color:#166534;margin-bottom:4px">✅ טעינה מלאה / הוטענו — ${charged.length} רכבים</div>`;
        html += `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">${headerRowCharged()}${charged.map(x=>chargedRow(x)).join('')}</div>`;
      }
      html += `</div>`;
    });
    wrap.innerHTML = html;
  });
}

let _battMgr = {};              // asgId → { headers, assignedTo, status, ts, rows:[{cells,battery,range,status}], convertedIdx:[] }
let _battMgrOrder = [];          // asgIds in display order
let _battSelected = new Set();   // "asgId:idx"
let _battSaveTimers = {};
let _battMgrLastEdit = 0;

function _loadBatteryAssignments() {
  if (!window._CONFIG_DONE) return;
  if (_batteryUnsub) _batteryUnsub();
  const wrap = document.getElementById('battery-table-wrap');
  wrap.innerHTML = '<div class="loading"><div class="spinner"></div> טוען...</div>';
  _batteryUnsub = _onSnap(_colRef('battery_assignments'), snap => {
    if (_batteryMode === 'preview') return;
    // don't blow away the manager's inputs mid-typing — but never DROP the
    // update either: hold it and re-apply once typing settles, otherwise a
    // driver's entry that lands in that window is lost until something else
    // changes on the server.
    if (Date.now() - _battMgrLastEdit < 2500) {
      clearTimeout(_battMgrPendingTimer);
      _battMgrPendingSnap = snap;
      _battMgrPendingTimer = setTimeout(() => {
        const s = _battMgrPendingSnap;
        _battMgrPendingSnap = null;
        if (s) _applyBatterySnapshot(s, wrap);
      }, 2600 - (Date.now() - _battMgrLastEdit));
      return;
    }
    _applyBatterySnapshot(snap, wrap);
  });
}
let _battMgrPendingSnap = null, _battMgrPendingTimer = null;

function _applyBatterySnapshot(snap, wrap) {
    const mine = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.sentBy === currentUser.name && !d.converted)
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
    if (!mine.length) {
      wrap.innerHTML = '<div class="empty-state" style="padding:40px 20px;text-align:center;color:var(--muted)">טרם נשלחה בדיקת טעינה</div>';
      _batteryDocId = '';
      _battMgr = {};
      document.getElementById('battery-submit-wrap').style.display = 'none';
      _updateConvertBar();
      return;
    }
    _batteryDocId = mine[mine.length - 1].id;
    _battMgr = {};
    for (const a of mine) {
      // resultsJson is the FINAL submitted snapshot; progressJson is what the
      // driver is typing right now. Only trust resultsJson once the check is
      // actually done — otherwise a stale resultsJson from a previous
      // submission hides every live entry the driver makes.
      const _live = a.progressJson ? JSON.parse(a.progressJson) : null;
      const _final = a.resultsJson ? JSON.parse(a.resultsJson) : null;
      const src = (a.status === 'done' ? (_final || _live) : (_live || _final))
        || (a.rowsJson ? JSON.parse(a.rowsJson) : []).map(r => ({ cells: Array.isArray(r) ? r : (r.cells || []), battery: '', range: '', status: (r && r.status) || '' }));
      _battMgr[a.id] = {
        headers: a.headers || [],
        assignedTo: a.assignedTo || '',
        status: a.status,
        ts: a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString('he-IL') : '',
        rows: src.map(r => ({ cells: r.cells || [], battery: r.battery ?? '', range: r.range ?? '', status: r.status || '' })),
        convertedIdx: a.convertedIdx || [],
      };
    }
    // drop selections that no longer exist
    for (const key of [..._battSelected]) {
      const [asg, idx] = key.split(':');
      if (!_battMgr[asg] || (_battMgr[asg].convertedIdx || []).includes(+idx)) _battSelected.delete(key);
    }
    _battMgrOrder = mine.map(a => a.id);
    wrap.innerHTML = _battMgrOrder.map(id => _renderBattMgrBlock(id)).join('');
    document.getElementById('battery-submit-wrap').style.display = 'none';
    _updateConvertBar();
}

function _rerenderBattMgrRight() {
  const wrap = document.getElementById('battery-table-wrap');
  if (!wrap) return;
  wrap.innerHTML = _battMgrOrder.map(id => _renderBattMgrBlock(id)).join('');
  _updateConvertBar();
}

function _renderBattMgrBlock(asgId) {
  const m = _battMgr[asgId];
  if (!m) return '';
  const conv = new Set(m.convertedIdx || []);
  const remaining = m.rows.filter((_, i) => !conv.has(i));
  const isDone = m.status === 'done';
  const filledCount = m.rows.filter(r => r.battery !== '' && r.range !== '').length;
  const statusLabel = isDone ? '✅ הושלמה' : `🔄 מולאו ${filledCount}/${m.rows.length}`;
  const bg = isDone ? '#f0fff4' : '#eff6ff', bd = isDone ? '#22c55e' : '#3b82f6', cl = isDone ? '#166534' : '#1e40af';
  let html = `<div style="margin-bottom:16px" data-batt-block="${asgId}"
      ondragover="_battDragOver(event,'${asgId}')" ondragleave="_battDragLeave(event)" ondrop="_battDrop(event,'${asgId}')">
    <div style="border-radius:10px;padding:8px 12px;margin-bottom:6px;font-size:12px;font-weight:700;background:${bg};border:2px solid ${bd};color:${cl}">🧑‍🔧 נהג: <b>${esc(m.assignedTo)}</b> · ${statusLabel} · ${m.ts} <span style="font-weight:500;opacity:.7">· ניתן לגרור רכב לנהג אחר</span></div>`;
  html += remaining.length ? _battMgrTableHTML(asgId, m.headers, m.rows, m.convertedIdx)
    : '<div style="text-align:center;color:var(--muted);font-size:13px;padding:14px">כל הרכבים הומרו למשימה ✓</div>';
  html += `</div>`;
  return html;
}

/* ── drag a car from one driver's battery check to another ───────────── */
let _battDrag = null;
function _battDragStart(ev, asgId, idx) {
  _battDrag = { asgId, idx };
  _battMgrLastEdit = Date.now(); // keep the live listener from re-rendering mid-drag
  try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', asgId + ':' + idx); } catch(e) {}
  ev.currentTarget.style.opacity = '0.4';
}
function _battDragEnd(ev) { ev.currentTarget.style.opacity = ''; _battDrag = null; }
function _battDragOver(ev, asgId) {
  if (!_battDrag || _battDrag.asgId === asgId) return; // same driver — nothing to do
  ev.preventDefault();
  try { ev.dataTransfer.dropEffect = 'move'; } catch(e) {}
  const b = ev.currentTarget;
  b.style.outline = '3px dashed #3b82f6';
  b.style.outlineOffset = '2px';
}
function _battDragLeave(ev) { ev.currentTarget.style.outline = ''; }

async function _battDrop(ev, dstAsg) {
  ev.preventDefault();
  ev.currentTarget.style.outline = '';
  const drag = _battDrag;
  _battDrag = null;
  if (!drag || drag.asgId === dstAsg) return;
  const src = _battMgr[drag.asgId], dst = _battMgr[dstAsg];
  if (!src || !dst || !src.rows[drag.idx]) return;

  const car = src.rows[drag.idx];
  const plate = (car.cells || [])[0] || 'הרכב';
  if (!confirm(`להעביר את ${plate} מ-${src.assignedTo} ל-${dst.assignedTo}?`)) return;

  // removing a row shifts every later index — remap convertedIdx accordingly
  src.rows = src.rows.filter((_, i) => i !== drag.idx);
  src.convertedIdx = (src.convertedIdx || [])
    .filter(ci => ci !== drag.idx)
    .map(ci => ci > drag.idx ? ci - 1 : ci);
  dst.rows = [...dst.rows, car];

  _battSelected.clear(); // indices moved — stale selections would point at the wrong cars
  _rerenderBattMgrRight();

  try {
    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const pack = m => JSON.stringify(m.rows.map(r => ({ cells: r.cells, battery: r.battery, range: r.range, status: r.status || '' })));
    // write to whichever field that doc is actually read from, so the move sticks
    const payloadFor = (id, m) => {
      const p = { progressJson: pack(m), convertedIdx: m.convertedIdx || [] };
      if (m.status === 'done') p.resultsJson = pack(m);
      return p;
    };
    await updateDoc(_docRef('battery_assignments', drag.asgId), payloadFor(drag.asgId, src));
    await updateDoc(_docRef('battery_assignments', dstAsg),   payloadFor(dstAsg, dst));
    showToast(`✅ ${plate} הועבר ל${dst.assignedTo}`);
  } catch(e) {
    console.error('battery drag move failed', e);
    showToast('שגיאה בהעברה: ' + (e.code || e.message));
  }
}
window._battDragStart = _battDragStart;
window._battDragEnd = _battDragEnd;
window._battDragOver = _battDragOver;
window._battDragLeave = _battDragLeave;
window._battDrop = _battDrop;

function _battMgrTableHTML(asgId, headers, rows, convertedIdx) {
  const conv = new Set(convertedIdx || []);
  const colCount = headers.length || (rows[0]?.cells.length || 1);
  const base = headers.length
    ? headers.map(h => /דגם/.test(h) ? 'minmax(90px,1.4fr)' : /מספר|לוחית/.test(h) ? 'minmax(80px,1.2fr)' : 'minmax(55px,1fr)')
    : Array(colCount).fill('1fr');
  const colW = [...base, '58px', '64px'].join(' ');
  let html = `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><div style="display:grid;grid-template-columns:${colW};gap:3px;background:var(--dark);color:#fff;border-radius:10px 10px 0 0;padding:6px 8px;font-size:11px;font-weight:700;direction:rtl;min-width:max-content">
    ${headers.map(h => `<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h)}</div>`).join('')}
    <div style="text-align:center;color:#86efac">אחוז<br>סוללה</div><div style="text-align:center;color:#86efac">טווח<br>נסיעה</div>
  </div>`;
  rows.forEach((row, idx) => {
    if (conv.has(idx)) return;
    const filled = row.battery !== '' && row.range !== '';
    html += `<div id="bm-${asgId}-${idx}" draggable="true" ondragstart="_battDragStart(event,'${asgId}',${idx})" ondragend="_battDragEnd(event)" style="display:grid;grid-template-columns:${colW};gap:3px;align-items:center;background:${filled ? '#f0fff4' : '#fff'};border:1.5px solid ${filled ? '#22c55e' : 'var(--border)'};border-top:none;padding:4px 6px;direction:rtl;min-width:max-content;cursor:grab">
      ${row.cells.map(c => `<div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c)}</div>`).join('')}
      <div><input type="number" min="0" max="100" value="${esc(row.battery)}" placeholder="%" onfocus="_battMgrLastEdit=Date.now()" oninput="_clampBatteryInput(this);_battMgrEdit('${asgId}',${idx},'battery',this.value)" style="width:100%;border:1.5px solid #22c55e;border-radius:6px;padding:4px 2px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;text-align:center;box-sizing:border-box;background:#f0fff4"></div>
      <div><input type="text" value="${esc(row.range)}" placeholder="קמ" onfocus="_battMgrLastEdit=Date.now()" oninput="_battMgrEdit('${asgId}',${idx},'range',this.value)" style="width:100%;border:1.5px solid #22c55e;border-radius:6px;padding:4px 2px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;text-align:center;box-sizing:border-box;background:#f0fff4"></div>
    </div>`;
  });
  html += '</div>';
  return html;
}

function _battMgrEdit(asgId, idx, field, val) {
  _battMgrLastEdit = Date.now();
  const m = _battMgr[asgId]; if (!m || !m.rows[idx]) return;
  m.rows[idx][field] = val;
  const filled = m.rows[idx].battery !== '' && m.rows[idx].range !== '';
  const el = document.getElementById(`bm-${asgId}-${idx}`);
  if (el) {
    el.style.background = filled ? '#f0fff4' : '#fff';
    el.style.borderColor = filled ? '#22c55e' : 'var(--border)';
    const cb = el.querySelector('input[type=checkbox]');
    if (cb) { cb.disabled = !filled; if (!filled && cb.checked) { cb.checked = false; _battSelected.delete(asgId + ':' + idx); } }
  }
  _updateConvertBar();
  clearTimeout(_battSaveTimers[asgId]);
  _battSaveTimers[asgId] = setTimeout(async () => {
    try {
      const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await updateDoc(_docRef('battery_assignments', asgId), {
        progressJson: JSON.stringify(m.rows.map(r => ({ cells: r.cells, battery: r.battery || '', range: r.range || '', status: r.status || '' }))),
      });
    } catch(e) { console.error('battMgrEdit save', e); }
  }, 900);
}
window._battMgrEdit = _battMgrEdit;

function _battMgrToggle(asgId, idx, checked) {
  const key = asgId + ':' + idx;
  if (checked) _battSelected.add(key); else _battSelected.delete(key);
  _updateConvertBar();
}
window._battMgrToggle = _battMgrToggle;

// rows eligible for conversion: the checked ones, or (if none checked) every
// filled, not-yet-converted row across all drivers
function _battConvertCandidates() {
  if (_battSelected.size) return [..._battSelected].map(k => { const [asg, idx] = k.split(':'); return { asg, idx: +idx }; });
  const out = [];
  for (const asg in _battMgr) {
    const m = _battMgr[asg]; const conv = new Set(m.convertedIdx || []);
    m.rows.forEach((r, idx) => { if (!conv.has(idx) && r.battery !== '' && r.range !== '') out.push({ asg, idx }); });
  }
  return out;
}
function _updateConvertBar() {
  const bar = document.getElementById('batt-convert-bar');
  const cnt = document.getElementById('batt-convert-count');
  const n = _battConvertCandidates().length;
  if (cnt) cnt.textContent = n;
  if (bar) bar.style.display = n > 0 ? 'block' : 'none';
}

async function convertSelectedBatteryToTask() {
  const candidates = _battConvertCandidates();
  if (!candidates.length) { showToast('אין רכבים עם אחוז סוללה וטווח נסיעה מלאים'); return; }
  const byAsg = {};
  for (const { asg, idx } of candidates) { (byAsg[asg] = byAsg[asg] || []).push(idx); }
  let headers = [];
  const toCharge = [], fullBattery = [];
  for (const asg in byAsg) {
    const m = _battMgr[asg]; if (!m) continue;
    if (!headers.length) headers = m.headers;
    for (const idx of byAsg[asg]) {
      const r = m.rows[idx]; if (!r) continue;
      const b = parseInt(r.battery);
      if (b === 100) fullBattery.push({ cells: r.cells, battery: r.battery || '', range: r.range || '', status: r.status || '' });
      else toCharge.push({ cells: r.cells, battery: r.battery || '', range: r.range || '', charged: false, status: r.status || '' });
    }
  }
  if (!toCharge.length && !fullBattery.length) { showToast('אין רכבים להמרה'); return; }
  try {
    const { addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, collection } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    // merge ALL active charging tasks + the new cars into ONE table (delete extras)
    const snap = await getDocs(query(collection(window._db, 'charging_tasks'), where('status', '==', 'active')));
    const docsArr = snap.docs.map(d => ({ id: d.id, data: d.data() }))
      .sort((a, b) => (a.data.createdAt?.toMillis?.() || 0) - (b.data.createdAt?.toMillis?.() || 0));
    let allCars = [], allFull = [], keepHeaders = headers;
    for (const dd of docsArr) {
      allCars.push(...(dd.data.carsJson ? JSON.parse(dd.data.carsJson) : []));
      allFull.push(...(dd.data.fullBatteryCarsJson ? JSON.parse(dd.data.fullBatteryCarsJson) : []));
      if (dd.data.headers && dd.data.headers.length) keepHeaders = dd.data.headers;
    }
    allCars.push(...toCharge);
    allFull.push(...fullBattery);
    if (docsArr.length) {
      await updateDoc(doc(window._db, 'charging_tasks', docsArr[0].id), {
        carsJson: JSON.stringify(allCars), fullBatteryCarsJson: JSON.stringify(allFull), headers: keepHeaders,
      });
      for (let i = 1; i < docsArr.length; i++) await deleteDoc(doc(window._db, 'charging_tasks', docsArr[i].id));
    } else {
      await addDoc(collection(window._db, 'charging_tasks'), {
        createdBy: currentUser.name, createdAt: _serverTs(), status: 'active',
        headers: keepHeaders, carsJson: JSON.stringify(allCars), fullBatteryCarsJson: JSON.stringify(allFull),
      });
    }
    for (const asg in byAsg) {
      const m = _battMgr[asg]; if (!m) continue;
      const merged = [...new Set([...(m.convertedIdx || []), ...byAsg[asg]])];
      m.convertedIdx = merged;
      await updateDoc(_docRef('battery_assignments', asg), { convertedIdx: merged });
    }
    _battSelected.clear();
    _battMgrLastEdit = 0; // allow the listener to re-render too
    _rerenderBattMgrRight(); // drop converted rows from the checks table immediately
    showToast(`✅ ${toCharge.length + fullBattery.length} רכבים הומרו למשימת טעינה`);
  } catch(e) { console.error('convertSelected', e); showToast('⚠️ שגיאה בהמרה'); }
}
window.convertSelectedBatteryToTask = convertSelectedBatteryToTask;


function handleBatteryFile(input, fileIndex) {
  const file = input.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    showToast('⏳ טוען ספריית Excel, נסה שוב...');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const nonEmpty = rows.map(r => r.map(c => String(c).trim())).filter(r => r.some(c => c !== ''));
      if (!nonEmpty.length) { showToast('הקובץ ריק'); return; }
      const firstRow = nonEmpty[0];
      let headers, dataRows;
      if (firstRow.some(v => /\d/.test(v))) {
        headers = [];
        dataRows = nonEmpty;
      } else {
        headers = firstRow;
        dataRows = nonEmpty.slice(1);
      }
      if (!dataRows.length) { showToast('לא נמצאו שורות בקובץ'); return; }
      _batteryParsedFiles[fileIndex] = { headers, dataRows, name: file.name };
      const nameEl = document.getElementById(fileIndex === 0 ? 'batt-file1-name' : 'batt-file2-name');
      if (nameEl) nameEl.textContent = `✅ ${file.name} (${dataRows.length} שורות)`;
      const zoneEl = document.getElementById(fileIndex === 0 ? 'batt-file1-zone' : 'batt-file2-zone');
      if (zoneEl) { zoneEl.style.borderColor = '#22c55e'; zoneEl.style.background = '#f0fff4'; }
      if (_batteryParsedFiles[0] || _batteryParsedFiles[1]) {
        document.getElementById('batt-convert-wrap').style.display = '';
      }
      _batteryMode = 'preview';
    } catch(err) {
      console.error('handleBatteryFile error', err);
      showToast('שגיאה בקריאת הקובץ: ' + (err.message || err));
    }
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
}

function mergeBatteryFiles() {
  const f1 = _batteryParsedFiles[0];
  const f2 = _batteryParsedFiles[1];
  if (!f1 && !f2) { showToast('⚠️ נא להעלות לפחות קובץ אחד'); return; }

  // columns to keep (in display order)
  const WANTED = [
    { label: 'מספר רישוי', pat: /מספר.?רישוי|לוחית/i },
    { label: 'שנת ייצור',  pat: /שנת|שנה/i },
    { label: 'יצרן',       pat: /יצרן/i },
    { label: 'דגם',        pat: /דגם/i },
    { label: 'סטטוס',      pat: /סטטוס/i },
  ];

  const ALLOWED_STATUSES = ['מגרש', 'מקדמה', 'לפרסם', 'לצלם'];

  const processFile = fd => {
    if (!fd) return [];
    // map each wanted col to its index in THIS file's headers
    const colIdxs = WANTED.map(w => fd.headers.findIndex(h => w.pat.test(h)));
    const statusColPos = 4; // סטטוס is always index 4 (last) in WANTED
    const statusIdx = colIdxs[4];
    const clean = s => String(s || '').replace(/[‎‏‪‫‬‭‮⁦⁧⁨⁩﻿]/g, '').replace(/\s+/g, ' ').trim();
    const hasStatusCol = typeof statusIdx === 'number' && statusIdx >= 0;
    return fd.dataRows
      .map(r => {
        const cells = colIdxs.map(ci => ci >= 0 ? clean(r[ci]) : '');
        // status is the last cell in our WANTED list (index statusColPos)
        const statusVal = cells[statusColPos] || '';
        return { cells, battery: '', range: '', status: statusVal };
      })
      .filter(row => {
        if (!hasStatusCol) return true;
        const pass = ALLOWED_STATUSES.some(s => row.status === s);
        if (!pass) console.log('🔋 filtered out:', JSON.stringify(row.status), [...row.status].map(c=>c.codePointAt(0).toString(16)));
        return pass;
      });
  };

  // determine display headers from first available file
  const refHdrs = (f1 || f2).headers;
  _batteryHeaders = WANTED
    .filter(w => refHdrs.some(h => w.pat.test(h)))
    .map(w => w.label);

  _batteryRows = [...processFile(f1), ...processFile(f2)];

  if (!_batteryRows.length) { showToast('לא נמצאו שורות בקובץ'); return; }
  renderBatteryTable();
  document.getElementById('batt-convert-wrap').style.display = 'none';
  document.getElementById('battery-submit-wrap').style.display = '';
}

// showBatteryCols=false → hides battery/range columns entirely (manager preview before send)
function _batteryTableHTML(headers, rows, editable, showBatteryCols = true, indexMap = null) {
  const colCount = headers.length || (rows[0]?.cells.length || 1);
  const COL_WIDTHS = {
    'מספר רישוי': '90px',
    'שנת ייצור':  '80px',
    'יצרן':       '90px',
    'דגם':        '140px',
    'סטטוס':      '80px',
  };
  const baseWidths = headers.length
    ? headers.map(h => COL_WIDTHS[h] || '80px')
    : Array(colCount).fill('80px');
  const colWidths = showBatteryCols ? [...baseWidths, '72px', '80px'] : baseWidths;
  const colW = colWidths.join(' ');
  let html = `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;display:block;width:fit-content;max-width:100%;margin:0 auto;direction:rtl">`;
  if (headers.length) {
    html += `<div style="display:grid;grid-template-columns:${colW};gap:3px;background:var(--dark);color:#fff;border-radius:10px 10px 0 0;padding:6px 8px;font-size:11px;font-weight:700;direction:rtl;min-width:max-content">
      ${headers.map(h => `<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h)}</div>`).join('')}
      ${showBatteryCols ? `<div style="text-align:center;color:#86efac">אחוזי<br>סוללה</div><div style="text-align:center;color:#86efac">טווח<br>נסיעה</div>` : ''}
    </div>`;
  }
  html += rows.map((row, i) => {
    const ri = indexMap ? indexMap[i] : i;
    const filled = row.battery !== '' || row.range !== '';
    const bg = filled ? '#f0fff4' : '#fff';
    const batteryCell = editable
      ? `<div><input type="number" min="0" max="100" value="${esc(row.battery)}" placeholder="%" oninput="_clampBatteryInput(this);batteryInputChange(${ri},'battery',this.value)" style="width:100%;border:1.5px solid #22c55e;border-radius:7px;padding:5px 4px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;text-align:center;outline:none;box-sizing:border-box;background:#f0fff4"></div>`
      : `<div style="font-size:13px;font-weight:800;text-align:center;color:${row.battery ? '#166534' : '#aaa'}">${row.battery ? row.battery + '%' : '—'}</div>`;
    const rangeCell = editable
      ? `<div><input type="text" value="${esc(row.range)}" placeholder="קמ" oninput="batteryInputChange(${ri},'range',this.value)" style="width:100%;border:1.5px solid #22c55e;border-radius:7px;padding:5px 4px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;text-align:center;outline:none;box-sizing:border-box;background:#f0fff4"></div>`
      : `<div style="font-size:13px;font-weight:800;text-align:center;color:${row.range ? '#166534' : '#aaa'}">${row.range ? row.range + ' קמ' : '—'}</div>`;
    return `<div id="batt-row-${ri}" style="display:grid;grid-template-columns:${colW};gap:3px;align-items:center;background:${bg};border:1.5px solid ${filled&&showBatteryCols?'#22c55e':'var(--border)'};border-top:none;padding:4px 6px;direction:rtl;min-width:max-content">
      ${row.cells.map(c => `<div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 0">${esc(c)}</div>`).join('')}
      ${showBatteryCols ? batteryCell + rangeCell : ''}
    </div>`;
  }).join('');
  html += '</div>';
  return html;
}

function renderBatteryTable() {
  // preview before send — columns visible but read-only
  document.getElementById('battery-table-wrap').innerHTML = _batteryTableHTML(_batteryHeaders, _batteryRows, false, true);
}

let _batteryEditDocId = '';
let _batteryEditSaveTimer = null;
function batteryInputChange(idx, field, val) {
  _batteryRows[idx][field] = val;
  const row = document.getElementById('batt-row-' + idx);
  if (row) row.style.background = val ? '#f0fff4' : '#fff';
  if (!_batteryEditDocId) return;
  clearTimeout(_batteryEditSaveTimer);
  _batteryEditSaveTimer = setTimeout(async () => {
    if (!window._CONFIG_DONE) return;
    try {
      const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await updateDoc(_docRef('battery_assignments', _batteryEditDocId), {
        progressJson: JSON.stringify(_batteryRows.map(r => ({ cells: r.cells, battery: r.battery || '', range: r.range || '', status: r.status || '' }))),
      });
    } catch(e) {}
  }, 1000);
}

async function clearBatteryTable() {
  if (!confirm('למחוק את כל הבדיקה ומשימות הטעינה?')) return;
  if (window._CONFIG_DONE) {
    try {
      const { deleteDoc, getDocs, query, where, collection } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const dels = [];
      // delete ALL battery assignments this manager sent (all drivers)
      const baSnap = await getDocs(collection(window._db, 'battery_assignments'));
      baSnap.forEach(d => { if (d.data().sentBy === currentUser.name) dels.push(deleteDoc(d.ref)); });
      // delete ALL charging tasks (active + done)
      const ctSnap = await getDocs(query(collection(window._db, 'charging_tasks'), where('status','!=','deleted')));
      ctSnap.forEach(d => dels.push(deleteDoc(d.ref)));
      await Promise.all(dels);
    } catch(e) { console.error('clearBattery', e); }
  }
  _batteryHeaders = [];
  _batteryRows = [];
  _batteryParsedFiles = [null, null];
  _batteryMode = 'live';
  _batteryDocId = '';
  document.getElementById('battery-table-wrap').innerHTML = '<div class="empty-state" style="padding:40px 20px;text-align:center;color:var(--muted)">טרם נשלחה בדיקת טעינה</div>';
  document.getElementById('battery-charging-tasks-wrap').innerHTML = '';
  document.getElementById('battery-submit-wrap').style.display = 'none';
  document.getElementById('batt-convert-wrap').style.display = 'none';
  document.getElementById('batt-file1-name').textContent = 'לחץ לבחירה';
  document.getElementById('batt-file2-name').textContent = 'לחץ לבחירה';
  ['batt-file1-zone','batt-file2-zone'].forEach(id => { const el = document.getElementById(id); if(el){el.style.borderColor='';el.style.background='transparent';} });
  showToast('🗑️ הבדיקה ומשימות הטעינה נמחקו');
}

async function submitBatteryAssignment() {
  if (!_batteryRows.length) { showToast('⚠️ נא להעלות קובץ'); return; }
  const drivers = [...document.querySelectorAll('.batt-drv:checked')].map(c => c.value);
  if (!drivers.length) { showToast('⚠️ נא לבחור נהג'); return; }
  if (!window._CONFIG_DONE) { showToast('Firebase לא מחובר'); return; }
  try {
    const { addDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    // even split — remainder goes to the first drivers
    const n = drivers.length, total = _batteryRows.length;
    const base = Math.floor(total / n), extra = total % n;
    const batchId = 'B' + Date.now();
    let cursor = 0, sent = 0;
    for (let i = 0; i < n; i++) {
      const count = base + (i < extra ? 1 : 0);
      const subset = _batteryRows.slice(cursor, cursor + count);
      cursor += count;
      if (!subset.length) continue;
      await addDoc(collection(window._db, 'battery_assignments'), {
        assignedTo: drivers[i],
        sentBy: currentUser.name,
        status: 'pending',
        headers: _batteryHeaders,
        rowsJson: JSON.stringify(subset.map(r => ({ cells: r.cells, status: r.status || '' }))),
        batchId,
        createdAt: _serverTs(),
      });
      _notifyDriver(drivers[i], `🔋 נשלחה אליך בדיקת טעינה חדשה (${subset.length} רכבים). כנס לאפליקציה ענק הרכבים.`);
      sent++;
    }
    showToast(`✅ נשלח ל-${sent} נהגים`);
    _batteryHeaders = [];
    _batteryRows = [];
    _batteryMode = 'live';
    document.getElementById('battery-submit-wrap').style.display = 'none';
    document.querySelectorAll('.batt-drv:checked').forEach(c => c.checked = false);
  } catch(e) {
    console.error('submitBatteryAssignment', e);
    showToast('⚠️ שגיאה בשמירה');
  }
}

/* ── Driver battery check ── */
let _dbattUnsub = null;
let _dbattDocId = null;
let _dbattHeaders = [];
let _dbattRows = [];  // [{cells, battery, range}]
let _dbattConvertedIdx = [];  // row indices converted to a charging task (hidden from the check)

let _dbattChargingUnsub = null;
function loadDriverBatteryCharging() {
  if (!window._CONFIG_DONE) return;
  if (_dbattChargingUnsub) _dbattChargingUnsub();
  const section = document.getElementById('dbattery-charging-section');
  const wrap = document.getElementById('dbattery-charging-wrap');
  _dbattChargingUnsub = _onSnap(_query(_colRef('charging_tasks'), _where('status','==','active')), snap => {
    if (!snap.size) { if (section) section.style.display = 'none'; return; }
    if (section) section.style.display = 'block';
    _renderChargingSnapshot(snap, wrap);
  });
}

function openDriverBatteryScreen() {
  showScreen('driver-battery');
  document.getElementById('dbattery-user-badge').textContent = currentUser.name;
  document.getElementById('dbattery-list').style.display = '';
  document.getElementById('dbattery-inline-wrap').style.display = 'none';
  loadDriverBatteryCharging();
  if (_dbattUnsub) _dbattUnsub();
  const container = document.getElementById('dbattery-list');
  container.innerHTML = '<div class="loading"><div class="spinner"></div> טוען...</div>';
  _dbattUnsub = _onSnap(_colRef('battery_assignments'), snap => {
    const docs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.assignedTo === currentUser.name && d.status === 'pending' && !d.converted);
    if (!docs.length) {
      container.innerHTML = '<div class="empty-state" style="padding:40px 20px;text-align:center;color:var(--muted)">אין בדיקות טעינה ממתינות 🔋</div>';
      return;
    }
    if (docs.length === 1) {
      const inlineOpen = document.getElementById('dbattery-inline-wrap').style.display !== 'none';
      const sameDoc = _dbattDocId === docs[0].id;
      if (!inlineOpen || !sameDoc) openDriverBatteryModal(docs[0].id);
      return;
    }
    container.innerHTML = docs.map(d => {
      const ts = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('he-IL') : '';
      const rowCount = d.rowsJson ? JSON.parse(d.rowsJson).length : (d.rows?.length || 0);
      return `<div class="vehicle-card" onclick="openDriverBatteryModal('${d.id}')" style="cursor:pointer;margin-bottom:12px">
        <div class="vehicle-plate" style="font-size:16px">🔋 בדיקת טעינה</div>
        <div class="vehicle-info">נשלח ע"י ${esc(d.sentBy||'')} · ${ts}</div>
        <div class="vehicle-meta"><span class="cond-badge" style="background:#dcfce7;color:#166534">${rowCount} רכבים לבדיקה</span></div>
      </div>`;
    }).join('');
  });
}

function openDriverBatteryModal(docId) {
  let firstLoad = true;
  _onSnap(_docRef('battery_assignments', docId), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    _dbattDocId = docId;
    _dbattHeaders = data.headers || [];
    const parsedRows = data.rowsJson ? JSON.parse(data.rowsJson) : (data.rows || []);
    const serverProgress = data.progressJson ? JSON.parse(data.progressJson) : null;
    const conv = data.convertedIdx || [];

    if (firstLoad) {
      const saved = localStorage.getItem('_dbattProgress_' + docId);
      const savedData = saved ? JSON.parse(saved) : null;
      _dbattRows = parsedRows.map((row, i) => ({
        cells:   Array.isArray(row) ? row : (row.cells || []),
        status:  Array.isArray(row) ? '' : (row.status || ''),
        battery: serverProgress?.[i]?.battery || savedData?.[i]?.battery || '',
        range:   serverProgress?.[i]?.range   || savedData?.[i]?.range   || '',
      }));
      _dbattConvertedIdx = conv;
      document.getElementById('dbattery-id').value = docId;
      document.getElementById('dbattery-notes').value = '';
      renderDriverBatteryModal();
      firstLoad = false;
      document.getElementById('dbattery-list').style.display = 'none';
      document.getElementById('dbattery-inline-wrap').style.display = '';
    } else if (conv.length !== _dbattConvertedIdx.length) {
      // manager converted some cars → drop them from the driver's check table
      _dbattConvertedIdx = conv;
      if (serverProgress) serverProgress.forEach((sp, i) => { if (_dbattRows[i]) { _dbattRows[i].battery = sp.battery || _dbattRows[i].battery; _dbattRows[i].range = sp.range || _dbattRows[i].range; } });
      renderDriverBatteryModal();
    } else if (serverProgress) {
      // Live sync: update inputs that aren't currently focused
      serverProgress.forEach((sp, i) => {
        if (!_dbattRows[i]) return;
        const rowEl = document.getElementById(`dbatt-row-${i}`);
        if (!rowEl) return;
        const numInputs = rowEl.querySelectorAll('input[type="number"]');
        const battEl = numInputs[0];
        const rngEl  = numInputs[1];
        if (battEl && document.activeElement !== battEl && sp.battery !== _dbattRows[i].battery) {
          _dbattRows[i].battery = sp.battery || '';
          battEl.value = sp.battery || '';
        }
        if (rngEl && document.activeElement !== rngEl && sp.range !== _dbattRows[i].range) {
          _dbattRows[i].range = sp.range || '';
          rngEl.value = sp.range || '';
        }
      });
    }
  });
}

function renderDriverBatteryModal() {
  const headers = _dbattHeaders;
  // card layout, 2 per row (the charging screen uses 1 per row — this form has
  // fewer fields per car so two fit comfortably on a phone).
  // NOTE: the live-sync code finds inputs via #dbatt-row-<i> and expects the
  // battery input first, range second — keep that order.
  const _convSet = new Set(_dbattConvertedIdx || []);
  const inp = (val, i, field, ph, extra) =>
    `<input type="number" inputmode="numeric" pattern="[0-9]*" min="0" ${extra} value="${esc(val)}" placeholder="${ph}"
      oninput="${field === 'battery' ? '_clampBatteryInput(this);' : ''}dbattInput(${i},'${field}',this.value)" onblur="_dbattFlush()"
      style="width:100%;border:1.5px solid #22c55e;border-radius:8px;padding:8px 4px;font-family:Heebo,sans-serif;font-size:16px;font-weight:800;text-align:center;outline:none;box-sizing:border-box;background:#f0fff4">`;

  const cards = _dbattRows.map((row, i) => {
    if (_convSet.has(i)) return '';
    const filled = row.battery !== '' || row.range !== '';
    const fields = headers.length
      ? headers.map((h, ci) => row.cells[ci]
          ? `<div style="display:flex;gap:4px;font-size:11px;line-height:1.5"><span style="color:var(--muted);font-weight:600">${esc(h)}:</span><span style="font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(row.cells[ci])}</span></div>`
          : '').join('')
      : row.cells.map(c => `<div style="font-size:12px;font-weight:800">${esc(c)}</div>`).join('');
    return `<div id="dbatt-row-${i}" style="background:${filled ? '#f0fff4' : '#fff'};border:2px solid ${filled?'#22c55e':'var(--border)'};border-radius:14px;padding:10px 12px;direction:rtl">
      <div style="display:flex;flex-direction:column;gap:2px;margin-bottom:10px;min-height:52px">${fields}</div>
      <div style="display:flex;gap:6px">
        <div style="flex:1">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-align:center;margin-bottom:3px">אחוז סוללה</div>
          ${inp(row.battery, i, 'battery', '%', 'max="100"')}
        </div>
        <div style="flex:1">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-align:center;margin-bottom:3px">טווח נסיעה</div>
          ${inp(row.range, i, 'range', 'קמ', '')}
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('dbattery-rows-container').innerHTML =
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${cards}</div>`;
}

function _clampBatteryInput(el) {
  let v = el.value;
  if (v === '' || v === '-') { el.value = ''; return; }
  if (v.length > 3) { el.value = '100'; return; }
  if (v.length === 3 && v !== '100') { el.value = v.slice(0, 2); return; }
  const n = parseInt(v);
  if (!isNaN(n)) el.value = Math.min(100, Math.max(0, n)); // 0% is a valid reading (empty battery)
}
let _dbattSaveTimer = null;
function dbattInput(idx, field, val) {
  _dbattRows[idx][field] = val;
  const row = document.getElementById('dbatt-row-' + idx);
  const filled = _dbattRows[idx].battery !== '' || _dbattRows[idx].range !== '';
  if (row) {
    row.style.background = filled ? '#f0fff4' : '#fff';
    row.style.border = `1.5px solid ${filled ? '#22c55e' : 'var(--border)'}`;
    row.style.borderTop = 'none';
  }
  try {
    localStorage.setItem('_dbattProgress_' + _dbattDocId, JSON.stringify(_dbattRows.map(r => ({ battery: r.battery, range: r.range }))));
  } catch(e) {}
  clearTimeout(_dbattSaveTimer);
  _dbattSaveTimer = setTimeout(async () => {
    if (!_dbattDocId || !window._CONFIG_DONE) return;
    try {
      const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await updateDoc(_docRef('battery_assignments', _dbattDocId), {
        progressJson: JSON.stringify(_dbattRows.map(r => ({ cells: r.cells, battery: r.battery, range: r.range, status: r.status || '' }))),
      });
    } catch(e) {}
  }, 600); // keep the manager's live view close to real-time
}

// save immediately (on blur / leaving the field) so nothing is lost on exit
async function _dbattFlush() {
  if (!_dbattDocId || !window._CONFIG_DONE) return;
  clearTimeout(_dbattSaveTimer);
  try {
    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(_docRef('battery_assignments', _dbattDocId), {
      progressJson: JSON.stringify(_dbattRows.map(r => ({ cells: r.cells, battery: r.battery, range: r.range, status: r.status || '' }))),
    });
  } catch(e) {}
}
window._dbattFlush = _dbattFlush;

async function submitDriverBattery() {
  // send whatever is filled — at least one car with both battery % and range
  const filled = _dbattRows.filter(r => r.battery !== '' && r.range !== '');
  if (!filled.length) {
    showToast('מלא לפחות רכב אחד — אחוז סוללה וטווח נסיעה');
    return;
  }
  if (!window._CONFIG_DONE) { showToast('Firebase לא מחובר'); return; }
  if (!_dbattDocId) { showToast('שגיאה: אין מסמך פתוח'); return; }
  try {
    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(_docRef('battery_assignments', _dbattDocId), {
      status: 'done',
      completedBy: currentUser.name,
      completedAt: _serverTs(),
      resultsJson: JSON.stringify(_dbattRows.map(r => ({ cells: r.cells, battery: r.battery, range: r.range, status: r.status || '' }))),
      notes: document.getElementById('dbattery-notes').value.trim(),
    });
    localStorage.removeItem('_dbattProgress_' + _dbattDocId);
    _dbattDocId = null;
    showToast('✅ בדיקת הטעינה נשלחה!');
    showScreen('driver-battery');
  } catch(e) {
    console.error('submitDriverBattery', e);
    showToast('⚠️ שגיאה בשמירה');
  }
}

window.openBatteryScreen = openBatteryScreen;
window.handleBatteryFile = handleBatteryFile;
window.mergeBatteryFiles = mergeBatteryFiles;
window.batteryInputChange = batteryInputChange;
window.clearBatteryTable = clearBatteryTable;
window.submitBatteryAssignment = submitBatteryAssignment;
window.openDriverBatteryScreen = openDriverBatteryScreen;
window.openDriverBatteryModal = openDriverBatteryModal;
window.dbattInput = dbattInput;
window.submitDriverBattery = submitDriverBattery;

/* ══════════════════════════════════════════
   🔌 CHARGING TASK (המר למשימה)
══════════════════════════════════════════ */
async function convertToChargingTask(batteryDocId) {
  if (!window._CONFIG_DONE) { showToast('Firebase לא מחובר'); return; }
  try {
    const { getDoc, addDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDoc(_docRef('battery_assignments', batteryDocId));
    if (!snap.exists()) { showToast('⚠️ לא נמצאה הבדיקה'); return; }
    const data = snap.data();
    // same rule as the manager's table: only a completed check may use the
    // final snapshot, otherwise the driver's live entries win
    const _lv = data.progressJson ? JSON.parse(data.progressJson) : null;
    const _fn = data.resultsJson ? JSON.parse(data.resultsJson) : null;
    const results = (data.status === 'done' ? (_fn || _lv) : (_lv || _fn)) || [];
    const headers = data.headers || [];
    // validate results exist and all rows have battery + range filled
    if (!results.length) { showToast('לא ניתן להמיר למשימת טעינה עד שכל הרכבים הושלמו.'); return; }
    const isMissing = v => v === '' || v === null || v === undefined;
    const missing = results.filter(r => isMissing(r.battery) || isMissing(r.range));
    if (missing.length) {
      showToast('לא ניתן להמיר למשימת טעינה עד שכל הרכבים הושלמו.');
      return;
    }
    const toCharge  = results.filter(r => { const b = parseInt(r.battery); return isNaN(b) || b < 100; })
      .map(r => ({ cells: r.cells, battery: r.battery || '', range: r.range || '', charged: false, status: r.status || '' }));
    const fullBattery = results.filter(r => parseInt(r.battery) === 100)
      .map(r => ({ cells: r.cells, battery: r.battery || '', range: r.range || '', status: r.status || '' }));
    if (!toCharge.length) { showToast('כל הרכבים בטעינה מלאה 🎉'); return; }
    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await addDoc(collection(window._db, 'charging_tasks'), {
      createdBy: currentUser.name,
      createdAt: _serverTs(),
      status: 'active',
      headers,
      carsJson: JSON.stringify(toCharge),
      fullBatteryCarsJson: JSON.stringify(fullBattery),
      fromBatteryId: batteryDocId,
    });
    await updateDoc(_docRef('battery_assignments', batteryDocId), { converted: true });
    showToast(`✅ נוצרה משימת טעינה עם ${toCharge.length} רכבים`);
  } catch(e) { console.error('convertToChargingTask', e); showToast('⚠️ שגיאה'); }
}

/* ── Driver charging task screen ── */
let _dchargingUnsub = null;

function openDriverChargingScreen() {
  showScreen('driver-charging');
  document.getElementById('dcharging-user-badge').textContent = currentUser.name;
  if (_dchargingUnsub) _dchargingUnsub();
  const container = document.getElementById('dcharging-list');
  container.innerHTML = '<div class="loading"><div class="spinner"></div> טוען...</div>';
  _dchargingUnsub = _onSnap(_query(_colRef('charging_tasks'), _where('status','==','active')), snap => _renderChargingSnapshot(snap, container));
}

function _renderChargingSnapshot(snap, container) {
    if (!container) return;
    if (!snap.size) {
      container.innerHTML = '<div class="empty-state" style="padding:40px 20px;text-align:center;color:var(--muted)">אין משימות טעינה פעילות 🔌</div>';
      return;
    }
    let html = '';
    snap.docs.forEach(d => {
      const data = d.data();
      const headers = data.headers || [];
      const cars = data.carsJson ? JSON.parse(data.carsJson) : [];
      // lowest battery % first (most urgent to charge); "מקדמה" status breaks ties
      const toCharge = cars.map((car,idx)=>({car,idx})).filter(x=>!x.car.charged).sort((a,b)=>{
        const ba = a.car.battery !== '' && a.car.battery != null ? parseInt(a.car.battery) : Infinity;
        const bb = b.car.battery !== '' && b.car.battery != null ? parseInt(b.car.battery) : Infinity;
        if (ba !== bb) return ba - bb;
        return (a.car.status==='מקדמה'?0:1)-(b.car.status==='מקדמה'?0:1);
      });
      const lowestToChargeBattery = toCharge.length
        ? Math.min(...toCharge.map(x => x.car.battery !== '' && x.car.battery != null ? parseInt(x.car.battery) : Infinity))
        : Infinity;
      const ts = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('he-IL') : '';

      // nothing left to charge in this task — don't leave an empty header
      if (!toCharge.length) return;

      // driver view = cards (easier on a phone). Cars with a full battery and
      // cars already charged are deliberately NOT shown to the driver — only
      // what's still left to do. The manager keeps the table view on desktop.
      const fieldPairs = (cells) => headers.length
        ? headers.map((h, i) => cells[i] ? `<div style="display:flex;gap:4px;font-size:12px"><span style="color:var(--muted);font-weight:600">${esc(h)}:</span><span style="font-weight:800">${esc(cells[i])}</span></div>` : '').join('')
        : cells.map(c => `<div style="font-size:12px;font-weight:800">${esc(c)}</div>`).join('');

      html += `<div style="margin-bottom:24px"><div style="font-size:13px;font-weight:900;color:#5b21b6;margin-bottom:8px">🔌 משימת טעינה · ${ts}</div>`;

      if (toCharge.length) {
        html += `<div style="font-size:12px;font-weight:800;color:#374151;margin-bottom:6px">⚡ לטעינה — ${toCharge.length} רכבים</div>`;
        html += `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">`;
        toCharge.forEach(({car,idx}) => {
          const isMakdama = car.status === 'מקדמה';
          const isLowest = car.battery !== '' && car.battery != null && parseInt(car.battery) === lowestToChargeBattery;
          const bg = isLowest ? '#cffafe' : (isMakdama ? '#fff1f2' : '#fff');
          const border = isLowest ? '#06b6d4' : (isMakdama ? '#ef4444' : 'var(--border)');
          html += `<div style="background:${bg};border:2px solid ${border};border-radius:14px;padding:12px 14px;direction:rtl">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
              <div style="font-size:20px;font-weight:900;color:${isLowest?'#0e7490':'var(--dark)'}">${car.battery !== '' && car.battery != null ? esc(String(car.battery))+'%' : '—'}</div>
              <div style="display:flex;gap:4px;align-items:center">
                ${isMakdama?`<span style="font-size:10px;background:#ef4444;color:#fff;border-radius:5px;padding:2px 6px;font-weight:800">מקדמה</span>`:''}
                ${isLowest?`<span style="font-size:10px;background:#06b6d4;color:#fff;border-radius:5px;padding:2px 6px;font-weight:800">הכי דחוף</span>`:''}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:10px">${fieldPairs(car.cells)}</div>
            <button onclick="markCarCharged('${d.id}',${idx})" style="width:100%;background:#22c55e;color:#fff;border:none;border-radius:10px;padding:11px;font-family:Heebo,sans-serif;font-size:14px;font-weight:800;cursor:pointer">הוטען ✓</button>
          </div>`;
        });
        html += `</div>`;
      }

      // cars already charged are intentionally hidden from the driver — he only
      // needs the list of what's still left to do
      html += `</div>`;
    });
    container.innerHTML = html || '<div class="empty-state" style="padding:40px 20px;text-align:center;color:var(--muted)">אין רכבים לטעינה 🔌</div>';
}

function openChargingTaskModal(docId) {
  _onSnap(_docRef('charging_tasks', docId), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    document.getElementById('charging-task-id').value = docId;
    renderChargingTaskModal(data);
    openModal('modal-charging-task');
  });
}

function renderChargingTaskModal(data) {
  const headers = data.headers || [];
  const cars = data.carsJson ? JSON.parse(data.carsJson) : [];
  const toCharge = cars.filter(c => !c.charged);
  const charged  = cars.filter(c =>  c.charged);

  // determine plate column index for display
  const plateIdx = headers.findIndex(h => /מספר|לוחית|פלייט/.test(h));
  const getLabel = cells => plateIdx >= 0 ? cells[plateIdx] : cells[0] || '';

  // column widths helper
  const colW = headers.length
    ? headers.map(h => {
        if (h.includes('דגם') || h.includes('יצרן') || h.includes('צבע')) return 'minmax(70px,1.4fr)';
        if (h.includes('מספר') || h.includes('לוחית')) return 'minmax(70px,1.2fr)';
        return 'minmax(50px,1fr)';
      }).join(' ')
    : '1fr';

  function headerRow() {
    if (!headers.length) return '';
    return `<div style="display:grid;grid-template-columns:${colW} 90px;gap:3px;background:var(--dark);color:#fff;border-radius:10px 10px 0 0;padding:5px 8px;font-size:10px;font-weight:700;direction:rtl;min-width:max-content">
      ${headers.map(h=>`<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h)}</div>`).join('')}
      <div style="text-align:center">פעולה</div>
    </div>`;
  }

  function carRow(car, idx, isCharged) {
    const isMakdama = !isCharged && car.status === 'מקדמה';
    const bg = isCharged ? '#f0fff4' : (isMakdama ? '#fff1f2' : '#fefce8');
    const border = isCharged ? '#22c55e' : (isMakdama ? '#ef4444' : '#eab308');
    const btn = isCharged
      ? `<span style="font-size:11px;font-weight:700;color:#166534">✅ הוטען</span>`
      : `<button onclick="markCarCharged('${document.getElementById('charging-task-id').value}',${idx})" style="background:#22c55e;color:#fff;border:none;border-radius:8px;padding:5px 10px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer">הוטען ✓</button>`;
    const urgentBadge = isMakdama ? `<span style="font-size:9px;font-weight:800;background:#ef4444;color:#fff;border-radius:5px;padding:1px 5px;margin-left:4px">מקדמה</span>` : '';
    return `<div style="display:grid;grid-template-columns:${colW} 90px;gap:3px;align-items:center;background:${bg};border:2px solid ${border};border-top:none;padding:5px 8px;direction:rtl;min-width:max-content">
      ${car.cells.map((c,ci) => `<div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c)}${ci===0 ? urgentBadge : ''}</div>`).join('')}
      <div style="text-align:center">${btn}</div>
    </div>`;
  }

  // sort: מקדמה first in toCharge section
  const toChargeWithIdx = cars.map((car, idx) => ({ car, idx })).filter(x => !x.car.charged);
  toChargeWithIdx.sort((a, b) => {
    const am = a.car.status === 'מקדמה' ? 0 : 1;
    const bm = b.car.status === 'מקדמה' ? 0 : 1;
    return am - bm;
  });

  let html = '';
  if (toCharge.length) {
    const makdamaCount = toChargeWithIdx.filter(x => x.car.status === 'מקדמה').length;
    const makdamaNote = makdamaCount ? ` · <span style="color:#ef4444">${makdamaCount} מקדמה ⚠️</span>` : '';
    html += `<div style="font-weight:800;font-size:14px;color:#854d0e;background:#fef9c3;border-radius:10px;padding:8px 12px;margin-bottom:6px;margin-top:10px">⚡ צריך להטעין — ${toCharge.length} רכבים${makdamaNote}</div>`;
    html += `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:16px">`;
    html += headerRow();
    toChargeWithIdx.forEach(({ car, idx }) => { html += carRow(car, idx, false); });
    html += '</div>';
  }
  if (charged.length) {
    html += `<div style="font-weight:800;font-size:14px;color:#166534;background:#dcfce7;border-radius:10px;padding:8px 12px;margin-bottom:6px">✅ הוטענו — ${charged.length} רכבים</div>`;
    html += `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">`;
    html += headerRow();
    cars.forEach((car, idx) => { if (car.charged) html += carRow(car, idx, true); });
    html += '</div>';
  }
  if (!toCharge.length && !charged.length) html = '<div style="text-align:center;padding:30px;color:var(--muted)">אין רכבים</div>';
  document.getElementById('charging-task-body').innerHTML = html;
}

async function markCarCharged(docId, carIdx) {
  if (!window._CONFIG_DONE) return;
  try {
    const { getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDoc(_docRef('charging_tasks', docId));
    if (!snap.exists()) return;
    const data = snap.data();
    const cars = data.carsJson ? JSON.parse(data.carsJson) : [];
    if (!cars[carIdx]) return;
    const origBattery = parseInt(cars[carIdx].battery);
    const origRange   = parseFloat(cars[carIdx].range);
    const calcRange = (!isNaN(origBattery) && origBattery > 0 && !isNaN(origRange))
      ? Math.round(origRange / origBattery * 100)
      : '';
    cars[carIdx].charged  = true;
    cars[carIdx].battery  = '100';
    cars[carIdx].range    = calcRange !== '' ? String(calcRange) : (cars[carIdx].range || '');
    const allCharged = cars.every(c => c.charged);
    await updateDoc(_docRef('charging_tasks', docId), {
      carsJson: JSON.stringify(cars),
      status: allCharged ? 'done' : 'active',
    });
    if (allCharged) { showToast('🎉 כל הרכבים הוטענו!'); } else { showToast('✅ הרכב סומן כהוטען'); }
    // re-render modal if open
    if (document.getElementById('modal-charging-task')?.classList.contains('open')) {
      const newData = { ...data, carsJson: JSON.stringify(cars) };
      renderChargingTaskModal(newData);
    }
  } catch(e) { console.error('markCarCharged', e); showToast('⚠️ שגיאה'); }
}

window.convertToChargingTask = convertToChargingTask;
window.openDriverChargingScreen = openDriverChargingScreen;
window.openChargingTaskModal = openChargingTaskModal;
window.markCarCharged = markCarCharged;

/* ── Plate Scanner — live continuous, local OCR, closed-set matching ──
   The camera streams inside the modal; frames are OCR'd locally (Tesseract,
   digits only) and matched ONLY against the plates in the open inventory list.
   Exact match marks immediately; a 1-digit-off match needs two agreeing frames
   (prevents wrong-car marks). No button presses between plates. */
let _plateStream = null, _plateWorker = null, _plateWorkers = [], _plateLoopOn = false, _plateScanBusy = false;

// two OCR workers, fixed psm 7 (single line) and psm 6 (block) — run in parallel
async function _plateEnsureWorkers() {
  if (_plateWorkers.length === 2) return;
  const mk = async psm => {
    const w = await Tesseract.createWorker('eng', 1);
    await w.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: psm });
    return w;
  };
  _plateWorkers = await Promise.all([mk('7'), mk('6')]);
}
if (!window._plateScanSeen) window._plateScanSeen = new Set();

// plates of the rows in the currently-open inventory assignment
function _invKnownPlates() {
  const out = [];
  _driverInvRows.forEach((r, i) => {
    for (const c of r.cells) {
      const d = String(c || '').replace(/\D/g, '');
      if (d.length === 7 || d.length === 8) { out.push({ idx: i, plate: d }); break; }
    }
  });
  return out;
}

function _plateTokensFrom(text) {
  const runs = String(text || '').match(/\d+/g) || [];
  const out = new Set();
  for (const r of runs) {
    if (r.length === 7 || r.length === 8) out.add(r);
    // windows inside longer runs (plate glued to another digit)
    if (r.length === 9) { out.add(r.slice(0, 8)); out.add(r.slice(1)); out.add(r.slice(0, 7)); out.add(r.slice(2)); }
  }
  // adjacent runs glued (e.g. "295 38 902")
  for (let s = 0; s < runs.length; s++) {
    let comb = '';
    for (let e = s; e < runs.length && comb.length < 9; e++) {
      comb += runs[e];
      if (comb.length === 7 || comb.length === 8) out.add(comb);
    }
  }
  return [...out];
}

// returns {idx, plate} or null. EXACT digit-for-digit match only — a near-miss
// (even one digit off) must never mark a car, wrong inventory marks are worse
// than a slower scan.
function _plateMatch(tokens) {
  const known = _invKnownPlates();
  for (const t of tokens) {
    const hit = known.find(k => k.plate === t);
    if (hit) return hit;
  }
  return null;
}

function _plateMarkFound(hit) {
  const resultEl = document.getElementById('plate-scan-result');
  const status = document.getElementById('plate-scan-status');
  const already = _driverInvRows[hit.idx].status === 'v';
  if (!already) {
    const headers = JSON.parse(document.getElementById('dinv-headers-cache').value || '[]');
    _driverInvRows[hit.idx].status = 'v';
    _dinvSaveProgress();
    renderDriverInvModal(headers);
  }
  _plateScanSeen.add(hit.plate);
  _plateCloudMissStreak = 0;
  _plateLastMarkAt = Date.now();
  resultEl.style.background = already ? '#0ea5e9' : '#22c55e';
  resultEl.textContent = already ? `✓ ${hit.plate} כבר סומנה` : `✅ ${hit.plate} נקלט וסומן`;
  resultEl.style.display = 'block';
  if (navigator.vibrate) { try { navigator.vibrate(already ? 60 : [80, 40, 80]); } catch(e) {} }
  _updatePlateScanCount();
  status.innerHTML = 'כוון ללוחית הבאה 📷';
  setTimeout(() => { resultEl.style.display = 'none'; }, 2200);
}

function _updatePlateScanCount() {
  const el = document.getElementById('plate-scan-count');
  if (!el) return;
  const total = _invKnownPlates().length;
  const done = _driverInvRows.filter(r => r.status === 'v').length;
  el.textContent = `סומנו ${done} מתוך ${total}`;
}

// grayscale + contrast stretch on the guide band, drawn into the work canvas.
// Returns the canvas itself (recognize(canvas) skips PNG encode/decode — fast).
function _plateGrabFrame() {
  const v = document.getElementById('plate-video');
  const c = document.getElementById('plate-canvas');
  if (!v || v.readyState < 2 || !v.videoWidth) return null;
  const vw = v.videoWidth, vh = v.videoHeight;
  let bx = vw * 0.05, bw = vw * 0.90, by = vh * 0.33, bh = vh * 0.34;
  // software zoom: crop the center of the band (used when hw zoom is unavailable)
  if (_plateSwZoom !== 1) {
    const cx = bx + bw / 2, cy = by + bh / 2;
    bw = Math.min(vw, bw / _plateSwZoom); bh = Math.min(vh, bh / _plateSwZoom);
    bx = Math.max(0, Math.min(vw - bw, cx - bw / 2));
    by = Math.max(0, Math.min(vh - bh, cy - bh / 2));
  }
  const sc = Math.min(2, 900 / bw); // small enough to stay fast — the zoom supplies the magnification
  c.width = Math.round(bw * sc); c.height = Math.round(bh * sc);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(v, bx, by, bw, bh, 0, 0, c.width, c.height);
  const id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
  const hist = new Array(256).fill(0);
  let yellowCount = 0; // Israeli plates are yellow — cheap "plate in view" signal
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i+1], b = d[i+2];
    if (r > 140 && gg > 110 && b < 110 && (r - b) > 55 && (gg - b) > 40) yellowCount++;
    const g = (0.299*r + 0.587*gg + 0.114*b) | 0;
    d[i] = d[i+1] = d[i+2] = g; hist[g]++;
  }
  const total = d.length / 4, cut = total * 0.02;
  let lo = 0, hi = 255, acc = 0;
  for (let t = 0; t < 256; t++) { acc += hist[t]; if (acc > cut) { lo = t; break; } }
  acc = 0;
  for (let t = 255; t >= 0; t--) { acc += hist[t]; if (acc > cut) { hi = t; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    let val = (d[i] - lo) * 255 / range; val = val < 0 ? 0 : val > 255 ? 255 : val;
    d[i] = d[i+1] = d[i+2] = val;
  }
  ctx.putImageData(id, 0, 0);
  return { c, yellow: yellowCount / total };
}

/* ── Cloud assist (Plate Recognizer): fired ONLY when local OCR sees digits but
   can't resolve them for ~0.9s — one throttled snapshot per stubborn plate.
   Quota-safe: never fires on empty frames while walking between cars, tracks
   monthly usage against the free 2,500 quota (shared team counter in
   Firestore), and stops automatically — with ONE clear message, not spam —
   before wasting calls that would fail anyway. ── */
const _PLATE_CLOUD_MONTHLY_LIMIT = 2400; // stop a little short of the 2,500 free quota
let _plateCloudToken = null, _plateCloudInflight = 0, _plateCloudLastAt = 0, _plateUnresolvedAt = 0;
let _plateCloudMonthKey = '', _plateCloudUsed = 0, _plateCloudBlocked = false, _plateCloudMissStreak = 0;

function _curMonthKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function _curDayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
// spreads the free 2,400 monthly calls across the month so the quota can never
// run out mid-month and leave the scanner slow for a week (the manager will
// not pay for the upgrade plan) — resets every midnight
// Adaptive daily budget: whatever is left this month, spread over the scan days
// (Sun–Fri) still remaining. A light day banks credit for a heavy one, and the
// monthly free quota can never be overrun.
function _plateScanDaysLeftInMonth() {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  let n = 0;
  for (let day = d.getDate(); day <= last; day++) {
    if (new Date(y, m, day).getDay() !== 6) n++; // skip Saturday
  }
  return Math.max(1, n);
}
function _plateDailyBudget() {
  const left = Math.max(0, _PLATE_CLOUD_MONTHLY_LIMIT - _plateCloudUsed);
  return Math.max(20, Math.floor(left / _plateScanDaysLeftInMonth()));
}
let _plateCloudDayKey = '', _plateCloudDayUsed = 0;

async function _plateLoadCloudToken() {
  if (_plateCloudToken !== null) return;
  _plateCloudToken = '';
  try {
    const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const s = await getDoc(_docRef('config', 'driver_contacts'));
    if (s.exists()) _plateCloudToken = (s.data()._plateToken && s.data()._plateToken.value) || '';
    // shared monthly usage counter — same doc, so all drivers count against one quota
    _plateCloudMonthKey = _curMonthKey();
    const usage = s.exists() ? s.data()._plateCloudUsage : null;
    _plateCloudUsed = (usage && usage.month === _plateCloudMonthKey) ? (usage.count || 0) : 0;
    _plateCloudDayKey = _curDayKey();
    _plateCloudDayUsed = (usage && usage.day === _plateCloudDayKey) ? (usage.dayCount || 0) : 0;
    _plateCloudBlocked = _plateCloudUsed >= _PLATE_CLOUD_MONTHLY_LIMIT || _plateCloudDayUsed >= _plateDailyBudget();
  } catch(e) { console.error('cloud token load', e); }
  _plateUpdateCloudUsageDisplay();
}

function _plateUpdateCloudUsageDisplay() {
  const el = document.getElementById('plate-cloud-usage');
  if (!el) return;
  if (!_plateCloudToken) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.textContent = `☁️ ענן היום: ${_plateCloudDayUsed}/${_plateDailyBudget()} · חודש: ${_plateCloudUsed}/${_PLATE_CLOUD_MONTHLY_LIMIT} · 🆓 מקומי: ${_plateLocalHits}`;
}

// fire-and-forget increment of the shared usage counter (best-effort; a lost
// increment here just means the local cutoff is a call or two late, never
// early — so it never blocks scanning prematurely)
async function _plateCloudBumpUsage() {
  _plateCloudUsed++;
  // midnight rollover mid-session: fresh day, fresh budget
  const dk = _curDayKey();
  if (dk !== _plateCloudDayKey) { _plateCloudDayKey = dk; _plateCloudDayUsed = 0; if (_plateCloudUsed < _PLATE_CLOUD_MONTHLY_LIMIT) _plateCloudBlocked = false; }
  _plateCloudDayUsed++;
  _plateUpdateCloudUsageDisplay();
  try {
    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(_docRef('config', 'driver_contacts'), { _plateCloudUsage: { month: _plateCloudMonthKey, count: _plateCloudUsed, day: _plateCloudDayKey, dayCount: _plateCloudDayUsed } });
  } catch(e) {}
  const status = document.getElementById('plate-scan-status');
  if (_plateCloudUsed >= _PLATE_CLOUD_MONTHLY_LIMIT && !_plateCloudBlocked) {
    _plateCloudBlocked = true;
    if (status) status.innerHTML = '📵 המכסה החינמית החודשית נוצלה — הזיהוי ממשיך מקומית בלבד';
  } else if (_plateCloudDayUsed >= _plateDailyBudget() && !_plateCloudBlocked) {
    _plateCloudBlocked = true;
    if (status) status.innerHTML = '📵 התקציב היומי של הענן נוצל — ממשיך בזיהוי מקומי (מתאפס בחצות)';
  }
}

let _plateLastMarkAt = 0;

// the cloud read the plate clearly but it isn't in the inventory list —
// tell the driver so they know it's a foreign car, not a bad read
let _plateNotInInvLastAt = 0;
function _plateShowNotInInventory(plate) {
  const now = Date.now();
  if (now - _plateNotInInvLastAt < 4000) return; // don't flash repeatedly on the same car
  _plateNotInInvLastAt = now;
  const resultEl = document.getElementById('plate-scan-result');
  if (!resultEl) return;
  resultEl.style.background = '#f59e0b';
  resultEl.textContent = `⚠️ ${plate} לא נמצאת ברשימת המלאי`;
  resultEl.style.display = 'block';
  if (navigator.vibrate) { try { navigator.vibrate([50, 50, 50, 50, 50]); } catch(e) {} }
  setTimeout(() => { if (resultEl.textContent.includes(plate)) resultEl.style.display = 'none'; }, 3000);
}

/* ── FREE local read of the tight plate crop ──────────────────────────────
   The cloud costs quota; this costs nothing. Run on the small, high-contrast
   plate rectangle (not the wide band) Tesseract is both fast and accurate, so
   most plates never need a cloud call at all — which is what makes 110 cars a
   day fit inside the free tier. ── */
const _plateLocalCanvas = document.createElement('canvas');
let _plateLocalBusy = false;
let _plateLocalHits = 0; // free reads, shown so the manager sees the savings
function _plateSharpenForOcr(src) {
  const c = _plateLocalCanvas;
  const scale = Math.min(3, Math.max(1, 420 / src.width));
  c.width = Math.round(src.width * scale); c.height = Math.round(src.height * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
  // grayscale + contrast stretch → black digits on white
  let lo = 255, hi = 0;
  const g = new Uint8Array(d.length / 4);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = (0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]) | 0;
    g[p] = v; if (v < lo) lo = v; if (v > hi) hi = v;
  }
  const span = Math.max(1, hi - lo);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    let v = ((g[p] - lo) / span) * 255;
    v = v < 128 ? Math.max(0, v * 0.6) : Math.min(255, 255 - (255 - v) * 0.6);
    d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  return c;
}
async function _plateLocalTry(srcCanvas) {
  if (_plateLocalBusy || !_plateWorkers.length) return null;
  _plateLocalBusy = true;
  try {
    const prepped = _plateSharpenForOcr(srcCanvas);
    const r = await _plateWorkers[0].recognize(prepped);
    return _plateTokensFrom(r.data.text);
  } catch(e) { return null; }
  finally { _plateLocalBusy = false; }
}

function _plateCloudTry(srcCanvas) {
  const nowW = Date.now();
  // Watchdog: whatever the cause (aborted request, callback that never fired,
  // browser throttling a backgrounded tab), never let the busy flag wedge the
  // scanner. If it's been set unreasonably long, clear it and carry on.
  if (_plateCloudInflight > 0 && nowW - _plateCloudLastAt > 3500) {
    console.warn('plate cloud watchdog — releasing stuck request');
    _plateCloudInflight = 0;
  }
  if (!_plateCloudToken || _plateCloudBlocked) return;
  // One request for a plate that reads first time. The moment an attempt FAILS
  // a second parallel attempt is allowed, doubling the retry rate on hard
  // plates without costing extra calls on easy ones.
  const maxInflight = _plateCloudMissStreak >= 1 ? 2 : 1;
  if (_plateCloudInflight >= maxInflight) return;
  // ~6 shots (≈2.5s) at one hopeless plate is enough — stop spending quota on
  // it. Resets automatically when the plate leaves the frame or moves.
  if (_plateCloudMissStreak >= 6) return;
  const now = Date.now();
  // NO waiting gates. The scanner retries continuously until the plate reads —
  // a hard plate gets hit again the moment the previous answer returns. The
  // only limits: one request in flight at a time, a minimal spacing so we don't
  // burst-duplicate the same frame, and the monthly quota block.
  if (now - _plateCloudLastAt < 250) return;
  _plateCloudInflight++; _plateCloudLastAt = now;
  // snapshot the canvas NOW — the scan loop keeps redrawing it
  const c = _plateSnapCanvas;
  c.width = srcCanvas.width; c.height = srcCanvas.height;
  c.getContext('2d').drawImage(srcCanvas, 0, 0);
  const status = document.getElementById('plate-scan-status');
  if (status) status.innerHTML = '☁️ מזהה בענן...';
  c.toBlob(async blob => {
    try {
      const fd = new FormData();
      fd.append('upload', blob, 'plate.jpg');
      fd.append('regions', 'il');
      fd.append('config', JSON.stringify({ mode: 'fast' }));
      // Hard timeout: on patchy reception a hanging request would keep
      // the in-flight counter held and freeze the scanner for as long as the browser
      // waits (can be minutes). Better to give up fast and try the next frame.
      const ctl = new AbortController();
      const killer = setTimeout(() => ctl.abort(), 2500);
      let resp;
      try {
        resp = await fetch('https://api.platerecognizer.com/v1/plate-reader/', {
          method: 'POST', headers: { Authorization: 'Token ' + _plateCloudToken }, body: fd, signal: ctl.signal
        });
      } finally { clearTimeout(killer); }
      const data = await resp.json().catch(() => ({}));
      _plateCloudBumpUsage(); // count every real call against the shared quota
      const toks = [];
      for (const r of (data.results || [])) {
        const d0 = String(r.plate || '').replace(/\D/g, '');
        if (d0.length === 7 || d0.length === 8) toks.push(d0);
        for (const cand of (r.candidates || [])) {
          const cd = String(cand.plate || '').replace(/\D/g, '');
          if (cd.length === 7 || cd.length === 8) toks.push(cd);
        }
      }
      if (toks.length) {
        const hit = _plateMatch(toks);
        if (hit) {
          // hold off on any further calls until this plate leaves the frame
          _plateMarkedBox = _platePendingBox;
          _plateResolvedHold = true;
          _plateCloudMissStreak = 0;
          _plateUnresolvedAt = 0;
          if (!_plateScanSeen.has(hit.plate)) _plateMarkFound(hit);
        } else {
          _plateShowNotInInventory(toks[0]);
          _plateCloudMissStreak++;
        }
      } else {
        _plateCloudMissStreak++;
      }
      if (resp.status === 401 || resp.status === 403) {
        // Plate Recognizer returns 403 both for a bad token and for an exhausted
        // quota — either way, stop calling and tell the manager plainly.
        _plateCloudBlocked = true;
        if (status) status.innerHTML = '⚠️ הענן חסום (טוקן שגוי או שהמכסה נגמרה) — הזיהוי ממשיך מקומית';
      }
    } catch(e) { console.error('plate cloud', e); }
    if (status && status.innerHTML === '☁️ מזהה בענן...') status.innerHTML = 'כוון ללוחית הבאה 📷';
    _plateCloudInflight = Math.max(0, _plateCloudInflight - 1);
  }, 'image/jpeg', _plateCloudMissStreak >= 1 ? 0.85 : 0.7);
}

/* ── Fast cloud loop: independent of the heavy OCR loop. Every 150ms it does a
   cheap yellow-plate detection on a tiny grab; when a plate is in view it crops
   JUST the plate rectangle at native resolution (~20KB upload instead of the
   whole band) and fires the cloud. Also keeps the TLS connection warm. ── */
let _plateCloudLoopOn = false;
let _plateYellowSinceAt = 0; // when the current plate-in-view streak started
// coarse "where the plate sits in frame" signatures — used to send exactly one
// cloud request per car instead of re-sending while it stays centred
let _plateLastSentBox = null, _plateMarkedBox = null, _platePendingBox = null;
// reused every frame — allocating canvases ~14x/sec builds GC pressure and the
// scanner visibly slows down the longer it stays open
const _plateCropCanvas = document.createElement('canvas');
const _plateSnapCanvas = document.createElement('canvas');
let _plateResolvedHold = false; // set after a hit; cleared when the plate leaves view
async function _plateCloudLoop() {
  const small = document.createElement('canvas');
  let lastPing = 0;
  while (_plateCloudLoopOn) {
    const now = Date.now();
    if (now - lastPing > 8000) {
      lastPing = now;
      try { fetch('https://api.platerecognizer.com/', { mode: 'no-cors' }).catch(() => {}); } catch(e) {}
    }
    const v = document.getElementById('plate-video');
    if (v && v.readyState >= 2 && v.videoWidth && _plateCloudInflight < 2 && _plateCloudToken) {
      try {
        const vw = v.videoWidth, vh = v.videoHeight;
        let bx = vw * 0.05, bw = vw * 0.90, by = vh * 0.33, bh = vh * 0.34;
        if (_plateSwZoom !== 1) { const cx = bx + bw/2, cy = by + bh/2; bw = Math.min(vw, bw/_plateSwZoom); bh = Math.min(vh, bh/_plateSwZoom); bx = Math.max(0, Math.min(vw - bw, cx - bw/2)); by = Math.max(0, Math.min(vh - bh, cy - bh/2)); }
        const sw = 240, sh = Math.max(1, Math.round(sw * bh / bw));
        small.width = sw; small.height = sh;
        const sctx = small.getContext('2d', { willReadFrequently: true });
        sctx.drawImage(v, bx, by, bw, bh, 0, 0, sw, sh);
        const dd = sctx.getImageData(0, 0, sw, sh).data;
        let minX = sw, maxX = 0, minY = sh, maxY = 0, cnt = 0;
        for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
          const i = (y * sw + x) * 4, r = dd[i], g = dd[i+1], b = dd[i+2];
          if (r > 140 && g > 110 && b < 110 && (r - b) > 55 && (g - b) > 40) {
            cnt++;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
        if (cnt > sw * sh * 0.02 && maxX > minX + 15) {
          // Fire the cloud the INSTANT a plate is in view — no warm-up delay.
          // Repeats are prevented by a coarse signature of where the plate sits
          // in frame: a different car (or the same car re-approached) produces a
          // different signature, the identical framing does not.
          // Position of the plate in frame, compared with a tolerance so that
          // hand-shake does NOT read as a different car (an exact-match
          // signature would fire several cloud calls for one vehicle).
          const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cw = maxX - minX;
          const near = (a) => a && Math.abs(a.cx - cx) < 22 && Math.abs(a.cy - cy) < 22 && Math.abs(a.cw - cw) < 22;
          // once a car is resolved, stay quiet until the plate leaves the frame
          const stillOnResolvedCar = _plateResolvedHold && near(_plateMarkedBox);
          const sameFraming = near(_plateLastSentBox);
          // a materially different framing means a DIFFERENT car — the previous
          // car's failures must not count against it (the counter only feeds
          // the auto-zoom/local-fallback heuristics; it never blocks the cloud)
          if (!sameFraming) _plateCloudMissStreak = 0;
          // retry the SAME plate as soon as the previous answer is back —
          // a hard plate keeps getting hit until it reads. Only a resolved
          // plate silences the cloud until it leaves the frame.
          if (!stillOnResolvedCar) {
            _plateLastSentBox = { cx, cy, cw };
            _platePendingBox = { cx, cy, cw };
            // crop the yellow box (+margin) from the live video at native resolution
            const px = bx + (minX / sw) * bw, pw = ((maxX - minX) / sw) * bw;
            const py = by + (minY / sh) * bh, ph = Math.max(1, ((maxY - minY) / sh) * bh);
            const ex = Math.max(0, px - pw * 0.12), ew = Math.min(vw - ex, pw * 1.24);
            const ey = Math.max(0, py - ph * 0.25), eh = Math.min(vh - ey, ph * 1.5);
            const out = _plateCropCanvas;
            // first try = small+fast; on a retry send a sharper crop so the
            // second attempt almost always reads (that keeps hard plates ~1s)
            const sc2 = _plateCloudMissStreak >= 1 ? Math.min(3, 900 / ew) : Math.min(2, 480 / ew);
            out.width = Math.max(60, Math.round(ew * sc2)); out.height = Math.max(20, Math.round(eh * sc2));
            out.getContext('2d').drawImage(v, ex, ey, ew, eh, 0, 0, out.width, out.height);
            // FREE first: read the crop locally. Only if that fails do we spend
            // a cloud call — this is what keeps 110 cars/day inside the free tier.
            let solvedLocally = false;
            if (!_plateLocalBusy && _plateCloudInflight === 0) {
              const toks = await _plateLocalTry(out);
              if (toks && toks.length) {
                const hit = _plateMatch(toks);
                if (hit) {
                  _plateMarkedBox = { cx, cy, cw };
                  _plateResolvedHold = true;
                  _plateCloudMissStreak = 0;
                  solvedLocally = true;
                  _plateLocalHits++;
                  _plateUpdateCloudUsageDisplay();
                  if (!_plateScanSeen.has(hit.plate)) _plateMarkFound(hit);
                }
              }
            }
            if (!solvedLocally) _plateCloudTry(out);
          }
        } else {
          // plate left the frame — everything resets so the next car is instant
          _plateYellowSinceAt = 0;
          _plateCloudMissStreak = 0;
          _plateLastSentBox = null;
          _plateMarkedBox = null;
          _plateResolvedHold = false;
        }
      } catch(e) { console.error('cloud loop', e); }
    }
    await new Promise(r => setTimeout(r, 70)); // tight loop — detection must not add latency
  }
}

async function _plateScanLoop() {
  while (_plateLoopOn) {
    // Tesseract is the SLOW path (hundreds of ms per frame) and it competes for
    // the same CPU the detection loop needs. When the cloud is available it
    // resolves plates far faster, so local OCR only runs as a fallback — this
    // is what keeps recognition under a second.
    // The detection loop now reads the tight plate crop locally (free) before
    // ever touching the cloud, so this wide-band pass is only a safety net for
    // plates the yellow detector never sees. Skip it whenever either engine is
    // already working, so it never competes for CPU.
    const someEngineWorking = _plateLocalBusy || _plateCloudInflight > 0 ||
      (_plateCloudToken && !_plateCloudBlocked && Date.now() - _plateCloudLastAt < 1000);
    if (someEngineWorking) {
      const grab = _plateGrabFrame();
      _plateAutoZoomTick(grab ? grab.yellow > 0.035 : false);
      await new Promise(r => setTimeout(r, 220));
      continue;
    }
    const grab = _plateGrabFrame();
    if (grab && _plateWorkers.length) {
      const frame = grab.c;
      try {
        // both page-seg modes run IN PARALLEL on separate workers (separate threads)
        const results = await Promise.all(_plateWorkers.map(w => w.recognize(frame).catch(() => ({ data: { text: '' } }))));
        let tokens = [];
        for (const r of results) tokens = tokens.concat(_plateTokensFrom(r.data.text));
        _plateAutoZoomTick(tokens.length > 0 || grab.yellow > 0.035);
        if (tokens.length) {
          const hit = _plateMatch(tokens);
          if (hit && !_plateScanSeen.has(hit.plate)) {
            _plateMarkFound(hit); // no pause — keep scanning
            _plateUnresolvedAt = 0;
          } else if (!hit) {
            // local read digits but couldn't match — only escalate to cloud once
            // this has persisted a moment, not on the very first misread frame
            if (!_plateUnresolvedAt) _plateUnresolvedAt = Date.now();
            else if (Date.now() - _plateUnresolvedAt > 450) _plateCloudTry(frame);
          }
        } else {
          _plateUnresolvedAt = 0;
        }
        // cloud is otherwise driven by the slower, cheaper _plateCloudLoop —
        // this loop no longer fires it eagerly on every yellow-in-view frame
      } catch(e) { console.error('plate scan frame', e); }
    }
    await new Promise(r => setTimeout(r, 30)); // near-continuous
  }
}

async function openPlateScanner() {
  window._plateScanSeen = new Set();
  const status = document.getElementById('plate-scan-status');
  const resultEl = document.getElementById('plate-scan-result');
  const fallbackBtn = document.getElementById('plate-capture-btn');
  const videoWrap = document.getElementById('plate-video-wrap');
  resultEl.style.display = 'none';
  fallbackBtn.style.display = 'none';
  videoWrap.style.display = 'block';
  status.innerHTML = 'כוון את הלוחית למסגרת הצהובה<br><span style="color:#94a3b8;font-size:12px;font-weight:400">הזיהוי אוטומטי — אין צורך ללחוץ</span>';
  _updatePlateScanCount();
  _plateUnresolvedAt = 0;
  _plateLoadCloudToken(); // async — cloud assist arms itself when ready
  try { fetch('https://api.platerecognizer.com/', { mode: 'no-cors' }).catch(() => {}); } catch(e) {} // warm DNS+TLS so the first cloud call is fast
  openModal('modal-plate-scanner');
  try {
    _plateStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 2560 }, height: { ideal: 1440 },
        focusMode: 'continuous'
      },
      audio: false
    });
    const v = document.getElementById('plate-video');
    v.srcObject = _plateStream;
    await v.play();
    _plateEmptyFrames = 0;
    try { _plateSetupZoom(); } catch(e) { console.error('zoom setup', e); }
    await _plateEnsureWorkers();
    _plateLoopOn = true;
    _plateScanLoop();
    _plateCloudLoopOn = true;
    _plateCloudLoop();
  } catch(e) {
    console.error('camera open failed', e);
    // no live camera (permission denied / unsupported) — photo fallback
    videoWrap.style.display = 'none';
    fallbackBtn.style.display = 'inline-block';
    status.innerHTML = 'המצלמה החיה לא זמינה — צלם את הלוחית בכפתור';
  }
}

/* ── Auto-zoom: hardware camera zoom when available, software (crop) zoom
   otherwise. Starts at 2x; if no digits are read for ~2.2s, cycles to the
   next level automatically until the plate locks. Tap the indicator to
   advance manually. ── */
const _plateZoomLevels = [0.5, 1, 1.5, 2, 2.5, 3];
let _plateZoomIdx = 3;      // start at 2x
let _plateSwZoom = 1;       // software crop-zoom factor (used when no hw zoom)
let _plateHwZoom = false;
let _plateLastTokensAt = 0;

function _plateSetupZoom() {
  const ind = document.getElementById('plate-zoom-ind');
  _plateZoomIdx = 1; // start at 1x — the driver stands close to the plate
  _plateLastTokensAt = Date.now();
  try {
    const track = _plateStream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    _plateHwZoom = !!(caps.zoom && caps.zoom.max > 1);
    // continuous autofocus tuned for close range — plates are read from ~0.5-2m
    const adv = [];
    if (caps.focusMode && caps.focusMode.includes('continuous')) adv.push({ focusMode: 'continuous' });
    if (caps.focusDistance && typeof caps.focusDistance.min === 'number') {
      // bias focus toward near objects (value is meters on most devices)
      const near = Math.max(caps.focusDistance.min, 0.5);
      adv.push({ focusMode: 'manual', focusDistance: near });
      // manual-near can fight moving scans — prefer continuous when both exist
      if (caps.focusMode && caps.focusMode.includes('continuous')) adv.pop();
    }
    if (adv.length) track.applyConstraints({ advanced: adv }).catch(() => {});
  } catch(e) { _plateHwZoom = false; }
  ind.style.display = 'inline-block';
  _plateApplyZoom();
}

async function _plateApplyZoom() {
  const z = _plateZoomLevels[_plateZoomIdx];
  if (_plateHwZoom) {
    try {
      const track = _plateStream.getVideoTracks()[0];
      const caps = track.getCapabilities();
      const zoom = Math.min(Math.max(z, caps.zoom.min || 1), caps.zoom.max);
      await track.applyConstraints({ advanced: [{ zoom }] });
      // hw zoom can't go below its min (usually 1) — cover the rest in software
      _plateSwZoom = z < zoom ? z / zoom : 1;
    } catch(e) { _plateSwZoom = z; } // hw apply failed → fall back to software
  } else {
    _plateSwZoom = z;
  }
  const ind = document.getElementById('plate-zoom-ind');
  if (ind) ind.textContent = `🔍 זום אוטומטי ${z}x`;
  // software zoom → mirror it visually so aiming matches what is scanned
  const v = document.getElementById('plate-video');
  if (v) { v.style.transformOrigin = 'center center'; v.style.transform = _plateSwZoom !== 1 ? `scale(${_plateSwZoom})` : 'none'; }
}

function _plateCycleZoom() {
  _plateZoomIdx = (_plateZoomIdx + 1) % _plateZoomLevels.length;
  _plateLastTokensAt = Date.now(); // manual change delays the auto-cycle
  _plateApplyZoom();
}
window._plateCycleZoom = _plateCycleZoom;

// called from the scan loop: advance zoom only after several token-less FRAMES
// (frame-based, not clock-based — slow devices must not flail between levels)
let _plateEmptyFrames = 0;
// Only hunt for a better zoom when a plate is actually in view and refuses to
// resolve. Cycling zoom while the driver simply walks between cars forces the
// camera to re-focus each time, so it arrives at the next plate blurred — that
// made acquisition slower, not faster.
function _plateAutoZoomTick(yellowPresent) {
  if (!yellowPresent) { _plateEmptyFrames = 0; _plateLastTokensAt = Date.now(); return; }
  // plate in view — is it resolving? if the cloud is getting it, leave zoom alone
  if (_plateCloudMissStreak < 1) { _plateEmptyFrames = 0; _plateLastTokensAt = Date.now(); return; }
  _plateEmptyFrames++;
  if (_plateEmptyFrames >= 4 && Date.now() - _plateLastTokensAt > 2000) {
    _plateEmptyFrames = 0;
    _plateLastTokensAt = Date.now();
    _plateZoomIdx = (_plateZoomIdx + 1) % _plateZoomLevels.length;
    _plateApplyZoom();
  }
}

function closePlateScanner() {
  _plateLoopOn = false;
  _plateCloudLoopOn = false;
  if (_plateStream) { try { _plateStream.getTracks().forEach(t => t.stop()); } catch(e) {} _plateStream = null; }
  const v = document.getElementById('plate-video');
  if (v) v.srcObject = null;
  for (const w of _plateWorkers) { try { w.terminate(); } catch(e) {} }
  _plateWorkers = [];
  if (_plateWorker) { try { _plateWorker.terminate(); } catch(e) {} _plateWorker = null; }
  closeModal('modal-plate-scanner');
}

// photo fallback — same local pipeline on a captured photo
async function onPlatePhoto(input) {
  const file = input.files[0];
  if (!file || _plateScanBusy) return;
  _plateScanBusy = true;
  const status = document.getElementById('plate-scan-status');
  status.innerHTML = '🔍 מזהה לוחית...';
  try {
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(file); });
    const prepped = await _prepRegion(url, { y0: 0.2, y1: 0.8 }, 2);
    const w = _plateWorker || await Tesseract.createWorker('eng', 1);
    if (!_plateWorker) { _plateWorker = w; await w.setParameters({ tessedit_char_whitelist: '0123456789' }); }
    let tokens = [];
    for (const psm of ['7', '6', '11']) {
      await w.setParameters({ tessedit_pageseg_mode: psm });
      tokens = tokens.concat(_plateTokensFrom((await w.recognize(prepped)).data.text));
    }
    const hit = _plateMatch(tokens);
    if (hit) _plateMarkFound(hit);
    else status.innerHTML = '❌ לא זוהתה — נסה לצלם קרוב יותר וישר מול הלוחית';
  } catch(e) {
    console.error('plate photo', e);
    status.innerHTML = '⚠️ שגיאה בזיהוי — נסה שוב';
  }
  input.value = '';
  _plateScanBusy = false;
}

window.openPlateScanner = openPlateScanner;
window.closePlateScanner = closePlateScanner;
window.onPlatePhoto = onPlatePhoto;
// closing via backdrop tap must also stop the camera + OCR worker
document.getElementById('modal-plate-scanner')?.addEventListener('click', e => {
  if (e.target && e.target.id === 'modal-plate-scanner') closePlateScanner();
});

window.pickDriver = pickDriver;
window.selectCarType = selectCarType;

window.selectDriver = selectDriver;
window.checkLoginReady = checkLoginReady;
window.doLogin = doLogin;
window.logout = logout;
window.goHome = goHome;
window.goToScreen = goToScreen;
window.openNewTaskModal = openNewTaskModal;
window.openNewVehicleModal = openNewVehicleModal;
window.fetchVehicleData = fetchVehicleData;
window.addPhotos = addPhotos;
window.removePhoto = removePhoto;
window.openNewPartModal = openNewPartModal;
window.submitTask = submitTask;
window.submitVehicle = submitVehicle;
window.submitPart = submitPart;
window.toggleTaskDone = toggleTaskDone;
window.deleteTask = deleteTask;
window._addDivider = async (label) => {
  // Place divider in the middle of current tasks in this column
  const colTasks = tasksCache.filter(t => t.label === label && t.type !== 'divider' && t.status !== 'done');
  const orders = colTasks.map(t => t.sortOrder ?? t.createdAt?.toMillis?.() ?? Date.now()).sort((a,b)=>a-b);
  const mid = orders.length ? orders[Math.floor(orders.length/2)] + 0.5 : Date.now();
  const { addDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await addDoc(collection(window._db, 'tasks'), { type:'divider', label, sortOrder: mid, createdAt: _serverTs() });
};
window.filterTasks = filterTasks;
