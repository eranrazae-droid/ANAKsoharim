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
export function parseVehiclesXml(xml: string, base = ""): DisplayCar[] {
  const cars: DisplayCar[] = [];
  const seen = new Set<string>();

  for (const match of xml.matchAll(CAR_BLOCK)) {
    const block = match[3];
    const fields = readFields(match[2], block);

    const images = readImages(block, base);
    const plate = pick(fields, [/^carnumber$/, /carnumber/, /^plate/, /licen/, /^adid$|^adnumber$|^itemid$/, /^id$/]);
    // אין מספר רישוי בפיד? הקוד שבקישור לעמוד הרכב באתר הישן משמש
    // כמזהה, ובלעדיו שם קובץ התמונה — שהוא מספר הרישוי.
    const fallbackId =
      block.match(/carcode=(\d+)/i)?.[1] ||
      images[0]?.match(/\/(\d{5,})\.[a-z]+$/i)?.[1] ||
      "";
    const id = plate.replace(/\D/g, "") || plate || fallbackId;
    if (!id || seen.has(id)) continue;

    // ^ מתחילת השם בכוונה: yearofmanufacture הוא שנה, לא יצרן
    const make = pick(fields, [/^manufactu/, /^carmanufactu/, /^make$/, /^brand/, /יצרן/]);
    const baseModel = pick(fields, [/^model$/, /^modelname$/, /^carmodel$/, /^basemodel$/, /^דגם$/, /^cartitle$|^title$|^name$/]);
    const subModel = pick(fields, [/submodel/, /^trim/, /^version/, /תתדגם/]);
    const model = `${baseModel} ${subModel}`.trim();
    if (!make || !model) continue;

    const category = pick(fields, [/category/, /^segment/, /^cartype$/, /^type$/, /קטגוריה/]);

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
      year: num(pick(fields, [/yearofmanufact/, /^year/, /^shnat/, /^yr$/, /שנת|שנה/])),
      price: num(pick(fields, [/^askingprice/, /^price$/, /^sellprice/, /^currentprice/, /^carprice$/, /^cost$/, /^מחיר$/])),
      listPrice: num(pick(fields, [/pricelist/, /listprice/, /mehiron/, /מחירון/])),
      monthly: num(pick(fields, [/monthly/, /permonth/, /^payment/, /החזרחודשי|תשלוםחודשי/])),
      advance: num(pick(fields, [/advance/, /downpayment/, /firstpayment/, /מקדמה/])),
      mileage: pick(fields, [/^km$/, /kilomet/, /mileage/, /^mile/, /^קמ$/]) || "0",
      hand: pick(fields, [/^hand/, /^yad$/, /numberofowner/, /^owners?$/, /^יד$/]),
      ownership: pick(fields, [/ownership/, /baalut/, /בעלות/]) || "לא צוין",
      engine: pick(fields, [/enginetype/, /fueltype/, /^fuel/, /סוגמנוע/]) || "לא צוין",
      engineCapacity: pick(fields, [/enginecapacity/, /enginevolume/, /^cc$/, /נפחמנוע/, /^engine$/]),
      horsePower: pick(fields, [/horsepower/, /^hp$/, /כוחסוס/]),
      gear: pick(fields, [/gear/, /transmission/, /תיבתהילוכים/]),
      drivetrain: pick(fields, [/propulsion/, /drivetrain/, /^drive/, /מערכתהנעה/]),
      color: pick(fields, [/^colou?r/, /צבע/]) || "לא צוין",
      doors: pick(fields, [/door/, /דלת/]).replace(/\D/g, ""),
      seats: pick(fields, [/seat/, /מושב/]).replace(/\D/g, ""),
      test: pick(fields, [/test/, /טסט/]),
      body: pick(fields, [/merkav/, /^body/, /carbody/, /מרכב/]),
      extras: pick(fields, [/extra/, /accessor/, /option/, /תוספות/]),
      remarks: pick(fields, [/remark/, /^description/, /^comment/, /^note/, /^text$/, /הערות/]),
      openRoof: yes(pick(fields, [/sunroof/, /openroof/, /גגנפתח/])),
      category: category || "כל הרכבים",
      categories: category ? [category] : [],
      video: null,
      spin360: [],
    });
  }

  return cars;
}
