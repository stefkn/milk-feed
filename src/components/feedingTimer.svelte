<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from "svelte";
    import localforage from "localforage";
    import { format, addSecond, diffSeconds } from "@formkit/tempo";
    import type { FeedLog } from "$lib/types";

    let currentTime = format(new Date(), {
        date: "short",
        time: "short",
    });

    /**
     * @type {number | undefined}
     */
    let stopwatchInterval: number | undefined;

    let currentFeed = {
        start: new Date(),
        end: new Date(),
    };

    let isFeeding = false;
    let isPaused = false;
    let bottleSize = 0;
    let remainingMilk = 0;
    let feedDurationSeconds = diffSeconds(currentFeed.end, currentFeed.start);

    const dispatch = createEventDispatcher();

    function _setStopWatchInterval() {
        stopwatchInterval = setInterval(() => {
            currentFeed.end = addSecond(currentFeed.end);
            feedDurationSeconds = diffSeconds(
                currentFeed.end,
                currentFeed.start,
            );
        }, 1000);
    }

    function startFeedingTimer() {
        isFeeding = true;
        isPaused = false;
        currentFeed = {
            start: new Date(),
            end: new Date(),
        };
        _setStopWatchInterval();
    }

    function stopFeedingTimer() {
        clearInterval(stopwatchInterval);
        isFeeding = false;
        isPaused = false;

        if (feedDurationSeconds === 0) {
            return;
        }

        const newFinishedFeed: FeedLog = {
            feedId: new Date().getTime().toString(),
            start: currentFeed.start,
            end: currentFeed.end,
            duration: feedDurationSeconds,
            remainingMilk: remainingMilk,
            bottleSize: bottleSize,
            type: "bottle",
        };

        dispatch("newfeedfinished", newFinishedFeed);

        currentFeed = {
            start: new Date(),
            end: new Date(),
        };
        feedDurationSeconds = 0;
    }

    function togglePauseFeedingTimer() {
        if (isPaused) {
            isPaused = false;
            _setStopWatchInterval();
        } else {
            isPaused = true;
            clearInterval(stopwatchInterval);
        }
    }

    /**
     * @param {number} bottleSize
     */
    function updateSavedBottleSize(bottleSize: number) {
        localforage.setItem("bottleSize", bottleSize).catch(function (err) {
            console.error(err);
        });
    }

    onMount(() => {
        localforage
            .getItem("bottleSize")
            .then((value: any) => {
                if (typeof Number.parseInt(value) !== "number") {
                    bottleSize = 0;
                    return;
                }
                bottleSize = value || 0;
            })
            .catch(function (err) {
                console.error(err);
            });
    });

    onDestroy(() => {
        stopFeedingTimer();
    });
</script>

<div
    class="block max-w-sm mt-2 m-auto p-6 bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700"
>
    <h3>Now: {currentTime}</h3>
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
    <div class="flex gap-4">
        <div>
            <label
                for="bottleSize"
                class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >Bottle Size (ml)</label
            >
            <input
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                bind:value={bottleSize}
                disabled={isFeeding}
                on:input={() => updateSavedBottleSize(bottleSize)}
                class="bg-gray-50 border border-gray-300 text-gray-900 text-md rounded-lg focus:ring-blue-600 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            />
        </div>
        <div>
            <label
                for="bottleSize"
                class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >Milk remaining (ml)</label
            >
            <input
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                bind:value={remainingMilk}
                class="bg-gray-50 border border-gray-300 text-gray-900 text-md rounded-lg focus:ring-blue-600 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            />
        </div>
    </div>
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
