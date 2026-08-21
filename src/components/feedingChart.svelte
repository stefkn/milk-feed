<script lang="ts">
    import { tick, onMount } from "svelte";
    import { get } from "svelte/store";
    import localforage from "localforage";
    import type { FeedLog } from "../lib/types";
    import { browser } from "$app/environment";
    import { format } from "@formkit/tempo";
    import Chart from "chart.js/auto";
    import { milkConsumed, mlPerMinute, DEFAULT_ML_PER_MINUTE, feedsSpanMultipleDays } from "../lib/feed";

    const CHART_FEEDING_TIME = "feeding_time";
    const CHART_FEEDING_SIZE = "bottle_size";
    const CHART_FEEDING_SPEED = "feeding_speed";
    let chartType = CHART_FEEDING_TIME;

    const ACTUAL_COLOR = "rgba(34, 197, 94, 0.85)";
    const ESTIMATED_BASE = "rgba(59, 130, 246, 0.3)";
    const ESTIMATED_LINE = "rgba(59, 130, 246, 0.9)";

    export let previousFeeds: FeedLog[] = [];
    let feedChart: Chart | undefined = undefined;
    let mlPerMinuteInput = DEFAULT_ML_PER_MINUTE;

    function createHatchPattern(): CanvasPattern | undefined {
        const size = 8;
        const patternCanvas = document.createElement("canvas");
        patternCanvas.width = size;
        patternCanvas.height = size;
        const ctx = patternCanvas.getContext("2d");
        if (!ctx) {
            return undefined;
        }
        ctx.fillStyle = ESTIMATED_BASE;
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = ESTIMATED_LINE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-size, size);
        ctx.lineTo(size * 2, -size);
        ctx.stroke();
        return ctx.createPattern(patternCanvas, "repeat") ?? undefined;
    }

    function saveMlPerMinute(rate: number) {
        localforage.setItem("mlPerMinute", rate).catch(function (err) {
            console.error(err);
        });
    }

    function handleMlPerMinuteInput() {
        const parsed = Number(mlPerMinuteInput);
        const rate = Number.isFinite(parsed) && parsed >= 0
            ? parsed
            : DEFAULT_ML_PER_MINUTE;
        mlPerMinuteInput = rate;
        mlPerMinute.set(rate);
        saveMlPerMinute(rate);
    }

    export async function updateFeedChart(previousFeeds: FeedLog[]) {
        if (!browser) {
            return;
        }

        await tick();

        if (feedChart instanceof Chart) {
            feedChart.destroy();
        }

        if (previousFeeds.length === 0) {
            return;
        }

        const canvas = document.getElementById(
            "myChart",
        ) as HTMLCanvasElement | null;

        if (!canvas) {
            return;
        }

        const spanMultipleDays = feedsSpanMultipleDays(previousFeeds);
        const previousFeedTimes = previousFeeds.map((feed) =>
            spanMultipleDays
                ? format(feed.start, { date: "short", time: "short" })
                : format(feed.start, { time: "short" }),
        );

        const rate = get(mlPerMinute);

        const scales = {
            y: {
                beginAtZero: true,
                grid: {
                    color: "gray",
                },
            },
            x: {
                grid: {
                    color: "gray",
                },
            },
        };

        if (chartType === CHART_FEEDING_SIZE) {
            const hatchPattern = createHatchPattern();
            const sizes = previousFeeds.map((feed) =>
                milkConsumed(feed, rate),
            );
            const backgroundColors = previousFeeds.map((feed) =>
                feed.type === "breast"
                    ? hatchPattern ?? ACTUAL_COLOR
                    : ACTUAL_COLOR,
            );

            feedChart = new Chart(canvas, {
                type: "bar",
                data: {
                    labels: previousFeedTimes,
                    datasets: [
                        {
                            label: "milk (ml)",
                            data: sizes,
                            backgroundColor: backgroundColors,
                            borderWidth: 1,
                        },
                    ],
                },
                options: {
                    scales,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: (item) => {
                                    const feed =
                                        previousFeeds[item.dataIndex];
                                    const value = Number(item.parsed.y);
                                    if (feed?.type === "breast") {
                                        return ` ${value} ml (estimated)`;
                                    }
                                    return ` ${value} ml`;
                                },
                            },
                        },
                    },
                },
            });
            return;
        }

        let label: string;
        let dataSet: number[];

        if (chartType === CHART_FEEDING_TIME) {
            label = "seconds";
            dataSet = previousFeeds.map((feed) => feed.duration);
        } else {
            label = "ml/s";
            dataSet = previousFeeds.map((feed) => {
                if (feed.duration === 0) {
                    return 0;
                }
                return milkConsumed(feed, rate) / feed.duration;
            });
        }

        feedChart = new Chart(canvas, {
            type: "bar",
            data: {
                labels: previousFeedTimes,
                datasets: [
                    {
                        label: label,
                        data: dataSet,
                        borderWidth: 1,
                    },
                ],
            },
            options: { scales },
        });
    }

    onMount(() => {
        const unsubscribe = mlPerMinute.subscribe((rate) => {
            mlPerMinuteInput = rate;
            updateFeedChart(previousFeeds);
        });

        localforage
            .getItem("mlPerMinute")
            .then((value: any) => {
                const parsed =
                    value === null || value === undefined || value === ""
                        ? Number.NaN
                        : Number(value);
                const rate = Number.isFinite(parsed) && parsed >= 0
                    ? parsed
                    : DEFAULT_ML_PER_MINUTE;
                mlPerMinute.set(rate);
            })
            .catch(function (err) {
                console.error(err);
            });

        return unsubscribe;
    });
</script>

<div>
    {#if previousFeeds.length === 0}
        <div class="max-w-xl m-auto">
            <h2 class="mt-4 text-xl max-w-xl m-auto">Feeding Chart</h2>
            <p>No feeds yet.</p>
        </div>
    {:else}
        <div class="max-w-xl m-auto">
            <h2 class="mt-4 text-xl max-w-xl m-auto">Feeding Chart</h2>
            <canvas id="myChart"></canvas>
            <label
                for="chartType"
                class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >Chart Type</label
            >
            <select
                bind:value={chartType}
                on:change={() => updateFeedChart(previousFeeds)}
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            >
                <option value={CHART_FEEDING_TIME}>feeding time</option>
                <option value={CHART_FEEDING_SIZE}>milk consumed (ml)</option>
                <option value={CHART_FEEDING_SPEED}>feeding speed</option>
            </select>

            <label
                for="mlPerMinute"
                class="block mt-3 mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >Estimated breast milk (ml/min)</label
            >
            <input
                type="number"
                id="mlPerMinute"
                min="0"
                step="0.5"
                bind:value={mlPerMinuteInput}
                on:change={handleMlPerMinuteInput}
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Hatched bars are estimated breast milk.
            </p>
        </div>
    {/if}
</div>
