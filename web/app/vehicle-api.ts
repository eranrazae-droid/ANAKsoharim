export const VEHICLES_API = "https://phpstack-1347359-5276985.cloudwaysapps.com/comigo-anakarehevim/index.php/api/GetActiveVehicles";
export const VEHICLE_IMAGES_XML = "https://03-5189189.netstyle.co.il/xml/yad2/";
import inventorySnapshot from "./inventory-snapshot.json";

export type DisplayCar = {
  id: string; image?: string | null; images?: string[]; make: string; model: string; year: number; monthly: number; category: string; categories?: string[];
  price: number; mileage: string; hand: string; ownership: string; engine: string; color: string; doors: string; seats: string;
  baseModel?: string; subModel?: string; advance?: number; openRoof?: boolean; engineCapacity?: string; horsePower?: string; gear?: string; drivetrain?: string; test?: string; body?: string; extras?: string; remarks?: string;
};

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
  };
}

export async function getActiveVehicles(): Promise<DisplayCar[]> {
  let cars: DisplayCar[];
  try {
    // רענון כל 10 דקות במקום בכל טעינת עמוד — מוריד עומס מה-API ומאיץ את האתר.
    const response = await fetch(VEHICLES_API, { headers: { Accept: "application/json" }, next: { revalidate: 600 } });
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
