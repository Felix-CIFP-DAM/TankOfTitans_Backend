const apiService = require('./api.service');

class MapService {
    // Obtener un mapa concreto con todas sus casillas
    async getMapa(mapaId) {
        return await apiService.get(`/api/mapas/${mapaId}`);
    }

    // Listar todos los mapas disponibles
    async listarMapas() {
        return await apiService.get('/api/mapas');
    }

    // Obtener un mapa aleatorio
    async getMapaAleatorio() {
        const mapas = await this.listarMapas();
        if (!mapas || mapas.length === 0) {
            throw new Error('No hay mapas disponibles');
        }
        const indice = Math.floor(Math.random() * mapas.length);
        return mapas[indice];
    }
}

module.exports = new MapService();