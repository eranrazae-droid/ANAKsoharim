"use client";

import { useState } from "react";
import { VIDEO } from "./site-config";

/**
 * סרטון שנטען רק בלחיצה.
 *
 * עד הלחיצה מוצגת תמונת שער בלבד — אין iframe, אין קובץ וידאו,
 * ואין אף בקשת רשת לנגן. כך הסרטון לא משפיע על מהירות הטעינה
 * של האתר ולא נספר במדדי המהירות של גוגל.
 * תומך גם ביוטיוב וגם בקובץ שהועלה לאתר.
 */
export default function VideoBlock({ preview = false }: { preview?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const ready = Boolean(VIDEO.youtubeId || VIDEO.file);
  if (!ready && !preview) return null;

  const poster = VIDEO.poster || "/assets/showroom-sm.jpg";

  return (
    <section className="videoSection section">
      <div className="shell">
        <header className="videoHead">
          <span className="eyebrow">קצת מאיתנו</span>
          <h2>{VIDEO.title}</h2>
        </header>

        <div className="videoFrame">
          {!playing && (
            <button
              type="button"
              className="videoPoster"
              onClick={() => ready && setPlaying(true)}
              aria-label={ready ? `הפעלת הסרטון: ${VIDEO.title}` : "הסרטון יתווסף כאן"}
              disabled={!ready}
            >
              <img src={poster} alt="" loading="lazy" decoding="async" />
              <span className="videoPlay" aria-hidden="true">▶</span>
              {!ready && <span className="videoSoon">כאן ייכנס הסרטון</span>}
            </button>
          )}

          {playing && VIDEO.youtubeId && (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${VIDEO.youtubeId}?autoplay=1&rel=0`}
              title={VIDEO.title}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          )}

          {playing && !VIDEO.youtubeId && VIDEO.file && (
            <video src={VIDEO.file} poster={poster} controls autoPlay playsInline preload="none" />
          )}
        </div>

        <p className="videoNote">
          הסרטון נטען רק בלחיצה, כדי שהאתר יישאר מהיר.
        </p>
      </div>
    </section>
  );
}
