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
                tanquesSeleccionados: (jugador1.tanquesIds || []).map(Number), 
                tanquesColocados: [],
                vida: jugador1.vida || 1000,
                iconoImagen: jugador1.iconoImagen || 'recluta.png',
                confirmado: false
            },
            [jugador2.id]: {
                ...jugador2,
                pa: jugador2.pa || 100,
                tanquesSeleccionados: (jugador2.tanquesIds || []).map(Number),
                tanquesColocados: [],
                vida: jugador2.vida || 1000,
                iconoImagen: jugador2.iconoImagen || 'recluta.png',
                confirmado: false
            }
        };
        this.tanques = [];
        this.escombros = [];
        this.turnoNumero = 1;
        this.turnoActual = jugador1.id;
        this.estado = 'JUGANDO'; 
        this.timer = null;
        this.fechaInicio = new Date();
    }

    // Jugador coloca uno de sus tanques en el mapa
    colocarTanque(jugadorId, tanqueId, x, y, tanqueData) {
        if (this.estado !== 'JUGANDO') {
            return { error: 'La partida no está activa' };
        }
        if (String(this.turnoActual) !== String(jugadorId)) {
            return { error: 'No es tu turno' };
        }
        const jugador = this.jugadores[jugadorId];
        if (!jugador) return { error: 'Jugador no encontrado' };

        if (!jugador.tanquesSeleccionados.some(id => String(id) === String(tanqueId))) {
            return { error: 'El tanque no pertenece al jugador' };
        }

        // Permitir redeploy si el tanque fue destruido previamente (posX === -1)
        const tanqueExistente = this.tanques.find(t => t.id === tanqueId && t.propietarioId === jugadorId);
        if (tanqueExistente && tanqueExistente.vivo) {
            return { error: 'El tanque ya ha sido colocado' };
        }

        // Validar PA para poner tanque
        const costePoner = tanqueData?.costePoner || 10;
        if (jugador.pa < costePoner) {
            return { error: `PA insuficientes para desplegar (Coste: ${costePoner}, Tienes: ${jugador.pa})` };
        }

        const baseTiles = this._obtenerBaseJugador(jugadorId);
        if (baseTiles.length === 0) return { error: 'Base no encontrada para el jugador' };

        const cercaDeBase = baseTiles.some(tile => {
            const dx = Math.abs(x - tile.x);
            const dy = Math.abs(y - tile.y);
            return dx <= 5 && dy <= 5;
        });

        if (!cercaDeBase) {
            return { error: 'Debes colocar el tanque cerca de tu base' };
        }

        if (!this._esCasillaValidaColocacion(x, y)) {
            return { error: 'Casilla inválida u ocupada' };
        }

        jugador.pa -= costePoner;

        if (tanqueExistente) {
            tanqueExistente.posX = x;
            tanqueExistente.posY = y;
            tanqueExistente.vivo = true;
            tanqueExistente.hp = tanqueExistente.hpMax;
        } else {
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
                vivo: true
            };
            this.tanques.push(tanque);
            jugador.tanquesColocados.push({ id: tanqueId, x, y });
        }

        return { success: true, paRestantes: jugador.pa };
    }

    _obtenerBaseJugador(jugadorId) {
        const isHost = String(jugadorId) === String(this.hostId);
        const tipoBase = isHost ? 'Base_J1' : 'Base_J2';
        const tiles = [];

        if (this.mapa && this.mapa.data && this.mapa.data.objetos) {
            for (let y = 0; y < this.mapa.data.suelo.length; y++) {
                for (let x = 0; x < this.mapa.data.suelo[y].length; x++) {
                    const obj = this.mapa.data.objetos?.[y]?.[x];
                    const ground = this.mapa.data.suelo[y][x];
                    
                    if ((obj && obj.tipo === tipoBase) || (ground && ground.tipo === tipoBase)) {
                        tiles.push({ x, y });
                    }
                }
            }
        }
        
        if (tiles.length > 0) return tiles;

        const rows = this.mapa?.data?.suelo?.length || 10;
        const cols = this.mapa?.data?.suelo?.[0]?.length || 15;
        return isHost ? [{ x: 1, y: 1 }] : [{ x: cols - 2, y: rows - 2 }];
    }

    _esCasillaValidaColocacion(x, y) {
        if (x < 0 || y < 0 || y >= this.mapa.data.suelo.length || x >= this.mapa.data.suelo[0].length) return false;
        const suelo = this.mapa.data.suelo[y][x];
        const objeto = this.mapa.data.objetos[y][x];
        const tanque = this.tanques.find(t => t.vivo && t.posX === x && t.posY === y);
        if (suelo.tipo === 'No_Transitable') return false;
        if (objeto && objeto.tipo === 'No_Transitable') return false;
        if (tanque) return false;
        return true;
    }

    confirmarColocacion(jugadorId) {
        const jugador = this.jugadores[jugadorId];
        if (jugador) {
            jugador.confirmado = true;
            return { success: true };
        }
        return { error: 'Jugador no encontrado' };
    }

    ambosListos() {
        return Object.values(this.jugadores).every(j => 
            j.tanquesColocados.length === 3 || j.confirmado
        );
    }

    iniciar(ioCallback) {
        // Ya no comprobamos ambosListos porque la colocación es parte del juego
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
        console.log(`[BACKEND][GameState] 🚜 Mover: Jugador ${jugadorId} moviendo tanque ${tanqueId} a (${targetX}, ${targetY})`);
        if (this.estado !== 'JUGANDO') return { error: 'La partida no está activa' };
        if (String(this.turnoActual) !== String(jugadorId)) return { error: 'No es tu turno' };

        const tanque = this.tanques.find(t => String(t.id) === String(tanqueId) && String(t.propietarioId) === String(jugadorId) && t.vivo);
        if (!tanque) return { error: 'Tanque no encontrado' };

        const jugador = this.jugadores[jugadorId];
        const costeMover = tanque.costeMover || 5;
        if (jugador.pa < costeMover) return { error: `PA insuficientes (Coste: ${costeMover})` };

        if (this.escombros.some(e => e.x === Number(targetX) && e.y === Number(targetY))) {
            return { error: 'No puedes moverte sobre los escombros' };
        }

        const resultado = CombatManager.mover(tanque, Number(targetX), Number(targetY), this.tanques, this.mapa.data);
        if (resultado.error) return resultado;

        jugador.pa -= costeMover;
        return { success: true, tanque, paRestantes: jugador.pa };
    }

    atacar(jugadorId, atacanteId, targetX, targetY) {
        console.log(`[BACKEND][GameState] ⚔️ Atacar: Jugador ${jugadorId} con tanque ${atacanteId} a (${targetX}, ${targetY})`);
        if (this.estado !== 'JUGANDO') return { error: 'La partida no está activa' };
        if (String(this.turnoActual) !== String(jugadorId)) return { error: 'No es tu turno' };

        const atacante = this.tanques.find(t => String(t.id) === String(atacanteId) && String(t.propietarioId) === String(jugadorId) && t.vivo);
        if (!atacante) return { error: 'Tanque atacante no encontrado' };

        const jugador = this.jugadores[jugadorId];
        const costeAtacar = atacante.costeAtacar || 15;
        if (jugador.pa < costeAtacar) return { error: `PA insuficientes (Coste: ${costeAtacar})` };

        if (!require('../utils/validators.utils').isValidAttackRange(atacante, Number(targetX), Number(targetY))) {
            return { error: 'El objetivo está fuera del rango de ataque' };
        }

        const defensor = this.tanques.find(t => t.vivo && Number(t.posX) === Number(targetX) && Number(t.posY) === Number(targetY));
        
        let resultado = { hit: false };
        if (defensor) {
            resultado = CombatManager.atacar(atacante, defensor);
            if (resultado.error) return resultado;
            resultado.hit = true;

            const defensorPlayer = this.jugadores[defensor.propietarioId];
            if (defensorPlayer) {
                defensorPlayer.vida = Math.max(0, defensorPlayer.vida - (resultado.daño || 0));
            }

            if (resultado.defensorMuerto) {
                this.escombros.push({ x: defensor.posX, y: defensor.posY, turnos: 4 });
                defensor.posX = -1;
                defensor.posY = -1;
                defensor.vivo = false;
            }
        } else {
            resultado = { 
                success: true, 
                hit: false, 
                mensaje: '¡Fallaste! El proyectil impactó en terreno vacío.' 
            };
        }

        jugador.pa -= costeAtacar;

        // Comprobar si alguien ha ganado tras el ataque
        const victoria = this._comprobarVictoria();
        if (victoria) {
            resultado.finPartida = victoria;
        }

        return { ...resultado, paRestantes: jugador.pa };
    }

    finTurno(jugadorId) {
        console.log(`[BACKEND][GameState] 🏁 finTurno solicitado por ${jugadorId}. Turno actual: ${this.turnoActual}`);
        if (this.estado !== 'JUGANDO') return { error: 'La partida no está activa' };
        if (String(this.turnoActual) !== String(jugadorId)) return { error: 'No es tu turno' };

        const ids = Object.keys(this.jugadores);
        this.turnoActual = ids.find(id => String(id) !== String(jugadorId));
        this.turnoNumero++;

        const jugadorSiguiente = this.jugadores[this.turnoActual];
        if (jugadorSiguiente) {
            jugadorSiguiente.pa = Math.min(100, (jugadorSiguiente.pa || 0) + 100);
        }

        // Resetear banderas de acción de todos los tanques para el nuevo turno
        this.tanques.forEach(t => {
            t.haMovido = false;
            t.haAtacado = false;
        });

        this.escombros.forEach(e => e.turnos--);
        this.escombros = this.escombros.filter(e => e.turnos > 0);

        if (this.timer) {
            this.timer.resetTurn();
        }
        
        return { success: true, turnoActual: this.turnoActual, pa: jugadorSiguiente?.pa };
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

    async _finalizar(ganadorId, razon) {
        if (this.estado === 'FINALIZADO') return null;
        this.estado = 'FINALIZADO';
        
        if (this.timer) {
            this.timer.stop();
        }

        const ids = Object.keys(this.jugadores);
        const empate = ganadorId === 'EMPATE';
        const ganador = empate ? null : ganadorId;
        const perdedor = empate ? null : ids.find(id => id !== ganadorId);

        const duracion = Math.floor((new Date() - this.fechaInicio) / 1000);
        const tanquesMuertosJ1 = this.tanques.filter(t => t.propietarioId === ids[0] && !t.vivo).length;
        const tanquesMuertosJ2 = this.tanques.filter(t => t.propietarioId === ids[1] && !t.vivo).length;

        // Guardar en la base de datos (Estadísticas y Monedas se actualizan en el API)
        gameService.guardarResultado(this.partidaId, ganador, perdedor, empate, duracion, tanquesMuertosJ1, tanquesMuertosJ2)
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
        const jugadoresObj = {};
        for (const [id, j] of Object.entries(this.jugadores)) {
            jugadoresObj[id] = { 
                id: j.id, 
                nickname: j.nickname, 
                pa: j.pa, 
                vida: j.vida,
                iconoImagen: j.iconoImagen || 'recluta.png'
            };
        }
        return {
            partidaId: this.partidaId,
            hostId: this.hostId,
            estado: this.estado,
            turnoNumero: this.turnoNumero,
            turnoActual: String(this.turnoActual),
            timeLeft: this.timer ? this.timer.getTimeLeft() : { total: 15 * 60, turno: 30 },
            jugadores: jugadoresObj,
            tanques: this.tanques,
            escombros: this.escombros
        };
    }
}

module.exports = GameState;