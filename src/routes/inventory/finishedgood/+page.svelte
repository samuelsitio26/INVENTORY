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
		tanggal_invoice: new Date().toISOString().split('T')[0],
		nama_sopir: '',
		no_kendaraan: '',
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

	onMount(async () => {
		// Load finished goods first, then check SO data and other dependencies
		await loadFinishedGoods().then(() => {
			checkLowStockItems();
			// Check if there's SO data to auto-fill SJ form (after finished goods are loaded)
			checkAndLoadSOData();
		});
		loadRawMaterials();
		loadConsumableSpareparts();
		loadCustomerOptions();
		loadGudangList();
	});
	
	// Function to check and load SO Customer data for auto-filling SJ form
	function checkAndLoadSOData() {
		try {
			const soData = localStorage.getItem('so_data_for_sj');
			if (soData) {
				const parsedData = JSON.parse(soData);
				console.log('=== DEBUG SO DATA LOADING ===');
				console.log('Loading SO data for SJ:', parsedData);
				console.log('Available finished goods:', finishedGoods.length);
				console.log('Sample finished goods:', finishedGoods.slice(0, 3));
				
				// Auto-fill SJ form with SO data
				sjFormData.kode_customer = parsedData.kode_customer || '';
				sjFormData.nama_customer = parsedData.nama_customer || '';
				sjFormData.kode_sales = parsedData.kode_sales || '';
				sjFormData.nomor_po_customer = parsedData.nomor_po_customer || '';
				
				// Auto-fill items with finished goods from SO
				if (parsedData.items && parsedData.items.length > 0) {
					console.log('=== DEBUG ITEMS PROCESSING ===');
					console.log('SO items to process:', parsedData.items);
					
					sjFormData.items = parsedData.items.map((item, index) => {
						console.log(`\n--- Processing item ${index + 1} ---`);
						console.log('SO item data:', item);
						
						// Find matching finished good by kode_barang first, then by nama_barang
						let matchingFinishedGood = null;
						
						// Try matching by kode_barang
						if (item.kode_barang) {
							matchingFinishedGood = finishedGoods.find(fg => 
								fg.kode_barang && fg.kode_barang.toLowerCase() === item.kode_barang.toLowerCase()
							);
							console.log(`Searching by kode_barang: "${item.kode_barang}" -> Found:`, matchingFinishedGood ? 'YES' : 'NO');
						}
						
						// If not found by kode_barang, try by nama_barang
						if (!matchingFinishedGood && item.nama_barang) {
							matchingFinishedGood = finishedGoods.find(fg => 
								fg.nama_barang && fg.nama_barang.toLowerCase().includes(item.nama_barang.toLowerCase())
							);
							console.log(`Searching by nama_barang: "${item.nama_barang}" -> Found:`, matchingFinishedGood ? 'YES' : 'NO');
						}
						
						// If still not found, try partial matching
						if (!matchingFinishedGood && item.nama_barang) {
							matchingFinishedGood = finishedGoods.find(fg => 
								fg.nama_barang && item.nama_barang.toLowerCase().includes(fg.nama_barang.toLowerCase())
							);
							console.log(`Partial matching by nama_barang: "${item.nama_barang}" -> Found:`, matchingFinishedGood ? 'YES' : 'NO');
						}
						
						if (matchingFinishedGood) {
							console.log('✅ Matched finished good:', {
								id: matchingFinishedGood.id,
								kode_barang: matchingFinishedGood.kode_barang,
								nama_barang: matchingFinishedGood.nama_barang
							});
						} else {
							console.log('❌ No matching finished good found');
							// Log available options for debugging
							console.log('Available finished goods kode_barang:', finishedGoods.map(fg => fg.kode_barang).slice(0, 10));
							console.log('Available finished goods nama_barang:', finishedGoods.map(fg => fg.nama_barang).slice(0, 10));
						}
						
						const resultItem = {
							finish_good_id: matchingFinishedGood ? matchingFinishedGood.id.toString() : '',
							finish_good_name: item.nama_barang || '',
							raw_material_id: '',
							raw_material_name: '',
							consumable_sparepart_id: '',
							consumable_sparepart_name: '',
							item_type: 'finished_good', // Default to finished good
							warna: item.warna || matchingFinishedGood?.warna || '',
							kemasan: item.kemasan || matchingFinishedGood?.kemasan || '',
							satuan: item.satuan || matchingFinishedGood?.satuan || 'pcs',
							quantity: item.qty || 1
						};
						
						console.log('Final item result:', resultItem);
						return resultItem;
					});
					
					console.log('=== FINAL SJ ITEMS ===');
					console.log('Final SJ items:', sjFormData.items);
				}
				
				// Generate SJ number
				generateNomorSJ().then(nomor => {
					sjFormData.nomor_sj = nomor;
				});
				
				// Open SJ form immediately
				showSJForm = true;
				
				// Force reactive update with a small delay
				setTimeout(() => {
					console.log('=== FORCING REACTIVE UPDATE ===');
					console.log('sjFormData after update:', sjFormData);
					// Trigger reactive update and force dropdown update
					forceUpdateDropdowns();
				}, 100);
				
				// Clear the localStorage data after using it
				localStorage.removeItem('so_data_for_sj');
				
				showToast('Data SO Customer berhasil dimuat untuk pembuatan Surat Jalan', 'success');
			} else {
				console.log('No SO data found in localStorage');
			}
		} catch (error) {
			console.error('Error loading SO data:', error);
		}
	}
	
	// Helper function to show toast notifications
	function showToast(message, type = 'success') {
		toast = { show: true, message, type, html: false };
		setTimeout(() => (toast.show = false), 3000);
	}
	
	// Test function to simulate SO data
	function testSOData() {
		// Create sample SO data for testing
		const testData = {
			kode_customer: 'CUST1082',
			nama_customer: 'ABI MAULANA, Bapak',
			kode_sales: 'S003',
			nomor_po_customer: '123456',
			items: [
				{
					kode_barang: finishedGoods.length > 0 ? finishedGoods[0].kode_barang : 'TEST001',
					nama_barang: finishedGoods.length > 0 ? finishedGoods[0].nama_barang : 'Test Product 1',
					qty: 20,
					satuan: 'KG',
					warna: 'Warna',
					kemasan: 'KALENG'
				}
			]
		};
		
		console.log('Creating test SO data:', testData);
		localStorage.setItem('so_data_for_sj', JSON.stringify(testData));
		checkAndLoadSOData();
	}
	
	// Force update dropdown values
	function forceUpdateDropdowns() {
		console.log('=== FORCING DROPDOWN UPDATE ===');
		sjFormData.items = sjFormData.items.map(item => ({ ...item }));
		sjFormData = { ...sjFormData };
	}

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
				console.log(
					`Batch ${Math.floor(offset / limit) + 1} - received ${data.data?.length || 0} items`
				);

				if (data.data && Array.isArray(data.data) && data.data.length > 0) {
					allFinishedGoods = allFinishedGoods.concat(data.data);
					offset += limit;

					// Check if we've received fewer items than the limit, indicating last page
					if (data.data.length < limit) {
						hasMore = false;
					}

					// Safety check - if we've loaded as many as the total count, stop
					if (
						totalCountInDirectus_temp > 0 &&
						allFinishedGoods.length >= totalCountInDirectus_temp
					) {
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
			console.log(
				'Total count comparison - Loaded:',
				finishedGoods.length,
				'vs Directus Total:',
				totalCountInDirectus
			);

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
				(item.nama_barang && item.nama_barang.toLowerCase().includes(searchTerm.toLowerCase())) ||
				(item.kode_barang && item.kode_barang.toLowerCase().includes(searchTerm.toLowerCase())) ||
				(item.nama_produk && item.nama_produk.toLowerCase().includes(searchTerm.toLowerCase())) ||
				(item.warna && item.warna.toLowerCase().includes(searchTerm.toLowerCase())) ||
				(item.kemasan && item.kemasan.toLowerCase().includes(searchTerm.toLowerCase())) ||
				(item.nama_produk_group && item.nama_produk_group.toLowerCase().includes(searchTerm.toLowerCase())) ||
				(item.nama_formula && item.nama_formula.toLowerCase().includes(searchTerm.toLowerCase()));

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

	// Reactive statements - gabung menjadi satu untuk efisiensi
	$: {
		if (finishedGoods.length > 0 && (searchTerm !== undefined || statusFilter !== undefined || gudangFilter !== undefined)) {
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
			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/consumable?limit=-1&fields=*',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);

			if (!response.ok) {
				throw new Error('Failed to fetch consumable & sparepart data');
			}

			const data = await response.json();

			// Map the data to match our expected structure
			consumableSpareparts =
				data.data?.map((item) => ({
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
			const response = await fetch(
				`https://directus.eltamaprimaindo.com/items/so_customer?filter[kode_customer][_eq]=${kodeCustomer}`,
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);

			if (!response.ok) {
				throw new Error('Failed to fetch customer PO data');
			}

			const data = await response.json();
			customerPOList = data.data || [];
			console.log(
				'Customer PO list loaded:',
				customerPOList.length,
				'items for customer:',
				kodeCustomer
			);

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
		const poData = customerPOList.find((po) => po.nomor_po_customer === selectedPO);

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
						console.log(
							`Autofill kode_sales berhasil menggunakan field alternatif '${field}':`,
							poData[field]
						);
						salesFound = true;
						break;
					}
				}

				if (!salesFound) {
					console.log(
						'Kode sales tidak ditemukan dalam data PO. Fields tersedia:',
						Object.keys(poData)
					);
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
		console.log('handleFinishGoodSelect called:', { index, finishGoodId });
		const selectedFinishGood = finishedGoods.find((item) => item.id.toString() === finishGoodId.toString());
		if (selectedFinishGood) {
			console.log('Selected finish good:', selectedFinishGood);
			sjFormData.items[index].finish_good_id = selectedFinishGood.id.toString();
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
		} else {
			console.log('No finish good found with ID:', finishGoodId);
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
				(item) =>
					(item.finish_good_id || item.raw_material_id || item.consumable_sparepart_id) &&
					item.quantity > 0
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
					const consumable = consumableSpareparts.find(
						(cs) => cs.id === item.consumable_sparepart_id
					);
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
					tgl_invoice: sjFormData.tanggal_invoice,
					nama_sopir: sjFormData.nama_sopir,
					no_kendaraan: sjFormData.no_kendaraan,
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
					const consumable = consumableSpareparts.find(
						(cs) => cs.id === item.consumable_sparepart_id
					);
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

	// Update due date when invoice date changes (using default 30 days term)
	function updateDueDate() {
		const invoiceDate = new Date(sjFormData.tanggal_invoice);
		sjFormData.due_date = new Date(invoiceDate.setDate(invoiceDate.getDate() + 30))
			.toISOString()
			.split('T')[0];
	}

	async function openSJForm() {
		// Check if there's existing data from SO (don't reset if already filled)
		if (!sjFormData.kode_customer) {
			// Reset form data only if no existing data
			sjFormData = {
				kode_customer: '',
				nama_customer: '', // Reset nama customer
				kode_sales: '',
				nomor_po_customer: '',
				tanggal_po_customer: new Date().toISOString().split('T')[0],
				nomor_sj: await generateNomorSJ(), // Auto-generate nomor SJ
				tanggal_sj: new Date().toISOString().split('T')[0],
				tanggal_invoice: new Date().toISOString().split('T')[0],
				nama_sopir: '',
				no_kendaraan: '',
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
		} else {
			// If data exists (from SO), just ensure we have a valid SJ number
			if (!sjFormData.nomor_sj) {
				sjFormData.nomor_sj = await generateNomorSJ();
			}
		}

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

	// Function to print Surat Jalan dengan format 9x11 inci yang lebih rapi
	async function printSuratJalan(sjData) {
		try {
			console.log('Creating Delivery Order PDF with data:', sjData);

			// Create PDF dengan ukuran 9x11 inci (648 x 792 points)
			const doc = new jsPDF({
				orientation: 'portrait',
				unit: 'pt',
				format: [648, 792]
			});

			// Load logo
			let logoDataUrl = null;
			try {
				console.log('Loading logo...');
				const logoResponse = await fetch('/Logo-Eltama-Prima-Indo-01.png');
				if (logoResponse.ok) {
					const logoBlob = await logoResponse.blob();
					logoDataUrl = await new Promise((resolve) => {
						const reader = new FileReader();
						reader.onload = () => resolve(reader.result);
						reader.readAsDataURL(logoBlob);
					});
					console.log('Logo loaded successfully');
				}
			} catch (logoError) {
				console.warn('Could not load logo:', logoError);
			}

			// Set font dan warna utama #0D3E75
			doc.setTextColor(13, 62, 117);

			// HEADER SECTION - Company info in bordered box (kiri) dan Delivery Order title (kanan)
			// Company info box with border - diperkecil agar lebih rapat
			doc.setLineWidth(1);
			doc.rect(110, 40, 240, 70); // Digeser ke kanan lagi dari 90 ke 110

			// Add logo jika tersedia
			if (logoDataUrl) {
				doc.addImage(logoDataUrl, 'PNG', 115, 45, 30, 30);
			}

			// Company name dengan dotted line
			doc.setFontSize(14);
			doc.setFont('helvetica', 'bold');
			doc.text('PT ELTAMA PRIMA INDO', 155, 60);

			// Dotted line under company name - disesuaikan dengan box yang lebih kecil
			doc.setLineWidth(0.5);
			doc.setLineDashPattern([2, 2], 0);
			doc.line(155, 65, 340, 65); // Digeser ke kanan lagi dari 135 ke 155, dan dari 320 ke 340
			doc.setLineDashPattern([], 0);

			// Company address
			doc.setFontSize(11);
			doc.setFont('helvetica', 'normal');
			doc.text('Jalan Raya Parpostel Gang Nangka', 155, 80);
			doc.text('RT 02 RW 03 No 88, Kel. Bolong Kuiur', 155, 92);
			doc.text('Kec. Gunung Putri, Bogor Jawa Barat', 155, 104);

			// DELIVERY ORDER TITLE (kanan atas)
			doc.setFontSize(24);
			doc.setFont('helvetica', 'normal');
			doc.text('Delivery Order', 580, 80, { align: 'right' });

			// BILL TO / SHIP TO SECTION
			const billToY = 140;

			// Bill To dan Ship To labels (kiri)
			doc.setFontSize(11);
			doc.setFont('helvetica', 'normal');
			doc.text('Bill To :', 40, billToY + 18);
			doc.text('Ship To :', 40, billToY + 58);

			// Customer info box dengan border dan dotted separator - diperkecil agar lebih rapat
			doc.setLineWidth(1);
			doc.rect(110, billToY, 300, 80); // Diperkecil dari 350 ke 300

			// Bill To section (atas)
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.text(`${sjData.nama_customer || ''}`, 120, billToY + 18);

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(10);
			doc.text('Jl. Raya Pasar Minggu KM 18, Pejaten Barat - Pasar Minggu, ', 120, billToY + 32);
			doc.text('Jakarta Selatan 12610', 120, billToY + 44);

			// Dotted line separator horizontal - disesuaikan dengan box yang lebih kecil
			doc.setLineWidth(0.5);
			doc.setLineDashPattern([2, 2], 0);
			doc.line(120, billToY + 50, 400, billToY + 50); // Diperpendek dari 450 ke 400
			doc.setLineDashPattern([], 0);

			// Ship To section (bawah)
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(10);
			const shipToText = sjData.alamat_pengiriman || sjData.alamat_customer || '';
			if (shipToText) {
				const shipToLines = doc.splitTextToSize(shipToText, 270); // Diperkecil dari 320 ke 270
				doc.text(shipToLines, 120, billToY + 65);
			}

			// RIGHT INFO TABLE
			const infoTableX = 480;
			const infoTableY = billToY;
			const tableWidth = 140;
			const tableHeight = 80;

			// Main table border
			doc.setLineWidth(1);
			doc.rect(infoTableX, infoTableY, tableWidth, tableHeight);

			// Internal table divisions
			doc.line(infoTableX, infoTableY + 35, infoTableX + tableWidth, infoTableY + 35); // Horizontal middle
			doc.line(infoTableX + 70, infoTableY, infoTableX + 70, infoTableY + tableHeight); // Vertical middle

			doc.setFontSize(9);
			doc.setFont('helvetica', 'normal');

			// Top left: Delivery Date
			doc.text('Delivery Date', infoTableX + 5, infoTableY + 12);
			doc.setFont('helvetica', 'bold');
			const deliveryDate = sjData.tgl_sj
				? new Date(sjData.tgl_sj).toLocaleDateString('id-ID')
				: new Date().toLocaleDateString('id-ID');
			doc.text(deliveryDate, infoTableX + 5, infoTableY + 25);

			// Top right: Delivery No
			doc.setFont('helvetica', 'normal');
			doc.text('Delivery No', infoTableX + 75, infoTableY + 12);
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(8);
			const deliveryNo =
				sjData.nomor_sj ||
				`SJ/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}`;
			doc.text(deliveryNo, infoTableX + 75, infoTableY + 25);

			// Bottom left: Ship Via
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9);
			doc.text('Ship Via', infoTableX + 5, infoTableY + 50);

			// Bottom right: PO No
			doc.text('PO. No.', infoTableX + 75, infoTableY + 50);
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(8);
			const poNo = sjData.nomor_po_customer || sjData.no_po || '-';
			doc.text(poNo, infoTableX + 75, infoTableY + 63);

			// PRY text tepat di bawah tabel info (di luar box)
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(10);
			doc.text('PRY', infoTableX + tableWidth / 2, infoTableY + tableHeight + 15, {
				align: 'center'
			});

			// MAIN TABLE
			const mainTableY = 250;
			const mainTableWidth = 580;
			const colWidths = [80, 320, 60, 120]; // Item, Description, Qty, Serial Number

			// Table header
			doc.setLineWidth(1);
			doc.rect(40, mainTableY, mainTableWidth, 25);

			// Header column separators
			let currentX = 40;
			for (let i = 0; i < colWidths.length - 1; i++) {
				currentX += colWidths[i];
				doc.line(currentX, mainTableY, currentX, mainTableY + 25);
			}

			// Header text
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.text('Item', 80, mainTableY + 16, { align: 'center' });
			doc.text('Item Description', 280, mainTableY + 16, { align: 'center' });
			doc.text('Qty', 480, mainTableY + 16, { align: 'center' });
			doc.text('Serial Number', 560, mainTableY + 16, { align: 'center' });

			// Prepare table data
			let groupedItems = [];

			console.log('=== DEBUGGING PRINT SURAT JALAN ===');
			console.log('sjData received:', sjData);
			console.log('sjFormData.items:', sjFormData.items);
			console.log('suratJalanList:', suratJalanList);
			console.log(
				'finishedGoods with selection:',
				finishedGoods?.slice(0, 3).map((item) => ({ id: item.id, selected: item.selected }))
			);

			console.log('Preparing groupedItems...');

			// Cek semua sumber data secara berurutan
			console.log('=== CHECKING DATA SOURCES ===');
			console.log('1. sjData.items exists:', !!(sjData.items && sjData.items.length > 0));
			console.log(
				'2. sjFormData.items exists:',
				!!(sjFormData.items && sjFormData.items.length > 0)
			);
			console.log('3. suratJalanList exists:', !!(suratJalanList && suratJalanList.length > 0));
			console.log('4. finishedGoods exists:', !!(finishedGoods && finishedGoods.length > 0));

			// Prioritas 1: Ambil dari tempSJData.items (dari printAfterSave)
			if (sjData.items && sjData.items.length > 0) {
				console.log('✅ Using sjData.items from form:', sjData.items);
				console.log('First sjData item structure:', sjData.items[0]);

				// Filter lebih fleksibel - cek berbagai kemungkinan field ID
				const validItems = sjData.items.filter((item) => {
					const hasId =
						item.finish_good_id ||
						item.raw_material_id ||
						item.consumable_sparepart_id ||
						item.id ||
						item.kode_barang ||
						item.nama_barang;
					console.log('sjData Item validation:', { item, hasId });
					return hasId;
				});

				console.log('Valid sjData items after filter:', validItems);

				groupedItems = validItems.map((item) => ({
					kode_barang:
						item.finish_good_id ||
						item.raw_material_id ||
						item.consumable_sparepart_id ||
						item.kode_barang ||
						item.id ||
						'-',
					nama_finishgood:
						item.finish_good_name ||
						item.raw_material_name ||
						item.consumable_sparepart_name ||
						item.nama_barang ||
						item.nama_finishgood ||
						'-',
					quantity: item.quantity || 0,
					satuan: item.satuan || 'PAIL'
				}));
			}

			// Prioritas 2: Ambil dari sjFormData.items (item yang dipilih di form)
			if (groupedItems.length === 0 && sjFormData.items && sjFormData.items.length > 0) {
				console.log('✅ Using sjFormData.items:', sjFormData.items);
				console.log('First item structure:', sjFormData.items[0]);

				// Filter lebih fleksibel - cek berbagai kemungkinan field ID
				const validItems = sjFormData.items.filter((item) => {
					const hasId =
						item.finish_good_id ||
						item.raw_material_id ||
						item.consumable_sparepart_id ||
						item.id ||
						item.kode_barang ||
						item.nama_barang;
					console.log('Item validation:', { item, hasId });
					return hasId;
				});

				console.log('Valid items after filter:', validItems);

				groupedItems = validItems.map((item) => ({
					kode_barang:
						item.finish_good_id ||
						item.raw_material_id ||
						item.consumable_sparepart_id ||
						item.kode_barang ||
						item.id ||
						'-',
					nama_finishgood:
						item.finish_good_name ||
						item.raw_material_name ||
						item.consumable_sparepart_name ||
						item.nama_barang ||
						item.nama_finishgood ||
						'-',
					quantity: item.quantity || 0,
					satuan: item.satuan || 'PAIL'
				}));
			}

			// Prioritas 3: Get items dari suratJalanList (jika print dari list)
			if (groupedItems.length === 0 && suratJalanList && suratJalanList.length > 0) {
				console.log('✅ Using suratJalanList data');
				const filteredSJ = suratJalanList.filter((sj) => sj.nomor_sj === sjData.nomor_sj);
				if (filteredSJ.length > 0) {
					groupedItems =
						filteredSJ[0].items?.map((item) => ({
							kode_barang: item.kode_barang || '-',
							nama_finishgood: item.nama_finishgood || item.nama_rawmaterial || '-',
							quantity: item.quantity || 0,
							satuan: item.satuan || 'PAIL'
						})) || [];
				}
			}

			// Prioritas 4: Ambil dari finishedGoods yang dipilih (fallback)
			if (groupedItems.length === 0 && finishedGoods && finishedGoods.length > 0) {
				console.log('✅ Using finishedGoods data');
				groupedItems = finishedGoods
					.filter((item) => item.selected)
					.map((item) => ({
						kode_barang: item.kode_barang || '-',
						nama_finishgood: item.nama_finishgood || item.nama_rawmaterial || '-',
						quantity: item.quantity || 0,
						satuan: item.satuan || 'PAIL'
					}));
			}

			console.log('Final groupedItems:', groupedItems);
			console.log('GroupedItems length:', groupedItems.length);

			// Jika tidak ada data yang dipilih, tampilkan pesan error
			if (groupedItems.length === 0) {
				console.error('Tidak ada item yang dipilih untuk dicetak');
				console.error('Debug info - sjData:', sjData);
				console.error('Debug info - sjFormData.items:', sjFormData.items);
				console.error('Debug info - sjFormData.items[0]:', sjFormData.items?.[0]);
				console.error('Debug info - sjData.items:', sjData.items);
				console.error('Debug info - suratJalanList:', suratJalanList);
				console.error(
					'Debug info - finishedGoods selected:',
					finishedGoods?.filter((item) => item.selected)
				);

				// Coba paksa menggunakan data yang ada tanpa filter ketat
				if (sjFormData.items && sjFormData.items.length > 0) {
					console.warn('Forcing use of sjFormData.items without strict filter');
					groupedItems = sjFormData.items.map((item, index) => ({
						kode_barang:
							item.finish_good_id ||
							item.raw_material_id ||
							item.consumable_sparepart_id ||
							item.kode_barang ||
							item.id ||
							`ITEM-${index + 1}`,
						nama_finishgood:
							item.finish_good_name ||
							item.raw_material_name ||
							item.consumable_sparepart_name ||
							item.nama_barang ||
							item.nama_finishgood ||
							`Item ${index + 1}`,
						quantity: item.quantity || 1,
						satuan: item.satuan || 'PAIL'
					}));
				} else if (sjData.items && sjData.items.length > 0) {
					console.warn('Forcing use of sjData.items without strict filter');
					groupedItems = sjData.items.map((item, index) => ({
						kode_barang:
							item.finish_good_id ||
							item.raw_material_id ||
							item.consumable_sparepart_id ||
							item.kode_barang ||
							item.id ||
							`ITEM-${index + 1}`,
						nama_finishgood:
							item.finish_good_name ||
							item.raw_material_name ||
							item.consumable_sparepart_name ||
							item.nama_barang ||
							item.nama_finishgood ||
							`Item ${index + 1}`,
						quantity: item.quantity || 1,
						satuan: item.satuan || 'PAIL'
					}));
				}

				// Jika masih kosong setelah paksa, baru return error
				if (groupedItems.length === 0) {
					alert('Tidak ada data item yang dapat digunakan untuk mencetak Surat Jalan');
					return;
				}

				console.log('Forced groupedItems:', groupedItems);
			}

			// Table rows
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(10);
			let currentY = mainTableY + 25;

			groupedItems.forEach((item, index) => {
				const rowHeight = 30;

				// Row border
				doc.rect(40, currentY, mainTableWidth, rowHeight);

				// Column separators
				let currentX = 40;
				for (let i = 0; i < colWidths.length - 1; i++) {
					currentX += colWidths[i];
					doc.line(currentX, currentY, currentX, currentY + rowHeight);
				}

				// Row data
				doc.text(item.kode_barang, 50, currentY + 18);

				// Item description dengan text wrapping
				const description = item.nama_finishgood;
				if (description.length > 40) {
					const lines = doc.splitTextToSize(description, 300);
					doc.text(lines[0], 130, currentY + 12);
					if (lines[1]) {
						doc.text(lines[1], 130, currentY + 24);
					}
				} else {
					doc.text(description, 130, currentY + 18);
				}

				doc.text(item.quantity.toString(), 480, currentY + 18, { align: 'center' });
				doc.text('', 560, currentY + 18); // Serial Number - kosong

				currentY += rowHeight;
			});

			// SIGNATURE SECTION - dengan ruang tanda tangan yang lebih besar
			const signatureY = currentY + 40;
			const signatureBoxes = [
				{ label: 'Prepared By', x: 40, width: 100 },
				{ label: 'Approved By', x: 150, width: 100 },
				{ label: 'Shipped By', x: 260, width: 100 },
				{ label: 'Received By', x: 370, width: 100 }
			];

			// Signature boxes dengan ruang tanda tangan yang lebih besar
			signatureBoxes.forEach((box) => {
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(11);
				doc.text(box.label, box.x + box.width / 2, signatureY, { align: 'center' });

				// Signature line dengan jarak yang lebih jauh untuk ruang tanda tangan
				doc.setLineWidth(1);
				doc.line(box.x, signatureY + 45, box.x + box.width, signatureY + 45); // Dipindah dari +30 ke +45

				// Date label ditempatkan lebih jauh ke bawah
				doc.setFontSize(9);
				doc.text('Date:', box.x, signatureY + 60); // Dipindah dari +45 ke +60
			});

			// Description box (kanan) - disesuaikan dengan posisi signature yang baru
			const descBoxX = 480;
			const descBoxY = signatureY - 15;
			const descBoxWidth = 140;
			const descBoxHeight = 75; // Diperbesar sedikit untuk menyesuaikan dengan signature yang lebih tinggi

			doc.setLineWidth(1);
			doc.rect(descBoxX, descBoxY, descBoxWidth, descBoxHeight);

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(11);
			doc.text('Description:', descBoxX + 5, descBoxY + 15);

			doc.setFontSize(9);
			const poText = sjData.nomor_po_customer || sjData.no_po || '';

			// Text dengan word wrapping untuk memastikan tidak keluar dari box
			if (poText) {
				const pryText = `${poText} PRY`;
				const pryLines = doc.splitTextToSize(pryText, descBoxWidth - 10);
				doc.text(pryLines, descBoxX + 5, descBoxY + 30);
			}

			// Text kedua dengan word wrapping - menggunakan nama customer dari database
			const companyText = sjData.nama_customer || '';
			if (companyText) {
				const companyLines = doc.splitTextToSize(companyText, descBoxWidth - 10);
				const startY = descBoxY + 30 + (poText ? 15 : 0);
				doc.text(companyLines, descBoxX + 5, startY);
			}

			// Save PDF
			const fileName = `Delivery_Order_${sjData.nomor_sj || 'SJ_' + Date.now()}.pdf`;
			doc.save(fileName);

			console.log('Delivery Order PDF generated successfully');
		} catch (error) {
			console.error('Error generating Delivery Order PDF:', error);
			alert('Gagal membuat PDF: ' + error.message);
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
			// Create a temporary SJ data object from form data with items
			const tempSJData = {
				nomor_sj: sjFormData.nomor_sj,
				tgl_sj: sjFormData.tanggal_sj,
				kode_customer: sjFormData.kode_customer,
				nama_customer: sjFormData.nama_customer,
				nama_sopir: sjFormData.nama_sopir,
				no_kendaraan: sjFormData.no_kendaraan,
				no_po: sjFormData.nomor_po_customer,
				tgl_po: sjFormData.tanggal_po_customer,
				// Menambahkan items dari form agar bisa diprint
				items: sjFormData.items || []
			};
			console.log('Printing after save with data:', tempSJData);
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
				class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
				on:click={testSOData}
			>
				Test SO Data
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
										placeholder={sjFormData.kode_customer
											? 'Tidak ada PO untuk customer ini'
											: 'Pilih customer terlebih dahulu'}
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

							<!-- Tax Info removed as requested -->

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

							<!-- Payment Terms removed as requested -->

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
													{#key `${index}-${item.finish_good_id}-${item.item_type}`}
														<select
															bind:value={item.finish_good_id}
															on:change={() => handleFinishGoodSelect(index, item.finish_good_id)}
															disabled={item.item_type !== 'finished_good'}
															class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm {item.item_type !==
															'finished_good'
																? 'bg-gray-100'
																: ''}"
														>
															<option value="">
																{item.item_type === 'finished_good' ? 'Pilih Finish Good' : '-'}
															</option>
															{#if item.item_type === 'finished_good'}
																{#each finishedGoods as fg}
																	<option value={fg.id.toString()} 
																		disabled={fg.sisa_stok < item.quantity}
																	>
																		{fg.kode_barang} - {fg.nama_barang}
																		{fg.sisa_stok < item.quantity ? ' (Stok tidak cukup)' : ` (Stok: ${fg.sisa_stok})`}
																	</option>
																{/each}
															{/if}
														</select>
													{/key}
													<!-- Debug info -->
													{#if item.item_type === 'finished_good'}
														<div class="text-xs text-gray-500 mt-1">
															Selected ID: {item.finish_good_id}
															{#if item.finish_good_id}
																{@const selectedFG = finishedGoods.find(fg => fg.id.toString() === item.finish_good_id.toString())}
																{#if selectedFG}
																	<br>Selected: {selectedFG.kode_barang} - {selectedFG.nama_barang}
																{/if}
															{/if}
														</div>
													{/if}
												</td>

												<!-- Raw Material -->
												<td class="px-3 py-2">
													<select
														bind:value={item.raw_material_id}
														on:change={() => handleRawMaterialSelect(index, item.raw_material_id)}
														disabled={item.item_type !== 'raw_material'}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm {item.item_type !==
														'raw_material'
															? 'bg-gray-100'
															: ''}"
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
														on:change={() =>
															handleConsumableSelect(index, item.consumable_sparepart_id)}
														disabled={item.item_type !== 'consumable_sparepart'}
														class="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm {item.item_type !==
														'consumable_sparepart'
															? 'bg-gray-100'
															: ''}"
													>
														<option value="">
															{item.item_type === 'consumable_sparepart'
																? 'Pilih Consumable/Sparepart'
																: '-'}
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
					placeholder="Cari nama barang, kode, produk, warna, kemasan..."
					class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					on:input={() => handleSearch()}
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
