<script lang="ts">
	import { onMount } from "svelte";
	import localforage from "localforage";
	import type { FeedLog, FeedingChartInterface } from "../lib/types";

	import PreviousFeedsList from "../components/previousFeedsList.svelte";
	import FeedingTimer from "../components/feedingTimer.svelte";
	import FeedingChart from "../components/feedingChart.svelte";

	import "../app.css";
	import {
		toggleLightDarkMode,
		toggleNightVision,
		restoreLightDarkModeFromLocalStorage,
	} from "../lib/lightDarkMode";

	export let previousFeeds: FeedLog[] = [];

	let feedingChartComponent: FeedingChartInterface;

	function handleNewFeedFinished(event: CustomEvent<FeedLog>) {
		console.log("new feed finished!", event.detail);

		previousFeeds = [...previousFeeds, event.detail];

		localforage
			.setItem("previousFeeds", previousFeeds)
			.catch(function (err) {
				console.error(err);
			});

		feedingChartComponent.updateFeedChart(previousFeeds);
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

		<FeedingTimer on:newfeedfinished={handleNewFeedFinished} />

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
