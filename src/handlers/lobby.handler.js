const lobbyService = require('../services/lobby.service');
const mapService = require('../services/map.service');
const userManager = require('../utils/UserManager');
const gameManager = require('../game/GameManager');

module.exports = (io, socket) => {
    // Crear una partida
    socket.on('crearPartida', async (payload) => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { nombre, publica, password } = payload;

            const partida = await lobbyService.crearPartida(
                user.id, nombre, publica, password
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
            const partidas = await lobbyService.listarPartidas();
            socket.emit('listaPartidas', partidas);
        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Unirse a una partida
    socket.on('unirsePartida', async (payload) => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId, password } = payload;

            const partida = await lobbyService.unirseAPartida(
                user.id, partidaId, password
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
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId } = payload;

            await lobbyService.marcarListo(user.id, partidaId);

            const partida = await lobbyService.getEstadoPartida(partidaId);

            // Notifica a todos en la sala el nuevo estado
            io.to(`lobby_${partidaId}`).emit('estadoSala', partida);

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Iniciar partida (solo el host)
    socket.on('iniciarPartida', async (payload) => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId } = payload;

            // Actualiza estado en la API
            const partida = await lobbyService.iniciarPartida(user.id, partidaId);

            // Carga un mapa aleatorio
            const mapa = await mapService.getMapaAleatorio();

            // Obtiene los datos de los jugadores de la sala
            const sockets = await io.in(`lobby_${partidaId}`).fetchSockets();
            const jugadores = sockets
                .map(s => userManager.getUser(s.id))
                .filter(Boolean);

            if (jugadores.length < 2) {
                socket.emit('error', { error: 'Se necesitan 2 jugadores' });
                return;
            }

            // Crea el GameState en memoria
            gameManager.crear(
                partidaId,
                jugadores[0],
                jugadores[1],
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
                mapa: {
                    id: mapa.id,
                    nombre: mapa.nombre,
                    ancho: mapa.ancho,
                    alto: mapa.alto,
                    casillas: mapa.casillas
                },
                mensaje: 'Selecciona tus 3 tanques'
            });

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Eliminar partida (solo el host)
    socket.on('eliminarPartida', async (payload) => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { partidaId } = payload;

            await lobbyService.eliminarPartida(user.id, partidaId);

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
            const { partidaId, hostActualId } = payload;
            await lobbyService.cambiarHost(partidaId, hostActualId);

            const partida = await lobbyService.getEstadoPartida(partidaId);
            io.to(`lobby_${partidaId}`).emit('hostCambiado', partida);

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });
};