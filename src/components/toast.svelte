<script lang="ts">
    import { toasts, dismissToast } from "$lib/toast";
</script>

<div
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[min(90vw,28rem)] pointer-events-none"
>
    {#each $toasts as toast (toast.id)}
        <div
            role="status"
            aria-live="polite"
            class="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg shadow-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 border border-gray-700 dark:border-gray-200"
        >
            <span class="text-sm flex-1">{toast.message}</span>
            <div class="flex items-center gap-2 shrink-0">
                {#if toast.actionLabel && toast.onAction}
                    <button
                        on:click={() => {
                            toast.onAction?.();
                            dismissToast(toast.id);
                        }}
                        class="text-sm font-medium underline underline-offset-2 hover:no-underline"
                    >
                        {toast.actionLabel}
                    </button>
                {/if}
                <button
                    on:click={() => dismissToast(toast.id)}
                    aria-label="Dismiss"
                    class="text-sm opacity-70 hover:opacity-100"
                >
                    ✕
                </button>
            </div>
        </div>
    {/each}
</div>
