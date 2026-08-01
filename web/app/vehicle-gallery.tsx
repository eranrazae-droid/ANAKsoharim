"use client";

import { useState } from "react";
import { GALLERY_SIZES, fallbackSrc, srcSet } from "./lib/images";

/**
 * גלריית הרכב.
 *
 * בפתיחת הדף נטענת רק התמונה הראשונה. השאר נטענות בלחיצה בלבד.
 * כשמסתכלים על תמונה מסוימת, רק הבאה בתור מוכנה ברקע — כדי
 * שהמעבר אליה יהיה מיידי בלי להוריד את כל הגלריה.
 *
 * הממוזערות משתמשות בגרסת 240 בלבד, שמשקלה כמה קילובייטים.
 */

function Picture({ src, alt, sizes, eager }: { src: string; alt: string; sizes: string; eager?: boolean }) {
  const webp = srcSet(src, "webp");
  const jpeg = srcSet(src, "jpeg");
  return (
    <picture>
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      {jpeg && <source type="image/jpeg" srcSet={jpeg} sizes={sizes} />}
      <img
        src={fallbackSrc(src, eager ? 1200 : 600)}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding={eager ? "sync" : "async"}
      />
    </picture>
  );
}

export default function VehicleGallery({ images, vehicleName }: { images: string[]; vehicleName: string }) {
  const [selected, setSelected] = useState(0);
  // התמונה שנבחרה, והבאה אחריה בלבד. לא יותר.
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0]));

  function show(index: number) {
    setSelected(index);
    setLoaded((current) => new Set([...current, index, (index + 1) % images.length]));
  }

  const main = images[selected] ?? images[0] ?? null;

  return (
    <div className="carGallery">
      <figure className={`carGalleryMain ${main ? "" : "carGalleryEmpty"}`}>
        {main ? (
          <Picture
            src={main}
            alt={`${vehicleName} — תמונה ${selected + 1} מתוך ${images.length}`}
            sizes={GALLERY_SIZES}
            eager
          />
        ) : (
          <figcaption>
            <img src="/assets/logo1.png" alt="ענק הרכבים" />
            <strong>תמונות הרכב יעלו בקרוב</strong>
            <span>הרכב קיים במלאי למסירה מיידית</span>
          </figcaption>
        )}
        <span className="carGalleryBadge">במלאי</span>
      </figure>

      {images.length > 1 && (
        <div className="carGalleryThumbs" role="group" aria-label="תמונות נוספות של הרכב">
          {images.map((src, index) => (
            <button
              type="button"
              key={src}
              className={index === selected ? "active" : ""}
              aria-label={`תמונה ${index + 1}`}
              aria-pressed={index === selected}
              onClick={() => show(index)}
            >
              {loaded.has(index) ? (
                <Picture src={src} alt="" sizes="80px" />
              ) : (
                <span className="carThumbHold" aria-hidden="true">{index + 1}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
