<script>
    import { onMount } from 'svelte';
    import StockTable from '$lib/components/inventory/StockTable.svelte';
    import StockStats from '$lib/components/inventory/StockStats.svelte';
    import ConfirmDialog from '$lib/components/inventory/confirm/ConfirmDialog.svelte';
    import AddToStockDialog from '$lib/components/inventory/confirm/AddToStockDialog.svelte';
    import QuickAddToStockDialog from '$lib/components/inventory/confirm/QuickAddToStockDialog.svelte';
    import EditStockDialog from '$lib/components/inventory/confirm/EditStockDialog.svelte';
    import { stockStore, stockStats } from '$lib/stores/inventory.js';
    import { searchTerm } from '$lib/stores/search.js';

    let loading = false;
    let stockOperationLoading = false;
    let error = null;
    let toast = { show: false, message: '', type: 'success' };
    let confirmDialog = { show: false, message: '', id: null, name: '', type: 'received' };
    let addToStockDialog = { show: false, selectedItem: null };
    let quickAddToStockDialog = { show: false, selectedItem: null };
    let editStockDialog = { show: false, selectedItem: null };

    // State untuk data
    let stockedItems = [];
    let identitasBarangList = [];
    let parentCategories = [];
    let subCategories = [];
    
    // Data untuk Barang Diterima
    let barangDiterimaItems = [];

    // Paginasi untuk items
    let currentPage = 1;
    const itemsPerPage = 30;
    let totalItems = 0;
    let paginatedItems = [];

    // Barang yang sudah masuk stok tidak ditampilkan lagi
    let addedToStockIds = [];

    let showRentalDropdown = false;

    // State paginasi untuk Barang di Stok
    let currentStockPage = 1;
    const stockItemsPerPage = 20;
    let paginatedStockedItems = [];

    // Debug function to check API structure  
    async function debugAPIStructure() {
        try {
            // Check what fields are available in Barang collection
            const response = await fetch('https://directus.eltamaprimaindo.com/items/Barang?limit=1', {
                headers: {
                    Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Sample Barang item structure:', data.data[0]);
            }

            // Check categories structure  
            const parentCatResponse = await fetch('https://directus.eltamaprimaindo.com/items/parent_category?limit=3', {
                headers: {
                    Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
                }
            });
            
            if (parentCatResponse.ok) {
                const parentData = await parentCatResponse.json();
                console.log('Sample parent category structure:', parentData.data);
            }

            const subCatResponse = await fetch('https://directus.eltamaprimaindo.com/items/sub_category?limit=3', {
                headers: {
                    Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
                }
            });
            
            if (subCatResponse.ok) {
                const subData = await subCatResponse.json();
                console.log('Sample sub category structure:', subData.data);
            }
        } catch (error) {
            console.error('Debug API error:', error);
        }
    }

    // Function to format tanggal
    function formatDate(dateString) {
        if (!dateString) return 'Tidak ada tanggal';
        
        const date = new Date(dateString);
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('id-ID', options);
    }

    // Fungsi untuk menghitung status berdasarkan stok dan threshold
    function calculateStatus(
        stock,
        useCustomThresholds = false,
        readyThreshold = 5,
        lowStockThreshold = 1
    ) {
        if (stock === 0) return 'Out of Stock';
        if (useCustomThresholds) {
            if (stock >= readyThreshold) return 'Ready';
            if (stock >= lowStockThreshold) return 'Low Stock';
            return 'Out of Stock';
        } else {
            // Default thresholds: Ready >= 5, Low Stock 1-4, Out of Stock = 0
            if (stock >= 5) return 'Ready';
            if (stock >= 1) return 'Low Stock';
            return 'Out of Stock';
        }
    }

    // Fungsi untuk auto-match identitas barang berdasarkan nama (sama seperti di QuickAddToStockDialog)
    function autoMatchIdentitasBarang(itemName) {
        if (!itemName || !identitasBarangList.length) {
            return null;
        }

        // Cari exact match dulu
        let found = identitasBarangList.find(
            (b) => b.nama_barang_lengkap.toLowerCase() === itemName.toLowerCase()
        );

        // Jika tidak ada exact match, cari yang mengandung kata kunci
        if (!found) {
            found = identitasBarangList.find(
                (b) =>
                    b.nama_barang_lengkap.toLowerCase().includes(itemName.toLowerCase()) ||
                    itemName.toLowerCase().includes(b.nama_barang_lengkap.toLowerCase())
            );
        }

        return found;
    }

    async function loadData() {
        loading = true;
        try {
            // Ambil data dari koleksi pengajuan untuk nama pengaju, status, dan tanggal
            const pengajuanResponse = await fetch(
                'https://directus.eltamaprimaindo.com/items/pengajuan?fields=*&limit=-1',
                {
                    headers: {
                        Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
                    }
                }
            );
            
            if (!pengajuanResponse.ok) {
                const errorText = await pengajuanResponse.text();
                console.error('Pengajuan API Error:', pengajuanResponse.status, errorText);
                throw new Error(`Gagal mengambil data pengajuan dari Directus: ${pengajuanResponse.status} - ${errorText}`);
            }

            // Ambil data dari koleksi items_pengajuan untuk nama barang dengan quantity
            const itemsPengajuanResponse = await fetch(
                'https://directus.eltamaprimaindo.com/items/items_pengajuan?fields=*&limit=-1',
                {
                    headers: {
                        Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
                    }
                }
            );
            
            if (!itemsPengajuanResponse.ok) {
                const errorText = await itemsPengajuanResponse.text();
                console.error('Items Pengajuan API Error:', itemsPengajuanResponse.status, errorText);
                throw new Error(`Gagal mengambil data items pengajuan dari Directus: ${itemsPengajuanResponse.status} - ${errorText}`);
            }

            // Ambil data dari koleksi Barang (barang di stok)
            const barangResponse = await fetch(
                'https://directus.eltamaprimaindo.com/items/Barang?fields=*,parent_category.id,parent_category.parent_category,sub_category.id,sub_category.nama_sub&limit=-1',
                {
                    headers: {
                        Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
                    }
                }
            );
            if (!barangResponse.ok) throw new Error('Gagal mengambil data stok dari Directus');

            // Ambil data identitas barang
            const identitasRes = await fetch(
                'https://directus.eltamaprimaindo.com/items/identitas_barang?fields=id,nama_barang_lengkap,sub_category,parent_category&limit=-1',
                {
                    headers: {
                        Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
                    }
                }
            );
            if (!identitasRes.ok) throw new Error('Gagal mengambil data identitas barang');
            const identitasData = await identitasRes.json();
            identitasBarangList = identitasData.data || [];

            // Ambil data kategori
            const parentResponse = await fetch(
                'https://directus.eltamaprimaindo.com/items/parent_category?fields=id,parent_category',
                {
                    headers: {
                        Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
                    }
                }
            );
            if (!parentResponse.ok) throw new Error('Gagal mengambil parent categories');
            const parentData = await parentResponse.json();
            parentCategories = parentData.data;

            const subResponse = await fetch('https://directus.eltamaprimaindo.com/items/sub_category', {
                headers: {
                    Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
                }
            });
            if (!subResponse.ok) throw new Error('Gagal mengambil subcategories');
            const subData = await subResponse.json();
            subCategories = subData.data;

            const pengajuanData = await pengajuanResponse.json();
            const itemsPengajuanData = await itemsPengajuanResponse.json();
            const barangData = await barangResponse.json();

            console.log('Pengajuan Data:', pengajuanData.data); // Debug API response
            console.log('Items Pengajuan Data:', itemsPengajuanData.data); // Debug API response
            
            // Log first item to see available fields
            if (pengajuanData.data && pengajuanData.data.length > 0) {
                console.log('Sample pengajuan item:', pengajuanData.data[0]);
            }
            if (itemsPengajuanData.data && itemsPengajuanData.data.length > 0) {
                console.log('Sample items_pengajuan item:', itemsPengajuanData.data[0]);
            }

            // Filter hanya pengajuan dengan status "Barang Diterima"
            const filteredPengajuan = pengajuanData.data.filter(
                pengajuan => pengajuan.status === 'Barang Diterima'
            );

            console.log('Filtered Pengajuan (Barang Diterima):', filteredPengajuan);

            // Gabungkan data pengajuan dengan items_pengajuan berdasarkan request_id
            barangDiterimaItems = itemsPengajuanData.data
                .map((item) => {
                    // Cari pengajuan yang sesuai berdasarkan request_id
                    const matchedPengajuan = filteredPengajuan.find(
                        pengajuan => pengajuan.id === item.request_id
                    );

                    // Hanya return jika ada pengajuan yang cocok dengan status "Barang Diterima"
                    if (matchedPengajuan) {
                        return {
                            id: item.id,
                            nama_barang: item.nama_barang,
                            nama_pengaju: matchedPengajuan.nama_pengaju,
                            status: matchedPengajuan.status,
                            request_id: item.request_id,
                            procurement_id: matchedPengajuan.id,
                            date_created: matchedPengajuan.date_created || matchedPengajuan.tanggal_dibuat || matchedPengajuan.created_at,
                            urgency: matchedPengajuan.urgency || matchedPengajuan.urgensi || 'Normal',
                            metode_pembayaran: matchedPengajuan.metode_pembayaran || matchedPengajuan.payment_method || 'Transfer',
                            tujuan_pengajuan: matchedPengajuan.tujuan_pengajuan || matchedPengajuan.purpose || 'Operasional',
                            quantity: item.quantity || item.qty || item.jumlah || 1,
                            unit: item.unit || item.satuan || 'Pcs'
                        };
                    }
                    return null;
                })
                .filter(item => item !== null); // Hapus item null

            console.log('Barang Diterima Items:', barangDiterimaItems); // Debug hasil gabungan

            // Simpan data ke stockStore untuk kompatibilitas dengan komponen yang ada
            stockStore.set({ 
                items: barangDiterimaItems, 
                originalItems: barangDiterimaItems, 
                loading: false 
            });
            totalItems = barangDiterimaItems.length;

            // Simpan data Barang ke stockedItems dengan penanganan yang lebih baik
            stockedItems = barangData.data.map((item) => {
                console.log('Mapping item:', item); // Debug setiap item

                // Ambil threshold settings dari API atau gunakan default
                const useCustomThresholds = item.useCustomThresholds || false;
                const readyThreshold = item.readyThreshold || 5;
                const lowStockThreshold = item.lowStockThreshold || 1;
                const stockIn = item.StokIn || 0;

                // Hitung status berdasarkan stok dan threshold
                const calculatedStatus = calculateStatus(
                    stockIn,
                    useCustomThresholds,
                    readyThreshold,
                    lowStockThreshold
                );

                return {
                    id: item.id,
                    name: item.Nama || '-',
                    description: item.Deskripsi || 'Tidak ada deskripsi',
                    stockIn: stockIn,
                    status: calculatedStatus, // Gunakan status yang dihitung
                    parent_category:
                        parentCategories.find((cat) => cat.id === item.parent_category?.id)?.parent_category ||
                        'Unknown',
                    sub_category:
                        subCategories.find((cat) => cat.id === item.sub_category?.id)?.nama_sub || 'Unknown',
                    // Tambahan: simpan ID kategori dan subkategori untuk kebutuhan edit
                    parent_category_id: item.parent_category?.id || null,
                    sub_category_id: item.sub_category?.id || null,
                    // Simpan threshold settings
                    useCustomThresholds: useCustomThresholds,
                    readyThreshold: readyThreshold,
                    lowStockThreshold: lowStockThreshold
                };
            });
            console.log('Stocked Items:', stockedItems); // Debug stockedItems

            // Hitung statistik berdasarkan status yang sudah dihitung
            const readyItems = stockedItems.filter((item) => item.status === 'Ready').length;
            const lowStockItems = stockedItems.filter((item) => item.status === 'Low Stock').length;
            const outOfStockItems = stockedItems.filter((item) => item.status === 'Out of Stock').length;

            // Update statistik
            stockStats.set({
                totalItems: stockedItems.length,
                readyItems,
                lowStockItems,
                outOfStockItems
            });

            updatePaginatedItems(barangDiterimaItems);
        } catch (err) {
            error = err.message;
            console.error('Load Data Error:', err);
        } finally {
            loading = false;
        }
    }

    function updatePaginatedItems(items) {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        paginatedItems = items.slice(start, end);
    }

    function changePage(page) {
        const itemsPerGroup = 5;
        if (page < 1 || page > Math.ceil(procurementGroups.length / itemsPerGroup)) return;
        currentPage = page;
    }

    // Function to check if item exists in stock and handle add/update
    async function handleDirectAddToStock(item) {
        if (stockOperationLoading) return; // Prevent multiple clicks
        
        stockOperationLoading = true;
        try {
            console.log('Processing item for stock:', item);
            
            // Check if categories are loaded
            if (!parentCategories.length || !subCategories.length) {
                throw new Error('Kategori belum dimuat. Silakan refresh halaman.');
            }

            // First, check if item already exists in stock by name
            const existingItemResponse = await fetch(
                `https://directus.eltamaprimaindo.com/items/Barang?filter[Nama][_eq]=${encodeURIComponent(item.nama_barang)}`,
                {
                    headers: {
                        Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
                    }
                }
            );

            if (!existingItemResponse.ok) {
                throw new Error('Gagal mengecek item yang sudah ada');
            }

            const existingData = await existingItemResponse.json();
            const existingItems = existingData.data || [];

            if (existingItems.length > 0) {
                // Item exists, update stock
                const existingItem = existingItems[0];
                const newStockIn = (existingItem.StokIn || 0) + (item.quantity || 1);

                console.log(`Updating existing item: ${existingItem.Nama} from ${existingItem.StokIn} to ${newStockIn}`);

                // Calculate new status
                const calculatedStatus = calculateStatus(
                    newStockIn,
                    existingItem.useCustomThresholds || false,
                    existingItem.readyThreshold || 5,
                    existingItem.lowStockThreshold || 1
                );

                const updatePayload = {
                    StokIn: newStockIn,
                    Status: calculatedStatus
                };

                console.log('Update payload:', updatePayload);

                const updateResponse = await fetch(
                    `https://directus.eltamaprimaindo.com/items/Barang/${existingItem.id}`,
                    {
                        method: 'PATCH',
                        headers: {
                            Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updatePayload)
                    }
                );

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    console.error('Update API Error Response:', errorText);
                    throw new Error(`Gagal mengupdate stok: ${errorText}`);
                }

                // Update local stockedItems
                stockedItems = stockedItems.map((stockItem) =>
                    stockItem.id === existingItem.id
                        ? {
                              ...stockItem,
                              stockIn: newStockIn,
                              status: calculatedStatus
                          }
                        : stockItem
                );

                toast = { 
                    show: true, 
                    message: `Stok berhasil ditambah! ${item.nama_barang} sekarang: ${newStockIn}`, 
                    type: 'success' 
                };
            } else {
                // Item doesn't exist, create new
                await createNewStockItem(item);
            }

            // Mark item as processed
            addedToStockIds = [...addedToStockIds, item.id];

            // Update stats
            updateStockStats();

            setTimeout(() => {
                toast.show = false;
            }, 3000);

        } catch (err) {
            toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
            setTimeout(() => {
                toast.show = false;
            }, 3000);
            console.error('Error handling stock:', err);
        } finally {
            stockOperationLoading = false;
        }
    }

    // Function to create new stock item
    async function createNewStockItem(item) {
        console.log('Creating new stock item:', item);
        console.log('Available parent categories:', parentCategories);
        console.log('Available sub categories:', subCategories);
        
        // Auto-match identitas barang for categories
        const matchedIdentitas = autoMatchIdentitasBarang(item.nama_barang);
        console.log('Matched identitas:', matchedIdentitas);
        
        // Use first available category if no match or invalid IDs
        let parentCatId = null;
        let subCatId = null;

        if (matchedIdentitas && matchedIdentitas.parent_category && matchedIdentitas.sub_category) {
            // Verify the IDs exist in our loaded categories
            const parentExists = parentCategories.find(cat => cat.id === matchedIdentitas.parent_category);
            const subExists = subCategories.find(cat => cat.id === matchedIdentitas.sub_category);
            
            if (parentExists && subExists) {
                parentCatId = matchedIdentitas.parent_category;
                subCatId = matchedIdentitas.sub_category;
            }
        }
        
        // Fallback to first available categories if no valid match
        if (!parentCatId || !subCatId) {
            parentCatId = parentCategories.length > 0 ? parentCategories[0].id : null;
            subCatId = subCategories.length > 0 ? subCategories[0].id : null;
        }

        console.log('Using parent category ID:', parentCatId);
        console.log('Using sub category ID:', subCatId);

        // If we still don't have valid categories, throw an error
        if (!parentCatId || !subCatId) {
            throw new Error('Tidak dapat menemukan kategori yang valid. Pastikan data kategori tersedia.');
        }

        const calculatedStatus = calculateStatus(item.quantity || 1);

        const payload = {
            Nama: item.nama_barang || '-',
            Deskripsi: `Barang dari pengajuan: ${item.nama_pengaju}`,
            StokIn: item.quantity || 1,
            Status: calculatedStatus
        };

        // Only add category fields if we have valid IDs
        if (parentCatId && subCatId) {
            payload.parent_category = parentCatId;
            payload.sub_category = subCatId;
        }

        console.log('Payload to be sent:', payload);

        const response = await fetch('https://directus.eltamaprimaindo.com/items/Barang', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`Gagal menyimpan ke stok: ${errorText}`);
        }

        const newItem = await response.json();
        console.log('New item created:', newItem);
        
        // Add to local stockedItems
        const newStockItem = {
            id: newItem.data.id,
            name: payload.Nama,
            description: payload.Deskripsi,
            stockIn: payload.StokIn,
            status: payload.Status,
            parent_category: parentCategories.find((cat) => cat.id === parentCatId)?.parent_category || 'Unknown',
            sub_category: subCategories.find((cat) => cat.id === subCatId)?.nama_sub || 'Unknown'
        };

        stockedItems = [newStockItem, ...stockedItems];

        toast = { 
            show: true, 
            message: `Barang baru berhasil ditambahkan ke stok: ${item.nama_barang}`, 
            type: 'success' 
        };
    }

    // Function to update stock statistics
    function updateStockStats() {
        const readyItems = stockedItems.filter((item) => item.status === 'Ready').length;
        const lowStockItems = stockedItems.filter((item) => item.status === 'Low Stock').length;
        const outOfStockItems = stockedItems.filter((item) => item.status === 'Out of Stock').length;

        stockStats.set({
            totalItems: stockedItems.length,
            readyItems,
            lowStockItems,
            outOfStockItems
        });
    }

    function addToStock(item) {
        addToStockDialog = { show: true, selectedItem: item };
    }

    function quickAddToStock(item) {
        quickAddToStockDialog = { show: true, selectedItem: item };
    }

    // ...existing code... (semua handler functions tetap sama)
    async function handleAddToStock({ detail }) {
        try {
            console.log('Detail received:', detail); // Debug data yang diterima
            console.log('Parent Categories:', parentCategories);
            console.log('Sub Categories:', subCategories);

            const parentCatId = detail.parent_category;
            const subCatId = detail.sub_category;

            if (!parentCatId || !subCatId) {
                throw new Error(`Kategori ID ${parentCatId} atau subkategori ID ${subCatId} tidak valid.`);
            }

            // Gunakan nama field sesuai Directus
            const payload = {
                Nama: detail.name || '-',
                Deskripsi: detail.detail || 'Tidak ada deskripsi',
                StokIn: detail.stockIn || 0,
                Status: detail.status || 'Unknown',
                parent_category: parentCatId,
                sub_category: subCatId
            };

            const response = await fetch('https://directus.eltamaprimaindo.com/items/Barang', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gagal menyimpan ke stok: ${errorText}`);
            }

            const newItem = await response.json();
            stockedItems = [
                {
                    id: newItem.data.id,
                    name: payload.Nama,
                    description: payload.Deskripsi,
                    stockIn: payload.StokIn,
                    status: payload.Status,
                    parent_category:
                        parentCategories.find((cat) => cat.id === parentCatId)?.parent_category || 'Unknown',
                    sub_category: subCategories.find((cat) => cat.id === subCatId)?.nama_sub || 'Unknown'
                },
                ...stockedItems
            ];

            addedToStockIds = [...addedToStockIds, detail.id];

            toast = { show: true, message: 'Barang berhasil dimasukkan ke stok!', type: 'success' };
            setTimeout(() => {
                toast.show = false;
            }, 2000);
        } catch (err) {
            toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
            setTimeout(() => {
                toast.show = false;
            }, 3000);
            console.error('Error details:', err);
        } finally {
            addToStockDialog = { show: false, selectedItem: null };
        }
    }

    // Handler untuk Quick Add To Stock (sama seperti handleAddToStock)
    async function handleQuickAddToStock({ detail }) {
        try {
            console.log('Quick Add Detail received:', detail);

            const parentCatId = detail.parent_category;
            const subCatId = detail.sub_category;

            // Gunakan nama field sesuai Directus
            const payload = {
                Nama: detail.name || '-',
                Deskripsi: detail.detail || 'Tidak ada deskripsi',
                StokIn: detail.stockIn || 0,
                Status: detail.status || 'Unknown',
                parent_category: parentCatId,
                sub_category: subCatId
            };

            const response = await fetch('https://directus.eltamaprimaindo.com/items/Barang', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gagal menyimpan ke stok: ${errorText}`);
            }

            const newItem = await response.json();
            stockedItems = [
                {
                    id: newItem.data.id,
                    name: payload.Nama,
                    description: payload.Deskripsi,
                    stockIn: payload.StokIn,
                    status: payload.Status,
                    parent_category:
                        parentCategories.find((cat) => cat.id === parentCatId)?.parent_category || 'Unknown',
                    sub_category: subCategories.find((cat) => cat.id === subCatId)?.nama_sub || 'Unknown'
                },
                ...stockedItems
            ];

            addedToStockIds = [...addedToStockIds, detail.id];

            toast = {
                show: true,
                message: '🚀 Barang berhasil ditambahkan ke stok dengan Quick Add!',
                type: 'success'
            };
            setTimeout(() => {
                toast.show = false;
            }, 2000);
        } catch (err) {
            toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
            setTimeout(() => {
                toast.show = false;
            }, 3000);
            console.error('Error details:', err);
        } finally {
            quickAddToStockDialog = { show: false, selectedItem: null };
        }
    }

    // Handler untuk beralih dari Quick Add ke Advanced Add
    function handleQuickToAdvanced(item) {
        quickAddToStockDialog = { show: false, selectedItem: null };
        addToStockDialog = { show: true, selectedItem: item };
    }

    async function deleteItem(id, name) {
        confirmDialog = {
            show: true,
            message: `Apakah Anda yakin ingin menghapus "${name}"?`,
            id,
            name,
            type: 'received' // Menandai bahwa ini adalah penghapusan barang diterima
        };
    }

    async function handleConfirmDelete() {
        const { id, type } = confirmDialog;

        if (type === 'stock') {
            // Hapus dari stok (database)
            await handleDeleteStockItem(id);
        } else {
            // Hapus dari barang diterima (hanya hidden dari tampilan)
            barangDiterimaItems = barangDiterimaItems.filter((item) => item.id !== id);
            stockStore.update((current) => {
                const updatedItems = current.items.filter((item) => item.id !== id);
                return {
                    ...current,
                    items: updatedItems,
                    originalItems: updatedItems
                };
            });

            totalItems = barangDiterimaItems.length;
            updatePaginatedItems(barangDiterimaItems);

            toast = {
                show: true,
                message: 'Barang berhasil disembunyikan dari tampilan!',
                type: 'success'
            };
            setTimeout(() => {
                toast.show = false;
            }, 2000);
        }

        confirmDialog.show = false;
    }

    function handleCancelDelete() {
        confirmDialog = { show: false, message: '', id: null, name: '', type: 'received' };
    }

    function editStock(item) {
        editStockDialog = {
            show: true,
            selectedItem: {
                id: item.id,
                name: item.name,
                description: item.description,
                stockIn: item.stockIn,
                status: item.status, // string, bukan object
                parent_category: item.parent_category,
                sub_category: item.sub_category,
                parent_category_id: item.parent_category_id,
                sub_category_id: item.sub_category_id,
                // Threshold settings
                useCustomThresholds: item.useCustomThresholds || false,
                readyThreshold: item.readyThreshold || 5,
                lowStockThreshold: item.lowStockThreshold || 1
            }
        };
    }

    async function handleEditStock({ detail }) {
        try {
            console.log('handleEditStock detail:', detail);

            // Hitung status berdasarkan stok dan threshold settings
            const calculatedStatus = calculateStatus(
                detail.stockIn,
                detail.useCustomThresholds,
                detail.readyThreshold,
                detail.lowStockThreshold
            );

            // Update semua field yang dapat diedit, termasuk threshold settings
            const updatePayload = {
                Nama: detail.name,
                Deskripsi: detail.description,
                StokIn: detail.stockIn,
                Status: calculatedStatus,
                // Simpan pengaturan threshold
                useCustomThresholds: detail.useCustomThresholds || false,
                readyThreshold: detail.readyThreshold || 5,
                lowStockThreshold: detail.lowStockThreshold || 1
            };

            const response = await fetch(
                `https://directus.eltamaprimaindo.com/items/Barang/${detail.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updatePayload)
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gagal menyimpan perubahan: ${errorText}`);
            }

            // Update data lokal
            stockedItems = stockedItems.map((item) =>
                item.id === detail.id
                    ? {
                            ...item,
                            name: detail.name,
                            description: detail.description,
                            stockIn: detail.stockIn,
                            status: calculatedStatus,
                            useCustomThresholds: detail.useCustomThresholds,
                            readyThreshold: detail.readyThreshold,
                            lowStockThreshold: detail.lowStockThreshold
                        }
                    : item
            );

            // Update statistik setelah edit
            const readyItems = stockedItems.filter((item) => item.status === 'Ready').length;
            const lowStockItems = stockedItems.filter((item) => item.status === 'Low Stock').length;
            const outOfStockItems = stockedItems.filter((item) => item.status === 'Out of Stock').length;

            stockStats.set({
                totalItems: stockedItems.length,
                readyItems,
                lowStockItems,
                outOfStockItems
            });

            toast = { show: true, message: 'Barang berhasil diperbarui!', type: 'success' };
            setTimeout(() => {
                toast.show = false;
            }, 2000);
        } catch (err) {
            toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
            setTimeout(() => {
                toast.show = false;
            }, 3000);
            console.error('Error details:', err);
        } finally {
            editStockDialog = { show: false, selectedItem: null };
        }
    }

    function handleCancelEdit() {
        editStockDialog = { show: false, selectedItem: null };
    }

    // Fungsi untuk menghapus item dari stok
    function deleteStockItem(id, name) {
        confirmDialog = {
            show: true,
            message: `Apakah Anda yakin ingin menghapus "${name}" dari stok? Data ini akan dihapus permanen dari database.`,
            id,
            name,
            type: 'stock' // Menandai bahwa ini adalah penghapusan stok
        };
    }

    async function handleDeleteStockItem(id) {
        try {
            // Hapus dari database Directus
            const response = await fetch(`https://directus.eltamaprimaindo.com/items/Barang/${id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gagal menghapus item: ${errorText}`);
            }

            // Hapus dari data lokal
            stockedItems = stockedItems.filter((item) => item.id !== id);

            // Update statistik setelah hapus
            const readyItems = stockedItems.filter((item) => item.status === 'Ready').length;
            const lowStockItems = stockedItems.filter((item) => item.status === 'Low Stock').length;
            const outOfStockItems = stockedItems.filter((item) => item.status === 'Out of Stock').length;

            stockStats.set({
                totalItems: stockedItems.length,
                readyItems,
                lowStockItems,
                outOfStockItems
            });

            toast = {
                show: true,
                message: 'Barang berhasil dihapus dari stok!',
                type: 'success'
            };
            setTimeout(() => {
                toast.show = false;
            }, 2000);
        } catch (err) {
            toast = {
                show: true,
                message: 'Error: ' + err.message,
                type: 'error'
            };
            setTimeout(() => {
                toast.show = false;
            }, 3000);
            console.error('Error deleting stock item:', err);
        }
    }

    // Clear search function
    function clearSearch() {
        searchTerm.set('');
    }

    onMount(() => {
        loadData();
        debugAPIStructure(); // Debug API structure
    });

    $: ({ items, loading: storeLoading } = $stockStore);
    $: isLoading = loading || storeLoading;

    // Filter untuk Barang di Stok
    $: filteredStockedItems = stockedItems.filter((item) => {
        if (!$searchTerm) return true;
        const search = $searchTerm.toLowerCase();
        return (
            item.name?.toLowerCase().includes(search) ||
            item.parent_category?.toLowerCase().includes(search) ||
            item.sub_category?.toLowerCase().includes(search) ||
            item.description?.toLowerCase().includes(search) ||
            item.status?.toLowerCase().includes(search) ||
            item.stockIn?.toString().includes(search)
        );
    });

    // Filter untuk Barang Diterima (menggunakan data baru)
    $: filteredReceivedItems = barangDiterimaItems.filter((item) => {
        if (!addedToStockIds.includes(item.id) && 
            (!$searchTerm ||
                item.nama_barang?.toLowerCase().includes($searchTerm.toLowerCase()) ||
                item.nama_pengaju?.toLowerCase().includes($searchTerm.toLowerCase()) ||
                item.status?.toLowerCase().includes($searchTerm.toLowerCase()))) {
            return true;
        }
        return false;
    });

    // Update total items berdasarkan hasil filter
    $: totalFilteredItems = filteredReceivedItems.length;

    // Group by procurement_id first, then paginate
    $: groupedByProcurement = filteredReceivedItems.reduce((groups, item) => {
        const procurementId = item.procurement_id;
        if (!groups[procurementId]) {
            groups[procurementId] = [];
        }
        groups[procurementId].push(item);
        return groups;
    }, {});

    // Convert to array of groups for pagination
    $: procurementGroups = Object.keys(groupedByProcurement).map(procurementId => {
        const items = groupedByProcurement[procurementId];
        const firstItem = items[0];
        return {
            procurement_id: procurementId,
            nama_pengaju: firstItem.nama_pengaju,
            date_created: firstItem.date_created,
            urgency: firstItem.urgency,
            metode_pembayaran: firstItem.metode_pembayaran,
            tujuan_pengajuan: firstItem.tujuan_pengajuan,
            status: firstItem.status,
            items: items
        };
    });

    // Paginated groups (not individual items)
    $: {
        const itemsPerGroup = 5; // Show 5 procurement groups per page
        const start = (currentPage - 1) * itemsPerGroup;
        const end = start + itemsPerGroup;
        paginatedItems = procurementGroups.slice(start, end);

        // Reset ke halaman 1 jika current page melebihi total pages setelah filter
        const maxPages = Math.ceil(procurementGroups.length / itemsPerGroup);
        if (currentPage > maxPages && maxPages > 0) {
            currentPage = 1;
        }
    }

    // Helper untuk paginasi dengan "..."
    function getPageNumbers() {
        const itemsPerGroup = 5;
        const totalPages = Math.ceil(procurementGroups.length / itemsPerGroup);
        const maxPagesToShow = 10;
        let pages = [];

        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 6) {
                pages = [...Array(Math.min(maxPagesToShow, totalPages)).keys()].map((i) => i + 1);
            } else if (currentPage >= totalPages - 4) {
                pages = [...Array(maxPagesToShow).keys()].map((i) => totalPages - maxPagesToShow + i + 1);
            } else {
                pages = [
                    1,
                    2,
                    '...',
                    currentPage - 2,
                    currentPage - 1,
                    currentPage,
                    currentPage + 1,
                    currentPage + 2,
                    '...',
                    totalPages
                ];
            }
        }
        return pages;
    }

    function updatePaginatedStockedItems() {
        const start = (currentStockPage - 1) * stockItemsPerPage;
        const end = start + stockItemsPerPage;
        paginatedStockedItems = filteredStockedItems.slice(start, end);
    }

    function changeStockPage(page) {
        const totalPages = Math.ceil(filteredStockedItems.length / stockItemsPerPage);
        if (page < 1 || page > totalPages) return;
        currentStockPage = page;
        updatePaginatedStockedItems();
    }

    function getStockPageNumbers() {
        const totalPages = Math.ceil(filteredStockedItems.length / stockItemsPerPage);
        const maxPagesToShow = 10;
        let pages = [];
        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentStockPage <= 6) {
                pages = [...Array(Math.min(maxPagesToShow, totalPages)).keys()].map((i) => i + 1);
            } else if (currentStockPage >= totalPages - 4) {
                pages = [...Array(maxPagesToShow).keys()].map((i) => totalPages - maxPagesToShow + i + 1);
            } else {
                pages = [
                    1,
                    2,
                    '...',
                    currentStockPage - 2,
                    currentStockPage - 1,
                    currentStockPage,
                    currentStockPage + 1,
                    currentStockPage + 2,
                    '...',
                    totalPages
                ];
            }
        }
        return pages;
    }

    // Update paginatedStockedItems setiap filteredStockedItems berubah
    $: {
        updatePaginatedStockedItems();
        const maxPages = Math.ceil(filteredStockedItems.length / stockItemsPerPage);
        if (currentStockPage > maxPages && maxPages > 0) {
            currentStockPage = 1;
            updatePaginatedStockedItems();
        }
    }
