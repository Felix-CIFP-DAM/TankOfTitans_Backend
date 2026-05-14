const TankFactory = require('./TankFactory');
const CombatManager = require('./CombatManager');
const GameTimer = require('../utils/timer.utils');
const gameService = require('../services/game.service');

class GameState {
    constructor(partidaId, jugador1, jugador2, mapa) {
        this.partidaId = partidaId;
        this.mapa = mapa; 
        this.hostId = jugador1.id; // Asumimos que el primero pasado es el host (desde lobby.handler)
        this.jugadores = {
            [jugador1.id]: {
                ...jugador1,
                pa: jugador1.pa || 100, 
                tanquesSeleccionados: jugador1.tanquesIds || [], 
                tanquesColocados: [],
                vida: jugador1.vida || 1000
            },
            [jugador2.id]: {
                ...jugador2,
                pa: jugador2.pa || 100,
                tanquesSeleccionados: jugador2.tanquesIds || [],
                tanquesColocados: [],
                vida: jugador2.vida || 1000
            }
        };
        this.tanques = [];
        this.turnoActual = jugador1.id;
        this.estado = 'COLOCACION'; 
        this.timer = null;
        this.fechaInicio = null;
    }

    // Jugador coloca uno de sus tanques en el mapa
    colocarTanque(jugadorId, tanqueId, x, y, tanqueData) {
        if (this.estado !== 'COLOCACION') {
            return { error: 'No es la fase de colocación' };
        }
        const jugador = this.jugadores[jugadorId];
        if (!jugador) return { error: 'Jugador no encontrado' };

        if (!jugador.tanquesSeleccionados.some(id => String(id) === String(tanqueId))) {
            return { error: 'El tanque no pertenece al jugador' };
        }

        if (jugador.tanquesColocados.some(t => t.id === tanqueId)) {
            return { error: 'El tanque ya ha sido colocado' };
        }

        // Validar PA para poner tanque
        const costePoner = tanqueData?.costePoner || 10;
        if (jugador.pa < costePoner) {
            return { error: `PA insuficientes para desplegar (Coste: ${costePoner}, Tienes: ${jugador.pa})` };
        }

        const base = this._obtenerBaseJugador(jugadorId);
        if (!base) return { error: 'Base no encontrada para el jugador' };

        const dx = Math.abs(x - base.x);
        const dy = Math.abs(y - base.y);
        if (dx > 4 || dy > 4) {
            return { error: 'Debes colocar el tanque cerca de tu base' };
        }

        if (!this._esCasillaValidaColocacion(x, y)) {
            return { error: 'Casilla inválida u ocupada' };
        }

        // Restar PA
        jugador.pa -= costePoner;

        // Crear tanque con sus stats reales
        const tanque = {
            id: tanqueId,
            propietarioId: jugadorId,
            nombre: tanqueData.nombre,
            tipo: tanqueData.tipo,
            hp: tanqueData.hp || 100,
            hpMax: tanqueData.hp || 100,
            ataque: tanqueData.ataque || 50,
            defensa: tanqueData.defensa || 50,
            rangoAtaque: tanqueData.rangoAtaque || 2,
            rangoMovimiento: tanqueData.rangoMovimiento || 3,
            costeAtacar: tanqueData.costeAtacar || 15,
            costeMover: tanqueData.costeMover || 5,
            miniatura: tanqueData.miniatura || '',
            imagenPortada: tanqueData.imagenPortada || '',
            posX: x,
            posY: y,
            vivo: true,
            haMovido: false,
            haAtacado: false
        };

        this.tanques.push(tanque);
        jugador.tanquesColocados.push({ id: tanqueId, x, y });

        return { success: true, tanque, paRestantes: jugador.pa };
    }

