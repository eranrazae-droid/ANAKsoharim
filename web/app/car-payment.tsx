"use client";

import { useMemo, useState } from "react";
import { cheapestQuote } from "./finance-tracks";

/**
 * החזר חודשי לרכב הזה.
 *
 * עד עכשיו לקוח שראה רכב ורצה לדעת כמה זה יוצא בחודש היה צריך
 * לצאת לעמוד המימון, ושם להקיש את המחיר בעצמו. רובם לא חזרו.
 * כאן המחיר כבר מוזן, ומשנים רק את המקדמה.
 *
 * החישוב זהה למחשבון שבעמוד המימון — אותה פונקציה בדיוק.
 */

const shekel = (value: number) => `${Math.round(value).toLocaleString("he-IL")} ש״ח`;

/**
 * מדרגות מקדמה נוחות ללחיצה.
 * אחוזים ולא סכומים קבועים — כך גם לרכב ב-25 אלף וגם לרכב
 * ב-300 אלף יש ארבע אפשרויות הגיוניות.
 */
function advanceSteps(price: number) {
  const round = (value: number) => Math.round(value / 1000) * 1000;
  const steps = [0, ...[0.1, 0.2, 0.3].map((share) => round(price * share))];
  return steps.filter((value, index) => value >= 0 && steps.indexOf(value) === index);
}

export default function CarPayment({ price, year }: { price: number; year: number }) {
  const steps = useMemo(() => advanceSteps(price), [price]);
  const [advance, setAdvance] = useState(0);
  const loan = Math.max(0, price - advance);
  const quote = useMemo(() => cheapestQuote(loan, year), [loan, year]);

  if (price <= 0) return null;

  return (
    <section className="carPay">
      <h2>כמה זה יוצא בחודש?</h2>

      <div className="carPayRow">
        <span>מקדמה</span>
        <div className="carPaySteps" role="group" aria-label="בחירת מקדמה">
          {steps.map((value) => (
            <button
              key={value}
              type="button"
              className={value === advance ? "on" : ""}
              onClick={() => setAdvance(value)}
            >
              {value === 0 ? "ללא מקדמה" : shekel(value)}
            </button>
          ))}
        </div>
      </div>

      {quote ? (
        <div className="carPayResult">
          <p>
            <small>החזר חודשי משוער</small>
            <strong>{shekel(quote.monthly)}</strong>
          </p>
          <p>
            <small>מספר תשלומים</small>
            <b>{quote.payments}</b>
          </p>
          <p>
            <small>סכום מימון</small>
            <b>{shekel(loan)}</b>
          </p>
        </div>
      ) : (
        <p className="carPayNone">לסכום הזה נשמח לבדוק עבורכם מסלול אישי בטלפון.</p>
      )}

      <p className="carPayNote">
        חישוב לפי המסלול המשתלם ביותר שאנחנו משיגים, בכפוף לאישור הגוף המממן.{" "}
        <a href="/finance">למחשבון המלא</a>
      </p>
    </section>
  );
}
