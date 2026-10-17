# סביבת הדגמה

עותק של אפליקציית התפעול עם נתונים מדומים, לבדיקת עיצוב בלי לגעת באפליקציה האמיתית.

- `mock/firebase-*.js` — מחליפים את Firebase (מסד נתונים, קבצים, הזדהות) בזיכרון הדפדפן.
- `mock/seed.js` — נתוני ההדגמה. כולם מומצאים.
- `mock/guard.js` — חוסם כל פנייה החוצה (שרת, WhatsApp, SMS, טלגרם, התראות).
- `build.sh` — מעתיק את `ops/` ל-`_preview/ops/`, מחבר את התחליפים, ומחליף את מפתחות Firebase במפתחות מזויפים.

```bash
bash design-preview/build.sh
python3 -m http.server 8080 -d _preview   # http://localhost:8080/ops/?ui2=1
```
משתמש אחר: `?as=גיל` וכו׳. רענון מחזיר את הנתונים להתחלה.
