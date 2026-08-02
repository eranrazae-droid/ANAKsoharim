import type { DisplayCar } from "./vehicle-types";

/**
 * קריאת מלאי מקובץ XML.
 *
 * הפיד של האתר הישן מגיש את הרכבים ואת התמונות באותו קובץ. אין לו
 * מבנה מוסכם — כל מערכת קוראת לשדות בשם אחר — ולכן הקריאה כאן
 * גמישה בכוונה: מזהים כל בלוק של רכב, אוספים את כל התגיות שבתוכו,
 * ומתאימים אותן לשדות שלנו לפי משמעות ולא לפי שם מדויק.
 *
 * שדה שאינו קיים בפיד נשאר ריק, והאתר פשוט לא מציג אותו. אין כאן
 * המצאה של נתונים — מחיר, החזר חודשי או מקדמה שלא הגיעו, לא מוצגים.
 */

/** תגיות שעוטפות רכב בודד. הפיד הקיים משתמש ב-CAR. */
const CAR_BLOCK = /<(car|vehicle|item|record|row|ad|auto)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

/** תגית שמכילה כתובת תמונה */
const IMAGE_TAG = /image|img|photo|pic|picture/;

/**
 * פענוח הקובץ לפי הקידוד שהוא מצהיר עליו בשורה הראשונה.
 * הפיד של האתר הקיים כתוב ב-windows-1255 ולא ב-UTF-8, ובלי פענוח
 * נכון כל האותיות בעברית הופכות לסימני שאלה.
 */
