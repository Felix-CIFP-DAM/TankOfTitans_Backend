const { isValidMove, isValidAttack } = require('../utils/validators.utils');

class CombatManager {
    // daño = (atacante.ataque / defensor.defensa) * 50 * random(0.85, 1.15)
    static calcularDaño(atacante, defensor) {
        if (!atacante || !defensor) return 0;

        const defensa = Math.max(1, defensor.defensa);
        const dañoBase = (atacante.ataque / defensa) * 50;
        const factorAleatorio = Math.random() * (1.15 - 0.85) + 0.85;

        return Math.round(dañoBase * factorAleatorio);
    }

    // Aplica el daño al defensor y marca si ha muerto
    static aplicarDaño(atacante, defensor) {
        const daño = this.calcularDaño(atacante, defensor);
        defensor.hp -= daño;

        if (defensor.hp <= 0) {
            defensor.hp = 0;
            defensor.vivo = false;
        }

        return {
            daño,
            defensorHp: defensor.hp,
            defensorMuerto: !defensor.vivo
        };
    }

    // Valida y ejecuta un movimiento
    static mover(tanque, targetX, targetY, todosTanques, casillas) {
        if (!tanque.vivo) {
            return { error: 'El tanque está destruido' };
        }
        if (tanque.haMovido) {
            return { error: 'Este tanque ya se ha movido este turno' };
        }
        if (!isValidMove(tanque, targetX, targetY, todosTanques, casillas)) {
            return { error: 'Movimiento inválido' };
        }

        tanque.posX = targetX;
        tanque.posY = targetY;
        tanque.haMovido = true;

        return { success: true, tanque };
    }

    // Valida y ejecuta un ataque
    static atacar(atacante, defensor) {
        if (!atacante.vivo) {
            return { error: 'El tanque atacante está destruido' };
        }
        if (!defensor.vivo) {
            return { error: 'El objetivo ya está destruido' };
        }
        if (atacante.haAtacado) {
            return { error: 'Este tanque ya ha atacado este turno' };
        }
        if (!isValidAttack(atacante, defensor)) {
            return { error: 'El objetivo está fuera del rango de ataque' };
        }

        // Artillería no puede mover y atacar en el mismo turno
        if (atacante.tipo === 'ARTILLERIA' && atacante.haMovido) {
            return { error: 'La artillería no puede mover y atacar en el mismo turno' };
        }

        const resultado = this.aplicarDaño(atacante, defensor);
        atacante.haAtacado = true;

        return {
            success: true,
            daño: resultado.daño,
            defensorHp: resultado.defensorHp,
            defensorMuerto: resultado.defensorMuerto
        };
    }
}

module.exports = CombatManager;
