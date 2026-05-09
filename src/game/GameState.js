const TankFactory = require('./TankFactory');
const CombatManager = require('./CombatManager');
const GameTimer = require('../utils/timer.utils');
const gameService = require('../services/game.service');

const INITIAL_PA = 5;
const COST_MOVER = 1;
const COST_ATACAR = 2;

class GameState {
    constructor(partidaId, jugador1, jugador2, mapa) {
        this.partidaId = partidaId;
        this.mapa = mapa; // { id, nombre, casillas }
        this.jugadores = {
            [jugador1.id]: {
                ...jugador1,
                pa: INITIAL_PA,
                tanquesSeleccionados: [] // tipos elegidos antes de iniciar
            },
            [jugador2.id]: {
                ...jugador2,
                pa: INITIAL_PA,
                tanquesSeleccionados: []
            }
        };
        this.tanques = [];
        this.turnoActual = jugador1.id;
        this.estado = 'SELECCION'; // SELECCION → JUGANDO → FINALIZADA
        this.timer = null;
        this.fechaInicio = null;
    }

    // Jugador selecciona sus 3 tanques antes de empezar
    seleccionarTanques(jugadorId, tipos) {
        if (this.estado !== 'SELECCION') {
            return { error: 'La partida ya ha comenzado' };
        }
        if (!this.jugadores[jugadorId]) {
            return { error: 'Jugador no encontrado' };
        }
        if (tipos.length !== 3) {
            return { error: 'Debes seleccionar exactamente 3 tanques' };
        }

        const tiposValidos = ['SUPERPESADO', 'LIGERO', 'ARTILLERIA'];
        for (const tipo of tipos) {
            if (!tiposValidos.includes(tipo)) {
                return { error: `Tipo de tanque inválido: ${tipo}` };
            }
        }

        this.jugadores[jugadorId].tanquesSeleccionados = tipos;
        return { success: true };
    }

    // Comprueba si ambos jugadores han seleccionado sus tanques
    ambosListos() {
        return Object.values(this.jugadores)
            .every(j => j.tanquesSeleccionados.length === 3);
    }

    // Despliega los tanques y arranca la partida
    iniciar() {
        if (!this.ambosListos()) {
            return { error: 'Ambos jugadores deben seleccionar sus tanques' };
        }

        const jugadorIds = Object.keys(this.jugadores);

        // Posiciones iniciales: J1 en columna 0, J2 en columna 11
        jugadorIds.forEach((jId, index) => {
            const jugador = this.jugadores[jId];
            jugador.tanquesSeleccionados.forEach((tipo, i) => {
                const posX = index === 0 ? 0 : 11;
                const posY = i * 2; // 0, 2, 4
                const tanque = TankFactory.crear(i + 1, tipo, jId, posX, posY);
                this.tanques.push(tanque);
            });
        });

        this.estado = 'JUGANDO';
        this.fechaInicio = new Date();

        // Arranca el timer con guardado periódico
        this.timer = new GameTimer(
            this.partidaId,
            () => this._guardarEstadoPeriodico(),
            () => this._finalizarPorTiempo()
        );
        this.timer.start();

        return { success: true };
    }

    // Mover un tanque
    mover(jugadorId, tanqueId, targetX, targetY) {
        if (this.estado !== 'JUGANDO') return { error: 'La partida no está activa' };
        if (this.turnoActual !== jugadorId) return { error: 'No es tu turno' };

        const jugador = this.jugadores[jugadorId];
        if (jugador.pa < COST_MOVER) return { error: 'PA insuficientes' };

        const tanque = this.tanques.find(
            t => t.id === tanqueId && t.propietarioId === jugadorId
        );
        if (!tanque) return { error: 'Tanque no encontrado' };

        const resultado = CombatManager.mover(
            tanque, targetX, targetY,
            this.tanques, this.mapa.casillas
        );

        if (resultado.error) return resultado;

        jugador.pa -= COST_MOVER;
        return { success: true, tanque, paRestantes: jugador.pa };
    }

    // Atacar con un tanque
    atacar(jugadorId, atacanteId, defensorId) {
        if (this.estado !== 'JUGANDO') return { error: 'La partida no está activa' };
        if (this.turnoActual !== jugadorId) return { error: 'No es tu turno' };

        const jugador = this.jugadores[jugadorId];
        if (jugador.pa < COST_ATACAR) return { error: 'PA insuficientes' };

        const atacante = this.tanques.find(
            t => t.id === atacanteId && t.propietarioId === jugadorId
        );
        const defensor = this.tanques.find(t => t.id === defensorId);

        if (!atacante || !defensor) return { error: 'Tanque no encontrado' };

        const resultado = CombatManager.atacar(atacante, defensor);
        if (resultado.error) return resultado;

        jugador.pa -= COST_ATACAR;

        // Comprueba si la partida ha acabado
        const finPartida = this._comprobarVictoriaPorDestruccion();

        return {
            success: true,
            daño: resultado.daño,
            defensorHp: resultado.defensorHp,
            defensorMuerto: resultado.defensorMuerto,
            paRestantes: jugador.pa,
            finPartida
        };
    }

