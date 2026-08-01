import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveVehicles, type DisplayCar } from "../../vehicle-api";
import { SiteFooter, SiteHeader } from "../../site-chrome";
import VehicleGallery from "../../vehicle-gallery";
import VehicleFinanceCalculator from "../../vehicle-finance-calculator";
import { CarLeadForm } from "../../lead-forms";
import { extraChips } from "../../vehicle-card";
import { getMaxPaymentsByYear } from "../../finance-rules";
import { BUSINESS, SITE_NAME, SITE_URL } from "../../site-config";

export const revalidate = 600;

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
  const description = `${name} למכירה ב${SITE_NAME} — ${km(car.mileage)} ק״מ, יד ${car.hand || "—"}, ${car.gear || "אוטומטי"}${price ? `, מחיר ${price.toLocaleString("he-IL")} ₪` : ""}. מימון עד 100% וטרייד אין. דוד רזיאל 4, ראשון לציון.`;

  return {
    title: `${name} למכירה`,
    description,
    alternates: { canonical: `/car/${car.id}` },
    openGraph: {
      type: "website",
      locale: "he_IL",
      title: `${name} | ${SITE_NAME}`,
      description,
      url: `${SITE_URL}/car/${car.id}`,
      images: car.images?.length ? [car.images[0]] : undefined,
    },
  };
}

/** המפרט מוצג כרשימת מפתח-ערך נקייה, בלי אייקונים */
function specs(car: DisplayCar): [string, string][] {
  return ([
    ["שנת ייצור", String(car.year)],
    ["קילומטראז׳", `${km(car.mileage)} ק״מ`],
    ["יד", car.hand || "—"],
    ["תיבת הילוכים", car.gear || "אוטומטי"],
    ["סוג מנוע", car.engine],
    ["נפח מנוע", car.engineCapacity ? `${car.engineCapacity} סמ״ק` : ""],
    ["כוח סוס", car.horsePower || ""],
    ["מערכת הנעה", car.drivetrain || ""],
    ["מרכב", car.body || car.category],
    ["צבע", car.color],
    ["מספר דלתות", car.doors || ""],
    ["מספר מקומות", car.seats || ""],
    ["גג נפתח", car.openRoof ? "כן" : "לא"],
    ["מקוריות", car.ownership],
    ["תוקף טסט", car.test || ""],
    ["קטגוריה", car.categories?.join(", ") || car.category],
  ] as [string, string][]).filter(([, value]) => value && value !== "לא צוין");
}

