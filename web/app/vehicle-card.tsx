import { propulsionTechnology, type DisplayCar } from "./vehicle-api";
import { BUSINESS, DEMO_IMAGE } from "./site-config";
import { CARD_SIZES } from "./lib/images";
import { Picture } from "./site-image";
import { PinIcon } from "./icons";
import CardGallery from "./card-gallery";

/**
 * כרטיס רכב ברשימה.
 * כל פרטי הרכב מופיעים בכרטיס עצמו, ולכן הוא אינו קישור.
 * בטלפון: תמונה רחבה למעלה, ומתחתיה הטקסט — מיקום, שם הרכב,
 * שתי שורות נתונים, ואזור המחיר וההחזר החודשי.
 * מתחת להם שורת נתוני הרכב ושורת התגיות, שתיהן נגללות לצדדים.
 * משמש גם בדף הבית וגם בעמוד המלאי, כדי שיהיה מקור אמת אחד.
 */

/** תוספת שמופיעה ליד המחיר בכל הרכבים */
const PRICE_NOTE = "גמיש לרציניים";

const MAX_CHIPS = 6;

/** מעל אורך זה שם הרכב לא נכנס לשורה אחת בטלפון, ומוקטן מעט */
const TITLE_CHARS = 26;

/** כמה תמונות מוצגות בגלריית הכרטיס */
const MAX_SLIDES = 5;

/** תמונות המחשה זמניות, עד שתמונות הרכבים יגיעו מהמערכת */
const DEMO_SLIDES = [
  DEMO_IMAGE,
  ...Array.from({ length: MAX_SLIDES - 1 }, (_, i) => `/placeholders/car-${i + 2}.svg`),
];

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

/** האם כוח הסוס מופיע בשורת המנוע במקום טכנולוגיית ההנעה */
function showsHorsePower(car: DisplayCar) {
  const technology = propulsionTechnology(car.engine);
  const engine = String(car.engine || "");
  const repeats = engine.includes(technology) || technology.includes(engine);
  return technology === "הנעה רגילה" || repeats;
}

/**
 * שורת המנוע: נפח וסוג מנוע, ואחריהם טכנולוגיית ההנעה — אבל רק
 * כשהיא חשמלית, פלאג־אין או היברידית. בהנעה רגילה אין מה לציין,
 * ובמקומה נרשם כוח הסוס.
 */
function engineLine(car: DisplayCar) {
  return [
    engineSize(car.engineCapacity),
    car.engine,
    showsHorsePower(car) ? car.horsePower && `${car.horsePower} כ״ס` : propulsionTechnology(car.engine),
  ]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

/** נתוני הרכב שאינם מופיעים בשורות הראשיות — שורה נגללת */
function specPills(car: DisplayCar) {
  return [
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

/** שורת נתונים אחת — כל שדה יחידה שלמה שאינה נשברת באמצע */
function DataLine({ className, parts }: { className: string; parts: string[] }) {
  return (
    <p className={`listLine ${className}`}>
      {parts.map((part, index) => (
        <span key={part}>
          {index > 0 && <i aria-hidden="true">·</i>}
          {part}
        </span>
      ))}
    </p>
  );
}

export default function VehicleCard({ car }: { car: DisplayCar }) {
  const name = [car.make, car.baseModel || car.model, car.subModel].filter(Boolean).join(" ");
  const specs = specPills(car);
  const chips = extraChips(car.extras).filter((chip) => !specs.includes(chip));
  const basics = [String(car.year), `${mileage(car)} ק״מ`, car.gear].filter(Boolean) as string[];
  const real = car.images?.length ? car.images.slice(0, MAX_SLIDES) : car.image ? [car.image] : [];
  const slides = real.length ? real : DEMO_SLIDES;

  return (
    <article className="listCard">
      <div className="listCardMain">
        <div className={`listMedia ${real.length ? "" : "listMediaDemo"}`}>
          <CardGallery images={slides} alt={`${name} שנת ${car.year}`} />
          {!real.length && <span>להמחשה</span>}
          {car.monthly > 0 && !car.advance && <b className="noAdvance">ללא מקדמה</b>}
        </div>

        <div className="listBody">
          {/* שורה אחת מתחת לתצלום: המיקום מימין, והקישור לעמוד
              התמונות והסרטון משמאל. זה הקישור היחיד בכרטיס. */}
          <div className="listTop">
            <p className="listPlace"><PinIcon size={12} />{BUSINESS.city}</p>
            {/* הכיתוב עטוף ב-span אחד: בלעדיו הרווחים שסביב 360°
                נבלעים, והמילים נדבקות זו לזו. */}
            <a className="listAllMedia" href={`/car/${car.id}`}>
              <span>תמונות <bdi>360°</bdi> וסרטון</span>
            </a>
          </div>
          <h3 className={`listTitle${name.length > TITLE_CHARS ? " listTitleLong" : ""}`}>{name}</h3>

          <DataLine className="listOdo" parts={basics} />
          <DataLine className="listEngine" parts={engineLine(car)} />

          <div className="listMoney">
            <div className="listPriceBox">
              <small>מחיר</small>
              <p className="listPrice">
                {car.price > 0 ? `${car.price.toLocaleString("he-IL")} ש״ח` : "לפרטים חייגו"}
              </p>
              {car.price > 0 && <em className="listPriceNote">{PRICE_NOTE}</em>}
            </div>

            {car.monthly > 0 && (
              <div className="listMonthlyBox">
                <small>החזר חודשי מ־</small>
                <p className="listMonthly">{car.monthly.toLocaleString("he-IL")} ש״ח לחודש</p>
              </div>
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
      </div>
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
            <Picture
              src={car.image || DEMO_IMAGE}
              alt={car.image ? `${car.make} ${car.baseModel || car.model}` : ""}
              sizes={CARD_SIZES}
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
