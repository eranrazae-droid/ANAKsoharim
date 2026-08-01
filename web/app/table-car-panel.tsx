"use client";

import { propulsionTechnology, type DisplayCar } from "./vehicle-types";
import { BUSINESS, DEMO_IMAGE } from "./site-config";
import CardGallery from "./card-gallery";
import { CarLeadForm } from "./lead-forms";

/**
 * כרטיס הרכב שנפתח בתוך טבלת המלאי.
 *
 * לחיצה על הפלוס שליד מספר השורה פותחת כאן את כל מה שיש על
 * הרכב: תצלומים שאפשר לגלול ביניהם, כל הנתונים, וטופס פנייה
 * שמגיע כשהרכב כבר רשום בו. כך הגולש רואה הכול בלי לצאת
 * מהטבלה ובלי לאבד את מקומו ברשימה.
 *
 * עמוד הרכב הנפרד נשאר קיים בשביל גוגל, אבל הגולש לא צריך אותו.
 */

const MAX_SLIDES = 5;
const DEMO_SLIDES = [
  DEMO_IMAGE,
  ...Array.from({ length: MAX_SLIDES - 1 }, (_, i) => `/placeholders/car-${i + 2}.svg`),
];

/** שורת נתון. ערך ריק פשוט לא מוצג — עדיף מלראות מקף. */
function Fact({ label, value }: { label: string; value?: string | number | null }) {
  const text = value === 0 ? "0" : value;
  if (!text) return null;
  return (
    <div className="panelFact">
      <dt>{label}</dt>
      <dd>{text}</dd>
    </div>
  );
}

export default function TableCarPanel({ car }: { car: DisplayCar }) {
  const name = [car.make, car.baseModel || car.model, car.subModel].filter(Boolean).join(" ");
  const real = car.images?.length ? car.images.slice(0, MAX_SLIDES) : car.image ? [car.image] : [];
  const slides = real.length ? real : DEMO_SLIDES;
  const propulsion = propulsionTechnology(car.engine);
  const kilometres = Number(String(car.mileage || "").replace(/\D/g, "")) || 0;

  return (
    <div className="carPanel">
      <div className="panelMedia">
        <div className={`panelSlides ${real.length ? "" : "panelSlidesDemo"}`}>
          <CardGallery images={slides} alt={`${name} שנת ${car.year}`} />
          {!real.length && <span className="panelDemoTag">להמחשה</span>}
        </div>
        <p className="panelSwipeHint">גוללים בין התמונות מצד לצד</p>
      </div>

      <div className="panelBody">
        <h3>{name} <em>שנת {car.year}</em></h3>

        <div className="panelMoney">
          <span className="panelPrice">
            {car.price > 0 ? `${car.price.toLocaleString("he-IL")} ש״ח` : "לפרטים חייגו"}
            {car.price > 0 && <small>גמיש לרציניים</small>}
          </span>
          {car.monthly > 0 && (
            <span className="panelMonthly">
              {car.monthly.toLocaleString("he-IL")} ש״ח לחודש
              {!car.advance && <b>ללא מקדמה</b>}
            </span>
          )}
        </div>

        <dl className="panelFacts">
          <Fact label="קילומטראז׳" value={kilometres ? `${kilometres.toLocaleString("he-IL")} ק״מ` : null} />
          <Fact label="תיבת הילוכים" value={car.gear} />
          <Fact label="סוג מנוע" value={car.engine} />
          <Fact label="נפח מנוע" value={car.engineCapacity} />
          <Fact label="כוח סוס" value={car.horsePower} />
          <Fact label="טכנולוגיית הנעה" value={propulsion === "הנעה רגילה" ? null : propulsion} />
          <Fact label="מערכת הנעה" value={car.drivetrain} />
          <Fact label="צבע" value={car.color} />
          <Fact label="מרכב" value={car.body} />
          <Fact label="קטגוריה" value={car.categories?.join(", ") || car.category} />
          <Fact label="מספר דלתות" value={car.doors} />
          <Fact label="מספר מושבים" value={car.seats} />
          <Fact label="גג נפתח" value={car.openRoof ? "כן" : null} />
          <Fact label="תוקף טסט" value={car.test} />
          <Fact label="מקדמה" value={car.advance ? `${car.advance.toLocaleString("he-IL")} ש״ח` : null} />
        </dl>

        {car.extras && (
          <p className="panelExtras"><b>תוספות:</b> {car.extras}</p>
        )}
      </div>

      <aside className="panelContact">
        <h4>צור קשר לגבי הרכב הזה</h4>
        <p>נחזור אליכם עם כל הפרטים: מחיר סופי, מימון וטרייד אין.</p>
        <CarLeadForm vehicle={`${name} שנת ${car.year}`} />
        <p className="panelCall">
          או חייגו עכשיו <a href={`tel:${BUSINESS.dial}`}>{BUSINESS.phone}</a>
        </p>
      </aside>
    </div>
  );
}
