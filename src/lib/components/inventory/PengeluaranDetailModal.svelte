<script>
	import jsPDF from 'jspdf';
	import autoTable from 'jspdf-autotable';
	
	export let item = null;
	export let show = false;
	export let onClose = () => {};

	function formatDate(dateStr) {
		if (!dateStr) return '-';
		const date = new Date(dateStr);
		return date.toLocaleDateString('id-ID', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatCurrency(amount) {
		if (!amount) return '-';
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0
		}).format(amount);
	}
	
	function printDetailPDF() {
		if (!item) return;
		
		try {
			// Initialize PDF document (use 'p' for portrait orientation)
			const doc = new jsPDF('p', 'mm', 'a4');
			const pageWidth = doc.internal.pageSize.getWidth();
			
			// Add title
			doc.setFontSize(16);
			doc.setFont('helvetica', 'bold');
			doc.text('Detail Pengeluaran Inventory', pageWidth / 2, 20, { align: 'center' });
			
			// Add date
			doc.setFontSize(10);
			doc.setFont('helvetica', 'normal');
			doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`, pageWidth - 15, 30, { align: 'right' });
			
			// Add basic information section
			doc.setFontSize(12);
			doc.setFont('helvetica', 'bold');
			doc.text('Informasi Barang', 15, 40);
			
			// Information tables - Barang
			const barangData = [
				['Kode Barang', item.kodeBarang || '-'],
				['Nama Barang', item.namaBarang || '-'],
				['Tipe Barang', item.tipeBarang || '-'],
				['Jumlah Keluar', `${item.jumlahKeluar || 0} ${item.satuan || '-'}`]
			];
			
			autoTable(doc, {
				startY: 45,
				body: barangData,
				theme: 'plain',
				styles: { 
					fontSize: 10,
					cellPadding: 2
				},
				columnStyles: { 
					0: { cellWidth: 40, fontStyle: 'bold' },
					1: { cellWidth: 80 }
				}
			});
			
			let currentY = doc.lastAutoTable.finalY + 10;
			
			// Information tables - Pengeluaran
			doc.setFontSize(12);
			doc.setFont('helvetica', 'bold');
			doc.text('Informasi Pengeluaran', 15, currentY);
			
			const pengeluaranData = [
				['Tanggal Keluar', formatDate(item.tanggalKeluar)],
				['Tujuan', item.tujuan || '-'],
				['PIC', item.pic || '-'],
				['Status', item.status || '-']
			];
			
			autoTable(doc, {
				startY: currentY + 5,
				body: pengeluaranData,
				theme: 'plain',
				styles: { 
					fontSize: 10,
					cellPadding: 2
				},
				columnStyles: { 
					0: { cellWidth: 40, fontStyle: 'bold' },
					1: { cellWidth: 80 }
				}
			});
			
			currentY = doc.lastAutoTable.finalY + 10;
			
			// Add Surat Jalan section if applicable
			if (item.nomorSJ) {
				doc.setFontSize(12);
				doc.setFont('helvetica', 'bold');
				doc.text('Informasi Surat Jalan', 15, currentY);
				
				const sjData = [
					['Nomor Surat Jalan', item.nomorSJ || '-']
				];
				
				if (item.nomorPO) sjData.push(['Nomor PO', item.nomorPO]);
				if (item.warna) sjData.push(['Warna', item.warna]);
				if (item.kemasan) sjData.push(['Kemasan', item.kemasan]);
				
				autoTable(doc, {
					startY: currentY + 5,
					body: sjData,
					theme: 'plain',
					styles: { 
						fontSize: 10,
						cellPadding: 2
					},
					columnStyles: { 
						0: { cellWidth: 40, fontStyle: 'bold' },
						1: { cellWidth: 80 }
					},
					didParseCell: function(data) {
						// Add light blue background to all cells in this table
						data.cell.styles.fillColor = [240, 248, 255];
					}
				});
				
				currentY = doc.lastAutoTable.finalY + 10;
			}
			
			// Add pricing information if applicable
			if (item.harga || item.totalHarga) {
				doc.setFontSize(12);
				doc.setFont('helvetica', 'bold');
				doc.text('Informasi Harga', 15, currentY);
				
				const hargaData = [];
				if (item.harga) hargaData.push(['Harga Satuan', formatCurrency(item.harga)]);
				if (item.totalHarga) hargaData.push(['Total Harga', formatCurrency(item.totalHarga)]);
				
				autoTable(doc, {
					startY: currentY + 5,
					body: hargaData,
					theme: 'plain',
					styles: { 
						fontSize: 10,
						cellPadding: 2
					},
					columnStyles: { 
						0: { cellWidth: 40, fontStyle: 'bold' },
						1: { cellWidth: 80 }
					},
					didParseCell: function(data) {
						// Add light gray background to all cells in this table
						data.cell.styles.fillColor = [245, 245, 245];
					}
				});
				
				currentY = doc.lastAutoTable.finalY + 10;
			}
			
			// Add keterangan if applicable
			if (item.keterangan) {
				doc.setFontSize(12);
				doc.setFont('helvetica', 'bold');
				doc.text('Keterangan', 15, currentY);
				
				autoTable(doc, {
					startY: currentY + 5,
					body: [[item.keterangan]],
					theme: 'plain',
					styles: { 
						fontSize: 10,
						cellPadding: 4
					},
					didParseCell: function(data) {
						// Add light gray background to all cells in this table
						data.cell.styles.fillColor = [245, 245, 245];
					}
				});
			}
			
			// Add footer
			doc.setFontSize(9);
			doc.setFont('helvetica', 'italic');
			doc.text('Dicetak dari Sistem Inventory PT. Eltama Prima Indo', pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
			
			// Save the PDF
			doc.save(`Pengeluaran-${item.kodeBarang || 'item'}-${new Date().toISOString().slice(0,10)}.pdf`);
		} catch (error) {
			console.error('Error generating PDF:', error);
			alert('Terjadi kesalahan saat membuat PDF. Silakan coba lagi.');
		}
	}

	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	function handleKeyDown(event) {
		if (event.key === 'Escape') {
			onClose();
		}
	}
</script>

{#if show && item}
	<div 
		class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="0"
		on:click={handleBackdropClick}
		on:keydown={handleKeyDown}
	>
		<div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
				<div class="flex items-center justify-between">
					<h3 id="modal-title" class="text-lg font-semibold text-gray-900">Detail Pengeluaran Inventory</h3>
					<button
						on:click={onClose}
						class="text-gray-400 hover:text-gray-600 transition-colors"
						aria-label="Tutup modal"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="p-6">
				<!-- Basic Information -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
					<div>
						<h4 class="text-sm font-medium text-gray-900 mb-3">Informasi Barang</h4>
						<dl class="space-y-2">
							<div>
								<dt class="text-sm text-gray-500">Kode Barang</dt>
								<dd class="text-sm font-medium text-gray-900">{item.kodeBarang}</dd>
							</div>
							<div>
								<dt class="text-sm text-gray-500">Nama Barang</dt>
								<dd class="text-sm font-medium text-gray-900">{item.namaBarang}</dd>
							</div>
							<div>
								<dt class="text-sm text-gray-500">Tipe Barang</dt>
								<dd>
									<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
										${item.tipeBarang === 'FINISHED GOOD' ? 'bg-purple-100 text-purple-800' : 
										item.tipeBarang === 'RAW MATERIAL' ? 'bg-blue-100 text-blue-800' : 
										'bg-orange-100 text-orange-800'}`}>
										{item.tipeBarang}
									</span>
								</dd>
							</div>
							<div>
								<dt class="text-sm text-gray-500">Jumlah Keluar</dt>
								<dd class="text-sm font-medium text-gray-900">{item.jumlahKeluar} {item.satuan}</dd>
							</div>
						</dl>
					</div>

					<div>
						<h4 class="text-sm font-medium text-gray-900 mb-3">Informasi Pengeluaran</h4>
						<dl class="space-y-2">
							<div>
								<dt class="text-sm text-gray-500">Tanggal Keluar</dt>
								<dd class="text-sm font-medium text-gray-900">{formatDate(item.tanggalKeluar)}</dd>
							</div>
							<div>
								<dt class="text-sm text-gray-500">Tujuan</dt>
								<dd class="text-sm font-medium text-gray-900">{item.tujuan}</dd>
							</div>
							<div>
								<dt class="text-sm text-gray-500">PIC</dt>
								<dd class="text-sm font-medium text-gray-900">{item.pic}</dd>
							</div>
							<div>
								<dt class="text-sm text-gray-500">Status</dt>
								<dd>
									<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
										${item.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
										item.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
										item.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 
										'bg-red-100 text-red-800'}`}>
										{item.status}
									</span>
								</dd>
							</div>
						</dl>
					</div>
				</div>

				<!-- Surat Jalan Information -->
				{#if item.nomorSJ}
					<div class="border-t border-gray-200 pt-6 mb-6">
						<h4 class="text-sm font-medium text-gray-900 mb-3">Informasi Surat Jalan</h4>
						<div class="bg-blue-50 rounded-lg p-4">
							<dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<dt class="text-sm text-gray-500">Nomor Surat Jalan</dt>
									<dd class="text-sm font-medium text-blue-900">{item.nomorSJ}</dd>
								</div>
								{#if item.nomorPO}
									<div>
										<dt class="text-sm text-gray-500">Nomor PO</dt>
										<dd class="text-sm font-medium text-blue-900">{item.nomorPO}</dd>
									</div>
								{/if}
								{#if item.warna}
									<div>
										<dt class="text-sm text-gray-500">Warna</dt>
										<dd class="text-sm font-medium text-blue-900">{item.warna}</dd>
									</div>
								{/if}
								{#if item.kemasan}
									<div>
										<dt class="text-sm text-gray-500">Kemasan</dt>
										<dd class="text-sm font-medium text-blue-900">{item.kemasan}</dd>
									</div>
								{/if}
							</dl>
						</div>
					</div>
				{/if}

				<!-- Pricing Information -->
				{#if item.harga || item.totalHarga}
					<div class="border-t border-gray-200 pt-6 mb-6">
						<h4 class="text-sm font-medium text-gray-900 mb-3">Informasi Harga</h4>
						<div class="bg-gray-50 rounded-lg p-4">
							<dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
								{#if item.harga}
									<div>
										<dt class="text-sm text-gray-500">Harga Satuan</dt>
										<dd class="text-sm font-medium text-gray-900">{formatCurrency(item.harga)}</dd>
									</div>
								{/if}
								{#if item.totalHarga}
									<div>
										<dt class="text-sm text-gray-500">Total Harga</dt>
										<dd class="text-lg font-semibold text-gray-900">{formatCurrency(item.totalHarga)}</dd>
									</div>
								{/if}
							</dl>
						</div>
					</div>
				{/if}

				<!-- Additional Information -->
				{#if item.keterangan}
					<div class="border-t border-gray-200 pt-6">
						<h4 class="text-sm font-medium text-gray-900 mb-3">Keterangan</h4>
						<div class="bg-gray-50 rounded-lg p-4">
							<p class="text-sm text-gray-700">{item.keterangan}</p>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-lg flex justify-end gap-3">
				<button
					on:click={onClose}
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
				>
					Tutup
				</button>
				<button
					on:click={printDetailPDF}
					class="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center gap-2"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
					</svg>
					Cetak
				</button>
				{#if item.nomorSJ}
					<button
						on:click={() => window.open(`/inventory/finishedgood`, '_blank')}
						class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
					>
						Lihat Surat Jalan
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Ensure modal is above other elements */
	:global(.modal-backdrop) {
		z-index: 1000;
	}
</style>
