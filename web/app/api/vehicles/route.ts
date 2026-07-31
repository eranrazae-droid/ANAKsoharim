import { getActiveVehicles } from "../../vehicle-api";

export async function GET() {
  try {
    const vehicles = await getActiveVehicles();
    return Response.json(vehicles, { headers: { "Cache-Control": "public, max-age=120, s-maxage=120" } });
  } catch {
    return Response.json({ error: "לא ניתן לטעון את המלאי כרגע" }, { status: 502 });
  }
}
