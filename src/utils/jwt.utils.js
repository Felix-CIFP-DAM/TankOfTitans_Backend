const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET no está definido en las variables de entorno (.env)');

// Genera un token para la sesión del usuario en el middleware
const generateToken = (userId, nickname) => {
    return jwt.sign(
        { id: userId, nickname },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

// Verifica y decodifica un token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

module.exports = { generateToken, verifyToken };