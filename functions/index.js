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
    const govRes = await fetch(`https://data.gov.il/api/3/action/datastore_search?${params.toString()}`);
    const data = await govRes.json();
    res.status(govRes.ok ? 200 : govRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "upstream fetch failed", message: err.message });
  }
});

// ── daily inventory pull + recall check (Sun–Fri 7:00) ──────────────────
const _RECALL_RESOURCE = "36bf1404-0be4-49d2-82dc-2f1ead4a8b93";
const _INVENTORY_URL = "https://phpstack-1347359-5276985.cloudwaysapps.com/comigo-anakarehevim/index.php/api/GetActiveVehicles";
const _sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));

async function _recallLearnField() {
  const res = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&limit=1`);
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
  const res = await fetch(url);
  if (res.status === 409) throw new Error("VALIDATION"); // wrong field — switch strategy, don't retry
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (!json.success) throw new Error("CKAN error");
  return json.result?.records || [];
}
async function _recallQueryQ(plate) {
  const res = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&q=${plate}&limit=5`);
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
  const res = await fetch(url);
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
    const res = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&limit=1`);
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
async function _recallReportRun(result, trigger) {
  try {
    await db.collection("recall_status").doc("lastRun").set({
      at: new Date(), trigger: trigger || "schedule", ...result,
    });
  } catch (err) { console.error("recall lastRun write failed", err); }
  if (result.ok) return;
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

async function _runRecallScan(trigger) {
  const res = await _runRecallScanInner().catch((err) => {
    console.error("recall scan crashed", err);
    return { ok: false, reason: "crashed", error: String(err && err.message || err) };
  });
  await _recallProgress(0, 0, false);   // הפס נעלם מהמסך בסיום, גם בכישלון
  await _recallReportRun(res, trigger);
  return res;
}

async function _runRecallScanInner() {
    let vehicles;
    try {
      const res = await fetch(_INVENTORY_URL);
      vehicles = await res.json();
    } catch (err) {
      console.error("dailyRecallPull: inventory fetch failed", err);
      return { ok: false, reason: "inventory-fetch-failed" };
    }
    if (!Array.isArray(vehicles) || !vehicles.length) return { ok: false, reason: "empty-inventory" };

    const cars = vehicles.map((v) => ({
      plate: String(v.ank_s_car_number || "").replace(/\D/g, ""),
      tozeret: v.ank_id_manufacturer || "",
      degem: [v.ank_id_model, v.ank_id_sub_model].filter(Boolean).join(" "),
      shnat: v.ank_id_year_of_manufacture || "",
    })).filter((c) => c.plate.length === 7 || c.plate.length === 8);
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
      const sampleRes = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&limit=2`);
      const sampleJson = await sampleRes.json().catch(() => ({}));
      const sampleRecs = sampleJson?.result?.records || [];
      const probePlate = cars[0]?.plate || "";
      const probe = {};
      for (const [mode, filters] of [["num", { [field]: [Number(probePlate)] }], ["str", { [field]: [String(probePlate)] }]]) {
        try {
          const r = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&filters=${encodeURIComponent(JSON.stringify(filters))}&limit=3`);
          probe[mode] = { status: r.status, count: (await r.json().catch(() => ({})))?.result?.records?.length ?? -1 };
        } catch (e) { probe[mode] = { error: e.message }; }
      }
      try {
        const r = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${_RECALL_RESOURCE}&q=${probePlate}&limit=3`);
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
    await statusRef.set({ cars: finalCars, updatedAt: new Date(), checkedCount: cars.length });
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

// instant webhook — Telegram calls this the moment a driver taps a button,
// instead of waiting for a 2-minute poll.
exports.telegramWebhook = onRequest({ region: "europe-west1" }, async (req, res) => {
  res.status(200).send("ok"); // ack Telegram immediately, process after
  try {
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

// טוענת את רשימת המלאי המלאה לתוך ownership_status/current. הבדיקה מול
// משרד התחבורה עצמה נעשית ידנית מול אתר gov (מוגן ב-reCAPTCHA ולא ניתן
// לאוטומציה), והמסך רק מנהל אותה כצ'קליסט — לכן כאן נשמרת רשימת הרכבים,
// ולא שום נתון בעלות שנמשך אוטומטית.
async function _runOwnershipScan() {
  let vehicles;
  try {
    const res = await fetch(_INVENTORY_URL);
    vehicles = await res.json();
  } catch (err) {
    return { ok: false, reason: "inventory-fetch-failed" };
  }
  if (!Array.isArray(vehicles) || !vehicles.length) return { ok: false, reason: "empty-inventory" };

  const cars = vehicles.map((v) => ({
    plate: String(v.ank_s_car_number || "").replace(/\D/g, ""),
    tozeret: v.ank_id_manufacturer || "",
    degem: [v.ank_id_model, v.ank_id_sub_model].filter(Boolean).join(" "),
    shnat: v.ank_id_year_of_manufacture || "",
  })).filter((c) => c.plate.length === 7 || c.plate.length === 8);
  if (!cars.length) return { ok: false, reason: "no-valid-plates" };

  await db.collection("ownership_status").doc("current").set({
    cars, checkedCount: cars.length, updatedAt: new Date(),
  });
  return { ok: true, checked: cars.length };
}

exports.runOwnershipScanNow = onRequest(
  { cors: true, region: "europe-west1", timeoutSeconds: 540, memory: "512MiB" },
  async (req, res) => {
    let out;
    try { out = await _runOwnershipScan(); }
    catch (err) { out = { ok: false, reason: "crashed", error: err.message }; }
    res.status(out.ok ? 200 : 500).json(out);
  }
);
