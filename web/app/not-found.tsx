import type { Metadata } from "next";
import { BUSINESS } from "./site-config";
import { SiteFooter, SiteHeader } from "./site-chrome";

export const metadata: Metadata = {
  title: "העמוד לא נמצא",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main dir="rtl">
      <SiteHeader />

      <section className="innerHero">
        <div className="shell">
          <span>404</span>
          <h1>העמוד לא נמצא</h1>
          <p>
            ייתכן שהרכב כבר נמכר או שהכתובת השתנתה.
            אפשר לחזור למלאי המלא או לדבר איתנו ישירות.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <p className="intro">
            <a className="goldButton" href="/cars">לכל הרכבים במלאי</a>
          </p>
          <p>
            או התקשרו: <a href={`tel:${BUSINESS.dial}`}>*2369</a> · <a href="tel:0503707010">050-3707010</a>
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
