<script>
	import { createEventDispatcher } from 'svelte';
	
	export let show = false;
	export let title = '';
	export let size = 'md'; // sm, md, lg, xl
	export let onClose = null;
	
	const dispatch = createEventDispatcher();
	
	function handleClose() {
		if (onClose) {
			onClose();
		} else {
			dispatch('close');
		}
	}
	
	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}
	
	function handleKeydown(event) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}
	
	$: sizeClasses = {
		sm: 'max-w-md',
		md: 'max-w-lg',
		lg: 'max-w-2xl',
		xl: 'max-w-4xl'
	};
</script>

<!-- Modal backdrop -->
{#if show}
	<div 
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
		on:click={handleBackdropClick}
		on:keydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby={title ? 'modal-title' : undefined}
	>
		<!-- Modal content -->
		<div class="bg-white rounded-xl shadow-xl w-full {sizeClasses[size]} max-h-[90vh] overflow-y-auto">
			<!-- Modal header -->
			{#if title}
				<div class="flex items-center justify-between p-6 border-b border-gray-200">
					<h2 id="modal-title" class="text-xl font-semibold text-gray-900">
						{title}
					</h2>
					<button
						type="button"
						on:click={handleClose}
						class="text-gray-400 hover:text-gray-600 transition-colors"
						aria-label="Close modal"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>
			{/if}
			
			<!-- Modal body -->
			<div class="p-6">
				<slot />
			</div>
		</div>
	</div>
{/if}

<style>
	/* Smooth animation for modal */
	div {
		transition: all 0.3s ease;
	}
	
	/* Prevent body scroll when modal is open */
	:global(body.modal-open) {
		overflow: hidden;
	}
</style>