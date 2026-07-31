import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "תנאי מימון לרכב — עד 100% מימון ועד 100 תשלומים",
  description:
    "מימון רכב בענק הרכבים: עד 100% מימון ללא מקדמה, פריסה עד 100 תשלומים ואפשרות לשלב טרייד אין. מחשבון מימון להתאמת ההחזר החודשי. בכפוף לאישור הגוף המממן.",
  alternates: { canonical: "/finance" },
};

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
