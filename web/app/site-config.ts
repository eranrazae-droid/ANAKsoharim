// הגדרות זהות האתר. נקודה אחת לשינוי — לא לפזר כתובות בקוד.

export const SITE_NAME = "ענק הרכבים";

// הדומיין הסופי שאליו האתר יעבור. משמש ל-canonical, sitemap ו-Open Graph.
export const SITE_URL = "https://www.03-5189189.co.il";

/**
 * מתג העלייה לאוויר.
 *
 * כל עוד הוא כבוי, האתר חסום לחלוטין בפני גוגל — גם ב-robots.txt וגם
 * בתגית meta בכל עמוד. זה מונע מאתר ההכנה להתחרות באתר הישן בגוגל.
 *
 * ביום המעבר: להגדיר ב-Vercel את משתנה הסביבה
 *   NEXT_PUBLIC_SITE_LIVE=true
 * ולהריץ פריסה מחדש. זו הפעולה היחידה שפותחת את האתר לגוגל.
 */
export const IS_LIVE = process.env.NEXT_PUBLIC_SITE_LIVE === "true";

export const BUSINESS = {
  phone: "*2369",
  phoneIntl: "+972-3-5189189",
  mobile: "050-3707010",
  whatsapp: "972503707010",
  street: "דוד רזיאל 4",
  city: "ראשון לציון",
  country: "IL",
  latitude: 31.9888,
  longitude: 34.77084,
  founded: "1998",
} as const;
