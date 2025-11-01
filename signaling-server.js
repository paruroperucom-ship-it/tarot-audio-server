// signaling-server.js — modo espejo estable para Render
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.get("/", (_, res) => res.send("🟢 Servidor WebSocket en modo espejo activo."));

const PORT = process.env.PORT || 10000;
const globalRooms = {}; // <- global persistente

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

    const { type, room, offer, answer, candidate, leave } = data;
    if (!room) return;

    // Unirse a una sala
    if (type === "join") {
      if (!globalRooms[room]) globalRooms[room] = [];
      if (!globalRooms[room].includes(ws)) {
        globalRooms[room].push(ws);
        console.log(`✅ Cliente unido a sala ${room}: ${globalRooms[room].length} conectado(s).`);
      }

      ws.send(JSON.stringify({ type: "joined", room, total: globalRooms[room].length }));

      // Asignar roles automáticamente
      if (globalRooms[room].length === 2) {
        const [caller, callee] = globalRooms[room];
        caller.send(JSON.stringify({ type: "role", role: "caller" }));
        callee.send(JSON.stringify({ type: "role", role: "callee" }));
        console.log(`🎭 Roles asignados para sala ${room}`);
      }
      return;
    }

    // Transmitir señales a todos menos al remitente
    if (offer || answer || candidate) {
      (globalRooms[room] || []).forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
      return;
    }

    // Usuario salió
    if (leave) {
      console.log(`🚪 Usuario salió de sala ${room}`);
      globalRooms[room] = (globalRooms[room] || []).filter((c) => c !== ws);
      (globalRooms[room] || []).forEach((client) => {
        if (client.readyState === 1) client.send(JSON.stringify({ leave: true }));
      });
      return;
    }
  });

  ws.on("close", () => {
    for (const room in globalRooms) {
      globalRooms[room] = globalRooms[room].filter((c) => c !== ws);
      if (!globalRooms[room].length) delete globalRooms[room];
    }
    console.log("❎ Cliente desconectado");
  });
});

// Keep-alive: Render no dormirá la instancia
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () =>
  console.log(`✅ Servidor WebSocket espejo ejecutándose en puerto ${PORT}`)
);
