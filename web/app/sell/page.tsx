"use client";

import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { Breadcrumbs, Faq } from "../page-schema";
import { SELL_FAQ } from "../faq-data";
import { Honeypot, LeadStatusMessage, useLead } from "../use-lead";

type Vehicle = { manufacturer: string; model: string; year: string };

/**
 * מכירת רכב לענק הרכבים — ללא קנייה מאיתנו.
 * הלקוח מקיש מספר רישוי, קילומטראז׳, מחיר סופי, שם, טלפון ועיר.
 * מספר הרישוי נבדק לבד מול מאגר משרד התחבורה, כך שהפנייה שמגיעה
 * למשרד כוללת כבר את פרטי הרכב.
 */
export default function SellPage() {
  const [plate, setPlate] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState("");
  const lead = useLead("sell");

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
          <span>קונים את הרכב שלכם</span>
          <h1>מוכרים רכב? אנחנו קונים</h1>
          <p>גם אם אתם לא קונים מאיתנו. משאירים פרטים ואנחנו חוזרים אליכם.</p>
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
                <span>קילומטר</span>
                <input required name="mileage" inputMode="numeric" placeholder="120000" />
              </label>

              <label className="tradeField">
                <span>מחיר סופי</span>
                <input required name="price" inputMode="numeric" placeholder="65000" />
                <b>ש״ח</b>
              </label>

              <label className="tradeField">
                <span>שם מלא</span>
                <input required name="name" placeholder="השם שלכם" />
              </label>

              <label className="tradeField">
                <span>טלפון</span>
                <input required name="phone" inputMode="tel" placeholder="050-0000000" />
              </label>

              <label className="tradeField">
                <span>עיר</span>
                <input required name="city" placeholder="איפה הרכב נמצא" />
              </label>

              <button className="tradeSubmit" disabled={lead.status === "sending"}>
                {lead.status === "sending" ? "שולח..." : "שליחת פרטים"}
              </button>

              <LeadStatusMessage status={lead.status} error={lead.error} />
            </form>

            <small className="govNotice">
              פרטי הרכב נמשכים ממאגר כלי הרכב הפתוח של משרד התחבורה. הרכישה
              מותנית בבדיקת הרכב בפועל.
            </small>
          </div>

          <div className="tradeIntro">
            <span className="eyebrow">מוכרים רכב?</span>
            <h2>אנחנו קונים כל רכב, גם בלי שתקנו מאיתנו</h2>
            <p>
              משאירים מספר רישוי ופרטים, ואנחנו חוזרים אליכם עם הצעה. אחרי
              שאנחנו רואים את הרכב סוגרים במקום — בלי מודעות ובלי פגישות
              עם קונים.
            </p>
            <ul>
              <li>הצעה מהירה ושקופה, בדרך כלל באותו יום עסקים</li>
              <li>בדיקת הרכב אצלנו ללא התחייבות</li>
              <li>תשלום והעברת בעלות מסודרת במקום</li>
            </ul>
            <p className="tradeCross">
              מחפשים גם רכב אחר? <a href="/trade">שווי הרכב שלכם יכול לשמש כמקדמה</a>
            </p>
          </div>
        </div>
      </section>

      <Faq items={SELL_FAQ} />
      <SiteFooter />
      <Breadcrumbs path="/sell" name="מכירת רכב" />
    </main>
  );
}
