<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

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
			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/rentals?fields=*,barang_id.id,barang_id.Nama,barang_id.StokIn,barang_id.parent_category.parent_category,barang_id.sub_category.nama_sub',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);
			if (!response.ok) throw new Error('Gagal mengambil data rental dari Directus');
			const result = await response.json();

			return (result.data || []).map((item) => {
				const returnStatus = calculateReturnStatus(
					item.borrow_date,
					item.duration,
					item.actual_return_date,
					item.returned
				);

				return {
					id: item.id,
					nama: item.barang_id?.Nama || '-',
					kategori: item.barang_id?.parent_category?.parent_category || '-',
					subKategori: item.barang_id?.sub_category?.nama_sub || '-',
					qty: item.qty ?? '-',
					peminjam: item.borrower || '-',
					tanggalPinjam: formatDate(item.borrow_date),
					tanggalJatuhTempo: calculateDueDate(item.borrow_date, item.duration),
					durasiPinjam: item.duration ? `${item.duration} hari` : '-',
					tanggalKembaliAktual: item.actual_return_date ? formatDate(item.actual_return_date) : '-',
					status: item.returned ? 'Dikembalikan' : 'Dipinjam',
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
			return [];
		}
	}

	onMount(async () => {
		try {
			data = await fetchRentalData();
			reminders = getReminders(data);
		} catch (e) {
			error = e.message || 'Gagal mengambil data';
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

	function getStatusLabel(status) {
		return status === 'Dipinjam' ? 'Dipinjam' : 'Dikembalikan';
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
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="sm:flex sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Daftar Rental Alat</h1>
			<p class="mt-1 text-sm text-gray-600">
				Kelola dan monitor proses peminjaman serta pengembalian alat-alat proyek
			</p>
		</div>
		<div class="mt-4 sm:mt-0 flex space-x-3">
			<div class="relative group">
				<button
					type="button"
					class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
				>
					📋 Rental Barang
					<svg
						class="ml-2 w-4 h-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg
					>
				</button>
				<div
					class="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity z-10"
				>
					<a href="/inventory/peminjaman" class="block px-4 py-2 text-gray-700 hover:bg-gray-100"
						>Pinjam Barang</a
					>
					<a href="/inventory/pengembalian" class="block px-4 py-2 text-gray-700 hover:bg-gray-100"
						>Pengembalian Barang</a
					>
				</div>
			</div>
		</div>
	</div>

	<!-- Error message -->
	{#if error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
			<p class="text-sm">{error}</p>
		</div>
	{/if}

	<!-- Reminder for due rentals -->
	{#if reminders.length > 0}
		<div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 mb-4 rounded">
			<strong class="block mb-2">Pengingat:</strong>
			<p class="mb-2">Segera lakukan pengembalian untuk alat berikut yang jatuh tempo besok:</p>
			<ul class="list-disc pl-5">
				{#each reminders as reminder}
					<li>
						{reminder.nama} (Peminjam: {reminder.peminjam}) - Jatuh tempo: {reminder.tanggalJatuhTempo}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Table -->
	{#if loading}
		<div class="flex justify-center items-center h-64">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
		</div>
	{:else if data.length === 0}
		<div class="flex flex-col items-center py-12">
			<div class="text-4xl mb-2">📋</div>
			<p class="font-medium">Tidak ada data rental</p>
			<p class="text-xs mt-1">Belum ada data rental yang dibuat</p>
		</div>
	{:else}
		<div class="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>No</th
						>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Nama Barang</th
						>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Kategori</th
						>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Peminjam</th
						>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Qty</th
						>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Tgl Pinjam</th
						>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Jatuh Tempo</th
						>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Durasi</th
						>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Tgl Kembali</th
						>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Status</th
						>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Status Pengembalian</th
						>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Kondisi</th
						>
						<th
							class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Aksi</th
						>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each data as item, i}
						<tr class="hover:bg-gray-50">
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{i + 1}</td>
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-medium"
								>{item.nama}</td
							>
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
								<div class="text-sm">{item.kategori}</div>
								<div class="text-xs text-gray-500">{item.subKategori}</div>
							</td>
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{item.peminjam}</td>
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center"
								>{item.qty}</td
							>
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{item.tanggalPinjam}</td
							>
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900"
								>{item.tanggalJatuhTempo}</td
							>
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{item.durasiPinjam}</td>
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900"
								>{item.tanggalKembaliAktual}</td
							>
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
								<span
									class="px-2 py-1 rounded-full text-xs font-semibold {item.status === 'Dipinjam'
										? 'bg-yellow-100 text-yellow-800'
										: 'bg-green-100 text-green-800'}"
								>
									{getStatusLabel(item.status)}
								</span>
							</td>
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
								{#if item.statusPengembalian && item.statusPengembalian.status !== '-'}
									<span
										class="px-2 py-1 rounded-full text-xs font-semibold {item.statusPengembalian
											.class}"
									>
										{item.statusPengembalian.status}
									</span>
								{:else}
									<span class="text-gray-400">-</span>
								{/if}
							</td>
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
								{#if item.kondisiKembali !== '-'}
									<span
										class="px-2 py-1 rounded text-xs font-medium {item.kondisiKembali === 'Baik'
											? 'bg-green-100 text-green-700'
											: item.kondisiKembali === 'Rusak'
												? 'bg-red-100 text-red-700'
												: 'bg-yellow-100 text-yellow-700'}"
									>
										{item.kondisiKembali}
									</span>
								{:else}
									<span class="text-gray-400">-</span>
								{/if}
							</td>
							<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
								<div class="flex gap-1">
									{#if item.status === 'Dipinjam'}
										<button
											class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
											on:click={() => handleReturn(item)}
											title="Kembalikan barang"
										>
											Kembalikan
										</button>
									{:else}
										<button
											class="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
											on:click={() => handleViewDetail(item)}
											title="Lihat detail pengembalian"
										>
											Lihat Detail
										</button>
										{#if canUndo(item)}
											<button
												class="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
												on:click={() => handleUndo(item)}
												title="Batalkan pengembalian"
											>
												Batalkan {getUndoCountdown(item)}
											</button>
										{/if}
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Dialog Konfirmasi -->
	{#if showConfirm}
		<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
			<div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
				<h2 class="text-lg font-bold mb-2">Konfirmasi</h2>
				<p class="mb-4">
					{#if confirmAction === 'return'}
						Yakin ingin mengubah status menjadi <b>Dikembalikan</b> untuk
						<b>{selectedItem.nama}</b>?
					{:else if confirmAction === 'undo'}
						Yakin ingin <b>membatalkan pengembalian</b> untuk <b>{selectedItem.nama}</b>?
					{/if}
				</p>
				<div class="flex justify-end gap-2">
					<button class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300" on:click={closeConfirm}
						>Batal</button
					>
					<button
						class="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
						on:click={confirmHandler}>Ya</button
					>
				</div>
			</div>
		</div>
	{/if}

	<!-- Modal Detail Pengembalian -->
	{#if showDetailModal && detailItem}
		<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
			<div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-xl font-bold text-gray-900">Detail Pengembalian</h2>
					<button class="text-gray-400 hover:text-gray-600 text-2xl" on:click={closeDetailModal}>
						×
					</button>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-gray-600">Nama Barang</label>
							<p class="text-lg font-semibold text-gray-900">{detailItem.nama}</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-600">Kategori</label>
							<p class="text-gray-900">{detailItem.kategori}</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-600">Sub Kategori</label>
							<p class="text-gray-900">{detailItem.subKategori}</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-600">Peminjam</label>
							<p class="text-gray-900">{detailItem.peminjam}</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-600">Jumlah</label>
							<p class="text-gray-900">{detailItem.qty}</p>
						</div>
					</div>

					<div class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-gray-600">Tanggal Pinjam</label>
							<p class="text-gray-900">{detailItem.tanggalPinjam}</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-600">Durasi Pinjam</label>
							<p class="text-gray-900">{detailItem.durasiPinjam}</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-600">Tanggal Jatuh Tempo</label>
							<p class="text-gray-900">{detailItem.tanggalJatuhTempo}</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-600">Tanggal Kembali Aktual</label>
							<p class="text-gray-900">{detailItem.tanggalKembaliAktual}</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-600">Status Pengembalian</label>
							{#if detailItem.statusPengembalian && detailItem.statusPengembalian.status !== '-'}
								<span
									class="inline-block px-3 py-1 rounded-full text-sm font-semibold {detailItem
										.statusPengembalian.class}"
								>
									{detailItem.statusPengembalian.status}
								</span>
							{:else}
								<p class="text-gray-400">-</p>
							{/if}
						</div>
					</div>
				</div>

				<div class="mt-6 space-y-3">
					<div>
						<label class="block text-sm font-medium text-gray-600">Kondisi Saat Dikembalikan</label>
						{#if detailItem.kondisiKembali !== '-'}
							<span
								class="inline-block px-3 py-1 rounded text-sm font-medium {detailItem.kondisiKembali ===
								'Baik'
									? 'bg-green-100 text-green-700'
									: detailItem.kondisiKembali === 'Rusak'
										? 'bg-red-100 text-red-700'
										: 'bg-yellow-100 text-yellow-700'}"
							>
								{detailItem.kondisiKembali}
							</span>
						{:else}
							<p class="text-gray-400">-</p>
						{/if}
					</div>

					{#if detailItem.keterangan !== '-'}
						<div>
							<label class="block text-sm font-medium text-gray-600">Keterangan Tambahan</label>
							<p class="text-gray-900 bg-gray-50 p-3 rounded-lg">{detailItem.keterangan}</p>
						</div>
					{/if}
				</div>

				<div class="flex justify-end mt-6">
					<button
						class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
						on:click={closeDetailModal}
					>
						Tutup
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Responsive table styles */
	@media (max-width: 1200px) {
		.overflow-x-auto {
			font-size: 0.875rem;
		}

		th,
		td {
			padding: 0.5rem 0.25rem;
		}
	}
</style>
