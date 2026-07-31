import { BUSINESS, SITE_NAME } from "../../site-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * קליטת לידים מכל טפסי האתר.
 *
 * יעדי שליחה נקבעים במשתני סביבה ב-Vercel — אין מפתחות בקוד:
 *
 *   LEAD_WEBHOOK_URL   כתובת Webhook (Make / Zapier / כל שירות אחר).
 *                      מקבלת JSON ומאפשרת לנתב לוואטסאפ, מייל או CRM
 *                      בלי לגעת בקוד. זו הדרך המומלצת.
 *
 *   LEAD_EMAIL_TO      כתובת מייל לקבלת לידים
 *   RESEND_API_KEY     מפתח Resend לשליחת המייל
 *   LEAD_EMAIL_FROM    כתובת שולח מאומתת ב-Resend
 *
 * אם לא הוגדר אף יעד, הבקשה נכשלת במפורש ומחזירה שגיאה ללקוח.
 * זה מכוון: עדיף הודעת שגיאה גלויה מאשר ליד שנעלם בשקט.
 */

const FIELD_LABELS: Record<string, string> = {
  name: "שם מלא",
  phone: "טלפון",
  email: "דוא״ל",
  city: "עיר",
  plate: "מספר רישוי",
  mileage: "קילומטראז׳",
  price: "מחיר מבוקש",
  vehicle: "רכב",
  notes: "הערות",
};

const FORM_LABELS: Record<string, string> = {
  hero: "ייעוץ מהיר — דף הבית",
  trade: "טרייד אין",
  sell: "מכירת רכב",
  finance: "בקשת מימון",
  contact: "צור קשר",
  car: "פנייה על רכב",
};

const MAX_FIELD_LENGTH = 500;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const recentRequests = new Map<string, number[]>();

function isRateLimited(ip: string) {
  const now = Date.now();
  const hits = (recentRequests.get(ip) ?? []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  recentRequests.set(ip, hits);

  // ניקוי תקופתי כדי שהמפה לא תגדל ללא גבול.
  if (recentRequests.size > 500) {
    for (const [key, times] of recentRequests) {
      if (times.every((time) => now - time >= RATE_LIMIT_WINDOW_MS)) recentRequests.delete(key);
    }
  }

  return hits.length > RATE_LIMIT_MAX;
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  // מספר ישראלי: 9 ספרות (קווי) או 10 (נייד), מתחיל ב-0.
  if (!/^0\d{8,9}$/.test(digits)) return null;
  return digits;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_FIELD_LENGTH) : "";
}

async function deliverToWebhook(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
}

async function deliverByEmail(payload: Record<string, string>, formLabel: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_EMAIL_TO;
  const from = process.env.LEAD_EMAIL_FROM;
  if (!apiKey || !to || !from) throw new Error("Email delivery is not fully configured");

  const rows = Object.entries(payload)
    .filter(([, value]) => value)
    .map(([key, value]) => `<tr><td style="padding:4px 12px;font-weight:bold">${FIELD_LABELS[key] ?? key}</td><td style="padding:4px 12px">${value}</td></tr>`)
    .join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: to.split(",").map((address) => address.trim()),
      subject: `ליד חדש מהאתר — ${formLabel}`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>ליד חדש מ${SITE_NAME}</h2><table>${rows}</table></div>`,
    }),
  });

  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return Response.json(
      { error: "נשלחו יותר מדי פניות. נסו שוב בעוד מספר דקות." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  // מלכודת ספאם: שדה מוסתר שרק בוטים ממלאים.
  if (clean(body.company)) {
    return Response.json({ ok: true });
  }

  const name = clean(body.name);
  const phone = normalizePhone(clean(body.phone));

  if (name.length < 2) {
    return Response.json({ error: "יש להזין שם מלא." }, { status: 400 });
  }
  if (!phone) {
    return Response.json({ error: "יש להזין מספר טלפון תקין." }, { status: 400 });
  }

  const form = clean(body.form) || "unknown";
  const formLabel = FORM_LABELS[form] ?? form;

  const fields: Record<string, string> = { name, phone };
  for (const key of ["email", "city", "plate", "mileage", "price", "vehicle", "notes"]) {
    const value = clean(body[key]);
    if (value) fields[key] = value;
  }

  const lead = {
    ...fields,
    form,
    formLabel,
    page: clean(body.page),
    business: SITE_NAME,
    businessPhone: BUSINESS.phone,
    receivedAt: new Date().toISOString(),
  };

  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  const hasEmail = Boolean(process.env.RESEND_API_KEY && process.env.LEAD_EMAIL_TO && process.env.LEAD_EMAIL_FROM);

  if (!webhookUrl && !hasEmail) {
    console.error(
      "[leads] אין יעד שליחה מוגדר. יש להגדיר LEAD_WEBHOOK_URL או RESEND_API_KEY + LEAD_EMAIL_TO + LEAD_EMAIL_FROM.",
      lead,
    );
    return Response.json(
      { error: `לא הצלחנו לשלוח את הפנייה. אנא התקשרו אלינו ל-${BUSINESS.phone}.` },
      { status: 503 },
    );
  }

  // מספיק שיעד אחד יצליח כדי שהליד לא ילך לאיבוד.
  const deliveries = await Promise.allSettled([
    ...(webhookUrl ? [deliverToWebhook(webhookUrl, lead)] : []),
    ...(hasEmail ? [deliverByEmail(fields, formLabel)] : []),
  ]);

  const delivered = deliveries.some((result) => result.status === "fulfilled");

  if (!delivered) {
    for (const result of deliveries) {
      if (result.status === "rejected") console.error("[leads] כשל בשליחה:", result.reason, lead);
    }
    return Response.json(
      { error: `לא הצלחנו לשלוח את הפנייה. אנא התקשרו אלינו ל-${BUSINESS.phone}.` },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
