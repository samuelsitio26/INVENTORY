<script>
	import { createEventDispatcher } from 'svelte';
	import Select from 'svelte-select';

	export let show = false;
	export let selectedItem = null;

	const dispatch = createEventDispatcher();

	let formData = {
		id: selectedItem ? selectedItem.id : null,
		name: selectedItem ? selectedItem.name : '',
		description: selectedItem ? selectedItem.description : '',
		stockIn: selectedItem ? selectedItem.stockIn : 0,
		status: selectedItem ? selectedItem.status : 'Ready',
		// Pengaturan batas stok
		useCustomThresholds: false,
		readyThreshold: 5,
		lowStockThreshold: 1
	};

	let errors = {};

	const statusOptions = [
		{ value: 'Ready', label: 'Ready' },
		{ value: 'Low Stock', label: 'Low Stock' },
		{ value: 'Out of Stock', label: 'Out of Stock' }
	];

	// Fungsi untuk menghitung status berdasarkan stok dan threshold
	function calculateStatus(stock, useCustom = false, readyThreshold = 5, lowStockThreshold = 1) {
		if (stock === 0) return 'Out of Stock';
		if (useCustom) {
			if (stock >= readyThreshold) return 'Ready';
			if (stock >= lowStockThreshold) return 'Low Stock';
			return 'Out of Stock';
		} else {
			// Default thresholds: Ready >= 5, Low Stock 1-4, Out of Stock = 0
			if (stock >= 5) return 'Ready';
			if (stock >= 1) return 'Low Stock';
			return 'Out of Stock';
		}
	}

	// Update status otomatis berdasarkan stok dan threshold
	$: {
		if (formData.stockIn !== undefined && formData.stockIn !== null) {
			const newStatus = calculateStatus(
				parseInt(formData.stockIn) || 0,
				formData.useCustomThresholds,
				formData.readyThreshold,
				formData.lowStockThreshold
			);
			formData.status = newStatus;
		}
	}

	function validateForm() {
		errors = {};
		if (!formData.name) errors.name = 'Nama barang wajib diisi';
		if (!formData.description) errors.description = 'Deskripsi wajib diisi';
		if (formData.stockIn === null || formData.stockIn === undefined || formData.stockIn < 0) {
			errors.stockIn = 'Stok tidak boleh minus';
		}
		if (!formData.status) errors.status = 'Status wajib dipilih';

		// Validasi threshold jika menggunakan custom
		if (formData.useCustomThresholds) {
			if (formData.readyThreshold <= formData.lowStockThreshold) {
				errors.readyThreshold = 'Batas Ready harus lebih besar dari batas Low Stock';
			}
			if (formData.lowStockThreshold < 1) {
				errors.lowStockThreshold = 'Batas Low Stock minimal 1';
			}
		}
		return Object.keys(errors).length === 0;
	}

	function handleSubmit() {
		if (validateForm()) {
			dispatch('confirm', {
				id: formData.id,
				name: formData.name,
				description: formData.description,
				stockIn: parseInt(formData.stockIn) || 0,
				status: formData.status,
				useCustomThresholds: formData.useCustomThresholds,
				readyThreshold: formData.readyThreshold,
				lowStockThreshold: formData.lowStockThreshold
			});
		}
	}

	function handleCancel() {
		dispatch('cancel');
		// Reset form data
		formData = {
			id: null,
			name: '',
			description: '',
			stockIn: 0,
			status: 'Ready',
			useCustomThresholds: false,
			readyThreshold: 5,
			lowStockThreshold: 1
		};
		errors = {};
	}

	$: if (selectedItem) {
		formData = {
			id: selectedItem.id,
			name: selectedItem.name || '',
			description: selectedItem.description || '',
			stockIn: selectedItem.stockIn || 0,
			status: selectedItem.status || 'Ready',
			useCustomThresholds: selectedItem.useCustomThresholds || false,
			readyThreshold: selectedItem.readyThreshold || 5,
			lowStockThreshold: selectedItem.lowStockThreshold || 1
		};
		// Reset errors when selectedItem changes
		errors = {};
	}
</script>

