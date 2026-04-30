import { TANK_STATS } from '../core/constants/TankStats.js';

export class Tank {
    constructor(id, type, ownerId, position) {
        const stats = TANK_STATS[type];
        this.id = id;
        this.type = type;
        this.ownerId = ownerId;
        this.hp = stats.hp;
        this.maxHp = stats.hp;
        this.attack = stats.attack;
        this.defense = stats.defense;
        this.moveRange = stats.moveRange;
        this.attackRange = stats.attackRange;
        this.x = position.x;
        this.y = position.y;
        this.hasMoved = false; // Útil para la regla de la Artillería por si queremos añadirla
        this.hasAttacked = false;
    }

    isAlive() {
        return this.hp > 0;
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
    }
}