<script>
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';

	export let reminders = [];
	export let lateItems = [];
	export let waitingApprovalItems = [];
	export let spkNotifications = [];
	export let productionRequests = [];
	export let productionNotifications = [];
	export let soCustomerData = [];

	let open = false;
	const dispatch = createEventDispatcher();
	let bellRef;
	let modalRef;
	let tab = 'late';
	let hasSetInitialTab = false;

	function toggle() {
		// Set initial tab when opening for the first time
		if (!open && !hasSetInitialTab) {
			if (productionNotifications.length > 0) {
				tab = 'production';
			} else if (spkNotifications.length > 0) {
				tab = 'spk';
			} else if (lateItems.length > 0) {
				tab = 'late';
			} else if (waitingApprovalItems.length > 0) {
				tab = 'approval';
			} else if (reminders.length > 0) {
				tab = 'reminder';
			} else if (soCustomerData.length > 0) {
				tab = 'so';
			}
			hasSetInitialTab = true;
		}
		open = !open;
	}

	// Reactive statement for debugging
	$: {
		console.log('NotificationBell - Production notifications:', productionNotifications);
		console.log(
			'NotificationBell - Production notifications length:',
			productionNotifications.length
		);
	}

	function handleClickOutside(event) {
		if (open && bellRef && !bellRef.contains(event.target)) {
			open = false;
		}
	}

	function handleKeyDown(event) {
		if (open && event.key === 'Escape') {
			open = false;
		}
	}

	function handleSPKAction(notificationId, spkId, action) {
		dispatch('spkAction', {
			notificationId,
			spkId,
			action
		});
	}

	onMount(() => {
		if (typeof window !== 'undefined' && typeof document !== 'undefined') {
			document.addEventListener('mousedown', handleClickOutside);
			document.addEventListener('keydown', handleKeyDown);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined' && typeof document !== 'undefined') {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeyDown);
		}
	});
</script>

