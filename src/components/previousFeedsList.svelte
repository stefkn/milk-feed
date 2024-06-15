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
        <div class="w-full dark:bg-gray-800 rounded-lg p-4">
            <div class="flex gap-4 justify-between">
                <p>
                    Total feeds: {previousFeeds.length}
                </p>
                <p>
                    Total milk: {previousFeeds.reduce((acc, feed) => acc + Number(feed.remainingMilk ? feed.bottleSize - feed.remainingMilk : feed.bottleSize), 0)}ml
                </p>
                <p>
                    Total time: 
                    {#if previousFeeds.reduce((acc, feed) => acc + feed.duration, 0) > 60 }
                        {Math.floor(previousFeeds.reduce((acc, feed) => acc + feed.duration, 0) / 60)} mins
                    {:else}
                        {previousFeeds.reduce((acc, feed) => acc + feed.duration, 0)} secs
                    {/if}
                </p>
            </div>
        </div>
        {#each previousFeeds as feed}
            <PreviousFeed {feed} on:deletefeed={deletePreviousFeed} on:updatefeed={updateFeed} />
        {/each}
    {/if}

    <button class="main-button bg-red-600 mt-4" on:click={deleteFeedHistory}>
        Delete all previous feeds
    </button>
</ul>
