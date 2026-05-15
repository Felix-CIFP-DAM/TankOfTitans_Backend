const apiService = require('./api.service');

class LobbyService {
    // Crear una partida
    async crearPartida(usuarioId, nombre, publica, password = null) {
        return await apiService.post('/api/lobby/crear', {
            usuarioId,
            nombre,
            publica,
            password
        });
    }

    // Listar partidas públicas disponibles
    async listarPartidas() {
        return await apiService.get('/api/lobby/partidas');
    }

    // Ver estado de una partida concreta
    async getEstadoPartida(partidaId) {
        return await apiService.get(`/api/lobby/partidas/${partidaId}`);
    }

    // Unirse a una partida
    async unirseAPartida(usuarioId, partidaId, password = null) {
        return await apiService.post(`/api/lobby/unirse/${partidaId}`, {
            usuarioId,
            password
        });
    }

    // Marcar listo / no listo
    async marcarListo(usuarioId, partidaId) {
        return await apiService.put(`/api/lobby/listo/${partidaId}`, {
            usuarioId
        });
    }

    // Iniciar la partida
    async iniciarPartida(usuarioId, partidaId) {
        return await apiService.put(`/api/lobby/iniciar/${partidaId}`, {
            usuarioId
        });
    }

    // Eliminar una partida
    async eliminarPartida(usuarioId, partidaId) {
        return await apiService.delete(`/api/lobby/eliminar/${partidaId}`, {
            usuarioId
        });
    }

    // Cambiar el host
    async cambiarHost(partidaId, hostActualId) {
        return await apiService.put(`/api/lobby/cambiarHost/${partidaId}/${hostActualId}`);
    }

    // Seleccionar tanque
    async seleccionarTanque(usuarioId, partidaId, tanqueId) {
        return await apiService.post(`/api/lobby/seleccionarTanque/${partidaId}`, {
            usuarioId,
            tanqueId
        });
    }

    // Deseleccionar tanque
    async deseleccionarTanque(usuarioId, partidaId, tanqueId) {
        return await apiService.post(`/api/lobby/deseleccionarTanque/${partidaId}`, {
            usuarioId,
            tanqueId
        });
    }

    // Seleccionar mapa
    async seleccionarMapa(usuarioId, partidaId, mapaId) {
        return await apiService.post(`/api/lobby/seleccionarMapa/${partidaId}`, {
            usuarioId,
            mapaId
        });
    }

    // Abandonar partida
    async abandonarPartida(usuarioId, partidaId) {
        return await apiService.post(`/api/lobby/abandonar/${partidaId}`, {
            usuarioId
        });
    }
}

module.exports = new LobbyService();