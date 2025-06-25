<!-- src/routes/+page.svelte (Simplified Version) -->
<script>
	import { onMount } from 'svelte';
	let loading = true;
	let error = null;
	let recentUpdates = [];
	let conditionSummary = { total: 0 };

	onMount(async () => {
		loading = false;
	});

	function formatDate(date) {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="md:flex md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
			<p class="mt-1 text-sm text-gray-600">Ringkasan data Inventory PT Eltama Prima Indo</p>
		</div>
	</div>

	<!-- Inventory Overview -->
	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-lg font-medium text-gray-900 mb-4">Inventory</h2>
		<p>Fitur dashboard inventory dan rental dapat dikembangkan di sini.</p>
	</div>
</div>
