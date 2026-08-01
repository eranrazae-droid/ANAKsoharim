import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { Breadcrumbs } from "../page-schema";
import { reviews } from "../reviews-data";
import { getActiveVehicles } from "../vehicle-api";
import { CheckIcon, NextIcon, PhoneIcon, PinIcon, StarIcon } from "../icons";
import { BUSINESS, GOOGLE_REVIEWS, SITE_NAME, SITE_URL } from "../site-config";

// מחליף את העמוד הוותיק /לקוחות-ממליצים.asp מהאתר הישן.
export const revalidate = 600;

export const metadata: Metadata = {
  title: "לקוחות ממליצים",
  description:
    "מה הלקוחות שלנו מספרים על ענק הרכבים בראשון לציון — שירות, אמינות, מימון וטרייד אין. חוות דעת של לקוחות שרכשו ומכרו אצלנו רכב.",
  alternates: { canonical: "/reviews" },
};

const WHATSAPP = `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent("שלום, אני מתעניין ברכב")}`;

/** חמישה כוכבים, מלאים עד הדירוג */
function Stars({ value }: { value: number }) {
  return (
    <span className="revStars" aria-label={`דירוג ${value} מתוך 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <StarIcon key={index} size={15} className={index < value ? "on" : ""} />
      ))}
    </span>
  );
}

export default async function ReviewsPage() {
  const cars = await getActiveVehicles().catch(() => []);
  const years = new Date().getFullYear() - Number(BUSINESS.founded);

  /* נתוני דירוג מובנים מתפרסמים רק כשיש המלצות אמיתיות בקובץ
     הנתונים. ביקורות מומצאות אסורות, וגוגל מעניש עליהן. */
  const reviewSchema = reviews.length
    ? {
        "@context": "https://schema.org",
        "@type": "AutoDealer",
        name: SITE_NAME,
        url: SITE_URL,
        review: reviews.map((item) => ({
          "@type": "Review",
          author: { "@type": "Person", name: item.author },
          reviewBody: item.body,
          datePublished: item.date,
          reviewRating: item.rating
            ? { "@type": "Rating", ratingValue: item.rating, bestRating: 5 }
            : undefined,
        })),
      }
    : null;

  /* ארבע עובדות. כולן נכונות ובדוקות — אין כאן מספר שהומצא. */
  const facts = [
    { big: String(years), small: `שנות ותק — מאז ${BUSINESS.founded}` },
    { big: cars.length ? String(cars.length) : "—", small: "רכבים במלאי כרגע" },
    { big: "100%", small: "מימון, גם ללא מקדמה" },
    { big: "טרייד אין", small: "על כל רכב, גם אם לא קונים מאיתנו" },
  ];

  return (
    <main dir="rtl">
      <SiteHeader />

      <section className="innerHero">
        <div className="shell">
          <span>מה אומרים עלינו</span>
          <h1>לקוחות ממליצים</h1>
          <p>לקוחות שרכשו ומכרו אצלנו רכב מספרים על החוויה.</p>
        </div>
      </section>

      <section className="section reviewsPage">
        <div className="shell">
          {/* ——— פס העובדות ——— */}
          <ul className="revFacts">
            {facts.map((fact) => (
              <li key={fact.small}>
                <b>{fact.big}</b>
                <span>{fact.small}</span>
              </li>
            ))}
          </ul>

          {/* ——— הביקורות ——— */}
          {reviews.length > 0 ? (
            <>
            <div className="revGrid">
              {reviews.map((item, index) => (
                <article className="revCard" key={`${item.author}-${index}`}>
                  <header>
                    <span className="revAvatar" aria-hidden="true">{item.author.slice(0, 1)}</span>
                    <div>
                      <h3>{item.author}</h3>
                      <p className="revMeta">
                        {item.rating && <Stars value={item.rating} />}
                        {item.car && <small>{item.car}</small>}
                        {item.source === "google" && <small className="revFrom">מתוך גוגל</small>}
                      </p>
                    </div>
                  </header>
                  <blockquote>{item.body}</blockquote>
                </article>
              ))}
            </div>
            {/* מה שמופיע כאן הוא מבחר. השאר נמצא בגוגל. */}
            <p className="revMore">
              <a className="revGoogle" href={GOOGLE_REVIEWS} target="_blank" rel="noreferrer">
                לכל הביקורות בגוגל <NextIcon size={15} />
              </a>
            </p>
            </>
          ) : (
            <div className="revEmpty">
              <h2>הביקורות שלנו נמצאות בגוגל</h2>
              <p>
                עוד לא העלינו לכאן ביקורות. מה שלקוחות כתבו עלינו נמצא בכרטיס
                העסק בגוגל — מקום שאנחנו לא יכולים לערוך או למחוק, ולכן גם
                המקום האמין ביותר לקרוא בו.
              </p>
              <a className="revGoogle" href={GOOGLE_REVIEWS} target="_blank" rel="noreferrer">
                לקריאת הביקורות בגוגל <NextIcon size={15} />
              </a>
            </div>
          )}

          {/* ——— מה מקבלים אצלנו ——— */}
          <section className="revPromise">
            <h2>על מה אנחנו נשפטים</h2>
            <ul>
              <li><CheckIcon size={15} /> מחיר מלא ומפורט לכל רכב באתר, בלי הפתעות</li>
              <li><CheckIcon size={15} /> כל רכב עובר בדיקה לפני מסירה</li>
              <li><CheckIcon size={15} /> מימון מסודר מול חברות מוכרות, גם ללא מקדמה</li>
              <li><CheckIcon size={15} /> טרייד אין לרכב שלכם, גם אם אתם לא קונים מאיתנו</li>
            </ul>
          </section>

          {/* ——— הזמנה לכתוב ——— */}
          <aside className="revAsk">
            <h2>קניתם אצלנו רכב?</h2>
            <p>נשמח שתספרו על החוויה. ביקורת בגוגל לוקחת דקה ועוזרת ללקוח הבא.</p>
            <div className="revAskLinks">
              <a className="revGoogle" href={GOOGLE_REVIEWS} target="_blank" rel="noreferrer">
                לכתיבת ביקורת בגוגל <NextIcon size={15} />
              </a>
              <a href={`tel:${BUSINESS.dial}`}>
                <PhoneIcon size={15} /> <bdi dir="ltr">{BUSINESS.phone}</bdi>
              </a>
              <a href={WHATSAPP} target="_blank" rel="noreferrer">ווטסאפ</a>
              <span className="revWhere">
                <PinIcon size={15} /> {BUSINESS.street}, {BUSINESS.city}
              </span>
            </div>
          </aside>
        </div>
      </section>

      <SiteFooter />
      <Breadcrumbs path="/reviews" name="לקוחות ממליצים" />

      {reviewSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema) }} />
      )}
    </main>
  );
}
