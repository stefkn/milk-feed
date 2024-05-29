<script>
	import { onMount, onDestroy } from "svelte";
	import { format, parse, addSecond, diffSeconds } from "@formkit/tempo";

	let currentTime = format(new Date(), {
		date: "full",
		time: "short",
	});
	let currentFeed = {
		start: new Date(),
		end: new Date(),
	};
	let isFeeding = false;
	let isPaused = false;
	let bottleSize = 0;
	let feedDurationSeconds = diffSeconds(currentFeed.end, currentFeed.start);

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
		currentFeed.start = new Date();
		currentFeed.end = new Date();
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
		currentFeed = {
			start: new Date(),
			end: new Date(),
		};
		feedDurationSeconds = 0;
	}

	onDestroy(() => {
		stopFeedingTimer();
	});
</script>

<main>
	<h1>it is {currentTime}</h1>
	<h1>
		this feed has taken {Math.round(
			feedDurationSeconds / 60,
		)}:{feedDurationSeconds % 60}
	</h1>
	<input type="number" bind:value={bottleSize} />
	{#if !isFeeding}
		<button on:click={startFeedingTimer}>Start Feeding</button>
	{/if}
	{#if isFeeding}
		{#if isPaused}
			<button on:click={togglePauseFeedingTimer}>Continue</button>
		{/if}
		{#if !isPaused}
			<button on:click={togglePauseFeedingTimer}>Pause</button>
		{/if}
		<button on:click={stopFeedingTimer}>Stop</button>
	{/if}
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		font-family: Arial, sans-serif;
	}

	h1 {
		margin-bottom: 1rem;
	}

	input {
		margin-bottom: 1rem;
	}

	button {
		padding: 0.5rem 1rem;
		margin-bottom: 1rem;
	}
</style>
