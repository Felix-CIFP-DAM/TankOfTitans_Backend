const axios = require('axios');
require('dotenv').config();

class ApiService {
    constructor() {
        this.baseURL = process.env.API_URL;
        this.token = null;

        // Instancia de axios con la URL base de Spring Boot
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 15000,
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
            // La API respondió con un error (4xx o 5xx)
            const detail = error.response.data.message || error.response.data.error || 'Sin detalle';
            console.error(`[BACKEND][api.service] ❌ Error ${error.response.status}: ${detail}`);
            throw new Error(`API Error (${error.response.status}): ${detail}`);
        } else if (error.request) {
            // La petición se hizo pero no hubo respuesta (API caída o timeout)
            console.error('[BACKEND][api.service] ❌ No hubo respuesta de la API');
            throw new Error('No se pudo conectar con la API (Sin respuesta)');
        } else {
            // Error al configurar la petición
            console.error('[BACKEND][api.service] ❌ Error de configuración:', error.message);
            throw new Error(`Error local: ${error.message}`);
        }
    }
}

// Exportamos una única instancia para toda la aplicación
const apiService = new ApiService();
module.exports = apiService;