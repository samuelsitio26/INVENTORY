<script>
  export let stock;
  export let deleteItem;
  export let addToStock; // Prop baru untuk fungsi "Masukkan ke Stok"
</script>

<div class="bg-white rounded-lg shadow p-6 overflow-x-auto">
  <table class="w-full border-collapse">
    <thead>
      <tr class="bg-gray-100">
        <th class="p-3 text-left">Barang Diterima</th>
        <th class="p-3 text-left">Kuantitas</th>
        <th class="p-3 text-left">Units</th>
        <th class="p-3 text-left">Aksi</th>
      </tr>
    </thead>
    <tbody>
      {#each stock as item}
        <tr class="border-b hover:bg-gray-50">
          <td class="p-3">{item.name}</td>
          <td class="p-3">{item.quantity}</td>
          <td class="p-3">{item.units}</td>
          <td class="p-3 space-x-2">
            <!-- <a
              href="/inventory/edit/{item.id}"
              class="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Edit
            </a> -->
            <!-- <button
              on:click={() => deleteItem(item.id, item.name)}
              class="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Hapus
            </button> -->
            <button
              on:click={() => addToStock(item)}
              class="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Masukkan ke Stok
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>