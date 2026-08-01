"use client";

import { useEffect, useRef, useState } from "react";
import { BUSINESS } from "./site-config";
import { Honeypot, LeadStatusMessage, useLead } from "./use-lead";

const WHATSAPP = `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent("שלום, אני מתעניין ברכב")}`;

/**
 * שלושת כפתורי הפעולה המרחפים — חייגו, וואטסאפ והשארת פרטים.
 * בטלפון הם סרגל קבוע בתחתית המסך, ובמחשב עמודה בפינה השמאלית.
 * מוצגים בכל עמודי האתר.
 */
export default function FloatingActions() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lead = useLead("floating");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <div className="floatBar">
        <a className="floatCall" href={`tel:${BUSINESS.phone}`}>
          <span aria-hidden="true">☎</span> חייג עכשיו
        </a>
        <a className="floatWhats" href={WHATSAPP} target="_blank" rel="noreferrer">
          <span aria-hidden="true">✆</span> שלח ווטסאפ
        </a>
        <button type="button" className="floatLead" onClick={() => setOpen(true)}>
          <span aria-hidden="true">✎</span> השאר פרטים
        </button>
      </div>

      <dialog className="floatDialog" ref={dialogRef} onClose={() => setOpen(false)}>
        <form className="floatForm" onSubmit={lead.submit}>
          <button type="button" className="floatClose" onClick={() => setOpen(false)} aria-label="סגירה">✕</button>
          <h2>השאירו פרטים</h2>
          <p>נחזור אליכם בהקדם עם כל הפרטים.</p>
          <Honeypot />
          <input required name="name" placeholder="שם מלא" aria-label="שם מלא" />
          <input required name="phone" inputMode="tel" placeholder="טלפון" aria-label="טלפון" />
          <textarea name="notes" placeholder="איזה רכב מעניין אתכם?" aria-label="הודעה" />
          <button type="submit" disabled={lead.status === "sending"}>
            {lead.status === "sending" ? "שולח..." : "שליחה"}
          </button>
          <LeadStatusMessage status={lead.status} error={lead.error} />
        </form>
      </dialog>
    </>
  );
}
