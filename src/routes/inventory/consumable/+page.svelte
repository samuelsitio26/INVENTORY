<script></script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { searchTerm } from '$lib/stores/search.js';

	let data = [];
	let loading = true;
	let error = '';
	let selectedItem = null;
	let showConfirm = false;
	let confirmAction = null;
	let showDetailModal = false;
	let detailItem = null;

	// User login & role mapping
	let user = null;

	onMount(() => {
		const email = localStorage.getItem('user_email');
		if (email === 'managerdept@eltama.com') {
			user = { email, role: 'Manager Dept', name: 'Manager Dept' };
		} else if (email === 'inventoryadmin@eltama.com') {
			user = { email, role: 'Inventory Manager', name: 'Inventory Manager' };
		} else if (email === 'procurementmanager@eltama.com') {
			user = { email, role: 'Procurement Manager', name: 'Procurement Manager' };
		} else {
			user = { email: '', role: '', name: '' };
		}
	});

	// Function untuk format tanggal DD-MM-YYYY
	function formatDate(dateStr) {
		if (!dateStr) return '-';
		const date = new Date(dateStr);
		const day = String(date.getDate()).padStart(2, '0');
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const year = date.getFullYear();
		return `${day}-${month}-${year}`;
	}

	// Fetch data consumable dari Directus
	async function fetchConsumableData() {
		try {
			console.log('Fetching consumable data from Directus...');

			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/consumables?fields=*,barang_id.id,barang_id.Nama,barang_id.StokIn,barang_id.parent_category.parent_category,barang_id.sub_category.nama_sub',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
						'Content-Type': 'application/json'
					}
				}
			);

			console.log('Response status:', response.status);

			if (!response.ok) {
				const errorText = await response.text();
				console.error('API Error Response:', errorText);
				throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
			}

			const result = await response.json();
			console.log('API Response:', result);

			if (!result.data) {
				console.warn('No data property in response:', result);
				return [];
			}

			return result.data.map((item, index) => {
				console.log(`Processing item ${index + 1}:`, item);

				// Status: Pending, Approved, Used
				let status = 'Pending';
				if (item.approved) {
					status = 'Approved';
				}
				if (item.used) {
					status = 'Used';
				}

				return {
					id: item.id || `temp-${index}`,
					nama: item.barang_id?.Nama || '-',
					kategori: item.barang_id?.parent_category?.parent_category || '-',
					subKategori: item.barang_id?.sub_category?.nama_sub || '-',
					qty: item.qty ?? '-',
					requestedBy: item.requested_by || '-',
					tanggalRequest: formatDate(item.request_date),
					tanggalApproval: item.approval_date ? formatDate(item.approval_date) : '-',
					tanggalPakai: item.use_date ? formatDate(item.use_date) : '-',
					status,
					keperluan: item.purpose || '-',
					keterangan: item.notes || '-',
					approvals: item.approvals || {},
					// Raw data untuk keperluan lain
					rawRequestDate: item.request_date,
					rawApprovalDate: item.approval_date,
					rawUseDate: item.use_date
				};
			});
		} catch (e) {
			console.error('Error fetch consumable:', e);
			// Return sample data untuk testing jika API gagal
			return [
				{
					id: 'sample-1',
					nama: 'Kertas A4',
					kategori: 'Office Supplies',
					subKategori: 'Stationery',
					qty: 5,
					requestedBy: 'John Doe',
					tanggalRequest: '20-06-2025',
					tanggalApproval: '21-06-2025',
					tanggalPakai: '-',
					status: 'Approved',
					keperluan: 'Untuk printing dokumen',
					keterangan: 'Urgent untuk meeting client',
					approvals: {
						dept: {
							by: 'managerdept@eltama.com',
							name: 'Manager Dept',
							at: '2025-06-21T10:00:00Z'
						}
					},
					rawRequestDate: '2025-06-20',
					rawApprovalDate: '2025-06-21',
					rawUseDate: null
				},
				{
					id: 'sample-2',
					nama: 'Tinta Printer HP',
					kategori: 'Office Supplies',
					subKategori: 'Printer Supplies',
					qty: 2,
					requestedBy: 'Jane Smith',
					tanggalRequest: '18-06-2025',
					tanggalApproval: '19-06-2025',
					tanggalPakai: '20-06-2025',
					status: 'Used',
					keperluan: 'Refill tinta printer departemen',
					keterangan: 'Tinta sudah habis, perlu segera diganti',
					approvals: {
						dept: {
							by: 'managerdept@eltama.com',
							name: 'Manager Dept',
							at: '2025-06-19T09:00:00Z'
						},
						inventory: {
							by: 'inventoryadmin@eltama.com',
							name: 'Inventory Manager',
							at: '2025-06-19T10:00:00Z'
						}
					},
					rawRequestDate: '2025-06-18',
					rawApprovalDate: '2025-06-19',
					rawUseDate: '2025-06-20'
				}
			];
		}
	}

	onMount(async () => {
		try {
			console.log('Component mounted, fetching data...');
			data = await fetchConsumableData();
			console.log('Data loaded:', data);
		} catch (e) {
			console.error('Error in onMount:', e);
			error = e.message || 'Gagal mengambil data consumable';
		} finally {
			loading = false;
		}
	});

	function openConfirm(item, action) {
		selectedItem = item;
		confirmAction = action;
		showConfirm = true;
	}

	function closeConfirm() {
		showConfirm = false;
		selectedItem = null;
		confirmAction = null;
	}

	function handleViewDetail(item) {
		detailItem = item;
		showDetailModal = true;
	}

	function closeDetailModal() {
		showDetailModal = false;
		detailItem = null;
	}

	function confirmHandler() {
		if (confirmAction === 'use') {
			// Ubah status jadi Used
			const idx = data.findIndex((d) => d.id === selectedItem.id);
			if (idx !== -1) {
				data[idx].status = 'Used';
				data[idx].tanggalPakai = formatDate(new Date().toISOString());
			}
		} else if (confirmAction === 'approve') {
			// Approve item
			const idx = data.findIndex((d) => d.id === selectedItem.id);
			if (idx !== -1) {
				data[idx].status = 'Approved';
				data[idx].tanggalApproval = formatDate(new Date().toISOString());
			}
		}
		closeConfirm();
	}

	// Fungsi Approve
	function getApprovalStage(item) {
		if (!item.approvals?.dept) return 'dept';
		if (!item.approvals?.inventory) return 'inventory';
		if (!item.approvals?.procurement) return 'procurement';
		return 'done';
	}

	function canApprove(user, item) {
		const stage = getApprovalStage(item);
		if (stage === 'dept' && user.role === 'Manager Dept') return true;
		if (stage === 'inventory' && user.role === 'Inventory Manager') return true;
		if (stage === 'procurement' && user.role === 'Procurement Manager') return true;
		return false;
	}

	async function handleApprove(item) {
		const idx = data.findIndex((d) => d.id === item.id);
		if (idx === -1) return;
		const now = new Date().toISOString();
		if (!data[idx].approvals) data[idx].approvals = {};
		const stage = getApprovalStage(data[idx]);
		if (stage === 'dept') {
			data[idx].approvals.dept = { by: user.email, name: user.name, at: now };
		} else if (stage === 'inventory') {
			data[idx].approvals.inventory = { by: user.email, name: user.name, at: now };
		} else if (stage === 'procurement') {
			data[idx].approvals.procurement = { by: user.email, name: user.name, at: now };
		}

		// Check if all approvals are done
		if (getApprovalStage(data[idx]) === 'done') {
			data[idx].status = 'Approved';
		}

		// Simpan ke backend Directus
		try {
			await fetch(`https://directus.eltamaprimaindo.com/items/consumables/${item.id}`, {
				method: 'PATCH',
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ 
					approvals: data[idx].approvals,
					approved: getApprovalStage(data[idx]) === 'done'
				})
			});
			// Refresh data agar approval stage update
			data = await fetchConsumableData();
		} catch (e) {
			alert('Gagal menyimpan approval ke server!');
		}
	}

	function handleUse(item) {
		openConfirm(item, 'use');
	}

	function getStatusBadgeClass(status) {
		if (status === 'Pending') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
		if (status === 'Dept Approved') return 'bg-purple-100 text-purple-800 border-purple-300';
		if (status === 'Inventory Approved') return 'bg-indigo-100 text-indigo-800 border-indigo-300';
		if (status === 'Approved') return 'bg-green-100 text-green-800 border-green-300';
		if (status === 'Used') return 'bg-gray-100 text-gray-700 border-gray-300';
		return 'bg-gray-100 text-gray-700 border-gray-300';
	}

	function getStatusLabel(item) {
		const stage = getApprovalStage(item);
		if (item.status === 'Used') return 'Used';
		if (stage === 'dept') return 'Pending';
		if (stage === 'inventory') return 'Dept Approved';
		if (stage === 'procurement') return 'Inventory Approved';
		if (stage === 'done') return 'Approved';
		return 'Pending';
	}

	let filterStartDate = '';
	let filterEndDate = '';
	let filterStatus = '';
	let filterSearch = '';

	// Filter data consumable sesuai filter
	$: filteredData = data.filter((item) => {
		// Filter tanggal request
		let passDate = true;
		if (filterStartDate) {
			const [d, m, y] = item.tanggalRequest.split('-');
			const tgl = new Date(`${y}-${m}-${d}`);
			passDate = passDate && tgl >= new Date(filterStartDate);
		}
		if (filterEndDate) {
			const [d, m, y] = item.tanggalRequest.split('-');
			const tgl = new Date(`${y}-${m}-${d}`);
			passDate = passDate && tgl <= new Date(filterEndDate);
		}
		// Filter status
		let passStatus = !filterStatus || getStatusLabel(item) === filterStatus;
		// Filter search
		let search = filterSearch.toLowerCase();
		let passSearch =
			!search ||
			item.nama?.toLowerCase().includes(search) ||
			item.kategori?.toLowerCase().includes(search) ||
			item.subKategori?.toLowerCase().includes(search) ||
			item.requestedBy?.toLowerCase().includes(search) ||
			item.keperluan?.toLowerCase().includes(search);
		return passDate && passStatus && passSearch;
	});

	// Pilihan Warna Gradient dengan color preview
	let colorOptions = [
		{
			name: 'Orange',
			gradient: 'from-white to-orange-900 border-orange-900',
			color: 'bg-orange-900',
			preview: 'bg-gradient-to-br from-white to-orange-900'
		},
		{
			name: 'Purple',
			gradient: 'from-white to-purple-900 border-purple-900',
			color: 'bg-purple-900',
			preview: 'bg-gradient-to-br from-white to-purple-900'
		},
		{
			name: 'Pink',
			gradient: 'from-white to-pink-900 border-pink-900',
			color: 'bg-pink-900',
			preview: 'bg-gradient-to-br from-white to-pink-900'
		},
		{
			name: 'Emerald',
			gradient: 'from-white to-emerald-900 border-emerald-900',
			color: 'bg-emerald-900',
			preview: 'bg-gradient-to-br from-white to-emerald-900'
		},
		{
			name: 'Cyan',
			gradient: 'from-white to-cyan-900 border-cyan-900',
			color: 'bg-cyan-900',
			preview: 'bg-gradient-to-br from-white to-cyan-900'
		}
	];
	let selectedGradient = colorOptions[0].gradient;

	function handleAddConsumable() {
		goto('/inventory/consumable/create');
	}

	function handleRefresh() {
		location.reload();
	}
