import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveVehicles, type DisplayCar } from "../../vehicle-api";
import { SiteFooter, SiteHeader } from "../../site-chrome";
import VehicleGallery from "../../vehicle-gallery";
import { CarLeadForm } from "../../lead-forms";
import { getMaxPaymentsByYear } from "../../finance-rules";
import { BUSINESS, DEMO_IMAGE, SITE_NAME, SITE_URL } from "../../site-config";
import { similarByPrice, PRICE_FLOOR_SHARE } from "../../similar-by-price";
import VideoBlock from "../../video-block";
import Spin360 from "../../spin-360";
import { CARD_SIZES } from "../../lib/images";
import { Picture } from "../../site-image";

export const revalidate = 600;

/**
 * תמונות המחשה זמניות.
 * מוצגות רק כשלרכב אין תמונות מהמערכת, כדי לראות את הפריסה.
 * למחיקה: להסיר את הקבוע ואת השימוש בו למטה, ואת public/placeholders.
 */
const PLACEHOLDERS = [
  DEMO_IMAGE,
  ...Array.from({ length: 9 }, (_, i) => `/placeholders/car-${i + 2}.svg`),
];

async function findCar(id: string) {
  const cars = await getActiveVehicles().catch(() => [] as DisplayCar[]);
  return { cars, car: cars.find((item) => item.id === id) ?? null };
}

function askingPrice(car: DisplayCar) {
  return car.price || Math.round(car.monthly * 83 / 1000) * 1000;
}

const km = (value: string) => Number(String(value).replace(/,/g, "") || 0).toLocaleString("he-IL");

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { car } = await findCar(id);
  if (!car) return { title: "הרכב לא נמצא", robots: { index: false, follow: true } };

  const name = `${car.make} ${car.model} שנת ${car.year}`;
  const price = askingPrice(car);
  const description = `${name} למכירה ב${SITE_NAME} — ${km(car.mileage)} ק״מ, ${car.gear || "אוטומטי"}${price ? `, מחיר ${price.toLocaleString("he-IL")} ₪` : ""}. מימון עד 100% וטרייד אין. דוד רזיאל 4, ראשון לציון.`;

  return {
    title: `${name} למכירה`,
    description,
    alternates: { canonical: `/car/${car.id}` },
    openGraph: {
      type: "website", locale: "he_IL",
      title: `${name} | ${SITE_NAME}`, description,
      url: `${SITE_URL}/car/${car.id}`,
      images: car.images?.length ? [car.images[0]] : undefined,
    },
  };
}

/** המפרט מוצג בשני טורים, שורות מפוספסות */
function specs(car: DisplayCar): [string, string][] {
  return ([
    ["שנת ייצור", String(car.year)],
    ["נפח", car.engineCapacity || ""],
    ["סוג מנוע", car.engine],
    ["כוח סוס", car.horsePower || ""],
    ["קילומטראז׳", km(car.mileage)],
    ["צבע", car.color],
    ["תיבת הילוכים", car.gear || "אוטומטי"],
    ["מספר מקומות ישיבה", car.seats || ""],
    ["מערכת הנעה", car.drivetrain || ""],
    ["גג נפתח", car.openRoof ? "כן" : "לא"],
    ["מספר דלתות", car.doors || ""],
    ["תוקף טסט", car.test || ""],
    ["מרכב", car.body || ""],
    ["קטגוריה", car.categories?.join(", ") || car.category],
  ] as [string, string][]).filter(([, value]) => value && value !== "לא צוין");
}

