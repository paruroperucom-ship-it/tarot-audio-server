// signaling-server.js — sincronización garantizada para Render WebSocket
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.get("/", (_, res) =>
  res.send("🟢 Servidor WebSocket activo y sincronizado con Render.")
);

const PORT = process.env.PORT || 10000;
const rooms = {};

wss.on("connection", (ws) => {
  console.log("📡 Nuevo cliente conectado");
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (err) {
      console.error("❌ JSON inválido:", msg);
      return;
    }

    const { room, join, offer, answer, candidate, leave } = data;
    if (!room) return;

    // Crear la sala si no existe
    if (!rooms[room]) rooms[room] = [];

    // Si no está ya agregado, incluir al cliente
    if (!rooms[room].includes(ws)) {
      rooms[room].push(ws);
      console.log(`✅ Cliente añadido a sala ${room} (${rooms[room].length} total)`);
    }

    // Enviar confirmación de unión
    ws.send(JSON.stringify({ type: "joined", room, count: rooms[room].length }));

    // Cuando haya 2 usuarios, asignar roles
    if (rooms[room].length === 2) {
      const [caller, callee] = rooms[room];
      caller.send(JSON.stringify({ type: "role", role: "caller" }));
      callee.send(JSON.stringify({ type: "role", role: "callee" }));
      console.log(`🎭 Roles asignados en sala ${room}`);
    }

    // Reenvío de señales (offer, answer, ICE)
    if (offer || answer || candidate) {
      rooms[room].forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
    }

    // Al salir un cliente
    if (leave) {
      rooms[room] = rooms[room].filter((c) => c !== ws);
      rooms[room].forEach((client) => {
        if (client.readyState === 1)
          client.send(JSON.stringify({ leave: true }));
      });
      console.log(`🚪 Cliente salió de sala ${room}`);
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

// Mantener Render despierto
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () =>
  console.log(`✅ Servidor WebSocket estable ejecutándose en puerto ${PORT}`)
);
