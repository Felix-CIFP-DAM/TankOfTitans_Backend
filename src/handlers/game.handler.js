const gameManager = require('../game/GameManager');
const userManager = require('../utils/UserManager');

module.exports = (io, socket) => {

    // Jugador selecciona sus 3 tanques
    socket.on('seleccionarTanques', (payload) => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId, tipos } = payload;
            const gameState = gameManager.get(partidaId);

            if (!gameState) {
                socket.emit('error', { error: 'Partida no encontrada' });
                return;
            }

            const resultado = gameState.seleccionarTanques(user.id, tipos);
            if (resultado.error) {
                socket.emit('error', resultado);
                return;
            }

            socket.emit('tanquesSeleccionados', { success: true });

            // Si ambos jugadores han seleccionado arrancamos
            if (gameState.ambosListos()) {
                const iniciado = gameState.iniciar((timeLeft) => {
                    io.to(`game_${partidaId}`).emit('tick', { timeLeft });
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
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId, tanqueId, targetX, targetY } = payload;
            const gameState = gameManager.get(partidaId);

            if (!gameState) {
                socket.emit('error', { error: 'Partida no encontrada' });
                return;
            }

            const resultado = gameState.mover(user.id, tanqueId, targetX, targetY);

            if (resultado.error) {
                socket.emit('error', resultado);
                return;
            }

            // Notifica a ambos jugadores el nuevo estado
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
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId, atacanteId, defensorId } = payload;
            const gameState = gameManager.get(partidaId);

            if (!gameState) {
                socket.emit('error', { error: 'Partida no encontrada' });
                return;
            }

            const resultado = gameState.atacar(user.id, atacanteId, defensorId);

            if (resultado.error) {
                socket.emit('error', resultado);
                return;
            }

            // Notifica a ambos jugadores
            io.to(`game_${partidaId}`).emit('ataqueRealizado', {
                daño: resultado.daño,
                defensorId,
                defensorHp: resultado.defensorHp,
                defensorMuerto: resultado.defensorMuerto,
                paRestantes: resultado.paRestantes,
                estado: gameState.getEstado()
            });

            // Si la partida ha acabado notificamos
            if (resultado.finPartida) {
                io.to(`game_${partidaId}`).emit('partidaFinalizada', resultado.finPartida);
                gameManager.delete(partidaId);
            }

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Fin de turno
    socket.on('finTurno', (payload) => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId } = payload;
            const gameState = gameManager.get(partidaId);

            if (!gameState) {
                socket.emit('error', { error: 'Partida no encontrada' });
                return;
            }

            const resultado = gameState.finTurno(user.id);

            if (resultado.error) {
                socket.emit('error', resultado);
                return;
            }

            io.to(`game_${partidaId}`).emit('turnocambiado', {
                turnoActual: resultado.turnoActual,
                pa: resultado.pa,
                estado: gameState.getEstado()
            });

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Abandono
    socket.on('abandonar', async (payload) => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId } = payload;
            const gameState = gameManager.get(partidaId);

            if (!gameState) {
                socket.emit('error', { error: 'Partida no encontrada' });
                return;
            }

            const resultado = await gameState.abandonar(user.id);

            io.to(`game_${partidaId}`).emit('partidaFinalizada', resultado);
            gameManager.delete(partidaId);

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });
};