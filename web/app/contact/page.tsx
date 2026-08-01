import type { Metadata } from "next";
import { SiteFooter,SiteHeader } from "../site-chrome"; import { Breadcrumbs } from "../page-schema";
import { ContactLeadForm } from "../lead-forms";

export const metadata: Metadata = {
  title: "צור קשר — דוד רזיאל 4, ראשון לציון",
  description:
    "ענק הרכבים, דוד רזיאל 4 ראשון לציון. טלפון *2369 או 050-3707010. פתוח א׳-ה׳ 08:30-18:00, ו׳ 08:30-13:00. נשמח לעזור בבחירת רכב, מימון, טרייד אין ומכירת רכב.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage(){return <main dir="rtl"><SiteHeader/><section className="innerHero"><div className="shell"><span>אנחנו כאן בשבילכם</span><h1>צור קשר</h1><p>נשמח לעזור בבחירת רכב, מימון, טרייד אין ומכירת רכב.</p></div></section><section className="section"><div className="shell contactPageGrid"><div><h2>ענק הרכבים</h2><p>דוד רזיאל 4, ראשון לציון</p><p><a href="tel:*2369">*2369</a> | <a href="tel:0503707010">050-3707010</a></p><p>א׳-ה׳ 08:30-18:00<br/>ו׳ 08:30-13:00</p><a className="goldButton" href="https://waze.com/ul?ll=31.9888,34.77084&navigate=yes">ניווט עם Waze</a></div><ContactLeadForm/></div></section><SiteFooter/><Breadcrumbs path="/contact" name="צור קשר"/></main>}
