const authService = require('../services/auth.service');
const { generateToken } = require('../utils/jwt.utils');
const userManager = require('../utils/UserManager');

module.exports = (io, socket) => {

    // Registro de un nuevo usuario
    socket.on('register', async (payload) => {
        try {
            const { nombre, nickname, email, password } = payload;

            if (!nombre || !nickname || !email || !password) {
                socket.emit('registerError', {
                    error: 'Todos los campos son obligatorios'
                });
                return;
            }

            const user = await authService.register(nombre, nickname, email, password);

            const token = generateToken(user.id, user.nickname);

            socket.emit('registerSuccess', {
                message: 'Usuario registrado correctamente',
                token,
                userId: user.id,
                nickname: user.nickname
            });

        } catch (error) {
            socket.emit('registerError', { error: error.message });
        }
    });

    // Login de un usuario
    socket.on('login', async (payload) => {
        try {
            const { nickname, password } = payload;

            if (!nickname || !password) {
                socket.emit('loginError', {
                    error: 'Nickname y password son obligatorios'
                });
                return;
            }

            // Autenticamos contra la API
            const userData = await authService.login(nickname, password);

            // Generamos token del middleware para esta sesión
            const token = generateToken(userData.userId, userData.nickname);

            // Guardamos la sesión en el UserManager
            userManager.loginUser(socket.id, {
                id: userData.userId,
                nickname: userData.nickname
            });

            socket.emit('loginSuccess', {
                token,
                userId: userData.userId,
                nickname: userData.nickname
            });

        } catch (error) {
            socket.emit('loginError', { error: error.message });
        }
    });

    // Logout
    socket.on('logout', () => {
        userManager.logoutUser(socket.id);
        socket.emit('logoutSuccess', { message: 'Sesión cerrada correctamente' });
    });
};