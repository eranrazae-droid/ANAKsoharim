"use client";

import { useRef, useState } from "react";
import { CARD_SIZES, fallbackSrc, srcSet } from "./lib/images";

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
          const webp = srcSet(src, "webp");
          const jpeg = srcSet(src, "jpeg");
          return ready ? (
            <picture key={src}>
              {webp && <source type="image/webp" srcSet={webp} sizes={CARD_SIZES} />}
              {jpeg && <source type="image/jpeg" srcSet={jpeg} sizes={CARD_SIZES} />}
              <img
                src={fallbackSrc(src)}
                alt={position === 0 ? alt : ""}
                loading={position === 0 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
              />
            </picture>
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