{#if show}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
			<h2 class="text-xl font-bold mb-4">Edit Barang di Stok</h2>

			<div class="space-y-4">
				<!-- Input Nama Barang -->
				<div>
					<label for="edit-nama-barang" class="block text-sm font-medium text-gray-700"
						>Nama Barang</label
					>
					<input
						id="edit-nama-barang"
						type="text"
						bind:value={formData.name}
						class="mt-1 block w-full border rounded-md p-2"
						placeholder="Masukkan nama barang"
					/>
					{#if errors.name}
						<p class="text-red-500 text-sm mt-1">{errors.name}</p>
					{/if}
				</div>

				<!-- Input Deskripsi -->
				<div>
					<label for="edit-deskripsi" class="block text-sm font-medium text-gray-700"
						>Deskripsi</label
					>
					<textarea
						id="edit-deskripsi"
						bind:value={formData.description}
						class="mt-1 block w-full border rounded-md p-2"
						rows="4"
						placeholder="Masukkan deskripsi barang"
					></textarea>
					{#if errors.description}
						<p class="text-red-500 text-sm mt-1">{errors.description}</p>
					{/if}
				</div>

				<!-- Input Stok -->
				<div>
					<label for="edit-stok" class="block text-sm font-medium text-gray-700">Stok</label>
					<input
						id="edit-stok"
						type="number"
						bind:value={formData.stockIn}
						class="mt-1 block w-full border rounded-md p-2"
						placeholder="Masukkan jumlah stok"
						min="0"
					/>
					{#if errors.stockIn}
						<p class="text-red-500 text-sm mt-1">{errors.stockIn}</p>
					{/if}
				</div>

				<!-- Dropdown Status (Readonly - Auto calculated) -->
				<div>
					<label for="edit-status" class="block text-sm font-medium text-gray-700"
						>Status (Otomatis)</label
					>
					<div class="mt-1 p-2 border rounded-md bg-gray-50">
						<span class="text-sm font-medium">
							{#if formData.status === 'Ready'}
								<span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Ready</span
								>
							{:else if formData.status === 'Low Stock'}
								<span class="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800"
									>Low Stock</span
								>
							{:else if formData.status === 'Out of Stock'}
								<span class="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800"
									>Out of Stock</span
								>
							{/if}
						</span>
					</div>
					<p class="text-xs text-gray-500 mt-1">
						Status dihitung otomatis berdasarkan stok dan pengaturan batas
					</p>
				</div>

				<!-- Pengaturan Batas Stok -->
				<div class="border-t pt-4">
					<div class="flex items-center mb-3">
						<input
							id="use-custom-thresholds"
							type="checkbox"
							bind:checked={formData.useCustomThresholds}
							class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
						/>
						<label for="use-custom-thresholds" class="ml-2 text-sm font-medium text-gray-700">
							Gunakan Pengaturan Batas Khusus
						</label>
					</div>

					{#if formData.useCustomThresholds}
						<div class="space-y-3 ml-6">
							<!-- Batas Ready -->
							<div>
								<label for="ready-threshold" class="block text-sm font-medium text-gray-700">
									Batas Minimum untuk Status "Ready"
								</label>
								<input
									id="ready-threshold"
									type="number"
									bind:value={formData.readyThreshold}
									class="mt-1 block w-full border rounded-md p-2"
									placeholder="5"
									min="1"
								/>
								{#if errors.readyThreshold}
									<p class="text-red-500 text-sm mt-1">{errors.readyThreshold}</p>
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
									bind:value={formData.lowStockThreshold}
									class="mt-1 block w-full border rounded-md p-2"
									placeholder="1"
									min="1"
								/>
								{#if errors.lowStockThreshold}
									<p class="text-red-500 text-sm mt-1">{errors.lowStockThreshold}</p>
								{/if}
							</div>

							<div class="text-xs text-gray-500 p-2 bg-blue-50 rounded">
								<p><strong>Aturan:</strong></p>
								<p>• Ready: Stok ≥ {formData.readyThreshold}</p>
								<p>
									• Low Stock: Stok {formData.lowStockThreshold} - {formData.readyThreshold - 1}
								</p>
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
				<div class="flex justify-end space-x-2">
					<button
						on:click={handleCancel}
						class="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
					>
						Batal
					</button>
					<button
						on:click={handleSubmit}
						class="px-4 py-2 border rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
					>
						Simpan
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Styling untuk svelte-select */
	:global(.svelte-select) {
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		padding: 0.5rem;
	}
	:global(.svelte-select input) {
		width: 100%;
	}
</style>
