const GameState = require('./GameState');

class GameManager {
    constructor() {
        this.partidas = new Map(); // partidaId → GameState
    }

    // Crea y guarda una nueva partida
    crear(partidaId, jugador1, jugador2, mapa) {
        if (this.partidas.has(partidaId)) {
            throw new Error(`La partida ${partidaId} ya existe`);
        }
        const gameState = new GameState(partidaId, jugador1, jugador2, mapa);
        this.partidas.set(partidaId, gameState);
        return gameState;
    }

    // Obtiene una partida por ID
    get(partidaId) {
        return this.partidas.get(partidaId) || null;
    }

    // Elimina una partida
    delete(partidaId) {
        return this.partidas.delete(partidaId);
    }

    // Comprueba si existe una partida
    existe(partidaId) {
        return this.partidas.has(partidaId);
    }

    // Lista todas las partidas activas
    getAll() {
        return Array.from(this.partidas.values());
    }

    // Busca la partida en la que está un jugador
    getPartidaDeJugador(jugadorId) {
        for (const [, gameState] of this.partidas) {
            if (gameState.jugadores[jugadorId]) {
                return gameState;
            }
        }
        return null;
    }
}

const gameManager = new GameManager();
module.exports = gameManager;