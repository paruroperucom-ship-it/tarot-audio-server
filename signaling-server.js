const WebSocket = require('ws');

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });
const rooms = {};

wss.on('connection', ws => {
  ws.on('message', msg => {
    const data = JSON.parse(msg);
    const { room } = data;
    if (!rooms[room]) rooms[room] = [];
    rooms[room].push(ws);

    // reenviar mensajes a todos los clientes en la sala (menos al emisor)
    rooms[room].forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on('close', () => {
    for (const room in rooms) {
      rooms[room] = rooms[room].filter(c => c !== ws);
    }
  });
});

console.log(`Servidor WebSocket ejecutándose en puerto ${PORT}`);
