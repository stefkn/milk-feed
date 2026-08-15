<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import localforage from "localforage";
    import PreviousFeed from "./previousFeed.svelte";
    import type { FeedLog } from '../lib/types';
    import { totalMilk, totalDuration, feedsOnDate, timeSinceLastFeed, formatTimeSince } from "../lib/feed";

    import "../app.css";
    
	const dispatch = createEventDispatcher();

    export let previousFeeds: FeedLog[] = [];

    let sortOrder: "oldest" | "newest" = "oldest";

    $: todayFeeds = feedsOnDate(previousFeeds, new Date());
    $: sinceLastFeed = timeSinceLastFeed(previousFeeds);
    $: displayedFeeds =
        sortOrder === "newest" ? [...previousFeeds].reverse() : previousFeeds;

    function toggleSortOrder() {
        sortOrder = sortOrder === "oldest" ? "newest" : "oldest";
        localforage
            .setItem("feedSortOrder", sortOrder)
            .catch(function (err) {
                console.error(err);
            });
    }

    onMount(() => {
        localforage
            .getItem("feedSortOrder")
            .then((value) => {
                if (value === "newest" || value === "oldest") {
                    sortOrder = value;
                }
            })
            .catch(function (err) {
                console.error(err);
            });
    });

    function deletePreviousFeed(event: any) {
        const newPreviousFeeds = previousFeeds.filter((f) => f.feedId !== event.detail.feedId);
        dispatch('updatepreviousfeeds', newPreviousFeeds);
    }

    function deleteFeedHistory() {
        if (!window.confirm("Delete all previous feeds? This cannot be undone.")) {
            return;
        }
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
        <div class="flex justify-end mb-1">
            <button
                on:click={toggleSortOrder}
                class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >Sort: {sortOrder === "oldest" ? "Oldest first" : "Newest first"}</button
            >
        </div>
        <div class="w-full dark:bg-gray-800 rounded-lg p-4">
            <div class="flex gap-4 justify-between">
                <p>
                    Total feeds: {previousFeeds.length}
                </p>
                <p>
                    Total milk: {totalMilk(previousFeeds)}ml
                </p>
                <p>
                    Total time: 
                    {#if totalDuration(previousFeeds) > 60 }
                        {Math.floor(totalDuration(previousFeeds) / 60)} mins
                    {:else}
                        {totalDuration(previousFeeds)} secs
                    {/if}
                </p>
            </div>
            <div class="flex gap-4 justify-between mt-2 pt-2 border-t border-gray-300 dark:border-gray-700">
                <p>
                    Today: {todayFeeds.length} feed{todayFeeds.length === 1 ? "" : "s"}
                </p>
                <p>
                    Today's milk: {totalMilk(todayFeeds)}ml
                </p>
                <p>
                    Last feed: {sinceLastFeed === undefined
                        ? "—"
                        : formatTimeSince(sinceLastFeed)}
                </p>
            </div>
        </div>
        {#each displayedFeeds as feed}
            <PreviousFeed {feed} on:deletefeed={deletePreviousFeed} on:updatefeed={updateFeed} />
        {/each}
    {/if}

    <button class="main-button bg-red-600 mt-4" on:click={deleteFeedHistory}>
        Delete all previous feeds
    </button>
</ul>
