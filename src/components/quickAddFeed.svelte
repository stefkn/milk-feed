<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { format, parse } from "@formkit/tempo";
    import { mlPerMinute, generateFeedId } from "$lib/feed";
    import type { FeedLog } from "$lib/types";

    import { feedValidationError } from "$lib/feedValidation";

    const dispatch = createEventDispatcher();

    export let open = false;

    let type: string = "bottle";
    let startStr: string = format(
        new Date(Date.now() - 20 * 60 * 1000),
        "YYYY-MM-DDTHH:mm",
        "en",
    );
    let endStr: string = format(new Date(), "YYYY-MM-DDTHH:mm", "en");
    let bottleSize: number = 120;
    let remainingMilk: number = 0;
    let estimatedMilk: number | undefined;

    let error = "";
    let dialogElement: HTMLDialogElement;

    function reset() {
        type = "bottle";
        startStr = format(
            new Date(Date.now() - 20 * 60 * 1000),
            "YYYY-MM-DDTHH:mm",
            "en",
        );
        endStr = format(new Date(), "YYYY-MM-DDTHH:mm", "en");
        bottleSize = 120;
        remainingMilk = 0;
        estimatedMilk = undefined;
        error = "";
    }

    function close() {
        if (dialogElement?.open) dialogElement.close();
        open = false;
        error = "";
    }

    function handleSubmit() {
        error = "";
        let start: Date;
        let end: Date;
        try {
            start = parse(startStr, "YYYY-MM-DDTHH:mm", "en");
            end = parse(endStr, "YYYY-MM-DDTHH:mm", "en");
        } catch {
            error = "Please enter valid dates.";
            return;
        }
        if (
            !(start instanceof Date) ||
            isNaN(start.getTime()) ||
            !(end instanceof Date) ||
            isNaN(end.getTime())
        ) {
            error = "Please enter valid start and end times.";
            return;
        }
        if (end.getTime() <= start.getTime()) {
            error = "End time must be after start time.";
            return;
        }
        const duration = Math.max(
            0,
            Math.floor((end.getTime() - start.getTime()) / 1000),
        );

        const feed: FeedLog = {
            feedId: generateFeedId(),
            start,
            end,
            duration,
            bottleSize: type === "breast" ? 0 : bottleSize,
            remainingMilk: type === "breast" ? 0 : remainingMilk,
            estimatedMilk: type === "breast" ? estimatedMilk : undefined,
            type,
        };

        error = feedValidationError(feed);
        if (error) return;
        dispatch("addfeed", feed);
        close();
    }

    function showDialog(dialog: HTMLDialogElement) {
        reset();
        dialog.showModal();
    }

    // clamp remaining when bottle size shrinks
    $: if (remainingMilk > bottleSize) remainingMilk = bottleSize;
</script>

{#if open}
    <dialog
        bind:this={dialogElement}
        use:showDialog
        on:close={close}
        aria-labelledby="quick-add-title"
        class="w-[calc(100%-2rem)] max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 max-h-[90dvh] overflow-auto backdrop:bg-black/40"
    >
        <div class="flex items-center justify-between mb-3">
            <h3
                id="quick-add-title"
                class="text-lg font-semibold text-gray-900 dark:text-white"
            >
                Add feed
            </h3>
            <button
                on:click={close}
                class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                aria-label="Close">✕</button
            >
        </div>

        <form
            on:submit|preventDefault={handleSubmit}
            class="flex flex-col gap-4"
        >
            <div class="flex gap-2">
                <button
                    type="button"
                    on:click={() => (type = "bottle")}
                    class="px-4 py-2 rounded-full text-sm font-medium {type ===
                    'bottle'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}"
                    >Bottle</button
                >
                <button
                    type="button"
                    on:click={() => (type = "breast")}
                    class="px-4 py-2 rounded-full text-sm font-medium {type ===
                    'breast'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}"
                    >Breast</button
                >
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label
                        class="block text-sm font-medium text-gray-900 dark:text-white mb-1"
                        for="qa-start">Start</label
                    >
                    <input
                        id="qa-start"
                        type="datetime-local"
                        required
                        bind:value={startStr}
                        class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
                <div>
                    <label
                        class="block text-sm font-medium text-gray-900 dark:text-white mb-1"
                        for="qa-end">End</label
                    >
                    <input
                        id="qa-end"
                        type="datetime-local"
                        required
                        bind:value={endStr}
                        class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
            </div>

            {#if type === "bottle"}
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label
                            class="block text-sm font-medium text-gray-900 dark:text-white mb-1"
                            for="qa-bottle">Bottle size (ml)</label
                        >
                        <input
                            id="qa-bottle"
                            type="number"
                            min="0"
                            required
                            bind:value={bottleSize}
                            class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                    <div>
                        <label
                            class="block text-sm font-medium text-gray-900 dark:text-white mb-1"
                            for="qa-remaining">Remaining (ml)</label
                        >
                        <input
                            id="qa-remaining"
                            type="number"
                            min="0"
                            max={bottleSize}
                            required
                            bind:value={remainingMilk}
                            class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                </div>
            {:else}
                <div>
                    <label
                        class="block text-sm font-medium text-gray-900 dark:text-white mb-1"
                        for="qa-est"
                        >Estimated milk (ml) <span
                            class="font-normal text-gray-500">optional</span
                        ></label
                    >
                    <input
                        id="qa-est"
                        type="number"
                        min="0"
                        bind:value={estimatedMilk}
                        placeholder={`uses ${$mlPerMinute} ml/min if empty`}
                        class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
            {/if}

            {#if error}
                <p class="text-sm text-red-600 dark:text-red-400" role="alert">
                    {error}
                </p>
            {/if}

            <div class="flex justify-end gap-2 pt-2">
                <button
                    type="button"
                    on:click={close}
                    class="px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                    >Cancel</button
                >
                <button
                    type="submit"
                    class="px-5 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    >Add feed</button
                >
            </div>
        </form>
    </dialog>
{/if}
