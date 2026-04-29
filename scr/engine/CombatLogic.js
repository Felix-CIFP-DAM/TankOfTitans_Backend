//Clase encargada de los cálculos matemáticos del juego.
//No guarda estado, solo procesa datos de entrada.

export class CombatLogic {
    
     //Calcula el daño final basado en la fórmula:
     //daño = (atacante.ataque / defensor.defensa) * 50 * random(0.85, 1.15)

    static calculateDamage(attacker, defender) {
        const baseDamage = (attacker.attack / defender.defense) * 50;
        
        // Generamos el factor aleatorio entre 0.85 y 1.15
        const randomMultiplier = Math.random() * (1.15 - 0.85) + 0.85;
        
        // Redondeamos para no tener decimales en la vida (HP)
        return Math.round(baseDamage * randomMultiplier);
    }


     //Calcula la distancia Manhattan entre dos puntos.
     //Útil para validar si un objetivo está en rango.
    
    static getDistance(objA, objB) {
        return Math.abs(objA.x - objB.x) + Math.abs(objA.y - objB.y);
    }

    //Valida si el defensor está dentro del rango de ataque del atacante.

    static isInRange(attacker, defender) {
        const distance = this.getDistance(attacker, defender);
        return distance <= attacker.attackRange;
    }

    //Valida si el movimiento es posible según el moveRange.

    static isValidMove(tank, targetX, targetY) {
        const distance = Math.abs(tank.x - targetX) + Math.abs(tank.y - targetY);
        return distance <= tank.moveRange;
    }

    //Verifica si la casilla de destino ya está ocupada por otro tanque.
    static isTileOccupied(targetX, targetY, allTanks) {
    return allTanks.some(t => t.isAlive() && t.x === targetX && t.y === targetY);
    }
}