export default async function CarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cars, car } = await findCar(id);
  if (!car) notFound();

  const year = Number(car.year) || 2020;
  const maxPayments = getMaxPaymentsByYear(year);
  const price = askingPrice(car);
  const name = `${car.make} ${car.model}`;
  const related = similarByPrice(cars, car);
  const priceFloor = Math.round(price * PRICE_FLOOR_SHARE);
  const whatsapp = `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(`שלום, אני מתעניין ב-${name} שנת ${car.year}`)}`;

  const real = car.images?.length ? car.images.slice(0, 10) : car.image ? [car.image] : [];
  const gallery = real.length ? real : PLACEHOLDERS;   // המחשה עד לחיבור שרת התמונות
  const isDemo = real.length === 0;

  const vehicleSchema = {
    "@context": "https://schema.org", "@type": "Car",
    name: `${name} ${car.year}`,
    brand: { "@type": "Brand", name: car.make },
    model: car.baseModel || car.model,
    vehicleModelDate: String(car.year),
    url: `${SITE_URL}/car/${car.id}`,
    image: real.length ? real : undefined,
    sku: car.id, color: car.color,
    numberOfDoors: Number(car.doors) || undefined,
    vehicleSeatingCapacity: Number(car.seats) || undefined,
    fuelType: car.engine,
    vehicleTransmission: car.gear || undefined,
    mileageFromOdometer: { "@type": "QuantitativeValue", value: Number(String(car.mileage).replace(/,/g, "")) || 0, unitCode: "KMT" },
    offers: {
      "@type": "Offer", priceCurrency: "ILS", price: price || undefined,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      url: `${SITE_URL}/car/${car.id}`,
      seller: { "@type": "AutoDealer", name: SITE_NAME, url: SITE_URL },
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "דף הבית", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "מלאי עדכני", item: `${SITE_URL}/cars` },
      { "@type": "ListItem", position: 3, name, item: `${SITE_URL}/car/${car.id}` },
    ],
  };

  return (
    <main dir="rtl" className="carPage">
      <SiteHeader />

      <nav className="carCrumb" aria-label="מיקום בעמוד">
        <div className="shell">
          <a href="/">דף הבית</a><span aria-hidden="true">←</span>
          <a href="/cars">מלאי עדכני</a><span aria-hidden="true">←</span>
          <b>{name}</b>
        </div>
      </nav>

      {/* ── תמונות, סבב 360 וסרטון — זה מה שהעמוד הזה נועד לו ── */}
      <section className="carStage">
        <div className="shell">
          <div className="carStageHead">
            <span className="eyebrow">למכירה!</span>
            <h1>{car.make} {car.model} שנת {car.year}</h1>
            <p className="carStagePrice">
              {price > 0 ? `${price.toLocaleString("he-IL")} ש״ח` : "לפרטים חייגו"}
              {car.monthly > 0 && <em>· {car.monthly.toLocaleString("he-IL")} ש״ח לחודש</em>}
              {car.monthly > 0 && !car.advance && <b className="noAdvance">ללא מקדמה</b>}
            </p>
          </div>

          <VehicleGallery images={gallery} vehicleName={name} />
          {isDemo && <p className="carDemoNote">תמונות להמחשה — יוחלפו בתמונות הרכב מהמערכת</p>}

          {car.spin360 && car.spin360.length > 1 && (
            <div className="carSpin">
              <h2>סבב 360 מעלות</h2>
              <Spin360 frames={car.spin360} alt={`${name} שנת ${car.year}`} />
            </div>
          )}
        </div>
      </section>

      {car.video && (
        <VideoBlock source={car.video} poster={gallery[0]} title={`${name} שנת ${car.year}`} />
      )}

      {/* ── הטקסט מתחת לתמונות: זה מה שגוגל קורא ── */}
      <section className="carText">
        <div className="shell">
          <h2>{car.make} {car.model} שנת {car.year} — כל הפרטים</h2>

          <dl className="carSpecTable">
            <div><dt>מחיר מבוקש:</dt><dd>{price.toLocaleString("he-IL")} ₪</dd></div>
            {car.monthly > 0 && (
              <div><dt>החזר חודשי:</dt><dd>{car.monthly.toLocaleString("he-IL")} ₪</dd></div>
            )}
            {car.monthly > 0 && (
              <div><dt>מקדמה:</dt><dd>
                {car.advance
                  ? `${car.advance.toLocaleString("he-IL")} ₪`
                  : <b className="noAdvance">ללא מקדמה</b>}
              </dd></div>
            )}
            <div><dt>עד:</dt><dd>{maxPayments} תשלומים</dd></div>
            {specs(car).map(([label, value]) => (
              <div key={label}><dt>{label}:</dt><dd>{value}</dd></div>
            ))}
          </dl>

          {car.extras && <p className="carNote"><b>תוספות:</b> {car.extras}</p>}
          <p className="carNote">
            <b>פרטים נוספים:</b>{" "}
            {car.remarks || `הרכב קיים במלאי למסירה מיידית. אפשרות מימון עד 100% ללא מקדמה ועד ${maxPayments} תשלומים בהחזר חודשי משתלם במיוחד. אנו מבצעים טרייד אין לכל סוגי הרכבים — מחכים לך ב${SITE_NAME}, ${BUSINESS.street}, ${BUSINESS.city}.`}
          </p>
          <p className="carRef"><b>קוד פנייה:</b> {"{"}67-{car.id}-00{"}"}</p>

          <div className="carLeadBox">
            <p><b>מתעניינים ברכב?</b> השאירו פרטים ונחזור אליכם.</p>
            <CarLeadForm vehicle={`${name} ${car.year}`} />
          </div>

          <div className="carContactBar">
            <a href={`tel:${BUSINESS.dial}`}>{BUSINESS.phone}</a>
            <a href={whatsapp} target="_blank" rel="noreferrer">וואטסאפ</a>
            <span>{BUSINESS.street}, {BUSINESS.city}</span>
          </div>
        </div>
      </section>

      {/* ── רכבים נוספים ── */}
      {related.length > 0 && (
        <section className="carSection carRelated">
          <div className="shell">
            <header className="relatedHead">
              <span className="eyebrow">לפני שסוגרים</span>
              <h2>שווה להסתכל גם על אלה</h2>
              <p>
                רכבים מאותה קטגוריה שנמצאים בטווח שלכם — מתחילים
                מ-{priceFloor.toLocaleString("he-IL")} ש״ח ועולים. לפעמים תוספת קטנה
                בהחזר החודשי נותנת רכב חדש יותר או עם פחות קילומטרים.
              </p>
            </header>
            <div className="matchGrid" role="list" tabIndex={0} aria-label="רכבים נוספים, ניתן לגלול לצדדים">
              {related.map((item) => (
                <a className="matchCard" role="listitem" href={`/car/${item.id}`} key={item.id}>
                  <div className={`matchMedia ${item.image ? "" : "matchMediaDemo"}`}>
                    <Picture
                      src={item.image || DEMO_IMAGE}
                      alt={item.image ? `${item.make} ${item.baseModel || item.model}` : ""}
                      sizes={CARD_SIZES}
                    />
                  </div>
                  <div className="matchInfo">
                    <b>{item.make} {item.baseModel || item.model}</b>
                    <small>{item.year}</small>
                    <i>{item.price > 0 ? `${item.price.toLocaleString("he-IL")} ₪` : "לפרטים חייגו"}</i>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <SiteFooter />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
    </main>
  );
}
