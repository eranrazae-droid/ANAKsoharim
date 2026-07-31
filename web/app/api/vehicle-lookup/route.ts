const RESOURCE_ID = "053cea08-09bc-40ec-8f7a-156f0677aff3";

export async function GET(request: Request) {
  const plate = new URL(request.url).searchParams.get("plate")?.replace(/\D/g, "") ?? "";
  if (plate.length < 7 || plate.length > 8) return Response.json({ error: "מספר הרכב אינו תקין" }, { status: 400 });
  const filters = encodeURIComponent(JSON.stringify({ mispar_rechev: Number(plate) }));
  const endpoint = `https://data.gov.il/api/3/action/datastore_search?resource_id=${RESOURCE_ID}&limit=1&filters=${filters}`;
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error();
    const payload = await response.json() as { result?: { records?: Record<string, unknown>[] } };
    const record = payload.result?.records?.[0];
    if (!record) return Response.json({ error: "הרכב לא נמצא במאגר משרד התחבורה" }, { status: 404 });
    return Response.json({ plate: String(record.mispar_rechev ?? plate), manufacturer: String(record.tozeret_nm ?? ""), model: String(record.kinuy_mishari ?? record.degem_nm ?? ""), year: String(record.shnat_yitzur ?? ""), color: String(record.tzeva_rechev ?? ""), ownership: String(record.baalut ?? ""), modelType: String(record.sug_degem ?? ""), firstOnRoad: String(record.moed_aliya_lakvish ?? ""), testValidity: String(record.tokef_dt ?? "") });
  } catch { return Response.json({ error: "לא ניתן להתחבר כעת למאגר משרד התחבורה" }, { status: 502 }); }
}
