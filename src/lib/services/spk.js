/**
 * SPK Service for Directus API
 * Handles CRUD operations for SPK (Surat Perintah Kerja)
 */

const BASE_URL = 'https://directus.eltamaprimaindo.com';

// Directus authentication token (same as other services)
let authToken = 'JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz';

/**
 * Load auth token from localStorage (with fallback to hardcoded token)
 */
export function loadAuthToken() {
	if (typeof window !== 'undefined') {
		const token = localStorage.getItem('directus_token');
		if (token) {
			authToken = token;
			console.log('SPK Service - Auth token loaded from localStorage');
		} else {
			// Keep the hardcoded token as fallback
			console.log('SPK Service - Using hardcoded token as fallback');
		}
	}
}

/**
 * Get all SPK from Directus
 * @returns {Promise<Array>} Array of SPK
 */
export async function getSPK() {
	try {
		loadAuthToken();
		
		console.log('Fetching SPK from Directus...');
		console.log('Using auth token:', authToken ? 'Token available' : 'No token');
		
		const response = await fetch(`${BASE_URL}/items/spk?sort=-date_created`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			}
		});

		console.log('SPK fetch response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('SPK fetch error response:', errorText);
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		console.log('SPK fetch result:', result);

		// Return the data array
		return result.data || [];
	} catch (error) {
		console.error('Error fetching SPK:', error);
		throw error;
	}
}

/**
 * Create new SPK in Directus
 * @param {Object} spkData - SPK data to create
 * @returns {Promise<Object>} Created SPK data
 */
export async function createSPK(spkData) {
	try {
		loadAuthToken();
		
		console.log('Creating SPK in Directus:', spkData);
		
		// Transform data to match Directus field names
		const directusData = {
			nomor: spkData.nomor,
			batch_no: spkData.batchNo,
			kode_formula: spkData.kodeFormula,
			nama_formula: spkData.namaFormula,
			finished_good: spkData.finishedGood,
			tanggal: spkData.tanggal,
			jumlah_produksi: spkData.jumlahProduksi,
			unit: spkData.unit,
			kode_customer: spkData.kodeCustomer,
			harga_per_unit: spkData.hargaPerUnit || 0,
			total_harga: spkData.totalHarga || 0,
			status: spkData.status || 'draft',
			keterangan: spkData.keterangan
		};

		const response = await fetch(`${BASE_URL}/items/spk`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(directusData)
		});

		console.log('SPK create response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('SPK create error response:', errorText);
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		console.log('SPK created successfully:', result);

		return result.data;
	} catch (error) {
		console.error('Error creating SPK:', error);
		throw error;
	}
}

/**
 * Update SPK in Directus
 * @param {string|number} id - SPK ID
 * @param {Object} spkData - SPK data to update
 * @returns {Promise<Object>} Updated SPK data
 */
export async function updateSPK(id, spkData) {
	try {
		loadAuthToken();
		
		console.log('Updating SPK in Directus:', { id, spkData });
		
		// Transform data to match Directus field names
		const directusData = {
			nomor: spkData.nomor,
			batch_no: spkData.batchNo,
			kode_formula: spkData.kodeFormula,
			nama_formula: spkData.namaFormula,
			finished_good: spkData.finishedGood,
			tanggal: spkData.tanggal,
			jumlah_produksi: spkData.jumlahProduksi,
			unit: spkData.unit,
			kode_customer: spkData.kodeCustomer,
			harga_per_unit: spkData.hargaPerUnit || 0,
			total_harga: spkData.totalHarga || 0,
			status: spkData.status || 'draft',
			keterangan: spkData.keterangan
		};

		const response = await fetch(`${BASE_URL}/items/spk/${id}`, {
			method: 'PATCH',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(directusData)
		});

		console.log('SPK update response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('SPK update error response:', errorText);
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		console.log('SPK updated successfully:', result);

		return result.data;
	} catch (error) {
		console.error('Error updating SPK:', error);
		throw error;
	}
}

/**
 * Delete SPK from Directus
 * @param {string|number} id - SPK ID
 * @returns {Promise<void>}
 */
export async function deleteSPK(id) {
	try {
		loadAuthToken();
		
		console.log('Deleting SPK from Directus:', id);

		const response = await fetch(`${BASE_URL}/items/spk/${id}`, {
			method: 'DELETE',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			}
		});

		console.log('SPK delete response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('SPK delete error response:', errorText);
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		console.log('SPK deleted successfully');
	} catch (error) {
		console.error('Error deleting SPK:', error);
		throw error;
	}
}

/**
 * Test connection to Directus SPK collection
 * @returns {Promise<Object>} Connection test result
 */
export async function testSPKConnection() {
	try {
		loadAuthToken();
		
		const response = await fetch(`${BASE_URL}/items/spk?limit=1`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			}
		});

		return {
			success: response.ok,
			status: response.status,
			message: response.ok ? 'Connection successful' : `HTTP ${response.status}`
		};
	} catch (error) {
		return {
			success: false,
			status: 0,
			message: error.message
		};
	}
}
