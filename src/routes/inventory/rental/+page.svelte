<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { searchTerm } from '$lib/stores/search.js';

	let data = [];
	let loading = true;
	let error = '';
	let undoTimeouts = {};
	let undoTimers = {};
	let showConfirm = false;
	let confirmAction = null;
	let selectedItem = null;
	let showDetailModal = false;
	let detailItem = null;
	const UNDO_DURATION = 300000; // 5 menit dalam ms

	// 1. User login & role mapping
	let user = null;

	// Simulasi: ambil user dari localStorage/session (atau hardcode untuk demo)
	// Ganti dengan logic login sesungguhnya jika sudah ada
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

	// Function untuk hitung status pengembalian
	function calculateReturnStatus(borrowDate, duration, actualReturnDate, returned) {
		if (!returned) return '-';
		if (!actualReturnDate) return '-';

		const expectedDate = new Date(borrowDate);
		expectedDate.setDate(expectedDate.getDate() + duration);
		const actualDate = new Date(actualReturnDate);

		if (actualDate <= expectedDate) {
			return { status: 'Tepat Waktu', class: 'bg-green-100 text-green-800' };
		} else {
			const diffTime = actualDate - expectedDate;
			const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
			return {
				status: `Terlambat (${diffDays} hari)`,
				class: 'bg-red-100 text-red-800'
			};
		}
	}

	// Function untuk hitung tanggal jatuh tempo
	function calculateDueDate(borrowDate, duration) {
		if (!borrowDate || !duration) return '-';
		const date = new Date(borrowDate);
		date.setDate(date.getDate() + duration);
		return formatDate(date.toISOString());
	}

	// Fetch data dari Directus dengan informasi lengkap
	async function fetchRentalData() {
		try {
			console.log('Fetching rental data from Directus...');

			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/rentals?fields=*,barang_id.id,barang_id.Nama,barang_id.StokIn,barang_id.parent_category.parent_category,barang_id.sub_category.nama_sub',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
						'Content-Type': 'application/json'
					}
				}
			);

			console.log('Response status:', response.status);
			console.log('Response headers:', response.headers);

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

				const returnStatus = calculateReturnStatus(
					item.borrow_date,
					item.duration,
					item.actual_return_date,
					item.returned
				);

				// Penentuan status baru: Pending, Approved, Dipinjam, Dikembalikan
				let status = 'Pending';
				if (item.approved) {
					status = 'Approved';
				}
				if (item.returned) {
					status = 'Dikembalikan';
				} else if (item.borrowed) {
					status = 'Dipinjam';
				}

				return {
					id: item.id || `temp-${index}`,
					nama: item.barang_id?.Nama || '-',
					kategori: item.barang_id?.parent_category?.parent_category || '-',
					subKategori: item.barang_id?.sub_category?.nama_sub || '-',
					qty: item.qty ?? '-',
					peminjam: item.borrower || '-',
					tanggalPinjam: formatDate(item.borrow_date),
					tanggalJatuhTempo: calculateDueDate(item.borrow_date, item.duration),
					durasiPinjam: item.duration ? `${item.duration} hari` : '-',
					tanggalKembaliAktual: item.actual_return_date ? formatDate(item.actual_return_date) : '-',
					status,
					statusPengembalian: returnStatus,
					kondisiKembali: item.return_condition || '-',
					keterangan: item.return_notes || '-',
					undoUntil: null,
					approvals: item.approvals || {},
					// Raw data untuk keperluan lain
					rawBorrowDate: item.borrow_date,
					rawDuration: item.duration,
					rawActualReturnDate: item.actual_return_date
				};
			});
		} catch (e) {
			console.error('Error fetch rental:', e);
			// Return sample data untuk testing jika API gagal
			return [
				{
					id: 'sample-1',
					nama: 'Laptop Dell',
					kategori: 'Elektronik',
					subKategori: 'Komputer',
					qty: 1,
					peminjam: 'John Doe',
					tanggalPinjam: '20-06-2025',
					tanggalJatuhTempo: '27-06-2025',
					durasiPinjam: '7 hari',
					tanggalKembaliAktual: '-',
					status: 'Pending',
					statusPengembalian: '-',
					kondisiKembali: '-',
					keterangan: 'Untuk presentasi client',
					undoUntil: null,
					approvals: {},
					rawBorrowDate: '2025-06-20',
					rawDuration: 7,
					rawActualReturnDate: null
				},
				{
					id: 'sample-2',
					nama: 'Projector Epson',
					kategori: 'Elektronik',
					subKategori: 'Presentasi',
					qty: 1,
					peminjam: 'Jane Smith',
					tanggalPinjam: '15-06-2025',
					tanggalJatuhTempo: '22-06-2025',
					durasiPinjam: '7 hari',
					tanggalKembaliAktual: '21-06-2025',
					status: 'Approved',
					statusPengembalian: { status: 'Tepat Waktu', class: 'bg-green-100 text-green-800' },
					kondisiKembali: 'Baik',
					keterangan: 'Dikembalikan dalam kondisi baik',
					undoUntil: null,
					approvals: {
						dept: {
							by: 'managerdept@eltama.com',
							name: 'Manager Dept',
							at: '2025-06-27T10:00:00Z'
						},
						inventory: {
							by: 'inventoryadmin@eltama.com',
							name: 'Inventory Manager',
							at: '2025-06-27T11:00:00Z'
						},
						procurement: {
							by: 'procurementmanager@eltama.com',
							name: 'Procurement Manager',
							at: '2025-06-27T12:00:00Z'
						}
					},
					rawBorrowDate: '2025-06-15',
					rawDuration: 7,
					rawActualReturnDate: '2025-06-21'
				}
			];
		}
	}

	onMount(async () => {
		try {
			console.log('Component mounted, fetching data...');
			data = await fetchRentalData();
			console.log('Data loaded:', data);
		} catch (e) {
			console.error('Error in onMount:', e);
			error = e.message || 'Gagal mengambil data rental';
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

	function handleReturn(item) {
		// Redirect ke halaman pengembalian dengan autofill data barang
		goto('/inventory/pengembalian', {
			state: {
				barang: item
			}
		});
	}

	function handleViewDetail(item) {
		detailItem = item;
		showDetailModal = true;
	}

	function closeDetailModal() {
		showDetailModal = false;
		detailItem = null;
	}

	function handleUndo(item) {
		openConfirm(item, 'undo');
	}

	function confirmHandler() {
		if (confirmAction === 'return') {
			// Ubah status jadi Dikembalikan, aktifkan undo
			const idx = data.findIndex((d) => d.id === selectedItem.id);
			if (idx !== -1) {
				data[idx].status = 'Dikembalikan';
				data[idx].undoUntil = Date.now() + UNDO_DURATION;
				// Set timer untuk hapus undo
				if (undoTimers[selectedItem.id]) clearTimeout(undoTimers[selectedItem.id]);
				undoTimers[selectedItem.id] = setTimeout(() => {
					const i = data.findIndex((d) => d.id === selectedItem.id);
					if (i !== -1) {
						delete data[i].undoUntil;
					}
				}, UNDO_DURATION);
			}
		} else if (confirmAction === 'undo') {
			// Batalkan pengembalian
			const idx = data.findIndex((d) => d.id === selectedItem.id);
			if (idx !== -1) {
				data[idx].status = 'Dipinjam';
				delete data[idx].undoUntil;
				if (undoTimers[selectedItem.id]) clearTimeout(undoTimers[selectedItem.id]);
			}
		}
		closeConfirm();
	}

	// Fungsi Approve dan Pinjam
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

		// Simpan ke backend Directus
		try {
			await fetch(`https://directus.eltamaprimaindo.com/items/rentals/${item.id}`, {
				method: 'PATCH',
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ approvals: data[idx].approvals })
			});
			// Refresh data agar approval stage update
			data = await fetchRentalData();
		} catch (e) {
			alert('Gagal menyimpan approval ke server!');
		}
	}
	function handlePinjam(item) {
		const idx = data.findIndex((d) => d.id === item.id);
		if (idx !== -1) {
			data[idx].status = 'Dipinjam';
		}
	}

	function canUndo(item) {
		return item.status === 'Dikembalikan' && item.undoUntil && item.undoUntil > Date.now();
	}

	function getUndoCountdown(item) {
		if (!item.undoUntil) return '';
		const ms = item.undoUntil - Date.now();
		if (ms <= 0) return '';
		const min = Math.floor(ms / 60000);
		const sec = Math.floor((ms % 60000) / 1000);
		return `(${min}:${sec.toString().padStart(2, '0')})`;
	}

	// Filter data rental sesuai searchTerm global
	$: filteredData = data.filter((item) => {
		// Filter tanggal pinjam
		let passDate = true;
		if (filterStartDate) {
			const [d, m, y] = item.tanggalPinjam.split('-');
			const tgl = new Date(`${y}-${m}-${d}`);
			passDate = passDate && tgl >= new Date(filterStartDate);
		}
		if (filterEndDate) {
			const [d, m, y] = item.tanggalPinjam.split('-');
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
			item.peminjam?.toLowerCase().includes(search);
		return passDate && passStatus && passSearch;
	});

	function getStatusBadgeClass(status) {
		if (status === 'Pending') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
		if (status === 'Dept Approved') return 'bg-purple-100 text-purple-800 border-purple-300';
		if (status === 'Inventory Approved') return 'bg-indigo-100 text-indigo-800 border-indigo-300';
		if (status === 'Approved') return 'bg-green-100 text-green-800 border-green-300';
		if (status === 'Dipinjam') return 'bg-blue-100 text-blue-800 border-blue-300';
		if (status === 'Dikembalikan') return 'bg-gray-100 text-gray-700 border-gray-300';
		return 'bg-gray-100 text-gray-700 border-gray-300';
	}

	// Hitung barang yang sudah terlambat (status Dipinjam, jatuh tempo < hari ini)
	$: lateItems = data.filter((item) => {
		if (item.status !== 'Dipinjam') return false;
		if (!item.tanggalJatuhTempo) return false;
		const [day, month, year] = item.tanggalJatuhTempo.split('-');
		const dueDate = new Date(`${year}-${month}-${day}`);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return dueDate < today;
	});

	// Hitung barang yang menunggu approval (status Pending atau belum semua approval terpenuhi)
	$: waitingApprovalItems = data.filter((item) => {
		const stage = getApprovalStage(item);
		return stage !== 'done';
	});

	function getStatusLabel(item) {
		const stage = getApprovalStage(item);
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
</script>

<div class="mx-auto px-4 py-8" style="max-width:1600px; font-size:1.1rem;">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
		<div>
			<h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">
				Procurement Peminjaman Barang
			</h1>
			<p class="mt-1 text-sm text-gray-500">Status procurement dan persetujuan peminjaman alat</p>
		</div>
		<div class="flex gap-2 mt-4 sm:mt-0">
			<button
				class="px-5 py-3 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors shadow"
				>Aksi Peminjaman</button
			>
			<button
				class="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow"
				>Refresh</button
			>
		</div>
	</div>

	<div class="bg-white rounded-2xl shadow border border-gray-200 px-4 py-8 min-h-[520px]">
		<div class="flex flex-row gap-8 xl:gap-12">
			<!-- Panel Kiri: Daftar Peminjaman -->
			<div
				class="flex flex-col h-full min-h-0"
				style="width:38%; min-width:420px; max-width:520px;"
			>
				<!-- Filter & Search (tetap di atas, tidak ikut scroll) -->
				<div class="flex flex-col gap-4 mb-4">
					<div class="flex flex-wrap gap-3 items-center">
						<input
							type="date"
							bind:value={filterStartDate}
							class="border border-gray-300 rounded-md px-3 py-2 text-base focus:ring-2 focus:ring-blue-500"
							placeholder="Dari"
							style="width: 170px;"
						/>
						<span class="text-gray-400">-</span>
						<input
							type="date"
							bind:value={filterEndDate}
							class="border border-gray-300 rounded-md px-3 py-2 text-base focus:ring-2 focus:ring-blue-500"
							placeholder="Sampai"
							style="width: 170px;"
						/>
						<select
							bind:value={filterStatus}
							class="border border-gray-300 rounded-md px-3 py-2 text-base focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Semua Status</option>
							<option value="Pending">Pending</option>
							<option value="Dept Approved">Dept Approved</option>
							<option value="Inventory Approved">Inventory Approved</option>
							<option value="Approved">Approved</option>
							<option value="Dipinjam">Dipinjam</option>
							<option value="Dikembalikan">Dikembalikan</option>
						</select>
						<input
							type="text"
							bind:value={filterSearch}
							placeholder="Cari barang/peminjam..."
							class="flex-1 border border-gray-300 rounded-md px-3 py-2 text-base focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>
				<!-- List Card: area scrollable -->
				<div class="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
					<div class="space-y-3">
						{#each filteredData as item, i}
							<div
								class="flex items-center bg-white shadow-sm rounded-lg border border-gray-200 px-6 py-4 gap-4 cursor-pointer hover:shadow-md transition-all procurement-card {selectedItem &&
								selectedItem.id === item.id
									? 'ring-2 ring-blue-400 border-blue-300'
									: ''}"
								on:click={() => (selectedItem = item)}
							>
								<div
									class="w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg bg-blue-50 text-blue-600 border border-blue-200"
								>
									#{i + 1}
								</div>
								<div class="flex-1 min-w-0">
									<div class="font-bold text-gray-900 truncate text-base">{item.nama}</div>
									<div class="text-sm text-gray-500 truncate">
										{item.kategori} &bull; Peminjam: {item.peminjam}
									</div>
								</div>
								<span
									class="ml-auto px-3 py-1 rounded-full text-base font-bold border status-badge {getStatusBadgeClass(
										getStatusLabel(item)
									)}">{getStatusLabel(item)}</span
								>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Panel Kanan: Detail Peminjaman -->
			<div
				class="flex flex-col h-full min-h-0 overflow-y-auto"
				style="width:62%; min-width:520px; max-width:900px; margin-left:-4px; margin-right:-4px;"
			>
				{#if selectedItem}
					<div
						class="bg-blue-50 rounded-2xl shadow border-2 border-blue-200 p-12 flex flex-col gap-8"
						style="margin-left:-4px; margin-right:-4px;"
					>
						<div class="flex items-center justify-between mb-6">
							<h2 class="text-2xl font-extrabold text-gray-900">Detail Barang</h2>
							<span
								class="px-4 py-2 rounded-full text-lg font-bold border {selectedItem.status ===
								'Pending'
									? 'bg-yellow-100 text-yellow-800'
									: selectedItem.status === 'Approved'
										? 'bg-green-100 text-green-800'
										: selectedItem.status === 'Dipinjam'
											? 'bg-blue-100 text-blue-800'
											: 'bg-gray-100 text-gray-700'}">{getStatusLabel(selectedItem)}</span
							>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-10">
							<div class="space-y-4">
								<div class="text-base text-gray-500 uppercase">Nama Barang</div>
								<div class="font-bold text-gray-900 text-xl">{selectedItem.nama}</div>
								<div class="text-base text-gray-500">
									Kategori: {selectedItem.kategori} - {selectedItem.subKategori}
								</div>
								<div class="text-base text-gray-500">Peminjam: {selectedItem.peminjam}</div>
								<div class="text-base text-gray-500">
									Jumlah: <span class="font-bold text-blue-600">{selectedItem.qty} Unit</span>
								</div>
							</div>
							<div class="space-y-4">
								<div class="text-base text-gray-500 uppercase">Tanggal Pinjam</div>
								<div class="text-lg text-gray-900">{selectedItem.tanggalPinjam}</div>
								<div class="text-base text-gray-500">
									Jatuh Tempo: <span class="font-bold text-red-600"
										>{selectedItem.tanggalJatuhTempo}</span
									>
								</div>
								<div class="text-base text-gray-500">Durasi: {selectedItem.durasiPinjam}</div>
								{#if selectedItem.tanggalKembaliAktual !== '-'}
									<div class="text-base text-gray-500">
										Tgl Kembali: {selectedItem.tanggalKembaliAktual}
									</div>
								{/if}
							</div>
						</div>
						<div class="flex flex-col gap-3">
							{#if selectedItem.statusPengembalian && selectedItem.statusPengembalian.status !== '-'}
								<div>
									<span class="text-base font-medium text-gray-500 uppercase tracking-wide"
										>Status Pengembalian</span
									>
									<span
										class="ml-2 inline-block px-3 py-2 rounded-full text-base font-semibold {selectedItem
											.statusPengembalian.class}">{selectedItem.statusPengembalian.status}</span
									>
								</div>
							{/if}
							{#if selectedItem.kondisiKembali !== '-'}
								<div>
									<span class="text-base font-medium text-gray-500 uppercase tracking-wide"
										>Kondisi</span
									>
									<span
										class="ml-2 inline-block px-3 py-2 rounded text-base font-medium {selectedItem.kondisiKembali ===
										'Baik'
											? 'bg-green-100 text-green-700'
											: selectedItem.kondisiKembali === 'Rusak'
												? 'bg-red-100 text-red-700'
												: 'bg-yellow-100 text-yellow-700'}">{selectedItem.kondisiKembali}</span
									>
								</div>
							{/if}
							{#if selectedItem.keterangan && selectedItem.keterangan !== '-'}
								<div>
									<span class="text-base font-medium text-gray-500 uppercase tracking-wide"
										>Catatan</span
									>
									<span class="ml-2 text-base text-gray-700">{selectedItem.keterangan}</span>
								</div>
							{/if}
						</div>
						<!-- Approval Progress -->
						<div class="mb-6">
							<span class="text-base font-medium text-gray-500 uppercase tracking-wide"
								>Alur Persetujuan</span
							>
							<div class="mt-4 space-y-4">
								<div class="flex items-center gap-3">
									<div
										class="w-6 h-6 rounded-full flex items-center justify-center {selectedItem
											.approvals?.dept
											? 'bg-green-500 text-white'
											: 'bg-gray-200 text-gray-400'} font-bold"
									>
										1
									</div>
									<span class="text-xs font-semibold">Manager Dept</span>
									{#if selectedItem.approvals?.dept}
										<span class="text-xs text-green-600"
											>{selectedItem.approvals.dept.name} ({selectedItem.approvals.dept.by}) - {formatDate(
												selectedItem.approvals.dept.at
											)}</span
										>
									{:else}
										<span class="text-xs text-gray-400">Belum disetujui</span>
									{/if}
								</div>
								<div class="flex items-center gap-3">
									<div
										class="w-6 h-6 rounded-full flex items-center justify-center {selectedItem
											.approvals?.inventory
											? 'bg-green-500 text-white'
											: 'bg-gray-200 text-gray-400'} font-bold"
									>
										2
									</div>
									<span class="text-xs font-semibold">Inventory Manager</span>
									{#if selectedItem.approvals?.inventory}
										<span class="text-xs text-green-600"
											>{selectedItem.approvals.inventory?.name} ({selectedItem.approvals.inventory
												?.by}) - {formatDate(selectedItem.approvals.inventory?.at)}</span
										>
									{:else}
										<span class="text-xs text-gray-400">Belum disetujui</span>
									{/if}
								</div>
								<div class="flex items-center gap-3">
									<div
										class="w-6 h-6 rounded-full flex items-center justify-center {selectedItem
											.approvals?.procurement
											? 'bg-green-500 text-white'
											: 'bg-gray-200 text-gray-400'} font-bold"
									>
										3
									</div>
									<span class="text-xs font-semibold">Procurement Manager</span>
									{#if selectedItem.approvals?.procurement}
										<span class="text-xs text-green-600"
											>{selectedItem.approvals.procurement?.name} ({selectedItem.approvals
												.procurement?.by}) - {formatDate(
												selectedItem.approvals.procurement?.at
											)}</span
										>
									{:else}
										<span class="text-xs text-gray-400">Belum disetujui</span>
									{/if}
								</div>
							</div>
						</div>
						<!-- Tombol Aksi -->
						<div class="flex flex-wrap gap-3 mt-8">
							{#if canApprove(user, selectedItem)}
								<button
									class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold shadow"
									on:click={() => handleApprove(selectedItem)}>Approve</button
								>
							{:else if selectedItem.status === 'Approved'}
								<button
									class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-semibold shadow"
									on:click={() => handlePinjam(selectedItem)}>Proses Peminjaman</button
								>
							{:else if selectedItem.status === 'Dipinjam'}
								<button
									class="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-xs font-semibold shadow"
									on:click={() => handleReturn(selectedItem)}>Proses Pengembalian</button
								>
							{:else}
								<button
									class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg border text-xs font-semibold shadow"
									disabled>Lihat Detail</button
								>
							{/if}
							{#if canUndo(selectedItem)}
								<button
									class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs font-semibold shadow"
									on:click={() => handleUndo(selectedItem)}
									>Batalkan {getUndoCountdown(selectedItem)}</button
								>
							{/if}
							<!-- Tombol Edit & Batalkan -->
							<button
								class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg border text-xs font-semibold shadow"
								>Edit Peminjaman</button
							>
							<button
								class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-semibold shadow"
								>Batalkan Peminjaman</button
							>
						</div>
					</div>
				{:else}
					<div class="h-full flex items-center justify-center text-gray-400 text-lg">
						Pilih barang di sebelah kiri untuk melihat detail
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Dialog Konfirmasi -->
	{#if showConfirm}
		<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
			<div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
				<div class="flex items-center mb-4">
					<div class="flex-shrink-0">
						<svg
							class="h-6 w-6 text-blue-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<h3 class="ml-3 text-lg font-medium text-gray-900">Konfirmasi Tindakan</h3>
				</div>
				<div class="mb-6">
					<p class="text-sm text-gray-600">
						{#if confirmAction === 'return'}
							Yakin ingin mengubah status menjadi <span class="font-semibold text-gray-900"
								>Dikembalikan</span
							>
							untuk barang
							<span class="font-semibold text-gray-900">{selectedItem.nama}</span>?
						{:else if confirmAction === 'undo'}
							Yakin ingin <span class="font-semibold text-gray-900">membatalkan pengembalian</span>
							untuk barang
							<span class="font-semibold text-gray-900">{selectedItem.nama}</span>?
						{/if}
					</p>
				</div>
				<div class="flex justify-end space-x-3">
					<button
						class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						on:click={closeConfirm}
					>
						Batal
					</button>
					<button
						class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						on:click={confirmHandler}
					>
						{#if confirmAction === 'return'}
							Ya, Kembalikan
						{:else if confirmAction === 'undo'}
							Ya, Batalkan
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Modal Detail Pengembalian -->
	{#if showDetailModal && detailItem}
		<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
			<div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
				<!-- Header -->
				<div class="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
					<div class="flex justify-between items-center">
						<div>
							<h2 class="text-xl font-bold text-gray-900">Detail Procurement Pengembalian</h2>
							<p class="text-sm text-gray-600">Informasi lengkap pengembalian barang</p>
						</div>
						<button
							class="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
							on:click={closeDetailModal}
							aria-label="Tutup modal detail"
						>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>
				</div>

				<!-- Content -->
				<div class="px-6 py-6">
					<!-- Status Header -->
					<div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
						<div class="flex items-center">
							<svg class="w-5 h-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"
								/>
							</svg>
							<div>
								<h3 class="text-sm font-medium text-green-800">Procurement Selesai</h3>
								<p class="text-xs text-green-600">Barang telah berhasil dikembalikan</p>
							</div>
						</div>
					</div>

					<!-- Detail Grid -->
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
						<!-- Informasi Barang -->
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
									Informasi Barang
								</h3>
								<div class="space-y-4">
									<div>
										<span
											class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
											>Nama Barang</span
										>
										<p class="text-lg font-semibold text-gray-900">{detailItem.nama}</p>
									</div>
									<div class="grid grid-cols-2 gap-4">
										<div>
											<span
												class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
												>Kategori</span
											>
											<p class="text-sm text-gray-900">{detailItem.kategori}</p>
										</div>
										<div>
											<span
												class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
												>Sub Kategori</span
											>
											<p class="text-sm text-gray-900">{detailItem.subKategori}</p>
										</div>
									</div>
									<div class="grid grid-cols-2 gap-4">
										<div>
											<span
												class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
												>Peminjam</span
											>
											<p class="text-sm font-medium text-gray-900">{detailItem.peminjam}</p>
										</div>
										<div>
											<span
												class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
												>Jumlah</span
											>
											<p class="text-sm font-semibold text-blue-600">{detailItem.qty} Unit</p>
										</div>
									</div>
								</div>
							</div>

							<!-- Kondisi dan Status -->
							<div>
								<h3 class="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
									Status & Kondisi
								</h3>
								<div class="space-y-4">
									<div>
										<span
											class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
											>Status Pengembalian</span
										>
										{#if detailItem.statusPengembalian && detailItem.statusPengembalian.status !== '-'}
											<span
												class="inline-block px-3 py-2 rounded-lg text-sm font-semibold {detailItem
													.statusPengembalian.class}"
											>
												{detailItem.statusPengembalian.status}
											</span>
										{:else}
											<p class="text-gray-400">-</p>
										{/if}
									</div>
									<div>
										<span
											class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
											>Kondisi Saat Dikembalikan</span
										>
										{#if detailItem.kondisiKembali !== '-'}
											<span
												class="inline-block px-3 py-2 rounded-lg text-sm font-medium {detailItem.kondisiKembali ===
												'Baik'
													? 'bg-green-100 text-green-700 border border-green-200'
													: detailItem.kondisiKembali === 'Rusak'
														? 'bg-red-100 text-red-700 border border-red-200'
														: 'bg-yellow-100 text-yellow-700 border border-yellow-200'}"
											>
												{detailItem.kondisiKembali}
											</span>
										{:else}
											<p class="text-gray-400">-</p>
										{/if}
									</div>
								</div>
							</div>
						</div>

						<!-- Timeline & Jadwal -->
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
									Timeline Peminjaman
								</h3>
								<div class="space-y-4">
									<div class="flex items-center space-x-3">
										<div class="flex-shrink-0 w-3 h-3 bg-blue-500 rounded-full"></div>
										<div class="flex-1">
											<span class="block text-xs font-medium text-gray-500 uppercase tracking-wide"
												>Tanggal Pinjam</span
											>
											<p class="text-sm text-gray-900">{detailItem.tanggalPinjam}</p>
										</div>
									</div>
									<div class="flex items-center space-x-3">
										<div class="flex-shrink-0 w-3 h-3 bg-orange-500 rounded-full"></div>
										<div class="flex-1">
											<span class="block text-xs font-medium text-gray-500 uppercase tracking-wide"
												>Tanggal Jatuh Tempo</span
											>
											<p class="text-sm font-medium text-orange-600">
												{detailItem.tanggalJatuhTempo}
											</p>
										</div>
									</div>
									<div class="flex items-center space-x-3">
										<div class="flex-shrink-0 w-3 h-3 bg-green-500 rounded-full"></div>
										<div class="flex-1">
											<span class="block text-xs font-medium text-gray-500 uppercase tracking-wide"
												>Tanggal Kembali Aktual</span
											>
											<p class="text-sm text-gray-900">{detailItem.tanggalKembaliAktual}</p>
										</div>
									</div>
									<div class="flex items-center space-x-3">
										<div class="flex-shrink-0 w-3 h-3 bg-gray-400 rounded-full"></div>
										<div class="flex-1">
											<span class="block text-xs font-medium text-gray-500 uppercase tracking-wide"
												>Durasi Pinjam</span
											>
											<p class="text-sm text-gray-900">{detailItem.durasiPinjam}</p>
										</div>
									</div>
								</div>
							</div>

							<!-- Approval Flow -->
							<div>
								<h3 class="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
									Alur Persetujuan
								</h3>
								<div class="space-y-3">
									<div
										class="flex items-center space-x-3 p-3 rounded-lg border"
										class:bg-green-50={detailItem.approvals?.dept}
										class:bg-gray-50={!detailItem.approvals?.dept}
										class:border-green-200={detailItem.approvals?.dept}
										class:border-gray-200={!detailItem.approvals?.dept}
									>
										<svg
											class="w-5 h-5"
											fill="currentColor"
											viewBox="0 0 20 20"
											class:text-green-500={detailItem.approvals?.dept}
											class:text-gray-400={!detailItem.approvals?.dept}
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clip-rule="evenodd"
											/>
										</svg>
										<div class="flex-1">
											<p
												class="text-sm font-medium"
												class:text-green-800={detailItem.approvals?.dept}
												class:text-gray-700={!detailItem.approvals?.dept}
											>
												Manager Dept
											</p>
											{#if detailItem.approvals?.dept}
												<p class="text-xs text-green-600">
													Approved by {detailItem.approvals.dept.name} ({detailItem.approvals.dept
														.by})<br />at {formatDate(detailItem.approvals.dept.at)}
												</p>
											{:else}
												<p class="text-xs text-gray-500">Belum disetujui</p>
											{/if}
										</div>
									</div>
									<div
										class="flex items-center space-x-3 p-3 rounded-lg border"
										class:bg-green-50={detailItem.approvals?.inventory}
										class:bg-gray-50={!detailItem.approvals?.inventory}
										class:border-green-200={detailItem.approvals?.inventory}
										class:border-gray-200={!detailItem.approvals?.inventory}
									>
										<svg
											class="w-5 h-5"
											fill="currentColor"
											viewBox="0 0 20 20"
											class:text-green-500={detailItem.approvals?.inventory}
											class:text-gray-400={!detailItem.approvals?.inventory}
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clip-rule="evenodd"
											/>
										</svg>
										<div class="flex-1">
											<p
												class="text-sm font-medium"
												class:text-green-800={detailItem.approvals?.inventory}
												class:text-gray-700={!detailItem.approvals?.inventory}
											>
												Inventory Manager
											</p>
											{#if detailItem.approvals?.inventory}
												<p class="text-xs text-green-600">
													{selectedItem.approvals.inventory?.name} ({selectedItem.approvals
														.inventory?.by}) - {formatDate(selectedItem.approvals.inventory?.at)}
												</p>
											{:else}
												<p class="text-xs text-gray-500">Belum disetujui</p>
											{/if}
										</div>
									</div>
									<div
										class="flex items-center space-x-3 p-3 rounded-lg border"
										class:bg-green-50={detailItem.approvals?.procurement}
										class:bg-gray-50={!detailItem.approvals?.procurement}
										class:border-green-200={detailItem.approvals?.procurement}
										class:border-gray-200={!detailItem.approvals?.procurement}
									>
										<svg
											class="w-5 h-5"
											fill="currentColor"
											viewBox="0 0 20 20"
											class:text-green-500={detailItem.approvals?.procurement}
											class:text-gray-400={!detailItem.approvals?.procurement}
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clip-rule="evenodd"
											/>
										</svg>
										<div class="flex-1">
											<p
												class="text-sm font-medium"
												class:text-green-800={detailItem.approvals?.procurement}
												class:text-gray-700={!detailItem.approvals?.procurement}
											>
												Procurement Manager
											</p>
											{#if detailItem.approvals?.procurement}
												<p class="text-xs text-green-600">
													{selectedItem.approvals.procurement?.name} ({selectedItem.approvals
														.procurement?.by}) - {formatDate(detailItem.approvals.procurement.at)}
												</p>
											{:else}
												<p class="text-xs text-gray-500">Belum disetujui</p>
											{/if}
										</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Catatan Tambahan -->
						{#if detailItem.keterangan && detailItem.keterangan !== '-'}
							<div class="mt-8 pt-6 border-t border-gray-200">
								<h3 class="text-lg font-semibold text-gray-900 mb-3">Catatan Tambahan</h3>
								<div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
									<p class="text-sm text-gray-900">{detailItem.keterangan}</p>
								</div>
							</div>
						{/if}
					</div>

					<!-- Footer -->
					<div class="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
						<div class="flex justify-between items-center">
							<div class="text-xs text-gray-500">
								ID Procurement: <span class="font-mono text-gray-700">{detailItem.id}</span>
							</div>
							<button
								class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
								on:click={closeDetailModal}
							>
								Tutup
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Card hover effects */
	.procurement-card {
		transition: all 0.3s ease;
	}

	.procurement-card:hover {
		transform: translateY(-2px);
	}

	/* Custom scrollbar for card list */
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: #a0aec0 #f7fafc;
	}
	.custom-scrollbar::-webkit-scrollbar {
		width: 8px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: #f7fafc;
	}

	/* Progress bar animation */
	@keyframes progress {
		0% {
			width: 0%;
		}
		100% {
			width: 65%;
		}
	}

	.progress-bar {
		animation: progress 2s ease-in-out;
	}

	/* Status badge styles */
	.status-badge {
		position: relative;
		overflow: hidden;
	}

	.status-badge::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
		transition: left 0.5s;
	}

	.status-badge:hover::before {
		left: 100%;
	}

	/* Responsive improvements */
	@media (max-width: 1200px) {
		.flex-row {
			flex-direction: column !important;
		}
		/* Panel lebar penuh jika layar kecil */
		div[style*='width:38%'],
		div[style*='width:62%'] {
			min-width: 0 !important;
			max-width: 100% !important;
			width: 100% !important;
		}
	}
	@media (max-width: 768px) {
		.max-w-screen-xl {
			padding: 0.5rem !important;
			font-size: 1rem !important;
		}
		.bg-white.rounded-2xl.shadow.border {
			padding: 1rem !important;
		}
		.p-10,
		.p-12 {
			padding: 1.5rem !important;
		}
		.gap-8,
		.gap-10,
		.gap-12,
		.xl\:gap-16 {
			gap: 1.2rem !important;
		}
		.md\:w-\[40\%\],
		.md\:w-\[60\%\],
		.xl\:w-\[42\%\],
		.xl\:w-\[58\%\] {
			width: 100% !important;
			max-width: 100% !important;
		}
	}
</style>
