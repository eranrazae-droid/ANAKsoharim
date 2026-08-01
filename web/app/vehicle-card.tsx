import type { DisplayCar } from "./vehicle-api";
import { DEMO_IMAGE } from "./site-config";

/**
 * כרטיס רכב ברשימה — תמונה בצד, ומולה שם הרכב, נתוני הבסיס והמחיר.
 * מתחת לתמונה, לכל רוחב הכרטיס: ההחזר החודשי ושורת נתוני הרכב
 * שנגללת לצדדים.
 * משמש גם בדף הבית וגם בעמוד המלאי, כדי שיהיה מקור אמת אחד.
 */

function mileage(car: DisplayCar) {
  return Number(String(car.mileage).replace(/,/g, "") || 0).toLocaleString("he-IL");
}

/** נפח מנוע מוצג בליטרים, כמו שנהוג בלוחות הרכב: 1598 -> 1.6 */
function engineSize(value?: string) {
  const cc = Number(String(value ?? "").replace(/\D/g, ""));
  if (!cc || cc < 500) return "";
  return `${(cc / 1000).toFixed(1)} ליטר`;
}

/** נתוני הרכב שאינם מופיעים בשורות הראשיות — שורה נגללת מתחת לתמונה. */
function specPills(car: DisplayCar) {
  return [
    engineSize(car.engineCapacity),
    car.gear,
    car.horsePower && `${car.horsePower} כ״ס`,
    car.color,
    car.doors && `${car.doors} דלתות`,
    car.seats && `${car.seats} מקומות`,
    car.drivetrain,
    car.body,
    car.openRoof ? "גג נפתח" : "",
    car.test && `טסט ${car.test}`,
    car.ownership,
  ]
    .map((item) => String(item ?? "").trim())
    .filter((item) => item && item !== "לא צוין");
}

export default function VehicleCard({ car }: { car: DisplayCar }) {
  const href = `/car/${car.id}`;
  const name = [car.make, car.baseModel || car.model, car.subModel].filter(Boolean).join(" ");
  const specs = specPills(car);

  return (
    <article className="listCard">
      <a className="listCardMain" href={href}>
        <div className={`listMedia ${car.image ? "" : "listMediaDemo"}`}>
          {car.image
            ? <img src={car.image} alt={`${name} שנת ${car.year}`} loading="lazy" decoding="async" />
            : <><img src={DEMO_IMAGE} alt="" loading="lazy" decoding="async" /><span>להמחשה</span></>}
        </div>

        <div className="listBody">
          <h3 className="listTitle">{name}</h3>

          <div className="listLines">
            <p className="listLine">
              <span>{car.year}</span>
              {car.engine && <><i aria-hidden="true">·</i><span>{car.engine}</span></>}
            </p>
            <p className="listLine">
              <span>יד {car.hand || "—"}</span>
              <i aria-hidden="true">·</i>
              <span>{mileage(car)} ק״מ</span>
            </p>
          </div>

          <div className="listMoney">
            {car.price > 0
              ? <p className="listPrice">{car.price.toLocaleString("he-IL")} <span>₪</span></p>
              : <p className="listPrice listPriceCall">לפרטים חייגו</p>}
            {car.monthly > 0 && (
              <p className="listMonthly">
                {car.monthly.toLocaleString("he-IL")} ₪ לחודש
                {!car.advance && <b className="noAdvance">ללא מקדמה</b>}
              </p>
            )}
          </div>

          {specs.length > 0 && (
            <ul className="listSpecs">
              {specs.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
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
          <div className="railMedia">
            <img
              src={car.image || DEMO_IMAGE}
              alt={car.image ? `${car.make} ${car.baseModel || car.model}` : ""}
              loading="lazy" decoding="async"
            />
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
