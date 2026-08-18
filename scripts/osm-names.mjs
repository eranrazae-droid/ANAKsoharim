// כל כמה זמן מאגר הרכבים הממשלתי מתעדכן בפועל
const RES = '053cea08-09bc-40ec-8f7a-156f0677aff3';
const r = await (await fetch(`https://data.gov.il/api/3/action/resource_show?id=${RES}`)).json().catch(() => ({}));
const d = r.result || {};
console.log('=== מאגר רכבים פרטיים ומסחריים ===');
for (const k of ['name', 'last_modified', 'metadata_modified', 'size', 'format']) {
  if (d[k]) console.log(`  ${k}: ${d[k]}`);
}
if (!d.name) console.log('  אין גישה למאגר מהסביבה הזו (data.gov.il חוסם בקשות מחוץ לישראל)');
