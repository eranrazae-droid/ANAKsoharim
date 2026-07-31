"use client";

import { FormEvent, useState } from "react";

export type LeadStatus = "idle" | "sending" | "sent" | "error";

/**
 * שליחת ליד מכל טופס באתר.
 *
 * הטופס נשלח ל-/api/leads יחד עם שם הטופס והעמוד שממנו הגיע,
 * כדי שאפשר יהיה לדעת מאיפה הגיעה כל פנייה.
 */
export function useLead(form: string) {
  const [status, setStatus] = useState<LeadStatus>("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>, extra?: Record<string, string>) {
    event.preventDefault();
    if (status === "sending") return; // הגנה מפני לחיצה כפולה

    const formElement = event.currentTarget;
    const fields = Object.fromEntries(new FormData(formElement).entries());

    setStatus("sending");
    setError("");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, ...extra, form, page: window.location.pathname }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "לא הצלחנו לשלוח את הפנייה.");

      setStatus("sent");
      formElement.reset();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "לא הצלחנו לשלוח את הפנייה.");
      setStatus("error");
    }
  }

  return { status, error, submit };
}

/** שדה מלכודת לבוטים. מוסתר מהמשתמש ומדולג בניווט מקלדת. */
export function Honeypot() {
  return (
    <input
      type="text"
      name="company"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
    />
  );
}

export function LeadStatusMessage({ status, error }: { status: LeadStatus; error: string }) {
  if (status === "sent") return <p className="success">תודה, הפרטים התקבלו. נציג יחזור אליכם בהקדם.</p>;
  if (status === "error") return <p className="tradeError">{error}</p>;
  return null;
}
