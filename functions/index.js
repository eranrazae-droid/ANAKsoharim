const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
// the app uses a named database called "default" (not the reserved "(default)"
// database) — without this second argument, every read/write here silently
// hits an empty, disconnected database instead of the real one.
const db = getFirestore("default");

// current Israel wall-clock time as a UTC-pretend Date, so naive
// (timezone-free) comparison against stored date/time strings works
// correctly regardless of DST
function nowIsraelAsUtcPretend() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  const hour = +g("hour");
  return new Date(Date.UTC(+g("year"), +g("month") - 1, +g("day"), hour === 24 ? 0 : hour, +g("minute")));
}

// runs every 5 minutes: sends the SMS reminder for calendar_events whose
// scheduled reminder time has arrived, then marks them as sent
exports.checkReminders = onSchedule(
  { schedule: "every 5 minutes", region: "europe-west1", timeZone: "Asia/Jerusalem" },
  async () => {
    const now = nowIsraelAsUtcPretend();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const snap = await db.collection("calendar_events").where("reminderSent", "==", false).get();
    if (snap.empty) return;

    const contactsSnap = await db.collection("config").doc("driver_contacts").get();
    const contacts = contactsSnap.exists ? contactsSnap.data() : {};
    // reminders go out over Telegram, like every other notification in the system
    const tgToken = contacts["_telegramToken"]?.value || "";

    for (const docSnap of snap.docs) {
      const e = docSnap.data();
      if (e.reminderMinutes === null || e.reminderMinutes === undefined) continue;
      if (!Array.isArray(e.reminderTo) || !e.reminderTo.length) continue;
      if (!e.date) continue;

      const [y, m, d] = e.date.split("-").map(Number);
      const [hh, mm] = (e.startTime || "00:00").split(":").map(Number);
      const repeat = e.repeat || "none";

      // A repeating task occurs on many dates, so the reminder must be anchored
      // to a specific occurrence — not to the document. Scan the nearby days for
      // an occurrence whose reminder window is open now.
      let dueDateStr = null; // YYYY-MM-DD of the occurrence to remind about
      let dueEventTime = null;
      for (let off = -1; off <= 2 && !dueDateStr; off++) {
        const day = new Date(now.getTime() + off * 24 * 60 * 60 * 1000);
        const ds = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
        if (ds < e.date) continue; // occurrence can't precede the task's start date
        let occurs = false;
        if (repeat === "none") occurs = ds === e.date;
        else if (repeat === "daily") occurs = true;
        else if (repeat === "weekly") occurs = day.getUTCDay() === new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        else if (repeat === "monthly") occurs = day.getUTCDate() === d;
        if (!occurs) continue;

        const eventTime = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hh || 0, mm || 0));
        const reminderTime = new Date(eventTime.getTime() - e.reminderMinutes * 60000);
        // Grace for a missed window: a one-off is worth sending late (up to a day),
        // but a repeating task recurs anyway — a stale occurrence shouldn't fire
        // hours after the fact, so its grace is short.
        const floor = repeat === "none" ? dayAgo : new Date(now.getTime() - 2 * 60 * 60 * 1000);
        if (now >= reminderTime && eventTime >= floor) { dueDateStr = ds; dueEventTime = eventTime; }
      }

      if (!dueDateStr) {
        // one-off event whose date is long past — close it so we stop scanning it
        if (repeat === "none") {
          const eventTime = new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0));
          if (eventTime < dayAgo) await docSnap.ref.update({ reminderSent: true });
        }
        continue;
      }
      // this occurrence was already reminded about — wait for the next one
      if (e.lastRemindedOccurrence === dueDateStr) continue;

      if (tgToken) {
        const text =
          `🔔 תזכורת: ${e.title || ""}` +
          (e.startTime ? ` — ${e.startTime}` : "") +
          (e.notes ? `\n${e.notes}` : "");
        for (const name of e.reminderTo) {
          const chatId = contacts[name]?.telegramId;
          if (!chatId) { console.warn("reminder: no telegramId for", name); continue; }
          try {
            await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text }),
            });
          } catch (err) { console.error("reminder send failed for", name, err); }
        }
      }
      // repeating tasks stay open (reminderSent=false) so future occurrences fire too
      await docSnap.ref.update(
        repeat === "none"
          ? { reminderSent: true, lastRemindedOccurrence: dueDateStr }
          : { lastRemindedOccurrence: dueDateStr },
      );
    }
  }
);

// data.gov.il's recall dataset (unlike the main vehicle registry dataset)
// doesn't send CORS headers, so the browser can't call it directly — this
// relays the request server-side, where CORS doesn't apply.
/* האם המרשם הראשי ריק כרגע (קורה בעדכוני הלילה של הממשלה)? נבדק לכל
   היותר אחת לחמש דקות, כדי שכל חיפוש כושל לא יגרור בדיקה נוספת. */
let _regEmptyCache = { at: 0, empty: false };
async function _registryLooksEmpty() {
  if (Date.now() - _regEmptyCache.at < 5 * 60000) return _regEmptyCache.empty;
  try {
    const r = await _govFetch("https://data.gov.il/api/3/action/datastore_search?resource_id=053cea08-09bc-40ec-8f7a-156f0677aff3&limit=1");
    const j = await r.clone().json().catch(() => null);
    _regEmptyCache = { at: Date.now(), empty: !(j?.result?.records?.length) };
  } catch (err) { _regEmptyCache = { at: Date.now(), empty: false }; }
  return _regEmptyCache.empty;
}

exports.govilProxy = onRequest({ cors: true, region: "europe-west1" }, async (req, res) => {
  const resourceId = req.query.resource_id;
  if (!resourceId || typeof resourceId !== "string") {
    return res.status(400).json({ error: "Missing resource_id" });
  }
  const params = new URLSearchParams({ resource_id: resourceId });
  if (req.query.filters) params.set("filters", req.query.filters);
  if (req.query.q) params.set("q", req.query.q);
  params.set("limit", req.query.limit || "5");
  try {
    const govRes = await _govFetch(`https://data.gov.il/api/3/action/datastore_search?${params.toString()}`);
    const data = await govRes.json();
    // חיפוש שחזר ריק במרשם הראשי: מבדילים בין "אין רכב כזה" ל"המרשם ריק"
    if (govRes.ok && resourceId === "053cea08-09bc-40ec-8f7a-156f0677aff3" &&
        data?.success && !(data.result?.records?.length) && (req.query.filters || req.query.q)) {
      data.registryEmpty = await _registryLooksEmpty();
    }
    res.status(govRes.ok ? 200 : govRes.status).json(data);
  } catch (err) {
    // מצרפים את מה שקרה בפועל, כדי שאפשר יהיה לאבחן מהקונסול
    res.status(502).json({ error: "upstream fetch failed", message: err.message, last: _govLast });
  }
});

// ── daily inventory pull + recall check (Sun–Fri 7:00) ──────────────────
const _RECALL_RESOURCE = "36bf1404-0be4-49d2-82dc-2f1ead4a8b93";
// המלאי מגיע כ-XML מה-CRM. השדות שמעניינים אותנו: CarNumber (מספר רישוי),
// ManufactureYear (שנה) ו-Description (יצרן ודגם כטקסט חופשי).
const _INVENTORY_URL = "https://anak-harechev-crm.vercel.app/api/vehicles/carwiz";
const _sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));

// פיענוח ה-XML בלי ספרייה חיצונית: הפיד שטוח (תג אחד לכל שדה), ולכן
// שליפה ישירה של התוכן בין התגים בטוחה ומספיקה.
function _xmlTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

// ה-Description הוא טקסט חופשי: "יונדאי VENUE PREMIUM 2023" או
// "COROLLA TS HSD SPACE 2019". המילה הראשונה בעברית היא היצרן; אם אין
// עברית, כל הטקסט הוא הדגם. שנת הייצור בסוף הטקסט מיותרת ומוסרת.
function _carwizName(desc) {
  const clean = String(desc || "").replace(/\s+/g, " ").trim().replace(/\s+(19|20)\d{2}$/, "");
  if (!clean) return { tozeret: "", degem: "" };
  const parts = clean.split(" ");
  if (/[֐-׿]/.test(parts[0])) return { tozeret: parts[0], degem: parts.slice(1).join(" ") };
  return { tozeret: "", degem: clean };
}

// ── רכבים שלא נסרקים ──────────────────────────────────────────────────
// רכב "לפי הזמנה" שטרם הגיע נרשם במלאי בלי מספר רישוי אמיתי ("הזמנה-021"),
// ולכן הוא ממילא אינו נכנס לסריקה — אין לו לוחית לבדוק. אין צורך ברשימת
// דילוג ידנית, וכל רכב עם מספר רישוי אמיתי נסרק.
// אם בכל זאת צריך להוציא רכב מסוים מהסריקה, אפשר להוסיף אותו ב-Firestore:
// config/scan_filter → skipPlates. הרשימה שם גוברת על הקוד.
const _SCAN_SKIP_PLATES = [];
let _skipPlates = null;      // מטמון קצר, כדי שעדכון הרשימה ייכנס מיד
let _skipPlatesAt = 0;

async function _loadSkipPlates() {
  if (_skipPlates && Date.now() - _skipPlatesAt < 60000) return _skipPlates;
  let list = _SCAN_SKIP_PLATES;
  try {
    const snap = await db.collection("config").doc("scan_filter").get();
    const fromDb = snap.exists ? snap.data().skipPlates : null;
    if (Array.isArray(fromDb)) list = fromDb;      // הרשימה במסד גוברת על הקוד
  } catch (err) { console.error("scan_filter load failed", err); }
  _skipPlates = new Set(list.map((p) => String(p).replace(/\D/g, "")).filter(Boolean));
  _skipPlatesAt = Date.now();
  return _skipPlates;
}

// מסננת מהמלאי את הרכבים שברשימת הדילוג. המספרים נשמרים כדי שבמסך
// יהיה אפשר לראות כמה רכבים היו במלאי וכמה דולגו — אחרת "נסרקו 85"
// נראה כאילו חסרים רכבים בלי שום הסבר.
let _lastScanCounts = { inventory: 0, skipped: 0, skippedPlates: [] };
async function _filterScannable(cars) {
  const skip = await _loadSkipPlates();
  const out = skip.size ? cars.filter((c) => !skip.has(c.plate)) : cars;
  _lastScanCounts = {
    inventory: cars.length,
    skipped: cars.length - out.length,
    skippedPlates: cars.filter((c) => skip.has(c.plate)).map((c) => c.plate),
    feedBlocks: _lastFeedCounts.blocks,
    badPlateCount: _lastFeedCounts.blocks - _lastFeedCounts.valid,
    badPlates: _lastFeedCounts.badPlates,
  };
  return out;
}

// מושכת את המלאי הפעיל ומחזירה רשימת רכבים אחידה לשתי הסריקות
// (ריקולים ובעלויות), כדי ששתיהן תמיד יעבדו על אותו מלאי.
// כמה רכבים הגיעו מהפיד וכמה נפלו בדרך — בלי המספרים האלה אי אפשר לדעת
// אם רכב חסר בגלל הפיד, בגלל לוחית לא תקינה או בגלל רשימת הדילוג.
let _lastFeedCounts = { blocks: 0, valid: 0, badPlates: [] };
async function _fetchInventory() {
  const res = await fetch(_INVENTORY_URL);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const xml = await res.text();
  const blocks = xml.match(/<CAR>[\s\S]*?<\/CAR>/gi) || [];
  const all = blocks.map((b) => {
    const { tozeret, degem } = _carwizName(_xmlTag(b, "Description"));
    return {
      plate: _xmlTag(b, "CarNumber").replace(/\D/g, ""),
      tozeret,
      degem,
      shnat: _xmlTag(b, "ManufactureYear"),
      rawPlate: _xmlTag(b, "CarNumber"),
    };
  });
  const valid = all.filter((c) => c.plate.length === 7 || c.plate.length === 8);
  _lastFeedCounts = {
    blocks: blocks.length,
    valid: valid.length,
    badPlates: all.filter((c) => c.plate.length !== 7 && c.plate.length !== 8)
      .map((c) => c.rawPlate).slice(0, 40),
  };
  return valid;
}

async function _recallLearnField() {
  const res = await _govFetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&limit=1`);
  const json = await res.json();
  const rec = json?.result?.records?.[0] || {};
  const keys = Object.keys(rec).filter((k) => !k.startsWith("_"));
  let best = keys.find((k) => /rechev|rishuy|mispar/i.test(k) && /^\d{6,9}$/.test(String(rec[k]).replace(/\D/g, "")));
  if (!best) best = keys.find((k) => /^\d{6,9}$/.test(String(rec[k]).replace(/\D/g, "")));
  return best || "mispar_rechev";
}
async function _recallQueryBatch(field, plates) {
  const filters = encodeURIComponent(JSON.stringify({ [field]: plates.map(Number) }));
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&filters=${filters}&limit=${plates.length * 5}`;
  const res = await _govFetch(url);
  if (res.status === 409) throw new Error("VALIDATION"); // wrong field — switch strategy, don't retry
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (!json.success) throw new Error("CKAN error");
  return json.result?.records || [];
}
async function _recallQueryQ(plate) {
  const res = await _govFetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&q=${plate}&limit=5`);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (!json.success) throw new Error("CKAN error");
  return (json.result?.records || []).filter((rec) =>
    Object.entries(rec).some(([k, v]) => !k.startsWith("_") && String(v).replace(/\D/g, "") === plate));
}

// CKAN filters are type-sensitive: if the resource stores the plate as text, a
// numeric filter matches NOTHING and still reports success — which looks
// exactly like "no recalls". Try numbers, then strings, and keep whichever
// actually returns rows.
async function _recallQueryBatchSmart(field, plates) {
  const asNum = await _recallQueryBatch(field, plates);
  if (asNum.length) return asNum;
  const filters = encodeURIComponent(JSON.stringify({ [field]: plates.map(String) }));
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&filters=${filters}&limit=${plates.length * 5}`;
  const res = await _govFetch(url);
  if (res.status === 409) return asNum;
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (!json.success) throw new Error("CKAN error");
  return json.result?.records || [];
}

