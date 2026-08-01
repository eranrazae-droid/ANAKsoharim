import type { MetadataRoute } from "next";
import { SITE_URL } from "./site-config";
import { getActiveVehicles } from "./vehicle-api";
import { articles } from "./articles-data";

// מתרענן פעם בשעה כדי שרכבים חדשים ייכנסו למפת האתר בלי בנייה מחדש.
export const revalidate = 3600;

const STATIC_PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/cars", priority: 0.9, changeFrequency: "daily" },
  { path: "/finance", priority: 0.8, changeFrequency: "monthly" },
  { path: "/trade", priority: 0.8, changeFrequency: "monthly" },
  { path: "/sell", priority: 0.8, changeFrequency: "monthly" },
  { path: "/compare", priority: 0.7, changeFrequency: "weekly" },
  { path: "/reviews", priority: 0.6, changeFrequency: "monthly" },
  { path: "/articles", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" },
  { path: "/lead", priority: 0.6, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const pages: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  for (const article of articles) {
    pages.push({
      url: `${SITE_URL}/articles/${article.slug}`,
      lastModified: new Date(article.updated),
      changeFrequency: "yearly",
      priority: 0.5,
    });
  }

  // אם המלאי לא זמין רגעית, עדיף מפת אתר עם העמודים הקבועים מאשר כישלון בנייה.
  try {
    const cars = await getActiveVehicles();

    // עמודי המלאי מעבר לראשון — כדי שגוגל יגיע לכל הרכבים
    const CARS_PER_PAGE = 30;
    const carPages = Math.ceil(cars.length / CARS_PER_PAGE);
    for (let page = 2; page <= carPages; page += 1) {
      pages.push({
        url: `${SITE_URL}/cars?page=${page}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }

    for (const car of cars) {
      pages.push({
        url: `${SITE_URL}/car/${car.id}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // מתעלמים — נשארים עם העמודים הקבועים.
  }

  return pages;
}
