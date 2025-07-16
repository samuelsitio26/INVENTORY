<script>
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';

	let form = {
		itemId: '',
		name: '',
		borrower: '',
		borrowDate: new Date().toISOString().split('T')[0],
		duration: 1,
		qty: ''
	};

	let items = [];
	let filteredItems = [];
	let selectedItem = null;
	let loading = false;
	let error = null;
	let qtyError = '';
	let showDropdown = false;
	let dropdownRef;

	function filterItems() {
		if (!form.name) {
			filteredItems = items;
			return;
		}
		filteredItems = items.filter(
			(item) =>
				item.name.toLowerCase().includes(form.name.toLowerCase()) ||
				item.category.toLowerCase().includes(form.name.toLowerCase()) ||
				item.subCategory.toLowerCase().includes(form.name.toLowerCase())
		);
	}

	function selectItem(item) {
		selectedItem = item;
		form.itemId = item.id;
		form.name = item.name;
		showDropdown = false;
		qtyError = '';
	}

	function validateQty() {
		if (!selectedItem) return true;
		const qty = Number(form.qty);
		if (qty <= 0) {
			qtyError = 'Jumlah harus lebih dari 0';
			return false;
		}
		if (qty > selectedItem.stockIn) {
			qtyError = `Jumlah tidak boleh melebihi stok yang tersedia (${selectedItem.stockIn})`;
			return false;
		}
		qtyError = '';
		return true;
	}

	async function loadData() {
		loading = true;
		try {
			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/Barang?fields=*,parent_category.parent_category,sub_category.nama_sub',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);
			if (!response.ok) throw new Error('Gagal mengambil data dari Directus');
			const data = await response.json();
			items = data.data
				.map((item) => ({
					id: item.id,
					name: item.Nama,
					category: item.parent_category?.parent_category || 'Unknown',
					subCategory: item.sub_category?.nama_sub || 'Unknown',
					stockIn: item.StokIn || 0
				}))
				.filter((item) => item.stockIn > 0); // hanya tampilkan barang dengan stok > 0
			filteredItems = items;
		} catch (err) {
			error = err.message;
			console.error('Error loading data:', err);
		} finally {
			loading = false;
		}
	}

	async function handleSubmit() {
		if (selectedItem && !validateQty()) {
			return;
		}
		try {
			const payload = {
				barang_id: form.itemId,
				borrower: form.borrower,
				borrow_date: form.borrowDate,
				duration: parseInt(form.duration),
				qty: Number(form.qty),
				returned: false
			};
			console.log('Payload yang dikirim:', payload);
			const response = await fetch('https://directus.eltamaprimaindo.com/items/rentals', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});
			if (!response.ok) {
				let errorText;
				try {
					errorText = await response.text();
					console.error('Response error:', errorText);
				} catch (e) {
					errorText = 'Unknown error';
				}
				throw new Error('Gagal meminjam: ' + errorText);
			}
			alert('Barang berhasil dipinjam!');
			// PATCH stok barang setelah berhasil pinjam
			const newStock = selectedItem.stockIn - Number(form.qty);
			await fetch(`https://directus.eltamaprimaindo.com/items/Barang/${form.itemId}`, {
				method: 'PATCH',
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ StokIn: newStock })
			});
			await new Promise((resolve) => setTimeout(resolve, 1000));
			await loadData();
			resetForm();
			goto('/inventory/peminjaman');
		} catch (err) {
			alert('Error: ' + err.message);
			console.error('Error details:', err);
		}
	}

	function resetForm() {
		form = {
			itemId: '',
			name: '',
			borrower: '',
			borrowDate: new Date().toISOString().split('T')[0],
			duration: 1,
			qty: ''
		};
		selectedItem = null;
		qtyError = '';
	}

	function handleClickOutside(event) {
		if (dropdownRef && !dropdownRef.contains(event.target)) {
			showDropdown = false;
		}
	}

	onMount(() => {
		window.addEventListener('mousedown', handleClickOutside);
		loadData();
	});

	onDestroy(() => {
		window.removeEventListener('mousedown', handleClickOutside);
	});

	// Ubah format returnDate menjadi mm-dd-yyyy
	function formatDateMDY(dateStr) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		const day = String(d.getDate()).padStart(2, '0');
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		return `${month}-${day}-${year}`;
	}

	$: returnDateRaw =
		form.borrowDate && form.duration
			? new Date(new Date(form.borrowDate).getTime() + (form.duration - 1) * 24 * 60 * 60 * 1000)
					.toISOString()
					.split('T')[0]
			: '';

	$: returnDate = formatDateMDY(returnDateRaw);
