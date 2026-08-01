"use client";

import { useState } from "react";
import { GALLERY_SIZES, THUMB_SIZES } from "./lib/images";
import { Logo, Picture } from "./site-image";

/**
 * גלריית הרכב.
 *
 * בפתיחת הדף נטענת רק התמונה הראשונה. השאר נטענות בלחיצה בלבד.
 * כשמסתכלים על תמונה מסוימת, רק הבאה בתור מוכנה ברקע — כדי
 * שהמעבר אליה יהיה מיידי בלי להוריד את כל הגלריה.
 *
 * הממוזערות משתמשות בגרסת 240 בלבד, שמשקלה כמה קילובייטים.
 */

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
            <Logo />
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
                <Picture src={src} alt="" sizes={THUMB_SIZES} />
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
