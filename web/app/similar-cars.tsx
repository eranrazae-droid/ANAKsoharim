import type { DisplayCar } from "./vehicle-api";

/**
 * גלריית רכבים שעשויים להתאים לצופה.
 *
 * ההתאמה נגזרת ממה שהצופה מסנן כרגע — קטגוריה, יצרן וטווח מחירים.
 * הדירוג הוא קודם כל לפי קרבת הקטגוריה, ורק אחר כך לפי קרבת המחיר,
 * מהמחיר הקרוב ביותר לרחוק ביותר.
 */

export type Reference = {
  category: string;
  make: string;
  /** מרכז טווח המחירים שהצופה בחר */
  price: number;
};

const ALL = "הכל";
const ALL_CATEGORIES = "כל הרכבים";

function categoriesOf(car: DisplayCar) {
  return car.categories?.length ? car.categories : [car.category];
}

/** 0 — אותה קטגוריה בדיוק, 1 — חופפת חלקית, 2 — שונה */
function categoryDistance(car: DisplayCar, category: string) {
  if (category === ALL_CATEGORIES) return 0;
  const list = categoriesOf(car);
  if (list[0] === category) return 0;
  if (list.includes(category)) return 1;
  return 2;
}

/**
 * מחיר הייחוס — הנקודה שממנה נמדדת קרבת המחיר.
 *
 * כששני הגבולות נבחרו, הייחוס הוא אמצע הטווח.
 * כשנבחר גבול אחד בלבד, הייחוס הוא אותו גבול עצמו: מי שביקש
 * "ממחיר 125,000" מתעניין ברכבים סביב הסכום הזה, לא באמצע
 * הדרך אל קצה המלאי.
 * כשלא נבחר דבר, הייחוס הוא חציון המלאי.
 */
export function referencePrice(cars: DisplayCar[], minPrice: number, maxPrice: number, inventoryMax: number) {
  const hasMin = minPrice > 0;
  const hasMax = maxPrice < inventoryMax;
  if (hasMin && hasMax) return (minPrice + maxPrice) / 2;
  if (hasMin) return minPrice;
  if (hasMax) return maxPrice;
  const prices = cars.map((car) => car.price).filter((price) => price > 0).sort((a, b) => a - b);
  return prices.length ? prices[Math.floor(prices.length / 2)] : 0;
}

export function pickSimilar(cars: DisplayCar[], ref: Reference, limit = 12) {
  return [...cars]
    .filter((car) => car.price > 0)
    .map((car) => ({
      car,
      categoryGap: categoryDistance(car, ref.category),
      makeGap: ref.make === ALL || car.make === ref.make ? 0 : 1,
      priceGap: Math.abs(car.price - ref.price),
    }))
    .sort((a, b) =>
      a.categoryGap - b.categoryGap ||   // הקטגוריה הזהה ביותר קודמת
      a.makeGap - b.makeGap ||
      a.priceGap - b.priceGap,           // ואז מהמחיר הקרוב ביותר לרחוק
    )
    .slice(0, limit)
    .map((item) => item.car);
}

export default function SimilarCars({ cars, profile }: { cars: DisplayCar[]; profile: Reference }) {
  const picks = pickSimilar(cars, profile);
  if (picks.length < 4) return null;

  const subtitle = profile.category === ALL_CATEGORIES
    ? "לפי טווח המחירים שאתם מסתכלים עליו"
    : `מקטגוריית ${profile.category}, לפי קרבת המחיר`;

  return (
    <section className="matchStrip" aria-labelledby="matchTitle">
      <div className="shell">
        <header className="matchHead">
          <span className="eyebrow">אולי יתאימו לכם</span>
          <h2 id="matchTitle">רכבים דומים במלאי</h2>
          <p>{subtitle}</p>
        </header>

        <div className="matchGrid" role="list" tabIndex={0} aria-label="רכבים דומים, ניתן לגלול לצדדים">
          {picks.map((car) => (
            <a className="matchCard" role="listitem" href={`/car/${car.id}`} key={car.id}>
              <div className={`matchMedia ${car.image ? "" : "matchMediaEmpty"}`}>
                {car.image
                  ? <img src={car.image} alt={`${car.make} ${car.baseModel || car.model} שנת ${car.year}`} loading="lazy" decoding="async" />
                  : <span>תמונה<br />בקרוב</span>}
              </div>
              <div className="matchInfo">
                <b>{car.make} {car.baseModel || car.model}</b>
                <small>{car.year} · יד {car.hand || "—"}</small>
                <i>{car.price.toLocaleString("he-IL")} ₪</i>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
