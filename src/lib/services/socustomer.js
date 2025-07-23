// src/lib/services/socustomer.js

const BASE_URL = 'https://directus.eltamaprimaindo.com';

/**
 * Fetch SO Customer data from Directus API with details
 * @returns {Promise<Array>} Array of SO Customer data with product details
 */
export async function fetchSOCustomer() {
	try {
		console.log('Fetching SO Customer data from:', `${BASE_URL}/items/so_customer`);

		// Fetch SO Customer with details if the relation exists
		const response = await fetch(`${BASE_URL}/items/so_customer?fields=*,details.*`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		console.log('SO Customer API response status:', response.status);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result = await response.json();
		console.log('SO Customer API result:', result);

		return result.data || [];
	} catch (error) {
		console.error('Error fetching SO Customer data:', error);
		return [];
	}
}

/**
 * Get SO Customer data with additional filtering or sorting
 * @param {Object} options - Filtering and sorting options
 * @returns {Promise<Array>} Filtered SO Customer data
 */
export async function getSOCustomerData(options = {}) {
	try {
		const data = await fetchSOCustomer();

		// Apply any filtering logic here if needed
		let filteredData = data;

		// Sort by tanggal_so (newest first) if no specific sorting is provided
		if (!options.sortBy) {
			filteredData = data.sort((a, b) => new Date(b.tanggal_so) - new Date(a.tanggal_so));
		}

		// Limit results if specified
		if (options.limit) {
			filteredData = filteredData.slice(0, options.limit);
		}

		return filteredData;
	} catch (error) {
		console.error('Error processing SO Customer data:', error);
		return [];
	}
}

/**
 * Get pending SO Customer (those with delivery date in the future or today)
 * @returns {Promise<Array>} Pending SO Customer data
 */
export async function getPendingSOCustomer() {
	try {
		const data = await fetchSOCustomer();
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		return data.filter((so) => {
			if (!so.tanggal_kirim) return true; // Include SO without delivery date

			const deliveryDate = new Date(so.tanggal_kirim);
			deliveryDate.setHours(0, 0, 0, 0);

			return deliveryDate >= today;
		});
	} catch (error) {
		console.error('Error getting pending SO Customer:', error);
		return [];
	}
}

/**
 * Get recent SO Customer (last 30 days)
 * @returns {Promise<Array>} Recent SO Customer data
 */
export async function getRecentSOCustomer() {
	try {
		const data = await fetchSOCustomer();
		console.log('Raw SO Customer data received:', data.length, 'items');

		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		return data
			.filter((so) => {
				const soDate = new Date(so.tanggal_so);
				return soDate >= thirtyDaysAgo;
			})
			.sort((a, b) => new Date(b.tanggal_so) - new Date(a.tanggal_so));
	} catch (error) {
		console.error('Error getting recent SO Customer:', error);
		return [];
	}
}

/**
 * Get all SO Customer data (for testing purposes)
 * @returns {Promise<Array>} All SO Customer data
 */
export async function getAllSOCustomer() {
	try {
		console.log('Getting all SO Customer data...');
		const data = await fetchSOCustomer();
		console.log('All SO Customer data received:', data.length, 'items');

		// Sort by tanggal_so (newest first)
		const sorted = data.sort((a, b) => new Date(b.tanggal_so) - new Date(a.tanggal_so));
		console.log('Sorted SO Customer data:', sorted.length, 'items');

		return sorted;
	} catch (error) {
		console.error('Error getting all SO Customer:', error);
		return [];
	}
}

/**
 * Get specific SO Customer by ID with full details
 * @param {string} soId - The SO Customer ID
 * @returns {Promise<Object|null>} SO Customer data with details
 */
export async function getSOCustomerById(soId) {
	try {
		console.log('Getting SO Customer by ID:', soId);

		const response = await fetch(`${BASE_URL}/items/so_customer/${soId}?fields=*,details.*`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result = await response.json();
		console.log('SO Customer details:', result);

		return result.data || null;
	} catch (error) {
		console.error('Error getting SO Customer by ID:', error);
		return null;
	}
}

/**
 * Mark SO Customer as accepted (store in localStorage as backup)
 * @param {string} soId - The SO Customer ID
 * @returns {Promise<boolean>} Success status
 */
export async function acceptSOCustomer(soId) {
	try {
		console.log('Accepting SO Customer with ID:', soId);

		// First, try to update in database
		try {
			const response = await fetch(`${BASE_URL}/items/so_customer/${soId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				},
				body: JSON.stringify({
					notification_accepted: true,
					accepted_at: new Date().toISOString()
				})
			});

			if (response.ok) {
				const result = await response.json();
				console.log('SO Customer accepted successfully in database:', result);
			} else {
				console.warn('Database update failed, using localStorage fallback');
			}
		} catch (dbError) {
			console.warn('Database update error, using localStorage fallback:', dbError);
		}

		// Always store in localStorage as backup
		const acceptedSOs = JSON.parse(localStorage.getItem('acceptedSOCustomers') || '[]');
		if (!acceptedSOs.includes(soId)) {
			acceptedSOs.push(soId);
			localStorage.setItem('acceptedSOCustomers', JSON.stringify(acceptedSOs));
			console.log('SO Customer ID stored in localStorage:', soId);
		}

		return true;
	} catch (error) {
		console.error('Error accepting SO Customer:', error);
		return false;
	}
}

/**
 * Get SO Customer data that haven't been accepted yet (for notifications)
 * Uses localStorage to filter out accepted items as fallback
 * @returns {Promise<Array>} Unaccepted SO Customer data
 */
export async function getUnacceptedSOCustomer() {
	try {
		console.log('Getting unaccepted SO Customer data...');
		
		// First try to get from database with filter
		try {
			const response = await fetch(`${BASE_URL}/items/so_customer?fields=*,details.*&filter[notification_accepted][_neq]=true`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				}
			});

			if (response.ok) {
				const result = await response.json();
				console.log('Successfully got unaccepted SO from database:', result);
				
				const data = result.data || [];
				const sorted = data.sort((a, b) => new Date(b.tanggal_so) - new Date(a.tanggal_so));
				console.log('Sorted unaccepted SO Customer data from database:', sorted.length, 'items');
				return sorted;
			}
		} catch (dbError) {
			console.warn('Database filter failed, using localStorage fallback:', dbError);
		}

		// Fallback: Get all data and filter using localStorage
		console.log('Using localStorage fallback for filtering accepted SO...');
		const allData = await getAllSOCustomer();
		
		// Get accepted SO IDs from localStorage
		const acceptedSOs = JSON.parse(localStorage.getItem('acceptedSOCustomers') || '[]');
		console.log('Accepted SO IDs from localStorage:', acceptedSOs);
		
		// Filter out accepted SOs
		const unacceptedData = allData.filter(so => {
			const isAccepted = acceptedSOs.includes(so.id.toString()) || acceptedSOs.includes(so.id);
			return !isAccepted;
		});
		
		console.log('Filtered unaccepted SO Customer data:', unacceptedData.length, 'items');
		return unacceptedData;
		
	} catch (error) {
		console.error('Error getting unaccepted SO Customer:', error);
		// Final fallback to getAllSOCustomer
		return await getAllSOCustomer();
	}
}

/**
 * Clear accepted SO Customer list from localStorage
 * @returns {void}
 */
export function clearAcceptedSOCustomers() {
	try {
		localStorage.removeItem('acceptedSOCustomers');
		console.log('Cleared accepted SO Customer list from localStorage');
	} catch (error) {
		console.error('Error clearing accepted SO Customer list:', error);
	}
}

/**
 * Get list of accepted SO Customer IDs from localStorage
 * @returns {Array} Array of accepted SO Customer IDs
 */
export function getAcceptedSOCustomerIds() {
	try {
		return JSON.parse(localStorage.getItem('acceptedSOCustomers') || '[]');
	} catch (error) {
		console.error('Error getting accepted SO Customer IDs:', error);
		return [];
	}
}
