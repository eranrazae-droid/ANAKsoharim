// אימות הקואורדינטות של ניר צבי וגלילות מול מקור כתובות אמיתי
const places = ['ניר צבי', 'גלילות', 'צומת גלילות'];
for (const q of places) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=il&accept-language=he&q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'anak-soharim/1.0 (ops app)' } });
    const j = await r.json();
    console.log(`\n=== ${q} ===`);
    for (const h of j) console.log(`  ${Number(h.lat).toFixed(4)}, ${Number(h.lon).toFixed(4)}  ·  ${h.display_name.slice(0, 90)}`);
    if (!j.length) console.log('  לא נמצא');
  } catch (e) { console.log(q, 'שגיאה:', e.message); }
  await new Promise(r => setTimeout(r, 1200));
}
