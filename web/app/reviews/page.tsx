import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { reviews } from "../reviews-data";
import { SITE_NAME, SITE_URL } from "../site-config";

// מחליף את העמוד הוותיק /לקוחות-ממליצים.asp מהאתר הישן.
export const metadata: Metadata = {
  title: "לקוחות ממליצים",
  description:
    "מה הלקוחות שלנו מספרים על ענק הרכבים בראשון לציון — שירות, אמינות, מימון וטרייד אין. חוות דעת של לקוחות שרכשו ומכרו אצלנו רכב.",
  alternates: { canonical: "/reviews" },
};

export default function ReviewsPage() {
  // נתוני דירוג מובנים מתפרסמים רק כשיש המלצות אמיתיות בקובץ הנתונים.
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

      <section className="section">
        <div className="shell">
          {reviews.length === 0 ? (
            <p className="intro">
              ההמלצות שלנו בדרך. בינתיים נשמח לספר לכם על התהליך בטלפון{" "}
              <a href="tel:*2369">*2369</a>.
            </p>
          ) : (
            <div className="benefitGrid">
              {reviews.map((item, index) => (
                <article key={`${item.author}-${index}`}>
                  <p>{item.body}</p>
                  <h3>{item.author}</h3>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />

      {reviewSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema) }} />
      )}
    </main>
  );
}