    _obtenerBaseJugador(jugadorId) {
        if (!this.mapa || !this.mapa.data || !this.mapa.data.objetos) return null;
        const isHost = String(jugadorId) === String(this.hostId);
        const tipoBase = isHost ? 'Base_J1' : 'Base_J2';

        for (let y = 0; y < this.mapa.data.objetos.length; y++) {
            for (let x = 0; x < this.mapa.data.objetos[y].length; x++) {
                const obj = this.mapa.data.objetos[y][x];
                if (obj && obj.tipo === tipoBase) return { x, y };
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

    ambosListos() {
        return Object.values(this.jugadores).every(j => j.tanquesColocados.length === 3);
    }

    iniciar(ioCallback) {
        if (!this.ambosListos()) return { error: 'Ambos jugadores deben colocar sus 3 tanques' };
        this.estado = 'JUGANDO';
        this.fechaInicio = new Date();
        
        // ioCallback is passed from the handler to broadcast events
        this.onTurnTimeout = ioCallback;

        this.timer = new GameTimer(
            this.partidaId, 
            () => this._guardarEstadoPeriodico(), 
            () => this._finalizarPorTiempo(),
            () => this._timeoutTurno()
        );
        this.timer.start();
        return { success: true };
    }

    _timeoutTurno() {
        this.finTurno(this.turnoActual);
        if (this.onTurnTimeout) {
            this.onTurnTimeout({
                turnoActual: this.turnoActual,
                pa: this.jugadores[this.turnoActual].pa,
                estado: this.getEstado()
            });
        }
    }

    mover(jugadorId, tanqueId, targetX, targetY) {
        if (this.estado !== 'JUGANDO') return { error: 'La partida no está activa' };
        if (this.turnoActual !== jugadorId) return { error: 'No es tu turno' };

        const tanque = this.tanques.find(t => t.id === tanqueId && t.propietarioId === jugadorId);
        if (!tanque) return { error: 'Tanque no encontrado' };

        const jugador = this.jugadores[jugadorId];
        const costeMover = tanque.costeMover || 5;
        if (jugador.pa < costeMover) return { error: `PA insuficientes (Coste: ${costeMover})` };

        const resultado = CombatManager.mover(tanque, targetX, targetY, this.tanques, this.mapa.data.suelo);
        if (resultado.error) return resultado;

        jugador.pa -= costeMover;
        return { success: true, tanque, paRestantes: jugador.pa };
    }

    atacar(jugadorId, atacanteId, defensorId) {
        if (this.estado !== 'JUGANDO') return { error: 'La partida no está activa' };
        if (this.turnoActual !== jugadorId) return { error: 'No es tu turno' };

        const atacante = this.tanques.find(t => t.id === atacanteId && t.propietarioId === jugadorId);
        const defensor = this.tanques.find(t => t.id === defensorId);
        if (!atacante || !defensor) return { error: 'Tanque no encontrado' };

        const jugador = this.jugadores[jugadorId];
        const costeAtacar = atacante.costeAtacar || 15;
        if (jugador.pa < costeAtacar) return { error: `PA insuficientes (Coste: ${costeAtacar})` };

        const resultado = CombatManager.atacar(atacante, defensor);
        if (resultado.error) return resultado;

        jugador.pa -= costeAtacar;
        
        const defensorPlayer = this.jugadores[defensor.propietarioId];
        defensorPlayer.vida -= resultado.daño;
        if (defensorPlayer.vida < 0) defensorPlayer.vida = 0;

        const finPartida = this._comprobarVictoria();

        return {
            success: true,
            daño: resultado.daño,
            defensorHp: resultado.defensorHp,
            defensorMuerto: resultado.defensorMuerto,
            defensorVidaTotal: defensorPlayer.vida,
            paRestantes: jugador.pa,
            finPartida
        };
    }

    finTurno(jugadorId) {
        if (this.estado !== 'JUGANDO') return { error: 'La partida no está activa' };
        if (this.turnoActual !== jugadorId) return { error: 'No es tu turno' };

        const ids = Object.keys(this.jugadores);
        this.turnoActual = ids.find(id => id !== jugadorId);

        if (this.timer) {
            this.timer.resetTurn();
        }
        
        return { success: true, turnoActual: this.turnoActual, pa: this.jugadores[this.turnoActual].pa };
    }

    abandonar(jugadorId) {
        const ids = Object.keys(this.jugadores);
        const ganadorId = ids.find(id => id !== jugadorId);
        return this._finalizar(ganadorId, 'ABANDONO');
    }

    _comprobarVictoria() {
        const ids = Object.keys(this.jugadores);
        for (const id of ids) {
            const jugador = this.jugadores[id];
            if (jugador.vida <= 0) {
                const ganadorId = ids.find(gId => gId !== id);
                return this._finalizar(ganadorId, 'DESTRUCCION_BASE');
            }
        }
        return null;
    }

    _finalizarPorTiempo() {
        const ids = Object.keys(this.jugadores);
        const vivosJ1 = this.tanques.filter(t => t.propietarioId === ids[0] && t.vivo).length;
        const vivosJ2 = this.tanques.filter(t => t.propietarioId === ids[1] && t.vivo).length;
        let ganadorId, razon;
        if (vivosJ1 > vivosJ2) { ganadorId = ids[0]; razon = 'TIEMPO'; }
        else if (vivosJ2 > vivosJ1) { ganadorId = ids[1]; razon = 'TIEMPO'; }
        else { ganadorId = 'EMPATE'; razon = 'TIEMPO_EMPATE'; }
        return this._finalizar(ganadorId, razon);
    }

    _finalizar(ganadorId, razon) {
        this.estado = 'FINALIZADA';
        if (this.timer) this.timer.stop();
        const ids = Object.keys(this.jugadores);
        const duracion = this.fechaInicio ? Math.floor((new Date() - this.fechaInicio) / 1000) : 0;
        const tanquesMuertosJ1 = this.tanques.filter(t => t.propietarioId === ids[0] && !t.vivo).length;
        const tanquesMuertosJ2 = this.tanques.filter(t => t.propietarioId === ids[1] && !t.vivo).length;
        const empate = ganadorId === 'EMPATE';

        gameService.guardarResultado(this.partidaId, empate ? null : ganadorId, empate ? null : ids.find(id => id !== ganadorId), empate, duracion, tanquesMuertosJ1, tanquesMuertosJ2)
            .catch(error => console.error('Error al guardar resultado:', error.message));

        return { ganadorId, razon, duracion, tanquesMuertosJ1, tanquesMuertosJ2 };
    }

    async _guardarEstadoPeriodico() {
        try {
            const jugadoresEstado = Object.values(this.jugadores).map(j => ({
                usuarioId: j.id,
                nickname: j.nickname,
                tanquesMuertos: this.tanques.filter(t => t.propietarioId === j.id && !t.vivo).length,
                tanques: this.tanques.filter(t => t.propietarioId === j.id).map(t => ({
                    numeroTanque: t.id,
                    tipo: t.tipo,
                    hp: t.hp,
                    vivo: t.vivo,
                    posX: t.posX,
                    posY: t.posY
                }))
            }));
            await gameService.guardarEstado(this.partidaId, jugadoresEstado);
        } catch (error) { console.error('Error al guardar estado periódico:', error.message); }
    }

    getEstado() {
        return {
            partidaId: this.partidaId,
            estado: this.estado,
            turnoActual: this.turnoActual,
            timeLeft: this.timer ? this.timer.getTimeLeft() : { total: 15 * 60, turno: 30 },
            jugadores: Object.values(this.jugadores).map(j => ({ id: j.id, nickname: j.nickname, pa: j.pa, vida: j.vida })),
            tanques: this.tanques
        };
    }
}

module.exports = GameState;