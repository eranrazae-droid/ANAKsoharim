import inventorySnapshot from "./inventory-snapshot.json";
import type { DisplayCar } from "./vehicle-types";

export type { DisplayCar } from "./vehicle-types";
export { propulsionTechnology } from "./vehicle-types";

/**
 * מקורות המלאי.
 *
 * ברירת המחדל היא המערכת הקיימת. כדי להעביר את המלאי למערכת אחרת
 * (למשל ה-CRM) מגדירים ב-Vercel את משתני הסביבה — בלי לגעת בקוד:
 *
 *   VEHICLES_API_URL         נתיב שמחזיר את הרכבים הפעילים כ-JSON
 *   VEHICLE_IMAGES_XML_URL   נתיב ה-XML של תמונות הרכבים
 *   VEHICLES_API_TOKEN       אסימון גישה, אם המקור החדש דורש אימות
 *
 * מבנה השדות הנדרש מוגדר ב-normalizeVehicle למטה.
 */
export const VEHICLES_API =
  process.env.VEHICLES_API_URL ||
  "https://phpstack-1347359-5276985.cloudwaysapps.com/comigo-anakarehevim/index.php/api/GetActiveVehicles";

export const VEHICLE_IMAGES_XML =
  process.env.VEHICLE_IMAGES_XML_URL || "https://03-5189189.netstyle.co.il/xml/yad2/";


function cleanCategories(value: unknown) {
  return Array.from(new Set(
    String(value ?? "")
      .split(",")
      .map((item) => item.replace(/-/g, "").trim())
      .filter(Boolean),
  ));
}

async function getVehicleImageMap() {
  const map = new Map<string, string[]>();
  try {
    const response = await fetch(VEHICLE_IMAGES_XML, { next: { revalidate: 300 } });
    if (!response.ok) return map;
    const xml = await response.text();
    const cars = xml.match(/<CAR>[\s\S]*?<\/CAR>/g) ?? [];
    for (const block of cars) {
      const id = block.match(/<CarNumber>\s*(\d+)\s*<\/CarNumber>/)?.[1];
      if (!id) continue;
      const images = Array.from(block.matchAll(/<CarImage\s+Path="([^"]+)"/g), (match) => match[1])
        .filter((url, index, list) => url && list.indexOf(url) === index);
      if (images.length) map.set(id, images);
    }
  } catch {
    return map;
  }
  return map;
}

function sortVehicles(cars: DisplayCar[]) {
  return [...cars].sort((a, b) =>
    a.make.localeCompare(b.make, "he") ||
    a.model.localeCompare(b.model, "he") ||
    b.year - a.year,
  );
}

export function normalizeVehicle(raw: Record<string, unknown>): DisplayCar {
  const baseModel = String(raw.ank_id_model ?? "").trim();
  const subModel = String(raw.ank_id_sub_model ?? "").trim();
  const categories = cleanCategories(raw.ank_s_category);
  return {
    id: String(raw.ank_s_car_number ?? raw.MOT_CODE ?? ""), image: null,
    // סרטון אחד לכל רכב, אם המערכת מספקת. יותר מאחד לא מוצג.
    video: String(raw.ank_s_video ?? raw.video ?? "") || null,
    // סבב 360 מעלות: רשימת פריימים מסודרת, מופרדת בפסיקים.
    // אין פריימים — המקטע פשוט לא מוצג. ראה IMAGES.md.
    spin360: String(raw.ank_s_360 ?? raw.spin360 ?? "").split(",").map((x) => x.trim()).filter(Boolean),
    make: String(raw.ank_id_manufacturer ?? "").trim(), model: `${baseModel} ${subModel}`.trim(),
    baseModel, subModel, advance: Number(raw.ank_m_advance_payment ?? 0), openRoof: Boolean(raw.ank_b_open_roof),
    year: Number(raw.ank_id_year_of_manufacture ?? 0), monthly: Number(raw.ank_m_monthly_payment ?? 0),
    category: categories[0] ?? "כל הרכבים", categories, price: Number(raw.ank_m_asking_price ?? 0),
    mileage: String(raw.ank_s_mileage ?? "0"), hand: String(raw.ank_n_number_of_ownership ?? ""),
    ownership: String(raw.ank_pl_orginallity ?? "לא צוין"), engine: String(raw.ank_gpl_engine_type ?? "לא צוין"),
    color: String(raw.ank_gpl_color ?? "לא צוין"), doors: String(raw.ank_n_cars_door ?? ""), seats: String(raw.ank_n_seats ?? ""),
    engineCapacity: String(raw.ank_s_engine_capacity ?? ""), horsePower: String(raw.ank_s_horse_power ?? ""),
    gear: String(raw.ank_gpl_gear ?? ""), drivetrain: String(raw.ank_gpl_propulsion_system ?? ""),
    test: String(raw.ank_dt_test ?? ""), body: String(raw.ank_s_merkav ?? ""), extras: String(raw.ank_s_extras ?? ""), remarks: String(raw.ank_s_remarks ?? ""),
    // מחיר מחירון ומספר רישוי מגיעים כבר היום מהמערכת.
    // המזהה נופל במקרה הצורך ל-MOT_CODE, ולכן מספר הרישוי
    // נלקח מהשדה שלו ולא ממנו.
    listPrice: Number(raw.ank_m_price_list ?? 0),
    plate: String(raw.ank_s_car_number ?? ""),
    daysInStock: Number(raw.ank_s_days_in_stock ?? -1),
    // סטטוס הרכב יגיע מה-CRM. כל עוד השדה לא נשלח הערך ריק
    // והשורה פשוט לא מוצגת בכרטיס — בלי שגיאה ובלי מידע שגוי.
    // מקבלים כאן כמה שמות אפשריים כדי שהחיבור יעבוד בלי
    // שינוי קוד. ראה README.
    status: String(raw.ank_s_status ?? raw.ank_gpl_status ?? raw.status ?? ""),
    // מיקום הרכב. כשהמערכת לא שולחת — מוצגת כתובת המגרש,
    // שם נמצאים כל הרכבים שבמלאי.
    location: String(raw.ank_s_location ?? raw.ank_gpl_location ?? raw.location ?? ""),
  };
}

export async function getActiveVehicles(): Promise<DisplayCar[]> {
  let cars: DisplayCar[];
  try {
    // רענון כל 10 דקות במקום בכל טעינת עמוד — מוריד עומס מה-API ומאיץ את האתר.
    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.VEHICLES_API_TOKEN) headers.Authorization = `Bearer ${process.env.VEHICLES_API_TOKEN}`;
    const response = await fetch(VEHICLES_API, { headers, next: { revalidate: 600 } });
    if (!response.ok) throw new Error(`Inventory API returned ${response.status}`);
    const data = await response.json() as Record<string, unknown>[];
    cars = data.map(normalizeVehicle).filter((car) => car.id && car.make && car.model);
  } catch {
    cars = (inventorySnapshot as Record<string, unknown>[]).map(normalizeVehicle).filter((car) => car.id && car.make && car.model);
  }
  const imageMap = await getVehicleImageMap();
  return sortVehicles(cars.map((car) => {
    const images = imageMap.get(car.id) ?? [];
    return { ...car, image: images[0] ?? car.image, images };
  }));
}

