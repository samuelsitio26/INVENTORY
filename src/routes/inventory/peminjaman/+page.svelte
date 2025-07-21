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

	// Pilihan Warna Gradient dengan color preview
	let colorOptions = [
		{
			name: 'Blue',
			gradient: 'from-white to-blue-900 border-blue-900',
			color: 'bg-blue-900',
			preview: 'bg-gradient-to-br from-white to-blue-900'
		},
		{
			name: 'Green',
			gradient: 'from-white to-green-900 border-green-900',
			color: 'bg-green-900',
			preview: 'bg-gradient-to-br from-white to-green-900'
		},
		{
			name: 'Red',
			gradient: 'from-white to-red-900 border-red-900',
			color: 'bg-red-900',
			preview: 'bg-gradient-to-br from-white to-red-900'
		},
		{
			name: 'Teal',
			gradient: 'from-white to-teal-900 border-teal-900',
			color: 'bg-teal-900',
			preview: 'bg-gradient-to-br from-white to-teal-900'
		},
		{
			name: 'Indigo',
			gradient: 'from-white to-indigo-900 border-indigo-900',
			color: 'bg-indigo-900',
			preview: 'bg-gradient-to-br from-white to-indigo-900'
		}
	];
	let selectedGradient = colorOptions[0].gradient;

	// Fungsi untuk edit peminjaman
	function handleEditPeminjaman(item) {
		if (!user || !user.role) {
			alert('Akses ditolak: Role user tidak valid');
			return;
		}

		// Hanya bisa edit jika belum disetujui sepenuhnya
		const stage = getApprovalStage(item);
		if (stage === 'done' && item.status !== 'Pending') {
			alert('Tidak dapat mengedit: Peminjaman sudah disetujui sepenuhnya');
			return;
		}

		// Redirect ke halaman edit atau buka modal edit
		// Untuk sementara, tampilkan alert sebagai placeholder
		alert(`Edit peminjaman "${item.nama}"\n\nFitur edit akan diarahkan ke halaman/modal edit peminjaman`);
		
		// TODO: Implementasi redirect atau modal edit
		// goto(`/inventory/rental/edit/${item.id}`);
	}

	function handleAddPeminjaman() {
		goto('/inventory/peminjaman/create');
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
				Peminjaman Barang
			</h1>
			<p class="mt-1 text-sm text-gray-500">Status procurement dan persetujuan peminjaman alat</p>
		</div>
		<div class="flex gap-2 mt-4 sm:mt-0">
			<button
				on:click={handleAddPeminjaman}
				class="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow"
				>Tambah Peminjaman</button
			>
			<button
				on:click={handleRefresh}
				class="px-5 py-3 bg-gray-600 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors shadow"
				>Refresh</button
			>
		</div>
	</div>

	<div
		class="bg-white rounded-2xl shadow border border-gray-200 px-4 py-8 min-h-[520px]"
		style="margin-left:-20px; margin-right:-20px;"
	>
		<!-- Panel Atas: Daftar Peminjaman -->
		<div class="mb-8">
			<div class="flex justify-between items-center mb-4">
				<h2 class="text-xl font-bold text-gray-900">Daftar Peminjaman</h2>
			</div>
			
			<!-- Filter & Search -->
			<div class="flex flex-col gap-3 mb-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
				<div class="flex flex-wrap gap-2 items-center">
					<input
						type="date"
						bind:value={filterStartDate}
						class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
						placeholder="Dari"
						style="width: 150px;"
					/>
					<span class="text-gray-400 text-sm">sampai</span>
					<input
						type="date"
						bind:value={filterEndDate}
						class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
						placeholder="Sampai"
						style="width: 150px;"
					/>
					<select
						bind:value={filterStatus}
						class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
						style="min-width: 140px;"
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
						class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
						style="min-width: 200px;"
					/>
				</div>
			</div>

			<!-- List Cards dalam Grid -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar">
				{#each filteredData as item, i}
					<div
						class="bg-white shadow-sm rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200 {selectedItem &&
						selectedItem.id === item.id
							? 'ring-2 ring-blue-500 border-blue-400 shadow-lg bg-blue-50'
							: 'hover:bg-gray-50'}"
						on:click={() => (selectedItem = item)}
					>
						<div class="flex items-center gap-3 mb-3">
							<div class="w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs bg-gradient-to-r from-blue-500 to-blue-600 text-white">
								#{i + 1}
							</div>
							<span class="px-2 py-1 rounded-full text-xs font-bold border {getStatusBadgeClass(getStatusLabel(item))}">{getStatusLabel(item)}</span>
						</div>
						<div class="space-y-2">
							<div class="font-bold text-gray-900 text-sm">{item.nama}</div>
							<div class="text-xs text-gray-500">{item.kategori}</div>
							<div class="text-xs text-gray-600">Peminjam: {item.peminjam}</div>
							<div class="text-xs text-gray-600">Tanggal: {item.tanggalPinjam}</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Panel Bawah: Detail Peminjaman -->
		{#if selectedItem}
			<div class="border-t border-gray-200 pt-8">
				<div class="flex items-center gap-3 mb-6">
					<div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
						<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
						</svg>
					</div>
					<div>
						<h3 class="text-xl font-bold text-gray-900">Detail Peminjaman</h3>
						<p class="text-sm text-gray-500">Informasi lengkap peminjaman barang: {selectedItem.nama}</p>
					</div>
				</div>
				
				<!-- Tabel Detail Horizontal -->
				<div class="overflow-x-auto">
					<table class="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
						<thead>
							<tr class="bg-blue-50">
								<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Nama Barang</th>
								<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Kategori</th>
								<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Sub Kategori</th>
								<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Qty</th>
								<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Peminjam</th>
								<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Tgl Pinjam</th>
								<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Jatuh Tempo</th>
								<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Durasi</th>
								<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Tgl Kembali</th>
								<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
								{#if selectedItem.statusPengembalian && selectedItem.statusPengembalian.status !== '-'}
									<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Status Pengembalian</th>
								{/if}
								{#if selectedItem.kondisiKembali !== '-'}
									<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Kondisi</th>
								{/if}
								{#if selectedItem.keterangan && selectedItem.keterangan !== '-'}
									<th class="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">Keterangan</th>
								{/if}
							</tr>
						</thead>
						<tbody class="bg-white">
							<tr class="hover:bg-gray-50">
								<td class="border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold text-center">{selectedItem.nama}</td>
								<td class="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">{selectedItem.kategori}</td>
								<td class="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">{selectedItem.subKategori}</td>
								<td class="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">{selectedItem.qty}</td>
								<td class="border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold text-center">{selectedItem.peminjam}</td>
								<td class="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">{selectedItem.tanggalPinjam}</td>
								<td class="border border-gray-300 px-4 py-3 text-sm text-center">
									<span class="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">{selectedItem.tanggalJatuhTempo}</span>
								</td>
								<td class="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">{selectedItem.durasiPinjam}</td>
								<td class="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">{selectedItem.tanggalKembaliAktual}</td>
								<td class="border border-gray-300 px-4 py-3 text-sm text-center">
									<span class="px-3 py-1 rounded-full text-xs font-bold border {getStatusBadgeClass(getStatusLabel(selectedItem))}">{getStatusLabel(selectedItem)}</span>
								</td>
								{#if selectedItem.statusPengembalian && selectedItem.statusPengembalian.status !== '-'}
									<td class="border border-gray-300 px-4 py-3 text-sm text-center">
										<span class="px-3 py-1 rounded-full text-xs font-medium {selectedItem.statusPengembalian.class || 'bg-gray-100 text-gray-800'}">
											{selectedItem.statusPengembalian.status}
										</span>
									</td>
								{/if}
								{#if selectedItem.kondisiKembali !== '-'}
									<td class="border border-gray-300 px-4 py-3 text-sm text-center">
										<span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">{selectedItem.kondisiKembali}</span>
									</td>
								{/if}
								{#if selectedItem.keterangan && selectedItem.keterangan !== '-'}
									<td class="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">{selectedItem.keterangan}</td>
								{/if}
							</tr>
						</tbody>
					</table>
				</div>

				<!-- Action Buttons -->
				{#if user && user.role}
					<div class="flex gap-3 mt-6">
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
								on:click={() => handlePinjam(selectedItem)}
								class="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
							>
								Tandai Dipinjam
							</button>
						{/if}
						{#if selectedItem.status === 'Dipinjam'}
							<button
								on:click={() => handleReturn(selectedItem)}
								class="px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors shadow-lg"
							>
								Kembalikan
							</button>
						{/if}
						{#if canUndo(selectedItem)}
							<button
								on:click={() => handleUndo(selectedItem)}
								class="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-lg"
							>
								Undo {getUndoCountdown(selectedItem)}
							</button>
						{/if}
					</div>
				{/if}

				<!-- Approval Progress -->
				<div class="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mt-6">
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

						<!-- Procurement Approval -->
						<div class="relative z-10 flex flex-col items-center">
							<div class={`w-10 h-10 rounded-full flex items-center justify-center ${selectedItem.approvals?.procurement ? 'bg-green-500' : 'bg-gray-300'}`}>
								<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									{#if selectedItem.approvals?.procurement}
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
									{:else}
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
									{/if}
								</svg>
							</div>
							<div class="mt-2 text-center">
								<div class="text-xs font-semibold text-gray-900">Procurement</div>
								<div class="text-xs text-gray-500">
									{selectedItem.approvals?.procurement ? selectedItem.approvals.procurement.name : 'Waiting'}
								</div>
							</div>
						</div>

						<!-- Final Status -->
						<div class="relative z-10 flex flex-col items-center">
							<div class={`w-10 h-10 rounded-full flex items-center justify-center ${selectedItem.status === 'Dikembalikan' ? 'bg-blue-500' : selectedItem.status === 'Dipinjam' ? 'bg-green-500' : 'bg-gray-300'}`}>
								<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									{#if selectedItem.status === 'Dikembalikan'}
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
									{:else if selectedItem.status === 'Dipinjam'}
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
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
		{:else}
			<!-- Empty state -->
			<div class="border-t border-gray-200 pt-8">
				<div class="flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 h-40">
					<div class="text-center">
						<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
						</svg>
						<h3 class="mt-2 text-sm font-medium text-gray-900">Pilih item peminjaman di atas</h3>
						<p class="mt-1 text-sm text-gray-500">untuk melihat detail lengkap peminjaman</p>
					</div>
				</div>
			</div>
		{/if}
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
					{#if confirmAction === 'return'}
						<p class="text-gray-700">
							Apakah Anda yakin ingin menandai <strong>{selectedItem?.nama}</strong> sebagai dikembalikan?
						</p>
					{:else if confirmAction === 'undo'}
						<p class="text-gray-700">
							Apakah Anda yakin ingin membatalkan pengembalian <strong>{selectedItem?.nama}</strong>?
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

	<!-- Modal Detail Pengembalian -->
	{#if showDetailModal && detailItem}
		<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
			<div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
				<div class="p-6">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-semibold text-gray-900">Detail Pengembalian</h3>
						<button
							on:click={closeDetailModal}
							class="text-gray-400 hover:text-gray-600 transition-colors"
						>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
							</svg>
						</button>
					</div>
					<div class="space-y-4">
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Nama Barang</label>
								<div class="p-3 bg-gray-50 rounded-lg">{detailItem.nama}</div>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Peminjam</label>
								<div class="p-3 bg-gray-50 rounded-lg">{detailItem.peminjam}</div>
							</div>
						</div>
						<!-- Add more detail fields as needed -->
					</div>
					<div class="mt-6 flex justify-end">
						<button
							on:click={closeDetailModal}
							class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
						>
							Tutup
						</button>
					</div>
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
