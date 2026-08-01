import { reviews } from "./reviews-data";
import { CARD_SIZES } from "./lib/images";
import { Picture } from "./site-image";

/**
 * רצועת לקוחות — תמונות ריבועיות של לקוחות שקנו רכב,
 * ומתחת לכל תמונה מה שהלקוח אמר. נגללת לצדדים.
 *
 * כל עוד אין המלצות אמיתיות בקובץ הנתונים, מוצגות מסגרות
 * ריקות מסומנות. אין ממציאים ביקורות.
 */
const PLACEHOLDERS = 10;

export default function CustomerStrip() {
  const hasReviews = reviews.length > 0;

  return (
    <section className="customerStrip" aria-labelledby="customersTitle">
      <div className="shell">
        <header className="customerHead">
          <span className="eyebrow">לקוחות מספרים</span>
          <h2 id="customersTitle">הם כבר נוסעים עם רכב מאיתנו</h2>
        </header>

        <div className="customerRow" role="list" tabIndex={0} aria-label="ביקורות לקוחות, ניתן לגלול לצדדים">
          {hasReviews
            ? reviews.map((review, index) => (
                /* ביקורת בלי תמונת לקוח מקבלת כרטיס טקסט עם עיגול
                   קטן. ריבוע אפור ריק בגודל מלא נראה כמו תקלה. */
                <article
                  className={`customerCard ${review.photo ? "" : "customerCardText"}`}
                  role="listitem"
                  key={`${review.author}-${index}`}
                >
                  {review.photo ? (
                    <div className="customerPhoto">
                      <Picture src={review.photo} alt={`${review.author} עם הרכב שרכש`} sizes={CARD_SIZES} />
                    </div>
                  ) : (
                    <span className="customerAvatar" aria-hidden="true">{review.author.slice(0, 1)}</span>
                  )}
                  <blockquote className="customerQuote">{review.body}</blockquote>
                  <p className="customerName">
                    {review.author}
                    {review.car && <small>{review.car}</small>}
                  </p>
                </article>
              ))
            : Array.from({ length: PLACEHOLDERS }, (_, index) => (
                <article className="customerCard customerCardEmpty" role="listitem" key={index}>
                  <div className="customerPhoto customerPhotoEmpty"><span>תמונת לקוח</span></div>
                  <blockquote className="customerQuote">מקום לביקורת של הלקוח</blockquote>
                  <p className="customerName">שם הלקוח<small>הרכב שנרכש</small></p>
                </article>
              ))}
        </div>

        {!hasReviews && (
          <p className="customerHint">
            הרצועה תתמלא בתמונות ובביקורות אמיתיות של לקוחות.
            עד אז מוצגות מסגרות ריקות.
          </p>
        )}
      </div>
    </section>
  );
}
