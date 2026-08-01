import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { Breadcrumbs } from "../page-schema";
import { BUSINESS } from "../site-config";
import { LeaveDetailsForm } from "../lead-forms";

export const metadata: Metadata = {
  title: "השארת פרטים — נחזור אליכם",
  description:
    "משאירים שם, טלפון ואיזה רכב מעניין אתכם, ונציג של ענק הרכבים חוזר אליכם עם כל הפרטים: מחיר, מימון, החזר חודשי ואפשרות טרייד אין.",
  alternates: { canonical: "/lead" },
};

/**
 * עמוד השארת פרטים.
 *
 * הכפתור "השאר פרטים" שבסרגל התחתון מוביל לכאן. קודם הוא פתח
 * חלון קופץ מעל העמוד; עמוד אמיתי עדיף — יש לו כתובת, אפשר
 * לשלוח אותה בהודעה, וגוגל יכול להגיע אליו.
 */
export default function LeadPage() {
  return (
    <main dir="rtl">
      <SiteHeader />

      <section className="innerHero financeHero">
        <div className="shell">
          <span>נחזור אליכם</span>
          <h1>השארת פרטים</h1>
          <p>
            ממלאים שלושה שדות ונציג חוזר אליכם עם מחיר, אפשרויות מימון והחזר
            חודשי. אין התחייבות.
          </p>
        </div>
      </section>

      <section className="section leadPage">
        <div className="shell leadPageGrid">
          <LeaveDetailsForm />

          <aside className="leadAside">
            <h2>מעדיפים לדבר עכשיו?</h2>
            <p>
              <a href={`tel:${BUSINESS.dial}`}>{BUSINESS.phone}</a>
            </p>
            <p>
              <a
                href={`https://wa.me/${BUSINESS.whatsapp}`}
                target="_blank"
                rel="noreferrer"
              >
                ווטסאפ
              </a>
            </p>
            <p className="leadHours">
              {BUSINESS.street}, {BUSINESS.city}
              <br />
              א׳-ה׳ 08:30-18:00 | ו׳ 08:30-13:00
            </p>
          </aside>
        </div>
      </section>

      <SiteFooter />
      <Breadcrumbs path="/lead" name="השארת פרטים" />
    </main>
  );
}
