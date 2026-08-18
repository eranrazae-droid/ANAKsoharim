// אילו ערכי "בעלות" בכלל קיימים במרשם — כדי לדעת לאילו קבוצות לפצל
const DS = '053cea08-09bc-40ec-8f7a-156f0677aff3';
const seen = {};
for (let off = 0; off < 24000; off += 4000) {
  const j = await (await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${DS}&limit=4000&offset=${off}`)).json();
  for (const r of j.result.records) {
    const b = (r.baalut || '(ריק)').trim();
    seen[b] = (seen[b] || 0) + 1;
  }
}
console.log('ערכי baalut שנמצאו במרשם:');
for (const [k, v] of Object.entries(seen).sort((a, b) => b[1] - a[1])) console.log(`  ${k} — ${v}`);
