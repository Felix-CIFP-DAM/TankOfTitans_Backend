export const TANK_TYPES = {
    SUPERHEAVY: 'SUPERHEAVY',
    LIGHT: 'LIGHT',
    ARTILLERY: 'ARTILLERY'
};

export const TANK_STATS = {
    [TANK_TYPES.SUPERHEAVY]: {
        hp: 120,
        attack: 40,
        defense: 80,
        moveRange: 1,
        attackRange: 1
    },
    [TANK_TYPES.LIGHT]: {
        hp: 50,
        attack: 90,
        defense: 20,
        moveRange: 4,
        attackRange: 2
    },
    [TANK_TYPES.ARTILLERY]: {
        hp: 70,
        attack: 100,
        defense: 30,
        moveRange: 1,
        attackRange: 5
    }
};

export const GAME_CONFIG = {
    TANKS_PER_PLAYER: 3,
    MAX_PA: 5,
    INITIAL_PA: 5
};