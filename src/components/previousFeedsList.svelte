<script lang="ts">
    import { onMount, createEventDispatcher } from "svelte";
    import localforage from "localforage";
    import PreviousFeed from "./previousFeed.svelte";
    import type { FeedLog } from "../lib/types";
    import {
        totalMilk,
        totalDuration,
        feedsOnDate,
        timeSinceLastFeed,
        formatTimeSince,
        timeUntilNextFeed,
        formatTimeUntil,
        mlPerMinute,
    } from "../lib/feed";
    import {
        activeFeeds,
        tombstoneFeed,
        undoFeedDeletions,
        stampFeed,
    } from "../lib/sync";
    import { dailyGoalMl, progressPercent } from "../lib/dailyGoal";
    import { groupFeedsByDay } from "../lib/history";
    import { pushToast } from "../lib/toast";

    import "../app.css";

    const dispatch = createEventDispatcher();

    export let previousFeeds: FeedLog[] = [];

    let sortOrder: "oldest" | "newest" = "oldest";
    let groupByDay = true;
    let now = new Date();

    $: active = activeFeeds(previousFeeds);
    $: todayFeeds = feedsOnDate(active, now);
    $: sinceLastFeed = timeSinceLastFeed(active, now.getTime());
    $: nextFeedDueSeconds = timeUntilNextFeed(active, now.getTime());
    $: todayMilk = totalMilk(todayFeeds, $mlPerMinute);
    $: todayGoalPercent = progressPercent(todayMilk, $dailyGoalMl);
    $: displayedFeeds = sortOrder === "newest" ? [...active].reverse() : active;
    $: dayGroups = groupFeedsByDay(displayedFeeds, now);
    // when sortOrder is oldest, groups should be oldest first
    $: orderedGroups =
        sortOrder === "oldest" ? [...dayGroups].reverse() : dayGroups;

    function toggleSortOrder() {
        sortOrder = sortOrder === "oldest" ? "newest" : "oldest";
        localforage.setItem("feedSortOrder", sortOrder).catch(function (err) {
            console.error(err);
        });
    }

    function toggleGroupByDay() {
        groupByDay = !groupByDay;
        localforage.setItem("groupByDay", groupByDay).catch(() => {});
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

        localforage
            .getItem("groupByDay")
            .then((v) => {
                if (typeof v === "boolean") groupByDay = v;
            })
            .catch(() => {});

        const interval = setInterval(() => {
            now = new Date();
        }, 30000);

        return () => clearInterval(interval);
    });

    function deleteFeeds(originals: FeedLog[]) {
        const deleted = originals.map((feed) => tombstoneFeed(feed));
        const byId = new Map(deleted.map((feed) => [feed.feedId, feed]));
        dispatch(
            "updatepreviousfeeds",
            previousFeeds.map((feed) => byId.get(feed.feedId) ?? feed),
        );
        pushToast(
            originals.length === 1
                ? "Feed deleted"
                : `Deleted ${originals.length} feeds`,
            {
                actionLabel: "Undo",
                onAction: () =>
                    dispatch(
                        "updatepreviousfeeds",
                        undoFeedDeletions(previousFeeds, originals, deleted),
                    ),
                durationMs: 6000,
            },
        );
    }

    function deletePreviousFeed(event: CustomEvent<FeedLog>) {
        deleteFeeds(
            active.filter((feed) => feed.feedId === event.detail.feedId),
        );
    }

    function deleteFeedHistory() {
        if (
            !active.length ||
            !window.confirm(
                "Delete all previous feeds? You can undo for a few seconds.",
            )
        )
            return;
        deleteFeeds(active);
    }

    function updateFeed(event: any) {
        const newPreviousFeeds = previousFeeds.map((f) => {
            if (f.feedId === event.detail.feedId) {
                return stampFeed({ ...event.detail, updatedAt: f.updatedAt });
            }
            return f;
        });
        dispatch("updatepreviousfeeds", newPreviousFeeds);
    }
</script>

<div
    class="max-w-xl text-gray-500 list-disc list-inside dark:text-gray-400 m-auto"