// proves the lookup pipeline actually works before we trust a "0 recalls"
// result — an all-failed run must never silently wipe the open-recall list.
async function _recallProbeWorks() {
  try {
    const res = await _govFetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&limit=1`);
    if (!res.ok) return false;
    const json = await res.json();
    return !!json.success && (json.result?.records || []).length > 0;
  } catch (err) { return false; }
}

exports.dailyRecallPull = onSchedule(
  // the per-plate fallback path can take minutes for a full lot — the default
  // 60s timeout would kill the run halfway through
  { schedule: "0 7 * * 0-5", region: "europe-west1", timeZone: "Asia/Jerusalem", timeoutSeconds: 540, memory: "512MiB" },
  async () => { await _runRecallScan("schedule"); }
);

// same scan, on demand — lets the manager verify without waiting for 07:00
exports.runRecallScanNow = onRequest(
  { cors: true, region: "europe-west1", timeoutSeconds: 540, memory: "512MiB" },
  async (req, res) => {
    try {
      const r = await _runRecallScan("manual");
      res.status(200).json(r);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// A run that ends early used to write nothing at all, so a morning with no
// scan looked exactly like a morning with no recalls. Every run now stamps
// recall_status/lastRun, and every failure sends a Telegram message.
async function _recallReportRun(result, trigger, quiet) {
  try {
    await db.collection("recall_status").doc("lastRun").set({
      at: new Date(), trigger: trigger || "schedule", ...result,
    });
  } catch (err) { console.error("recall lastRun write failed", err); }
  if (result.ok) return;
  // בזמן ניסיונות חוזרים אחרי חסימה לא שולחים הודעת כישלון בכל ניסיון
  if (quiet) return;
  const reasons = {
    "inventory-fetch-failed": "לא הצלחנו למשוך את רשימת הרכבים מהמערכת (השרת לא הגיב)",
    "empty-inventory": "רשימת הרכבים חזרה ריקה מהמערכת",
    "no-valid-plates": "לא נמצאו מספרי רישוי תקינים ברשימת הרכבים",
    "unreliable": "משרד התחבורה לא הגיב — הרשימה הקודמת נשמרה",
    "crashed": "הסריקה נעצרה עקב שגיאה",
  };
  try {
    const cs = await db.collection("config").doc("driver_contacts").get();
    const contacts = cs.exists ? cs.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    const chatId = contacts["ליאל"]?.telegramId || "";
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚠️ בדיקת הריקול לא הושלמה.\nסיבה: ${reasons[result.reason] || result.reason || "לא ידוע"}\nהרשימה הקודמת נשמרה. אפשר להריץ סריקה ידנית מהמסך.`,
      }),
    });
  } catch (err) { console.error("recall failure alert failed", err); }
}

// The scan runs on the server and can take minutes, so it reports how far it
// got after every batch. The recall screen listens to this doc and draws a
// percentage — for the manual run and for the 07:00 one alike.
async function _recallProgress(done, total, running) {
  try {
    await db.collection("recall_status").doc("progress")
      .set({ done, total, running, at: new Date() });
  } catch (err) { console.error("recall progress write failed", err); }
}

async function _runRecallScan(trigger, quiet) {
  const res = await _runRecallScanInner().catch((err) => {
    console.error("recall scan crashed", err);
    return { ok: false, reason: "crashed", error: String(err && err.message || err) };
  });
  await _recallProgress(0, 0, false);   // הפס נעלם מהמסך בסיום, גם בכישלון
  await _recallReportRun(res, trigger, quiet);
  return res;
}

