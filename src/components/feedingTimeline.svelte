<script lang="ts">
    import { tick, onMount } from "svelte";
    import { get } from "svelte/store";
    import type { FeedLog } from "../lib/types";
    import { browser } from "$app/environment";
    import { format } from "@formkit/tempo";
    import { Chart } from "chart.js/auto";
    import "chartjs-adapter-date-fns";
    import { milkConsumed, mlPerMinute } from "../lib/feed";
    import {
        defaultTimelineRange,
        nightPeriodsInRange,
        dayPeriodsInRange,
    } from "../lib/timeline";

    export let previousFeeds: FeedLog[] = [];
    let feedTimeline: Chart | undefined = undefined;

    const ICON_RADIUS = 5;
    const ICON_INSET = 8;
    const ICON_Y_OFFSET = 12;

    function drawMoon(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        r: number,
        color: string,
    ) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.arc(x + r * 0.5, y - r * 0.2, r * 0.8, 0, Math.PI * 2);
        ctx.fill("evenodd");
        ctx.restore();
    }

    function drawSun(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        r: number,
        color: string,
    ) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = r * 0.35;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            ctx.moveTo(
                x + Math.cos(angle) * r * 0.9,
                y + Math.sin(angle) * r * 0.9,
            );
            ctx.lineTo(
                x + Math.cos(angle) * r * 1.6,
                y + Math.sin(angle) * r * 1.6,
            );
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    const timelineDecorationsPlugin = {
        id: "timelineDecorations",
        beforeDatasetsDraw(chart: Chart) {
            const xScale = chart.scales.x;
            if (!xScale) {
                return;
            }
            const min = xScale.min;
            const max = xScale.max;
            if (min === undefined || max === undefined) {
                return;
            }

            const periods = nightPeriodsInRange(min, max);
            if (periods.length === 0) {
                return;
            }

            const { ctx, chartArea } = chart;
            const isDark =
                typeof document !== "undefined" &&
                document.documentElement.classList.contains("dark");

            ctx.save();
            ctx.fillStyle = isDark
                ? "rgba(255, 255, 255, 0.06)"
                : "rgba(0, 0, 0, 0.06)";
            for (const [start, end] of periods) {
                const x1 = xScale.getPixelForValue(start);
                const x2 = xScale.getPixelForValue(end);
                ctx.fillRect(
                    x1,
                    chartArea.top,
                    x2 - x1,
                    chartArea.bottom - chartArea.top,
                );
            }
            ctx.restore();
        },
        afterDatasetsDraw(chart: Chart) {
            const xScale = chart.scales.x;
            if (!xScale) {
                return;
            }
            const min = xScale.min;
            const max = xScale.max;
            if (min === undefined || max === undefined) {
                return;
            }

            const nights = nightPeriodsInRange(min, max);
            const days = dayPeriodsInRange(min, max);

            const { ctx, chartArea } = chart;
            const isDark =
                typeof document !== "undefined" &&
                document.documentElement.classList.contains("dark");

            const moonColor = isDark
                ? "rgba(226, 232, 240, 0.95)"
                : "rgba(71, 85, 105, 0.95)";
            const sunColor = "rgba(245, 158, 11, 0.95)";

            const iconY = chartArea.top + ICON_Y_OFFSET;
            const iconX = (timeMs: number) => {
                const px = xScale.getPixelForValue(timeMs) + ICON_INSET;
                return Math.max(
                    chartArea.left + ICON_RADIUS + 2,
                    Math.min(chartArea.right - ICON_RADIUS - 2, px),
                );
            };

            ctx.save();
            for (const [start] of nights) {
                drawMoon(ctx, iconX(start), iconY, ICON_RADIUS, moonColor);
            }
            for (const [start] of days) {
                drawSun(ctx, iconX(start), iconY, ICON_RADIUS, sunColor);
            }
            ctx.restore();
        },
    };

    export async function updateTimeline(previousFeeds: FeedLog[]) {
        if (!browser) {
            return;
        }

        if (previousFeeds.length === 0) {
            return;
        }

        await tick();

        const { default: zoomPlugin } = await import("chartjs-plugin-zoom");
        Chart.register(zoomPlugin);

        const rate = get(mlPerMinute);

        const startMs = previousFeeds.map((feed) =>
            new Date(feed.start).getTime(),
        );
        const endMs = previousFeeds.map((feed) =>
            new Date(feed.end).getTime(),
        );

        const range = defaultTimelineRange(previousFeeds);

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
                        data: previousFeeds.map((_, index) => ({
                            x: [startMs[index], endMs[index]] as [
                                number,
                                number,
                            ],
                            y: 0,
                        })) as any,
                    },
                ],
            },
            options: {
                indexAxis: "y" as const,
                responsive: true,
                scales: {
                    x: {
                        min: range.min,
                        max: range.max,
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
                        ticks: {
                            display: false,
                        },
                        grid: {
                            color: "gray",
                        },
                        border: {
                            color: "gray",
                        },
                    },
                },
                plugins: {
                    zoom: {
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            mode: "x",
                        },
                        pan: {
                            enabled: true,
                            mode: "x",
                        },
                    },
                    tooltip: {
                        callbacks: {
                            title: () => "",
                            label: (item) => {
                                const feed = previousFeeds[item.dataIndex];
                                if (!feed) {
                                    return "";
                                }
                                return (
                                    " fed " +
                                    milkConsumed(feed, rate) +
                                    "ml" +
                                    " from " +
                                    format(feed.start, "HH:mm") +
                                    " to " +
                                    format(feed.end, "HH:mm")
                                );
                            },
                        },
                    },
                },
            },
            plugins: [timelineDecorationsPlugin],
        });
    }

    function resetTimelineView() {
        if (feedTimeline) {
            (feedTimeline as unknown as { resetZoom: () => void }).resetZoom();
        }
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
            <button
                on:click={resetTimelineView}
                class="mt-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >Reset view</button
            >
        {/if}
    </div>
</div>
