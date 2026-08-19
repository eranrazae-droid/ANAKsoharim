// בדיקה: האם יש כרגע גישה למרשם הרכב (מריץ את הסריקה בשרת)
const r = await fetch('https://europe-west1-anak-soharim.cloudfunctions.net/runOwnershipScanNow', { method: 'POST' });
const j = await r.json().catch(() => null);
console.log('status:', r.status);
if (j) console.log(JSON.stringify({ ok: j.ok, reason: j.reason, checked: j.checked, notOurs: j.notOurs, unknown: j.unknown, http: j.registryHttp }, null, 1));

