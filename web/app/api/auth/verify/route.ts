import { cookies } from "next/headers";
import { get, remove, set } from "../../../lib/store";
import {
  COOKIE, createSessionValue, isValidPhone, loadAccount,
  normalizePhone, saveAccount, sessionCookieOptions,
} from "../../../lib/account";

/** אימות הקוד וכניסה לחשבון */
const MAX_TRIES = 5;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const code = String(body.code || "").replace(/\D/g, "");
  const username = String(body.username || "").trim().slice(0, 30);

  if (!isValidPhone(phone)) return Response.json({ error: "מספר הטלפון אינו תקין" }, { status: 400 });

  const expected = await get(`otp:code:${phone}`);
  if (!expected) return Response.json({ error: "הקוד פג תוקף. בקשו קוד חדש." }, { status: 400 });

  const tries = Number((await get(`otp:tries:${phone}`)) || 0);
  if (tries >= MAX_TRIES) {
    await remove(`otp:code:${phone}`);
    return Response.json({ error: "יותר מדי ניסיונות. בקשו קוד חדש." }, { status: 429 });
  }

  if (code !== expected) {
    await set(`otp:tries:${phone}`, String(tries + 1), 300);
    return Response.json({ error: "הקוד אינו נכון" }, { status: 400 });
  }

  const existing = await loadAccount(phone);
  if (!existing && !username) {
    // חשבון חדש — הקוד נשאר בתוקף עד שייבחר שם משתמש
    return Response.json({ ok: true, needsUsername: true });
  }

  await remove(`otp:code:${phone}`);
  await remove(`otp:tries:${phone}`);

  const account = existing
    ? { ...existing, username: username || existing.username }
    : { phone, username, createdAt: new Date().toISOString(), alerts: [] };
  await saveAccount(account);

  (await cookies()).set(COOKIE, await createSessionValue(phone), sessionCookieOptions);
  return Response.json({ ok: true, account: { username: account.username, phone: account.phone, alerts: account.alerts } });
}
