// src/lib/services/api.js
import axios from 'axios';

// Konfigurasi dasar axios untuk Directus API
const api = axios.create({
	baseURL: 'https://directus.eltamaprimaindo.com',
	headers: {
		'Content-Type': 'application/json',
		Authorization: `Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz`
	}
});

// Interceptor untuk menangani error
api.interceptors.response.use(
	(response) => response,
	(error) => {
		// Handle error disini (misalnya token kadaluarsa atau permission)
		console.error('API Error:', error);
		if (error.response?.status === 403) {
			console.warn('403 Forbidden - Check token permissions or collection access rules');
		}
		return Promise.reject(error);
	}
);

export default api;
