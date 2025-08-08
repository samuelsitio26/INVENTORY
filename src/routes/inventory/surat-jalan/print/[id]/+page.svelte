<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let sjData = null;
	let loading = true;
	let error = '';
	
	$: sjId = $page.params.id;

	onMount(async () => {
		await loadSJData();
	});

	async function loadSJData() {
		loading = true;
		try {
			// Load dari localStorage
			const stored = localStorage.getItem('surat_jalans');
			if (stored) {
				const allSJs = JSON.parse(stored);
				sjData = allSJs.find(sj => sj.id === sjId);
				
				if (!sjData) {
					throw new Error('Surat Jalan tidak ditemukan');
				}
			} else {
				throw new Error('Data Surat Jalan tidak tersedia');
			}
		} catch (err) {
			console.error('Error loading SJ data:', err);
			error = err.message;
		} finally {
			loading = false;
		}
	}

	function handlePrint() {
		window.print();
	}

	function backToList() {
		goto('/inventory/surat-jalan');
	}

	function formatDate(dateString) {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function formatCurrency(amount) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR'
		}).format(amount || 0);
	}
</script>

<svelte:head>
	<title>Print Surat Jalan - {sjData?.nomor_sj || ''}</title>
	<style>
		@media print {
			.no-print {
				display: none !important;
			}
			
			.print-container {
				margin: 0 !important;
				padding: 0 !important;
				box-shadow: none !important;
				border: none !important;
			}
			
			body {
				font-size: 12pt;
				line-height: 1.4;
			}
			
			.print-header {
				border-bottom: 2px solid #000;
				margin-bottom: 20px;
				padding-bottom: 10px;
			}
			
			.print-table {
				border-collapse: collapse;
				width: 100%;
			}
			
			.print-table th,
			.print-table td {
				border: 1px solid #000;
				padding: 8px;
				text-align: left;
			}
			
			.print-table th {
				background-color: #f5f5f5;
				font-weight: bold;
			}
		}
	</style>
</svelte:head>

