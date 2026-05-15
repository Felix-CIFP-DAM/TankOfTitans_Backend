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

            const gameState = gameManager.crear(
                partidaId,
                hostDTO,
                guestDTO,
                mapa
            );

            // Iniciar la partida inmediatamente (arranca el timer y turnos)
            gameState.iniciar((timeoutData) => {
                io.to(`game_${partidaId}`).emit('turnoCambiado', timeoutData);
            });

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

            // Actualizamos la lista pública de partidas porque esta partida ya no está "ESPERANDO"
            const partidas = await lobbyService.listarPartidas();
            io.emit('listaPartidas', partidas);

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

    // Abandonar partida (tanto en preparacion como en juego)
    socket.on('abandonarPartida', async (payload) => {
        try {
            console.log('[BACKEND][lobby.handler] 📥 Evento abandonarPartida recibido:', payload.partidaId);
            const user = userManager.getUser(socket.id);
            if (!user) return;

            const { partidaId } = payload;

            // Llamamos a la API para limpiar
            await lobbyService.abandonarPartida(Number(user.id), partidaId);

            // Si el GameManager lo tiene registrado, lo borramos de memoria
            if (gameManager.existe(partidaId)) {
                gameManager.delete(partidaId);
            }

            // Notificamos a la sala que este jugador ha abandonado
            // Y sacamos al socket de las salas
            socket.leave(`lobby_${partidaId}`);
            socket.leave(`game_${partidaId}`);

            io.to(`lobby_${partidaId}`).emit('jugadorAbandono', {
                message: `El jugador ${user.nickname} ha abandonado la partida.`
            });
            io.to(`game_${partidaId}`).emit('jugadorAbandono', {
                message: `El jugador ${user.nickname} ha abandonado la partida.`
            });

            // Enviar el nuevo estado de la sala a los que queden (para que vean el cambio de host)
            try {
                const partidaActualizada = await lobbyService.getEstadoPartida(partidaId);
                io.to(`lobby_${partidaId}`).emit('estadoSala', partidaActualizada);
            } catch (err) {
                // Si la partida se borró porque no queda nadie, getEstadoPartida fallará, lo cual es normal.
                console.log(`[BACKEND][lobby.handler] Partida ${partidaId} eliminada o inaccesible tras abandono.`);
            }

            // Actualizamos lista de partidas porque puede haber cambiado su estado o eliminado
            const partidas = await lobbyService.listarPartidas();
            io.emit('listaPartidas', partidas);

        } catch (error) {
            console.error('[BACKEND][lobby.handler] ❌ Error al abandonar partida:', error.message);
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

        // --- PASO 1: Leer estado ANTES de iniciar la partida en la API ---
        // Si lo leemos después, la API puede haber borrado/modificado tanquesIds
        const partidaPrevia = await lobbyService.getEstadoPartida(partidaId);
        console.log(`[BACKEND][lobby.handler] 🕒 Inicio automático para partida ${partidaId}. Host: ${partidaPrevia.hostNickname}`);

        const hostId = partidaPrevia.hostId;
        if (!hostId) {
            throw new Error('No se pudo identificar al host para iniciar la partida');
        }

        // Capturar datos de jugadores CON sus tanquesIds ANTES de cambiar estado
        const pJugadores = partidaPrevia.jugadoresList;
        if (!pJugadores || pJugadores.length < 2) {
            throw new Error(`No hay suficientes jugadores en la sala (${pJugadores?.length || 0})`);
        }

        const j1Data = pJugadores.find(j => Number(j.id) === Number(hostId));
        const j2Data = pJugadores.find(j => Number(j.id) !== Number(hostId));

        if (!j1Data || !j2Data) {
            throw new Error('No se encontraron los datos de ambos jugadores');
        }

        console.log(`[BACKEND][lobby.handler] 👤 J1 (host): ${j1Data.nickname} | tanquesIds: ${JSON.stringify(j1Data.tanquesIds)}`);
        console.log(`[BACKEND][lobby.handler] 👤 J2 (guest): ${j2Data.nickname} | tanquesIds: ${JSON.stringify(j2Data.tanquesIds)}`);

        // --- PASO 2: Actualizar estado en la API (cambia a EN_CURSO) ---
        await lobbyService.iniciarPartida(hostId, partidaId);
        console.log(`[BACKEND][lobby.handler] ✅ Partida ${partidaId} marcada EN_CURSO en la API`);

        // --- PASO 3: Cargar el mapa ---
        let mapa;
        if (partidaPrevia.mapaId) {
            console.log(`[BACKEND][lobby.handler] 🗺️ Usando mapa seleccionado en automático: ${partidaPrevia.mapaId}`);
            mapa = await mapService.getMapa(partidaPrevia.mapaId);
        } else {
            console.log('[BACKEND][lobby.handler] 🎲 Cargando mapa aleatorio en automático');
            mapa = await mapService.getMapaAleatorio();
        }

        // --- PASO 4: Crear el GameState con los datos capturados pre-inicio ---
        const j1 = {
            id: j1Data.id,
            nickname: j1Data.nickname,
            tanquesIds: (j1Data.tanquesIds || []).map(Number),
            pa: j1Data.pa || 100,   // JugadorLobbyDTO usa 'pa', no 'puntosAccion'
            vida: j1Data.vida || 1000,
            iconoImagen: j1Data.iconoImagen || 'recluta.png'
        };
        const j2 = {
            id: j2Data.id,
            nickname: j2Data.nickname,
            tanquesIds: (j2Data.tanquesIds || []).map(Number),
            pa: j2Data.pa || 100,   // JugadorLobbyDTO usa 'pa', no 'puntosAccion'
            vida: j2Data.vida || 1000,
            iconoImagen: j2Data.iconoImagen || 'recluta.png'
        };

        const gameState = gameManager.crear(partidaId, j1, j2, mapa);
        
        // Iniciar la partida inmediatamente (arranca el timer y turnos)
        gameState.iniciar((timeoutData) => {
            io.to(`game_${partidaId}`).emit('turnoCambiado', timeoutData);
        });

        console.log(`[BACKEND][lobby.handler] 🎮 GameState creado e iniciado para partida ${partidaId}`);

        // --- PASO 5: Mover sockets a sala del juego ---
        const sockets = await io.in(`lobby_${partidaId}`).fetchSockets();
        console.log(`[BACKEND][lobby.handler] 👥 Sockets en lobby para mover: ${sockets.length}`);

        sockets.forEach(s => {
            console.log(`[BACKEND][lobby.handler] ➡️ Socket ${s.id} movido a sala game_${partidaId}`);
            s.leave(`lobby_${partidaId}`);
            s.join(`game_${partidaId}`);
        });

        // --- PASO 6: Notificar el inicio ---
        io.to(`game_${partidaId}`).emit('seleccionTanques', {
            partidaId,
            mapa,
            mensaje: '¡Que comience la batalla! Coloca tus tanques cerca de tu base.'
        });

        // Actualizamos la lista pública de partidas para que desaparezca
        const partidas = await lobbyService.listarPartidas();
        io.emit('listaPartidas', partidas);

    } catch (error) {
        console.error('[BACKEND][lobby.handler] ❌ Error en inicio automático:', error.message);
        io.to(`lobby_${partidaId}`).emit('error', { error: 'No se pudo iniciar la partida automáticamente: ' + error.message });
    }
}


