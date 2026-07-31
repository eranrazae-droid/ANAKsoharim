import type { DisplayCar } from "./vehicle-api";

/**
 * כרטיס רכב ברשימה — תמונה בצד, מחיר בראש ותגיות אבזור.
 * משמש גם בדף הבית וגם בעמוד המלאי, כדי שיהיה מקור אמת אחד.
 */

const MAX_CHIPS = 4;

/** מפרק את שדה התוספות לתגיות קצרות וקריאות. */
export function extraChips(extras?: string, limit = MAX_CHIPS) {
  if (!extras) return [];
  return Array.from(
    new Set(
      String(extras)
        .replace(/;/g, ",")
        .split(",")
        .map((item) => item.replace(/\.$/, "").trim())
        .filter((item) => item.length > 2 && item.length <= 28),
    ),
  ).slice(0, limit);
}

function mileage(car: DisplayCar) {
  return Number(String(car.mileage).replace(/,/g, "") || 0).toLocaleString("he-IL");
}

/** נפח מנוע מוצג בליטרים, כמו שנהוג בלוחות הרכב: 1598 -> 1.6 */
function engineSize(value?: string) {
  const cc = Number(String(value ?? "").replace(/\D/g, ""));
  if (!cc || cc < 500) return "";
  return `${(cc / 1000).toFixed(1)} ליטר`;
}

function subtitle(car: DisplayCar) {
  return [car.subModel, engineSize(car.engineCapacity), car.engine, car.gear]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

export default function VehicleCard({ car }: { car: DisplayCar }) {
  const chips = extraChips(car.extras);
  const href = `/car/${car.id}`;
  const name = `${car.make} ${car.baseModel || car.model}`;

  return (
    <article className="listCard">
      <a className="listCardMain" href={href}>
        <div className={`listMedia ${car.image ? "" : "listMediaEmpty"}`}>
          {car.image
            ? <img src={car.image} alt={`${name} שנת ${car.year}`} loading="lazy" decoding="async" />
            : <span>תמונה<br />בקרוב</span>}
        </div>

        <div className="listBody">
          <h3 className="listTitle">{name}</h3>
          {subtitle(car) && <p className="listSub">{subtitle(car)}</p>}

          <p className="listMeta">
            <span>{car.year}</span>
            <i aria-hidden="true">•</i>
            <span>יד {car.hand || "—"}</span>
            <i aria-hidden="true">•</i>
            <span>{mileage(car)} ק״מ</span>
          </p>

          {chips.length > 0 && (
            <ul className="listChips">
              {chips.map((chip) => <li key={chip}>{chip}</li>)}
            </ul>
          )}

          <div className="listFoot">
            {car.price > 0
              ? <p className="listPrice">{car.price.toLocaleString("he-IL")} <span>₪</span></p>
              : <p className="listPrice listPriceCall">לפרטים חייגו</p>}
            <span className="listGo" aria-hidden="true">←</span>
            {car.monthly > 0 && (
              <p className="listMonthly">{car.monthly.toLocaleString("he-IL")} ₪ לחודש</p>
            )}
          </div>
        </div>
      </a>
    </article>
  );
}

/** עמודת צד — רכבים נוספים מהמלאי. */
export function PromoRail({ cars, title }: { cars: DisplayCar[]; title: string }) {
  if (!cars.length) return null;
  return (
    <aside className="rail">
      <p className="railHead">{title}</p>
      {cars.map((car) => (
        <a className="railCard" href={`/car/${car.id}`} key={car.id}>
          <div className={`railMedia ${car.image ? "" : "railNoImage"}`}>
            {car.image
              ? <img src={car.image} alt={`${car.make} ${car.baseModel || car.model}`} loading="lazy" decoding="async" />
              : <span>תמונה<br />בקרוב</span>}
          </div>
          <div className="railInfo">
            <b>{car.make} {car.baseModel || car.model}</b>
            <small>{car.year} · יד {car.hand || "—"}</small>
            <i>{car.price > 0 ? `${car.price.toLocaleString("he-IL")} ₪` : "לפרטים חייגו"}</i>
          </div>
        </a>
      ))}
    </aside>
  );
}
