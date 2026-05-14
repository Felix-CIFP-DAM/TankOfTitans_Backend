const userManager = require('../utils/UserManager');
const gameManager = require('../game/GameManager');

// Uso: llamar dentro de los eventos del game.handler antes de ejecutar lógica
const gameMiddleware = (socket, partidaId) => {
    const user = userManager.getUser(socket.id);

    if (!user) {
        return { error: 'No has iniciado sesión' };
    }

    const gameState = gameManager.get(partidaId);

    if (!gameState) {
        return { error: 'Partida no encontrada' };
    }

    if (!gameState.jugadores[user.id]) {
        return { error: 'No estás en esta partida' };
    }

    return { user, gameState };
};

module.exports = gameMiddleware;