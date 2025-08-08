<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let suratJalans = [];
	let loading = true;
	let error = '';

	// Search and filter
	let searchTerm = '';
	let statusFilter = 'all';

	// Pagination
	let currentPage = 1;
	let itemsPerPage = 10;

	onMount(async () => {
		await loadSuratJalans();
	});

	async function loadSuratJalans() {
		loading = true;
		try {
			// For now, load from localStorage (in real app, load from API)
			const stored = localStorage.getItem('surat_jalans');
			if (stored) {
				suratJalans = JSON.parse(stored);
			}
			
			console.log('Surat Jalans loaded:', suratJalans.length);
		} catch (err) {
			console.error('Error loading Surat Jalans:', err);
			error = 'Gagal memuat data Surat Jalan';
		} finally {
			loading = false;
		}
	}

	function createNew() {
		goto('/inventory/surat-jalan/create');
	}

	function formatDate(dateString) {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('id-ID');
	}

	function formatCurrency(amount) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR'
		}).format(amount || 0);
	}

	// Filter and search
	$: filteredSJs = suratJalans.filter((sj) => {
		const matchesSearch =
			!searchTerm ||
			sj.nomor_sj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			sj.nama_customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			sj.nomor_so?.toLowerCase().includes(searchTerm.toLowerCase());

		const matchesStatus = statusFilter === 'all' || sj.status === statusFilter;

		return matchesSearch && matchesStatus;
	});

	// Pagination
	$: totalPages = Math.ceil(filteredSJs.length / itemsPerPage);
	$: paginatedSJs = filteredSJs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

	function changePage(page) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}

	async function terbitkanSuratJalan(sjId) {
		try {
			// Update status SJ dari draft ke done
			const updatedSJs = suratJalans.map(sj => 
				sj.id === sjId ? { ...sj, status: 'done', published_at: new Date().toISOString() } : sj
			);
			
			// Save ke localStorage
			localStorage.setItem('surat_jalans', JSON.stringify(updatedSJs));
			
			// Update local state
			suratJalans = updatedSJs;
			
			// Navigate ke halaman print (akan dibuat nanti)
			goto(`/inventory/surat-jalan/print/${sjId}`);
			
		} catch (error) {
			console.error('Error terbitkan surat jalan:', error);
			alert('Gagal menerbitkan surat jalan. Silakan coba lagi.');
		}
	}

	function printSuratJalan(sjId) {
		goto(`/inventory/surat-jalan/print/${sjId}`);
	}
</script>

