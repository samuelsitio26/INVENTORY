// Pengeluaran Inventory Service for Directus integration

const DIRECTUS_URL = 'https://directus.eltamaprimaindo.com';
const DIRECTUS_TOKEN = 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz';

/**
 * Get all pengeluaran inventory based on surat jalan data
 * @returns {Promise<Array>} List of inventory outflows
 */
export async function getPengeluaranInventory() {
    try {
        // Fetch surat jalan data
        const response = await fetch(`${DIRECTUS_URL}/items/suratjalan?fields=*`, {
            headers: {
                'Authorization': DIRECTUS_TOKEN
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch surat jalan data');
        }

        const data = await response.json();
        
        // Transform surat jalan data to pengeluaran format
        const pengeluaranData = data.data?.map(sj => {
            // Determine item type based on available data
            let tipeBarang = 'FINISHED GOOD';
            let namaBarang = sj.nama_finishgood || sj.nama_rawmaterial || '-';
            let kodeBarang = sj.kode_customer || sj.nomor_sj || '-';
            
            if (sj.nama_rawmaterial) {
                tipeBarang = 'RAW MATERIAL';
            }
            
            // Determine destination
            let tujuan = '-';
            if (sj.kode_customer) {
                tujuan = `Customer: ${sj.kode_customer}`;
            } else if (sj.nama_rawmaterial) {
                tujuan = 'Produksi';
            }

            return {
                id: sj.id,
                kodeBarang: kodeBarang,
                namaBarang: namaBarang,
                tipeBarang: tipeBarang,
                jumlahKeluar: sj.quantity || 0,
                satuan: sj.satuan || 'pcs',
                tanggalKeluar: sj.tgl_sj || sj.date_created,
                tujuan: tujuan,
                pic: sj.kode_sales || sj.nama_sopir || '-',
                keterangan: `SJ: ${sj.nomor_sj}${sj.no_po ? ` | PO: ${sj.no_po}` : ''}`,
                status: 'APPROVED', // Surat jalan yang sudah dibuat dianggap approved
                nomorSJ: sj.nomor_sj,
                nomorPO: sj.no_po,
                warna: sj.warna,
                kemasan: sj.kemasan,
                harga: sj.harga,
                totalHarga: sj.total_harga
            };
        }) || [];

        return pengeluaranData;
    } catch (error) {
        console.error('Error fetching pengeluaran inventory:', error);
        throw error;
    }
}

/**
 * Get pengeluaran summary statistics
 * @returns {Promise<Object>} Summary statistics
 */
export async function getPengeluaranSummary() {
    try {
        const data = await getPengeluaranInventory();
        
        const today = new Date();
        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const thisYear = new Date(today.getFullYear(), 0, 1);

        const summary = {
            total: data.length,
            thisMonth: data.filter(item => new Date(item.tanggalKeluar) >= thisMonth).length,
            thisYear: data.filter(item => new Date(item.tanggalKeluar) >= thisYear).length,
            byType: {
                finishedGood: data.filter(item => item.tipeBarang === 'FINISHED GOOD').length,
                rawMaterial: data.filter(item => item.tipeBarang === 'RAW MATERIAL').length,
                consumable: data.filter(item => item.tipeBarang === 'CONSUMABLE').length
            },
            totalValue: data.reduce((sum, item) => sum + (item.totalHarga || 0), 0)
        };

        return summary;
    } catch (error) {
        console.error('Error getting pengeluaran summary:', error);
        return {
            total: 0,
            thisMonth: 0,
            thisYear: 0,
            byType: { finishedGood: 0, rawMaterial: 0, consumable: 0 },
            totalValue: 0
        };
    }
}

/**
 * Create manual pengeluaran entry (not from surat jalan)
 * @param {Object} pengeluaranData - The pengeluaran data to create
 * @returns {Promise<Object>} The created pengeluaran response
 */
export async function createPengeluaranManual(pengeluaranData) {
    try {
        const response = await fetch(`${DIRECTUS_URL}/items/pengeluaran_inventory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': DIRECTUS_TOKEN
            },
            body: JSON.stringify({
                ...pengeluaranData,
                status: 'published',
                date_created: new Date().toISOString()
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.message || 'Failed to create pengeluaran');
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating pengeluaran:', error);
        throw error;
    }
}

/**
 * Get pengeluaran data with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Filtered pengeluaran data
 */
export async function getPengeluaranWithFilters(filters = {}) {
    try {
        const data = await getPengeluaranInventory();
        
        let filteredData = data;

        // Filter by date range
        if (filters.startDate) {
            filteredData = filteredData.filter(item => 
                new Date(item.tanggalKeluar) >= new Date(filters.startDate)
            );
        }
        
        if (filters.endDate) {
            filteredData = filteredData.filter(item => 
                new Date(item.tanggalKeluar) <= new Date(filters.endDate)
            );
        }

        // Filter by type
        if (filters.type) {
            filteredData = filteredData.filter(item => 
                item.tipeBarang === filters.type
            );
        }

        // Filter by status
        if (filters.status) {
            filteredData = filteredData.filter(item => 
                item.status === filters.status
            );
        }

        // Filter by search term
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filteredData = filteredData.filter(item =>
                item.namaBarang?.toLowerCase().includes(searchTerm) ||
                item.kodeBarang?.toLowerCase().includes(searchTerm) ||
                item.tujuan?.toLowerCase().includes(searchTerm) ||
                item.pic?.toLowerCase().includes(searchTerm) ||
                item.nomorSJ?.toLowerCase().includes(searchTerm)
            );
        }

        return filteredData;
    } catch (error) {
        console.error('Error filtering pengeluaran:', error);
        return [];
    }
}

/**
 * Update stock after pengeluaran
 * @param {string} itemId - The item ID to update stock
 * @param {number} quantity - Quantity to subtract from stock
 * @returns {Promise<boolean>} Success status
 */
export async function updateStockAfterPengeluaran(itemId, quantity) {
    try {
        // Get current stock
        const response = await fetch(`${DIRECTUS_URL}/items/Barang/${itemId}`, {
            headers: {
                'Authorization': DIRECTUS_TOKEN
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch current stock');
        }

        const itemData = await response.json();
        const currentStock = itemData.data.StokIn || 0;
        const newStock = Math.max(0, currentStock - quantity);

        // Update stock
        const updateResponse = await fetch(`${DIRECTUS_URL}/items/Barang/${itemId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': DIRECTUS_TOKEN
            },
            body: JSON.stringify({
                StokIn: newStock,
                last_updated: new Date().toISOString()
            })
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update stock');
        }

        return true;
    } catch (error) {
        console.error('Error updating stock:', error);
        return false;
    }
}
