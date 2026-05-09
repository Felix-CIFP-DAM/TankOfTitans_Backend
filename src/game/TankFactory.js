const TANK_STATS = {
    SUPERPESADO: {
        hp: 120,
        ataque: 40,
        defensa: 80,
        rangoAtaque: 1,
        rangoMovimiento: 1
    },
    LIGERO: {
        hp: 50,
        ataque: 90,
        defensa: 20,
        rangoAtaque: 2,
        rangoMovimiento: 4
    },
    ARTILLERIA: {
        hp: 70,
        ataque: 100,
        defensa: 30,
        rangoAtaque: 5,
        rangoMovimiento: 1
    }
};

class TankFactory {

    // Crea un tanque con sus stats según el tipo
    static crear(numeroTanque, tipo, propietarioId, posX, posY) {
        const stats = TANK_STATS[tipo];

        if (!stats) {
            throw new Error(`Tipo de tanque desconocido: ${tipo}`);
        }

        return {
            id: `${propietarioId}_tanque_${numeroTanque}`,
            numeroTanque,
            tipo,
            propietarioId,
            hp: stats.hp,
            hpMax: stats.hp,
            ataque: stats.ataque,
            defensa: stats.defensa,
            rangoAtaque: stats.rangoAtaque,
            rangoMovimiento: stats.rangoMovimiento,
            posX,
            posY,
            vivo: true,
            haMovido: false,
            haAtacado: false
        };
    }

    // Resetea las acciones del tanque al inicio de cada turno
    static resetAcciones(tanque) {
        tanque.haMovido = false;
        tanque.haAtacado = false;
        return tanque;
    }

    static getStats(tipo) {
        return TANK_STATS[tipo] || null;
    }
}

module.exports = TankFactory;