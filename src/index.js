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
const adminHandler = require('./handlers/admin.handler');


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
    adminHandler(io, socket);


    socket.on('disconnecting', async () => {
        const user = userManager.getUser(socket.id);
        if (user) {
            try {
                // Buscamos si estaba en alguna sala de lobby_ o game_
                const rooms = Array.from(socket.rooms);
                const gameRoom = rooms.find(r => r.startsWith('lobby_') || r.startsWith('game_'));
                
                if (gameRoom) {
                    const partidaId = gameRoom.split('_')[1];
                    console.log(`[BACKEND][index] 🔌 Cliente ${user.nickname} desconectándose de partida ${partidaId}. Dando 5s de margen para reconexión...`);
                    
                    const timeoutId = setTimeout(async () => {
                        console.log(`[BACKEND][index] ⏰ Margen expirado para ${user.nickname}. Ejecutando abandono automático de partida ${partidaId}`);
                        try {
                            await lobbyService.abandonarPartida(Number(user.id), partidaId);
                            
                            const gameManager = require('./game/GameManager');
                            if (gameManager.existe(partidaId)) {
                                gameManager.delete(partidaId);
                            }

                            io.to(`lobby_${partidaId}`).emit('jugadorAbandono', {
                                message: `El jugador ${user.nickname} se ha desconectado.`
                            });
                            io.to(`game_${partidaId}`).emit('jugadorAbandono', {
                                message: `El jugador ${user.nickname} se ha desconectado.`
                            });

                            // Actualizar al que se queda
                            const partidaActualizada = await lobbyService.getEstadoPartida(partidaId);
                            io.to(`lobby_${partidaId}`).emit('estadoSala', partidaActualizada);
                            
                            const partidas = await lobbyService.listarPartidas();
                            io.emit('listaPartidas', partidas);
                        } catch (err) {
                            // Ignorar si la partida ya no existe
                        }
                    }, 5000); // 5 segundos para recargar la página

                    userManager.setDisconnectTimeout(user.id, timeoutId);
                }
            } catch (error) {
                console.error('[BACKEND][index] ❌ Error al gestionar desconexión:', error.message);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`Cliente desconectado: ${socket.id}`);
        userManager.logoutUser(socket.id);
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