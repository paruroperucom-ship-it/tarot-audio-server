import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });
console.log("✅ Servidor de señalización activo en puerto", process.env.PORT || 8080);

const rooms = {};

wss.on("connection", (ws) => {
  console.log("📡 Nuevo cliente conectado");

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return console.error("❌ Mensaje inválido:", message);
    }

    const room = data.room;
    if (!room) return;

    if (!rooms[room]) rooms[room] = [];
    if (!rooms[room].includes(ws)) rooms[room].push(ws);

    console.log(`📦 Sala: ${room}, usuarios: ${rooms[room].length}`);

    if (data.join && rooms[room].length === 2) {
      console.log(`🚀 Ambos usuarios en sala ${room}`);
      rooms[room].forEach((client, i) => {
        client.send(JSON.stringify({ type: "ready", role: i === 0 ? "caller" : "callee" }));
      });
      return;
    }

    if (data.offer || data.answer || data.candidate) {
      rooms[room].forEach((client) => {
        if (client !== ws && client.readyState === 1) client.send(JSON.stringify(data));
      });
    }

    if (data.leave) {
      console.log(`🚪 Usuario salió de sala ${room}`);
      rooms[room] = rooms[room].filter((c) => c !== ws);
      rooms[room].forEach((client) => {
        if (client.readyState === 1) client.send(JSON.stringify({ leave: true }));
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
