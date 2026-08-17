<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from "svelte";
    import localforage from "localforage";
    import { format } from "@formkit/tempo";
    import type { FeedLog } from "$lib/types";
    import { feedElapsedMs, feedElapsedSeconds, generateFeedId, timeUntilNextFeed, formatTimeUntil } from "$lib/feed";

    export let previousFeeds: FeedLog[] = [];

    let currentTime = format(new Date(), {
        date: "short",
        time: "short",
    });

    let now = Date.now();

    /**
     * @type {number | undefined}
     */
    let stopwatchInterval: number | undefined;
    let clockInterval: number | undefined;

    let feedStartTime = Date.now();
    let pausedDurationMs = 0;
    let pauseStartedAt: number | undefined;

    let currentFeed = {
        start: new Date(),
        end: new Date(),
    };

    let isSticky = true;
    let isFeeding = false;
    let isPaused = false;
    let bottleSize = 0;
    let remainingMilk = 0;
    let feedType = "bottle";
    let feedDurationSeconds = 0;

    const BOTTLE_PRESETS = [120, 150, 180, 210];

    $: remainingPercent =
        bottleSize > 0
            ? Math.min(
                  100,
                  Math.max(0, Math.round((remainingMilk / bottleSize) * 100)),
              )
            : 0;

    $: nextFeedDueSeconds = timeUntilNextFeed(previousFeeds, now);

    function toggleSticky() {
        isSticky = !isSticky;
    }

    const dispatch = createEventDispatcher();

    function updateFeedDuration() {
        const nowMs = Date.now();
        const elapsedMs = feedElapsedMs(nowMs, feedStartTime, pausedDurationMs);
        feedDurationSeconds = feedElapsedSeconds(
            nowMs,
            feedStartTime,
            pausedDurationMs,
        );
        currentFeed.end = new Date(feedStartTime + elapsedMs);
    }

    function updateCurrentTime() {
        now = Date.now();
        currentTime = format(new Date(), {
            date: "short",
            time: "short",
        });
    }

    function _setStopWatchInterval() {
        stopwatchInterval = setInterval(updateFeedDuration, 1000);
    }

    function startFeedingTimer() {
        isFeeding = true;
        isPaused = false;
        feedStartTime = Date.now();
        pausedDurationMs = 0;
        pauseStartedAt = undefined;
        currentFeed = {
            start: new Date(feedStartTime),
            end: new Date(feedStartTime),
        };
        feedDurationSeconds = 0;
        _setStopWatchInterval();
        persistActiveFeed();
    }

    function stopFeedingTimer() {
        clearInterval(stopwatchInterval);
        if (isPaused && pauseStartedAt !== undefined) {
            pausedDurationMs += Date.now() - pauseStartedAt;
            pauseStartedAt = undefined;
        }
        isFeeding = false;
        isPaused = false;

        clearActiveFeed();

        updateFeedDuration();

        if (feedDurationSeconds === 0) {
            return;
        }

        const newFinishedFeed: FeedLog = {
            feedId: generateFeedId(),
            start: currentFeed.start,
            end: currentFeed.end,
            duration: feedDurationSeconds,
            remainingMilk: feedType === "breast" ? 0 : remainingMilk,
            bottleSize: feedType === "breast" ? 0 : bottleSize,
            type: feedType,
        };

        feedStartTime = Date.now();
        pausedDurationMs = 0;
        pauseStartedAt = undefined;
        currentFeed = {
            start: new Date(),
            end: new Date(),
        };
        feedDurationSeconds = 0;

        dispatch("newfeedfinished", newFinishedFeed);
    }

    function togglePauseFeedingTimer() {
        if (isPaused) {
            isPaused = false;
            if (pauseStartedAt !== undefined) {
                pausedDurationMs += Date.now() - pauseStartedAt;
            }
            pauseStartedAt = undefined;
            _setStopWatchInterval();
        } else {
            isPaused = true;
            clearInterval(stopwatchInterval);
            pauseStartedAt = Date.now();
            updateFeedDuration();
        }
        persistActiveFeed();
    }

    /**
     * @param {number} bottleSize
     */
    function updateSavedBottleSize(bottleSize: number) {
        localforage.setItem("bottleSize", bottleSize).catch(function (err) {
            console.error(err);
        });
    }

    function setBottleSize(size: number) {
        bottleSize = size;
        updateSavedBottleSize(size);
    }

    function handleRemainingSlider(event: Event) {
        const percent = Number((event.target as HTMLInputElement).value);
        remainingMilk = Math.round((bottleSize * percent) / 100);
    }

    function persistActiveFeed() {
        if (!isFeeding) {
            return;
        }
        localforage
            .setItem("activeFeed", {
                isPaused,
                feedStartTime,
                pausedDurationMs,
                pauseStartedAt,
                feedType,
                bottleSize,
                remainingMilk,
                feedDurationSeconds,
            })
            .catch(function (err) {
                console.error(err);
            });
    }

    function clearActiveFeed() {
        localforage.removeItem("activeFeed").catch(function (err) {
            console.error(err);
        });
    }

    function restoreActiveFeed(state: any) {
        if (!state || typeof state.isPaused !== "boolean") {
            return;
        }

        isFeeding = true;
        isPaused = state.isPaused;
        feedStartTime = Number(state.feedStartTime) || Date.now();
        pausedDurationMs = Number(state.pausedDurationMs) || 0;
        pauseStartedAt =
            state.pauseStartedAt !== undefined && state.pauseStartedAt !== null
                ? Number(state.pauseStartedAt)
                : undefined;
        feedType = state.feedType === "breast" ? "breast" : "bottle";
        bottleSize = Number(state.bottleSize) || 0;
        remainingMilk = Number(state.remainingMilk) || 0;
        feedDurationSeconds = Number(state.feedDurationSeconds) || 0;

        currentFeed = {
            start: new Date(feedStartTime),
            end: new Date(feedStartTime + feedDurationSeconds * 1000),
        };

        if (!isPaused) {
            updateFeedDuration();
            _setStopWatchInterval();
        }
    }

    onMount(() => {
        updateCurrentTime();
        clockInterval = setInterval(updateCurrentTime, 1000);

        localforage
            .getItem("bottleSize")
            .then((value: any) => {
                const parsed = Number(value);
                bottleSize = Number.isFinite(parsed) ? parsed : 0;
            })
            .catch(function (err) {
                console.error(err);
            });

        localforage
            .getItem("activeFeed")
            .then((value: any) => {
                restoreActiveFeed(value);
            })
            .catch(function (err) {
                console.error(err);
            });
    });

    onDestroy(() => {
        clearInterval(stopwatchInterval);
        clearInterval(clockInterval);
    });
