import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { Breadcrumbs } from "../page-schema";
import { getActiveVehicles, type DisplayCar } from "../vehicle-api";
import VehicleCard from "../vehicle-card";
import MobileReveal from "../mobile-reveal";
import { SITE_NAME, SITE_URL } from "../site-config";

// מחליף את עמודי המלאי הוותיקים של האתר הישן:
// /cars.asp, /רכבים-ראשון-לציון.asp, /מגרשי-מכוניות.asp
export const revalidate = 600;

/**
 * שלושים רכבים בעמוד.
 * זה הגבול שמחזיק את משקל העמוד בטלפון מתחת למגה וחצי, וגם מספיק
 * כדי שגולש יראה מבחר בלי לגלול לנצח. שאר העמודים נגישים בקישורים
 * רגילים — כך גם הגולש וגם גוגל מגיעים לכל המלאי.
 */
const PER_PAGE = 30;

type Search = { searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ searchParams }: Search): Promise<Metadata> {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const suffix = page > 1 ? ` — עמוד ${page}` : "";
  return {
    title: `מלאי רכבים עדכני — רכבים משומשים בראשון לציון${suffix}`,
    description:
      "מלאי הרכבים המשומשים של ענק הרכבים בראשון לציון. עשרות רכבים מכל הסוגים והשנתונים, מחירים מלאים, מימון עד 100% ועד 100 תשלומים וטרייד אין על כל רכב.",
    alternates: { canonical: page > 1 ? `/cars?page=${page}` : "/cars" },
  };
}

export default async function CarsPage({ searchParams }: Search) {
  const cars = await getActiveVehicles().catch(() => [] as DisplayCar[]);
  const pages = Math.max(1, Math.ceil(cars.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number((await searchParams).page) || 1));
  const shown = cars.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const listSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `מלאי רכבים — ${SITE_NAME}`,
    numberOfItems: cars.length,
    itemListElement: shown.map((car, index) => ({
      "@type": "ListItem",
      position: (page - 1) * PER_PAGE + index + 1,
      url: `${SITE_URL}/car/${car.id}`,
      name: `${car.make} ${car.model} ${car.year}`,
    })),
  };

  const href = (target: number) => (target === 1 ? "/cars" : `/cars?page=${target}`);

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

          {/* בטלפון הרשימה מקופלת — שלושים כרטיסים הם גלילה ארוכה.
              כולם ב-HTML, רק התצוגה מקופלת עד לחיצה. */}
          <MobileReveal label={`${shown.length} רכבים בעמוד הזה`}>
            <div className="listGrid">
              {shown.map((car) => <VehicleCard car={car} key={car.id} />)}
            </div>
          </MobileReveal>

          {pages > 1 && (
            <nav className="pager" aria-label="עמודי המלאי">
              {page > 1 && <a className="pagerStep" href={href(page - 1)} rel="prev">← הקודם</a>}
              <span className="pagerNow">עמוד {page} מתוך {pages}</span>
              {page < pages && <a className="pagerStep" href={href(page + 1)} rel="next">הבא →</a>}
              <span className="pagerAll">
                {Array.from({ length: pages }, (_, index) => index + 1).map((target) => (
                  <a key={target} href={href(target)} className={target === page ? "on" : ""} aria-current={target === page ? "page" : undefined}>
                    {target}
                  </a>
                ))}
              </span>
            </nav>
          )}
        </div>
      </section>

      <SiteFooter />
      <Breadcrumbs path="/cars" name="מלאי עדכני" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listSchema) }} />
    </main>
  );
}
