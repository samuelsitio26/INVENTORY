<script>
	import { onMount } from 'svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';

	let loading = false;
	let error = null;
	let toast = { show: false, message: '', type: 'success' };
	
	// State untuk data finished goods
	let finishedGoods = [];
	let filteredFinishedGoods = [];
	
	// Paginasi
	let currentPage = 1;
	const itemsPerPage = 20;
	let totalItems = 0;
	let paginatedItems = [];
	
	// Filter dan search
	let searchTerm = '';
	let statusFilter = 'all';
	
	// Form state
	let showAddForm = false;
	let formData = {
		kode_barang: '',
		nama_barang: '',
		kemasan: '',
		quantity: '',
		kode_produk: '',
		nama_produk: '',
		kode_warna: '',
		warna: '',
		produk_group: '',
		nama_produk_group: '',
		kode_formula: '',
		nama_formula: '',
		sisa_stok: ''
	};
	let saving = false;
	
	// Sample data - replace with actual API call
	// Remove this section as we're now using real API data

	onMount(() => {
		loadFinishedGoods();
	});

	async function loadFinishedGoods() {
		loading = true;
		try {
			const response = await fetch('https://directus.eltamaprimaindo.com/items/finishgood', {
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				}
			});
			
			if (!response.ok) {
				throw new Error('Failed to fetch finished goods');
			}
			
			const data = await response.json();
			finishedGoods = data.data.map(item => ({
				...item,
				status: calculateStatus(item.sisa_stok || 0)
			}));
			
			filteredFinishedGoods = finishedGoods;
			totalItems = finishedGoods.length;
			updatePaginatedItems();
		} catch (err) {
			error = err.message;
			console.error('Load Finished Goods Error:', err);
		} finally {
			loading = false;
		}
	}

	function calculateStatus(stock) {
		if (stock === 0) return 'Out of Stock';
		if (stock < 10) return 'Low Stock';
		return 'Ready';
	}

	function getColorCode(colorName) {
		const colorMap = {
			'Putih': '#ffffff',
			'Coklat': '#8B4513',
			'Abu-abu': '#808080',
			'Hijau': '#008000',
			'Biru': '#0000FF',
			'Merah': '#FF0000',
			'Kuning': '#FFFF00',
			'Hitam': '#000000',
			'Orange': '#FFA500',
			'Ungu': '#800080',
			'Pink': '#FFC0CB',
			'Cream': '#F5F5DC',
			'Silver': '#C0C0C0',
			'Gold': '#FFD700'
		};
		return colorMap[colorName] || '#CCCCCC';
	}

	async function saveFinishedGood() {
		saving = true;
		try {
			const response = await fetch('https://directus.eltamaprimaindo.com/items/finishgood', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				},
				body: JSON.stringify({
					...formData,
					quantity: parseInt(formData.quantity) || 0,
					sisa_stok: parseInt(formData.sisa_stok) || 0,
					status: 'published'
				})
			});

			if (!response.ok) {
				throw new Error('Failed to save finished good');
			}

			// Reset form
			formData = {
				kode_barang: '',
				nama_barang: '',
				kemasan: '',
				quantity: '',
				kode_produk: '',
				nama_produk: '',
				kode_warna: '',
				warna: '',
				produk_group: '',
				nama_produk_group: '',
				kode_formula: '',
				nama_formula: '',
				sisa_stok: ''
			};
			
			showAddForm = false;
			await loadFinishedGoods();
			
			toast = { show: true, message: 'Finished good berhasil ditambahkan!', type: 'success' };
			setTimeout(() => toast.show = false, 3000);
		} catch (err) {
			toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
			setTimeout(() => toast.show = false, 3000);
			console.error('Save Error:', err);
		} finally {
			saving = false;
		}
	}

	function openAddForm() {
		showAddForm = true;
	}

	function closeAddForm() {
		showAddForm = false;
		formData = {
			kode_barang: '',
			nama_barang: '',
			kemasan: '',
			quantity: '',
			kode_produk: '',
			nama_produk: '',
			kode_warna: '',
			warna: '',
			produk_group: '',
			nama_produk_group: '',
			kode_formula: '',
			nama_formula: '',
			sisa_stok: ''
		};
	}

	function updatePaginatedItems() {
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		paginatedItems = filteredFinishedGoods.slice(start, end);
	}

	function handleSearch() {
		filteredFinishedGoods = finishedGoods.filter(item => {
			const matchesSearch = searchTerm === '' || 
				item.nama_barang.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.kode_barang.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.nama_produk.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.warna.toLowerCase().includes(searchTerm.toLowerCase());
			
			const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
			
			return matchesSearch && matchesStatus;
		});
		
		totalItems = filteredFinishedGoods.length;
		currentPage = 1;
		updatePaginatedItems();
	}

	function nextPage() {
		if (currentPage < Math.ceil(totalItems / itemsPerPage)) {
			currentPage++;
			updatePaginatedItems();
		}
	}

	function previousPage() {
		if (currentPage > 1) {
			currentPage--;
			updatePaginatedItems();
		}
	}

	function goToPage(page) {
		currentPage = page;
		updatePaginatedItems();
	}

	// Reactive statements
	$: {
		if (searchTerm !== undefined || statusFilter !== undefined) {
			handleSearch();
		}
	}

	$: totalPages = Math.ceil(totalItems / itemsPerPage);
	$: startItem = (currentPage - 1) * itemsPerPage + 1;
	$: endItem = Math.min(currentPage * itemsPerPage, totalItems);
