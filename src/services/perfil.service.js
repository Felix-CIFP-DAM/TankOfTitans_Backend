const apiService = require('./api.service');

class PerfilService {

    async obtenerPerfil(usuarioId) {
        return await apiService.get(`/api/perfil/${usuarioId}`);
    }

    async actualizarPerfil(usuarioId, datos) {
        return await apiService.put('/api/perfil/actualizar', {
            usuarioId,
            ...datos
        });
    }
}

module.exports = new PerfilService();