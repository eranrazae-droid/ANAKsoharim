import { fallbackSrc, localWebp, srcSet, type ImageSize } from "./lib/images";

/**
 * תמונה עם גיבוי.
 *
 * הדפדפן מקבל WebP אם הוא יודע לקרוא אותו, ו-JPEG אם לא. אין כאן
 * לוגיקה של מצב, ולכן הרכיב עובד גם בצד השרת וגם בצד הלקוח בלי
 * לגרור קוד לדפדפן.
 *
 * שני מקורות אפשריים ל-WebP:
 * 1. תצלומי רכבים מ-Firebase — הגרסאות נוצרות בתוסף, דרך srcSet
 * 2. תמונות של האתר עצמו — קובץ webp צמוד, דרך localWebp
 */
export function Picture({
  src,
  alt,
  sizes,
  eager,
  className,
  draggable,
}: {
  src: string;
  alt: string;
  sizes?: string;
  /** תמונה שנראית מיד בפתיחת הדף — נטענת ראשונה ובלי השהיה */
  eager?: boolean;
  className?: string;
  draggable?: boolean;
}) {
  const webp = srcSet(src, "webp");
  const jpeg = srcSet(src, "jpeg");
  const local = webp ? undefined : localWebp(src);
  const size: ImageSize = eager ? 1200 : 600;

  return (
    <picture className={className}>
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      {jpeg && <source type="image/jpeg" srcSet={jpeg} sizes={sizes} />}
      {local && <source type="image/webp" srcSet={local} sizes={sizes} />}
      <img
        src={fallbackSrc(src, size)}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding={eager ? "sync" : "async"}
        draggable={draggable}
      />
    </picture>
  );
}

/**
 * הלוגו של העסק.
 *
 * מופיע בכותרת, בתחתית ובמקומות שאין בהם תצלום רכב. בגרסת WebP
 * הוא שוקל שמינית מקובץ ה-PNG המקורי, שנשאר כגיבוי.
 * בכותרת הוא נראה מיד ולכן eager, בשאר המקומות נטען בגלילה.
 */
export function Logo({ eager }: { eager?: boolean }) {
  return (
    <picture>
      <source type="image/webp" srcSet="/assets/logo1.webp" />
      <img
        src="/assets/logo1.png"
        alt="ענק הרכבים"
        width={246}
        height={75}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
      />
    </picture>
  );
}