async function _runRecallScanInner() {
    let cars;
    try {
      cars = await _filterScannable(await _fetchInventory());
    } catch (err) {
      console.error("dailyRecallPull: inventory fetch failed", err);
      return { ok: false, reason: "inventory-fetch-failed" };
    }
    if (!cars.length) return { ok: false, reason: "no-valid-plates" };

    // keep "resolved" + linked-task info for cars still open from a previous run
    const statusRef = db.collection("recall_status").doc("current");
    const existingSnap = await statusRef.get();
    const prevByPlate = {};
    if (existingSnap.exists) {
      for (const c of existingSnap.data().cars || []) prevByPlate[c.plate] = c;
    }

    const field = await _recallLearnField().catch(() => "mispar_rechev");

    // diagnostic snapshot → Firestore, so a "0 recalls" result can be audited:
    // what the dataset looks like, which field was chosen, and what a direct
    // probe for one known plate returns in both filter modes and free-text.
    try {
      const sampleRes = await _govFetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&limit=2`);
      const sampleJson = await sampleRes.json().catch(() => ({}));
      const sampleRecs = sampleJson?.result?.records || [];
      const probePlate = cars[0]?.plate || "";
      const probe = {};
      for (const [mode, filters] of [["num", { [field]: [Number(probePlate)] }], ["str", { [field]: [String(probePlate)] }]]) {
        try {
          const r = await _govFetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&filters=${encodeURIComponent(JSON.stringify(filters))}&limit=3`);
          probe[mode] = { status: r.status, count: (await r.json().catch(() => ({})))?.result?.records?.length ?? -1 };
        } catch (e) { probe[mode] = { error: e.message }; }
      }
      try {
        const r = await _govFetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&q=${probePlate}&limit=3`);
        const j = await r.json().catch(() => ({}));
        probe.q = { status: r.status, count: j?.result?.records?.length ?? -1, sample: (j?.result?.records || [])[0] || null };
      } catch (e) { probe.q = { error: e.message }; }
      await db.collection("recall_status").doc("debug").set({
        at: new Date(), chosenField: field, probePlate,
        sampleKeys: sampleRecs[0] ? Object.keys(sampleRecs[0]) : [],
        sampleRecord: sampleRecs[0] ? JSON.stringify(sampleRecs[0]).slice(0, 1500) : null,
        probe: JSON.stringify(probe),
        totalInDataset: sampleJson?.result?.total ?? null,
      });
    } catch (e) { console.error("recall debug snapshot failed", e); }

    const BATCH = 40;
    const openCars = [];
    let useQ = false;
    let failedPlates = 0;
    await _recallProgress(0, cars.length, true);
    for (let i = 0; i < cars.length; i += BATCH) {
      const chunk = cars.slice(i, i + BATCH);
      let batchOk = false;
      if (!useQ) {
        try {
          const recs = await _recallQueryBatchSmart(field, chunk.map((c) => c.plate));
          const foundPlates = new Set();
          for (const rec of recs) {
            for (const [k, v] of Object.entries(rec)) {
              if (k.startsWith("_")) continue;
              const d = String(v).replace(/\D/g, "");
              if (d.length >= 6 && d.length <= 9) foundPlates.add(d);
            }
          }
          for (const c of chunk) if (foundPlates.has(c.plate)) openCars.push(c);
          batchOk = true;
        } catch (err) {
          console.error("dailyRecallPull: batch query failed, switching to free-text", err);
          useQ = true;
        }
      }
      if (!batchOk) {
        // המסלול האיטי — רכב אחרי רכב. מדווח כל עשרה, כדי לא להציף בכתיבות
        let n = 0;
        for (const c of chunk) {
          try {
            const recs = await _recallQueryQ(c.plate);
            if (recs.length) openCars.push(c);
          } catch (err) { failedPlates++; }
          if (++n % 10 === 0) await _recallProgress(i + n, cars.length, true);
          await _sleep2(250);
        }
      } else if (i + BATCH < cars.length) {
        await _sleep2(400);
      }
      await _recallProgress(Math.min(i + BATCH, cars.length), cars.length, true);
    }

    // Never let a broken run masquerade as "no recalls": if we found nothing,
    // only trust it when the lookup pipeline is provably alive and no plate
    // errored. Otherwise keep yesterday's list and tell the manager.
    if (!openCars.length) {
      const probeOk = await _recallProbeWorks();
      if (!probeOk || failedPlates) {
        console.error(`dailyRecallPull: unreliable run (probeOk=${probeOk}, failedPlates=${failedPlates}) — keeping previous list`);
        return { ok: false, reason: "unreliable", probeOk, failedPlates, checked: cars.length };
      }
    }

    const finalCars = openCars.map((c) => {
      const prev = prevByPlate[c.plate];
      return { ...c, resolved: !!prev?.resolved, taskId: prev?.taskId || null };
    });
    await statusRef.set({
      cars: finalCars, updatedAt: new Date(), checkedCount: cars.length,
      inventoryCount: _lastScanCounts.inventory,
      skippedCount: _lastScanCounts.skipped,
      skippedPlates: _lastScanCounts.skippedPlates,
      feedCount: _lastScanCounts.feedBlocks || 0,
      badPlateCount: _lastScanCounts.badPlateCount || 0,
      badPlates: _lastScanCounts.badPlates || [],
    });
    return { ok: true, checked: cars.length, withRecall: finalCars.length, usedFreeText: useQ };
}

// daily reminder for open, unresolved recalls — as long as recall_status/current
// still lists an unresolved car, ליאל gets a Telegram message every morning with
// the vehicle details and a nudge to book an appointment.
exports.recallDailyReminder = onSchedule(
  { schedule: "30 8 * * *", region: "europe-west1", timeZone: "Asia/Jerusalem" },
  async () => {
    const statusSnap = await db.collection("recall_status").doc("current").get();
    const cars = (statusSnap.exists ? statusSnap.data().cars : []) || [];
    const open = cars.filter((c) => !c.resolved);
    if (!open.length) return;

    const contactsSnap = await db.collection("config").doc("driver_contacts").get();
    const contacts = contactsSnap.exists ? contactsSnap.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    const chatId = contacts["ליאל"]?.telegramId || "";
    if (!token || !chatId) return;

    const lines = open.map((c) => {
      const desc = [c.tozeret, c.degem, c.shnat ? `שנת ${c.shnat}` : ""].filter(Boolean).join(" ");
      return `🚗 ${c.plate}${desc ? " — " + desc : ""}`;
    });
    const text = `⚠️ תזכורת יומית — ${open.length} רכבים עם ריקול פתוח שממתין לטיפול:\n\n${lines.join("\n")}\n\nיש לקבוע תור לתיקון.`;

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (err) {
      console.error("recall reminder send failed", err);
    }
  }
);

// sends the battery-check nudge with two reply buttons: "busy, remind me
// tomorrow" and "handling it now" — the driver's choice is relayed to ליאל.
async function _sendBatteryReminderMsg(token, chatId, driverName, count) {
  const text = `🔋 תזכורת — יש לך ${count} רכבים שממתינים לבדיקת סוללה. כנס לאפליקציה להשלים.`;
  const reply_markup = {
    inline_keyboard: [
      [{ text: "⏰ עסוק עכשיו, תזכיר לי מחר", callback_data: `battery_snooze:${driverName}` }],
      [{ text: "✅ מטפל בזה עכשיו", callback_data: `battery_now:${driverName}` }],
    ],
  };
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup }),
  });
}

async function _countPendingBatteryChecks(driverName) {
  const snap = await db.collection("battery_assignments")
    .where("status", "==", "pending").where("assignedTo", "==", driverName).get();
  let count = 0;
  snap.forEach((d) => {
    const rows = d.data().rowsJson ? JSON.parse(d.data().rowsJson) : [];
    count += rows.length;
  });
  return count;
}

// Sun/Tue/Thu at 11:00 — nudge each driver individually about how many
// battery checks (battery_assignments, status 'pending') are personally
// assigned to them.
exports.batteryCheckReminder = onSchedule(
  { schedule: "0 11 * * 0,2,4", region: "europe-west1", timeZone: "Asia/Jerusalem" },
  async () => {
    const snap = await db.collection("battery_assignments").where("status", "==", "pending").get();
    if (snap.empty) return;

    const countByDriver = {};
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const rows = data.rowsJson ? JSON.parse(data.rowsJson) : [];
      const driver = data.assignedTo;
      if (!driver) continue;
      countByDriver[driver] = (countByDriver[driver] || 0) + rows.length;
    }
    if (!Object.keys(countByDriver).length) return;

    const contactsSnap = await db.collection("config").doc("driver_contacts").get();
    const contacts = contactsSnap.exists ? contactsSnap.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    if (!token) return;

    for (const [name, count] of Object.entries(countByDriver)) {
      const chatId = contacts[name]?.telegramId;
      if (!chatId) continue;
      try {
        await _sendBatteryReminderMsg(token, chatId, name, count);
      } catch (err) {
        console.error("battery check reminder send failed for", name, err);
      }
    }
  }
);

// תזכורת לנהגים על משימות פתוחות. רצה כל בוקר ב-8:00 (ראשון–שישי), אבל
// כל משימה מזכירים עליה רק כל 48 שעות: תזכורת ראשונה אחרי 48 שעות
// מהיצירה, ואז שוב כל 48 שעות כל עוד היא פתוחה. אחרי 4 ימים הנוסח
// משתנה ל"יותר מ-4 ימים". lastReminderAt נשמר על כל משימה כדי לשמור על
// הקצב הזה.
const _TASK_DRIVERS = ["עופר", "גיל", "איתי"];
const _tsMillis = (v) => v && typeof v.toMillis === "function" ? v.toMillis() : (v && v.seconds ? v.seconds * 1000 : 0);

exports.taskReminders = onSchedule(
  { schedule: "0 8 * * 0-5", region: "europe-west1", timeZone: "Asia/Jerusalem" },
  async () => {
    const snap = await db.collection("tasks").get();
    if (snap.empty) return;
    const now = Date.now();
    const DAY2 = 48 * 3600 * 1000, DAY4 = 96 * 3600 * 1000;
    const byDriver = {};        // name → [{title, days}]
    const toStamp = [];         // refs לעדכון lastReminderAt
    for (const docSnap of snap.docs) {
      const t = docSnap.data();
      if (t.type === "divider" || t.status === "done") continue;
      const created = _tsMillis(t.createdAt);
      if (!created || now - created < DAY2) continue;   // טרם עברו 48 שעות מהיצירה
      const driver = _TASK_DRIVERS.includes(t.assignedTo) ? t.assignedTo
        : (_TASK_DRIVERS.includes(t.label) ? t.label : null);
      if (!driver) continue;
      // מזכירים רק אם עברו 48 שעות מהתזכורת האחרונה (או מהיצירה אם אין)
      const lastRem = _tsMillis(t.lastReminderAt) || created;
      if (now - lastRem < DAY2) continue;
      const days = now - created >= DAY4 ? 4 : 2;
      (byDriver[driver] = byDriver[driver] || []).push({ title: t.title || "משימה", days });
      toStamp.push(docSnap.ref);
    }
    if (!Object.keys(byDriver).length) return;

    const contactsSnap = await db.collection("config").doc("driver_contacts").get();
    const contacts = contactsSnap.exists ? contactsSnap.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    if (!token) return;

    for (const [name, items] of Object.entries(byDriver)) {
      const chatId = contacts[name]?.telegramId;
      if (!chatId) continue;
      const list = items.slice(0, 15)
        .map((x) => `• ${x.title} — ממתינה ${x.days === 4 ? "יותר מ-4 ימים" : "יותר מיומיים"}`).join("\n");
      const text = `בוקר טוב ${name} 👋\nמשימות שממתינות לך:\n${list}${items.length > 15 ? `\n…ועוד ${items.length - 15}` : ""}\n\nכנס לאפליקציה ענק הרכבים.`;
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        });
      } catch (err) { console.error("task reminder send failed for", name, err); }
    }
    // מסמנים את זמן התזכורת רק אחרי השליחה, כדי לשמור על קצב 48 השעות
    for (const ref of toStamp) {
      try { await ref.update({ lastReminderAt: new Date(now) }); } catch (err) { /* ignore */ }
    }
  }
);

// instant webhook — Telegram calls this the moment a driver taps a button,
// instead of waiting for a 2-minute poll.
exports.telegramWebhook = onRequest({ region: "europe-west1" }, async (req, res) => {
  res.status(200).send("ok"); // ack Telegram immediately, process after
  try {
    // כל הודעה שמגיעה מקבוצה — רושמים את מזהה הקבוצה ושמה, כדי שאפשר
    // יהיה לבחור אותה כיעד בהגדרות בלי כלים חיצוניים.
    const msg = req.body?.message || req.body?.edited_message;
    if (msg?.chat && (msg.chat.type === "group" || msg.chat.type === "supergroup")) {
      try {
        await db.collection("config").doc("telegram_groups").set({
          [String(msg.chat.id)]: { id: msg.chat.id, title: msg.chat.title || "", at: new Date() },
        }, { merge: true });
      } catch (err) { console.error("group capture failed", err); }
    }

    // שיחה פרטית — רושמים את מזהה הצ'אט והשם, כדי לשייך אותו לעובד
    // בהגדרות. הבוט עובד ב-webhook, ולכן getUpdates חסום ואי אפשר לשלוף
    // את ההודעות בדיעבד — הן נתפסות כאן, ברגע שהן מגיעות.
    if (msg?.chat && msg.chat.type === "private") {
      try {
        const from = msg.from || {};
        const name = [from.first_name, from.last_name].filter(Boolean).join(" ")
          || from.username || String(msg.chat.id);
        await db.collection("config").doc("telegram_chats").set({
          [String(msg.chat.id)]: { id: msg.chat.id, name, username: from.username || "", at: new Date() },
        }, { merge: true });
      } catch (err) { console.error("private chat capture failed", err); }
    }

    const cq = req.body?.callback_query;
    if (!cq || !cq.data) return;

    const contactsSnap = await db.collection("config").doc("driver_contacts").get();
    const contacts = contactsSnap.exists ? contactsSnap.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    if (!token) return;
    const managerChatId = contacts["ליאל"]?.telegramId;

    fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cq.id }),
    }).catch(() => {});

    const [action, driverName] = cq.data.split(":");
    if (action === "battery_snooze") {
      await db.collection("pending_reminders").add({
        type: "battery_snooze",
        driver: driverName,
        chatId: cq.message?.chat?.id,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        sent: false,
        createdAt: new Date(),
      });
      if (managerChatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: managerChatId, text: `⏰ ${driverName} ביקש תזכורת מחר לגבי בדיקת הסוללה.` }),
        });
      }
    } else if (action === "battery_now") {
      if (managerChatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: managerChatId, text: `✅ ${driverName} מטפל עכשיו בבדיקת הסוללה.` }),
        });
      }
    }
  } catch (err) {
    console.error("telegramWebhook failed", err);
  }
});

// one-time setup — open this URL once in a browser to point the bot at the
// webhook above (instead of the 2-minute poll it used before).
exports.registerTelegramWebhook = onRequest({ region: "europe-west1" }, async (req, res) => {
  const contactsSnap = await db.collection("config").doc("driver_contacts").get();
  const contacts = contactsSnap.exists ? contactsSnap.data() : {};
  const token = contacts["_telegramToken"]?.value || "";
  if (!token) return res.status(400).send("אין טוקן טלגרם מוגדר");
  const webhookUrl = "https://europe-west1-anak-soharim.cloudfunctions.net/telegramWebhook";
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const tgData = await tgRes.json();
    res.status(200).send(tgData.ok ? "✅ הבוט מחובר עכשיו לתגובה מיידית" : "שגיאה: " + JSON.stringify(tgData));
  } catch (err) {
    res.status(500).send("שגיאה: " + err.message);
  }
});

// every 15 min — fires any snoozed "remind me tomorrow" reminders whose time
// has come, re-checking the driver's current pending count first.
exports.sendDueReminders = onSchedule(
  { schedule: "every 15 minutes", region: "europe-west1" },
  async () => {
    const snap = await db.collection("pending_reminders").where("sent", "==", false).get();
    if (snap.empty) return;
    const now = new Date();
    const due = snap.docs.filter((d) => {
      const r = d.data();
      const dueAt = r.dueAt?.toDate ? r.dueAt.toDate() : new Date(r.dueAt);
      return dueAt <= now;
    });
    if (!due.length) return;

    const contactsSnap = await db.collection("config").doc("driver_contacts").get();
    const contacts = contactsSnap.exists ? contactsSnap.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    if (!token) { for (const d of due) await d.ref.update({ sent: true }); return; }

    for (const docSnap of due) {
      const r = docSnap.data();
      try {
        if (r.type === "battery_snooze") {
          const count = await _countPendingBatteryChecks(r.driver);
          if (count > 0 && r.chatId) await _sendBatteryReminderMsg(token, r.chatId, r.driver, count);
        }
      } catch (err) {
        console.error("sendDueReminders failed for", r.driver, err);
      }
      await docSnap.ref.update({ sent: true });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════════
   GOOGLE CALENDAR — two-way sync

   Both directions are immediate:
   · app → google  : a write to calendar_events fires syncCalendarToGoogle
   · google → app  : google pushes to calendarPush, which pulls only what
                     changed and writes it back here

   Nothing runs until the one-time setup is done:
   1. enable the Google Calendar API on the firebase project
   2. share the calendar with the function's service account, with
      permission to make changes to events
   3. write the calendar's address into config/google_calendar as
      { calendarId: "…@group.calendar.google.com" }  (or "primary")
   4. call startCalendarSync once — it registers the push channel

   The loop is broken by two things: an event written here from google is
   marked with syncedFrom:"google" and the trigger ignores that write, and
   every google event we create carries our own document id in its private
   properties, so it is never taken for a new event coming back.
═══════════════════════════════════════════════════════════════════ */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { google } = require("googleapis");
const { getStorage } = require("firebase-admin/storage");

const GCAL_REGION = "europe-west1";
const GCAL_CFG = () => db.collection("config").doc("google_calendar");
const GCAL_TAG = "anak_event_id";   // our id, kept on the google event
const GCAL_SPAN = 2 * 365 * 86400000;   // how far a full read reaches, each way

async function gcal() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });
  return google.calendar({ version: "v3", auth: await auth.getClient() });
}

// which service account this function actually runs as
async function runtimeAccount() {
  try {
    const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/calendar.events"] });
    const c = await auth.getCredentials();
    return c.client_email || "(unknown)";
  } catch (e) { return "(unknown)"; }
}

async function gcalConfig() {
  const snap = await GCAL_CFG().get();
  const d = snap.exists ? snap.data() : {};
  return { calendarId: d.calendarId || "", channelId: d.channelId || "", resourceId: d.resourceId || "", syncToken: d.syncToken || "" };
}

// our events carry a date and, usually, a start time; google wants either a
// timed range or a whole day
function toGoogleEvent(id, e) {
  const date = String(e.date || "").slice(0, 10);
  const body = {
    summary: e.title || "משימה",
    description: e.notes || "",
    extendedProperties: { private: { [GCAL_TAG]: id } },
  };
  if (e.startTime) {
    const start = `${date}T${e.startTime}:00`;
    const endT = e.endTime || addHour(e.startTime);
    body.start = { dateTime: start, timeZone: "Asia/Jerusalem" };
    body.end = { dateTime: `${date}T${endT}:00`, timeZone: "Asia/Jerusalem" };
  } else {
    body.start = { date };
    body.end = { date: nextDay(date) };
  }
  return body;
}

function addHour(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
}

function nextDay(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// google → our shape
function fromGoogleEvent(ev) {
  const startDateTime = ev.start?.dateTime || "";
  const endDateTime = ev.end?.dateTime || "";
  const date = (ev.start?.date || startDateTime).slice(0, 10);
  const hm = (s) => (s ? s.slice(11, 16) : "");
  return {
    title: ev.summary || "ללא כותרת",
    date,
    startTime: hm(startDateTime),
    endTime: hm(endDateTime),
    notes: ev.description || "",
    gcalId: ev.id,
    syncedFrom: "google",
    syncedAt: new Date().toISOString(),
  };
}

/* ── app → google ─────────────────────────────────────────────────── */
exports.syncCalendarToGoogle = onDocumentWritten(
  { document: "calendar_events/{id}", region: GCAL_REGION, database: "default" },
  async (event) => {
    const { calendarId } = await gcalConfig();
    if (!calendarId) return;                       // setup not done yet

    const id = event.params.id;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    // a write that came from google must not be sent back to it
    if (after?.syncedFrom === "google" && before?.syncedFrom !== "google") return;
    if (after && before && JSON.stringify({ ...before, syncedAt: 0 }) === JSON.stringify({ ...after, syncedAt: 0 })) return;

    const cal = await gcal();
    try {
      if (!after) {
        if (before?.gcalId) await cal.events.delete({ calendarId, eventId: before.gcalId }).catch(() => {});
        return;
      }
      const body = toGoogleEvent(id, after);
      if (after.gcalId) {
        await cal.events.patch({ calendarId, eventId: after.gcalId, requestBody: body });
      } else {
        const res = await cal.events.insert({ calendarId, requestBody: body });
        await event.data.after.ref.update({ gcalId: res.data.id });
      }
    } catch (e) {
      console.error("syncCalendarToGoogle", id, e.message);
    }
  }
);

/* ── google → app ─────────────────────────────────────────────────── */
// מזהה המסמך אצלנו נגזר ממזהה האירוע בגוגל, כדי שאותו אירוע ייכתב תמיד
// לאותו מסמך. מזהה מסמך ב-Firestore לא יכול להכיל "/" ולא להיות ארוך מדי.
function gcalDocId(googleId) {
  const safe = String(googleId).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 90);
  return `g_${safe}`;
}

// pulls only what changed since the last time, using google's sync token
async function pullGoogleChanges() {
  const { calendarId, syncToken } = await gcalConfig();
  if (!calendarId) return { skipped: "no calendarId" };
  const cal = await gcal();

  let pageToken = null, token = syncToken, changed = 0;
  do {
    let res;
    try {
      res = await cal.events.list({
        calendarId, singleEvents: true, showDeleted: true, maxResults: 250,
        // the first read takes the whole calendar — two years back and two
        // years forward. A repeating event has to be given an end for google
        // to expand it, so both bounds are needed here.
        ...(token ? { syncToken: token } : {
          timeMin: new Date(Date.now() - GCAL_SPAN).toISOString(),
          timeMax: new Date(Date.now() + GCAL_SPAN).toISOString(),
        }),
        ...(pageToken ? { pageToken } : {}),
      });
    } catch (e) {
      // an expired token means a full read is needed once
      if (e.code === 410) { await GCAL_CFG().set({ syncToken: "" }, { merge: true }); return pullGoogleChanges(); }
      throw e;
    }

    for (const ev of res.data.items || []) {
      const ourId = ev.extendedProperties?.private?.[GCAL_TAG];
      if (ev.status === "cancelled") {
        if (ourId) await db.collection("calendar_events").doc(ourId).delete().catch(() => {});
        else {
          // נמחקים כל העותקים, אם נוצרו כפילויות בעבר
          const q = await db.collection("calendar_events").where("gcalId", "==", ev.id).get();
          for (const d of q.docs) await d.ref.delete().catch(() => {});
        }
        changed++;
        continue;
      }
      const data = fromGoogleEvent(ev);
      if (ourId) {
        await db.collection("calendar_events").doc(ourId).set(data, { merge: true });
      } else {
        const q = await db.collection("calendar_events").where("gcalId", "==", ev.id).get();
        if (!q.empty) {
          await q.docs[0].ref.set(data, { merge: true });
          // ניקוי כפילויות שנוצרו לפני התיקון
          for (const extra of q.docs.slice(1)) await extra.ref.delete().catch(() => {});
        } else {
          // מזהה קבוע הנגזר מהאירוע בגוגל: שתי הרצאות במקביל של הפונקציה
          // כותבות לאותו מסמך, ולכן אירוע אחד לא יכול להיווצר פעמיים
          const ref = db.collection("calendar_events").doc(gcalDocId(ev.id));
          await ref.set({
            ...data, repeat: "none", reminderMinutes: 0, reminderTo: "", reminderSent: true,
            createdAt: new Date(),
          }, { merge: true });
          // tie the two together, so the pair is never duplicated
          await cal.events.patch({
            calendarId, eventId: ev.id,
            requestBody: { extendedProperties: { private: { [GCAL_TAG]: ref.id } } },
          }).catch(() => {});
        }
      }
      changed++;
    }
    pageToken = res.data.nextPageToken || null;
    if (res.data.nextSyncToken) await GCAL_CFG().set({ syncToken: res.data.nextSyncToken }, { merge: true });
  } while (pageToken);

  return { changed };
}

// the trigger above only fires when a document is written, so events that
// were already in the app when the sync was switched on would never reach
// google on their own. This sends them once.
async function pushAllToGoogle() {
  const { calendarId } = await gcalConfig();
  if (!calendarId) return { pushed: 0 };
  const cal = await gcal();
  const snap = await db.collection("calendar_events").get();
  let pushed = 0;
  for (const doc of snap.docs) {
    const e = doc.data();
    if (e.gcalId) continue;                 // already over there
    try {
      const res = await cal.events.insert({ calendarId, requestBody: toGoogleEvent(doc.id, e) });
      await doc.ref.update({ gcalId: res.data.id });
      pushed++;
    } catch (err) { console.error("pushAllToGoogle", doc.id, err.message); }
  }
  return { pushed };
}

// google calls this the moment anything changes in the calendar
exports.calendarPush = onRequest({ region: GCAL_REGION, cors: false }, async (req, res) => {
  res.status(200).send("ok");   // google wants an immediate answer
  try {
    if (req.get("X-Goog-Resource-State") === "sync") return;   // the handshake
    await pullGoogleChanges();
  } catch (e) { console.error("calendarPush", e.message); }
});

/* ── setup and upkeep ─────────────────────────────────────────────── */
// called once by hand: registers the push channel and reads the calendar in
// full for the first time. Safe to call again — it replaces the channel.
exports.startCalendarSync = onRequest({ region: GCAL_REGION, cors: true }, async (req, res) => {
  try {
    const { calendarId, channelId, resourceId } = await gcalConfig();
    if (!calendarId) return res.status(400).send('חסר calendarId במסמך config/google_calendar');
    const cal = await gcal();

    if (channelId && resourceId) {
      await cal.channels.stop({ requestBody: { id: channelId, resourceId } }).catch(() => {});
    }
    const id = `anak-${Date.now()}`;
    const address = `https://${GCAL_REGION}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/calendarPush`;
    const watch = await cal.events.watch({
      calendarId,
      requestBody: { id, type: "web_hook", address, ttl: "2592000" },   // 30 days
    });
    await GCAL_CFG().set({
      channelId: id, resourceId: watch.data.resourceId,
      watchExpires: watch.data.expiration || "", updatedAt: new Date().toISOString(),
      syncToken: "",   // pressing the button means: read everything again
    }, { merge: true });

    const pulled = await pullGoogleChanges();
    const sent = await pushAllToGoogle();
    res.json({ ok: true, address, channel: id, sharedWith: await runtimeAccount(), ...pulled, ...sent });
  } catch (e) {
    console.error("startCalendarSync", e);
    // the usual cause is the calendar not being shared with THIS account, so
    // the answer says which one it is
    res.status(500).send(`${e.message} — יש לשתף את היומן עם ${await runtimeAccount()}`);
  }
});

