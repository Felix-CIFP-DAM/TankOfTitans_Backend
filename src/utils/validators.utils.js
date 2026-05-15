// Comprueba si una posición está dentro del tablero
const isInsideBoard = (x, y, casillas) => {
    if (!casillas || casillas.length === 0) return false;
    const rows = casillas.length;
    const cols = casillas[0].length;
    return x >= 0 && x < cols && y >= 0 && y < rows;
};

// Comprueba si una casilla es transitable según el mapa
const isTransitable = (x, y, data) => {
    if (!data || !data.suelo) return false;
    if (!isInsideBoard(x, y, data.suelo)) return false;
    
    const ground = data.suelo[y][x];
    const object = data.objetos ? data.objetos[y][x] : null;
    
    const groundTransitable = ground ? (ground.tipo !== 'No_Transitable' && ground.transitable !== false) : false;
    const objectTransitable = object ? (object.tipo !== 'No_Transitable' && object.transitable !== false) : true;
    
    return groundTransitable && objectTransitable;
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
const isValidMove = (tank, targetX, targetY, allTanks, mapData) => {
    if (!tank) return false;
    if (!isInsideBoard(targetX, targetY, mapData.suelo)) return false;
    if (!isTransitable(targetX, targetY, mapData)) return false;
    if (isTileOccupied(targetX, targetY, allTanks)) return false;

    const distance = getDistance(tank.posX, tank.posY, targetX, targetY);
    if (distance > tank.rangoMovimiento) return false;

    return true;
};

// Valida si un objetivo está en rango de ataque
const isValidAttackRange = (attacker, targetX, targetY) => {
    const distance = getDistance(
        attacker.posX, attacker.posY,
        targetX, targetY
    );
    return distance > 0 && distance <= (attacker.rangoAtaque || 5);
};

// Valida si un ataque a un tanque específico es posible
const isValidAttack = (attacker, target) => {
    if (!target || !target.vivo) return false;
    return isValidAttackRange(attacker, target.posX, target.posY);
};

module.exports = {
    isInsideBoard,
    isTransitable,
    isTileOccupied,
    getDistance,
    isValidMove,
    isValidAttack,
    isValidAttackRange
};