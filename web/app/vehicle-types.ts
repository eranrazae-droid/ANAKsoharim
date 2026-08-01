/**
 * טיפוסי הרכב והפונקציות הטהורות שנגזרות מהם.
 *
 * הקובץ הזה חייב להישאר נקי מייבוא של נתונים — במיוחד של
 * inventory-snapshot.json — כי רכיבי לקוח מייבאים ממנו, וכל מה
 * שהם מייבאים נארז לתוך קוד הדפדפן. הפרדה זו חוסכת מאות קילובייט.
 */

export type DisplayCar = {
  id: string; image?: string | null; images?: string[]; make: string; model: string; year: number; monthly: number; category: string; categories?: string[];
  price: number; mileage: string; hand: string; ownership: string; engine: string; color: string; doors: string; seats: string;
  video?: string | null; spin360?: string[]; baseModel?: string; subModel?: string; advance?: number; openRoof?: boolean; engineCapacity?: string; horsePower?: string; gear?: string; drivetrain?: string; test?: string; body?: string; extras?: string; remarks?: string;
  /* מחיר מחירון ומספר רישוי מגיעים כבר היום. הסטטוס יגיע
     כשה-CRM יחובר — עד אז הוא ריק והשדה פשוט לא מוצג. */
  listPrice?: number; plate?: string; status?: string;
};

/**
 * טכנולוגיית ההנעה, נגזרת מסוג המנוע.
 * "הנעה רגילה" הוא המקרה הרגיל ואינו מוצג ללקוח.
 */
export function propulsionTechnology(engine: string) {
  const value = String(engine || "").toLowerCase();
  const electric = value.includes("חשמל") || value.includes("electric");
  const fuel = value.includes("בנזין") || value.includes("דיזל") || value.includes("petrol") || value.includes("diesel");
  if (value.includes("פלאג") || value.includes("נטען") || value.includes("phev")) return "פלאג־אין";
  // "חשמל/בנזין" הוא רכב היברידי, לא חשמלי. רק מנוע חשמלי בלבד הוא חשמלי.
  if (electric && fuel) return "היברידי";
  if (electric) return "חשמלי";
  if (value.includes("היבריד") || value.includes("hybrid")) return "היברידי";
  return "הנעה רגילה";
}