</script>

<div
    class={`block top-4 max-w-sm mt-2 m-auto p-6 bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700 ${
        isSticky ? "sticky" : ""
    }`}
>
    <div>
        <button class="bg-cyan-600 p-2 mb-2 rounded-lg float-right" on:click={toggleSticky}>
            {isSticky ? "un-pin" : "pin to top"}
        </button>
    </div>
    <h3>Now: {currentTime}</h3>
    <p class="text-sm">
        Next feed: {nextFeedDueSeconds === undefined
            ? "—"
            : formatTimeUntil(nextFeedDueSeconds)}
    </p>
    <div class="flex items-center space-between my-2">
        {#if isFeeding && !isPaused}
            <div role="status" class="mr-4">
                <svg
                    aria-hidden="true"
                    class="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
                    viewBox="0 0 100 101"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                        fill="currentColor"
                    />
                    <path
                        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                        fill="currentFill"
                    />
                </svg>
                <span class="sr-only">Feeding...</span>
            </div>
        {/if}
        <h3 class="text-2xl my-2">
            This feed: {Math.floor(feedDurationSeconds / 60)
                .toString()
                .padStart(2, "0")}:{(feedDurationSeconds % 60)
                .toString()
                .padStart(2, "0")}
        </h3>
    </div>
    <div class="flex gap-2 my-2">
        <button
            type="button"
            disabled={isFeeding}
            on:click={() => (feedType = "bottle")}
            class="px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50 {feedType ===
            'bottle'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}"
            >Bottle</button
        >
        <button
            type="button"
            disabled={isFeeding}
            on:click={() => (feedType = "breast")}
            class="px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50 {feedType ===
            'breast'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}"
            >Breast</button
        >
    </div>
    {#if feedType === "bottle"}
        <div class="flex gap-4">
            <div class="flex-1">
                <label
                    for="bottleSize"
                    class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                    >Bottle Size (ml)</label
                >
                <input
                    type="number"
                    min="0"
                    bind:value={bottleSize}
                    disabled={isFeeding}
                    on:input={() => updateSavedBottleSize(bottleSize)}
                    class="bg-gray-50 border border-gray-300 text-gray-900 text-md rounded-lg focus:ring-blue-600 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                />
                <div class="flex flex-wrap gap-1 mt-2">
                    {#each BOTTLE_PRESETS as preset}
                        <button
                            type="button"
                            disabled={isFeeding}
                            on:click={() => setBottleSize(preset)}
                            class="px-2 py-1 rounded-full text-xs font-medium disabled:opacity-50 {bottleSize ===
                            preset
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}"
                            >{preset}ml</button
                        >
                    {/each}
                </div>
            </div>
            <div class="flex-1">
                <label
                    for="remainingMilk"
                    class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                    >Milk remaining (ml)</label
                >
                <input
                    type="number"
                    min="0"
                    max={bottleSize}
                    bind:value={remainingMilk}
                    on:input={() => isFeeding && persistActiveFeed()}
                    class="bg-gray-50 border border-gray-300 text-gray-900 text-md rounded-lg focus:ring-blue-600 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                />
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={remainingPercent}
                    disabled={bottleSize === 0}
                    on:input={handleRemainingSlider}
                    class="w-full mt-2"
                    aria-label="Milk remaining percentage"
                />
            </div>
        </div>
    {/if}
    <div class="flex justify-center gap-4">
        {#if !isFeeding}
            <button
                class="main-button bg-emerald-600 mt-4 hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 font-medium rounded-full text-sm px-5 py-2.5 text-center mb-2 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:focus:ring-emerald-700"
                on:click={startFeedingTimer}>Start Feeding</button
            >
        {/if}
        {#if isFeeding}
            {#if isPaused}
                <button
                    class="main-button bg-emerald-600 mt-4"
                    on:click={togglePauseFeedingTimer}>Continue</button
                >
            {/if}
            {#if !isPaused}
                <button
                    class="main-button bg-yellow-600 mt-4"
                    on:click={togglePauseFeedingTimer}>Pause</button
                >
            {/if}
            <button
                class="main-button bg-red-600 mt-4"
                on:click={stopFeedingTimer}>Stop</button
            >
        {/if}
    </div>
</div>
