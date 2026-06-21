const { onRequest } = require("firebase-functions/v2/https");

exports.sendWhatsApp = onRequest({ cors: true, region: "europe-west1" }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { accountSid, authToken, from, to, message } = req.body;
  if (!accountSid || !authToken || !to || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const toNum = "whatsapp:+" + to.replace(/\D/g, "");
  const fromNum = from || "whatsapp:+14155238886"; // Twilio sandbox default

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
