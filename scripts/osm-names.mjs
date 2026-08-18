// כל כמה זמן מאגר הרכבים הממשלתי מתעדכן בפועל
const RES = '053cea08-09bc-40ec-8f7a-156f0677aff3';
const r = await (await fetch(`https://data.gov.il/api/3/action/resource_show?id=${RES}`)).json();
const d = r.result || {};
console.log('=== מאגר רכבים פרטיים ומסחריים ===');
for (const k of ['name','created','last_modified','metadata_modified','cache_last_updated','size','format']) {
  if (d[k]) console.log(`  ${k}: ${d[k]}`);
}
if (d.package_id) {
  const p = await (await fetch(`https://data.gov.il/api/3/action/package_show?id=${d.package_id}`)).json();
  const pk = p.result || {};
  console.log('\n=== המאגר ההורה ===');
  for (const k of ['title','metadata_created','metadata_modified']) if (pk[k]) console.log(`  ${k}: ${pk[k]}`);
  const extras = (pk.extras || []).filter(e => /frequency|update|תדירות|עדכון/i.test(e.key + e.value));
  for (const e of extras) console.log(`  ${e.key}: ${e.value}`);
}
const now = new Date();
const lm = new Date(d.last_modified || d.metadata_modified);
if (!isNaN(lm)) {
  const hrs = (now - lm) / 36e5;
  console.log(`\n⏱ עדכון אחרון לפני ${hrs.toFixed(1)} שעות (עכשיו: ${now.toISOString()})`);
}
