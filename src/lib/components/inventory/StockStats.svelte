<script>
    export let stats;
</script>

<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-sm font-medium text-gray-500">Total</h3>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{stats.totalItems}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-sm font-medium text-gray-500">Ready</h3>
        <p class="mt-1 text-2xl font-semibold text-green-600">{stats.readyItems}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-sm font-medium text-gray-500">Low Stock</h3>
        <p class="mt-1 text-2xl font-semibold text-yellow-600">{stats.lowStockItems}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-sm font-medium text-gray-500">Out of Stock</h3>
        <p class="mt-1 text-2xl font-semibold text-red-600">{stats.outOfStockItems}</p>
    </div>
</div>