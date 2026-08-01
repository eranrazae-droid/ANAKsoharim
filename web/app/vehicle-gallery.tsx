"use client";

import { useState } from "react";
import { GALLERY_SIZES, THUMB_SIZES } from "./lib/images";
import { Logo, Picture } from "./site-image";
import { PlayIcon } from "./icons";

/**
 * גלריית הרכב.
 *
 * הפריסה במחשב היא בצורת האות ר הפוכה: עמודת תמונות יורדת לצד
 * התמונה הגדולה, ומתחת לשתיהן שורה לרוחב כל המסך. בשורה
 * התחתונה שמורים גם שני מקומות קבועים — סבב 360 מעלות וסרטון.
 * בטלפון הכל נערם: התמונה למעלה ושורה נגללת מתחתיה.
 *
 * הממוזערות נטענות בגרסת 240 בלבד — כמה קילובייטים כל אחת —
 * ולכן הן מוצגות מיד. קודם הן היו ריבועים אפורים עם מספר עד
 * שלוחצים, וזה נראה כאילו הגלריה לא נטענה.
 *
 * התמונה הגדולה מתחלפת בלחיצה, בגודל המלא.
 */

/** כמה תמונות יורדות בעמודה שלצד התמונה הגדולה */
const SIDE = 4;

export default function VehicleGallery({
  images,
  vehicleName,
  hasSpin = false,
  hasVideo = false,
}: {
  images: string[];
  vehicleName: string;
  hasSpin?: boolean;
  hasVideo?: boolean;
}) {
  const [selected, setSelected] = useState(0);

  const main = images[selected] ?? images[0] ?? null;

  function Thumb({ index }: { index: number }) {
    return (
      <button
        type="button"
        className={index === selected ? "active" : ""}
        aria-label={`תמונה ${index + 1}`}
        aria-pressed={index === selected}
        onClick={() => setSelected(index)}
      >
        <Picture src={images[index]} alt="" sizes={THUMB_SIZES} />
      </button>
    );
  }

  /* ארבע הראשונות יורדות בעמודה שלצד התמונה הגדולה, וכל השאר
     עוברות לשורה שמתחת. */
  const side = images.map((_, index) => index).slice(0, SIDE);
  const row = images.map((_, index) => index).slice(SIDE);

  /** מקום שמור לסבב או לסרטון. אין תוכן — מוצג כמקום שמחכה. */
  function Extra({ label, ready, href }: { label: string; ready: boolean; href: string }) {
    const inner = (
      <>
        <PlayIcon size={18} />
        <b>{label}</b>
        {!ready && <small>בקרוב</small>}
      </>
    );
    return ready
      ? <a className="carGalleryExtra" href={href}>{inner}</a>
      : <span className="carGalleryExtra carGalleryExtraSoon">{inner}</span>;
  }

  return (
    <div className="carGallery">
      {images.length > 1 && (
        <div className="carGalleryStrip" role="group" aria-label="תמונות נוספות של הרכב">
          {side.map((index) => <Thumb index={index} key={index} />)}
        </div>
      )}

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

      <div className="carGalleryRow">
        {row.map((index) => <Thumb index={index} key={index} />)}
        <Extra label="360°" ready={hasSpin} href="#carSpin" />
        <Extra label="סרטון" ready={hasVideo} href="#carVideo" />
      </div>
    </div>
  );
}
