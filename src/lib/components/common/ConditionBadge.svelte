<!-- src/lib/components/common/ConditionBadge.svelte -->
<script>
    export let condition = '';
    export let showIcon = true;
    export let size = 'normal'; // 'small', 'normal', 'large'
    
    const conditionConfig = {
      normal: {
        label: 'Normal',
        class: 'bg-green-100 text-green-800 border-green-200',
        icon: '✅'
      },
      bermasalah: {
        label: 'Bermasalah',
        class: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: '⚠️'
      },
      rusak: {
        label: 'Rusak',
        class: 'bg-red-100 text-red-800 border-red-200',
        icon: '❌'
      }
    };
    
    $: config = conditionConfig[condition] || conditionConfig.normal;
    
    $: sizeClass = {
      'small': 'px-2 py-0.5 text-xs',
      'normal': 'px-2.5 py-0.5 text-xs',  
      'large': 'px-3 py-1 text-sm'
    }[size] || 'px-2.5 py-0.5 text-xs';
</script>

<span class="inline-flex items-center {sizeClass} rounded-full font-medium border {config.class}">
  {#if showIcon}
    <span class="mr-1">{config.icon}</span>
  {/if}
  {config.label}
</span>