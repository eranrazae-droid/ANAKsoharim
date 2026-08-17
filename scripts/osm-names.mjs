// אילו שדות באמת קיימים במאגרי הרכב הפתוחים — כדי לדעת מה אפשר לבדוק
// על בעלות בלי לפנות לאתר התשלומים המוגן.
const DATASETS = [
  ['רכבים פרטיים ומסחריים', '053cea08-09bc-40ec-8f7a-156f0677aff3'],
  ['רכב לא פעיל (בוטל/גרוטאה)', '851ecab1-0622-4dbe-a6c7-f950cf82abf9'],
  ['ייבוא אישי', '03adc637-b6fe-402b-9937-7c3d3afc9140'],
];
const PLATE = '53957103';   // רכב אמיתי מהמלאי

for (const [name, id] of DATASETS) {
  console.log(`\n=== ${name} ===`);
  try {
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${id}&limit=1`;
    const j = await (await fetch(url)).json();
    if (!j.success) { console.log('  שגיאה'); continue; }
    const rec = j.result.records[0] || {};
    const keys = Object.keys(rec).filter(k => !k.startsWith('_'));
    console.log('  סה"כ רשומות:', j.result.total);
    console.log('  שדות:', keys.join(', '));
    // מה שמעניין: כל שדה שנראה כמו בעלות / תאריך העברה / מספר יד
    const hot = keys.filter(k => /baal|owner|yad|hand|taarich|date|shinuy|ba_?al/i.test(k));
    if (hot.length) console.log('  ⭐ שדות רלוונטיים לבעלות:', hot.map(k => `${k}=${rec[k]}`).join(' | '));
  } catch (e) { console.log('  כשל:', e.message); }
}

// רשומה מלאה של רכב אמיתי — לראות ערכים ולא רק שמות שדות
console.log('\n=== רשומה מלאה לרכב ' + PLATE + ' ===');
const f = encodeURIComponent(JSON.stringify({ mispar_rechev: [Number(PLATE)] }));
const j = await (await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=053cea08-09bc-40ec-8f7a-156f0677aff3&filters=${f}&limit=1`)).json();
console.log(JSON.stringify(j.result?.records?.[0] || null, null, 1));