export function decodeXml(buffer: ArrayBuffer) {
  const head = new TextDecoder("latin1").decode(buffer.slice(0, 200));
  const label = head.match(/encoding=["']([\w-]+)["']/i)?.[1] || "utf-8";
  try {
    return new TextDecoder(label).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .trim();
}

/** שם תגית מנוקה: בלי קידומת מרחב שמות, בלי מקפים ובלי אותיות גדולות */
function key(tag: string) {
  return tag.toLowerCase().replace(/^[^:]*:/, "").replace(/[^a-z0-9֐-׿]/g, "");
}

/**
 * כל התגיות שבתוך בלוק אחד, כמפה של שם → ערך.
 * נאספות רק תגיות עלה — כאלה שאין בתוכן תגיות אחרות.
 */
function readFields(attributes: string, block: string) {
  const map = new Map<string, string>();
  const add = (tag: string, value: string) => {
    const name = key(tag);
    const text = decode(value);
    if (name && text && !map.has(name)) map.set(name, text);
  };

  // תגית עם CDATA נקראת ראשונה, כי הסוגר של הטקסט הרגיל לא תופס אותה
  for (const match of block.matchAll(/<([\w.:-]+)\b[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/\1>/g)) {
    add(match[1], match[2]);
  }
  for (const match of block.matchAll(/<([\w.:-]+)\b[^>]*>([^<]*)<\/\1>/g)) {
    add(match[1], match[2]);
  }
  // פידים מסוימים שמים את הנתונים כמאפיינים על תגית הרכב עצמה
  for (const match of attributes.matchAll(/\b([\w.:-]+)\s*=\s*"([^"]*)"/g)) {
    add(match[1], match[2]);
  }
  return map;
}

/** הערך הראשון שמתאים לאחד מהדפוסים, לפי סדר החשיבות שלהם */
function pick(map: Map<string, string>, patterns: RegExp[]) {
  for (const pattern of patterns) {
    for (const [name, value] of map) if (pattern.test(name)) return value;
  }
  return "";
}

function num(value: string) {
  return Number(String(value).replace(/[^\d.]/g, "")) || 0;
}

function isImage(value: string) {
  return /\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(value.trim());
}

/** כתובת יחסית בפיד הופכת לכתובת מלאה, לפי כתובת הקובץ עצמו */
function absolute(url: string, base: string) {
  const value = url.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  try {
    return new URL(value, base).href;
  } catch {
    return "";
  }
}

/** כל כתובות התמונות שבבלוק — גם כמאפיין וגם כטקסט */
function readImages(block: string, base: string) {
  const urls: string[] = [];
  const add = (value: string) => {
    const url = absolute(decode(value), base);
    if (url && !urls.includes(url)) urls.push(url);
  };

  // <CarImage Path="..."/>
  for (const match of block.matchAll(/<([\w.:-]+)\b([^>]*?)\/?>/g)) {
    if (!IMAGE_TAG.test(key(match[1]))) continue;
    for (const attribute of match[2].matchAll(/\b[\w.:-]+\s*=\s*"([^"]*)"/g)) {
      if (isImage(attribute[1])) add(attribute[1]);
    }
  }
  // <Image>https://.../1.jpg</Image>, וגם רשימה מופרדת בפסיקים
  for (const match of block.matchAll(/<([\w.:-]+)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    if (!IMAGE_TAG.test(key(match[1]))) continue;
    // כמה כתובות בתגית אחת, מופרדות בפסיק או ברווח — כל אחת בנפרד
    for (const part of decode(match[2]).split(/[,;|\s]+/)) if (isImage(part)) add(part);
  }

  // רשת ביטחון: אם שם התגית לא רומז על תמונה, כל כתובת תמונה
  // שנמצאת בתוך בלוק של רכב שייכת לאותו רכב ממילא.
  if (!urls.length) {
    for (const part of decode(block).split(/[,;|"'<>\s]+/)) if (isImage(part)) add(part);
  }
  return urls;
}

/** ערך שמשמעותו "כן" בפיד */
function yes(value: string) {
  return Boolean(value) && !/^(0|no|false|לא|אין)$/i.test(value.trim());
}

/**
 * שדה טקסט שערכו מספר בלבד הוא קוד פנימי של הפיד — צבע 32, סוג
 * מנוע 1 וכדומה. אין לנו את טבלת הקודים, ולכן עדיף לא להציג כלום
 * מאשר להציג מספר חסר משמעות ללקוח.
 */
function text(value: string) {
  return /^\d+$/.test(value.trim()) ? "" : value;
}

/** תוקף טסט מגיע כ-2027-05 ומוצג כ-05/2027 */
function testDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{1,2})$/);
  return match ? `${match[2].padStart(2, "0")}/${match[1]}` : value;
}

/**
 * שם הרכב מתוך שורת התיאור.
 *
 * בפיד של האתר הקיים אין שדות נפרדים ליצרן ולדגם — יש שורה אחת
 * כמו "ב מ וו X3 XDRIVE20I 2020". מזהים את היצרן לפי רשימת
 * היצרנים שבמלאי (הארוך ביותר קודם, כי "ב מ וו" הוא שלוש מילים),
 * המילה שאחריו היא הדגם וכל השאר תת הדגם.
 */
function splitName(description: string, makes: string[]) {
  const year = description.match(/\b(19|20)\d{2}\b\s*$/)?.[0] ?? "";
  const clean = description.replace(/\s*\b(19|20)\d{2}\b\s*$/, "").trim();
  if (!clean) return { make: "", baseModel: "", subModel: "", year: "" };
  const known = makes.find((name) => clean === name || clean.startsWith(`${name} `));
  const make = known || clean.split(/\s+/)[0];
  const [baseModel = "", ...rest] = clean.slice(make.length).trim().split(/\s+/);
  return { make, baseModel, subModel: rest.join(" "), year, known: Boolean(known) };
}

/**
 * מספר מתוך ערך שמכיל גם טקסט — "החל מ- 1334 ש״ח בחודש" -> 1334.
 * מחפש לפי משמעות הערך ולא לפי שם התגית, כי בפיד של גוגל שופינג
 * ההחזר החודשי יושב בשדה בשם customlabel0.
 */
function numByValue(fields: Map<string, string>, pattern: RegExp) {
  for (const value of fields.values()) {
    if (!pattern.test(value)) continue;
    const found = value.match(/\d[\d,]*/)?.[0];
    if (found) return Number(found.replace(/,/g, ""));
  }
  return 0;
}

/**
 * מה באמת יש בפיד — שמות התגיות של הרכב הראשון וכמה בלוקים נמצאו.
 * משמש את /api/inventory-source, כדי שאפשר יהיה לראות מה חסר בלי
 * לנחש. אינו משפיע על האתר עצמו.
 */
export function describeVehiclesXml(xml: string) {
  const blocks = Array.from(xml.matchAll(CAR_BLOCK));
  const first = blocks[0];
  return {
    blocks: blocks.length,
    tags: first ? Object.fromEntries(readFields(first[2], first[3])) : {},
    images: first ? readImages(first[3], "").length : 0,
  };
}

/**
 * הופך קובץ XML לרשימת רכבים.
 * base היא כתובת הקובץ, ומשמשת להשלמת כתובות תמונה יחסיות.
 */
export function parseVehiclesXml(xml: string, base = "", makes: string[] = []): DisplayCar[] {
  const cars: DisplayCar[] = [];
  const seen = new Set<string>();
  // הארוך ביותר קודם, כדי ש"ב מ וו" ינצח לפני "ב"
  const known = [...makes].sort((a, b) => b.length - a.length);

  for (const match of xml.matchAll(CAR_BLOCK)) {
    const block = match[3];
    const fields = readFields(match[2], block);

    const images = readImages(block, base);
    // מספר הרישוי הוא שם קובץ התמונה. בפידים מסוימים השדה שנראה
    // כמזהה מחזיק קוד פנימי קצר (110) ולא את מספר הרכב.
    const imagePlate = images[0]?.match(/\/(\d{5,})\.[a-z]+$/i)?.[1] ?? "";
    const tagPlate = pick(fields, [/^carnumber$/, /carnumber/, /^plate/, /licen/, /^adid$|^adnumber$|^itemid$/, /^id$/]);
    const plate = /^\d{5,}$/.test(tagPlate) ? tagPlate : imagePlate || tagPlate;
    const id = plate.replace(/\D/g, "") || plate || block.match(/carcode=(\d+)/i)?.[1] || "";
    if (!id || seen.has(id)) continue;

    // אין שדות נפרדים ליצרן ולדגם? נגזרים משורת השם. הכותרת קודמת
    // לתיאור, כי בפיד של גוגל שופינג התיאור הוא רשימת האבזור.
    const title = pick(fields, [/^title$/, /^cartitle$/]);
    const description = pick(fields, [/^description$/]);
    const named = splitName(title || description, known);
    // מדויק בכוונה: ManufactureYear הוא שנת ייצור, לא יצרן
    const tagMake = pick(fields, [/^manufacturer/, /^carmanufacturer/, /^make$/, /^brand/, /יצרן/]);
    // בפיד של גוגל שופינג השדה brand מחזיק את הקטגוריה ולא את היצרן.
    // לכן יצרן מזוהה מהכותרת מנצח שם שאינו ברשימת היצרנים שבמלאי.
    const fromTag = tagMake && (known.includes(tagMake) || !named.known);
    const make = fromTag ? tagMake : named.make;
    const baseModel =
      pick(fields, [/^model$/, /^modelname$/, /^carmodel$/, /^basemodel$/, /^דגם$/, /^name$/]) || named.baseModel;
    const subModel = pick(fields, [/submodel/, /^trim/, /^version/, /תתדגם/]) || named.subModel;
    const model = `${baseModel} ${subModel}`.trim();
    if (!make || !model) continue;

    // השדה שהחזיק את הקטגוריה במקום את היצרן הוא הקטגוריה עצמה
    const category =
      pick(fields, [/category/, /^segment/, /^cartype$/, /^type$/, /קטגוריה/]) ||
      (!fromTag && tagMake ? tagMake : "");

    seen.add(id);
    cars.push({
      id,
      plate,
      make,
      model,
      baseModel,
      subModel,
      image: images[0] ?? null,
      images,
      year:
        num(pick(fields, [/yearofmanufact/, /manufactureyear/, /^year/, /^shnat/, /^yr$/, /year/, /שנת|שנה/])) ||
        num(named.year),
      price: num(pick(fields, [/^askingprice/, /^price$/, /^sellprice/, /^currentprice/, /^carprice$/, /^cost$/, /^מחיר$/])),
      listPrice: num(pick(fields, [/pricelist/, /listprice/, /mehiron/, /מחירון/])),
      monthly:
        num(pick(fields, [/monthly/, /permonth/, /^payment/, /החזרחודשי|תשלוםחודשי/])) ||
        numByValue(fields, /בחודש/),
      advance: num(pick(fields, [/advance/, /downpayment/, /firstpayment/, /מקדמה/])),
      mileage: pick(fields, [/^kms?$/, /kilomet/, /mileage/, /^mile/, /^קמ$/]) || "0",
      hand: pick(fields, [/^hand$/, /^yad$/, /numberofowner/, /^owners?$/, /^יד$/]),
      // שדה שאין לו ערך נשאר ריק ופשוט לא מוצג — עדיף מ"לא צוין"
      ownership: text(pick(fields, [/ownership/, /baalut/, /בעלות/])),
      engine: text(pick(fields, [/enginetype/, /fueltype/, /^fuel/, /סוגמנוע/])),
      engineCapacity: pick(fields, [/enginecapacity/, /enginevolume/, /^cc$/, /נפחמנוע/, /^engine$/]),
      horsePower: pick(fields, [/horsepower/, /^hp$/, /כוחסוס/]),
      gear: text(pick(fields, [/^gear/, /transmission/, /^gir$/, /תיבתהילוכים/])),
      drivetrain: text(pick(fields, [/propulsion/, /drivetrain/, /^drive$/, /מערכתהנעה/])),
      color: text(pick(fields, [/^colou?r/, /צבע/])),
      doors: pick(fields, [/door/, /דלת/]).replace(/\D/g, ""),
      seats: pick(fields, [/seat/, /מושב/]).replace(/\D/g, ""),
      test: testDate(pick(fields, [/test/, /טסט/])),
      body: text(pick(fields, [/merkav/, /^body/, /carbody/, /מרכב/])),
      // רשימת האבזור. "הערות" בפיד הן טקסט שיווקי אחיד עם קוד
      // פנימי בסופו, ולכן אינן מוצגות ללקוח.
      // כשהשם הגיע מהכותרת, התיאור הוא רשימת האבזור
      extras: pick(fields, [/extra/, /accessor/, /option/, /^remark/, /תוספות/]) || (title ? description : ""),
      remarks: pick(fields, [/^comment/, /^note/, /הערות/]),
      openRoof: yes(pick(fields, [/sunroof/, /openroof/, /גגנפתח/])),
      category: category || "כל הרכבים",
      categories: category ? [category] : [],
      video: null,
      spin360: [],
    });
  }

  return cars;
}
