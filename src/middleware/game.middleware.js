const userManager = require('../utils/UserManager');
const gameManager = require('../game/GameManager');

// Uso: llámalo dentro de los eventos del game.handler antes de ejecutar lógica
const gameMiddleware = (socket, partidaId) => {
    const user = userManager.getUser(socket.id);

    if (!user) {
        return { error: 'No has iniciado sesión' };
    }

    const gameState = gameManager.get(partidaId);

    if (!gameState) {
        return { error: 'Partida no encontrada' };
    }

    const player = gameState.jugadores[user.id] || 
                   Object.values(gameState.jugadores).find(j => String(j.id) === String(user.id));

    if (!player) {
        console.warn(`[BACKEND][game.middleware] ⚠️ Usuario ${user.id} (${user.nickname}) intentó actuar en partida ${partidaId} pero no figura como jugador.`);
        return { error: 'No estás en esta partida' };
    }

    return { user, gameState, player };
};

module.exports = gameMiddleware;