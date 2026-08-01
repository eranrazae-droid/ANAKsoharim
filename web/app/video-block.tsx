"use client";

import { useState } from "react";
import { GALLERY_SIZES } from "./lib/images";
import { Picture } from "./site-image";
import { PlayIcon } from "./icons";

/**
 * סרטון הרכב — אחד בלבד, ונטען רק בלחיצה.
 *
 * עד הלחיצה מוצגת תמונת שער בלבד: אין iframe, אין קובץ וידאו,
 * ואין אף בקשת רשת לנגן. הקובץ יורד רק כשהגולש מבקש לראות אותו.
 * כך הסרטון לא משפיע על מהירות הדף ולא נספר במדדי גוגל.
 *
 * מוצג רק בעמוד הרכב. לא בדף הבית ולא ברשימת המלאי — שם סרטון
 * היה מכפיל את משקל העמוד בלי להוסיף ללקוח.
 */

/** מזהה יוטיוב מתוך כתובת מלאה, או מזהה שכבר נקי */
function youtubeId(source: string) {
  const match = source.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]{11}$/.test(source) ? source : "";
}

export default function VideoBlock({
  source,
  poster,
  title,
}: {
  /** כתובת יוטיוב, מזהה יוטיוב, או נתיב לקובץ mp4 */
  source: string;
  poster: string;
  title: string;
}) {
  const [playing, setPlaying] = useState(false);
  if (!source) return null;

  const youtube = youtubeId(source);

  return (
    <section className="videoSection">
      <div className="shell">
        <h2>סרטון הרכב</h2>

        <div className="videoFrame">
          {!playing ? (
            <button
              type="button"
              className="videoPoster"
              onClick={() => setPlaying(true)}
              aria-label={`הפעלת הסרטון: ${title}`}
            >
              <Picture src={poster} alt="" sizes={GALLERY_SIZES} />
              <span className="videoPlay" aria-hidden="true"><PlayIcon /></span>
            </button>
          ) : youtube ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1&rel=0`}
              title={title}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <video src={source} poster={poster} controls autoPlay playsInline preload="none" />
          )}
        </div>

        <p className="videoNote">הסרטון נטען רק בלחיצה, כדי שהדף יישאר מהיר בסלולר.</p>
      </div>
    </section>
  );
}
