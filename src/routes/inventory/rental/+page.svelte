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

	// Fetch data dari Directus - gabungan SPK dan inventory requests
	async function fetchApprovalData() {
		try {
			console.log('Fetching approval data from Directus...');

			// Fetch data SPK (Surat Perintah Kerja) untuk raw material
			const spkResponse = await fetch('https://directus.eltamaprimaindo.com/items/spk?fields=*', {
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
					'Content-Type': 'application/json'
				}
			});

			// Fetch data inventory requests untuk sparepart/maintenance
			const inventoryResponse = await fetch(
				'https://directus.eltamaprimaindo.com/items/inventory_requests?fields=*',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
						'Content-Type': 'application/json'
					}
				}
			);

			if (!spkResponse.ok) {
				console.error('SPK API Error:', await spkResponse.text());
			}
			if (!inventoryResponse.ok) {
				console.error('Inventory API Error:', await inventoryResponse.text());
			}

			let combinedData = [];

			// Process SPK data (Raw Material untuk Produksi)
			if (spkResponse.ok) {
				const spkResult = await spkResponse.json();
				console.log('SPK Response:', spkResult);

				const spkData =
					spkResult.data?.map((item) => ({
						id: `spk_${item.id}`,
						originalId: item.id,
						type: 'SPK',
						department: 'Produksi',
						namaBarang: item.nama_material || item.description || 'Raw Material',
						kategori: 'Raw Material',
						subKategori: item.kategori || 'Production',
						peminjam: item.requestor || item.created_by || 'Produksi Team',
						quantity: item.quantity || 1,
						unit: item.unit || 'pcs',
						tanggalPinjam: formatDate(item.date_created || item.tanggal_spk),
						durasiPinjam: `${item.duration || 1} hari`,
						tanggalJatuhTempo: calculateDueDate(
							item.date_created || item.tanggal_spk,
							item.duration || 1
						),
						status: item.status || 'Pending',
						approvals: item.approvals || {},
						keterangan: item.keterangan || item.notes || '-',
						priority: item.priority || 'Normal'
					})) || [];

				combinedData = [...combinedData, ...spkData];
			}

			// Process Inventory Requests (Sparepart untuk Maintenance)
			if (inventoryResponse.ok) {
				const inventoryResult = await inventoryResponse.json();
				console.log('Inventory Response:', inventoryResult);

				const inventoryData =
					inventoryResult.data?.map((item) => ({
						id: `inv_${item.id}`,
						originalId: item.id,
						type: 'INVENTORY',
						department: 'Maintenance',
						namaBarang: item.item_name || item.nama_barang || 'Sparepart',
						kategori: item.category || 'Sparepart',
						subKategori: item.sub_category || 'Maintenance',
						peminjam: item.requestor || item.maintenance_team || 'Maintenance Team',
						quantity: item.quantity || 1,
						unit: item.unit || 'pcs',
						tanggalPinjam: formatDate(item.date_created || item.request_date),
						durasiPinjam: `${item.duration || 7} hari`,
						tanggalJatuhTempo: calculateDueDate(
							item.date_created || item.request_date,
							item.duration || 7
						),
						status: item.status || 'Pending',
						approvals: item.approvals || {},
						keterangan: item.notes || item.description || '-',
						priority: item.priority || 'Normal'
					})) || [];

				combinedData = [...combinedData, ...inventoryData];
			}

			console.log('Combined Data:', combinedData);
			return combinedData;
		} catch (error) {
			console.error('Error fetching approval data:', error);
			// Return sample data untuk testing jika API gagal
			return [
				{
					id: 'spk_sample_1',
					originalId: 'S001',
					type: 'SPK',
					department: 'Produksi',
					namaBarang: 'Bahan Baku Aluminium',
					kategori: 'Raw Material',
					subKategori: 'Logam',
					peminjam: 'Tim Produksi A',
					quantity: 100,
					unit: 'kg',
					tanggalPinjam: formatDate(new Date().toISOString()),
					durasiPinjam: '3 hari',
					tanggalJatuhTempo: calculateDueDate(new Date().toISOString(), 3),
					status: 'Pending',
					approvals: {},
					keterangan: 'Untuk produksi order PO-2025-001',
					priority: 'High'
				},
				{
					id: 'inv_sample_1',
					originalId: 'I001',
					type: 'INVENTORY',
					department: 'Maintenance',
					namaBarang: 'Bearing 6205',
					kategori: 'Sparepart',
					subKategori: 'Bearing',
					peminjam: 'Maintenance Team',
					quantity: 2,
					unit: 'pcs',
					tanggalPinjam: formatDate(new Date().toISOString()),
					durasiPinjam: '1 hari',
					tanggalJatuhTempo: calculateDueDate(new Date().toISOString(), 1),
					status: 'Pending',
					approvals: {
						dept: {
							by: 'managerdept@eltama.com',
							name: 'Manager Dept',
							at: new Date().toISOString()
						}
					},
					keterangan: 'Untuk maintenance mesin produksi line 1',
					priority: 'Normal'
				},
				{
					id: 'spk_sample_2',
					originalId: 'S002',
					type: 'SPK',
					department: 'Produksi',
					namaBarang: 'Plastik HDPE',
					kategori: 'Raw Material',
					subKategori: 'Plastik',
					peminjam: 'Tim Produksi B',
					quantity: 50,
					unit: 'kg',
					tanggalPinjam: formatDate(new Date().toISOString()),
					durasiPinjam: '2 hari',
					tanggalJatuhTempo: calculateDueDate(new Date().toISOString(), 2),
					status: 'Approved',
					approvals: {
						dept: {
							by: 'managerdept@eltama.com',
							name: 'Manager Dept',
							at: new Date().toISOString()
						},
						inventory: {
							by: 'inventoryadmin@eltama.com',
							name: 'Inventory Manager',
							at: new Date().toISOString()
						},
						procurement: {
							by: 'procurementmanager@eltama.com',
							name: 'Procurement Manager',
							at: new Date().toISOString()
						}
					},
					keterangan: 'Untuk produksi order PO-2025-002',
					priority: 'Normal'
				}
			];
		}
	}

	onMount(async () => {
		try {
			console.log('Component mounted, fetching data...');
			data = await fetchApprovalData();
			console.log('Data loaded:', data);
		} catch (e) {
			console.error('Error in onMount:', e);
			error = e.message || 'Gagal mengambil data approval';
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

		// Simpan ke backend Directus - endpoint berbeda untuk SPK dan inventory_requests
		try {
			let endpoint;
			if (item.type === 'SPK') {
				endpoint = `https://directus.eltamaprimaindo.com/items/spk/${item.originalId}`;
			} else {
				endpoint = `https://directus.eltamaprimaindo.com/items/inventory_requests/${item.originalId}`;
			}

			const response = await fetch(endpoint, {
				method: 'PATCH',
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					approvals: data[idx].approvals,
					status: getApprovalStage(data[idx]) === 'done' ? 'Approved' : 'Pending'
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			// Refresh data agar approval stage update
			data = await fetchApprovalData();

			// Tampilkan notifikasi sukses
			alert(
				`Approval berhasil disimpan untuk ${item.type === 'SPK' ? 'SPK' : 'Request Inventory'}`
			);
		} catch (e) {
			console.error('Error saving approval:', e);
			alert(`Gagal menyimpan approval: ${e.message}`);
		}
	}
	function handlePinjam(item) {
		const idx = data.findIndex((d) => d.id === item.id);
		if (idx !== -1) {
			data[idx].status = 'Dipinjam';
		}
	}

	async function handleReject(item, reason = '') {
		const idx = data.findIndex((d) => d.id === item.id);
		if (idx === -1) return;

		const now = new Date().toISOString();
		if (!data[idx].approvals) data[idx].approvals = {};

		// Set rejection info
		data[idx].approvals.rejected = {
			by: user.email,
			name: user.name,
			at: now,
			reason: reason || 'Tidak ada alasan'
		};
		data[idx].status = 'Rejected';

		// Simpan ke backend Directus - endpoint berbeda untuk SPK dan inventory_requests
		try {
			let endpoint;
			if (item.type === 'SPK') {
				endpoint = `https://directus.eltamaprimaindo.com/items/spk/${item.originalId}`;
			} else {
				endpoint = `https://directus.eltamaprimaindo.com/items/inventory_requests/${item.originalId}`;
			}

			const response = await fetch(endpoint, {
				method: 'PATCH',
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					approvals: data[idx].approvals,
					status: 'Rejected'
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			// Refresh data agar status update
			data = await fetchApprovalData();

			// Tampilkan notifikasi sukses
			alert(`Request ${item.type === 'SPK' ? 'SPK' : 'Inventory'} berhasil ditolak`);
		} catch (e) {
			console.error('Error rejecting approval:', e);
			alert(`Gagal menolak request: ${e.message}`);
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
		if (status === 'Rejected') return 'bg-red-100 text-red-800 border-red-300';
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
		// Cek jika item ditolak
		if (item.approvals?.rejected) {
			return 'Rejected';
		}

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
		alert(
			`Edit peminjaman "${item.namaBarang}"\n\nFitur edit akan diarahkan ke halaman/modal edit peminjaman`
		);

		// TODO: Implementasi redirect atau modal edit
		// goto(`/inventory/rental/edit/${item.id}`);
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
				Sistem Approval Material & Sparepart
			</h1>
			<p class="mt-1 text-sm text-gray-500">
				Approval untuk SPK Raw Material (Produksi) dan Sparepart (Maintenance)
			</p>
		</div>
		<div class="flex gap-2 mt-4 sm:mt-0">
			<button
				class="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow"
				on:click={async () => {
					loading = true;
					try {
						data = await fetchApprovalData();
					} catch (e) {
						error = e.message || 'Gagal memuat data approval';
					} finally {
						loading = false;
					}
				}}
			>
				<svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					></path>
				</svg>
				Refresh Data
			</button>
		</div>
	</div>

	<!-- Statistics Cards -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
		<!-- Card: Total Requests -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
			<div class="flex items-center">
				<div class="flex-shrink-0">
					<div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
						<svg
							class="w-5 h-5 text-blue-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							></path>
						</svg>
					</div>
				</div>
				<div class="ml-3">
					<p class="text-sm font-medium text-gray-500">Total Requests</p>
					<p class="text-2xl font-bold text-gray-900">{data.length}</p>
				</div>
			</div>
		</div>

		<!-- Card: Pending Approval -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
			<div class="flex items-center">
				<div class="flex-shrink-0">
					<div class="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
						<svg
							class="w-5 h-5 text-yellow-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
					</div>
				</div>
				<div class="ml-3">
					<p class="text-sm font-medium text-gray-500">Pending Approval</p>
					<p class="text-2xl font-bold text-gray-900">
						{data.filter((item) => getApprovalStage(item) !== 'done' && !item.approvals?.rejected)
							.length}
					</p>
				</div>
			</div>
		</div>

		<!-- Card: Approved -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
			<div class="flex items-center">
				<div class="flex-shrink-0">
					<div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
						<svg
							class="w-5 h-5 text-green-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
					</div>
				</div>
				<div class="ml-3">
					<p class="text-sm font-medium text-gray-500">Approved</p>
					<p class="text-2xl font-bold text-gray-900">
						{data.filter((item) => getApprovalStage(item) === 'done').length}
					</p>
				</div>
			</div>
		</div>

		<!-- Card: Rejected -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
			<div class="flex items-center">
				<div class="flex-shrink-0">
					<div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
						<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
					</div>
				</div>
				<div class="ml-3">
					<p class="text-sm font-medium text-gray-500">Rejected</p>
					<p class="text-2xl font-bold text-gray-900">
						{data.filter((item) => item.approvals?.rejected).length}
					</p>
				</div>
			</div>
		</div>
	</div>

	<div
		class="mx-auto px-4 py-8"
		style="max-width:1600px; font-size:1.1rem; margin-left:-50px; margin-right:-50px;"
	>
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
			<div>
				<h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">
					Sistem Approval Material & Sparepart
				</h1>
				<p class="mt-1 text-sm text-gray-500">
					Approval untuk SPK Raw Material (Produksi) dan Sparepart (Maintenance)
				</p>
			</div>
			<div class="flex gap-2 mt-4 sm:mt-0">
				<button
					class="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow"
					on:click={async () => {
						loading = true;
						try {
							data = await fetchApprovalData();
						} catch (e) {
							error = e.message || 'Gagal memuat data approval';
						} finally {
							loading = false;
						}
					}}
				>
					<svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						></path>
					</svg>
					Refresh Data
				</button>
			</div>
		</div>
	</div>

	<div
		class="bg-white rounded-2xl shadow border border-gray-200 px-4 py-8 min-h-[520px] max-h-[800px]"
		style="margin-left:-20px; margin-right:-20px;"
	>
		<div class="flex flex-row gap-8 xl:gap-12">
			<!-- Panel Kiri: Daftar Peminjaman -->
			<div
				class="flex flex-col h-full min-h-0"
				style="width:38%; min-width:420px; max-width:520px;"
			>
				<!-- Filter & Search (tetap di atas, tidak ikut scroll) -->
				<div
					class="flex flex-col gap-3 mb-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm"
				>
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
					</div>
					<div class="flex flex-wrap gap-2 items-center">
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
							<option value="Rejected">Rejected</option>
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
				<!-- List Card: area scrollable -->
				<div
					class="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar max-h-[480px] border border-gray-300 rounded-xl p-3 bg-gradient-to-b from-gray-50 to-white shadow-inner"
				>
					<div class="space-y-2 pb-2">
						{#each filteredData as item, i}
							<div
								class="flex items-center bg-white shadow-sm rounded-xl border border-gray-200 px-5 py-3 gap-4 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200 procurement-card {selectedItem &&
								selectedItem.id === item.id
									? 'ring-2 ring-blue-500 border-blue-400 shadow-lg bg-blue-50'
									: 'hover:bg-gray-50'}"
								role="button"
								tabindex="0"
								on:click={() => (selectedItem = item)}
								on:keydown={(e) => e.key === 'Enter' && (selectedItem = item)}
							>
								<div
									class="w-9 h-9 flex items-center justify-center rounded-full font-bold text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
								>
									#{i + 1}
								</div>
								<div class="flex-1 min-w-0">
									<div class="font-bold text-gray-900 truncate text-sm">{item.nama}</div>
									<div class="text-xs text-gray-500 truncate">
										{item.kategori} • Peminjam: {item.peminjam}
									</div>
								</div>
								<span
									class="ml-auto px-3 py-1.5 rounded-full text-xs font-bold border status-badge {getStatusBadgeClass(
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
											class="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"
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
													d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
												/>
											</svg>
										</div>
										<div>
											<h2 class="text-2xl font-bold text-gray-900">Detail Request</h2>
											<p class="text-sm text-gray-600">
												{selectedItem.type === 'SPK'
													? 'Informasi SPK Raw Material'
													: 'Informasi Request Sparepart'}
											</p>
										</div>
									</div>
									<span
										class="px-4 py-2 rounded-full text-sm font-bold border shadow-sm {selectedItem.status ===
										'Pending'
											? 'bg-yellow-100 text-yellow-800 border-yellow-300'
											: selectedItem.status === 'Approved'
												? 'bg-green-100 text-green-800 border-green-300'
												: selectedItem.status === 'Dipinjam'
													? 'bg-blue-100 text-blue-800 border-blue-300'
													: 'bg-gray-100 text-gray-700 border-gray-300'}"
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
												<h3 class="text-lg font-bold text-gray-900">Informasi Material</h3>
												<p class="text-xs text-gray-500">
													{selectedItem.type === 'SPK'
														? 'Raw Material untuk Produksi'
														: 'Sparepart untuk Maintenance'}
												</p>
											</div>
										</div>
										<div class="space-y-4">
											<div class="p-3 bg-gray-50 rounded-xl">
												<div class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
													{selectedItem.type === 'SPK' ? 'Nama Material' : 'Nama Sparepart'}
												</div>
												<div class="font-bold text-gray-900 text-lg">{selectedItem.namaBarang}</div>
											</div>
											<div class="grid grid-cols-1 gap-3">
												<div class="p-3 bg-blue-50 rounded-xl border border-blue-100">
													<div
														class="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1"
													>
														Kategori
													</div>
													<div class="text-sm text-gray-900 font-semibold">
														{selectedItem.kategori} - {selectedItem.subKategori}
													</div>
												</div>
												<div class="grid grid-cols-2 gap-3">
													<div class="p-3 bg-purple-50 rounded-xl border border-purple-100">
														<div
															class="text-xs font-medium text-purple-600 uppercase tracking-wide mb-1"
														>
															{selectedItem.type === 'SPK' ? 'Requestor' : 'Team Maintenance'}
														</div>
														<div class="text-sm text-gray-900 font-semibold">
															{selectedItem.peminjam}
														</div>
													</div>
													<div class="p-3 bg-orange-50 rounded-xl border border-orange-100">
														<div
															class="text-xs font-medium text-orange-600 uppercase tracking-wide mb-1"
														>
															Quantity
														</div>
														<div class="text-sm font-bold text-orange-700">
															{selectedItem.quantity}
															{selectedItem.unit}
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
														d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
											</div>
											<div>
												<h3 class="text-lg font-bold text-gray-900">Timeline Request</h3>
												<p class="text-xs text-gray-500">
													{selectedItem.type === 'SPK' ? 'Jadwal SPK' : 'Jadwal Penggunaan'}
												</p>
											</div>
										</div>
										<div class="space-y-4">
											<div class="p-3 bg-gray-50 rounded-xl">
												<div class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
													Tanggal Pinjam
												</div>
												<div class="text-lg text-gray-900 font-bold">
													{selectedItem.tanggalPinjam}
												</div>
											</div>
											<div class="grid grid-cols-1 gap-3">
												<div class="p-3 bg-red-50 rounded-xl border border-red-100">
													<div
														class="text-xs font-medium text-red-600 uppercase tracking-wide mb-1"
													>
														Jatuh Tempo
													</div>
													<div class="text-sm font-bold text-red-700">
														{selectedItem.tanggalJatuhTempo}
													</div>
												</div>
												<div class="grid grid-cols-2 gap-3">
													<div class="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
														<div
															class="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1"
														>
															Durasi
														</div>
														<div class="text-sm text-gray-900 font-semibold">
															{selectedItem.durasiPinjam}
														</div>
													</div>
													{#if selectedItem.tanggalKembaliAktual !== '-'}
														<div class="p-3 bg-green-50 rounded-xl border border-green-100">
															<div
																class="text-xs font-medium text-green-600 uppercase tracking-wide mb-1"
															>
																Tgl Kembali
															</div>
															<div class="text-sm text-gray-900 font-semibold">
																{selectedItem.tanggalKembaliAktual}
															</div>
														</div>
													{:else}
														<div class="p-3 bg-gray-100 rounded-xl border border-gray-200">
															<div
																class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
															>
																Tgl Kembali
															</div>
															<div class="text-sm text-gray-400">Belum dikembalikan</div>
														</div>
													{/if}
												</div>
											</div>
										</div>
									</div>
								</div>

								<!-- Status dan Kondisi Barang -->
								{#if (selectedItem.statusPengembalian && selectedItem.statusPengembalian.status !== '-') || selectedItem.kondisiKembali !== '-' || (selectedItem.keterangan && selectedItem.keterangan !== '-')}
									<div class="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
										<div class="flex items-center gap-3 mb-4">
											<div
												class="w-10 h-10 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-sm"
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
														d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
											</div>
											<div>
												<h3 class="text-lg font-bold text-gray-900">Status & Kondisi</h3>
												<p class="text-xs text-gray-500">Informasi pengembalian</p>
											</div>
										</div>
										<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
											{#if selectedItem.statusPengembalian && selectedItem.statusPengembalian.status !== '-'}
												<div class="p-3 bg-teal-50 rounded-xl border border-teal-100">
													<div
														class="text-xs font-medium text-teal-600 uppercase tracking-wide mb-1"
													>
														Status Pengembalian
													</div>
													<span
														class="inline-block px-3 py-1.5 rounded-lg text-sm font-semibold {selectedItem
															.statusPengembalian.class}"
													>
														{selectedItem.statusPengembalian.status}
													</span>
												</div>
											{/if}
											{#if selectedItem.kondisiKembali !== '-'}
												<div class="p-3 bg-cyan-50 rounded-xl border border-cyan-100">
													<div
														class="text-xs font-medium text-cyan-600 uppercase tracking-wide mb-1"
													>
														Kondisi
													</div>
													<span
														class="inline-block px-3 py-1.5 rounded-lg text-sm font-medium {selectedItem.kondisiKembali ===
														'Baik'
															? 'bg-green-100 text-green-700 border border-green-200'
															: selectedItem.kondisiKembali === 'Rusak'
																? 'bg-red-100 text-red-700 border border-red-200'
																: 'bg-yellow-100 text-yellow-700 border border-yellow-200'}"
													>
														{selectedItem.kondisiKembali}
													</span>
												</div>
											{/if}
										</div>
										{#if selectedItem.keterangan && selectedItem.keterangan !== '-'}
											<div class="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
												<div
													class="text-xs font-medium text-slate-600 uppercase tracking-wide mb-2"
												>
													Catatan
												</div>
												<div class="text-sm text-gray-700 leading-relaxed">
													{selectedItem.keterangan}
												</div>
											</div>
										{/if}
									</div>
								{/if}

								<!-- Approval Progress -->
								<div class="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mt-4">
									<span
										class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 block"
										>Alur Persetujuan</span
									>
									<!-- Horizontal Approval Flow -->
									<div class="flex items-center justify-between relative">
										<!-- Progress Line Background -->
										<div
											class="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-300 transform -translate-y-1/2 z-0"
										></div>
										<!-- Progress Line Active -->
										<div
											class="absolute top-1/2 left-0 h-0.5 bg-green-500 transform -translate-y-1/2 z-0 transition-all duration-500"
											style="width: {selectedItem.approvals?.dept
												? selectedItem.approvals?.inventory
													? selectedItem.approvals?.procurement
														? '100%'
														: '66%'
													: '33%'
												: '0%'}"
										></div>

										<!-- Step 1: Manager Dept -->
										<div
											class="flex flex-col items-center relative z-10 bg-blue-50 px-3 py-2 rounded-lg"
										>
											<div
												class="w-8 h-8 rounded-full flex items-center justify-center {selectedItem
													.approvals?.dept
													? 'bg-green-500 text-white'
													: 'bg-gray-300 text-gray-500'} font-bold text-sm shadow-sm mb-2 transition-colors duration-300"
											>
												1
											</div>
											<span class="text-xs font-medium text-center text-gray-700">Manager Dept</span
											>
											{#if selectedItem.approvals?.dept}
												<span class="text-xs text-green-600 text-center mt-1"
													>{formatDate(selectedItem.approvals.dept.at)}</span
												>
											{:else}
												<span class="text-xs text-gray-400 text-center mt-1">Pending</span>
											{/if}
										</div>

										<!-- Arrow 1 -->
										<div class="flex-1 flex justify-center">
											<svg class="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
												<path
													fill-rule="evenodd"
													d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
													clip-rule="evenodd"
												></path>
											</svg>
										</div>

										<!-- Step 2: Inventory Manager -->
										<div
											class="flex flex-col items-center relative z-10 bg-blue-50 px-3 py-2 rounded-lg"
										>
											<div
												class="w-8 h-8 rounded-full flex items-center justify-center {selectedItem
													.approvals?.inventory
													? 'bg-green-500 text-white'
													: 'bg-gray-300 text-gray-500'} font-bold text-sm shadow-sm mb-2 transition-colors duration-300"
											>
												2
											</div>
											<span class="text-xs font-medium text-center text-gray-700"
												>Inventory Manager</span
											>
											{#if selectedItem.approvals?.inventory}
												<span class="text-xs text-green-600 text-center mt-1"
													>{formatDate(selectedItem.approvals.inventory.at)}</span
												>
											{:else}
												<span class="text-xs text-gray-400 text-center mt-1">Pending</span>
											{/if}
										</div>

										<!-- Arrow 2 -->
										<div class="flex-1 flex justify-center">
											<svg class="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
												<path
													fill-rule="evenodd"
													d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
													clip-rule="evenodd"
												></path>
											</svg>
										</div>

										<!-- Step 3: Procurement Manager -->
										<div
											class="flex flex-col items-center relative z-10 bg-blue-50 px-3 py-2 rounded-lg"
										>
											<div
												class="w-8 h-8 rounded-full flex items-center justify-center {selectedItem
													.approvals?.procurement
													? 'bg-green-500 text-white'
													: 'bg-gray-300 text-gray-500'} font-bold text-sm shadow-sm mb-2 transition-colors duration-300"
											>
												3
											</div>
											<span class="text-xs font-medium text-center text-gray-700"
												>Procurement Manager</span
											>
											{#if selectedItem.approvals?.procurement}
												<span class="text-xs text-green-600 text-center mt-1"
													>{formatDate(selectedItem.approvals.procurement.at)}</span
												>
											{:else}
												<span class="text-xs text-gray-400 text-center mt-1">Pending</span>
											{/if}
										</div>
									</div>
								</div>
								<!-- Tombol Aksi -->
								<div
									class="flex flex-wrap gap-2 mt-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm"
								>
									{#if canApprove(user, selectedItem)}
										<button
											class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
											on:click={() => handleApprove(selectedItem)}
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M5 13l4 4L19 7"
												></path>
											</svg>
											Approve {selectedItem.type === 'SPK' ? 'SPK' : 'Request'}
										</button>
										<button
											class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
											on:click={() => {
												const reason = prompt('Alasan penolakan (opsional):');
												if (reason !== null) {
													handleReject(selectedItem, reason);
												}
											}}
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M6 18L18 6M6 6l12 12"
												></path>
											</svg>
											Reject {selectedItem.type === 'SPK' ? 'SPK' : 'Request'}
										</button>
									{:else if selectedItem.status === 'Approved'}
										<div
											class="px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-semibold border border-green-200"
										>
											✓ Request Telah Disetujui
										</div>
									{:else if selectedItem.approvals?.rejected}
										<div
											class="px-4 py-2 bg-red-100 text-red-800 rounded-lg text-sm font-semibold border border-red-200"
										>
											✗ Request Ditolak: {selectedItem.approvals.rejected.reason}
										</div>
									{:else}
										<div
											class="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-semibold border border-yellow-200"
										>
											⏳ Menunggu Approval dari {getApprovalStage(selectedItem) === 'dept'
												? 'Manager Departemen'
												: getApprovalStage(selectedItem) === 'inventory'
													? 'Inventory Manager'
													: getApprovalStage(selectedItem) === 'procurement'
														? 'Procurement Manager'
														: 'Unknown'}
										</div>
									{/if}

									<!-- Tombol Info Detail -->
									<button
										class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg border border-blue-200 text-sm font-semibold shadow-sm hover:bg-blue-200 transition-colors flex items-center gap-2"
										on:click={() => {
											alert(
												`Detail ${selectedItem.type}:\n\nID: ${selectedItem.originalId}\nDepartment: ${selectedItem.department}\nPriority: ${selectedItem.priority}`
											);
										}}
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											></path>
										</svg>
										Info Detail
									</button>
								</div>
							</div>
						</div>
					{:else}
						<!-- Empty state, ukuran dan padding sama -->
						<div
							class="flex-1 min-h-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 h-full min-h-[400px]"
						>
							<div class="text-center p-8">
								<svg
									class="w-16 h-16 text-gray-300 mx-auto mb-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1"
										d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
									/>
								</svg>
								<p class="text-gray-500 font-medium">Pilih barang di sebelah kiri</p>
								<p class="text-gray-400 text-sm mt-1">untuk melihat detail peminjaman</p>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Color Picker Boxes -->
	<div class="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
		<div class="block text-sm font-medium text-gray-700 mb-3">Pilih Warna Background</div>
		<div class="flex gap-3 flex-wrap">
			{#each colorOptions as colorOpt}
				<button
					on:click={() => (selectedGradient = colorOpt.gradient)}
					class={`relative w-12 h-12 rounded-lg ${colorOpt.preview} border-2 hover:scale-105 transition-transform duration-200 ${selectedGradient === colorOpt.gradient ? 'border-gray-800 ring-2 ring-gray-400' : 'border-gray-300'}`}
					title={colorOpt.name}
				>
					{#if selectedGradient === colorOpt.gradient}
						<div class="absolute inset-0 flex items-center justify-center">
							<svg
								class="w-5 h-5 text-white drop-shadow-lg"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								></path>
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
										class="flex items-center space-x-3 p-3 rounded-lg border {detailItem.approvals
											?.procurement
											? 'bg-green-50 border-green-200'
											: 'bg-gray-50 border-gray-200'}"
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
		transition: all 0.2s ease-in-out;
		transform: translateY(0);
	}

	.procurement-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
	}

	/* Custom scrollbar for card list */
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: #cbd5e1 #f1f5f9;
	}
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: linear-gradient(to bottom, #cbd5e1, #94a3b8);
		border-radius: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-corner {
		background: #f1f5f9;
	}

	/* Progress bar animation */
	@keyframes progress {
		0% {
			width: 0%;
		}
		100% {
			width: var(--progress-width);
		}
	}

	.progress-bar {
		animation: progress 1s ease-in-out;
	}

	/* Approval step animations */
	.approval-step {
		transition: all 0.3s ease-in-out;
	}

	.approval-step.completed {
		animation: stepComplete 0.5s ease-in-out;
	}

	@keyframes stepComplete {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
		100% {
			transform: scale(1);
		}
	}

	/* Status badge styles */
	.status-badge {
		position: relative;
		overflow: hidden;
		transition: all 0.2s ease;
	}

	.status-badge::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
		transition: left 0.4s;
	}

	.status-badge:hover::before {
		left: 100%;
	}

	/* Additional improvements */
	.bg-gradient-to-br {
		background-image: linear-gradient(to bottom right, var(--tw-gradient-stops));
	}

	.shadow-inner {
		box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
	}

	/* Responsive improvements */
	@media (max-width: 1200px) {
		.flex-row {
			flex-direction: column !important;
		}
		/* Panel lebar penuh jika layar kecil */
		div[style*='width:38%'] {
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
	}
</style>
