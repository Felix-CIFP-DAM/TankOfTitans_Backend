const { verifyToken } = require('../utils/jwt.utils');
const userManager = require('../utils/UserManager');

const authMiddleware = (socket, next) => {
    const token = socket.handshake.auth.token;

    // Si no hay token solo dejamos pasar la conexión inicial
    // El usuario tendrá que hacer login antes de cualquier acción
    if (!token) {
        return next();
    }

    const payload = verifyToken(token);

    if (!payload) {
        return next(new Error('Token inválido o expirado'));
    }

    // Guardamos los datos del usuario en el socket
    socket.userId = payload.id;
    socket.nickname = payload.nickname;

    // Si el usuario ya tiene sesión la actualizamos
    if (!userManager.isLoggedIn(socket.id)) {
        userManager.loginUser(socket.id, {
            id: payload.id,
            nickname: payload.nickname
        });
    }

    next();
};

module.exports = authMiddleware;