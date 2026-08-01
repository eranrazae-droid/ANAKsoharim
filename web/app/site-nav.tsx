"use client";

import { useState } from "react";
import { CloseIcon, MenuIcon } from "./icons";

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

          {/* התפריט יושב בתוך שורת הכותרת: במחשב באמצע, בין
              הסמלים לטלפון. בטלפון הוא נפתח מתחתיה בכפתור. */}
          <nav className={`nav ${open ? "open" : ""}`}>
            <div className="navLinks" onClick={() => setOpen(false)}>
              {links}
            </div>
          </nav>

          <button
            className="menuButton"
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "סגירת התפריט" : "פתיחת התפריט"}
          >
            {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </header>
    </>
  );
}
