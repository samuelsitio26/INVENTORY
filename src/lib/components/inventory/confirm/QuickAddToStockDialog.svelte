<script>
	import { createEventDispatcher } from 'svelte';

	export let show = false;
	export let selectedItem = null;
	export let identitasBarangList = [];
	export let parentCategories = [];
	export let subCategories = [];

	const dispatch = createEventDispatcher();

	let stockIn = selectedItem ? selectedItem.quantity : 0;
	let description = '';
	let matchedBarang = null;
	let errors = {};
	let submitError = null;

	// Auto-match ketika selectedItem berubah
	$: if (selectedItem) {
		stockIn = selectedItem.quantity;
		description = `Stok dari ${selectedItem.name} - ${selectedItem.quantity} ${selectedItem.units}`;
		autoMatchIdentitasBarang(selectedItem.name);
	}

	// Auto-update status preview berdasarkan stockIn
	$: statusPreview =
		stockIn > 0
			? stockIn >= 5
				? 'Ready'
				: stockIn >= 1
					? 'Low Stock'
					: 'Out of Stock'
			: 'Out of Stock';

	// Fungsi untuk auto-match identitas barang berdasarkan nama
	function autoMatchIdentitasBarang(itemName) {
		if (!itemName || !identitasBarangList.length) {
			matchedBarang = null;
			return;
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

		matchedBarang = found;
	}

	function validateForm() {
		errors = {};
		if (!stockIn || stockIn <= 0) {
			errors.stockIn = 'Stok harus lebih dari 0';
		}
		if (!description || description.trim() === '') {
			errors.description = 'Deskripsi wajib diisi';
		}
		if (!matchedBarang) {
			errors.match = 'Barang tidak ditemukan di database identitas barang';
		}
		return Object.keys(errors).length === 0;
	}

	async function handleSubmit() {
		if (!validateForm()) return;

		try {
			const parentCat = parentCategories.find((cat) => cat.id === matchedBarang.parent_category);
			const subCat = subCategories.find((cat) => cat.id === matchedBarang.sub_category);

			// Hitung status berdasarkan stok
			let status = 'Ready';
			if (stockIn === 0) status = 'Out of Stock';
			else if (stockIn < 5) status = 'Low Stock';

			const payload = {
				identitas_id: matchedBarang.id,
				name: matchedBarang.nama_barang_lengkap,
				parent_category: parentCat ? parentCat.id : null,
				sub_category: subCat ? subCat.id : null,
				detail: description,
				stockIn: parseInt(stockIn),
				status: status,
				id: selectedItem.id
			};

			dispatch('confirm', payload);
			handleCancel();
		} catch (err) {
			submitError = err.message;
			console.error('Submit error:', err);
		}
	}

	function handleCancel() {
		dispatch('cancel');
		stockIn = 0;
		description = '';
		matchedBarang = null;
		errors = {};
		submitError = null;
	}

	function handleAdvanced() {
		dispatch('advanced', selectedItem);
	}
</script>

{#if show}
	<div class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4">
		<div class="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">🚀 Quick Add ke Stok</h2>

			{#if selectedItem}
				<!-- Info Barang -->
				<div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
					<h3 class="font-medium text-blue-900 text-sm">📦 Barang Diterima:</h3>
					<p class="text-blue-800 text-sm">{selectedItem.name}</p>
					<p class="text-blue-600 text-xs">Qty: {selectedItem.quantity} {selectedItem.units}</p>
				</div>

				<!-- Status Match -->
				{#if matchedBarang}
					<div class="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
						<div class="flex items-center gap-2">
							<svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"
								></path>
							</svg>
							<span class="text-sm font-medium text-green-800">✅ Match Found!</span>
						</div>
						<p class="text-xs text-green-700 mt-1">
							{matchedBarang.nama_barang_lengkap}
						</p>
						<p class="text-xs text-green-600">
							Kategori: {parentCategories.find((cat) => cat.id === matchedBarang.parent_category)
								?.parent_category || 'Unknown'}
						</p>
					</div>
				{:else}
					<div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
						<div class="flex items-center gap-2">
							<svg class="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
									clip-rule="evenodd"
								></path>
							</svg>
							<span class="text-sm font-medium text-red-800">❌ No Match</span>
						</div>
						<p class="text-xs text-red-700 mt-1">
							Barang tidak ditemukan di database identitas barang
						</p>
						<button
							on:click={handleAdvanced}
							class="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
						>
							Gunakan mode advanced untuk input manual
						</button>
					</div>
				{/if}

				<div class="space-y-4">
					<!-- Stok Input -->
					<div>
						<label for="stock-input" class="block text-sm font-medium text-gray-700 mb-1">
							Jumlah Stok
						</label>
						<input
							id="stock-input"
							type="number"
							bind:value={stockIn}
							class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							placeholder="Masukkan jumlah stok"
							min="0"
						/>
						{#if errors.stockIn}
							<p class="text-red-500 text-xs mt-1">{errors.stockIn}</p>
						{/if}
					</div>

					<!-- Deskripsi -->
					<div>
						<label for="description-input" class="block text-sm font-medium text-gray-700 mb-1">
							Deskripsi Singkat
						</label>
						<textarea
							id="description-input"
							bind:value={description}
							class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							rows="2"
							placeholder="Deskripsi singkat..."
						></textarea>
						{#if errors.description}
							<p class="text-red-500 text-xs mt-1">{errors.description}</p>
						{/if}
					</div>

					<!-- Status Preview -->
					{#if stockIn !== undefined && stockIn !== null}
						<div class="text-xs text-gray-600 bg-gray-50 p-2 rounded">
							<strong>Status akan menjadi:</strong>
							{#if statusPreview === 'Ready'}
								<span class="text-green-600 font-medium">✅ Ready</span>
							{:else if statusPreview === 'Low Stock'}
								<span class="text-yellow-600 font-medium">⚠️ Low Stock</span>
							{:else}
								<span class="text-red-600 font-medium">❌ Out of Stock</span>
							{/if}
						</div>
					{/if}

					{#if errors.match}
						<p class="text-red-500 text-xs">{errors.match}</p>
					{/if}
					{#if submitError}
						<p class="text-red-500 text-xs">{submitError}</p>
					{/if}
				</div>

				<!-- Tombol Aksi -->
				<div class="flex justify-between items-center mt-6">
					<button
						on:click={handleAdvanced}
						class="text-sm text-gray-600 hover:text-gray-800 underline"
					>
						Mode Advanced
					</button>
					<div class="space-x-3">
						<button
							on:click={handleCancel}
							class="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
						>
							Batal
						</button>
						<button
							on:click={handleSubmit}
							disabled={!matchedBarang}
							class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
						>
							🚀 Add ke Stok
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