// reads nothing and changes nothing — it only answers "what does each side
// actually hold right now", so a sync problem can be located instead of guessed
exports.calendarDiag = onRequest({ region: GCAL_REGION, cors: true }, async (req, res) => {
  const out = { account: await runtimeAccount() };
  try {
    const cfg = await gcalConfig();
    out.config = {
      calendarId: cfg.calendarId || "(חסר)",
      hasChannel: !!cfg.channelId,
      hasSyncToken: !!cfg.syncToken,
    };

    const snap = await db.collection("calendar_events").get();
    out.app = {
      total: snap.size,
      withGcalId: snap.docs.filter((d) => d.data().gcalId).length,
      sample: snap.docs.slice(0, 5).map((d) => ({
        id: d.id, title: d.data().title, date: d.data().date, gcalId: d.data().gcalId || null,
      })),
    };

    if (!cfg.calendarId) { out.google = "אין מזהה יומן"; return res.json(out); }
    const cal = await gcal();
    try {
      const list = await cal.calendarList.list();
      out.visibleCalendars = (list.data.items || []).map((c) => c.id);
    } catch (e) { out.visibleCalendars = `שגיאה: ${e.message}`; }

    try {
      const ev = await cal.events.list({
        calendarId: cfg.calendarId, singleEvents: true, maxResults: 250,
        timeMin: new Date(Date.now() - GCAL_SPAN).toISOString(),
        timeMax: new Date(Date.now() + GCAL_SPAN).toISOString(),
      });
      const items = ev.data.items || [];
      out.google = {
        total: items.length,
        tagged: items.filter((e) => e.extendedProperties?.private?.[GCAL_TAG]).length,
        sample: items.slice(0, 5).map((e) => ({
          id: e.id, summary: e.summary, start: e.start?.dateTime || e.start?.date,
        })),
      };
    } catch (e) { out.google = `שגיאה בקריאת היומן: ${e.message}`; }

    res.json(out);
  } catch (e) {
    out.error = e.message;
    res.status(500).json(out);
  }
});

// the channel google gives us expires; this keeps it alive, and also acts as a
// safety net in case a push was ever missed
exports.renewCalendarWatch = onSchedule(
  { schedule: "0 3 * * *", timeZone: "Asia/Jerusalem", region: GCAL_REGION },
  async () => {
    const { calendarId, channelId, resourceId, watchExpires } = await gcalConfig();
    if (!calendarId) return;
    try {
      await pullGoogleChanges();
      const daysLeft = watchExpires ? (Number(watchExpires) - Date.now()) / 86400000 : -1;
      if (daysLeft > 3) return;   // still good
      const cal = await gcal();
      if (channelId && resourceId) {
        await cal.channels.stop({ requestBody: { id: channelId, resourceId } }).catch(() => {});
      }
      const id = `anak-${Date.now()}`;
      const address = `https://${GCAL_REGION}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/calendarPush`;
      const watch = await cal.events.watch({
        calendarId, requestBody: { id, type: "web_hook", address, ttl: "2592000" },
      });
      await GCAL_CFG().set({
        channelId: id, resourceId: watch.data.resourceId,
        watchExpires: watch.data.expiration || "", updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) { console.error("renewCalendarWatch", e.message); }
  }
);

/* ═══════════════════════════════════════════════════════════════════
   USERS — one identity per person, managed from the manager's screen

   Everyone signs in with a phone number and a password. The phone is
   turned into an internal address (0521234567 → 0521234567@anak.local)
   because that is what the sign-in mechanism understands; nothing about
   it is visible to the person signing in.

   The manager's screen calls this function to list people, add one,
   change a phone or set a new password. Passwords are never read back
   from here — they cannot be. A password that the manager wants kept for
   his own reference is stored by the app, in a document only his own
   account is allowed to read.
═══════════════════════════════════════════════════════════════════ */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");

const USERS_REGION = "europe-west1";
const phoneToEmail = (phone) => `${String(phone).replace(/\D/g, "")}@anak.local`;

// only the manager may manage people
async function assertManager(uid) {
  if (!uid) throw new HttpsError("unauthenticated", "נדרשת התחברות");
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists || snap.data().role !== "manager") {
    throw new HttpsError("permission-denied", "רק המנהל יכול לנהל משתמשים");
  }
}

exports.adminUsers = onCall({ region: USERS_REGION }, async (req) => {
  const { action, name, phone, password, role, uid } = req.data || {};

  // the very first manager can be created while there is still nobody:
  // without it there would be no way in at all
  const usersSnap = await db.collection("users").limit(1).get();
  const firstRun = usersSnap.empty;
  if (!firstRun) await assertManager(req.auth?.uid);

  const auth = getAuth();

  if (action === "list") {
    const snap = await db.collection("users").get();
    return { users: snap.docs.map((d) => ({ uid: d.id, ...d.data() })) };
  }

  if (action === "create") {
    if (!name || !phone || !password) throw new HttpsError("invalid-argument", "חסר שם, טלפון או סיסמה");
    const email = phoneToEmail(phone);
    let user;
    try {
      user = await auth.createUser({ email, password, displayName: name });
    } catch (e) {
      if (e.code === "auth/email-already-exists") {
        user = await auth.getUserByEmail(email);
        await auth.updateUser(user.uid, { password, displayName: name });
      } else throw new HttpsError("internal", e.message);
    }
    await db.collection("users").doc(user.uid).set({
      name, phone: String(phone).replace(/\D/g, ""), role: role || "driver",
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return { uid: user.uid };
  }

  if (action === "setPassword") {
    if (!uid || !password) throw new HttpsError("invalid-argument", "חסר משתמש או סיסמה");
    await auth.updateUser(uid, { password });   // this also signs him out everywhere
    await db.collection("users").doc(uid).set({ passwordChangedAt: new Date().toISOString() }, { merge: true });
    return { ok: true };
  }

  if (action === "setPhone") {
    if (!uid || !phone) throw new HttpsError("invalid-argument", "חסר משתמש או טלפון");
    await auth.updateUser(uid, { email: phoneToEmail(phone) });
    await db.collection("users").doc(uid).set({ phone: String(phone).replace(/\D/g, ""), updatedAt: new Date().toISOString() }, { merge: true });
    return { ok: true };
  }

  if (action === "remove") {
    if (!uid) throw new HttpsError("invalid-argument", "חסר משתמש");
    await auth.deleteUser(uid).catch(() => {});
    await db.collection("users").doc(uid).delete().catch(() => {});
    return { ok: true };
  }

  throw new HttpsError("invalid-argument", "פעולה לא מוכרת");
});

// deploy trigger

/* ═══════════════════════════════════════════════════════════════════
   SETUP REMINDERS — a short list of things that were left open while the
   sign-in work was done. Each one is sent once, on its morning, and then
   marked so it never repeats. Delete this block when the list is done.
═══════════════════════════════════════════════════════════════════ */
const SETUP_REMINDERS = [
  {
    id: "2026-08-09-open-items",
    date: "2026-08-09",
    text: [
      "☀️ בוקר טוב — מה שנשאר פתוח:",
      "",
      "1️⃣ טלגרם לאיברהים — שיפתח שיחה עם הבוט וישלח /start, ואז בהגדרות טלגרם: רענן צ׳אטים → שייך לשורה שלו → בדיקה → שמור",
      "2️⃣ יומן גוגל — להפעיל Calendar API, לשתף את היומן עם anak-soharim@appspot.gserviceaccount.com בהרשאת עריכה, ואז לפתוח פעם אחת:",
      "https://europe-west1-anak-soharim.cloudfunctions.net/startCalendarSync",
      "3️⃣ לוודא שכל הנהגים התחברו עם הטלפון והסיסמה ורואים את המסך הנכון",
      "",
      "כשתסיים — תגיד לקלוד ונמשיך.",
    ].join("\n"),
  },
  {
    id: "2026-08-10-rules",
    date: "2026-08-10",
    text: [
      "🔒 תזכורת — הידוק ההרשאות במסד",
      "",
      "אם כולם התחברו ועבדו יום שלם בלי תקלה, זה הזמן:",
      "• להעתיק את firestore.rules.new אל firestore.rules ולפרוס",
      "• מרגע זה איברהים נוגע רק בנתוני הפחחות, ומסך הסיסמאות נגיש רק לך",
      "",
      "עוד שני דברים שנשארו פתוחים:",
      "• כפתור 'אפס פתקים' עדיין מוחק לתמיד בלחיצה אחת",
      "• גיבוי הטלגרם מכסה רק פתקים שהסתיימו",
    ].join("\n"),
  },
];

exports.setupReminders = onSchedule(
  { schedule: "0 8 * * *", timeZone: "Asia/Jerusalem", region: "europe-west1" },
  async () => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const due = SETUP_REMINDERS.filter((r) => r.date <= today);
    if (!due.length) return;

    const cfg = await db.collection("config").doc("driver_contacts").get();
    const contacts = cfg.exists ? cfg.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    const chatId = contacts["ליאל"]?.telegramId || "";
    if (!token || !chatId) return console.warn("setupReminders: telegram not configured");

    const sentSnap = await db.collection("config").doc("setup_reminders").get();
    const sent = sentSnap.exists ? (sentSnap.data().sent || []) : [];

    for (const r of due) {
      if (sent.includes(r.id)) continue;
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: r.text, disable_web_page_preview: true }),
        });
        sent.push(r.id);
      } catch (e) { console.error("setupReminders send", r.id, e.message); }
    }
    await db.collection("config").doc("setup_reminders").set({ sent }, { merge: true });
  }
);