    // Fin de turno — pasa el turno al otro jugador
    finTurno(jugadorId) {
        if (this.estado !== 'JUGANDO') return { error: 'La partida no está activa' };
        if (this.turnoActual !== jugadorId) return { error: 'No es tu turno' };

        const ids = Object.keys(this.jugadores);
        this.turnoActual = ids.find(id => id !== jugadorId);

        // Resetea PA y acciones de tanques del nuevo jugador
        this.jugadores[this.turnoActual].pa = INITIAL_PA;
        this.tanques
            .filter(t => t.propietarioId === this.turnoActual)
            .forEach(t => TankFactory.resetAcciones(t));

        return {
            success: true,
            turnoActual: this.turnoActual,
            pa: INITIAL_PA
        };
    }

    // Abandono de un jugador
    abandonar(jugadorId) {
        const ids = Object.keys(this.jugadores);
        const ganadorId = ids.find(id => id !== jugadorId);
        return this._finalizar(ganadorId, 'ABANDONO');
    }

    // Comprueba si un jugador ha perdido todos sus tanques
    _comprobarVictoriaPorDestruccion() {
        const ids = Object.keys(this.jugadores);

        for (const id of ids) {
            const tanquesVivos = this.tanques.filter(
                t => t.propietarioId === id && t.vivo
            ).length;

            if (tanquesVivos === 0) {
                const ganadorId = ids.find(gId => gId !== id);
                return this._finalizar(ganadorId, 'DESTRUCCION');
            }
        }
        return null;
    }

    // Finalizar por tiempo
    _finalizarPorTiempo() {
        const ids = Object.keys(this.jugadores);
        const vivosJ1 = this.tanques.filter(
            t => t.propietarioId === ids[0] && t.vivo
        ).length;
        const vivosJ2 = this.tanques.filter(
            t => t.propietarioId === ids[1] && t.vivo
        ).length;

        let ganadorId;
        let razon;

        if (vivosJ1 > vivosJ2) {
            ganadorId = ids[0];
            razon = 'TIEMPO';
        } else if (vivosJ2 > vivosJ1) {
            ganadorId = ids[1];
            razon = 'TIEMPO';
        } else {
            ganadorId = 'EMPATE';
            razon = 'TIEMPO_EMPATE';
        }

        return this._finalizar(ganadorId, razon);
    }

    // Finaliza la partida y guarda el resultado en la API
    _finalizar(ganadorId, razon) {
        this.estado = 'FINALIZADA';
        if (this.timer) this.timer.stop();

        const ids = Object.keys(this.jugadores);
        const duracion = this.fechaInicio
            ? Math.floor((new Date() - this.fechaInicio) / 1000)
            : 0;

        const tanquesMuertosJ1 = this.tanques.filter(
            t => t.propietarioId === ids[0] && !t.vivo
        ).length;
        const tanquesMuertosJ2 = this.tanques.filter(
            t => t.propietarioId === ids[1] && !t.vivo
        ).length;

        const empate = ganadorId === 'EMPATE';

        gameService.guardarResultado(
            this.partidaId,
            empate ? null : ganadorId,
            empate ? null : ids.find(id => id !== ganadorId),
            empate,
            duracion,
            tanquesMuertosJ1,
            tanquesMuertosJ2
        ).catch(error => {
            console.error('Error al guardar resultado:', error.message);
        });

        return {
            ganadorId,
            razon,
            duracion,
            tanquesMuertosJ1,
            tanquesMuertosJ2
        };
    }

    // Guardado periódico del estado
    async _guardarEstadoPeriodico() {
        try {
            const jugadoresEstado = Object.values(this.jugadores).map(j => ({
                usuarioId: j.id,
                nickname: j.nickname,
                tanquesMuertos: this.tanques.filter(
                    t => t.propietarioId === j.id && !t.vivo
                ).length,
                tanques: this.tanques
                    .filter(t => t.propietarioId === j.id)
                    .map(t => ({
                        numeroTanque: t.numeroTanque,
                        tipo: t.tipo,
                        hp: t.hp,
                        vivo: t.vivo,
                        posX: t.posX,
                        posY: t.posY
                    }))
            }));

            await gameService.guardarEstado(this.partidaId, jugadoresEstado);
            console.log(`Estado de partida ${this.partidaId} guardado correctamente`);
        } catch (error) {
            console.error('Error al guardar estado periódico:', error.message);
        }
    }

    // Devuelve el estado completo para enviarlo a los clientes
    getEstado() {
        return {
            partidaId: this.partidaId,
            estado: this.estado,
            turnoActual: this.turnoActual,
            timeLeft: this.timer ? this.timer.getTimeLeft() : 0,
            jugadores: Object.values(this.jugadores).map(j => ({
                id: j.id,
                nickname: j.nickname,
                pa: j.pa
            })),
            tanques: this.tanques
        };
    }
}

module.exports = GameState;