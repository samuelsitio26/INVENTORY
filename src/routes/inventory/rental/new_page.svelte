<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { searchTerm } from '$lib/stores/search.js';

	let data = [];
	let loading = true;
	let error = '';

	// User login & role mapping
	let user = null;

	// Simulasi: ambil user dari localStorage/session (atau hardcode untuk demo)
	// Ganti dengan logic login sesungguhnya jika sudah ada
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

	// Fetch data pengeluaran barang (outflows) dari Directus
	async function fetchInventoryOutflows() {
		try {
			console.log('Fetching inventory outflow data from Directus...');
			
			// 1. Fetch Surat Jalan (Finished Goods & Raw Material outflow)
			const sjResponse = await fetch(
				'https://directus.eltamaprimaindo.com/items/suratjalan?fields=*,tanggal_sj,nomor_sj,kode_customer,nama_finishgood,nama_rawmaterial,quantity,satuan,warna,kemasan',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
						'Content-Type': 'application/json'
					}
				}
			);
			
			// 2. Fetch Consumable outflow (from StokOut records)
			const consumableResponse = await fetch(
				'https://directus.eltamaprimaindo.com/items/Barang?fields=*,Nama,StokIn,StokOut,parent_category.parent_category,sub_category.nama_sub&filter[parent_category][parent_category][_in]=CONSUMABLE,SPAREPART',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
						'Content-Type': 'application/json'
					}
				}
			);

			if (!sjResponse.ok || !consumableResponse.ok) {
				const errorText = await ((!sjResponse.ok) ? sjResponse.text() : consumableResponse.text());
				console.error('API Error Response:', errorText);
				throw new Error(`HTTP Error: ${errorText}`);
			}

			const sjResult = await sjResponse.json();
			const consumableResult = await consumableResponse.json();
			
			console.log('Surat Jalan API Response:', sjResult);
			console.log('Consumable API Response:', consumableResult);

			// Combine and format data
			let outflowData = [];
			
			// Format SJ data (Finished Goods & Raw Materials)
			if (sjResult.data && sjResult.data.length) {
				outflowData = outflowData.concat(sjResult.data.map((item) => {
					// Determine if it's a finished good or raw material
					const isFG = !!item.nama_finishgood;
					return {
						id: item.id,
						tanggal: formatDate(item.tanggal_sj || item.date_created),
						nomor: item.nomor_sj || '-',
						kategori: isFG ? 'Finished Good' : 'Raw Material',
						namaBarang: isFG ? item.nama_finishgood : item.nama_rawmaterial,
						kuantitas: item.quantity || 0,
						satuan: item.satuan || 'pcs',
						tujuan: item.kode_customer || '-',
						keterangan: `${item.warna || ''} ${item.kemasan || ''}`.trim() || '-',
						tipe: 'suratjalan'
					};
				}));
			}
			
			// Format Consumable data
			if (consumableResult.data && consumableResult.data.length) {
				const consumables = consumableResult.data
					.filter(item => (item.StokOut || 0) > 0)  // Only include items with StokOut > 0
					.map(item => {
						return {
							id: item.id,
							tanggal: formatDate(item.date_updated || item.date_created),
							nomor: `CONS-${item.id.substring(0,8)}`,
							kategori: item.parent_category?.parent_category || 'Consumable',
							namaBarang: item.Nama || '-',
							kuantitas: item.StokOut || 0,
							satuan: item.Satuan || 'pcs',
							tujuan: item.Tujuan || 'Internal',
							keterangan: item.Keterangan || '-',
							tipe: 'consumable'
						};
					});
				
				outflowData = outflowData.concat(consumables);
			}
			
			// Sort by date (newest first)
			outflowData.sort((a, b) => {
				// Convert DD-MM-YYYY to Date objects
				const dateA = a.tanggal.split('-').reverse().join('-');
				const dateB = b.tanggal.split('-').reverse().join('-');
				return new Date(dateB) - new Date(dateA);
			});
			
			return outflowData;
		} catch (err) {
			console.error('Error fetching inventory outflow data:', err);
			// Return sample data untuk testing jika API gagal
			return [
				{
					id: 'sj-001',
					tanggal: '15-07-2025',
					nomor: 'SJ/FG/2025/07/001',
					kategori: 'Finished Good',
					namaBarang: 'Aluminium Profile AC-121',
					kuantitas: 150,
					satuan: 'pcs',
					tujuan: 'PT. Mega Elektronik',
					keterangan: 'Silver Anodize',
					tipe: 'suratjalan'
				},
				{
					id: 'sj-002',
					tanggal: '14-07-2025',
					nomor: 'SJ/FG/2025/07/002',
					kategori: 'Finished Good',
					namaBarang: 'Aluminium Bracket BR-45',
					kuantitas: 300,
					satuan: 'pcs',
					tujuan: 'CV. Maju Teknik',
					keterangan: 'Black Powder Coating',
					tipe: 'suratjalan'
				},
				{
					id: 'sj-003',
					tanggal: '14-07-2025',
					nomor: 'SJ/RM/2025/07/001',
					kategori: 'Raw Material',
					namaBarang: 'Plastik HDPE',
					kuantitas: 500,
					satuan: 'kg',
					tujuan: 'PT. Indo Plastik',
					keterangan: 'Untuk produksi kemasan',
					tipe: 'suratjalan'
				},
				{
					id: 'cons-001',
					tanggal: '13-07-2025',
					nomor: 'CONS-2025-001',
					kategori: 'Consumable',
					namaBarang: 'Oli Mesin',
					kuantitas: 20,
					satuan: 'liter',
					tujuan: 'Maintenance',
					keterangan: 'Perawatan bulanan mesin',
					tipe: 'consumable'
				},
				{
					id: 'cons-002',
					tanggal: '12-07-2025',
					nomor: 'CONS-2025-002',
					kategori: 'SPAREPART',
					namaBarang: 'Filter Udara',
					kuantitas: 5,
					satuan: 'pcs',
					tujuan: 'Maintenance',
					keterangan: 'Penggantian filter mesin',
					tipe: 'consumable'
				}
			];
		}
	}

	onMount(async () => {
		try {
			console.log('Component mounted, fetching data...');
			data = await fetchInventoryOutflows();
			console.log('Data loaded:', data);
		} catch (e) {
			console.error('Error in onMount:', e);
			error = e.message || 'Gagal mengambil data pengeluaran inventory';
		} finally {
			loading = false;
		}
	});

	// Filter data inventory outflow sesuai filter
	$: filteredData = data.filter((item) => {
		// Filter tanggal
		let passDate = true;
		if (filterStartDate) {
			const [d, m, y] = item.tanggal.split('-');
			const tgl = new Date(`${y}-${m}-${d}`);
			passDate = passDate && tgl >= new Date(filterStartDate);
		}
		if (filterEndDate) {
			const [d, m, y] = item.tanggal.split('-');
			const tgl = new Date(`${y}-${m}-${d}`);
			passDate = passDate && tgl <= new Date(filterEndDate);
		}
		
		// Filter kategori
		let passKategori = !filterKategori || item.kategori === filterKategori;
		
		// Filter search
		let search = filterSearch.toLowerCase();
		let passSearch =
			!search ||
			item.namaBarang?.toLowerCase().includes(search) ||
			item.nomor?.toLowerCase().includes(search) ||
			item.tujuan?.toLowerCase().includes(search) ||
			item.keterangan?.toLowerCase().includes(search);
			
		return passDate && passKategori && passSearch;
	});

	let filterStartDate = '';
	let filterEndDate = '';
	let filterKategori = '';
	let filterSearch = '';
