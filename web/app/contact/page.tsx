import type { Metadata } from "next";
import { BUSINESS } from "../site-config";
import { SiteFooter,SiteHeader } from "../site-chrome"; import { Breadcrumbs } from "../page-schema";
import { ContactLeadForm } from "../lead-forms";

export const metadata: Metadata = {
  title: "צור קשר — דוד רזיאל 4, ראשון לציון",
  description:
    "ענק הרכבים, דוד רזיאל 4 ראשון לציון. טלפון *2369 או 050-3707010. פתוח א׳-ה׳ 08:30-18:00, ו׳ 08:30-13:00. נשמח לעזור בבחירת רכב, מימון, טרייד אין ומכירת רכב.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage(){return <main dir="rtl"><SiteHeader/><section className="innerHero"><div className="shell"><span>אנחנו כאן בשבילכם</span><h1>צור קשר</h1><p>נשמח לעזור בבחירת רכב, מימון, טרייד אין ומכירת רכב.</p></div></section><section className="section contactSection"><div className="shell contactPageGrid"><ContactLeadForm/><div className="contactDetails"><article><h2>הכתובת</h2><p>{BUSINESS.street}, {BUSINESS.city}</p><a className="goldButton" href="https://waze.com/ul?ll=31.9888,34.77084&navigate=yes" target="_blank" rel="noreferrer">ניווט עם Waze</a></article><article><h2>טלפון</h2><p><a href={`tel:${BUSINESS.dial}`}>{BUSINESS.phone}</a></p><p><a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer">ווטסאפ</a></p></article><article><h2>שעות פתיחה</h2><p>א׳-ה׳ 08:30-18:00</p><p>ו׳ 08:30-13:00</p></article></div></div></section><SiteFooter/><Breadcrumbs path="/contact" name="צור קשר"/></main>}