{#if loading}
	<div class="flex items-center justify-center min-h-screen">
		<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
		<span class="ml-2 text-gray-600">Memuat data Surat Jalan...</span>
	</div>
{:else if error}
	<div class="flex items-center justify-center min-h-screen">
		<div class="text-center">
			<div class="text-red-500 text-lg font-medium mb-4">{error}</div>
			<button
				on:click={backToList}
				class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
			>
				Kembali ke Daftar SJ
			</button>
		</div>
	</div>
{:else if sjData}
	<!-- Print Actions (tidak akan terprint) -->
	<div class="no-print bg-white shadow-sm border-b border-gray-200 px-6 py-4 mb-6">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold text-gray-900">Print Surat Jalan</h1>
				<p class="text-sm text-gray-600">Nomor: {sjData.nomor_sj}</p>
			</div>
			<div class="flex space-x-3">
				<button
					on:click={backToList}
					class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
				>
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
					</svg>
					Kembali
				</button>
				<button
					on:click={handlePrint}
					class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
				>
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
					</svg>
					Print
				</button>
			</div>
		</div>
	</div>

	<!-- Print Content -->
	<div class="print-container max-w-4xl mx-auto bg-white p-8">
		<!-- Header -->
		<div class="print-header text-center mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">SURAT JALAN</h1>
			<div class="text-lg">
				<p class="font-semibold">PT. ELTAMA PRIMA INDO</p>
				<p class="text-sm text-gray-600">Jl. Contoh Alamat No. 123, Jakarta</p>
				<p class="text-sm text-gray-600">Telp: (021) 123-4567 | Email: info@eltamaprimaindo.com</p>
			</div>
		</div>

		<!-- Document Info -->
		<div class="grid grid-cols-2 gap-8 mb-8">
			<div>
				<table class="w-full">
					<tbody>
						<tr>
							<td class="font-semibold py-1">Nomor SJ:</td>
							<td>{sjData.nomor_sj}</td>
						</tr>
						<tr>
							<td class="font-semibold py-1">Tanggal SJ:</td>
							<td>{formatDate(sjData.tanggal_sj)}</td>
						</tr>
						<tr>
							<td class="font-semibold py-1">Tanggal Kirim:</td>
							<td>{formatDate(sjData.tanggal_kirim) || 'Sesuai kesepakatan'}</td>
						</tr>
						{#if sjData.nomor_so}
							<tr>
								<td class="font-semibold py-1">Nomor SO:</td>
								<td>{sjData.nomor_so}</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>>
			
			<div>
				<h3 class="font-semibold text-lg mb-3">Kepada:</h3>
				<div class="border border-gray-300 p-4 rounded">
					<p class="font-semibold">{sjData.nama_customer}</p>
					{#if sjData.kode_customer}
						<p class="text-sm text-gray-600">Kode: {sjData.kode_customer}</p>
					{/if}
					{#if sjData.alamat_kirim}
						<p class="text-sm mt-2">{sjData.alamat_kirim}</p>
					{/if}
					{#if sjData.nomor_po_customer}
						<p class="text-sm mt-2">
							<span class="font-semibold">PO Customer:</span> {sjData.nomor_po_customer}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Sales Info -->
		{#if sjData.nama_sales}
			<div class="mb-6">
				<p class="text-sm">
					<span class="font-semibold">Sales:</span> 
					{sjData.nama_sales} 
					{#if sjData.kode_sales}
						({sjData.kode_sales})
					{/if}
				</p>
			</div>
		{/if}

		<!-- Items Table -->
		<div class="mb-8">
			<h3 class="font-semibold text-lg mb-4">Daftar Barang:</h3>
			<table class="print-table w-full border-collapse border border-gray-400">
				<thead>
					<tr class="bg-gray-100">
						<th class="border border-gray-400 px-4 py-2 text-center w-12">No</th>
						<th class="border border-gray-400 px-4 py-2">Kode Barang</th>
						<th class="border border-gray-400 px-4 py-2">Nama Barang</th>
						<th class="border border-gray-400 px-4 py-2 text-center w-20">Qty</th>
						<th class="border border-gray-400 px-4 py-2 text-center w-20">Satuan</th>
						{#if sjData.items?.some(item => item.harga > 0)}
							<th class="border border-gray-400 px-4 py-2 text-right w-32">Harga</th>
							<th class="border border-gray-400 px-4 py-2 text-right w-32">Total</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each sjData.items || [] as item, index}
						<tr>
							<td class="border border-gray-400 px-4 py-2 text-center">{index + 1}</td>
							<td class="border border-gray-400 px-4 py-2">{item.kode_barang || '-'}</td>
							<td class="border border-gray-400 px-4 py-2">{item.nama_barang || '-'}</td>
							<td class="border border-gray-400 px-4 py-2 text-center">{item.qty || 0}</td>
							<td class="border border-gray-400 px-4 py-2 text-center">{item.satuan || 'pcs'}</td>
							{#if sjData.items?.some(item => item.harga > 0)}
								<td class="border border-gray-400 px-4 py-2 text-right">{formatCurrency(item.harga)}</td>
								<td class="border border-gray-400 px-4 py-2 text-right">{formatCurrency(item.total || (item.qty * item.harga))}</td>
							{/if}
						</tr>
					{/each}
				</tbody>
				{#if sjData.items?.some(item => item.harga > 0)}
					<tfoot>
						<tr class="bg-gray-100 font-semibold">
							<td colspan="{sjData.items?.some(item => item.harga > 0) ? '6' : '4'}" class="border border-gray-400 px-4 py-2 text-right">
								Total Keseluruhan:
							</td>
							<td class="border border-gray-400 px-4 py-2 text-right">
								{formatCurrency(sjData.items?.reduce((sum, item) => sum + (item.total || (item.qty * item.harga)), 0) || 0)}
							</td>
						</tr>
					</tfoot>
				{/if}
			</table>
		</div>

		<!-- Summary -->
		<div class="grid grid-cols-2 gap-8 mb-8">
			<div>
				<h4 class="font-semibold mb-2">Ringkasan:</h4>
				<p>Total Item: {sjData.items?.length || 0} produk</p>
				<p>Total Qty: {sjData.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0}</p>
			</div>
			
			{#if sjData.keterangan}
				<div>
					<h4 class="font-semibold mb-2">Keterangan:</h4>
					<p class="text-sm border border-gray-300 p-3 rounded">{sjData.keterangan}</p>
				</div>
			{/if}
		</div>

		<!-- Signatures -->
		<div class="grid grid-cols-3 gap-8 mt-16">
			<div class="text-center">
				<p class="mb-16 font-semibold">Pengirim</p>
				<div class="border-t border-gray-400 pt-2">
					<p>( _________________ )</p>
				</div>
			</div>
			
			<div class="text-center">
				<p class="mb-16 font-semibold">Penerima</p>
				<div class="border-t border-gray-400 pt-2">
					<p>( _________________ )</p>
				</div>
			</div>
			
			<div class="text-center">
				<p class="mb-16 font-semibold">Sopir</p>
				<div class="border-t border-gray-400 pt-2">
					<p>( _________________ )</p>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="text-center text-xs text-gray-500 mt-8 pt-8 border-t border-gray-200">
			<p>Dokumen ini dicetak secara otomatis pada {formatDate(new Date().toISOString())}</p>
		</div>
	</div>
{/if}
