<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getSPKNotifications, approveSPKNotification, rejectSPKNotification, markSPKNotificationAsRead } from '$lib/services/notifications.js';
	import { getSPK } from '$lib/services/spk.js';

	let loading = true;
	let notification = null;
	let spkDetail = null;
	let error = null;
	let processing = false;

	const notificationId = $page.params.id;

	onMount(async () => {
		await loadNotificationDetail();
	});

	async function loadNotificationDetail() {
		try {
			loading = true;
			error = null;
			
			console.log('Loading notification detail for ID:', notificationId);
			
			// Load all notifications and find the specific one
			const notifications = await getSPKNotifications();
			console.log('All notifications:', notifications);
			
			notification = notifications.find(n => n.id.toString() === notificationId.toString());
			
			if (!notification) {
				console.error('Notification not found with ID:', notificationId);
				error = 'Notifikasi tidak ditemukan';
				return;
			}

			console.log('Found notification:', notification);

			// Load SPK detail if spk_id exists
			if (notification.spk_id) {
				try {
					const spkList = await getSPK();
					spkDetail = spkList.find(s => s.id === notification.spk_id);
					console.log('SPK Detail:', spkDetail);
				} catch (spkError) {
					console.error('Error loading SPK detail:', spkError);
					// Continue without SPK detail
				}
			}

			// Mark as read if not already
			if (notification.status === 'pending') {
				try {
					await markSPKNotificationAsRead(notification.id);
					notification.status = 'read';
				} catch (updateError) {
					console.error('Error updating notification status:', updateError);
					// Continue without updating status
				}
			}
		} catch (err) {
			console.error('Error loading notification detail:', err);
			error = 'Gagal memuat detail notifikasi: ' + err.message;
		} finally {
			loading = false;
		}
	}

	async function handleApprove() {
		if (!confirm('Apakah Anda yakin ingin menyetujui SPK ini?')) return;
		
		try {
			processing = true;
			await approveSPKNotification(notification.id, notification.spk_id);
			alert('SPK berhasil disetujui!');
			
			// Refresh data
			await loadNotificationDetail();
		} catch (err) {
			console.error('Error approving SPK:', err);
			alert('Gagal menyetujui SPK: ' + err.message);
		} finally {
			processing = false;
		}
	}

	async function handleReject() {
		const reason = prompt('Masukkan alasan penolakan:');
		if (!reason) return;
		
		try {
			processing = true;
			await rejectSPKNotification(notification.id, notification.spk_id, reason);
			alert('SPK berhasil ditolak!');
			
			// Refresh data
			await loadNotificationDetail();
		} catch (err) {
			console.error('Error rejecting SPK:', err);
			alert('Gagal menolak SPK: ' + err.message);
		} finally {
			processing = false;
		}
	}

	function formatDateTime(dateStr) {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getStatusBadge(status) {
		switch (status) {
			case 'pending':
				return 'bg-orange-100 text-orange-800';
			case 'read':
				return 'bg-blue-100 text-blue-800';
			case 'approved':
				return 'bg-green-100 text-green-800';
			case 'rejected':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}
</script>

<svelte:head>
	<title>Detail Notifikasi SPK - PT Eltama Prima Indo</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="md:flex md:items-center md:justify-between">
		<div>
			<nav class="flex" aria-label="Breadcrumb">
				<ol class="flex items-center space-x-4">
					<li>
						<a href="/inventory/spk-notifications" class="text-blue-600 hover:text-blue-800 font-medium">
							← Notifikasi SPK
						</a>
					</li>
					<li>
						<div class="flex items-center">
							<span class="text-gray-400">/</span>
							<span class="ml-4 text-sm font-medium text-gray-500">Detail</span>
						</div>
					</li>
				</ol>
			</nav>
			<h1 class="mt-2 text-2xl font-bold text-gray-900">Detail Notifikasi SPK</h1>
			{#if notification}
				<p class="mt-1 text-sm text-gray-600">
					{notification.spk_nomor} - {notification.nama_formula}
				</p>
			{/if}
		</div>
		<div class="mt-4 md:mt-0">
			<button
				on:click={() => goto('/inventory/spk-notifications')}
				class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
			>
				← Kembali ke Daftar
			</button>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
			<span class="ml-2 text-gray-600">Memuat detail notifikasi...</span>
		</div>
	{:else if error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
			<p class="text-sm">{error}</p>
		</div>
	{:else if notification}
		<!-- Notification Detail Card -->
		<div class="bg-white shadow overflow-hidden sm:rounded-lg">
			<div class="px-4 py-5 sm:px-6">
				<h3 class="text-lg leading-6 font-medium text-gray-900">
					{notification.title}
				</h3>
				<p class="mt-1 max-w-2xl text-sm text-gray-500">
					{notification.message}
				</p>
				<div class="mt-2">
					<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusBadge(notification.status)}">
						{notification.status}
					</span>
				</div>
			</div>
			<div class="border-t border-gray-200">
				<dl>
					<div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
						<dt class="text-sm font-medium text-gray-500">Waktu Dibuat</dt>
						<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
							{formatDateTime(notification.created_at)}
						</dd>
					</div>
					<div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
						<dt class="text-sm font-medium text-gray-500">Nomor SPK</dt>
						<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
							{notification.spk_nomor}
						</dd>
					</div>
					<div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
						<dt class="text-sm font-medium text-gray-500">Formula</dt>
						<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
							{notification.nama_formula}
						</dd>
					</div>
					<div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
						<dt class="text-sm font-medium text-gray-500">Finished Good</dt>
						<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
							{notification.finished_good || '-'}
						</dd>
					</div>
					<div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
						<dt class="text-sm font-medium text-gray-500">Jumlah Produksi</dt>
						<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
							{new Intl.NumberFormat('id-ID').format(notification.jumlah_produksi)} {notification.unit}
						</dd>
					</div>
					<div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
						<dt class="text-sm font-medium text-gray-500">Customer</dt>
						<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
							{notification.kode_customer}
						</dd>
					</div>
					<div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
						<dt class="text-sm font-medium text-gray-500">Prioritas</dt>
						<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
								{notification.priority === 'high' ? 'bg-red-100 text-red-800' : 
								notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
								'bg-green-100 text-green-800'}">
								{notification.priority}
							</span>
						</dd>
					</div>
					{#if notification.approved_at}
						<div class="bg-green-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
							<dt class="text-sm font-medium text-gray-500">Waktu Disetujui</dt>
							<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
								{formatDateTime(notification.approved_at)}
							</dd>
						</div>
					{/if}
					{#if notification.rejected_at}
						<div class="bg-red-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
							<dt class="text-sm font-medium text-gray-500">Waktu Ditolak</dt>
							<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
								{formatDateTime(notification.rejected_at)}
							</dd>
						</div>
						{#if notification.rejection_reason}
							<div class="bg-red-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt class="text-sm font-medium text-gray-500">Alasan Penolakan</dt>
								<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
									{notification.rejection_reason}
								</dd>
							</div>
						{/if}
					{/if}
				</dl>
			</div>
		</div>

		<!-- SPK Detail Card -->
		{#if spkDetail}
			<div class="bg-white shadow overflow-hidden sm:rounded-lg">
				<div class="px-4 py-5 sm:px-6">
					<h3 class="text-lg leading-6 font-medium text-gray-900">
						Detail SPK Lengkap
					</h3>
					<p class="mt-1 max-w-2xl text-sm text-gray-500">
						Informasi lengkap dari SPK yang diajukan
					</p>
				</div>
				<div class="border-t border-gray-200">
					<dl>
						<div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
							<dt class="text-sm font-medium text-gray-500">Batch No</dt>
							<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
								{spkDetail.batch_no}
							</dd>
						</div>
						<div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
							<dt class="text-sm font-medium text-gray-500">Tanggal</dt>
							<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
								{new Date(spkDetail.tanggal).toLocaleDateString('id-ID', {
									day: 'numeric',
									month: 'long',
									year: 'numeric'
								})}
							</dd>
						</div>
						<div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
							<dt class="text-sm font-medium text-gray-500">Harga Per Unit</dt>
							<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
								{spkDetail.harga_per_unit ? `Rp ${new Intl.NumberFormat('id-ID').format(spkDetail.harga_per_unit)}` : '-'}
							</dd>
						</div>
						<div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
							<dt class="text-sm font-medium text-gray-500">Total Harga</dt>
							<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
								{spkDetail.total_harga ? `Rp ${new Intl.NumberFormat('id-ID').format(spkDetail.total_harga)}` : '-'}
							</dd>
						</div>
						<div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
							<dt class="text-sm font-medium text-gray-500">Status SPK</dt>
							<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
									{spkDetail.status === 'draft' ? 'bg-gray-100 text-gray-800' :
									spkDetail.status === 'pending_approval' ? 'bg-orange-100 text-orange-800' :
									spkDetail.status === 'approved' ? 'bg-green-100 text-green-800' :
									spkDetail.status === 'rejected' ? 'bg-red-100 text-red-800' :
									'bg-gray-100 text-gray-800'}">
									{spkDetail.status}
								</span>
							</dd>
						</div>
						{#if spkDetail.keterangan}
							<div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt class="text-sm font-medium text-gray-500">Keterangan</dt>
								<dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
									{spkDetail.keterangan}
								</dd>
							</div>
						{/if}
					</dl>
				</div>
			</div>
		{/if}

		<!-- Action Buttons -->
		{#if notification.status === 'pending' || notification.status === 'read'}
			<div class="bg-white shadow sm:rounded-lg">
				<div class="px-4 py-5 sm:p-6">
					<h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
						Aksi Persetujuan
					</h3>
					<div class="flex space-x-4">
						<button
							on:click={handleApprove}
							disabled={processing}
							class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
						>
							{#if processing}
								<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
							{/if}
							✅ Setujui SPK
						</button>
						<button
							on:click={handleReject}
							disabled={processing}
							class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
						>
							{#if processing}
								<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
							{/if}
							❌ Tolak SPK
						</button>
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<div class="text-center py-8">
			<p class="text-gray-500">Notifikasi tidak ditemukan</p>
		</div>
	{/if}
</div>
