"use client";

import { useEffect, useMemo, useState } from "react";
import { isNewInStock, propulsionTechnology, type DisplayCar } from "./vehicle-types";
import { BUSINESS, IS_LIVE } from "./site-config";
import VehicleCard from "./vehicle-card";
import CustomerStrip from "./customer-strip";
import FloatingActions from "./floating-actions";
import SocialLinks from "./social-links";
import { Logo, Picture } from "./site-image";
import { CarIcon, CheckIcon, GridIcon, MenuIcon, PhoneIcon, PinIcon, PlusMinusIcon, SortIcon, StarIcon, TableIcon } from "./icons";
import SimilarCars, { referencePrice } from "./similar-cars";
import TableCarPanel from "./table-car-panel";
import { Honeypot, LeadStatusMessage, useLead } from "./use-lead";

type TradeVehicle = { plate: string; manufacturer: string; model: string; year: string; color: string; ownership: string; modelType: string; firstOnRoad: string; testValidity: string };
type TableSortKey = "make" | "model" | "subModel" | "year" | "mileage" | "engineCapacity" | "engine" | "propulsion" | "openRoof" | "price" | "advance" | "monthly" | "newest";

const categoryOptions = [
  { value: "כל הרכבים", label: "כל הרכבים" },
  { value: "פנאי/שטח 7 מקומות", label: "פנאי שטח 7 מקומות" },
  { value: "פנאי/שטח", label: "פנאי שטח" },
  { value: "מנהלים", label: "מנהלים" },
  { value: "ספורטיביים", label: "ספורטיביות" },
  { value: "משפחתיים", label: "משפחתיות" },
  { value: "קומפקטיים", label: "קומפקטיות" },
  { value: "מסחריות", label: "מסחריות" },
];

/**
 * השוואת מחיר או החזר חודשי.
 * רכב בלי מחיר ("לפרטים חייגו") יורד תמיד לסוף הרשימה, בשני הכיוונים,
 * כדי שהמיון "מהזול ליקר" יתחיל באמת ברכב הזול ביותר.
 */
function byValue(a: number, b: number, direction: 1 | -1) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return (a - b) * direction;
}

