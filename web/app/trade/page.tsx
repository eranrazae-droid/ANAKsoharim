"use client";

import { useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lead = useLead("trade");

  async function lookup() {
    const digits = plate.replace(/\D/g, "");
    if (digits.length < 7) {
      setError("יש להזין מספר רישוי תקין");
      return;
    }
    setLoading(true);
    setError("");
    setVehicle(null);
    try {
      const response = await fetch(`/api/vehicle-lookup?plate=${digits}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "הרכב לא נמצא");
      setVehicle(data);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "הרכב לא נמצא");
    } finally {
      setLoading(false);
    }
  }

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
                  onChange={(event) => {
                    setPlate(event.target.value.replace(/\D/g, "").slice(0, 8));
                    setVehicle(null);
                    setError("");
                  }}
                />
                <button type="button" onClick={lookup} disabled={loading}>
                  {loading ? "בודק..." : "בדיקה"}
                </button>
              </label>

              {error && <p className="tradeError">{error}</p>}

              {vehicle && (
                <div className="tradeVehicleDetails">
                  <strong>{vehicle.manufacturer} {vehicle.model}</strong>
                  <div>
                    <span>שנה: {vehicle.year || "לא צוין"}</span>
                    <span>צבע: {vehicle.color || "לא צוין"}</span>
                    <span>בעלות: {vehicle.ownership || "לא צוין"}</span>
                    <span>עלייה לכביש: {vehicle.firstOnRoad || "לא צוין"}</span>
                  </div>
                </div>
              )}

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
