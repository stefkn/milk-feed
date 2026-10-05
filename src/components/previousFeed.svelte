<script lang="ts">
    import { format } from "@formkit/tempo";
    import { createEventDispatcher } from "svelte";
    import type { FeedLog } from "../lib/types";
    import {
        milkConsumed,
        formatDuration,
        applyFeedEdit,
        generateFeedId,
        mlPerMinute,
    } from "../lib/feed";

    import { feedValidationError } from "$lib/feedValidation";

    const dispatch = createEventDispatcher();

    export let feed: FeedLog = {
        feedId: generateFeedId(),
        start: new Date(),
        end: new Date(),
        duration: 0,
        bottleSize: 0,
        remainingMilk: 0,
        type: "bottle",
    };

    let isEditing = false;
    let updatedFeed = { ...feed };
    let updatedFeedDuration = feed.duration;
    let updatedFeedBoundStart = format(
        updatedFeed.start,
        "YYYY-MM-DDTHH:mm",
        "en",
    );
    let updatedFeedBoundEnd = format(updatedFeed.end, "YYYY-MM-DDTHH:mm", "en");
    let editError = "";

    $: isBottle = feed.type === "bottle";
    $: borderColor = isBottle ? "border-l-emerald-500" : "border-l-purple-500";

    function handleFormSubmit(event: any) {
        event.preventDefault();
        try {
            // Preserve seconds (and paused durations) when date fields are untouched.
            if (
                updatedFeedBoundStart !==
                format(updatedFeed.start, "YYYY-MM-DDTHH:mm", "en")
            ) {
                updatedFeed = applyFeedEdit(
                    updatedFeed,
                    "start",
                    updatedFeedBoundStart,
                );
            }
            if (
                updatedFeedBoundEnd !==
                format(updatedFeed.end, "YYYY-MM-DDTHH:mm", "en")
            ) {
                updatedFeed = applyFeedEdit(
                    updatedFeed,
                    "end",
                    updatedFeedBoundEnd,
                );
            }
            editError = feedValidationError(updatedFeed);
        } catch {
            editError = "Please enter valid start and end times.";
        }
        if (editError) return;
        dispatch("updatefeed", updatedFeed);
        isEditing = false;
    }

    function handleUpdateFeedChange(event: any) {
        const { name, value } = event.target;
        try {
            updatedFeed = applyFeedEdit(updatedFeed, name, value);
        } catch {
            editError = "Please enter valid start and end times.";
            return;
        }
        updatedFeedDuration = updatedFeed.duration;
        if (name === "bottleSize" || name === "remainingMilk") {
            if (updatedFeed.remainingMilk > updatedFeed.bottleSize) {
                updatedFeed.remainingMilk = updatedFeed.bottleSize;
            }
        }
        editError = "";
    }

    function handleDelete() {
        if (
            window.confirm("Delete this feed? You can undo for a few seconds.")
        ) {
            dispatch("deletefeed", feed);
        }
    }

    function toggleEdit() {
        if (!isEditing) {
            // reset edit state from current feed prop
            updatedFeed = { ...feed };
            updatedFeedDuration = feed.duration;
            updatedFeedBoundStart = format(
                feed.start,
                "YYYY-MM-DDTHH:mm",
                "en",
            );
            updatedFeedBoundEnd = format(feed.end, "YYYY-MM-DDTHH:mm", "en");
            editError = "";
        }
        isEditing = !isEditing;
    }
</script>

<li
    class={`block max-w-2xl m-auto p-2 my-2 bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700 border-l-4 ${borderColor}`}