<svelte:head>
	<title>Surat Jalan - Inventory Management</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="sm:flex sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Surat Jalan</h1>
			<p class="mt-1 text-sm text-gray-600">Kelola surat jalan pengiriman barang</p>
		</div>
		<div class="mt-4 sm:mt-0 flex space-x-3">
			<button
				on:click={loadSuratJalans}
				class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
			>
				<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				Refresh
			</button>
			<button
				on:click={createNew}
				class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
			>
				<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
				</svg>
				Buat Surat Jalan
			</button>
		</div>
	</div>

	<!-- Search and Filters -->
	<div class="bg-white p-4 rounded-lg shadow">
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div>
				<label for="search" class="block text-sm font-medium text-gray-700 mb-1">Cari SJ</label>
				<input
					id="search"
					type="text"
					bind:value={searchTerm}
					placeholder="Nomor SJ, customer, atau nomor SO..."
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
				/>
			</div>
			<div>
				<label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
				<select
					id="status-filter"
					bind:value={statusFilter}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
				>
					<option value="all">Semua Status</option>
					<option value="draft">Draft</option>
					<option value="done">Done</option>
					<option value="confirmed">Confirmed</option>
					<option value="delivered">Delivered</option>
				</select>
			</div>
		</div>
	</div>

	<!-- Content -->
	{#if loading}
		<div class="bg-white rounded-lg shadow p-6">
			<div class="flex items-center justify-center py-12">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
				<span class="ml-2 text-gray-600">Memuat data Surat Jalan...</span>
			</div>
		</div>
	{:else if error}
		<div class="bg-white rounded-lg shadow p-6">
			<div class="text-center py-12">
				<div class="text-red-500 text-lg font-medium">{error}</div>
				<button
					on:click={loadSuratJalans}
					class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
				>
					Coba Lagi
				</button>
			</div>
		</div>
	{:else if filteredSJs.length === 0}
		<div class="bg-white rounded-lg shadow p-6">
			<div class="text-center py-12">
				<svg
					class="mx-auto h-12 w-12 text-gray-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				<h3 class="mt-2 text-sm font-medium text-gray-900">Belum ada Surat Jalan</h3>
				<p class="mt-1 text-sm text-gray-500">
					{searchTerm || statusFilter !== 'all'
						? 'Tidak ditemukan SJ yang sesuai dengan pencarian atau filter.'
						: 'Mulai dengan membuat surat jalan pertama Anda.'}
				</p>
				{#if !searchTerm && statusFilter === 'all'}
					<div class="mt-6">
						<button
							on:click={createNew}
							class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
						>
							<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
							</svg>
							Buat Surat Jalan Pertama
						</button>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Surat Jalan Cards -->
		<div class="grid gap-6">
			{#each paginatedSJs as sj}
				<div class="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
					<div class="p-6">
						<!-- Header -->
						<div class="flex items-start justify-between mb-4">
							<div>
								<h3 class="text-lg font-semibold text-gray-900">SJ: {sj.nomor_sj}</h3>
								<p class="text-sm text-gray-600">
									{sj.nama_customer}
									{#if sj.nomor_so}
										<span class="text-gray-400">• SO: {sj.nomor_so}</span>
									{/if}
								</p>
							</div>
							<div class="flex items-center space-x-2">
								<span
									class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {sj.status === 'delivered'
										? 'bg-green-100 text-green-800'
										: sj.status === 'confirmed'
										? 'bg-blue-100 text-blue-800'
										: sj.status === 'done'
										? 'bg-green-100 text-green-800'
										: 'bg-yellow-100 text-yellow-800'}"
								>
									{sj.status === 'delivered' 
										? 'Delivered' 
										: sj.status === 'confirmed' 
										? 'Confirmed' 
										: sj.status === 'done'
										? 'Done'
										: 'Draft'}
								</span>
								
								<!-- Action buttons -->
								<div class="flex space-x-2">
									{#if sj.status === 'draft'}
										<button
											on:click={() => terbitkanSuratJalan(sj.id)}
											class="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
										>
											<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											Terbitkan
										</button>
									{:else if sj.status === 'done'}
										<button
											on:click={() => printSuratJalan(sj.id)}
											class="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
										>
											<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
											</svg>
											Print
										</button>
									{/if}
								</div>
							</div>
						</div>

						<!-- SJ Information -->
						<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
							<div>
								<div class="text-xs font-medium text-gray-500 uppercase">Tanggal SJ</div>
								<p class="text-sm text-gray-900">{formatDate(sj.tanggal_sj)}</p>
							</div>
							<div>
								<div class="text-xs font-medium text-gray-500 uppercase">Tanggal Kirim</div>
								<p class="text-sm text-gray-900">{formatDate(sj.tanggal_kirim) || 'Belum ditentukan'}</p>
							</div>
							<div>
								<div class="text-xs font-medium text-gray-500 uppercase">Total Items</div>
								<p class="text-sm text-gray-900">{sj.items?.length || 0} produk</p>
							</div>
							<div>
								<div class="text-xs font-medium text-gray-500 uppercase">Total Qty</div>
								<p class="text-sm text-gray-900">
									{sj.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0}
								</p>
							</div>
						</div>

						<!-- Product Summary -->
						{#if sj.items && sj.items.length > 0}
							<div>
								<h4 class="text-sm font-medium text-gray-700 mb-3">Ringkasan Barang:</h4>
								<div class="grid gap-2">
									{#each sj.items.slice(0, 3) as item}
										<div class="flex items-center justify-between p-2 bg-gray-50 rounded">
											<div class="flex-1">
												<p class="text-sm font-medium text-gray-900">
													{item.kode_barang} - {item.nama_barang}
												</p>
											</div>
											<div class="text-sm text-gray-600">
												{item.qty} {item.satuan || 'pcs'}
											</div>
										</div>
									{/each}
									{#if sj.items.length > 3}
										<div class="text-sm text-gray-500 text-center py-2">
											... dan {sj.items.length - 3} item lainnya
										</div>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
				<div class="flex-1 flex justify-between sm:hidden">
					<button
						on:click={() => changePage(currentPage - 1)}
						disabled={currentPage === 1}
						class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Previous
					</button>
					<button
						on:click={() => changePage(currentPage + 1)}
						disabled={currentPage === totalPages}
						class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Next
					</button>
				</div>
				<div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
					<div>
						<p class="text-sm text-gray-700">
							Showing
							<span class="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
							to
							<span class="font-medium">{Math.min(currentPage * itemsPerPage, filteredSJs.length)}</span>
							of
							<span class="font-medium">{filteredSJs.length}</span>
							results
						</p>
					</div>
					<div>
						<nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
							<button
								on:click={() => changePage(currentPage - 1)}
								disabled={currentPage === 1}
								class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<span class="sr-only">Previous</span>
								<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
										clip-rule="evenodd"
									/>
								</svg>
							</button>

							{#each Array(totalPages) as _, i}
								<button
									on:click={() => changePage(i + 1)}
									class="relative inline-flex items-center px-4 py-2 border text-sm font-medium {currentPage === i + 1
										? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
										: 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}"
								>
									{i + 1}
								</button>
							{/each}

							<button
								on:click={() => changePage(currentPage + 1)}
								disabled={currentPage === totalPages}
								class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<span class="sr-only">Next</span>
								<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
										clip-rule="evenodd"
									/>
								</svg>
							</button>
						</nav>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
