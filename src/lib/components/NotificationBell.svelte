<script>
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';

	export let reminders = [];
	export let lateItems = [];
	export let waitingApprovalItems = [];

	let open = false;
	const dispatch = createEventDispatcher();
	let bellRef;
	let modalRef;
	let tab = 'late';

	function toggle() {
		open = !open;
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
		{#if reminders.length + lateItems.length + waitingApprovalItems.length > 0}
			<span
				class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold animate-pulse"
			>
				{reminders.length + lateItems.length + waitingApprovalItems.length}
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
						class:text-blue-600={tab === 'late'}
						on:click={() => (tab = 'late')}>Terlambat</button
					>
					<button
						class="flex-1 py-3 text-sm font-bold border-b-2"
						class:text-blue-600={tab === 'approval'}
						on:click={() => (tab = 'approval')}>Menunggu Approval</button
					>
					<button
						class="flex-1 py-3 text-sm font-bold border-b-2"
						class:text-blue-600={tab === 'reminder'}
						on:click={() => (tab = 'reminder')}>Jatuh Tempo Besok</button
					>
				</div>
				<div class="p-4 max-h-80 overflow-y-auto">
					{#if tab === 'late'}
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
