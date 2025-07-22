<script>
	import { createEventDispatcher } from 'svelte';

	export let show = false;
	export let soData = null;

	const dispatch = createEventDispatcher();

	function close() {
		show = false;
		dispatch('close');
	}

	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			close();
		}
	}

	// Function to format currency
	function formatCurrency(amount) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR'
		}).format(amount);
	}

	// Function to calculate item total
	function getItemTotal(item) {
		const quantity = item.quantity || 0;
		const price = item.price || 0;
		const discount = item.discount || 0;
		const subtotal = quantity * price;
		const discountAmount = (subtotal * discount) / 100;
		return subtotal - discountAmount;
	}
</script>

{#if show && soData}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
		on:click={handleBackdropClick}
	>
		<div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
			<!-- Header -->
			<div class="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-2xl font-bold">Detail SO Customer</h2>
						<p class="text-indigo-100 mt-1">Nomor SO: {soData.nomor_so}</p>
					</div>
					<button on:click={close} class="text-indigo-100 hover:text-white transition-colors">
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
			<div class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
				<!-- SO Information -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
					<div class="bg-gray-50 rounded-lg p-4">
						<h3 class="text-lg font-semibold text-gray-900 mb-4">Informasi Customer</h3>
						<div class="space-y-3">
							<div>
								<label class="text-sm font-medium text-gray-500">Nama Perusahaan</label>
								<p class="text-gray-900 font-medium">{soData.company_name || '-'}</p>
							</div>
							<div>
								<label class="text-sm font-medium text-gray-500">Kode Customer</label>
								<p class="text-gray-900">{soData.customer_code || '-'}</p>
							</div>
							{#if soData.nomor_po_customer}
								<div>
									<label class="text-sm font-medium text-gray-500">Nomor PO Customer</label>
									<p class="text-gray-900">{soData.nomor_po_customer}</p>
								</div>
							{/if}
						</div>
					</div>

					<div class="bg-gray-50 rounded-lg p-4">
						<h3 class="text-lg font-semibold text-gray-900 mb-4">Informasi SO</h3>
						<div class="space-y-3">
							<div>
								<label class="text-sm font-medium text-gray-500">Tanggal SO</label>
								<p class="text-gray-900">
									{new Date(soData.tanggal_so).toLocaleDateString('id-ID')}
								</p>
							</div>
							<div>
								<label class="text-sm font-medium text-gray-500">Tanggal Kirim</label>
								<p class="text-gray-900">
									{soData.tanggal_kirim
										? new Date(soData.tanggal_kirim).toLocaleDateString('id-ID')
										: 'Belum ditentukan'}
								</p>
							</div>
							<div>
								<label class="text-sm font-medium text-gray-500">Sales</label>
								<p class="text-gray-900">{soData.sales_name || '-'} ({soData.sales_code || '-'})</p>
							</div>
						</div>
					</div>
				</div>

				<!-- Products Table -->
				<div class="mb-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Produk yang Diminta</h3>
					{#if soData.details && soData.details.length > 0}
						<div class="overflow-x-auto">
							<table class="min-w-full bg-white border border-gray-200 rounded-lg">
								<thead class="bg-gray-50">
									<tr>
										<th
											class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>No</th
										>
										<th
											class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Nama Produk</th
										>
										<th
											class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Kode Produk</th
										>
										<th
											class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Quantity</th
										>
										<th
											class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Satuan</th
										>
										<th
											class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Harga</th
										>
										<th
											class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Diskon</th
										>
										<th
											class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Total</th
										>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									{#each soData.details as item, index}
										<tr class="hover:bg-gray-50">
											<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
											<td class="px-4 py-4 text-sm text-gray-900 font-medium">
												{item.product_name || item.nama_produk || '-'}
											</td>
											<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
												{item.product_code || item.kode_produk || '-'}
											</td>
											<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
												{item.quantity || 0}
											</td>
											<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
												{item.unit || item.satuan || '-'}
											</td>
											<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
												{formatCurrency(item.price || item.harga || 0)}
											</td>
											<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
												{item.discount || item.diskon || 0}%
											</td>
											<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
												{formatCurrency(getItemTotal(item))}
											</td>
										</tr>
									{/each}
								</tbody>
								<tfoot class="bg-gray-50">
									<tr>
										<td
											colspan="7"
											class="px-4 py-3 text-right text-sm font-semibold text-gray-900"
										>
											Grand Total:
										</td>
										<td class="px-4 py-3 whitespace-nowrap text-sm font-bold text-indigo-600">
											{formatCurrency(soData.grand_total || 0)}
										</td>
									</tr>
								</tfoot>
							</table>
						</div>
					{:else}
						<div class="text-center py-8 text-gray-500">
							<svg
								class="mx-auto h-12 w-12 text-gray-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8v2a2 2 0 002 2h-1l-4 4-4-4h-1a2 2 0 002-2V5z"
								/>
							</svg>
							<p class="mt-2">Tidak ada detail produk tersedia</p>
						</div>
					{/if}
				</div>

				<!-- Notes -->
				{#if soData.notes}
					<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
						<h4 class="text-sm font-semibold text-yellow-800 mb-2">Catatan:</h4>
						<p class="text-sm text-yellow-700">{soData.notes}</p>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
				<button
					on:click={close}
					class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}