</script>

<div
	class="mx-auto px-4 py-8"
	style="max-width:1600px; font-size:1.1rem; margin-left:-50px; margin-right:-50px;"
>
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
		<div>
			<h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">
				Manajemen Inventory
			</h1>
			<p class="mt-1 text-sm text-gray-500">Rekap pengeluaran barang finished goods, raw material, dan consumable</p>
		</div>
		<div class="flex gap-2 mt-4 sm:mt-0">
			<button
				on:click={() => goto('/inventory/finishedgood')}
				class="px-5 py-3 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors shadow flex items-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
				</svg>
				Finished Goods
			</button>
			<button
				on:click={() => goto('/inventory/rawmaterial')}
				class="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow flex items-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
				</svg>
				Raw Materials
			</button>
			<button
				on:click={() => goto('/inventory/consumable')}
				class="px-5 py-3 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 transition-colors shadow flex items-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
				</svg>
				Consumable
			</button>
			<button
				on:click={() => location.reload()}
				class="px-5 py-3 bg-gray-600 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors shadow"
				>Refresh</button
			>
		</div>
	</div>

	<!-- Filter Bar -->
	<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
		<div class="flex flex-wrap gap-4 items-center">
			<div class="flex items-center gap-2">
				<input
					type="date"
					bind:value={filterStartDate}
					class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
					style="width: 150px;"
				/>
				<span class="text-gray-500">-</span>
				<input
					type="date"
					bind:value={filterEndDate}
					class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
					style="width: 150px;"
				/>
			</div>

			<select
				bind:value={filterKategori}
				class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
			>
				<option value="">Semua Kategori</option>
				<option value="Finished Good">Finished Good</option>
				<option value="Raw Material">Raw Material</option>
				<option value="Consumable">Consumable</option>
				<option value="SPAREPART">Sparepart</option>
			</select>
			
			<div class="flex-1 relative">
				<svg class="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
				</svg>
				<input
					type="text"
					bind:value={filterSearch}
					placeholder="Cari berdasarkan nama barang, nomor, tujuan..."
					class="border border-gray-300 rounded-lg pl-10 pr-3 py-2 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
				/>
			</div>
		</div>
	</div>

	<!-- Main Table -->
	<div class="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
		{#if loading}
			<div class="flex justify-center items-center py-20">
				<div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
				<span class="ml-3 text-gray-700 font-medium">Memuat data...</span>
			</div>
		{:else if error}
			<div class="p-8 text-center">
				<div class="w-16 h-16 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-4">
					<svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"/>
					</svg>
				</div>
				<h3 class="text-lg font-medium text-gray-900 mb-2">Error</h3>
				<p class="text-gray-600 mb-4">{error}</p>
				<button 
					on:click={() => location.reload()}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
				>
					Coba Lagi
				</button>
			</div>
		{:else if filteredData.length === 0}
			<div class="p-8 text-center">
				<div class="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-4">
					<svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
					</svg>
				</div>
				<h3 class="text-lg font-medium text-gray-900 mb-2">Tidak ada data</h3>
				<p class="text-gray-600">Tidak ditemukan data yang sesuai dengan filter.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nomor Dokumen</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Barang</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kuantitas</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tujuan</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keterangan</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each filteredData as item, index}
							<tr class="hover:bg-gray-50 transition-colors">
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.tanggal}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.nomor}</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full 
										{item.kategori === 'Finished Good' 
											? 'bg-green-100 text-green-800 border border-green-300' 
											: item.kategori === 'Raw Material'
												? 'bg-blue-100 text-blue-800 border border-blue-300'
												: item.kategori === 'Consumable' || item.kategori === 'CONSUMABLE'
													? 'bg-orange-100 text-orange-800 border border-orange-300'
													: 'bg-purple-100 text-purple-800 border border-purple-300'
										}"
									>
										{item.kategori}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{item.namaBarang}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{item.kuantitas} {item.satuan}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.tujuan}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.keterangan}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			
			<!-- Statistics Summary -->
			<div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
				<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
					<div class="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
						<div class="text-sm font-medium text-gray-500 mb-1">Total Pengeluaran</div>
						<div class="text-2xl font-bold text-gray-900">{filteredData.length}</div>
					</div>
					<div class="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
						<div class="text-sm font-medium text-gray-500 mb-1">Finished Good</div>
						<div class="text-2xl font-bold text-green-600">
							{filteredData.filter(item => item.kategori === 'Finished Good').length}
						</div>
					</div>
					<div class="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
						<div class="text-sm font-medium text-gray-500 mb-1">Raw Material</div>
						<div class="text-2xl font-bold text-blue-600">
							{filteredData.filter(item => item.kategori === 'Raw Material').length}
						</div>
					</div>
					<div class="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
						<div class="text-sm font-medium text-gray-500 mb-1">Consumable & Sparepart</div>
						<div class="text-2xl font-bold text-orange-600">
							{filteredData.filter(item => item.kategori === 'Consumable' || item.kategori === 'CONSUMABLE' || item.kategori === 'SPAREPART').length}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
