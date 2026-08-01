"use client";

import { useState } from "react";

/**
 * בטלפון רשימה של מאה וחמישים רכבים יוצרת עמוד באורך של עשרות מסכים.
 * כל הרכבים נשארים ב-HTML — חשוב לגוגל — אבל התצוגה מקופלת עד שהגולש
 * לוחץ. במסך רחב אין לזה שום השפעה: העטיפה שקופה והכפתור מוסתר.
 */
export default function MobileReveal({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`inventoryReveal${open ? " open" : ""}`}>{children}</div>
      {!open && (
        <button type="button" className="showMore" onClick={() => setOpen(true)}>
          הצגת כל הרכבים <span>{label}</span>
        </button>
      )}
    </>
  );
}