</script>

<div class="max-w-4xl mx-auto p-6">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900">Permintaan Peminjaman Barang</h1>
		<p class="text-gray-600 mt-2">
			Silakan isi form di bawah untuk mengajukan permintaan peminjaman barang
		</p>
	</div>

	{#if error}
		<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
			<div class="flex">
				<svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
						clip-rule="evenodd"
					/>
				</svg>
				<p class="text-red-700">{error}</p>
			</div>
		</div>
	{/if}

	<div class="bg-white rounded-lg shadow-lg p-6">
		<form on:submit|preventDefault={handleSubmit}>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Pilih Barang -->
				<div class="md:col-span-2">
					<label for="nama-barang" class="block text-sm font-medium text-gray-700 mb-2">
						Nama Barang *
					</label>
					<div class="relative" bind:this={dropdownRef}>
						<input
							type="text"
							bind:value={form.name}
							on:input={filterItems}
							on:focus={() => (showDropdown = true)}
							placeholder="Ketik untuk mencari barang..."
							class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							required
						/>
						{#if showDropdown && filteredItems.length > 0}
							<div
								class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
							>
								{#each filteredItems as item}
									<button
										type="button"
										on:click={() => selectItem(item)}
										class="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
									>
										<div class="font-medium text-gray-900">{item.name}</div>
										<div class="text-sm text-gray-500">
											{item.category} - {item.subCategory} (Stok: {item.stockIn})
										</div>
									</button>
								{/each}
							</div>
						{/if}
					</div>
					{#if selectedItem}
						<div class="mt-2 p-3 bg-blue-50 rounded-lg">
							<p class="text-sm text-blue-800">
								<strong>Dipilih:</strong>
								{selectedItem.name} (Stok tersedia: {selectedItem.stockIn})
							</p>
						</div>
					{/if}
				</div>

				<!-- Nama Peminjam -->
				<div>
					<label for="peminjam" class="block text-sm font-medium text-gray-700 mb-2">
						Nama Peminjam *
					</label>
					<input
						type="text"
						bind:value={form.borrower}
						placeholder="Masukkan nama peminjam"
						class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						required
					/>
				</div>

				<!-- Tanggal Pinjam -->
				<div>
					<label for="tanggal-pinjam" class="block text-sm font-medium text-gray-700 mb-2">
						Tanggal Pinjam *
					</label>
					<input
						type="date"
						bind:value={form.borrowDate}
						class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						required
					/>
				</div>

				<!-- Durasi Pinjam -->
				<div>
					<label for="durasi" class="block text-sm font-medium text-gray-700 mb-2">
						Durasi Pinjam (hari) *
					</label>
					<input
						type="number"
						bind:value={form.duration}
						min="1"
						placeholder="Masukkan durasi dalam hari"
						class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						required
					/>
					<div class="mt-2 text-sm text-gray-600">
						Tanggal Pengembalian: <b>{returnDate}</b>
					</div>
				</div>

				<!-- Jumlah Pinjam -->
				<div>
					<label for="qty" class="block text-sm font-medium text-gray-700 mb-2">
						Jumlah Pinjam *
					</label>
					<input
						type="number"
						bind:value={form.qty}
						on:input={validateQty}
						min="1"
						max={selectedItem?.stockIn || 999}
						placeholder="Jumlah barang"
						class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						required
					/>
					{#if qtyError}
						<p class="text-red-600 text-sm mt-1">{qtyError}</p>
					{/if}
				</div>
			</div>

			<div class="mt-8 flex justify-end space-x-4">
				<button
					type="button"
					on:click={() => goto('/inventory/peminjaman')}
					class="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
				>
					Batal
				</button>
				<button
					type="submit"
					disabled={loading || !!qtyError}
					class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{#if loading}
						<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Menyimpan...
					{:else}
						Submit Permintaan
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
