// server.js
import express from "express";
import cors from "cors";
import twilio from "twilio";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🔐 Variables seguras (defínelas en Render o en .env)
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioApiKey = process.env.TWILIO_API_KEY_SID;
const twilioApiSecret = process.env.TWILIO_API_KEY_SECRET;

// 🧠 Endpoint para generar credenciales efímeras TURN/STUN
app.get("/turn-credentials", async (req, res) => {
  try {
    const client = twilio(twilioApiKey, twilioApiSecret, { accountSid: twilioAccountSid });
    const token = await client.tokens.create();
    res.json(token.iceServers);
  } catch (error) {
    console.error("❌ Error generando credenciales TURN:", error);
    res.status(500).json({ error: "No se pudieron generar las credenciales TURN" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor TURN ejecutándose en puerto ${PORT}`);
});
