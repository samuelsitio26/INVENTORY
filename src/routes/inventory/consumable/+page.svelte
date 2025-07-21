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

    // Fetch data dari Barang di Stok dengan kategori CONSUMABLE dan SPAREPART
    async function fetchBarangData() {
        try {
            console.log('Fetching barang data from Directus...');

            const response = await fetch(
                'https://directus.eltamaprimaindo.com/items/Barang?fields=*,parent_category.parent_category,sub_category.nama_sub&filter[parent_category][parent_category][_in]=CONSUMABLE,SPAREPART',
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

            if (!result.data) {
                console.warn('No data property in response:', result);
                return [];
            }

            return result.data.map((item, index) => {
                console.log(`Processing item ${index + 1}:`, item);

                return {
                    id: item.id || `temp-${index}`,
                    nama: item.Nama || '-',
                    kategori: item.parent_category?.parent_category || '-',
                    subKategori: item.sub_category?.nama_sub || '-',
                    stokIn: item.StokIn || 0,
                    stokOut: item.StokOut || 0,
                    stokAkhir: (item.StokIn || 0) - (item.StokOut || 0),
                    supplier: item.Supplier || '-',
                    lokasi: item.Lokasi || '-',
                    tanggalMasuk: formatDate(item.date_created),
                    keterangan: item.Keterangan || '-',
                    minStock: item.MinStock || 0,
                    maxStock: item.MaxStock || 0,
                    harga: item.Harga || 0
                };
            });
        } catch (e) {
            console.error('Error fetch barang:', e);
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
            item.supplier?.toLowerCase().includes(search) ||
            item.lokasi?.toLowerCase().includes(search);
        
        // Filter stok rendah (stok akhir <= min stock)
        let passStokRendah = !filterStokRendah || item.stokAkhir <= item.minStock;
        
        return passKategori && passSearch && passStokRendah;
    });

    function getStokStatus(item) {
        if (item.stokAkhir <= 0) return { status: 'habis', class: 'bg-red-100 text-red-800 border-red-300' };
        if (item.stokAkhir <= item.minStock) return { status: 'rendah', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
        if (item.stokAkhir >= item.maxStock) return { status: 'berlebih', class: 'bg-blue-100 text-blue-800 border-blue-300' };
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
                placeholder="Cari nama barang, supplier, lokasi..."
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
                                Supplier
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Lokasi
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
                                    <div class="text-sm text-gray-500">{item.keterangan}</div>
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
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold {item.stokAkhir <= 0 ? 'text-red-600' : item.stokAkhir <= item.minStock ? 'text-yellow-600' : 'text-green-600'}">
                                    {item.stokAkhir}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full border {stokInfo.class}">
                                        {stokInfo.status}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {item.supplier}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {item.lokasi}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                        on:click={() => openDetailModal(item)}
                                        class="text-orange-600 hover:text-orange-900 font-semibold"
                                    >
                                        Detail
                                    </button>
                                </td>
                            </tr>
                        {/each}
                        {#if filteredData.length === 0}
                            <tr>
                                <td colspan="11" class="px-6 py-12 text-center">
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

        <!-- Info Summary -->
        <div class="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium text-gray-500">Total Item</p>
                        <p class="text-2xl font-semibold text-gray-900">{filteredData.length}</p>
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
                        <p class="text-2xl font-semibold text-gray-900">{filteredData.filter(item => item.stokAkhir <= item.minStock && item.stokAkhir > 0).length}</p>
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
                        <p class="text-2xl font-semibold text-gray-900">{filteredData.filter(item => item.stokAkhir <= 0).length}</p>
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
                        <p class="text-2xl font-semibold text-gray-900">{filteredData.filter(item => item.stokAkhir > item.minStock && item.stokAkhir < item.maxStock).length}</p>
                    </div>
                </div>
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
                            <label class="text-sm font-medium text-gray-500">Keterangan</label>
                            <p class="text-gray-900">{detailItem.keterangan}</p>
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
                            <label class="text-sm font-medium text-gray-500">Min/Max Stock</label>
                            <p class="text-gray-900">{detailItem.minStock} / {detailItem.maxStock}</p>
                        </div>
                    </div>
                </div>

                <!-- Informasi Supplier -->
                <div class="bg-gray-50 rounded-xl p-4">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Informasi Supplier</h3>
                    <div class="space-y-3">
                        <div>
                            <label class="text-sm font-medium text-gray-500">Supplier</label>
                            <p class="text-gray-900">{detailItem.supplier}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500">Lokasi</label>
                            <p class="text-gray-900">{detailItem.lokasi}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500">Tanggal Masuk</label>
                            <p class="text-gray-900">{detailItem.tanggalMasuk}</p>
                        </div>
                    </div>
                </div>

                <!-- Informasi Harga -->
                <div class="bg-gray-50 rounded-xl p-4">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Informasi Harga</h3>
                    <div class="space-y-3">
                        <div>
                            <label class="text-sm font-medium text-gray-500">Harga Satuan</label>
                            <p class="text-gray-900 font-semibold">{formatRupiah(detailItem.harga)}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500">Total Nilai Stok</label>
                            <p class="text-gray-900 font-bold text-lg">{formatRupiah(detailItem.harga * detailItem.stokAkhir)}</p>
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