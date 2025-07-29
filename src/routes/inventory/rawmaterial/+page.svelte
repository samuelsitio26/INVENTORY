<script>
	import { onMount } from 'svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { getAllRawMaterials, createRawMaterial } from '$lib/services/rawmaterial.js';

	let loading = false;
	let error = null;
	let toast = { show: false, message: '', type: 'success' };
	
	// State untuk data raw materials
	let rawMaterials = [];
	let filteredRawMaterials = [];
	
	// Paginasi
	let currentPage = 1;
	const itemsPerPage = 20;
	let totalItems = 0;
	let paginatedItems = [];
	
	// Filter dan search
	let searchTerm = '';
	let statusFilter = 'all';
	let divisiFilter = 'all';
	let jenisFilter = 'all';
	
	// Form state
	let showAddForm = false;
	let formData = {
		kode: '',
		nama: '',
		kemasan: '',
		satuan: '',
		Divisi: '',
		Group: '',
		Jenis: '',
		stok: '',
		kategori: 'Active',
		harga_beli: '',
		harga_lama: '',
		hp_awal: '',
		sisa_stok: '',
		sisa_po: '',
		minimum_stok: '',
		in_liter: '',
		in_kg: ''
	};
	let saving = false;
	
	// Options for dropdowns
	const divisiOptions = ['Food & Beverages', 'Chemicals', 'Textiles', 'Packaging', 'PRODUKSI',  'Others'];
	const jenisOptions = ['Raw Material', 'Packing', 'Solid', 'Paste', 'Granule', 'BASE', 'BANGUNAN', 'ELECTRICAL', 'EQUIPMENT', 'INSPEKSI'];
	const satuanOptions = ['Kg', 'Ltr', 'Pcs', 'Box', 'Bag', 'Drum'];

	onMount(() => {
		loadRawMaterials();
	});

	async function loadRawMaterials() {
		loading = true;
		try {
			console.log('Loading raw materials...');
			const data = await getAllRawMaterials();
			
			rawMaterials = data.map(item => ({
				...item,
				status: calculateStatus(item.sisa_stok || 0, item.minimum_stok || 0)
			}));
			
			filteredRawMaterials = rawMaterials;
			totalItems = rawMaterials.length;
			updatePaginatedItems();
			
			console.log('Raw materials loaded:', rawMaterials.length);
		} catch (err) {
			error = err.message;
			console.error('Load Raw Materials Error:', err);
			toast = { show: true, message: 'Error loading data: ' + err.message, type: 'error' };
			setTimeout(() => toast.show = false, 3000);
		} finally {
			loading = false;
		}
	}

	function calculateStatus(currentStock, minStock) {
		if (currentStock === 0) return 'Out of Stock';
		if (currentStock <= minStock) return 'Low Stock';
		return 'Ready';
	}

	async function saveRawMaterial() {
		saving = true;
		try {
			console.log('Saving raw material...');
			console.log('Original formData:', formData);
			
			// Validate required fields
			if (!formData.kode || !formData.nama || !formData.satuan) {
				throw new Error('Mohon isi semua field yang wajib diisi');
			}
			
			if (!formData.kategori) {
				throw new Error('Field kategori harus dipilih');
			}
			
			console.log('Validation passed, kategori value:', formData.kategori);
			
			// Prepare data for Directus with proper field mapping
			const rawMaterialData = {
				kode: formData.kode.toString(),
				nama: formData.nama.toString(),
				kemasan: formData.kemasan.toString(),
				satuan: formData.satuan.toString(),
				Divisi: formData.Divisi || '',
				Group: formData.Group || '',
				Jenis: formData.Jenis || '',
				stok: formData.stok || '',
				kategori: formData.kategori || 'Active', // Ensure kategori is not null
				harga_beli: parseFloat(formData.harga_beli) || 0,
				harga_lama: parseFloat(formData.harga_lama) || 0,
				hp_awal: parseFloat(formData.hp_awal) || 0,
				sisa_stok: parseFloat(formData.sisa_stok) || 0,
				sisa_po: parseFloat(formData.sisa_po) || 0,
				minimum_stok: parseFloat(formData.minimum_stok) || 0,
				in_liter: parseFloat(formData.in_liter) || 0,
				in_kg: parseFloat(formData.in_kg) || 0
			};

			console.log('Prepared data for Directus:', rawMaterialData);

			const result = await createRawMaterial(rawMaterialData);
			console.log('Raw material created:', result);

			// Reset form
			resetForm();
			showAddForm = false;
			await loadRawMaterials();
			
			toast = { show: true, message: 'Raw material berhasil ditambahkan!', type: 'success' };
			setTimeout(() => toast.show = false, 3000);
		} catch (err) {
			console.error('Save Error:', err);
			toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
			setTimeout(() => toast.show = false, 3000);
		} finally {
			saving = false;
		}
	}

	function resetForm() {
		console.log('Resetting form...');
		formData = {
			kode: '',
			nama: '',
			kemasan: '',
			satuan: '',
			Divisi: '',
			Group: '',
			Jenis: '',
			stok: '',
			kategori: 'Active', // Explicitly set to Active
			harga_beli: '',
			harga_lama: '',
			hp_awal: '',
			sisa_stok: '',
			sisa_po: '',
			minimum_stok: '',
			in_liter: '',
			in_kg: ''
		};
		console.log('Form reset to:', formData);
	}

	function openAddForm() {
		showAddForm = true;
	}

	function closeAddForm() {
		showAddForm = false;
		resetForm();
	}

	function updatePaginatedItems() {
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		paginatedItems = filteredRawMaterials.slice(start, end);
	}

	function handleSearch() {
		filteredRawMaterials = rawMaterials.filter(item => {
			const matchesSearch = searchTerm === '' || 
				item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.kode.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.kemasan.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.Divisi.toLowerCase().includes(searchTerm.toLowerCase());
			
			const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
			const matchesDivisi = divisiFilter === 'all' || item.Divisi === divisiFilter;
			const matchesJenis = jenisFilter === 'all' || item.Jenis === jenisFilter;
			
			return matchesSearch && matchesStatus && matchesDivisi && matchesJenis;
		});
		
		totalItems = filteredRawMaterials.length;
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

	function formatCurrency(value) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0
		}).format(value);
	}

	// Reactive statements
	$: {
		if (searchTerm !== undefined || statusFilter !== undefined || divisiFilter !== undefined || jenisFilter !== undefined) {
			handleSearch();
		}
	}

	$: totalPages = Math.ceil(totalItems / itemsPerPage);
	$: startItem = (currentPage - 1) * itemsPerPage + 1;
	$: endItem = Math.min(currentPage * itemsPerPage, totalItems);
