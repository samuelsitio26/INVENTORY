<script>
	import { createEventDispatcher } from 'svelte';
	import { createGudang } from '$lib/services/gudang.js';
	import Modal from '$lib/components/common/Modal.svelte';

	export let show = false;

	const dispatch = createEventDispatcher();

	let formData = {
		kode_gudang: '',
		nama_gudang: ''
	};

	let loading = false;
	let error = '';
	let success = '';

	// Reset form when modal is opened/closed
	$: if (show) {
		resetForm();
	}

	function resetForm() {
		formData = {
			kode_gudang: '',
			nama_gudang: ''
		};
		error = '';
		success = '';
		loading = false;
	}

	function closeModal() {
		dispatch('close');
	}

	async function handleSubmit() {
		// Validation
		if (!formData.kode_gudang.trim()) {
			error = 'Kode gudang harus diisi';
			return;
		}
		
		if (!formData.nama_gudang.trim()) {
			error = 'Nama gudang harus diisi';
			return;
		}

		// Check if kode_gudang has valid format (optional, adjust as needed)
		if (!/^[A-Z0-9-]+$/.test(formData.kode_gudang.trim())) {
			error = 'Kode gudang hanya boleh mengandung huruf besar, angka, dan tanda strip (-)';
			return;
		}

		loading = true;
		error = '';

		try {
			const result = await createGudang({
				kode_gudang: formData.kode_gudang.trim().toUpperCase(),
				nama_gudang: formData.nama_gudang.trim()
			});

			success = 'Gudang berhasil dibuat!';
			
			// Dispatch success event with created data
			dispatch('success', result);
			
			// Close modal after short delay to show success message
			setTimeout(() => {
				closeModal();
			}, 1500);

		} catch (e) {
			console.error('Error creating gudang:', e);
			error = e.message || 'Gagal membuat gudang';
		} finally {
			loading = false;
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Enter' && !loading) {
			handleSubmit();
		}
	}
</script>

<Modal {show} onClose={closeModal} title="Buat Gudang Baru">
	<form on:submit|preventDefault={handleSubmit} class="space-y-6">
		<!-- Kode Gudang -->
		<div>
			<label for="kode_gudang" class="block text-sm font-medium text-gray-700 mb-2">
				Kode Gudang <span class="text-red-500">*</span>
			</label>
			<input
				id="kode_gudang"
				type="text"
				bind:value={formData.kode_gudang}
				on:keydown={handleKeydown}
				placeholder="Contoh: GD-001, WAREHOUSE-A"
				class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
				class:border-red-300={error && !formData.kode_gudang.trim()}
				disabled={loading}
				maxlength="20"
			/>
			<p class="mt-1 text-xs text-gray-500">
				Format: Huruf besar, angka, dan tanda strip (-). Maksimal 20 karakter.
			</p>
		</div>

		<!-- Nama Gudang -->
		<div>
			<label for="nama_gudang" class="block text-sm font-medium text-gray-700 mb-2">
				Nama Gudang <span class="text-red-500">*</span>
			</label>
			<input
				id="nama_gudang"
				type="text"
				bind:value={formData.nama_gudang}
				on:keydown={handleKeydown}
				placeholder="Contoh: Gudang Utama, Warehouse Area A"
				class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
				class:border-red-300={error && !formData.nama_gudang.trim()}
				disabled={loading}
				maxlength="100"
			/>
			<p class="mt-1 text-xs text-gray-500">
				Nama lengkap gudang. Maksimal 100 karakter.
			</p>
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="bg-red-50 border border-red-200 rounded-lg p-4">
				<div class="flex">
					<svg class="w-5 h-5 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<div>
						<p class="text-sm text-red-800">{error}</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Success Message -->
		{#if success}
			<div class="bg-green-50 border border-green-200 rounded-lg p-4">
				<div class="flex">
					<svg class="w-5 h-5 text-green-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
					</svg>
					<div>
						<p class="text-sm text-green-800">{success}</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Action Buttons -->
		<div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
			<button
				type="button"
				on:click={closeModal}
				disabled={loading}
				class="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Batal
			</button>
			<button
				type="submit"
				disabled={loading || !formData.kode_gudang.trim() || !formData.nama_gudang.trim()}
				class="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
			>
				{#if loading}
					<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					Menyimpan...
				{:else}
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
					</svg>
					Buat Gudang
				{/if}
			</button>
		</div>
	</form>
</Modal>

<style>
	/* Custom focus styles */
	input:focus {
		outline: none;
		box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.1);
	}
	
	/* Animation for success/error messages */
	.bg-red-50, .bg-green-50 {
		animation: slideDown 0.3s ease-out;
	}
	
	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