/* ── בדיקת בעלויות ───────────────────────────────────────────────────
   הבדיקה בפועל — האם הרכב רשום על הח.פ/ת.ז של החברה — נעשית מול אתר
   התשלומים של משרד התחבורה, שמוגן ב-reCAPTCHA ולכן לא ניתן לאוטומציה.
   כאן רק נטענת רשימת המלאי המלאה, והמסך מנהל את הבדיקה הידנית כצ'קליסט
   עם שמירת התוצאות.
─────────────────────────────────────────────────────────────────────── */

const _VEHICLE_RESOURCE = "053cea08-09bc-40ec-8f7a-156f0677aff3";

/* מתי המרשם עצמו התעדכן לאחרונה. הפרסום נעשה פעם ביום בשעות הלילה,
   ולכן אין טעם לסרוק שוב לפני שהוא התחלף — הבדיקה הזאת היא בקשה אחת
   קטנה, והיא זו שקובעת אם להריץ סריקה מלאה. */
async function _registryLastModified() {
  try {
    const r = await (await _govFetch(`https://data.gov.il/api/3/action/resource_show?id=${_VEHICLE_RESOURCE}`)).json();
    const d = r?.result || {};
    return String(d.last_modified || d.metadata_modified || "");
  } catch (err) { return ""; }
}

// סוג הבעלות (baalut) של קבוצת לוחיות מהמאגר הפתוח. הפונקציה רצה בענן,
// שם data.gov.il נגיש (בניגוד לדפדפן). מחזיר { plate: "פרטי"|"חברה"|... }.
// data.gov.il חוסם בקשות בלי דפדפן מזוהה — כל הפניות למאגר עוברות דרך כאן
const _GOV_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
  "Referer": "https://data.gov.il/",
};
let _govLast = { status: 0, body: "" };
// המאגר הממשלתי חוסם פניות מחוץ לישראל, והפונקציות שלנו רצות בבלגיה.
// לכן יש ממסר בשרת של גוגל בתל אביב (me-west1) — משם הפנייה יוצאת
// מכתובת ישראלית ועוברת. קודם מנסים ישירות, ואם נחסם — דרך הממסר.
const _GOV_RELAY = "https://me-west1-anak-soharim.cloudfunctions.net/govRelay";
// פנייה עם מגבלת זמן — חיבור שנתקע לא מבזבז את כל זמן הבקשה
async function _fetchTimeout(url, opts, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 15000);
  try { return await fetch(url, { ...(opts || {}), signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

async function _govFetch(url) {
  let res = null, thrown = null;
  /* תשובה שנרשמת ביומן נקראת מעותק (clone) — קריאה מהגוף עצמו הייתה
     משאירה תשובה "מרוקנת", ומי שקיבל אותה נפל על
     "Body has already been read". */
  const peek = async (r) => { try { return (await r.clone().text()).slice(0, 200); } catch (e) { return ""; } };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await _fetchTimeout(url, { headers: _GOV_HEADERS });
      if (res.ok) { _govLast = { status: res.status, body: "" }; return res; }
      _govLast = { status: res.status, body: await peek(res) };
      if (res.status !== 403 && res.status < 500) break;
    } catch (err) {
      /* הפנייה הישירה נפלה ברמת הרשת — ממשיכים לממסר הישראלי */
      thrown = err;
      _govLast = { status: 0, body: String(err && err.message || err).slice(0, 200) };
    }
    if (attempt < 1) await _sleep2(1500);
  }
  // נחסמנו — מנסים דרך הממסר הישראלי
  try {
    const relayed = await _fetchTimeout(`${_GOV_RELAY}?url=${encodeURIComponent(url)}`, null, 30000);
    if (relayed.ok) { _govLast = { status: relayed.status, body: "", via: "relay" }; return relayed; }
    _govLast = { status: relayed.status, body: await peek(relayed), via: "relay" };
    if (res) return res;
    return relayed;
  } catch (err) { /* הממסר לא זמין */ }
  if (res) return res;
  throw thrown || new Error("gov fetch failed");
}

// הממסר עצמו: רץ בתל אביב ומעביר הלאה רק כתובות של data.gov.il
exports.govRelay = onRequest(
  { region: "me-west1", timeoutSeconds: 120, memory: "256MiB" },
  async (req, res) => {
    const url = String(req.query.url || "");
    if (!url.startsWith("https://data.gov.il/")) return res.status(400).send("bad url");
    try {
      const r = await fetch(url, { headers: _GOV_HEADERS });
      const body = await r.text();
      res.status(r.status).set("Content-Type", r.headers.get("content-type") || "application/json").send(body);
    } catch (err) { res.status(502).json({ error: err.message }); }
  }
);

/* נקודת אבחון: בודקת כל חוליה בשרשרת בנפרד — פנייה ישירה מבלגיה,
   הממסר בתל אביב, והמסלול המלא — ומחזירה מה בדיוק קרה בכל אחת.
   כך תקלה במשיכת נתונים מאובחנת מראיות ולא מניחושים. */
exports.govProbe = onRequest(
  { cors: true, region: "europe-west1", timeoutSeconds: 120 },
  async (req, res) => {
    const RES = "053cea08-09bc-40ec-8f7a-156f0677aff3";   // מרשם הרכב
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${RES}&limit=1`;
    const out = { at: new Date().toISOString(), region: "europe-west1" };
    const step = async (name, fn) => {
      const t0 = Date.now();
      try {
        const r = await fn();
        const body = await r.text();
        let records = null;
        try { records = JSON.parse(body)?.result?.records?.length ?? null; } catch (e) {}
        out[name] = { status: r.status, ms: Date.now() - t0, records, head: body.slice(0, 160) };
      } catch (err) {
        out[name] = { error: String(err && err.message || err), ms: Date.now() - t0 };
      }
    };
    await step("direct", () => _fetchTimeout(url, { headers: _GOV_HEADERS }, 20000));
    await step("relay", () => _fetchTimeout(`${_GOV_RELAY}?url=${encodeURIComponent(url)}`, null, 30000));
    await step("full_chain", () => _govFetch(url));
    out.govLast = _govLast;
    res.json(out);
  }
);

async function _ownRegistryBaalut(plates) {
  const out = {};
  const BATCH = 40;
  for (let i = 0; i < plates.length; i += BATCH) {
    const chunk = plates.slice(i, i + BATCH);
    let recs = [];
    // קודם כמספרים, ואם המאגר שומר לוחיות כטקסט — שוב כמחרוזות
    for (const vals of [chunk.map(Number), chunk.map(String)]) {
      const filters = encodeURIComponent(JSON.stringify({ mispar_rechev: vals }));
      const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${_VEHICLE_RESOURCE}&filters=${filters}&limit=${chunk.length}`;
      try {
        const res = await _govFetch(url);
        if (!res.ok) continue;
        const json = await res.json().catch(() => null);
        recs = json?.result?.records || [];
        if (recs.length) break;
      } catch (err) { /* try next form */ }
    }
    for (const r of recs) {
      const p = String(r.mispar_rechev).replace(/\D/g, "");
      out[p] = String(r.baalut || "").trim();
    }
    /* מטמון המרשם: המרשם הממשלתי מתרוקן מדי פעם בעדכוני הלילה שלו, ואז
       שום משיכת פרטי רכב לא עובדת. הרשומות כבר בידינו כאן — שמירה שלהן
       מאפשרת לטפסים למלא פרטים גם כשהמרשם ריק. */
    try {
      await Promise.all(recs.map((r) => {
        const p = String(r.mispar_rechev).replace(/\D/g, "");
        if (!p) return null;
        const slim = {};
        for (const k of ["mispar_rechev", "tozeret_nm", "kinuy_mishari", "degem_nm", "ramat_gimur",
                         "tzeva_rechev", "shnat_yitzur", "tokef_dt", "baalut", "misgeret", "degem_cd", "tozeret_cd"]) {
          if (r[k] !== undefined && r[k] !== null) slim[k] = r[k];
        }
        return db.collection("plate_cache").doc(p).set({ rec: slim, at: new Date() }, { merge: true });
      }));
    } catch (err) { console.warn("plate_cache write failed", err.message); }
    // אבחון חד-פעמי: רושם אילו שדות בכלל קיימים במאגר, כדי לדעת אם יש
    // שדה של תאריך העברה / מספר בעלים שיאפשר לזהות כל העברת בעלות.
    if (i === 0 && recs[0]) {
      db.collection("ownership_status").doc("registry_fields").set({
        at: new Date(),
        fields: Object.keys(recs[0]).filter((k) => !k.startsWith("_")),
        sample: JSON.stringify(recs[0]).slice(0, 2000),
      }).catch(() => {});
    }
    await _sleep2(300);
  }
  return out;
}

