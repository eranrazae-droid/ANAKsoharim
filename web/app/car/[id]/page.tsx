import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveVehicles, type DisplayCar } from "../../vehicle-api";
import VehicleGallery from "../../vehicle-gallery";
import VehicleFinanceCalculator from "../../vehicle-finance-calculator";
import { getMaxPaymentsByYear } from "../../finance-rules";
import { SITE_NAME, SITE_URL } from "../../site-config";

export const revalidate = 600;

async function findCar(id: string) {
  const cars = await getActiveVehicles().catch(() => [] as DisplayCar[]);
  return { cars, car: cars.find((item) => item.id === id) ?? null };
}

function askingPrice(car: DisplayCar) {
  return car.price || Math.round(car.monthly * 83 / 1000) * 1000;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { car } = await findCar(id);
  if (!car) return { title: "הרכב לא נמצא", robots: { index: false, follow: true } };

  const name = `${car.make} ${car.model} שנת ${car.year}`;
  const price = askingPrice(car);
  const mileage = Number(String(car.mileage).replace(/,/g, "") || 0).toLocaleString("he-IL");
  const description = `${name} למכירה ב${SITE_NAME} — ${mileage} ק״מ, יד ${car.hand || "—"}, ${car.gear || "אוטומטי"}${price ? `, מחיר ${price.toLocaleString("he-IL")} ₪` : ""}. מימון עד 100% וטרייד אין. דוד רזיאל 4, ראשון לציון.`;

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

const specItems = (car: DisplayCar, price: number) => [
  ["✋", "יד", car.hand || "לא צוין"],
  ["⌂", "מקוריות", car.ownership],
  ["◉", "קילומטראז׳", `${Number(car.mileage.replace(/,/g, "") || 0).toLocaleString("he-IL")} ק״מ`],
  ["⚙", "תיבת הילוכים", car.gear || "אוטומטי"],
  ["⌘", "מערכת הנעה", car.drivetrain || "לא צוין"],
  ["▥", "מספר דלתות", car.doors || "לא צוין"],
  ["▰", "מרכב", car.body || car.category],
  ["▤", "נפח מנוע", car.engineCapacity ? `${car.engineCapacity} סמ״ק` : "לא צוין"],
  ["◈", "סוג מנוע", car.engine],
  ["ϟ", "כוח סוס", car.horsePower || "לא צוין"],
  ["●", "צבע", car.color],
  ["♙", "מספר מקומות", car.seats || "לא צוין"],
  ["◒", "גג נפתח", car.openRoof ? "כן" : "לא"],
  ["✓", "תוקף טסט", car.test || "לא צוין"],
  ["◆", "קטגוריה", car.category],
];

export default async function CarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cars, car } = await findCar(id);

  // רכב שנמכר או קוד שגוי מחזיר 404 אמיתי — לא רכב אקראי.
  if (!car) notFound();

  const vehicleYear = Number(car.year) || 2020;
  const maxPayments = getMaxPaymentsByYear(vehicleYear);
  const price = askingPrice(car);
  const relatedCars = cars.filter((item) => item.id !== car.id).slice(0, 4);
  const message = encodeURIComponent(`שלום, אני מתעניין ב-${car.make} ${car.model} שנת ${car.year}`);
  const whatsapp = `https://wa.me/972503707010?text=${message}`;
  const imageSrc = (value?: string | null) => value?.startsWith("http") ? value : value ? `/assets/${value}` : "";
  const galleryImages = car.images?.length ? car.images.slice(0, 10) : car.image ? [imageSrc(car.image)] : [];

  // נתונים מובנים — מאפשרים לגוגל להציג מחיר, שנתון וקילומטראז' ישירות בתוצאות החיפוש.
  const vehicleSchema = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: `${car.make} ${car.model} ${car.year}`,
    brand: { "@type": "Brand", name: car.make },
    model: car.baseModel || car.model,
    vehicleModelDate: String(car.year),
    productionDate: String(car.year),
    url: `${SITE_URL}/car/${car.id}`,
    image: galleryImages.length ? galleryImages : undefined,
    sku: car.id,
    color: car.color,
    numberOfDoors: Number(car.doors) || undefined,
    vehicleSeatingCapacity: Number(car.seats) || undefined,
    fuelType: car.engine,
    vehicleTransmission: car.gear || undefined,
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: Number(String(car.mileage).replace(/,/g, "")) || 0,
      unitCode: "KMT",
    },
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
      { "@type": "ListItem", position: 2, name: "רכבים במלאי", item: `${SITE_URL}/cars` },
      { "@type": "ListItem", position: 3, name: `${car.make} ${car.model}`, item: `${SITE_URL}/car/${car.id}` },
    ],
  };

  return (
    <main dir="rtl" className="carPage modernCarPage">
      <header className="topbar">
        <div className="shell headerInner">
          <a className="logo" href="/"><img src="/assets/logo1.png" alt="ענק הרכבים" /></a>
          <div className="headerActions">
            <a className="location" href="https://waze.com/ul?ll=31.9888,34.77084&navigate=yes">⌖ דוד רזיאל 4, ראשון לציון</a>
            <a className="phone" href="tel:*2369"><small>חייגו עכשיו</small><strong>*2369</strong><span>☎</span></a>
          </div>
        </div>
      </header>

      <nav className="nav">
        <div className="shell navLinks">
          <a href="/">דף הבית</a><a href="/#inventory">רכבים משומשים</a><a href="/finance">תנאי מימון</a>
          <a href="/trade">טרייד אין</a><a href="/sell">מכירת רכב</a><a href="/contact">צור קשר</a>
        </div>
      </nav>

      <div className="modernBreadcrumb">
        <div className="shell"><a href="/">דף הבית</a><span>←</span><a href="/#inventory">הרכבים שלנו</a><span>←</span><b>{car.make} {car.model}</b></div>
      </div>

      <section className="modernVehicleHero">
        <div className="shell listingLayout">
          <div className="modernSummary listingContent">
            <div className="modernEyebrow vehicleTitleLine"><h1>{car.make} {car.model} שנת {car.year}</h1></div>

            <div className="modernHighlights">
              <div><small>שנת ייצור</small><strong>{car.year}</strong></div>
              <div><small>קילומטראז׳</small><strong>{Number(car.mileage.replace(/,/g, "") || 0).toLocaleString("he-IL")}</strong></div>
              <div><small>יד</small><strong>{car.hand || "—"}</strong></div>
              <div><small>תוקף טסט</small><strong>{car.test || "לא צוין"}</strong></div>
            </div>
            <div className="modernSpecs heroSpecs">
              {specItems(car, price).map(([icon, label, value]) => (
                <div key={String(label)}>
                  <span className="specIcon" aria-hidden="true">{icon}</span>
                  <section><small>{label}</small><strong>{value}</strong></section>
                </div>
              ))}
            </div>
            <div className="heroCopy">
              <p><b>תוספות:</b> {car.extras || "פרטי אבזור נוספים יימסרו על ידי נציג המכירות."}</p>
              <p><b>פרטים נוספים:</b> {car.remarks || "הרכב קיים במלאי למסירה מיידית. אפשרות מימון עד 100% ללא מקדמה ועד 100 תשלומים."}</p>
              <small className="vehicleCodes"><span><b>קוד פנייה:</b> (67-{car.id}-00)</span><span><b>קוד רכב:</b> {car.id}</span></small>
            </div>
            <div className="heroPricing">
              <p><b>מחיר מבוקש:</b> {price.toLocaleString("he-IL")} ₪</p>
              <p><b>החזר חודשי:</b> {car.monthly > 0 ? `${car.monthly.toLocaleString("he-IL")} ₪` : "יש לפנות לנציג"}</p>
              <p><b>סכום מקדמה:</b> {(car.advance ?? 0).toLocaleString("he-IL")} ₪</p>
            </div>
            <VehicleFinanceCalculator price={price} year={vehicleYear} />
            <div className="modernTrust">
              <span>✓ עד {maxPayments} תשלומים</span><span>✓ טרייד אין</span><span>✓ ליווי אישי</span>
            </div>
          </div>
          <VehicleGallery images={galleryImages} vehicleName={`${car.make} ${car.model}`} />
        </div>
      </section>

      <section className="modernLeadSection">
        <div className="shell modernLeadBox">
          <div><span>רוצים לשמוע עוד?</span><h2>השאירו פרטים ונחזור אליכם</h2><p>נציג מקצועי יחזור אליכם עם כל המידע על הרכב ואפשרויות המימון.</p></div>
          <form className="modernLeadForm">
            <input name="name" required placeholder="שם מלא" aria-label="שם מלא" />
            <input name="phone" required placeholder="טלפון" aria-label="טלפון" />
            <input name="vehicle" defaultValue={`${car.make} ${car.model} ${car.year}`} aria-label="רכב" />
            <button type="submit">שלחו פרטים</button>
          </form>
        </div>
      </section>

      <section className="modernRelated">
        <div className="shell">
          <header className="modernSectionHeading"><span>אולי יעניין אתכם</span><h2>רכבים נוספים במלאי</h2></header>
          <div className="modernRelatedGrid">
            {relatedCars.map((item) => (
              <a className="modernRelatedCard" href={`/car/${item.id}`} key={item.id}>
                <div className={item.image ? "" : "missing"}>
                  {item.image ? <img src={imageSrc(item.image)} alt={`${item.make} ${item.model}`} /> : <><img src="/assets/logo1.png" alt="" /><span>תמונה תעלה בקרוב</span></>}
                </div>
                <section><small>{item.category}</small><h3>{item.make} {item.model}</h3><p>{item.year} · {item.gear || "אוטומטי"} · {Number(item.mileage.replace(/,/g, "") || 0).toLocaleString("he-IL")} ק״מ</p><strong>{item.price > 0 ? `${item.price.toLocaleString("he-IL")} ₪` : `החל מ־${item.monthly.toLocaleString("he-IL")} ₪ בחודש`}</strong></section>
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <div className="shell footerGrid">
          <div className="footerBrand"><img src="/assets/logo1.png" alt="ענק הרכבים" /><p>ענק הרכבים — קנייה, מכירה, מימון וטרייד אין במקום אחד.</p></div>
          <div><h3>ניווט מהיר</h3><a href="/">דף הבית</a><a href="/#inventory">רכבים במלאי</a><a href="/finance">תנאי מימון</a></div>
          <div><h3>צרו קשר</h3><a href="tel:*2369">*2369</a><a href="tel:0503707010">050-3707010</a><span>דוד רזיאל 4, ראשון לציון</span></div>
        </div>
      </footer>

      <div className="modernMobileBar"><a href="tel:*2369">חייגו *2369</a><a href={whatsapp}>וואטסאפ</a></div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
    </main>
  );
}
