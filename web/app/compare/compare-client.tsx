"use client";

import { useMemo, useState } from "react";
import { propulsionTechnology, type DisplayCar } from "../vehicle-types";
import { BUSINESS, DEMO_IMAGE } from "../site-config";
import { Picture } from "../site-image";
import { CloseIcon, NextIcon, PencilIcon, PhoneIcon } from "../icons";

/**
 * השוואת רכבים.
 * בוחרים עד שלושה רכבים מהמלאי ורואים אותם זה מול זה.
 * בשורות שיש בהן "טוב יותר" מובהק — מחיר, החזר, שנתון, קילומטראז׳
 * וכוח סוס — הערך המוביל מסומן בזהב.
 */

const SLOTS = 3;

const km = (car: DisplayCar) => Number(String(car.mileage).replace(/,/g, "") || 0);
const shekel = (value: number) => `${value.toLocaleString("he-IL")} ש״ח`;

function engineSize(value?: string) {
  const cc = Number(String(value ?? "").replace(/\D/g, ""));
  return !cc || cc < 500 ? "" : `${(cc / 1000).toFixed(1)} ליטר`;
}

/** best: "low" — הנמוך מנצח, "high" — הגבוה מנצח */
type Row = {
  label: string;
  value: (car: DisplayCar) => string;
  compare?: (car: DisplayCar) => number;
  best?: "low" | "high";
  /** האם אפס הוא ערך אמיתי ולא "אין נתון" — למשל מקדמה */
  zeroCounts?: boolean;
};

const ROWS: Row[] = [
  { label: "מחיר", value: (car) => (car.price ? shekel(car.price) : "לפרטים חייגו"), compare: (car) => car.price, best: "low" },
  { label: "החזר חודשי", value: (car) => (car.monthly ? shekel(car.monthly) : "—"), compare: (car) => car.monthly, best: "low" },
  { label: "מקדמה", value: (car) => (car.advance ? shekel(car.advance) : "ללא מקדמה"), compare: (car) => car.advance ?? 0, best: "low", zeroCounts: true },
  { label: "שנת ייצור", value: (car) => String(car.year), compare: (car) => car.year, best: "high" },
  { label: "קילומטראז׳", value: (car) => `${km(car).toLocaleString("he-IL")} ק״מ`, compare: km, best: "low", zeroCounts: true },
  { label: "נפח מנוע", value: (car) => engineSize(car.engineCapacity) || "—" },
  { label: "סוג מנוע", value: (car) => car.engine || "—" },
  { label: "טכנולוגיית הנעה", value: (car) => { const t = propulsionTechnology(car.engine); return t === "הנעה רגילה" ? "—" : t; } },
  { label: "כוח סוס", value: (car) => (car.horsePower ? `${car.horsePower} כ״ס` : "—"), compare: (car) => Number(car.horsePower) || 0, best: "high" },
  { label: "תיבת הילוכים", value: (car) => car.gear || "—" },
  { label: "מערכת הנעה", value: (car) => car.drivetrain || "—" },
  { label: "צבע", value: (car) => car.color || "—" },
  { label: "מרכב", value: (car) => car.body || "—" },
  { label: "דלתות", value: (car) => car.doors || "—" },
  { label: "מקומות", value: (car) => car.seats || "—" },
  { label: "גג נפתח", value: (car) => (car.openRoof ? "כן" : "לא") },
  { label: "תוקף טסט", value: (car) => car.test || "—" },
];

const WHATSAPP = `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent("שלום, השוויתי בין שני רכבים באתר ואשמח לפרטים")}`;

