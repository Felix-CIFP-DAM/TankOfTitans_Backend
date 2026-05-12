const apiService = require('./api.service');

class AuthService {
// Registro de un nuevo usuario
    async register(nombre, nickname, email, password) {
        return await apiService.post('/api/auth/register', {
            nombre,
            nickname,
            email,
            password
        });
    }

     // Login de un usuario — devuelve el userId y nickname
    async login(nickname, password) {
        try {
            const response = await apiService.post('/api/auth/login', {
                nickname,
                password
            });
            console.log('[BACKEND][auth.service] Respuesta raw de la API Java:', JSON.stringify(response));
            return {
                userId:       response.userId,
                nombre:       response.nombre,
                nickname:     response.nickname,
                token:        response.token,
                icono:        response.icono,
                iconoImagen:  response.iconoImagen
            };
        } catch (error) {
            throw new Error('Usuario o contraseña incorrectos');
        }
    }

}

module.exports = new AuthService();