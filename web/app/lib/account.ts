import { cookies } from "next/headers";
import { getJson, setJson } from "./store";

/**
 * חשבון גולש באתר.
 *
 * הזהות היא מספר הטלפון, והאימות נעשה בקוד חד־פעמי שנשלח אליו.
 * שם המשתמש הוא שם התצוגה בלבד. הכניסה נשמרת בעוגייה חתומה —
 * אי אפשר לזייף אותה בלי המפתח שבשרת.
 */

export const COOKIE = "anak_session";
const SESSION_DAYS = 60;

export type Alert = {
  id: string;
  make: string;
  model: string;
  category: string;
  maxPrice: number;
  maxMonthly: number;
  fromYear: number;
  createdAt: string;
};

export type Account = {
  phone: string;
  username: string;
  createdAt: string;
  alerts: Alert[];
};

/** נייד ישראלי לפורמט אחיד: 0501234567 */
export function normalizePhone(input: string) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.startsWith("972")) return `0${digits.slice(3)}`;
  return digits;
}

export const isValidPhone = (phone: string) => /^05\d{8}$/.test(phone);

const secret = () => process.env.AUTH_SECRET || "anak-dev-secret-not-for-production";

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Buffer.from(signature).toString("base64url");
}

export async function createSessionValue(phone: string) {
  const issued = Date.now().toString(36);
  const body = `${phone}.${issued}`;
  return `${body}.${await sign(body)}`;
}

async function readSessionValue(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [phone, issued, signature] = parts;
  if ((await sign(`${phone}.${issued}`)) !== signature) return null;
  const age = Date.now() - parseInt(issued, 36);
  if (!Number.isFinite(age) || age > SESSION_DAYS * 86400000) return null;
  return phone;
}

export const sessionCookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 86400,
};

/** הטלפון של הגולש המחובר, או null כשאין חיבור תקף */
export async function currentPhone() {
  const value = (await cookies()).get(COOKIE)?.value;
  return value ? readSessionValue(value) : null;
}

export const accountKey = (phone: string) => `account:${phone}`;

export async function loadAccount(phone: string) {
  return getJson<Account>(accountKey(phone));
}

export async function saveAccount(account: Account) {
  await setJson(accountKey(account.phone), account);
  return account;
}

export async function currentAccount() {
  const phone = await currentPhone();
  return phone ? loadAccount(phone) : null;
}
