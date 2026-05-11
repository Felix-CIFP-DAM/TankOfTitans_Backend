const apiService = require('./api.service');

class GameService {

    //Guardar estado periódico de la partida (min 0, 5 y 10)
    async guardarEstado(partidaId, jugadores) {
        return await apiService.post(`/api/partidas/${partidaId}/estado`, {
            jugadores
        });
    }

    // Recuperar estado en caso de reconexión
    async recuperarEstado(partidaId) {
        return await apiService.get(`/api/partidas/${partidaId}/estado`);
    }

    // Guardar resultado final
    async guardarResultado(partidaId, ganadorId, perdedorId, empate,
                           duracionSegundos, tanquesMuertosJ1, tanquesMuertosJ2) {
        return await apiService.post(`/api/partidas/${partidaId}/resultado`, {
            ganadorId,
            perdedorId,
            empate,
            duracionSegundos,
            tanquesMuertosJ1,
            tanquesMuertosJ2
        });
    }
}
module.exports = new GameService();