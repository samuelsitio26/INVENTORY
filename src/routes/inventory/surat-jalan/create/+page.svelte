<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Form data
	let formData = {
		nomor_sj: '',
		tanggal_sj: new Date().toISOString().split('T')[0],
		tanggal_kirim: '',
		kode_customer: '',
		nama_customer: '',
		kode_sales: '',
		nama_sales: '',
		nomor_po_customer: '',
		nomor_so: '',
		alamat_kirim: '',
		keterangan: '',
		items: []
	};

	// Form state
	let loading = false;
	let error = '';
	let success = false;

	onMount(() => {
		// Load data from localStorage if coming from SO Customer
		const sjDataFromSO = localStorage.getItem('sj_data_from_so');
		if (sjDataFromSO) {
			try {
				const data = JSON.parse(sjDataFromSO);
				
				// Fill form with SO data
				formData.kode_customer = data.kode_customer;
				formData.nama_customer = data.nama_customer;
				formData.kode_sales = data.kode_sales;
				formData.nama_sales = data.nama_sales;
				formData.nomor_po_customer = data.nomor_po_customer;
				formData.nomor_so = data.nomor_so;
				formData.tanggal_kirim = data.tanggal_kirim ? new Date(data.tanggal_kirim).toISOString().split('T')[0] : '';
				formData.items = data.items || [];

				// Generate nomor SJ
				generateNomorSJ();

				// Clear from localStorage after use
				localStorage.removeItem('sj_data_from_so');
			} catch (err) {
				console.error('Error parsing SO data:', err);
			}
		} else {
			// Generate nomor SJ for new SJ
			generateNomorSJ();
		}
	});

	function generateNomorSJ() {
		// Generate nomor SJ dengan format: SJ/YYYY/MM/DD/XXX
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
		
		formData.nomor_sj = `SJ/${year}/${month}/${day}/${random}`;
	}

	function addItem() {
		formData.items = [
			...formData.items,
			{
				kode_barang: '',
				nama_barang: '',
				qty: 0,
				satuan: '',
				harga: 0,
				total: 0
			}
		];
	}

	function removeItem(index) {
		formData.items = formData.items.filter((_, i) => i !== index);
	}

	function updateItemTotal(index) {
		const item = formData.items[index];
		item.total = item.qty * item.harga;
		formData.items = [...formData.items];
	}

	async function handleSubmit() {
		loading = true;
		error = '';

		try {
			// Validate required fields
			if (!formData.nomor_sj || !formData.nama_customer || formData.items.length === 0) {
				throw new Error('Mohon lengkapi semua field yang diperlukan');
			}

			// Prepare data for submission
			const submitData = {
				...formData,
				id: Date.now().toString(), // Simple ID generation
				grand_total: formData.items.reduce((sum, item) => sum + (item.total || 0), 0),
				total_qty: formData.items.reduce((sum, item) => sum + (item.qty || 0), 0),
				status: 'draft',
				created_at: new Date().toISOString()
			};

			console.log('Submitting Surat Jalan:', submitData);

			// Save to localStorage for demo purposes
			const existingSJs = JSON.parse(localStorage.getItem('surat_jalans') || '[]');
			existingSJs.push(submitData);
			localStorage.setItem('surat_jalans', JSON.stringify(existingSJs));

			// Here you would normally submit to your API
			// const response = await fetch('/api/surat-jalan', {
			//     method: 'POST',
			//     headers: { 'Content-Type': 'application/json' },
			//     body: JSON.stringify(submitData)
			// });

			success = true;
			setTimeout(() => {
				goto('/inventory/surat-jalan');
			}, 2000);

		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	function cancel() {
		goto('/inventory/so-customer');
	}
</script>

<svelte:head>
	<title>Buat Surat Jalan - Inventory Management</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="sm:flex sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Buat Surat Jalan</h1>
			<p class="mt-1 text-sm text-gray-600">Buat surat jalan baru untuk pengiriman barang</p>
		</div>
		<div class="mt-4 sm:mt-0 flex space-x-3">
			<button
				on:click={cancel}
				class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
			>
				Batal
			</button>
			<button
				on:click={handleSubmit}
				disabled={loading}
				class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
			>
				{loading ? 'Menyimpan...' : 'Simpan SJ'}
			</button>
		</div>
	</div>

	<!-- Success Message -->
	{#if success}
		<div class="bg-green-50 border border-green-200 rounded-md p-4">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-green-800">Surat Jalan berhasil dibuat!</h3>
					<div class="mt-2 text-sm text-green-700">
						<p>Anda akan diarahkan ke halaman daftar surat jalan...</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Error Message -->
	{#if error}
		<div class="bg-red-50 border border-red-200 rounded-md p-4">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-red-800">Error</h3>
					<div class="mt-2 text-sm text-red-700">
						<p>{error}</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Form -->
	<form on:submit|preventDefault={handleSubmit} class="space-y-6">
		<!-- Basic Information -->
		<div class="bg-white shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200">
				<h3 class="text-lg font-medium text-gray-900">Informasi Surat Jalan</h3>
			</div>
			<div class="p-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<label for="nomor_sj" class="block text-sm font-medium text-gray-700 mb-1">
							Nomor SJ *
						</label>
						<input
							id="nomor_sj"
							type="text"
							bind:value={formData.nomor_sj}
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
							readonly
						/>
					</div>
					<div>
						<label for="tanggal_sj" class="block text-sm font-medium text-gray-700 mb-1">
							Tanggal SJ *
						</label>
						<input
							id="tanggal_sj"
							type="date"
							bind:value={formData.tanggal_sj}
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
					</div>
					<div>
						<label for="tanggal_kirim" class="block text-sm font-medium text-gray-700 mb-1">
							Tanggal Kirim
						</label>
						<input
							id="tanggal_kirim"
							type="date"
							bind:value={formData.tanggal_kirim}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
					</div>
					<div>
						<label for="nomor_so" class="block text-sm font-medium text-gray-700 mb-1">
							Nomor SO
						</label>
						<input
							id="nomor_so"
							type="text"
							bind:value={formData.nomor_so}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
							readonly
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- Customer Information -->
		<div class="bg-white shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200">
				<h3 class="text-lg font-medium text-gray-900">Informasi Customer</h3>
			</div>
			<div class="p-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<label for="kode_customer" class="block text-sm font-medium text-gray-700 mb-1">
							Kode Customer
						</label>
						<input
							id="kode_customer"
							type="text"
							bind:value={formData.kode_customer}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
					</div>
					<div>
						<label for="nama_customer" class="block text-sm font-medium text-gray-700 mb-1">
							Nama Customer *
						</label>
						<input
							id="nama_customer"
							type="text"
							bind:value={formData.nama_customer}
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
					</div>
					<div>
						<label for="nomor_po_customer" class="block text-sm font-medium text-gray-700 mb-1">
							Nomor PO Customer
						</label>
						<input
							id="nomor_po_customer"
							type="text"
							bind:value={formData.nomor_po_customer}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
					</div>
					<div>
						<label for="alamat_kirim" class="block text-sm font-medium text-gray-700 mb-1">
							Alamat Kirim
						</label>
						<input
							id="alamat_kirim"
							type="text"
							bind:value={formData.alamat_kirim}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- Sales Information -->
		<div class="bg-white shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200">
				<h3 class="text-lg font-medium text-gray-900">Informasi Sales</h3>
			</div>
			<div class="p-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<label for="kode_sales" class="block text-sm font-medium text-gray-700 mb-1">
							Kode Sales
						</label>
						<input
							id="kode_sales"
							type="text"
							bind:value={formData.kode_sales}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
					</div>
					<div>
						<label for="nama_sales" class="block text-sm font-medium text-gray-700 mb-1">
							Nama Sales
						</label>
						<input
							id="nama_sales"
							type="text"
							bind:value={formData.nama_sales}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- Items -->
		<div class="bg-white shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
				<h3 class="text-lg font-medium text-gray-900">Daftar Barang</h3>
				<button
					type="button"
					on:click={addItem}
					class="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-indigo-600 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
				>
					<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
					</svg>
					Tambah Item
				</button>
			</div>
			<div class="p-6">
				{#if formData.items.length === 0}
					<div class="text-center py-8 text-gray-500">
						<p>Belum ada item. Klik "Tambah Item" untuk menambah barang.</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#each formData.items as item, index}
							<div class="bg-gray-50 rounded-lg p-4 relative">
								<button
									type="button"
									on:click={() => removeItem(index)}
									class="absolute top-2 right-2 text-red-500 hover:text-red-700"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
								
								<div class="grid grid-cols-1 md:grid-cols-5 gap-4">
									<div>
										<label class="block text-xs font-medium text-gray-700 mb-1">
											Kode Barang *
										</label>
										<input
											type="text"
											bind:value={item.kode_barang}
											required
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
										/>
									</div>
									<div>
										<label class="block text-xs font-medium text-gray-700 mb-1">
											Nama Barang *
										</label>
										<input
											type="text"
											bind:value={item.nama_barang}
											required
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
										/>
									</div>
									<div>
										<label class="block text-xs font-medium text-gray-700 mb-1">
											Qty *
										</label>
										<input
											type="number"
											bind:value={item.qty}
											min="0"
											step="1"
											required
											on:input={() => updateItemTotal(index)}
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
										/>
									</div>
									<div>
										<label class="block text-xs font-medium text-gray-700 mb-1">
											Satuan
										</label>
										<input
											type="text"
											bind:value={item.satuan}
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
										/>
									</div>
									<div>
										<label class="block text-xs font-medium text-gray-700 mb-1">
											Harga
										</label>
										<input
											type="number"
											bind:value={item.harga}
											min="0"
											step="0.01"
											on:input={() => updateItemTotal(index)}
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
										/>
									</div>
								</div>
								
								{#if item.harga > 0 && item.qty > 0}
									<div class="mt-2 text-right">
										<span class="text-sm font-medium text-gray-700">
											Total: Rp {(item.total || 0).toLocaleString('id-ID')}
										</span>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Additional Information -->
		<div class="bg-white shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200">
				<h3 class="text-lg font-medium text-gray-900">Informasi Tambahan</h3>
			</div>
			<div class="p-6">
				<div>
					<label for="keterangan" class="block text-sm font-medium text-gray-700 mb-1">
						Keterangan
					</label>
					<textarea
						id="keterangan"
						bind:value={formData.keterangan}
						rows="3"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
						placeholder="Tambahkan catatan atau keterangan khusus..."
					></textarea>
				</div>
			</div>
		</div>

		<!-- Summary -->
		{#if formData.items.length > 0}
			<div class="bg-indigo-50 rounded-lg p-6">
				<h3 class="text-lg font-medium text-indigo-900 mb-4">Ringkasan</h3>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div>
						<div class="text-sm text-indigo-600">Total Item</div>
						<div class="text-2xl font-bold text-indigo-900">{formData.items.length}</div>
					</div>
					<div>
						<div class="text-sm text-indigo-600">Total Qty</div>
						<div class="text-2xl font-bold text-indigo-900">
							{formData.items.reduce((sum, item) => sum + (item.qty || 0), 0)}
						</div>
					</div>
					<div>
						<div class="text-sm text-indigo-600">Grand Total</div>
						<div class="text-2xl font-bold text-indigo-900">
							Rp {formData.items.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('id-ID')}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</form>
</div>
