const adminService = require('../services/admin.service');
const userManager = require('../utils/UserManager');

module.exports = (io, socket) => {

    // Crear avatar (Solo para administradores)
    socket.on('crear_avatar', async (payload) => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            // Aquí se podría añadir una comprobación de rol si es necesario

            const { nombre } = payload;
            if (!nombre) {
                socket.emit('avatar_creado', { success: false, mensaje: 'El nombre es obligatorio' });
                return;
            }

            const avatar = await adminService.crearAvatar(nombre);
            
            socket.emit('avatar_creado', {
                success: true,
                avatar
            });

            // Opcional: Notificar a todos que hay un nuevo avatar
            io.emit('nuevo_avatar', avatar);

        } catch (error) {
            socket.emit('avatar_creado', {
                success: false,
                mensaje: error.message
            });
        }
    });

    // Listar avatares
    socket.on('listar_avatares', async () => {
        try {
            console.log('[BACKEND][admin.handler] 📥 Evento listar_avatares recibido');
            const avatares = await adminService.listarAvatares();
            console.log(`[BACKEND][admin.handler] 📤 Emitiendo avatares_lista: ${avatares.length} avatares`);
            socket.emit('avatares_lista', avatares);
        } catch (error) {
            console.error('[BACKEND][admin.handler] ❌ Error en listar_avatares:', error.message);
            socket.emit('error', { error: error.message });
        }
    });

    // Guardar mapa
    socket.on('mapa:guardar', async (payload) => {
        try {
            console.log(`[BACKEND][admin.handler] 📥 Evento mapa:guardar recibido: ${payload.nombreMapa}`);
            
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('mapa:guardado', { success: false, mensaje: 'No has iniciado sesión' });
                return;
            }

            const mapa = await adminService.crearMapa(payload);
            
            console.log(`[BACKEND][admin.handler] ✅ Mapa guardado correctamente: ${mapa.nombre}`);
            socket.emit('mapa:guardado', {
                success: true,
                mapa
            });

        } catch (error) {
            console.error('[BACKEND][admin.handler] ❌ Error en mapa:guardar:', error.message);
            socket.emit('mapa:guardado', {
                success: false,
                mensaje: error.message
            });
        }
    });

};
