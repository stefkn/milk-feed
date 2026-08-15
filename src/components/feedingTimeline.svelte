<script lang="ts">
    import { tick, onMount } from "svelte";
    import { get } from "svelte/store";
    import type { FeedLog } from "../lib/types";
    import { browser } from "$app/environment";
    import { format, parse } from "@formkit/tempo";
    import { Chart } from "chart.js/auto";
    import "chartjs-adapter-date-fns";
    import { milkConsumed, mlPerMinute } from "../lib/feed";

    export let previousFeeds: FeedLog[] = [];
    let feedTimeline: Chart | undefined = undefined;

    interface ChartInterface {
        x: Date[];
        y: number;
        fedMilk: number;
        start: string;
        end: string;
    }

    export async function updateTimeline(previousFeeds: FeedLog[]) {
        if (!browser) {
            return;
        }

        if (previousFeeds.length === 0) {
            if (feedTimeline instanceof Chart) {
                feedTimeline.destroy();
                feedTimeline = undefined;
            }
            return;
        }

        await tick();

        const rate = get(mlPerMinute);

        const canvas = document.getElementById(
            "timelineChart",
        ) as HTMLCanvasElement | null;

        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext("2d");

        if (feedTimeline instanceof Chart) {
            feedTimeline.destroy();
        }

        if (!ctx) {
            return;
        }

        feedTimeline = new Chart(ctx, {
            type: "bar",
            data: {
                datasets: [
                    {
                        label: "feeding",
                        data: previousFeeds.map((feed, index) => {
                            return {
                                x: [feed.start, feed.end],
                                y: 0,
                                fedMilk: milkConsumed(feed, rate),
                                start: format(feed.start, "HH:mm"),
                                end: format(feed.end, "HH:mm"),
                            }
                        }),
                    },
                ],
            },
            options: {
                indexAxis: "y" as const,
                responsive: true,
                scales: {
                    x: {
                        min: Math.min(
                            ...previousFeeds.map((feed) =>
                                parse(
                                    format(feed.start, "full"),
                                    "full",
                                ).getTime(),
                            ),
                        ),
                        max: Date.now(),
                        ticks: {
                            autoSkip: true,
                            maxTicksLimit: 4,
                            color: "gray",
                        },
                        grid: {
                            color: "gray",
                        },
                        time: {
                            displayFormats: {
                                minute: "MM-dd HH:mm",
                                hour: "MM-dd HH:mm",
                            },
                            unit: "minute",
                        },
                        stacked: true,
                        type: "time",
                        border: {
                            color: "gray",
                        },
                    },
                    y: {
                        stacked: true,
                        border: {
                            color: "gray",
                        },
                    },
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: () => "",
                            label: (item) => {
                                const data = item.dataset.data[item.dataIndex] as ChartInterface
                                if (!data) {
                                    return "";
                                }
                                return (
                                    " fed " +
                                    data.fedMilk +
                                    "ml" +
                                    " from " +
                                    data.start +
                                    " to " +
                                    data.end
                                );
                            },
                        },
                    },
                },
            },
        });

        return () => {};
    }

    onMount(() => {
        return mlPerMinute.subscribe(() => {
            updateTimeline(previousFeeds);
        });
    });
</script>

<div>
    <div class="max-w-xl m-auto">
        <h2 class="mt-4 text-xl max-w-xl m-auto">Timeline</h2>
        {#if previousFeeds.length === 0}
            <p>No feeds yet.</p>
        {:else}
            <canvas id="timelineChart"></canvas>
        {/if}
    </div>
</div>
