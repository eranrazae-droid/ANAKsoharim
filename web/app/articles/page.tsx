import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { articles } from "../articles-data";

// מחליף את /articles.asp מהאתר הישן.
export const metadata: Metadata = {
  title: "מדריכים ומאמרים על רכב",
  description:
    "מדריכים מקצועיים מענק הרכבים: מימון רכב, קניית רכב יד שנייה, טרייד אין ומה חשוב לבדוק לפני שסוגרים עסקה.",
  alternates: { canonical: "/articles" },
};

export default function ArticlesPage() {
  return (
    <main dir="rtl">
      <SiteHeader />

      <section className="innerHero">
        <div className="shell">
          <span>הידע שלנו, פתוח לכולם</span>
          <h1>מדריכים ומאמרים</h1>
          <p>כל מה שכדאי לדעת לפני שקונים, מוכרים או ממנים רכב.</p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="benefitGrid">
            {articles.map((article) => (
              <article key={article.slug}>
                <h2><a href={`/articles/${article.slug}`}>{article.title}</a></h2>
                <p>{article.description}</p>
                <a className="cardButton" href={`/articles/${article.slug}`}>לקריאת המדריך</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
