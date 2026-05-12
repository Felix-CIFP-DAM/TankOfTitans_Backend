const apiService = require('./api.service');

class AdminService {
    async crearAvatar(nombre) {
        try {
            return await apiService.post('/api/avatars', {
                nombre: nombre,
                imagen: `${nombre}.png`
            });
        } catch (error) {
            console.error(`[BACKEND][admin.service] ❌ Error al crear avatar:`, error.message);
            throw new Error(error.message || 'Error al crear el avatar en la API');
        }
    }

    async listarAvatares() {
        try {
            console.log(`[BACKEND][admin.service] 📡 Llamando a la API Java (vía apiService) a /api/avatars`);
            const data = await apiService.get('/api/avatars');
            console.log(`[BACKEND][admin.service] ✅ Respuesta de la API Java (avatares):`, Array.isArray(data) ? `${data.length} avatares` : data);
            return data;
        } catch (error) {
            console.error(`[BACKEND][admin.service] ❌ Error al obtener avatares de la API:`, error.message);
            throw new Error('Error al obtener la lista de avatares');
        }
    }
}

module.exports = new AdminService();