// מושכת את המלאי הנוכחי, קוראת את סוג הבעלות של כל רכב מהמאגר הפתוח,
// ומצליבה מול רשימת הבעלויות השמורה. לכל רכב נקבע status: 'ours' /
// 'not' (עדיין פרטי או רשום על מישהו אחר) / 'unknown'. סימון ידני גובר.
async function _runOwnershipScan() {
  let vehicles;
  try {
    vehicles = await _filterScannable(await _fetchInventory());
  } catch (err) {
    return { ok: false, reason: "inventory-fetch-failed" };
  }
  if (!vehicles.length) return { ok: false, reason: "empty-inventory" };

  let owners = {}, ourIds = [];
  try {
    const cfg = await db.collection("config").doc("ownership").get();
    if (cfg.exists) {
      owners = cfg.data().owners || {};
      ourIds = (cfg.data().ourIds || []).map((s) => String(s).replace(/\D/g, ""));
    }
  } catch (err) { /* בלי רשימה — הכל לפי המאגר */ }

  const plates = vehicles.map((v) => v.plate);
  // סוג הבעלות מהמאגר הפתוח — האות האוטומטי שמתעדכן אחרי העברת בעלות
  const baalutByPlate = await _ownRegistryBaalut(plates);

  const cars = vehicles.map((v) => {
    const plate = v.plate;
    const ownerId = String(owners[plate] || "").replace(/\D/g, "");
    const baalut = baalutByPlate[plate] || "";
    // רכב "פרטי" = עדיין רשום על אדם פרטי, כלומר העברת הבעלות לחברה
    // עוד לא בוצעה. זה מה שהסריקה מחפשת.
    // רכב שעומד במגרש אמור להיות רשום על תו סחר — כלומר "סוחר" במרשם.
    // כל ערך אחר (פרטי / חברה / ליסינג / השכרה) אומר שהוא כבר לא אצלנו.
    const onTradePlate = baalut.includes("סוחר");
    let status;
    // התוצאה נקבעת רק לפי סוג הבעלות במרשם. הסימונים הידניים ורשימת
    // הח.פ/ת.ז של השיטה הישנה כבר לא משפיעים.
    if (!baalut) status = "unknown";                                                 // לא נמצא במאגר
    else status = onTradePlate ? "ours" : "not";                                     // לפי סוג הבעלות
    return {
      plate, tozeret: v.tozeret, degem: v.degem, shnat: v.shnat,
      ownerId: ownerId || null, baalut: baalut || null, status,
    };
  });
  if (!cars.length) return { ok: false, reason: "no-valid-plates" };
  // אם אף רכב לא נמצא במרשם — אין גישה למאגר. לא דורסים את המצב הקודם
  // ולא שולחים התראות על סמך בדיקה שלא הצליחה.
  if (!cars.some((c) => c.baalut)) {
    return { ok: false, reason: "registry-unreachable", checked: cars.length, registryHttp: _govLast };
  }

  // רכבים חדשים = לוחיות שלא היו במלאי בסריקה הקודמת. כך הסריקה היומית
  // יודעת על מה להתריע — מה שנכנס היום וטרם נבדק.
  let prevSeen = [];
  const prevCars = {};
  let hadPrev = false;
  try {
    const prev = await db.collection("ownership_status").doc("current").get();
    if (prev.exists) {
      prevSeen = prev.data().seenPlates || [];
      for (const c of prev.data().cars || []) prevCars[c.plate] = c;
      hadPrev = Object.keys(prevCars).length > 0;
    }
  } catch (err) { /* ignore */ }
  const prevSet = new Set(prevSeen);

  const notOurs = cars.filter((c) => c.status === "not");
  const unknown = cars.filter((c) => c.status === "unknown");
  // חדשים וטרם נבדקו: נכנסו מאז הסריקה הקודמת ואין להם עדיין תשובה
  const newUnchecked = cars.filter((c) => c.status === "unknown" && !prevSet.has(c.plate));

  /* מה השתנה מאז הסריקה הקודמת. הסריקה השעתית מתריעה רק על אלה —
     בלי זה היא הייתה שולחת את אותה רשימה כל שעה. בסריקה הראשונה אין
     מול מה להשוות, ולכן היא נשמרת כבסיס בלי להתריע. */
  const changedToNot = hadPrev ? cars.filter((c) =>
    c.status === "not" && prevCars[c.plate] && prevCars[c.plate].status !== "not") : [];
  const changedToOurs = hadPrev ? cars.filter((c) =>
    c.status === "ours" && prevCars[c.plate] && prevCars[c.plate].status === "not") : [];
  // רכב שנכנס למלאי וכבר מגיע לא על תו סחר — גם זה שינוי שדורש טיפול
  const newAndNot = hadPrev ? cars.filter((c) =>
    c.status === "not" && !prevCars[c.plate]) : [];
  // שינוי בסוג הבעלות עצמו, גם כשהסטטוס לא השתנה (סוחר→סוחר אחר לא נראה,
  // אבל פרטי→חברה כן — וזה אומר שהרכב זז)
  const changedBaalut = hadPrev ? cars.filter((c) => {
    const p = prevCars[c.plate];
    return p && p.baalut && c.baalut && p.baalut !== c.baalut;
  }) : [];
  // רכב שהיה במלאי ואיננו — נמכר, נאסף או ירד מהרשימה. שווה לדעת.
  const nowSet = new Set(cars.map((c) => c.plate));
  const goneFromStock = hadPrev
    ? Object.values(prevCars).filter((c) => !nowSet.has(c.plate)) : [];
  /* רכב שירד מהמלאי — בדיקה אחרונה במרשם: האם הוא גם עבר בעלות, או
     שירד מהרשימה בלי שהבעלות זזה. זו התשובה לשאלה "למה הוא ירד". */
  if (goneFromStock.length) {
    try {
      const goneBaalut = await _ownRegistryBaalut(goneFromStock.map((c) => c.plate));
      for (const c of goneFromStock) {
        const nowB = (goneBaalut[c.plate] || "").trim();
        c.nowBaalut = nowB;
        c.movedOnExit = !!(nowB && c.baalut && nowB !== c.baalut);
      }
    } catch (err) { console.error("gone-from-stock baalut check failed", err); }
  }

  /* רגע זיהוי שינוי הבעלות. המרשם אינו מפרסם תאריך העברה, ולכן זה הזמן
     שבו הסריקה ראתה את השינוי — מדויק עד שעה, כי היא רצה כל שעה.
     רכב שלא השתנה שומר את התאריך שכבר נרשם לו. */
  const stamp = new Date().toISOString();
  for (const c of cars) {
    const p = prevCars[c.plate];
    const moved = p && p.baalut && c.baalut && p.baalut !== c.baalut;
    if (moved) { c.baalutFrom = p.baalut; c.baalutChangedAt = stamp; }
    else if (p) { if (p.baalutFrom) c.baalutFrom = p.baalutFrom; if (p.baalutChangedAt) c.baalutChangedAt = p.baalutChangedAt; }
  }

  /* יומן שינויי בעלות — כל שינוי נרשם פעם אחת ונשמר לתמיד, כדי שתהיה
     היסטוריה מלאה גם אחרי שההתראה בטלגרם נעלמה. האישור הידני ("מאושר
     על ידי") נכתב על אותה רשומה מתוך האפליקציה. */
  if (hadPrev) {
    const log = db.collection("ownership_log");
    const entry = (c, kind, from, to) => ({
      plate: c.plate, tozeret: c.tozeret || "", degem: c.degem || "", shnat: c.shnat || "",
      kind, from: from || "", to: to || "",
      at: new Date(), approvedBy: null, approvedAt: null, note: "",
    });
    const rows = [];
    const seenLog = new Set();
    for (const c of [...changedToNot, ...changedBaalut, ...changedToOurs]) {
      if (seenLog.has(c.plate)) continue;
      seenLog.add(c.plate);
      const from = prevCars[c.plate]?.baalut || "";
      rows.push(entry(c, c.status === "ours" ? "back" : "moved", from, c.baalut));
    }
    for (const c of newAndNot) if (!seenLog.has(c.plate)) { seenLog.add(c.plate); rows.push(entry(c, "new_not", "", c.baalut)); }
    // רכב שהוצא מהסריקה אינו "ירד מהמלאי" — לא רושמים עליו כלום
    const skipNow = await _loadSkipPlates();
    for (const c of goneFromStock) if (!seenLog.has(c.plate) && !skipNow.has(c.plate)) {
      seenLog.add(c.plate);
      const row = entry(c, "gone", c.baalut, c.movedOnExit ? c.nowBaalut : "");
      row.movedOnExit = !!c.movedOnExit;
      rows.push(row);
    }
    for (const row of rows) {
      try { await log.add(row); } catch (err) { console.error("ownership_log write failed", row.plate, err); }
    }
  }

  await db.collection("ownership_status").doc("current").set({
    cars, checkedCount: cars.length,
    notOursCount: notOurs.length, unknownCount: unknown.length,
    seenPlates: cars.map((c) => c.plate),
    updatedAt: new Date(),
  });
  return {
    ok: true, checked: cars.length, notOurs: notOurs.length, unknown: unknown.length,
    registryHttp: _govLast,
    notOursCars: notOurs, newUnchecked,
    changedToNot, changedToOurs, newAndNot, changedBaalut, goneFromStock,
    // הבעלות הקודמת של כל רכב שהשתנה — כדי לנסח "עבר מ… ל…"
    prevBaalut: Object.fromEntries(
      Object.values(prevCars).filter((c) => c.baalut).map((c) => [c.plate, c.baalut])),
  };
}

exports.runOwnershipScanNow = onRequest(
  { cors: true, region: "europe-west1", timeoutSeconds: 540, memory: "512MiB" },
  async (req, res) => {
    let out;
    try { out = await _runOwnershipScan(); }
    catch (err) { out = { ok: false, reason: "crashed", error: err.message }; }
    // גם בדיקה ידנית שנחסמה מפעילה את הניסיונות החוזרים
    if (out.reason === "registry-unreachable") await _setScanBlocked("own", true);
    else if (out.ok) await _setScanBlocked("own", false);
    res.status(out.ok ? 200 : 500).json(out);
  }
);

/* ── גשר לגוגל מפות ──────────────────────────────────────────────────
   כתובות, מרחקים וזמני הליכה מדויקים — ישירות מגוגל, אותם מספרים כמו
   באפליקציית גוגל מפות. המפתח נשמר ב-config/maps (שדה key) ולא נחשף
   לדפדפן: כל הקריאות עוברות דרך הפונקציה הזאת.
   op=ping    → האם יש מפתח מוגדר
   op=geocode → address+city → נקודה מאומתת בישראל
   op=route   → from=lat,lng & to=lat,lng → הליכה ונסיעה בקריאה אחת   */
async function _mapsKey() {
  try {
    const snap = await db.collection("config").doc("maps").get();
    return snap.exists ? String(snap.data().key || "").trim() : "";
  } catch (e) { return ""; }
}
exports.mapsProxy = onRequest(
  { cors: true, region: "europe-west1", timeoutSeconds: 30 },
  async (req, res) => {
    const key = await _mapsKey();
    const op = String(req.query.op || "");
    if (op === "ping") return res.json({ ok: true, hasKey: !!key });
    if (!key) return res.status(400).json({ ok: false, error: "no-key" });
    try {
      if (op === "geocode") {
        const address = String(req.query.address || "");
        const city = String(req.query.city || "");
        const q = [address, city].filter(Boolean).join(", ");
        const url = "https://maps.googleapis.com/maps/api/geocode/json?address=" +
          encodeURIComponent(q) + "&components=country:IL&language=he&key=" + key;
        const j = await (await fetch(url)).json();
        const r = (j.results || [])[0];
        if (!r) return res.json({ ok: true, found: false, status: j.status });
        // תוצאה ברמת עיר/מדינה אינה כתובת — שהלקוח ידע שזה משוער
        const kinds = r.types || [];
        const cityLevel = kinds.includes("locality") || kinds.includes("administrative_area_level_1") || kinds.includes("country");
        return res.json({
          ok: true, found: true, cityLevel,
          lat: r.geometry.location.lat, lng: r.geometry.location.lng,
          formatted: r.formatted_address,
        });
      }
      if (op === "route") {
        const from = String(req.query.from || ""), to = String(req.query.to || "");
        if (!/^[\d.,-]+$/.test(from) || !/^[\d.,-]+$/.test(to)) return res.status(400).json({ ok: false, error: "bad-coords" });
        const leg = async (mode) => {
          const url = "https://maps.googleapis.com/maps/api/directions/json?origin=" + from +
            "&destination=" + to + "&mode=" + mode + "&language=he&key=" + key;
          const j = await (await fetch(url)).json();
          const l = j.routes?.[0]?.legs?.[0];
          return l ? { km: l.distance.value / 1000, min: l.duration.value / 60 } : null;
        };
        const [walking, driving] = await Promise.all([leg("walking"), leg("driving")]);
        return res.json({ ok: true, walking, driving });
      }
      res.status(400).json({ ok: false, error: "bad-op" });
    } catch (err) {
      res.status(502).json({ ok: false, error: err.message });
    }
  }
);

// בדיקת מקור המלאי: כמה רכבים נמשכו ואיך נקראו השדות. משמשת לאימות
// מהיר אחרי החלפת מקור, בלי להריץ סריקה שלמה.
exports.inventoryCheck = onRequest(
  { cors: true, region: "europe-west1", timeoutSeconds: 120 },
  async (req, res) => {
    try {
      const cars = await _fetchInventory();
      res.json({ ok: true, url: _INVENTORY_URL, count: cars.length, sample: cars.slice(0, 5) });
    } catch (err) {
      res.status(500).json({ ok: false, url: _INVENTORY_URL, error: err.message });
    }
  }
);

// סריקה יומית: כל בוקר מרעננת את המלאי ומתריעה בטלגרם על שני דברים —
// רכבים שכבר סומנו כלא־שלנו, ורכבים חדשים שנכנסו וטרם נבדקו ידנית.
/* בדיקת בעלויות.
   המרשם הממשלתי מתפרסם מחדש פעם ביום בשעות הלילה, ולכן אין טעם לסרוק
   שוב ושוב על אותם נתונים. הפונקציה רצה כל שעה, אבל קודם בודקת בבקשה
   אחת קטנה אם המרשם התחלף — ורק אז מריצה סריקה מלאה. כך ההתראה על
   העברת בעלות מגיעה תוך שעה מרגע שהמידע מתפרסם, בלי עבודה מיותרת.
   התראה על רכב שירד מהמלאי אינה דחופה, ולכן היא נצברת ונשלחת פעם ביום
   בסיכום של 08:07. (השם נשאר dailyOwnershipCheck כדי לא ליצור עבודה
   מתוזמנת כפולה.) */
