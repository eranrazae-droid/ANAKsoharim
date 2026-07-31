"use client";

import { useMemo, useState } from "react";
import { getMaxPaymentsByYear } from "./finance-rules";

const money = (value: number) => Math.round(value).toLocaleString("he-IL");
const ANNUAL_INTEREST = 7;

export default function VehicleFinanceCalculator({ price, year }: { price: number; year: number }) {
  const maxPayments = getMaxPaymentsByYear(year);
  const [advance, setAdvance] = useState(Math.min(Math.round(price * 0.1 / 1000) * 1000, price));
  const [payments, setPayments] = useState(Math.min(60, maxPayments));

  const monthly = useMemo(() => {
    const principal = Math.max(0, price - advance);
    const monthlyRate = ANNUAL_INTEREST / 100 / 12;
    if (!monthlyRate) return principal / payments;
    return principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -payments));
  }, [price, advance, payments]);

  return (
    <section className="vehicleFinanceCalculator" aria-label="מחשבון מימון לרכב">
      <header>
        <div><small>מחיר הרכב</small><strong>{money(price)} ₪</strong></div>
        <div className="monthlyResult"><small>החזר חודשי משוער</small><strong>{money(monthly)} ₪</strong></div>
      </header>
      <div className="financeSlider">
        <label><span>מקדמה</span><b>{money(advance)} ₪</b></label>
        <input type="range" min="0" max={Math.max(price, 1000)} step="1000" value={advance} onChange={(event) => setAdvance(Number(event.target.value))} />
      </div>
      <div className="financeSlider">
        <label><span>מספר תשלומים</span><b>{payments} מתוך {maxPayments}</b></label>
        <input type="range" min={Math.min(12, maxPayments)} max={maxPayments} step="1" value={payments} onChange={(event) => setPayments(Number(event.target.value))} />
      </div>
      <small className="financeDisclaimer">החישוב להמחשה בלבד וכפוף לאישור חברת המימון.</small>
    </section>
  );
}
