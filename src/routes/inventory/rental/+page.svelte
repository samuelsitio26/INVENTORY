<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { searchTerm } from '$lib/stores/search.js';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import PengeluaranDetailModal from '$lib/components/inventory/PengeluaranDetailModal.svelte';
	import CreateGudangModal from '$lib/components/inventory/CreateGudangModal.svelte';
	import { getPengeluaranInventory, getPengeluaranSummary, getPengeluaranWithFilters } from '$lib/services/pengeluaran.js';
	import { exportToCSV, printPengeluaranReport } from '$lib/utils/exportPengeluaran.js';
	
	let data = [];
	let loading = true;
	let error = '';
	let summary = null;
	let showCreateModal = false;
	let showDetailModal = false;
	let showCreateGudangModal = false;
	let selectedItem = null;
	
	// User authentication
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

	// Function untuk format currency
	function formatCurrency(amount) {
		if (!amount) return '-';
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0
		}).format(amount);
	}

	// Fetch data from surat jalan
	async function fetchInventoryOutflows() {
		try {
			console.log('Fetching inventory outflow data from surat jalan...');
			
			// Use the new service to get data from surat jalan
			const pengeluaranData = await getPengeluaranInventory();
			return pengeluaranData;
			
		} catch (e) {
			console.error('Error fetching inventory outflows:', e);
			error = e.message || 'Gagal mengambil data pengeluaran barang';
			
			// Fallback to sample data if API fails
			return [
				{
					id: 1,
					kodeBarang: 'FG-001',
					namaBarang: 'Pipa PVC 4"',
					tipeBarang: 'FINISHED GOOD',
					jumlahKeluar: 5,
					satuan: 'pcs',
					tanggalKeluar: '2025-07-10',
					tujuan: 'PT. Maju Jaya',
					pic: 'Ahmad Sobari',
					keterangan: 'Pengiriman proyek Tangerang',
					status: 'APPROVED',
					nomorSJ: 'SJ/202507/001'
				},
				{
					id: 2,
					kodeBarang: 'RM-023',
					namaBarang: 'Besi Beton 10mm',
					tipeBarang: 'RAW MATERIAL',
					jumlahKeluar: 10,
					satuan: 'batang',
					tanggalKeluar: '2025-07-12',
					tujuan: 'Area Produksi B',
					pic: 'Budi Santoso',
					keterangan: 'Produksi batch #234',
					status: 'APPROVED',
					nomorSJ: 'SJ/202507/002'
				}
			];
		}
	}

	// Load summary data
	async function loadSummary() {
		try {
			summary = await getPengeluaranSummary();
		} catch (e) {
			console.error('Error loading summary:', e);
		}
	}

	onMount(async () => {
		try {
			console.log('Component mounted, fetching data...');
			data = await fetchInventoryOutflows();
			await loadSummary();
			console.log('Data loaded:', data);
			console.log('Summary loaded:', summary);
		} catch (e) {
			console.error('Error in onMount:', e);
			error = e.message || 'Gagal mengambil data pengeluaran barang';
		} finally {
			loading = false;
		}
	});

	// Filter variables
	let filterStartDate = '';
	let filterEndDate = '';
	let filterType = '';
	let filterStatus = '';
	let filterSearch = '';

	// Filtered data based on search criteria
	$: filteredData = data.filter((item) => {
		// Filter tanggal keluar
		let passDate = true;
		if (filterStartDate) {
			passDate = passDate && new Date(item.tanggalKeluar) >= new Date(filterStartDate);
		}
		if (filterEndDate) {
			passDate = passDate && new Date(item.tanggalKeluar) <= new Date(filterEndDate);
		}
		
		// Filter tipe barang
		let passType = !filterType || item.tipeBarang === filterType;
		
		// Filter status
		let passStatus = !filterStatus || item.status === filterStatus;
		
		// Filter search
		let search = filterSearch.toLowerCase();
		let passSearch =
			!search ||
			item.namaBarang?.toLowerCase().includes(search) ||
			item.kodeBarang?.toLowerCase().includes(search) ||
			item.tujuan?.toLowerCase().includes(search) ||
			item.pic?.toLowerCase().includes(search) ||
			item.nomorSJ?.toLowerCase().includes(search);
			
		return passDate && passType && passStatus && passSearch;
	});

	// Apply filters when search button is clicked
	async function applyFilters() {
		loading = true;
		try {
			const filters = {
				startDate: filterStartDate,
				endDate: filterEndDate,
				type: filterType,
				status: filterStatus,
				search: filterSearch
			};
			
			data = await getPengeluaranWithFilters(filters);
		} catch (e) {
			console.error('Error applying filters:', e);
			error = 'Gagal menerapkan filter';
		} finally {
			loading = false;
		}
	}

	// Reset filters
	function resetFilters() {
		filterStartDate = '';
		filterEndDate = '';
		filterType = '';
		filterStatus = '';
		filterSearch = '';
		// Reload original data
		fetchInventoryOutflows().then(result => {
			data = result;
		});
	}

	// Refresh data
	async function refreshData() {
		loading = true;
		try {
			data = await fetchInventoryOutflows();
			await loadSummary();
		} catch (e) {
			console.error('Error refreshing data:', e);
			error = 'Gagal memuat ulang data';
		} finally {
			loading = false;
		}
	}

	function getStatusClass(status) {
		switch (status) {
			case 'APPROVED':
				return 'bg-green-100 text-green-800';
			case 'PENDING':
				return 'bg-yellow-100 text-yellow-800';
			case 'IN_PROGRESS':
				return 'bg-blue-100 text-blue-800';
			case 'REJECTED':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	// Modal functions
	function openDetailModal(item) {
		selectedItem = item;
		showDetailModal = true;
	}

	function closeDetailModal() {
		showDetailModal = false;
		selectedItem = null;
	}

	// Gudang modal functions
	function openCreateGudangModal() {
		showCreateGudangModal = true;
	}

	function closeCreateGudangModal() {
		showCreateGudangModal = false;
	}

	function handleGudangCreated(event) {
		const newGudang = event.detail;
		console.log('Gudang baru dibuat:', newGudang);
		
		// Show success notification
		// You can add a toast notification here if you have one
		
		// Optionally refresh data or update UI
		// refreshData();
	}

	// Export functions
	function handleExportCSV() {
		const currentFilters = {
			startDate: filterStartDate,
			endDate: filterEndDate,
			type: filterType,
			status: filterStatus,
			search: filterSearch
		};
		exportToCSV(filteredData, 'pengeluaran-inventory');
	}

	function handlePrintReport() {
		const currentFilters = {
			startDate: filterStartDate,
			endDate: filterEndDate,
			type: filterType,
			status: filterStatus,
			search: filterSearch
		};
		printPengeluaranReport(filteredData, summary, currentFilters);
	}
</script>

<div class="mx-auto px-4 py-8" style="max-width:1600px; margin-left:-50px; margin-right:-50px;">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
		<div>
			<h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">
				Pengeluaran Inventory
			</h1>
			<p class="mt-1 text-sm text-gray-500">Rekap pengeluaran barang berdasarkan Surat Jalan yang telah dibuat</p>
		</div>
		<div class="flex gap-2 mt-4 sm:mt-0">
			<button
				on:click={() => goto('/inventory/consumable')}
				class="px-5 py-3 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 transition-colors shadow flex items-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
				</svg>
				Consumable
			</button>
			<button
				on:click={() => goto('/inventory/peminjaman')}
				class="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow flex items-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
				</svg>
				Peminjaman Barang
			</button>
			<button
				on:click={openCreateGudangModal}
				class="px-5 py-3 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors shadow flex items-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
				</svg>
				Buat Gudang
			</button>
			<button
				on:click={refreshData}
				class="px-5 py-3 bg-gray-600 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors shadow"
				>Refresh</button
			>
		</div>
	</div>

	<!-- Summary Cards -->
	{#if summary}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
			<div class="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
							<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<h3 class="text-sm font-medium text-gray-500">Total Pengeluaran</h3>
						<p class="text-2xl font-semibold text-gray-900">{summary.total}</p>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
							<svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6m-6 0l-3 6v6a2 2 0 002 2h8a2 2 0 002-2v-6l-3-6"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<h3 class="text-sm font-medium text-gray-500">Bulan Ini</h3>
						<p class="text-2xl font-semibold text-gray-900">{summary.thisMonth}</p>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
							<svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<h3 class="text-sm font-medium text-gray-500">Tahun Ini</h3>
						<p class="text-2xl font-semibold text-gray-900">{summary.thisYear}</p>
					</div>
				</div>
			</div>

			<!-- <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="w-8 h-8 bg-yellow-100 rounded-md flex items-center justify-center">
							<svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<h3 class="text-sm font-medium text-gray-500">Nilai Total</h3>
						<p class="text-lg font-semibold text-gray-900">{formatCurrency(summary.totalValue)}</p>
					</div>
				</div>
			</div> -->
		</div>
	{/if}

	<!-- Filter dan Pencarian -->
	<div class="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-200 flex flex-wrap gap-3 items-center">
		<div class="flex items-center gap-2">
			<input
				type="date"
				bind:value={filterStartDate}
				class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				placeholder="Dari Tanggal"
			/>
			<span class="text-gray-500">-</span>
			<input
				type="date"
				bind:value={filterEndDate}
				class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				placeholder="Sampai Tanggal"
			/>
		</div>

		<select
			bind:value={filterType}
			class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
		>
			<option value="">Semua Tipe</option>
			<option value="FINISHED GOOD">Finished Good</option>
			<option value="RAW MATERIAL">Raw Material</option>
			<option value="CONSUMABLE">Consumable</option>
		</select>

		<select
			bind:value={filterStatus}
			class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
		>
			<option value="">Semua Status</option>
			<option value="APPROVED">Approved</option>
			<option value="PENDING">Pending</option>
			<option value="IN_PROGRESS">In Progress</option>
			<option value="REJECTED">Rejected</option>
		</select>

		<div class="flex-1 min-w-[200px]">
			<input
				type="text"
				bind:value={filterSearch}
				placeholder="Cari kode, nama barang, tujuan, atau PIC..."
				class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			/>
		</div>

		<button
			on:click={applyFilters}
			class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow"
		>
			<svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
			</svg>
			Cari
		</button>

		<button
			on:click={resetFilters}
			class="px-4 py-2 bg-gray-500 text-white rounded-md text-sm font-medium hover:bg-gray-600 transition-colors shadow"
		>
			<svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
			</svg>
			Reset
		</button>

		<div class="flex gap-2 ml-4">
			<button
				on:click={handleExportCSV}
				class="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors shadow"
				title="Export ke CSV"
			>
				<svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
				</svg>
				Export CSV
			</button>
			
			<button
				on:click={handlePrintReport}
				class="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors shadow"
				title="Cetak Laporan"
			>
				<svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
				</svg>
				Cetak
			</button>
		</div>
	</div>

	<!-- Tabel Pengeluaran Barang -->
	<div class="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
		{#if loading}
			<div class="flex items-center justify-center p-10">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
				<span class="ml-3 text-gray-600">Memuat data...</span>
			</div>
		{:else if error}
			<div class="p-6 text-center text-red-600">
				<svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>
				<p class="text-lg font-medium">{error}</p>
				<button 
					on:click={() => location.reload()} 
					class="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
				>
					Coba Lagi
				</button>
			</div>
		{:else if filteredData.length === 0}
			<div class="p-10 text-center text-gray-500">
				<svg class="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
				</svg>
				<p class="text-lg font-medium">Data tidak ditemukan</p>
				<p class="mt-1">Coba ubah filter pencarian atau reset filter</p>
				<button 
					on:click={() => {
						filterStartDate = '';
						filterEndDate = '';
						filterType = '';
						filterStatus = '';
						filterSearch = '';
						resetFilters();
					}} 
					class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
				>
					Reset Filter
				</button>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Barang</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl Keluar</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tujuan</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PIC</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. SJ</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each filteredData as item}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.kodeBarang}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.namaBarang}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
										${item.tipeBarang === 'FINISHED GOOD' ? 'bg-purple-100 text-purple-800' : 
										item.tipeBarang === 'RAW MATERIAL' ? 'bg-blue-100 text-blue-800' : 
										'bg-orange-100 text-orange-800'}`}>
										{item.tipeBarang}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.jumlahKeluar} {item.satuan}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(item.tanggalKeluar)}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.tujuan}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.pic}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
									{item.nomorSJ || '-'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(item.status)}`}>
										{item.status}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
									<button 
										class="text-blue-600 hover:text-blue-900 mr-3"
										title="Lihat Detail"
										on:click={() => openDetailModal(item)}
									>
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
										</svg>
									</button>
									{#if item.nomorSJ}
										<button 
											class="text-green-600 hover:text-green-900"
											title="Lihat Surat Jalan"
											on:click={() => goto(`/inventory/finishedgood`)}
										>
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
											</svg>
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
				<div class="flex-1 flex justify-between sm:hidden">
					<a href="#" class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
						Sebelumnya
					</a>
					<a href="#" class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
						Selanjutnya
					</a>
				</div>
				<div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
					<div>
						<p class="text-sm text-gray-700">
							Menampilkan <span class="font-medium">1</span> sampai <span class="font-medium">{filteredData.length}</span> dari <span class="font-medium">{data.length}</span> data
							{#if summary && summary.totalValue > 0}
								<span class="text-gray-500">• Total Nilai: <span class="font-medium text-gray-900">{formatCurrency(summary.totalValue)}</span></span>
							{/if}
						</p>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-sm text-gray-500">Data diambil dari Surat Jalan</span>
						<div class="w-2 h-2 bg-green-400 rounded-full"></div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Detail Modal -->
<PengeluaranDetailModal 
	{selectedItem} 
	show={showDetailModal} 
	onClose={closeDetailModal} 
	item={selectedItem}
/>

<!-- Create Gudang Modal -->
<CreateGudangModal 
	show={showCreateGudangModal} 
	on:close={closeCreateGudangModal}
	on:success={handleGudangCreated}
/>

<style>
	/* Keep original styles that are still relevant */
	.hover\:shadow-lg:hover {
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
	}

	/* Custom scrollbar for tables */
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: #cbd5e1 #f1f5f9;
	}
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: linear-gradient(to bottom, #cbd5e1, #94a3b8);
		border-radius: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-corner {
		background: #f1f5f9;
	}

	/* Table row hover effect */
	.hover\:bg-gray-50:hover {
		background-color: #f9fafb;
		transition: background-color 0.2s ease;
	}
	
	/* Status badge animation */
	.inline-flex {
		position: relative;
		overflow: hidden;
	}
</style>
