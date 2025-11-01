// signaling-server.js — versión estable Render
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.get("/", (_, res) => res.send("🟢 Servidor WebSocket activo"));

const PORT = process.env.PORT || 10000;
const rooms = {};

wss.on("connection", (ws) => {
  console.log("📡 Nuevo cliente conectado");

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      console.error("❌ JSON inválido:", msg);
      return;
    }

    const room = data.room;
    if (!room) return;

    // Crear o agregar al array
    if (!rooms[room]) rooms[room] = [];
    if (!rooms[room].includes(ws)) rooms[room].push(ws);

    console.log(`📦 Sala ${room}: ${rooms[room].length} usuarios`);

    // En cuanto haya 2 usuarios, asignar roles automáticamente
    if (rooms[room].length === 2) {
      const [caller, callee] = rooms[room];
      if (caller.readyState === 1)
        caller.send(JSON.stringify({ type: "role", role: "caller" }));
      if (callee.readyState === 1)
        callee.send(JSON.stringify({ type: "role", role: "callee" }));
    }

    // Reenviar señales
    if (data.offer || data.answer || data.candidate) {
      rooms[room].forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
    }

    // Manejo de salida
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
      if (!rooms[room].length) delete rooms[room];
    }
    console.log("❎ Cliente desconectado");
  });
});

server.listen(PORT, () =>
  console.log(`✅ Servidor WebSocket activo en puerto ${PORT}`)
);
