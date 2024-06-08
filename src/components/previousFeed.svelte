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
    let updatedFeedBoundStart = format(updatedFeed.start, "YYYY-MM-DDThh:mm", "en");
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
    <div class="flex justify-between items-centre gap-2">
        <span>
            🍼 {format(feed.start, { date: "short" })}
        </span>
        <span>
            {format(feed.start, { time: "short" })} - {format(feed.end, {
                time: "short",
            })}
        </span>
        <span>
            {feed.duration} seconds
        </span>
        <span>
            {#if feed.remainingMilk === 0}
                {feed.bottleSize}
            {:else}
                {feed.bottleSize - feed.remainingMilk}
            {/if}
            ml
        </span>
        <button
            on:click={() => dispatch("deletefeed", feed)}
            class="bg-red-500 p-1 rounded-md"
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
</li>
