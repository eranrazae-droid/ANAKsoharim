import { CARD_SIZES, fallbackSrc, srcSet } from "./lib/images";

/**
 * תמונה שמגישה WebP עם JPEG כגיבוי, ובוחרת גודל לפי המסך.
 *
 * הדפדפן מוריד גרסה אחת בלבד — זו שמתאימה לרוחב שהיא תופסת בפועל
 * ולצפיפות המסך. בטלפון זו בדרך כלל גרסת 600 ולא 1200.
 */
export default function SmartImage({
  src,
  alt,
  sizes = CARD_SIZES,
  eager = false,
  className,
}: {
  src: string;
  alt: string;
  sizes?: string;
  /** רק לתמונה הראשונה שנראית בפתיחת הדף */
  eager?: boolean;
  className?: string;
}) {
  const webp = srcSet(src, "webp");
  const jpeg = srcSet(src, "jpeg");

  return (
    <picture className={className}>
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      {jpeg && <source type="image/jpeg" srcSet={jpeg} sizes={sizes} />}
      <img
        src={fallbackSrc(src)}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding={eager ? "sync" : "async"}
      />
    </picture>
  );
}
