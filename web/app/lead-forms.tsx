"use client";

import { Honeypot, LeadStatusMessage, useLead } from "./use-lead";

/** טופס "צור קשר". נטען כרכיב לקוח בתוך עמוד שרת. */
export function ContactLeadForm() {
  const lead = useLead("contact");
  return (
    <form className="standaloneLead" onSubmit={lead.submit}>
      <h2>השאירו פרטים</h2>
      <Honeypot />
      <input required name="name" placeholder="שם מלא" aria-label="שם מלא" />
      <input required name="phone" inputMode="tel" placeholder="טלפון" aria-label="טלפון" />
      <textarea name="notes" placeholder="איך אפשר לעזור?" aria-label="הודעה" />
      <button disabled={lead.status === "sending"}>
        {lead.status === "sending" ? "שולח..." : "שליחה"}
      </button>
      <LeadStatusMessage status={lead.status} error={lead.error} />
    </form>
  );
}

/** טופס פנייה בעמוד רכב. שם הרכב מגיע מהשרת ונשלח יחד עם הפנייה. */
export function CarLeadForm({ vehicle }: { vehicle: string }) {
  const lead = useLead("car");
  return (
    <form className="modernLeadForm" onSubmit={lead.submit}>
      <Honeypot />
      <input name="name" required placeholder="שם מלא" aria-label="שם מלא" />
      <input name="phone" required inputMode="tel" placeholder="טלפון" aria-label="טלפון" />
      <input name="vehicle" defaultValue={vehicle} aria-label="רכב" />
      <button type="submit" disabled={lead.status === "sending"}>
        {lead.status === "sending" ? "שולח..." : "שלחו פרטים"}
      </button>
      <LeadStatusMessage status={lead.status} error={lead.error} />
    </form>
  );
}

/**
 * טופס העמוד "השארת פרטים".
 * שלושה שדות בלבד: שם, טלפון ואיזה רכב מעניין. ככל שיש פחות
 * שדות כך יותר לקוחות משלימים אותם.
 */
export function LeaveDetailsForm() {
  const lead = useLead("lead-page");
  return (
    <form className="leadPageForm" onSubmit={lead.submit}>
      <Honeypot />
      <label>
        שם מלא
        <input required name="name" placeholder="ישראל ישראלי" aria-label="שם מלא" />
      </label>
      <label>
        טלפון
        <input required name="phone" inputMode="tel" placeholder="050-0000000" aria-label="טלפון" />
      </label>
      <label>
        איזה רכב מעניין אתכם?
        <input name="vehicle" placeholder="יצרן, דגם או תקציב" aria-label="הרכב שמעניין אתכם" />
      </label>
      <button disabled={lead.status === "sending"}>
        {lead.status === "sending" ? "שולח..." : "שלחו פרטים"}
      </button>
      <LeadStatusMessage status={lead.status} error={lead.error} />
    </form>
  );
}
