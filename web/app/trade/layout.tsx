import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "טרייד אין לרכב — קבלו הצעה על הרכב שלכם",
  description:
    "טרייד אין בענק הרכבים על כל סוגי הרכבים. הזינו מספר רכב, קבלו את פרטיו ממאגר משרד התחבורה וקבלו הצעה מהירה ללא התחייבות. העברת בעלות מסודרת ואפשרות לשלב מימון.",
  alternates: { canonical: "/trade" },
};

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
