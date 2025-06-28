<script>
	import { stockStore, stockStats } from '$lib/stores/inventory.js';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let form = {
		name: '',
		parent_category: '',
		sub_category: '',
		description: '',
		stockIn: 0,
		status: 'Ready',
		// Pengaturan batas stok
		useCustomThresholds: false,
		readyThreshold: 5,
		lowStockThreshold: 1
	};

	let parentCategories = [];
	let subCategories = [];
	let filteredSubCategories = [];
	let identitasBarangList = [];
	let loadingCategories = false;
	let toast = { show: false, message: '', type: 'success' };
	let errors = {};

	// Variabel untuk dropdown auto-complete
	let showDropdown = false;
	let filteredBarangList = [];
	let showNotification = false;
	let notificationMessage = '';
	let selectedIdentitasId = '';

	const statusOptions = [
		{ value: 'Ready', label: 'Ready' },
		{ value: 'Low Stock', label: 'Low Stock' },
		{ value: 'Out of Stock', label: 'Out of Stock' }
	];

	// Reactive statement untuk filtering barang berdasarkan input
	$: filteredBarangList = form.name
		? identitasBarangList.filter((b) =>
				b.nama_barang_lengkap.toLowerCase().includes(form.name.toLowerCase())
			)
		: identitasBarangList;

	// Reactive statement untuk notifikasi jika barang tidak ditemukan
	$: {
		if (form.name && form.name.trim()) {
			const barangExists = identitasBarangList.some(
				(b) => b.nama_barang_lengkap.toLowerCase() === form.name.toLowerCase()
			);
			const parentCatExists = form.parent_category
				? parentCategories.some((cat) => cat.parent_category === form.parent_category)
				: true; // Allow empty parent category
			const subCatExists = form.sub_category
				? subCategories.some((cat) => cat.nama_sub === form.sub_category)
				: true; // Allow empty sub category

			if (!barangExists || !parentCatExists || !subCatExists) {
				showNotification = true;
				notificationMessage = !barangExists
					? 'Nama barang tidak ditemukan di daftar.'
					: 'Kategori atau subkategori tidak tersedia.';
			} else {
				showNotification = false;
			}
		} else {
			showNotification = false;
		}
	}

	// Reactive statement untuk auto-set status berdasarkan stok
	$: {
		if (form.stockIn >= 0) {
			if (form.stockIn === 0) {
				form.status = 'Out of Stock';
			} else if (form.useCustomThresholds) {
				// Gunakan threshold custom
				if (form.stockIn >= form.readyThreshold) {
					form.status = 'Ready';
				} else if (form.stockIn >= form.lowStockThreshold) {
					form.status = 'Low Stock';
				} else {
					form.status = 'Out of Stock';
				}
			} else {
				// Gunakan threshold default
				if (form.stockIn >= 5) {
					form.status = 'Ready';
				} else if (form.stockIn >= 1) {
					form.status = 'Low Stock';
				} else {
					form.status = 'Out of Stock';
				}
			}
		}
	}

	// Load parent categories, subcategories, and identitas barang from Directus
	async function loadCategories() {
		loadingCategories = true;
		try {
			// Fetch parent categories
			const parentResponse = await fetch(
				'https://directus.eltamaprimaindo.com/items/parent_category?fields=id,parent_category',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);
			if (!parentResponse.ok) throw new Error('Gagal mengambil daftar kategori');

			// Fetch subcategories
			const subResponse = await fetch(
				'https://directus.eltamaprimaindo.com/items/sub_category?fields=id,nama_sub,parent_category',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);
			if (!subResponse.ok) throw new Error('Gagal mengambil daftar subkategori');

			// Fetch identitas barang
			const identitasResponse = await fetch(
				'https://directus.eltamaprimaindo.com/items/identitas_barang?fields=id,nama_barang_lengkap,sub_category,parent_category&limit=-1',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);
			if (!identitasResponse.ok) throw new Error('Gagal mengambil data identitas barang');

			const parentData = await parentResponse.json();
			const subData = await subResponse.json();
			const identitasData = await identitasResponse.json();

			parentCategories = parentData.data;
			subCategories = subData.data;
			identitasBarangList = identitasData.data || [];

			updateFilteredSubCategories();
			debugCategoryData(); // Tambahkan debug di sini
		} catch (err) {
			console.error('Error loading categories:', err);
			toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
			setTimeout(() => (toast.show = false), 3000);
		} finally {
			loadingCategories = false;
		}
	}

	// Update filtered subcategories based on selected parent category
	function updateFilteredSubCategories() {
		if (form.parent_category) {
			filteredSubCategories = subCategories.filter(
				(sub) => sub.parent_category === form.parent_category
			);
			// Reset subcategory if current selection is invalid
			if (!filteredSubCategories.some((sub) => sub.id === form.sub_category)) {
				form.sub_category = filteredSubCategories.length > 0 ? filteredSubCategories[0].id : '';
			}
		} else {
			filteredSubCategories = [];
			form.sub_category = '';
		}
	}

	// Reactive update for subcategories when parent category changes
	$: if (form.parent_category) {
		updateFilteredSubCategories();
	}

	// Fungsi helper untuk mencari parent category
	function findParentCategoryById(parentCategoryId) {
		if (!parentCategoryId) return null;
		// Cari berdasarkan ID dengan loose equality
		let parentCat = parentCategories.find((cat) => cat.id == parentCategoryId);
		// Jika tidak ditemukan berdasarkan ID, coba cari berdasarkan nama
		if (!parentCat) {
			parentCat = parentCategories.find((cat) => cat.parent_category == parentCategoryId);
		}
		return parentCat;
	}

	// Fungsi helper untuk mencari sub category
	function findSubCategoryById(subCategoryId) {
		if (!subCategoryId) return null;
		// Cari berdasarkan ID dengan loose equality
		let subCat = subCategories.find((cat) => cat.id == subCategoryId);
		// Jika tidak ditemukan berdasarkan ID, coba cari berdasarkan nama
		if (!subCat) {
			subCat = subCategories.find((cat) => cat.nama_sub == subCategoryId);
		}
		return subCat;
	}

	// Fungsi untuk memilih barang dari dropdown
	function selectBarang(barang) {
		selectedIdentitasId = barang.id;
		form.identitas_id = barang.id;
		form.name = barang.nama_barang_lengkap;
		// Gunakan helper untuk parent category
		const parentCat = findParentCategoryById(barang.parent_category);
		if (parentCat) {
			form.parent_category = parentCat.parent_category;
		} else {
			form.parent_category = '';
			console.warn('Parent category tidak ditemukan untuk ID:', barang.parent_category);
		}
		// Gunakan helper untuk sub category
		const subCat = findSubCategoryById(barang.sub_category);
		if (subCat) {
			form.sub_category = subCat.nama_sub;
		} else {
			form.sub_category = '';
			console.warn('Sub category tidak ditemukan untuk ID:', barang.sub_category);
		}
		showDropdown = false;
		// Log untuk debugging
		console.log('Barang dipilih:', {
			barang: barang,
			parentCat: parentCat,
			subCat: subCat,
			finalForm: {
				parent_category: form.parent_category,
				sub_category: form.sub_category
			}
		});
	}

	// Tambahan: fungsi debug data kategori
	function debugCategoryData() {
		console.log('=== DEBUG CATEGORY DATA ===');
		console.log('Parent Categories:', parentCategories);
		console.log('Sub Categories:', subCategories);
		console.log('Identitas Barang List:', identitasBarangList);
		console.log('=========================');
	}

	// Fungsi untuk menutup notifikasi
	function dismissNotification() {
		showNotification = false;
	}

	onMount(loadCategories);

	function validateForm() {
		errors = {};
		if (!form.name || form.name.trim() === '') errors.name = 'Nama barang wajib diisi';
		if (!form.description) errors.description = 'Deskripsi wajib diisi';
		if (!form.stockIn || form.stockIn < 0) errors.stockIn = 'Stok harus 0 atau lebih';
		if (!form.status) errors.status = 'Status wajib dipilih';

		// Validasi kategori dan sub kategori hanya jika diisi melalui auto-complete
		if (selectedIdentitasId) {
			if (!form.parent_category) errors.parent_category = 'Kategori wajib diisi';
			// Sub kategori tidak wajib karena tidak semua barang memiliki sub kategori
			// if (!form.sub_category) errors.sub_category = 'Subkategori wajib diisi';
		}

		// Validasi threshold jika menggunakan custom
		if (form.useCustomThresholds) {
			if (form.readyThreshold <= form.lowStockThreshold) {
				errors.readyThreshold = 'Batas Ready harus lebih besar dari batas Low Stock';
			}
			if (form.lowStockThreshold < 1) {
				errors.lowStockThreshold = 'Batas Low Stock minimal 1';
			}
		}

		return Object.keys(errors).length === 0;
	}

	async function handleSubmit() {
		if (!validateForm()) {
			toast = { show: true, message: 'Lengkapi semua field yang wajib diisi', type: 'error' };
			setTimeout(() => (toast.show = false), 3000);
			return;
		}

		try {
			// Convert nama kategori/sub kategori ke ID untuk disimpan
			const parentCatId =
				parentCategories.find((cat) => cat.parent_category === form.parent_category)?.id || null;
			const subCatId = subCategories.find((cat) => cat.nama_sub === form.sub_category)?.id || null;

			const payload = {
				Nama: form.name,
				Deskripsi: form.description || 'Tidak ada deskripsi',
				StokIn: parseInt(form.stockIn) || 0,
				Status: form.status,
				parent_category: parentCatId,
				sub_category: subCatId,
				useCustomThresholds: form.useCustomThresholds,
				readyThreshold: form.readyThreshold,
				lowStockThreshold: form.lowStockThreshold
			};

			console.log('Payload sent:', payload);

			// Save to Directus
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
				throw new Error(`Gagal menyimpan ke Directus: ${errorText}`);
			}

			const newItemData = await response.json();

			// Add to stockStore
			const newItem = {
				id: newItemData.data.id,
				name: form.name,
				description: form.description,
				stockIn: form.stockIn,
				status: form.status,
				parent_category: form.parent_category || 'Unknown',
				sub_category: form.sub_category || 'Unknown'
			};

			stockStore.update((current) => {
				const updatedItems = [...current.items, newItem];
				return {
					...current,
					items: updatedItems,
					originalItems: updatedItems
				};
			});

			// Update stockStats
			stockStats.update((stats) => ({
				totalItems: stats.totalItems + 1,
				readyItems: form.status === 'Ready' ? stats.readyItems + 1 : stats.readyItems,
				lowStockItems: form.status === 'Low Stock' ? stats.lowStockItems + 1 : stats.lowStockItems,
				outOfStockItems:
					form.status === 'Out of Stock' ? stats.outOfStockItems + 1 : stats.outOfStockItems
			}));

			// Show success toast and redirect
			toast = { show: true, message: 'Barang berhasil ditambahkan!', type: 'success' };
			setTimeout(() => {
				toast.show = false;
				goto('/inventory');
			}, 2000);
		} catch (err) {
			toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
			setTimeout(() => (toast.show = false), 3000);
			console.error('Error details:', err);
		}
	}

	function resetForm() {
		form = {
			name: '',
			parent_category: parentCategories.length > 0 ? parentCategories[0].id : '',
			sub_category: '',
			description: '',
			stockIn: 0,
			status: 'Ready',
			useCustomThresholds: false,
			readyThreshold: 5,
			lowStockThreshold: 1
		};
		errors = {};
	}

	function goBack() {
		goto('/inventory');
	}
