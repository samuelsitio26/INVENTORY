<script>
	import { onMount } from 'svelte';
	import { getAllSOCustomer } from '$lib/services/socustomer.js';
	import SOCustomerDetailModal from '$lib/components/common/SOCustomerDetailModal.svelte';

	let soCustomers = [];
	let loading = true;
	let error = '';

	// Modal state
	let showDetailModal = false;
	let selectedSO = null;

	// Search and filter
	let searchTerm = '';
	let statusFilter = 'all';

	// Pagination
	let currentPage = 1;
	let itemsPerPage = 10;
	let totalItems = 0;

	// Loading state for status updates
	let updatingStatus = {};

	// Dropdown state
	let openDropdowns = {};

	function toggleDropdown(soId) {
		openDropdowns[soId] = !openDropdowns[soId];
		// Close other dropdowns
		Object.keys(openDropdowns).forEach((id) => {
			if (id !== soId.toString()) {
				openDropdowns[id] = false;
			}
		});
	}

	function closeDropdown(soId) {
		openDropdowns[soId] = false;
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event) {
		if (!event.target.closest('.relative')) {
			Object.keys(openDropdowns).forEach((id) => {
				openDropdowns[id] = false;
			});
		}
	}

	onMount(async () => {
		await loadSOCustomers();

		// Add click outside listener
		document.addEventListener('click', handleClickOutside);

		// Cleanup
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	async function loadSOCustomers() {
		loading = true;
		try {
			soCustomers = await getAllSOCustomer();
			totalItems = soCustomers.length;
			console.log('SO Customers loaded:', soCustomers.length);
		} catch (err) {
			console.error('Error loading SO customers:', err);
			error = 'Gagal memuat data SO Customer';
		} finally {
			loading = false;
		}
	}

	function openDetailModal(so) {
		selectedSO = so;
		showDetailModal = true;
	}

	async function updateSOStatus(soId, newStatus) {
		updatingStatus[soId] = true;

		try {
			const response = await fetch(
				`https://directus.eltamaprimaindo.com/items/so_customer/${soId}`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						status: newStatus
					})
				}
			);

			if (!response.ok) {
				throw new Error('Gagal mengupdate status');
			}

			// Update local data
			soCustomers = soCustomers.map((so) => (so.id === soId ? { ...so, status: newStatus } : so));

			console.log(`Status SO ${soId} berhasil diubah ke ${newStatus}`);
		} catch (err) {
			console.error('Error updating status:', err);
			alert('Gagal mengupdate status SO. Silakan coba lagi.');
		} finally {
			updatingStatus[soId] = false;
		}
	}

	function getStatusColor(status) {
		switch (status) {
			case 'ready':
				return 'bg-green-100 text-green-800';
			case 'pending':
				return 'bg-yellow-100 text-yellow-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function formatCurrency(amount) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR'
		}).format(amount);
	}

	// Filter and search
	$: filteredSOs = soCustomers.filter((so) => {
		const matchesSearch =
			!searchTerm ||
			so.nomor_so?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			so.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			so.sales_name?.toLowerCase().includes(searchTerm.toLowerCase());

		const matchesStatus = statusFilter === 'all' || so.status === statusFilter;

		return matchesSearch && matchesStatus;
	});

	// Pagination
	$: totalPages = Math.ceil(filteredSOs.length / itemsPerPage);
	$: paginatedSOs = filteredSOs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

	function changePage(page) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}
</script>

