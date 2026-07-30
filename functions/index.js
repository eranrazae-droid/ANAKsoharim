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
    const accountSid = contacts["_twilioSid"]?.value || "";
    const authToken = contacts["_twilioToken"]?.value || "";
    const from = contacts["_twilioFrom"]?.value || "";

    for (const docSnap of snap.docs) {
      const e = docSnap.data();
      if (e.reminderMinutes === null || e.reminderMinutes === undefined) continue;
      if (!Array.isArray(e.reminderTo) || !e.reminderTo.length) continue;
      if (!e.date) continue;

      const [y, m, d] = e.date.split("-").map(Number);
      const [hh, mm] = (e.startTime || "00:00").split(":").map(Number);
      const eventTime = new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0));
      const reminderTime = new Date(eventTime.getTime() - e.reminderMinutes * 60000);

      // event already fully passed (function was down / missed the window) — skip silently
      if (eventTime < dayAgo) { await docSnap.ref.update({ reminderSent: true }); continue; }
      if (now < reminderTime) continue; // not due yet

      if (accountSid && authToken && from) {
        for (const name of e.reminderTo) {
          let phone = contacts[name]?.phone;
          if (!phone && name === "ליאל") phone = contacts["_managerPhone"]?.value;
          if (!phone) continue;
          const toNum = "+" + String(phone).replace(/\D/g, "");
          const fromNum = from.startsWith("+") ? from : "+" + from.replace(/\D/g, "");
          const params = new URLSearchParams({
            From: fromNum,
            To: toNum,
            Body: `🔔 תזכורת: ${e.title || ""}${e.startTime ? " — " + e.startTime : ""}`,
          });
          const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
          try {
            await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
              method: "POST",
              headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
              body: params.toString(),
            });
          } catch (err) { console.error("reminder send failed for", name, err); }
        }
      }
      await docSnap.ref.update({ reminderSent: true });
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
  async () => { await _runRecallScan(); }
);

// same scan, on demand — lets the manager verify without waiting for 07:00
exports.runRecallScanNow = onRequest(
  { cors: true, region: "europe-west1", timeoutSeconds: 540, memory: "512MiB" },
  async (req, res) => {
    try {
      const r = await _runRecallScan();
      res.status(200).json(r);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

async function _runRecallScan() {
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
        for (const c of chunk) {
          try {
            const recs = await _recallQueryQ(c.plate);
            if (recs.length) openCars.push(c);
          } catch (err) { failedPlates++; }
          await _sleep2(250);
        }
      } else if (i + BATCH < cars.length) {
        await _sleep2(400);
      }
    }

    // Never let a broken run masquerade as "no recalls": if we found nothing,
    // only trust it when the lookup pipeline is provably alive and no plate
    // errored. Otherwise keep yesterday's list and tell the manager.
    if (!openCars.length) {
      const probeOk = await _recallProbeWorks();
      if (!probeOk || failedPlates) {
        console.error(`dailyRecallPull: unreliable run (probeOk=${probeOk}, failedPlates=${failedPlates}) — keeping previous list`);
        try {
          const cs = await db.collection("config").doc("driver_contacts").get();
          const contacts = cs.exists ? cs.data() : {};
          const token = contacts["_telegramToken"]?.value || "";
          const chatId = contacts["ליאל"]?.telegramId || "";
          if (token && chatId) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: "⚠️ בדיקת הריקול הבוקר לא הושלמה (בעיית תקשורת מול משרד התחבורה). הרשימה הקודמת נשמרה — הבדיקה תרוץ שוב מחר." }),
            });
          }
        } catch (err) { console.error("recall failure alert failed", err); }
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
