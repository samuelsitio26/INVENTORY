// src/lib/services/gudang.js
import api from './api.js';

/**
 * Mendapatkan semua data gudang
 */
export async function getGudang() {
    try {
        const response = await api.get('/items/gudang');
        return response.data.data || [];
    } catch (error) {
        console.error('Error fetching gudang:', error);
        throw new Error('Gagal mengambil data gudang');
    }
}

/**
 * Membuat gudang baru
 * @param {Object} gudangData - Data gudang yang akan dibuat
 * @param {string} gudangData.kode_gudang - Kode gudang
 * @param {string} gudangData.nama_gudang - Nama gudang
 */
export async function createGudang(gudangData) {
    try {
        const response = await api.post('/items/gudang', gudangData);
        return response.data.data;
    } catch (error) {
        console.error('Error creating gudang:', error);
        if (error.response?.data?.errors) {
            const errorMessages = error.response.data.errors.map(err => err.message).join(', ');
            throw new Error(`Gagal membuat gudang: ${errorMessages}`);
        }
        throw new Error('Gagal membuat gudang');
    }
}

/**
 * Mengupdate data gudang
 * @param {number} id - ID gudang
 * @param {Object} gudangData - Data gudang yang akan diupdate
 */
export async function updateGudang(id, gudangData) {
    try {
        const response = await api.patch(`/items/gudang/${id}`, gudangData);
        return response.data.data;
    } catch (error) {
        console.error('Error updating gudang:', error);
        if (error.response?.data?.errors) {
            const errorMessages = error.response.data.errors.map(err => err.message).join(', ');
            throw new Error(`Gagal mengupdate gudang: ${errorMessages}`);
        }
        throw new Error('Gagal mengupdate gudang');
    }
}

/**
 * Menghapus gudang
 * @param {number} id - ID gudang
 */
export async function deleteGudang(id) {
    try {
        await api.delete(`/items/gudang/${id}`);
        return true;
    } catch (error) {
        console.error('Error deleting gudang:', error);
        if (error.response?.data?.errors) {
            const errorMessages = error.response.data.errors.map(err => err.message).join(', ');
            throw new Error(`Gagal menghapus gudang: ${errorMessages}`);
        }
        throw new Error('Gagal menghapus gudang');
    }
}

/**
 * Mendapatkan detail gudang berdasarkan ID
 * @param {number} id - ID gudang
 */
export async function getGudangById(id) {
    try {
        const response = await api.get(`/items/gudang/${id}`);
        return response.data.data;
    } catch (error) {
        console.error('Error fetching gudang by ID:', error);
        throw new Error('Gagal mengambil detail gudang');
    }
}
