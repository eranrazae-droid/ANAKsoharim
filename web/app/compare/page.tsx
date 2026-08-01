import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { getActiveVehicles, type DisplayCar } from "../vehicle-api";
import CompareClient from "./compare-client";
import { SITE_NAME } from "../site-config";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "השוואת רכבים",
  description:
    `בוחרים עד שלושה רכבים מהמלאי של ${SITE_NAME} ורואים אותם זה מול זה — מחיר, החזר חודשי, שנתון, קילומטראז׳, מנוע וכל המפרט.`,
  alternates: { canonical: "/compare" },
};

export default async function ComparePage() {
  const cars = await getActiveVehicles().catch(() => [] as DisplayCar[]);

  return (
    <main dir="rtl">
      <SiteHeader />

      <section className="innerHero">
        <div className="shell">
          <span>מתלבטים בין שניים?</span>
          <h1>השוואת רכבים</h1>
          <p>בוחרים עד שלושה רכבים מהמלאי ורואים אותם זה מול זה, שורה מול שורה.</p>
        </div>
      </section>

      <section className="comparePage section">
        <div className="shell">
          <CompareClient cars={cars} />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
