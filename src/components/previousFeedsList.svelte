<script lang="ts">
    import PreviousFeed from "./previousFeed.svelte";
    import { createEventDispatcher } from 'svelte';
    import type { FeedLog } from '../lib/types';

    import "../app.css";
    
	const dispatch = createEventDispatcher();

    export let previousFeeds: FeedLog[] = [];

    function deletePreviousFeed(event: any) {
        const newPreviousFeeds = previousFeeds.filter((f) => f !== event.detail);
        dispatch('updatepreviousfeeds', newPreviousFeeds);
    }

    function deleteFeedHistory() {
        const newPreviousFeeds: FeedLog[] = [];
        dispatch('updatepreviousfeeds', newPreviousFeeds);
    }

    function updateFeed(event: any) {
        const newPreviousFeeds = previousFeeds.map((f) => {
            if (f.feedId === event.detail.feedId) {
                return event.detail;
            }
            return f;
        });
        dispatch('updatepreviousfeeds', newPreviousFeeds);
    }
</script>

<ul
    class="max-w-xl text-gray-500 list-disc list-inside dark:text-gray-400 m-auto"
>
    {#if previousFeeds.length === 0}
        <p class="text-left">No previous feeds.</p>
    {:else}    
        {#each previousFeeds as feed}
            <PreviousFeed {feed} on:deletefeed={deletePreviousFeed} on:updatefeed={updateFeed} />
        {/each}
    {/if}

    <button class="main-button bg-red-600 mt-4" on:click={deleteFeedHistory}>
        Delete all previous feeds
    </button>
</ul>
