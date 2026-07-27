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

// Sun/Tue/Thu at 11:00 — nudge drivers about cars still waiting to be
// charged, as long as any active charging_tasks batch has unfinished cars.
exports.chargingReminder = onSchedule(
  { schedule: "0 11 * * 0,2,4", region: "europe-west1", timeZone: "Asia/Jerusalem" },
  async () => {
    const snap = await db.collection("charging_tasks").where("status", "==", "active").get();
    if (snap.empty) return;

    const pendingPlates = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const headers = data.headers || [];
      const plateIdx = headers.findIndex((h) => /מספר רישוי|מספר רכב|לוחית/.test(h));
      const cars = data.carsJson ? JSON.parse(data.carsJson) : [];
      for (const car of cars) {
        if (car.charged) continue;
        const cells = car.cells || [];
        const plate = plateIdx >= 0 ? cells[plateIdx] : cells.find((c) => /^\d{7,8}$/.test(String(c).replace(/\D/g, "")));
        pendingPlates.push(plate || "רכב ללא מספר מזוהה");
      }
    }
    if (!pendingPlates.length) return;

    const contactsSnap = await db.collection("config").doc("driver_contacts").get();
    const contacts = contactsSnap.exists ? contactsSnap.data() : {};
    const token = contacts["_telegramToken"]?.value || "";
    if (!token) return;

    const text = `🔋 תזכורת — יש ${pendingPlates.length} רכבים שממתינים לטעינה:\n\n${pendingPlates.map((p) => "🚗 " + p).join("\n")}\n\nיש להשלים את הטעינה.`;

    for (const name of ["עופר", "גיל", "איתי"]) {
      const chatId = contacts[name]?.telegramId;
      if (!chatId) continue;
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        });
      } catch (err) {
        console.error("charging reminder send failed for", name, err);
      }
    }
  }
);
