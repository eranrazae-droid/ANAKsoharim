"use client";

import { useEffect, useState } from "react";

type Alert = {
  id: string; make: string; model: string; category: string;
  maxPrice: number; maxMonthly: number; fromYear: number;
};
type Account = { username: string; phone: string; alerts: Alert[] };

type Options = { makes: string[]; models: string[]; categories: string[] };

const shekel = (value: number) => `${value.toLocaleString("he-IL")} ש״ח`;

/**
 * אזור אישי.
 * הכניסה היא בטלפון ובקוד חד־פעמי — בלי סיסמאות. בפנים אפשר להגדיר
 * התראות על רכבים, ולקבל הודעה כשנכנס למלאי רכב שמתאים.
 * הגלישה באתר פתוחה גם בלי חשבון.
 */
export default function AccountClient({ options }: { options: Options }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  const [step, setStep] = useState<"phone" | "code" | "username">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  const [draft, setDraft] = useState({
    make: "הכל", model: "הכל", category: "כל הרכבים",
    maxPrice: "", maxMonthly: "", fromYear: "",
  });

  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data) => setAccount(data.account))
      .catch(() => setAccount(null))
      .finally(() => setReady(true));
  }, []);

  async function send(url: string, options?: RequestInit) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "משהו השתבש");
      return data;
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "משהו השתבש");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function requestCode() {
    const data = await send("/api/auth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!data) return;
    setStep("code");
    setHint(data.code ? `מצב בדיקה — הקוד הוא ${data.code}` : "שלחנו קוד בהודעה");
  }

  async function verify(withUsername = "") {
    const data = await send("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code, username: withUsername }),
    });
    if (!data) return;
    if (data.needsUsername) {
      setStep("username");
      setHint("");
      return;
    }
    setAccount(data.account);
    setHint("");
  }

  async function addAlert(event: React.FormEvent) {
    event.preventDefault();
    const data = await send("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!data || !account) return;
    setAccount({ ...account, alerts: data.alerts });
    setDraft({ make: "הכל", model: "הכל", category: "כל הרכבים", maxPrice: "", maxMonthly: "", fromYear: "" });
  }

  async function removeAlert(id: string) {
    const data = await send(`/api/alerts?id=${id}`, { method: "DELETE" });
    if (!data || !account) return;
    setAccount({ ...account, alerts: data.alerts });
  }

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setAccount(null);
    setStep("phone");
    setPhone(""); setCode(""); setUsername("");
  }

  if (!ready) return <p className="accountLoading">רגע…</p>;

  /* ── מחובר ── */
  if (account) {
    return (
      <div className="accountBox">
        <div className="accountHead">
          <div>
            <b>{account.username}</b>
            <small>{account.phone}</small>
          </div>
          <button type="button" className="accountOut" onClick={signOut}>יציאה</button>
        </div>

        <h2>ההתראות שלי</h2>
        {account.alerts.length === 0 && (
          <p className="accountEmpty">עדיין לא הגדרתם התראה. ספרו לנו איזה רכב אתם מחפשים.</p>
        )}

        {account.alerts.length > 0 && (
          <ul className="alertList">
            {account.alerts.map((alert) => (
              <li key={alert.id}>
                <div>
                  <b>{alert.make === "הכל" ? "כל היצרנים" : alert.make}
                    {alert.model !== "הכל" ? ` ${alert.model}` : ""}</b>
                  <small>
                    {[
                      alert.category !== "כל הרכבים" ? alert.category : "",
                      alert.fromYear ? `משנת ${alert.fromYear}` : "",
                      alert.maxPrice ? `עד ${shekel(alert.maxPrice)}` : "",
                      alert.maxMonthly ? `החזר עד ${shekel(alert.maxMonthly)}` : "",
                    ].filter(Boolean).join(" · ") || "כל הרכבים במלאי"}
                  </small>
                </div>
                <button type="button" onClick={() => removeAlert(alert.id)} aria-label="מחיקת התראה">✕</button>
              </li>
            ))}
          </ul>
        )}

        <form className="alertForm" onSubmit={addAlert}>
          <h3>הוספת התראה</h3>

          <label className="accountField">
            <span>יצרן</span>
            <select value={draft.make} onChange={(e) => setDraft({ ...draft, make: e.target.value, model: "הכל" })}>
              <option value="הכל">כל היצרנים</option>
              {options.makes.map((make) => <option key={make} value={make}>{make}</option>)}
            </select>
          </label>

          <label className="accountField">
            <span>דגם</span>
            <select value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })}>
              <option value="הכל">כל הדגמים</option>
              {options.models.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>

          <label className="accountField">
            <span>קטגוריה</span>
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              <option value="כל הרכבים">כל הקטגוריות</option>
              {options.categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>

          <label className="accountField">
            <span>משנת</span>
            <input inputMode="numeric" placeholder="לא משנה" value={draft.fromYear}
              onChange={(e) => setDraft({ ...draft, fromYear: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
          </label>

          <label className="accountField">
            <span>מחיר עד</span>
            <input inputMode="numeric" placeholder="לא משנה" value={draft.maxPrice}
              onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value.replace(/\D/g, "").slice(0, 7) })} />
            <b>ש״ח</b>
          </label>

          <label className="accountField">
            <span>החזר עד</span>
            <input inputMode="numeric" placeholder="לא משנה" value={draft.maxMonthly}
              onChange={(e) => setDraft({ ...draft, maxMonthly: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
            <b>ש״ח</b>
          </label>

          {error && <p className="accountError">{error}</p>}
          <button className="accountSubmit" disabled={busy}>{busy ? "שומר…" : "שמירת התראה"}</button>
        </form>

        <p className="accountNote">
          נודיע לכם בהודעה כשייכנס למלאי רכב שמתאים לחיפוש. אפשר למחוק התראה בכל רגע.
        </p>
      </div>
    );
  }

  /* ── כניסה ── */
  return (
    <div className="accountBox">
      {step === "phone" && (
        <form className="accountForm" onSubmit={(e) => { e.preventDefault(); requestCode(); }}>
          <h2>כניסה לאזור האישי</h2>
          <p>מזינים טלפון, מקבלים קוד בהודעה. בלי סיסמאות.</p>
          <label className="accountField">
            <span>טלפון</span>
            <input required inputMode="tel" placeholder="050-0000000" value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
          </label>
          {error && <p className="accountError">{error}</p>}
          <button className="accountSubmit" disabled={busy}>{busy ? "שולח…" : "שלחו לי קוד"}</button>
        </form>
      )}

      {step === "code" && (
        <form className="accountForm" onSubmit={(e) => { e.preventDefault(); verify(); }}>
          <h2>הקוד שקיבלתם</h2>
          <p>שלחנו קוד בן שש ספרות ל-{phone}</p>
          <label className="accountField">
            <span>קוד</span>
            <input required inputMode="numeric" placeholder="123456" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          </label>
          {hint && <p className="accountHint">{hint}</p>}
          {error && <p className="accountError">{error}</p>}
          <button className="accountSubmit" disabled={busy}>{busy ? "בודק…" : "כניסה"}</button>
          <button type="button" className="accountBack" onClick={() => { setStep("phone"); setCode(""); setError(""); }}>
            החלפת מספר
          </button>
        </form>
      )}

      {step === "username" && (
        <form className="accountForm" onSubmit={(e) => { e.preventDefault(); verify(username); }}>
          <h2>איך לקרוא לכם?</h2>
          <p>השם הזה יופיע באזור האישי ובהודעות שנשלח לכם.</p>
          <label className="accountField">
            <span>שם משתמש</span>
            <input required placeholder="השם שלכם" value={username}
              onChange={(e) => setUsername(e.target.value.slice(0, 30))} />
          </label>
          {error && <p className="accountError">{error}</p>}
          <button className="accountSubmit" disabled={busy}>{busy ? "שומר…" : "סיום"}</button>
        </form>
      )}
    </div>
  );
}
