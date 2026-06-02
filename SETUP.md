# הגדרת מערכת ההתראות

## שלב 1 — צור בוט טלגרם (5 דקות)

1. פתח טלגרם וחפש `@BotFather`
2. שלח `/newbot` ועקוב אחרי ההוראות
3. קבל **Token** (נראה כך: `123456789:AAF...`)
4. שלח הודעה לבוט שלך (כדי לפתוח שיחה)
5. פתח בדפדפן:
   ```
   https://api.telegram.org/botTOKEN_שלך/getUpdates
   ```
6. מצא את `"chat":{"id":...}` — זה ה-**Chat ID** שלך

---

## שלב 2 — התקן Python ותלויות

```bash
pip install -r requirements.txt
playwright install chromium
```

---

## שלב 3 — ייצא חיפושים מהדשבורד

1. פתח את האתר
2. לחץ על טאב "🔔 התראות Marketplace"
3. הוסף חיפושים
4. לחץ "⬇️ ייצוא JSON"
5. שמור את הקובץ `market_alerts.json` בתיקיית הסקריפט

---

## שלב 4 — הגדר משתני סביבה

**Windows:**
```cmd
set TELEGRAM_TOKEN=123456789:AAF...
set TELEGRAM_CHAT_ID=987654321
python marketplace_monitor.py
```

**Mac/Linux:**
```bash
export TELEGRAM_TOKEN="123456789:AAF..."
export TELEGRAM_CHAT_ID="987654321"
python marketplace_monitor.py
```

**קובץ .env (אופציונלי):**
```
TELEGRAM_TOKEN=123456789:AAF...
TELEGRAM_CHAT_ID=987654321
FB_EMAIL=your@email.com    # אופציונלי — לתוצאות טובות יותר
FB_PASS=yourpassword       # אופציונלי
```

---

## שלב 5 — הרץ

```bash
python marketplace_monitor.py
```

הסקריפט ירוץ כל 10 דקות ויתריע בטלגרם על מודעות חדשות.

---

## הרצה ב-VPS / שרת רקע

```bash
# Linux — הרצה ברקע
nohup python marketplace_monitor.py &

# או עם screen
screen -S monitor
python marketplace_monitor.py
# Ctrl+A, D — לצאת מבלי לעצור
```
