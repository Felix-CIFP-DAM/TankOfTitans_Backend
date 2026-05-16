const tiendaService = require('../services/tienda.service');
const userManager = require('../utils/UserManager');

module.exports = (io, socket) => {
    // Obtener contenido de la tienda
    socket.on('obtener_tienda', async () => {
        try {
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            console.log(`[BACKEND][tienda.handler] 🛒 obtener_tienda para userId: ${user.id}`);
            const tienda = await tiendaService.obtenerTienda(user.id);
            socket.emit('tienda_datos', tienda);

        } catch (error) {
            console.error('[BACKEND][tienda.handler] ❌ Error en obtener_tienda:', error.message);
            socket.emit('error', { error: error.message });
        }
    });

    // Comprar un tanque
    socket.on('comprar_tanque', async (payload) => {
        try {
            const { tanqueId } = payload;
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            console.log(`[BACKEND][tienda.handler] 🛡️ comprar_tanque ${tanqueId} para userId: ${user.id}`);
            await tiendaService.comprarTanque(user.id, tanqueId);
            
            // Si la compra tiene éxito, emitimos respuesta positiva
            socket.emit('compra_resultado', { success: true, mensaje: 'Tanque adquirido con éxito' });
            
            // Opcional: reenviar el estado actualizado de la tienda o monedas
            const tienda = await tiendaService.obtenerTienda(user.id);
            socket.emit('tienda_datos', tienda);

        } catch (error) {
            console.error('[BACKEND][tienda.handler] ❌ Error en comprar_tanque:', error.message);
            socket.emit('compra_resultado', { success: false, mensaje: error.message });
        }
    });

    // Comprar un avatar
    socket.on('comprar_avatar', async (payload) => {
        try {
            const { avatarId } = payload;
            const user = userManager.getUser(socket.id);
            if (!user) {
                socket.emit('error', { error: 'No has iniciado sesión' });
                return;
            }

            console.log(`[BACKEND][tienda.handler] 🎭 comprar_avatar ${avatarId} para userId: ${user.id}`);
            await tiendaService.comprarAvatar(user.id, avatarId);
            
            socket.emit('compra_resultado', { success: true, mensaje: 'Avatar adquirido con éxito' });
            
            const tienda = await tiendaService.obtenerTienda(user.id);
            socket.emit('tienda_datos', tienda);

        } catch (error) {
            console.error('[BACKEND][tienda.handler] ❌ Error en comprar_avatar:', error.message);
            socket.emit('compra_resultado', { success: false, mensaje: error.message });
        }
    });
};
