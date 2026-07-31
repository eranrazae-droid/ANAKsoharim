import type { Metadata } from "next";
import HomeClient from "./home-client";
import { getActiveVehicles } from "./vehicle-api";
import { SITE_URL } from "./site-config";

// המלאי מרונדר בשרת ומתרענן כל 10 דקות.
// כך גוגל מקבל HTML עם כל הרכבים, והדף נשאר מהיר.
export const revalidate = 600;

export const metadata: Metadata = {
  title: "ענק הרכבים | קנייה, מכירה, מימון וטרייד אין בראשון לציון",
  description:
    "מעל 150 רכבים משומשים במלאי בראשון לציון. מימון עד 100% ועד 100 תשלומים, טרייד אין על כל סוגי הרכבים וקניית רכבים במזומן. ענק הרכבים — משנת 1998.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const cars = await getActiveVehicles().catch(() => []);

  const searchSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ענק הרכבים",
    url: SITE_URL,
    inLanguage: "he-IL",
  };

  return (
    <>
      <HomeClient initialCars={cars} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(searchSchema) }}
      />
    </>
  );
}
