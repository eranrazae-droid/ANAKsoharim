const { onRequest } = require("firebase-functions/v2/https");

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
