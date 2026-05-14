const apiService = require('./api.service');

class PerfilService {

    async obtenerPerfil(usuarioId) {
        return await apiService.get(`/api/perfil/${usuarioId}`);
    }

    async actualizarPerfil(usuarioId, datos) {
        try {
            // Mapeamos 'password' (del handler) a 'contrasena' (de la API Java)
            const payloadJava = {
                usuarioId,
                nombre:     datos.nombre,
                nickname:   datos.nickname,
                email:      datos.email,
                icono:      datos.icono,
                contrasena: datos.password || datos.contrasena // Aceptamos ambos nombres
            };

            console.log(`[BACKEND][perfil.service] 📡 Enviando PUT a /api/perfil/actualizar para ID: ${usuarioId}`);
            const response = await apiService.put('/api/perfil/actualizar', payloadJava);
            console.log(`[BACKEND][perfil.service] ✅ Respuesta de API Java recibida`);
            return response;
        } catch (error) {
            console.error(`[BACKEND][perfil.service] ❌ Error en la llamada a la API:`, error.message);
            throw error;
        }
    }

    async obtenerTanques(usuarioId) {
        return await apiService.get(`/api/perfil/${usuarioId}/tanques`);
    }

}

module.exports = new PerfilService();