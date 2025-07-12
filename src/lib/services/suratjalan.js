// Surat Jalan Service for Directus integration

const DIRECTUS_URL = 'https://directus.eltamaprimaindo.com';
const DIRECTUS_TOKEN = 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz';

/**
 * Create a new Surat Jalan in Directus
 * @param {Object} suratJalanData - The surat jalan data to create
 * @returns {Promise<Object>} The created surat jalan response
 */
export async function createSuratJalan(suratJalanData) {
    try {
        const response = await fetch(`${DIRECTUS_URL}/items/suratjalan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': DIRECTUS_TOKEN
            },
            body: JSON.stringify({
                ...suratJalanData,
                status: 'published'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.message || 'Failed to create surat jalan');
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating surat jalan:', error);
        throw error;
    }
}

/**
 * Get all Surat Jalan from Directus
 * @returns {Promise<Array>} List of surat jalan
 */
export async function getSuratJalan() {
    try {
        const response = await fetch(`${DIRECTUS_URL}/items/suratjalan`, {
            headers: {
                'Authorization': DIRECTUS_TOKEN
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch surat jalan');
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('Error fetching surat jalan:', error);
        throw error;
    }
}

/**
 * Get a specific Surat Jalan by ID
 * @param {string} id - The surat jalan ID
 * @returns {Promise<Object>} The surat jalan data
 */
export async function getSuratJalanById(id) {
    try {
        const response = await fetch(`${DIRECTUS_URL}/items/suratjalan/${id}`, {
            headers: {
                'Authorization': DIRECTUS_TOKEN
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch surat jalan');
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Error fetching surat jalan:', error);
        throw error;
    }
}

/**
 * Update a Surat Jalan
 * @param {string} id - The surat jalan ID
 * @param {Object} updateData - The data to update
 * @returns {Promise<Object>} The updated surat jalan
 */
export async function updateSuratJalan(id, updateData) {
    try {
        const response = await fetch(`${DIRECTUS_URL}/items/suratjalan/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': DIRECTUS_TOKEN
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.message || 'Failed to update surat jalan');
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating surat jalan:', error);
        throw error;
    }
}

/**
 * Delete a Surat Jalan
 * @param {string} id - The surat jalan ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteSuratJalan(id) {
    try {
        const response = await fetch(`${DIRECTUS_URL}/items/suratjalan/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': DIRECTUS_TOKEN
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete surat jalan');
        }

        return true;
    } catch (error) {
        console.error('Error deleting surat jalan:', error);
        throw error;
    }
}

/**
 * Generate nomor surat jalan automatically
 * @returns {Promise<string>} Generated nomor surat jalan
 */
export async function generateNomorSJ() {
    try {
        // Get the latest SJ to generate next number
        const response = await fetch(`${DIRECTUS_URL}/items/suratjalan?sort=-date_created&limit=1`, {
            headers: {
                'Authorization': DIRECTUS_TOKEN
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch latest surat jalan');
        }

        const data = await response.json();
        const latestSJ = data.data[0];
        
        // Generate new number based on current date and sequence
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const datePrefix = `SJ/${year}${month}`;
        
        let sequence = 1;
        if (latestSJ && latestSJ.nomor_sj && latestSJ.nomor_sj.startsWith(datePrefix)) {
            const lastSequence = parseInt(latestSJ.nomor_sj.split('/').pop()) || 0;
            sequence = lastSequence + 1;
        }
        
        return `${datePrefix}/${String(sequence).padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating nomor SJ:', error);
        // Fallback to timestamp-based generation
        const timestamp = Date.now();
        return `SJ/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/${timestamp}`;
    }
}
