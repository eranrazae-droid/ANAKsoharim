import { VEHICLES_XML } from "../../vehicle-api";
import { describeVehiclesXml, parseVehiclesXml } from "../../vehicle-xml";

/**
 * בדיקת מקור המלאי.
 *
 * מציג מה הפיד החזיר בפועל: כמה רכבים נקראו, כמה תמונות יש לרכב
 * הראשון, ואילו שדות קיימים בו. עמוד עזר לבדיקות בלבד — לא מקושר
 * משום מקום באתר ולא מופיע בגוגל.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(VEHICLES_XML, { cache: "no-store" });
    if (!response.ok) {
      return Response.json({ url: VEHICLES_XML, ok: false, status: response.status });
    }
    const xml = await response.text();
    const cars = parseVehiclesXml(xml, VEHICLES_XML);
    return Response.json({
      url: VEHICLES_XML,
      ok: true,
      bytes: xml.length,
      cars: cars.length,
      withImages: cars.filter((car) => car.images?.length).length,
      feed: describeVehiclesXml(xml),
      first: cars[0] ?? null,
    });
  } catch (error) {
    return Response.json({ url: VEHICLES_XML, ok: false, error: String(error) }, { status: 502 });
  }
}
