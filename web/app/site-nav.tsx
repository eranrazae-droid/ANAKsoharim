"use client";

import { useState } from "react";

/**
 * הכותרת וסרגל הניווט של העמודים הפנימיים.
 *
 * בטלפון הסרגל מוסתר ונפתח בכפתור התפריט. עד עכשיו הכפתור היה
 * קיים רק בדף הבית, ולכן בעמודים הפנימיים לא הייתה בטלפון שום
 * דרך להגיע לשאר האתר.
 *
 * הכפתור חייב לשבת בתוך הכותרת השחורה — מחוצה לה הוא לבן על
 * רקע לבן ולא נראה. לכן הרכיב עוטף את הכותרת כולה, אבל התוכן
 * עצמו מגיע מבחוץ ונשאר מרונדר בשרת: לדפדפן יורד רק המתג.
 */
export default function SiteNav({
  children,
  links,
}: {
  children: React.ReactNode;
  links: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="topbar">
        <div className="shell headerInner">
          {children}
          <button
            className="menuButton"
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "סגירת התפריט" : "פתיחת התפריט"}
          >
            <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </header>

      <nav className={`nav ${open ? "open" : ""}`}>
        <div className="shell navLinks" onClick={() => setOpen(false)}>
          {links}
        </div>
      </nav>
    </>
  );
}