const _OWN_DIGEST_HOUR = 8;
exports.dailyOwnershipCheck = onSchedule(
  { schedule: "7 * * * *", region: "europe-west1", timeZone: "Asia/Jerusalem", timeoutSeconds: 300, memory: "256MiB" },
  async () => {
    const metaRef = db.collection("ownership_status").doc("meta");
    let meta = {};
    try { const m = await metaRef.get(); if (m.exists) meta = m.data() || {}; } catch (err) { /* ignore */ }

    const modified = await _registryLastModified();
    const hour = Number(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem", hour: "2-digit", hour12: false }).format(new Date()));
    const isDigest = hour === _OWN_DIGEST_HOUR;
    // המרשם לא התחלף ואין סיכום יומי — אין מה לעשות
    if (!isDigest && modified && meta.registryModified === modified) return;

    const r = await _runOwnershipScan().catch((e) => ({ ok: false, reason: "crashed", error: String(e && e.message || e) }));
    if (!r.ok) {
      if (r.reason === "registry-unreachable") await _setScanBlocked("own", true);
      return;
    }
    await _setScanBlocked("own", false);

    const toNot   = r.changedToNot   || [];
    const toOurs  = r.changedToOurs  || [];
    const newNot  = r.newAndNot      || [];
    const newUnk  = r.newUnchecked   || [];
    /* "ירד מתו סחר" ו"שינה סוג בעלות" הם אותו דבר מבחינת המנהל — הרכב
       עבר בעלות. מאחדים לרשימה אחת, בלי כפילויות. */
    const moved = [...toNot];
    for (const c of (r.changedBaalut || [])) {
      if (!moved.some((x) => x.plate === c.plate) && !toOurs.some((x) => x.plate === c.plate)) moved.push(c);
    }

    // רכבים שירדו מהמלאי נצברים לסיכום היומי במקום להתריע מיד
    const pendingGone = [...(meta.pendingGone || []), ...(r.goneFromStock || []).map((c) => ({
      plate: c.plate, tozeret: c.tozeret || "", degem: c.degem || "",
      baalut: c.baalut || "", nowBaalut: c.nowBaalut || "", movedOnExit: !!c.movedOnExit,
    }))];
    const gone = isDigest ? pendingGone : [];

    const nothing = !moved.length && !toOurs.length && !newNot.length && !newUnk.length && !gone.length;
    if (nothing) {
      await metaRef.set({ registryModified: modified || meta.registryModified || "", pendingGone, at: new Date() }, { merge: true });
      return;
    }

    try {
      const cs = await db.collection("config").doc("driver_contacts").get();
      const contacts = cs.exists ? cs.data() : {};
      const token = contacts["_telegramToken"]?.value || "";
      const chatId = contacts["ליאל"]?.telegramId || "";
      if (!token || !chatId) return;

      // ניסוח הבעלות במילים, כדי שההודעה תיקרא כמו משפט ולא כמו קוד
      const phrase = (b) => ({
        "סוחר": "תו סחר", "פרטי": "אדם פרטי", "חברה": "חברה",
        "ליסינג": "ליסינג", "השכרה": "השכרה",
      }[String(b || "").trim()] || b || "לא ידוע");
      // תאריך ושעה שבהם הסריקה זיהתה את המעבר
      const when = (c) => {
        if (!c.baalutChangedAt) return "";
        const d = new Date(c.baalutChangedAt);
        if (isNaN(d)) return "";
        return "\n   🕒 זוהה ב-" + d.toLocaleString("he-IL", {
          timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit",
          year: "numeric", hour: "2-digit", minute: "2-digit",
        });
      };
      // "עבר מ… ל…" — הבעלות הקודמת מול הנוכחית, עם מועד הזיהוי
      const movedTxt = (c) => {
        const from = r.prevBaalut?.[c.plate] || c.baalutFrom;
        const head = from && c.baalut && from !== c.baalut
          ? ` — עבר מבעלות ${phrase(from)} לבעלות ${phrase(c.baalut)}`
          : (c.baalut ? ` — רשום על ${phrase(c.baalut)}` : "");
        return head + when(c);
      };
      const line = (c, extra) => `• ${c.plate} ${[c.tozeret, c.degem].filter(Boolean).join(" ")}${extra || ""}`.trim();
      const block = (title, cars, extraFn) => {
        const shown = cars.slice(0, 15).map((c) => line(c, extraFn ? extraFn(c) : "")).join("\n");
        return `${title}\n${shown}${cars.length > 15 ? `\n…ועוד ${cars.length - 15}` : ""}`;
      };
      const parts = [];
      if (moved.length)  parts.push(block(`🚨 ${moved.length} רכבים עברו בעלות:`, moved, movedTxt));
      if (newNot.length) parts.push(block(`⚠️ ${newNot.length} רכבים חדשים במלאי שאינם על תו סחר:`, newNot, (c) => c.baalut ? ` — רשום על ${phrase(c.baalut)}` : ""));
      if (gone.length)   parts.push(block(`📤 ${gone.length} רכבים ירדו מהמלאי (סיכום יומי):`, gone, (c) =>
        c.movedOnExit
          ? ` — עבר מבעלות ${phrase(c.baalut)} לבעלות ${phrase(c.nowBaalut)}`
          : (c.baalut ? ` — הבעלות לא השתנתה (${phrase(c.baalut)})` : "")));
      if (newUnk.length) parts.push(block(`🆕 ${newUnk.length} רכבים חדשים שטרם נבדקה בעלותם:`, newUnk));
      if (toOurs.length) parts.push(block(`✅ ${toOurs.length} רכבים חזרו לתו סחר:`, toOurs, movedTxt));

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `בדיקת בעלויות — שינוי מהסריקה הקודמת\n\n${parts.join("\n\n")}\n\nכנס לאפליקציה → בדיקת בעלויות.`,
        }),
      });
    } catch (err) { console.error("ownership alert failed", err); }

    // הרשימה הצבורה מתאפסת רק אחרי שהסיכום היומי נשלח
    await metaRef.set({
      registryModified: modified || meta.registryModified || "",
      pendingGone: isDigest ? [] : pendingGone,
      at: new Date(),
    }, { merge: true });
  }
);

/* ── גיבוי שבועי ─────────────────────────────────────────────────────
   כל שישי לפנות בוקר, ה-Functions מפעילות את יצוא הגיבוי המנוהל של
   Firestore (המנגנון הרשמי שגוגל ממליצה עליו לגיבוי) לתוך Cloud
   Storage. זו הביטוח נגד מחיקה בטעות — עד עכשיו לא היה עותק שני של
   הנתונים בשום מקום.
   גיבויים בני יותר משמונה שבועות נמחקים אוטומטית כדי שהאחסון לא יתפח
   בלי גבול. הצלחה וכישלון כאחד מדווחים בטלגרם למנהל, כדי שגיבוי לא
   יפסיק לרוץ בלי ששמים לב.
─────────────────────────────────────────────────────────────────────── */
const BACKUP_PROJECT = "anak-soharim";
const BACKUP_DATABASE = "default";
const BACKUP_PREFIX = "firestore-backups";
const BACKUP_KEEP_DAYS = 56;   // שמונה שבועות

// Firestore מייצא רק לדלי שנמצא באותו אזור כמו מסד הנתונים. המסד כאן
// יושב ב-me-west1 (ישראל), בעוד דלי ברירת המחדל של Firebase נוצר
// ב-europe-west1 — ולכן נדרש דלי ייעודי לגיבוי, באזור הנכון.
const BACKUP_DB_LOCATION = "me-west1";
const BACKUP_BUCKET_DEFAULT = `${BACKUP_PROJECT}-backups`;

// אפשר לעקוף את שם הדלי דרך config/backup בלי פריסה מחדש
async function _backupBucketName() {
  try {
    const snap = await db.collection("config").doc("backup").get();
    const name = snap.exists ? (snap.data().bucket || "") : "";
    if (name) return String(name).trim();
  } catch (err) { /* נופלים לברירת המחדל */ }
  return BACKUP_BUCKET_DEFAULT;
}

// מוודא שהדלי קיים ושהוא באזור הנכון, כדי ששתי התקלות האלה לא ייראו
// כמו שגיאת הרשאה סתומה
async function _assertBucket(name) {
  const bucket = getStorage().bucket(name);
  const [exists] = await bucket.exists();
  if (!exists) {
    throw new Error(
      `דלי הגיבוי ${name} לא קיים. יש ליצור אותו פעם אחת ב-Cloud Storage ` +
      `בשם המדויק "${name}" ובאזור ${BACKUP_DB_LOCATION}, ואז להריץ שוב.`);
  }
  try {
    const [meta] = await bucket.getMetadata();
    const loc = String(meta.location || "").toLowerCase();
    if (loc && loc !== BACKUP_DB_LOCATION) {
      throw new Error(
        `דלי הגיבוי ${name} נמצא באזור ${loc}, אבל מסד הנתונים דורש ${BACKUP_DB_LOCATION}. ` +
        `אי אפשר לשנות אזור של דלי קיים — צריך ליצור דלי חדש באזור ${BACKUP_DB_LOCATION}.`);
    }
  } catch (err) {
    if (err.message && err.message.includes("אזור")) throw err;
    // כשל בקריאת המטא-דאטה אינו סיבה לעצור — הייצוא עצמו יאמת ממילא
  }
}

async function _runFirestoreBackup() {
  const dateTag = new Date().toISOString().slice(0, 10);   // YYYY-MM-DD
  const bucketName = await _backupBucketName();
  await _assertBucket(bucketName);
  const outputUriPrefix = `gs://${bucketName}/${BACKUP_PREFIX}/${dateTag}`;
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const url = `https://firestore.googleapis.com/v1/projects/${BACKUP_PROJECT}/databases/${BACKUP_DATABASE}:exportDocuments`;
  // ללא collectionIds = מייצא את כל ה-collections, כל אחד מהם
  await client.request({ url, method: "POST", data: { outputUriPrefix } });
  return { outputUriPrefix, bucketName };
}

// מוחק תיקיות גיבוי ישנות משמונה שבועות
async function _cleanOldBackups() {
  const bucket = getStorage().bucket(await _backupBucketName());
  const [files] = await bucket.getFiles({ prefix: `${BACKUP_PREFIX}/` });
  const cutoff = Date.now() - BACKUP_KEEP_DAYS * 86400000;
  const dateRe = new RegExp(`^${BACKUP_PREFIX}/(\\d{4}-\\d{2}-\\d{2})/`);
  let deleted = 0;
  for (const f of files) {
    const m = f.name.match(dateRe);
    if (!m) continue;
    const d = new Date(m[1]);
    if (isNaN(d) || d.getTime() >= cutoff) continue;
    try { await f.delete(); deleted++; } catch (err) { console.error("backup cleanup: delete failed for", f.name, err); }
  }
  return deleted;
}

// השירות שרץ תחתיו הגיבוי — כדי שהודעת כישלון תגיד בדיוק למי לתת הרשאה
async function _backupRuntimeAccount() {
  try {
    const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/datastore"] });
    const c = await auth.getCredentials();
    return c.client_email || "";
  } catch (err) { return ""; }
}

async function _backupTelegram(text) {
  try {
    const cs = await db.collection("config").doc("driver_contacts").get();
    const contacts = cs.exists ? cs.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    const chatId = contacts["ליאל"]?.telegramId || "";
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) { console.error("backup telegram ping failed", err); }
}

async function _weeklyBackupRun() {
  let result;
  try {
    result = await _runFirestoreBackup();
  } catch (err) {
    console.error("weekly backup failed", err);
    const who = await _backupRuntimeAccount();
    await _backupTelegram(
      `❌ הגיבוי השבועי נכשל.\nסיבה: ${err.message || err}` +
      (who ? `\n\nכנראה חסרה הרשאה. יש לתת ל-${who} את התפקידים "Cloud Datastore Import Export Admin" ו-"Storage Admin" ב-IAM של הפרויקט anak-soharim.` : ""),
    );
    return { ok: false, error: err.message || String(err) };
  }
  let deleted = 0;
  try { deleted = await _cleanOldBackups(); } catch (err) { console.error("backup cleanup failed", err); }
  await _backupTelegram(
    `✅ הגיבוי השבועי בוצע בהצלחה.\n${result.outputUriPrefix}` +
    (deleted ? `\n🧹 נמחקו ${deleted} קבצים ישנים מ-8 שבועות` : ""),
  );
  return { ok: true, ...result, deleted };
}

/* ── ניסיונות חוזרים אחרי חסימה של מרשם הרכב ─────────────────────────
   כשמשרד התחבורה חוסם, הסריקה נכשלת ונשמר סימון "חסום". מכאן ואילך
   מנסים שוב כל חמש דקות בשקט — בלי הודעות כישלון — ורק כשהבדיקה
   עוברת נשלחת הודעה אחת בטלגרם, והסימון מתבטל.                      */
const _SCAN_RETRY_DOC = () => db.collection("scan_status").doc("retry");

async function _setScanBlocked(kind, blocked) {
  try {
    await _SCAN_RETRY_DOC().set({ [kind]: !!blocked, at: new Date() }, { merge: true });
  } catch (err) { console.error("scan retry flag write failed", err); }
}

async function _notifyManager(text) {
  try {
    const cs = await db.collection("config").doc("driver_contacts").get();
    const contacts = cs.exists ? cs.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    const chatId = contacts["ליאל"]?.telegramId || "";
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) { console.error("manager notify failed", err); }
}


// ── תזכורת ראש חודש ────────────────────────────────────────────────
// כל בוקר ב-00:05 בודקים אם היום ראש חודש עברי (יום אחד או שניים),
// ואם כן יוצרים אירוע ביומן לשעה 06:00 שמזכיר את זה למנהל בטלגרם —
// דרך אותו מנגנון checkReminders שכבר קיים לכל אירועי היומן.
function _hebDay(d) {
  const f = new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric" });
  return +f.formatToParts(d).find((p) => p.type === "day").value;
}
function _hebMonthName(d) {
  return new Intl.DateTimeFormat("he-u-ca-hebrew", { month: "long" }).format(d);
}
function _isRoshChodesh(d) {
  const day = _hebDay(d);
  if (day === 1) return true;
  if (day === 30) return _hebDay(new Date(d.getTime() + 86400000)) === 1;
  return false;
}

exports.roshChodeshReminder = onSchedule(
  { schedule: "5 0 * * *", region: "europe-west1", timeZone: "Asia/Jerusalem" },
  async () => {
    const now = nowIsraelAsUtcPretend();
    if (!_isRoshChodesh(now)) return;
    // שם החודש: אם זה היום השני של ר"ח דו-יומי, השם כבר מתאים; אם זה היום
    // הראשון מתוך שניים, השם הנכון הוא של המחר
    const monthDate = _hebDay(now) === 30 ? new Date(now.getTime() + 86400000) : now;
    const monthName = _hebMonthName(monthDate);
    const dateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    // מונעים כפילות אם הפונקציה רצה פעמיים באותו יום
    const existing = await db.collection("calendar_events")
      .where("date", "==", dateStr).where("autoRoshChodesh", "==", true).limit(1).get();
    if (!existing.empty) return;

    await db.collection("calendar_events").add({
      title: `🌙 ראש חודש ${monthName}`,
      date: dateStr, startTime: "06:00", endTime: "", notes: "",
      repeat: "none", reminderMinutes: 0, reminderTo: ["ליאל"], reminderSent: false,
      autoRoshChodesh: true, createdAt: new Date(),
    });
  }
);

