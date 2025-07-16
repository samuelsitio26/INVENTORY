<!-- src/routes/+layout.svelte -->
<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { searchTerm } from '$lib/stores/search.js';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import {
		getSPKNotifications,
		approveSPKNotification,
		rejectSPKNotification
	} from '$lib/services/notifications.js';
	import { productionRequests } from '$lib/stores/notifications.js';
	import { getRecentSOCustomer, getAllSOCustomer } from '$lib/services/socustomer.js';

	const menuItems = [
		{ path: '/dashboard', label: 'Dashboard', icon: '🏠' },
		{ path: '/inventory', label: 'Inventory', icon: '📦' },
		{ path: '/inventory/rental', label: 'Rental', icon: '📋' },
		{ path: '/inventory/finishedgood', label: 'Finish Good', icon: '🏷️' },
		{ path: '/inventory/rawmaterial', label: 'Raw Material', icon: '🧱' },
		{ path: '/inventory/spk-notifications', label: 'SPK Notifications', icon: '🔔' },
		{ path: '/inventory/produksi-notifications', label: 'Produksi Notifications', icon: '🏭' }
	];

	// State for user
	let user = null;
	let dropdownOpen = false;

	// Notification state
	let reminders = [];
	let lateItems = [];
	let waitingApprovalItems = [];
	let spkNotifications = [];
	let soCustomerData = [];
	let rentalData = [];
	let productionRequestsData = [];
	let finishedGoodsData = [];
	let productionNotifications = [];
	let manualProductionRequests = []; // For NotificationBell only

	// Toast notification state
	let toastNotifications = [];
	let toastId = 0;

	onMount(() => {
		if (typeof window !== 'undefined') {
			const token = localStorage.getItem('user_token'); // fix: use correct key
			const userData = {
				email: localStorage.getItem('user_email'),
				nama_lengkap: localStorage.getItem('user_nama_lengkap'),
				role: localStorage.getItem('user_role')
			};
			user = userData.email ? userData : null;
			if (!token && $page.url.pathname !== '/login') {
				window.location.href = '/login';
			}
		}

		// Subscribe to production requests
		const unsubscribe = productionRequests.subscribe((value) => {
			productionRequestsData = value;
		});

		// Load production requests from localStorage
		loadProductionRequests();

		// Listen for production request events
		window.addEventListener('productionRequestAdded', handleProductionRequestAdded);
		window.addEventListener('productionRequestDeleted', handleProductionRequestDeleted);

		return () => {
			unsubscribe();
			window.removeEventListener('productionRequestAdded', handleProductionRequestAdded);
			window.removeEventListener('productionRequestDeleted', handleProductionRequestDeleted);
		};
	});

	function logout() {
		if (typeof window !== 'undefined') {
			localStorage.removeItem('user_token');
			localStorage.removeItem('user_email');
			localStorage.removeItem('user_uid');
			localStorage.removeItem('user_nama_lengkap');
			localStorage.removeItem('user_role');
			window.location.href = '/login';
		}
	}

	function clearSearch() {
		searchTerm.set('');
	}

	// Helper functions (copied from rental +page.svelte)
	function formatDate(dateStr) {
		if (!dateStr) return '-';
		const date = new Date(dateStr);
		const day = String(date.getDate()).padStart(2, '0');
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const year = date.getFullYear();
		return `${day}-${month}-${year}`;
	}
	function calculateDueDate(borrowDate, duration) {
		if (!borrowDate || !duration) return '-';
		const date = new Date(borrowDate);
		date.setDate(date.getDate() + duration);
		return formatDate(date.toISOString());
	}
	function getReminders(rentals) {
		const today = new Date();
		const besok = new Date(today);
		besok.setDate(today.getDate() + 1);
		return rentals.filter((item) => {
			if (item.status !== 'Dipinjam') return false;
			if (
				!item.tanggalJatuhTempo ||
				typeof item.tanggalJatuhTempo !== 'string' ||
				!item.tanggalJatuhTempo.includes('-')
			)
				return false;
			const [day, month, year] = item.tanggalJatuhTempo.split('-');
			if (!day || !month || !year) return false;
			const dueDate = new Date(`${year}-${month}-${day}`);
			return (
				dueDate.getFullYear() === besok.getFullYear() &&
				dueDate.getMonth() === besok.getMonth() &&
				dueDate.getDate() === besok.getDate()
			);
		});
	}
	function calculateLateDays(tanggalJatuhTempo) {
		if (!tanggalJatuhTempo) return 0;
		const today = new Date();
		const dueDate = new Date(tanggalJatuhTempo);
		const diffTime = Math.abs(today - dueDate);
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	}
	function getApprovalStage(item) {
		if (!item.approvals?.dept) return 'dept';
		if (!item.approvals?.inventory) return 'inventory';
		if (!item.approvals?.procurement) return 'procurement';
		return 'done';
	}

	async function fetchRentalData() {
		try {
			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/rentals?fields=*,barang_id.id,barang_id.Nama,barang_id.StokIn,barang_id.parent_category.parent_category,barang_id.sub_category.nama_sub',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
						'Content-Type': 'application/json'
					}
				}
			);
			if (!response.ok) return [];
			const result = await response.json();
			if (!result.data) return [];
			return result.data.map((item, index) => {
				// Penentuan status baru: Pending, Approved, Dipinjam, Dikembalikan
				let status = 'Pending';
				if (item.approved) status = 'Approved';
				if (item.returned) status = 'Dikembalikan';
				else if (item.borrowed) status = 'Dipinjam';
				return {
					id: item.id || `temp-${index}`,
					nama: item.barang_id?.Nama || '-',
					kategori: item.barang_id?.parent_category?.parent_category || '-',
					subKategori: item.barang_id?.sub_category?.nama_sub || '-',
					qty: item.qty ?? '-',
					peminjam: item.borrower || '-',
					tanggalPinjam: formatDate(item.borrow_date),
					tanggalJatuhTempo: calculateDueDate(item.borrow_date, item.duration),
					durasiPinjam: item.duration ? `${item.duration} hari` : '-',
					tanggalKembaliAktual: item.actual_return_date ? formatDate(item.actual_return_date) : '-',
					status,
					approvals: item.approvals || {},
					// Raw data untuk keperluan lain
					rawBorrowDate: item.borrow_date,
					rawDuration: item.duration,
					rawActualReturnDate: item.actual_return_date
				};
			});
		} catch (e) {
			return [];
		}
	}

	function getLateItems(data) {
		return data.filter((item) => {
			if (item.status !== 'Dipinjam') return false;
			if (
				!item.tanggalJatuhTempo ||
				typeof item.tanggalJatuhTempo !== 'string' ||
				!item.tanggalJatuhTempo.includes('-')
			)
				return false;
			const [day, month, year] = item.tanggalJatuhTempo.split('-');
			if (!day || !month || !year) return false;
			const dueDate = new Date(`${year}-${month}-${day}`);
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			return dueDate < today;
		});
	}
	function getWaitingApprovalItems(data) {
		return data.filter((item) => {
			const stage = getApprovalStage(item);
			return stage !== 'done';
		});
	}

	async function fetchSPKNotifications() {
		try {
			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/spk_notifications?fields=*,user_id.email,user_id.nama_lengkap',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz',
						'Content-Type': 'application/json'
					}
				}
			);
			if (!response.ok) return [];
			const result = await response.json();
			if (!result.data) return [];
			return result.data.map((item) => ({
				id: item.id,
				judul: item.judul,
				isi: item.isi,
				tanggal: formatDate(item.tanggal),
				status: item.status,
				user: item.user_id ? `${item.user_id.nama_lengkap} (${item.user_id.email})` : '-'
			}));
		} catch (e) {
			return [];
		}
	}

	// Fetch finished goods data for production notifications
	async function fetchFinishedGoods() {
		try {
			const response = await fetch('https://directus.eltamaprimaindo.com/items/finishgood', {
				headers: {
					Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
				}
			});

			if (!response.ok) return [];

			const data = await response.json();
			return data.data.map((item) => ({
				...item,
				status: calculateStatus(item.sisa_stok || 0)
			}));
		} catch (err) {
			console.error('Fetch Finished Goods Error:', err);
			return [];
		}
	}

	function calculateStatus(stock) {
		if (stock === 0) return 'Out of Stock';
		if (stock < 10) return 'Low Stock';
		return 'Ready';
	}

	// Get production notifications (items that need restocking)
	function getProductionNotifications(finishedGoods) {
		const dismissedItems =
			typeof window !== 'undefined'
				? JSON.parse(localStorage.getItem('dismissedAutoNotifications') || '[]')
				: [];
		const dismissedKodeBaran = dismissedItems.map((item) => item.kode_barang);

		return finishedGoods
			.filter((item) => item.sisa_stok <= 10) // Items with stock <= 10
			.filter((item) => !dismissedKodeBaran.includes(item.kode_barang)) // Exclude dismissed items
			.sort((a, b) => a.sisa_stok - b.sisa_stok) // Sort by stock level, lowest first
			.map((item) => ({
				id: item.id,
				kode_barang: item.kode_barang,
				nama_barang: item.nama_barang,
				sisa_stok: item.sisa_stok,
				status: item.status,
				warna: item.warna,
				kemasan: item.kemasan,
				priority: item.sisa_stok === 0 ? 'urgent' : item.sisa_stok <= 5 ? 'high' : 'medium',
				created_at: new Date().toISOString()
			}));
	}

	// Load production requests from localStorage
	function loadProductionRequests() {
		if (typeof window !== 'undefined') {
			const requests = JSON.parse(localStorage.getItem('productionRequests') || '[]');
			productionNotifications = [...productionNotifications, ...requests];
		}
	}

	// Handle new production request event
	async function handleProductionRequestAdded(event) {
		const newRequest = event.detail;

		// Reload production notifications to include the new request
		productionNotifications = getCombinedProductionNotifications();
		manualProductionRequests = await getManualProductionRequests();

		// Show toast notification
		showToastNotification({
			title: 'Permintaan Produksi Baru',
			message: `${newRequest.nama_barang} telah diajukan untuk produksi`,
			type: 'info',
			icon: '🏭'
		});

		console.log('Production request added to notifications:', newRequest);
		console.log('Total production notifications:', productionNotifications.length);
		console.log('Manual production requests:', manualProductionRequests.length);
	}

	// Handle deleted production request event
	function handleProductionRequestDeleted(event) {
		const deletedRequest = event.detail;

		// Reload production notifications to reflect the deletion
		productionNotifications = getCombinedProductionNotifications();
		manualProductionRequests = getManualProductionRequests();

		const actionText = deletedRequest.source === 'manual' ? 'dihapus' : 'disembunyikan';
		showToastNotification({
			title:
				'Produksi Notification ' +
				(deletedRequest.source === 'manual' ? 'Dihapus' : 'Disembunyikan'),
			message: `${deletedRequest.nama_barang} telah ${actionText}`,
			type: 'info',
			icon: '🗑️'
		});

		console.log('Production request deleted/dismissed:', deletedRequest);
		console.log('Updated production notifications:', productionNotifications.length);
		console.log('Updated manual production requests:', manualProductionRequests.length);
	}

	// Function to show toast notification
	function showToastNotification({ title, message, type = 'info', icon = '🔔', duration = 5000 }) {
		const notification = {
			id: ++toastId,
			title,
			message,
			type,
			icon,
			timestamp: new Date().toLocaleTimeString('id-ID', {
				hour: '2-digit',
				minute: '2-digit'
			})
		};

		toastNotifications = [...toastNotifications, notification];

		// Auto remove after duration
		setTimeout(() => {
			removeToastNotification(notification.id);
		}, duration);
	}

	// Function to remove toast notification
	function removeToastNotification(id) {
		toastNotifications = toastNotifications.filter((notification) => notification.id !== id);
	}

	// Function to get notification color classes
	function getToastColor(type) {
		switch (type) {
			case 'success':
				return 'bg-green-500 border-green-600';
			case 'error':
				return 'bg-red-500 border-red-600';
			case 'warning':
				return 'bg-yellow-500 border-yellow-600';
			case 'info':
				return 'bg-blue-500 border-blue-600';
			default:
				return 'bg-gray-500 border-gray-600';
		}
	}

	// Combine automatic and manual production notifications
	function getCombinedProductionNotifications() {
		// Get automatic notifications from finished goods
		const autoNotifications = getProductionNotifications(finishedGoodsData);

		// Get manual requests from localStorage
		const manualRequests =
			typeof window !== 'undefined'
				? JSON.parse(localStorage.getItem('productionRequests') || '[]')
				: [];

		// Combine and deduplicate by kode_barang
		const combined = [...autoNotifications];
		manualRequests.forEach((request) => {
			const exists = combined.find((item) => item.kode_barang === request.kode_barang);
			if (!exists) {
				combined.push({
					...request,
					id: request.id || Date.now(),
					created_at: request.tanggal_request || new Date().toISOString()
				});
			}
		});

		return combined.sort((a, b) => {
			// Sort by priority: urgent > high > medium
			const priorityOrder = { urgent: 3, high: 2, medium: 1 };
			if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
				return priorityOrder[b.priority] - priorityOrder[a.priority];
			}
			// Then by stock level (lowest first)
			return a.sisa_stok - b.sisa_stok;
		});
	}

	// Get manual production requests for NotificationBell (only manually requested items)
	async function getManualProductionRequests() {
		try {
			// Try to fetch from Directus database first
			const response = await fetch(
				'https://directus.eltamaprimaindo.com/items/produksi_notifications',
				{
					headers: {
						Authorization: 'Bearer JaXaSE93k24zq7T2-vZyu3lgNOUgP8fz'
					}
				}
			);

			if (response.ok) {
				const data = await response.json();
				return data.data
					.filter((request) => request.status !== 'completed') // Only show pending requests
					.map((request) => ({
						...request,
						source: 'manual',
						created_at: request.tanggal_request || new Date().toISOString()
					}))
					.sort((a, b) => {
						// Sort by timestamp, newest first
						return new Date(b.created_at) - new Date(a.created_at);
					});
			} else {
				console.warn('Failed to fetch from database, using localStorage fallback');
			}
		} catch (error) {
			console.error('Error fetching production requests from database:', error);
		}

		// Fallback to localStorage if database fails
		const manualRequests =
			typeof window !== 'undefined'
				? JSON.parse(localStorage.getItem('productionRequests') || '[]')
				: [];

		return manualRequests
			.map((request) => ({
				...request,
				source: 'manual',
				created_at: request.tanggal_request || new Date().toISOString()
			}))
			.sort((a, b) => {
				// Sort by timestamp, newest first
				return new Date(b.created_at) - new Date(a.created_at);
			});
	}

	onMount(async () => {
		rentalData = await fetchRentalData();
		reminders = getReminders(rentalData);
		lateItems = getLateItems(rentalData);
		waitingApprovalItems = getWaitingApprovalItems(rentalData);

		// Load finished goods and production notifications
		finishedGoodsData = await fetchFinishedGoods();
		productionNotifications = getCombinedProductionNotifications();
		manualProductionRequests = await getManualProductionRequests();

		// Load SPK notifications
		try {
			spkNotifications = await getSPKNotifications();
			console.log('SPK notifications loaded in layout:', spkNotifications.length);
		} catch (error) {
			console.error('Error loading SPK notifications in layout:', error);
			spkNotifications = [];
		}

		// Load SO Customer data
		try {
			soCustomerData = await getAllSOCustomer();
			console.log('SO Customer data loaded in layout:', soCustomerData.length);
		} catch (error) {
			console.error('Error loading SO Customer data in layout:', error);
			soCustomerData = [];
		}
	});

	// Handle SPK actions from NotificationBell
	async function handleSPKAction(event) {
		const { notificationId, spkId, action } = event.detail;

		try {
			if (action === 'approve') {
				await approveSPKNotification(spkId);
				showToastNotification({
					title: 'SPK Disetujui',
					message: `SPK #${spkId} berhasil disetujui`,
					type: 'success',
					icon: '✅'
				});
				console.log('SPK approved:', spkId);
			} else if (action === 'reject') {
				await rejectSPKNotification(spkId);
				showToastNotification({
					title: 'SPK Ditolak',
					message: `SPK #${spkId} telah ditolak`,
					type: 'error',
					icon: '❌'
				});
				console.log('SPK rejected:', spkId);
			}

			// Reload SPK notifications after action
			spkNotifications = await getSPKNotifications();
		} catch (error) {
			console.error('Error handling SPK action:', error);
			showToastNotification({
				title: 'Error',
				message: 'Terjadi kesalahan saat memproses SPK',
				type: 'error',
				icon: '⚠️'
			});
		}
	}
