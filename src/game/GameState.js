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
                tanquesSeleccionados: jugador1.tanquesIds || [], // IDs de los tanques elegidos en lobby
                tanquesColocados: [] // tanques ya puestos en mapa
            },
            [jugador2.id]: {
                ...jugador2,
                pa: INITIAL_PA,
                tanquesSeleccionados: jugador2.tanquesIds || [],
                tanquesColocados: []
            }
        };
        this.tanques = [];
        this.turnoActual = jugador1.id;
        this.estado = 'COLOCACION'; // COLOCACION → JUGANDO → FINALIZADA
        this.timer = null;
        this.fechaInicio = null;
    }

    // Jugador coloca uno de sus tanques en el mapa
    colocarTanque(jugadorId, tanqueId, x, y) {
        if (this.estado !== 'COLOCACION') {
            return { error: 'No es la fase de colocación' };
        }
        const jugador = this.jugadores[jugadorId];
        if (!jugador) return { error: 'Jugador no encontrado' };

        if (!jugador.tanquesSeleccionados.includes(tanqueId)) {
            return { error: 'El tanque no pertenece al jugador' };
        }

        if (jugador.tanquesColocados.some(t => t.id === tanqueId)) {
            return { error: 'El tanque ya ha sido colocado' };
        }

        // Validar rango de base
        const base = this._obtenerBaseJugador(jugadorId);
        if (!base) return { error: 'Base no encontrada para el jugador' };

        const dx = Math.abs(x - base.x);
        const dy = Math.abs(y - base.y);
        // Rango de colocación: 4 casillas desde la esquina de la base
        if (dx > 4 || dy > 4) {
            return { error: 'Debes colocar el tanque cerca de tu base' };
        }

        // Validar que la casilla esté libre y sea transitable
        if (!this._esCasillaValidaColocacion(x, y)) {
            return { error: 'Casilla inválida u ocupada' };
        }

        // Añadir tanque al estado (usamos un tipo genérico por ahora o buscamos el tipo real)
        // Nota: En una versión real buscaríamos el tipo en la DB o pasaríamos el tipo desde el lobby
        const tanque = TankFactory.crear(tanqueId, 'LIGERO', jugadorId, x, y); 
        this.tanques.push(tanque);
        jugador.tanquesColocados.push({ id: tanqueId, x, y });

        return { success: true, tanque };
    }

    _obtenerBaseJugador(jugadorId) {
        if (!this.mapa || !this.mapa.data || !this.mapa.data.objetos) return null;
        
        const isHost = String(jugadorId) === String(Object.keys(this.jugadores)[0]);
        const tipoBase = isHost ? 'Base_J1' : 'Base_J2';

        for (let y = 0; y < this.mapa.data.objetos.length; y++) {
            for (let x = 0; x < this.mapa.data.objetos[y].length; x++) {
                const obj = this.mapa.data.objetos[y][x];
                if (obj && obj.tipo === tipoBase) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    _esCasillaValidaColocacion(x, y) {
        if (x < 0 || y < 0 || y >= this.mapa.data.suelo.length || x >= this.mapa.data.suelo[0].length) return false;
        
        const suelo = this.mapa.data.suelo[y][x];
        const objeto = this.mapa.data.objetos[y][x];
        const tanque = this.tanques.find(t => t.posX === x && t.posY === y);

        if (suelo.tipo === 'No_Transitable') return false;
        if (objeto && objeto.tipo === 'No_Transitable') return false;
        if (tanque) return false;

        return true;
    }

    // Comprueba si ambos jugadores han colocado sus 3 tanques
    ambosListos() {
        return Object.values(this.jugadores)
            .every(j => j.tanquesColocados.length === 3);
    }

    // Despliega los tanques y arranca la partida
    iniciar() {
        if (!this.ambosListos()) {
            return { error: 'Ambos jugadores deben colocar sus 3 tanques' };
        }

        // Ya no necesitamos crear tanques aquí, se crearon al colocarlos

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