// Export utilities for pengeluaran inventory

/**
 * Export pengeluaran data to CSV format
 * @param {Array} data - Pengeluaran data array
 * @param {string} filename - Filename for the exported file
 */
export function exportToCSV(data, filename = 'pengeluaran-inventory') {
    if (!data || data.length === 0) {
        alert('Tidak ada data untuk diekspor');
        return;
    }

    // CSV Headers
    const headers = [
        'Kode Barang',
        'Nama Barang',
        'Tipe Barang',
        'Jumlah Keluar',
        'Satuan',
        'Tanggal Keluar',
        'Tujuan',
        'PIC',
        'Nomor SJ',
        'Nomor PO',
        'Status',
        'Keterangan',
        'Harga Satuan',
        'Total Harga',
        'Warna',
        'Kemasan'
    ];

    // Convert data to CSV rows
    const csvRows = data.map(item => [
        item.kodeBarang || '',
        item.namaBarang || '',
        item.tipeBarang || '',
        item.jumlahKeluar || 0,
        item.satuan || '',
        formatDateForExport(item.tanggalKeluar),
        item.tujuan || '',
        item.pic || '',
        item.nomorSJ || '',
        item.nomorPO || '',
        item.status || '',
        item.keterangan || '',
        item.harga || 0,
        item.totalHarga || 0,
        item.warna || '',
        item.kemasan || ''
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...csvRows]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Export pengeluaran summary to JSON format
 * @param {Object} summary - Summary data object
 * @param {string} filename - Filename for the exported file
 */
export function exportSummaryToJSON(summary, filename = 'pengeluaran-summary') {
    if (!summary) {
        alert('Tidak ada data summary untuk diekspor');
        return;
    }

    const jsonContent = JSON.stringify(summary, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Print pengeluaran report
 * @param {Array} data - Pengeluaran data array
 * @param {Object} summary - Summary data object
 * @param {Object} filters - Applied filters object
 */
export function printPengeluaranReport(data, summary, filters = {}) {
    if (!data || data.length === 0) {
        alert('Tidak ada data untuk dicetak');
        return;
    }

    const printWindow = window.open('', '_blank');
    
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Laporan Pengeluaran Inventory</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    font-size: 12px; 
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                    border-bottom: 2px solid #333; 
                    padding-bottom: 20px; 
                }
                .company-name { 
                    font-size: 18px; 
                    font-weight: bold; 
                    margin-bottom: 5px; 
                }
                .report-title { 
                    font-size: 16px; 
                    font-weight: bold; 
                    margin-bottom: 10px; 
                }
                .report-date { 
                    font-size: 12px; 
                    color: #666; 
                }
                .summary { 
                    margin-bottom: 20px; 
                    background: #f5f5f5; 
                    padding: 15px; 
                    border-radius: 5px; 
                }
                .summary-grid { 
                    display: grid; 
                    grid-template-columns: repeat(4, 1fr); 
                    gap: 15px; 
                }
                .summary-item { 
                    text-align: center; 
                }
                .summary-label { 
                    font-size: 10px; 
                    color: #666; 
                    margin-bottom: 5px; 
                }
                .summary-value { 
                    font-size: 14px; 
                    font-weight: bold; 
                }
                .filters { 
                    margin-bottom: 20px; 
                    font-size: 11px; 
                    color: #666; 
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 20px; 
                }
                th, td { 
                    border: 1px solid #ddd; 
                    padding: 8px; 
                    text-align: left; 
                }
                th { 
                    background-color: #f2f2f2; 
                    font-weight: bold; 
                    font-size: 11px; 
                }
                td { 
                    font-size: 10px; 
                }
                .status-approved { color: #10b981; font-weight: bold; }
                .status-pending { color: #f59e0b; font-weight: bold; }
                .status-progress { color: #3b82f6; font-weight: bold; }
                .status-rejected { color: #ef4444; font-weight: bold; }
                .footer { 
                    margin-top: 30px; 
                    text-align: right; 
                    font-size: 10px; 
                    color: #666; 
                }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                    @page { margin: 1cm; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="company-name">PT. ELTAMA PRIMA INDO</div>
                <div class="report-title">LAPORAN PENGELUARAN INVENTORY</div>
                <div class="report-date">Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}</div>
            </div>

            ${summary ? `
            <div class="summary">
                <h3 style="margin-top: 0;">Ringkasan</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">Total Pengeluaran</div>
                        <div class="summary-value">${summary.total}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Bulan Ini</div>
                        <div class="summary-value">${summary.thisMonth}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Tahun Ini</div>
                        <div class="summary-value">${summary.thisYear}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Total Nilai</div>
                        <div class="summary-value">${formatCurrencyForPrint(summary.totalValue)}</div>
                    </div>
                </div>
            </div>
            ` : ''}

            ${Object.keys(filters).length > 0 ? `
            <div class="filters">
                <strong>Filter yang diterapkan:</strong>
                ${filters.startDate ? `Dari: ${formatDateForExport(filters.startDate)} ` : ''}
                ${filters.endDate ? `Sampai: ${formatDateForExport(filters.endDate)} ` : ''}
                ${filters.type ? `Tipe: ${filters.type} ` : ''}
                ${filters.status ? `Status: ${filters.status} ` : ''}
                ${filters.search ? `Pencarian: "${filters.search}"` : ''}
            </div>
            ` : ''}

            <table>
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Kode</th>
                        <th>Nama Barang</th>
                        <th>Tipe</th>
                        <th>Jumlah</th>
                        <th>Tgl Keluar</th>
                        <th>Tujuan</th>
                        <th>PIC</th>
                        <th>No. SJ</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${item.kodeBarang || '-'}</td>
                            <td>${item.namaBarang || '-'}</td>
                            <td>${item.tipeBarang || '-'}</td>
                            <td>${item.jumlahKeluar || 0} ${item.satuan || ''}</td>
                            <td>${formatDateForExport(item.tanggalKeluar)}</td>
                            <td>${item.tujuan || '-'}</td>
                            <td>${item.pic || '-'}</td>
                            <td>${item.nomorSJ || '-'}</td>
                            <td class="status-${item.status?.toLowerCase() || 'unknown'}">${item.status || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="footer">
                <div>Data diambil dari Sistem Inventory Management</div>
                <div>Dicetak pada: ${new Date().toLocaleString('id-ID')}</div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                    // Close window after printing (optional)
                    setTimeout(function() {
                        window.close();
                    }, 1000);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
}

/**
 * Format date for export (DD/MM/YYYY)
 * @param {string} dateStr - Date string
 * @returns {string} Formatted date
 */
function formatDateForExport(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Format currency for print
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */
function formatCurrencyForPrint(amount) {
    if (!amount) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}
