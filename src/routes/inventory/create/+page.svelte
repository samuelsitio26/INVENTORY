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
		status: 'Ready'
	};

	let parentCategories = [];
	let subCategories = [];
	let filteredSubCategories = [];
	let loadingCategories = false;
	let toast = { show: false, message: '', type: 'success' };
	let errors = {};

	const statusOptions = [
		{ value: 'Ready', label: 'Ready' },
		{ value: 'Low Stock', label: 'Low Stock' },
		{ value: 'Out of Stock', label: 'Out of Stock' }
	];

	// Load parent categories and subcategories from Directus
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

			const parentData = await parentResponse.json();
			const subData = await subResponse.json();

			parentCategories = parentData.data;
			subCategories = subData.data;
			updateFilteredSubCategories();
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

	onMount(loadCategories);

	function validateForm() {
		errors = {};
		if (!form.name || form.name.trim() === '') errors.name = 'Nama barang wajib diisi';
		if (!form.parent_category) errors.parent_category = 'Kategori wajib dipilih';
		if (!form.sub_category) errors.sub_category = 'Subkategori wajib dipilih';
		if (!form.description) errors.description = 'Deskripsi wajib diisi';
		if (!form.stockIn || form.stockIn < 0) errors.stockIn = 'Stok harus 0 atau lebih';
		if (!form.status) errors.status = 'Status wajib dipilih';
		return Object.keys(errors).length === 0;
	}

	async function handleSubmit() {
		if (!validateForm()) {
			toast = { show: true, message: 'Lengkapi semua field yang wajib diisi', type: 'error' };
			setTimeout(() => (toast.show = false), 3000);
			return;
		}

		try {
			const payload = {
				Nama: form.name,
				Deskripsi: form.description || 'Tidak ada deskripsi',
				StokIn: parseInt(form.stockIn) || 0,
				Status: form.status,
				parent_category: form.parent_category,
				sub_category: form.sub_category
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
				parent_category:
					parentCategories.find((cat) => cat.id === form.parent_category)?.parent_category ||
					'Unknown',
				sub_category:
					subCategories.find((cat) => cat.id === form.sub_category)?.nama_sub || 'Unknown'
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
			status: 'Ready'
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
		<!-- Nama Barang -->
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-1.5">Nama Barang</label>
			<input
				type="text"
				bind:value={form.name}
				class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
				placeholder="Masukkan nama barang"
			/>
			{#if errors.name}
				<p class="text-red-500 text-xs mt-1.5">{errors.name}</p>
			{/if}
		</div>

		<!-- Kategori dan Sub Kategori -->
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Kategori</label>
				<select
					bind:value={form.parent_category}
					class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
					disabled={loadingCategories}
				>
					{#if loadingCategories}
						<option disabled>Pengambilan data kategori...</option>
					{:else if parentCategories.length === 0}
						<option disabled>Tidak ada kategori tersedia</option>
					{:else}
						<option value="">Pilih kategori</option>
						{#each parentCategories as category}
							<option value={category.id}>{category.parent_category}</option>
						{/each}
					{/if}
				</select>
				{#if errors.parent_category}
					<p class="text-red-500 text-xs mt-1.5">{errors.parent_category}</p>
				{/if}
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Sub Kategori</label>
				<select
					bind:value={form.sub_category}
					class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
					disabled={loadingCategories || !form.parent_category}
				>
					{#if loadingCategories}
						<option disabled>Pengambilan data subkategori...</option>
					{:else if filteredSubCategories.length === 0}
						<option disabled>Pilih kategori terlebih dahulu</option>
					{:else}
						<option value="">Pilih subkategori</option>
						{#each filteredSubCategories as sub}
							<option value={sub.id}>{sub.nama_sub}</option>
						{/each}
					{/if}
				</select>
				{#if errors.sub_category}
					<p class="text-red-500 text-xs mt-1.5">{errors.sub_category}</p>
				{/if}
			</div>
		</div>

		<!-- Deskripsi -->
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-1.5">Deskripsi</label>
			<textarea
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
			<label class="block text-sm font-medium text-gray-700 mb-1.5">Stok</label>
			<input
				type="number"
				bind:value={form.stockIn}
				min="0"
				class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
				placeholder="Masukkan jumlah stok"
			/>
			{#if errors.stockIn}
				<p class="text-red-500 text-xs mt-1.5">{errors.stockIn}</p>
			{/if}
		</div>

		<!-- Status -->
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
			<select
				bind:value={form.status}
				class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
			>
				{#each statusOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
			{#if errors.status}
				<p class="text-red-500 text-xs mt-1.5">{errors.status}</p>
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
