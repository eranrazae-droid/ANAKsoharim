import { BUSINESS } from "./site-config";

const WHATSAPP = `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent("שלום, אני מתעניין ברכב")}`;

/**
 * שלושת כפתורי הפעולה — חייגו, ווטסאפ והשארת פרטים.
 *
 * בטלפון סרגל קבוע בתחתית המסך. במחשב הם מוסתרים, כי שם יש
 * טלפון גדול בכותרת והסרגל המרחף כיסה את הטקסט.
 *
 * שלושתם קישורים רגילים: "השאר פרטים" מוביל לעמוד אמיתי ולא
 * לחלון קופץ, ולכן אין כאן קוד שרץ בדפדפן בכלל.
 */
export default function FloatingActions() {
  return (
    <div className="floatBar">
      <a className="floatCall" href={`tel:${BUSINESS.dial}`}>
        <span aria-hidden="true">☎</span> חייג עכשיו
      </a>
      <a className="floatWhats" href={WHATSAPP} target="_blank" rel="noreferrer">
        שלח ווטסאפ
      </a>
      <a className="floatLead" href="/lead">
        <span aria-hidden="true">✎</span> השאר פרטים
      </a>
    </div>
  );
}
