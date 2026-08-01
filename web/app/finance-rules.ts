/**
 * פריסת התשלומים המרבית לפי שנתון הרכב.
 *
 * לכל חברת מימון טבלה משלה, כפי שהיא מופיעה במחשבון הפנימי של המשרד.
 * מקום אחד לעדכון — כשהחברות משנות תנאים משנים כאן בלבד.
 */

/** כאל.רכב — פריסה רגילה, ללא בלון */
const KAL: Record<number, number> = {
  2026: 100, 2025: 100, 2024: 100, 2023: 100,
  2022: 84, 2021: 84, 2020: 72, 2019: 60,
  2018: 48, 2017: 36, 2016: 24,
};

/** מימון ישיר */
const YASIR: Record<number, number> = {
  2026: 100, 2025: 100, 2024: 100, 2023: 100,
  2022: 84, 2021: 82, 2020: 70, 2019: 58,
  2018: 46, 2017: 34, 2016: 22,
  2015: 36, 2014: 36, 2013: 36, 2012: 24, 2011: 12,
};

/** שנתון חדש מהטבלה מקבל את התנאי של השנתון החדש ביותר */
const lookup = (table: Record<number, number>, year: number) =>
  table[year] ?? (year > 2026 ? 100 : 0);

export const maxPaymentsKal = (year: number) => lookup(KAL, year);
export const maxPaymentsYasir = (year: number) => lookup(YASIR, year);

/** הפריסה הטובה ביותר שאפשר להשיג לשנתון הזה, מבין כל החברות */
export const getMaxPaymentsByYear = (year: number) =>
  Math.max(maxPaymentsKal(year), maxPaymentsYasir(year)) || 12;
