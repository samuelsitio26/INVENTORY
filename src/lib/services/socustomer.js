// src/lib/services/socustomer.js
import api from './api.js';

/**
 * Fetch SO Customer data from Directus API with details
 * @returns {Promise<Array>} Array of SO Customer data with product details
 */
export async function fetchSOCustomer() {
	try {
		console.log('Fetching SO Customer data...');

		// Fetch SO Customer with details if the relation exists
		const response = await api.get('/items/so_customer', {
			params: {
				fields: '*,details.*'
			}
		});

		console.log('SO Customer API response:', response.data);

		return response.data?.data || [];
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

		const response = await api.get(`/items/so_customer/${soId}`, {
			params: {
				fields: '*,details.*'
			}
		});

		console.log('SO Customer details:', response.data);
		return response.data?.data || null;
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
			const response = await api.patch(`/items/so_customer/${soId}`, {
				notification_accepted: true,
				accepted_at: new Date().toISOString()
			});

			console.log('SO Customer accepted successfully in database:', response.data);
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

		// Get all data since the filter might be causing permission issues
		console.log('Fetching all SO Customer data and filtering client-side...');
		const allData = await getAllSOCustomer();

		// Get accepted SO IDs from localStorage
		const acceptedSOs = JSON.parse(localStorage.getItem('acceptedSOCustomers') || '[]');
		console.log('Accepted SO IDs from localStorage:', acceptedSOs);

		// Filter out accepted SOs
		const unacceptedData = allData.filter((so) => {
			const isAccepted = acceptedSOs.includes(so.id.toString()) || acceptedSOs.includes(so.id);
			return !isAccepted && !so.notification_accepted; // Also check database field if available
		});

		// Sort by tanggal_so (newest first)
		const sorted = unacceptedData.sort((a, b) => new Date(b.tanggal_so) - new Date(a.tanggal_so));
		console.log('Filtered unaccepted SO Customer data:', sorted.length, 'items');
		return sorted;
	} catch (error) {
		console.error('Error getting unaccepted SO Customer:', error);

		// Final fallback to getAllSOCustomer
		try {
			console.log('Using fallback: returning all SO Customer data');
			return await getAllSOCustomer();
		} catch (fallbackError) {
			console.error('Fallback also failed:', fallbackError);
			return [];
		}
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
