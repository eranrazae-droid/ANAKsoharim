"use client";

import { useState } from "react";

export default function VehicleGallery({ images, vehicleName }: { images: string[]; vehicleName: string }) {
  const [selected, setSelected] = useState(0);
  const slots = Array.from({ length: 10 }, (_, index) => images[index] ?? null);
  const mainImage = images[selected] ?? images[0] ?? null;

  return (
    <aside className="sideGallery">
      <div className={`modernMainImage ${mainImage ? "" : "modernImageMissing"}`}>
        <span className="stockBadge">במלאי</span>
        {mainImage ? (
          <img src={mainImage} alt={`${vehicleName} - תמונה ${selected + 1}`} />
        ) : (
          <div className="modernPlaceholder">
            <img src="/assets/logo1.png" alt="ענק הרכבים" />
            <strong>תמונות הרכב יעלו בקרוב</strong>
            <span>הרכב קיים במלאי למסירה מיידית</span>
          </div>
        )}
      </div>
      <div className="modernThumbs interactiveThumbs">
        {slots.map((src, index) => (
          src ? (
            <button
              type="button"
              className={index === selected ? "active" : ""}
              key={src}
              onClick={() => setSelected(index)}
              aria-label={`הצגת תמונה ${index + 1} של ${vehicleName}`}
            >
              <img src={src} alt="" />
            </button>
          ) : (
            <div className="empty" key={`empty-${index}`}><span>תמונה</span></div>
          )
        ))}
      </div>
    </aside>
  );
}
