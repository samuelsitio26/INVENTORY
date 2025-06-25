<script>
    import { stockStore } from '$lib/stores/inventory.js';

    let searchTerm = '';
    let selectedCategory = 'Semua';

    // Dapatkan daftar kategori unik dari data asli
    $: uniqueCategories = ['Semua', ...new Set($stockStore.originalItems.map(item => item.category))];

    // Filter items secara lokal tanpa mengubah store
    $: filteredItems = $stockStore.originalItems.filter(item => {
        const matchesSearch = !searchTerm || 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.pic.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'Semua' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // Kirim filteredItems ke store hanya saat filter berubah
    $: {
        stockStore.update(store => ({
            ...store,
            items: filteredItems
        }));
    }
</script>

<div class="bg-white rounded-lg shadow p-6 space-y-4">
    <div>
        <label class="block text-sm font-medium text-gray-700">Cari</label>
        <input
            type="text"
            bind:value={searchTerm}
            placeholder="Cari barang, lokasi, atau PIC..."
            class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
    </div>
    <!-- <div>
        <label class="block text-sm font-medium text-gray-700">Kategori</label>
        <select
            bind:value={selectedCategory}
            class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            {#each uniqueCategories as category}
                <option value={category}>{category === 'Semua' ? 'Semua Kategori' : category}</option>
            {/each}
        </select>
    </div> -->
</div>

<style>
    /* Optional: Tambahkan styling jika diperlukan */
</style>