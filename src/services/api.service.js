const axios = require('axios');
require('dotenv').config();

class ApiService {
    constructor() {
        this.baseURL = process.env.API_URL;
        this.token = null;

        // Instancia de axios con la URL base de Spring Boot
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Login contra Spring Boot con el superusuario
    async login() {
        try {
            const response = await this.client.post('/api/auth/login', {
                nickname: process.env.MIDDLEWARE_NICKNAME,
                password: process.env.MIDDLEWARE_PASSWORD
            });
            this.token = response.data.token;
            console.log('Middleware autenticado correctamente en la API');
        } catch (error) {
            console.error('Error al autenticar el middleware en la API:', error.message);
            throw error;
        }
    }

    // Devuelve los headers con el token para las peticiones protegidas
    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    // GET genérico
    async get(endpoint) {
        try {
            const response = await this.client.get(endpoint, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    // POST genérico
    async post(endpoint, data) {
        try {
            console.log(`[BACKEND][api.service] 📡 POST ${endpoint} - Body:`, JSON.stringify(data));
            const response = await this.client.post(endpoint, data, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    // PUT genérico
    async put(endpoint, data) {
        try {
            const response = await this.client.put(endpoint, data, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    // DELETE genérico
    async delete(endpoint, data) {
        try {
            const response = await this.client.delete(endpoint, {
                headers: this.getAuthHeaders(),
                data: data
            });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    handleError(error) {
        if (error.response) {
            // La API respondió con un error
            throw new Error(error.response.data.error || 'Error en la API');
        } else {
            // No hubo respuesta (API caída, etc.)
            throw new Error('No se pudo conectar con la API');
        }
    }
}

// Exportamos una única instancia para toda la aplicación
const apiService = new ApiService();
module.exports = apiService;