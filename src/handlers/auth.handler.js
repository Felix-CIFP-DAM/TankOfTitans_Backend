const authService = require('../services/auth.service');
const { generateToken } = require('../utils/jwt.utils');
const userManager = require('../utils/UserManager');

module.exports = (io, socket) => {

    // Registro de un nuevo usuario
    socket.on('register', async (payload) => {
        try {
            const { nombre, nickname, email, password } = payload;
            console.log(`[BACKEND][auth.handler] 📝 Evento 'register' recibido para: ${nickname}`);

            if (!nombre || !nickname || !email || !password) {
                socket.emit('registerError', {
                    error: 'Todos los campos son obligatorios'
                });
                return;
            }

            const user = await authService.register(nombre, nickname, email, password);
            console.log(`[BACKEND][auth.handler] ✅ Usuario registrado:`, { id: user.id, nombre: user.nombre, nickname: user.nickname });

            const token = generateToken(user.id, user.nickname);

            socket.emit('registerSuccess', {
                message: 'Usuario registrado correctamente',
                token,
                userId:      user.id,
                nombre:      user.nombre   || nombre,    // del objeto usuario o del payload
                nickname:    user.nickname || nickname,
                icono:       user.icono    || 0,
                iconoImagen: 'recluta.png'               // avatar por defecto para nuevos usuarios
            });

        } catch (error) {
            console.error(`[BACKEND][auth.handler] ❌ Error en registro:`, error.message);
            socket.emit('registerError', { error: error.message });
        }
    });


    // Login de un usuario
    socket.on('login', async (payload) => {
        try {
            const { nickname, password } = payload;
            console.log(`[BACKEND][auth.handler] 🔐 Evento 'login' recibido para: ${nickname}`);

            if (!nickname || !password) {
                socket.emit('loginError', {
                    error: 'Nickname y password son obligatorios'
                });
                return;
            }

            // Autenticamos contra la API
            console.log(`[BACKEND][auth.handler] 📡 Llamando authService.login...`);
            const userData = await authService.login(nickname, password);
            console.log(`[BACKEND][auth.handler] ✅ Respuesta API:`, {
                userId: userData.userId,
                nombre: userData.nombre,
                nickname: userData.nickname,
                icono: userData.icono,
                iconoImagen: userData.iconoImagen
            });

            // Generamos token del middleware para esta sesión
            const token = generateToken(userData.userId, userData.nickname);

            // Guardamos la sesión en el UserManager
            userManager.loginUser(socket.id, {
                id: userData.userId,
                nickname: userData.nickname
            });

            console.log(`[BACKEND][auth.handler] 📤 Emitiendo 'loginSuccess' -> iconoImagen: ${userData.iconoImagen}`);
            socket.emit('loginSuccess', {
                token,
                userId:       userData.userId,
                nombre:       userData.nombre,
                nickname:     userData.nickname,
                icono:        userData.icono,
                iconoImagen:  userData.iconoImagen
            });

        } catch (error) {
            console.error(`[BACKEND][auth.handler] ❌ Error en login:`, error.message);
            socket.emit('loginError', { error: error.message });
        }
    });


    // Logout
    socket.on('logout', () => {
        userManager.logoutUser(socket.id);
        socket.emit('logoutSuccess', { message: 'Sesión cerrada correctamente' });
    });
};