<script>
	import { browser } from "$app/environment";
	import { onMount, onDestroy } from "svelte";
	import { format, parse, addSecond, diffSeconds } from "@formkit/tempo";
	import Chart from "chart.js/auto";
	import localforage from "localforage";

	import PreviousFeedsList from "../components/previousFeedsList.svelte";
	import "../app.css";

	const CHART_FEEDING_TIME = "feeding_time";
	const CHART_FEEDING_SIZE = "bottle_size";
	const CHART_FEEDING_SPEED = "feeding_speed";

	let currentTime = format(new Date(), {
		date: "short",
		time: "short",
	});

	/**
	 * @type {any[]}
	 */
	let previousFeeds = [];

	let currentFeed = {
		start: new Date(),
		end: new Date(),
	};
	let isFeeding = false;
	let isPaused = false;
	let bottleSize = 0;
	let feedDurationSeconds = diffSeconds(currentFeed.end, currentFeed.start);
	let chartType = CHART_FEEDING_TIME;

	/**
	 * @type {Chart | undefined}
	 */
	let feedChart;

	/**
	 * @type {number | undefined}
	 */
	let stopwatchInterval;

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

	function togglePauseFeedingTimer() {
		if (isPaused) {
			isPaused = false;
			_setStopWatchInterval();
		} else {
			isPaused = true;
			clearInterval(stopwatchInterval);
		}
	}

	function stopFeedingTimer() {
		clearInterval(stopwatchInterval);
		isFeeding = false;
		isPaused = false;

		if (feedDurationSeconds === 0) {
			return;
		}

		previousFeeds = [
			...previousFeeds,
			{
				start: currentFeed.start,
				end: currentFeed.end,
				duration: feedDurationSeconds,
				bottleSize,
			},
		];
		localforage
			.setItem("previousFeeds", previousFeeds)
			.catch(function (err) {
				console.error(err);
			});
		currentFeed = {
			start: new Date(),
			end: new Date(),
		};
		feedDurationSeconds = 0;
		updateFeedChart();
	}

	function updateFeedChart() {
		if (!browser) {
			return;
		}

		const ctx = document.getElementById("myChart");

		if (feedChart instanceof Chart && feedChart) {
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
			return feed.bottleSize / feed.duration;
		});

		const chartGeneratorFunction = (
			/** @type {string} */ label,
			/** @type {any[]} */ data,
		) => {
			if (ctx && ctx instanceof HTMLCanvasElement) {
				feedChart = new Chart(ctx, {
					type: "bar",
					data: {
						labels: previousFeedTimes,
						datasets: [
							{
								label: label,
								data: data,
								borderWidth: 1,
							},
						],
					},
					options: {
						scales: {
							y: {
								beginAtZero: true,
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
	}

	/**
	 * @param {number} bottleSize
	 */
	function updateSavedBottleSize(bottleSize) {
		localforage.setItem("bottleSize", bottleSize).catch(function (err) {
			console.error(err);
		});
	}


	function toggleLightDarkMode() {
		if (document.documentElement.classList.contains("nv")) {
			document.documentElement.classList.remove("nv");
			document.documentElement.classList.add("dark");
			localStorage.theme = "dark";
			return;
		}
		if (document.documentElement.classList.contains("dark")) {
			document.documentElement.classList.remove("dark");
			localStorage.theme = "light";
		} else {
			document.documentElement.classList.add("dark");
			localStorage.theme = "dark";
		}
	}

	function toggleNightVision() {
		if (document.documentElement.classList.contains("nv")) {
			document.documentElement.classList.remove("nv");
			localStorage.theme = "dark";
		} else {
			document.documentElement.classList.add("nv");
			document.documentElement.classList.add("dark");
			localStorage.theme = "nv";
		}
	}

	/**
     * @param {any[]} event
     */
	function updatePreviousFeeds(event) {
		previousFeeds = event.detail || [];
		updateFeedChart();
	}

	onMount(() => {
		localforage
			.getItem("previousFeeds")
			.then((value) => {
				if (value) {
					previousFeeds = value.filter((feed) => feed.duration > 0);
				}
			})
			.then(() => {
				updateFeedChart();
			});
		localforage.getItem("bottleSize").then((value) => {
			if (value) {
				bottleSize = value;
			}
		});

		// Toggle light/dark mode
		if (
			localStorage.theme === "dark" ||
			(!("theme" in localStorage) &&
				window.matchMedia("(prefers-color-scheme: dark)").matches)
		) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	});

	onDestroy(() => {
		stopFeedingTimer();
	});
</script>

<main>
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
					on:change={updateFeedChart}
					class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
				>
					<option value={CHART_FEEDING_TIME}>feeding time</option>
					<option value={CHART_FEEDING_SIZE}>bottle size</option>
					<option value={CHART_FEEDING_SPEED}>feeding speed</option>
				</select>
			</div>
		{/if}
		<div>
			<h2 class="mt-4 text-xl max-w-xl m-auto">Previous Feeds</h2>
			<PreviousFeedsList {previousFeeds} on:updatepreviousfeeds={updatePreviousFeeds(previousFeeds)} />
		</div>
	</div>
</main>

<style>
	.main-button {
		border: none;
		color: white;
		padding: 15px 32px;
		text-align: center;
		text-decoration: none;
		display: inline-block;
		font-size: 16px;
		margin: 14px 0px;
		cursor: pointer;
		border-radius: 8px;
	}
</style>