export default function HomeClient({ initialCars }: { initialCars: DisplayCar[] }) {
  // המלאי מגיע מהשרת ומרונדר ל-HTML — כך גוגל רואה את כל הרכבים.
  const cars = initialCars;
  const inventoryMaxPrice = useMemo(() => Math.max(0, ...cars.map((car) => Number(car.price || 0))), [cars]);
  const inventoryMaxMonthly = useMemo(() => Math.max(0, ...cars.map((car) => Number(car.monthly || 0))), [cars]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [category, setCategory] = useState("כל הרכבים");
  const [make, setMake] = useState("הכל");
  const [model, setModel] = useState("הכל");
  const [sortBy, setSortBy] = useState("alphabetical");
  const [driveTech, setDriveTech] = useState("הכל");
  const [propulsionTech, setPropulsionTech] = useState("הכל");
  const [roofFilter, setRoofFilter] = useState("הכל");
  const [fromYear, setFromYear] = useState("הכל");
  const [toYear, setToYear] = useState("הכל");
  const [engineType, setEngineType] = useState("הכל");
  const [gearbox, setGearbox] = useState("הכל");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(inventoryMaxPrice || 650000);
  const [minMonthly, setMinMonthly] = useState(0);
  const [maxMonthly, setMaxMonthly] = useState(inventoryMaxMonthly || 8000);
  const [tableView, setTableView] = useState(true);
  const [expandedCarId, setExpandedCarId] = useState<string | null>(null);
  const [tableSortKey, setTableSortKey] = useState<TableSortKey>("make");
  const [tableSortDirection, setTableSortDirection] = useState<"asc" | "desc">("asc");
  const [tradePlate, setTradePlate] = useState("");
  const [tradeVehicle, setTradeVehicle] = useState<TradeVehicle | null>(null);
  const [tradeLookup, setTradeLookup] = useState<"idle" | "loading" | "error">("idle");
  const [tradeError, setTradeError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // טבלה של חמש עשרה עמודות אינה קריאה בטלפון. במסך צר יש רק תצוגת כרטיסים,
  // וכפתורי המעבר מוסתרים. גם שינוי רוחב החלון מחזיר לכרטיסים.
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 900px)");
    const apply = () => { if (narrow.matches) setTableView(false); };
    apply();
    narrow.addEventListener("change", apply);
    return () => narrow.removeEventListener("change", apply);
  }, []);
  // כל הרכבים נשארים ב-HTML בשביל גוגל. בטלפון הרשימה מקופלת עד לחיצה.
  const [revealAll, setRevealAll] = useState(false);
  // מדרגות מחיר לבחירה מהירה, נגזרות מהמלאי בפועל
  const priceSteps = useMemo(() => {
    const top = Math.ceil(inventoryMaxPrice / 10000) * 10000;
    const step = top > 300000 ? 25000 : 10000;
    const list: number[] = [];
    for (let value = step; value <= top; value += step) list.push(value);
    return list;
  }, [inventoryMaxPrice]);
  const matchRef = useMemo(() => ({
    category,
    make,
    price: referencePrice(cars, minPrice, maxPrice, inventoryMaxPrice),
  }), [category, make, cars, minPrice, maxPrice, inventoryMaxPrice]);
  const heroLead = useLead("hero");
  const tradeLead = useLead("trade");
  const sellLead = useLead("sell");
  const availableModels = useMemo(() => Array.from(new Set(cars
    .filter((car) => make === "הכל" || car.make === make)
    .map((car) => car.baseModel || car.model)
    .filter(Boolean))).sort((a, b) => a.localeCompare(b, "he")), [cars, make]);
  const availableDriveTech = useMemo(() => Array.from(new Set(cars.map((car) => car.drivetrain).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "he")), [cars]);
  const availableEngines = useMemo(() => Array.from(new Set(cars.map((car) => car.engine).filter(Boolean))).sort((a, b) => a.localeCompare(b, "he")), [cars]);
  const availableGears = useMemo(() => Array.from(new Set(cars.map((car) => car.gear).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "he")), [cars]);
  const availableYears = useMemo(() => Array.from(new Set(cars.map((car) => car.year).filter(Boolean))).sort((a, b) => a - b), [cars]);
  const shownCars = useMemo(() => cars
    .filter((car) => (category === "כל הרכבים" || (car.categories?.length ? car.categories : [car.category]).includes(category)) && (make === "הכל" || car.make === make) && (model === "הכל" || (car.baseModel || car.model) === model) && (driveTech === "הכל" || car.drivetrain === driveTech) && (propulsionTech === "הכל" || propulsionTechnology(car.engine) === propulsionTech) && (roofFilter === "הכל" || (roofFilter === "כן" ? car.openRoof : !car.openRoof)) && (fromYear === "הכל" || car.year >= Number(fromYear)) && (toYear === "הכל" || car.year <= Number(toYear)) && (engineType === "הכל" || car.engine === engineType) && (gearbox === "הכל" || car.gear === gearbox) && car.price >= minPrice && car.price <= maxPrice && car.monthly >= minMonthly && car.monthly <= maxMonthly)
    .sort((a, b) => {
      if (sortBy === "price-asc") return byValue(a.price, b.price, 1);
      if (sortBy === "price-desc") return byValue(a.price, b.price, -1);
      if (sortBy === "monthly-asc") return byValue(a.monthly, b.monthly, 1);
      /* החדשים ביותר: מי שפחות ימים במגרש קודם. רכב בלי נתון
         יורד לסוף, כדי שלא ייראה כאילו נכנס היום. */
      if (sortBy === "newest") {
        const days = (car: DisplayCar) => { const d = car.daysInStock ?? -1; return d < 0 ? Infinity : d; };
        return days(a) - days(b) || b.year - a.year;
      }
      return a.make.localeCompare(b.make, "he") || a.model.localeCompare(b.model, "he") || b.year - a.year;
    }), [cars, category, make, model, driveTech, propulsionTech, roofFilter, fromYear, toYear, engineType, gearbox, sortBy, minPrice, maxPrice, minMonthly, maxMonthly]);
  /* הערך שלפיו ממיינים עמודה. רוב העמודות הן שדה ישיר ברכב;
     שלוש מהן מחושבות, ולכן הן מטופלות כאן בנפרד. */
  function sortValue(car: DisplayCar, key: TableSortKey) {
    if (key === "model") return car.baseModel || car.model;
    if (key === "openRoof") return Number(Boolean(car.openRoof));
    if (key === "propulsion") return propulsionTechnology(car.engine);
    /* רכב בלי נתון ימים במלאי יורד לסוף, כדי שלא ייראה כאילו
       נכנס היום. */
    if (key === "newest") { const d = car.daysInStock ?? -1; return d < 0 ? Number.MAX_SAFE_INTEGER : d; }
    return car[key] ?? "";
  }
  const tableCars = useMemo(() => [...shownCars].sort((a, b) => {
    const direction = tableSortDirection === "asc" ? 1 : -1;
    if (tableSortKey === "make") {
      const hierarchy = a.make.localeCompare(b.make, "he", { numeric: true })
        || (a.baseModel || a.model).localeCompare(b.baseModel || b.model, "he", { numeric: true })
        || String(a.subModel || "").localeCompare(String(b.subModel || ""), "he", { numeric: true })
        || a.year - b.year;
      return direction * hierarchy;
    }
    const numericKeys: TableSortKey[] = ["year", "engineCapacity", "mileage", "advance", "monthly", "price", "newest"];
    const aValue = sortValue(a, tableSortKey);
    const bValue = sortValue(b, tableSortKey);
    const comparison = numericKeys.includes(tableSortKey)
      ? Number(aValue || 0) - Number(bValue || 0)
      : String(aValue).localeCompare(String(bValue), "he", { numeric: true });
    return direction * comparison;
  }), [shownCars, tableSortKey, tableSortDirection]);
  /* תיבת המיון שמעל הרשימה משפיעה גם על הטבלה. עד עכשיו
     הטבלה מיינה תמיד לפי היצרן, ובחירה בתיבה לא עשתה בה כלום.
     לחיצה על כותרת עמודה עדיין גוברת. */
  useEffect(() => {
    const map: Record<string, [TableSortKey, "asc" | "desc"]> = {
      "price-asc": ["price", "asc"],
      "price-desc": ["price", "desc"],
      "monthly-asc": ["monthly", "asc"],
      "newest": ["newest", "asc"],
      "alphabetical": ["make", "asc"],
    };
    const next = map[sortBy];
    if (next) { setTableSortKey(next[0]); setTableSortDirection(next[1]); }
  }, [sortBy]);

  /* לחיצה על כל מקום בשורה פותחת וסוגרת את כרטיס הרכב, בדיוק
     כמו הפלוס שליד המספר. קודם היא הובילה לעמוד הרכב, והגולש
     היה מאבד את מקומו ברשימה. */
  function toggleRow(id: string) {
    setExpandedCarId(expandedCarId === id ? null : id);
  }
  function changeTableSort(key: TableSortKey) {
    if (tableSortKey === key) setTableSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else { setTableSortKey(key); setTableSortDirection("asc"); }
  }
  function sortableHeader(label: string, key: TableSortKey) {
    const active = tableSortKey === key;
    return <button type="button" className={active ? "tableSortButton active" : "tableSortButton"} onClick={() => changeTableSort(key)}>{label}<span><SortIcon up={!(active && tableSortDirection === "desc")} /></span></button>;
  }
  function resetAllCalculators() {
    setCategory("כל הרכבים"); setMake("הכל"); setModel("הכל"); setSortBy("alphabetical");
    setDriveTech("הכל"); setPropulsionTech("הכל"); setRoofFilter("הכל"); setFromYear("הכל"); setToYear("הכל"); setEngineType("הכל"); setGearbox("הכל");
    setMinPrice(0); setMaxPrice(inventoryMaxPrice); setMinMonthly(0); setMaxMonthly(inventoryMaxMonthly); setTableSortKey("make"); setTableSortDirection("asc"); setRevealAll(false);
    setTradePlate(""); setTradeVehicle(null); setTradeLookup("idle"); setTradeError(""); setMobileOpen(false);
  }
  async function lookupTradeVehicle() {
    const plate = tradePlate.replace(/\D/g, "");
    if (plate.length < 7) { setTradeError("יש להזין מספר רכב תקין"); setTradeLookup("error"); return; }
    setTradeLookup("loading"); setTradeError(""); setTradeVehicle(null);
    try { const response = await fetch(`/api/vehicle-lookup?plate=${plate}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || "הרכב לא נמצא"); setTradeVehicle(data); setTradeLookup("idle"); }
    catch (error) { setTradeError(error instanceof Error ? error.message : "הרכב לא נמצא"); setTradeLookup("error"); }
  }

  return (
    <main dir="rtl">
      <header className="topbar"><div className="shell headerInner">
        <a className="logo" href="#top" onClick={resetAllCalculators} aria-label="ענק הרכבים - דף הבית"><Logo eager /></a>
        <SocialLinks /><div className="headerActions"><a className="location" href="https://waze.com/ul?ll=31.9888,34.77084&navigate=yes" target="_blank" rel="noreferrer"><PinIcon /> <span>דוד רזיאל 4, ראשון לציון</span></a><a className="phone" href={`tel:${BUSINESS.dial}`}><small>חייגו עכשיו</small><strong>*2369</strong><span><PhoneIcon size={18} /></span></a></div>
        <nav className={`nav ${mobileOpen ? "open" : ""}`}><div className="navLinks" onClick={() => setMobileOpen(false)}><a href="#top" onClick={resetAllCalculators}>דף הבית</a><a href="#inventory">מלאי עדכני</a><a href="/finance">מחשבון מימון</a><a href="/trade">טרייד אין</a><a href="/sell">קונים את הרכב שלך</a><a href="/reviews">לקוחות ממליצים</a><a href="/articles">מדריכים</a><a href="/contact">צור קשר</a><a href="/compare">השוואת רכבים</a><a href="/account">האזור האישי</a></div></nav><button className="menuButton" onClick={() => setMobileOpen(!mobileOpen)} aria-label="פתיחת תפריט"><MenuIcon size={22} /></button>
      </div></header>
      

      {/* שתי תמונות שונות: במסך צר תצלום אחר, לא חיתוך של תמונת המחשב */}
      <section id="top" className="hero heroFinder"><picture>
          {/* הסדר קובע: הדפדפן לוקח את המקור הראשון שהוא מבין ושתואם
              למסך. WebP לפני JPEG, ותצלום הנייד לפני זה של המחשב. */}
          <source
            type="image/webp"
            media="(max-width: 900px)"
            srcSet="/assets/showroom-mobile-sm.webp 800w, /assets/showroom-mobile.webp 1400w"
            sizes="100vw"
          />
          <source
            media="(max-width: 900px)"
            srcSet="/assets/showroom-mobile-sm.jpg 800w, /assets/showroom-mobile.jpg 1400w"
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet="/assets/showroom-sm.webp 1000w, /assets/showroom.webp 1599w"
            sizes="100vw"
          />
          <img
            src="/assets/showroom.jpg"
            srcSet="/assets/showroom-sm.jpg 1000w, /assets/showroom.jpg 1599w"
            sizes="100vw"
            alt="אולם התצוגה של ענק הרכבים"
            fetchPriority="high"
            decoding="async"
          />
        </picture><div className="heroShade" /><div className="shell finderContent">
        <div className="finderBox" aria-label="חיפוש רכב">
          <p className="finderBoxTitle">חיפוש רכב במלאי</p>
          <div className="finderFields">
            <label>קטגוריה<select value={category} onChange={(e) => setCategory(e.target.value)}>{categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label>יצרן<select value={make} onChange={(e) => { setMake(e.target.value); setModel("הכל"); }}><option value="הכל">כל היצרנים</option>{[...new Set(cars.map(c => c.make))].sort((a, b) => a.localeCompare(b, "he")).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>דגם<select value={model} onChange={(e) => setModel(e.target.value)}><option value="הכל">כל הדגמים</option>{availableModels.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>סוג מנוע<select value={engineType} onChange={(e) => setEngineType(e.target.value)}><option value="הכל">כל סוגי המנוע</option>{availableEngines.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>ממחיר<select value={String(minPrice)} onChange={(e) => setMinPrice(Math.min(Number(e.target.value), maxPrice))}><option value="0">ללא הגבלה</option>{priceSteps.map((item) => <option key={item} value={item}>{item.toLocaleString("he-IL")} ₪</option>)}</select></label>
            <label>עד מחיר<select value={String(maxPrice)} onChange={(e) => setMaxPrice(Math.max(Number(e.target.value), minPrice))}><option value={inventoryMaxPrice}>ללא הגבלה</option>{priceSteps.map((item) => <option key={item} value={item}>{item.toLocaleString("he-IL")} ₪</option>)}</select></label>
          </div>

          <button type="button" className="advancedToggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(!advancedOpen)}>
            <span>סינון מורחב</span>
            <i aria-hidden="true"><PlusMinusIcon open={advancedOpen} /></i>
          </button>

          {advancedOpen && (
            <div className="finderAdvanced">
              <div className="finderFields">
                <label>משנת ייצור<select value={fromYear} onChange={(e) => setFromYear(e.target.value)}><option value="הכל">כל השנים</option>{availableYears.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>עד שנת ייצור<select value={toYear} onChange={(e) => setToYear(e.target.value)}><option value="הכל">כל השנים</option>{availableYears.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>גג נפתח<select value={roofFilter} onChange={(e) => setRoofFilter(e.target.value)}><option value="הכל">הכול</option><option value="כן">כן</option><option value="לא">לא</option></select></label>
                <label>מערכת הנעה<select value={driveTech} onChange={(e) => setDriveTech(e.target.value)}><option value="הכל">הכול</option>{availableDriveTech.map((item) => <option key={item} value={item}>{item.replace(/x/gi, "×")}</option>)}</select></label>
                <label>תיבת הילוכים<select value={gearbox} onChange={(e) => setGearbox(e.target.value)}><option value="הכל">הכול</option>{availableGears.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>טכנולוגיית הנעה<select value={propulsionTech} onChange={(e) => setPropulsionTech(e.target.value)}><option value="הכל">הכול</option><option value="היברידי">היברידי</option><option value="חשמלי">חשמלי</option><option value="פלאג־אין">פלאג־אין</option><option value="הנעה רגילה">הנעה רגילה</option></select></label>
              </div>
              <div className="rangeFilter"><div><strong>החזר חודשי</strong><span>{minMonthly.toLocaleString("he-IL")} ₪ – {maxMonthly.toLocaleString("he-IL")} ₪</span></div><div className="dualRange"><input aria-label="החזר חודשי מינימום" type="range" min="0" max={inventoryMaxMonthly} step="1" value={minMonthly} onChange={(e) => setMinMonthly(Math.min(Number(e.target.value), maxMonthly - 1))} /><input aria-label="החזר חודשי מקסימום" type="range" min="0" max={inventoryMaxMonthly} step="1" value={maxMonthly} onChange={(e) => setMaxMonthly(Math.max(Number(e.target.value), minMonthly + 1))} /></div></div>
              <button type="button" className="clearFilters" onClick={resetAllCalculators}>ניקוי כל הסינונים</button>
            </div>
          )}

        </div>
      </div></section>

      <section id="inventory" className="inventory section"><div className="shell"><h1 className="inventoryTitle">כל סוגי הרכבים במקום אחד!</h1><div className="viewToggle" role="group" aria-label="בחירת תצוגת רכבים"><button type="button" className={tableView ? "active" : ""} aria-pressed={tableView} onClick={() => setTableView(true)}><TableIcon size={15} /> תצוגת טבלה</button><button type="button" className={!tableView ? "active" : ""} aria-pressed={!tableView} onClick={() => setTableView(false)}><GridIcon size={15} /> תצוגת גלריה</button></div><div className="inventoryControls"><div className="categoryTabs">{categoryOptions.map((item) => <button key={item.value} className={category === item.value ? "active" : ""} onClick={() => setCategory(item.value)}>{item.label}</button>)}</div><label className="inventorySortBlock"><span>מיון</span><select className="inventorySort" aria-label="מיון רכבים" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="price-asc">מחיר — מהזול ליקר</option><option value="price-desc">מחיר — מהיקר לזול</option><option value="monthly-asc">החזר חודשי — מהזול ליקר</option><option value="newest">החדשים במלאי</option><option value="alphabetical">לפי שם א׳–ב׳</option></select></label></div>
      <div className={`inventoryReveal${revealAll ? " open" : ""}`}>
      {tableView ? <div className="resultsTableWrap"><table className="resultsTable"><thead><tr><th>#</th><th>{sortableHeader("יצרן", "make")}</th><th>{sortableHeader("דגם", "model")}</th><th>{sortableHeader("תת דגם", "subModel")}</th><th>{sortableHeader("שנת ייצור", "year")}</th><th>{sortableHeader("ק״מ", "mileage")}</th><th>{sortableHeader("נפח מנוע", "engineCapacity")}</th><th>{sortableHeader("סוג מנוע", "engine")}</th><th>{sortableHeader("טכנולוגיית הנעה", "propulsion")}</th><th>{sortableHeader("גג נפתח", "openRoof")}</th><th>{sortableHeader("מחיר מבוקש", "price")}</th><th>{sortableHeader("מקדמה", "advance")}</th><th>{sortableHeader("תשלום חודשי", "monthly")}</th><th>תמונה</th></tr></thead><tbody>{tableCars.map((car, index) => [
        <tr key={`${car.id}-main`} aria-expanded={expandedCarId === car.id} onClick={() => toggleRow(car.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") toggleRow(car.id); }}>
          <td><button className="expandRowButton" type="button" aria-expanded={expandedCarId === car.id} onClick={(event) => { event.stopPropagation(); toggleRow(car.id); }}>{index + 1}<span><PlusMinusIcon open={expandedCarId === car.id} /></span></button></td>
          <td>{car.make}{isNewInStock(car) && <b className="rowNew">חדש</b>}</td><td>{car.baseModel || car.model}</td><td>{car.subModel || "—"}</td><td>{car.year}</td><td>{Number(car.mileage || 0).toLocaleString("he-IL")}</td><td>{car.engineCapacity || "—"}</td><td>{car.engine || "—"}</td><td>{propulsionTechnology(car.engine)}</td><td>{car.openRoof ? "כן" : "לא"}</td><td className="askingPriceCell">{car.price.toLocaleString("he-IL")} ₪</td><td>{car.advance ? `${car.advance.toLocaleString("he-IL")} ₪` : <b className="noAdvance">ללא מקדמה</b>}</td><td>{car.monthly.toLocaleString("he-IL")} ₪</td><td><span className="tableCarImage">{car.image ? <Picture src={car.image} alt={`${car.make} ${car.model}`} sizes="68px" /> : <><Logo /><em>תמונות יעלו בקרוב</em></>}</span></td>
        </tr>,
        expandedCarId === car.id && <tr className="expandedVehicleRow" key={`${car.id}-details`}><td colSpan={14}><TableCarPanel car={car} /></td></tr>
      ])}</tbody></table></div> : <div className="listGrid">{shownCars.map((car) => <VehicleCard car={car} key={car.id} />)}</div>}
      </div>
      {!revealAll && shownCars.length > 0 && (
        <button type="button" className="showMore" onClick={() => setRevealAll(true)}>
          הצגת כל הרכבים <span>{shownCars.length.toLocaleString("he-IL")} רכבים במלאי</span>
        </button>
      )}
      {shownCars.length === 0 && <p className="empty">לא נמצאו רכבים בסינון שבחרתם.</p>}</div></section>

      <SimilarCars cars={cars} profile={matchRef} />

      <section className="consultSection"><div className="shell">
        <form className="quickLead" onSubmit={heroLead.submit}><strong>לייעוץ מקצועי מלאו פרטים</strong><Honeypot /><input required name="name" placeholder="שם.." aria-label="שם" /><input required name="phone" inputMode="tel" placeholder="טלפון.." aria-label="טלפון" /><input name="notes" placeholder="הערות.." aria-label="הערות" /><button disabled={heroLead.status === "sending"}>{heroLead.status === "sending" ? "שולח..." : "שלח"}</button><LeadStatusMessage status={heroLead.status} error={heroLead.error} /></form>
      </div></section>

      <CustomerStrip />



      <section id="finance" className="benefits section"><div className="shell"><h2>רכב קונים רק <span>בענק הרכבים!</span></h2><p className="intro">אנחנו מלווים אתכם משלב בחירת הרכב ועד למסירה, בשקיפות מלאה ועם פתרונות שמתאימים בדיוק לכם.</p><div className="benefitGrid"><article><i><CheckIcon size={26} /></i><h3>בדיקות קפדניות</h3><p>בדיקה מקצועית ושקיפות מלאה על היסטוריית הרכב.</p></article><article><i><CarIcon /></i><h3>מגוון ענק</h3><p>עשרות רכבים מכל הסוגים ובכל רמות המחיר.</p></article><article><i><StarIcon /></i><h3>שירות ואמינות</h3><p>ייעוץ אישי וליווי מקצועי גם אחרי הקנייה.</p></article><article><i>₪</i><h3>עד 100% מימון</h3><p>אפשרויות מימון נוחות ללא מקדמה, בכפוף לאישור.</p></article></div></div></section>


      <footer id="contact"><div className="shell footerGrid"><div><Logo /><p>מכירה, קנייה וטרייד אין לרכבים מאז 1998.</p></div><div><h3>צרו קשר</h3><p>רחוב דוד רזיאל 4, ראשון לציון</p><a href={`tel:${BUSINESS.dial}`}><bdi dir="ltr">*2369</bdi></a><p>א׳-ה׳ 08:30-18:00 | ו׳ 08:30-13:00</p></div><div><h3>קישורים</h3><a href="#inventory">רכבים במלאי</a><a href="/sell">קונים את הרכב שלך</a><a href="/finance">מימון</a><a href="/trade">טרייד אין</a><a href="/reviews">לקוחות ממליצים</a><a href="/articles">מדריכים</a><a href="/contact">צור קשר</a></div></div><div className="copyright">© {new Date().getFullYear()} ענק הרכבים. כל הזכויות שמורות.</div></footer>
      <FloatingActions />
    </main>
  );
}
