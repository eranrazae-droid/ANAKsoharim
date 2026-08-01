import { propulsionTechnology, type DisplayCar } from "./vehicle-api";
import { DEMO_IMAGE } from "./site-config";

/**
 * כרטיס רכב ברשימה.
 * מול התמונה: יצרן ודגם, תת דגם ושנת ייצור, קילומטראז׳ וגיר, ושורת המנוע.
 * מתחת לתמונה, לכל רוחב הכרטיס: מחיר והחזר חודשי באותה שורה,
 * שורת נתוני הרכב ושורת התגיות — שתיהן נגללות לצדדים.
 * משמש גם בדף הבית וגם בעמוד המלאי, כדי שיהיה מקור אמת אחד.
 */

/** תוספת שמופיעה ליד המחיר בכל הרכבים */
const PRICE_NOTE = "גמיש לרציניים";

const MAX_CHIPS = 6;

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

/**
 * שורת המנוע: נפח וסוג מנוע, ואחריהם טכנולוגיית ההנעה — אבל רק
 * כשהיא חשמלית, פלאג־אין או היברידית. בהנעה רגילה אין מה לציין,
 * ובמקומה נרשם כוח הסוס.
 */
function engineLine(car: DisplayCar) {
  const technology = propulsionTechnology(car.engine);
  // ברכב חשמלי סוג המנוע והטכנולוגיה הם אותו דבר — אין טעם לרשום פעמיים
  const engine = String(car.engine || "");
  const repeats = engine.includes(technology) || technology.includes(engine);
  const special = technology !== "הנעה רגילה" && !repeats;
  return [
    engineSize(car.engineCapacity),
    car.engine,
    special ? technology : car.horsePower && `${car.horsePower} כ״ס`,
  ]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

/** האם כוח הסוס כבר מופיע בשורת המנוע */
function showsHorsePower(car: DisplayCar) {
  const technology = propulsionTechnology(car.engine);
  const engine = String(car.engine || "");
  const repeats = engine.includes(technology) || technology.includes(engine);
  return technology === "הנעה רגילה" || repeats;
}

/** נתוני הרכב שאינם מופיעים בשורות הראשיות — שורה נגללת מתחת לתמונה. */
function specPills(car: DisplayCar) {
  return [
    // כוח סוס מופיע כאן רק אם שורת המנוע הציגה במקומו את טכנולוגיית ההנעה
    showsHorsePower(car) ? "" : car.horsePower && `${car.horsePower} כ״ס`,
    car.color,
    car.doors && `${car.doors} דלתות`,
    car.seats && `${car.seats} מקומות`,
    car.drivetrain,
    car.body,
    car.openRoof ? "גג נפתח" : "",
    car.test && `טסט ${car.test}`,
  ]
    .map((item) => String(item ?? "").trim())
    .filter((item) => item && item !== "לא צוין");
}

export default function VehicleCard({ car }: { car: DisplayCar }) {
  const href = `/car/${car.id}`;
  const name = [car.make, car.baseModel || car.model, car.subModel].filter(Boolean).join(" ");
  const specs = specPills(car);
  const engine = engineLine(car);
  const chips = extraChips(car.extras).filter((chip) => !specs.includes(chip));
  const subtitle = [car.subModel, `שנת ייצור ${car.year}`].filter(Boolean).join(" · ");

  return (
    <article className="listCard">
      <a className="listCardMain" href={href}>
        <div className={`listMedia ${car.image ? "" : "listMediaDemo"}`}>
          {car.image
            ? <img src={car.image} alt={`${name} שנת ${car.year}`} loading="lazy" decoding="async" />
            : <><img src={DEMO_IMAGE} alt="" loading="lazy" decoding="async" /><span>להמחשה</span></>}
        </div>

        <div className="listBody">
          <h3 className="listTitle">{car.make} {car.baseModel || car.model}</h3>

          <div className="listLines">
            <p className="listLine listSubline">{subtitle}</p>
            <p className="listLine listOdo">
              <span>{mileage(car)} ק״מ</span>
              {car.gear && <><i aria-hidden="true">·</i><span>{car.gear}</span></>}
            </p>
            <p className="listLine listEngine">
              {engine.map((part, index) => (
                <span key={part}>
                  {index > 0 && <i aria-hidden="true">·</i>}
                  {part}
                </span>
              ))}
            </p>
          </div>

          <div className="listMoney">
            {car.price > 0
              ? <p className="listPrice">
                  {car.price.toLocaleString("he-IL")} <span>₪</span>
                  <em className="listPriceNote">{PRICE_NOTE}</em>
                </p>
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

          {chips.length > 0 && (
            <ul className="listChips">
              {chips.map((chip) => <li key={chip}>{chip}</li>)}
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
            <small>{car.year}</small>
            <i>{car.price > 0 ? `${car.price.toLocaleString("he-IL")} ₪` : "לפרטים חייגו"}</i>
          </div>
        </a>
      ))}
    </aside>
  );
}