<div class="relative" bind:this={bellRef}>
	<button
		class="relative p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
		aria-label="Notifikasi"
		on:click={toggle}
	>
		<svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
			/>
		</svg>
		{#if reminders.length + lateItems.length + waitingApprovalItems.length + spkNotifications.length + productionNotifications.length + soCustomerData.length > 0}
			<span
				class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold animate-pulse"
			>
				{reminders.length +
					lateItems.length +
					waitingApprovalItems.length +
					spkNotifications.length +
					productionNotifications.length +
					soCustomerData.length}
			</span>
		{/if}
	</button>
	{#if open}
		<!-- Modal Popup Notifikasi -->
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
			<div class="bg-white rounded-lg shadow-lg w-full max-w-md p-0" bind:this={modalRef}>
				<div class="flex border-b">
					<button
						class="flex-1 py-3 text-sm font-bold border-b-2"
						class:text-blue-600={tab === 'spk'}
						class:border-b-blue-600={tab === 'spk'}
						on:click={() => (tab = 'spk')}>SPK Approval</button
					>
					<button
						class="flex-1 py-3 text-sm font-bold border-b-2"
						class:text-blue-600={tab === 'production'}
						class:border-b-blue-600={tab === 'production'}
						on:click={() => (tab = 'production')}>Produksi</button
					>
					<button
						class="flex-1 py-3 text-sm font-bold border-b-2"
						class:text-blue-600={tab === 'late'}
						class:border-b-blue-600={tab === 'late'}
						on:click={() => (tab = 'late')}>Terlambat</button
					>
					<button
						class="flex-1 py-3 text-sm font-bold border-b-2"
						class:text-blue-600={tab === 'approval'}
						class:border-b-blue-600={tab === 'approval'}
						on:click={() => (tab = 'approval')}>Rental Approval</button
					>
					<button
						class="flex-1 py-3 text-sm font-bold border-b-2"
						class:text-blue-600={tab === 'so'}
						class:border-b-blue-600={tab === 'so'}
						on:click={() => (tab = 'so')}>SO Customer</button
					>
				</div>
				<div class="p-4 max-h-80 overflow-y-auto">
					{#if tab === 'spk'}
						{#if spkNotifications.length === 0}
							<div class="text-gray-400 text-sm text-center">Tidak ada SPK menunggu approval</div>
						{:else}
							{#each spkNotifications as notification}
								<div class="mb-3 p-3 rounded bg-blue-50 border border-blue-100">
									<div class="font-semibold text-blue-700">{notification.title}</div>
									<div class="text-xs text-gray-600 mt-1">{notification.message}</div>
									<div class="text-xs text-gray-500 mt-1">
										SPK: {notification.spk_nomor} | {notification.nama_formula}
									</div>
									<div class="text-xs text-gray-500">
										Jumlah: {notification.jumlah_produksi}
										{notification.unit}
									</div>
									<div class="flex space-x-2 mt-2">
										<button
											on:click={() =>
												handleSPKAction(notification.id, notification.spk_id, 'approve')}
											class="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
										>
											Approve
										</button>
										<button
											on:click={() =>
												handleSPKAction(notification.id, notification.spk_id, 'reject')}
											class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
										>
											Reject
										</button>
										<a
											href="/inventory/spk-notifications/{notification.id}"
											class="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
										>
											Detail
										</a>
									</div>
								</div>
							{/each}
						{/if}
					{:else if tab === 'production'}
						{#if productionNotifications.length === 0}
							<div class="text-gray-400 text-sm text-center">Tidak ada permintaan produksi</div>
						{:else}
							{#each productionNotifications.slice(0, 5) as item}
								<div class="mb-3 p-3 rounded bg-purple-50 border border-purple-100">
									<div class="font-semibold text-purple-700">{item.nama_barang}</div>
									<div class="text-xs text-gray-600 mt-1">Kode: {item.kode_barang}</div>
									<div class="text-xs text-gray-500 mt-1">
										Status: {item.status} | Stok: {item.sisa_stok}
									</div>
									<div class="text-xs text-gray-500">
										Priority:
										{#if item.priority === 'urgent'}
											<span class="px-1 py-0.5 rounded text-white text-xs bg-red-500">URGENT</span>
										{:else if item.priority === 'high'}
											<span class="px-1 py-0.5 rounded text-white text-xs bg-orange-500">HIGH</span>
										{:else}
											<span class="px-1 py-0.5 rounded text-white text-xs bg-yellow-500"
												>MEDIUM</span
											>
										{/if}
									</div>
									{#if item.source === 'manual'}
										<div class="text-xs text-purple-600 mt-1">
											📋 Permintaan diajukan: {new Date(item.tanggal_request).toLocaleDateString(
												'id-ID'
											)}
										</div>
									{/if}
									<div class="flex space-x-2 mt-2">
										<a
											href="/inventory/produksi-notifications"
											class="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
										>
											Detail
										</a>
									</div>
								</div>
							{/each}
							{#if productionNotifications.length > 5}
								<div class="text-center mt-2">
									<a
										href="/inventory/produksi-notifications"
										class="text-xs text-blue-600 hover:text-blue-800"
									>
										Lihat semua ({productionNotifications.length}) permintaan
									</a>
								</div>
							{/if}
						{/if}
					{:else if tab === 'late'}
						{#if lateItems.length === 0}
							<div class="text-gray-400 text-sm text-center">Tidak ada barang terlambat</div>
						{:else}
							{#each lateItems as item}
								<div class="mb-3 p-3 rounded bg-red-50 border border-red-100">
									<div class="font-semibold text-red-700">{item.nama}</div>
									<div class="text-xs text-gray-500">Peminjam: {item.peminjam}</div>
									<div class="text-xs text-red-700">Jatuh tempo: {item.tanggalJatuhTempo}</div>
								</div>
							{/each}
						{/if}
					{:else if tab === 'approval'}
						{#if waitingApprovalItems.length === 0}
							<div class="text-gray-400 text-sm text-center">
								Tidak ada barang menunggu approval
							</div>
						{:else}
							{#each waitingApprovalItems as item}
								<div class="mb-3 p-3 rounded bg-yellow-50 border border-yellow-100">
									<div class="font-semibold text-yellow-700">{item.nama}</div>
									<div class="text-xs text-gray-500">Peminjam: {item.peminjam}</div>
									<div class="text-xs text-yellow-700">Status: {item.status}</div>
								</div>
							{/each}
						{/if}
					{:else if tab === 'reminder'}
						{#if reminders.length === 0}
							<div class="text-gray-400 text-sm text-center">
								Tidak ada barang jatuh tempo besok
							</div>
						{:else}
							{#each reminders as item}
								<div class="mb-3 p-3 rounded bg-blue-50 border border-blue-100">
									<div class="font-semibold text-blue-700">{item.nama}</div>
									<div class="text-xs text-gray-500">Peminjam: {item.peminjam}</div>
									<div class="text-xs text-blue-700">Jatuh tempo: {item.tanggalJatuhTempo}</div>
								</div>
							{/each}
						{/if}
					{:else if tab === 'so'}
						{#if soCustomerData.length === 0}
							<div class="text-gray-400 text-sm text-center">Tidak ada SO Customer</div>
						{:else}
							{#each soCustomerData as so}
								<div class="mb-3 p-3 rounded bg-indigo-50 border border-indigo-100">
									<div class="font-semibold text-indigo-700">{so.nomor_so}</div>
									<div class="text-xs text-gray-500">Customer: {so.company_name}</div>
									<div class="text-xs text-gray-500">PO Customer: {so.nomor_po_customer}</div>
									<div class="text-xs text-indigo-700">Tanggal SO: {so.tanggal_so}</div>
									<div class="text-xs text-indigo-700">
										Tanggal Kirim: {so.tanggal_kirim || '-'}
									</div>
									<div class="text-xs text-gray-600">Sales: {so.sales_name} ({so.sales_code})</div>
									<div class="text-xs font-medium text-indigo-800">
										Total: {new Intl.NumberFormat('id-ID', {
											style: 'currency',
											currency: 'IDR'
										}).format(so.grand_total)}
									</div>
									{#if so.details && so.details.length > 0}
										<div class="text-xs text-gray-500 mt-1">
											Items: {so.details.length} produk
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					{/if}
				</div>
				<div class="flex justify-end p-2 border-t">
					<button
						class="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold"
						on:click={() => (open = false)}>Tutup</button
					>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.animate-pulse {
		animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
