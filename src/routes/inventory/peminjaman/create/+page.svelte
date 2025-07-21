<script>
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';

	let form = {
		borrower: '',
		borrowDate: new Date().toISOString().split('T')[0],
		duration: 1,
		items: [{
			itemId: '',
			name: '',
			qty: '',
			selectedItem: null,
			qtyError: '',
			showDropdown: false
		}]
	};

	let items = [];
	let filteredItems = [];
	let loading = false;
	let error = null;
	let dropdownRefs = [];

	function filterItems(index, searchTerm) {
		if (!searchTerm) {
			filteredItems = items;
			return;
		}
		filteredItems = items.filter(
			(item) =>
				item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.subCategory.toLowerCase().includes(searchTerm.toLowerCase())
		);
	}

	function selectItem(formIndex, item) {
		form.items[formIndex].selectedItem = item;
		form.items[formIndex].itemId = item.id;
		form.items[formIndex].name = item.name;
		form.items[formIndex].showDropdown = false;
		form.items[formIndex].qtyError = '';
	}

	function validateQty(index) {
		const formItem = form.items[index];
		if (!formItem.selectedItem) return true;
		
		const qty = Number(formItem.qty);
		if (qty <= 0) {
			formItem.qtyError = 'Jumlah harus lebih dari 0';
			return false;
		}
		if (qty > formItem.selectedItem.stockIn) {
			formItem.qtyError = `Jumlah tidak boleh melebihi stok yang tersedia (${formItem.selectedItem.stockIn})`;
			return false;
		}
		formItem.qtyError = '';
		return true;
	}

	function addItem() {
		form.items = [...form.items, {
			itemId: '',
			name: '',
			qty: '',
			selectedItem: null,
			qtyError: '',
			showDropdown: false
		}];
	}

	function removeItem(index) {
		if (form.items.length > 1) {
			form.items = form.items.filter((_, i) => i !== index);
		}
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
		// Validate all items
		let hasErrors = false;
		for (let i = 0; i < form.items.length; i++) {
			if (!validateQty(i)) {
				hasErrors = true;
			}
		}
		
		if (hasErrors) {
			return;
		}

		// Check if all items are selected
		const invalidItems = form.items.filter(item => !item.selectedItem || !item.qty);
		if (invalidItems.length > 0) {
			alert('Harap lengkapi semua barang dan jumlahnya');
			return;
		}

		try {
			// Create multiple rental records
			const rentalPromises = form.items.map(formItem => {
				const payload = {
					barang_id: formItem.itemId,
					borrower: form.borrower,
					borrow_date: form.borrowDate,
					duration: parseInt(form.duration),
					qty: Number(formItem.qty),
					returned: false
				};
				
				return fetch('https://directus.eltamaprimaindo.com/items/rentals', {
					method: 'POST',
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				});
			});

			const responses = await Promise.all(rentalPromises);
			
			// Check if all requests were successful
			const failedResponses = responses.filter(response => !response.ok);
			if (failedResponses.length > 0) {
				throw new Error('Gagal menyimpan beberapa item peminjaman');
			}

			// Update stock for all items
			const stockUpdatePromises = form.items.map(formItem => {
				const newStock = formItem.selectedItem.stockIn - Number(formItem.qty);
				return fetch(`https://directus.eltamaprimaindo.com/items/Barang/${formItem.itemId}`, {
					method: 'PATCH',
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ StokIn: newStock })
				});
			});

			await Promise.all(stockUpdatePromises);
			
			alert(`${form.items.length} barang berhasil dipinjam!`);
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
			borrower: '',
			borrowDate: new Date().toISOString().split('T')[0],
			duration: 1,
			items: [{
				itemId: '',
				name: '',
				qty: '',
				selectedItem: null,
				qtyError: '',
				showDropdown: false
			}]
		};
	}

	function handleClickOutside(event) {
		form.items.forEach((item, index) => {
			if (dropdownRefs[index] && !dropdownRefs[index].contains(event.target)) {
				item.showDropdown = false;
			}
		});
	}

	onMount(() => {
		window.addEventListener('mousedown', handleClickOutside);
		loadData();
	});

	onDestroy(() => {
		window.removeEventListener('mousedown', handleClickOutside);
	});

	// Reactive statement to update dropdownRefs array
	$: {
		if (dropdownRefs.length !== form.items.length) {
			dropdownRefs = new Array(form.items.length).fill(null);
		}
	}

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
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
			</div>

			<!-- Daftar Barang -->
			<div class="mb-6">
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-semibold text-gray-900">Daftar Barang yang Dipinjam</h3>
					<button
						type="button"
						on:click={addItem}
						class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
						</svg>
						Tambah Barang
					</button>
				</div>

				{#each form.items as formItem, index}
					<div class="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
						<div class="flex justify-between items-start mb-4">
							<h4 class="font-medium text-gray-900">Barang #{index + 1}</h4>
							{#if form.items.length > 1}
								<button
									type="button"
									on:click={() => removeItem(index)}
									class="text-red-600 hover:text-red-800 p-1"
									title="Hapus barang"
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
									</svg>
								</button>
							{/if}
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<!-- Pilih Barang -->
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Nama Barang *
								</label>
								<div class="relative" bind:this={dropdownRefs[index]}>
									<input
										type="text"
										bind:value={formItem.name}
										on:input={() => filterItems(index, formItem.name)}
										on:focus={() => (formItem.showDropdown = true)}
										placeholder="Ketik untuk mencari barang..."
										class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										required
									/>
									{#if formItem.showDropdown && filteredItems.length > 0}
										<div
											class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
										>
											{#each filteredItems as item}
												<button
													type="button"
													on:click={() => selectItem(index, item)}
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
								{#if formItem.selectedItem}
									<div class="mt-2 p-2 bg-blue-50 rounded-lg">
										<p class="text-sm text-blue-800">
											<strong>Dipilih:</strong>
											{formItem.selectedItem.name} (Stok tersedia: {formItem.selectedItem.stockIn})
										</p>
									</div>
								{/if}
							</div>

							<!-- Jumlah Pinjam -->
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Jumlah Pinjam *
								</label>
								<input
									type="number"
									bind:value={formItem.qty}
									on:input={() => validateQty(index)}
									min="1"
									max={formItem.selectedItem?.stockIn || 999}
									placeholder="Jumlah barang"
									class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									required
								/>
								{#if formItem.qtyError}
									<p class="text-red-600 text-sm mt-1">{formItem.qtyError}</p>
								{/if}
							</div>
						</div>
					</div>
				{/each}
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
					disabled={loading || form.items.some(item => item.qtyError)}
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
