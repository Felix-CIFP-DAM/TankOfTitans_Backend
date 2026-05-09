const BOARD_WIDTH = 12;
const BOARD_HEIGHT = 8;

// Comprueba si una posición está dentro del tablero
const isInsideBoard = (x, y) => {
    return x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT;
};

// Comprueba si una casilla es transitable según el mapa
const isTransitable = (x, y, casillas) => {
    const casilla = casillas.find(c => c.posX === x && c.posY === y);
    return casilla ? casilla.transitable : false;
};

// Comprueba si una casilla está ocupada por algún tanque vivo
const isTileOccupied = (x, y, tanks) => {
    return tanks.some(t => t.vivo && t.posX === x && t.posY === y);
};

// Distancia Manhattan entre dos posiciones
const getDistance = (x1, y1, x2, y2) => {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
};

// Valida si un movimiento es posible
const isValidMove = (tank, targetX, targetY, allTanks, casillas) => {
    if (!tank) return false;
    if (!isInsideBoard(targetX, targetY)) return false;
    if (!isTransitable(targetX, targetY, casillas)) return false;
    if (isTileOccupied(targetX, targetY, allTanks)) return false;

    const distance = getDistance(tank.posX, tank.posY, targetX, targetY);
    if (distance > tank.rangoMovimiento) return false;

    return true;
};

// Valida si un ataque es posible
const isValidAttack = (attacker, target) => {
    if (!target.vivo) return false;
    const distance = getDistance(
        attacker.posX, attacker.posY,
        target.posX, target.posY
    );
    return distance <= attacker.rangoAtaque;
};

module.exports = {
    isInsideBoard,
    isTransitable,
    isTileOccupied,
    getDistance,
    isValidMove,
    isValidAttack
};