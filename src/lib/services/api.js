// src/lib/services/api.js
import axios from 'axios';

// Konfigurasi dasar axios untuk Directus API
const api = axios.create({
  baseURL: 'https://directus.eltamaprimaindo.com',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz`
  }
});

// Interceptor untuk menangani error
api.interceptors.response.use(
  response => response,
  error => {
    // Handle error disini (misalnya token kadaluarsa)
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default api;