import { propulsionTechnology, type DisplayCar } from "./vehicle-types";
import { CarLeadForm } from "./lead-forms";
import { getMaxPaymentsByYear } from "./finance-rules";
import { BUSINESS, SITE_NAME } from "./site-config";

/**
 * פרטי הרכב ורצועת הפנייה.
 *
 * אותם שני חלקים בדיוק מוצגים בשני מקומות: בכרטיס שנפתח בטבלת
 * המלאי, ובעמוד הרכב מתחת לתמונות. הם יושבים כאן כדי שיישארו
 * זהים — שינוי בשדה אחד משנה את שני המקומות.
 *
 * המחיר, ההחזר החודשי והמקדמה הם שדות ככל השדות. רק "ללא מקדמה"
 * מודגש — זו ההטבה שהלקוח מחפש.
 */

/** שורת נתון. ערך ריק פשוט לא מוצג — עדיף מלראות מקף. */
function Fact({ label, value }: { label: string; value?: React.ReactNode }) {
  const text = value === 0 ? "0" : value;
  if (!text) return null;
  return (
    <div className="panelFact">
      <dt>{label}</dt>
      <dd>{text}</dd>
    </div>
  );
}

/* לרוב הרכבים מגיעה הערה מהמערכת. כשאין — נכתב הנוסח הקבוע,
   כדי שלא יישאר שדה ריק בכרטיס. */
function defaultRemarks(car: DisplayCar) {
  const payments = getMaxPaymentsByYear(Number(car.year) || 0);
  return `הרכב קיים במלאי למסירה מיידית. אפשרות מימון עד 100% ללא מקדמה ועד ${payments} תשלומים בהחזר חודשי משתלם במיוחד. אנו מבצעים טרייד אין לכל סוגי הרכבים — מחכים לך ב${SITE_NAME}, ${BUSINESS.street}, ${BUSINESS.city}.`;
}

export function carName(car: DisplayCar) {
  return [car.make, car.baseModel || car.model, car.subModel].filter(Boolean).join(" ");
}

/* סדר השדות בעמוד הרכב. שינוי סדר נעשה כאן בלבד. */
const CAR_PAGE_ORDER = [
  "קילומטראז׳", "נפח מנוע", "סוג מנוע", "טכנולוגיית הנעה", "כוח סוס",
  "מערכת הנעה", "תיבת הילוכים", "צבע", "מרכב", "מספר דלתות", "מספר מושבים",
  "גג נפתח", "תוקף טסט",
  "מחיר מבוקש", "החזר חודשי", "מקדמה", "מחיר מחירון", "מספר רישוי",
  "מיקום הרכב", "צפי הגעה", "סטטוס הרכב",
];

/* סדר השדות בכרטיס שנפתח בטבלה. חסרים כאן השדות שכבר יש להם
   עמודה בשורה שמעליו — לחזור עליהם זה כפל שמאריך את הכרטיס
   בלי להוסיף מידע. */
const IN_TABLE_ORDER = [
  "תיבת הילוכים", "כוח סוס", "מערכת הנעה", "צבע", "מרכב",
  "מספר דלתות", "מספר מושבים", "תוקף טסט", "קטגוריה",
  "מחיר מחירון", "מספר רישוי", "מיקום הרכב", "צפי הגעה", "סטטוס הרכב",
];

/**
 * inTable — הכרטיס נפתח בתוך שורת הטבלה, ואז הסדר שונה ומדולגים
 * בו השדות שכבר מופיעים כעמודות בשורה שמעליו.
 */
export function CarFacts({ car, inTable = false }: { car: DisplayCar; inTable?: boolean }) {
  const propulsion = propulsionTechnology(car.engine);
  const kilometres = Number(String(car.mileage || "").replace(/\D/g, "")) || 0;
  const shekel = (value: number) => `${value.toLocaleString("he-IL")} ש״ח`;

  /* כל השדות במקום אחד. הסדר נקבע ברשימות שלמעלה, וערך ריק
     פשוט לא מוצג. */
  const fields: Record<string, React.ReactNode> = {
    "מחיר מבוקש": car.price > 0 ? shekel(car.price) : "לפרטים חייגו",
    "החזר חודשי": car.monthly > 0 ? shekel(car.monthly) : null,
    "מקדמה": car.monthly > 0
      ? (car.advance ? shekel(car.advance) : <b className="noAdvance">ללא מקדמה</b>)
      : null,
    "קילומטראז׳": kilometres ? `${kilometres.toLocaleString("he-IL")} ק״מ` : null,
    "נפח מנוע": car.engineCapacity,
    "סוג מנוע": car.engine,
    "טכנולוגיית הנעה": propulsion === "הנעה רגילה" ? null : propulsion,
    "כוח סוס": car.horsePower,
    "מערכת הנעה": car.drivetrain,
    "תיבת הילוכים": car.gear,
    "צבע": car.color,
    "מרכב": car.body,
    "מספר דלתות": car.doors,
    "מספר מושבים": car.seats,
    "גג נפתח": car.openRoof ? "כן" : null,
    "תוקף טסט": car.test,
    "קטגוריה": car.categories?.join(", ") || car.category,
    "מחיר מחירון": car.listPrice && car.listPrice > 0 ? shekel(car.listPrice) : null,
    "מספר רישוי": car.plate,
    "סטטוס הרכב": car.status,
    "מיקום הרכב": car.location || `${BUSINESS.street}, ${BUSINESS.city}`,
    "צפי הגעה": car.arrival,
  };

  return (
    <>
      <h3 className="panelTitle">{carName(car)} <em>שנת {car.year}</em></h3>

      <dl className="panelFacts">
        {(inTable ? IN_TABLE_ORDER : CAR_PAGE_ORDER).map((label) => (
          <Fact key={label} label={label} value={fields[label]} />
        ))}
      </dl>

      {car.extras && <p className="panelExtras"><b>תוספות:</b> {car.extras}</p>}
      <p className="panelExtras"><b>פרטים נוספים:</b> {car.remarks || defaultRemarks(car)}</p>
    </>
  );
}

/** רצועת הפנייה — כותרת, שלושה שדות וכפתור, הכול בשורה אחת. */
export function CarContactStrip({ car }: { car: DisplayCar }) {
  return (
    <aside className="panelContact">
      <h4>צור קשר לגבי הרכב הזה</h4>
      <CarLeadForm vehicle={`${carName(car)} שנת ${car.year}`} />
    </aside>
  );
}