</script>

<svelte:head>
	<title>Finished Goods - Inventory Management</title>
</svelte:head>

<div class="p-6 max-w-full mx-auto">
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Finished Goods</h1>
			<p class="text-gray-600">Kelola produk jadi yang siap untuk dijual</p>
		</div>
		<div class="flex gap-2">
			<button
				class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
				on:click={openAddForm}
			>
				+ Tambah Finish Good
			</button>
			<button
				class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
				on:click={() => window.location.reload()}
			>
				Refresh
			</button>
		</div>
	</div>

	{#if toast.show}
		<div class="fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg {toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white">
			{toast.message}
		</div>
	{/if}

	<!-- Add Form Modal -->
	{#if showAddForm}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
			<div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
				<div class="p-6">
					<div class="flex justify-between items-center mb-6">
						<h2 class="text-xl font-bold text-gray-900">Tambah Finish Good</h2>
						<button
							on:click={closeAddForm}
							class="text-gray-400 hover:text-gray-600 focus:outline-none"
						>
							✕
						</button>
					</div>
					
					<form on:submit|preventDefault={saveFinishedGood}>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
							<div>
								<label for="kode_barang" class="block text-sm font-medium text-gray-700 mb-1">Kode Barang *</label>
								<input
									id="kode_barang"
									type="text"
									bind:value={formData.kode_barang}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode barang"
								/>
							</div>
							
							<div>
								<label for="nama_barang" class="block text-sm font-medium text-gray-700 mb-1">Nama Barang *</label>
								<input
									id="nama_barang"
									type="text"
									bind:value={formData.nama_barang}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama barang"
								/>
							</div>
							
							<div>
								<label for="kemasan" class="block text-sm font-medium text-gray-700 mb-1">Kemasan *</label>
								<input
									id="kemasan"
									type="text"
									bind:value={formData.kemasan}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Contoh: Kaleng 5L"
								/>
							</div>
							
							<div>
								<label for="quantity" class="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
								<input
									id="quantity"
									type="number"
									bind:value={formData.quantity}
									required
									min="0"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="0"
								/>
							</div>
							
							<div>
								<label for="kode_produk" class="block text-sm font-medium text-gray-700 mb-1">Kode Produk *</label>
								<input
									id="kode_produk"
									type="text"
									bind:value={formData.kode_produk}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode produk"
								/>
							</div>
							
							<div>
								<label for="nama_produk" class="block text-sm font-medium text-gray-700 mb-1">Nama Produk *</label>
								<input
									id="nama_produk"
									type="text"
									bind:value={formData.nama_produk}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama produk"
								/>
							</div>
							
							<div>
								<label for="kode_warna" class="block text-sm font-medium text-gray-700 mb-1">Kode Warna *</label>
								<input
									id="kode_warna"
									type="text"
									bind:value={formData.kode_warna}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode warna"
								/>
							</div>
							
							<div>
								<label for="warna" class="block text-sm font-medium text-gray-700 mb-1">Warna *</label>
								<input
									id="warna"
									type="text"
									bind:value={formData.warna}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama warna"
								/>
							</div>
							
							<div>
								<label for="produk_group" class="block text-sm font-medium text-gray-700 mb-1">Produk Group *</label>
								<input
									id="produk_group"
									type="text"
									bind:value={formData.produk_group}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode produk group"
								/>
							</div>
							
							<div>
								<label for="nama_produk_group" class="block text-sm font-medium text-gray-700 mb-1">Nama Produk Group *</label>
								<input
									id="nama_produk_group"
									type="text"
									bind:value={formData.nama_produk_group}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama produk group"
								/>
							</div>
							
							<div>
								<label for="kode_formula" class="block text-sm font-medium text-gray-700 mb-1">Kode Formula *</label>
								<input
									id="kode_formula"
									type="text"
									bind:value={formData.kode_formula}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode formula"
								/>
							</div>
							
							<div>
								<label for="nama_formula" class="block text-sm font-medium text-gray-700 mb-1">Nama Formula *</label>
								<input
									id="nama_formula"
									type="text"
									bind:value={formData.nama_formula}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama formula"
								/>
							</div>
							
							<div class="md:col-span-2">
								<label for="sisa_stok" class="block text-sm font-medium text-gray-700 mb-1">Sisa Stok *</label>
								<input
									id="sisa_stok"
									type="number"
									bind:value={formData.sisa_stok}
									required
									min="0"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="0"
								/>
							</div>
						</div>
						
						<div class="flex justify-end gap-3">
							<button
								type="button"
								on:click={closeAddForm}
								class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
							>
								Batal
							</button>
							<button
								type="submit"
								disabled={saving}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
							>
								{saving ? 'Menyimpan...' : 'Simpan'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}

	<!-- Filters -->
	<div class="bg-white rounded-lg shadow p-4 mb-6">
		<div class="flex flex-wrap gap-4 items-center">
			<div class="flex-1 min-w-64">
				<label for="search-input" class="block text-sm font-medium text-gray-700 mb-1">Search</label>
				<input
					id="search-input"
					type="text"
					bind:value={searchTerm}
					placeholder="Cari berdasarkan nama, kode barang, produk, atau warna..."
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
			<div class="min-w-48">
				<label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
				<select
					id="status-filter"
					bind:value={statusFilter}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="all">Semua Status</option>
					<option value="Ready">Ready</option>
					<option value="Low Stock">Low Stock</option>
					<option value="Out of Stock">Out of Stock</option>
				</select>
			</div>
		</div>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Total Produk</div>
			<div class="text-2xl font-bold text-gray-900">{finishedGoods.length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Ready</div>
			<div class="text-2xl font-bold text-green-600">{finishedGoods.filter(item => item.status === 'Ready').length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Low Stock</div>
			<div class="text-2xl font-bold text-yellow-600">{finishedGoods.filter(item => item.status === 'Low Stock').length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Out of Stock</div>
			<div class="text-2xl font-bold text-red-600">{finishedGoods.filter(item => item.status === 'Out of Stock').length}</div>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-8">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
			<span class="ml-2 text-gray-600">Loading...</span>
		</div>
	{:else if error}
		<div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
			<div class="flex">
				<div class="text-red-400">⚠️</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-red-800">Error</h3>
					<div class="mt-2 text-sm text-red-700">{error}</div>
				</div>
			</div>
		</div>
	{:else}
		<!-- Table -->
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode Barang</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Barang</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kemasan</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode Produk</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Produk</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode Warna</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warna</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produk Group</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Produk Group</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode Formula</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Formula</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sisa Stok</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each paginatedItems as item}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.kode_barang}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama_barang}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.kemasan}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.kode_produk}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama_produk}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.kode_warna}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
									<div class="flex items-center">
										<div class="w-4 h-4 rounded-full mr-2 border border-gray-300" style="background-color: {getColorCode(item.warna)};"></div>
										{item.warna}
									</div>
								</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.produk_group}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama_produk_group}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.kode_formula}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama_formula}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.sisa_stok}</td>
								<td class="px-4 py-4 whitespace-nowrap">
									<StatusBadge status={item.status} />
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
					<div class="flex-1 flex justify-between items-center">
						<div>
							<p class="text-sm text-gray-700">
								Menampilkan <span class="font-medium">{startItem}</span> sampai <span class="font-medium">{endItem}</span> dari <span class="font-medium">{totalItems}</span> hasil
							</p>
						</div>
						<div class="flex items-center space-x-2">
							<button
								on:click={previousPage}
								disabled={currentPage === 1}
								class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Previous
							</button>
							
							{#each Array(totalPages) as _, i}
								{#if i + 1 === currentPage}
									<button
										class="px-3 py-1 border border-blue-500 bg-blue-50 text-blue-600 rounded-md text-sm font-medium"
									>
										{i + 1}
									</button>
								{:else if i + 1 === 1 || i + 1 === totalPages || (i + 1 >= currentPage - 1 && i + 1 <= currentPage + 1)}
									<button
										on:click={() => goToPage(i + 1)}
										class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
									>
										{i + 1}
									</button>
								{:else if i + 1 === currentPage - 2 || i + 1 === currentPage + 2}
									<span class="px-1 text-gray-500">...</span>
								{/if}
							{/each}
							
							<button
								on:click={nextPage}
								disabled={currentPage === totalPages}
								class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Next
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Custom styles if needed */
</style>