/* ─────────────────────────────────────────────────────────────
   רכבי דוגמה — לתצוגת עיצוב בלבד.
   מוצגים רק כאשר אין חיבור למלאי האמיתי.
   ברגע שה-CRM מחובר: לשנות ב-site-core.js את DEMO_WHEN_EMPTY ל-false,
   ואפשר למחוק את הקובץ הזה.
   ───────────────────────────────────────────────────────────── */

const A = 'images/demo-car-1.svg';
const B = 'images/demo-car-2.svg';
const C = 'images/demo-car-3.svg';

export const DEMO_CARS = [
  // הרכב היחיד עם צילום אמיתי מהמגרש — להמחשה בדף הרכב
  { id:'demo-1', plate:'12345601', make:'ג׳יפ', model:'רנגלר', trim:'Rubicon',
    year:2024, hand:1, km:12000, price:385000, gearbox:'אוטומטית', fuel:'בנזין',
    engine:'1995', color:'לבן', test:'2027-04-18', body:'רכב שטח', featured:true,
    description:'רכב צעיר עם קילומטראז׳ נמוך, הנעה 4×4.\nצמיגי שטח, פנים בעור אדום, אחריות יצרן בתוקף.',
    images:['images/demo-jeep.jpg'] },

  { id:'demo-2', plate:'22345602', make:'טויוטה', model:'קורולה', trim:'Hybrid Premium',
    year:2021, hand:2, km:72000, price:112000, gearbox:'אוטומטית', fuel:'היברידי',
    engine:'1798', color:'לבן', test:'2026-11-14', body:'האצ׳בק',
    description:'צריכת דלק נמוכה, מתאים לנסיעות עירוניות.',
    images:[B, A] },

  { id:'demo-3', plate:'32345603', make:'קיה', model:'ספורטאז׳', trim:'GT-Line',
    year:2023, hand:1, km:21000, price:168000, gearbox:'אוטומטית', fuel:'בנזין',
    engine:'1598', color:'אפור', test:'2027-01-20', body:'ג׳יפון', featured:true,
    description:'רכב צעיר עם קילומטראז׳ נמוך. אחריות יצרן בתוקף.',
    images:[C, A, B] },

  { id:'demo-4', plate:'42345604', make:'יונדאי', model:'i20', trim:'Inspire',
    year:2020, hand:2, km:88000, price:69000, gearbox:'אוטומטית', fuel:'בנזין',
    engine:'1368', color:'כסוף', test:'2026-09-02', body:'האצ׳בק',
    images:[B] },

  { id:'demo-5', plate:'52345605', make:'BMW', model:'X3', trim:'xDrive20d',
    year:2020, hand:1, km:96000, price:245000, gearbox:'אוטומטית', fuel:'דיזל',
    engine:'1995', color:'שחור', test:'2026-12-11', body:'ג׳יפ',
    description:'הנעה כפולה, חבילת M Sport.',
    images:[A, C] },

  { id:'demo-6', plate:'62345606', make:'מאזדה', model:'3', trim:'Executive',
    year:2019, hand:3, km:121000, price:78000, gearbox:'אוטומטית', fuel:'בנזין',
    engine:'1998', color:'אדום', test:'2026-08-30', body:'סדאן', status:'נמכר',
    images:[C] },
];
