const userManager = require('../utils/UserManager');
const gameManager = require('../game/GameManager');
const gameMiddleware = require('../middleware/game.middleware');

module.exports = (io, socket) => {

    // Jugador coloca uno de sus tanques en el mapa
    socket.on('colocarTanque', (payload) => {
        try {
            console.log('[BACKEND][game.handler] 📥 Evento colocarTanque recibido:', payload.partidaId);
            const { partidaId, tanqueId, x, y } = payload;

            const check = gameMiddleware(socket, partidaId);
            if (check.error) {
                socket.emit('error', check);
                return;
            }

            const { user, gameState } = check;

            const resultado = gameState.colocarTanque(user.id, tanqueId, x, y);
            if (resultado.error) {
                socket.emit('error', resultado);
                return;
            }

            // Notificar a todos que un tanque ha sido colocado
            io.to(`game_${partidaId}`).emit('tanqueColocado', { 
                tanque: resultado.tanque,
                jugadorId: user.id,
                estado: gameState.getEstado()
            });

            // Si ambos jugadores han terminado de colocar, arrancamos oficialmente
            if (gameState.ambosListos()) {
                const iniciado = gameState.iniciar();

                if (iniciado.error) {
                    io.to(`game_${partidaId}`).emit('error', iniciado);
                    return;
                }

                io.to(`game_${partidaId}`).emit('partidaIniciada', {
                    estado: gameState.getEstado()
                });
            }

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Mover un tanque
    socket.on('moverTanque', (payload) => {
        try {
            console.log('[BACKEND][game.handler]  Evento moverTanque recibido:', payload.partidaId);
            const { partidaId, tanqueId, targetX, targetY } = payload;

            const check = gameMiddleware(socket, partidaId);
            if (check.error) {
                socket.emit('error', check);
                return;
            }

            const { user, gameState } = check;

            const resultado = gameState.mover(user.id, tanqueId, targetX, targetY);
            if (resultado.error) {
                socket.emit('error', resultado);
                return;
            }

            io.to(`game_${partidaId}`).emit('tanqueMovido', {
                tanque: resultado.tanque,
                paRestantes: resultado.paRestantes,
                estado: gameState.getEstado()
            });

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Atacar con un tanque
    socket.on('atacar', (payload) => {
        try {
            console.log('[BACKEND][game.handler] 📥 Evento atacar recibido:', payload.partidaId);
            const { partidaId, atacanteId, defensorId } = payload;

            const check = gameMiddleware(socket, partidaId);
            if (check.error) {
                socket.emit('error', check);
                return;
            }

            const { user, gameState } = check;

            const resultado = gameState.atacar(user.id, atacanteId, defensorId);
            if (resultado.error) {
                socket.emit('error', resultado);
                return;
            }

            io.to(`game_${partidaId}`).emit('ataqueRealizado', {
                daño: resultado.daño,
                defensorId,
                defensorHp: resultado.defensorHp,
                defensorMuerto: resultado.defensorMuerto,
                paRestantes: resultado.paRestantes,
                estado: gameState.getEstado()
            });

            // Si la partida ha acabado notificamos y limpiamos
            if (resultado.finPartida) {
                io.to(`game_${partidaId}`).emit('partidaFinalizada',
                    resultado.finPartida);
                gameManager.delete(partidaId);
            }

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Fin de turno
    socket.on('finTurno', (payload) => {
        try {
            console.log('[BACKEND][game.handler] 📥 Evento finTurno recibido:', payload.partidaId);
            const { partidaId } = payload;

            const check = gameMiddleware(socket, partidaId);
            if (check.error) {
                socket.emit('error', check);
                return;
            }

            const { user, gameState } = check;

            const resultado = gameState.finTurno(user.id);
            if (resultado.error) {
                socket.emit('error', resultado);
                return;
            }

            io.to(`game_${partidaId}`).emit('turnoCambiado', {
                turnoActual: resultado.turnoActual,
                pa: resultado.pa,
                estado: gameState.getEstado()
            });

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Abandono
    socket.on('abandonar', (payload) => {
        try {
            console.log('[BACKEND][game.handler] 📥 Evento abandonar recibido:', payload.partidaId);
            const { partidaId } = payload;

            const check = gameMiddleware(socket, partidaId);
            if (check.error) {
                socket.emit('error', check);
                return;
            }

            const { user, gameState } = check;

            const resultado = gameState.abandonar(user.id);

            io.to(`game_${partidaId}`).emit('partidaFinalizada', resultado);
            gameManager.delete(partidaId);

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });
};