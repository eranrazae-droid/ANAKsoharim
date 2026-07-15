# אוטודילר / JOY MOTORS — תיעוד תקלות ופתרונות

## 🔴 תקלה: לידים מגיעים חסרים (בלי טרייד-אין / מקור / שדות חדשים)

**התסמין:** לקוח משאיר ליד עם פרטי טרייד-אין (מספר רכב), אבל באדמין הליד מגיע
בלי המספר — רק שם וטלפון.

**הסיבה השורשית:** כשמוסיפים שדה חדש לליד בקוד (למשל `source`, `tradein_plate`,
`tradein_credit`, `summary`, `interest_cars`...), חייבים להוסיף עמודה מתאימה
בטבלת `leads` ב-Supabase. אם העמודה **לא קיימת** — Postgres דוחה את **כל**
פעולת ה-INSERT, וספריית supabase-js **לא זורקת שגיאה** (מחזירה `{error}` בשקט).
הקוד אז נופל ל-fallback ששומר רק שם+טלפון, וכל השאר (כולל טרייד-אין) הולך לאיבוד.

**הפתרון:** בכל פעם שמוסיפים שדה חדש לליד — להריץ ב-Supabase:
```sql
alter table public.leads add column if not exists <שם_העמודה> <טיפוס>;
```

**רשימת העמודות המלאה של leads (להריץ בבת אחת, בטוח):**
```sql
alter table public.leads add column if not exists status text default 'פתוח';
alter table public.leads add column if not exists followup_at text;
alter table public.leads add column if not exists call_attempts int default 0;
alter table public.leads add column if not exists tradein boolean default false;
alter table public.leads add column if not exists financing boolean default false;
alter table public.leads add column if not exists tradein_plate text;
alter table public.leads add column if not exists tradein_credit text;
alter table public.leads add column if not exists interest_cars text;
alter table public.leads add column if not exists summary text;
alter table public.leads add column if not exists source text;
```

**הגנה בקוד:** ה-INSERT-ים בצד הלקוח משתמשים ב-fallback מדורג — מנסים שמירה מלאה,
ואם נכשל מנסים בלי `source` (אבל עם טרייד-אין), ורק בסוף שמירה בסיסית. עדיין —
**הפתרון הנכון הוא להריץ את ה-SQL** כדי שכל העמודות יתקיימו.

---

## 🔴 תקלה: שליפת פרטי רכב (טרייד-אין) ממשרד התחבורה לא עובדת

**הסיבה:** הדפדפן חוסם קריאה ישירה מהאתר ל-data.gov.il (CORS). כשפותחים את
הכתובת ידנית בדפדפן זה עובד, אבל fetch מהאתר נחסם.

**הפתרון:** פונקציית שרת ב-Netlify — `netlify/functions/govproxy.js` — שולפת בצד
השרת ומחזירה עם כותרות CORS פתוחות. הקוד באדמין (`govFetchRecords`) מנסה קודם
ישירות, ואם נחסם עובר אוטומטית דרך הפרוקסי:
`/.netlify/functions/govproxy?resource=<id>&q=<plate>`.
מוגדר ב-`netlify.toml` תחת `[functions] directory = "netlify/functions"`.

**מאגרי data.gov.il בשימוש:**
- רכב פרטי/מסחרי: `053cea08-09bc-40ec-8f7a-156f0677aff3` (שדה מפתח: `mispar_rechev`)
- מבחני רכב (טסט, ק"מ אחרון): `56063a99-8a3e-4ff4-912e-5966c0279bad`
- היסטוריית בעלויות: `bb2355dc-9ec7-4f06-9c3f-3344672171da` (שדות: `baalut_dt`, `baalut`)

---

## עיקרון כללי לזכור
**כל שדה חדש שמכניסים ל-Supabase (leads / earnings / inventory) — חייב עמודה
מתאימה בטבלה, אחרת השמירה נכשלת בשקט ונתונים הולכים לאיבוד.** תמיד לספק את
ה-`ALTER TABLE ... add column if not exists` יחד עם שינוי הקוד.
