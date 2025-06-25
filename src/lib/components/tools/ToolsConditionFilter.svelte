<!-- src/lib/components/tools/ToolsConditionFilter.svelte -->
<script>
	import { onMount } from 'svelte';
	import { projectToolsStore } from '$lib/stores/projectTools.js';
	import { projectsService } from '$lib/services/projects.js';
	import { toolsService } from '$lib/services/tools.js';

	export let onFilterChange = () => {};

	let projects = [];
	let tools = [];
	let loading = false;

	let filters = {
		condition: 'all',
		project: null,
		tool: null,
		search: ''
	};

	onMount(async () => {
		await loadFilterData();
	});

	async function loadFilterData() {
		loading = true;
		try {
			const [projectsResponse, toolsResponse] = await Promise.all([
				projectsService.getActive(),
				toolsService.getActive({ sort: 'name' })
			]);

			projects = projectsResponse.data || [];
			tools = toolsResponse.data || [];
		} catch (error) {
			console.error('Error loading filter data:', error);
		} finally {
			loading = false;
		}
	}

	// Apply filters
	async function applyFilters() {
		// Set filters in store
		Object.entries(filters).forEach(([key, value]) => {
			if (value !== 'all' && value !== null && value !== '') {
				projectToolsStore.setFilter(key, value);
			}
		});

		// Call parent callback
		onFilterChange(filters);

		// Reload data with filters
		await projectToolsStore.loadProjectTools();
	}

	// Clear filters
	async function clearFilters() {
		filters = {
			condition: 'all',
			project: null,
			tool: null,
			search: ''
		};

		projectToolsStore.clearFilters();
		onFilterChange(filters);
		await projectToolsStore.loadProjectTools();
	}

	// Auto-apply filters when values change
	$: if (filters) {
		applyFilters();
	}
</script>

<div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		<!-- Search -->
		<div>
			<label for="search" class="block text-sm font-medium text-gray-700"> Cari </label>
			<div class="mt-1 relative rounded-md shadow-sm">
				<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
					<span class="text-gray-500 sm:text-sm">🔍</span>
				</div>
				<input
					type="text"
					id="search"
					bind:value={filters.search}
					placeholder="Cari alat atau proyek..."
					class="pl-10 block w-full pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
				/>
			</div>
		</div>

		<!-- Condition Filter -->
		<div>
			<label for="condition" class="block text-sm font-medium text-gray-700"> Kondisi </label>
			<select
				id="condition"
				bind:value={filters.condition}
				class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
			>
				<option value="all">Semua Kondisi</option>
				<option value="normal">Normal</option>
				<option value="bermasalah">Bermasalah</option>
				<option value="rusak">Rusak</option>
			</select>
		</div>

		<!-- Project Filter -->
		<div>
			<label for="project" class="block text-sm font-medium text-gray-700"> Project </label>
			<select
				id="project"
				bind:value={filters.project}
				disabled={loading}
				class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md disabled:bg-gray-100"
			>
				<option value={null}>Semua Project</option>
				{#each projects as project}
					<option value={project.id}>{project.name}</option>
				{/each}
			</select>
		</div>

		<!-- Tool Filter -->
		<div>
			<label for="tool" class="block text-sm font-medium text-gray-700"> Alat </label>
			<select
				id="tool"
				bind:value={filters.tool}
				disabled={loading}
				class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md disabled:bg-gray-100"
			>
				<option value={null}>Semua Alat</option>
				{#each tools as tool}
					<option value={tool.id}
						>{tool.name} {tool.description ? `- ${tool.description}` : ''}</option
					>
				{/each}
			</select>
		</div>

		<!-- Action Buttons -->
		<div class="flex items-end space-x-2">
			<button
				on:click={clearFilters}
				disabled={loading}
				class="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
			>
				Reset
			</button>
		</div>
	</div>

	<!-- Filter Summary -->
	{#if filters.condition !== 'all' || filters.project || filters.tool || filters.search}
		<div class="mt-3 pt-3 border-t border-gray-200">
			<div class="flex items-center justify-between text-sm text-gray-600">
				<div>
					<span class="font-medium">Filter aktif:</span>
					{#if filters.condition !== 'all'}
						<span class="ml-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
							Kondisi: {filters.condition}
						</span>
					{/if}
					{#if filters.project}
						<span class="ml-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
							Project: {projects.find((p) => p.id === filters.project)?.name || 'Unknown'}
						</span>
					{/if}
					{#if filters.tool}
						<span class="ml-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
							Alat: {tools.find((t) => t.id === filters.tool)?.name || 'Unknown'}
						</span>
					{/if}
					{#if filters.search}
						<span class="ml-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
							Pencarian: "{filters.search}"
						</span>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- File ini sudah tidak digunakan. Semua logic terkait filter kondisi alat/tools telah dihapus untuk fokus pada Inventory. -->
