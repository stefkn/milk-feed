<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher, tick } from "svelte";
    import localforage from "localforage";
    import { browser } from "$app/environment";
    import { format } from "@formkit/tempo";
    import type { FeedLog } from "$lib/types";
    import {
        feedElapsedMs,
        feedElapsedSeconds,
        generateFeedId,
        timeUntilNextFeed,
        formatTimeUntil,
        totalMilk,
        feedsOnDate,
        mlPerMinute,
    } from "$lib/feed";
    import { nextFeedDueMs, DEFAULT_REMINDER_SETTINGS } from "$lib/reminders";
    import {
        dailyGoalMl,
        DEFAULT_DAILY_GOAL_ML,
        clampDailyGoal,
        progressPercent,
        remainingToGoal,
    } from "$lib/dailyGoal";

    import { createScreenWakeLock, type ScreenLockAPI } from "$lib/wakeLock";

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

    let reminderSettings = { ...DEFAULT_REMINDER_SETTINGS };
    let reminderTimeout: number | undefined;
    let showReminderConfig = false;
    let reminderNotice = "";

    const BOTTLE_PRESETS = [120, 150, 180, 210];

    let screenAwake = false;
    let destroyed = false;
    const screenLock = createScreenWakeLock(
        browser
            ? (navigator as Navigator & { wakeLock?: ScreenLockAPI }).wakeLock
            : undefined,
        () =>
            browser &&
            !destroyed &&
            isFeeding &&
            !isPaused &&
            document.visibilityState === "visible",
        (held) => {
            screenAwake = held;
        },
    );
    let originalTitle = browser ? document.title : "MilkFeed";
    let dailyGoal = DEFAULT_DAILY_GOAL_ML;
    let showGoalEdit = false;

    $: remainingPercent =
        bottleSize > 0
            ? Math.min(
                  100,
                  Math.max(0, Math.round((remainingMilk / bottleSize) * 100)),
              )
            : 0;

    $: nextFeedDueSeconds = timeUntilNextFeed(previousFeeds, now);
    $: todayFeedsForGoal = feedsOnDate(previousFeeds, new Date(now));
    $: todayMilk = totalMilk(todayFeedsForGoal, $mlPerMinute);
    $: goalPercent = progressPercent(todayMilk, $dailyGoalMl);
    $: goalRemaining = remainingToGoal(todayMilk, $dailyGoalMl);

    $: previousFeeds, reminderSettings, scheduleReminder();

    function toggleSticky() {
        isSticky = !isSticky;
        localforage.setItem("timerSticky", isSticky).catch(console.error);
    }

    const dispatch = createEventDispatcher();

    function handleVisibilityChange() {
        if (document.visibilityState === "visible") {
            void screenLock.request();
            syncTitle();
        } else {
            void screenLock.release();
        }
    }

    function syncTitle() {
        if (!browser) return;
        if (isFeeding) {
            const mm = Math.floor(feedDurationSeconds / 60)
                .toString()
                .padStart(2, "0");
            const ss = (feedDurationSeconds % 60).toString().padStart(2, "0");
            document.title = `${mm}:${ss} • ${isPaused ? "Paused" : "Feeding"} — MilkFeed`;
        } else {
            document.title = originalTitle || "MilkFeed";
        }
    }

    function updateFeedDuration() {
        const nowMs = Date.now();
        const elapsedMs = feedElapsedMs(nowMs, feedStartTime, pausedDurationMs);
        feedDurationSeconds = feedElapsedSeconds(
            nowMs,
            feedStartTime,
            pausedDurationMs,
        );
        currentFeed.end = new Date(feedStartTime + elapsedMs);
        syncTitle();
    }

    function updateCurrentTime() {
        now = Date.now();
        currentTime = format(new Date(), {
            date: "short",
            time: "short",
        });
    }

    function _setStopWatchInterval() {
        stopwatchInterval = window.setInterval(updateFeedDuration, 1000);
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
        void screenLock.request();
        syncTitle();
        try {
            navigator.vibrate?.(50);
        } catch {}
    }

    function stopFeedingTimer() {
        window.clearInterval(stopwatchInterval);
        if (isPaused && pauseStartedAt !== undefined) {
            pausedDurationMs += Date.now() - pauseStartedAt;
            pauseStartedAt = undefined;
        }
        isFeeding = false;
        isPaused = false;

        clearActiveFeed();
        void screenLock.release();
        syncTitle();
        try {
            navigator.vibrate?.([40, 30, 40]);
        } catch {}

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
        syncTitle();

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
            void screenLock.request();
        } else {
            isPaused = true;
            void screenLock.release();
            window.clearInterval(stopwatchInterval);
            pauseStartedAt = Date.now();
            updateFeedDuration();
        }
        persistActiveFeed();
        syncTitle();
        try {
            navigator.vibrate?.(30);
        } catch {}
    }

    /**
     * @param {number} bottleSize
     */
    function updateSavedBottleSize(size: number) {
        bottleSize = Math.max(0, Number(size) || 0);
        remainingMilk = Math.min(
            bottleSize,
            Math.max(0, Number(remainingMilk) || 0),
        );
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
        if (isFeeding) persistActiveFeed();
    }

    async function handleRemainingNumberInput() {
        await tick();
        remainingMilk = Math.min(
            bottleSize,
            Math.max(0, Number(remainingMilk) || 0),
        );
        if (isFeeding) persistActiveFeed();
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
            void screenLock.request();
        }
        syncTitle();
    }

    function persistReminderSettings() {
        localforage
            .setItem("reminderSettings", reminderSettings)
            .catch(function (err) {
                console.error(err);
            });
    }

    function persistDailyGoal() {
        localforage.setItem("dailyGoalMl", dailyGoal).catch(function (err) {
            console.error(err);
        });
        dailyGoalMl.set(dailyGoal);
    }

    function handleDailyGoalInput() {
        dailyGoal = clampDailyGoal(dailyGoal);
        persistDailyGoal();
    }

    function showReminderNotification() {
        if (!browser || !("Notification" in window)) {
            return;
        }
        if (Notification.permission !== "granted") {
            return;
        }
        const notification = new Notification("MilkFeed", {
            body: "Time for the next feed",
        });
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }

    function scheduleReminder() {
        if (!browser) {
            return;
        }
        if (reminderTimeout !== undefined) {
            window.clearTimeout(reminderTimeout);
            reminderTimeout = undefined;
        }
        if (!reminderSettings.enabled) {
            return;
        }
        const dueMs = nextFeedDueMs(previousFeeds, reminderSettings);
        if (dueMs === undefined) {
            return;
        }
        const delay = Math.max(0, dueMs - Date.now());
        reminderTimeout = window.setTimeout(showReminderNotification, delay);
    }

    async function handleReminderToggle(event: Event) {
        const enabled = (event.target as HTMLInputElement).checked;
        reminderNotice = "";
        if (enabled) {
            if (!("Notification" in window)) {
                reminderNotice =
                    "Notifications aren't supported in this browser.";
                return;
            }
            if (Notification.permission === "denied") {
                reminderNotice =
                    "Notification permission was denied. Enable it in your browser settings.";
                return;
            }
            if (Notification.permission !== "granted") {
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                    reminderNotice = "Notification permission was not granted.";
                    return;
                }
            }
        }
        reminderSettings = { ...reminderSettings, enabled };
        persistReminderSettings();
        scheduleReminder();
    }

    function handleSettingsChange() {
        reminderSettings = { ...reminderSettings };
        persistReminderSettings();
        scheduleReminder();
    }

    onMount(() => {
        if (browser) originalTitle = document.title;
        updateCurrentTime();
        clockInterval = window.setInterval(updateCurrentTime, 1000);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        localforage
            .getItem<boolean>("timerSticky")
            .then((value) => {
                if (!destroyed && typeof value === "boolean") isSticky = value;
            })
            .catch(console.error);

        localforage
            .getItem("bottleSize")
            .then((value: any) => {
                const parsed = Number(value);
                if (!destroyed && !isFeeding)
                    bottleSize = Math.max(
                        0,
                        Number.isFinite(parsed) ? parsed : 0,
                    );
            })
            .catch(function (err) {
                console.error(err);
            });

        localforage
            .getItem("activeFeed")
            .then((value: any) => {
                if (!destroyed && !isFeeding) restoreActiveFeed(value);
            })
            .catch(function (err) {
                console.error(err);
            });

        localforage
            .getItem("reminderSettings")
            .then((value: any) => {
                if (value && typeof value.enabled === "boolean") {
                    reminderSettings = {
                        enabled: value.enabled,
                        mode: value.mode === "fixed" ? "fixed" : "auto",
                        fixedIntervalHours: Number.isFinite(
                            Number(value.fixedIntervalHours),
                        )
                            ? Number(value.fixedIntervalHours)
                            : DEFAULT_REMINDER_SETTINGS.fixedIntervalHours,
                    };
                }
            })
            .catch(function (err) {
                console.error(err);
            });

        localforage
            .getItem("dailyGoalMl")
            .then((value: any) => {
                const n = Number(value);
                if (Number.isFinite(n) && n > 0) {
                    dailyGoal = clampDailyGoal(n);
                    dailyGoalMl.set(dailyGoal);
                }
            })
            .catch(function (err) {
                console.error(err);
            });

        const unsub = dailyGoalMl.subscribe((v) => {
            dailyGoal = v;
        });

        return () => {
            unsub();
        };
    });

    onDestroy(() => {
        clearInterval(stopwatchInterval);
        clearInterval(clockInterval);
        if (reminderTimeout !== undefined) {
            clearTimeout(reminderTimeout);
        }
        destroyed = true;
        if (browser)
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
        void screenLock.release();
        if (browser) document.title = originalTitle;
    });
