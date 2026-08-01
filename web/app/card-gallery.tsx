"use client";

import { useRef, useState } from "react";
import { CARD_SIZES } from "./lib/images";
import { Picture } from "./site-image";

/**
 * גלריית התמונות שבראש כרטיס הרכב.
 * גוללים באצבע מצד לצד, והנקודות שמתחת מסמנות באיזו תמונה נמצאים.
 * הנקודות הן סימון בלבד ולא כפתורים — הכרטיס כולו הוא קישור אחד,
 * ואסור לקנן בתוכו אלמנט לחיץ נוסף.
 */
export default function CardGallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  function trackPosition() {
    const element = strip.current;
    if (!element || !element.clientWidth) return;
    // ב-RTL הגלילה נספרת אחורה, ולכן לוקחים את הערך המוחלט
    const current = Math.round(Math.abs(element.scrollLeft) / element.clientWidth);
    if (current !== index) setIndex(current);
  }

  return (
    <>
      <div className="listSlides" ref={strip} onScroll={trackPosition}>
        {images.map((src, position) => {
          // רק התמונה הנוכחית והבאה אחריה מוכנות. השאר ממתינות.
          const ready = position <= index + 1;
          return ready ? (
            <Picture
              key={src}
              src={src}
              alt={position === 0 ? alt : ""}
              sizes={CARD_SIZES}
              draggable={false}
            />
          ) : (
            <span className="listSlideHold" key={src} aria-hidden="true" />
          );
        })}
      </div>

      {images.length > 1 && (
        <span className="listDots" aria-hidden="true">
          {images.map((src, position) => (
            <i key={src} className={position === index ? "on" : ""} />
          ))}
        </span>
      )}
    </>
  );
}
