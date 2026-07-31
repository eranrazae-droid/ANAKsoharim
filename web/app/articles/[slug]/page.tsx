import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../site-chrome";
import { articles, findArticle } from "../../articles-data";
import { SITE_NAME, SITE_URL } from "../../site-config";

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) return { title: "המאמר לא נמצא", robots: { index: false, follow: true } };

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: "article",
      locale: "he_IL",
      title: article.title,
      description: article.description,
      url: `${SITE_URL}/articles/${article.slug}`,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) notFound();

  const others = articles.filter((item) => item.slug !== article.slug);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    dateModified: article.updated,
    inLanguage: "he-IL",
    mainEntityOfPage: `${SITE_URL}/articles/${article.slug}`,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/assets/logo1.png` },
    },
  };

  return (
    <main dir="rtl">
      <SiteHeader />

      <section className="innerHero">
        <div className="shell">
          <span><a href="/articles">מדריכים ומאמרים</a></span>
          <h1>{article.title}</h1>
          <p>{article.description}</p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          {article.body.map((paragraph, index) =>
            paragraph.startsWith("## ")
              ? <h2 key={index}>{paragraph.slice(3)}</h2>
              : <p key={index}>{paragraph}</p>,
          )}

          {others.length > 0 && (
            <>
              <h2>מדריכים נוספים</h2>
              <ul>
                {others.map((item) => (
                  <li key={item.slug}><a href={`/articles/${item.slug}`}>{item.title}</a></li>
                ))}
              </ul>
            </>
          )}

          <p className="intro">
            רוצים לדבר עם נציג? <a href="tel:*2369">*2369</a> או{" "}
            <a href="/contact">השאירו פרטים</a>.
          </p>
        </div>
      </section>

      <SiteFooter />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
    </main>
  );
}
