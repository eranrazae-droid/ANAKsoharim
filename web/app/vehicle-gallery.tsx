"use client";

import { useState } from "react";

/**
 * גלריית הרכב — תמונה ראשית גדולה ורצועת תמונות תחתיה.
 * מוצגות רק תמונות שקיימות בפועל, בלי מסגרות ריקות.
 */
export default function VehicleGallery({ images, vehicleName }: { images: string[]; vehicleName: string }) {
  const [selected, setSelected] = useState(0);
  const main = images[selected] ?? images[0] ?? null;

  return (
    <div className="carGallery">
      <figure className={`carGalleryMain ${main ? "" : "carGalleryEmpty"}`}>
        {main ? (
          <img src={main} alt={`${vehicleName} — תמונה ${selected + 1} מתוך ${images.length}`} />
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
              onClick={() => setSelected(index)}
            >
              <img src={src} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
