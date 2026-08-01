import { propulsionTechnology, type DisplayCar } from "./vehicle-types";
import { CarLeadForm } from "./lead-forms";

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

export function carName(car: DisplayCar) {
  return [car.make, car.baseModel || car.model, car.subModel].filter(Boolean).join(" ");
}

/**
 * inTable — הכרטיס נפתח בתוך שורת הטבלה.
 *
 * במקרה הזה השורה שמעליו כבר מציגה מחיר, החזר חודשי, מקדמה,
 * ק״מ, נפח מנוע, סוג מנוע, טכנולוגיית הנעה וגג נפתח — לכל
 * אחד מהם יש עמודה משלו. לחזור עליהם בכרטיס זה כפל שמאריך
 * אותו בלי להוסיף מידע, ולכן הם מדולגים. בעמוד הרכב, שבו
 * אין טבלה, כולם מוצגים כרגיל.
 */
export function CarFacts({ car, inTable = false }: { car: DisplayCar; inTable?: boolean }) {
  const propulsion = propulsionTechnology(car.engine);
  const kilometres = Number(String(car.mileage || "").replace(/\D/g, "")) || 0;

  return (
    <>
      <h3 className="panelTitle">{carName(car)} <em>שנת {car.year}</em></h3>

      <dl className="panelFacts">
        {!inTable && (
          <>
            <Fact label="מחיר מבוקש" value={car.price > 0 ? `${car.price.toLocaleString("he-IL")} ש״ח` : "לפרטים חייגו"} />
            <Fact label="החזר חודשי" value={car.monthly > 0 ? `${car.monthly.toLocaleString("he-IL")} ש״ח` : null} />
            <Fact
              label="מקדמה"
              value={car.monthly > 0
                ? (car.advance
                    ? `${car.advance.toLocaleString("he-IL")} ש״ח`
                    : <b className="noAdvance">ללא מקדמה</b>)
                : null}
            />
            <Fact label="קילומטראז׳" value={kilometres ? `${kilometres.toLocaleString("he-IL")} ק״מ` : null} />
            <Fact label="נפח מנוע" value={car.engineCapacity} />
            <Fact label="סוג מנוע" value={car.engine} />
          </>
        )}
        <Fact label="תיבת הילוכים" value={car.gear} />
        <Fact label="כוח סוס" value={car.horsePower} />
        {!inTable && <Fact label="טכנולוגיית הנעה" value={propulsion === "הנעה רגילה" ? null : propulsion} />}
        <Fact label="מערכת הנעה" value={car.drivetrain} />
        <Fact label="צבע" value={car.color} />
        <Fact label="מרכב" value={car.body} />
        <Fact label="קטגוריה" value={car.categories?.join(", ") || car.category} />
        <Fact label="מספר דלתות" value={car.doors} />
        <Fact label="מספר מושבים" value={car.seats} />
        {!inTable && <Fact label="גג נפתח" value={car.openRoof ? "כן" : null} />}
        <Fact label="תוקף טסט" value={car.test} />
      </dl>

      {car.extras && <p className="panelExtras"><b>תוספות:</b> {car.extras}</p>}
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
