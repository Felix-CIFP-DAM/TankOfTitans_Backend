export const TANK_TYPES = {
    SUPERHEAVY: 'SUPERHEAVY',
    MEDIUM: 'MEDIUM',
    LIGHT: 'LIGHT'
};

/**
 * Estadísticas base para cada tipo de tanque.
 * HP: Puntos de vida.
 * attack: Poder ofensivo base.
 * defense: Capacidad de mitigar daño.
 * moveRange: Cuántas casillas puede desplazarse.
 * attackRange: Distancia máxima a la que puede golpear.
 */

export const TANK_STATS = {
    [TANK_TYPES.SUPERHEAVY]: {
        hp: 120,
        attack: 40,
        defense: 80,
        moveRange: 1,
        attackRange: 1
    },
    [TANK_TYPES.MEDIUM]: {
        hp: 85,
        attack: 65,
        defense: 50,
        moveRange: 2,
        attackRange: 2
    },
    [TANK_TYPES.LIGHT]: {
        hp: 50,
        attack: 90,
        defense: 20,
        moveRange: 4,
        attackRange: 2
    }
};

//Configuración general de la partida.

export const GAME_CONFIG = {
    TANKS_PER_PLAYER: 3,        // Cada jugador elige 3 tanques
    MAX_PA: 5,                  // Límite máximo de Puntos de Acción
    INITIAL_PA: 5,              // PA con los que se empieza cada turno
    GAME_DURATION_MIN: 15,      // Duración de la partida (15 min)
    
    // Costes de acción (opcional, para que Node.js sepa cuánto restar)
    COSTS: {
        MOVE: 1,
        ATTACK: 2
    }
};