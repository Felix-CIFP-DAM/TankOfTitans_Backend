require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const apiService = require('./services/api.service');
const socketConfig = require('./config/socket.config');
const userManager = require('./utils/UserManager');
const lobbyService = require('./services/lobby.service');
const authMiddleware = require('./middleware/auth.middleware');

const authHandler = require('./handlers/auth.handler');
const lobbyHandler = require('./handlers/lobby.handler');
const gameHandler = require('./handlers/game.handler');
const perfilHandler = require('./handlers/perfil.handler');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, socketConfig);

// Registra el middleware de autenticación en cada conexión
io.use(authMiddleware);

io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    authHandler(io, socket);
    lobbyHandler(io, socket);
    gameHandler(io, socket);
    perfilHandler(io, socket);

    socket.on('disconnect', async () => {
        console.log(`Cliente desconectado: ${socket.id}`);

        const user = userManager.getUser(socket.id);
        if (user) {
            try {
                const partidas = await lobbyService.listarPartidas();
                const partidaDelUsuario = partidas.find(
                    p => p.hostNickname === user.nickname
                );
                if (partidaDelUsuario) {
                    await lobbyService.cambiarHost(
                        partidaDelUsuario.id, user.id
                    );
                    io.to(`lobby_${partidaDelUsuario.id}`)
                        .emit('hostCambiado', {
                            message: 'El host se ha desconectado, nuevo host asignado'
                        });
                }
            } catch (error) {
                console.error('Error al gestionar desconexión:', error.message);
            }

            userManager.logoutUser(socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;

apiService.login()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Middleware arrancado en puerto ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('No se pudo conectar con la API:', error.message);
        process.exit(1);
    });