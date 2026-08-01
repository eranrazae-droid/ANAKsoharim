# אתר הלקוחות — ענק הרכבים

אתר תדמית ומלאי ללקוחות. נפרד לחלוטין מהמערכת התפעולית (`ops/`) ומכלי המכירות שבשורש.

## הדפים
| קובץ | מה זה |
|---|---|
| `index.html` | דף הבית — hero, חיפוש מהיר, רכבים נבחרים, למה אנחנו, טופס פנייה |
| `inventory.html` | כל המלאי + סינון ומיון |
| `car.html?id=…` | דף רכב — גלריה, מפרט, הערכת החזר חודשי, נסיעת מבחן |
| `css/site.css` | מערכת העיצוב (צבעי המותג: נייבי `#0d1f3c`, זהב `#c9a227`) |
| `js/site-core.js` | **כל החיבור לנתונים** — Firebase, קריאת מלאי, שליחת לידים |
| `js/reveal.js` | אנימציית הופעה בגלילה (עצמאי, בלי תלויות) |

## החיבור ל-CRM

האתר קורא רכבים מ-collection אחד ב-Firestore (מסד `default`, אותו פרויקט `anak-soharim`).
כל ההגדרות נמצאות בראש `js/site-core.js`:

```js
export const CARS_COLLECTION  = 'cars';    // שם ה-collection של הרכבים ב-CRM
export const LEADS_COLLECTION = 'leads';   // לכאן נכנסות הפניות מהאתר
```

**אם שמות השדות ב-CRM שונים** — לא צריך לגעת בשום דף. מוסיפים את השם ל-`FIELDS` באותו קובץ:

```js
const FIELDS = {
  price: ['price','askingPrice','salePrice','מחיר'],   // הראשון שנמצא — מנצח
  ...
};
```

תמונות נקראות מ-`images` / `photos` / `gallery` (מערך או מחרוזת מופרדת בפסיקים).

### מה לא מוצג באתר
- רכב עם `status` שמכיל "טיוטה" / `draft`, או `published: false` / `hidden: true` — לא מופיע כלל
- רכב עם `status` שמכיל "נמכר" / `sold`, או `sold: true` — מסומן "נמכר" ומופיע רק בסינון מפורש
- רכב עם `featured: true` — מופיע ב"רכבים נבחרים" בדף הבית

## לידים

כל פנייה מהאתר נשמרת ב-`leads`:

```
{ name, phone, message, type, carId, carPlate, carTitle,
  source:'website', status:'new', createdAt }
```

`type` יכול להיות `contact` (טופס צור קשר) או `test_drive` (בקשת נסיעת מבחן מדף הרכב).

## הגדרות העסק
טלפון, שעות פעילות ושם — בראש `js/site-core.js` באובייקט `SITE`.
