<script>
	import { browser } from "$app/environment";
	import { onMount, onDestroy } from "svelte";
	import { format } from "@formkit/tempo";
	import Chart from "chart.js/auto";
	import localforage from "localforage";

	import PreviousFeedsList from "../components/previousFeedsList.svelte";
	import FeedingTimer from "../components/feedingTimer.svelte";
	import "../app.css";
	import { toggleLightDarkMode, toggleNightVision, restoreLightDarkModeFromLocalStorage } from "../lib/lightDarkMode";

	const CHART_FEEDING_TIME = "feeding_time";
	const CHART_FEEDING_SIZE = "bottle_size";
	const CHART_FEEDING_SPEED = "feeding_speed";
	let chartType = CHART_FEEDING_TIME;

	/**
	 * @type {any[]}
	 */
	let previousFeeds = [];

	/**
	 * @type {Chart | undefined}
	 */
	let feedChart;

	function handleNewFeedFinished(event) {
		console.log('new feed finished!', event.detail);

		previousFeeds = [
			...previousFeeds,
			event.detail
		];

		localforage
			.setItem("previousFeeds", previousFeeds)
			.catch(function (err) {
				console.error(err);
			});
	
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

		restoreLightDarkModeFromLocalStorage();
	});
</script>

<main>
	<div class="overlay"></div>
	<div
		class="w-auto h-full bg-blue-100 m-auto max-w-3xl p-4 rounded-lg dark:bg-slate-900"
	>
		<div class="flex justify-between max-w-xl m-auto">
			<h1 class="text-3xl">🍼 MilkFeed</h1>
			<div class="flex gap-2">
				<button
					on:click={toggleLightDarkMode}
					class="text-white bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-4 focus:ring-purple-300 font-medium rounded-full text-sm px-5 py-2.5 text-center mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900"
					>Toggle light/dark</button
				>
				<button
					on:click={toggleNightVision}
					class="text-white bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-4 focus:ring-purple-300 font-medium rounded-full text-sm px-5 py-2.5 text-center mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900"
					>Toggle night</button
				>
			</div>
		</div>

		<FeedingTimer on:newfeedfinished={handleNewFeedFinished}  />

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
