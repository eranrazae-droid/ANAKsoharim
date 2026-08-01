/**
 * מסלולי המימון של ענק הרכבים.
 *
 * הנתונים לקוחים מהמחשבון הפנימי של המשרד (finance.html):
 * ריביות, תקרות תשלומים, עמלות פתיחת תיק ותוספת ריבית לפי גובה ההלוואה.
 * מקום אחד לעדכון — כשהריביות משתנות משנים כאן בלבד.
 */

import { maxPaymentsKal, maxPaymentsYasir } from "./finance-rules";

/** ריבית הפריים. לעדכון כשבנק ישראל משנה. */
export const PRIME = 5.5;

/** ברירת מחדל לבלון: מחצית מסכום ההלוואה */
export const BALLOON_SHARE = 0.5;

export type Track = {
  company: string;
  name: string;
  /** ריבית שנתית לפני תוספת לפי גובה ההלוואה */
  rate: number;
  /** תקרת תשלומים, לפי גובה ההלוואה ושנתון הרכב */
  maxPayments: (loan: number, year: number) => number;
  /** האם המסלול כולל תשלום בלון בסוף התקופה */
  balloon: boolean;
  fee: (loan: number) => number;
};

const feeKal = (loan: number) => (loan <= 100000 ? 345 : Math.round(345 + loan * 0.01));
const feeYasir = (loan: number) => Math.round(loan * 0.015 + 400);

/** מימון ישיר מאשרים 120 תשלומים רק בהלוואות מעל 400,000 */
const yasirLoanCap = (loan: number) => (loan > 400000 ? 120 : 100);

const kal = (_loan: number, year: number) => maxPaymentsKal(year);
const kalBalloon = (_loan: number, year: number) => Math.min(60, maxPaymentsKal(year));
const yasir = (loan: number, year: number) => Math.min(yasirLoanCap(loan), maxPaymentsYasir(year));
const yasirBalloon = (loan: number, year: number) => Math.min(60, yasir(loan, year));

export const TRACKS: Track[] = [
  { company: "כאל", name: "צמוד מדד", rate: 4.2, maxPayments: kal, balloon: false, fee: feeKal },
  { company: "כאל", name: "צמוד מדד + בלון", rate: 4.2, maxPayments: kalBalloon, balloon: true, fee: feeKal },
  { company: "כאל", name: "פריים + 1.6%", rate: PRIME + 1.6, maxPayments: kal, balloon: false, fee: feeKal },
  { company: "מימון ישיר", name: "ריבית קבועה", rate: 7, maxPayments: yasir, balloon: false, fee: feeYasir },
  { company: "מימון ישיר", name: "ריבית קבועה", rate: 9, maxPayments: yasir, balloon: false, fee: feeYasir },
  { company: "מימון ישיר", name: "ריבית קבועה + בלון", rate: 7, maxPayments: yasirBalloon, balloon: true, fee: feeYasir },
];

/** תוספת ריבית לפי גובה ההלוואה */
export function rateSurcharge(loan: number) {
  if (loan > 500000) return 3;
  if (loan > 349000) return 2;
  if (loan > 200000) return 1;
  return 0;
}

/** החזר חודשי בשיטת שפיצר, עם אפשרות לתשלום בלון בסוף התקופה */
export function monthlyPayment(principal: number, annualRate: number, payments: number, balloon = 0) {
  if (!principal || !payments) return 0;
  const rate = annualRate / 100 / 12;
  if (rate === 0) return Math.round((principal - balloon) / payments);
  const balloonValue = balloon / Math.pow(1 + rate, payments);
  return Math.round(((principal - balloonValue) * rate) / (1 - Math.pow(1 + rate, -payments)));
}

export type Quote = {
  company: string;
  track: string;
  rate: number;
  payments: number;
  monthly: number;
  fee: number;
  balloon: number;
  /** סך כל התשלומים כולל בלון ועמלת פתיחת תיק */
  total: number;
};

function quote(track: Track, loan: number, year: number): Quote {
  const rate = track.rate + rateSurcharge(loan);
  const payments = track.maxPayments(loan, year);
  const balloon = track.balloon ? Math.round(loan * BALLOON_SHARE) : 0;
  const monthly = monthlyPayment(loan, rate, payments, balloon);
  const fee = track.fee(loan);
  return {
    company: track.company,
    track: track.name,
    rate,
    payments,
    monthly,
    fee,
    balloon,
    total: monthly * payments + balloon + fee,
  };
}

/**
 * המסלול עם ההחזר החודשי הנמוך ביותר.
 * כל מסלול מחושב בפריסה המקסימלית שלו, כי זו הפריסה שנותנת
 * את ההחזר החודשי הנמוך ביותר באותו מסלול. שנתון הרכב מגביל את
 * הפריסה — רכב ישן יותר מקבל פחות תשלומים.
 *
 * מסלולי בלון אינם נכללים כברירת מחדל. ההחזר החודשי בהם נמוך
 * במעט, אבל בסוף התקופה נותר תשלום של מחצית ההלוואה — הצגתו
 * ללקוח כ"המסלול הזול ביותר" מטעה. להצגתם: withBalloon = true.
 */
export function cheapestQuote(loan: number, year: number, withBalloon = false): Quote | null {
  if (!loan || loan < 5000) return null;
  return TRACKS
    .filter((track) => withBalloon || !track.balloon)
    .map((track) => quote(track, loan, year))
    .filter((option) => option.payments > 0)
    .sort((a, b) => a.monthly - b.monthly)[0] ?? null;
}
