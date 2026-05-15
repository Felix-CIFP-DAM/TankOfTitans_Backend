const perfilService = require('../services/perfil.service');
const userManager = require('../utils/UserManager');

module.exports = (io, socket) => {

    // Obtener perfil
    socket.on('obtener_perfil', async () => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                console.warn('[BACKEND][perfil.handler] ⚠️ obtener_perfil: usuario no autenticado');
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            console.log(`[BACKEND][perfil.handler] 📥 obtener_perfil para userId: ${user.id}`);
            const perfil = await perfilService.obtenerPerfil(user.id);
            console.log(`[BACKEND][perfil.handler] 📤 Emitiendo perfil_datos:`, { nombre: perfil.nombre, nickname: perfil.nickname, icono: perfil.icono, iconoImagen: perfil.iconoImagen });
            socket.emit('perfil_datos', perfil);

        } catch (error) {
            console.error('[BACKEND][perfil.handler] ❌ Error en obtener_perfil:', error.message);
            socket.emit('error', { error: error.message });
        }
    });

    // Obtener tanques del usuario
    socket.on('obtener_tanques', async () => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            console.log(`[BACKEND][perfil.handler] 📥 obtener_tanques para userId: ${user.id}`);
            const tanques = await perfilService.obtenerTanques(user.id);
            console.log(`[BACKEND][perfil.handler] 📤 Emitiendo tanques_usuario: ${tanques.length} tanques`);
            socket.emit('tanques_usuario', tanques);

        } catch (error) {
            console.error('[BACKEND][perfil.handler] ❌ Error en obtener_tanques:', error.message);
            socket.emit('error', { error: error.message });
        }
    });
    
    // Listar avatares (con info de si el usuario los tiene)
    socket.on('listar_avatares', async () => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            console.log(`[BACKEND][perfil.handler] 📥 listar_avatares para userId: ${user.id}`);
            const avatares = await perfilService.listarAvatares(user.id);
            socket.emit('avatares_lista', avatares);

        } catch (error) {
            console.error('[BACKEND][perfil.handler] ❌ Error en listar_avatares:', error.message);
            socket.emit('error', { error: error.message });
        }
    });


    // Actualizar perfil
    socket.on('actualizar_perfil', async (payload) => {
        try {
            console.log('[BACKEND][perfil.handler] 📥 Evento actualizar_perfil recibido. Payload:', payload);
            const user = userManager.getUser(socket.id);
            if (!user) {
                console.warn('[BACKEND][perfil.handler] ⚠️ Intento de actualización sin sesión');
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            const { nombre, nickname, email, password, icono } = payload;
            console.log(`[BACKEND][perfil.handler] 📡 Actualizando para userId: ${user.id}`);

            const perfil = await perfilService.actualizarPerfil(user.id, {
                nombre,
                nickname,
                email,
                password,
                icono
            });

            console.log('[BACKEND][perfil.handler] ✅ Perfil actualizado en API:', perfil);

            // Si cambió el nickname actualizamos la sesión
            if (nickname) {
                user.nickname = nickname;
                console.log(`[BACKEND][perfil.handler] 👤 Nickname actualizado en sesión: ${nickname}`);
            }

            socket.emit('perfil_resultado', {
                success: true,
                ...perfil
            });

        } catch (error) {
            console.error('[BACKEND][perfil.handler] ❌ Error en actualizar_perfil:', error.message);
            socket.emit('perfil_resultado', {
                success: false,
                mensaje: error.message
            });
        }
    });

};