>
    {#if active.length === 0}
        <div
            class="text-center py-8 px-4 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 mt-4"
        >
            <p class="text-2xl mb-2">🍼</p>
            <p class="text-gray-900 dark:text-white font-medium">
                No feeds yet
            </p>
            <p class="text-sm mt-1">
                Start the timer above or add a past feed manually.
            </p>
            <button
                on:click={() => dispatch("requestquickadd")}
                class="mt-3 text-sm font-medium text-cyan-700 dark:text-cyan-300 hover:underline"
                >Add a past feed</button
            >
            <p class="text-xs mt-2 text-gray-400">
                Your feeds stay on this device and can be synced with your
                partner.
            </p>
        </div>
    {:else}
        <div
            class="flex flex-wrap justify-between items-center gap-2 mb-2 mt-2"
        >
            <div class="flex gap-2">
                <button
                    on:click={toggleSortOrder}
                    class="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >Sort: {sortOrder === "oldest"
                        ? "Oldest first"
                        : "Newest first"}</button
                >
                <button
                    on:click={toggleGroupByDay}
                    class="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >{groupByDay ? "Grouped by day" : "Flat list"}</button
                >
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400"
                >{active.length} feeds</span
            >
        </div>
        <div
            class="w-full dark:bg-gray-800 bg-white rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
            <div
                class="flex gap-4 justify-between text-sm text-gray-700 dark:text-gray-300"
            >
                <p>
                    Total feeds: {active.length}
                </p>
                <p>
                    Total milk: {totalMilk(active, $mlPerMinute)}ml
                </p>
                <p>
                    Total time:
                    {#if totalDuration(active) > 60}
                        {Math.floor(totalDuration(active) / 60)} mins
                    {:else}
                        {totalDuration(active)} secs
                    {/if}
                </p>
            </div>
            <div
                class="flex gap-4 justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
            >
                <p>
                    Today: {todayFeeds.length} feed{todayFeeds.length === 1
                        ? ""
                        : "s"}
                </p>
                <p>
                    Today's milk: {todayMilk} / {$dailyGoalMl}ml
                </p>
                <p>
                    Last feed: {sinceLastFeed === undefined
                        ? "—"
                        : formatTimeSince(sinceLastFeed)}
                </p>
            </div>
            <div class="mt-2">
                <div
                    class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700 overflow-hidden"
                >
                    <div
                        class="h-2 rounded-full transition-all {todayGoalPercent >=
                        100
                            ? 'bg-emerald-500'
                            : 'bg-cyan-600'}"
                        style="width: {todayGoalPercent}%"
                    ></div>
                </div>
            </div>
            <div
                class="flex gap-4 justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
            >
                <p>
                    Next feed: {nextFeedDueSeconds === undefined
                        ? "—"
                        : formatTimeUntil(nextFeedDueSeconds)}
                </p>
            </div>
        </div>
        {#if groupByDay}
            {#each orderedGroups as group (group.key)}
                <div class="mt-4">
                    <details open class="group">
                        <summary
                            class="flex cursor-pointer items-baseline justify-between px-1 mb-1"
                        >
                            <span
                                aria-hidden="true"
                                class="group-open:rotate-90">▶</span
                            >
                            <span
                                class="text-sm font-semibold text-gray-900 dark:text-white"
                                >{group.label}
                                <span
                                    class="font-normal text-gray-500 dark:text-gray-400"
                                    >— {group.feeds.length} feed{group.feeds
                                        .length === 1
                                        ? ""
                                        : "s"}</span
                                ></span
                            >
                            <span
                                class="text-xs text-gray-500 dark:text-gray-400"
                                >{totalMilk(group.feeds, $mlPerMinute)} ml • {Math.floor(
                                    totalDuration(group.feeds) / 60,
                                )}m</span
                            >
                        </summary>
                        <ul>
                            {#each group.feeds as feed (feed.feedId)}
                                <PreviousFeed
                                    {feed}
                                    on:deletefeed={deletePreviousFeed}
                                    on:updatefeed={updateFeed}
                                />
                            {/each}
                        </ul>
                    </details>
                </div>
            {/each}
        {:else}
            <ul>
                {#each displayedFeeds as feed (feed.feedId)}
                    <PreviousFeed
                        {feed}
                        on:deletefeed={deletePreviousFeed}
                        on:updatefeed={updateFeed}
                    />
                {/each}
            </ul>
        {/if}
    {/if}

    <button
        disabled={active.length === 0}
        class="main-button bg-red-600 mt-4 hover:bg-red-700 disabled:opacity-50"
        on:click={deleteFeedHistory}
    >
        Delete all previous feeds
    </button>
</div>
