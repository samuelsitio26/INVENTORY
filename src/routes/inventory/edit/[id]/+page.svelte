<script>
	import { stockStore, stockStats } from '$lib/stores/inventory.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let form = {
		name: '',
		category: '',
		stockIn: 0,
		stockOut: '-', // Default ke '-' jika tidak diisi
		location: '',
		pic: '',
		status: 'Ready'
	};

	let categories = [];
	let loadingCategories = false;
	let initialLoad = true;
	let toast = { show: false, message: '', type: 'success' }; // State untuk toast notification

	$: id = Number($page.params.id);

	// Load categories from Parent Category
	async function loadCategories() {
		loadingCategories = true;
		try {
			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/parent_category?fields=id,parent_category',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);
			if (!response.ok) throw new Error('Gagal mengambil daftar kategori');
			const data = await response.json();
			categories = data.data.map((item) => ({
				id: item.id,
				parent_category: item.parent_category
			}));
		} catch (err) {
			console.error('Error loading categories:', err);
		} finally {
			loadingCategories = false;
		}
	}

	// Load initial item data
	async function loadItemData() {
		await loadCategories();
		const item = $stockStore.items.find((item) => item.id === id);
		if (item) {
			form = {
				name: item.name,
				category: item.category
					? categories.find((cat) => cat.parent_category === item.category)?.id ||
						(categories.length > 0 ? categories[0].id : '')
					: categories.length > 0
						? categories[0].id
						: '',
				stockIn: item.stockIn,
				stockOut: item.stockOut === '-' || !item.stockOut ? '-' : item.stockOut,
				location: item.location,
				pic: item.pic,
				status: item.status
			};
		}
		initialLoad = false;
	}

	onMount(loadItemData);

	async function handleSubmit() {
		try {
			// Validate form data
			if (!form.name || !form.location || !form.pic || !form.category) {
				throw new Error('Semua field wajib diisi, termasuk nama, lokasi, PIC, dan kategori');
			}

			// Prepare payload for Directus
			const payload = {
				name: form.name,
				StokIn: parseInt(form.stockIn) || 0,
				StokOut: form.stockOut === '-' ? null : parseInt(form.stockOut) || 0,
				Lokasi: form.location,
				PIC: form.pic,
				Status: form.status === 'Ready' ? '•' : form.status === 'Low Stock' ? '○' : 'x',
				nama_kategori: form.category
			};

			// Send data to Directus
			const response = await fetch(`https://directus.eltamaprimaindo.com/items/Barang/${id}`, {
				method: 'PATCH',
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Gagal memperbarui di Directus: ${errorText}`);
			}

			// Update local store
			stockStore.update((current) => {
				const updatedItems = current.items.map((item) =>
					item.id === id
						? {
								...item,
								...form,
								category:
									categories.find((cat) => cat.id === form.category)?.parent_category ||
									form.category
							}
						: item
				);
				return {
					...current,
					items: updatedItems,
					originalItems: updatedItems
				};
			});

			// Update statistics
			stockStats.update((stats) => ({
				totalItems: $stockStore.items.length,
				readyItems: $stockStore.items.filter((item) => item.status === 'Ready').length,
				lowStockItems: $stockStore.items.filter((item) => item.status === 'Low Stock').length,
				outOfStockItems: $stockStore.items.filter((item) => item.status === 'Out of Stock').length
			}));

			// Tampilkan toast sukses
			toast = { show: true, message: 'Data berhasil diperbarui!', type: 'success' };
			// Redirect setelah 2 detik
			setTimeout(() => {
				toast.show = false;
				goto('/inventory');
			}, 2000);
		} catch (err) {
			// Tampilkan toast error
			toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
			// Sembunyikan toast setelah 3 detik
			setTimeout(() => {
				toast.show = false;
			}, 3000);
			console.error('Error details:', err);
		}
	}

	function resetForm() {
		const item = $stockStore.items.find((item) => item.id === id);
		if (item) {
			form = {
				name: item.name,
				category: item.category
					? categories.find((cat) => cat.parent_category === item.category)?.id ||
						(categories.length > 0 ? categories[0].id : '')
					: categories.length > 0
						? categories[0].id
						: '',
				stockIn: item.stockIn,
				stockOut: item.stockOut === '-' || !item.stockOut ? '-' : item.stockOut,
				location: item.location,
				pic: item.pic,
				status: item.status
			};
		}
	}

	function goBack() {
		goto('/inventory');
	}
</script>

<div class="space-y-6 p-6 bg-gray-100 min-h-screen">
	<h1 class="text-2xl font-bold text-gray-900">Edit Data Barang</h1>

	<!-- Toast Notification -->
	{#if toast.show}
		<div
			class="fixed top-4 right-4 p-4 rounded-lg shadow-lg transition-all duration-300"
			class:bg-green-500={toast.type === 'success'}
			class:bg-red-500={toast.type === 'error'}
			class:text-white={true}
		>
			{toast.message}
		</div>
	{/if}

	<form on:submit|preventDefault={handleSubmit} class="bg-white rounded-lg shadow p-6 space-y-4">
		<div>
			<label class="block text-sm font-medium text-gray-700">Nama Barang</label>
			<input
				type="text"
				bind:value={form.name}
				required
				class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>

		<div>
			<label class="block text-sm font-medium text-gray-700">Kategori</label>
			<select
				bind:value={form.category}
				class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
				disabled={loadingCategories}
			>
				{#if loadingCategories}
					<option disabled>Pengambilan data kategori...</option>
				{:else if categories.length === 0}
					<option disabled>Tidak ada kategori tersedia</option>
				{:else}
					{#each categories as category}
						<option value={category.id}>{category.parent_category}</option>
					{/each}
				{/if}
			</select>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label class="block text-sm font-medium text-gray-700">Stok Masuk</label>
				<input
					type="number"
					bind:value={form.stockIn}
					min="0"
					required
					class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700">Stok Keluar (Opsional)</label>
				<input
					type="number"
					bind:value={form.stockOut}
					placeholder="-"
					class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
		</div>

		<div>
			<label class="block text-sm font-medium text-gray-700">Lokasi</label>
			<input
				type="text"
				bind:value={form.location}
				required
				class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>

		<div>
			<label class="block text-sm font-medium text-gray-700">PIC</label>
			<input
				type="text"
				bind:value={form.pic}
				required
				class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>

		<div>
			<label class="block text-sm font-medium text-gray-700">Status</label>
			<select
				bind:value={form.status}
				class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<option value="Ready">Ready</option>
				<option value="Low Stock">Low Stock</option>
				<option value="Out of Stock">Out of Stock</option>
			</select>
		</div>

		<div class="flex space-x-4">
			<button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
				Simpan
			</button>
			<button
				type="button"
				on:click={resetForm}
				class="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
			>
				Reset
			</button>
			<button
				type="button"
				on:click={goBack}
				class="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
			>
				Kembali
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
</style>