</script>

<div
    class={`block top-4 max-w-sm mt-2 m-auto p-6 bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700 ${
        isSticky ? "sticky" : ""
    }`}
>
    <div class="flex justify-between items-start">
        <div>
            <h3 class="text-sm text-gray-500 dark:text-gray-400">Now</h3>
            <p class="font-medium text-gray-900 dark:text-white">
                {currentTime}
            </p>
            <p class="text-sm mt-1">
                Next feed: {nextFeedDueSeconds === undefined
                    ? "—"
                    : formatTimeUntil(nextFeedDueSeconds)}
            </p>
        </div>
        <button
            class="bg-cyan-600 text-white p-1.5 rounded-full text-xs shrink-0"
            on:click={toggleSticky}
            aria-label={isSticky ? "Unpin timer" : "Pin timer"}
            title={isSticky ? "Unpin" : "Pin to top"}
        >
            {#if isSticky}
                📌 Pinned
            {:else}
                📍 Pin
            {/if}
        </button>
    </div>

    <!-- Daily goal progress -->
    <div class="mt-3">
        <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300"
                >Today: {todayMilk} / {$dailyGoalMl} ml</span
            >
            <button
                class="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                on:click={() => (showGoalEdit = !showGoalEdit)}
                >{showGoalEdit ? "Done" : "Edit goal"}</button
            >
        </div>
        <div
            class="w-full bg-gray-200 rounded-full h-2.5 mt-1 dark:bg-gray-700 overflow-hidden"
        >
            <div
                class="h-2.5 rounded-full transition-all duration-500 {goalPercent >=
                100
                    ? 'bg-emerald-500'
                    : 'bg-cyan-600'}"
                style="width: {goalPercent}%"
            ></div>
        </div>
        <p
            class="text-xs mt-1 {goalPercent >= 100
                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                : 'text-gray-500 dark:text-gray-400'}"
        >
            {#if goalPercent >= 100}
                ✓ Daily goal reached!
            {:else}
                {goalRemaining} ml to goal • {goalPercent}%
            {/if}
        </p>
        {#if showGoalEdit}
            <div class="flex items-center gap-2 mt-2">
                <input
                    type="number"
                    aria-label="Daily milk goal in ml"
                    min="50"
                    max="3000"
                    step="1"
                    bind:value={dailyGoal}
                    on:change={handleDailyGoalInput}
                    class="w-24 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <span class="text-sm text-gray-600 dark:text-gray-300"
                    >ml / day</span
                >
            </div>
        {/if}
    </div>

    <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <label class="flex items-center gap-2 text-sm">
            <input
                type="checkbox"
                checked={reminderSettings.enabled}
                on:change={handleReminderToggle}
            />
            Remind me when the next feed is due
        </label>
        {#if reminderNotice}
            <p class="mt-2 text-xs text-amber-700 dark:text-amber-400">
                {reminderNotice}
            </p>
        {/if}
        {#if reminderSettings.enabled}
            <button
                type="button"
                on:click={() => (showReminderConfig = !showReminderConfig)}
                class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-purple-700 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                aria-expanded={showReminderConfig}
            >
                {showReminderConfig ? "Hide" : "Show"} reminder settings
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
                    class:rotate-180={showReminderConfig}
                    ><polyline points="6 9 12 15 18 9"></polyline></svg
                >
            </button>
            {#if showReminderConfig}
                <div class="flex flex-wrap items-center gap-2 mt-2">
                    <select
                        bind:value={reminderSettings.mode}
                        on:change={handleSettingsChange}
                        class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="auto">Auto (from schedule)</option>
                        <option value="fixed">Fixed interval</option>
                    </select>
                    {#if reminderSettings.mode === "fixed"}
                        <input
                            type="number"
                            min="1"
                            step="0.5"
                            bind:value={reminderSettings.fixedIntervalHours}
                            on:change={handleSettingsChange}
                            class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 w-20 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        <span
                            class="text-sm font-medium text-gray-900 dark:text-white"
                            >hours</span
                        >
                    {/if}
                </div>
            {/if}
        {/if}
    </div>
    <div class="flex items-center space-between my-2">
        {#if isFeeding && !isPaused}
            <div role="status" class="mr-4">
                <svg
                    aria-hidden="true"
                    class="w-8 h-8 text-gray-200 motion-safe:animate-spin dark:text-gray-600 fill-blue-600"
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
        {#if screenAwake}
            <span
                class="ml-auto text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                >Screen awake</span
            >
        {/if}
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
                    on:change={() => updateSavedBottleSize(bottleSize)}
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
                    on:input={handleRemainingNumberInput}
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
                {#if remainingMilk > bottleSize}
                    <p class="text-xs text-red-600 dark:text-red-400 mt-1">
                        Cannot exceed bottle size
                    </p>
                {/if}
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
