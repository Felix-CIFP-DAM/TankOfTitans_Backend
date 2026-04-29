import { Tank } from '../entities/Tank.js';
import { CombatLogic } from './CombatLogic.js';
import { GAME_CONFIG } from '../core/constants/TankStats.js';

export class GameSession {
    constructor(gameId, player1, player2) {
        this.gameId = gameId;
        this.players = {
            [player1.id]: player1,
            [player2.id]: player2
        };
        this.tanks = [];
        this.turnOwnerId = player1.id;
        this.status = 'WAITING';
        
        this.timeLeft = GAME_CONFIG.GAME_DURATION_MIN * 60;
        this.timerInterval = null;
    }

    /**
     * Comprueba si ambos jugadores tienen sus 3 tanques seleccionados.
     */
    canStart() {
        // Corregido: .length (no .lenght)
        return Object.values(this.players).every(p => p.selectedTanks.length === 3);
    }

    /**
     * Prepara el tablero, coloca los tanques y arranca el cronómetro.
     */
    initGame(onTick) {
        // Validamos si podemos empezar antes de ejecutar la lógica
        if (!this.canStart()) {
            console.error("No se puede iniciar: Faltan tanques por elegir");
            return false;
        }

        const playerIds = Object.keys(this.players);
        
        playerIds.forEach((pid, index) => {
            const player = this.players[pid];
            player.pa = GAME_CONFIG.INITIAL_PA;

            player.selectedTanks.forEach((type, i) => {
                const startX = index === 0 ? 0 : 9;
                const startY = i * 2; 
                const tankId = `tank_${pid}_${i}`;
                
                this.tanks.push(new Tank(tankId, type, pid, { x: startX, y: startY }));
            });
        });

        this.status = 'PLAYING';
        this.startTimer(onTick);
        return true;
    }

    /**
     * Inicia el contador regresivo en el servidor.
     */
    startTimer(onTick) {
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            
            if (onTick) onTick(this.timeLeft);

            if (this.timeLeft <= 0) {
                this.finishGame(this.calculateTimeUpWinner(), "TIME_UP");
            }
        }, 1000);
    }

    /**
     * Lógica de movimiento con validación de PA, rango y ocupación.
     */
    moveTank(playerId, tankId, newX, newY) {
        if (this.status !== 'PLAYING') return { error: "La partida no está activa" };
        if (this.turnOwnerId !== playerId) return { error: "No es tu turno" };
        
        const player = this.players[playerId];
        const tank = this.tanks.find(t => t.id === tankId && t.ownerId === playerId);

        if (!tank || !tank.isAlive()) return { error: "Tanque no disponible" };
        if (tank.hasMoved) return { error: "Este tanque ya se ha movido este turno" };
        if (player.pa < GAME_CONFIG.COSTS.MOVE) return { error: "Puntos de Acción (PA) insuficientes" };
        
        // Comprobar si el movimiento es válido y la casilla está libre
        // Pasamos this.tanks para que CombatLogic pueda revisar si hay alguien más allí
        if (CombatLogic.isValidMove(tank, newX, newY, this.tanks)) {
            tank.moveTo(newX, newY);
            player.pa -= GAME_CONFIG.COSTS.MOVE;
            return { success: true, tank, remainingPA: player.pa };
        }
        
        return { error: "Movimiento inválido (fuera de rango o casilla ocupada)" };
    }

    /**
     * Lógica de ataque con cálculo de daño y validación de rango.
     */
    attackTank(playerId, attackerId, targetId) {
        if (this.status !== 'PLAYING') return { error: "La partida no está activa" };
        if (this.turnOwnerId !== playerId) return { error: "No es tu turno" };

        const player = this.players[playerId];
        const attacker = this.tanks.find(t => t.id === attackerId && t.ownerId === playerId);
        const target = this.tanks.find(t => t.id === targetId);

        if (!attacker || !target || !target.isAlive()) return { error: "Objetivo no válido" };
        if (attacker.hasAttacked) return { error: "Este tanque ya ha atacado este turno" };
        if (player.pa < GAME_CONFIG.COSTS.ATTACK) return { error: "Puntos de Acción (PA) insuficientes" };

        if (CombatLogic.isInRange(attacker, target)) {
            const damage = CombatLogic.calculateDamage(attacker, target);
            target.takeDamage(damage);
            attacker.hasAttacked = true;
            player.pa -= GAME_CONFIG.COSTS.ATTACK;

            const destructionResult = this.checkDestructionVictory();
            
            return { 
                success: true, 
                damage, 
                targetId: target.id, 
                targetHP: target.hp, 
                remainingPA: player.pa,
                gameOver: destructionResult 
            };
        }

        return { error: "El objetivo está fuera del rango de ataque" };
    }

    /**
     * Cambia el turno al oponente y regenera recursos.
     */
    nextTurn() {
        const ids = Object.keys(this.players);
        this.turnOwnerId = (this.turnOwnerId === ids[0]) ? ids[1] : ids[0];
        
        this.players[this.turnOwnerId].pa = GAME_CONFIG.INITIAL_PA;
        this.tanks
            .filter(t => t.ownerId === this.turnOwnerId)
            .forEach(t => t.resetActions());

        return { currentTurn: this.turnOwnerId, pa: GAME_CONFIG.INITIAL_PA };
    }

    /**
     * Gestiona el abandono de un jugador.
     */
    handleAbandonment(leaverId) {
        if (this.status === 'FINISHED') return;

        const playerIds = Object.keys(this.players);
        const winnerId = playerIds.find(id => id !== leaverId);

        return this.finishGame(winnerId, "ABANDONMENT");
    }

    /**
     * Verifica si un jugador ha perdido todos sus tanques.
     */
    checkDestructionVictory() {
        const playerIds = Object.keys(this.players);
        const p1Alive = this.tanks.filter(t => t.ownerId === playerIds[0] && t.isAlive()).length;
        const p2Alive = this.tanks.filter(t => t.ownerId === playerIds[1] && t.isAlive()).length;

        if (p1Alive === 0) return this.finishGame(playerIds[1], "DESTRUCTION");
        if (p2Alive === 0) return this.finishGame(playerIds[0], "DESTRUCTION");
        
        return null;
    }

    /**
     * Define el ganador cuando se acaba el tiempo.
     */
    calculateTimeUpWinner() {
        const ids = Object.keys(this.players);
        const p1Alive = this.tanks.filter(t => t.ownerId === ids[0] && t.isAlive()).length;
        const p2Alive = this.tanks.filter(t => t.ownerId === ids[1] && t.isAlive()).length;

        if (p1Alive > p2Alive) return ids[0];
        if (p2Alive > p1Alive) return ids[1];
        return "DRAW"; 
    }

    /**
     * Cierra la partida y limpia procesos.
     */
    finishGame(winnerId, reason) {
        this.status = 'FINISHED';
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        return {
            gameId: this.gameId,
            winnerId: winnerId,
            reason: reason,
            status: 'FINISHED'
        };
    }
}