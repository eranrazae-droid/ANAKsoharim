"use client";

import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { Breadcrumbs, Faq } from "../page-schema";
import { TRADE_FAQ } from "../faq-data";
import { Honeypot, LeadStatusMessage, useLead } from "../use-lead";

type Vehicle = {
  plate: string;
  manufacturer: string;
  model: string;
  year: string;
  color: string;
  ownership: string;
  modelType: string;
  firstOnRoad: string;
};

/**
 * בקשת הצעת מחיר לטרייד אין.
 * הלקוח מקיש מספר רישוי, שם וטלפון. מספר הרישוי נבדק מול מאגר
 * כלי הרכב של משרד התחבורה, כך שהפנייה שמגיעה למשרד כוללת כבר
 * את פרטי הרכב ואפשר לחזור אליו עם הצעה.
 */
export default function TradePage() {
  const [plate, setPlate] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState("");
  const lead = useLead("trade");

  // ברגע שמספר הרישוי מלא, פרטי הרכב נמשכים לבד ממאגר משרד התחבורה.
  // הלקוח לא צריך ללחוץ על דבר, והפנייה שמגיעה למשרד כוללת את הרכב.
  useEffect(() => {
    const digits = plate.replace(/\D/g, "");
    setVehicle(null);
    setError("");
    if (digits.length < 7) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/vehicle-lookup?plate=${digits}`);
        const data = await response.json();
        if (cancelled) return;
        if (response.ok) { setVehicle(data); return; }
        // רק "לא נמצא" מעניין את הלקוח — סימן שהמספר שגוי.
        // תקלת תקשורת מול המאגר היא עניין שלנו, והטופס ממשיך לעבוד בלעדיה.
        if (response.status === 404) setError("לא מצאנו רכב עם המספר הזה");
      } catch {
        /* המאגר לא זמין — ממשיכים בלי פרטי הרכב */
      }
    }, 500);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [plate]);

  return (
    <main dir="rtl">
      <SiteHeader />

      <section className="innerHero">
        <div className="shell">
          <span>טרייד אין בענק הרכבים</span>
          <h1>קונים אצלנו רכב, ומשאירים את הישן בעסקה</h1>
          <p>שווי הרכב שלכם יורד ממחיר הרכב הבא. משאירים מספר רישוי, שם וטלפון ואנחנו חוזרים עם הצעה.</p>
        </div>
      </section>

      <section className="tradeSection section">
        <div className="shell tradeLayout">
          <div className="tradeCard">
            <form
              className="tradeForm"
              onSubmit={(event) =>
                lead.submit(event, {
                  vehicle: vehicle ? `${vehicle.manufacturer} ${vehicle.model} ${vehicle.year}` : "",
                })
              }
            >
              <Honeypot />

              <label className="tradeField">
                <span>מספר רישוי</span>
                <input
                  required
                  name="plate"
                  inputMode="numeric"
                  placeholder="12345678"
                  value={plate}
                  onChange={(event) => setPlate(event.target.value.replace(/\D/g, "").slice(0, 8))}
                />
              </label>

              {vehicle && (
                <p className="tradeFound">
                  זיהינו: {vehicle.manufacturer} {vehicle.model}
                  {vehicle.year ? `, ${vehicle.year}` : ""}
                </p>
              )}
              {error && <p className="tradeError">{error}</p>}

              <label className="tradeField">
                <span>שם מלא</span>
                <input required name="name" placeholder="השם שלכם" />
              </label>

              <label className="tradeField">
                <span>טלפון</span>
                <input required name="phone" inputMode="tel" placeholder="050-0000000" />
              </label>

              <button className="tradeSubmit" disabled={lead.status === "sending"}>
                {lead.status === "sending" ? "שולח..." : "קבלו הצעת מחיר"}
              </button>

              <LeadStatusMessage status={lead.status} error={lead.error} />
            </form>

            <small className="govNotice">
              פרטי הרכב נמשכים ממאגר כלי הרכב הפתוח של משרד התחבורה. ההצעה ניתנת
              לאחר בדיקת הרכב בפועל, ללא התחייבות.
            </small>
          </div>

          <div className="tradeIntro">
            <span className="eyebrow">איך עובד טרייד אין</span>
            <h2>הרכב הישן הופך למקדמה לרכב הבא</h2>
            <p>
              בוחרים רכב מהמלאי, אנחנו מעריכים את הרכב שלכם, והשווי שלו יורד
              ממחיר הרכב שאתם קונים. את ההפרש משלימים במזומן או פורסים במימון.
            </p>
            <ul>
              <li>עסקה אחת: מוכרים וקונים באותו מקום ובאותו יום</li>
              <li>בלי מודעה, בלי פגישות עם קונים ובלי להישאר בלי רכב</li>
              <li>שווי הרכב משמש כמקדמה, ועל היתרה נבנה מסלול תשלומים</li>
              <li>העברת הבעלות של שני הרכבים מסודרת אצלנו במקום</li>
            </ul>
            <p className="tradeCross">
              רק רוצים למכור, בלי לקנות? <a href="/sell">אנחנו קונים כל רכב</a>
            </p>
          </div>
        </div>
      </section>

      <Faq items={TRADE_FAQ} />
      <SiteFooter />
      <Breadcrumbs path="/trade" name="טרייד אין" />
    </main>
  );
}
