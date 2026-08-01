import { getActiveVehicles, type DisplayCar } from "../../../vehicle-api";
import { getJson, keys, setJson } from "../../../lib/store";
import type { Account } from "../../../lib/account";
import { sendMessage } from "../../../lib/notify";
import { SITE_URL } from "../../../site-config";

/**
 * סריקת ההתראות מול המלאי ושליחת הודעה על רכבים חדשים שמתאימים.
 * מיועד להרצה יומית מתזמון (Vercel Cron). מוגן בסוד:
 * הקריאה חייבת לכלול Authorization: Bearer <CRON_SECRET>.
 * לכל התראה נשמר אילו רכבים כבר נשלחו, כדי לא להציק פעמיים.
 */
function matches(car: DisplayCar, alert: Account["alerts"][number]) {
  const categories = car.categories?.length ? car.categories : [car.category];
  if (alert.make !== "הכל" && car.make !== alert.make) return false;
  if (alert.model !== "הכל" && (car.baseModel || car.model) !== alert.model) return false;
  if (alert.category !== "כל הרכבים" && !categories.includes(alert.category)) return false;
  if (alert.maxPrice && (!car.price || car.price > alert.maxPrice)) return false;
  if (alert.maxMonthly && (!car.monthly || car.monthly > alert.maxMonthly)) return false;
  if (alert.fromYear && car.year < alert.fromYear) return false;
  return true;
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "לא מורשה" }, { status: 401 });
  }

  const cars = await getActiveVehicles().catch(() => [] as DisplayCar[]);
  if (!cars.length) return Response.json({ ok: true, checked: 0, sent: 0 });

  const accountKeys = await keys("account:");
  let sent = 0;

  for (const key of accountKeys) {
    const account = await getJson<Account>(key);
    if (!account?.alerts?.length) continue;

    for (const alert of account.alerts) {
      const seenKey = `seen:${account.phone}:${alert.id}`;
      const seen = new Set((await getJson<string[]>(seenKey)) ?? []);
      const fresh = cars.filter((car) => matches(car, alert) && !seen.has(car.id));
      if (!fresh.length) continue;

      const list = fresh.slice(0, 3)
        .map((car) => `${car.make} ${car.baseModel || car.model} ${car.year}${car.price ? ` — ${car.price.toLocaleString("he-IL")} ש״ח` : ""}`)
        .join("\n");
      const more = fresh.length > 3 ? `\nועוד ${fresh.length - 3} רכבים` : "";
      await sendMessage(account.phone, `היי ${account.username}, נכנסו רכבים שמתאימים לחיפוש שלך:\n${list}${more}\n${SITE_URL}/cars`);
      sent += 1;

      await setJson(seenKey, [...seen, ...fresh.map((car) => car.id)].slice(-400));
    }
  }

  return Response.json({ ok: true, checked: accountKeys.length, sent });
}
