/**
 * Service untuk mengelola notifikasi sistem
 */
import api from './api.js';

const DIRECTUS_URL = 'https://directus.eltamaprimaindo.com';

/**
 * Mengambil notifikasi SPK yang menunggu approval
 */
export async function getSPKNotifications() {
	try {
		console.log('Fetching SPK notifications from SPK collection...');

		// Ambil SPK dengan status pending_approval sebagai notifikasi
		const response = await api.get('/items/spk', {
			params: {
				'filter[status][_eq]': 'pending_approval',
				sort: '-date_created'
			}
		});

		console.log(
			'SPK notifications fetched successfully:',
			response.data?.data?.length || 0,
			'items'
		);

		// Transform SPK data to notification format
		const notifications = (response.data?.data || []).map((spk) => ({
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
		// Since we're using SPK ID as notification ID with prefix, extract the actual SPK ID
		const spkId = notificationId.replace('spk_', '');

		const response = await api.patch(`/items/spk/${spkId}`, updateData);
		return response.data;
	} catch (error) {
		console.error('Error updating SPK notification:', error);
		if (error.response) {
			console.error('Error response:', error.response.data);
			throw new Error(
				`HTTP error! status: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`
			);
		}
		throw error;
	}
}

/**
 * Menghapus notifikasi SPK
 */
export async function deleteSPKNotification(notificationId) {
	try {
		// Since we're using SPK ID as notification ID with prefix, extract the actual SPK ID
		const spkId = notificationId.replace('spk_', '');

		const response = await api.delete(`/items/spk/${spkId}`);
		return true;
	} catch (error) {
		console.error('Error deleting SPK notification:', error);
		if (error.response) {
			console.error('Error response:', error.response.data);
			throw new Error(
				`HTTP error! status: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`
			);
		}
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
export async function approveSPKNotification(notificationId, spkId) {
	try {
		console.log('Approving SPK:', spkId, 'Notification:', notificationId);

		// Update SPK status ke approved dengan tambahan fields
		const response = await api.patch(`/items/spk/${spkId}`, {
			status: 'approved',
			approved_at: new Date().toISOString(),
			approved_by: 'Admin'
		});

		console.log('SPK approved successfully:', response.data);
		return true;
	} catch (error) {
		console.error('Error approving SPK:', error);
		if (error.response) {
			console.error('Error response:', error.response.data);
			throw new Error(
				`HTTP error! status: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`
			);
		}
		throw error;
	}
}

/**
 * Reject SPK notification
 */
export async function rejectSPKNotification(notificationId, spkId, reason = '') {
	try {
		console.log('Rejecting SPK:', spkId, 'Notification:', notificationId, 'Reason:', reason);

		// Update SPK status ke rejected dengan tambahan fields
		const response = await api.patch(`/items/spk/${spkId}`, {
			status: 'rejected',
			rejected_at: new Date().toISOString(),
			rejected_by: 'Admin',
			rejection_reason: reason
		});

		console.log('SPK rejected successfully:', response.data);
		return true;
	} catch (error) {
		console.error('Error rejecting SPK:', error);
		if (error.response) {
			console.error('Error response:', error.response.data);
			throw new Error(
				`HTTP error! status: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`
			);
		}
		throw error;
	}
}

/**
 * Mengambil detail SPK berdasarkan ID
 */
export async function getSPKDetails(spkId) {
	try {
		const response = await api.get(`/items/spk/${spkId}`);
		return response.data?.data;
	} catch (error) {
		console.error('Error fetching SPK details:', error);
		if (error.response) {
			console.error('Error response:', error.response.data);
			throw new Error(
				`HTTP error! status: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`
			);
		}
		throw error;
	}
}
