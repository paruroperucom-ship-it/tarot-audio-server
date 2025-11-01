// signaling-server.js — sincronizado con Render y soporte TURN
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

const server = createServer(app);
const wss = new WebSocketServer({ server });

app.get("/", (_, res) => res.send("🟢 Servidor WebSocket sincronizado con Render activo."));

const PORT = process.env.PORT || 10000;
globalThis.rooms = globalThis.rooms || {};

// 🔐 Endpoint TURN usando tus claves Twilio
app.get("/turn-credentials", async (req, res) => {
  try {
    const tokenResponse = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + process.env.TWILIO_ACCOUNT_SID + "/Tokens.json", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(process.env.TWILIO_API_KEY_SID + ":" + process.env.TWILIO_API_KEY_SECRET).toString("base64"),
      },
    });
    const tokenData = await tokenResponse.json();
    res.json(tokenData.ice_servers || []);
  } catch (error) {
    console.error("❌ Error generando credenciales TURN:", error);
    res.status(500).json({ error: "No se pudieron generar credenciales TURN" });
  }
});

// 📡 WebSocket principal
wss.on("connection", (ws) => {
  console.log("📡 Nuevo cliente conectado");
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      console.error("❌ JSON inválido:", msg);
      return;
    }

    const { type, room, offer, answer, candidate, leave } = data;
    if (!room) return;

    // Unirse a sala global
    if (type === "join") {
      if (!globalThis.rooms[room]) globalThis.rooms[room] = [];
      if (!globalThis.rooms[room].includes(ws)) {
        globalThis.rooms[room].push(ws);
        console.log(`✅ Cliente unido a sala ${room}: ${globalThis.rooms[room].length} conectado(s).`);
      }

      // Asignar roles al segundo usuario
      if (globalThis.rooms[room].length === 2) {
        const [caller, callee] = globalThis.rooms[room];
        caller.send(JSON.stringify({ type: "role", role: "caller" }));
        callee.send(JSON.stringify({ type: "role", role: "callee" }));
        console.log(`🎭 Roles asignados en sala ${room}`);
      }
      return;
    }

    // Reenvío de señal
    if (offer || answer || candidate) {
      globalThis.rooms[room].forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
      return;
    }

    // Salida de la sala
    if (leave) {
      console.log(`🚪 Usuario salió de sala ${room}`);
      globalThis.rooms[room] = globalThis.rooms[room].filter((c) => c !== ws);
      if (!globalThis.rooms[room].length) delete globalThis.rooms[room];
      return;
    }
  });

  ws.on("close", () => {
    for (const room in globalThis.rooms) {
      globalThis.rooms[room] = globalThis.rooms[room].filter((c) => c !== ws);
      if (!globalThis.rooms[room].length) delete globalThis.rooms[room];
    }
    console.log("❎ Cliente desconectado");
  });
});

// 🔄 Mantener instancia viva (Render)
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () =>
  console.log(`✅ Servidor WebSocket sincronizado ejecutándose en puerto ${PORT}`)
);
