"use client";

import { useMemo, useState } from "react";
import { propulsionTechnology, type DisplayCar } from "../vehicle-types";
import { DEMO_IMAGE } from "../site-config";
import { Picture } from "../site-image";

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
          <label className="compareSlot" key={slot}>
            <span>רכב {slot + 1}</span>
            <select value={picked[slot]} onChange={(event) => pick(slot, event.target.value)}>
              <option value="">בחרו רכב</option>
              {grouped.map(([make, list]) => (
                <optgroup label={make} key={make}>
                  {list.map((car) => (
                    <option value={car.id} key={car.id}>
                      {car.baseModel || car.model} {car.subModel} {car.year}
                      {car.price ? ` · ${car.price.toLocaleString("he-IL")} ש״ח` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ))}
      </div>

      {active.length < 2 ? (
        <p className="compareEmpty">בחרו לפחות שני רכבים כדי לראות אותם זה מול זה.</p>
      ) : (
        <div className="compareTableWrap">
          <table className="compareTable" style={{ ["--cols" as string]: active.length }}>
            <thead>
              <tr>
                <th />
                {active.map((car) => (
                  <th key={car.id}>
                    <Picture src={car.image || DEMO_IMAGE} alt="" sizes="120px" />
                    <b>{car.make} {car.baseModel || car.model}</b>
                    <small>{car.subModel || " "}</small>
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
        <p className="compareNote">
          הערך המסומן בזהב הוא המשתלם יותר באותה שורה. השוואה אינה תחליף
          לבדיקת הרכב — נשמח להראות לכם את שניהם במגרש.
        </p>
      )}
    </div>
  );
}
