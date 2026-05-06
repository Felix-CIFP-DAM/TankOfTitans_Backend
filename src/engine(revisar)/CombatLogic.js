
export class CombatLogic {
    
    
     //Calcula el daño final basado en ataque/defensa y un factor aleatorio.
     
    static calculateDamage(attacker, defender) {
        const baseDamage = (attacker.attack / defender.defense) * 50;
        
        // Factor aleatorio entre 0.85 y 1.15 (15% de variación)
        const randomMultiplier = Math.random() * (1.15 - 0.85) + 0.85;
        
        return Math.round(baseDamage * randomMultiplier);
    }

    
     //Calcula la distancia Manhattan entre dos objetos con coordenadas x e y.
    
    static getDistance(objA, objB) {
        return Math.abs(objA.x - objB.x) + Math.abs(objA.y - objB.y);
    }

    
     //Valida si el objetivo está dentro del rango de ataque.
     
    static isInRange(attacker, defender) {
        const distance = this.getDistance(attacker, defender);
        return distance <= attacker.attackRange;
    }

    
     //Verifica si una casilla específica está ocupada por algún tanque vivo.
     
    static isTileOccupied(targetX, targetY, allTanks) {
        return allTanks.some(t => t.isAlive() && t.x === targetX && t.y === targetY);
    }

    /**
     * Valida si un movimiento es posible.
     * @param {Object} tank - El tanque que se quiere mover.
     * @param {number} targetX - Coordenada X de destino.
     * @param {number} targetY - Coordenada Y de destino.
     * @param {Array} allTanks - Lista de todos los tanques para verificar colisiones.
     */
    static isValidMove(tank, targetX, targetY, allTanks) {
        const distance = Math.abs(tank.x - targetX) + Math.abs(tank.y - targetY);
        
        // 1. ¿Está dentro de su rango de movimiento?
        if (distance > tank.moveRange) return false;

        // 2. ¿La casilla de destino está libre?
        if (this.isTileOccupied(targetX, targetY, allTanks)) return false;

        return true;
    }
}
