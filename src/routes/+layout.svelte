<!-- src/routes/+layout.svelte -->
<script>
	import { page } from '$app/stores';

	const menuItems = [
		{ path: '/inventory', label: 'Inventory', icon: '📦' },
		{ path: '/inventory/rental', label: 'Rental', icon: '📋' }
	];
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="bg-white shadow-sm border-b">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center h-16">
				<div class="flex items-center">
					<h1 class="text-xl font-semibold text-gray-900">
						Sistem Maintenance - PT Eltama Prima Indo
					</h1>
				</div>

				<div class="flex items-center space-x-4">
					<span class="text-sm text-gray-600">
						{new Date().toLocaleDateString('id-ID', {
							weekday: 'long',
							year: 'numeric',
							month: 'long',
							day: 'numeric'
						})}
					</span>
				</div>
			</div>
		</div>
	</header>

	<!-- Navigation -->
	<nav class="bg-white shadow-sm">
		<div class="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
			<div class="flex flex-wrap space-x-4">
				{#each menuItems as item}
					<a
						href={item.path}
						class="inline-flex items-center px-2 pt-1 pb-2 text-sm font-medium transition-colors
						{$page.url.pathname === item.path
							? 'text-primary border-b-2 border-primary'
							: 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'}"
					>
						<span class="mr-2">{item.icon}</span>
						{item.label}
					</a>
				{/each}
			</div>
		</div>
	</nav>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<slot />
	</main>
</div>
