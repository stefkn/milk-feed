<script>
	import { onMount, onDestroy } from "svelte";
	import { browser } from '$app/environment';
	import { format, parse, addSecond, diffSeconds } from "@formkit/tempo";
	import Chart from "chart.js/auto";
	import localforage from "localforage";
	import "../app.css";

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

		const previousFeedTimes = previousFeeds.map((feed) =>
			format(feed.start, { time: "short" }),
		);

		const previousFeedDurations = previousFeeds.map((feed) => feed.duration);

		if (ctx && ctx instanceof HTMLCanvasElement) {
			feedChart = new Chart(ctx, {
				type: "bar",
				data: {
					labels: previousFeedTimes,
					datasets: [
						{
							label: "seconds",
							data: previousFeedDurations,
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
	}

	/**
	 * @param {number} bottleSize
	 */
	function updateSavedBottleSize(bottleSize) {
		localforage.setItem("bottleSize", bottleSize).catch(function (err) {
			console.error(err);
		});
	}

	onMount(() => {
		localforage.getItem("previousFeeds").then((value) => {
			if (value) {
				previousFeeds = value.filter((feed) => feed.duration > 0);
			}
		}).then(() => {
			updateFeedChart();
		})
		localforage.getItem("bottleSize").then((value) => {
			if (value) {
				bottleSize = value;
			}
		});
	});

	onDestroy(() => {
		stopFeedingTimer();
	});
</script>

<main>
	<div class="w-auto h-full bg-blue-100 m-auto mt-4 max-w-96 p-4 rounded-lg">
		<h1>{currentTime}</h1>
		<h1>
			this feed has taken {Math.floor(feedDurationSeconds / 60)
				.toString()
				.padStart(2, "0")}:{(feedDurationSeconds % 60)
				.toString()
				.padStart(2, "0")}
		</h1>
		<div>
			<label for="bottleSize">Bottle Size (ml)</label>
			<input
				type="number"
				bind:value={bottleSize}
				disabled={isFeeding}
				on:input={() => updateSavedBottleSize(bottleSize)}
			/>
		</div>
		<div>
			{#if !isFeeding}
				<button class="main-button bg-emerald-400" on:click={startFeedingTimer}>Start Feeding</button>
			{/if}
			{#if isFeeding}
				{#if isPaused}
					<button class="main-button bg-emerald-400" on:click={togglePauseFeedingTimer}>Continue</button>
				{/if}
				{#if !isPaused}
					<button class="main-button bg-yellow-400" on:click={togglePauseFeedingTimer}>Pause</button>
				{/if}
				<button class="main-button bg-red-400" on:click={stopFeedingTimer}>Stop</button>
			{/if}
		</div>
		<div>
			<h2>Previous Feeds</h2>
			<ul>
				{#each previousFeeds as feed}
					<li>
						{format(feed.start, {
							date: "full",
							time: "short",
						})} - {format(feed.end, { time: "short" })} ({feed.duration}
						seconds) - {feed.bottleSize}ml
					</li>
				{/each}
			</ul>

			<div>
				<canvas id="myChart"></canvas>
			</div>
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