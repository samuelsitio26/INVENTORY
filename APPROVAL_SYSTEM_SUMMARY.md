Sistem Approval Material & Sparepart untuk PT Eltama Prima Indo telah berhasil dimodifikasi dari sistem rental menjadi sistem approval lintas departemen.

## Perubahan yang Telah Dilakukan:

### 1. **Struktur Data Unified**

- Menggabungkan data dari dua endpoint Directus:
  - `/items/spk` (SPK Raw Material untuk Produksi)
  - `/items/inventory_requests` (Sparepart untuk Maintenance)
- Mapping ke struktur data yang konsisten dengan field: id, type, department, namaBarang, kategori, peminjam, quantity, dll.

### 2. **Fungsi Fetch Data**

- `fetchApprovalData()`: Mengambil dan menggabungkan data dari kedua endpoint
- Fallback ke sample data jika API tidak tersedia
- Mapping field yang berbeda dari kedua sumber ke format yang unified

### 3. **Sistem Approval Multi-Level**

- **Manager Departemen** → **Inventory Manager** → **Procurement Manager**
- Status approval: Pending → Dept Approved → Inventory Approved → Approved
- Tambahan status: Rejected untuk penolakan

### 4. **Fungsi Approve/Reject**

- `handleApprove()`: Menyetujui request dan menyimpan ke endpoint yang sesuai
- `handleReject()`: Menolak request dengan alasan
- `canApprove()`: Cek apakah user bisa approve berdasarkan role dan stage
- `canReject()`: Cek apakah user bisa reject

### 5. **UI/UX Improvements**

- Header diubah menjadi "Sistem Approval Material & Sparepart"
- Kartu statistik menampilkan: Total Requests, Pending Approval, Approved, Rejected
- Tombol approve/reject dengan icon yang sesuai
- Detail panel dinamis berdasarkan tipe request (SPK/Inventory)
- Status badge dengan warna yang tepat untuk setiap status

### 6. **Role-Based Access Control**

- Mapping user berdasarkan email di localStorage
- Hanya user dengan role yang sesuai bisa approve di stage tertentu
- Tampilan tombol approve/reject hanya untuk user yang berwenang

### 7. **Error Handling & Feedback**

- Notifikasi success/error saat approve/reject
- Fallback ke sample data jika API gagal
- Refresh data otomatis setelah approval

## Endpoint yang Digunakan:

### SPK (Surat Perintah Kerja)

```
GET/PATCH: https://directus.eltamaprimaindo.com/items/spk
```

- Untuk raw material produksi
- Field: nama_material, quantity, unit, requestor, keterangan

### Inventory Requests

```
GET/PATCH: https://directus.eltamaprimaindo.com/items/inventory_requests
```

- Untuk sparepart maintenance
- Field: item_name, quantity, unit, requestor, notes

## Status Approval Flow:

1. **Pending**: Request baru masuk
2. **Dept Approved**: Disetujui Manager Departemen
3. **Inventory Approved**: Disetujui Inventory Manager
4. **Approved**: Disetujui Procurement Manager (final)
5. **Rejected**: Ditolak di tahap manapun

## Sample Data:

- SPK: Bahan Baku Aluminium (Produksi)
- Inventory: Bearing 6205 (Maintenance)
- Menampilkan berbagai tahap approval untuk testing

## Teknologi:

- SvelteKit
- Tailwind CSS
- Directus Headless CMS
- Fetch API untuk komunikasi dengan backend

Sistem ini sekarang sudah siap untuk digunakan sebagai sistem approval lintas departemen untuk material dan sparepart!
