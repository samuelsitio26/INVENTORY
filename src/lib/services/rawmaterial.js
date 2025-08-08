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
 * Test basic connection to Directus server
 * @returns {Promise<Object>} Connection test result
 */
export async function testDirectusConnection() {
	try {
		loadAuthToken();
		
		console.log('Testing Directus connection...');
		console.log('Base URL:', BASE_URL);
		console.log('Token available:', authToken ? 'Yes' : 'No');
		
		// Test basic server connection first
		const serverResponse = await fetch(`${BASE_URL}/server/info`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		
		if (!serverResponse.ok) {
			throw new Error(`Server connection failed: ${serverResponse.status}`);
		}
		
		// Test authenticated endpoint
		const authResponse = await fetch(`${BASE_URL}/items/rawmaterial?limit=1`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			}
		});

		const result = {
			serverConnected: serverResponse.ok,
			authenticationWorking: authResponse.ok,
			status: authResponse.status,
			message: authResponse.ok ? 'Connection successful' : `Auth failed: HTTP ${authResponse.status}`
		};
		
		if (!authResponse.ok) {
			const errorText = await authResponse.text();
			result.error = errorText;
		}
		
		console.log('Connection test result:', result);
		return result;
		
	} catch (error) {
		console.error('Connection test error:', error);
		return {
			serverConnected: false,
			authenticationWorking: false,
			status: 0,
			message: error.message,
			error: error.message
		};
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
			in_kg: Number(rawMaterialData.in_kg) || 0
			// Removed status: 'published' to see if it's causing issues
		};

		console.log('Sanitized data to send:', sanitizedData);
		console.log('Request URL:', `${BASE_URL}/items/rawmaterial`);
		
		const response = await fetch(`${BASE_URL}/items/rawmaterial`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(sanitizedData)
		});

		console.log('Create raw material response status:', response.status);
		console.log('Response headers:', Object.fromEntries(response.headers.entries()));

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Create raw material error response:', errorText);
			
			// Try to parse error for more details
			try {
				const errorJson = JSON.parse(errorText);
				console.error('Parsed error:', errorJson);
				throw new Error(`HTTP ${response.status}: ${errorJson.errors?.[0]?.message || errorText}`);
			} catch (parseError) {
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}
		}

		const result = await response.json();
		console.log('Create raw material result:', result);

		return result.data;
	} catch (error) {
		console.error('Error creating raw material:', error);
		console.error('Error stack:', error.stack);
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
		console.log('Using URL:', `${BASE_URL}/items/rawmaterial`);
		console.log('Using token:', authToken ? 'Token available' : 'No token');
		
		// First, get the total count of items to ensure we fetch all data
		const countResponse = await fetch(`${BASE_URL}/items/rawmaterial?aggregate[count]=*`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			}
		});

		let totalCount = 0;
		if (countResponse.ok) {
			const countResult = await countResponse.json();
			totalCount = countResult.data?.[0]?.count || 0;
			console.log('Total items in Directus:', totalCount);
		}

		// Set limit to -1 to get all items, or use a very high limit
		const limit = totalCount > 0 ? Math.max(totalCount, 1000) : 1000;
		
		// Try without status filter first to see if data exists, and with high limit
		const response = await fetch(`${BASE_URL}/items/rawmaterial?fields=*&sort=kode&limit=${limit}`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			}
		});

		console.log('All raw materials fetch response status:', response.status);
		console.log('Response headers:', Object.fromEntries(response.headers.entries()));

		if (!response.ok) {
			const errorText = await response.text();
			console.error('All raw materials fetch error response:', errorText);
			
			// Try to get more specific error information
			try {
				const errorJson = JSON.parse(errorText);
				console.error('Parsed error:', errorJson);
			} catch (e) {
				console.error('Could not parse error response as JSON');
			}
			
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		console.log('All raw materials fetch result structure:', {
			hasData: !!result.data,
			dataLength: result.data ? result.data.length : 0,
			meta: result.meta,
			firstItem: result.data && result.data.length > 0 ? result.data[0] : null,
			expectedCount: totalCount,
			actualCount: result.data ? result.data.length : 0
		});

		// Check if we got all the data
		if (result.data && totalCount > 0 && result.data.length < totalCount) {
			console.warn(`Warning: Expected ${totalCount} items but got ${result.data.length}`);
			
			// Try to fetch in batches if we didn't get all data
			const batchSize = 100;
			const allData = [...result.data];
			
			for (let offset = result.data.length; offset < totalCount; offset += batchSize) {
				console.log(`Fetching batch: offset ${offset}, limit ${batchSize}`);
				
				const batchResponse = await fetch(`${BASE_URL}/items/rawmaterial?fields=*&sort=kode&limit=${batchSize}&offset=${offset}`, {
					method: 'GET',
					headers: {
						'Authorization': `Bearer ${authToken}`,
						'Content-Type': 'application/json'
					}
				});
				
				if (batchResponse.ok) {
					const batchResult = await batchResponse.json();
					if (batchResult.data && batchResult.data.length > 0) {
						allData.push(...batchResult.data);
						console.log(`Added ${batchResult.data.length} items, total: ${allData.length}`);
					} else {
						break; // No more data
					}
				} else {
					console.error('Batch fetch failed:', batchResponse.status);
					break;
				}
			}
			
			console.log(`Final data count: ${allData.length} of expected ${totalCount}`);
			return allData;
		}

		return result.data || [];
	} catch (error) {
		console.error('Error fetching all raw materials:', error);
		console.error('Error stack:', error.stack);
		throw error;
	}
}

/**
 * Get all raw materials - Simple version without batching
 * @returns {Promise<Array>} Array of raw materials with all fields
 */
export async function getAllRawMaterialsSimple() {
	try {
		loadAuthToken();
		
		console.log('Fetching all raw materials (simple version)...');
		
		// Use limit=-1 to get all items (Directus supports this)
		const response = await fetch(`${BASE_URL}/items/rawmaterial?fields=*&sort=kode&limit=-1`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			}
		});

		console.log('Simple fetch response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Simple fetch error:', errorText);
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		console.log('Simple fetch result:', {
			hasData: !!result.data,
			dataLength: result.data ? result.data.length : 0
		});

		return result.data || [];
	} catch (error) {
		console.error('Error in simple fetch:', error);
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
