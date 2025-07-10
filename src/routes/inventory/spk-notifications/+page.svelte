<script>
	import { onMount } from 'svelte';
	import { getSPKNotifications, approveSPKNotification, rejectSPKNotification, markSPKNotificationAsRead } from '$lib/services/notifications.js';

	let loading = true;
	let notifications = [];
	let filteredNotifications = [];
	let selectedStatus = 'all';
	let processing = false;

	const statusOptions = [
		{ value: 'all', label: 'Semua Status' },
		{ value: 'pending', label: 'Menunggu' },
		{ value: 'read', label: 'Dibaca' },
		{ value: 'approved', label: 'Disetujui' },
		{ value: 'rejected', label: 'Ditolak' }
	];

	onMount(async () => {
		await loadNotifications();
	});

	async function loadNotifications() {
		try {
			loading = true;
			notifications = await getSPKNotifications();
			filterNotifications();
			console.log('SPK notifications loaded:', notifications);
		} catch (error) {
			console.error('Error loading SPK notifications:', error);
			notifications = [];
		} finally {
			loading = false;
		}
	}

	function filterNotifications() {
		if (selectedStatus === 'all') {
			filteredNotifications = notifications;
		} else {
			filteredNotifications = notifications.filter(n => n.status === selectedStatus);
		}
	}

	function handleStatusFilter(event) {
		selectedStatus = event.target.value;
		filterNotifications();
	}

	async function handleQuickApprove(notificationId, spkId) {
		if (!confirm('Apakah Anda yakin ingin menyetujui SPK ini?')) return;
		
		try {
			processing = true;
			await approveSPKNotification(notificationId, spkId);
			alert('SPK berhasil disetujui!');
			await loadNotifications();
		} catch (error) {
			console.error('Error approving SPK:', error);
			alert('Gagal menyetujui SPK: ' + error.message);
		} finally {
			processing = false;
		}
	}

	async function handleQuickReject(notificationId, spkId) {
		const reason = prompt('Masukkan alasan penolakan:');
		if (!reason) return;
		
		try {
			processing = true;
			await rejectSPKNotification(notificationId, spkId, reason);
			alert('SPK berhasil ditolak!');
			await loadNotifications();
		} catch (error) {
			console.error('Error rejecting SPK:', error);
			alert('Gagal menolak SPK: ' + error.message);
		} finally {
			processing = false;
		}
	}

	async function markAsRead(notificationId) {
		try {
			await markSPKNotificationAsRead(notificationId);
			await loadNotifications();
		} catch (error) {
			console.error('Error marking notification as read:', error);
		}
	}

	function formatDateTime(dateStr) {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleString('id-ID', {
			day: 'numeric',
			month: 'short',
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

	function getPriorityBadge(priority) {
		switch (priority) {
			case 'high':
				return 'bg-red-100 text-red-800';
			case 'medium':
				return 'bg-yellow-100 text-yellow-800';
			case 'low':
				return 'bg-green-100 text-green-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}
</script>

<svelte:head>
	<title>Notifikasi SPK - PT Eltama Prima Indo</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="md:flex md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Notifikasi SPK</h1>
			<p class="mt-1 text-sm text-gray-600">Kelola persetujuan SPK (Surat Perintah Kerja)</p>
		</div>
		<div class="mt-4 md:mt-0 flex space-x-3">
			<button
				on:click={loadNotifications}
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

	<!-- Filter -->
	<div class="bg-white shadow sm:rounded-lg">
		<div class="px-4 py-5 sm:p-6">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-center space-x-4">
					<label for="status-filter" class="text-sm font-medium text-gray-700">Filter Status:</label>
					<select
						id="status-filter"
						bind:value={selectedStatus}
						on:change={handleStatusFilter}
						class="mt-1 block w-48 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
					>
						{#each statusOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
				<div class="mt-4 sm:mt-0">
					<span class="text-sm text-gray-500">
						Menampilkan {filteredNotifications.length} dari {notifications.length} notifikasi
					</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Notifications List -->
	<div class="bg-white shadow overflow-hidden sm:rounded-md">
		<div class="px-4 py-5 sm:p-6">
			<h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
				Daftar Notifikasi SPK ({filteredNotifications.length} data)
			</h3>
			
			{#if loading}
				<div class="flex justify-center items-center py-8">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
					<span class="ml-2 text-gray-600">Memuat notifikasi...</span>
				</div>
			{:else if filteredNotifications.length === 0}
				<div class="text-center py-8">
					<p class="text-gray-500">
						{selectedStatus === 'all' ? 'Belum ada notifikasi SPK' : `Tidak ada notifikasi dengan status "${statusOptions.find(o => o.value === selectedStatus)?.label}"`}
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each filteredNotifications as notification}
						<div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<div class="flex items-center space-x-2 mb-2">
										<h4 class="text-sm font-medium text-gray-900">
											{notification.title}
										</h4>
										<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusBadge(notification.status)}">
											{notification.status}
										</span>
										<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getPriorityBadge(notification.priority)}">
											{notification.priority}
										</span>
									</div>
									
									<p class="text-sm text-gray-600 mb-2">
										{notification.message}
									</p>
									
									<div class="text-xs text-gray-500 space-y-1">
										<div>SPK: <span class="font-medium">{notification.spk_nomor}</span></div>
										<div>Formula: <span class="font-medium">{notification.nama_formula}</span></div>
										<div>Jumlah: <span class="font-medium">{new Intl.NumberFormat('id-ID').format(notification.jumlah_produksi)} {notification.unit}</span></div>
										<div>Customer: <span class="font-medium">{notification.kode_customer}</span></div>
										<div>Dibuat: <span class="font-medium">{formatDateTime(notification.created_at)}</span></div>
									</div>
								</div>
								
								<div class="flex flex-col space-y-2 ml-4">
									<a
										href="/inventory/spk-notifications/{notification.id}"
										on:click={() => markAsRead(notification.id)}
										class="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
									>
										👁️ Detail
									</a>
									
									{#if notification.status === 'pending' || notification.status === 'read'}
										<button
											on:click={() => handleQuickApprove(notification.id, notification.spk_id)}
											disabled={processing}
											class="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
										>
											✅ Setujui
										</button>
										
										<button
											on:click={() => handleQuickReject(notification.id, notification.spk_id)}
											disabled={processing}
											class="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
										>
											❌ Tolak
										</button>
									{:else if notification.status === 'approved'}
										<span class="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
											✅ Disetujui
										</span>
										{#if notification.approved_at}
											<span class="text-xs text-gray-500">
												{formatDateTime(notification.approved_at)}
											</span>
										{/if}
									{:else if notification.status === 'rejected'}
										<span class="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
											❌ Ditolak
										</span>
										{#if notification.rejected_at}
											<span class="text-xs text-gray-500">
												{formatDateTime(notification.rejected_at)}
											</span>
										{/if}
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
