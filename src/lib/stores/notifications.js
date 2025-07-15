import { writable } from 'svelte/store';

// Store for production request notifications
export const productionRequests = writable([]);

// Function to add a new production request notification
export function addProductionRequest(items) {
    const requestId = Date.now();
    const timestamp = new Date().toLocaleString('id-ID');
    
    const newRequest = {
        id: requestId,
        message: `Permintaan produksi untuk ${items.length} item telah dikirim ke tim produksi`,
        timestamp: timestamp,
        itemCount: items.length,
        items: items.map(item => ({
            nama_barang: item.nama_barang,
            kode_barang: item.kode_barang,
            status: item.status,
            sisa_stok: item.sisa_stok
        }))
    };
    
    productionRequests.update(requests => {
        // Add new request at the beginning
        const updatedRequests = [newRequest, ...requests];
        // Keep only last 10 requests to prevent memory issues
        return updatedRequests.slice(0, 10);
    });
    
    return requestId;
}

// Function to clear production request notifications
export function clearProductionRequests() {
    productionRequests.set([]);
}

// Function to remove a specific production request
export function removeProductionRequest(id) {
    productionRequests.update(requests => 
        requests.filter(request => request.id !== id)
    );
}