</script>

<div class="space-y-6 p-6 bg-white-100 min-h-screen">
    <!-- ...existing code... (search filter, toast, dialogs, header, stats) -->
    <!-- Search Filter - Diperbaiki dengan clear button -->
    <div class="mb-4">
        <label for="search-barang" class="block text-sm font-medium text-gray-700 mb-2"
            >Pencarian Barang</label
        >
        <div class="relative">
            <input
                id="search-barang"
                type="text"
                bind:value={$searchTerm}
                placeholder="Cari di semua tabel: nama barang, nama pengaju, status..."
                class="w-full p-3 pl-10 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <!-- Search Icon -->
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                </svg>
            </div>
            <!-- Clear Button -->
            {#if $searchTerm}
                <button
                    on:click={clearSearch}
                    class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    aria-label="Hapus pencarian"
                >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            {/if}
        </div>
        {#if $searchTerm}
            <div class="mt-2 text-sm text-gray-600">
                Hasil pencarian untuk: "<span class="font-semibold">{$searchTerm}</span>" - Barang di Stok: {filteredStockedItems.length},
                Barang Diterima: {totalFilteredItems}
            </div>
        {/if}
    </div>

    <!-- Toast Notification -->
    {#if toast.show}
        <div
            class="fixed top-4 right-4 p-4 rounded-lg shadow-lg transition-opacity duration-300 z-50"
            class:bg-green-500={toast.type === 'success'}
            class:bg-red-500={toast.type === 'error'}
            class:text-white={true}
            class:opacity-100={toast.show}
            class:opacity-0={!toast.show}
        >
            {toast.message}
        </div>
    {/if}

    <!-- Confirm Dialog -->
    <ConfirmDialog
        bind:show={confirmDialog.show}
        message={confirmDialog.message}
        onConfirm={handleConfirmDelete}
        on:cancel={handleCancelDelete}
    />

    <!-- Quick Add to Stock Dialog (Primary) -->
    <QuickAddToStockDialog
        bind:show={quickAddToStockDialog.show}
        selectedItem={quickAddToStockDialog.selectedItem}
        {identitasBarangList}
        {parentCategories}
        {subCategories}
        on:confirm={handleQuickAddToStock}
        on:cancel={() => (quickAddToStockDialog = { show: false, selectedItem: null })}
        on:advanced={(e) => handleQuickToAdvanced(e.detail)}
    />

    <!-- Add to Stock Dialog (Advanced) -->
    <AddToStockDialog
        bind:show={addToStockDialog.show}
        stockItems={barangDiterimaItems}
        selectedItem={addToStockDialog.selectedItem}
        {identitasBarangList}
        {parentCategories}
        {subCategories}
        on:confirm={handleAddToStock}
        on:cancel={() => (addToStockDialog = { show: false, selectedItem: null })}
    />

    <!-- Edit Stock Dialog -->
    <EditStockDialog
        bind:show={editStockDialog.show}
        selectedItem={editStockDialog.selectedItem}
        {parentCategories}
        {subCategories}
        on:confirm={handleEditStock}
        on:cancel={handleCancelEdit}
    />

    <!-- Header -->
    <div class="sm:flex sm:items-center sm:justify-between">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">
                Manajemen Stok Barang (Inventory - Barang Diterima)
            </h1>
            <p class="mt-1 text-sm text-gray-600">
                Kelola dan monitor barang yang sudah diterima dengan status "Barang Diterima"
            </p>
        </div>
        <div class="mt-4 sm:mt-0 flex space-x-3">
            <a
                href="/inventory/create"
                class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                ➕ Tambah Barang
            </a>
            <div class="relative group">
                <button
                    type="button"
                    class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                    📋 Rental Barang
                    <svg
                        class="ml-2 w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                        ><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg
                    >
                </button>
                <div
                    class="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity z-10"
                >
                    <a href="/inventory/peminjaman" class="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        >Pinjam Barang</a
                    >
                    <a href="/inventory/pengembalian" class="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        >Pengembalian Barang</a
                    >
                </div>
            </div>
        </div>
    </div>

    <!-- Stats -->
    <StockStats stats={$stockStats} />

    <!-- Error message -->
    {#if error}
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <p class="text-sm">{error}</p>
        </div>
    {/if}

    <!-- Loading State -->
    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
    {:else}
        <!-- Tabel Barang di Stok -->
        <div class="mt-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-gray-900">Barang di Stok</h2>
                <div class="text-sm text-gray-600">
                    {filteredStockedItems.length} dari {stockedItems.length} barang
                </div>
            </div>
            {#if filteredStockedItems.length > 0}
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full border-collapse">
                            <thead>
                                <tr class="bg-gray-50 border-b border-gray-200">
                                    <th
                                        class="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >Nama</th
                                    >
                                    <th
                                        class="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >Kategori</th
                                    >
                                    <th
                                        class="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >Sub Kategori</th
                                    >
                                    <th
                                        class="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >Deskripsi</th
                                    >
                                    <th
                                        class="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >Stok</th
                                    >
                                    <th
                                        class="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >Status</th
                                    >
                                    <th
                                        class="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >Aksi</th
                                    >
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                {#each paginatedStockedItems as item, index}
                                    <tr class="hover:bg-gray-50 transition-colors">
                                        <td class="p-4 whitespace-nowrap text-sm font-medium text-gray-900"
                                            >{item.name}</td
                                        >
                                        <td class="p-4 whitespace-nowrap text-sm text-gray-700"
                                            >{item.parent_category}</td
                                        >
                                        <td class="p-4 whitespace-nowrap text-sm text-gray-700">{item.sub_category}</td>
                                        <td class="p-4 text-sm text-gray-700 max-w-xs truncate" title={item.description}
                                            >{item.description}</td
                                        >
                                        <td class="p-4 whitespace-nowrap text-sm text-gray-900 font-semibold"
                                            >{item.stockIn}</td
                                        >
                                        <td class="p-4 whitespace-nowrap">
                                            {#if item.status === 'Ready'}
                                                <span
                                                    class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                                                    >Ready</span
                                                >
                                            {:else if item.status === 'Low Stock'}
                                                <span
                                                    class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                                                    >Low Stock</span
                                                >
                                            {:else if item.status === 'Out of Stock'}
                                                <span
                                                    class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-gray-800"
                                                    >Out of Stock</span
                                                >
                                            {:else}
                                                <span
                                                    class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                                                    >{item.status}</span
                                                >
                                            {/if}
                                        </td>
                                        <td class="p-4 whitespace-nowrap space-x-2">
                                            <button
                                                on:click={() => editStock(item)}
                                                class="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                on:click={() => deleteStockItem(item.id, item.name)}
                                                class="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                            >
                                                Hapus
                                            </button>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                </div>
                <!-- Paginasi untuk Barang di Stok -->
                {#if filteredStockedItems.length > 0}
                    <div class="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                        <div class="text-sm text-gray-600">
                            Menampilkan {Math.min(
                                (currentStockPage - 1) * stockItemsPerPage + 1,
                                filteredStockedItems.length
                            )} - {Math.min(currentStockPage * stockItemsPerPage, filteredStockedItems.length)} dari
                            {filteredStockedItems.length} barang
                            {#if $searchTerm}
                                <span class="text-blue-600">(hasil pencarian)</span>
                            {/if}
                        </div>
                        <div class="flex flex-wrap justify-center gap-1">
                            <button
                                on:click={() => changeStockPage(currentStockPage - 1)}
                                disabled={currentStockPage === 1}
                                class="px-3 py-2 text-sm font-medium rounded-md border transition-colors {currentStockPage ===
                                1
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'}"
                            >
                                ← Previous
                            </button>
                            {#each getStockPageNumbers() as pageNum, i}
                                {#if pageNum === '...'}
                                    <span class="px-3 py-2 text-sm text-gray-500">...</span>
                                {:else}
                                    <button
                                        on:click={() => changeStockPage(pageNum)}
                                        class="px-3 py-2 text-sm font-medium rounded-md border transition-colors {currentStockPage ===
                                        pageNum
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'}"
                                        disabled={currentStockPage === pageNum}
                                    >
                                        {pageNum}
                                    </button>
                                {/if}
                            {/each}
                            <button
                                on:click={() => changeStockPage(currentStockPage + 1)}
                                disabled={currentStockPage ===
                                    Math.ceil(filteredStockedItems.length / stockItemsPerPage)}
                                class="px-3 py-2 text-sm font-medium rounded-md border transition-colors {currentStockPage ===
                                Math.ceil(filteredStockedItems.length / stockItemsPerPage)
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'}"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                {/if}
            {:else}
                <div class="bg-white rounded-lg shadow p-8 text-center">
                    <div class="text-gray-400 mb-4">
                        <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                            />
                        </svg>
                    </div>
                    <p class="text-gray-600">
                        {$searchTerm
                            ? `Tidak ada barang di stok yang cocok dengan pencarian "${$searchTerm}"`
                            : 'Tidak ada barang di stok.'}
                    </p>
                </div>
            {/if}
        </div>

        <!-- Barang Diterima - Card Layout -->
        <div class="mt-8">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold text-gray-900">Barang Diterima</h2>
                <div class="text-sm text-gray-600">
                    {procurementGroups.length} procurement ({totalFilteredItems} items total)
                </div>
            </div>
            
            {#if totalFilteredItems > 0}
                <!-- Display grouped procurement cards -->
                {#each paginatedItems as procurement}
                    <div class="bg-white rounded-lg shadow-md border border-gray-200 mb-6 overflow-hidden">
                        <!-- Header Card -->
                        <div class="bg-gray-50 border-b border-gray-200 px-6 py-4">
                            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div class="flex-1">
                                    <div class="flex items-center gap-3 mb-2">
                                        <span class="text-sm font-medium text-gray-500">ID Procurement:</span>
                                        <span class="font-mono text-lg font-bold text-gray-900">{procurement.procurement_id}</span>
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            {procurement.status}
                                        </span>
                                    </div>
                                    <div class="text-lg font-semibold text-gray-900 mb-1">{procurement.nama_pengaju}</div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button class="text-blue-600 hover:text-blue-800 p-1 rounded" title="Refresh" aria-label="Refresh data">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Info Grid -->
                        <div class="px-6 py-4 bg-white">
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                <div class="flex flex-col">
                                    <span class="text-sm text-gray-500 mb-1">Departemen</span>
                                    <span class="font-medium text-gray-900">IT</span>
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-sm text-gray-500 mb-1">Urgency</span>
                                    <span class="inline-flex items-center w-fit px-2 py-1 rounded text-xs font-medium"
                                          class:bg-red-100={procurement.urgency === 'Very Urgent'}
                                          class:text-red-800={procurement.urgency === 'Very Urgent'}
                                          class:bg-yellow-100={procurement.urgency === 'Urgent'}
                                          class:text-yellow-800={procurement.urgency === 'Urgent'}
                                          class:bg-green-100={procurement.urgency === 'Normal'}
                                          class:text-green-800={procurement.urgency === 'Normal'}>
                                        {procurement.urgency}
                                    </span>
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-sm text-gray-500 mb-1">Metode Pembayaran</span>
                                    <span class="font-medium text-gray-900">{procurement.metode_pembayaran}</span>
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-sm text-gray-500 mb-1">Tujuan Pengajuan</span>
                                    <span class="font-medium text-gray-900">{procurement.tujuan_pengajuan}</span>
                                </div>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-sm text-gray-500 mb-1">Tanggal Dibutuhkan</span>
                                <span class="font-medium text-gray-900">{formatDate(procurement.date_created)}</span>
                            </div>
                        </div>

                        <!-- Items Table -->
                        <div class="border-t border-gray-200">
                            <div class="px-6 py-3 bg-gray-50 border-b border-gray-200">
                                <div class="flex items-center gap-2">
                                    <h3 class="text-sm font-medium text-gray-900">Daftar Item</h3>
                                    <button class="text-blue-600 hover:text-blue-800 text-xs" title="Sinkronkan Status">
                                        🔄 Sinkronkan Status
                                    </button>
                                </div>
                            </div>
                            
                            <div class="overflow-x-auto">
                                <table class="w-full">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Nama Barang
                                            </th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Qty
                                            </th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Satuan
                                            </th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody class="bg-white divide-y divide-gray-200">
                                        {#each procurement.items as item}
                                            <tr class="hover:bg-gray-50">
                                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {item.nama_barang}
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {item.quantity}
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {item.unit}
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap space-x-2">
                                                    <!-- Direct Add to Stock Button -->
                                                    <button
                                                        on:click={() => handleDirectAddToStock({
                                                            id: item.id,
                                                            nama_barang: item.nama_barang,
                                                            nama_pengaju: item.nama_pengaju,
                                                            status: item.status,
                                                            quantity: item.quantity,
                                                            unit: item.unit
                                                        })}
                                                        class="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                                        disabled={addedToStockIds.includes(item.id)}
                                                    >
                                                        {#if addedToStockIds.includes(item.id)}
                                                            ✓ Sudah Di Stok
                                                        {:else}
                                                            � Tambah Stock
                                                        {/if}
                                                    </button>
                                                    
                                                    <!-- Advanced Add Button -->
                                                    <button
                                                        on:click={() => addToStock({
                                                            id: item.id,
                                                            name: item.nama_barang,
                                                            nama_pengaju: item.nama_pengaju,
                                                            status: item.status,
                                                            quantity: item.quantity,
                                                            unit: item.unit
                                                        })}
                                                        class="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                                        disabled={addedToStockIds.includes(item.id)}
                                                    >
                                                        {#if addedToStockIds.includes(item.id)}
                                                            ✓ Sudah Ditambah
                                                        {:else}
                                                            ⚙️ Advanced
                                                        {/if}
                                                    </button>
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                {/each}

                <!-- Paginasi untuk Barang Diterima -->
                <div class="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                    <div class="text-sm text-gray-600">
                        Menampilkan {Math.min((currentPage - 1) * 5 + 1, procurementGroups.length)} - {Math.min(
                            currentPage * 5,
                            procurementGroups.length
                        )} dari {procurementGroups.length} procurement ({totalFilteredItems} items total)
                        {#if $searchTerm}
                            <span class="text-blue-600">(hasil pencarian)</span>
                        {/if}
                    </div>
                    <div class="flex flex-wrap justify-center gap-1">
                        <button
                            on:click={() => changePage(currentPage - 1)}
                            disabled={currentPage === 1}
                            class="px-3 py-2 text-sm font-medium rounded-md border transition-colors {currentPage ===
                            1
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'}"
                        >
                            ← Previous
                        </button>
                        {#each getPageNumbers() as pageNum, i}
                            {#if pageNum === '...'}
                                <span class="px-3 py-2 text-sm text-gray-500">...</span>
                            {:else}
                                <button
                                    on:click={() => changePage(pageNum)}
                                    class="px-3 py-2 text-sm font-medium rounded-md border transition-colors {currentPage ===
                                    pageNum
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'}"
                                    disabled={currentPage === pageNum}
                                >
                                    {pageNum}
                                </button>
                            {/if}
                        {/each}
                        <button
                            on:click={() => changePage(currentPage + 1)}
                            disabled={currentPage === Math.ceil(procurementGroups.length / 5)}
                            class="px-3 py-2 text-sm font-medium rounded-md border transition-colors {currentPage ===
                            Math.ceil(procurementGroups.length / 5)
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'}"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            {:else if $searchTerm}
                <div class="bg-white rounded-lg shadow p-8 text-center">
                    <div class="text-gray-400 mb-4">
                        <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.44-1.01-5.9-2.618A8 8 0 0112 3c1.572 0 3.047.455 4.28 1.235"
                            />
                        </svg>
                    </div>
                    <p class="text-gray-600 mb-2">
                        Tidak ada barang diterima yang cocok dengan pencarian "<span class="font-semibold"
                            >{$searchTerm}</span
                        >"
                    </p>
                    <button
                        on:click={clearSearch}
                        class="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                        Hapus Filter
                    </button>
                </div>
            {:else}
                <div class="bg-white rounded-lg shadow p-8 text-center">
                    <div class="text-gray-400 mb-4">
                        <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                            />
                        </svg>
                    </div>
                    <p class="text-gray-600">Tidak ada barang dengan status "Barang Diterima".</p>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .bg-green-500 {
        background-color: #10b981;
    }
    .bg-red-500 {
        background-color: #ef4444;
    }
    .text-white {
        color: white;
    }
    .opacity-0 {
        opacity: 0;
    }
    .opacity-100 {
        opacity: 1;
    }
    .group:hover .group-hover\:opacity-100,
    .group:focus .group-hover\:opacity-100 {
        opacity: 1;
    }

    /* Custom scrollbar untuk tabel */
    .overflow-x-auto::-webkit-scrollbar {
        height: 8px;
    }

    .overflow-x-auto::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 4px;
    }

    .overflow-x-auto::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
    }

    .overflow-x-auto::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }

    /* Animasi untuk transisi */
    .transition-colors {
        transition:
            background-color 0.15s ease-in-out,
            border-color 0.15s ease-in-out,
            color 0.15s ease-in-out;
    }
</style>