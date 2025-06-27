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
	let reminders = [];

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
			reminders = getReminders(data);
			console.log('Reminders:', reminders);
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
	function handleApprove(item) {
		const idx = data.findIndex((d) => d.id === item.id);
		if (idx !== -1) {
			data[idx].status = 'Approved';
		}
	}
	function handlePinjam(item) {
		const idx = data.findIndex((d) => d.id === item.id);
		if (idx !== -1) {
			data[idx].status = 'Dipinjam';
		}
	}

	function getStatusLabel(status) {
		switch (status) {
			case 'Pending':
				return 'Pending';
			case 'Approved':
				return 'Approved';
			case 'Dipinjam':
				return 'Dipinjam';
			case 'Dikembalikan':
				return 'Dikembalikan';
			default:
				return status;
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

	function getReminders(rentals) {
		const today = new Date();
		const besok = new Date(today);
		besok.setDate(today.getDate() + 1);

		return rentals.filter((item) => {
			if (item.status !== 'Dipinjam') return false;
			// tanggalJatuhTempo format: dd-mm-yyyy
			const [day, month, year] = item.tanggalJatuhTempo.split('-');
			const dueDate = new Date(`${year}-${month}-${day}`);
			return (
				dueDate.getFullYear() === besok.getFullYear() &&
				dueDate.getMonth() === besok.getMonth() &&
				dueDate.getDate() === besok.getDate()
			);
		});
	}

	// Filter data rental sesuai searchTerm global
	$: filteredData = !$searchTerm
		? data
		: data.filter((item) => {
				const search = $searchTerm.toLowerCase();
				return (
					item.nama?.toLowerCase().includes(search) ||
					item.kategori?.toLowerCase().includes(search) ||
					item.subKategori?.toLowerCase().includes(search) ||
					item.peminjam?.toLowerCase().includes(search) ||
					item.status?.toLowerCase().includes(search) ||
					item.tanggalPinjam?.toLowerCase().includes(search) ||
					item.tanggalJatuhTempo?.toLowerCase().includes(search)
				);
			});
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
	<!-- Header dengan Filter -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
		<div class="p-6">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
				<div>
					<h1 class="text-2xl font-bold text-gray-900">Procurement Peminjaman Barang</h1>
					<p class="mt-1 text-sm text-gray-600">
						Status procurement dan persetujuan peminjaman alat
					</p>
				</div>
				<div class="mt-4 sm:mt-0 flex items-center space-x-3">
					<span class="text-sm text-gray-500">Status:</span>
					<select class="border border-gray-300 rounded-md px-3 py-2 text-sm">
						<option value="">Semua Status</option>
						<option value="pending">Pending</option>
						<option value="approved">Approved</option>
						<option value="rejected">Rejected</option>
					</select>
				</div>
			</div>

			<!-- Search Bar -->
			<div class="flex flex-col sm:flex-row gap-4">
				<div class="flex-1">
					<input
						type="text"
						placeholder="Cari procurement..."
						class="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				</div>
				<div class="flex space-x-2">
					<button
						class="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
					>
						Aksi Procurement
					</button>
					<button
						class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
					>
						Refresh
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Error message -->
	{#if error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
			<div class="flex items-start">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-red-800">Error mengambil data</h3>
					<p class="text-sm mt-1">{error}</p>
					<p class="text-xs mt-2 text-red-600">
						Silakan periksa koneksi internet atau coba refresh halaman. Jika masalah berlanjut,
						hubungi administrator.
					</p>
					<button
						class="mt-2 px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
						on:click={() => window.location.reload()}
					>
						Refresh Halaman
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Reminder for due rentals -->
	{#if reminders.length > 0}
		<div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-md">
			<div class="flex items-start">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-yellow-800">Pengingat Jatuh Tempo</h3>
					<div class="mt-2 text-sm text-yellow-700">
						<p class="mb-2">
							Segera lakukan pengembalian untuk alat berikut yang jatuh tempo besok:
						</p>
						<ul class="list-disc pl-5 space-y-1">
							{#each reminders as reminder}
								<li>
									<strong>{reminder.nama}</strong> - Peminjam: {reminder.peminjam} - Jatuh tempo: {reminder.tanggalJatuhTempo}
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Main Content -->
	{#if loading}
		<div class="bg-white rounded-lg shadow-sm border border-gray-200">
			<div class="flex justify-center items-center h-64">
				<div class="text-center">
					<div
						class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"
					></div>
					<p class="text-gray-600">Memuat data procurement...</p>
				</div>
			</div>
		</div>
	{:else if data.length === 0}
		<div class="bg-white rounded-lg shadow-sm border border-gray-200">
			<div class="flex flex-col items-center justify-center py-16">
				<svg
					class="w-16 h-16 text-gray-400 mb-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				<h3 class="text-lg font-medium text-gray-900 mb-2">Tidak ada data procurement</h3>
				<p class="text-gray-500 text-center max-w-sm">
					Belum ada pengajuan peminjaman barang yang perlu disetujui
				</p>
			</div>
		</div>
	{:else if filteredData.length === 0 && $searchTerm}
		<div class="bg-white rounded-lg shadow-sm border border-gray-200">
			<div class="flex flex-col items-center justify-center py-16">
				<svg
					class="w-16 h-16 text-gray-400 mb-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				<h3 class="text-lg font-medium text-gray-900 mb-2">Tidak ditemukan</h3>
				<p class="text-gray-500 text-center max-w-sm">
					Tidak ada data procurement yang cocok dengan pencarian
					<span class="font-semibold text-blue-600">"{$searchTerm}"</span>
				</p>
			</div>
		</div>
	{:else}
		<!-- Procurement Cards -->
		<div class="grid gap-6">
			{#each filteredData as item, i}
				<div
					class="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
				>
					<!-- Header Card -->
					<div class="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
						<div class="flex items-center justify-between">
							<div class="flex items-center space-x-4">
								<div class="flex-shrink-0">
									<div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
										<span class="text-sm font-medium text-blue-600">#{i + 1}</span>
									</div>
								</div>
								<div>
									<h3 class="text-lg font-semibold text-gray-900">{item.nama}</h3>
									<p class="text-sm text-gray-600">{item.kategori} - {item.subKategori}</p>
								</div>
							</div>
							<!-- Status Badge -->
							<span
								class="px-3 py-1 rounded-full text-xs font-bold tracking-wide border
								{item.status === 'Pending'
									? 'bg-yellow-100 text-yellow-800 border-yellow-300'
									: item.status === 'Approved'
										? 'bg-blue-100 text-blue-800 border-blue-300'
										: item.status === 'Dipinjam'
											? 'bg-orange-100 text-orange-700 border-orange-300'
											: 'bg-green-100 text-green-800 border-green-300'}"
							>
								{getStatusLabel(item.status)}
							</span>
						</div>
					</div>

					<!-- Content Card -->
					<div class="px-6 py-4">
						<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
							<!-- Info Section -->
							<div class="space-y-3">
								<div>
									<span class="text-xs font-medium text-gray-500 uppercase tracking-wide"
										>Departemen</span
									>
									<p class="mt-1 text-sm text-gray-900">Inventory</p>
								</div>
								<div>
									<span class="text-xs font-medium text-gray-500 uppercase tracking-wide"
										>Peminjam</span
									>
									<p class="mt-1 text-sm font-medium text-gray-900">{item.peminjam}</p>
								</div>
								<div>
									<span class="text-xs font-medium text-gray-500 uppercase tracking-wide"
										>Jumlah</span
									>
									<p class="mt-1 text-sm font-semibold text-blue-600">{item.qty} Unit</p>
								</div>
							</div>

							<!-- Timeline Section -->
							<div class="space-y-3">
								<div>
									<span class="text-xs font-medium text-gray-500 uppercase tracking-wide"
										>Tanggal Pinjam</span
									>
									<p class="mt-1 text-sm text-gray-900">{item.tanggalPinjam}</p>
								</div>
								<div>
									<span class="text-xs font-medium text-gray-500 uppercase tracking-wide"
										>Jatuh Tempo</span
									>
									<p class="mt-1 text-sm font-medium text-red-600">{item.tanggalJatuhTempo}</p>
								</div>
								<div>
									<span class="text-xs font-medium text-gray-500 uppercase tracking-wide"
										>Durasi</span
									>
									<p class="mt-1 text-sm text-gray-900">{item.durasiPinjam}</p>
								</div>
							</div>

							<!-- Status Section -->
							<div class="space-y-3">
								{#if item.statusPengembalian && item.statusPengembalian.status !== '-'}
									<div>
										<span class="text-xs font-medium text-gray-500 uppercase tracking-wide"
											>Status Pengembalian</span
										>
										<span
											class="mt-1 inline-block px-2 py-1 rounded-full text-xs font-semibold {item
												.statusPengembalian.class}"
										>
											{item.statusPengembalian.status}
										</span>
									</div>
								{/if}
								{#if item.kondisiKembali !== '-'}
									<div>
										<span class="text-xs font-medium text-gray-500 uppercase tracking-wide"
											>Kondisi</span
										>
										<span
											class="mt-1 inline-block px-2 py-1 rounded text-xs font-medium {item.kondisiKembali ===
											'Baik'
												? 'bg-green-100 text-green-700'
												: item.kondisiKembali === 'Rusak'
													? 'bg-red-100 text-red-700'
													: 'bg-yellow-100 text-yellow-700'}"
										>
											{item.kondisiKembali}
										</span>
									</div>
								{/if}
								{#if item.tanggalKembaliAktual !== '-'}
									<div>
										<span class="text-xs font-medium text-gray-500 uppercase tracking-wide"
											>Tgl Kembali</span
										>
										<p class="mt-1 text-sm text-gray-900">{item.tanggalKembaliAktual}</p>
									</div>
								{/if}
							</div>
						</div>

						<!-- Progress Bar untuk item yang dipinjam -->
						{#if item.status === 'Dipinjam'}
							<div class="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
								<div class="flex items-center justify-between mb-2">
									<span class="text-xs font-medium text-yellow-800">Progress Peminjaman</span>
									<span class="text-xs text-yellow-600">Menunggu Pengembalian</span>
								</div>
								<div class="w-full bg-yellow-200 rounded-full h-2">
									<div class="bg-yellow-500 h-2 rounded-full" style="width: 65%"></div>
								</div>
							</div>
						{/if}

						<!-- Catatan jika ada -->
						{#if item.keterangan && item.keterangan !== '-'}
							<div class="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
								<span class="text-xs font-medium text-gray-500 uppercase tracking-wide"
									>Catatan</span
								>
								<p class="mt-1 text-sm text-gray-900">{item.keterangan}</p>
							</div>
						{/if}
					</div>

					<!-- Footer/Actions -->
					<div class="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
						<div class="flex items-center justify-between">
							<div class="flex items-center space-x-4">
								<div class="text-xs text-gray-500">
									ID Procurement: <span class="font-mono">{item.id}</span>
								</div>
								{#if canUndo(item)}
									<div class="text-xs text-orange-600 font-medium">
										Dapat dibatalkan {getUndoCountdown(item)}
									</div>
								{/if}
							</div>
							<div class="flex space-x-2">
								{#if item.status === 'Pending'}
									<button
										class="px-3 py-1 text-xs font-semibold text-white bg-blue-500 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
										on:click={() => handleApprove(item)}
									>
										<svg
											class="w-4 h-4 inline mr-1"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M5 13l4 4L19 7"
											/></svg
										>
										Approve
									</button>
								{:else if item.status === 'Approved'}
									<button
										class="px-3 py-1 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400"
										on:click={() => handlePinjam(item)}
									>
										<svg
											class="w-4 h-4 inline mr-1"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M8 17l4 4 4-4m0-5V3"
											/></svg
										>
										Proses Peminjaman
									</button>
								{:else if item.status === 'Dipinjam'}
									<button
										class="px-3 py-1 text-xs font-semibold text-white bg-orange-500 rounded hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400"
										on:click={() => handleReturn(item)}
									>
										<svg
											class="w-4 h-4 inline mr-1"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
											/></svg
										>
										Proses Pengembalian
									</button>
								{:else}
									<button
										class="px-3 py-1 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
										on:click={() => handleViewDetail(item)}
									>
										<svg
											class="w-4 h-4 inline mr-1"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
											/></svg
										>
										Lihat Detail
									</button>
									{#if canUndo(item)}
										<button
											class="px-3 py-1 text-xs font-semibold text-white bg-orange-600 rounded hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
											on:click={() => handleUndo(item)}
										>
											<svg
												class="w-4 h-4 inline mr-1"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												><path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M10 19l-7-7m0 0l7-7m-7 7h18"
												/></svg
											>
											Batalkan
										</button>
									{/if}
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

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
										class="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-200"
									>
										<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clip-rule="evenodd"
											/>
										</svg>
										<div class="flex-1">
											<p class="text-sm font-medium text-green-800">Manager Dept</p>
											<p class="text-xs text-green-600">Fully Approved</p>
										</div>
									</div>
									<div
										class="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-200"
									>
										<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clip-rule="evenodd"
											/>
										</svg>
										<div class="flex-1">
											<p class="text-sm font-medium text-green-800">Inventory Manager</p>
											<p class="text-xs text-green-600">Fully Approved</p>
										</div>
									</div>
									<div
										class="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-200"
									>
										<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clip-rule="evenodd"
											/>
										</svg>
										<div class="flex-1">
											<p class="text-sm font-medium text-green-800">Procurement Manager</p>
											<p class="text-xs text-green-600">Fully Approved</p>
										</div>
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
	@media (max-width: 768px) {
		.procurement-card {
			margin-bottom: 1rem;
		}

		.grid-cols-1.md\\:grid-cols-3 {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
	}

	/* Modal backdrop blur effect */
	.modal-backdrop {
		backdrop-filter: blur(4px);
	}

	/* Timeline styles */
	.timeline-item {
		position: relative;
	}

	.timeline-item:not(:last-child)::after {
		content: '';
		position: absolute;
		left: 0.375rem;
		top: 1.5rem;
		width: 2px;
		height: 2rem;
		background: linear-gradient(to bottom, currentColor, transparent);
		opacity: 0.3;
	}
</style>
