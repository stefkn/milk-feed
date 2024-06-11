<script lang="ts">
    import type { FeedLog } from "../lib/types";
    import { browser } from "$app/environment";
    import { format, parse } from "@formkit/tempo";
    import { Chart } from "chart.js/auto";
    import "chartjs-adapter-date-fns";

    export let previousFeeds: FeedLog[] = [];
    let feedTimeline: Chart | undefined = undefined;

    interface ChartInterface {
        x: Date[];
        y: number;
        fedMilk: number;
        start: string;
        end: string;
    }

    export function updateTimeline(previousFeeds: FeedLog[]) {
        if (!browser) {
            return;
        }

        if (previousFeeds.length === 0) {
            return;
        }

        const ctx = (
            document.getElementById("timelineChart") as HTMLCanvasElement
        ).getContext("2d");

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
                                fedMilk:
                                    feed.remainingMilk === 0
                                        ? feed.bottleSize
                                        : feed.bottleSize - feed.remainingMilk,
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
                                console.log(data);
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