</script>

{#if $page.url.pathname !== '/login'}
	<div class="min-h-screen bg-gray-50">
		<!-- Toast Notifications -->
		<div class="fixed top-4 right-4 z-50 space-y-2">
			{#each toastNotifications as notification (notification.id)}
				<div
					class="max-w-sm w-full {getToastColor(
						notification.type
					)} shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out animate-slide-in"
				>
					<div class="p-4">
						<div class="flex items-start">
							<div class="flex-shrink-0">
								<span class="text-2xl">{notification.icon}</span>
							</div>
							<div class="ml-3 w-0 flex-1 pt-0.5">
								<p class="text-sm font-medium text-white">
									{notification.title}
								</p>
								<p class="mt-1 text-sm text-white/90">
									{notification.message}
								</p>
								<p class="mt-1 text-xs text-white/70">
									{notification.timestamp}
								</p>
							</div>
							<div class="ml-4 flex-shrink-0 flex">
								<button
									class="bg-white/20 rounded-md inline-flex text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
									on:click={() => removeToastNotification(notification.id)}
								>
									<span class="sr-only">Close</span>
									<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
										<path
											fill-rule="evenodd"
											d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
							</div>
						</div>
					</div>
					<!-- Progress bar -->
					<div class="bg-black/20 h-1">
						<div class="bg-white/40 h-full animate-progress-bar"></div>
					</div>
				</div>
			{/each}
		</div>
		<!-- Header -->
		<header
			class="relative bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 shadow-2xl border-b border-white/10"
		>
			<!-- Background Pattern -->
			<div
				class="absolute inset-0 opacity-30"
				style="background-image: url('data:image/svg+xml;utf8,<svg width=&quot;60&quot; height=&quot;60&quot; viewBox=&quot;0 0 60 60&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;><g fill=&quot;none&quot; fill-rule=&quot;evenodd&quot;><g fill=&quot;%23ffffff&quot; fill-opacity=&quot;0.03&quot;><circle cx=&quot;60&quot; cy=&quot;30&quot; r=&quot;2&quot;/><circle cx=&quot;30&quot; cy=&quot;60&quot; r=&quot;2&quot;/><circle cx=&quot;0&quot; cy=&quot;30&quot; r=&quot;2&quot;/><circle cx=&quot;30&quot; cy=&quot;0&quot; r=&quot;2&quot;/></g></g></svg>')"
			></div>

			<!-- Animated Background Gradient -->
			<div
				class="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-indigo-600/20 animate-pulse duration-[3000ms]"
			></div>

			<div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex justify-between items-center h-24">
					<div class="flex items-center space-x-6">
						<!-- Logo/Icon with Glow Effect -->
						<div class="relative group">
							<div
								class="absolute -inset-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"
							></div>
							<div
								class="relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm"
							>
								<div
									class="absolute inset-0 bg-white/10 rounded-2xl animate-pulse duration-2000"
								></div>
								<!-- <span class="relative text-3xl filter drop-shadow-lg"><img src="/Logo-Eltama-Prima-Indo-01.png" alt="Logo" class="w-16 h-16 mb-2 drop-shadow-lg" /></span>  rapihkan logo -->
								<span class="relative text-3xl font-bold text-white">
									<img
										src="/Logo-Eltama-Prima-Indo-01.png"
										alt="Logo"
										class="w-16 h-16 drop-shadow-lg"
									/>
								</span>
							</div>
						</div>

						<div class="flex flex-col">
							<h1
								class="text-3xl font-black text-transparent bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text tracking-tight leading-tight"
							>
								INVENTORY SYSTEM
							</h1>
							<div class="flex items-center space-x-2">
								<div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
								<p class="text-blue-200 text-sm font-semibold tracking-wide uppercase">
									PT Eltama Prima Indo
								</p>
							</div>
						</div>
					</div>

					<div class="flex items-center space-x-6">
						<!-- Real-time Status Indicator -->
						<div
							class="hidden lg:flex items-center space-x-3 bg-white/5 px-4 py-3 rounded-xl backdrop-blur-sm border border-white/10"
						>
							<div class="flex items-center space-x-2">
								<div
									class="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"
								></div>
								<span class="text-green-300 text-sm font-medium">System Online</span>
							</div>
						</div>

						<!-- Current Date & Time -->
						<div
							class="hidden md:flex flex-col items-center bg-white/5 px-5 py-3 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300"
						>
							<div class="flex items-center space-x-2 mb-1">
								<span class="text-blue-300 text-lg">📅</span>
								<span class="text-white text-sm font-bold">
									{new Date().toLocaleDateString('id-ID', {
										day: '2-digit',
										month: 'short',
										year: 'numeric'
									})}
								</span>
							</div>
							<span class="text-blue-200 text-xs font-medium">
								{new Date().toLocaleTimeString('id-ID', {
									hour: '2-digit',
									minute: '2-digit'
								})} WIB
							</span>
						</div>

						<!-- User Profile with Enhanced Design -->
						<div class="relative group">
							<div
								class="absolute -inset-1 bg-gradient-to-r from-blue-400 to-purple-500 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-500"
							></div>
							<div
								class="relative flex items-center space-x-4 bg-white/5 px-5 py-3 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 cursor-pointer"
								tabindex="0"
								aria-haspopup="true"
								aria-expanded={dropdownOpen}
								on:click={() => (dropdownOpen = !dropdownOpen)}
								on:blur={() => setTimeout(() => (dropdownOpen = false), 150)}
							>
								<!-- Avatar with Status -->
								<div class="relative">
									<div
										class="w-10 h-10 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20"
									>
										<span class="text-white text-lg font-bold"
											>{user ? user.nama_lengkap.charAt(0).toUpperCase() : 'U'}</span
										>
									</div>
									<!-- Online Status Dot -->
									<div
										class="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-slate-900 animate-pulse shadow-lg shadow-green-400/50"
									></div>
								</div>

								<div class="hidden sm:block">
									<p class="text-white text-sm font-bold">{user ? user.nama_lengkap : 'User'}</p>
									<div class="flex items-center space-x-2">
										<div class="w-2 h-2 bg-green-400 rounded-full"></div>
										<p class="text-green-300 text-xs font-medium">Active Now</p>
									</div>
								</div>

								<!-- Dropdown Arrow -->
								<div class="flex flex-col items-center ml-2">
									<svg
										class="w-4 h-4 text-white/60 group-hover:rotate-180 transition-transform duration-300"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<path
											fill-rule="evenodd"
											d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
							</div>
							{#if dropdownOpen}
								<div
									class="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg py-2 z-50 border border-gray-100 animate-fade-in"
								>
									<button
										on:click={logout}
										class="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 rounded-b-xl font-semibold"
									>
										Logout
									</button>
								</div>
							{/if}
						</div>
					</div>
				</div>
				<!-- close .flex justify-between items-center h-24 -->
			</div>
			<!-- close .relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -->

			<!-- Bottom Border Glow -->
			<div
				class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent"
			></div>
		</header>

		<!-- Navigation -->
		<nav
			class="relative bg-gradient-to-r from-white via-gray-50 to-white shadow-xl border-b border-gray-200/50"
		>
			<!-- Subtle Background Pattern -->
			<div
				class="absolute inset-0 opacity-50"
				style="background-image: url('data:image/svg+xml;utf8,<svg width=&quot;40&quot; height=&quot;40&quot; viewBox=&quot;0 0 40 40&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;><g fill=&quot;%23f3f4f6&quot; fill-opacity=&quot;0.4&quot;><path d=&quot;M20 20c0 11.046-8.954 20-20 20v20h40V20H20z&quot;/></g></svg>')"
			></div>

			<div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between h-16">
					<!-- Navigation Items -->
					<div class="flex items-center space-x-2">
						{#each menuItems as item, index}
							<a
								href={item.path}
								class="group relative inline-flex items-center px-6 py-3 text-sm font-semibold transition-all duration-300 rounded-xl
							{$page.url.pathname === item.path
									? 'text-white bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-500/25 transform scale-105'
									: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 hover:shadow-md hover:scale-105'}"
							>
								<!-- Active Background Glow -->
								{#if $page.url.pathname === item.path}
									<div
										class="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-25 animate-pulse"
									></div>
								{/if}

								<!-- Icon with Enhanced Styling -->
								<span
									class="relative mr-3 text-lg transform group-hover:scale-110 transition-transform duration-300
								{$page.url.pathname === item.path ? 'filter drop-shadow-sm' : ''}"
								>
									{item.icon}
								</span>

								<!-- Label -->
								<span class="relative font-bold tracking-wide">
									{item.label}
								</span>

								<!-- Active Indicator -->
								{#if $page.url.pathname === item.path}
									<div
										class="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-lg"
									></div>
								{/if}

								<!-- Hover Effect -->
								<div
									class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/10 group-hover:to-purple-500/10 rounded-xl transition-all duration-300"
								></div>
							</a>
						{/each}
					</div>

					<!-- Right Side - Quick Actions -->
					<div class="flex items-center space-x-4">
						<!-- Notification Bell -->
						<NotificationBell
							{reminders}
							{lateItems}
							{waitingApprovalItems}
							{spkNotifications}
							{soCustomerData}
							productionNotifications={manualProductionRequests}
							productionRequests={productionRequestsData}
							on:spkAction={handleSPKAction}
						/>
					</div>
				</div>
			</div>

			<!-- Bottom Gradient Border -->
			<div
				class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 opacity-60"
			></div>
		</nav>

		<!-- Main Content -->
		<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<slot />
		</main>
	</div>
{:else}
	<slot />
{/if}

<style>
	.animate-fade-in {
		animation: fadeIn 0.3s ease-out;
	}

	.animate-slide-in {
		animation: slideIn 0.3s ease-out;
	}

	.animate-progress-bar {
		animation: progressBar 5s linear;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateX(100%);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@keyframes progressBar {
		from {
			width: 100%;
		}
		to {
			width: 0%;
		}
	}
</style>
