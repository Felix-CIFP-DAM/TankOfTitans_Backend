const apiService = require('./api.service');

class TiendaService {
    async obtenerTienda(usuarioId) {
        return await apiService.get(`/api/tienda/${usuarioId}`);
    }

    async comprarTanque(usuarioId, tanqueId) {
        return await apiService.post(`/api/tienda/${usuarioId}/comprar/tanque/${tanqueId}`);
    }

    async comprarAvatar(usuarioId, avatarId) {
        return await apiService.post(`/api/tienda/${usuarioId}/comprar/avatar/${avatarId}`);
    }
}

module.exports = new TiendaService();
