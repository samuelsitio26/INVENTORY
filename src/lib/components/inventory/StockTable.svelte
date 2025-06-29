<script>
	export let stock;
	export let addToStock; // Prop untuk fungsi "Masukkan ke Stok" (Advanced)
	export let quickAddToStock; // Prop baru untuk Quick Add
</script>

<div class="bg-white rounded-lg shadow p-6 overflow-x-auto">
	<table class="w-full border-collapse">
		<thead>
			<tr class="bg-gray-100">
				<th class="p-3 text-left">Barang Diterima</th>
				<th class="p-3 text-left">Kategori</th>
				<th class="p-3 text-left">Sub Kategori</th>
				<th class="p-3 text-left">Kuantitas</th>
				<th class="p-3 text-left">Units</th>
				<th class="p-3 text-left">Aksi</th>
			</tr>
		</thead>
		<tbody>
			{#each stock as item}
				<tr class="border-b hover:bg-gray-50">
					<td class="p-3">{item.name}</td>
					<td class="p-3">
						<span
							class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
						>
							{item.category}
						</span>
					</td>
					<td class="p-3">
						<span
							class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
						>
							{item.subCategory}
						</span>
					</td>
					<td class="p-3">{item.quantity}</td>
					<td class="p-3">{item.units}</td>
					<td class="p-3 space-x-2">
						<!-- Quick Add Button (Utama) -->
						<button
							on:click={() => quickAddToStock(item)}
							class="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
							title="Quick Add - Langsung masukkan ke stok"
						>
							🚀 Quick Add
						</button>

						<!-- Advanced Add Button (Alternatif) -->
						<button
							on:click={() => addToStock(item)}
							class="inline-flex items-center px-2 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
							title="Advanced - Form lengkap dengan pilihan manual"
						>
							⚙️ Advanced
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
