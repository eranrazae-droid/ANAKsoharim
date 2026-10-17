# הנחיות לסוכני AI (ChatGPT / Codex ואחרים)

המאגר הזה מכיל **כמה פרויקטים נפרדים** (מכירות, מימון, הצעות מחיר ועוד).
**מותר לך לעבוד רק על מערכת התפעול — התיקייה `ops/`.** אסור לגעת בשום קובץ אחר במאגר.

לפני כל עבודה קרא: `.github/design/RULES.md` (כללים מחייבים), `.github/design/SYSTEM-REPORT.md` (אפיון), `.github/design/DESIGN-CONTRACT.md` (מה אסור לשנות).

לבדיקת מסכים בלי לגעת באפליקציה האמיתית: `bash design-preview/build.sh && python3 -m http.server 8080 -d _preview` ואז `http://localhost:8080/ops/?ui2=1` (פירוט ב-RULES.md).
