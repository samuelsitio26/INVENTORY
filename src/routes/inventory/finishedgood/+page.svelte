<script>
	import { onMount } from 'svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { createSuratJalan, generateNomorSJ, getSuratJalan } from '$lib/services/suratjalan.js';
	import { jsPDF } from 'jspdf';
	import 'jspdf-autotable';
	import { addProductionRequest } from '$lib/stores/notifications.js';

	let loading = false;
	let error = null;
	let toast = { show: false, message: '', type: 'success', html: false };
	
	// State untuk data finished goods
	let finishedGoods = [];
	let filteredFinishedGoods = [];
	
	// Paginasi
	let currentPage = 1;
	const itemsPerPage = 20;
	let totalItems = 0;
	let paginatedItems = [];
	
	// Filter dan search
	let searchTerm = '';
	let statusFilter = 'all';
	
	// Form state
	let showAddForm = false;
	let formData = {
		kode_barang: '',
		nama_barang: '',
		kemasan: '',
		quantity: '',
		kode_produk: '',
		nama_produk: '',
		kode_warna: '',
		warna: '',
		produk_group: '',
		nama_produk_group: '',
		kode_formula: '',
		nama_formula: '',
		sisa_stok: ''
	};
	let saving = false;
	
	// Edit form state
	let showEditForm = false;
	let editFormData = { ...formData };

	// State for SJ form
	let showSJForm = false;
	let showSJList = false;
	let suratJalanList = [];
	let rawMaterials = []; // This would be populated from API
	
	// State for Production Request Modal
	let showProductionRequestModal = false;
	let productionRequestItems = [];
	let sjFormData = {
		kode_customer: '',
		kode_sales: '',
		nomor_po_customer: '',
		tanggal_po_customer: new Date().toISOString().split('T')[0],
		nomor_sj: '',
		tanggal_sj: new Date().toISOString().split('T')[0],
		nomor_pajak: '',
		tanggal_pajak: new Date().toISOString().split('T')[0],
		tanggal_invoice: new Date().toISOString().split('T')[0],
		nama_sopir: '',
		no_kendaraan: '',
		term: 30, // Default 30 days
		due_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
		ppn_enable: true,
		include_ppn: true,
		tarif_ppn: 11, // Default 11%
		nominal_ppn: 0,
		dasar_pengenaan_pajak: 0,
		harga_setelah_pajak_diskon: 0,
		sisa_sales_order: 0,
		items: [{
			finish_good_id: '',
			finish_good_name: '',
			raw_material_id: '',
			raw_material_name: '',
			warna: '',
			kemasan: '',
			satuan: '',
			quantity: 1,
			harga: 0,
			diskon: 0,
			total_harga: 0
		}]
	};

	onMount(() => {
		loadFinishedGoods().then(() => {
			checkLowStockItems();
		});
		loadRawMaterials();
	});

	async function loadFinishedGoods() {
		loading = true;
		try {
			const response = await fetch('https://directus.eltamaprimaindo.com/items/finishgood', {
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				}
			});
			
			if (!response.ok) {
				throw new Error('Failed to fetch finished goods');
			}
			
			const data = await response.json();
			finishedGoods = data.data.map(item => ({
				...item,
				status: calculateStatus(item.sisa_stok || 0)
			}));
			
			filteredFinishedGoods = finishedGoods;
			totalItems = finishedGoods.length;
			updatePaginatedItems();
		} catch (err) {
			error = err.message;
			console.error('Load Finished Goods Error:', err);
		} finally {
			loading = false;
		}
	}

	function calculateStatus(stock) {
		if (stock === 0) return 'Out of Stock';
		if (stock < 10) return 'Low Stock';
		return 'Ready';
	}

	function getColorCode(colorName) {
		const colorMap = {
			'WHITE': '#ffffff',
			'BROWN': '#8B4513',
			'GREY': '#808080',
			'GREEN': '#008000',
			'BLUE': '#0000FF',
			'RED': '#FF0000',
			'YELLOW': '#FFFF00',
			'BLACK': '#000000',
			'ORANGE': '#FFA500',
			'PURPLE': '#800080',
			'PINK': '#FFC0CB',
			'CREAM': '#F5F5DC',
			'SILVER': '#C0C0C0',
			'GOLD': '#FFD700'
		};
		return colorMap[colorName] || '#CCCCCC';
	}

	async function saveFinishedGood() {
		saving = true;
		try {
			const response = await fetch('https://directus.eltamaprimaindo.com/items/finishgood', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				},
				body: JSON.stringify({
					...formData,
					quantity: parseInt(formData.quantity) || 0,
					sisa_stok: parseInt(formData.sisa_stok) || 0,
					status: 'published'
				})
			});

			if (!response.ok) {
				throw new Error('Failed to save finished good');
			}

			// Reset form
			formData = {
				kode_barang: '',
				nama_barang: '',
				kemasan: '',
				quantity: '',
				kode_produk: '',
				nama_produk: '',
				kode_warna: '',
				warna: '',
				produk_group: '',
				nama_produk_group: '',
				kode_formula: '',
				nama_formula: '',
				sisa_stok: ''
			};
			
			showAddForm = false;
			await loadFinishedGoods();
			
			toast = { show: true, message: 'Finished good berhasil ditambahkan!', type: 'success' };
			setTimeout(() => toast.show = false, 3000);
		} catch (err) {
			toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
			setTimeout(() => toast.show = false, 3000);
			console.error('Save Error:', err);
		} finally {
			saving = false;
		}
	}

	function openAddForm() {
		showAddForm = true;
	}

	function closeAddForm() {
		showAddForm = false;
		formData = {
			kode_barang: '',
			nama_barang: '',
			kemasan: '',
			quantity: '',
			kode_produk: '',
			nama_produk: '',
			kode_warna: '',
		warna: '',
			produk_group: '',
			nama_produk_group: '',
			kode_formula: '',
			nama_formula: '',
			sisa_stok: ''
		};
	}

	function updatePaginatedItems() {
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		paginatedItems = filteredFinishedGoods.slice(start, end);
	}

	function handleSearch() {
		filteredFinishedGoods = finishedGoods.filter(item => {
			const matchesSearch = searchTerm === '' || 
				item.nama_barang.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.kode_barang.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.nama_produk.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.warna.toLowerCase().includes(searchTerm.toLowerCase());
			
			const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
			
			return matchesSearch && matchesStatus;
		});
		
		totalItems = filteredFinishedGoods.length;
		currentPage = 1;
		updatePaginatedItems();
	}

	function nextPage() {
		if (currentPage < Math.ceil(totalItems / itemsPerPage)) {
			currentPage++;
			updatePaginatedItems();
		}
	}

	function previousPage() {
		if (currentPage > 1) {
			currentPage--;
			updatePaginatedItems();
		}
	}

	function goToPage(page) {
		currentPage = page;
		updatePaginatedItems();
	}

	async function updateFinishedGood() {
		saving = true;
		try {
			const response = await fetch(`https://directus.eltamaprimaindo.com/items/finishgood/${editFormData.id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				},
				body: JSON.stringify(editFormData)
			});

			if (!response.ok) {
				throw new Error('Failed to update finished good');
			}

			showEditForm = false;
			await loadFinishedGoods();

			toast = { show: true, message: 'Finished good berhasil diperbarui!', type: 'success' };
			setTimeout(() => toast.show = false, 3000);
		} catch (err) {
			toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
			setTimeout(() => toast.show = false, 3000);
			console.error('Update Error:', err);
		} finally {
			saving = false;
		}
	}

	function openEditForm(item) {
		showEditForm = true;
		editFormData = { ...item };
	}

	// Get list of items that need restocking
	function getItemsNeedingRestock() {
		return finishedGoods.filter(item => item.sisa_stok <= 10 && item.sisa_stok > 0)
			.sort((a, b) => a.sisa_stok - b.sisa_stok); // Sort by stock level, lowest first
	}

	// Show detailed restock info
	function showRestockDetails() {
		const restockItems = getItemsNeedingRestock();
		if (restockItems.length > 0) {
			let message = `<strong>Barang yang perlu di-restock:</strong><br><ul>`;
			restockItems.forEach(item => {
				message += `<li>${item.nama_barang} (${item.kode_barang}) - Sisa: ${item.sisa_stok}</li>`;
			});
			message += `</ul>`;
			
			toast = { 
				show: true, 
				message, 
				type: 'warning',
				html: true
			};
			setTimeout(() => toast.show = false, 10000); // Show for 10 seconds
		} else {
			toast = { 
				show: true, 
				message: 'Semua stok dalam jumlah yang cukup.', 
				type: 'success' 
			};
			setTimeout(() => toast.show = false, 3000);
		}
	}

	// Modified check low stock to be simpler
	function checkLowStockItems() {
		const lowStockItems = getItemsNeedingRestock();
		if (lowStockItems.length > 0) {
			toast = { 
				show: true, 
				message: `Peringatan: Terdapat ${lowStockItems.length} item dengan stok rendah! <button id="view-restock" class="ml-2 px-2 py-1 bg-white text-yellow-700 rounded text-xs font-bold">Lihat Detail</button>`, 
				type: 'warning',
				html: true
			};
			setTimeout(() => toast.show = false, 5000);
			
			// Add event listener after toast is shown
			setTimeout(() => {
				const button = document.getElementById('view-restock');
				if (button) {
					button.addEventListener('click', showRestockDetails);
				}
			}, 100);
		}
	}

	// Function to show production request modal
	function showProductionRequestNotification(item) {
		// Filter items that need production (Low Stock or Out of Stock)
		productionRequestItems = finishedGoods.filter(fg => 
			fg.status === 'Low Stock' || fg.status === 'Out of Stock'
		);
		showProductionRequestModal = true;
	}

	// Function to handle production request submission
	async function submitProductionRequest(item) {
		try {
			// Create production request notification data
			const productionRequestData = {
				nama_barang: item.nama_barang,
				kode_barang: item.kode_barang,
				sisa_stok: item.sisa_stok,
				warna: item.warna || null,
				kemasan: item.kemasan || null,
				priority: item.sisa_stok === 0 ? 'urgent' : item.sisa_stok <= 5 ? 'high' : 'medium',
				tanggal_request: new Date().toISOString(),
				status: 'pending',
				requested_by: 'User', // Could be dynamic based on logged in user
				message: `Permintaan produksi untuk ${item.nama_barang} - Stok saat ini: ${item.sisa_stok}`,
				source: 'manual',
				finish_good_id: item.id
			};

			// Save to Directus database
			const response = await fetch('https://directus.eltamaprimaindo.com/items/produksi_notifications', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				},
				body: JSON.stringify(productionRequestData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(`Failed to save production request: ${errorData.message || response.statusText}`);
			}

			const savedData = await response.json();
			console.log('Production request saved to database:', savedData);

			// Also save to localStorage for backward compatibility and immediate UI update
			let existingRequests = JSON.parse(localStorage.getItem('productionRequests') || '[]');
			
			// Check if request already exists for this item
			const existingIndex = existingRequests.findIndex(req => req.kode_barang === item.kode_barang);
			if (existingIndex !== -1) {
				// Update existing request
				existingRequests[existingIndex] = { ...existingRequests[existingIndex], ...productionRequestData, id: savedData.data.id };
			} else {
				// Add new request
				existingRequests.push({ ...productionRequestData, id: savedData.data.id });
			}
			
			localStorage.setItem('productionRequests', JSON.stringify(existingRequests));

			// Trigger a custom event to notify layout about new production request
			window.dispatchEvent(new CustomEvent('productionRequestAdded', {
				detail: { ...productionRequestData, id: savedData.data.id }
			}));

			toast = {
				show: true,
				message: `Permintaan produksi untuk "${item.nama_barang}" berhasil diajukan dan tersimpan ke database! Silakan cek Produksi Notifications untuk melihat status.`,
				type: 'success'
			};
			setTimeout(() => toast.show = false, 5000);

		} catch (error) {
			console.error('Error submitting production request:', error);
			toast = {
				show: true,
				message: 'Error mengajukan permintaan produksi: ' + error.message,
				type: 'error'
			};
			setTimeout(() => toast.show = false, 5000);
		}
	}

	// Reactive statements
	$: {
		if (searchTerm !== undefined || statusFilter !== undefined) {
			handleSearch();
		}
	}

	$: totalPages = Math.ceil(totalItems / itemsPerPage);
	$: startItem = (currentPage - 1) * itemsPerPage + 1;
	$: endItem = Math.min(currentPage * itemsPerPage, totalItems);

	// Load raw materials data
	async function loadRawMaterials() {
		try {
			const response = await fetch('https://directus.eltamaprimaindo.com/items/rawmaterial', {
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				}
			});
			
			if (!response.ok) {
				throw new Error('Failed to fetch raw materials');
			}
			
			const data = await response.json();
			rawMaterials = data.data;
		} catch (err) {
			console.error('Load Raw Materials Error:', err);
		}
	}

	// Function to add a new item row
	function addItemRow() {
		sjFormData.items = [...sjFormData.items, {
			finish_good_id: '',
			finish_good_name: '',
			raw_material_id: '',
			raw_material_name: '',
			warna: '',
			kemasan: '',
			satuan: '',
			quantity: 1,
			harga: 0,
			diskon: 0,
			total_harga: 0
		}];
	}

	// Function to remove an item row
	function removeItemRow(index) {
		sjFormData.items = sjFormData.items.filter((_, i) => i !== index);
		calculateTotals();
	}

	// Function to handle finish good selection
	function handleFinishGoodSelect(index, finishGoodId) {
		const selectedFinishGood = finishedGoods.find(item => item.id === finishGoodId);
		if (selectedFinishGood) {
			sjFormData.items[index].finish_good_id = selectedFinishGood.id;
			sjFormData.items[index].finish_good_name = selectedFinishGood.nama_barang;
			sjFormData.items[index].warna = selectedFinishGood.warna || '';
			sjFormData.items[index].kemasan = selectedFinishGood.kemasan || '';
			
			// Check if stock is sufficient
			if (selectedFinishGood.sisa_stok < sjFormData.items[index].quantity) {
				toast = {
					show: true,
					message: `Peringatan: Stok ${selectedFinishGood.nama_barang} tidak mencukupi (${selectedFinishGood.sisa_stok} tersedia)`,
					type: 'warning'
				};
				setTimeout(() => toast.show = false, 5000);
			}
		}
		calculateItemTotal(index);
	}

	// Function to handle raw material selection
	function handleRawMaterialSelect(index, rawMaterialId) {
		const selectedRawMaterial = rawMaterials.find(item => item.id === rawMaterialId);
		if (selectedRawMaterial) {
			sjFormData.items[index].raw_material_id = selectedRawMaterial.id;
			sjFormData.items[index].raw_material_name = selectedRawMaterial.nama_barang;
			sjFormData.items[index].satuan = selectedRawMaterial.satuan || '';
			
			// Check if stock is sufficient
			if (selectedRawMaterial.sisa_stok < sjFormData.items[index].quantity) {
				toast = {
					show: true,
					message: `Peringatan: Stok ${selectedRawMaterial.nama_barang} tidak mencukupi (${selectedRawMaterial.sisa_stok} tersedia)`,
					type: 'warning'
				};
				setTimeout(() => toast.show = false, 5000);
			}
		}
		calculateItemTotal(index);
	}

	// Calculate item total price
	function calculateItemTotal(index) {
		const item = sjFormData.items[index];
		const subtotal = item.harga * item.quantity;
		const discount = (subtotal * item.diskon) / 100;
		item.total_harga = subtotal - discount;
		
		calculateTotals();
	}

	// Calculate overall totals
	function calculateTotals() {
		const subtotal = sjFormData.items.reduce((sum, item) => sum + item.total_harga, 0);
		sjFormData.dasar_pengenaan_pajak = subtotal;
		
		if (sjFormData.ppn_enable) {
			sjFormData.nominal_ppn = (subtotal * sjFormData.tarif_ppn) / 100;
		} else {
			sjFormData.nominal_ppn = 0;
		}
		
		sjFormData.harga_setelah_pajak_diskon = sjFormData.include_ppn 
			? subtotal + sjFormData.nominal_ppn 
			: subtotal;
	}

	// Save SJ form
	async function saveSJForm() {
		saving = true;
		try {
			// Validate required fields
			if (!sjFormData.kode_customer.trim()) {
				throw new Error('Kode Customer harus diisi');
			}
			if (!sjFormData.kode_sales.trim()) {
				throw new Error('Kode Sales harus diisi');
			}
			if (!sjFormData.nama_sopir.trim()) {
				throw new Error('Nama Sopir harus diisi');
			}
			if (!sjFormData.no_kendaraan.trim()) {
				throw new Error('No Kendaraan harus diisi');
			}

			// Validate items
			const validItems = sjFormData.items.filter(item => 
				(item.finish_good_id || item.raw_material_id) && item.quantity > 0
			);
			
			if (validItems.length === 0) {
				throw new Error('Minimal harus ada satu item dengan quantity > 0');
			}

			// Check stock for all valid items
			let insufficientStock = false;
			const stockErrors = [];
			
			validItems.forEach(item => {
				if (item.finish_good_id) {
					const finishGood = finishedGoods.find(fg => fg.id === item.finish_good_id);
					if (finishGood && finishGood.sisa_stok < item.quantity) {
						insufficientStock = true;
						stockErrors.push(`Stok ${finishGood.nama_barang} tidak mencukupi (${finishGood.sisa_stok} tersedia)`);
					}
				}
				if (item.raw_material_id) {
					const rawMaterial = rawMaterials.find(rm => rm.id === item.raw_material_id);
					if (rawMaterial && rawMaterial.sisa_stok < item.quantity) {
						insufficientStock = true;
						stockErrors.push(`Stok ${rawMaterial.nama_barang} tidak mencukupi (${rawMaterial.sisa_stok} tersedia)`);
					}
				}
			});
			
			if (insufficientStock) {
				toast = {
					show: true,
					message: `Error: ${stockErrors.join(', ')}`,
					type: 'error'
				};
				setTimeout(() => toast.show = false, 5000);
				throw new Error('Insufficient stock for one or more items');
			}

			// Generate nomor SJ if not provided
			if (!sjFormData.nomor_sj) {
				sjFormData.nomor_sj = await generateNomorSJ();
			}

			// Save to Directus - create separate record for each valid item
			const results = [];
			
			for (let i = 0; i < validItems.length; i++) {
				const item = validItems[i];
				
				const suratJalanData = {
					kode_customer: sjFormData.kode_customer,
					kode_sales: sjFormData.kode_sales,
					no_po: sjFormData.nomor_po_customer,
					tgl_po: sjFormData.tanggal_po_customer,
					nomor_sj: sjFormData.nomor_sj,
					tgl_sj: sjFormData.tanggal_sj,
					no_pajak: sjFormData.nomor_pajak,
					tgl_pajak: sjFormData.tanggal_pajak,
					tgl_invoice: sjFormData.tanggal_invoice,
					nama_sopir: sjFormData.nama_sopir,
					no_kendaraan: sjFormData.no_kendaraan,
					term: sjFormData.term.toString(),
					due_date: sjFormData.due_date,
					ppn_enabled: sjFormData.ppn_enable,
					ppn_included: sjFormData.include_ppn,
					ppn_rate: sjFormData.tarif_ppn,
					ppn_amount: i === 0 ? sjFormData.nominal_ppn : 0, // Only apply PPN to first item
					dpp_amount: i === 0 ? sjFormData.dasar_pengenaan_pajak : 0, // Only apply DPP to first item
					netto_amount: i === 0 ? sjFormData.harga_setelah_pajak_diskon : item.total_harga, // For first item use total, others use item total
					sisa_so: sjFormData.sisa_sales_order,
					// Item specific data
					nama_finishgood: item.finish_good_name || null,
					nama_rawmaterial: item.raw_material_name || null,
					warna: item.warna || null,
					satuan: item.satuan || null,
					quantity: item.quantity || null,
					harga: item.harga || null,
					diskon: item.diskon || null,
					total_harga: item.total_harga || null,
					kemasan: item.kemasan || null
				};

				const result = await createSuratJalan(suratJalanData);
				results.push(result);
			}
			
			// Update stock for finished goods and raw materials
			for (const item of validItems) {
				if (item.finish_good_id && item.quantity > 0) {
					const finishGood = finishedGoods.find(fg => fg.id === item.finish_good_id);
					if (finishGood) {
						const newStock = Math.max(0, finishGood.sisa_stok - item.quantity);
						await updateFinishedGoodStock(item.finish_good_id, newStock);
					}
				}
				
				if (item.raw_material_id && item.quantity > 0) {
					const rawMaterial = rawMaterials.find(rm => rm.id === item.raw_material_id);
					if (rawMaterial) {
						const newStock = Math.max(0, rawMaterial.sisa_stok - item.quantity);
						await updateRawMaterialStock(item.raw_material_id, newStock);
					}
				}
			}
			
			toast = {
				show: true,
				message: `Surat Jalan berhasil dibuat dengan nomor: ${sjFormData.nomor_sj}! Total ${results.length} item disimpan ke Directus. PDF akan otomatis ter-download.`,
				type: 'success'
			};
			setTimeout(() => toast.show = false, 5000);
			
			// Auto print after save
			setTimeout(() => {
				printAfterSave();
			}, 1000);
			
			// Reload data to reflect stock changes
			await loadFinishedGoods();
			await loadRawMaterials();
			
			closeSJForm();
		} catch (err) {
			toast = {
				show: true,
				message: 'Error: ' + err.message,
				type: 'error'
			};
			setTimeout(() => toast.show = false, 5000);
			console.error('Save SJ Error:', err);
		} finally {
			saving = false;
		}
	}

	// Helper function to update finished good stock
	async function updateFinishedGoodStock(id, newStock) {
		try {
			const response = await fetch(`https://directus.eltamaprimaindo.com/items/finishgood/${id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				},
				body: JSON.stringify({
					sisa_stok: newStock
				})
			});

			if (!response.ok) {
				throw new Error('Failed to update finished good stock');
			}
		} catch (error) {
			console.error('Error updating finished good stock:', error);
		}
	}

	// Helper function to update raw material stock
	async function updateRawMaterialStock(id, newStock) {
		try {
			const response = await fetch(`https://directus.eltamaprimaindo.com/items/rawmaterial/${id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				},
				body: JSON.stringify({
					sisa_stok: newStock
				})
			});

			if (!response.ok) {
				throw new Error('Failed to update raw material stock');
			}
		} catch (error) {
			console.error('Error updating raw material stock:', error);
		}
	}

	// Update due date when term changes
	function updateDueDate() {
		const invoiceDate = new Date(sjFormData.tanggal_invoice);
		sjFormData.due_date = new Date(invoiceDate.setDate(invoiceDate.getDate() + sjFormData.term)).toISOString().split('T')[0];
	}

	async function openSJForm() {
		// Reset form data
		sjFormData = {
			kode_customer: '',
			kode_sales: '',
			nomor_po_customer: '',
			tanggal_po_customer: new Date().toISOString().split('T')[0],
			nomor_sj: await generateNomorSJ(), // Auto-generate nomor SJ
			tanggal_sj: new Date().toISOString().split('T')[0],
			nomor_pajak: '',
			tanggal_pajak: new Date().toISOString().split('T')[0],
			tanggal_invoice: new Date().toISOString().split('T')[0],
			nama_sopir: '',
			no_kendaraan: '',
			term: 30, // Default 30 days
			due_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
			ppn_enable: true,
			include_ppn: true,
			tarif_ppn: 11, // Default 11%
			nominal_ppn: 0,
			dasar_pengenaan_pajak: 0,
			harga_setelah_pajak_diskon: 0,
			sisa_sales_order: 0,
			items: [{
				finish_good_id: '',
				finish_good_name: '',
				raw_material_id: '',
				raw_material_name: '',
				warna: '',
				kemasan: '',
				satuan: '',
				quantity: 1,
				harga: 0,
				diskon: 0,
				total_harga: 0
			}]
		};
		showSJForm = true;
	}

	function closeSJForm() {
		showSJForm = false;
	}

	// Load Surat Jalan list
	async function loadSuratJalan() {
		try {
			suratJalanList = await getSuratJalan();
		} catch (error) {
			console.error('Error loading surat jalan:', error);
			toast = {
				show: true,
				message: 'Error loading surat jalan: ' + error.message,
				type: 'error'
			};
			setTimeout(() => toast.show = false, 3000);
		}
	}

	function openSJList() {
		loadSuratJalan();
		showSJList = true;
	}

	function closeSJList() {
		showSJList = false;
	}

	// Function to print Surat Jalan
	function printSuratJalan(sjData) {
		try {
			const doc = new jsPDF();

			// Set font
			doc.setFont('helvetica');

			// Company Header
			doc.setFontSize(16);
			doc.setFont('helvetica', 'bold');
			doc.text('PT. ELTAMA PRIMA INDO', 105, 20, { align: 'center' });
			
			doc.setFontSize(10);
			doc.setFont('helvetica', 'normal');
			doc.text('Jl. Raya Parpostel Gang Nangka RT. 02 RW. 03', 105, 28, { align: 'center' });
			doc.text('No 88 Kel. Bojong Kulur Kec. Gunung Putri', 105, 34, { align: 'center' });
			doc.text('Bogor, Ja-Bar 021-82745454', 105, 40, { align: 'center' });

			// Customer section
			doc.setFontSize(10);
			doc.text('Kepada Yth.', 14, 55);
			doc.text(`${sjData.kode_customer || '-'}`, 14, 62);
			doc.text('PT. MOWILEX INDONESIA', 14, 68);
			doc.text('Jl. Daan Mogot Raya KM. 10 No. 2A RT.001/008, Kedaung-Kaliangke Cengkareng -', 14, 74);
			doc.text('Jakarta Barat, 11710', 14, 80);
			doc.text('Telp: 021 - 5406663, 5451292, 619187', 14, 86);

			// SURAT JALAN title
			doc.setFontSize(18);
			doc.setFont('helvetica', 'bold');
			doc.text('SURAT JALAN', 105, 105, { align: 'center' });

			// Right side information
			doc.setFontSize(10);
			doc.setFont('helvetica', 'normal');
			const rightX = 140;
			doc.text('Nomor', rightX, 55);
			doc.text(':', rightX + 25, 55);
			doc.text(sjData.nomor_sj || '-', rightX + 30, 55);

			doc.text('Tanggal', rightX, 62);
			doc.text(':', rightX + 25, 62);
			doc.text(sjData.tgl_sj ? new Date(sjData.tgl_sj).toLocaleDateString('id-ID') : '-', rightX + 30, 62);

			doc.text('No. Kendaraan', rightX, 69);
			doc.text(':', rightX + 25, 69);
			doc.text(sjData.no_kendaraan || '-', rightX + 30, 69);

			doc.text('Sopir / Kernet', rightX, 76);
			doc.text(':', rightX + 25, 76);
			doc.text(sjData.nama_sopir || '-', rightX + 30, 76);

			doc.text('No. PO', rightX, 83);
			doc.text(':', rightX + 25, 83);
			doc.text(sjData.no_po || '-', rightX + 30, 83);

			doc.text('Tanggal PO', rightX, 90);
			doc.text(':', rightX + 25, 90);
			doc.text(sjData.tgl_po ? new Date(sjData.tgl_po).toLocaleDateString('id-ID') : '-', rightX + 30, 90);

			// Table headers and data
			const headers = [['No.', 'NAMA BARANG', 'QUANTITY', 'SATUAN', 'TOTAL KG']];
			
			// Create table data - group items with same nomor_sj
			let groupedItems = [];
			
			// If printing from list, get items from suratJalanList
			if (suratJalanList && suratJalanList.length > 0) {
				groupedItems = suratJalanList.filter(item => item.nomor_sj === sjData.nomor_sj);
			} 
			// If printing from form (after save), use form data
			else if (sjFormData && sjFormData.items) {
				groupedItems = sjFormData.items.filter(item => 
					(item.finish_good_id || item.raw_material_id) && item.quantity > 0
				).map(item => ({
					nama_finishgood: item.finish_good_name,
					nama_rawmaterial: item.raw_material_name,
					quantity: item.quantity,
					satuan: item.satuan
				}));
			}
			
			const tableData = [];
			let totalKg = 0;

			groupedItems.forEach((item, index) => {
				const namaBarang = item.nama_finishgood || item.nama_rawmaterial || '-';
				const quantity = item.quantity || 0;
				const satuan = item.satuan || 'PAIL';
				const quantityText = `${quantity.toFixed(2)} ${satuan}`;
				const kgPerUnit = satuan.toLowerCase().includes('pail') ? 20 : 1; // Assume 20kg per pail
				const totalKgItem = quantity * kgPerUnit;
				totalKg += totalKgItem;

				tableData.push([
					(index + 1).toString(),
					namaBarang,
					quantityText,
					`${quantity.toFixed(2)} KG`,
					`${totalKgItem.toFixed(2)}`
				]);
			});

			// Add empty row if no items
			if (tableData.length === 0) {
				tableData.push(['1', 'No items found', '-', '-', '0']);
			}

			// Try to use autoTable if available, otherwise use manual table
			if (doc.autoTable) {
				// Add table
				doc.autoTable({
					head: headers,
					body: tableData,
					startY: 120,
					theme: 'grid',
					styles: {
						fontSize: 9,
						cellPadding: 3,
					},
					headStyles: {
						fillColor: [240, 240, 240],
						textColor: [0, 0, 0],
						fontStyle: 'bold'
					},
					columnStyles: {
						0: { cellWidth: 15, halign: 'center' }, // No.
						1: { cellWidth: 80 }, // NAMA BARANG
						2: { cellWidth: 30, halign: 'center' }, // QUANTITY
						3: { cellWidth: 25, halign: 'center' }, // SATUAN
						4: { cellWidth: 30, halign: 'right' } // TOTAL KG
					}
				});

				// Total row - calculate position after table
				const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 5 : 120 + (tableData.length * 10) + 20;
				
				doc.line(14, finalY, 196, finalY);
				doc.setFont('helvetica', 'bold');
				doc.text('TOTAL KG', 150, finalY + 7);
				doc.text(':', 170, finalY + 7);
				doc.text(totalKg.toFixed(2), 175, finalY + 7);

				// Footer section
				const footerY = finalY + 25;
				doc.setFont('helvetica', 'normal');
				doc.text(`Kirim ke : ${sjData.kode_customer || 'Jl. Daan Mogot Raya KM. 10 No. 2A RT.001/008, Kedaung-Kaliangke'}`, 14, footerY);

				doc.text('NB.', 14, footerY + 15);
				doc.text('KIRIM KE CUSTOMER', 30, footerY + 15);

				// Signature section
				const signY = footerY + 35;
				doc.text('STEMPLE & Ttd PENERIMA', 30, signY);
				doc.text('SOPIR', 85, signY);
				doc.text('DIPERIKSA OLEH', 130, signY);
				doc.text('HORMAT KAMI', 175, signY);

				// Signature boxes
				doc.rect(25, signY + 5, 50, 30);
				doc.rect(80, signY + 5, 40, 30);
				doc.rect(125, signY + 5, 40, 30);
				doc.rect(170, signY + 5, 35, 30);
			} else {
				// Manual table drawing if autoTable is not available
				let currentY = 120;
				
				// Draw table headers
				doc.setFontSize(9);
				doc.setFont('helvetica', 'bold');
				doc.text('No.', 20, currentY);
				doc.text('NAMA BARANG', 40, currentY);
				doc.text('QUANTITY', 120, currentY);
				doc.text('SATUAN', 150, currentY);
				doc.text('TOTAL KG', 180, currentY);
				
				currentY += 5;
				doc.line(14, currentY, 196, currentY);
				currentY += 8;
				
				// Draw table rows
				doc.setFont('helvetica', 'normal');
				tableData.forEach(row => {
					doc.text(row[0], 20, currentY);
					doc.text(row[1], 40, currentY);
					doc.text(row[2], 120, currentY);
					doc.text(row[3], 150, currentY);
					doc.text(row[4], 180, currentY);
					currentY += 8;
				});
				
				// Total row
				doc.line(14, currentY, 196, currentY);
				currentY += 8;
				doc.setFont('helvetica', 'bold');
				doc.text('TOTAL KG', 150, currentY);
				doc.text(':', 170, currentY);
				doc.text(totalKg.toFixed(2), 180, currentY);
				
				// Footer section
				const footerY = currentY + 25;
				doc.setFont('helvetica', 'normal');
				doc.text(`Kirim ke : ${sjData.kode_customer || 'Jl. Daan Mogot Raya KM. 10 No. 2A RT.001/008, Kedaung-Kaliangke'}`, 14, footerY);

				doc.text('NB.', 14, footerY + 15);
				doc.text('KIRIM KE CUSTOMER', 30, footerY + 15);

				// Signature section
				const signY = footerY + 35;
				doc.text('STEMPLE & Ttd PENERIMA', 30, signY);
				doc.text('SOPIR', 85, signY);
				doc.text('DIPERIKSA OLEH', 130, signY);
				doc.text('HORMAT KAMI', 175, signY);

				// Signature boxes
				doc.rect(25, signY + 5, 50, 30);
				doc.rect(80, signY + 5, 40, 30);
				doc.rect(125, signY + 5, 40, 30);
				doc.rect(170, signY + 5, 35, 30);
			}

			// Save or print the PDF
			doc.save(`Surat-Jalan-${sjData.nomor_sj}.pdf`);
		} catch (error) {
			console.error('Error printing PDF:', error);
			toast = {
				show: true,
				message: 'Error creating PDF: ' + error.message,
				type: 'error'
			};
			setTimeout(() => toast.show = false, 5000);
		}
	}

	// Function to print from the list
	function printFromList(sjData) {
		printSuratJalan(sjData);
		
		toast = {
			show: true,
			message: `Surat Jalan ${sjData.nomor_sj} berhasil di-download!`,
			type: 'success'
		};
		setTimeout(() => toast.show = false, 3000);
	}

	// Function to print after saving (when form is completed)
	function printAfterSave() {
		if (sjFormData.nomor_sj) {
			// Create a temporary SJ data object from form data
			const tempSJData = {
				nomor_sj: sjFormData.nomor_sj,
				tgl_sj: sjFormData.tanggal_sj,
				kode_customer: sjFormData.kode_customer,
				nama_sopir: sjFormData.nama_sopir,
				no_kendaraan: sjFormData.no_kendaraan,
				no_po: sjFormData.nomor_po_customer,
				tgl_po: sjFormData.tanggal_po_customer
			};
			printSuratJalan(tempSJData);
		}
	}

	// Load raw materials when component mounts
	onMount(() => {
		loadFinishedGoods().then(() => {
			checkLowStockItems();
		});
		loadRawMaterials();
	});
</script>

<svelte:head>
	<title>Finished Goods - Inventory Management</title>
</svelte:head>

<div class="p-6 max-w-full mx-auto">
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Finished Goods</h1>
			<p class="text-gray-600">Kelola produk jadi yang siap untuk dijual</p>
		</div>
		<div class="flex gap-2">
			<button
				class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
				on:click={openAddForm}
			>
				+ Tambah Finish Good
			</button>
			
			<button
				class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
				on:click={() => window.location.reload()}
			>
				Refresh
			</button>

			<button
				class="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
				on:click={openSJForm}
			>
				Buat SJ
			</button>

			<button
				class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
				on:click={openSJList}
			>
				Lihat Surat Jalan
			</button>

			<button
				class="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400"
				on:click={showRestockDetails}
			>
				Lihat Barang Perlu Restock
			</button>
		</div>
	</div>

	{#if toast.show}
		<div class="fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg {
			toast.type === 'success' ? 'bg-green-500' : 
			toast.type === 'warning' ? 'bg-yellow-500' : 
			'bg-red-500'
		} text-white">
			{#if toast.html}
				{@html toast.message}
			{:else}
				{toast.message}
			{/if}
		</div>
	{/if}

	<!-- Add Form Modal -->
	{#if showAddForm}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
			<div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
				<div class="p-6">
					<div class="flex justify-between items-center mb-6">
						<h2 class="text-xl font-bold text-gray-900">Tambah Finish Good</h2>
						<button
							on:click={closeAddForm}
							class="text-gray-400 hover:text-gray-600 focus:outline-none"
						>
							✕
						</button>
					</div>
					
					<form on:submit|preventDefault={saveFinishedGood}>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
							<div>
								<label for="kode_barang" class="block text-sm font-medium text-gray-700 mb-1">Kode Barang *</label>
								<input
									id="kode_barang"
									type="text"
									bind:value={formData.kode_barang}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode barang"
								/>
							</div>
							
							<div>
								<label for="nama_barang" class="block text-sm font-medium text-gray-700 mb-1">Nama Barang *</label>
								<input
									id="nama_barang"
									type="text"
									bind:value={formData.nama_barang}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama barang"
								/>
							</div>
							
							<div>
								<label for="kemasan" class="block text-sm font-medium text-gray-700 mb-1">Kemasan</label>
								<input
									id="kemasan"
									type="text"
									bind:value={formData.kemasan}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Contoh: Kaleng 5L"
								/>
							</div>
							
							<div>
								<label for="quantity" class="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
								<input
									id="quantity"
									type="number"
									bind:value={formData.quantity}
									required
									min="0"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="0"
								/>
							</div>
							
							<div>
								<label for="kode_produk" class="block text-sm font-medium text-gray-700 mb-1">Kode Produk *</label>
								<input
									id="kode_produk"
									type="text"
									bind:value={formData.kode_produk}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode produk"
								/>
							</div>
							
							<div>
								<label for="nama_produk" class="block text-sm font-medium text-gray-700 mb-1">Nama Produk *</label>
								<input
									id="nama_produk"
									type="text"
									bind:value={formData.nama_produk}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama produk"
								/>
							</div>
							
							<div>
								<label for="kode_warna" class="block text-sm font-medium text-gray-700 mb-1">Kode Warna *</label>
								<input
									id="kode_warna"
									type="text"
									bind:value={formData.kode_warna}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode warna"
								/>
							</div>
							
							<div>
								<label for="warna" class="block text-sm font-medium text-gray-700 mb-1">Warna</label>
								<input
									id="warna"
									type="text"
									bind:value={formData.warna}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama warna"
								/>
							</div>
							
							<div>
								<label for="produk_group" class="block text-sm font-medium text-gray-700 mb-1">Produk Group *</label>
								<input
									id="produk_group"
									type="text"
									bind:value={formData.produk_group}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode produk group"
								/>
							</div>
							
							<div>
								<label for="nama_produk_group" class="block text-sm font-medium text-gray-700 mb-1">Nama Produk Group *</label>
								<input
									id="nama_produk_group"
									type="text"
									bind:value={formData.nama_produk_group}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama produk group"
								/>
							</div>
							
							<div>
								<label for="kode_formula" class="block text-sm font-medium text-gray-700 mb-1">Kode Formula</label>
								<input
									id="kode_formula"
									type="text"
									bind:value={formData.kode_formula}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode formula"
								/>
							</div>
							
							<div>
								<label for="nama_formula" class="block text-sm font-medium text-gray-700 mb-1">Nama Formula</label>
								<input
									id="nama_formula"
									type="text"
									bind:value={formData.nama_formula}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama formula"
								/>
							</div>
							
							<div class="md:col-span-2">
								<label for="sisa_stok" class="block text-sm font-medium text-gray-700 mb-1">Sisa Stok *</label>
								<input
									id="sisa_stok"
									type="number"
									bind:value={formData.sisa_stok}
									required
									min="0"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="0"
								/>
							</div>
						</div>
						
						<div class="flex justify-end gap-3">
							<button
								type="button"
								on:click={closeAddForm}
								class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
							>
								Batal
							</button>
							<button
								type="submit"
								disabled={saving}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
							>
								{saving ? 'Menyimpan...' : 'Simpan'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}

	<!-- Edit Form Modal -->
	{#if showEditForm}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
			<div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
				<div class="p-6">
					<div class="flex justify-between items-center mb-6">
						<h2 class="text-xl font-bold text-gray-900">Edit Finish Good</h2>
						<button
							on:click={() => showEditForm = false}
							class="text-gray-400 hover:text-gray-600 focus:outline-none"
						>
							✕
						</button>
					</div>

					<form on:submit|preventDefault={updateFinishedGood}>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
							<div>
								<label for="edit_kode_barang" class="block text-sm font-medium text-gray-700 mb-1">Kode Barang *</label>
								<input
									id="edit_kode_barang"
									type="text"
									bind:value={editFormData.kode_barang}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="edit_nama_barang" class="block text-sm font-medium text-gray-700 mb-1">Nama Barang *</label>
								<input
									id="edit_nama_barang"
									type="text"
									bind:value={editFormData.nama_barang}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="edit_kemasan" class="block text-sm font-medium text-gray-700 mb-1">Kemasan</label>
								<input
									id="edit_kemasan"
									type="text"
									bind:value={editFormData.kemasan}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="edit_quantity" class="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
								<input
									id="edit_quantity"
									type="number"
									bind:value={editFormData.quantity}
									required
									min="0"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="edit_kode_produk" class="block text-sm font-medium text-gray-700 mb-1">Kode Produk *</label>
								<input
									id="edit_kode_produk"
									type="text"
									bind:value={editFormData.kode_produk}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="edit_nama_produk" class="block text-sm font-medium text-gray-700 mb-1">Nama Produk *</label>
								<input
									id="edit_nama_produk"
									type="text"
									bind:value={editFormData.nama_produk}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="edit_kode_warna" class="block text-sm font-medium text-gray-700 mb-1">Kode Warna *</label>
								<input
									id="edit_kode_warna"
									type="text"
									bind:value={editFormData.kode_warna}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="edit_warna" class="block text-sm font-medium text-gray-700 mb-1">Warna</label>
								<input
									id="edit_warna"
									type="text"
									bind:value={editFormData.warna}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="edit_produk_group" class="block text-sm font-medium text-gray-700 mb-1">Produk Group *</label>
								<input
									id="edit_produk_group"
									type="text"
									bind:value={editFormData.produk_group}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="edit_nama_produk_group" class="block text-sm font-medium text-gray-700 mb-1">Nama Produk Group *</label>
								<input
									id="edit_nama_produk_group"
									type="text"
									bind:value={editFormData.nama_produk_group}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="edit_kode_formula" class="block text-sm font-medium text-gray-700 mb-1">Kode Formula</label>
								<input
									id="edit_kode_formula"
									type="text"
									bind:value={editFormData.kode_formula}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="edit_nama_formula" class="block text-sm font-medium text-gray-700 mb-1">Nama Formula</label>
								<input
									id="edit_nama_formula"
									type="text"
									bind:value={editFormData.nama_formula}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div class="md:col-span-2">
								<label for="edit_sisa_stok" class="block text-sm font-medium text-gray-700 mb-1">Sisa Stok *</label>
								<input
									id="edit_sisa_stok"
									type="number"
									bind:value={editFormData.sisa_stok}
									required
									min="0"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
						</div>

						<div class="flex justify-end gap-3">
							<button
								type="button"
								on:click={() => showEditForm = false}
								class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
							>
								Batal
							</button>
							<button
								type="submit"
								disabled={saving}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
							>
								{saving ? 'Menyimpan...' : 'Simpan'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}

	<!-- SJ Form Modal -->
	{#if showSJForm}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
			<div class="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
				<div class="p-6">
					<div class="flex justify-between items-center mb-6">
						<h2 class="text-xl font-bold text-gray-900">Buat Surat Jalan (SJ)</h2>
						<button
							on:click={closeSJForm}
							class="text-gray-400 hover:text-gray-600 focus:outline-none"
						>
							✕
						</button>
					</div>
					
					<form on:submit|preventDefault={saveSJForm}>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
							<!-- Customer & Sales Info -->
							<div>
								<label for="kode_customer" class="block text-sm font-medium text-gray-700 mb-1">Kode Customer *</label>
								<input
									id="kode_customer"
									type="text"
									bind:value={sjFormData.kode_customer}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode customer"
								/>
							</div>
							
							<div>
								<label for="kode_sales" class="block text-sm font-medium text-gray-700 mb-1">Kode Sales *</label>
								<input
									id="kode_sales"
									type="text"
									bind:value={sjFormData.kode_sales}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode sales"
								/>
							</div>
							
							<div>
								<label for="nomor_po_customer" class="block text-sm font-medium text-gray-700 mb-1">Nomor PO Customer *</label>
								<input
									id="nomor_po_customer"
									type="text"
									bind:value={sjFormData.nomor_po_customer}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nomor PO customer"
								/>
							</div>
							
							<!-- Dates -->
							<div>
								<label for="tanggal_po_customer" class="block text-sm font-medium text-gray-700 mb-1">Tanggal PO Customer *</label>
								<input
									id="tanggal_po_customer"
									type="date"
									bind:value={sjFormData.tanggal_po_customer}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="nomor_sj" class="block text-sm font-medium text-gray-700 mb-1">Nomor SJ *</label>
								<input
									id="nomor_sj"
									type="text"
									bind:value={sjFormData.nomor_sj}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nomor SJ"
								/>
							</div>
							
							<div>
								<label for="tanggal_sj" class="block text-sm font-medium text-gray-700 mb-1">Tanggal SJ *</label>
								<input
									id="tanggal_sj"
									type="date"
									bind:value={sjFormData.tanggal_sj}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<!-- Tax Info -->
							<div>
								<label for="nomor_pajak" class="block text-sm font-medium text-gray-700 mb-1">Nomor Pajak *</label>
								<input
									id="nomor_pajak"
									type="text"
									bind:value={sjFormData.nomor_pajak}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nomor pajak"
								/>
							</div>
							
							<div>
								<label for="tanggal_pajak" class="block text-sm font-medium text-gray-700 mb-1">Tanggal Pajak *</label>
								<input
									id="tanggal_pajak"
									type="date"
									bind:value={sjFormData.tanggal_pajak}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div>
								<label for="tanggal_invoice" class="block text-sm font-medium text-gray-700 mb-1">Tanggal Invoice *</label>
								<input
									id="tanggal_invoice"
									type="date"
									bind:value={sjFormData.tanggal_invoice}
									required
									on:change={updateDueDate}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<!-- Shipping Info -->
							<div>
								<label for="nama_sopir" class="block text-sm font-medium text-gray-700 mb-1">Nama Sopir</label>
								<input
									id="nama_sopir"
									type="text"
									bind:value={sjFormData.nama_sopir}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama sopir (opsional)"
								/>
							</div>
							
							<div>
								<label for="no_kendaraan" class="block text-sm font-medium text-gray-700 mb-1">No. Kendaraan</label>
								<input
									id="no_kendaraan"
									type="text"
									bind:value={sjFormData.no_kendaraan}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nomor kendaraan (opsional)"
								/>
							</div>
							
							<!-- Payment Terms -->
							<div>
								<label for="term" class="block text-sm font-medium text-gray-700 mb-1">Term (hari) *</label>
								<input
									id="term"
									type="number"
									bind:value={sjFormData.term}
									required
									min="0"
									on:change={updateDueDate}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="30"
								/>
							</div>
							
							<div>
								<label for="due_date" class="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
								<input
									id="due_date"
									type="date"
									bind:value={sjFormData.due_date}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<!-- Tax Settings -->
							<div class="flex items-center space-x-4">
								<div class="flex items-center">
									<input
										id="ppn_enable"
										type="checkbox"
										bind:checked={sjFormData.ppn_enable}
										on:change={calculateTotals}
										class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
									/>
									<label for="ppn_enable" class="ml-2 block text-sm text-gray-700">PPN Enable</label>
								</div>
								
								<div class="flex items-center">
									<input
										id="include_ppn"
										type="checkbox"
										bind:checked={sjFormData.include_ppn}
										on:change={calculateTotals}
										class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
									/>
									<label for="include_ppn" class="ml-2 block text-sm text-gray-700">Include PPN</label>
								</div>
							</div>
							
							<div>
								<label for="tarif_ppn" class="block text-sm font-medium text-gray-700 mb-1">Tarif PPN (%) *</label>
								<input
									id="tarif_ppn"
									type="number"
									bind:value={sjFormData.tarif_ppn}
									required
									min="0"
									on:change={calculateTotals}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="11"
								/>
							</div>
						</div>
						
						<!-- Item Table -->
						<div class="mb-6">
							<div class="flex justify-between items-center mb-3">
								<h3 class="text-lg font-semibold text-gray-900">Daftar Item</h3>
								<button
									type="button"
									on:click={addItemRow}
									class="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400"
								>
									+ Tambah Item
								</button>
							</div>
							
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Finish Good</th>
											<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Raw Material</th>
											<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warna</th>
											<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kemasan</th>
											<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Satuan</th>
											<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
											<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga</th>
											<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diskon (%)</th>
											<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
											<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each sjFormData.items as item, index}
											<tr>
												<td class="px-3 py-2">
													<select
														bind:value={item.finish_good_id}
														on:change={() => handleFinishGoodSelect(index, item.finish_good_id)}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
													>
														<option value="">Pilih Finish Good</option>
														{#each finishedGoods as fg}
															<option value={fg.id} disabled={fg.sisa_stok < item.quantity}>
																{fg.nama_barang} {fg.sisa_stok < item.quantity ? '(Stok tidak cukup)' : ''}
															</option>
														{/each}
													</select>
												</td>
												<td class="px-3 py-2">
													<select
														bind:value={item.raw_material_id}
														on:change={() => handleRawMaterialSelect(index, item.raw_material_id)}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
													>
														<option value="">Pilih Raw Material</option>
														{#each rawMaterials as rm}
															<option value={rm.id} disabled={rm.sisa_stok < item.quantity}>
																{rm.nama} {rm.sisa_stok < item.quantity ? '(Stok tidak cukup)' : ''}
															</option>
														{/each}
													</select>
												</td>
												<td class="px-3 py-2">
													<input
														type="text"
														bind:value={item.warna}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
													/>
												</td>
												<td class="px-3 py-2">
													<input
														type="text"
														bind:value={item.kemasan}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
													/>
												</td>
												<td class="px-3 py-2">
													<input
														type="text"
														bind:value={item.satuan}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
													/>
												</td>
												<td class="px-3 py-2">
													<input
														type="number"
														bind:value={item.quantity}
														min="1"
														on:change={() => calculateItemTotal(index)}
														class="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
													/>
												</td>
												<td class="px-3 py-2">
													<input
														type="number"
														bind:value={item.harga}
														min="0"
														on:change={() => calculateItemTotal(index)}
														class="w-24 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
													/>
												</td>
												<td class="px-3 py-2">
													<input
														type="number"
														bind:value={item.diskon}
														min="0"
														max="100"
														on:change={() => calculateItemTotal(index)}
														class="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
													/>
												</td>
												<td class="px-3 py-2">
													<span class="text-sm font-medium">{item.total_harga.toLocaleString('id-ID')}</span>
												</td>
												<td class="px-3 py-2">
													<button
														type="button"
														on:click={() => removeItemRow(index)}
														disabled={sjFormData.items.length === 1}
														class="px-2 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
													>
														Hapus
													</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
						
						<!-- Summary -->
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
							<div></div>
							<div class="space-y-3">
								<div class="flex justify-between">
									<span class="text-sm font-medium text-gray-700">Dasar Pengenaan Pajak:</span>
									<span class="text-sm">Rp {sjFormData.dasar_pengenaan_pajak.toLocaleString('id-ID')}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-sm font-medium text-gray-700">Nominal PPN ({sjFormData.tarif_ppn}%):</span>
									<span class="text-sm">Rp {sjFormData.nominal_ppn.toLocaleString('id-ID')}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-sm font-medium text-gray-700">Harga Setelah Pajak & Diskon:</span>
									<span class="text-sm font-bold">Rp {sjFormData.harga_setelah_pajak_diskon.toLocaleString('id-ID')}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-sm font-medium text-gray-700">Sisa Sales Order:</span>
									<span class="text-sm">Rp {sjFormData.sisa_sales_order.toLocaleString('id-ID')}</span>
								</div>
							</div>
						</div>
						
						<div class="flex justify-end gap-3">
							<button
								type="button"
								on:click={closeSJForm}
								class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
							>
								Batal
							</button>
							{#if sjFormData.nomor_sj}
								<button
									type="button"
									on:click={printAfterSave}
									class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
								>
									<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
									</svg>
									Print PDF
								</button>
							{/if}
							<button
								type="submit"
								disabled={saving}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
							>
								{saving ? 'Menyimpan...' : 'Simpan'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}

	<!-- Filters -->
	<div class="bg-white rounded-lg shadow p-4 mb-6">
		<div class="flex flex-wrap gap-4 items-center">
			<div class="flex-1 min-w-64">
				<label for="search-input" class="block text-sm font-medium text-gray-700 mb-1">Search</label>
				<input
					id="search-input"
					type="text"
					bind:value={searchTerm}
					placeholder="Cari berdasarkan nama, kode barang, produk, atau warna..."
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
			<div class="min-w-48">
				<label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
				<select
					id="status-filter"
					bind:value={statusFilter}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="all">Semua Status</option>
					<option value="Ready">Ready</option>
					<option value="Low Stock">Low Stock</option>
					<option value="Out of Stock">Out of Stock</option>
				</select>
			</div>
		</div>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Total Produk</div>
			<div class="text-2xl font-bold text-gray-900">{finishedGoods.length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Ready</div>
			<div class="text-2xl font-bold text-green-600">{finishedGoods.filter(item => item.status === 'Ready').length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Low Stock</div>
			<div class="text-2xl font-bold text-yellow-600">{finishedGoods.filter(item => item.status === 'Low Stock').length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Out of Stock</div>
			<div class="text-2xl font-bold text-red-600">{finishedGoods.filter(item => item.status === 'Out of Stock').length}</div>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-8">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
			<span class="ml-2 text-gray-600">Loading...</span>
		</div>
	{:else if error}
		<div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
			<div class="flex">
				<div class="text-red-400">⚠️</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-red-800">Error</h3>
					<div class="mt-2 text-sm text-red-700">{error}</div>
				</div>
			</div>
		</div>
	{:else}
		<!-- Table -->
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode Barang</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Barang</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kemasan</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode Produk</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Produk</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode Warna</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warna</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produk Group</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Produk Group</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode Formula</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Formula</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sisa Stok</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each paginatedItems as item}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.kode_barang}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama_barang}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.kemasan}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.kode_produk}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama_produk}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.kode_warna}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
									<div class="flex items-center">
										<div class="w-4 h-4 rounded-full mr-2 border border-gray-300" style="background-color: {getColorCode(item.warna)};"></div>
										{item.warna}
									</div>
								</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.produk_group}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama_produk_group}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.kode_formula}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama_formula}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.sisa_stok}</td>
								<td class="px-4 py-4 whitespace-nowrap">
									<StatusBadge status={item.status} />
								</td>
								<td class="px-4 py-4 whitespace-nowrap">
									<button
										class="px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
										on:click={() => openEditForm(item)}
									>
										Edit
									</button>
									<button
										class="px-2 py-1 bg-purple-500 text-white rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-400 ml-2"
										on:click={() => submitProductionRequest(item)}
									>
										Ajukan Produksi
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
					<div class="flex-1 flex justify-between items-center">
						<div>
							<p class="text-sm text-gray-700">
								Menampilkan <span class="font-medium">{startItem}</span> sampai <span class="font-medium">{endItem}</span> dari <span class="font-medium">{totalItems}</span> hasil
							</p>
						</div>
						<div class="flex items-center space-x-2">
							<button
								on:click={previousPage}
								disabled={currentPage === 1}
								class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Previous
							</button>
							
							{#each Array(totalPages) as _, i}
								{#if i + 1 === currentPage}
									<button
										class="px-3 py-1 border border-blue-500 bg-blue-50 text-blue-600 rounded-md text-sm font-medium"
									>
										{i + 1}
									</button>
								{:else if i + 1 === 1 || i + 1 === totalPages || (i + 1 >= currentPage - 1 && i + 1 <= currentPage + 1)}
									<button
										on:click={() => goToPage(i + 1)}
										class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
									>
										{i + 1}
									</button>
								{:else if i + 1 === currentPage - 2 || i + 1 === currentPage + 2}
									<span class="px-1 text-gray-500">...</span>
								{/if}
							{/each}
							
							<button
								on:click={nextPage}
								disabled={currentPage === totalPages}
								class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Next
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Surat Jalan List Modal -->
	{#if showSJList}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div class="bg-white p-6 rounded-lg shadow-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
				<div class="flex justify-between items-center mb-6">
					<h2 class="text-xl font-bold text-gray-900">Daftar Surat Jalan</h2>
					<button
						class="text-gray-500 hover:text-gray-700"
						on:click={closeSJList}
						aria-label="Close"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				</div>

				{#if suratJalanList.length === 0}
					<div class="text-center py-8">
						<p class="text-gray-500">Belum ada surat jalan yang dibuat.</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="min-w-full bg-white border border-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nomor SJ</th>
									<th class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal SJ</th>
									<th class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
									<th class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sopir</th>
									<th class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. Kendaraan</th>
									<th class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total (Rp)</th>
									<th class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
									<th class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each suratJalanList as sj}
									<tr class="hover:bg-gray-50">
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
											{sj.nomor_sj || '-'}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{sj.tgl_sj ? new Date(sj.tgl_sj).toLocaleDateString('id-ID') : '-'}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{sj.kode_customer || '-'}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{sj.nama_sopir || '-'}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{sj.no_kendaraan || '-'}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(sj.netto_amount || 0)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
												Created
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
											<button
												class="inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
												on:click={() => printFromList(sj)}
											>
												<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
												</svg>
												Print
											</button>
										</td>
									</tr>
									<!-- Show item details if available -->
									{#if sj.nama_finishgood || sj.nama_rawmaterial}
										<tr class="bg-gray-50">
											<td colspan="8" class="px-6 py-2">
												<div class="text-sm text-gray-600">
													<strong>Items:</strong>
													{#if sj.nama_finishgood}
														{sj.nama_finishgood} ({sj.quantity || 0} {sj.satuan || 'pcs'}) - {sj.warna || ''} - {sj.kemasan || ''}
														{#if sj.harga}
															@ Rp {new Intl.NumberFormat('id-ID').format(sj.harga)}
														{/if}
													{/if}
													{#if sj.nama_rawmaterial}
														{sj.nama_rawmaterial} ({sj.quantity || 0} {sj.satuan || 'pcs'})
														{#if sj.harga}
															@ Rp {new Intl.NumberFormat('id-ID').format(sj.harga)}
														{/if}
													{/if}
													{#if sj.total_harga}
														<br><strong>Total: Rp {new Intl.NumberFormat('id-ID').format(sj.total_harga)}</strong>
													{/if}
												</div>
											</td>
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				<div class="mt-6 flex justify-end">
					<button
						class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
						on:click={closeSJList}
					>
						Tutup
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Production Request Modal -->
	{#if showProductionRequestModal}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div class="bg-white p-6 rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
				<div class="flex justify-between items-center mb-6">
					<h2 class="text-xl font-bold text-gray-900">Permintaan Produksi</h2>
					<button
						class="text-gray-500 hover:text-gray-700"
						on:click={() => showProductionRequestModal = false}
						aria-label="Close"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				</div>

				<div class="mb-4">
					<p class="text-gray-600">Berikut adalah daftar finished goods yang perlu diproduksi:</p>
				</div>

				{#if productionRequestItems.length === 0}
					<div class="text-center py-8">
						<p class="text-gray-500">Semua finished goods memiliki stok yang cukup.</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="min-w-full bg-white border border-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode Barang</th>
									<th class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Barang</th>
									<th class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warna</th>
									<th class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sisa Stok</th>
									<th class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
									<th class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Formula</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each productionRequestItems as item}
									<tr class="hover:bg-gray-50">
										<td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.kode_barang}</td>
										<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama_barang}</td>
										<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
											<div class="flex items-center">
												<div class="w-4 h-4 rounded-full mr-2 border border-gray-300" style="background-color: {getColorCode(item.warna)};"></div>
												{item.warna}
											</div>
										</td>
										<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.sisa_stok}</td>
										<td class="px-4 py-4 whitespace-nowrap">
											<StatusBadge status={item.status} />
										</td>
										<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama_formula}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<div class="mt-6 p-4 bg-blue-50 rounded-lg">
						<div class="flex">
							<div class="text-blue-400">
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
								</svg>
							</div>
							<div class="ml-3">
								<h3 class="text-sm font-medium text-blue-800">Informasi</h3>
								<div class="mt-2 text-sm text-blue-700">
									<p>Terdapat {productionRequestItems.length} item yang perlu diproduksi. Silakan koordinasikan dengan tim produksi untuk melakukan produksi sesuai dengan formula yang tersedia.</p>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<div class="mt-6 flex justify-end gap-3">
					<button
						class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
						on:click={() => showProductionRequestModal = false}
					>
						Tutup
					</button>
					{#if productionRequestItems.length > 0}
						<button
							class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
							on:click={() => {
								// Add notification to the notification bell
								addProductionRequest(productionRequestItems);
								
								// Show success toast
								toast = { 
									show: true, 
									message: `Permintaan produksi untuk ${productionRequestItems.length} item telah dikirim ke tim produksi dan ditambahkan ke notifikasi`,
									type: 'success' 
								};
								setTimeout(() => toast.show = false, 5000);
								
								showProductionRequestModal = false;
							}}
						>
							Kirim Permintaan
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Custom styles if needed */
</style>