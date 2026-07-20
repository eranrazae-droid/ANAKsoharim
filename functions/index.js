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
