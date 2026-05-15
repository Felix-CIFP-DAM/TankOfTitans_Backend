const GameState = require('../src/game/GameState');

const mapMock = {
    nombre: 'TestMap',
    data: {
        suelo: Array(10).fill(null).map(() => Array(15).fill({tipo: 'Transitable', sheet: 'suelos-1', x: 0, y: 0})),
        objetos: Array(10).fill(null).map(() => Array(15).fill(null))
    }
};

const j1 = { id: 1, nickname: 'Alice', tanquesIds: [45, 46, 47], pa: 100, vida: 1000, iconoImagen: 'recluta.png' };
const j2 = { id: 2, nickname: 'Bob',   tanquesIds: [48, 49, 50], pa: 100, vida: 1000, iconoImagen: 'soldado.png' };

const g = new GameState(99, j1, j2, mapMock);

console.log('\n=== Estado inicial ===');
const estado = g.getEstado();
console.log('Estado:', estado.estado);
console.log('TurnoActual type:', typeof estado.turnoActual, '| valor:', estado.turnoActual);
console.log('Jugadores keys:', Object.keys(estado.jugadores));
console.log('Jugador 1 (host):', estado.jugadores[1]);
console.log('Jugador 2:', estado.jugadores[2]);

console.log('\n=== Colocar tanques J1 ===');
const r1 = g.colocarTanque(1, 45, 1, 1, {costePoner: 10, nombre: 'Churchill', hp: 150});
console.log('Resultado:', r1.success ? `✅ ok | PA restantes: ${r1.paRestantes}` : `❌ ${r1.error}`);

console.log('\n=== Colocar tanques J2 ===');
const r2 = g.colocarTanque(2, 48, 13, 8, {costePoner: 10, nombre: 'T-34', hp: 120});
console.log('Resultado:', r2.success ? `✅ ok | PA restantes: ${r2.paRestantes}` : `❌ ${r2.error}`);

console.log('\n=== Estado tras colocación ===');
const estadoTras = g.getEstado();
console.log('Tanques en mapa:', estadoTras.tanques.length);
console.log('ambosListos (necesita 3 c/u):', g.ambosListos());

// Verificar que el turnoActual es string
console.log('\n=== Verificar tipos ===');
console.log('turnoActual === "1":', estado.turnoActual === '1');
console.log('turnoActual === 1:', estado.turnoActual === 1);