>
    <div
        class="flex flex-wrap justify-between items-center gap-2 md:flex-nowrap"
    >
        {#if isEditing}
            <form
                class="flex flex-wrap gap-4 gap-y-0 items-center w-full"
                on:submit={handleFormSubmit}
            >
                <div>
                    <label
                        for={`edit-start-${feed.feedId}`}
                        class="block text-sm font-medium text-gray-900 dark:text-white"
                        >Start</label
                    >
                    <input
                        required
                        type="datetime-local"
                        id={`edit-start-${feed.feedId}`}
                        name="start"
                        class="my-2 p-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:text-white w-48"
                        bind:value={updatedFeedBoundStart}
                        on:change={handleUpdateFeedChange}
                    />
                </div>

                <div>
                    <label
                        for={`edit-end-${feed.feedId}`}
                        class="block text-sm font-medium text-gray-900 dark:text-white"
                        >End</label
                    >
                    <input
                        required
                        type="datetime-local"
                        id={`edit-end-${feed.feedId}`}
                        name="end"
                        class="my-2 p-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:text-white w-48"
                        bind:value={updatedFeedBoundEnd}
                        on:change={handleUpdateFeedChange}
                    />
                </div>

                <div>
                    <label
                        for={`edit-duration-${feed.feedId}`}
                        class="block text-sm font-medium text-gray-900 dark:text-white"
                        >Duration (s)</label
                    >
                    <input
                        type="number"
                        class="my-2 p-2.5 bg-gray-100 border border-gray-300 text-gray-900 text-sm rounded-lg block w-24 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        id={`edit-duration-${feed.feedId}`}
                        bind:value={updatedFeedDuration}
                        disabled
                    />
                </div>

                <div>
                    <label
                        for={`edit-type-${feed.feedId}`}
                        class="block text-sm font-medium text-gray-900 dark:text-white"
                        >Type</label
                    >
                    <select
                        id={`edit-type-${feed.feedId}`}
                        name="type"
                        class="my-2 p-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:text-white w-28"
                        bind:value={updatedFeed.type}
                        on:change={handleUpdateFeedChange}
                    >
                        <option value="bottle">Bottle</option>
                        <option value="breast">Breast</option>
                    </select>
                </div>

                <div>
                    <label
                        for={`edit-bottleSize-${feed.feedId}`}
                        class="block text-sm font-medium text-gray-900 dark:text-white"
                        >Bottle Size (ml)</label
                    >
                    <input
                        type="number"
                        id={`edit-bottleSize-${feed.feedId}`}
                        name="bottleSize"
                        min="0"
                        disabled={updatedFeed.type === "breast"}
                        class="my-2 p-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:text-white w-24 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                        bind:value={updatedFeed.bottleSize}
                        on:change={handleUpdateFeedChange}
                    />
                </div>

                <div>
                    <label
                        for={`edit-remainingMilk-${feed.feedId}`}
                        class="block text-sm font-medium text-gray-900 dark:text-white"
                        >Remaining Milk (ml)</label
                    >
                    <input
                        type="number"
                        id={`edit-remainingMilk-${feed.feedId}`}
                        name="remainingMilk"
                        min="0"
                        max={updatedFeed.bottleSize}
                        disabled={updatedFeed.type === "breast"}
                        class="my-2 p-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:text-white w-28 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                        bind:value={updatedFeed.remainingMilk}
                        on:change={handleUpdateFeedChange}
                    />
                </div>

                <div>
                    <label
                        for={`edit-estimatedMilk-${feed.feedId}`}
                        class="block text-sm font-medium text-gray-900 dark:text-white"
                        >Estimated Milk (ml)</label
                    >
                    <input
                        type="number"
                        id={`edit-estimatedMilk-${feed.feedId}`}
                        name="estimatedMilk"
                        min="0"
                        disabled={updatedFeed.type === "bottle"}
                        class="my-2 p-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:text-white w-28 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                        bind:value={updatedFeed.estimatedMilk}
                        on:change={handleUpdateFeedChange}
                    />
                </div>

                {#if editError}
                    <p
                        class="w-full text-sm text-red-600 dark:text-red-400"
                        role="alert"
                    >
                        {editError}
                    </p>
                {/if}

                <div class="flex gap-2 w-full mt-2">
                    <button
                        class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        type="submit"
                    >
                        Save
                    </button>
                    <button
                        class="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-4 py-2 rounded-lg text-sm"
                        type="button"
                        on:click={toggleEdit}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        {:else}
            <div class="flex flex-wrap items-center gap-3 text-sm">
                <span class="inline-flex items-center gap-1.5">
                    <span
                        class="w-2 h-2 rounded-full {isBottle
                            ? 'bg-emerald-500'
                            : 'bg-purple-500'}"
                    ></span>
                    <span class="capitalize">{feed.type}</span>
                </span>
                <span>
                    {format(feed.start, { date: "short" })}
                </span>
                <span class="font-medium">
                    {format(feed.start, { time: "short" })}-{format(feed.end, {
                        time: "short",
                    })}
                </span>
                <span
                    class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs"
                >
                    {formatDuration(feed.duration)}
                </span>
                <span class="font-medium">
                    {milkConsumed(feed, $mlPerMinute)} ml{#if feed.type === "breast"}
                        <span
                            class="text-xs font-normal text-gray-500 dark:text-gray-400"
                            >(est)</span
                        >{/if}
                </span>
            </div>
        {/if}
        <div class="flex gap-2 shrink-0">
            <button
                on:click={toggleEdit}
                class="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-md h-8 w-8 flex items-center justify-center"
                aria-label={isEditing ? "Cancel edit" : "Edit feed"}
            >
                {#if isEditing}
                    ✕
                {:else}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="feather feather-edit-3"
                        ><path d="M12 20h9"></path><path
                            d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                        ></path></svg
                    >
                {/if}
            </button>
            <button
                on:click={handleDelete}
                class="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-md h-8 w-8 flex items-center justify-center"
                aria-label="Delete feed"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="feather feather-trash-2"
                    ><polyline points="3 6 5 6 21 6"></polyline><path
                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    ></path><line x1="10" y1="11" x2="10" y2="17"></line><line
                        x1="14"
                        y1="11"
                        x2="14"
                        y2="17"
                    ></line></svg
                >
            </button>
        </div>
    </div>
</li>
