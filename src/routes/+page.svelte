<!-- src/routes/+page.svelte (Comprehensive Inventory Dashboard) -->
<script>
	import { onMount } from 'svelte';

	let loading = true;
	let error = null;
	let inventoryData = {
		totalItems: 0,
		readyItems: 0,
		lowStockItems: 0,
		outOfStockItems: 0
	};
	let rentalData = {
		totalRentals: 0,
		activeRentals: 0,
		overdueRentals: 0,
		returnedToday: 0
	};
	let recentActivities = [];

	onMount(async () => {
		await loadDashboardData();
	});

	async function loadDashboardData() {
		loading = true;
		try {
			// Load inventory statistics
			await loadInventoryStats();
			// Load rental statistics
			await loadRentalStats();
			// Load recent activities
			await loadRecentActivities();
		} catch (err) {
			error = err.message || 'Gagal memuat data dashboard';
			console.error('Dashboard error:', err);
		} finally {
			loading = false;
		}
	}

	async function loadInventoryStats() {
		try {
			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/Barang?fields=StokIn,Status&limit=-1',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);
			if (response.ok) {
				const data = await response.json();
				const items = data.data || [];

				inventoryData = {
					totalItems: items.length,
					readyItems: items.filter((item) => item.StokIn > 5).length,
					lowStockItems: items.filter((item) => item.StokIn > 0 && item.StokIn <= 5).length,
					outOfStockItems: items.filter((item) => item.StokIn === 0).length
				};
			}
		} catch (err) {
			console.error('Error loading inventory stats:', err);
		}
	}

	async function loadRentalStats() {
		try {
			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/rentals?fields=*&limit=-1',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);
			if (response.ok) {
				const data = await response.json();
				const rentals = data.data || [];
				const today = new Date();

				rentalData = {
					totalRentals: rentals.length,
					activeRentals: rentals.filter((r) => !r.returned).length,
					overdueRentals: rentals.filter((r) => {
						if (r.returned) return false;
						const dueDate = new Date(r.borrow_date);
						dueDate.setDate(dueDate.getDate() + r.duration);
						return dueDate < today;
					}).length,
					returnedToday: rentals.filter((r) => {
						if (!r.actual_return_date) return false;
						const returnDate = new Date(r.actual_return_date);
						return returnDate.toDateString() === today.toDateString();
					}).length
				};
			}
		} catch (err) {
			console.error('Error loading rental stats:', err);
		}
	}

	async function loadRecentActivities() {
		try {
			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/rentals?fields=*,barang_id.Nama&sort=-date_created&limit=5',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);
			if (response.ok) {
				const data = await response.json();
				recentActivities = (data.data || []).map((item) => ({
					type: item.returned ? 'return' : 'borrow',
					item: item.barang_id?.Nama || 'Unknown',
					borrower: item.borrower,
					date: item.returned ? item.actual_return_date : item.borrow_date
				}));
			}
		} catch (err) {
			console.error('Error loading recent activities:', err);
		}
	}

	function formatDate(date) {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="md:flex md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
			<p class="mt-1 text-sm text-gray-600">Ringkasan data Inventory PT Eltama Prima Indo</p>
		</div>
		<div class="mt-4 md:mt-0">
			<button
				on:click={loadDashboardData}
				disabled={loading}
				class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
			>
				{#if loading}
					<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
				{:else}
					🔄
				{/if}
				Refresh
			</button>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
			<span class="ml-2 text-gray-600">Memuat data...</span>
		</div>
	{:else if error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
			<p class="text-sm">{error}</p>
		</div>
	{:else}
		<!-- Inventory Statistics -->
		<div class="bg-white rounded-lg shadow p-6">
			<h2 class="text-lg font-medium text-gray-900 mb-4">Statistik Inventory</h2>
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div class="bg-gray-50 rounded-lg p-4">
					<div class="flex items-center">
						<div class="flex-shrink-0">
							<span class="text-2xl">📦</span>
						</div>
						<div class="ml-4">
							<dt class="text-sm font-medium text-gray-500">Total Items</dt>
							<dd class="mt-1 text-2xl font-semibold text-gray-900">{inventoryData.totalItems}</dd>
						</div>
					</div>
				</div>
				<div class="bg-green-50 rounded-lg p-4">
					<div class="flex items-center">
						<div class="flex-shrink-0">
							<span class="text-2xl">✅</span>
						</div>
						<div class="ml-4">
							<dt class="text-sm font-medium text-green-600">Ready</dt>
							<dd class="mt-1 text-2xl font-semibold text-green-900">{inventoryData.readyItems}</dd>
						</div>
					</div>
				</div>
				<div class="bg-yellow-50 rounded-lg p-4">
					<div class="flex items-center">
						<div class="flex-shrink-0">
							<span class="text-2xl">⚠️</span>
						</div>
						<div class="ml-4">
							<dt class="text-sm font-medium text-yellow-600">Low Stock</dt>
							<dd class="mt-1 text-2xl font-semibold text-yellow-900">
								{inventoryData.lowStockItems}
							</dd>
						</div>
					</div>
				</div>
				<div class="bg-red-50 rounded-lg p-4">
					<div class="flex items-center">
						<div class="flex-shrink-0">
							<span class="text-2xl">❌</span>
						</div>
						<div class="ml-4">
							<dt class="text-sm font-medium text-red-600">Out of Stock</dt>
							<dd class="mt-1 text-2xl font-semibold text-red-900">
								{inventoryData.outOfStockItems}
							</dd>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Rental Statistics -->
		<div class="bg-white rounded-lg shadow p-6">
			<h2 class="text-lg font-medium text-gray-900 mb-4">Statistik Rental</h2>
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div class="bg-blue-50 rounded-lg p-4">
					<div class="flex items-center">
						<div class="flex-shrink-0">
							<span class="text-2xl">📋</span>
						</div>
						<div class="ml-4">
							<dt class="text-sm font-medium text-blue-600">Total Rental</dt>
							<dd class="mt-1 text-2xl font-semibold text-blue-900">{rentalData.totalRentals}</dd>
						</div>
					</div>
				</div>
				<div class="bg-orange-50 rounded-lg p-4">
					<div class="flex items-center">
						<div class="flex-shrink-0">
							<span class="text-2xl">🔄</span>
						</div>
						<div class="ml-4">
							<dt class="text-sm font-medium text-orange-600">Sedang Dipinjam</dt>
							<dd class="mt-1 text-2xl font-semibold text-orange-900">
								{rentalData.activeRentals}
							</dd>
						</div>
					</div>
				</div>
				<div class="bg-red-50 rounded-lg p-4">
					<div class="flex items-center">
						<div class="flex-shrink-0">
							<span class="text-2xl">⏰</span>
						</div>
						<div class="ml-4">
							<dt class="text-sm font-medium text-red-600">Terlambat</dt>
							<dd class="mt-1 text-2xl font-semibold text-red-900">{rentalData.overdueRentals}</dd>
						</div>
					</div>
				</div>
				<div class="bg-green-50 rounded-lg p-4">
					<div class="flex items-center">
						<div class="flex-shrink-0">
							<span class="text-2xl">✅</span>
						</div>
						<div class="ml-4">
							<dt class="text-sm font-medium text-green-600">Kembali Hari Ini</dt>
							<dd class="mt-1 text-2xl font-semibold text-green-900">{rentalData.returnedToday}</dd>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Recent Activities -->
		<div class="bg-white rounded-lg shadow p-6">
			<h2 class="text-lg font-medium text-gray-900 mb-4">Aktivitas Terbaru</h2>
			{#if recentActivities.length === 0}
				<p class="text-gray-500 text-sm">Belum ada aktivitas terbaru</p>
			{:else}
				<div class="space-y-3">
					{#each recentActivities as activity}
						<div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
							<div class="flex-shrink-0">
								<span class="text-lg">
									{activity.type === 'borrow' ? '📤' : '📥'}
								</span>
							</div>
							<div class="flex-1">
								<p class="text-sm font-medium text-gray-900">
									{activity.type === 'borrow' ? 'Peminjaman' : 'Pengembalian'}: {activity.item}
								</p>
								<p class="text-xs text-gray-500">
									oleh {activity.borrower} • {formatDate(activity.date)}
								</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Quick Actions -->
		<div class="bg-white rounded-lg shadow p-6">
			<h2 class="text-lg font-medium text-gray-900 mb-4">Aksi Cepat</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<a
					href="/inventory"
					class="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
				>
					<div class="flex items-center">
						<span class="text-2xl mr-3">📦</span>
						<div>
							<h3 class="text-sm font-medium text-gray-900">Kelola Inventory</h3>
							<p class="text-xs text-gray-500">Lihat & update stok barang</p>
						</div>
					</div>
				</a>

				<a
					href="/inventory/rental"
					class="block p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
				>
					<div class="flex items-center">
						<span class="text-2xl mr-3">📋</span>
						<div>
							<h3 class="text-sm font-medium text-gray-900">Kelola Rental</h3>
							<p class="text-xs text-gray-500">Monitor peminjaman barang</p>
						</div>
					</div>
				</a>

				<a
					href="/inventory/peminjaman"
					class="block p-4 border border-gray-200 rounded-lg hover:border-yellow-300 hover:bg-yellow-50 transition-colors"
				>
					<div class="flex items-center">
						<span class="text-2xl mr-3">📤</span>
						<div>
							<h3 class="text-sm font-medium text-gray-900">Pinjam Barang</h3>
							<p class="text-xs text-gray-500">Formulir peminjaman</p>
						</div>
					</div>
				</a>
			</div>
		</div>
	{/if}
</div>
