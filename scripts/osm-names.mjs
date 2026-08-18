// מריץ את סריקת הבעלויות בשרת ומדפיס את התוצאה האמיתית
const URL = 'https://europe-west1-anak-soharim.cloudfunctions.net/runOwnershipScanNow';
const r = await fetch(URL, { method: 'POST' });
const t = await r.text();
console.log('status:', r.status);
let j = null; try { j = JSON.parse(t); } catch { console.log(t.slice(0, 800)); }
if (j) {
  console.log('נבדקו:', j.checked, '| לא על תו סחר:', j.notOurs, '| לא נמצאו במרשם:', j.unknown);
  const list = (j.notOursCars || []).slice(0, 15).map(c => `${c.plate} · ${c.baalut || '—'}`);
  console.log('דוגמאות לא על תו סחר:\n  ' + list.join('\n  '));
  console.log('ירדו מהמלאי:', (j.goneFromStock || []).length);
  console.log('סטטוס מול המאגר:', JSON.stringify(j.registryHttp));
}
