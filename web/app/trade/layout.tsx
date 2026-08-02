import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "טרייד אין — קונים רכב ומשאירים את הישן בעסקה",
  description:
    "טרייד אין בענק הרכבים: קונים אצלנו רכב, ושווי הרכב הישן שלכם יורד מהמחיר ומשמש כמקדמה. עסקה אחת במקום שתיים, אפשרות לפרוס את ההפרש במימון והעברת בעלות מסודרת אצלנו.",
  alternates: { canonical: "/trade" },
};

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
