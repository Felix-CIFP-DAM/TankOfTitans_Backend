require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const apiService = require('./services/api.service');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;

// Primero nos autenticamos en la API y luego arrancamos
apiService.login()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Middleware arrancado en puerto ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('No se pudo conectar con la API:', error.message);
        process.exit(1);
    });;