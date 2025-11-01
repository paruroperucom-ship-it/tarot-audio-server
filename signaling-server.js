// signaling-server.js — versión Render estable y sincronizada
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.get("/", (_, res) => res.send("🟢 Servidor WebSocket activo y sincronizado con Render."));

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

    const { type, room, offer, answer, candidate, leave } = data;
    if (!room) return;

    // Unirse a sala
    if (type === "join") {
      if (!rooms[room]) rooms[room] = [];
      if (!rooms[room].includes(ws)) {
        rooms[room].push(ws);
        console.log(`✅ Cliente añadido a sala ${room} (${rooms[room].length} total)`);
      }

      // Enviar confirmación al cliente
      ws.send(JSON.stringify({ type: "joined", room, count: rooms[room].length }));

      // Si hay dos usuarios, asignar roles
      if (rooms[room].length === 2) {
        const [caller, callee] = rooms[room];
        caller.send(JSON.stringify({ type: "role", role: "caller" }));
        callee.send(JSON.stringify({ type: "role", role: "callee" }));
        console.log(`🎭 Roles asignados en sala ${room}`);
      }
      return;
    }

    // Reenviar oferta, respuesta o ICE
    if (offer || answer || candidate) {
      rooms[room]?.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
      return;
    }

    // Cuando alguien se desconecta
    if (leave) {
      console.log(`🚪 Cliente salió de sala ${room}`);
      rooms[room] = rooms[room].filter((c) => c !== ws);
      rooms[room]?.forEach((client) => {
        if (client.readyState === 1)
          client.send(JSON.stringify({ leave: true }));
      });
      return;
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

// Mantener Render activo
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