</script>

<svelte:head>
	<title>Raw Materials - Inventory Management</title>
</svelte:head>

<div class="p-6 max-w-full mx-auto">
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Raw Materials</h1>
			<p class="text-gray-600">Kelola bahan baku untuk produksi</p>
		</div>
		<div class="flex gap-2">
			<button
				class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
				on:click={openAddForm}
			>
				+ Tambah Raw Material
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
			<div class="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
				<div class="p-6">
					<div class="flex justify-between items-center mb-6">
						<h2 class="text-xl font-bold text-gray-900">Tambah Raw Material</h2>
						<button
							on:click={closeAddForm}
							class="text-gray-400 hover:text-gray-600 focus:outline-none"
						>
							✕
						</button>
					</div>
					
					<form on:submit|preventDefault={saveRawMaterial}>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
							<!-- Debug Form Data -->
							<div class="md:col-span-3 mb-4 p-4 bg-gray-50 rounded-md">
								<h4 class="text-sm font-medium text-gray-700 mb-2">Debug Form Data:</h4>
								<pre class="text-xs text-gray-600">{JSON.stringify(formData, null, 2)}</pre>
							</div>
							
							<!-- Basic Information -->
							<div class="md:col-span-3">
								<h3 class="text-lg font-semibold text-gray-900 mb-4">Informasi Dasar</h3>
							</div>
							
							<div>
								<label for="kode" class="block text-sm font-medium text-gray-700 mb-1">Kode *</label>
								<input
									id="kode"
									type="text"
									bind:value={formData.kode}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode"
								/>
							</div>
							
							<div>
								<label for="nama" class="block text-sm font-medium text-gray-700 mb-1">Nama *</label>
								<input
									id="nama"
									type="text"
									bind:value={formData.nama}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama"
								/>
							</div>
							
							<div>
								<label for="kemasan" class="block text-sm font-medium text-gray-700 mb-1">Kemasan</label>
								<input
									id="kemasan"
									type="text"
									bind:value={formData.kemasan}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Contoh: Drum 200L"
								/>
							</div>
							
							<div>
								<label for="satuan" class="block text-sm font-medium text-gray-700 mb-1">Satuan *</label>
								<select
									id="satuan"
									bind:value={formData.satuan}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Pilih Satuan</option>
									{#each satuanOptions as option}
										<option value={option}>{option}</option>
									{/each}
								</select>
							</div>
							
							<div>
								<label for="Divisi" class="block text-sm font-medium text-gray-700 mb-1">Divisi *</label>
								<select
									id="Divisi"
									bind:value={formData.Divisi}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Pilih Divisi</option>
									{#each divisiOptions as option}
										<option value={option}>{option}</option>
									{/each}
								</select>
							</div>
							
							<div>
								<label for="Group" class="block text-sm font-medium text-gray-700 mb-1">Group *</label>
								<input
									id="Group"
									type="text"
									bind:value={formData.Group}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan group"
								/>
							</div>
							
							<div>
								<label for="Jenis" class="block text-sm font-medium text-gray-700 mb-1">Jenis *</label>
								<select
									id="Jenis"
									bind:value={formData.Jenis}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Pilih Jenis</option>
									{#each jenisOptions as option}
										<option value={option}>{option}</option>
									{/each}
								</select>
							</div>
							
							<div>
								<label for="stok" class="block text-sm font-medium text-gray-700 mb-1">Satuan Stok *</label>
								<select
									id="stok"
									bind:value={formData.stok}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Pilih Satuan Stok</option>
									<option value="Stok">Stok</option>
									<option value="Non Stok">Non Stok</option>
								</select>
							</div>
							
							<div>
								<label for="kategori" class="block text-sm font-medium text-gray-700 mb-1">Kategori *</label>
								<select
									id="kategori"
									bind:value={formData.kategori}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="Active">Active</option>
									<option value="Not Active">Not Active</option>
								</select>
								<!-- Debug info -->
								<div class="text-xs text-gray-500 mt-1">Current value: {formData.kategori}</div>
							</div>
							
							<!-- Pricing Information -->
							<div class="md:col-span-3 mt-6">
								<h3 class="text-lg font-semibold text-gray-900 mb-4">Informasi Harga</h3>
							</div>
							
							<div>
								<label for="harga_beli" class="block text-sm font-medium text-gray-700 mb-1">Harga Beli</label>
								<input
									id="harga_beli"
									type="number"
									bind:value={formData.harga_beli}
									min="0"
									step="0.01"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="0"
								/>
							</div>
							
							<div>
								<label for="harga_lama" class="block text-sm font-medium text-gray-700 mb-1">Harga Lama</label>
								<input
									id="harga_lama"
									type="number"
									bind:value={formData.harga_lama}
									min="0"
									step="0.01"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="0"
								/>
							</div>
							
							<div>
								<label for="hp_awal" class="block text-sm font-medium text-gray-700 mb-1">HP Awal</label>
								<input
									id="hp_awal"
									type="number"
									bind:value={formData.hp_awal}
									min="0"
									step="0.01"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="0"
								/>
							</div>
							
							<!-- Stock Information -->
							<div class="md:col-span-3 mt-6">
								<h3 class="text-lg font-semibold text-gray-900 mb-4">Informasi Stok</h3>
							</div>
							
							<div>
								<label for="sisa_stok" class="block text-sm font-medium text-gray-700 mb-1">Sisa Stok *</label>
								<input
									id="sisa_stok"
									type="number"
									bind:value={formData.sisa_stok}
									required
									min="0"
									step="0.01"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="0"
								/>
							</div>
							
							<div>
								<label for="sisa_po" class="block text-sm font-medium text-gray-700 mb-1">Sisa PO</label>
								<input
									id="sisa_po"
									type="number"
									bind:value={formData.sisa_po}
									min="0"
									step="0.01"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="0"
								/>
							</div>
							
							<div>
								<label for="minimum_stok" class="block text-sm font-medium text-gray-700 mb-1">Minimum Stok *</label>
								<input
									id="minimum_stok"
									type="number"
									bind:value={formData.minimum_stok}
									required
									min="0"
									step="0.01"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="0"
								/>
							</div>
							
							<div>
								<label for="in_liter" class="block text-sm font-medium text-gray-700 mb-1">In Liter</label>
								<input
									id="in_liter"
									type="number"
									bind:value={formData.in_liter}
									min="0"
									step="0.01"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="0"
								/>
							</div>
							
							<div>
								<label for="in_kg" class="block text-sm font-medium text-gray-700 mb-1">In KG</label>
								<input
									id="in_kg"
									type="number"
									bind:value={formData.in_kg}
									min="0"
									step="0.01"
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
					placeholder="Cari berdasarkan kode, nama, kemasan, atau divisi..."
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
			<div class="min-w-40">
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
			<div class="min-w-40">
				<label for="divisi-filter" class="block text-sm font-medium text-gray-700 mb-1">Divisi</label>
				<select
					id="divisi-filter"
					bind:value={divisiFilter}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="all">Semua Divisi</option>
					{#each divisiOptions as option}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</div>
			<div class="min-w-40">
				<label for="jenis-filter" class="block text-sm font-medium text-gray-700 mb-1">Jenis</label>
				<select
					id="jenis-filter"
					bind:value={jenisFilter}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="all">Semua Jenis</option>
					{#each jenisOptions as option}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Total Raw Materials</div>
			<div class="text-2xl font-bold text-gray-900">{rawMaterials.length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Ready</div>
			<div class="text-2xl font-bold text-green-600">{rawMaterials.filter(item => item.status === 'Ready').length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Low Stock</div>
			<div class="text-2xl font-bold text-yellow-600">{rawMaterials.filter(item => item.status === 'Low Stock').length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Out of Stock</div>
			<div class="text-2xl font-bold text-red-600">{rawMaterials.filter(item => item.status === 'Out of Stock').length}</div>
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
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kemasan</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Satuan</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Divisi</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jenis</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Satuan Stok</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga Beli</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga Lama</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HP Awal</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sisa Stok</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sisa PO</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Stok</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In Liter</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In KG</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each paginatedItems as item}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.kode}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.kemasan}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.satuan}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.Divisi}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.Group}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.Jenis}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.stok}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm">
									<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {item.kategori === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
										{item.kategori}
									</span>
								</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(item.harga_beli || 0)}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(item.harga_lama || 0)}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(item.hp_awal || 0)}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.sisa_stok || 0}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.sisa_po || 0}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.minimum_stok || 0}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.in_liter || 0}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.in_kg || 0}</td>
								<td class="px-4 py-4 whitespace-nowrap">
									<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {
										item.status === 'Ready' ? 'bg-green-100 text-green-800' :
										item.status === 'Low Stock' ? 'bg-yellow-100 text-yellow-800' :
										item.status === 'Out of Stock' ? 'bg-red-100 text-red-800' :
										'bg-gray-100 text-gray-800'
									}">
										{item.status}
									</span>
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
