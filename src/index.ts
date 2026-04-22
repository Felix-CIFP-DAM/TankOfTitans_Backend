
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

io.on('connection', socket => {
  console.log('cliente conectado', socket.id);

  socket.on('message', data => {
    console.log('mensaje recibido', data);
    // broadcast de vuelta al mismo cliente o a todos:
    socket.emit('message', { echo: data });
  });

  socket.on('disconnect', () => {
    console.log('cliente desconectado', socket.id);
  });
});

server.listen(3000, () => console.log('Socket.io server running on :3000'));