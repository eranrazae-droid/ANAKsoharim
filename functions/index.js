const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// Plain SMS via Twilio (no WhatsApp session, no QR re-scan — an official,
// stable API that only breaks if the Twilio account itself has a problem).
exports.sendSms = onRequest({ cors: true, region: "europe-west1" }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { accountSid, authToken, from, to, message } = req.body;
  if (!accountSid || !authToken || !from || !to || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const toNum = "+" + to.replace(/\D/g, "");
  const fromNum = from.startsWith("+") ? from : "+" + from.replace(/\D/g, "");

  const params = new URLSearchParams({
    From: fromNum,
    To: toNum,
    Body: message,
  });

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  const data = await twilioRes.json();
  res.status(twilioRes.ok ? 200 : twilioRes.status).json(data);
});

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

// one-time sample send at 00:10 — fires once (guarded by a Firestore flag so
// it never repeats even though the schedule itself runs daily), so ליאל can
// see exactly what the real reminder + buttons look like.
exports.sendSampleBatteryReminderOnce = onSchedule(
  { schedule: "every 1 minutes", region: "europe-west1", timeZone: "Asia/Jerusalem" },
  async () => {
    const flagRef = db.collection("config").doc("sample_reminder_once");
    const flagSnap = await flagRef.get();
    if (flagSnap.exists && flagSnap.data().sent) return;

    const contactsSnap = await db.collection("config").doc("driver_contacts").get();
    const contacts = contactsSnap.exists ? contactsSnap.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    const chatId = contacts["ליאל"]?.telegramId || "";
    if (token && chatId) {
      try {
        await _sendBatteryReminderMsg(token, chatId, "ליאל", 3);
      } catch (err) {
        console.error("sendSampleBatteryReminderOnce failed", err);
      }
    }
    await flagRef.set({ sent: true });
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

// polls Telegram every 2 minutes for button presses on the reminder message
// (no public webhook needed — avoids depending on this project's flaky
// Cloud Run URL provisioning) and relays the driver's choice to ליאל.
exports.telegramPoll = onSchedule(
  { schedule: "every 2 minutes", region: "europe-west1" },
  async () => {
    const contactsSnap = await db.collection("config").doc("driver_contacts").get();
    const contacts = contactsSnap.exists ? contactsSnap.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    if (!token) return;

    const offsetDoc = await db.collection("config").doc("telegram_poll").get();
    const offset = offsetDoc.exists ? offsetDoc.data().offset || 0 : 0;

    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=0`);
    const data = await res.json();
    if (!data.ok || !data.result?.length) return;

    const managerChatId = contacts["ליאל"]?.telegramId;
    let maxUpdateId = offset - 1;

    for (const update of data.result) {
      maxUpdateId = Math.max(maxUpdateId, update.update_id);
      const cq = update.callback_query;
      if (!cq || !cq.data) continue;

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
    }
    await db.collection("config").doc("telegram_poll").set({ offset: maxUpdateId + 1 });
  }
);

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
