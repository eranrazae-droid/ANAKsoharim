import { get, remove, set } from "../../../lib/store";
import { isValidPhone, normalizePhone } from "../../../lib/account";
import { exposeCodeForTesting, sendMessage } from "../../../lib/notify";

/** שליחת קוד אימות חד־פעמי לטלפון */
const CODE_TTL = 300;        // חמש דקות
const RESEND_WAIT = 45;      // המתנה בין שליחות
const DAILY_LIMIT = 8;       // תקרת בקשות ליום למספר

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  if (!isValidPhone(phone)) {
    return Response.json({ error: "מספר הטלפון אינו תקין" }, { status: 400 });
  }

  if (await get(`otp:wait:${phone}`)) {
    return Response.json({ error: "כבר שלחנו קוד. אפשר לבקש שוב בעוד רגע." }, { status: 429 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const countKey = `otp:count:${phone}:${today}`;
  const sentToday = Number((await get(countKey)) || 0);
  if (sentToday >= DAILY_LIMIT) {
    return Response.json({ error: "נשלחו יותר מדי קודים היום. נסו מחר או התקשרו אלינו." }, { status: 429 });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await set(`otp:code:${phone}`, code, CODE_TTL);
  await remove(`otp:tries:${phone}`);
  await set(`otp:wait:${phone}`, "1", RESEND_WAIT);
  await set(countKey, String(sentToday + 1), 86400);

  await sendMessage(phone, `קוד הכניסה שלך לענק הרכבים: ${code}`);

  return Response.json({ ok: true, ...(exposeCodeForTesting ? { code } : {}) });
}
