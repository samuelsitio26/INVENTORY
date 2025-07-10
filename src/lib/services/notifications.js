/**
 * Service untuk mengelola notifikasi sistem
 */

const DIRECTUS_URL = 'https://directus.eltamaprimaindo.com';
const TOKEN = 'JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz';

/**
 * Mengambil notifikasi SPK yang menunggu approval
 */
export async function getSPKNotifications() {
	try {
		console.log('Fetching SPK notifications from SPK collection...');
		
		// Ambil SPK dengan status pending_approval sebagai notifikasi
		const response = await fetch(
			`${DIRECTUS_URL}/items/spk?filter[status][_eq]=pending_approval&sort=-date_created`,
			{
				headers: {
					Authorization: `Bearer ${TOKEN}`,
					'Content-Type': 'application/json'
				}
			}
		);

		console.log('SPK notifications response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.log('SPK notifications error response:', errorText);
			throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
		}

		const result = await response.json();
		console.log('SPK notifications fetched successfully:', result.data?.length || 0, 'items');
		
		// Transform SPK data to notification format
		const notifications = (result.data || []).map(spk => ({
			id: `spk_${spk.id}`,
			type: 'spk_approval',
			title: 'SPK Menunggu Persetujuan',
			message: `SPK ${spk.nomor} (${spk.nama_formula || 'Formula'}) menunggu persetujuan`,
			spk_id: spk.id,
			spk_nomor: spk.nomor,
			nama_formula: spk.nama_formula,
			finished_good: spk.finished_good,
			jumlah_produksi: spk.jumlah_produksi,
			unit: spk.unit,
			kode_customer: spk.kode_customer,
			status: 'pending',
			created_at: spk.date_created,
			priority: 'normal'
		}));

		return notifications;
	} catch (error) {
		console.error('Error fetching SPK notifications:', error);
		return [];
	}
}

/**
 * Membuat notifikasi SPK baru (dalam hal ini hanya log notifikasi)
 */
export async function createSPKNotification(notificationData) {
	try {
		console.log('Creating SPK notification (logging):', notificationData);
		
		// Karena collection spk_notifications belum ada, kita hanya log notifikasi
		// Status SPK sudah diupdate ke pending_approval di submitSPK function
		console.log('SPK notification logged successfully:', {
			type: notificationData.type,
			spk_nomor: notificationData.spk_nomor,
			message: notificationData.message,
			timestamp: new Date().toISOString()
		});

		return { success: true, message: 'Notification logged' };
	} catch (error) {
		console.error('Error creating SPK notification:', error);
		throw error;
	}
}

/**
 * Mengupdate status notifikasi SPK
 */
export async function updateSPKNotification(notificationId, updateData) {
	try {
		const response = await fetch(`${DIRECTUS_URL}/items/spk_notifications/${notificationId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${TOKEN}`
			},
			body: JSON.stringify(updateData)
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result = await response.json();
		return result.data;
	} catch (error) {
		console.error('Error updating SPK notification:', error);
		throw error;
	}
}

/**
 * Menghapus notifikasi SPK
 */
export async function deleteSPKNotification(notificationId) {
	try {
		const response = await fetch(`${DIRECTUS_URL}/items/spk_notifications/${notificationId}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${TOKEN}`
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return true;
	} catch (error) {
		console.error('Error deleting SPK notification:', error);
		throw error;
	}
}

/**
 * Menandai notifikasi sebagai sudah dibaca
 */
export async function markSPKNotificationAsRead(notificationId) {
	return updateSPKNotification(notificationId, {
		status: 'read',
		read_at: new Date().toISOString()
	});
}

/**
 * Approve SPK notification
 */
export async function approveSPKNotification(spkId) {
	try {
		console.log('Approving SPK:', spkId);
		
		// Update SPK status ke approved
		const spkResponse = await fetch(`${DIRECTUS_URL}/items/spk/${spkId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${TOKEN}`
			},
			body: JSON.stringify({
				status: 'approved'
			})
		});

		if (!spkResponse.ok) {
			throw new Error(`HTTP error! status: ${spkResponse.status}`);
		}

		console.log('SPK approved successfully');
		return true;
	} catch (error) {
		console.error('Error approving SPK:', error);
		throw error;
	}
}

/**
 * Reject SPK notification
 */
export async function rejectSPKNotification(spkId, reason = '') {
	try {
		console.log('Rejecting SPK:', spkId, 'Reason:', reason);
		
		// Update SPK status ke rejected
		const spkResponse = await fetch(`${DIRECTUS_URL}/items/spk/${spkId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${TOKEN}`
			},
			body: JSON.stringify({
				status: 'rejected'
			})
		});

		if (!spkResponse.ok) {
			throw new Error(`HTTP error! status: ${spkResponse.status}`);
		}

		console.log('SPK rejected successfully');
		return true;
	} catch (error) {
		console.error('Error rejecting SPK:', error);
		throw error;
	}
}

/**
 * Mengambil detail SPK berdasarkan ID
 */
export async function getSPKDetails(spkId) {
	try {
		const response = await fetch(`${DIRECTUS_URL}/items/spk/${spkId}`, {
			headers: {
				Authorization: `Bearer ${TOKEN}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result = await response.json();
		return result.data;
	} catch (error) {
		console.error('Error fetching SPK details:', error);
		throw error;
	}
}
