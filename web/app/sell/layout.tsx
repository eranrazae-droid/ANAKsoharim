import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מכירת רכב — אנחנו קונים את הרכב שלכם במזומן",
  description:
    "מוכרים רכב? ענק הרכבים קונה את כל סוגי הרכבים במזומן. בדיקה מקצועית, הצעה מהירה ללא התחייבות, תשלום במקום והעברת בעלות מסודרת. דוד רזיאל 4, ראשון לציון.",
  alternates: { canonical: "/sell" },
};

export default function SellLayout({ children }: { children: React.ReactNode }) {
  return children;
}
