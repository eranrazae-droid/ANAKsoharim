"use client";

import { useMemo, useState } from "react";
import { cheapestQuote } from "./finance-tracks";
import { Honeypot, LeadStatusMessage, useLead } from "./use-lead";

const shekel = (value: number) => `${Math.round(value).toLocaleString("he-IL")} ש״ח`;

/** טווח שנתוני הרכב שחברות המימון מאשרות */
const FIRST_YEAR = 2011;
const LAST_YEAR = 2026;

/**
 * מחשבון המימון.
 * מקישים סכום הלוואה ושנתון הרכב ומקבלים את ההחזר החודשי הנמוך
 * ביותר. השנתון קובע את מספר התשלומים המרבי שחברות המימון מאשרות.
 */
export default function LoanCalculator() {
  const [loan, setLoan] = useState(100000);
  const [year, setYear] = useState(2022);
  const best = useMemo(() => cheapestQuote(loan, year), [loan, year]);
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

      <div className="loanField loanYear">
        <span>שנת ייצור</span>
        <b>{year}</b>
      </div>

      <input
        className="loanSlider"
        type="range"
        min={FIRST_YEAR}
        max={LAST_YEAR}
        step={1}
        value={year}
        onChange={(event) => setYear(Number(event.target.value))}
        aria-label="שנת ייצור הרכב"
      />

      {best ? (
        <>
          <div className="loanResult">
            <small>ההחזר החודשי הנמוך ביותר</small>
            <strong>{shekel(best.monthly)}</strong>
            <span>לחודש</span>
          </div>

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
              ? `הלוואה ${shekel(loan)} · שנתון ${year} · ${best.company} ${best.track} ${best.rate.toFixed(1)}% · ${shekel(best.monthly)} לחודש ב-${best.payments} תשלומים`
              : `הלוואה ${shekel(loan)} · שנתון ${year}`,
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
