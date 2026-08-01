/**
 * שליחת הודעות לגולשים — קוד אימות והתראות על רכבים.
 *
 * ההודעה נשלחת ל-SMS_WEBHOOK_URL, כתובת אחת שמקבלת {phone, text}.
 * אפשר לחבר אליה כל ספק SMS או וואטסאפ, ישירות או דרך Make/Zapier.
 * כשאין כתובת מוגדרת ההודעה נרשמת ביומן השרת בלבד.
 */
export async function sendMessage(phone: string, text: string) {
  const endpoint = process.env.SMS_WEBHOOK_URL;
  if (!endpoint) {
    console.log(`[הודעה ל-${phone}] ${text}`);
    return false;
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify({ phone, text }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * במצב פיתוח, כשאין ספק SMS מוגדר, הקוד מוחזר גם בתשובת השרת
 * כדי שאפשר יהיה לבדוק את התהליך. באתר החי זה כבוי.
 */
export const exposeCodeForTesting =
  !process.env.SMS_WEBHOOK_URL && process.env.NEXT_PUBLIC_SITE_LIVE !== "true";
