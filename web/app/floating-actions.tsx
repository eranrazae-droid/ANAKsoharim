import { BUSINESS } from "./site-config";
import { PencilIcon, PhoneIcon } from "./icons";

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
        <PhoneIcon size={17} /> חייג עכשיו
      </a>
      <a className="floatWhats" href={WHATSAPP} target="_blank" rel="noreferrer">
        שלח ווטסאפ
      </a>
      <a className="floatLead" href="/lead">
        <PencilIcon size={17} /> השאר פרטים
      </a>
    </div>
  );
}
