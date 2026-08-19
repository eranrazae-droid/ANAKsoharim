// בדיקה: האם הסריקה עוברת עכשיו דרך הממסר הישראלי
const r = await fetch('https://europe-west1-anak-soharim.cloudfunctions.net/runOwnershipScanNow', { method: 'POST' });
const j = await r.json().catch(() => null);
console.log('status:', r.status);
if (j) console.log(JSON.stringify({ ok: j.ok, reason: j.reason, checked: j.checked, notOurs: j.notOurs, unknown: j.unknown, http: j.registryHttp }));

