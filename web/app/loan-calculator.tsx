"use client";

import { useMemo, useState } from "react";
import { cheapestQuote } from "./finance-tracks";
import { Honeypot, LeadStatusMessage, useLead } from "./use-lead";

const shekel = (value: number) => `${Math.round(value).toLocaleString("he-IL")} ש״ח`;

/**
 * מחשבון המימון.
 * מקישים סכום הלוואה ומקבלים מסלול אחד — הזול ביותר מבין המסלולים
 * של חברות המימון שאיתן אנחנו עובדים, עם ההחזר החודשי שלו.
 */
export default function LoanCalculator() {
  const [loan, setLoan] = useState(100000);
  const best = useMemo(() => cheapestQuote(loan), [loan]);
  const lead = useLead("loan");

  return (
    <div className="loanCalc">
      <label className="loanField">
        <span>סכום ההלוואה</span>
        <input
          type="number"
          inputMode="numeric"
          min={5000}
          max={800000}
          step={1000}
          value={loan || ""}
          onChange={(event) => setLoan(Number(event.target.value) || 0)}
          aria-label="סכום ההלוואה בשקלים"
        />
        <b>ש״ח</b>
      </label>

      <input
        className="loanSlider"
        type="range"
        min={10000}
        max={600000}
        step={5000}
        value={Math.min(600000, Math.max(10000, loan))}
        onChange={(event) => setLoan(Number(event.target.value))}
        aria-label="בחירת סכום ההלוואה"
      />

      {best ? (
        <>
          <div className="loanResult">
            <small>ההחזר החודשי הנמוך ביותר</small>
            <strong>{shekel(best.monthly)}</strong>
            <span>לחודש · {best.payments} תשלומים</span>
          </div>

          <dl className="loanDetails">
            <div><dt>חברת המימון</dt><dd>{best.company}</dd></div>
            <div><dt>מסלול</dt><dd>{best.track}</dd></div>
            <div><dt>ריבית שנתית</dt><dd>{best.rate.toFixed(1)}%</dd></div>
            <div><dt>עמלת פתיחת תיק</dt><dd>{shekel(best.fee)}</dd></div>
            {best.balloon > 0 && (
              <div className="loanBalloon">
                <dt>תשלום בלון בסוף התקופה</dt>
                <dd>{shekel(best.balloon)}</dd>
              </div>
            )}
            <div><dt>סך הכל לתשלום</dt><dd>{shekel(best.total)}</dd></div>
          </dl>

          {best.balloon > 0 && (
            <p className="loanWarn">
              במסלול הזה ההחזר החודשי נמוך יותר, אבל בסוף התקופה נותר תשלום אחד
              גדול של {shekel(best.balloon)}. אפשר לפרוס גם אותו — נשמח להסביר.
            </p>
          )}
        </>
      ) : (
        <p className="loanEmpty">הקישו סכום הלוואה כדי לראות את ההחזר החודשי.</p>
      )}

      <p className="financeDisclaimer">
        החישוב הוא הערכה בלבד ואינו הצעת אשראי. הריבית, מספר התשלומים והאישור
        הסופי נקבעים על ידי חברת המימון בהתאם לנתוני הלקוח ולרכב.
      </p>

      <form
        className="loanLead"
        onSubmit={(event) =>
          lead.submit(event, {
            notes: best
              ? `הלוואה ${shekel(loan)} · ${best.company} ${best.track} · ${shekel(best.monthly)} לחודש ב-${best.payments} תשלומים`
              : `הלוואה ${shekel(loan)}`,
          })
        }
      >
        <b>רוצים לבדוק אם אתם מאושרים?</b>
        <Honeypot />
        <input required name="name" placeholder="שם מלא" aria-label="שם מלא" />
        <input required name="phone" inputMode="tel" placeholder="טלפון" aria-label="טלפון" />
        <button disabled={lead.status === "sending"}>
          {lead.status === "sending" ? "שולח..." : "בדקו עבורי"}
        </button>
        <LeadStatusMessage status={lead.status} error={lead.error} />
      </form>
    </div>
  );
}
