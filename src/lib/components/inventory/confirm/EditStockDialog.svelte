<script>
  import { createEventDispatcher } from 'svelte';
  import Select from 'svelte-select';

  export let show = false;
  export let selectedItem = null;

  const dispatch = createEventDispatcher();

  let formData = {
    id: selectedItem ? selectedItem.id : null,
    name: selectedItem ? selectedItem.name : '',
    description: selectedItem ? selectedItem.description : '',
    stockIn: selectedItem ? selectedItem.stockIn : 0,
    status: selectedItem ? selectedItem.status : 'Ready'
  };

  let errors = {};

  const statusOptions = [
    { value: 'Ready', label: 'Ready' },
    { value: 'Low Stock', label: 'Low Stock' },
    { value: 'Out of Stock', label: 'Out of Stock' }
  ];

  function validateForm() {
    errors = {};
    if (!formData.name) errors.name = 'Nama barang wajib diisi';
    if (!formData.description) errors.description = 'Deskripsi wajib diisi';
    if (!formData.stockIn || formData.stockIn <= 0) errors.stockIn = 'Stok harus lebih dari 0';
    if (!formData.status) errors.status = 'Status wajib dipilih';
    return Object.keys(errors).length === 0;
  }

  function handleSubmit() {
    if (validateForm()) {
      dispatch('confirm', {
        id: formData.id,
        name: formData.name,
        description: formData.description,
        stockIn: parseInt(formData.stockIn),
        status: formData.status
      });
    }
  }

  function handleCancel() {
    dispatch('cancel');
    formData = {
      id: null,
      name: '',
      description: '',
      stockIn: 0,
      status: 'Ready'
    };
    errors = {};
  }

  $: if (selectedItem) {
    formData = {
      id: selectedItem.id,
      name: selectedItem.name,
      description: selectedItem.description,
      stockIn: selectedItem.stockIn,
      status: selectedItem.status
    };
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <h2 class="text-xl font-bold mb-4">Edit Barang di Stok</h2>
      
      <div class="space-y-4">
        <!-- Input Nama Barang -->
        <div>
          <label class="block text-sm font-medium text-gray-700">Nama Barang</label>
          <input
            type="text"
            bind:value={formData.name}
            class="mt-1 block w-full border rounded-md p-2"
            placeholder="Masukkan nama barang"
          />
          {#if errors.name}
            <p class="text-red-500 text-sm mt-1">{errors.name}</p>
          {/if}
        </div>

        <!-- Input Deskripsi -->
        <div>
          <label class="block text-sm font-medium text-gray-700">Deskripsi</label>
          <textarea
            bind:value={formData.description}
            class="mt-1 block w-full border rounded-md p-2"
            rows="4"
            placeholder="Masukkan deskripsi barang"
          ></textarea>
          {#if errors.description}
            <p class="text-red-500 text-sm mt-1">{errors.description}</p>
          {/if}
        </div>

        <!-- Input Stok -->
        <div>
          <label class="block text-sm font-medium text-gray-700">Stok</label>
          <input
            type="number"
            bind:value={formData.stockIn}
            class="mt-1 block w-full border rounded-md p-2"
            placeholder="Masukkan jumlah stok"
            min="0"
          />
          {#if errors.stockIn}
            <p class="text-red-500 text-sm mt-1">{errors.stockIn}</p>
          {/if}
        </div>

        <!-- Dropdown Status -->
        <div>
          <label class="block text-sm font-medium text-gray-700">Status</label>
          <Select
            items={statusOptions}
            bind:value={formData.status}
            placeholder="Pilih status..."
            class="mt-1"
            getOptionLabel={option => option.label}
            getOptionValue={option => option.value}
          />
          {#if errors.status}
            <p class="text-red-500 text-sm mt-1">{errors.status}</p>
          {/if}
        </div>

        <!-- Tombol Aksi -->
        <div class="flex justify-end space-x-2">
          <button
            on:click={handleCancel}
            class="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            on:click={handleSubmit}
            class="px-4 py-2 border rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Styling untuk svelte-select */
  :global(.svelte-select) {
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    padding: 0.5rem;
  }
  :global(.svelte-select input) {
    width: 100%;
  }
</style>