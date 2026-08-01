/**
 * גרסאות התמונה.
 *
 * כל תצלום נשמר בשלושה גדלים שנוצרים אוטומטית בהעלאה:
 * 240 לממוזערת, 600 לכרטיס ו-1200 לתצוגה מלאה. הדפדפן בוחר לבד
 * את הגרסה שמתאימה לרוחב שהוא צריך ולצפיפות המסך, דרך srcset.
 *
 * הפורמט המועדף הוא WebP — קטן בכשלושים אחוז מ-JPEG באותה איכות.
 * ה-JPEG נשאר כגיבוי לדפדפנים ישנים דרך תגית picture.
 *
 * ההמרה עצמה נעשית בהעלאה על ידי התוסף Resize Images של
 * Firebase Storage, לא בקוד האתר. ראה IMAGES.md.
 */

export const SIZES = [240, 600, 1200] as const;
export type ImageSize = (typeof SIZES)[number];

/** תיקיית היעד של התוסף. ניתנת לשינוי בלי נגיעה בקוד. */
const RESIZED_DIR = process.env.NEXT_PUBLIC_RESIZED_DIR || "resized";

/** האם התמונות המומרות כבר קיימות. עד שהתוסף מותקן — מגישים את המקור. */
export const VARIANTS_READY = process.env.NEXT_PUBLIC_IMAGE_VARIANTS === "true";

type Parts = { dir: string; name: string; ext: string; query: string };

function split(url: string): Parts | null {
  const [pathPart, query = ""] = url.split("?");
  const slash = pathPart.lastIndexOf("/");
  const file = slash === -1 ? pathPart : pathPart.slice(slash + 1);
  const dot = file.lastIndexOf(".");
  if (dot <= 0) return null;
  return {
    dir: slash === -1 ? "" : pathPart.slice(0, slash + 1),
    name: file.slice(0, dot),
    ext: file.slice(dot + 1),
    query: query ? `?${query}` : "",
  };
}

/**
 * כתובת גרסה בגודל מסוים.
 * שם הקובץ נקבע לפי המוסכמה של התוסף: <שם>_<רוחב>x<רוחב>.<סיומת>
 */
export function variant(url: string, size: ImageSize, format: "webp" | "jpeg") {
  const parts = split(url);
  if (!parts) return url;
  const ext = format === "webp" ? "webp" : parts.ext;
  return `${parts.dir}${RESIZED_DIR}/${parts.name}_${size}x${size}.${ext}${parts.query}`;
}

/** רשימת גרסאות ל-srcset, לפי רוחב בפיקסלים */
export function srcSet(url: string, format: "webp" | "jpeg") {
  if (!VARIANTS_READY) return undefined;
  return SIZES.map((size) => `${variant(url, size, format)} ${size}w`).join(", ");
}

/** הכתובת שתוגש לדפדפנים שלא מבינים srcset */
export function fallbackSrc(url: string, size: ImageSize = 600) {
  return VARIANTS_READY ? variant(url, size, "jpeg") : url;
}

/**
 * ההנחיה לדפדפן כמה רוחב התמונה תופסת בפועל.
 * בלעדיה הדפדפן מניח רוחב מסך מלא ומוריד גרסה גדולה מהנדרש.
 */
export const CARD_SIZES = "(max-width: 700px) 100vw, 200px";
export const GALLERY_SIZES = "(max-width: 999px) 100vw, 600px";
export const THUMB_SIZES = "80px";
