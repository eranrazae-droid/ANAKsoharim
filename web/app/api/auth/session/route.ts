import { cookies } from "next/headers";
import { COOKIE, currentAccount } from "../../../lib/account";

/** מי מחובר כרגע */
export async function GET() {
  const account = await currentAccount();
  if (!account) return Response.json({ account: null });
  return Response.json({ account: { username: account.username, phone: account.phone, alerts: account.alerts } });
}

/** יציאה מהחשבון */
export async function DELETE() {
  (await cookies()).delete(COOKIE);
  return Response.json({ ok: true });
}