exports.retryBlockedScans = onSchedule(
  { schedule: "*/5 * * * *", region: "europe-west1", timeZone: "Asia/Jerusalem", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    let state = {};
    try { const d = await _SCAN_RETRY_DOC().get(); if (d.exists) state = d.data() || {}; } catch (err) { /* ignore */ }

    // הריקול: הסימון נלמד מהריצה האחרונה שנשמרה ממילא
    let recallBlocked = false;
    try {
      const lr = await db.collection("recall_status").doc("lastRun").get();
      const d = lr.exists ? lr.data() : null;
      recallBlocked = !!d && d.ok === false &&
        ["unreliable", "registry-unreachable"].includes(d.reason);
    } catch (err) { /* ignore */ }

    // אם סריקה כבר רצה (ידנית או מהניסיון הקודם) — לא מפעילים עוד אחת
    let running = false;
    try {
      const pr = await db.collection("recall_status").doc("progress").get();
      running = !!(pr.exists && pr.data().running);
    } catch (err) { /* ignore */ }

    if (recallBlocked && !running) {
      const r = await _runRecallScan("retry", true);
      if (r.ok) await _notifyManager("✅ בדיקת הריקול עברה בהצלחה — משרד התחבורה חזר להגיב.");
    }

    if (state.own) {
      const r = await _runOwnershipScan().catch(() => ({ ok: false }));
      if (r.ok) {
        await _setScanBlocked("own", false);
        await _notifyManager("✅ בדיקת הבעלויות עברה בהצלחה — משרד התחבורה חזר להגיב.");
      }
    }
  }
);

exports.weeklyFirestoreBackup = onSchedule(
  { schedule: "0 3 * * 5", region: "europe-west1", timeZone: "Asia/Jerusalem", timeoutSeconds: 300, memory: "256MiB" },
  async () => { await _weeklyBackupRun(); },
);

// הרצה ידנית — לבדיקה מיידית בלי לחכות ליום שישי, באותו דפוס בדיוק כמו
// runRecallScanNow / runOwnershipScanNow.
// השם backupNow ולא runBackupNow: הניסיון הראשון להקים את runBackupNow
// יצר שירות Cloud Run יתום בלי רשומת פונקציה, וכל פריסה מאז נכשלה על
// 409 "service already exists". שם חדש עוקף את היתום.
exports.backupNow = onRequest(
  { cors: true, region: "europe-west1", timeoutSeconds: 300, memory: "256MiB" },
  async (req, res) => {
    const out = await _weeklyBackupRun();
    res.status(out.ok ? 200 : 500).json(out);
  },
);

// ════════════════════════════════════════════════════════════════════════
// משחקי ברצלונה ביומן
// המקור: football-data.org — מחזיר את כל המשחקים הקבועים של הקבוצה
// (ליגה, גביע ואירופה) עם שעת פתיחה מעודכנת ב-UTC. הסנכרון רץ כל שלושה
// ימים, ולכן שינויי מועד ושעה נקלטים מעצמם.
// המפתח נשמר ב-config/barca (שדה token) דרך מסך ההגדרות באפליקציה.
// ════════════════════════════════════════════════════════════════════════
const _BARCA_TEAM_ID = 81;   // FC Barcelona
const _BARCA_ALERT_MIN = 10 * 60;      // התראה ביום המשחק בשעה 10:00
const _BARCA_ALERT_TO = ["ליאל"];

// שמות הקבוצות בעברית. מה שלא ברשימה מוצג בשם המקורי.
const _BARCA_TEAMS = {
  "FC Barcelona": "ברצלונה", "Real Madrid CF": "ריאל מדריד",
  "Club Atlético de Madrid": "אתלטיקו מדריד", "Athletic Club": "אתלטיק בילבאו",
  "Real Sociedad de Fútbol": "ריאל סוסיאדד", "Villarreal CF": "ויאריאל",
  "Real Betis Balompié": "בטיס", "Sevilla FC": "סביליה",
  "Valencia CF": "ולנסיה", "RC Celta de Vigo": "סלטה ויגו",
  "RCD Espanyol de Barcelona": "אספניול", "Rayo Vallecano de Madrid": "ראיו ויאקאנו",
  "CA Osasuna": "אוססונה", "Getafe CF": "חטאפה", "Girona FC": "ג'ירונה",
  "RCD Mallorca": "מיורקה", "Deportivo Alavés": "אלאבס", "Elche CF": "אלצ'ה",
  "Levante UD": "לבאנטה", "Real Oviedo": "אוביידו", "Real Valladolid CF": "ויאדוליד",
  "UD Las Palmas": "לאס פלמאס", "Real Racing Club": "רסינג סנטנדר",
  "Málaga CF": "מלאגה", "Cádiz CF": "קאדיס", "UD Almería": "אלמריה",
  "Granada CF": "גרנדה", "SD Eibar": "אייבר", "Sporting de Gijón": "חיחון",
  "Manchester City FC": "מנצ'סטר סיטי", "Liverpool FC": "ליברפול",
  "Arsenal FC": "ארסנל", "Chelsea FC": "צ'לסי", "Manchester United FC": "מנצ'סטר יונייטד",
  "Tottenham Hotspur FC": "טוטנהאם", "Newcastle United FC": "ניוקאסל",
  "FC Bayern München": "באיירן מינכן", "Borussia Dortmund": "בורוסיה דורטמונד",
  "Bayer 04 Leverkusen": "באייר לברקוזן", "RB Leipzig": "לייפציג",
  "Paris Saint-Germain FC": "פ.ס.ז'.", "Olympique de Marseille": "מארסיי",
  "Olympique Lyonnais": "ליון", "AS Monaco FC": "מונאקו",
  "FC Internazionale Milano": "אינטר", "AC Milan": "מילאן",
  "Juventus FC": "יובנטוס", "SSC Napoli": "נאפולי", "AS Roma": "רומא",
  "Atalanta BC": "אטלנטה", "SL Benfica": "בנפיקה", "FC Porto": "פורטו",
  "Sporting Clube de Portugal": "ספורטינג ליסבון", "AFC Ajax": "אייאקס",
  "PSV": "פ.ס.וו. איינדהובן", "Club Brugge KV": "קלאב ברוז'",
};
// שמות המפעלים בעברית
const _BARCA_COMPS = {
  "Primera Division": "ליגה ספרדית", "La Liga": "ליגה ספרדית",
  "Copa del Rey": "גביע המלך", "Supercopa de España": "סופרקאפ ספרד",
  "UEFA Champions League": "ליגת האלופות", "Club Friendlies": "ידידות",
  "FIFA Club World Cup": "מונדיאל המועדונים",
};
const _barcaName = (t) =>
  (t && (_BARCA_TEAMS[t.name] || _BARCA_TEAMS[t.shortName] || t.shortName || t.name)) || "";

// ממיר חותמת UTC לתאריך ולשעה בשעון ישראל — בדיוק בפורמט שהיומן שומר
function _barcaLocal(utcISO) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(utcISO));
  const g = (t) => parts.find((p) => p.type === t).value;
  const hh = g("hour") === "24" ? "00" : g("hour");
  return { date: `${g("year")}-${g("month")}-${g("day")}`, startTime: `${hh}:${g("minute")}` };
}

async function _barcaSync() {
  const cfgSnap = await db.doc("config/barca").get();
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const token = (cfg.token || "").trim();
  if (!token) return { ok: false, reason: "no-token" };
  const teamId = cfg.teamId || _BARCA_TEAM_ID;

  const url = `https://api.football-data.org/v4/teams/${teamId}/matches?status=SCHEDULED&limit=200`;
  const res = await fetch(url, { headers: { "X-Auth-Token": token } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, reason: `http-${res.status}`, body: body.slice(0, 200) };
  }
  const data = await res.json();
  const matches = Array.isArray(data.matches) ? data.matches : [];

  const seen = new Set();
  let written = 0;
  for (const m of matches) {
    if (!m.utcDate || !m.id) continue;
    const { date, startTime } = _barcaLocal(m.utcDate);
    const home = _barcaName(m.homeTeam);
    const away = _barcaName(m.awayTeam);
    if (!home || !away) continue;
    const comp = _BARCA_COMPS[m.competition?.name] || m.competition?.name || "";
    const id = `barca_${m.id}`;
    seen.add(id);
    const ref = db.doc(`calendar_events/${id}`);
    const fields = {
      title: `⚽ ${home} – ${away}`,
      date, startTime, endTime: "",
      notes: comp,
      repeat: "none",
      autoBarca: true,
      barcaMatchId: m.id,
      updatedAt: new Date().toISOString(),
    };
    // תזכורת ביום המשחק בשעה 10:00. השדה נמדד בדקות לפני שריקת הפתיחה,
    // ולכן הוא מחושב מחדש בכל משיכה — משחק שהוזז לשעה אחרת עדיין יתריע ב-10:00.
    const [kh, km] = startTime.split(":").map(Number);
    fields.reminderMinutes = Math.max(0, (kh * 60 + km) - _BARCA_ALERT_MIN);
    fields.reminderTo = _BARCA_ALERT_TO;

    const prev = await ref.get();
    const p = prev.exists ? prev.data() : null;
    // תזכורת נשלחת פעם אחת. אם המשחק הוזז ליום או לשעה אחרת — פותחים אותה מחדש.
    if (!p || p.date !== date || p.startTime !== startTime) {
      fields.reminderSent = false;
      if (!p) fields.createdAt = new Date().toISOString();
    }
    await ref.set(fields, { merge: true });
    written++;
  }

  // משחק שנדחה או ירד מהלוח — נמחק מהיומן, אבל רק אירועים עתידיים
  // שנוצרו אוטומטית. משחקים שכבר עברו נשארים כהיסטוריה.
  const today = _barcaLocal(new Date().toISOString()).date;
  let removed = 0;
  // שאילתה על שדה אחד בלבד — סינון התאריך נעשה כאן, כדי לא לחייב אינדקס מורכב
  const stale = await db.collection("calendar_events").where("autoBarca", "==", true).get();
  for (const d of stale.docs) {
    if (seen.has(d.id)) continue;
    if ((d.data().date || "") < today) continue;   // משחקים שעברו נשארים כהיסטוריה
    await d.ref.delete(); removed++;
  }

  await db.doc("config/barca").set(
    { lastSync: new Date().toISOString(), lastCount: written, lastRemoved: removed }, { merge: true });
  return { ok: true, written, removed };
}

// כל בוקר ב-04:00 — מושך את כל המשחקים הידועים קדימה. יומי ולא כל שלושה
// ימים, כדי שגם שינוי שעה של הרגע האחרון ייקלט לפני התראת ה-10:00.
exports.barcaFixturesSync = onSchedule(
  { schedule: "0 4 * * *", region: "europe-west1", timeZone: "Asia/Jerusalem", timeoutSeconds: 300 },
  async () => { console.log("barcaFixturesSync", JSON.stringify(await _barcaSync())); }
);

// משיכה ידנית מתוך מסך ההגדרות
exports.runBarcaSyncNow = onRequest(
  { cors: true, region: "europe-west1", timeoutSeconds: 300 },
  async (req, res) => {
    try { res.json(await _barcaSync()); }
    catch (err) { res.status(500).json({ ok: false, error: err.message }); }
  }
);

// ════════════════════════════════════════════════════════════════════════
// התראות מתוזמנות
// המנהל מגדיר במסך "ניהול התראות" הודעה, נמענים, ימים ושעות. כאן נשלחות
// ההודעות בזמן שנקבע, גם כשהאפליקציה סגורה. כל שעה נשלחת פעם אחת ביום.
// ════════════════════════════════════════════════════════════════════════
function _israelParts() {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem", weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t).value;
  const dows = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hh = g("hour") === "24" ? "00" : g("hour");
  return {
    day: `${g("year")}-${g("month")}-${g("day")}`,
    dow: dows[g("weekday")],
    minutes: (+hh) * 60 + (+g("minute")),
  };
}

exports.scheduledNotifications = onSchedule(
  { schedule: "every 5 minutes", region: "europe-west1", timeZone: "Asia/Jerusalem" },
  async () => {
    const { day, dow, minutes } = _israelParts();
    const snap = await db.collection("notif_templates").get();
    if (snap.empty) return;

    const contactsSnap = await db.collection("config").doc("driver_contacts").get();
    const contacts = contactsSnap.exists ? contactsSnap.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    if (!token) return;

    for (const docSnap of snap.docs) {
      const t = docSnap.data();
      const days = Array.isArray(t.days) ? t.days : [];
      const times = Array.isArray(t.times) ? t.times : [];
      const to = Array.isArray(t.to) ? t.to : [];
      if (!days.length || !times.length || !to.length || !t.message) continue;
      // התראה מוקפאת אינה נשלחת. הקפאה עד תאריך פגה מעצמה למחרת.
      if (t.frozen && (!t.frozenUntil || day <= t.frozenUntil)) continue;
      if (!days.includes(dow)) continue;

      for (const hhmm of times) {
        const [h, m] = String(hhmm).split(":").map(Number);
        if (isNaN(h) || isNaN(m)) continue;
        const due = h * 60 + m;
        // חלון של חמש דקות — בדיוק תדירות ההרצה, כך שכל שעה נתפסת פעם אחת
        if (minutes < due || minutes >= due + 5) continue;
        const key = `${day} ${hhmm}`;
        if ((t.sentLog || {})[key]) continue;

        for (const name of to) {
          const chatId = contacts[name]?.telegramId;
          if (!chatId) continue;
          try {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: t.message }),
            });
          } catch (err) { console.error("scheduled notif send failed", name, err); }
        }
        // רישום מצומצם: רק המפתחות של היום, כדי שהמסמך לא יתנפח
        const log = Object.fromEntries(
          Object.entries(t.sentLog || {}).filter(([k]) => k.startsWith(day)));
        log[key] = true;
        await docSnap.ref.set({ sentLog: log }, { merge: true });
      }
    }
  }
);

// פריסה חוזרת — הריצה הקודמת נפלה על שגיאת API זמנית של גוגל
