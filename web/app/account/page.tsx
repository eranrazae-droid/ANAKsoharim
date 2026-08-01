import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { getActiveVehicles, type DisplayCar } from "../vehicle-api";
import AccountClient from "./account-client";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "האזור האישי",
  description:
    "פותחים חשבון בענק הרכבים ומגדירים איזה רכב אתם מחפשים. כשייכנס למלאי רכב שמתאים — נודיע לכם. הגלישה באתר פתוחה גם בלי חשבון.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: true },
};

/**
 * האזור האישי.
 * אפשרויות הסינון להתראות נגזרות מהמלאי בפועל, כדי שהגולש יבחר
 * רק יצרנים ודגמים שקיימים אצלנו.
 */
export default async function AccountPage() {
  const cars = await getActiveVehicles().catch(() => [] as DisplayCar[]);
  const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "he"));

  const options = {
    makes: unique(cars.map((car) => car.make)),
    models: unique(cars.map((car) => car.baseModel || car.model)),
    categories: unique(cars.flatMap((car) => (car.categories?.length ? car.categories : [car.category]))),
  };

  return (
    <main dir="rtl">
      <SiteHeader />

      <section className="innerHero">
        <div className="shell">
          <span>האזור האישי</span>
          <h1>שנודיע לכם כשייכנס הרכב שאתם מחפשים?</h1>
          <p>פותחים חשבון בטלפון, מגדירים מה מחפשים, ומקבלים הודעה. הגלישה באתר פתוחה גם בלי חשבון.</p>
        </div>
      </section>

      <section className="accountPage section">
        <div className="shell">
          <AccountClient options={options} />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
