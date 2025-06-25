<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';

	let form = {
		rentalId: '',
		itemName: '',
		category: '',
		subCategory: '',
		quantityReturned: 1,
		borrower: '',
		borrowDate: '',
		actualReturnDate: new Date().toISOString().split('T')[0],
		itemCondition: 'Baik',
		additionalNotes: '',
		returnStatus: ''
	};

	let rentals = [];
	let loading = false;
	let error = null;
	let selectedRental = null;
	let showDropdown = false;
	let filteredRentals = [];
	let dropdownRef;
	let qtyError = '';

	const conditionOptions = ['Baik', 'Rusak', 'Tidak Lengkap', 'Hilang'];

	function filterRentals() {
		if (!form.itemName) {
			filteredRentals = rentals.filter(rental => !rental.returned);
			return;
		}
		filteredRentals = rentals.filter((rental) =>
			!rental.returned && 
			rental.itemName.toLowerCase().includes(form.itemName.toLowerCase())
		);
	}

	function selectRental(rental) {
		selectedRental = rental;
		form.rentalId = rental.id;
		form.itemName = rental.itemName;
		form.category = rental.category;
		form.subCategory = rental.subCategory;
		form.borrower = rental.borrower;
		form.borrowDate = formatDateDMY(rental.borrowDate);
		form.quantityReturned = rental.qty;
		form.returnStatus = calculateReturnStatus(rental.expectedReturnDate);
		qtyError = '';
		showDropdown = false;
	}

	function validateQty() {
		if (!selectedRental) return;
		const qty = Number(form.quantityReturned);
		if (!qty || qty < 1) {
			qtyError = 'Jumlah kembalikan minimal 1';
			return false;
		}
		if (qty > selectedRental.qty) {
			qtyError = `Jumlah kembalikan tidak boleh melebihi jumlah pinjam (${selectedRental.qty})`;
			return false;
		}
		qtyError = '';
		return true;
	}

	function calculateReturnStatus(expectedReturnDate) {
		const today = new Date();
		const expected = new Date(expectedReturnDate);
		const actual = new Date(form.actualReturnDate);
		
		if (actual <= expected) {
			return 'Tepat Waktu';
		} else {
			const diffTime = actual - expected;
			const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
			return `Terlambat ${diffDays} hari`;
		}
	}

	async function loadRentals() {
		loading = true;
		try {
			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/rentals?fields=*,barang_id.id,barang_id.Nama,barang_id.StokIn,barang_id.parent_category.parent_category,barang_id.sub_category.nama_sub',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);
			if (!response.ok) throw new Error('Gagal mengambil data peminjaman dari Directus');
			const data = await response.json();
			
			rentals = data.data.map((rental) => {
				const borrowDate = new Date(rental.borrow_date);
				const expectedReturnDate = new Date(borrowDate.getTime() + (rental.duration * 24 * 60 * 60 * 1000));
				
				return {
					id: rental.id,
					itemId: rental.barang_id?.id || '',
					itemName: rental.barang_id?.Nama || 'Unknown',
					category: rental.barang_id?.parent_category?.parent_category || 'Unknown',
					subCategory: rental.barang_id?.sub_category?.nama_sub || 'Unknown',
					borrower: rental.borrower || 'Unknown',
					borrowDate: rental.borrow_date,
					expectedReturnDate: expectedReturnDate,
					qty: rental.qty || 1,
					returned: rental.returned || false,
					currentStock: rental.barang_id?.StokIn || 0
				};
			});
			
			filteredRentals = rentals.filter(rental => !rental.returned);
		} catch (err) {
			error = err.message;
			console.error('Error loading rentals:', err);
		} finally {
			loading = false;
		}
	}

	async function handleSubmit() {
		if (selectedRental && !validateQty()) {
			return;
		}

		try {
			// Update status peminjaman menjadi returned
			const updateRentalPayload = {
				returned: true,
				actual_return_date: form.actualReturnDate,
				return_condition: form.itemCondition,
				return_notes: form.additionalNotes,
				return_status: form.returnStatus,
				quantity_returned: Number(form.quantityReturned)
			};

			console.log('Updating rental:', updateRentalPayload);
			
			const updateResponse = await fetch(`https://directus.eltamaprimaindo.com/items/rentals/${form.rentalId}`, {
				method: 'PATCH',
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateRentalPayload)
			});

			if (!updateResponse.ok) {
				let errorText;
				try {
					errorText = await updateResponse.text();
					console.error('Update rental error:', errorText);
				} catch (e) {
					errorText = 'Unknown error';
				}
				throw new Error('Gagal mengupdate data peminjaman: ' + errorText);
			}

			// Update stok barang (tambahkan kembali stok yang dikembalikan)
			const newStock = selectedRental.currentStock + Number(form.quantityReturned);
			const updateStockPayload = { StokIn: newStock };

			console.log('Updating stock for item:', selectedRental.itemId, 'New stock:', newStock);
			
			const stockResponse = await fetch(`https://directus.eltamaprimaindo.com/items/Barang/${selectedRental.itemId}`, {
				method: 'PATCH',
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateStockPayload)
			});

			if (!stockResponse.ok) {
				console.warn('Gagal mengupdate stok barang, tapi pengembalian tetap berhasil');
			}

			alert('Barang berhasil dikembalikan!');
			
			// Reload data dan reset form
			await new Promise((resolve) => setTimeout(resolve, 1000));
			await loadRentals();
			resetForm();
			
		} catch (err) {
			alert('Error: ' + err.message);
			console.error('Error details:', err);
		}
	}

	function resetForm() {
		form = {
			rentalId: '',
			itemName: '',
			category: '',
			subCategory: '',
			quantityReturned: 1,
			borrower: '',
			borrowDate: '',
			actualReturnDate: new Date().toISOString().split('T')[0],
			itemCondition: 'Baik',
			additionalNotes: '',
			returnStatus: ''
		};
		selectedRental = null;
		qtyError = '';
	}

	function handleClickOutside(event) {
		if (dropdownRef && !dropdownRef.contains(event.target)) {
			showDropdown = false;
		}
	}

	// Format date untuk tampilan (DD/MM/YYYY)
	function formatDateDMY(dateStr) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		const day = String(d.getDate()).padStart(2, '0');
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		return `${day}/${month}/${year}`;
	}

	// Update return status ketika tanggal aktual berubah
	$: if (selectedRental && form.actualReturnDate) {
		form.returnStatus = calculateReturnStatus(selectedRental.expectedReturnDate);
	}

	onMount(() => {
		window.addEventListener('mousedown', handleClickOutside);
		loadRentals();
	});

	onDestroy(() => {
		window.removeEventListener('mousedown', handleClickOutside);
	});
