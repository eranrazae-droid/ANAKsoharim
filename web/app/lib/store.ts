/**
 * אחסון פשוט של מפתח–ערך.
 *
 * שני מנועים: זיכרון מקומי לפיתוח, ו-Upstash Redis לאתר החי.
 * הבחירה נעשית לפי משתני הסביבה — אין מה לשנות בקוד.
 * כשאין Upstash מוגדר, הנתונים נשמרים בזיכרון השרת בלבד ונמחקים
 * בכל פריסה מחדש. מתאים לבדיקות, לא לאתר החי.
 */

const URL_KEY = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const storeIsPersistent = Boolean(URL_KEY && TOKEN);

type Entry = { value: string; expiresAt: number | null };
const memory = new Map<string, Entry>();

async function upstash(command: (string | number)[]) {
  const response = await fetch(`${URL_KEY}/${command.map((part) => encodeURIComponent(String(part))).join("/")}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`store ${response.status}`);
  const payload = (await response.json()) as { result: unknown };
  return payload.result;
}

export async function get(key: string): Promise<string | null> {
  if (storeIsPersistent) return ((await upstash(["get", key])) as string | null) ?? null;
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

export async function set(key: string, value: string, ttlSeconds?: number) {
  if (storeIsPersistent) {
    await upstash(ttlSeconds ? ["set", key, value, "ex", ttlSeconds] : ["set", key, value]);
    return;
  }
  memory.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
}

export async function remove(key: string) {
  if (storeIsPersistent) {
    await upstash(["del", key]);
    return;
  }
  memory.delete(key);
}

/** רשימת המפתחות תחת קידומת — לסריקת כל ההתראות */
export async function keys(prefix: string): Promise<string[]> {
  if (storeIsPersistent) return ((await upstash(["keys", `${prefix}*`])) as string[]) ?? [];
  return [...memory.keys()].filter((key) => key.startsWith(prefix));
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const setJson = (key: string, value: unknown, ttlSeconds?: number) =>
  set(key, JSON.stringify(value), ttlSeconds);