</script>

<div class="space-y-6 p-6 bg-white-100 min-h-screen">
	<h1 class="text-2xl font-bold text-gray-900">Tambah Data Barang</h1>

	<!-- Toast Notification -->
	{#if toast.show}
		<div
			class="fixed top-4 right-4 p-4 rounded-lg shadow-lg transition-opacity duration-300"
			class:bg-green-500={toast.type === 'success'}
			class:bg-red-500={toast.type === 'error'}
			class:text-white={true}
			class:opacity-100={toast.show}
			class:opacity-0={!toast.show}
		>
			{toast.message}
		</div>
	{/if}

	<form on:submit|preventDefault={handleSubmit} class="bg-white rounded-lg shadow p-6 space-y-5">
		<!-- Notifikasi untuk barang tidak ditemukan -->
		{#if showNotification}
			<div
				class="flex items-start gap-4 p-4 rounded-2xl shadow-md bg-yellow-100 border border-yellow-300 text-yellow-800 mb-4 animate-fade-in"
			>
				<!-- Icon -->
				<div class="mt-1">
					<svg class="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						></path>
					</svg>
				</div>

				<!-- Message -->
				<div class="flex-1 text-sm">
					<p class="mb-2 font-medium">{notificationMessage}</p>
					<p class="text-xs">
						Anda dapat menambahkan barang baru ini ke sistem atau pilih dari daftar yang tersedia.
					</p>
				</div>

				<!-- Close button -->
				<button
					type="button"
					on:click={dismissNotification}
					class="text-yellow-600 hover:text-yellow-800"
					aria-label="Tutup notifikasi"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
				</button>
			</div>
		{/if}

		<!-- Nama Barang dengan Auto-complete -->
		<div class="relative">
			<label for="nama-barang" class="block text-sm font-medium text-gray-700 mb-1.5"
				>Nama Barang</label
			>
			<input
				id="nama-barang"
				type="text"
				bind:value={form.name}
				class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
				placeholder="Cari atau masukkan nama barang..."
				on:input={() => {
					showDropdown = true;
					selectedIdentitasId = '';
				}}
				on:focus={() => (showDropdown = true)}
				on:blur={() => setTimeout(() => (showDropdown = false), 200)}
			/>
			{#if showDropdown && filteredBarangList.length > 0}
				<ul
					class="absolute z-20 bg-white border border-gray-200 w-full max-h-48 overflow-y-auto rounded-lg shadow-lg mt-1"
					role="listbox"
				>
					{#each filteredBarangList as barang}
						<li
							class="px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 cursor-pointer transition-colors duration-150"
							on:mousedown={() => selectBarang(barang)}
						>
							{barang.nama_barang_lengkap}
						</li>
					{/each}
				</ul>
			{/if}
			{#if errors.name}
				<p class="text-red-500 text-xs mt-1.5">{errors.name}</p>
			{/if}
		</div>

		<!-- Kategori dan Sub Kategori -->
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="kategori" class="block text-sm font-medium text-gray-700 mb-1.5">Kategori</label
				>
				<input
					id="kategori"
					type="text"
					class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
					bind:value={form.parent_category}
					placeholder={form.parent_category
						? form.parent_category
						: 'Kategori akan terisi otomatis'}
					readonly
				/>
				{#if errors.parent_category}
					<p class="text-red-500 text-xs mt-1.5">{errors.parent_category}</p>
				{/if}
			</div>
			<div>
				<label for="sub-kategori" class="block text-sm font-medium text-gray-700 mb-1.5"
					>Sub Kategori</label
				>
				<input
					id="sub-kategori"
					type="text"
					class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
					bind:value={form.sub_category}
					placeholder={form.sub_category
						? form.sub_category
						: 'Sub kategori akan terisi otomatis (jika tersedia)'}
					readonly
				/>
				{#if errors.sub_category}
					<p class="text-red-500 text-xs mt-1.5">{errors.sub_category}</p>
				{/if}
			</div>
		</div>

		<!-- Deskripsi -->
		<div>
			<label for="deskripsi" class="block text-sm font-medium text-gray-700 mb-1.5">Deskripsi</label
			>
			<textarea
				id="deskripsi"
				bind:value={form.description}
				class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
				rows="4"
				placeholder="Masukkan deskripsi barang"
			></textarea>
			{#if errors.description}
				<p class="text-red-500 text-xs mt-1.5">{errors.description}</p>
			{/if}
		</div>

		<!-- Stok -->
		<div>
			<label for="stok" class="block text-sm font-medium text-gray-700 mb-1.5">Stok</label>
			<input
				id="stok"
				type="number"
				bind:value={form.stockIn}
				min="0"
				class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
				placeholder="Masukkan jumlah stok"
			/>
			{#if form.useCustomThresholds}
				<p class="text-xs text-gray-500 mt-1">
					Pengaturan khusus: Ready (≥{form.readyThreshold}), Low Stock ({form.lowStockThreshold}-{form.readyThreshold -
						1}), Out of Stock (0)
				</p>
			{:else}
				<p class="text-xs text-gray-500 mt-1">
					Pengaturan default: Ready (≥5), Low Stock (1-4), Out of Stock (0)
				</p>
			{/if}
			{#if errors.stockIn}
				<p class="text-red-500 text-xs mt-1.5">{errors.stockIn}</p>
			{/if}
		</div>

		<!-- Status -->
		<div>
			<label for="status" class="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
			<div class="mt-1 p-2 border rounded-md bg-gray-50">
				<span class="text-sm font-medium">
					{#if form.status === 'Ready'}
						<span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Ready</span>
					{:else if form.status === 'Low Stock'}
						<span class="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800"
							>Low Stock</span
						>
					{:else if form.status === 'Out of Stock'}
						<span class="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">Out of Stock</span>
					{/if}
				</span>
			</div>
			<p class="text-xs text-gray-500 mt-1">
				Status akan diatur otomatis berdasarkan jumlah stok dan pengaturan batas
			</p>
			{#if errors.status}
				<p class="text-red-500 text-xs mt-1.5">{errors.status}</p>
			{/if}
		</div>

		<!-- Pengaturan Batas Stok -->
		<div class="border-t pt-4">
			<div class="flex items-center mb-3">
				<input
					id="use-custom-thresholds"
					type="checkbox"
					bind:checked={form.useCustomThresholds}
					class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
				/>
				<label for="use-custom-thresholds" class="ml-2 text-sm font-medium text-gray-700">
					Gunakan Pengaturan Batas Khusus
				</label>
			</div>

			{#if form.useCustomThresholds}
				<div class="space-y-3 ml-6">
					<!-- Batas Ready -->
					<div>
						<label for="ready-threshold" class="block text-sm font-medium text-gray-700">
							Batas Minimum untuk Status "Ready"
						</label>
						<input
							id="ready-threshold"
							type="number"
							bind:value={form.readyThreshold}
							class="mt-1 block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
							placeholder="5"
							min="1"
						/>
						{#if errors.readyThreshold}
							<p class="text-red-500 text-xs mt-1">{errors.readyThreshold}</p>
						{/if}
					</div>

					<!-- Batas Low Stock -->
					<div>
						<label for="low-threshold" class="block text-sm font-medium text-gray-700">
							Batas Minimum untuk Status "Low Stock"
						</label>
						<input
							id="low-threshold"
							type="number"
							bind:value={form.lowStockThreshold}
							class="mt-1 block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
							placeholder="1"
							min="1"
						/>
						{#if errors.lowStockThreshold}
							<p class="text-red-500 text-xs mt-1">{errors.lowStockThreshold}</p>
						{/if}
					</div>

					<div class="text-xs text-gray-500 p-2 bg-blue-50 rounded">
						<p><strong>Aturan:</strong></p>
						<p>• Ready: Stok ≥ {form.readyThreshold}</p>
						<p>• Low Stock: Stok {form.lowStockThreshold} - {form.readyThreshold - 1}</p>
						<p>• Out of Stock: Stok = 0</p>
					</div>
				</div>
			{:else}
				<div class="text-xs text-gray-500 p-2 bg-gray-50 rounded ml-6">
					<p><strong>Pengaturan Default:</strong></p>
					<p>• Ready: Stok ≥ 5</p>
					<p>• Low Stock: Stok 1 - 4</p>
					<p>• Out of Stock: Stok = 0</p>
				</div>
			{/if}
		</div>

		<!-- Tombol Aksi -->
		<div class="flex justify-end space-x-3 mt-6">
			<button
				type="button"
				on:click={goBack}
				class="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200 shadow-sm"
			>
				Kembali
			</button>
			<button
				type="button"
				on:click={resetForm}
				class="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200 shadow-sm"
			>
				Reset
			</button>
			<button
				type="submit"
				class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors duration-200 shadow-sm"
			>
				Simpan
			</button>
		</div>
	</form>
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
</style>
