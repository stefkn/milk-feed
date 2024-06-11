<script lang="ts">
	import { onMount } from "svelte";
	import { browser } from "$app/environment";
	import localforage from "localforage";
	import type { FeedLog, FeedingChartInterface, TimelineInterface } from "../lib/types";

	import PreviousFeedsList from "../components/previousFeedsList.svelte";
	import FeedingTimer from "../components/feedingTimer.svelte";
	import FeedingChart from "../components/feedingChart.svelte";
	import FeedingTimeline from "../components/feedingTimeline.svelte";

	import "../app.css";
	import {
		toggleLightDarkMode,
		toggleNightVision,
		restoreLightDarkModeFromLocalStorage,
	} from "../lib/lightDarkMode";

	export let previousFeeds: FeedLog[] = [];

	let feedingChartComponent: FeedingChartInterface;
	let timelineComponent: TimelineInterface;
	let isDarkMode: Boolean = browser ? document.documentElement.classList.contains("dark") : false;

	function handleNewFeedFinished(event: CustomEvent<FeedLog>) {
		console.log("new feed finished!", event.detail);

		previousFeeds = [...previousFeeds, event.detail];

		localforage
			.setItem("previousFeeds", previousFeeds)
			.catch(function (err) {
				console.error(err);
			});

		feedingChartComponent.updateFeedChart(previousFeeds);
		timelineComponent.updateTimeline(previousFeeds);
	}

	function updatePreviousFeeds(event: CustomEvent<FeedLog[]>) {
		console.log("updating previous feeds", event);
		previousFeeds = event.detail;

		localforage
			.setItem("previousFeeds", previousFeeds)
			.catch(function (err) {
				console.error(err);
			});

		feedingChartComponent.updateFeedChart(previousFeeds);
		timelineComponent.updateTimeline(previousFeeds);
	}

	function handleToggleLightDarkMode() {
		toggleLightDarkMode();
		isDarkMode = !isDarkMode;
	}

	onMount(() => {
		localforage
			.getItem("previousFeeds")
			.then((value) => {
				if (value instanceof Array) {
					previousFeeds = value.filter((feed) => feed.duration > 0);
				}
			})
			.then(() => {
				feedingChartComponent.updateFeedChart(previousFeeds);
				timelineComponent.updateTimeline(previousFeeds);
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
			<h1 class="text-3xl">milkfeed</h1>
			<div class="flex gap-2">
				<button
					on:click={handleToggleLightDarkMode}
					class="text-white bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-4 focus:ring-purple-300 font-medium rounded-full text-sm px-5 py-2.5 text-center mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900"
				>
					{#if isDarkMode}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="feather feather-sun"
							><circle cx="12" cy="12" r="5"></circle><line
								x1="12"
								y1="1"
								x2="12"
								y2="3"
							></line><line x1="12" y1="21" x2="12" y2="23"
							></line><line
								x1="4.22"
								y1="4.22"
								x2="5.64"
								y2="5.64"
							></line><line
								x1="18.36"
								y1="18.36"
								x2="19.78"
								y2="19.78"
							></line><line x1="1" y1="12" x2="3" y2="12"
							></line><line x1="21" y1="12" x2="23" y2="12"
							></line><line
								x1="4.22"
								y1="19.78"
								x2="5.64"
								y2="18.36"
							></line><line
								x1="18.36"
								y1="5.64"
								x2="19.78"
								y2="4.22"
							></line></svg
						>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="feather feather-moon"
							><path
								d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
							></path></svg
						>
					{/if}
				</button>
				<button
					on:click={toggleNightVision}
					class="text-white bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-4 focus:ring-purple-300 font-medium rounded-full text-sm px-5 py-2.5 text-center mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900"
					>night mode</button
				>
			</div>
		</div>

		<FeedingTimer on:newfeedfinished={handleNewFeedFinished} />

		<FeedingTimeline {previousFeeds} bind:this={timelineComponent} />

		<FeedingChart {previousFeeds} bind:this={feedingChartComponent} />

		<div>
			<h2 class="mt-4 text-xl max-w-xl m-auto">Previous Feeds</h2>
			<PreviousFeedsList
				{previousFeeds}
				on:updatepreviousfeeds={updatePreviousFeeds}
			/>
		</div>
	</div>
</main>
