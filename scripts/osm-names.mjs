// אימות הגשר לגוגל מפות מקצה לקצה: פינג, המרת כתובת, ומסלול הליכה —
// מול השרת האמיתי עם המפתח האמיתי. משווה לערכים הידועים מגוגל מפות.
const BASE = 'https://europe-west1-anak-soharim.cloudfunctions.net/mapsProxy';

const ping = await (await fetch(`${BASE}?op=ping`)).json();
console.log('פינג:', JSON.stringify(ping));
if (!ping.hasKey) { console.log('❌ אין מפתח מוגדר'); process.exit(1); }

// הכתובת מהמקרה של הנהג: שנקר 15 פתח תקווה
const g = await (await fetch(`${BASE}?op=geocode&address=${encodeURIComponent('אריה שנקר 15')}&city=${encodeURIComponent('פתח תקווה')}`)).json();
console.log('גיאוקוד שנקר 15 פ"ת:', JSON.stringify(g));
if (!g.found) { console.log('❌ לא נמצא'); process.exit(1); }

// מסלול ממנה לתחנת קרית אריה (32.0980,34.8620) — בגוגל של המשתמש: 2.5 ק"מ / 6 דק' נסיעה
const r = await (await fetch(`${BASE}?op=route&from=${g.lat},${g.lng}&to=32.0980,34.8620`)).json();
console.log('מסלול לתחנה:', JSON.stringify(r));
if (!r.ok || !r.walking) { console.log('❌ אין מסלול'); process.exit(1); }
console.log(`🚶 הליכה: ${r.walking.km.toFixed(1)} ק"מ · ${Math.round(r.walking.min)} דק'`);
console.log(`🚗 נסיעה: ${r.driving.km.toFixed(1)} ק"מ · ${Math.round(r.driving.min)} דק'`);
console.log('✅ הגשר לגוגל עובד');
