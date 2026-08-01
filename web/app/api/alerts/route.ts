import { currentAccount, saveAccount, type Alert } from "../../lib/account";

/** ההתראות של הגולש המחובר */
const MAX_ALERTS = 5;

const clean = (value: unknown, fallback = "") => String(value ?? "").trim().slice(0, 40) || fallback;
const number = (value: unknown) => Math.max(0, Math.min(2000000, Number(value) || 0));

export async function GET() {
  const account = await currentAccount();
  if (!account) return Response.json({ error: "לא מחובר" }, { status: 401 });
  return Response.json({ alerts: account.alerts });
}

export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return Response.json({ error: "לא מחובר" }, { status: 401 });
  if (account.alerts.length >= MAX_ALERTS) {
    return Response.json({ error: `אפשר להגדיר עד ${MAX_ALERTS} התראות` }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const alert: Alert = {
    id: Math.random().toString(36).slice(2, 10),
    make: clean(body.make, "הכל"),
    model: clean(body.model, "הכל"),
    category: clean(body.category, "כל הרכבים"),
    maxPrice: number(body.maxPrice),
    maxMonthly: number(body.maxMonthly),
    fromYear: Math.min(2030, Math.max(0, Number(body.fromYear) || 0)),
    createdAt: new Date().toISOString(),
  };

  account.alerts = [...account.alerts, alert];
  await saveAccount(account);
  return Response.json({ alerts: account.alerts });
}

export async function DELETE(request: Request) {
  const account = await currentAccount();
  if (!account) return Response.json({ error: "לא מחובר" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  account.alerts = account.alerts.filter((alert) => alert.id !== id);
  await saveAccount(account);
  return Response.json({ alerts: account.alerts });
}
