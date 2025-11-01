// signaling-server.js — versión Render estable con sincronización forzada
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.get("/", (_, res) => res.send("🟢 Servidor WebSocket activo con sincronización estable."));

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
    } catch {
      console.error("❌ JSON inválido:", msg);
      return;
    }

    const { room, join, offer, answer, candidate, leave } = data;
    if (!room) return;

    // Crear la sala si no existe
    if (!rooms[room]) rooms[room] = [];
    if (!rooms[room].includes(ws)) rooms[room].push(ws);

    console.log(`📦 Sala ${room}: ${rooms[room].length} usuario(s)`);

    // Asignar roles automáticamente apenas haya 2 usuarios
    if (rooms[room].length === 2) {
      const [caller, callee] = rooms[room];
      try {
        caller.send(JSON.stringify({ type: "role", role: "caller" }));
        callee.send(JSON.stringify({ type: "role", role: "callee" }));
        console.log(`🎭 Roles asignados en sala ${room}`);
      } catch (err) {
        console.error("Error al asignar roles:", err);
      }
    }

    // Reenvío de señales entre clientes
    if (offer || answer || candidate) {
      rooms[room].forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
    }

    // Cuando un usuario se desconecta
    if (leave) {
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

// 🧠 Mantener Render despierto (keep-alive)
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
