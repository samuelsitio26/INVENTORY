// src/lib/services/customer.js

const BASE_URL = 'https://directus.eltamaprimaindo.com';

/**
 * Fetch master customer data from Directus API
 * @returns {Promise<Array>} Array of customer data
 */
export async function fetchMasterCustomer() {
	try {
		console.log('Fetching Master Customer data from:', `${BASE_URL}/items/master_customer`);

		const response = await fetch(`${BASE_URL}/items/master_customer`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		console.log('Master Customer API response status:', response.status);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result = await response.json();
		console.log('Master Customer API result:', result);

		return result.data || [];
	} catch (error) {
		console.error('Error fetching Master Customer data:', error);
		return [];
	}
}

/**
 * Get customer data formatted for dropdown
 * @returns {Promise<Array>} Array of customer options for dropdown
 */
export async function getCustomerOptions() {
	try {
		const customers = await fetchMasterCustomer();
		
		// Format data untuk dropdown: kode_customer dan nama_sj_fp
		return customers.map(customer => ({
			kode: customer.kode_customer,
			nama: customer.nama_sj_fp,
			...customer // Include all customer data for reference
		})).filter(customer => customer.kode && customer.nama); // Filter out incomplete data
	} catch (error) {
		console.error('Error getting customer options:', error);
		return [];
	}
}

/**
 * Get customer by kode_customer
 * @param {string} kode_customer - Customer code to search for
 * @returns {Promise<Object|null>} Customer data or null if not found
 */
export async function getCustomerByKode(kode_customer) {
	try {
		const customers = await fetchMasterCustomer();
		return customers.find(customer => customer.kode_customer === kode_customer) || null;
	} catch (error) {
		console.error('Error getting customer by kode:', error);
		return null;
	}
}
