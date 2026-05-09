class UserManager {
    constructor() {
        this.sessions = new Map();
    }

    // Guarda la sesión del usuario al conectarse
    loginUser(socketId, userData) {
        // Si el usuario ya tenía una sesión anterior la eliminamos
        for (let [key, value] of this.sessions.entries()) {
            if (value.id === userData.id) {
                this.sessions.delete(key);
                break;
            }
        }
        this.sessions.set(socketId, {
            ...userData,
            loginAt: new Date()
        });
    }

    // Obtiene los datos de un usuario por su socketId
    getUser(socketId) {
        return this.sessions.get(socketId) || null;
    }

    // Elimina la sesión al desconectarse
    logoutUser(socketId) {
        this.sessions.delete(socketId);
    }

    // Comprueba si un socket tiene sesión activa
    isLoggedIn(socketId) {
        return this.sessions.has(socketId);
    }

    // Número de usuarios conectados
    getActiveUsers() {
        return this.sessions.size;
    }
}

const userManager = new UserManager();
module.exports = userManager;