</script>

<div class="space-y-6 p-6 bg-gray-100 min-h-screen">
	<h1 class="text-2xl font-bold text-gray-900">Formulir Pengembalian Barang</h1>
	
	{#if loading}
		<div class="text-center py-4">
			<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
			<p class="mt-2 text-gray-600">Memuat data peminjaman...</p>
		</div>
	{/if}

	{#if error}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
			Error: {error}
		</div>
	{/if}

	<form on:submit|preventDefault={handleSubmit} class="bg-white rounded-lg shadow p-6 space-y-4">
		<!-- Nama Barang dengan Dropdown -->
		<div class="relative" bind:this={dropdownRef}>
			<label class="block text-sm font-medium text-gray-700 mb-1.5">
				Nama Barang <span class="text-red-500">*</span>
			</label>
			<input
				type="text"
				bind:value={form.itemName}
				on:input={() => {
					filterRentals();
					showDropdown = true;
					selectedRental = null;
					form.rentalId = '';
				}}
				on:focus={() => {
					filterRentals();
					showDropdown = true;
				}}
				class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
				placeholder="Pilih barang yang akan dikembalikan"
				autocomplete="off"
				disabled={loading}
				required
			/>
			{#if showDropdown && filteredRentals.length > 0}
				<ul class="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-48 overflow-auto shadow-lg">
					{#each filteredRentals as rental}
						<li
							class="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
							on:click={() => selectRental(rental)}
						>
							<div class="font-medium text-gray-900">{rental.itemName}</div>
							<div class="text-sm text-gray-500">
								Peminjam: {rental.borrower} | Qty: {rental.qty} | Tanggal: {formatDateDMY(rental.borrowDate)}
							</div>
						</li>
					{/each}
				</ul>
			{:else if showDropdown && form.itemName && filteredRentals.length === 0}
				<div class="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 p-4 shadow-lg">
					<p class="text-gray-500 text-sm">Tidak ada barang yang masih dipinjam dengan nama tersebut</p>
				</div>
			{/if}
		</div>

		{#if selectedRental}
			<!-- Info Barang -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50 p-4 rounded-lg">
				<div>
					<label class="block text-xs font-medium text-gray-600">Kategori</label>
					<div class="font-semibold text-gray-900">{form.category}</div>
				</div>
				<div>
					<label class="block text-xs font-medium text-gray-600">Sub Kategori</label>
					<div class="font-semibold text-gray-900">{form.subCategory}</div>
				</div>
				<div>
					<label class="block text-xs font-medium text-gray-600">Stok Saat Ini</label>
					<div class="font-semibold text-gray-900">{selectedRental.currentStock}</div>
				</div>
			</div>

			<!-- Jumlah Dikembalikan -->
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">
					Jumlah Dikembalikan <span class="text-red-500">*</span>
				</label>
				<input
					type="number"
					min="1"
					max={selectedRental.qty}
					bind:value={form.quantityReturned}
					on:input={validateQty}
					class="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					disabled={loading}
					required
				/>
				<p class="text-sm text-gray-500 mt-1">Maksimal: {selectedRental.qty} (jumlah yang dipinjam)</p>
				{#if qtyError}
					<div class="text-red-600 text-sm mt-1">{qtyError}</div>
				{/if}
			</div>

			<!-- Info Peminjam dan Tanggal -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">Peminjam</label>
					<input
						type="text"
						bind:value={form.borrower}
						class="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50"
						readonly
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Peminjaman</label>
					<input
						type="text"
						bind:value={form.borrowDate}
						class="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50"
						readonly
					/>
				</div>
			</div>

			<!-- Tanggal Pengembalian Aktual -->
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">
					Tanggal Pengembalian Aktual <span class="text-red-500">*</span>
				</label>
				<input
					type="date"
					bind:value={form.actualReturnDate}
					class="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					disabled={loading}
					required
				/>
			</div>

			<!-- Status Pengembalian -->
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Status Pengembalian</label>
				<input
					type="text"
					bind:value={form.returnStatus}
					class="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50"
					readonly
				/>
			</div>

			<!-- Kondisi Barang -->
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">
					Kondisi Barang Saat Dikembalikan <span class="text-red-500">*</span>
				</label>
				<select
					bind:value={form.itemCondition}
					class="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					disabled={loading}
					required
				>
					{#each conditionOptions as condition}
						<option value={condition}>{condition}</option>
					{/each}
				</select>
			</div>

			<!-- Keterangan Tambahan -->
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Keterangan Tambahan (Opsional)</label>
				<textarea
					bind:value={form.additionalNotes}
					rows="3"
					class="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					placeholder="Catatan kerusakan, alasan keterlambatan, atau informasi tambahan lainnya..."
					disabled={loading}
				></textarea>
			</div>
		{/if}

		<!-- Tombol Aksi -->
		<div class="flex space-x-4 pt-4">
			<button
				type="submit"
				class="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				disabled={loading || !selectedRental}
			>
				{loading ? 'Memproses...' : 'Kembalikan Barang'}
			</button>
			<button
				type="button"
				on:click={resetForm}
				class="bg-gray-500 text-white px-6 py-2.5 rounded-lg hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
				disabled={loading}
			>
				Reset
			</button>
			<button
				type="button"
				on:click={() => (window.history.length > 1 ? window.history.back() : goto('/inventory'))}
				class="bg-gray-300 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-400 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors disabled:opacity-50"
				disabled={loading}
			>
				Kembali
			</button>
		</div>
	</form>
</div>

<style>
	/* Custom scrollbar untuk dropdown */
	ul {
		scrollbar-width: thin;
		scrollbar-color: #cbd5e0 #f7fafc;
	}
	
	ul::-webkit-scrollbar {
		width: 6px;
	}
	
	ul::-webkit-scrollbar-track {
		background: #f7fafc;
	}
	
	ul::-webkit-scrollbar-thumb {
		background-color: #cbd5e0;
		border-radius: 3px;
	}
</style>