<script lang="ts">
    import type { FeedLog } from "../lib/types";
    import { browser } from "$app/environment";
    import { format } from "@formkit/tempo";
    import Chart from "chart.js/auto";

    const CHART_FEEDING_TIME = "feeding_time";
    const CHART_FEEDING_SIZE = "bottle_size";
    const CHART_FEEDING_SPEED = "feeding_speed";
    let chartType = CHART_FEEDING_TIME;

    export let previousFeeds: FeedLog[] = [];
    let feedChart: Chart | undefined = undefined;

    export function updateFeedChart(previousFeeds: FeedLog[]) {
        if (!browser) {
            return;
        }

        const ctx = document.getElementById("myChart");

        if (feedChart instanceof Chart) {
            feedChart.destroy();
        }

        if (previousFeeds.length === 0) {
            return;
        }

        const previousFeedTimes = previousFeeds.map((feed) =>
            format(feed.start, { time: "short" }),
        );

        const previousFeedDurations = previousFeeds.map(
            (feed) => feed.duration,
        );

        const previousFeedSizes = previousFeeds.map((feed) => feed.bottleSize);

        const previousFeedSpeeds = previousFeeds.map((feed) => {
            if (feed.duration === 0) {
                return 0;
            }
            if (feed.remainingMilk === 0) {
                return feed.bottleSize / feed.duration;
            } else {
                return (feed.bottleSize - feed.remainingMilk) / feed.duration;
            }
        });

        const chartGeneratorFunction = (
            /** @type {string} */ label: string,
            /** @type {any[]} */ dataSet: number[],
        ) => {
            if (ctx && ctx instanceof HTMLCanvasElement) {
                if (feedChart instanceof Chart) {
                    feedChart.destroy();
                }
                feedChart = new Chart(ctx, {
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
                    options: {
                        scales: {
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
                        },
                    },
                });
            }
        };

        switch (chartType) {
            case CHART_FEEDING_TIME:
                chartGeneratorFunction("seconds", previousFeedDurations);
                break;
            case CHART_FEEDING_SIZE:
                chartGeneratorFunction("ml", previousFeedSizes);
                break;
            case CHART_FEEDING_SPEED:
                chartGeneratorFunction("ml/s", previousFeedSpeeds);
                break;
        }

        return () => {};
    }
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
                on:change={updateFeedChart(previousFeeds)}
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            >
                <option value={CHART_FEEDING_TIME}>feeding time</option>
                <option value={CHART_FEEDING_SIZE}>bottle size</option>
                <option value={CHART_FEEDING_SPEED}>feeding speed</option>
            </select>
        </div>
    {/if}
</div>
