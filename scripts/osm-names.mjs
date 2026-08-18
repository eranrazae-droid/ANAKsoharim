// מריץ את סריקת הבעלויות ומדפיס את התוצאה בצורה קריאה
const URL = 'https://europe-west1-anak-soharim.cloudfunctions.net/runOwnershipScanNow';
console.log('⏳ מריץ סריקת בעלויות על כל המלאי…');
const t0 = Date.now();
const res = await fetch(URL, { signal: AbortSignal.timeout(540000) });
const r = await res.json();
console.log(`(${Math.round((Date.now() - t0) / 1000)} שניות)\n`);

if (!r.ok) { console.log('❌ הסריקה נכשלה:', JSON.stringify(r)); process.exit(0); }

console.log('═══════════ סיכום ═══════════');
console.log(`  רכבים שנסרקו:        ${r.checked}`);
console.log(`  ✅ תקינים (תו סחר):   ${r.checked - r.notOurs - r.unknown}`);
console.log(`  ❌ לא על תו סחר:      ${r.notOurs}`);
console.log(`  ❓ לא נמצאו במרשם:    ${r.unknown}`);
console.log(`  🆕 חדשים שטרם נבדקו: ${(r.newUnchecked || []).length}`);

const byType = {};
for (const c of r.notOursCars || []) {
  const k = c.baalut || '(לא נמצא במרשם)';
  (byType[k] ||= []).push(c);
}
if (Object.keys(byType).length) {
  console.log('\n═══════ פירוט לפי סוג בעלות ═══════');
  for (const [t, cars] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n▸ רשומים כ"${t}" — ${cars.length} רכבים:`);
    for (const c of cars) {
      console.log(`   ${c.plate}  ${[c.tozeret, c.degem, c.shnat].filter(Boolean).join(' ')}${c.ownerId ? '  · ' + c.ownerId : ''}`);
    }
  }
} else {
  console.log('\n✅ כל הרכבים במלאי רשומים על תו סחר');
}
