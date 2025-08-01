<script>
	import { onMount } from 'svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { createSuratJalan, generateNomorSJ, getSuratJalan } from '$lib/services/suratjalan.js';
	import { getCustomerOptions, getCustomerByKode } from '$lib/services/customer.js';
	import { getGudang } from '$lib/services/gudang.js';
	import { jsPDF } from 'jspdf';
	import 'jspdf-autotable';
	import { addProductionRequest } from '$lib/stores/notifications.js';

	let loading = false;
	let error = null;
	let toast = { show: false, message: '', type: 'success', html: false };

	// State untuk data finished goods
	let finishedGoods = [];
	let filteredFinishedGoods = [];
	let totalCountInDirectus = 0;

	// Paginasi
	let currentPage = 1;
	const itemsPerPage = 20;
	let totalItems = 0;
	let paginatedItems = [];

	// Filter dan search
	let searchTerm = '';
	let statusFilter = 'all';
	let gudangFilter = 'all';

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
		sisa_stok: '',
		kode_gudang: ''
	};
	let saving = false;

	// Edit form state
	let showEditForm = false;
	let editFormData = { ...formData };

	// Gudang state
	let gudangList = [];
	let showGudangTable = false;

	// State for SJ form
	let showSJForm = false;
	let showSJList = false;
	let suratJalanList = [];
	let rawMaterials = []; // This would be populated from API
	let consumableSpareparts = []; // Consumable & Sparepart data from API
	let customerOptions = []; // Customer options for dropdown
	let customerPOList = []; // PO list for selected customer

	// State for Production Request Modal
	let showProductionRequestModal = false;
	let productionRequestItems = [];
	let sjFormData = {
		kode_customer: '',
		nama_customer: '', // Tambahan field untuk nama customer
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
		items: [
			{
				finish_good_id: '',
				finish_good_name: '',
				raw_material_id: '',
				raw_material_name: '',
				consumable_sparepart_id: '',
				consumable_sparepart_name: '',
				item_type: 'finished_good', // 'finished_good', 'raw_material', 'consumable_sparepart'
				warna: '',
				kemasan: '',
				satuan: '',
				quantity: 1
				// Harga, diskon, dan total_harga dihapus
			}
		]
	};

	onMount(() => {
		loadFinishedGoods().then(() => {
			checkLowStockItems();
		});
		loadRawMaterials();
		loadConsumableSpareparts();
		loadCustomerOptions();
		loadGudangList();
	});

	async function loadFinishedGoods() {
		loading = true;
		error = null;
		try {
			console.log('Loading finished goods...');
			console.log('Base URL: https://directus.eltamaprimaindo.com');
			
			// Get total count first
			console.log('Getting total count of finished goods...');
			const countUrl = 'https://directus.eltamaprimaindo.com/items/finishgood?aggregate[count]=*';
			console.log('Count request URL:', countUrl);
			
			const countResponse = await fetch(countUrl, {
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				}
			});
			
			if (!countResponse.ok) {
				console.warn('Could not get count, proceeding without count verification');
			}
			
			let totalCountInDirectus_temp = 0;
			try {
				const countResult = await countResponse.json();
				console.log('Count result:', countResult);
				totalCountInDirectus_temp = countResult.data?.[0]?.count || 0;
				totalCountInDirectus = totalCountInDirectus_temp;
				console.log('Total finished goods in Directus:', totalCountInDirectus);
			} catch (countError) {
				console.warn('Count parsing failed:', countError);
			}
			
			// Get all finished goods using pagination to ensure we get all data
			let allFinishedGoods = [];
			let offset = 0;
			const limit = 1000; // Use pagination with 1000 items per request
			let hasMore = true;
			
			while (hasMore) {
				const dataUrl = `https://directus.eltamaprimaindo.com/items/finishgood?fields=*&limit=${limit}&offset=${offset}&sort=id`;
				console.log(`Data request URL (offset ${offset}):`, dataUrl);
				
				const response = await fetch(dataUrl, {
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				});

				console.log(`Finished goods fetch response status (offset ${offset}):`, response.status);

				if (!response.ok) {
					const errorText = await response.text();
					console.error('Finished goods fetch error response:', errorText);
					throw new Error(`Failed to fetch finished goods: HTTP ${response.status}`);
				}

				const data = await response.json();
				console.log(`Batch ${Math.floor(offset/limit) + 1} - received ${data.data?.length || 0} items`);
				
				if (data.data && Array.isArray(data.data) && data.data.length > 0) {
					allFinishedGoods = allFinishedGoods.concat(data.data);
					offset += limit;
					
					// Check if we've received fewer items than the limit, indicating last page
					if (data.data.length < limit) {
						hasMore = false;
					}
					
					// Safety check - if we've loaded as many as the total count, stop
					if (totalCountInDirectus_temp > 0 && allFinishedGoods.length >= totalCountInDirectus_temp) {
						hasMore = false;
					}
					
					// Safety check - prevent infinite loop
					if (offset > 10000) {
						console.warn('Safety limit reached, stopping pagination');
						hasMore = false;
					}
				} else {
					hasMore = false;
				}
				
				console.log(`Total loaded so far: ${allFinishedGoods.length}`);
			}
			
			console.log('Finished goods fetch result - Total items loaded:', allFinishedGoods.length);
			console.log('Received vs Total:', allFinishedGoods.length, '/', totalCountInDirectus);
			
			// Debug: Log first and last items
			if (allFinishedGoods.length > 0) {
				console.log('First finished good item:', allFinishedGoods[0]);
				console.log('First item keys:', Object.keys(allFinishedGoods[0]));
				console.log('Last finished good item:', allFinishedGoods[allFinishedGoods.length - 1]);
			}
			
			if (!Array.isArray(allFinishedGoods)) {
				throw new Error('Invalid response format - no data array');
			}

			finishedGoods = allFinishedGoods.map((item) => ({
				...item,
				status: calculateStatus(item.sisa_stok || 0)
			}));

			console.log('Finished goods processed:', finishedGoods.length);
			console.log('Total count comparison - Loaded:', finishedGoods.length, 'vs Directus Total:', totalCountInDirectus);
			
			// Debug sample item
			if (finishedGoods[0]) {
				console.log('Sample processed item:', {
					id: finishedGoods[0].id,
					kode_barang: finishedGoods[0].kode_barang,
					nama_barang: finishedGoods[0].nama_barang,
					sisa_stok: finishedGoods[0].sisa_stok,
					status: finishedGoods[0].status
				});
			}

			filteredFinishedGoods = finishedGoods;
			totalItems = finishedGoods.length;
			updatePaginatedItems();
		} catch (err) {
			error = err.message;
			console.error('Load Finished Goods Error:', err);
			console.error('Error details:', {
				message: err.message,
				stack: err.stack,
				name: err.name
			});
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
			WHITE: '#ffffff',
			BROWN: '#8B4513',
			GREY: '#808080',
			GREEN: '#008000',
			BLUE: '#0000FF',
			RED: '#FF0000',
			YELLOW: '#FFFF00',
			BLACK: '#000000',
			ORANGE: '#FFA500',
			PURPLE: '#800080',
			PINK: '#FFC0CB',
			CREAM: '#F5F5DC',
			SILVER: '#C0C0C0',
			GOLD: '#FFD700'
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
			setTimeout(() => (toast.show = false), 3000);
		} catch (err) {
			toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
			setTimeout(() => (toast.show = false), 3000);
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
			sisa_stok: '',
			kode_gudang: ''
		};
	}

	function updatePaginatedItems() {
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		paginatedItems = filteredFinishedGoods.slice(start, end);
	}

	function handleSearch() {
		filteredFinishedGoods = finishedGoods.filter((item) => {
			const matchesSearch =
				searchTerm === '' ||
				item.nama_barang.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.kode_barang.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.nama_produk.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.warna.toLowerCase().includes(searchTerm.toLowerCase());

			const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

			const matchesGudang = gudangFilter === 'all' || item.kode_gudang === gudangFilter;

			return matchesSearch && matchesStatus && matchesGudang;
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
			const response = await fetch(
				`https://directus.eltamaprimaindo.com/items/finishgood/${editFormData.id}`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					},
					body: JSON.stringify(editFormData)
				}
			);

			if (!response.ok) {
				const errorData = await response.text();
				console.error('Update failed with response:', errorData);
				throw new Error('Failed to update finished good');
			}

			showEditForm = false;
			await loadFinishedGoods();

			toast = { show: true, message: 'Finished good berhasil diperbarui!', type: 'success' };
			setTimeout(() => (toast.show = false), 3000);
		} catch (err) {
			toast = { show: true, message: 'Error: ' + err.message, type: 'error' };
			setTimeout(() => (toast.show = false), 3000);
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
		return finishedGoods
			.filter((item) => item.sisa_stok <= 10 && item.sisa_stok > 0)
			.sort((a, b) => a.sisa_stok - b.sisa_stok); // Sort by stock level, lowest first
	}

	// Show detailed restock info
	function showRestockDetails() {
		const restockItems = getItemsNeedingRestock();
		if (restockItems.length > 0) {
			let message = `<strong>Barang yang perlu di-restock:</strong><br><ul>`;
			restockItems.forEach((item) => {
				message += `<li>${item.nama_barang} (${item.kode_barang}) - Sisa: ${item.sisa_stok}</li>`;
			});
			message += `</ul>`;

			toast = {
				show: true,
				message,
				type: 'warning',
				html: true
			};
			setTimeout(() => (toast.show = false), 10000); // Show for 10 seconds
		} else {
			toast = {
				show: true,
				message: 'Semua stok dalam jumlah yang cukup.',
				type: 'success'
			};
			setTimeout(() => (toast.show = false), 3000);
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
			setTimeout(() => (toast.show = false), 5000);

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
		productionRequestItems = finishedGoods.filter(
			(fg) => fg.status === 'Low Stock' || fg.status === 'Out of Stock'
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
			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/produksi_notifications',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					},
					body: JSON.stringify(productionRequestData)
				}
			);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(
					`Failed to save production request: ${errorData.message || response.statusText}`
				);
			}

			const savedData = await response.json();
			console.log('Production request saved to database:', savedData);

			// Also save to localStorage for backward compatibility and immediate UI update
			let existingRequests = JSON.parse(localStorage.getItem('productionRequests') || '[]');

			// Check if request already exists for this item
			const existingIndex = existingRequests.findIndex(
				(req) => req.kode_barang === item.kode_barang
			);
			if (existingIndex !== -1) {
				// Update existing request
				existingRequests[existingIndex] = {
					...existingRequests[existingIndex],
					...productionRequestData,
					id: savedData.data.id
				};
			} else {
				// Add new request
				existingRequests.push({ ...productionRequestData, id: savedData.data.id });
			}

			localStorage.setItem('productionRequests', JSON.stringify(existingRequests));

			// Trigger a custom event to notify layout about new production request
			window.dispatchEvent(
				new CustomEvent('productionRequestAdded', {
					detail: { ...productionRequestData, id: savedData.data.id }
				})
			);

			toast = {
				show: true,
				message: `Permintaan produksi untuk "${item.nama_barang}" berhasil diajukan dan tersimpan ke database! Silakan cek Produksi Notifications untuk melihat status.`,
				type: 'success'
			};
			setTimeout(() => (toast.show = false), 5000);
		} catch (error) {
			console.error('Error submitting production request:', error);
			toast = {
				show: true,
				message: 'Error mengajukan permintaan produksi: ' + error.message,
				type: 'error'
			};
			setTimeout(() => (toast.show = false), 5000);
		}
	}

	// Reactive statements
	$: {
		if (searchTerm !== undefined || statusFilter !== undefined) {
			handleSearch();
		}
	}

	$: {
		if (searchTerm !== undefined || statusFilter !== undefined || gudangFilter !== undefined) {
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

	// Load consumable & sparepart data
	async function loadConsumableSpareparts() {
		try {
			const response = await fetch('https://directus.eltamaprimaindo.com/items/consumable?limit=-1&fields=*', {
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				}
			});

			if (!response.ok) {
				throw new Error('Failed to fetch consumable & sparepart data');
			}

			const data = await response.json();
			
			// Map the data to match our expected structure
			consumableSpareparts = data.data?.map(item => ({
				id: item.id,
				nama: item.namabarang || '-',
				kategori: item.kategori || '-',
				subKategori: item.subkategori || '-',
				stokIn: parseInt(item.stokmasuk) || 0,
				stokOut: parseInt(item.stokkeluar) || 0,
				stokAkhir: parseInt(item.stokakhir) || 0,
				sisa_stok: parseInt(item.stokakhir) || 0, // Use stokakhir as sisa_stok for consistency
				status: item.status || '-',
				moving: item.moving || '-',
				unit: item.unit || '-',
				safety: item.safety || '-'
			})) || [];
			
			console.log('Consumable & Sparepart data loaded:', consumableSpareparts.length);
		} catch (err) {
			console.error('Load Consumable & Sparepart Error:', err);
			consumableSpareparts = [];
		}
	}

	// Load customer options
	async function loadCustomerOptions() {
		try {
			customerOptions = await getCustomerOptions();
			console.log('Customer options loaded:', customerOptions.length);
		} catch (error) {
			console.error('Error loading customer options:', error);
			customerOptions = [];
		}
	}

	// Load PO list for selected customer
	async function loadCustomerPOList(kodeCustomer) {
		try {
			const response = await fetch(`https://directus.eltamaprimaindo.com/items/so_customer?filter[kode_customer][_eq]=${kodeCustomer}`, {
				headers: {
					'Authorization': 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				}
			});

			if (!response.ok) {
				throw new Error('Failed to fetch customer PO data');
			}

			const data = await response.json();
			customerPOList = data.data || [];
			console.log('Customer PO list loaded:', customerPOList.length, 'items for customer:', kodeCustomer);
			
			// Debug: Check if kode_sales exists in the data
			if (customerPOList.length > 0) {
				console.log('Sample PO data:', customerPOList[0]);
				customerPOList.forEach((po, index) => {
					console.log(`PO ${index + 1}:`, {
						nomor_po_customer: po.nomor_po_customer,
						kode_sales: po.kode_sales,
						status: po.status,
						tanggal_po: po.tanggal_po
					});
				});
			}
		} catch (error) {
			console.error('Error loading customer PO list:', error);
			customerPOList = [];
		}
	}

	// Function to load gudang data
	async function loadGudangList() {
		try {
			gudangList = await getGudang();
			console.log('Gudang data loaded:', gudangList.length);
		} catch (error) {
			console.error('Error loading gudang data:', error);
			gudangList = [];
			showToast('Gagal memuat data gudang', 'error');
		}
	}

	// Functions to show/hide gudang table
	function showGudangTableModal() {
		showGudangTable = true;
	}

	function closeGudangTable() {
		showGudangTable = false;
	}

	// Function to get warehouse name by code
	function getGudangName(kodeGudang) {
		if (!kodeGudang) return '-';
		if (!gudangList || gudangList.length === 0) {
			return kodeGudang || '-'; // Return code if name not available
		}
		const gudang = gudangList.find((g) => g.kode_gudang === kodeGudang);
		return gudang ? gudang.nama_gudang : kodeGudang || '-';
	}

	// Function to handle customer selection
	async function handleCustomerChange(event) {
		const selectedKode = event.target.value;
		sjFormData.kode_customer = selectedKode;

		if (selectedKode) {
			try {
				const customer = await getCustomerByKode(selectedKode);
				if (customer) {
					sjFormData.nama_customer = customer.nama_sj_fp || '';
				} else {
					sjFormData.nama_customer = '';
				}

				// Load PO list for this customer
				await loadCustomerPOList(selectedKode);
				
				// Reset PO selection when customer changes
				sjFormData.nomor_po_customer = '';
				sjFormData.tanggal_po_customer = new Date().toISOString().split('T')[0];
				sjFormData.kode_sales = ''; // Reset kode sales
			} catch (error) {
				console.error('Error getting customer details:', error);
				sjFormData.nama_customer = '';
				customerPOList = [];
			}
		} else {
			sjFormData.nama_customer = '';
			customerPOList = [];
			sjFormData.nomor_po_customer = '';
			sjFormData.kode_sales = ''; // Reset kode sales
		}
	}

	// Function to handle PO selection
	function handlePOSelection(event) {
		const selectedPO = event.target.value;
		
		// Find the selected PO data to validate status
		const poData = customerPOList.find(po => po.nomor_po_customer === selectedPO);
		
		// Check if PO status is ready
		if (poData && poData.status === 'ready') {
			// Reset selection and show warning
			sjFormData.nomor_po_customer = '';
			toast = {
				show: true,
				message: 'PO ini sudah berstatus ready dan tidak dapat dipilih lagi.',
				type: 'error'
			};
			setTimeout(() => (toast.show = false), 3000);
			return;
		}
		
		sjFormData.nomor_po_customer = selectedPO;

		// Set the date if available
		if (poData && poData.tanggal_po) {
			sjFormData.tanggal_po_customer = new Date(poData.tanggal_po).toISOString().split('T')[0];
		}

		// Auto-fill kode sales if available
		console.log('Debugging PO selection - Selected PO:', selectedPO);
		console.log('Debugging PO selection - Found PO data:', poData);
		
		if (poData) {
			console.log('All available fields in PO data:', Object.keys(poData));
			
			if (poData.kode_sales) {
				sjFormData.kode_sales = poData.kode_sales;
				console.log('Autofill kode_sales berhasil:', poData.kode_sales);
			} else {
				// Check for alternative field names
				const possibleSalesFields = ['sales_code', 'kodeSales', 'sales', 'kode_salesman'];
				let salesFound = false;
				
				for (const field of possibleSalesFields) {
					if (poData[field]) {
						sjFormData.kode_sales = poData[field];
						console.log(`Autofill kode_sales berhasil menggunakan field alternatif '${field}':`, poData[field]);
						salesFound = true;
						break;
					}
				}
				
				if (!salesFound) {
					console.log('Kode sales tidak ditemukan dalam data PO. Fields tersedia:', Object.keys(poData));
					sjFormData.kode_sales = ''; // Reset if no sales code found
				}
			}
		} else {
			console.log('Data PO tidak ditemukan untuk nomor:', selectedPO);
		}
	}

	// Function to add a new item row
	function addItemRow() {
		sjFormData.items = [
			...sjFormData.items,
			{
				item_type: 'finished_good',
				finish_good_id: '',
				finish_good_name: '',
				raw_material_id: '',
				raw_material_name: '',
				consumable_sparepart_id: '',
				consumable_sparepart_name: '',
				warna: '',
				kemasan: '',
				satuan: '',
				quantity: 1,
				harga: 0,
				diskon: 0,
				total_harga: 0
			}
		];
	}

	// Function to remove an item row
	function removeItemRow(index) {
		sjFormData.items = sjFormData.items.filter((_, i) => i !== index);
		calculateTotals();
	}

	// Function to handle finish good selection
	function handleFinishGoodSelect(index, finishGoodId) {
		const selectedFinishGood = finishedGoods.find((item) => item.id === finishGoodId);
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
				setTimeout(() => (toast.show = false), 5000);
			}
		}
		calculateItemTotal(index);
	}

	// Function to handle raw material selection
	function handleRawMaterialSelect(index, rawMaterialId) {
		const selectedRawMaterial = rawMaterials.find((item) => item.id === rawMaterialId);
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
				setTimeout(() => (toast.show = false), 5000);
			}
		}
		calculateItemTotal(index);
	}

	// Function to handle consumable & sparepart selection
	function handleConsumableSelect(index, consumableId) {
		const selectedConsumable = consumableSpareparts.find((item) => item.id === consumableId);
		if (selectedConsumable) {
			sjFormData.items[index].consumable_sparepart_id = selectedConsumable.id;
			sjFormData.items[index].consumable_sparepart_name = selectedConsumable.nama;
			sjFormData.items[index].satuan = selectedConsumable.unit || '';

			// Check if stock is sufficient
			if (selectedConsumable.sisa_stok < sjFormData.items[index].quantity) {
				toast = {
					show: true,
					message: `Peringatan: Stok ${selectedConsumable.nama} tidak mencukupi (${selectedConsumable.sisa_stok} tersedia)`,
					type: 'warning'
				};
				setTimeout(() => (toast.show = false), 5000);
			}
		}
		calculateItemTotal(index);
	}

	// Function to handle item type selection
	function handleItemTypeSelect(index, itemType) {
		// Clear all item selections when type changes
		sjFormData.items[index].item_type = itemType;
		sjFormData.items[index].finish_good_id = '';
		sjFormData.items[index].finish_good_name = '';
		sjFormData.items[index].raw_material_id = '';
		sjFormData.items[index].raw_material_name = '';
		sjFormData.items[index].consumable_sparepart_id = '';
		sjFormData.items[index].consumable_sparepart_name = '';
		sjFormData.items[index].warna = '';
		sjFormData.items[index].kemasan = '';
		sjFormData.items[index].satuan = '';
	}

	// Calculate item total (simplified - not needed but kept for compatibility)
	function calculateItemTotal(index) {
		// Function kept but no longer calculates financial totals
		// since we only show quantity x unit
	}

	// Calculate overall totals (simplified - removed financial calculations)
	function calculateTotals() {
		// Function kept but simplified since we no longer calculate financial totals
	}

	// Save SJ form
	async function saveSJForm() {
		saving = true;
		try {
			// Removed required field validations - all fields are now optional

			// Validate items
			const validItems = sjFormData.items.filter(
				(item) => (item.finish_good_id || item.raw_material_id || item.consumable_sparepart_id) && item.quantity > 0
			);

			if (validItems.length === 0) {
				throw new Error('Minimal harus ada satu item dengan quantity > 0');
			}

			// Check stock for all valid items
			let insufficientStock = false;
			const stockErrors = [];

			validItems.forEach((item) => {
				if (item.finish_good_id) {
					const finishGood = finishedGoods.find((fg) => fg.id === item.finish_good_id);
					if (finishGood && finishGood.sisa_stok < item.quantity) {
						insufficientStock = true;
						stockErrors.push(
							`Stok ${finishGood.nama_barang} tidak mencukupi (${finishGood.sisa_stok} tersedia)`
						);
					}
				}
				if (item.raw_material_id) {
					const rawMaterial = rawMaterials.find((rm) => rm.id === item.raw_material_id);
					if (rawMaterial && rawMaterial.sisa_stok < item.quantity) {
						insufficientStock = true;
						stockErrors.push(
							`Stok ${rawMaterial.nama_barang} tidak mencukupi (${rawMaterial.sisa_stok} tersedia)`
						);
					}
				}
				if (item.consumable_sparepart_id) {
					const consumable = consumableSpareparts.find((cs) => cs.id === item.consumable_sparepart_id);
					if (consumable && consumable.sisa_stok < item.quantity) {
						insufficientStock = true;
						stockErrors.push(
							`Stok ${consumable.nama} tidak mencukupi (${consumable.sisa_stok} tersedia)`
						);
					}
				}
			});

			if (insufficientStock) {
				toast = {
					show: true,
					message: `Error: ${stockErrors.join(', ')}`,
					type: 'error'
				};
				setTimeout(() => (toast.show = false), 5000);
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
					nama_customer: sjFormData.nama_customer, // Tambah nama customer
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
					nama_consumable_sparepart: item.consumable_sparepart_name || null,
					item_type: item.item_type || 'finished_good',
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

			// Update stock for finished goods, raw materials, and consumable & sparepart
			for (const item of validItems) {
				if (item.finish_good_id && item.quantity > 0) {
					const finishGood = finishedGoods.find((fg) => fg.id === item.finish_good_id);
					if (finishGood) {
						const newStock = Math.max(0, finishGood.sisa_stok - item.quantity);
						await updateFinishedGoodStock(item.finish_good_id, newStock);
					}
				}

				if (item.raw_material_id && item.quantity > 0) {
					const rawMaterial = rawMaterials.find((rm) => rm.id === item.raw_material_id);
					if (rawMaterial) {
						const newStock = Math.max(0, rawMaterial.sisa_stok - item.quantity);
						await updateRawMaterialStock(item.raw_material_id, newStock);
					}
				}

				if (item.consumable_sparepart_id && item.quantity > 0) {
					const consumable = consumableSpareparts.find((cs) => cs.id === item.consumable_sparepart_id);
					if (consumable) {
						const newStock = Math.max(0, consumable.sisa_stok - item.quantity);
						await updateConsumableStock(item.consumable_sparepart_id, newStock);
					}
				}
			}

			toast = {
				show: true,
				message: `Surat Jalan berhasil dibuat dengan nomor: ${sjFormData.nomor_sj}! Total ${results.length} item disimpan ke Directus. PDF akan otomatis ter-download.`,
				type: 'success'
			};
			setTimeout(() => (toast.show = false), 5000);

			// Auto print after save
			setTimeout(async () => {
				await printAfterSave();
			}, 1000);

			// Reload data to reflect stock changes
			await loadFinishedGoods();
			await loadRawMaterials();
			await loadConsumableSpareparts();

			closeSJForm();
		} catch (err) {
			toast = {
				show: true,
				message: 'Error: ' + err.message,
				type: 'error'
			};
			setTimeout(() => (toast.show = false), 5000);
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

	// Helper function to update consumable & sparepart stock
	async function updateConsumableStock(id, newStock) {
		try {
			const response = await fetch(`https://directus.eltamaprimaindo.com/items/consumable/${id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				},
				body: JSON.stringify({
					stokakhir: newStock.toString() // Convert to string as per the API structure
				})
			});

			if (!response.ok) {
				throw new Error('Failed to update consumable & sparepart stock');
			}
		} catch (error) {
			console.error('Error updating consumable & sparepart stock:', error);
		}
	}

	// Update due date when term changes
	function updateDueDate() {
		const invoiceDate = new Date(sjFormData.tanggal_invoice);
		sjFormData.due_date = new Date(invoiceDate.setDate(invoiceDate.getDate() + sjFormData.term))
			.toISOString()
			.split('T')[0];
	}

	async function openSJForm() {
		// Reset form data
		sjFormData = {
			kode_customer: '',
			nama_customer: '', // Reset nama customer
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
			items: [
				{
					finish_good_id: '',
					finish_good_name: '',
					raw_material_id: '',
					raw_material_name: '',
					warna: '',
					kemasan: '',
					satuan: '',
					quantity: 1
					// Harga, diskon, dan total_harga dihapus
				}
			]
		};
		
		// Reset customer PO list
		customerPOList = [];
		
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
			setTimeout(() => (toast.show = false), 3000);
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
	async function printSuratJalan(sjData) {
		try {
			console.log('printSuratJalan called with data:', sjData);
			console.log('suratJalanList:', suratJalanList);
			console.log('sjFormData:', sjFormData);

			// Calculate dynamic page height based on content - optimized for compact layout
			let estimatedHeight = 90; // Reduced base height for header and customer info
			
			// Get item count for height calculation - default minimum 5 items
			let itemCount = 5; // Default minimum 5 items untuk space yang cukup
			if (sjData.items && Array.isArray(sjData.items)) {
				itemCount = Math.max(sjData.items.length, 5); // Minimal 5 items
			} else if (sjFormData && sjFormData.items) {
				itemCount = Math.max(sjFormData.items.length, 5); // Minimal 5 items
			} else if (suratJalanList && suratJalanList.length > 0) {
				const matchingItems = suratJalanList.filter(item => item.nomor_sj === sjData.nomor_sj);
				itemCount = Math.max(matchingItems.length || 1, 5); // Minimal 5 items
			}
			
			// Add height for table: header (8mm) + items (6mm each) + spacing (compact)
			estimatedHeight += 8 + (itemCount * 6) + 10;
			
			// Add height for footer sections: total (10mm) + delivery (12mm) + note (8mm) + signatures (50mm) - INCREASED signature space significantly
			estimatedHeight += 80;
			
			// Create PDF with landscape orientation (width: A4 height, height: dynamic)
			const pageHeight = Math.max(estimatedHeight, 220); // INCREASED minimum height from 180 to 220mm
			const doc = new jsPDF({
				unit: 'mm',
				orientation: 'landscape',
				format: [297, pageHeight] // 297mm width (A4 landscape), dynamic height
			});

			// Set font
			doc.setFont('helvetica');

			// Add Company Logo
			try {
				// Load logo from static folder
				const logoResponse = await fetch('/Logo-Eltama-Prima-Indo-01.png');
				if (logoResponse.ok) {
					const logoBlob = await logoResponse.blob();
					const logoBase64 = await new Promise((resolve) => {
						const reader = new FileReader();
						reader.onload = () => resolve(reader.result);
						reader.readAsDataURL(logoBlob);
					});
					// Add logo to PDF
					doc.addImage(logoBase64, 'PNG', 15, 15, 25, 25); // x, y, width, height
				} else {
					console.warn('Logo file not found, using text placeholder');
					doc.setFontSize(8);
					doc.setFont('helvetica', 'normal');
					doc.text('[LOGO]', 15, 25);
				}
			} catch (error) {
				console.error('Error loading logo:', error);
				// Fallback to text if logo fails to load
				doc.setFontSize(8);
				doc.setFont('helvetica', 'normal');
				doc.text('[LOGO]', 15, 25);
			}

			// Company Header - adjusted for logo space and landscape orientation
			doc.setFontSize(16);
			doc.setFont('helvetica', 'bold');
			doc.text('PT. ELTAMA PRIMA INDO', 148, 20, { align: 'center' });

			doc.setFontSize(9);
			doc.setFont('helvetica', 'normal');
			doc.text('Jl. Raya Parpostel Gang Nangka RT. 02 RW. 03', 148, 28, { align: 'center' });
			doc.text('No 88 Kel. Bojong Kulur Kec. Gunung Putri', 148, 34, { align: 'center' });
			doc.text('Bogor, Ja-Bar 021-82745454', 148, 40, { align: 'center' });

			// Draw separator line - extended for landscape
			doc.setLineWidth(0.5);
			doc.line(14, 45, 283, 45);

			// Customer section - redesigned layout dengan space yang cukup
			doc.setLineWidth(0.3);
			
			// Left box for customer info - ukuran lebih kecil
			doc.rect(14, 50, 100, 35); // Customer info box - dikurangi lebar
			
			doc.setFontSize(9);
			doc.setFont('helvetica', 'normal');
			doc.text('Kepada Yth.', 16, 56);

			// Customer info with compact spacing
			doc.setFont('helvetica', 'bold');
			doc.text(`${sjData.kode_customer || 'CUSTOMER'}`, 16, 62);
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8);
			doc.text(`${sjData.nama_customer || 'PT. MOWILEX INDONESIA'}`, 16, 67);
			doc.text('Jl. Daan Mogot Raya KM. 10 No. 2A', 16, 72);
			doc.text('RT.001/008, Kedaung-Kaliangke', 16, 77);
			doc.text('Cengkareng - Jakarta Barat, 11710', 16, 82);

			// Right box for document info - digeser lebih ke kanan dengan space
			doc.rect(125, 50, 158, 35); // Document info box - digeser ke kanan, lebar ditambah
			
			doc.setFontSize(9);
			doc.setFont('helvetica', 'normal');
			const rightX = 127; // Posisi lebih ke kanan
			const colonX = rightX + 35; // Space untuk label yang lebih panjang
			const valueX = colonX + 5;

			doc.text('Nomor', rightX, 56);
			doc.text(':', colonX, 56);
			doc.text(sjData.nomor_sj || 'SJ/2025/01/0001', valueX, 56);

			doc.text('Tanggal', rightX, 62);
			doc.text(':', colonX, 62);
			doc.text(
				sjData.tgl_sj ? new Date(sjData.tgl_sj).toLocaleDateString('id-ID') : '29/7/2025',
				valueX,
				62
			);

			doc.text('No. Kendaraan', rightX, 68);
			doc.text(':', colonX, 68);
			doc.text(sjData.no_kendaraan || '1231', valueX, 68);

			doc.text('Sopir / Kernet', rightX, 74);
			doc.text(':', colonX, 74);
			doc.text(sjData.nama_sopir || 'ANIRIBU', valueX, 74);

			doc.text('No. PO', rightX, 80);
			doc.text(':', colonX, 80);
			doc.text(sjData.no_po || '123456', valueX, 80);

			// Hapus vertical divider karena tidak perlu lagi

			// SURAT JALAN title - compact positioning
			doc.setFontSize(16);
			doc.setFont('helvetica', 'bold');
			doc.text('SURAT JALAN', 148, 95, { align: 'center' });

			// Table headers and data - Simplified columns without warna
			const headers = [
				['No.', 'NAMA BARANG', 'KEMASAN', 'QTY', 'SATUAN', 'Total KG']
			];

			// Create table data - group items with same nomor_sj
			let groupedItems = [];

			console.log('Preparing groupedItems...');

			// If printing from list, get items from suratJalanList
			if (suratJalanList && suratJalanList.length > 0) {
				// Check if we have items in sjData.items or need to fetch them
				if (sjData.items && Array.isArray(sjData.items)) {
					groupedItems = sjData.items.map((item) => ({
						...item,
						quantity: parseFloat(item.quantity) || 0
					}));
					console.log('Using sjData.items:', groupedItems);
				} else {
					// If no items in sjData, try to find items by nomor_sj in suratJalanList
					// This assumes items might be stored separately with nomor_sj reference
					groupedItems = suratJalanList
						.filter(
							(item) =>
								item.nomor_sj === sjData.nomor_sj &&
								(item.nama_finishgood || item.nama_rawmaterial) &&
								item.quantity
						)
						.map((item) => ({
							...item,
							quantity: parseFloat(item.quantity) || 0
						}));
					console.log('Using suratJalanList filtered items:', groupedItems);
				}
			}
			// If printing from form (after save), use form data
			else if (sjFormData && sjFormData.items) {
				groupedItems = sjFormData.items
					.filter((item) => (item.finish_good_id || item.raw_material_id) && item.quantity > 0)
					.map((item) => ({
						kode_barang: item.kode_barang || item.finish_good_id || item.raw_material_id,
						nama_finishgood: item.finish_good_name,
						nama_rawmaterial: item.raw_material_name,
						warna: item.warna || '',
						kemasan: item.kemasan || '',
						quantity: parseFloat(item.quantity) || 0, // Ensure quantity is a number
						satuan: item.satuan || 'PAIL',
						harga: item.harga || 0,
						total_harga: item.total_harga || 0
					}));
				console.log('Using sjFormData, mapped items:', groupedItems);
			}

			console.log('Final groupedItems:', groupedItems);

			if (!groupedItems || groupedItems.length === 0) {
				console.warn('No items found for printing, creating placeholder item');
				// Create a placeholder item if no items found
				groupedItems = [
					{
						nama_finishgood: 'OX 9250 20 CLEAR',
						nama_rawmaterial: '',
						kemasan: 'PAIL',
						quantity: 2.0,
						satuan: 'PAIL'
					}
				];
			}

			const tableData = [];
			let totalKg = 0; // Initialize the total KG

			groupedItems.forEach((item, index) => {
				const namaBarang = item.nama_finishgood || item.nama_rawmaterial || '-';
				const kemasan = item.kemasan || '-';
				const quantity = Number(parseFloat(item.quantity) || 0);
				const satuan = item.satuan || 'PAIL';
				
				// Calculate total KG for this item (quantity * 1, assuming each unit = 1 KG)
				// You can modify this calculation based on your business logic
				const totalKgItem = quantity; // Assuming 1 unit = 1 KG

				// Add this item's total to the grand total
				totalKg += totalKgItem;

				console.log(`Processing item ${index + 1}:`, {
					namaBarang,
					kemasan,
					quantity,
					satuan,
					totalKgItem,
					runningTotal: totalKg
				});

				tableData.push([
					(index + 1).toString(),
					namaBarang,
					kemasan,
					quantity.toString(),
					satuan,
					totalKgItem.toFixed(2)
				]);
			});

			// Pastikan minimal 5 baris untuk tampilan yang konsisten
			while (tableData.length < 5) {
				tableData.push([
					(tableData.length + 1).toString(),
					'-',
					'-',
					'0',
					'-',
					'0.00'
				]);
			}

			console.log('Final calculated totalKg from table items:', totalKg);

			// Use totalKg as the final total
			const finalTotalKg = totalKg;
			console.log('Using finalTotalKg for PDF:', finalTotalKg);

			// Try to use autoTable if available, otherwise use manual table
			if (doc.autoTable) {
				// Add table with better styling - compact layout for landscape
				doc.autoTable({
					head: headers,
					body: tableData,
					startY: 102, // Moved up for compact layout
					theme: 'grid',
					styles: {
						fontSize: 9, // Slightly smaller font
						cellPadding: 3, // Reduced padding
						lineColor: [0, 0, 0],
						lineWidth: 0.1
					},
					headStyles: {
						fillColor: [240, 240, 240], // Light gray background
						textColor: [0, 0, 0],
						fontStyle: 'bold',
						halign: 'center'
					},
					columnStyles: {
						0: { cellWidth: 18, halign: 'center' }, // No. - compact
						1: { cellWidth: 130, halign: 'left' }, // NAMA BARANG - maximized
						2: { cellWidth: 35, halign: 'center' }, // KEMASAN - compact
						3: { cellWidth: 25, halign: 'center' }, // QTY - compact
						4: { cellWidth: 30, halign: 'center' }, // SATUAN - compact
						5: { cellWidth: 30, halign: 'center' } // Total KG - compact
					},
					margin: { left: 14, right: 14 }
				});

				// Total row - calculate position after table
				const finalY = doc.lastAutoTable
					? doc.lastAutoTable.finalY + 5
					: 135 + tableData.length * 12;

				// Total KG section with better formatting - extended for landscape
				doc.setLineWidth(0.5);
				doc.line(14, finalY, 283, finalY);
				doc.setFont('helvetica', 'bold');
				doc.setFontSize(10);
				doc.text('TOTAL KG', 220, finalY + 8);
				doc.text(':', 245, finalY + 8);
				doc.text(finalTotalKg.toFixed(2), 255, finalY + 8);

				// Customer delivery info - compact
				const deliveryY = finalY + 12; // Reduced spacing further
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(9);
				doc.text(
					`Kirim ke : ${sjData.nama_customer || sjData.kode_customer || 'PT. MOWILEX INDONESIA'}`,
					14,
					deliveryY
				);

				// Note section - compact
				doc.setFont('helvetica', 'bold');
				doc.text('NB.', 14, deliveryY + 6); // Reduced spacing
				doc.setFont('helvetica', 'normal');
				doc.text('KIRIM KE CUSTOMER', 30, deliveryY + 6);

				// Signature section - layout diperbaiki dengan garis bawah yang jelas
				const signY = deliveryY + 18; // Reduced spacing for more room
				doc.setFontSize(9);
				doc.setFont('helvetica', 'normal');

				// Signature labels - dengan spacing yang lebih baik untuk landscape
				doc.text('STEMPLE & Ttd PENERIMA', 15, signY);
				doc.text('SOPIR', 85, signY);
				doc.text('DIPERIKSA OLEH', 155, signY);
				doc.text('HORMAT KAMI', 225, signY);

				// Ensure drawing color and stroke is properly set
				doc.setDrawColor(0, 0, 0); // Black color
				doc.setFillColor(0, 0, 0); // Black fill

				// Single signature underlines - garis bawah yang tebal dan jelas
				const lineY = signY + 20; // Spacing for signature lines
				doc.setLineWidth(1.0); // Thick lines untuk visibility
				
				// Draw signature lines
				doc.line(15, lineY, 80, lineY); // STEMPLE & Ttd PENERIMA - 65mm
				doc.line(85, lineY, 145, lineY); // SOPIR - 60mm
				doc.line(155, lineY, 215, lineY); // DIPERIKSA OLEH - 60mm
				doc.line(225, lineY, 280, lineY); // HORMAT KAMI - 55mm

				// Labels untuk nama di bawah garis
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(7);
				doc.text('( )', 40, lineY + 8); // STEMPLE & Ttd PENERIMA
				doc.text('( )', 110, lineY + 8); // SOPIR
				doc.text('( )', 180, lineY + 8); // DIPERIKSA OLEH
				doc.text('( )', 250, lineY + 8); // HORMAT KAMI
			} else {
				// Manual table drawing if autoTable is not available - compact layout
				let currentY = 102; // Moved up for compact layout

				// Draw table headers
				doc.setFontSize(8);
				doc.setFont('helvetica', 'bold');

				// Header border - extended for landscape with gray background
				doc.setLineWidth(0.5);
				doc.setFillColor(240, 240, 240); // Light gray
				doc.rect(14, currentY - 5, 269, 10, 'FD'); // Fill and draw

				// Header text for 6 columns - repositioned for landscape
				doc.setTextColor(0, 0, 0); // Black text
				doc.text('No.', 18, currentY);
				doc.text('NAMA BARANG', 35, currentY);
				doc.text('KEMASAN', 170, currentY);
				doc.text('QTY', 215, currentY);
				doc.text('SATUAN', 235, currentY);
				doc.text('Total KG', 265, currentY);

				currentY += 8;

				// Draw table rows
				doc.setFont('helvetica', 'normal');
				doc.setFillColor(255, 255, 255); // White background for rows
				tableData.forEach((row, index) => {
					// Row border - extended for landscape with alternating colors
					if (index % 2 === 0) {
						doc.setFillColor(250, 250, 250); // Very light gray for even rows
					} else {
						doc.setFillColor(255, 255, 255); // White for odd rows
					}
					doc.rect(14, currentY - 3, 269, 8, 'FD'); // Reduced height for compact layout

					doc.setFontSize(8); // Smaller font for compact layout
					doc.text(row[0], 18, currentY + 1); // No.
					doc.text(row[1], 35, currentY + 1); // NAMA BARANG
					doc.text(row[2], 170, currentY + 1); // KEMASAN
					doc.text(row[3], 215, currentY + 1); // QTY
					doc.text(row[4], 235, currentY + 1); // SATUAN
					doc.text(row[5], 265, currentY + 1); // TOTAL KG
					currentY += 8; // Reduced spacing
				});

				// Total row - compact layout
				currentY += 3; // Reduced spacing
				doc.setLineWidth(0.5);
				doc.line(14, currentY, 283, currentY);
				doc.setFont('helvetica', 'bold');
				doc.setFontSize(9);
				doc.text('TOTAL KG', 220, currentY + 6);
				doc.text(':', 245, currentY + 6);
				doc.text(finalTotalKg.toFixed(2), 255, currentY + 6);

				// Customer delivery info - compact
				const deliveryY = currentY + 12; // Reduced spacing further
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(9);
				doc.text(
					`Kirim ke : ${sjData.nama_customer || sjData.kode_customer || 'PT. MOWILEX INDONESIA'}`,
					14,
					deliveryY
				);

				// Note section - compact
				doc.setFont('helvetica', 'bold');
				doc.text('NB.', 14, deliveryY + 6); // Reduced spacing
				doc.setFont('helvetica', 'normal');
				doc.text('KIRIM KE CUSTOMER', 30, deliveryY + 6);

				// Signature section - layout diperbaiki dengan space yang cukup (manual table)
				const signY = deliveryY + 18; // Reduced spacing for more room
				doc.setFontSize(9);
				doc.setFont('helvetica', 'normal');

				// Signature labels - dengan spacing yang lebih baik untuk landscape
				doc.text('STEMPLE & Ttd PENERIMA', 15, signY);
				doc.text('SOPIR', 85, signY);
				doc.text('DIPERIKSA OLEH', 155, signY);
				doc.text('HORMAT KAMI', 225, signY);

				// Ensure drawing color and stroke is properly set
				doc.setDrawColor(0, 0, 0); // Black color
				doc.setFillColor(0, 0, 0); // Black fill

				// Single signature underlines - garis bawah yang tebal dan jelas
				const lineY = signY + 20; // Spacing for signature lines
				doc.setLineWidth(1.0); // Thick lines untuk visibility
				
				// Draw signature lines
				doc.line(15, lineY, 80, lineY); // STEMPLE & Ttd PENERIMA - 65mm
				doc.line(85, lineY, 145, lineY); // SOPIR - 60mm
				doc.line(155, lineY, 215, lineY); // DIPERIKSA OLEH - 60mm
				doc.line(225, lineY, 280, lineY); // HORMAT KAMI - 55mm

				// Name labels under signature lines
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(7);
				doc.text('( )', 40, lineY + 8); // STEMPLE & Ttd PENERIMA
				doc.text('( )', 110, lineY + 8); // SOPIR
				doc.text('( )', 180, lineY + 8); // DIPERIKSA OLEH
				doc.text('( )', 250, lineY + 8); // HORMAT KAMI
				
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
			setTimeout(() => (toast.show = false), 5000);
		}
	}

	// Function to print from the list
	async function printFromList(sjData) {
		try {
			console.log('Printing surat jalan:', sjData);
			await printSuratJalan(sjData);

			toast = {
				show: true,
				message: `Surat Jalan ${sjData.nomor_sj} berhasil di-download!`,
				type: 'success'
			};
		} catch (error) {
			console.error('Error in printFromList:', error);
			toast = {
				show: true,
				message: `Error printing Surat Jalan: ${error.message}`,
				type: 'error'
			};
		}
		setTimeout(() => (toast.show = false), 3000);
	}

	// Function to print after saving (when form is completed)
	async function printAfterSave() {
		if (sjFormData.nomor_sj) {
			// Create a temporary SJ data object from form data
			const tempSJData = {
				nomor_sj: sjFormData.nomor_sj,
				tgl_sj: sjFormData.tanggal_sj,
				kode_customer: sjFormData.kode_customer,
				nama_customer: sjFormData.nama_customer, // Tambah nama customer
				nama_sopir: sjFormData.nama_sopir,
				no_kendaraan: sjFormData.no_kendaraan,
				no_po: sjFormData.nomor_po_customer,
				tgl_po: sjFormData.tanggal_po_customer
			};
			await printSuratJalan(tempSJData);
		}
	}

	// Load raw materials when component mounts
	// onMount functionality already handled above
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

			<!-- <button
				class="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
				on:click={showGudangTableModal}
			>
				Lihat Gudang
			</button> -->
		</div>
	</div>

	{#if toast.show}
		<div
			class="fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg {toast.type === 'success'
				? 'bg-green-500'
				: toast.type === 'warning'
					? 'bg-yellow-500'
					: 'bg-red-500'} text-white"
		>
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
								<label for="kode_barang" class="block text-sm font-medium text-gray-700 mb-1"
									>Kode Barang *</label
								>
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
								<label for="nama_barang" class="block text-sm font-medium text-gray-700 mb-1"
									>Nama Barang *</label
								>
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
								<label for="kemasan" class="block text-sm font-medium text-gray-700 mb-1"
									>Kemasan</label
								>
								<input
									id="kemasan"
									type="text"
									bind:value={formData.kemasan}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Contoh: Kaleng 5L"
								/>
							</div>

							<div>
								<label for="quantity" class="block text-sm font-medium text-gray-700 mb-1"
									>Quantity *</label
								>
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
								<label for="kode_produk" class="block text-sm font-medium text-gray-700 mb-1"
									>Kode Produk *</label
								>
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
								<label for="nama_produk" class="block text-sm font-medium text-gray-700 mb-1"
									>Nama Produk *</label
								>
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
								<label for="kode_warna" class="block text-sm font-medium text-gray-700 mb-1"
									>Kode Warna *</label
								>
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
								<label for="warna" class="block text-sm font-medium text-gray-700 mb-1">Warna</label
								>
								<input
									id="warna"
									type="text"
									bind:value={formData.warna}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama warna"
								/>
							</div>

							<div>
								<label for="produk_group" class="block text-sm font-medium text-gray-700 mb-1"
									>Produk Group *</label
								>
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
								<label for="nama_produk_group" class="block text-sm font-medium text-gray-700 mb-1"
									>Nama Produk Group *</label
								>
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
								<label for="kode_formula" class="block text-sm font-medium text-gray-700 mb-1"
									>Kode Formula</label
								>
								<input
									id="kode_formula"
									type="text"
									bind:value={formData.kode_formula}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan kode formula"
								/>
							</div>

							<div>
								<label for="nama_formula" class="block text-sm font-medium text-gray-700 mb-1"
									>Nama Formula</label
								>
								<input
									id="nama_formula"
									type="text"
									bind:value={formData.nama_formula}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama formula"
								/>
							</div>

							<div class="md:col-span-2">
								<label for="sisa_stok" class="block text-sm font-medium text-gray-700 mb-1"
									>Sisa Stok *</label
								>
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

							<div class="md:col-span-2">
								<label for="kode_gudang" class="block text-sm font-medium text-gray-700 mb-1"
									>Gudang *</label
								>
								<select
									id="kode_gudang"
									bind:value={formData.kode_gudang}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
								>
									<option value="">Pilih Gudang</option>
									{#each gudangList as gudang}
										<option value={gudang.kode_gudang}
											>{gudang.kode_gudang} - {gudang.nama_gudang}</option
										>
									{/each}
								</select>
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
							on:click={() => (showEditForm = false)}
							class="text-gray-400 hover:text-gray-600 focus:outline-none"
						>
							✕
						</button>
					</div>

					<form on:submit|preventDefault={updateFinishedGood}>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
							<div>
								<label for="edit_kode_barang" class="block text-sm font-medium text-gray-700 mb-1"
									>Kode Barang *</label
								>
								<input
									id="edit_kode_barang"
									type="text"
									bind:value={editFormData.kode_barang}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="edit_nama_barang" class="block text-sm font-medium text-gray-700 mb-1"
									>Nama Barang *</label
								>
								<input
									id="edit_nama_barang"
									type="text"
									bind:value={editFormData.nama_barang}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="edit_kemasan" class="block text-sm font-medium text-gray-700 mb-1"
									>Kemasan</label
								>
								<input
									id="edit_kemasan"
									type="text"
									bind:value={editFormData.kemasan}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="edit_quantity" class="block text-sm font-medium text-gray-700 mb-1"
									>Quantity *</label
								>
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
								<label for="edit_kode_produk" class="block text-sm font-medium text-gray-700 mb-1"
									>Kode Produk *</label
								>
								<input
									id="edit_kode_produk"
									type="text"
									bind:value={editFormData.kode_produk}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="edit_nama_produk" class="block text-sm font-medium text-gray-700 mb-1"
									>Nama Produk *</label
								>
								<input
									id="edit_nama_produk"
									type="text"
									bind:value={editFormData.nama_produk}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="edit_kode_warna" class="block text-sm font-medium text-gray-700 mb-1"
									>Kode Warna</label
								>
								<input
									id="edit_kode_warna"
									type="text"
									bind:value={editFormData.kode_warna}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="edit_warna" class="block text-sm font-medium text-gray-700 mb-1"
									>Warna</label
								>
								<input
									id="edit_warna"
									type="text"
									bind:value={editFormData.warna}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="edit_produk_group" class="block text-sm font-medium text-gray-700 mb-1"
									>Produk Group *</label
								>
								<input
									id="edit_produk_group"
									type="text"
									bind:value={editFormData.produk_group}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label
									for="edit_nama_produk_group"
									class="block text-sm font-medium text-gray-700 mb-1">Nama Produk Group *</label
								>
								<input
									id="edit_nama_produk_group"
									type="text"
									bind:value={editFormData.nama_produk_group}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="edit_kode_formula" class="block text-sm font-medium text-gray-700 mb-1"
									>Kode Formula</label
								>
								<input
									id="edit_kode_formula"
									type="text"
									bind:value={editFormData.kode_formula}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="edit_nama_formula" class="block text-sm font-medium text-gray-700 mb-1"
									>Nama Formula</label
								>
								<input
									id="edit_nama_formula"
									type="text"
									bind:value={editFormData.nama_formula}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div class="md:col-span-2">
								<label for="edit_sisa_stok" class="block text-sm font-medium text-gray-700 mb-1"
									>Sisa Stok *</label
								>
								<input
									id="edit_sisa_stok"
									type="number"
									bind:value={editFormData.sisa_stok}
									required
									min="0"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div class="md:col-span-2">
								<label for="edit_kode_gudang" class="block text-sm font-medium text-gray-700 mb-1"
									>Gudang *</label
								>
								<select
									id="edit_kode_gudang"
									bind:value={editFormData.kode_gudang}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
								>
									<option value="">Pilih Gudang</option>
									{#each gudangList as gudang}
										<option value={gudang.kode_gudang}
											>{gudang.kode_gudang} - {gudang.nama_gudang}</option
										>
									{/each}
								</select>
							</div>
						</div>

						<div class="flex justify-end gap-3">
							<button
								type="button"
								on:click={() => (showEditForm = false)}
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
								<label for="kode_customer" class="block text-sm font-medium text-gray-700 mb-1"
									>Kode Customer</label
								>
								<select
									id="kode_customer"
									bind:value={sjFormData.kode_customer}
									on:change={handleCustomerChange}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Pilih Customer</option>
									{#each customerOptions as customer}
										<option value={customer.kode}>{customer.kode} - {customer.nama}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="nama_customer" class="block text-sm font-medium text-gray-700 mb-1"
									>Nama Customer</label
								>
								<input
									id="nama_customer"
									type="text"
									bind:value={sjFormData.nama_customer}
									readonly
									class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
									placeholder="Nama customer akan terisi otomatis"
								/>
							</div>

							<div>
								<label for="kode_sales" class="block text-sm font-medium text-gray-700 mb-1"
									>Kode Sales</label
								>
								<input
									id="kode_sales"
									type="text"
									bind:value={sjFormData.kode_sales}
									readonly
									class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Kode sales akan terisi otomatis setelah memilih PO"
								/>
							</div>

							<div>
								<label for="nomor_po_customer" class="block text-sm font-medium text-gray-700 mb-1"
									>Nomor PO Customer</label
								>
								{#if customerPOList.length > 0}
									<select
										id="nomor_po_customer"
										bind:value={sjFormData.nomor_po_customer}
										on:change={handlePOSelection}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									>
										<option value="">Pilih Nomor PO</option>
										{#each customerPOList as po}
											<option 
												value={po.nomor_po_customer}
												disabled={po.status === 'ready'}
												class={po.status === 'ready' ? 'text-gray-400 bg-gray-100' : ''}
											>
												{po.nomor_po_customer} - {po.status || 'Status tidak tersedia'} 
												{po.kode_sales ? `(Sales: ${po.kode_sales})` : ''} 
												{po.status === 'ready' ? '(Tidak dapat dipilih)' : ''}
											</option>
										{/each}
									</select>
								{:else}
									<input
										id="nomor_po_customer"
										type="text"
										bind:value={sjFormData.nomor_po_customer}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder={sjFormData.kode_customer ? "Tidak ada PO untuk customer ini" : "Pilih customer terlebih dahulu"}
										readonly={sjFormData.kode_customer ? false : true}
									/>
								{/if}
							</div>

							<!-- Dates -->
							<div>
								<label
									for="tanggal_po_customer"
									class="block text-sm font-medium text-gray-700 mb-1">Tanggal PO Customer *</label
								>
								<input
									id="tanggal_po_customer"
									type="date"
									bind:value={sjFormData.tanggal_po_customer}
									required
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="nomor_sj" class="block text-sm font-medium text-gray-700 mb-1"
									>Nomor SJ *</label
								>
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
								<label for="tanggal_sj" class="block text-sm font-medium text-gray-700 mb-1"
									>Tanggal SJ</label
								>
								<input
									id="tanggal_sj"
									type="date"
									bind:value={sjFormData.tanggal_sj}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<!-- Tax Info -->
							<div>
								<label for="nomor_pajak" class="block text-sm font-medium text-gray-700 mb-1"
									>Nomor Pajak</label
								>
								<input
									id="nomor_pajak"
									type="text"
									bind:value={sjFormData.nomor_pajak}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nomor pajak"
								/>
							</div>

							<div>
								<label for="tanggal_pajak" class="block text-sm font-medium text-gray-700 mb-1"
									>Tanggal Pajak</label
								>
								<input
									id="tanggal_pajak"
									type="date"
									bind:value={sjFormData.tanggal_pajak}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="tanggal_invoice" class="block text-sm font-medium text-gray-700 mb-1"
									>Tanggal Invoice *</label
								>
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
								<label for="nama_sopir" class="block text-sm font-medium text-gray-700 mb-1"
									>Nama Sopir</label
								>
								<input
									id="nama_sopir"
									type="text"
									bind:value={sjFormData.nama_sopir}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Masukkan nama sopir (opsional)"
								/>
							</div>

							<div>
								<label for="no_kendaraan" class="block text-sm font-medium text-gray-700 mb-1"
									>No. Kendaraan</label
								>
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
								<label for="term" class="block text-sm font-medium text-gray-700 mb-1"
									>Term (hari)</label
								>
								<input
									id="term"
									type="number"
									bind:value={sjFormData.term}
									min="0"
									on:change={updateDueDate}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="30"
								/>
							</div>

							<div>
								<label for="due_date" class="block text-sm font-medium text-gray-700 mb-1"
									>Due Date</label
								>
								<input
									id="due_date"
									type="date"
									bind:value={sjFormData.due_date}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<!-- Tax Settings dihapus sesuai permintaan -->
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
											<th
												class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Tipe Item</th
											>
											<th
												class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Finish Good</th
											>
											<th
												class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Raw Material</th
											>
											<th
												class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Consumable & Sparepart</th
											>
											<th
												class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Warna</th
											>
											<th
												class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Kemasan</th
											>
											<th
												class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Satuan</th
											>
											<th
												class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Qty</th
											>
											<th
												class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Total (Satuan x Qty)</th
											>
											<th
												class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Aksi</th
											>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each sjFormData.items as item, index}
											<tr>
												<!-- Tipe Item -->
												<td class="px-3 py-2">
													<select
														bind:value={item.item_type}
														on:change={() => handleItemTypeSelect(index, item.item_type)}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
													>
														<option value="finished_good">Finish Good</option>
														<option value="raw_material">Raw Material</option>
														<option value="consumable_sparepart">Consumable & Sparepart</option>
													</select>
												</td>

												<!-- Finish Good -->
												<td class="px-3 py-2">
													<select
														bind:value={item.finish_good_id}
														on:change={() => handleFinishGoodSelect(index, item.finish_good_id)}
														disabled={item.item_type !== 'finished_good'}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm {item.item_type !== 'finished_good' ? 'bg-gray-100' : ''}"
													>
														<option value="">
															{item.item_type === 'finished_good' ? 'Pilih Finish Good' : '-'}
														</option>
														{#if item.item_type === 'finished_good'}
															{#each finishedGoods as fg}
																<option value={fg.id} disabled={fg.sisa_stok < item.quantity}>
																	{fg.nama_barang}
																	{fg.sisa_stok < item.quantity ? '(Stok tidak cukup)' : ''}
																</option>
															{/each}
														{/if}
													</select>
												</td>

												<!-- Raw Material -->
												<td class="px-3 py-2">
													<select
														bind:value={item.raw_material_id}
														on:change={() => handleRawMaterialSelect(index, item.raw_material_id)}
														disabled={item.item_type !== 'raw_material'}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm {item.item_type !== 'raw_material' ? 'bg-gray-100' : ''}"
													>
														<option value="">
															{item.item_type === 'raw_material' ? 'Pilih Raw Material' : '-'}
														</option>
														{#if item.item_type === 'raw_material'}
															{#each rawMaterials as rm}
																<option value={rm.id} disabled={rm.sisa_stok < item.quantity}>
																	{rm.nama}
																	{rm.sisa_stok < item.quantity ? '(Stok tidak cukup)' : ''}
																</option>
															{/each}
														{/if}
													</select>
												</td>

												<!-- Consumable & Sparepart -->
												<td class="px-3 py-2">
													<select
														bind:value={item.consumable_sparepart_id}
														on:change={() => handleConsumableSelect(index, item.consumable_sparepart_id)}
														disabled={item.item_type !== 'consumable_sparepart'}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm {item.item_type !== 'consumable_sparepart' ? 'bg-gray-100' : ''}"
													>
														<option value="">
															{item.item_type === 'consumable_sparepart' ? 'Pilih Consumable/Sparepart' : '-'}
														</option>
														{#if item.item_type === 'consumable_sparepart'}
															{#each consumableSpareparts as cs}
																<option value={cs.id} disabled={cs.sisa_stok < item.quantity}>
																	{cs.nama} - {cs.kategori}
																	{cs.sisa_stok < item.quantity ? '(Stok tidak cukup)' : ''}
																</option>
															{/each}
														{/if}
													</select>
												</td>

												<!-- Warna -->
												<td class="px-3 py-2">
													<input
														type="text"
														bind:value={item.warna}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
														placeholder="Warna"
													/>
												</td>

												<!-- Kemasan -->
												<td class="px-3 py-2">
													<input
														type="text"
														bind:value={item.kemasan}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
														placeholder="Kemasan"
													/>
												</td>

												<!-- Satuan -->
												<td class="px-3 py-2">
													<input
														type="text"
														bind:value={item.satuan}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
														placeholder="Satuan"
													/>
												</td>

												<!-- Quantity -->
												<td class="px-3 py-2">
													<input
														type="number"
														bind:value={item.quantity}
														min="1"
														class="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
													/>
												</td>

												<!-- Total -->
												<td class="px-3 py-2">
													<span class="text-sm font-medium">
														{#if item.satuan && item.quantity}
															{(() => {
																// Extract number from satuan (e.g., "2 Kg" -> 2)
																const satuanMatch = item.satuan.match(/(\d+(?:\.\d+)?)/);
																const satuanValue = satuanMatch ? parseFloat(satuanMatch[1]) : 1;
																const unit = item.satuan.replace(/[\d\.\s]+/, '').trim() || 'unit';
																const total = satuanValue * item.quantity;
																return `${total} ${unit}`;
															})()}
														{:else}
															{item.quantity} {item.satuan || 'unit'}
														{/if}
													</span>
												</td>

												<!-- Aksi -->
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
							<!-- Informasi pajak dihapus sesuai permintaan -->
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
									<svg
										class="w-4 h-4 inline mr-1"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
										/>
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
	<div class="bg-white rounded-lg shadow p-3 mb-6">
		<div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
			<div>
				<label for="search-input" class="block text-xs font-medium text-gray-700 mb-1">Search</label
				>
				<input
					id="search-input"
					type="text"
					bind:value={searchTerm}
					placeholder="Cari nama, kode barang..."
					class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
			<div>
				<label for="status-filter" class="block text-xs font-medium text-gray-700 mb-1"
					>Status</label
				>
				<select
					id="status-filter"
					bind:value={statusFilter}
					class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
				>
					<option value="all">Semua Status</option>
					<option value="Ready">Ready</option>
					<option value="Low Stock">Low Stock</option>
					<option value="Out of Stock">Out of Stock</option>
				</select>
			</div>
			<div>
				<label for="gudang-filter" class="block text-xs font-medium text-gray-700 mb-1"
					>Gudang</label
				>
				<select
					id="gudang-filter"
					bind:value={gudangFilter}
					class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
				>
					<option value="all">Semua Gudang</option>
					{#each gudangList as gudang}
						<option value={gudang.kode_gudang}>{gudang.nama_gudang}</option>
					{/each}
				</select>
			</div>
			<div>
				<button
					on:click={() => {
						searchTerm = '';
						statusFilter = 'all';
						gudangFilter = 'all';
					}}
					class="w-full px-3 py-2 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
				>
					Reset Filter
				</button>
			</div>
		</div>
		
		<!-- Data Summary -->
		<div class="mt-4 p-3 bg-blue-50 rounded-md">
			<div class="text-sm text-blue-800">
				<strong>Data Summary:</strong> 
				Loaded {finishedGoods.length} dari {totalCountInDirectus} total items di Directus
			</div>
		</div>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Total Produk</div>
			<div class="text-2xl font-bold text-gray-900">{filteredFinishedGoods.length}</div>
			<div class="text-xs text-gray-500 mt-1">dari {finishedGoods.length} total</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Ready</div>
			<div class="text-2xl font-bold text-green-600">
				{filteredFinishedGoods.filter((item) => item.status === 'Ready').length}
			</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Low Stock</div>
			<div class="text-2xl font-bold text-yellow-600">
				{filteredFinishedGoods.filter((item) => item.status === 'Low Stock').length}
			</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-sm text-gray-600">Out of Stock</div>
			<div class="text-2xl font-bold text-red-600">
				{filteredFinishedGoods.filter((item) => item.status === 'Out of Stock').length}
			</div>
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
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Kode Barang</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Nama Barang</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Kemasan</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Quantity</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Kode Warna</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Warna</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Nama Produk Group</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Kode Formula</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Nama Formula</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Sisa Stok</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Gudang</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Status</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Aksi</th
							>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each paginatedItems as item}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
									>{item.kode_barang}</td
								>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.nama_barang}</td
								>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.kemasan}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.kode_warna}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
									<div class="flex items-center">
										<div
											class="w-4 h-4 rounded-full mr-2 border border-gray-300"
											style="background-color: {getColorCode(item.warna)};"
										></div>
										{item.warna}
									</div>
								</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900"
									>{item.nama_produk_group}</td
								>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900"
									>{item.kode_formula}</td
								>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900"
									>{item.nama_formula}</td
								>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.sisa_stok}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900"
									>{getGudangName(item.kode_gudang)}</td
								>
								<td class="px-4 py-4 whitespace-nowrap">
									<span
										class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {item.status ===
										'Ready'
											? 'bg-green-100 text-green-800'
											: item.status === 'Low Stock'
												? 'bg-yellow-100 text-yellow-800'
												: item.status === 'Out of Stock'
													? 'bg-red-100 text-red-800'
													: 'bg-gray-100 text-gray-800'}"
									>
										{item.status}
									</span>
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
								Menampilkan <span class="font-medium">{startItem}</span> sampai
								<span class="font-medium">{endItem}</span>
								dari <span class="font-medium">{totalItems}</span> hasil
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
			<div
				class="bg-white p-6 rounded-lg shadow-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto"
			>
				<div class="flex justify-between items-center mb-6">
					<h2 class="text-xl font-bold text-gray-900">Daftar Surat Jalan</h2>
					<button
						class="text-gray-500 hover:text-gray-700"
						on:click={closeSJList}
						aria-label="Close"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
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
									<th
										class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Nomor SJ</th
									>
									<th
										class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Tanggal SJ</th
									>
									<th
										class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Customer</th
									>
									<th
										class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Sopir</th
									>
									<th
										class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>No. Kendaraan</th
									>
									<th
										class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Total (Rp)</th
									>
									<th
										class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Status</th
									>
									<th
										class="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Action</th
									>
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
											{new Intl.NumberFormat('id-ID', {
												style: 'currency',
												currency: 'IDR'
											}).format(sj.dasar_pengenaan_pajak || sj.netto_amount || 0)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span
												class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
											>
												Created
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
											<button
												class="inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
												on:click={() => printFromList(sj)}
											>
												<svg
													class="w-4 h-4 mr-1"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
													/>
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
														{sj.nama_finishgood} ({sj.quantity || 0}
														{sj.satuan || 'pcs'}) - {sj.warna || ''} - {sj.kemasan || ''}
														{#if sj.harga}
															@ Rp {new Intl.NumberFormat('id-ID').format(sj.harga)}
														{/if}
													{/if}
													{#if sj.nama_rawmaterial}
														{sj.nama_rawmaterial} ({sj.quantity || 0}
														{sj.satuan || 'pcs'})
														{#if sj.harga}
															@ Rp {new Intl.NumberFormat('id-ID').format(sj.harga)}
														{/if}
													{/if}
													{#if sj.total_harga || sj.dasar_pengenaan_pajak || sj.netto_amount}
														<br /><strong
															>Total: Rp {new Intl.NumberFormat('id-ID').format(
																sj.dasar_pengenaan_pajak || sj.netto_amount || sj.total_harga || 0
															)}</strong
														>
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
			<div
				class="bg-white p-6 rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
			>
				<div class="flex justify-between items-center mb-6">
					<h2 class="text-xl font-bold text-gray-900">Permintaan Produksi</h2>
					<button
						class="text-gray-500 hover:text-gray-700"
						on:click={() => (showProductionRequestModal = false)}
						aria-label="Close"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
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
									<th
										class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Kode Barang</th
									>
									<th
										class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Nama Barang</th
									>
									<th
										class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Warna</th
									>
									<th
										class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Sisa Stok</th
									>
									<th
										class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Gudang</th
									>
									<th
										class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Status</th
									>
									<th
										class="px-4 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Formula</th
									>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each productionRequestItems as item}
									<tr class="hover:bg-gray-50">
										<td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
											>{item.kode_barang}</td
										>
										<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900"
											>{item.nama_barang}</td
										>
										<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
											<div class="flex items-center">
												<div
													class="w-4 h-4 rounded-full mr-2 border border-gray-300"
													style="background-color: {getColorCode(item.warna)};"
												></div>
												{item.warna}
											</div>
										</td>
										<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900"
											>{item.sisa_stok}</td
										>
										<td class="px-4 py-4 whitespace-nowrap">
											<StatusBadge status={item.status} />
										</td>
										<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900"
											>{item.nama_formula}</td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<div class="mt-6 p-4 bg-blue-50 rounded-lg">
						<div class="flex">
							<div class="text-blue-400">
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
										clip-rule="evenodd"
									></path>
								</svg>
							</div>
							<div class="ml-3">
								<h3 class="text-sm font-medium text-blue-800">Informasi</h3>
								<div class="mt-2 text-sm text-blue-700">
									<p>
										Terdapat {productionRequestItems.length} item yang perlu diproduksi. Silakan koordinasikan
										dengan tim produksi untuk melakukan produksi sesuai dengan formula yang tersedia.
									</p>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<div class="mt-6 flex justify-end gap-3">
					<button
						class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
						on:click={() => (showProductionRequestModal = false)}
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
								setTimeout(() => (toast.show = false), 5000);

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

	<!-- Gudang Table Modal -->
	{#if showGudangTable}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
			<div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
				<div class="p-6">
					<div class="flex justify-between items-center mb-6">
						<h2 class="text-xl font-bold text-gray-900">Daftar Gudang</h2>
						<button
							on:click={closeGudangTable}
							class="text-gray-400 hover:text-gray-600 focus:outline-none"
						>
							✕
						</button>
					</div>

					{#if gudangList.length === 0}
						<div class="text-center py-8">
							<div class="text-gray-500 mb-4">
								<svg
									class="w-16 h-16 mx-auto mb-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
									/>
								</svg>
							</div>
							<p class="text-lg font-medium text-gray-500">Tidak ada data gudang</p>
							<p class="text-sm text-gray-400 mt-1">
								Data gudang akan ditampilkan di sini setelah tersedia
							</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200">
								<thead class="bg-gray-50">
									<tr>
										<th
											class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>
											Kode Gudang
										</th>
										<th
											class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>
											Nama Gudang
										</th>
										<th
											class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>
											Tanggal Dibuat
										</th>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									{#each gudangList as gudang}
										<tr class="hover:bg-gray-50">
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
												{gudang.kode_gudang}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
												{gudang.nama_gudang}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{new Date(gudang.date_created).toLocaleDateString('id-ID')}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<div class="mt-6 flex justify-between items-center">
							<div class="text-sm text-gray-700">
								Menampilkan {gudangList.length} gudang
							</div>
							<button
								on:click={closeGudangTable}
								class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
							>
								Tutup
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Print optimization styles */
	@media print {
		@page {
			size: A4 landscape;
			margin: 10mm;
		}
		
		body {
			-webkit-print-color-adjust: exact;
			color-adjust: exact;
		}
	}
	
	/* Compact layout styles for better space utilization */
	.compact-form {
		max-width: 100%;
		margin: 0 auto;
	}
	
	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
	}
	
	.compact-table {
		font-size: 0.9em;
		line-height: 1.2;
	}
	
	.compact-table th,
	.compact-table td {
		padding: 0.3rem;
		border: 1px solid #ddd;
	}
</style>