<svelte:head>
	<title>SO Customer - Inventory Management</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="sm:flex sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">SO Customer</h1>
			<p class="mt-1 text-sm text-gray-600">Kelola dan lihat detail Sales Order dari customer</p>
		</div>
		<div class="mt-4 sm:mt-0">
			<button
				on:click={loadSOCustomers}
				class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
			>
				<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				Refresh Data
			</button>
		</div>
	</div>

	<!-- Search and Filters -->
	<div class="bg-white p-4 rounded-lg shadow">
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div>
				<label for="search" class="block text-sm font-medium text-gray-700 mb-1"> Cari SO </label>
				<input
					id="search"
					type="text"
					bind:value={searchTerm}
					placeholder="Nomor SO, nama customer, atau sales..."
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
				/>
			</div>
			<div>
				<label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">
					Status
				</label>
				<select
					id="status-filter"
					bind:value={statusFilter}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
				>
					<option value="all">Semua Status</option>
					<option value="pending">Pending</option>
					<option value="ready">Ready</option>
				</select>
			</div>
		</div>
	</div>

	<!-- Content -->
	{#if loading}
		<div class="bg-white rounded-lg shadow p-6">
			<div class="flex items-center justify-center py-12">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
				<span class="ml-2 text-gray-600">Memuat data SO Customer...</span>
			</div>
		</div>
	{:else if error}
		<div class="bg-white rounded-lg shadow p-6">
			<div class="text-center py-12">
				<div class="text-red-500 text-lg font-medium">{error}</div>
				<button
					on:click={loadSOCustomers}
					class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
				>
					Coba Lagi
				</button>
			</div>
		</div>
	{:else if filteredSOs.length === 0}
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
				<h3 class="mt-2 text-sm font-medium text-gray-900">Tidak ada SO Customer</h3>
				<p class="mt-1 text-sm text-gray-500">
					{searchTerm || statusFilter !== 'all'
						? 'Tidak ditemukan SO yang sesuai dengan pencarian atau filter.'
						: 'Belum ada data SO Customer.'}
				</p>
			</div>
		</div>
	{:else}
		<!-- SO Customer Table -->
		<div class="bg-white shadow overflow-hidden sm:rounded-lg">
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>
								Nomor SO
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>
								Customer
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>
								Sales
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>
								Tanggal SO
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>
								Tanggal Kirim
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>
								Total
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>
								Items
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>
								Status
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>
								Aksi
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each paginatedSOs as so}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
									{so.nomor_so}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									<div>
										<div class="font-medium text-gray-900">
											{so.company_name || so.customer_name || '-'}
										</div>
										{#if so.nomor_po_customer}
											<div class="text-xs text-gray-500">PO: {so.nomor_po_customer}</div>
										{/if}
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{so.sales_name || '-'} ({so.sales_code || '-'})
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{new Date(so.tanggal_so).toLocaleDateString('id-ID')}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{so.tanggal_kirim
										? new Date(so.tanggal_kirim).toLocaleDateString('id-ID')
										: 'Belum ditentukan'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
									{formatCurrency(so.grand_total || 0)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{so.details?.length || 0} produk
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span
										class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusColor(
											so.status || 'pending'
										)}"
									>
										{so.status === 'ready' ? 'Ready' : 'Pending'}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
									<div class="relative">
										<button
											on:click={() => toggleDropdown(so.id)}
											class="text-gray-400 hover:text-gray-600 p-1"
											aria-label="More actions"
										>
											<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
												<path
													d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
												/>
											</svg>
										</button>

										{#if openDropdowns[so.id]}
											<div
												class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200"
											>
												<div class="py-1">
													<button
														on:click={() => {
															openDetailModal(so);
															closeDropdown(so.id);
														}}
														class="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
													>
														<svg
															class="w-4 h-4 mr-3"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
															/>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
															/>
														</svg>
														View Detail
													</button>

													{#if so.status !== 'ready'}
														<button
															on:click={() => {
																updateSOStatus(so.id, 'ready');
																closeDropdown(so.id);
															}}
															disabled={updatingStatus[so.id]}
															class="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
														>
															{#if updatingStatus[so.id]}
																<svg
																	class="animate-spin w-4 h-4 mr-3"
																	fill="none"
																	viewBox="0 0 24 24"
																>
																	<circle
																		class="opacity-25"
																		cx="12"
																		cy="12"
																		r="10"
																		stroke="currentColor"
																		stroke-width="4"
																	></circle>
																	<path
																		class="opacity-75"
																		fill="currentColor"
																		d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
																	></path>
																</svg>
															{:else}
																<svg
																	class="w-4 h-4 mr-3"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M5 13l4 4L19 7"
																	/>
																</svg>
															{/if}
															Set Ready
														</button>
													{:else}
														<button
															on:click={() => {
																updateSOStatus(so.id, 'pending');
																closeDropdown(so.id);
															}}
															disabled={updatingStatus[so.id]}
															class="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
														>
															{#if updatingStatus[so.id]}
																<svg
																	class="animate-spin w-4 h-4 mr-3"
																	fill="none"
																	viewBox="0 0 24 24"
																>
																	<circle
																		class="opacity-25"
																		cx="12"
																		cy="12"
																		r="10"
																		stroke="currentColor"
																		stroke-width="4"
																	></circle>
																	<path
																		class="opacity-75"
																		fill="currentColor"
																		d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
																	></path>
																</svg>
															{:else}
																<svg
																	class="w-4 h-4 mr-3"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
																	/>
																</svg>
															{/if}
															Set Pending
														</button>
													{/if}
												</div>
											</div>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div
				class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6"
			>
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
							<span class="font-medium"
								>{Math.min(currentPage * itemsPerPage, filteredSOs.length)}</span
							>
							of
							<span class="font-medium">{filteredSOs.length}</span>
							results
						</p>
					</div>
					<div>
						<nav
							class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
							aria-label="Pagination"
						>
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
									class="relative inline-flex items-center px-4 py-2 border text-sm font-medium {currentPage ===
									i + 1
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

<!-- SO Customer Detail Modal -->
<SOCustomerDetailModal
	bind:show={showDetailModal}
	soData={selectedSO}
	on:close={() => {
		showDetailModal = false;
		selectedSO = null;
	}}
/>
