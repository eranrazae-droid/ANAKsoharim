import { SITE_NAME, SITE_URL } from "./site-config";

/**
 * סימון פירורי לחם לגוגל.
 * מאפשר להציג בתוצאות החיפוש "ענק הרכבים › מלאי עדכני" במקום
 * כתובת האתר החשופה, ומסביר לגוגל את מבנה האתר.
 */
export function Breadcrumbs({ path, name }: { path: string; name: string }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "דף הבית", item: SITE_URL },
      { "@type": "ListItem", position: 2, name, item: `${SITE_URL}${path}` },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
}

export type Question = { q: string; a: string };

/**
 * שאלות ותשובות.
 * מוצגות בעמוד וגם מסומנות לגוגל, כך שהן עשויות להופיע כתשובות
 * מורחבות בתוצאות החיפוש. הסימון חייב להתאים לטקסט שרואים בעמוד.
 */
export function Faq({ items, title = "שאלות שחוזרות אצלנו" }: { items: Question[]; title?: string }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section className="faqSection section">
      <div className="shell">
        <h2>{title}</h2>
        <dl className="faqList">
          {items.map((item) => (
            <div key={item.q}>
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
        <p className="faqNote">
          לא מצאתם תשובה? חייגו {SITE_NAME.includes("ענק") ? "*2369" : ""} ונשמח לעזור.
        </p>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </section>
  );
}
