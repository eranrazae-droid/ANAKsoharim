import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { getActiveVehicles, type DisplayCar } from "../vehicle-api";
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

function mileageText(car: DisplayCar) {
  return Number(String(car.mileage).replace(/,/g, "") || 0).toLocaleString("he-IL");
}

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

          <div className="carGrid">
            {cars.map((car) => (
              <article className="carCard" key={car.id}>
                <a className={`carImage ${car.image ? "" : "noVehicleImage"}`} href={`/car/${car.id}`}>
                  {car.image
                    ? <img src={car.image} alt={`${car.make} ${car.model} שנת ${car.year}`} loading="lazy" decoding="async" />
                    : <div><img src="/assets/logo1.png" alt={SITE_NAME} loading="lazy" decoding="async" /><span>תמונה תעלה בקרוב</span></div>}
                  <b>במלאי</b>
                </a>
                <div className="carInfo">
                  <small>{car.category}</small>
                  <h2>{car.make} {car.model}</h2>
                  <p>שנת {car.year} | {car.gear || "אוטומטי"} | {mileageText(car)} ק״מ</p>
                  <div>
                    <strong>{car.price.toLocaleString("he-IL")} ₪</strong>
                    <span>מחיר מבוקש</span>
                  </div>
                  {car.monthly > 0 && (
                    <div className="cardMonthly">
                      <strong>החל מ-{car.monthly.toLocaleString("he-IL")} ₪</strong>
                      <span>בחודש</span>
                    </div>
                  )}
                  <a className="cardButton" href={`/car/${car.id}`}>לפרטים נוספים</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listSchema) }} />
    </main>
  );
}
