<!-- src/routes/+layout.svelte -->
<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { searchTerm } from '$lib/stores/search.js';

	const menuItems = [
		{ path: '/dashboard', label: 'Dashboard', icon: '🏠' },
		{ path: '/inventory', label: 'Inventory', icon: '📦' },
		{ path: '/inventory/rental', label: 'Rental', icon: '📋' }
	];

	// State for user
	let user = null;
	let dropdownOpen = false;

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
</script>

{#if $page.url.pathname !== '/login'}
	<div class="min-h-screen bg-gray-50">
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
								<span class="relative text-3xl filter drop-shadow-lg">📦</span>
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
						<!-- Quick Search -->
						<div class="hidden md:flex flex-col justify-center w-72">
							<label class="sr-only">Pencarian Barang</label>
							<div class="relative">
								<input
									type="text"
									placeholder="Cari di semua tabel: nama barang, kategori, departemen, status, deskripsi..."
									class="w-full p-2 pl-10 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm"
									bind:value={$searchTerm}
								/>
								<!-- Search Icon -->
								<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<svg
										class="h-5 w-5 text-gray-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
										/>
									</svg>
								</div>
								<!-- Clear Button -->
								{#if $searchTerm}
									<button
										on:click={clearSearch}
										class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
										type="button"
									>
										<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								{/if}
							</div>
						</div>

						<!-- Notification Bell -->
						<button
							class="relative p-3 bg-gray-100/80 rounded-xl border border-gray-200/50 hover:bg-gray-200/80 hover:shadow-md transition-all duration-300 group"
						>
							<svg
								class="w-5 h-5 text-gray-600 group-hover:text-gray-800 transition-colors duration-300"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 17h5l-5 5v-5zM4 12c0-4.418 3.582-8 8-8s8 3.582 8 8c0 4.418-3.582 8-8 8s-8-3.582-8-8z"
								></path>
							</svg>
							<!-- Notification Dot -->
							<div
								class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"
							></div>
						</button>
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
