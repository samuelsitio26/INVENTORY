<script>
	import { onMount } from 'svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';

	let loading = false;
	let error = null;
	let toast = { show: false, message: '', type: 'success' };
	
	// State untuk data finished goods yang perlu diproduksi
	let productionNotifications = [];
	let filteredNotifications = [];
	
	// Paginasi
	let currentPage = 1;
	const itemsPerPage = 20;
	let totalItems = 0;
	let paginatedItems = [];
	
	// Filter dan search
	let searchTerm = '';
	let priorityFilter = 'all';

	onMount(() => {
		loadProductionNotifications();
	});

	async function loadProductionNotifications() {
		loading = true;
		try {
			const response = await fetch('https://directus.eltamaprimaindo.com/items/finishgood', {
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				}
			});
			
			if (!response.ok) {
				throw new Error('Failed to fetch finished goods');
			}
			
			const data = await response.json();
			const finishedGoods = data.data.map(item => ({
				...item,
				status: calculateStatus(item.sisa_stok || 0)
			}));
			
			// Filter items yang perlu diproduksi (stok <= 10)
			productionNotifications = finishedGoods
				.filter(item => item.sisa_stok <= 10)
				.sort((a, b) => a.sisa_stok - b.sisa_stok)
				.map(item => ({
					...item,
					priority: item.sisa_stok === 0 ? 'urgent' : item.sisa_stok <= 5 ? 'high' : 'medium',
					tanggal_notifikasi: new Date().toLocaleDateString('id-ID')
				}));
			
			filteredNotifications = productionNotifications;
			totalItems = productionNotifications.length;
			updatePaginatedItems();
		} catch (err) {
			error = err.message;
			console.error('Load Production Notifications Error:', err);
		} finally {
			loading = false;
		}
	}

	function calculateStatus(stock) {
		if (stock === 0) return 'Out of Stock';
		if (stock < 10) return 'Low Stock';
		return 'Ready';
	}

	function getPriorityColor(priority) {
		switch (priority) {
			case 'urgent': return 'bg-red-500';
			case 'high': return 'bg-orange-500';
			case 'medium': return 'bg-yellow-500';
			default: return 'bg-gray-500';
		}
	}

	function getPriorityText(priority) {
		switch (priority) {
			case 'urgent': return 'URGENT';
			case 'high': return 'HIGH';
			case 'medium': return 'MEDIUM';
			default: return 'LOW';
		}
	}

	function updatePaginatedItems() {
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		paginatedItems = filteredNotifications.slice(start, end);
	}

	function handleSearch() {
		filteredNotifications = productionNotifications.filter(item => {
			const matchesSearch = searchTerm === '' || 
				item.nama_barang.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.kode_barang.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.warna.toLowerCase().includes(searchTerm.toLowerCase());
			
			const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
			
			return matchesSearch && matchesPriority;
		});
		
		totalItems = filteredNotifications.length;
		currentPage = 1;
		updatePaginatedItems();
	}

	function nextPage() {
		if (currentPage < Math.ceil(totalItems / itemsPerPage)) {
			currentPage++;
			updatePaginatedItems();
		}
	}

	function previousPage() {
		if (currentPage > 1) {
			currentPage--;
			updatePaginatedItems();
		}
	}

	function goToPage(page) {
		currentPage = page;
		updatePaginatedItems();
	}

	function markAsProduced(item) {
		toast = {
			show: true,
			message: `${item.nama_barang} telah ditandai sebagai diproduksi. Silakan update stok di halaman Finished Goods.`,
			type: 'success'
		};
		setTimeout(() => toast.show = false, 5000);
	}

	// Reactive statements
	$: {
		if (searchTerm !== undefined || priorityFilter !== undefined) {
			handleSearch();
		}
	}

	$: totalPages = Math.ceil(totalItems / itemsPerPage);
	$: startItem = (currentPage - 1) * itemsPerPage + 1;
	$: endItem = Math.min(currentPage * itemsPerPage, totalItems);
</script>

<svelte:head>
	<title>Produksi Notifications - Inventory Management</title>
</svelte:head>

