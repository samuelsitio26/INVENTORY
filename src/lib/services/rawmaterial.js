/**
 * Raw Material Service for Directus API
 * Handles CRUD operations for raw materials
 */

const BASE_URL = 'https://directus.eltamaprimaindo.com';

// Directus authentication token (same as formula service)
let authToken = 'JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz';

/**
 * Load auth token from localStorage (with fallback to hardcoded token)
 */
export function loadAuthToken() {
	if (typeof window !== 'undefined') {
		const token = localStorage.getItem('directus_token');
		if (token) {
			authToken = token;
			console.log('Raw Material Service - Auth token loaded from localStorage');
		} else {
			// Keep the hardcoded token as fallback
			console.log('Raw Material Service - Using hardcoded token as fallback');
		}
	}
}

/**
 * Get all raw materials from Directus
 * @returns {Promise<Array>} Array of raw materials
 */
export async function getRawMaterials() {
	try {
		// Load auth token but don't require it from localStorage (we have hardcoded fallback)
		loadAuthToken();
		
		console.log('Fetching raw materials from Directus...');
		console.log('Using auth token:', authToken ? 'Token available' : 'No token');
		
		const response = await fetch(`${BASE_URL}/items/rawmaterial?fields=id,kode,nama&filter[status][_eq]=published&sort=kode`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			}
		});

		console.log('Raw materials fetch response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Raw materials fetch error response:', errorText);
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		console.log('Raw materials fetch result:', result);

		// Return the data array
		return result.data || [];
	} catch (error) {
		console.error('Error fetching raw materials:', error);
		throw error;
	}
}

/**
 * Test connection to Directus raw material collection
 * @returns {Promise<Object>} Connection test result
 */
export async function testRawMaterialConnection() {
	try {
		loadAuthToken();
		
		const response = await fetch(`${BASE_URL}/items/rawmaterial?limit=1`, {
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

/**
 * Create a new raw material in Directus
 * @param {Object} rawMaterialData - Raw material data to create
 * @returns {Promise<Object>} Created raw material data
 */
export async function createRawMaterial(rawMaterialData) {
	try {
		loadAuthToken();
		
		console.log('Creating raw material in Directus...');
		console.log('Raw material data to send:', rawMaterialData);
		
		// Ensure all fields are properly formatted and not undefined
		const sanitizedData = {
			kode: (rawMaterialData.kode || '').toString(),
			nama: (rawMaterialData.nama || '').toString(),
			kemasan: (rawMaterialData.kemasan || '').toString(),
			satuan: (rawMaterialData.satuan || '').toString(),
			Divisi: (rawMaterialData.Divisi || '').toString(),
			Group: (rawMaterialData.Group || '').toString(),
			Jenis: (rawMaterialData.Jenis || '').toString(),
			stok: (rawMaterialData.stok || '').toString(),
			kategori: (rawMaterialData.kategori || 'Active').toString(),
			harga_beli: Number(rawMaterialData.harga_beli) || 0,
			harga_lama: Number(rawMaterialData.harga_lama) || 0,
			hp_awal: Number(rawMaterialData.hp_awal) || 0,
			sisa_stok: Number(rawMaterialData.sisa_stok) || 0,
			sisa_po: Number(rawMaterialData.sisa_po) || 0,
			minimum_stok: Number(rawMaterialData.minimum_stok) || 0,
			in_liter: Number(rawMaterialData.in_liter) || 0,
			in_kg: Number(rawMaterialData.in_kg) || 0,
			status: 'published'
		};

		console.log('Sanitized data to send:', sanitizedData);
		
		const response = await fetch(`${BASE_URL}/items/rawmaterial`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(sanitizedData)
		});

		console.log('Create raw material response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Create raw material error response:', errorText);
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		console.log('Create raw material result:', result);

		return result.data;
	} catch (error) {
		console.error('Error creating raw material:', error);
		throw error;
	}
}

/**
 * Get all raw materials with full details from Directus
 * @returns {Promise<Array>} Array of raw materials with all fields
 */
export async function getAllRawMaterials() {
	try {
		loadAuthToken();
		
		console.log('Fetching all raw materials from Directus...');
		
		const response = await fetch(`${BASE_URL}/items/rawmaterial?fields=*&filter[status][_eq]=published&sort=kode`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			}
		});

		console.log('All raw materials fetch response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('All raw materials fetch error response:', errorText);
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		console.log('All raw materials fetch result:', result);

		return result.data || [];
	} catch (error) {
		console.error('Error fetching all raw materials:', error);
		throw error;
	}
}

/**
 * Update a raw material in Directus
 * @param {string} id - Raw material ID
 * @param {Object} rawMaterialData - Raw material data to update
 * @returns {Promise<Object>} Updated raw material data
 */
export async function updateRawMaterial(id, rawMaterialData) {
	try {
		loadAuthToken();
		
		console.log('Updating raw material in Directus...', id, rawMaterialData);
		
		const response = await fetch(`${BASE_URL}/items/rawmaterial/${id}`, {
			method: 'PATCH',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(rawMaterialData)
		});

		console.log('Update raw material response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Update raw material error response:', errorText);
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		console.log('Update raw material result:', result);

		return result.data;
	} catch (error) {
		console.error('Error updating raw material:', error);
		throw error;
	}
}

/**
 * Delete a raw material from Directus
 * @param {string} id - Raw material ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteRawMaterial(id) {
	try {
		loadAuthToken();
		
		console.log('Deleting raw material from Directus...', id);
		
		const response = await fetch(`${BASE_URL}/items/rawmaterial/${id}`, {
			method: 'DELETE',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			}
		});

		console.log('Delete raw material response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Delete raw material error response:', errorText);
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		return true;
	} catch (error) {
		console.error('Error deleting raw material:', error);
		throw error;
	}
}
