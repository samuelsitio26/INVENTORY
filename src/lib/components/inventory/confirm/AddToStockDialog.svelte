<script>
	import { createEventDispatcher } from 'svelte';

	export let show = false;
	export let stockItems = [];
	export let selectedItem = null;
	export let identitasBarangList = [];
	export let parentCategories = [];
	export let subCategories = [];

	const dispatch = createEventDispatcher();

	let formData = {
		identitas_id: '',
		name: '',
		parent_category: '',
		sub_category: '',
		detail: '',
		stockIn: selectedItem ? selectedItem.quantity : 0,
		status: 'Ready'
	};

	let errors = {};
	let submitError = null;
	let showNotification = false; // State for notification visibility
	let notificationMessage = ''; // Custom message for notification

	const statusOptions = [
		{ value: 'Ready', label: 'Ready' },
		{ value: 'Low Stock', label: 'Low Stock' },
		{ value: 'Out of Stock', label: 'Out of Stock' }
	];

	// Reactive statement to check for missing item or category
	$: {
		if (formData.name && formData.name.trim()) {
			const barangExists = identitasBarangList.some(
				(b) => b.nama_barang_lengkap.toLowerCase() === formData.name.toLowerCase()
			);
			const parentCatExists = formData.parent_category
				? parentCategories.some((cat) => cat.parent_category === formData.parent_category)
				: true; // Allow empty parent category
			const subCatExists = formData.sub_category
				? subCategories.some((cat) => cat.nama_sub === formData.sub_category)
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

	// Auto-update status berdasarkan stockIn
	$: {
		if (formData.stockIn !== undefined && formData.stockIn !== null) {
			const stock = parseInt(formData.stockIn);
			if (stock === 0) {
				formData.status = 'Out of Stock';
			} else if (stock < 5) {
				formData.status = 'Low Stock';
			} else {
				formData.status = 'Ready';
			}
		}
	}

	$: if (selectedItem) {
		formData.name = selectedItem.name || '';
		formData.stockIn = selectedItem.quantity;
		// Auto-match dengan identitas barang
		autoMatchIdentitasBarang(selectedItem.name);
	}

	// Fungsi untuk auto-match identitas barang berdasarkan nama
	function autoMatchIdentitasBarang(itemName) {
		if (!itemName || !identitasBarangList.length) return;

		// Cari exact match dulu
		let matchedBarang = identitasBarangList.find(
			(b) => b.nama_barang_lengkap.toLowerCase() === itemName.toLowerCase()
		);

		// Jika tidak ada exact match, cari yang mengandung kata kunci
		if (!matchedBarang) {
			matchedBarang = identitasBarangList.find(
				(b) =>
					b.nama_barang_lengkap.toLowerCase().includes(itemName.toLowerCase()) ||
					itemName.toLowerCase().includes(b.nama_barang_lengkap.toLowerCase())
			);
		}

		if (matchedBarang) {
			// Auto-fill form dengan data yang ditemukan
			formData.identitas_id = matchedBarang.id;
			formData.name = matchedBarang.nama_barang_lengkap;

			const parentCat = parentCategories.find((cat) => cat.id === matchedBarang.parent_category);
			formData.parent_category = parentCat
				? parentCat.parent_category
				: matchedBarang.parent_category || '';

			const subCat = subCategories.find((cat) => cat.id === matchedBarang.sub_category);
			formData.sub_category = subCat ? subCat.nama_sub : matchedBarang.sub_category || '';

			// Auto-update status berdasarkan stockIn saat ini
			const stock = parseInt(formData.stockIn) || 0;
			if (stock === 0) {
				formData.status = 'Out of Stock';
			} else if (stock < 5) {
				formData.status = 'Low Stock';
			} else {
				formData.status = 'Ready';
			}
		}
	}

	function handleNamaChange(e) {
		const id = e.target.value;
		const barang = identitasBarangList.find((b) => b.id == id);
		if (barang) {
			formData.identitas_id = id;
			formData.name = barang.nama_barang_lengkap || '';
			const parentCat = parentCategories.find((cat) => cat.id === barang.parent_category);
			formData.parent_category = parentCat
				? parentCat.parent_category
				: barang.parent_category || '';
			const subCat = subCategories.find((cat) => cat.id === barang.sub_category);
			formData.sub_category = subCat ? subCat.nama_sub : barang.sub_category || '';

			// Auto-update status berdasarkan stockIn saat ini
			const stock = parseInt(formData.stockIn) || 0;
			if (stock === 0) {
				formData.status = 'Out of Stock';
			} else if (stock < 5) {
				formData.status = 'Low Stock';
			} else {
				formData.status = 'Ready';
			}
		} else {
			formData.identitas_id = id;
			formData.name = '';
			formData.parent_category = '';
			formData.sub_category = '';
		}
	}

	function validateForm() {
		errors = {};
		if (!formData.name || formData.name.trim() === '') errors.name = 'Nama barang wajib diisi';
		if (!formData.detail) errors.detail = 'Deskripsi wajib diisi';
		if (!formData.stockIn || formData.stockIn <= 0) errors.stockIn = 'Stok harus lebih dari 0';
		if (!formData.status) errors.status = 'Status wajib dipilih';

		// Hanya validasi identitas_id jika tidak ada auto-match
		if (!formData.identitas_id && !formData.parent_category) {
			errors.identitas_id = 'Pilih nama barang dari daftar atau pastikan kategori terisi';
		}

		return Object.keys(errors).length === 0;
	}

	async function handleSubmit() {
		if (validateForm()) {
			try {
				console.log('FormData sebelum submit:', formData);
				const payload = {
					identitas_id: formData.identitas_id,
					name: formData.name || '-',
					parent_category:
						parentCategories.find((cat) => cat.parent_category === formData.parent_category)?.id ||
						null,
					sub_category:
						subCategories.find((cat) => cat.nama_sub === formData.sub_category)?.id || null,
					detail: formData.detail || 'Tidak ada deskripsi',
					stockIn: parseInt(formData.stockIn) || 0,
					status: formData.status || 'Unknown'
				};

				console.log('Payload sent:', payload);
				dispatch('confirm', {
					name: payload.name,
					detail: payload.detail,
					stockIn: payload.stockIn,
					status: payload.status,
					parent_category: payload.parent_category,
					sub_category: payload.sub_category,
					id: formData.identitas_id
				});
				handleCancel();
			} catch (err) {
				submitError = err.message;
				console.error('Submit error:', err);
			}
		}
	}

	function handleCancel() {
		dispatch('cancel');
		formData = {
			identitas_id: '',
			name: '',
			parent_category: '',
			sub_category: '',
			detail: '',
			stockIn: 0,
			status: 'Ready'
		};
		errors = {};
		submitError = null;
		showNotification = false;
	}

	function dismissNotification() {
		showNotification = false;
	}

	let showDropdown = false;
	let filteredBarangList = [];

	$: filteredBarangList = formData.name
		? identitasBarangList.filter((b) =>
				b.nama_barang_lengkap.toLowerCase().includes(formData.name.toLowerCase())
			)
		: identitasBarangList;

	function selectBarang(barang) {
		formData.identitas_id = barang.id;
		formData.name = barang.nama_barang_lengkap;
		const parentCat = parentCategories.find((cat) => cat.id === barang.parent_category);
		formData.parent_category = parentCat ? parentCat.parent_category : barang.parent_category || '';
		const subCat = subCategories.find((cat) => cat.id === barang.sub_category);
		formData.sub_category = subCat ? subCat.nama_sub : barang.sub_category || '';
		showDropdown = false;

		// Auto-update status berdasarkan stockIn saat ini
		const stock = parseInt(formData.stockIn) || 0;
		if (stock === 0) {
			formData.status = 'Out of Stock';
		} else if (stock < 5) {
			formData.status = 'Low Stock';
		} else {
			formData.status = 'Ready';
		}
	}
</script>

{#if show}
	<div class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4">
		<div class="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
			<h2 class="text-2xl font-semibold text-gray-800 mb-6">Masukkan ke Stok</h2>

			<!-- Modern Notification for Missing Item or Category -->
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
						<a
							href="/inventory/create"
							class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-white bg-blue-600 hover:bg-blue-700 text-sm shadow transition"
						>
							➕ Tambah Barang
						</a>
					</div>

					<!-- Close button -->
					<button
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

			<div class="space-y-5">
				<!-- Auto-Match Status (Jika ada match) -->
				{#if formData.identitas_id}
					<div class="bg-green-50 border border-green-200 rounded-lg p-3">
						<div class="flex items-center gap-2">
							<svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"
								></path>
							</svg>
							<span class="text-sm font-medium text-green-800">✅ Barang ditemukan di database</span
							>
						</div>
						<p class="text-xs text-green-700 mt-1">
							Kategori dan informasi sudah terisi otomatis. Silakan atur stok dan deskripsi, status
							akan otomatis disesuaikan.
						</p>
					</div>
				{/if}
				<!-- Dropdown Nama Barang -->
				<div class="relative">
					<label for="namaBarang" class="block text-sm font-medium text-gray-700 mb-1.5"
						>Nama Barang</label
					>
					<input
						id="namaBarang"
						type="text"
						class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
						bind:value={formData.name}
						placeholder="Cari atau masukkan nama barang..."
						on:input={(e) => {
							showDropdown = true;
							// Jika user mengetik manual, reset identitas_id
							if (e.target.value !== formData.name) {
								formData.identitas_id = '';
								formData.parent_category = '';
								formData.sub_category = '';
							}
							// Coba auto-match saat user mengetik
							autoMatchIdentitasBarang(e.target.value);
						}}
						on:focus={() => (showDropdown = true)}
						on:blur={() => setTimeout(() => (showDropdown = false), 200)}
					/>
					{#if showDropdown && filteredBarangList.length > 0}
						<div
							class="absolute z-20 bg-white border border-gray-200 w-full max-h-48 overflow-y-auto rounded-lg shadow-lg mt-1"
							role="listbox"
						>
							{#each filteredBarangList as barang}
								<div
									class="px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 cursor-pointer transition-colors duration-150"
									on:click={() => selectBarang(barang)}
									on:keydown={(e) => e.key === 'Enter' && selectBarang(barang)}
									role="option"
									aria-selected={formData.identitas_id === barang.id}
									tabindex="0"
								>
									{barang.nama_barang_lengkap}
								</div>
							{/each}
						</div>
					{/if}
					{#if errors.name}
						<p class="text-red-500 text-xs mt-1.5">{errors.name}</p>
					{/if}
				</div>

				<!-- Kategori dan Sub Kategori -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="kategori" class="block text-sm font-medium text-gray-700 mb-1.5"
							>Kategori</label
						>
						<input
							id="kategori"
							type="text"
							class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
							bind:value={formData.parent_category}
							readonly
						/>
					</div>
					<div>
						<label for="subKategori" class="block text-sm font-medium text-gray-700 mb-1.5"
							>Sub Kategori</label
						>
						<input
							id="subKategori"
							type="text"
							class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
							bind:value={formData.sub_category}
							readonly
						/>
					</div>
				</div>

				<!-- Deskripsi -->
				<div>
					<label for="deskripsi" class="block text-sm font-medium text-gray-700 mb-1.5"
						>Deskripsi</label
					>
					<textarea
						id="deskripsi"
						bind:value={formData.detail}
						class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
						rows="4"
						placeholder="Masukkan deskripsi barang"
					></textarea>
					{#if errors.detail}
						<p class="text-red-500 text-xs mt-1.5">{errors.detail}</p>
					{/if}
				</div>

				<!-- Stok -->
				<div>
					<label for="stok" class="block text-sm font-medium text-gray-700 mb-1.5">Stok</label>
					<input
						id="stok"
						type="number"
						bind:value={formData.stockIn}
						class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
						placeholder="Masukkan jumlah stok"
						min="0"
					/>
					{#if errors.stockIn}
						<p class="text-red-500 text-xs mt-1.5">{errors.stockIn}</p>
					{/if}
				</div>

				<!-- Status -->
				<div>
					<label for="status" class="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
					<select
						id="status"
						bind:value={formData.status}
						class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
					>
						{#each statusOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
					<p class="text-xs text-gray-500 mt-1">
						Status akan diperbarui otomatis berdasarkan jumlah stok
					</p>
					{#if errors.status}
						<p class="text-red-500 text-xs mt-1.5">{errors.status}</p>
					{/if}
				</div>

				<!-- Tampilkan error submit jika ada -->
				{#if submitError}
					<p class="text-red-500 text-sm mt-2">{submitError}</p>
				{/if}

				<!-- Tombol Aksi -->
				<div class="flex justify-end space-x-3 mt-6">
					<button
						on:click={handleCancel}
						class="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200 shadow-sm"
					>
						Batal
					</button>
					<button
						on:click={handleSubmit}
						class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors duration-200 shadow-sm"
					>
						Simpan
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
