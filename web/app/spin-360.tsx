"use client";

import { useRef, useState } from "react";
import { Picture } from "./site-image";
import { GALLERY_SIZES } from "./lib/images";

/**
 * סבב 360 מעלות.
 *
 * המערכת מספקת רשימת פריימים מסודרת — צילומים של הרכב מכל
 * הזוויות, לפי הסדר. גרירה באצבע או בעכבר מקדמת פריים, וכך
 * נוצרת תחושת סיבוב.
 *
 * הפריים הראשון בלבד נטען בפתיחה. השאר נטענים ברגע שנוגעים
 * בסבב, כדי שהוא לא יכביד על העמוד למי שלא משתמש בו.
 *
 * אין פריימים — הרכיב לא מציג דבר.
 */
export default function Spin360({ frames, alt }: { frames: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [awake, setAwake] = useState(false);
  const drag = useRef<{ x: number; from: number } | null>(null);

  if (frames.length < 2) return null;

  function move(x: number) {
    if (!drag.current) return;
    // רוחב מלא של הפריים שווה לסיבוב שלם
    const step = Math.round((drag.current.x - x) / 8);
    setIndex((((drag.current.from + step) % frames.length) + frames.length) % frames.length);
  }

  return (
    <div className="spinBox">
      <div
        className="spinStage"
        role="group"
        aria-label={`סבב 360 מעלות של ${alt}`}
        onPointerDown={(event) => {
          setAwake(true);
          drag.current = { x: event.clientX, from: index };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => move(event.clientX)}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        {frames.map((src, position) => (
          // עד הנגיעה הראשונה קיים רק הפריים הפותח
          (awake || position === 0) && (
            <div key={src} className={position === index ? "spinFrame on" : "spinFrame"}>
              <Picture src={src} alt={position === 0 ? alt : ""} sizes={GALLERY_SIZES} eager={position === 0} />
            </div>
          )
        ))}
        <span className="spinBadge" aria-hidden="true">360°</span>
      </div>

      <input
        className="spinSlider"
        type="range"
        min={0}
        max={frames.length - 1}
        value={index}
        onChange={(event) => { setAwake(true); setIndex(Number(event.target.value)); }}
        aria-label="סיבוב הרכב"
      />
      <p className="spinHint">גוררים לצדדים כדי לסובב את הרכב</p>
    </div>
  );
}
