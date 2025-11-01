// signaling-server.js — versión sincronizada
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.get("/", (req, res) => {
  res.send("🟢 Servidor WebSocket activo y sincronizado");
});

const PORT = process.env.PORT || 10000;
const rooms = {};

wss.on("connection", (ws) => {
  console.log("📡 Nuevo cliente conectado");

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return console.error("❌ JSON inválido:", message);
    }

    const room = data.room;
    if (!room) return;

    // Crear sala si no existe
    if (!rooms[room]) rooms[room] = [];
    if (!rooms[room].includes(ws)) rooms[room].push(ws);

    console.log(`📦 Sala ${room}: ${rooms[room].length} usuarios`);

    // Si ambos usuarios están en la sala, sincronizar roles
    if (data.join && rooms[room].length === 2) {
      console.log(`🚀 Sala ${room} lista para conexión`);
      const [caller, callee] = rooms[room];

      if (caller.readyState === 1)
        caller.send(JSON.stringify({ type: "role", role: "caller" }));
      if (callee.readyState === 1)
        callee.send(JSON.stringify({ type: "role", role: "callee" }));
      return;
    }

    // Reenviar señal (offer, answer, candidate)
    if (["offer", "answer", "candidate"].some(k => data[k])) {
      rooms[room].forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
    }

    // Usuario sale
    if (data.leave) {
      console.log(`🚪 Usuario salió de sala ${room}`);
      rooms[room] = rooms[room].filter((c) => c !== ws);
      rooms[room].forEach((client) => {
        if (client.readyState === 1)
          client.send(JSON.stringify({ leave: true }));
      });
    }
  });

  ws.on("close", () => {
    for (const room in rooms) {
      rooms[room] = rooms[room].filter((c) => c !== ws);
      if (rooms[room].length === 0) delete rooms[room];
    }
    console.log("❎ Cliente desconectado");
  });
});

server.listen(PORT, () => {
  console.log(`✅ Servidor WebSocket sincronizado en puerto ${PORT}`);
});
