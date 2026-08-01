import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { Breadcrumbs } from "../page-schema";
import { getActiveVehicles, type DisplayCar } from "../vehicle-api";
import VehicleCard from "../vehicle-card";
import MobileReveal from "../mobile-reveal";
import { SITE_NAME, SITE_URL } from "../site-config";

// מחליף את עמודי המלאי הוותיקים של האתר הישן:
// /cars.asp, /רכבים-ראשון-לציון.asp, /מגרשי-מכוניות.asp
export const revalidate = 600;

export const metadata: Metadata = {
  title: "מלאי רכבים עדכני — רכבים משומשים בראשון לציון",
  description:
    "מלאי הרכבים המשומשים של ענק הרכבים בראשון לציון. עשרות רכבים מכל הסוגים והשנתונים, מחירים מלאים, מימון עד 100% ועד 100 תשלומים וטרייד אין על כל רכב.",
  alternates: { canonical: "/cars" },
};

export default async function CarsPage() {
  const cars = await getActiveVehicles().catch(() => [] as DisplayCar[]);


  const listSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "מלאי רכבים — ענק הרכבים",
    numberOfItems: cars.length,
    itemListElement: cars.slice(0, 100).map((car, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/car/${car.id}`,
      name: `${car.make} ${car.model} ${car.year}`,
    })),
  };

  return (
    <main dir="rtl">
      <SiteHeader />

      <section className="innerHero">
        <div className="shell">
          <span>מגרש הרכבים שלנו</span>
          <h1>מלאי רכבים עדכני</h1>
          <p>
            כל הרכבים שבמלאי {SITE_NAME} בראשון לציון, עם כל הפרטים והמחירים.
            המלאי מתעדכן ישירות ממערכת הניהול שלנו.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <p className="intro">
            {cars.length > 0
              ? `${cars.length.toLocaleString("he-IL")} רכבים זמינים כרגע. לחיפוש לפי יצרן, דגם, שנתון, מחיר והחזר חודשי — היכנסו לחיפוש בדף הבית.`
              : "המלאי מתעדכן כעת. נסו שוב בעוד מספר דקות או התקשרו אלינו ל-*2369."}
          </p>

          <MobileReveal label={`${cars.length.toLocaleString("he-IL")} רכבים במלאי`}>
            <div className="listGrid">
              {cars.map((car) => <VehicleCard car={car} key={car.id} />)}
            </div>
          </MobileReveal>
        </div>
      </section>

      <SiteFooter />
      <Breadcrumbs path="/cars" name="מלאי עדכני" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listSchema) }} />
    </main>
  );
}
