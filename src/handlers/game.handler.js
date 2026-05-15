const userManager = require('../utils/UserManager');
const gameManager = require('../game/GameManager');
const gameMiddleware = require('../middleware/game.middleware');

module.exports = (io, socket) => {

    // Obtener estado de la partida
    socket.on('obtenerEstadoPartida', (payload) => {
        try {
            console.log('[BACKEND][game.handler] 📥 Evento obtenerEstadoPartida recibido:', payload.partidaId);
            const { partidaId } = payload;
            
            // Asegurarnos de que está unido a la sala del socket para recibir broadcast
            socket.join(`game_${partidaId}`);

            const check = gameMiddleware(socket, partidaId);
            if (check.error) {
                socket.emit('error', check);
                return;
            }

            const { gameState } = check;

            socket.emit('estadoPartida', {
                estado: gameState.getEstado()
            });

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Jugador coloca uno de sus tanques en el mapa
    socket.on('colocarTanque', (payload) => {
        try {
            console.log('[BACKEND][game.handler] 📥 Evento colocarTanque recibido:', payload.partidaId);
            const { partidaId, tanqueId, x, y, tanqueData } = payload;

            const check = gameMiddleware(socket, partidaId);
            if (check.error) {
                socket.emit('error', check);
                return;
            }

            const { user, gameState } = check;

            const resultado = gameState.colocarTanque(user.id, tanqueId, x, y, tanqueData);
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

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Jugador confirma que ha terminado de colocar
    socket.on('confirmarColocacion', (payload) => {
        try {
            const { partidaId } = payload;
            const check = gameMiddleware(socket, partidaId);
            if (check.error) return socket.emit('error', check);

            const { user, gameState } = check;
            const resultado = gameState.confirmarColocacion(user.id);
            if (resultado.error) return socket.emit('error', resultado);

            io.to(`game_${partidaId}`).emit('jugadorListoColocacion', { 
                jugadorId: user.id,
                estado: gameState.getEstado()
            });

            if (gameState.ambosListos()) {
                const iniciado = gameState.iniciar((timeoutData) => {
                    io.to(`game_${partidaId}`).emit('turnoCambiado', timeoutData);
                });
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
            console.log('[BACKEND][game.handler] 📥 Evento moverTanque recibido:', payload.partidaId);
            const { partidaId, tanqueId, targetX, targetY } = payload;
 
            const check = gameMiddleware(socket, partidaId);
            if (check.error) {
                socket.emit('error', check);
                return;
            }
 
            const { user, gameState } = check;
 
            const resultado = gameState.mover(user.id, tanqueId, Number(targetX), Number(targetY));
            if (resultado.error) {
                socket.emit('error', resultado);
                return;
            }
 
            io.to(`game_${partidaId}`).emit('tanqueMovido', {
                tanque: resultado.tanque,
                paRestantes: resultado.paRestantes,
                estado: gameState.getEstado()
            });
        } catch (e) {
            console.error('[BACKEND][game.handler] Error en moverTanque:', e);
            socket.emit('error', { error: 'Error interno al mover el tanque' });
        }
    });

    // Atacar con un tanque
    socket.on('atacar', (payload) => {
        try {
            console.log('[BACKEND][game.handler] 📥 Evento atacar recibido:', payload.partidaId);
            const { partidaId, atacanteId, targetX, targetY } = payload;
 
            const check = gameMiddleware(socket, partidaId);
            if (check.error) {
                socket.emit('error', check);
                return;
            }
 
            const { user, gameState } = check;
 
            const resultado = gameState.atacar(user.id, atacanteId, Number(targetX), Number(targetY));
            if (resultado.error) {
                socket.emit('error', resultado);
                return;
            }
 
            io.to(`game_${partidaId}`).emit('ataqueRealizado', {
                hit: resultado.hit,
                daño: resultado.daño,
                defensorId: resultado.defensorId,
                defensorHp: resultado.defensorHp,
                defensorMuerto: resultado.defensorMuerto,
                paRestantes: resultado.paRestantes,
                estado: gameState.getEstado()
            });

            if (resultado.finPartida) {
                io.to(`game_${partidaId}`).emit('partidaFinalizada', resultado.finPartida);
                const gameService = require('../services/game.service');
                gameService.resetearPartida(partidaId).catch(console.error);
                // No borramos de gameManager inmediatamente para permitir que el frontend vea el estado final
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
            const gameService = require('../services/game.service');
            gameService.resetearPartida(partidaId).catch(console.error);
            // No borramos inmediatamente
        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });
};