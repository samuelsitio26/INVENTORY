// src/lib/services/socustomer.js

const BASE_URL = 'https://directus.eltamaprimaindo.com';

/**
 * Fetch SO Customer data from Directus API
 * @returns {Promise<Array>} Array of SO Customer data
 */
export async function fetchSOCustomer() {
	try {
		const response = await fetch(`${BASE_URL}/items/so_customer`);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result = await response.json();
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
