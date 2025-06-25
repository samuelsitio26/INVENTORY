<!-- src/lib/components/common/StatusBadge.svelte -->
<script>
    export let status = '';
    
    const statusConfig = {
      pending: {
        label: 'Pending',
        class: 'bg-yellow-100 text-yellow-800'
      },
      in_progress: {
        label: 'On Process',
        class: 'bg-blue-100 text-blue-800'
      },
      under_maintenance: {
        label: 'Under Maintenance',
        class: 'bg-orange-100 text-orange-800'
      },
      completed: {
        label: 'Done',
        class: 'bg-green-100 text-green-800'
      },
      to_do: {
        label: 'To Do',
        class: 'bg-gray-100 text-gray-800'
      }
    };
    
    $: config = statusConfig[status] || { label: status, class: 'bg-gray-100 text-gray-800' };
  </script>
  
  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {config.class}">
    {config.label}
  </span>