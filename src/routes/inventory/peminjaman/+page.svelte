<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';

	let form = {
		itemId: '',
		name: '',
		borrower: '',
		borrowDate: new Date().toISOString().split('T')[0],
		duration: 1,
		qty: 1 // jumlah barang yang ingin dipinjam
	};
	let items = [];
	let loading = false;
	let error = null;
	let selectedItem = null;
	let showDropdown = false;
	let filteredItems = [];
	let dropdownRef;
	let qtyError = '';

	function filterItems() {
		if (!form.name) {
			filteredItems = items;
			return;
		}
		filteredItems = items.filter((item) =>
			item.name.toLowerCase().includes(form.name.toLowerCase())
		);
	}

	function selectItem(item) {
		selectedItem = item;
		form.itemId = item.id;
		form.name = item.name;
		form.qty = 1;
		qtyError = '';
		showDropdown = false;
	}

	function validateQty() {
		if (!selectedItem) return;
		const qty = Number(form.qty);
		if (!qty || qty < 1) {
			qtyError = 'Jumlah pinjam minimal 1';
			return false;
		}
		if (qty > selectedItem.stockIn) {
			qtyError = `Jumlah pinjam tidak boleh melebihi stok (${selectedItem.stockIn})`;
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

<div class="space-y-6 p-6 bg-white-100 min-h-screen">
	<h1 class="text-2xl font-bold text-gray-900">Peminjaman Barang</h1>
	<form on:submit|preventDefault={handleSubmit} class="bg-white rounded-lg shadow p-6 space-y-4">
		<div class="relative" bind:this={dropdownRef}>
			<label class="block text-sm font-medium text-gray-700 mb-1.5">Nama Barang</label>
			<input
				type="text"
				bind:value={form.name}
				on:input={() => {
					filterItems();
					showDropdown = true;
					selectedItem = null;
					form.itemId = '';
				}}
				on:focus={() => {
					filterItems();
					showDropdown = true;
				}}
				class="block w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
				placeholder="Masukkan nama barang"
				autocomplete="off"
				disabled={loading}
			/>
			{#if showDropdown && filteredItems.length > 0}
				<ul
					class="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-48 overflow-auto shadow-lg"
				>
					{#each filteredItems as item}
						<li
							class="px-4 py-2 hover:bg-blue-100 cursor-pointer"
							on:click={() => selectItem(item)}
						>
							{item.name} (Stok: {item.stockIn})
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		{#if selectedItem}
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-3 rounded mb-2 mt-2">
				<div>
					<label class="block text-xs font-medium text-gray-500">Kategori</label>
					<div class="font-semibold text-gray-800">{selectedItem.category}</div>
				</div>
				<div>
					<label class="block text-xs font-medium text-gray-500">Sub Kategori</label>
					<div class="font-semibold text-gray-800">{selectedItem.subCategory}</div>
				</div>
				<div>
					<label class="block text-xs font-medium text-gray-500">Stok</label>
					<div class="font-semibold text-gray-800">{selectedItem.stockIn}</div>
				</div>
			</div>
			<div class="mb-2">
				<label class="block text-sm font-medium text-gray-700">Jumlah Pinjam</label>
				<input
					type="number"
					min="1"
					max={selectedItem.stockIn}
					bind:value={form.qty}
					on:input={validateQty}
					class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
					disabled={loading}
				/>
				{#if qtyError}
					<div class="text-red-600 text-xs mt-1">{qtyError}</div>
				{/if}
			</div>
		{/if}
		<div>
			<label class="block text-sm font-medium text-gray-700">Peminjam</label>
			<input
				type="text"
				bind:value={form.borrower}
				required
				class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
				disabled={loading}
			/>
		</div>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<label class="block text-sm font-medium text-gray-700">Tanggal Peminjaman</label>
				<input
					type="date"
					bind:value={form.borrowDate}
					required
					class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
					disabled={loading}
				/>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700">Durasi Peminjaman (hari)</label>
				<input
					type="number"
					min="1"
					bind:value={form.duration}
					required
					class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
					disabled={loading}
				/>
				<div class="mt-2 text-sm text-gray-600">
					Tanggal Pengembalian: <b>{returnDate}</b>
				</div>
			</div>
		</div>
		<div class="flex space-x-4">
			<button
				type="submit"
				class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
				disabled={loading}>Pinjam</button
			>
			<button
				type="button"
				on:click={resetForm}
				class="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
				disabled={loading}>Reset</button
			>
			<button
				type="button"
				on:click={() => (window.history.length > 1 ? window.history.back() : goto('/inventory'))}
				class="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
				disabled={loading}
			>
				Kembali
			</button>
		</div>
	</form>
</div>
