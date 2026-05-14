const lobbyService = require('../services/lobby.service');
const mapService = require('../services/map.service');
const userManager = require('../utils/UserManager');
const gameManager = require('../game/GameManager');

module.exports = (io, socket) => {
    // Crear una partida
    socket.on('crearPartida', async (payload) => {
        try {
            console.log('[BACKEND][lobby.handler] 📥 Evento crearPartida recibido:', payload.nombre);
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { nombre, publica, password } = payload;
            console.log(`[BACKEND][lobby.handler] 📡 Usuario ${user.nickname} (ID: ${user.id}) creando partida: ${nombre}`);

            const partida = await lobbyService.crearPartida(
                Number(user.id), nombre, publica, password
            );

            // El host se une a la sala del socket
            socket.join(`lobby_${partida.id}`);

            socket.emit('partidaCreada', partida);

            // Actualiza la lista de partidas públicas para todos
            if (publica) {
                const partidas = await lobbyService.listarPartidas();
                io.emit('listaPartidas', partidas);
            }

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Listar partidas públicas
    socket.on('listarPartidas', async () => {
        try {
            console.log('[BACKEND][lobby.handler] 📥 Evento listarPartidas recibido');
            const partidas = await lobbyService.listarPartidas();
            socket.emit('listaPartidas', partidas);
        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Unirse a una partida
    socket.on('unirsePartida', async (payload) => {
        try {
            console.log('[BACKEND][lobby.handler] 📥 Evento unirsePartida recibido:', payload.partidaId);
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId, password } = payload;
            console.log(`[BACKEND][lobby.handler] 📡 Usuario ${user.nickname} (ID: ${user.id}) uniéndose a partida: ${partidaId}`);

            const partida = await lobbyService.unirseAPartida(
                Number(user.id), partidaId, password
            );

            // Se une a la sala del socket
            socket.join(`lobby_${partidaId}`);

            // Notifica a todos en la sala
            io.to(`lobby_${partidaId}`).emit('jugadorUnido', partida);

            // Actualiza lista pública
            const partidas = await lobbyService.listarPartidas();
            io.emit('listaPartidas', partidas);

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Marcar listo
    socket.on('marcarListo', async (payload) => {
        try {
            console.log('[BACKEND][lobby.handler] 📥 Evento marcarListo recibido:', payload.partidaId);
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId } = payload;
            console.log(`[BACKEND][lobby.handler] 📡 Usuario ${user.nickname} (ID: ${user.id}) marcando listo en partida: ${partidaId}`);

            await lobbyService.marcarListo(Number(user.id), partidaId);
            const partida = await lobbyService.getEstadoPartida(partidaId);

            // Notifica a todos en la sala el nuevo estado
            io.to(`lobby_${partidaId}`).emit('estadoSala', partida);

            // Verificar si todos están listos para iniciar cuenta atrás
            if (partida.jugadoresList.length >= 2 && partida.jugadoresList.every(j => j.listo)) {
                console.log(`[BACKEND][lobby.handler] 🕒 Todos listos en sala ${partidaId}. Iniciando cuenta atrás.`);
                
                let count = 5;
                const interval = setInterval(() => {
                    io.to(`lobby_${partidaId}`).emit('cuentaAtras', count);
                    if (count <= 0) {
                        clearInterval(interval);
                        iniciarPartidaAutomatico(io, partidaId);
                    }
                    count--;
                }, 1000);
            }

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Iniciar partida (solo el host)
    socket.on('iniciarPartida', async (payload) => {
        try {
            console.log('[BACKEND][lobby.handler] 📥 Evento iniciarPartida recibido:', payload.partidaId);
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId } = payload;

            // Actualiza estado en la API
            const partida = await lobbyService.iniciarPartida(Number(user.id), partidaId);
            console.log(`[BACKEND][lobby.handler] ✅ Partida ${partidaId} iniciada en API`);

            // Carga el mapa (el seleccionado o uno aleatorio)
            let mapa;
            if (partida.mapaId) {
                console.log(`[BACKEND][lobby.handler] 🗺️ Usando mapa seleccionado: ${partida.mapaId}`);
                mapa = await mapService.getMapa(partida.mapaId);
            } else {
                console.log('[BACKEND][lobby.handler] 🎲 No hay mapa seleccionado. Cargando uno aleatorio.');
                mapa = await mapService.getMapaAleatorio();
            }

            // Obtiene los datos de los jugadores de la sala
            const sockets = await io.in(`lobby_${partidaId}`).fetchSockets();
            console.log(`[BACKEND][lobby.handler] 👥 Sockets encontrados en sala lobby_${partidaId}:`, sockets.length);

            // Obtenemos los DTOs de los jugadores desde la respuesta de la API
            // El host es el que coincide con partida.hostId
            const hostDTO = partida.jugadoresList.find(j => Number(j.id) === Number(partida.hostId));
            const guestDTO = partida.jugadoresList.find(j => Number(j.id) !== Number(partida.hostId));

            if (!hostDTO || !guestDTO) {
                console.error('[BACKEND][lobby.handler] ❌ No se encontraron ambos jugadores en la respuesta de la API');
                socket.emit('error', { error: 'Error al obtener datos de los jugadores' });
                return;
            }

            // Crea el GameState en memoria usando los DTOs (que tienen PA, tanquesIds, etc.)
            // Importante: Pasamos el hostDTO como primer jugador para que GameState sepa quién es quién
            gameManager.crear(
                partidaId,
                hostDTO,
                guestDTO,
                mapa
            );

            // Mueve a los jugadores a la sala del juego
            sockets.forEach(s => {
                s.leave(`lobby_${partidaId}`);
                s.join(`game_${partidaId}`);
            });

            // Notifica a ambos jugadores que empiece la selección de tanques
            io.to(`game_${partidaId}`).emit('seleccionTanques', {
                partidaId,
                mapa,
                mensaje: 'Selecciona tus 3 tanques'
            });

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Eliminar partida (solo el host)
    socket.on('eliminarPartida', async (payload) => {
        try {
            console.log('[BACKEND][lobby.handler] 📥 Evento eliminarPartida recibido:', payload.partidaId);
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId } = payload;

            await lobbyService.eliminarPartida(Number(user.id), partidaId);

            // Notifica a todos en la sala
            io.to(`lobby_${partidaId}`).emit('partidaEliminada', {
                message: 'La partida ha sido eliminada por el host'
            });

            // Actualiza lista pública
            const partidas = await lobbyService.listarPartidas();
            io.emit('listaPartidas', partidas);

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Host se desconecta — cambia el host
    socket.on('hostDesconectado', async (payload) => {
        try {
            console.log('[BACKEND][lobby.handler] 📥 Evento hostDesconectado recibido:', payload.partidaId);
            const { partidaId, hostActualId } = payload;
            await lobbyService.cambiarHost(partidaId, hostActualId);

            const partida = await lobbyService.getEstadoPartida(partidaId);
            io.to(`lobby_${partidaId}`).emit('hostCambiado', partida);

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Seleccionar tanque
    socket.on('seleccionarTanque', async (payload) => {
        try {
            console.log('[BACKEND][lobby.handler] 📥 Evento seleccionarTanque recibido:', payload.tanqueId);
            const user = userManager.getUser(socket.id);
            if (!user) return;

            const { partidaId, tanqueId } = payload;
            await lobbyService.seleccionarTanque(Number(user.id), partidaId, tanqueId);

            const partida = await lobbyService.getEstadoPartida(partidaId);
            io.to(`lobby_${partidaId}`).emit('estadoSala', partida);

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Deseleccionar tanque
    socket.on('deseleccionarTanque', async (payload) => {
        try {
            console.log('[BACKEND][lobby.handler] 📥 Evento deseleccionarTanque recibido:', payload.tanqueId);
            const user = userManager.getUser(socket.id);
            if (!user) return;

            const { partidaId, tanqueId } = payload;
            await lobbyService.deseleccionarTanque(Number(user.id), partidaId, tanqueId);

            const partida = await lobbyService.getEstadoPartida(partidaId);
            io.to(`lobby_${partidaId}`).emit('estadoSala', partida);

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Obtener estado de una sala concreta (útil para refrescos de página)
    socket.on('obtenerEstadoSala', async (payload) => {
        try {
            console.log('[BACKEND][lobby.handler] 📥 Evento obtenerEstadoSala recibido:', payload.partidaId);
            const user = userManager.getUser(socket.id);
            if (!user) return;

            const { partidaId } = payload;
            socket.join(`lobby_${partidaId}`);

            const partida = await lobbyService.getEstadoPartida(partidaId);
            socket.emit('estadoSala', partida);

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Seleccionar mapa
    socket.on('seleccionarMapa', async (payload) => {
        try {
            console.log('[BACKEND][lobby.handler] 📥 Evento seleccionarMapa recibido:', payload.mapaId);
            const user = userManager.getUser(socket.id);
            if (!user) return;
 
            const { partidaId, mapaId } = payload;
            await lobbyService.seleccionarMapa(Number(user.id), partidaId, mapaId);
 
            const partida = await lobbyService.getEstadoPartida(partidaId);
            io.to(`lobby_${partidaId}`).emit('estadoSala', partida);
 
        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });
};

async function iniciarPartidaAutomatico(io, partidaId) {
    try {
        const lobbyService = require('../services/lobby.service');
        const mapService = require('../services/map.service');
        const userManager = require('../utils/UserManager');
        const gameManager = require('../game/GameManager');

        // Obtenemos el estado final de la sala
        const partida = await lobbyService.getEstadoPartida(partidaId);
        console.log(`[BACKEND][lobby.handler] 🕒 Inicio automático para partida ${partidaId}. Host: ${partida.hostNickname}`);
        
        const hostId = partida.hostId;
        if (!hostId) {
            throw new Error('No se pudo identificar al host para iniciar la partida');
        }
 
        // Actualiza estado en la API
        await lobbyService.iniciarPartida(hostId, partidaId);
 
        // Carga el mapa
        let mapa;
        if (partida.mapaId) {
            console.log(`[BACKEND][lobby.handler] 🗺️ Usando mapa seleccionado en automático: ${partida.mapaId}`);
            mapa = await mapService.getMapa(partida.mapaId);
        } else {
            console.log('[BACKEND][lobby.handler] 🎲 Cargando mapa aleatorio en automático');
            mapa = await mapService.getMapaAleatorio();
        }
 
        // Obtiene los datos de los jugadores de la sala
        const sockets = await io.in(`lobby_${partidaId}`).fetchSockets();
        console.log(`[BACKEND][lobby.handler] 👥 Sockets encontrados: ${sockets.length}`);
 
        const jugadores = sockets
            .map(s => userManager.getUser(s.id))
            .filter(Boolean);
        if (sockets.length < 2) {
            throw new Error(`No hay suficientes jugadores conectados (${sockets.length})`);
        }

        // Obtener datos finales de los jugadores de la partida (con sus tanquesIds)
        const partidaActualizada = await lobbyService.getEstadoPartida(partidaId);
        const pJugadores = partidaActualizada.jugadoresList;

        const j1Data = pJugadores.find(j => j.nickname === partidaActualizada.hostNickname);
        const j2Data = pJugadores.find(j => j.nickname !== partidaActualizada.hostNickname);

        const j1 = { ...userManager.getUser(sockets.find(s => s.id === j1Data.socketId)?.id), id: j1Data.userId, tanquesIds: j1Data.tanquesIds };
        const j2 = { ...userManager.getUser(sockets.find(s => s.id !== j1Data.socketId)?.id), id: j2Data.userId, tanquesIds: j2Data.tanquesIds };

        // Instancia el GameState en Node
        gameManager.crear(partidaId, j1, j2, mapa);
 
        // Mueve a los jugadores a la sala del juego y notifica
        sockets.forEach(s => {
            console.log(`[BACKEND][lobby.handler] ➡️ Socket ${s.id} movido a sala game_${partidaId}`);
            s.leave(`lobby_${partidaId}`);
            s.join(`game_${partidaId}`);
        });
 
        io.to(`game_${partidaId}`).emit('seleccionTanques', {
            partidaId,
            mapa,
            mensaje: '¡Que comience la batalla! Coloca tus tanques cerca de tu base.'
        });

    } catch (error) {
        console.error('[BACKEND][lobby.handler] ❌ Error en inicio automático:', error.message);
        io.to(`lobby_${partidaId}`).emit('error', { error: 'No se pudo iniciar la partida automáticamente' });
    }
}
