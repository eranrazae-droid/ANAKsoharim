"use client";

import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "../site-chrome";
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
          <h1>קבלו הצעת מחיר לרכב שלכם</h1>
          <p>משאירים מספר רישוי, שם וטלפון — ואנחנו חוזרים אליכם עם הצעה.</p>
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
            <span className="eyebrow">תהליך מהיר ופשוט</span>
            <h2>הרכב שלכם מתקדם אתכם לרכב הבא</h2>
            <p>אנחנו קונים כל רכב, גם אם אתם לא קונים מאיתנו.</p>
            <ul>
              <li>הצעה מהירה ושקופה</li>
              <li>העברת בעלות מסודרת</li>
              <li>אפשרות לשלב מימון לרכב הבא</li>
            </ul>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
