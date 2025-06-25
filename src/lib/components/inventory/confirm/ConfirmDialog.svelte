<!-- $lib/components/ConfirmDialog.svelte -->
<script>
  export let show = false;
  export let message = '';
  export let onConfirm = () => {};
  export let onCancel = () => {};

  function handleConfirm() {
    onConfirm();
    show = false;
  }

  function handleCancel() {
    onCancel();
    show = false;
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Konfirmasi</h2>
      <p class="text-sm text-gray-600 mb-6">{message}</p>
      <div class="flex justify-end space-x-3">
        <button
          on:click={handleCancel}
          class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Batal
        </button>
        <button
          on:click={handleConfirm}
          class="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Hapus
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .fixed {
    z-index: 50;
  }
</style>