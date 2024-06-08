<script lang="ts">
    import { format, diffSeconds } from "@formkit/tempo";
    import { createEventDispatcher } from "svelte";
    import type { FeedLog } from "../lib/types";

    const dispatch = createEventDispatcher();

    export let feed: FeedLog = {
        feedId: new Date().getTime().toString(),
        start: new Date(),
        end: new Date(),
        duration: 0,
        bottleSize: 0,
        remainingMilk: 0,
        type: "bottle",
    };

    let isEditing = false;
    let updatedFeed = { ...feed };
    let updatedFeedDuration = diffSeconds(updatedFeed.end, updatedFeed.start);
    let updatedFeedBoundStart = format(
        updatedFeed.start,
        "YYYY-MM-DDThh:mm",
        "en",
    );
    let updatedFeedBoundEnd = format(updatedFeed.end, "YYYY-MM-DDThh:mm", "en");

    function handleFormSubmit(event: any) {
        event.preventDefault();
        dispatch("updatefeed", updatedFeed);
        isEditing = false;
    }

    function handleUpdateFeedChange(event: any) {
        const { name, value } = event.target;
        updatedFeed = {
            ...updatedFeed,
            [name]: value,
        };
        updatedFeedDuration = diffSeconds(updatedFeed.end, updatedFeed.start);
        if (0 > updatedFeedDuration) {
            updatedFeedDuration = 0;
        }
        updatedFeed = {
            ...updatedFeed,
            duration: updatedFeedDuration,
        };
    }
</script>

<li
    class="block max-w-2xl m-auto p-2 my-2 bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700"
>
    <div class="flex justify-between items-center gap-2">
        {#if isEditing}
            <form
                class="flex flex-wrap gap-4 gap-y-0 items-center"
                on:submit={handleFormSubmit}
            >
                <div>
                    <label
                        for="start"
                        class="block text-sm font-medium text-gray-900 dark:text-white"
                        >Start</label
                    >
                    <input
                        type="datetime-local"
                        name="start"
                        class="my-2 p-2.5 bg-gray-500 rounded-lg w-48"
                        bind:value={updatedFeedBoundStart}
                        on:change={handleUpdateFeedChange}
                    />
                </div>

                <div>
                    <label
                        for="end"
                        class="block text-sm font-medium text-gray-900 dark:text-white"
                        >End</label
                    >
                    <input
                        type="datetime-local"
                        name="end"
                        class="my-2 p-2.5 bg-gray-500 rounded-lg w-48"
                        bind:value={updatedFeedBoundEnd}
                        on:change={handleUpdateFeedChange}
                    />
                </div>

                <div>
                    <label
                        for="duration"
                        class="block text-sm font-medium text-gray-900 dark:text-white"
                        >Duration (s)</label
                    >
                    <input
                        type="number"
                        class="my-2 p-2.5 bg-gray-700 rounded-lg w-24"
                        bind:value={updatedFeedDuration}
                        disabled
                    />
                </div>

                <div>
                    <label
                        for="bottleSize"
                        class="block text-sm font-medium text-gray-900 dark:text-white"
                        >Bottle Size (ml)</label
                    >
                    <input
                        type="text"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        class="my-2 p-2.5 bg-gray-500 rounded-lg w-24"
                        bind:value={updatedFeed.bottleSize}
                        on:change={handleUpdateFeedChange}
                    />
                </div>

                <div>
                    <label
                        for="remainingMilk"
                        class="block text-sm font-medium text-gray-900 dark:text-white"
                        >Remaining Milk (ml)</label
                    >
                    <input
                        type="text"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        class="my-2 p-2.5 bg-gray-500 rounded-lg w-28"
                        bind:value={updatedFeed.remainingMilk}
                        on:change={handleUpdateFeedChange}
                    />
                </div>

                <button
                    class="bg-emerald-500 p-2 rounded-lg mt-4"
                    type="submit"
                >
                    Save
                </button>
            </form>
        {:else}
            <span>
                {format(feed.start, { date: "short" })}
            </span>
            <span>
                {format(feed.start, { time: "short" })} - {format(feed.end, {
                    time: "short",
                })}
            </span>
            <span>
                {#if feed.duration <= 60}
                    {feed.duration} seconds
                {:else}
                    {feed.duration / 60} minutes
                {/if}
            </span>
            <span>
                {#if feed.remainingMilk === 0}
                    {feed.bottleSize}
                {:else}
                    {feed.bottleSize - feed.remainingMilk}
                {/if}
                ml
            </span>
        {/if}
        <div class="flex gap-2">
            <button
                on:click={() => {
                    isEditing = !isEditing;
                }}
                class="bg-blue-400 p-1 rounded-md h-8"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
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
            </button>
            <button
                on:click={() => dispatch("deletefeed", feed)}
                class="bg-red-400 p-1 rounded-md h-8"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
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