export default function CompareClient({ cars }: { cars: DisplayCar[] }) {
  const [picked, setPicked] = useState<string[]>(["", "", ""]);

  // הרכבים מקובצים לפי יצרן, כדי שהבחירה בטלפון תהיה נוחה
  const grouped = useMemo(() => {
    const map = new Map<string, DisplayCar[]>();
    for (const car of cars) {
      const list = map.get(car.make) ?? [];
      list.push(car);
      map.set(car.make, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "he"));
  }, [cars]);

  const chosen = picked.map((id) => cars.find((car) => car.id === id) ?? null);
  const active = chosen.filter(Boolean) as DisplayCar[];

  function pick(slot: number, id: string) {
    setPicked(picked.map((current, index) => (index === slot ? id : current)));
  }

  /** מזהי הרכבים המובילים בשורה. שוויון — אף אחד לא מסומן */
  function winners(row: Row) {
    if (!row.compare || !row.best || active.length < 2) return new Set<string>();
    const values = active.map((car) => ({ id: car.id, value: row.compare!(car) })).filter((item) => row.zeroCounts || item.value > 0);
    if (values.length < 2) return new Set<string>();
    const target = row.best === "low"
      ? Math.min(...values.map((item) => item.value))
      : Math.max(...values.map((item) => item.value));
    const leaders = values.filter((item) => item.value === target);
    return leaders.length === values.length ? new Set<string>() : new Set(leaders.map((item) => item.id));
  }

  return (
    <div className="compare">
      <div className="compareSlots">
        {Array.from({ length: SLOTS }, (_, slot) => (
          <label className={`compareSlot ${picked[slot] ? "on" : ""}`} key={slot}>
            <span>רכב {slot + 1}</span>
            <select value={picked[slot]} onChange={(event) => pick(slot, event.target.value)}>
              <option value="">בחרו רכב</option>
              {grouped.map(([make, list]) => (
                <optgroup label={make} key={make}>
                  {list.map((car) => (
                    <option value={car.id} key={car.id}>
                      {car.baseModel || car.model} {car.subModel} {car.year}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ))}
      </div>

      {active.length < 2 ? (
        /* עד שנבחרים שני רכבים אין מה להשוות. במקום שורת טקסט
           בודדת מוסבר כאן מה עומד לקרות, ומי שעוד לא יודע מה
           הוא מחפש מקבל קישור למלאי. */
        <div className="compareEmpty">
          <h2>איך זה עובד</h2>
          <ol>
            <li><b>1</b> בוחרים רכב בתיבה הראשונה</li>
            <li><b>2</b> בוחרים רכב שני להשוואה</li>
            <li><b>3</b> רואים את כל המפרט זה מול זה, והמשתלם יותר מסומן בזהב</li>
          </ol>
          <a href="/cars">לעיון בכל המלאי <NextIcon size={15} /></a>
        </div>
      ) : (
        <div className="compareTableWrap" style={{ ["--cols" as string]: active.length }}>
          <table className="compareTable">
            <thead>
              <tr>
                <th />
                {active.map((car) => (
                  <th key={car.id}>
                    {/* כותרת העמודה מקשרת לעמוד הרכב עצמו */}
                    <a href={`/car/${car.id}`}>
                      <Picture src={car.image || DEMO_IMAGE} alt="" sizes="120px" />
                    <b>{car.make} {car.baseModel || car.model}</b>
                    <small>{car.subModel || " "}</small>
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const leaders = winners(row);
                return (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {active.map((car) => (
                      <td key={car.id} className={leaders.has(car.id) ? "compareBest" : ""}>
                        {row.value(car)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {active.length >= 2 && (
        <>
          <p className="compareNote">
            הערך המסומן בזהב הוא המשתלם יותר באותה שורה. השוואה אינה תחליף
            לבדיקת הרכב — נשמח להראות לכם את שניהם במגרש.
          </p>

          {/* מה עושים אחרי שראו את ההשוואה */}
          <aside className="compareNext">
            <h2>עדיין מתלבטים?</h2>
            <p>נציג יעבור איתכם על ההבדלים ויגיד לכם מה מתאים יותר למה שאתם מחפשים.</p>
            <div className="compareNextLinks">
              <a className="compareCall" href={`tel:${BUSINESS.dial}`}>
                <PhoneIcon size={16} /> <bdi dir="ltr">{BUSINESS.phone}</bdi>
              </a>
              <a className="compareWhats" href={WHATSAPP} target="_blank" rel="noreferrer">ווטסאפ</a>
              <a className="compareLead" href="/lead"><PencilIcon size={16} /> השארת פרטים</a>
            </div>
          </aside>

          <button type="button" className="compareClear" onClick={() => setPicked(["", "", ""])}>
            <CloseIcon size={14} /> ניקוי הבחירה
          </button>
        </>
      )}
    </div>
  );
}
