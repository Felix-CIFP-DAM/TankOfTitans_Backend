require('dotenv').config();

module.exports = {
    baseURL: process.env.API_URL || 'http://localhost:8080',
    nickname: process.env.MIDDLEWARE_NICKNAME || 'middleware_admin',
    password: process.env.MIDDLEWARE_PASSWORD || 'middleware_secret_2024'
};