export default async function CarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cars, car } = await findCar(id);

  // רכב שנמכר או קוד שגוי מחזיר 404 אמיתי — לא רכב אקראי.
  if (!car) notFound();

  const year = Number(car.year) || 2020;
  const maxPayments = getMaxPaymentsByYear(year);
  const price = askingPrice(car);
  const name = `${car.make} ${car.model}`;
  const chips = extraChips(car.extras, 12);
  const related = cars.filter((item) => item.id !== car.id).slice(0, 10);
  const whatsapp = `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(`שלום, אני מתעניין ב-${name} שנת ${car.year}`)}`;
  const gallery = car.images?.length ? car.images.slice(0, 10) : car.image ? [car.image] : [];

  const vehicleSchema = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: `${name} ${car.year}`,
    brand: { "@type": "Brand", name: car.make },
    model: car.baseModel || car.model,
    vehicleModelDate: String(car.year),
    url: `${SITE_URL}/car/${car.id}`,
    image: gallery.length ? gallery : undefined,
    sku: car.id,
    color: car.color,
    numberOfDoors: Number(car.doors) || undefined,
    vehicleSeatingCapacity: Number(car.seats) || undefined,
    fuelType: car.engine,
    vehicleTransmission: car.gear || undefined,
    mileageFromOdometer: { "@type": "QuantitativeValue", value: Number(String(car.mileage).replace(/,/g, "")) || 0, unitCode: "KMT" },
    offers: {
      "@type": "Offer",
      priceCurrency: "ILS",
      price: price || undefined,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      url: `${SITE_URL}/car/${car.id}`,
      seller: { "@type": "AutoDealer", name: SITE_NAME, url: SITE_URL },
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
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

      {/* ═══ הרכב והעסקה ═══ */}
      <section className="carTop">
        <div className="shell carTopGrid">
          <div className="carTopMedia">
            <VehicleGallery images={gallery} vehicleName={name} />
          </div>

          <aside className="carDeal">
            <div className="carDealCard">
              <h1>{car.make} <span>{car.model}</span></h1>
              <p className="carDealMeta">
                <span>{car.year}</span><i aria-hidden="true">·</i>
                <span>יד {car.hand || "—"}</span><i aria-hidden="true">·</i>
                <span>{km(car.mileage)} ק״מ</span>
              </p>

              <div className="carDealPrice">
                <small>מחיר מבוקש</small>
                <strong>{price.toLocaleString("he-IL")} <span>₪</span></strong>
              </div>

              {(car.monthly > 0 || (car.advance ?? 0) > 0) && (
                <dl className="carDealTerms">
                  {car.monthly > 0 && <div><dt>החזר חודשי</dt><dd>{car.monthly.toLocaleString("he-IL")} ₪</dd></div>}
                  {(car.advance ?? 0) > 0 && <div><dt>מקדמה</dt><dd>{(car.advance ?? 0).toLocaleString("he-IL")} ₪</dd></div>}
                  <div><dt>עד</dt><dd>{maxPayments} תשלומים</dd></div>
                </dl>
              )}

              <div className="carDealActions">
                <a className="carCall" href={`tel:${BUSINESS.phone}`}>חייגו {BUSINESS.phone}</a>
                <a className="carWa" href={whatsapp} target="_blank" rel="noreferrer">וואטסאפ</a>
              </div>

              <p className="carDealCode">קוד רכב {car.id}</p>
            </div>
          </aside>
        </div>
      </section>

      {/* ═══ מפרט ═══ */}
      <section className="carSection">
        <div className="shell">
          <h2>מפרט הרכב</h2>
          <dl className="carSpecs">
            {specs(car).map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>

          {chips.length > 0 && (
            <>
              <h3 className="carSubhead">אבזור ותוספות</h3>
              <ul className="carChips">{chips.map((chip) => <li key={chip}>{chip}</li>)}</ul>
            </>
          )}

          {car.remarks && (
            <>
              <h3 className="carSubhead">פרטים נוספים</h3>
              <p className="carRemarks">{car.remarks}</p>
            </>
          )}
        </div>
      </section>

      {/* ═══ מימון ═══ */}
      <section className="carSection carFinance">
        <div className="shell">
          <h2>כמה זה יעלה בחודש</h2>
          <p className="carSectionLead">הזיזו את המקדמה ואת מספר התשלומים כדי לראות את ההחזר.</p>
          <VehicleFinanceCalculator price={price} year={year} />
        </div>
      </section>

      {/* ═══ השארת פרטים ═══ */}
      <section className="carSection carLead">
        <div className="shell carLeadGrid">
          <div>
            <h2>רוצים לשמוע עוד על הרכב?</h2>
            <p>נציג יחזור אליכם עם כל המידע ואפשרויות המימון.</p>
          </div>
          <CarLeadForm vehicle={`${name} ${car.year}`} />
        </div>
      </section>

      {/* ═══ רכבים נוספים ═══ */}
      {related.length > 0 && (
        <section className="carSection carRelated">
          <div className="shell">
            <h2>רכבים נוספים במלאי</h2>
            <div className="matchGrid" role="list" tabIndex={0} aria-label="רכבים נוספים, ניתן לגלול לצדדים">
              {related.map((item) => (
                <a className="matchCard" role="listitem" href={`/car/${item.id}`} key={item.id}>
                  <div className={`matchMedia ${item.image ? "" : "matchMediaEmpty"}`}>
                    {item.image
                      ? <img src={item.image} alt={`${item.make} ${item.baseModel || item.model}`} loading="lazy" decoding="async" />
                      : <span>תמונה<br />בקרוב</span>}
                  </div>
                  <div className="matchInfo">
                    <b>{item.make} {item.baseModel || item.model}</b>
                    <small>{item.year} · יד {item.hand || "—"}</small>
                    <i>{item.price > 0 ? `${item.price.toLocaleString("he-IL")} ₪` : "לפרטים חייגו"}</i>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <SiteFooter />

      {/* פס פעולה קבוע במובייל */}
      <div className="carMobileBar">
        <a href={`tel:${BUSINESS.phone}`}>חייגו {BUSINESS.phone}</a>
        <a href={whatsapp} target="_blank" rel="noreferrer">וואטסאפ</a>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
    </main>
  );
}
