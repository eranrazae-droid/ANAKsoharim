/* נתוני הדגמה — כולם מומצאים. התאריכים נבנים ביחס להיום, כך שהמסכים
   תמיד נראים "חיים". אפשר להוסיף כאן נתונים כדי לראות מצבים נוספים. */
export function SEED(TS) {
  const now = Date.now(), H = 3600e3, D = 24 * H;
  const ago = ms => TS.fromMillis(now - ms);
  const iso = ms => new Date(now - ms).toISOString();
  const ymd = ms => iso(ms).slice(0, 10);
  const IMG = n => '/ops/img/ui2/mod-' + n + '.jpg';
  const DRV = ['גיל', 'עופר', 'איתי'];
  const CARS = [
    ['12-345-67', 'טויוטה', 'קורולה', '2021', 'לבן'], ['23-456-78', 'יונדאי', 'איוניק 5', '2023', 'אפור'],
    ['34-567-89', 'קיה', 'ספורטז׳', '2022', 'שחור'], ['45-678-90', 'מאזדה', '3', '2020', 'אדום'],
    ['56-789-01', 'סקודה', 'אוקטביה', '2022', 'כסוף'], ['67-890-12', 'טסלה', 'מודל 3', '2023', 'לבן'],
    ['78-901-23', 'מרצדס', 'C200', '2021', 'שחור'], ['89-012-34', 'ב.מ.וו', 'X1', '2022', 'כחול'],
    ['90-123-45', 'פולקסווגן', 'גולף', '2019', 'אפור'], ['11-222-33', 'שברולט', 'ספארק', '2020', 'צהוב'],
    ['22-333-44', 'ניסאן', 'קשקאי', '2021', 'לבן'], ['33-444-55', 'סיאט', 'לאון', '2022', 'אדום'],
    ['44-555-66', 'BYD', 'אטו 3', '2024', 'ירוק'], ['55-666-77', 'רנו', 'קליאו', '2019', 'כחול'],
    ['66-777-88', 'הונדה', 'סיוויק', '2021', 'שחור'], ['77-888-99', 'אאודי', 'A3', '2022', 'לבן'],
  ];
  const car = i => { const c = CARS[i % CARS.length]; return { plate: c[0], brand: c[1], maker: c[1], model: c[2], year: c[3], color: c[4] }; };
  const out = {};
  const put = (c, id, d) => { (out[c] = out[c] || {})[id] = d; };

  /* ── משימות ── */
  const TASKS = [
    ['משימות בעדיפות עליונה', 'להחליף צמיג קדמי ימני', 'red'], ['משימות בעדיפות עליונה', 'בדיקת בלמים לפני מסירה', 'red'],
    ['משימות ללקוחות ומוסך', 'לתאם מסירה ללקוח — יום ה׳'], ['משימות ללקוחות ומוסך', 'להחזיר רכב מהמוסך ללקוח'],
    ['משימות כלליות', 'שטיפה פנימית לפני צילום'], ['משימות כלליות', 'להעביר לחניה 42'], ['משימות כלליות', 'החלפת מגב אחורי'],
    ['משימות כלליות', 'מילוי נוזל מגבים'], ['חביב', 'חלון נהג לא עולה'], ['חביב', 'מנגנון חלון אחורי'],
    ['ולאדי', 'פגוש קדמי — שריטה'], ['ולאדי', 'צבע דלת ימין'], ['רפד', 'קרע במושב נהג'], ['רפד', 'ריפוד הגה שחוק'],
    ['זגג', 'סדק בשמשה קדמית'], ['רדארים', 'כיול חיישן חניה אחורי'], ['מוסך', 'טיפול 30,000'], ['מוסך', 'נורת מנוע דולקת'],
    ['גיל', 'מנורה אחורית שרופה'], ['עופר', 'להביא רכב מהמוסך'], ['איתי', 'טעינה לרכב חשמלי'],
  ];
  TASKS.forEach(([label, t, color], i) => {
    const c = car(i);
    put('tasks', 'task' + i, { title: c.plate + ' · ' + t, label, assignedTo: DRV.includes(label) ? label : 'כולם', status: i % 7 === 6 ? 'done' : 'open',
      ...(color ? { color } : {}), notes: i % 3 ? '' : 'לבדוק מול הלקוח', createdBy: i % 2 ? 'ליאל' : DRV[i % 3], createdAt: ago((i + 1) * 5 * H), sortOrder: i,
      ...(i === 2 ? { photos: [IMG('tasks')] } : {}) });
  });

  /* ── קליטות ── */
  for (let i = 0; i < 9; i++) {
    const c = car(i + 3), done = i >= 4;
    put('intake_assignments', 'intake' + i, { ...c, spot: String(40 + i), assignedTo: DRV[i % 3], createdBy: 'ליאל', status: done ? 'done' : 'pending', createdAt: ago((i + 1) * 7 * H),
      ...(done ? { km: String(20000 + i * 7311), code: String(1000 + i * 37), notes: i === 5 ? 'שריטה קלה בפגוש' : '', checklist: { 'c-tires': 'v', 'c-lights': i === 6 ? 'x' : 'v', 'c-wipers': 'v' },
        dashChecks: {}, safetyChecks: {}, photoUrls: {}, batteryPhotoUrls: {}, batteryMonth: '2024-0' + (i % 9 + 1), completedBy: DRV[i % 3], sentBy: DRV[i % 3], completedAt: ago(i * 3 * H), intakeDateTime: iso(i * 3 * H) } : {}) });
  }
  for (let i = 0; i < 6; i++) put('intake_archive', 'iarch' + i, { ...car(i + 8), assignedTo: DRV[i % 3], status: 'done', km: String(31000 + i * 5000), createdAt: ago((i + 3) * D), completedAt: ago((i + 2) * D), archivedAt: ago((i + 1) * D) });

  /* ── בקשות משימה ── */
  [['גיל', 'משימות כלליות', 'ניקוי כתם בריפוד אחורי'], ['עופר', 'חביב', 'חלון אחורי שמאל תקוע'], ['איתי', 'ולאדי', 'מכה בכנף שמאל']].forEach(([d, col, text], i) =>
    put('task_requests', 'req' + i, { driverName: d, column: col, text, photo: null, regionCity: 'תל אביב', region: 'מרכז', vehicle: { plate: car(i + 5).plate, maker: car(i + 5).maker, model: car(i + 5).model, year: car(i + 5).year }, status: 'pending', createdAt: ago((i + 1) * 2 * H) }));

  /* ── רענון ── */
  for (let i = 0; i < 4; i++) put('refreshes', 'ref' + i, { plate: car(i + 10).plate, vehicleType: car(i + 10).maker + ' ' + car(i + 10).model, year: car(i + 10).year, color: car(i + 10).color, parking: String(60 + i), managerNotes: i % 2 ? 'לבדוק ריח' : '', assignedTo: DRV[i % 3], status: i === 3 ? 'done' : 'pending', createdAt: ago((i + 1) * 9 * H) });

  /* ── מלאי ── */
  const invRows = Array.from({ length: 10 }, (_, i) => ({ cells: [car(i).plate, car(i).maker, car(i).model, car(i).color, String(40 + i)], status: i % 4 === 0 ? 'נמצא' : '' }));
  put('inventory_assignments', 'inv0', { assignedTo: 'גיל', sentBy: 'ליאל', createdAt: ago(3 * H), headers: ['מספר רישוי', 'יצרן', 'דגם', 'צבע', 'חניה'], rowsJson: JSON.stringify(invRows), status: 'pending' });
  put('inventory_assignments', 'inv1', { assignedTo: 'עופר', sentBy: 'ליאל', createdAt: ago(D), headers: ['מספר רישוי', 'יצרן', 'דגם', 'צבע', 'חניה'], rowsJson: JSON.stringify(invRows.map(r => ({ ...r, status: 'נמצא' }))), status: 'done' });

  /* ── מצברים וטעינה ── */
  const battRows = Array.from({ length: 8 }, (_, i) => ({ cells: [car(i).plate, car(i).year, car(i).maker, car(i).model, i % 3 ? 'מגרש' : 'מקדמה'], status: '' }));
  put('battery_assignments', 'ba0', { assignedTo: 'איתי', sentBy: 'ליאל', status: 'pending', headers: ['מספר רישוי', 'שנת ייצור', 'יצרן', 'דגם', 'סטטוס'], rowsJson: JSON.stringify(battRows), batchId: 'b1', createdAt: ago(5 * H) });
  const chCars = [1, 5, 12, 2].map((k, i) => ({ cells: [car(k).plate, car(k).year, car(k).maker, car(k).model, i === 0 ? 'מקדמה' : 'מגרש'], battery: String([18, 34, 52, 27][i]), range: String([60, 140, 210, 90][i]), charged: false, status: i === 0 ? 'מקדמה' : 'מגרש' }));
  put('charging_tasks', 'ch0', { createdBy: 'ליאל', createdAt: ago(4 * H), status: 'active', headers: ['מספר רישוי', 'שנת ייצור', 'יצרן', 'דגם', 'סטטוס'], carsJson: JSON.stringify(chCars), fullBatteryCarsJson: '[]' });
  [['VARTA E44', 'E44', 520, 6], ['VARTA E39', 'E39', 480, 3], ['BOSCH S5 008', 'S5008', 560, 0], ['EXIDE EA770', 'EA770', 430, 4], ['VARTA A7 AGM', 'A7', 890, 2]].forEach(([model, sku, price, qty], i) => {
    put('battery_catalog', 'cat' + i, { sku, model, price, updatedAt: ago(10 * D) });
    put('battery_stock', 'stock' + i, { model, sku, price, qty, invoice: '2231' + i, note: '', createdBy: 'ליאל', createdAt: ago(20 * D), updatedAt: ago(2 * D) });
  });
  for (let i = 0; i < 3; i++) put('battery_installs', 'inst' + i, { model: 'VARTA E44', sku: 'E44', price: 520, stockId: 'stock0', plate: car(i + 2).plate, car: car(i + 2).maker + ' ' + car(i + 2).model, installedAt: ymd(i * D), ordered: i === 2, note: '', createdBy: 'ליאל', createdAt: ago(i * D + H) });

  /* ── פיטים ── */
  ['טסט', 'פיט', 'טסט'].forEach((t, i) => put('pit_checks', 'pit' + i, { plate: car(i + 6).plate, checkType: t, maker: car(i + 6).maker, model: car(i + 6).model, year: car(i + 6).year, color: car(i + 6).color, status: i === 2 ? 'sent' : 'pending', createdAt: ago((i + 1) * 6 * H) }));

  /* ── מגרש ── */
  const yard = {};
  for (let s = 1; s <= 34; s += 2) yard['L_' + s + '_כניסה'] = car(s).plate;
  for (let n = 40; n <= 60; n += 3) yard['R_' + n + '_' + (n % 2 ? 'בחוץ' : 'בפנים')] = car(n).plate;
  put('yard', 'current', { data: yard, status: 'draft', updatedAt: ago(2 * H) });

  /* ── פיקאפ ── */
  const CITY = [['תל אביב', 'דיזנגוף 120', 32.0853, 34.7818], ['רמת גן', 'ביאליק 45', 32.0823, 34.8106], ['פתח תקווה', 'רוטשילד 10', 32.0871, 34.8875], ['חולון', 'סוקולוב 33', 32.0158, 34.7874], ['ראשון לציון', 'הרצל 70', 31.9642, 34.8044]];
  CITY.forEach(([city, st, lat, lng], i) => put('pickup_cars', 'pk' + i, { plate: car(i + 1).plate, brand: car(i + 1).maker, type: car(i + 1).maker + ' ' + car(i + 1).model, year: car(i + 1).year, color: car(i + 1).color, km: String(40000 + i * 9000),
    test: ymd(-90 * D), city, address: st + ', ' + city, lat, lng, contact: 'דני ' + (i + 1) + ' 050-123456' + i, note: i === 1 ? 'מפתח אצל השומר' : '', assignedDriver: i < 3 ? 'הילה' : '', source: 'ידני', sortIndex: i, doc: null, docMime: null, docName: null, createdBy: 'משה', createdAt: ago((i + 1) * 4 * H) }));
  for (let i = 0; i < 4; i++) put('pickup_archive', 'pka' + i, { plate: car(i + 9).plate, type: car(i + 9).maker + ' ' + car(i + 9).model, address: CITY[i][1] + ', ' + CITY[i][0], city: CITY[i][0], hasDoc: false, collectedAt: ago((i + 1) * D), collectedBy: 'הילה', collectedByText: 'הילה', createdAt: ago((i + 2) * D) });

  /* ── נסיעות מבחן ── */
  ['pending', 'done', 'transferred', 'pending'].forEach((st, i) => put('test_drives', 'td' + i, { plate: car(i + 4).plate, maker: car(i + 4).maker, model: car(i + 4).model, year: car(i + 4).year, color: car(i + 4).color, assignedTo: DRV[i % 3], status: st, createdBy: 'ליאל', createdAt: ago((i + 1) * 8 * H) }));

  /* ── פחחות ── */
  const items = (a) => a.map(([name, price]) => ({ name, price }));
  [['at_shop', 'פגוש אחורי + צבע', [['פגוש אחורי', 900], ['צבע', 700]]], ['at_shop', 'דלת נהג', [['יישור דלת', 600]]], ['draft', 'כנף ימין', [['כנף', 450], ['צבע', 500]]], ['returned', 'מראה ימין', [['מראה', 350]]], ['returned', 'מכסה מנוע', [['יישור', 800], ['צבע', 900]]]].forEach(([st, desc, it], i) =>
    put('bodyshop_jobs', 'bs' + i, { plate: car(i + 7).plate, desc, note: i === 1 ? 'דחוף — מסירה ביום חמישי' : '', maker: car(i + 7).maker, items: items(it), status: st, paidAt: null, sentAt: st !== 'draft' ? iso((i + 2) * D) : null, ...(st === 'returned' ? { returnedAt: iso(i * 6 * H) } : {}), photoThumb: IMG('shop'), createdBy: 'ליאל', createdAt: ago((i + 3) * D) }));
  put('bodyshop_archive', 'bsa0', { title: 'עד ' + new Date(now - 14 * D).toLocaleDateString('he-IL'), paidAt: iso(14 * D), total: 4200, cars: [{ id: 'x1', plate: car(13).plate, desc: 'פגוש קדמי', note: '', items: items([['פגוש', 1500], ['צבע', 900]]), total: 2400 }, { id: 'x2', plate: car(14).plate, desc: 'דלת', note: '', items: items([['דלת', 1800]]), total: 1800 }], createdBy: 'ליאל', createdAt: ago(14 * D) });

  /* ── שטיפה ── */
  const WT = ['חיצוני', 'חיצוני ידני', 'פנימי', 'חיצוני + פנימי'];
  for (let i = 0; i < 14; i++) put('wash_notes', 'wn' + i, { ...car(i), type: WT[i % 4], createdBy: DRV[i % 3], createdAt: ago(i * 11 * H + H) });
  for (let i = 0; i < 6; i++) put('wash_vehicles', 'wv' + i, { plate: car(i).plate, maker: car(i).maker, model: car(i).model, subModel: '', color: car(i).color, year: car(i).year, label: '', addedBy: 'ליאל', createdAt: ago(30 * D) });
  put('wash_payments', 'wp0', { paidAt: ago(20 * D), paidBy: 'ליאל', from: ymd(55 * D), to: ymd(25 * D), count: 42, subtotal: 3150, vat: 567, total: 3717, invoiceNumber: '10482', invoiceMonth: ymd(40 * D).slice(0, 7), byType: { 'חיצוני': 30, 'פנימי': 12 }, cars: [], hasDoc: false });

  /* ── יומן והתראות ── */
  [['פגישה עם ספק מצברים', 0, '10:00'], ['מסירת רכב ללקוח', 0, '13:30'], ['ביקורת מגרש', 1, '09:00'], ['טסט ל-' + car(3).plate, 2, '11:00'], ['ישיבת צוות', 5, '08:30']].forEach(([title, d, t], i) =>
    put('calendar_events', 'ev' + i, { title, date: ymd(-d * D), startTime: t, endTime: '', notes: '', repeat: 'none', reminderMinutes: 0, reminderTo: '', reminderSent: false, createdAt: ago(D) }));
  DRV.forEach((d, i) => put('driver_notifications', 'dn' + i, { to: d, message: 'בוקר טוב — יש ' + (i + 2) + ' משימות חדשות', seen: i === 2, createdAt: ago((i + 1) * H) }));

  /* ── חלקים ── */
  put('parts', 'part0', { name: 'מראה צד ימין', plate: car(2).plate, qty: '1', supplier: 'אוטו-פרטס', notes: '', status: 'pending', requestedBy: 'גיל', requestedAt: ago(6 * H) });

  /* ── זמני ביצוע (timing_logs) — דפוסים שונים לכל נהג ── */
  const mkLog = (id, kind, driver, plate, agoMs, gapsSec, extraIdleAt, extraIdleSec) => {
    const end = now - agoMs; let t = end - gapsSec.reduce((x, y) => x + y, 0) * 1000 - (extraIdleSec || 0) * 1000;
    const openedAt = t; const acts = [], marks = {};
    gapsSec.forEach((g, i) => { t += g * 1000; if (i === extraIdleAt) t += (extraIdleSec || 0) * 1000; acts.push(t); marks['k' + i] = t; });
    put('timing_logs', id, { kind, refId: id, driver, plate, openedAt, submittedAt: end, sessions: [{ o: openedAt, c: end }], acts, marks, changes: 0 });
  };
  const norm = n => Array.from({ length: n }, (_, i) => 12 + (i * 7) % 25);
  const fast = n => Array.from({ length: n }, (_, i) => i < 3 ? 15 : 1);
  for (let i = 0; i < 6; i++) mkLog('tl-g' + i, 'intake', 'גיל', car(i).plate, i * 20 * H + H, norm(20));
  for (let i = 0; i < 5; i++) mkLog('tl-o' + i, 'intake', 'עופר', car(i + 5).plate, i * 22 * H + 2 * H, i % 2 ? fast(20) : norm(14));
  for (let i = 0; i < 5; i++) mkLog('tl-i' + i, 'intake', 'איתי', car(i + 9).plate, i * 18 * H + 3 * H, norm(22), 8, i % 2 ? 600 : 0);
  for (let i = 0; i < 4; i++) DRV.forEach((d, j) => mkLog(`tl-inv${i}${j}`, 'inventory', d, '', (i * 30 + j) * H, Array.from({ length: 30 + j * 10 }, () => 4 + j * 3)));
  for (let i = 0; i < 3; i++) DRV.forEach((d, j) => mkLog(`tl-td${i}${j}`, 'testdrive', d, car(i + j).plate, (i * 25 + j) * H, norm(12 + j * 2)));
  put('pro_payments', 'pp0', { who: 'חביב', amount: 850, date: ymd(12 * D), note: 'חלונות — 3 רכבים', createdBy: 'ליאל', createdAt: ago(12 * D) });
  put('pro_payments', 'pp1', { who: 'חביב', amount: 400, date: ymd(2 * D), note: '', createdBy: 'ליאל', createdAt: ago(2 * D) });
  put('battery_orders', 'bo0', { lines: [], units: 6, total: 2980, at: iso(9 * D), createdBy: 'ליאל', createdAt: ago(9 * D) });

  return out;
}
