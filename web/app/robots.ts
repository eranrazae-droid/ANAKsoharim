import type { MetadataRoute } from "next";
import { IS_LIVE, SITE_URL } from "./site-config";

export default function robots(): MetadataRoute.Robots {
  // אתר הכנה — חסימה מלאה כדי שגוגל לא יאנדקס אותו במקביל לאתר הישן.
  if (!IS_LIVE) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