</script>

<div
	class="mx-auto px-4 py-8"
	style="max-width:1600px; font-size:1.1rem; margin-left:-50px; margin-right:-50px;"
>
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
		<div>
			<h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">
				Manajemen Barang Consumable
			</h1>
			<p class="mt-1 text-sm text-gray-500">Kelola permintaan dan penggunaan barang habis pakai</p>
		</div>
		<div class="flex gap-2 mt-4 sm:mt-0">
			<button
				on:click={handleAddConsumable}
				class="px-5 py-3 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 transition-colors shadow"
				>Tambah Request</button
			>
			<button
				on:click={handleRefresh}
				class="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow"
				>Refresh</button
			>
		</div>
	</div>

	<div
		class="bg-white rounded-2xl shadow border border-gray-200 px-4 py-8 min-h-[520px] max-h-[800px]"
		style="margin-left:-20px; margin-right:-20px;"
	>
		<div class="flex flex-row gap-8 xl:gap-12">
			<!-- Panel Kiri: Daftar Consumable -->
			<div
				class="flex flex-col h-full min-h-0"
				style="width:38%; min-width:420px; max-width:520px;"
			>
				<!-- Filter & Search -->
				<div
					class="flex flex-col gap-3 mb-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm"
				>
					<div class="flex flex-wrap gap-2 items-center">
						<input
							type="date"
							bind:value={filterStartDate}
							class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
							placeholder="Dari"
							style="width: 150px;"
						/>
						<span class="text-gray-400 text-sm">sampai</span>
						<input
							type="date"
							bind:value={filterEndDate}
							class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
							placeholder="Sampai"
							style="width: 150px;"
						/>
					</div>
					<div class="flex flex-wrap gap-2 items-center">
						<select
							bind:value={filterStatus}
							class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors bg-white"
							style="min-width: 140px;"
						>
							<option value="">Semua Status</option>
							<option value="Pending">Pending</option>
							<option value="Dept Approved">Dept Approved</option>
							<option value="Inventory Approved">Inventory Approved</option>
							<option value="Approved">Approved</option>
							<option value="Used">Used</option>
						</select>
						<input
							type="text"
							bind:value={filterSearch}
							placeholder="Cari barang/pemohon..."
							class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
							style="min-width: 200px;"
						/>
					</div>
				</div>
				<!-- List Card: area scrollable -->
				<div
					class="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar max-h-[480px] border border-gray-300 rounded-xl p-3 bg-gradient-to-b from-gray-50 to-white shadow-inner"
				>
					<div class="space-y-2 pb-2">
						{#each filteredData as item, i}
							<div
								class="flex items-center bg-white shadow-sm rounded-xl border border-gray-200 px-5 py-3 gap-4 cursor-pointer hover:shadow-lg hover:border-orange-300 transition-all duration-200 {selectedItem &&
								selectedItem.id === item.id
									? 'ring-2 ring-orange-500 border-orange-400 shadow-lg bg-orange-50'
									: 'hover:bg-gray-50'}"
								on:click={() => (selectedItem = item)}
							>
								<div
									class="w-9 h-9 flex items-center justify-center rounded-full font-bold text-sm bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md"
								>
									#{i + 1}
								</div>
								<div class="flex-1 min-w-0">
									<div class="font-bold text-gray-900 truncate text-sm">{item.nama}</div>
									<div class="text-xs text-gray-500 truncate">
										{item.kategori} • Pemohon: {item.requestedBy}
									</div>
								</div>
								<span
									class="ml-auto px-3 py-1.5 rounded-full text-xs font-bold border {getStatusBadgeClass(
										getStatusLabel(item)
									)}">{getStatusLabel(item)}</span
								>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Panel Kanan: Detail Consumable -->
			<div
				class="flex-1 min-h-0 flex flex-col overflow-y-auto"
				style="min-width:420px; max-width:900px; width:100%; min-height:400px; max-height:calc(100vh - 120px);"
			>
				<div class="flex-1 min-h-0 flex flex-col h-full">
					{#if selectedItem}
						<!-- Area scroll dengan custom scrollbar -->
						<div
							class="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-0"
							style="height:100%; max-height:100%;"
						>
							<div
								class={`bg-gradient-to-br ${selectedGradient} rounded-2xl shadow-lg p-8 flex flex-col gap-6 h-full min-h-[400px] overflow-y-auto max-h-full`}
							>
								<div class="flex items-center justify-between mb-6">
									<div class="flex items-center gap-4">
										<div
											class="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg"
										>
											<svg
												class="w-6 h-6 text-white"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
												/>
											</svg>
										</div>
										<div>
											<h2 class="text-2xl font-bold text-gray-900">Detail Consumable</h2>
											<p class="text-sm text-gray-600">Informasi lengkap permintaan barang</p>
										</div>
									</div>
									<span
										class="px-4 py-2 rounded-full text-sm font-bold border shadow-sm {getStatusBadgeClass(
											getStatusLabel(selectedItem)
										)}"
										>{getStatusLabel(selectedItem)}</span
									>
								</div>
								
								<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
									<!-- Card Informasi Barang -->
									<div
										class="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300"
									>
										<div class="flex items-center gap-3 mb-4">
											<div
												class="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-sm"
											>
												<svg
													class="w-5 h-5 text-white"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
													/>
												</svg>
											</div>
											<div>
												<h3 class="text-lg font-bold text-gray-900">Informasi Barang</h3>
												<p class="text-xs text-gray-500">Detail produk consumable</p>
											</div>
										</div>
										<div class="space-y-4">
											<div class="p-3 bg-gray-50 rounded-xl">
												<div class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
													Nama Barang
												</div>
												<div class="font-bold text-gray-900 text-lg">{selectedItem.nama}</div>
											</div>
											<div class="grid grid-cols-1 gap-3">
												<div class="p-3 bg-blue-50 rounded-xl border border-blue-100">
													<div
														class="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1"
													>
														Kategori
													</div>
													<div class="text-sm text-gray-900 font-semibold">
														{selectedItem.kategori}
													</div>
												</div>
												<div class="grid grid-cols-2 gap-3">
													<div class="p-3 bg-purple-50 rounded-xl border border-purple-100">
														<div
															class="text-xs font-medium text-purple-600 uppercase tracking-wide mb-1"
														>
															Sub Kategori
														</div>
														<div class="text-sm text-gray-900 font-semibold">
															{selectedItem.subKategori}
														</div>
													</div>
													<div class="p-3 bg-orange-50 rounded-xl border border-orange-100">
														<div
															class="text-xs font-medium text-orange-600 uppercase tracking-wide mb-1"
														>
															Qty
														</div>
														<div class="text-sm text-gray-900 font-semibold">
															{selectedItem.qty}
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>

									<!-- Card Timeline -->
									<div
										class="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300"
									>
										<div class="flex items-center gap-3 mb-4">
											<div
												class="w-10 h-10 bg-gradient-to-r from-rose-500 to-pink-600 rounded-lg flex items-center justify-center shadow-sm"
											>
												<svg
													class="w-5 h-5 text-white"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
													/>
												</svg>
											</div>
											<div>
												<h3 class="text-lg font-bold text-gray-900">Timeline</h3>
												<p class="text-xs text-gray-500">Riwayat permohonan</p>
											</div>
										</div>
										<div class="space-y-4">
											<div class="p-3 bg-gray-50 rounded-xl">
												<div class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
													Tanggal Request
												</div>
												<div class="text-lg text-gray-900 font-bold">
													{selectedItem.tanggalRequest}
												</div>
											</div>
											<div class="grid grid-cols-1 gap-3">
												<div class="p-3 bg-green-50 rounded-xl border border-green-100">
													<div
														class="text-xs font-medium text-green-600 uppercase tracking-wide mb-1"
													>
														Tanggal Approval
													</div>
													<div class="text-sm text-gray-900 font-semibold">
														{selectedItem.tanggalApproval}
													</div>
												</div>
												<div class="p-3 bg-red-50 rounded-xl border border-red-100">
													<div
														class="text-xs font-medium text-red-600 uppercase tracking-wide mb-1"
													>
														Tanggal Pakai
													</div>
													<div class="text-sm text-gray-900 font-semibold">
														{selectedItem.tanggalPakai}
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>

								<!-- Informasi Request -->
								<div class="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
									<div class="flex items-center gap-3 mb-4">
										<div
											class="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm"
										>
											<svg
												class="w-5 h-5 text-white"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
												/>
											</svg>
										</div>
										<div>
											<h3 class="text-lg font-bold text-gray-900">Informasi Request</h3>
											<p class="text-xs text-gray-500">Detail permohonan</p>
										</div>
									</div>
									<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div class="p-3 bg-gray-50 rounded-xl">
											<div class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
												Pemohon
											</div>
											<div class="text-sm text-gray-900 font-semibold">
												{selectedItem.requestedBy}
											</div>
										</div>
										<div class="p-3 bg-yellow-50 rounded-xl border border-yellow-100">
											<div class="text-xs font-medium text-yellow-600 uppercase tracking-wide mb-1">
												Keperluan
											</div>
											<div class="text-sm text-gray-900 font-semibold">
												{selectedItem.keperluan}
											</div>
										</div>
									</div>
									{#if selectedItem.keterangan && selectedItem.keterangan !== '-'}
										<div class="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
											<div class="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">
												Keterangan
											</div>
											<div class="text-sm text-gray-900">
												{selectedItem.keterangan}
											</div>
										</div>
									{/if}
								</div>

								<!-- Action Buttons -->
								{#if user && user.role}
									<div class="flex gap-3 mt-4">
										{#if canApprove(user, selectedItem)}
											<button
												on:click={() => handleApprove(selectedItem)}
												class="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-lg"
											>
												Approve
											</button>
										{/if}
										{#if selectedItem.status === 'Approved' && user.role === 'Inventory Manager'}
											<button
												on:click={() => handleUse(selectedItem)}
												class="px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors shadow-lg"
											>
												Tandai Sudah Digunakan
											</button>
										{/if}
									</div>
								{/if}

								<!-- Approval Progress -->
								<div class="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mt-4">
									<h4 class="text-sm font-semibold text-gray-900 mb-3">Alur Persetujuan</h4>
									<!-- Horizontal Approval Flow -->
									<div class="flex items-center justify-between relative">
										<div class="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0"></div>
										
										<!-- Dept Approval -->
										<div class="relative z-10 flex flex-col items-center">
											<div class={`w-10 h-10 rounded-full flex items-center justify-center ${selectedItem.approvals?.dept ? 'bg-green-500' : 'bg-gray-300'}`}>
												<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													{#if selectedItem.approvals?.dept}
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
													{:else}
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 6.292 4 4 0 010-6.292zM15 21H3v-1a6 6 0 0112 0v1z"/>
													{/if}
												</svg>
											</div>
											<div class="mt-2 text-center">
												<div class="text-xs font-semibold text-gray-900">Dept Manager</div>
												<div class="text-xs text-gray-500">
													{selectedItem.approvals?.dept ? selectedItem.approvals.dept.name : 'Waiting'}
												</div>
											</div>
										</div>

										<!-- Inventory Approval -->
										<div class="relative z-10 flex flex-col items-center">
											<div class={`w-10 h-10 rounded-full flex items-center justify-center ${selectedItem.approvals?.inventory ? 'bg-green-500' : 'bg-gray-300'}`}>
												<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													{#if selectedItem.approvals?.inventory}
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
													{:else}
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
													{/if}
												</svg>
											</div>
											<div class="mt-2 text-center">
												<div class="text-xs font-semibold text-gray-900">Inventory</div>
												<div class="text-xs text-gray-500">
													{selectedItem.approvals?.inventory ? selectedItem.approvals.inventory.name : 'Waiting'}
												</div>
											</div>
										</div>

										<!-- Final Status -->
										<div class="relative z-10 flex flex-col items-center">
											<div class={`w-10 h-10 rounded-full flex items-center justify-center ${selectedItem.status === 'Used' ? 'bg-blue-500' : selectedItem.status === 'Approved' ? 'bg-green-500' : 'bg-gray-300'}`}>
												<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													{#if selectedItem.status === 'Used'}
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
													{:else if selectedItem.status === 'Approved'}
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
													{:else}
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
													{/if}
												</svg>
											</div>
											<div class="mt-2 text-center">
												<div class="text-xs font-semibold text-gray-900">Status</div>
												<div class="text-xs text-gray-500">
													{selectedItem.status}
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					{:else}
						<!-- Empty state -->
						<div
							class="flex-1 min-h-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 h-full min-h-[400px]"
						>
							<div class="text-center">
								<svg
									class="mx-auto h-12 w-12 text-gray-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
									/>
								</svg>
								<h3 class="mt-2 text-sm font-medium text-gray-900">Pilih barang di sebelah kiri</h3>
								<p class="mt-1 text-sm text-gray-500">untuk melihat detail consumable</p>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Color Picker Boxes -->
	<div class="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
		<label class="block text-sm font-medium text-gray-700 mb-3">Pilih Warna Background</label>
		<div class="flex gap-3 flex-wrap">
			{#each colorOptions as colorOpt}
				<button
					on:click={() => (selectedGradient = colorOpt.gradient)}
					class={`relative w-12 h-12 rounded-lg ${colorOpt.preview} border-2 hover:scale-105 transition-transform duration-200 ${selectedGradient === colorOpt.gradient ? 'border-gray-800 ring-2 ring-gray-400' : 'border-gray-300'}`}
					title={colorOpt.name}
				>
					{#if selectedGradient === colorOpt.gradient}
						<div class="absolute inset-0 flex items-center justify-center">
							<svg class="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
							</svg>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- Dialog Konfirmasi -->
	{#if showConfirm}
		<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
			<div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
				<div class="flex items-center mb-4">
					<div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
						<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"/>
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-semibold text-gray-900">Konfirmasi</h3>
						<p class="text-sm text-gray-500">Pastikan aksi yang akan dilakukan</p>
					</div>
				</div>
				<div class="mb-6">
					{#if confirmAction === 'use'}
						<p class="text-gray-700">
							Apakah Anda yakin ingin menandai <strong>{selectedItem?.nama}</strong> sebagai sudah digunakan?
						</p>
					{/if}
				</div>
				<div class="flex justify-end space-x-3">
					<button
						on:click={closeConfirm}
						class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
					>
						Batal
					</button>
					<button
						on:click={confirmHandler}
						class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
					>
						Ya, Lanjutkan
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}
</style>
