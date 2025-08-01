<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { searchTerm } from '$lib/stores/search.js';

    let data = [];
    let loading = true;
    let error = '';
    let selectedItem = null;
    let showConfirm = false;
    let confirmAction = null;
    let showDetailModal = false;
    let detailItem = null;

    // User login & role mapping
    let user = null;

    onMount(() => {
        const email = localStorage.getItem('user_email');
        if (email === 'managerdept@eltama.com') {
            user = { email, role: 'Manager Dept', name: 'Manager Dept' };
        } else if (email === 'inventoryadmin@eltama.com') {
            user = { email, role: 'Inventory Manager', name: 'Inventory Manager' };
        } else if (email === 'procurementmanager@eltama.com') {
            user = { email, role: 'Procurement Manager', name: 'Procurement Manager' };
        } else {
            user = { email: '', role: '', name: '' };
        }
    });

    // Function untuk format tanggal DD-MM-YYYY
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }

    // Fetch data dari Consumable endpoint di Directus
    async function fetchBarangData() {
        try {
            console.log('Fetching consumable data from Directus...');

            // Menambahkan parameter untuk mengambil semua data
            const response = await fetch(
                'https://directus.eltamaprimaindo.com/items/consumable?limit=-1&fields=*',
                {
                    headers: {
                        Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.log('API Response:', result);
            console.log('Total items from API:', result.data?.length || 0);
            console.log('Available fields in first item:', result.data?.[0] ? Object.keys(result.data[0]) : 'No data');

            if (!result.data) {
                console.warn('No data property in response:', result);
                return [];
            }

            const mappedData = result.data.map((item, index) => {
                console.log(`Processing item ${index + 1}:`, item);

                return {
                    id: item.id || `temp-${index}`,
                    nama: item.namabarang || '-',
                    kategori: item.kategori || '-',
                    subKategori: item.subkategori || '-',
                    stokIn: parseInt(item.stokmasuk) || 0,
                    stokOut: parseInt(item.stokkeluar) || 0,
                    stokAkhir: parseInt(item.stokakhir) || 0,
                    status: item.status || '-',
                    moving: item.moving || '-',
                    unit: item.unit || '-',
                    safety: item.safety || '-',
                    tanggalMasuk: formatDate(item.date_created),
                    tanggalUpdate: formatDate(item.date_updated)
                };
            });

            console.log('Total mapped items:', mappedData.length);
            console.log('Mapped data sample:', mappedData.slice(0, 3));
            
            return mappedData;
        } catch (e) {
            console.error('Error fetch consumable data:', e);
            // Return sample data untuk testing jika API gagal
            return [
                {
                    id: 'sample-1',
                    nama: 'Kertas A4',
                    kategori: 'CONSUMABLE',
                    subKategori: 'Office Supplies',
                    stokIn: 100,
                    stokOut: 25,
                    stokAkhir: 75,
                    supplier: 'PT. Paper Supply',
                    lokasi: 'Gudang A1',
                    tanggalMasuk: '15-06-2025',
                    keterangan: 'Kertas putih 80gsm',
                    minStock: 20,
                    maxStock: 200,
                    harga: 50000
                },
                {
                    id: 'sample-2',
                    nama: 'Filter Air',
                    kategori: 'SPAREPART',
                    subKategori: 'Water System',
                    stokIn: 50,
                    stokOut: 10,
                    stokAkhir: 40,
                    supplier: 'CV. Sparepart Indo',
                    lokasi: 'Gudang B2',
                    tanggalMasuk: '20-06-2025',
                    keterangan: 'Filter air untuk mesin produksi',
                    minStock: 5,
                    maxStock: 100,
                    harga: 150000
                }
            ];
        }
    }

    onMount(async () => {
        try {
            console.log('Component mounted, fetching data...');
            data = await fetchBarangData();
            console.log('Data loaded:', data);
        } catch (e) {
            console.error('Error in onMount:', e);
            error = e.message || 'Gagal mengambil data barang';
        } finally {
            loading = false;
        }
    });

    function openDetailModal(item) {
        detailItem = item;
        showDetailModal = true;
    }

    function closeDetailModal() {
        showDetailModal = false;
        detailItem = null;
    }

    // Filter data
    let filterKategori = '';
    let filterSearch = '';
    let filterStokRendah = false;

    // Filter data barang sesuai filter
    $: filteredData = data.filter((item) => {
        // Filter kategori
        let passKategori = !filterKategori || item.kategori === filterKategori;
        
        // Filter search
        let search = filterSearch.toLowerCase();
        let passSearch =
            !search ||
            item.nama?.toLowerCase().includes(search) ||
            item.kategori?.toLowerCase().includes(search) ||
            item.subKategori?.toLowerCase().includes(search) ||
            item.status?.toLowerCase().includes(search) ||
            item.unit?.toLowerCase().includes(search);
        
        // Filter stok rendah (stok akhir <= safety stock)
        let passStokRendah = !filterStokRendah || (item.safety && item.stokAkhir <= parseInt(item.safety));
        
        return passKategori && passSearch && passStokRendah;
    });

    function getStokStatus(item) {
        if (item.stokAkhir <= 0) return { status: 'habis', class: 'bg-red-100 text-red-800 border-red-300' };
        if (item.safety && item.stokAkhir <= parseInt(item.safety)) return { status: 'rendah', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
        return { status: 'normal', class: 'bg-green-100 text-green-800 border-green-300' };
    }

    function formatRupiah(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }

    function handleAddBarang() {
        goto('/inventory/peminjaman/create');
    }

    function handleRefresh() {
        location.reload();
    }

    // Fungsi untuk menyimpan data baru ke Directus
    // Fungsi untuk menyimpan data ke Directus
    async function saveConsumableData(itemData) {
        try {
            // Transform form data to match exact Directus field names
            const dataToSave = {
                namabarang: itemData.nama_barang,
                kategori: itemData.kategori,
                subkategori: itemData.sub_kategori,
                stokmasuk: itemData.stok_masuk?.toString() || "0",
                stokkeluar: itemData.stok_keluar?.toString() || "0",
                stokakhir: ((itemData.stok_masuk || 0) - (itemData.stok_keluar || 0)).toString(),
                status: itemData.status || null,
                moving: itemData.moving || null,
                unit: itemData.unit || null,
                safety: itemData.safety || null
            };

            console.log('Data to save:', dataToSave);

            const response = await fetch('https://directus.eltamaprimaindo.com/items/consumable', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToSave)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Data berhasil disimpan:', result);
            
            // Refresh data setelah berhasil menyimpan
            data = await fetchBarangData();
            
            return result;
        } catch (e) {
            console.error('Error saving data:', e);
            throw e;
        }
    }

    // Fungsi untuk update data di Directus
    async function updateConsumableData(id, itemData) {
        try {
            // Transform form data to match exact Directus field names
            const dataToUpdate = {
                namabarang: itemData.nama_barang,
                kategori: itemData.kategori,
                subkategori: itemData.sub_kategori,
                stokmasuk: itemData.stok_masuk?.toString() || "0",
                stokkeluar: itemData.stok_keluar?.toString() || "0",
                stokakhir: ((itemData.stok_masuk || 0) - (itemData.stok_keluar || 0)).toString(),
                status: itemData.status || null,
                moving: itemData.moving || null,
                unit: itemData.unit || null,
                safety: itemData.safety || null
            };

            console.log('Data to update:', dataToUpdate);

            const response = await fetch(`https://directus.eltamaprimaindo.com/items/consumable/${id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToUpdate)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Data berhasil diupdate:', result);
            
            // Refresh data setelah berhasil update
            data = await fetchBarangData();
            
            return result;
        } catch (e) {
            console.error('Error updating data:', e);
            throw e;
        }
    }

    // State untuk form add/edit
    let showAddForm = false;
    let editingItem = null;
    let formData = {
        nama_barang: '',
        kategori: 'CONSUMABLE',
        sub_kategori: '',
        stok_masuk: 0,
        stok_keluar: 0,
        status: '',
        moving: '',
        unit: '',
        safety: ''
    };

    function resetForm() {
        formData = {
            nama_barang: '',
            kategori: 'CONSUMABLE',
            sub_kategori: '',
            stok_masuk: 0,
            stok_keluar: 0,
            status: '',
            moving: '',
            unit: '',
            safety: ''
        };
        editingItem = null;
    }

    function openAddForm() {
        resetForm();
        showAddForm = true;
    }

    function openEditForm(item) {
        formData = {
            nama_barang: item.nama,
            kategori: item.kategori,
            sub_kategori: item.subKategori,
            stok_masuk: item.stokIn,
            stok_keluar: item.stokOut,
            status: item.status,
            moving: item.moving,
            unit: item.unit,
            safety: item.safety
        };
        editingItem = item;
        showAddForm = true;
    }

    function closeAddForm() {
        showAddForm = false;
        resetForm();
    }

    async function handleSubmitForm() {
        try {
            loading = true;
            console.log('Form data to submit:', formData);
            
            if (editingItem) {
                // Update existing item
                await updateConsumableData(editingItem.id, formData);
                console.log('Item berhasil diupdate');
                alert('Data berhasil diupdate!');
            } else {
                // Create new item
                await saveConsumableData(formData);
                console.log('Item berhasil ditambahkan');
                alert('Data berhasil ditambahkan!');
            }
            
            closeAddForm();
        } catch (e) {
            console.error('Error submitting form:', e);
            error = e.message || 'Gagal menyimpan data';
            alert('Error: ' + (e.message || 'Gagal menyimpan data'));
        } finally {
            loading = false;
        }
    }
</script>

<div class="mx-auto px-4 py-8" style="max-width:1600px; font-size:1.1rem;">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
            <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">
                Stok Consumable & Sparepart
            </h1>
            <p class="mt-1 text-sm text-gray-500">Kelola barang consumable dan sparepart</p>
        </div>
        <div class="flex gap-2 mt-4 sm:mt-0">
            <button
                on:click={openAddForm}
                class="px-5 py-3 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors shadow"
            >
                + Tambah Data
            </button>
            <button
                on:click={handleAddBarang}
                class="px-5 py-3 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 transition-colors shadow"
            >
                Pengajuan Barang
            </button>
            <button
                on:click={handleRefresh}
                class="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow"
            >
                Refresh
            </button>
        </div>
    </div>

    <!-- Info Summary - Moved to top -->
    <div class="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="flex items-center">
                <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium text-gray-500">Total Item</p>
                    <p class="text-2xl font-semibold text-gray-900">{data.length}</p>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="flex items-center">
                <div class="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg class="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"/>
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium text-gray-500">Stok Rendah</p>
                    <p class="text-2xl font-semibold text-gray-900">{data.filter(item => item.safety && item.stokAkhir <= parseInt(item.safety) && item.stokAkhir > 0).length}</p>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="flex items-center">
                <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium text-gray-500">Stok Habis</p>
                    <p class="text-2xl font-semibold text-gray-900">{data.filter(item => item.stokAkhir <= 0).length}</p>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="flex items-center">
                <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium text-gray-500">Stok Normal</p>
                    <p class="text-2xl font-semibold text-gray-900">{data.filter(item => item.stokAkhir > 0 && (!item.safety || item.stokAkhir > parseInt(item.safety))).length}</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Filter -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div class="flex flex-wrap gap-4 items-center">
            <select
                bind:value={filterKategori}
                class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors bg-white"
            >
                <option value="">Semua Kategori</option>
                <option value="CONSUMABLE">Consumable</option>
                <option value="SPAREPART">Sparepart</option>
                
            </select>
            
            <input
                type="text"
                bind:value={filterSearch}
                placeholder="Cari nama barang, kategori, sub kategori, status, unit..."
                class="flex-1 min-w-[300px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
            />
            
            <label class="flex items-center gap-2">
                <input
                    type="checkbox"
                    bind:checked={filterStokRendah}
                    class="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 focus:ring-2"
                />
                <span class="text-sm text-gray-700">Stok Rendah</span>
            </label>
        </div>
    </div>

    {#if loading}
        <div class="flex items-center justify-center h-64">
            <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
                <p class="mt-4 text-gray-600">Memuat data...</p>
            </div>
        </div>
    {:else if error}
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p class="font-semibold">Error:</p>
            <p>{error}</p>
        </div>
    {:else}
        <!-- Tabel -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                No
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Nama Barang
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Kategori
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Sub Kategori
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Stok Masuk
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Stok Keluar
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Stok Akhir
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Moving
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Unit
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Safety
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Aksi
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {#each filteredData as item, i}
                            {@const stokInfo = getStokStatus(item)}
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {i + 1}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm font-medium text-gray-900">{item.nama}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {item.kategori === 'CONSUMABLE' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">
                                        {item.kategori}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {item.subKategori}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                    {item.stokIn}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                    {item.stokOut}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold {item.stokAkhir <= 0 ? 'text-red-600' : item.safety && item.stokAkhir <= parseInt(item.safety) ? 'text-yellow-600' : 'text-green-600'}">
                                    {item.stokAkhir}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full border {stokInfo.class}">
                                        {stokInfo.status}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {item.moving}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {item.unit}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {item.safety}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div class="flex gap-2">
                                        <button
                                            on:click={() => openDetailModal(item)}
                                            class="text-orange-600 hover:text-orange-900 font-semibold"
                                        >
                                            Detail
                                        </button>
                                        <button
                                            on:click={() => openEditForm(item)}
                                            class="text-blue-600 hover:text-blue-900 font-semibold"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                        {#if filteredData.length === 0}
                            <tr>
                                <td colspan="12" class="px-6 py-12 text-center">
                                    <div class="text-gray-500">
                                        <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                                        </svg>
                                        <p class="text-lg font-medium">Tidak ada data ditemukan</p>
                                        <p class="text-sm">Coba ubah filter atau tambah barang baru</p>
                                    </div>
                                </td>
                            </tr>
                        {/if}
                    </tbody>
                </table>
            </div>
        </div>
    {/if}
</div>

<!-- Modal Detail -->
{#if showDetailModal && detailItem}
    <div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-gray-900">Detail Barang</h2>
                        <p class="text-sm text-gray-500">Informasi lengkap barang</p>
                    </div>
                </div>
                <button
                    on:click={closeDetailModal}
                    class="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Informasi Dasar -->
                <div class="bg-gray-50 rounded-xl p-4">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Informasi Dasar</h3>
                    <div class="space-y-3">
                        <div>
                            <label class="text-sm font-medium text-gray-500">Nama Barang</label>
                            <p class="text-gray-900 font-semibold">{detailItem.nama}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500">Kategori</label>
                            <p class="text-gray-900">{detailItem.kategori}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500">Sub Kategori</label>
                            <p class="text-gray-900">{detailItem.subKategori}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500">Status</label>
                            <p class="text-gray-900">{detailItem.status}</p>
                        </div>
                    </div>
                </div>

                <!-- Informasi Stok -->
                <div class="bg-gray-50 rounded-xl p-4">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Informasi Stok</h3>
                    <div class="space-y-3">
                        <div>
                            <label class="text-sm font-medium text-gray-500">Stok Masuk</label>
                            <p class="text-gray-900 font-semibold text-green-600">{detailItem.stokIn}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500">Stok Keluar</label>
                            <p class="text-gray-900 font-semibold text-red-600">{detailItem.stokOut}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500">Stok Akhir</label>
                            <p class="text-gray-900 font-bold text-lg">{detailItem.stokAkhir}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500">Safety Stock</label>
                            <p class="text-gray-900">{detailItem.safety}</p>
                        </div>
                    </div>
                </div>

                <!-- Informasi Lainnya -->
                <div class="bg-gray-50 rounded-xl p-4">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Informasi Lainnya</h3>
                    <div class="space-y-3">
                        <div>
                            <label class="text-sm font-medium text-gray-500">Moving</label>
                            <p class="text-gray-900">{detailItem.moving}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500">Unit</label>
                            <p class="text-gray-900">{detailItem.unit}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500">Tanggal Dibuat</label>
                            <p class="text-gray-900">{detailItem.tanggalMasuk}</p>
                        </div>
                    </div>
                </div>

                <!-- Status Stok -->
                <div class="bg-gray-50 rounded-xl p-4">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Status Stok</h3>
                    <div class="space-y-3">
                        <div>
                            <label class="text-sm font-medium text-gray-500">Status Stok</label>
                            <div class="mt-1">
                                {#if detailItem}
                                    {@const stokInfo = getStokStatus(detailItem)}
                                    <span class="inline-flex px-3 py-1 text-sm font-semibold rounded-full border {stokInfo.class}">
                                        {stokInfo.status}
                                    </span>
                                {/if}
                            </div>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500">Persentase Safety</label>
                            <p class="text-gray-900">
                                {#if detailItem.safety && parseInt(detailItem.safety) > 0}
                                    {Math.round((detailItem.stokAkhir / parseInt(detailItem.safety)) * 100)}%
                                {:else}
                                    -
                                {/if}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex justify-end mt-6">
                <button
                    on:click={closeDetailModal}
                    class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                    Tutup
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Modal Form Add/Edit -->
{#if showAddForm}
    <div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-gray-900">
                            {editingItem ? 'Edit' : 'Tambah'} Data Consumable & Sparepart
                        </h2>
                        <p class="text-sm text-gray-500">
                            {editingItem ? 'Ubah informasi barang' : 'Tambah barang consumable atau sparepart baru'}
                        </p>
                    </div>
                </div>
                <button
                    on:click={closeAddForm}
                    class="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            
            <form on:submit|preventDefault={handleSubmitForm}>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Informasi Dasar -->
                    <div class="space-y-4">
                        <h3 class="text-lg font-semibold text-gray-900">Informasi Dasar</h3>
                        
                        <div>
                            <label for="nama_barang" class="block text-sm font-medium text-gray-700 mb-1">Nama Barang *</label>
                            <input
                                id="nama_barang"
                                type="text"
                                bind:value={formData.nama_barang}
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                placeholder="Masukkan nama barang"
                            />
                        </div>

                        <div>
                            <label for="kategori" class="block text-sm font-medium text-gray-700 mb-1">Kategori *</label>
                            <select
                                id="kategori"
                                bind:value={formData.kategori}
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            >
                                <option value="CONSUMABLE">Consumable</option>
                                <option value="SPAREPART">Sparepart</option>
                            </select>
                        </div>

                        <div>
                            <label for="sub_kategori" class="block text-sm font-medium text-gray-700 mb-1">Sub Kategori</label>
                            <input
                                id="sub_kategori"
                                type="text"
                                bind:value={formData.sub_kategori}
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                placeholder="Masukkan sub kategori"
                            />
                        </div>

                        <div>
                            <label for="status" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <input
                                id="status"
                                type="text"
                                bind:value={formData.status}
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                placeholder="Masukkan status barang"
                            />
                        </div>
                    </div>

                    <!-- Informasi Stok & Lainnya -->
                    <div class="space-y-4">
                        <h3 class="text-lg font-semibold text-gray-900">Informasi Stok & Lainnya</h3>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="stok_masuk" class="block text-sm font-medium text-gray-700 mb-1">Stok Masuk</label>
                                <input
                                    id="stok_masuk"
                                    type="number"
                                    bind:value={formData.stok_masuk}
                                    min="0"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label for="stok_keluar" class="block text-sm font-medium text-gray-700 mb-1">Stok Keluar</label>
                                <input
                                    id="stok_keluar"
                                    type="number"
                                    bind:value={formData.stok_keluar}
                                    min="0"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div>
                            <label for="moving" class="block text-sm font-medium text-gray-700 mb-1">Moving</label>
                            <input
                                id="moving"
                                type="text"
                                bind:value={formData.moving}
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                placeholder="Masukkan informasi moving"
                            />
                        </div>

                        <div>
                            <label for="unit" class="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                            <input
                                id="unit"
                                type="text"
                                bind:value={formData.unit}
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                placeholder="Masukkan unit (pcs, kg, liter, dll)"
                            />
                        </div>

                        <div>
                            <label for="safety" class="block text-sm font-medium text-gray-700 mb-1">Safety Stock</label>
                            <input
                                id="safety"
                                type="number"
                                bind:value={formData.safety}
                                min="0"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                placeholder="Masukkan safety stock"
                            />
                        </div>

                        <div class="bg-gray-50 p-3 rounded-lg">
                            <p class="text-sm text-gray-600 mb-1">Stok Akhir (Auto Calculate):</p>
                            <p class="text-lg font-semibold text-green-600">
                                {(formData.stok_masuk || 0) - (formData.stok_keluar || 0)}
                            </p>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                    <button
                        type="button"
                        on:click={closeAddForm}
                        class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Menyimpan...' : (editingItem ? 'Update' : 'Simpan')}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }
</style>