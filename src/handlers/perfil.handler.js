const perfilService = require('../services/perfil.service');
const userManager = require('../utils/UserManager');

module.exports = (io, socket) => {

    // Obtener perfil
    socket.on('obtener_perfil', async () => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const perfil = await perfilService.obtenerPerfil(user.id);
            socket.emit('perfil_datos', perfil);

        } catch (error) {
            socket.emit('error', { error: error.message });
        }
    });

    // Actualizar perfil
    socket.on('actualizar_perfil', async (payload) => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { nombre, nickname, email, contrasena, icono } = payload;

            const perfil = await perfilService.actualizarPerfil(user.id, {
                nombre,
                nickname,
                email,
                contrasena,
                icono
            });

            // Si cambió el nickname actualizamos la sesión
            if (nickname) {
                const sesion = userManager.getUser(socket.id);
                sesion.nickname = nickname;
            }

            socket.emit('perfil_resultado', {
                success: true,
                ...perfil
            });

        } catch (error) {
            socket.emit('perfil_resultado', {
                success: false,
                mensaje: error.message
            });
        }
    });
};