<div class="p-6 max-w-full mx-auto">
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Produksi Notifications</h1>
			<p class="text-gray-600">Daftar finished goods yang perlu diproduksi untuk restock</p>
		</div>
		<div class="flex gap-2">
			<button
				class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
				on:click={() => window.location.reload()}
			>
				Refresh
			</button>
		</div>
	</div>

	{#if toast.show}
		<div class="fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg {
			toast.type === 'success' ? 'bg-green-500' : 
			toast.type === 'warning' ? 'bg-yellow-500' : 
			'bg-red-500'
		} text-white">
			{toast.message}
		</div>
	{/if}

	<!-- Filters -->
	<div class="bg-white rounded-lg shadow p-4 mb-6">
		<div class="flex flex-wrap gap-4 items-center">
			<div class="flex-1 min-w-64">
				<label for="search-input" class="block text-sm font-medium text-gray-700 mb-1">Search</label>
				<input
					id="search-input"
					type="text"
					bind:value={searchTerm}
					placeholder="Cari berdasarkan nama barang, kode barang, atau warna..."
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
			<div class="min-w-48">
				<label for="priority-filter" class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
				<select
					id="priority-filter"
					bind:value={priorityFilter}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="all">Semua Priority</option>
					<option value="urgent">Urgent</option>
					<option value="high">High</option>
					<option value="medium">Medium</option>
				</select>
			</div>
		</div>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Total Items</div>
			<div class="text-2xl font-bold text-gray-900">{productionNotifications.length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Urgent</div>
			<div class="text-2xl font-bold text-red-600">{productionNotifications.filter(item => item.priority === 'urgent').length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">High Priority</div>
			<div class="text-2xl font-bold text-orange-600">{productionNotifications.filter(item => item.priority === 'high').length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Medium Priority</div>
			<div class="text-2xl font-bold text-yellow-600">{productionNotifications.filter(item => item.priority === 'medium').length}</div>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-8">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
			<span class="ml-2 text-gray-600">Loading...</span>
		</div>
	{:else if error}
		<div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
			<div class="flex">
				<div class="text-red-400">⚠️</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-red-800">Error</h3>
					<div class="mt-2 text-sm text-red-700">{error}</div>
				</div>
			</div>
		</div>
	{:else if productionNotifications.length === 0}
		<div class="bg-green-50 border border-green-200 rounded-md p-8 text-center">
			<div class="text-green-600 text-6xl mb-4">✅</div>
			<h3 class="text-lg font-medium text-green-800 mb-2">Semua Stok Mencukupi!</h3>
			<p class="text-green-700">Tidak ada finished goods yang perlu diproduksi saat ini.</p>
		</div>
	{:else}
		<!-- Table -->
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode Barang</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Barang</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warna</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kemasan</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sisa Stok</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Notifikasi</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each paginatedItems as item}
							<tr class="hover:bg-gray-50 {item.priority === 'urgent' ? 'bg-red-50' : item.priority === 'high' ? 'bg-orange-50' : 'bg-yellow-50'}">
								<td class="px-4 py-4 whitespace-nowrap">
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white {getPriorityColor(item.priority)}">
										{getPriorityText(item.priority)}
									</span>
								</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.kode_barang}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama_barang}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
									<div class="flex items-center">
										<div class="w-4 h-4 rounded-full mr-2 border border-gray-300" style="background-color: {item.warna ? '#' + item.warna : '#CCCCCC'};"></div>
										{item.warna || '-'}
									</div>
								</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.kemasan || '-'}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
									<span class="font-bold {item.sisa_stok === 0 ? 'text-red-600' : item.sisa_stok <= 5 ? 'text-orange-600' : 'text-yellow-600'}">
										{item.sisa_stok}
									</span>
								</td>
								<td class="px-4 py-4 whitespace-nowrap">
									<StatusBadge status={item.status} />
								</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.tanggal_notifikasi}</td>
								<td class="px-4 py-4 whitespace-nowrap">
									<button
										class="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
										on:click={() => markAsProduced(item)}
									>
										Tandai Diproduksi
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
					<div class="flex-1 flex justify-between items-center">
						<div>
							<p class="text-sm text-gray-700">
								Menampilkan <span class="font-medium">{startItem}</span> sampai <span class="font-medium">{endItem}</span> dari <span class="font-medium">{totalItems}</span> hasil
							</p>
						</div>
						<div class="flex items-center space-x-2">
							<button
								on:click={previousPage}
								disabled={currentPage === 1}
								class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Previous
							</button>
							
							{#each Array(totalPages) as _, i}
								{#if i + 1 === currentPage}
									<button
										class="px-3 py-1 border border-blue-500 bg-blue-50 text-blue-600 rounded-md text-sm font-medium"
									>
										{i + 1}
									</button>
								{:else if i + 1 === 1 || i + 1 === totalPages || (i + 1 >= currentPage - 1 && i + 1 <= currentPage + 1)}
									<button
										on:click={() => goToPage(i + 1)}
										class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
									>
										{i + 1}
									</button>
								{:else if i + 1 === currentPage - 2 || i + 1 === currentPage + 2}
									<span class="px-1 text-gray-500">...</span>
								{/if}
							{/each}
							
							<button
								on:click={nextPage}
								disabled={currentPage === totalPages}
								class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Next
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
