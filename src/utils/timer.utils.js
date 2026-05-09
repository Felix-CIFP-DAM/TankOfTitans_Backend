const GAME_DURATION = 15 * 60; // 15 minutos en segundos
const SAVE_INTERVALS = [10 * 60, 5 * 60]; // guardado en min 5 y min 10

class GameTimer {
    constructor(partidaId, onSave, onEnd) {
        if (typeof onSave !== 'function') throw new Error('GameTimer: onSave debe ser una función');
        if (typeof onEnd !== 'function') throw new Error('GameTimer: onEnd debe ser una función');
        this.partidaId = partidaId;
        this.timeLeft = GAME_DURATION;
        this.onSave = onSave; // función que llama a la API para guardar estado
        this.onEnd = onEnd;   // función que se llama al acabar el tiempo
        this.interval = null;
    }

    start() {
        // Evita lanzar un segundo intervalo si ya está en marcha
        if (this.interval) return;
        this.interval = setInterval(() => {
            this.timeLeft--;

            // Guardado periódico en min 10 y min 5
            if (SAVE_INTERVALS.includes(this.timeLeft)) {
                console.log(`Guardando estado de partida ${this.partidaId} (${this.timeLeft / 60} min restantes)`);
                this.onSave();
            }

            // Fin de partida por tiempo
            if (this.timeLeft <= 0) {
                this.stop();
                this.onEnd();
            }
        }, 1000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    getTimeLeft() {
        return this.timeLeft;
    }
}

module.exports = GameTimer;