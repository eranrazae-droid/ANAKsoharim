import type { DisplayCar } from "./vehicle-api";

/**
 * רכבים דומים לרכב שהלקוח מסתכל עליו.
 *
 * ההגדרה: אותה קטגוריה, ומחיר שמתחיל בעשרים אחוז מתחת למחיר הרכב
 * הנוכחי ועולה משם מרכב לרכב. כך הראשון שהלקוח רואה קרוב לתקציב
 * שלו, וככל שהוא גולל הוא מטפס.
 *
 * אם אין מספיק רכבים באותה קטגוריה מרחיבים בשלבים, כדי שתמיד
 * יהיה מה להציג: קודם מוותרים על הקטגוריה, ואז על רצפת המחיר.
 */

/** כמה מתחת למחיר הרכב מתחילים */
export const PRICE_FLOOR_SHARE = 0.8;

const categoriesOf = (car: DisplayCar) => (car.categories?.length ? car.categories : [car.category]);

const sameCategory = (car: DisplayCar, target: DisplayCar) =>
  categoriesOf(car).some((category) => categoriesOf(target).includes(category));

export function similarByPrice(cars: DisplayCar[], car: DisplayCar, limit = 10) {
  const pool = cars.filter((item) => item.id !== car.id && item.price > 0);
  const floor = Math.round((car.price || 0) * PRICE_FLOOR_SHARE);
  const byPrice = (a: DisplayCar, b: DisplayCar) => a.price - b.price;

  // שלב ראשון: אותה קטגוריה, ממחיר הרצפה ומעלה
  const exact = pool.filter((item) => sameCategory(item, car) && item.price >= floor).sort(byPrice);
  if (exact.length >= limit) return exact.slice(0, limit);

  // שלב שני: משלימים מאותה קטגוריה גם מתחת לרצפה, מהיקר לזול
  const belowFloor = pool
    .filter((item) => sameCategory(item, car) && item.price < floor)
    .sort((a, b) => b.price - a.price);
  const withCategory = [...exact, ...belowFloor];
  if (withCategory.length >= limit) return withCategory.slice(0, limit);

  // שלב שלישי: מכל הקטגוריות, לפי קרבת המחיר
  const rest = pool
    .filter((item) => !withCategory.includes(item))
    .sort((a, b) => Math.abs(a.price - car.price) - Math.abs(b.price - car.price));

  return [...withCategory, ...rest].slice(0, limit);
}
