<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { browser } from "$app/environment";
	import localforage from "localforage";
	import type { FeedLog, FeedingChartInterface, TimelineInterface } from "../lib/types";
	import { feedsToCsv, csvToFeedsWithStats, mergeFeedsById } from "../lib/csv";
	import { sortFeedsByStart } from "../lib/feed";

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
	import {
		calcSunTimes,
		isNight,
		geocodeLocation,
		type AutoNightLocation,
	} from "../lib/autoNight";

	export let previousFeeds: FeedLog[] = [];

	let feedingChartComponent: FeedingChartInterface;
	let timelineComponent: TimelineInterface;
	let fileInput: HTMLInputElement;
	let isMenuOpen = false;
	let importStatus = "";
	let importStatusTimeout: number | undefined;
	let autoNightEnabled = false;
	let autoNightLocation: AutoNightLocation | null = null;
	let autoNightApplied = false;
	let showAutoNightInput = false;
	let autoNightLocationQuery = "";
	let autoNightError = "";
	let autoNightTimer: number | undefined;
	let isDarkMode: boolean = browser
		? document.documentElement.classList.contains("dark")
		: false;

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
		showAutoNightInput = false;
		autoNightError = "";
	}

	function persistFeeds() {
		localforage
			.setItem("previousFeeds", previousFeeds)
			.catch(function (err) {
				console.error(err);
			});
	}

	function handleExportCsv() {
		if (!browser) {
			return;
		}

		const blob = new Blob([feedsToCsv(previousFeeds)], {
			type: "text/csv;charset=utf-8;",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		const today = new Date();
		const date = `${today.getFullYear()}-${String(
			today.getMonth() + 1,
		).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
		link.download = `milk-feed-${date}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function handleImportCsv(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) {
			return;
		}

		const { feeds, skipped } = csvToFeedsWithStats(await file.text());
		previousFeeds = sortFeedsByStart(mergeFeedsById(previousFeeds, feeds));
		persistFeeds();
		feedingChartComponent.updateFeedChart(previousFeeds);
		timelineComponent.updateTimeline(previousFeeds);
		input.value = "";

		const skippedNote = skipped > 0 ? ` (${skipped} skipped)` : "";
		importStatus = `Imported ${feeds.length} feeds${skippedNote}.`;
		window.clearTimeout(importStatusTimeout);
		importStatusTimeout = window.setTimeout(() => {
			importStatus = "";
		}, 4000);
	}

	function handleNewFeedFinished(event: CustomEvent<FeedLog>) {
		previousFeeds = sortFeedsByStart([...previousFeeds, event.detail]);

		localforage
			.setItem("previousFeeds", previousFeeds)
			.catch(function (err) {
				console.error(err);
			});

		feedingChartComponent.updateFeedChart(previousFeeds);
		timelineComponent.updateTimeline(previousFeeds);
	}

	function updatePreviousFeeds(event: CustomEvent<FeedLog[]>) {
		previousFeeds = sortFeedsByStart(event.detail);

		localforage
			.setItem("previousFeeds", previousFeeds)
			.catch(function (err) {
				console.error(err);
			});

		feedingChartComponent.updateFeedChart(previousFeeds);
		timelineComponent.updateTimeline(previousFeeds);
	}

	function syncDarkModeState() {
		isDarkMode = browser
			? document.documentElement.classList.contains("dark")
			: false;
	}

	function handleToggleLightDarkMode() {
		toggleLightDarkMode();
		syncDarkModeState();
	}

	function handleToggleNightVision() {
		toggleNightVision();
		syncDarkModeState();
	}

	function loadAutoNightState() {
		autoNightEnabled = localStorage.getItem("autoNightMode") === "on";
		const raw = localStorage.getItem("autoNightLocation");
		if (raw) {
			try {
				autoNightLocation = JSON.parse(raw) as AutoNightLocation;
			} catch {
				autoNightLocation = null;
			}
		}
	}

	function persistAutoNightState() {
		if (autoNightEnabled) {
			localStorage.setItem("autoNightMode", "on");
		} else {
			localStorage.removeItem("autoNightMode");
		}
		if (autoNightLocation) {
			localStorage.setItem(
				"autoNightLocation",
				JSON.stringify(autoNightLocation),
			);
		} else {
			localStorage.removeItem("autoNightLocation");
		}
	}

	function applyAutoNight() {
		if (!autoNightEnabled || !autoNightLocation) {
			return;
		}
		const now = new Date();
		const { sunrise, sunset } = calcSunTimes(
			now,
			autoNightLocation.latitude,
			autoNightLocation.longitude,
		);
		const root = document.documentElement;
		if (isNight(now, sunrise, sunset)) {
			root.classList.add("nv");
			root.classList.add("dark");
			autoNightApplied = true;
		} else if (autoNightApplied) {
			root.classList.remove("nv");
			if (localStorage.theme !== "dark") {
				root.classList.remove("dark");
			}
			autoNightApplied = false;
		}
		syncDarkModeState();
	}

	function clearAutoNightTimer() {
		if (autoNightTimer !== undefined) {
			window.clearInterval(autoNightTimer);
			autoNightTimer = undefined;
		}
	}

	function startAutoNight() {
		clearAutoNightTimer();
		applyAutoNight();
		autoNightTimer = window.setInterval(applyAutoNight, 60000);
	}

	function stopAutoNight() {
		clearAutoNightTimer();
		if (autoNightApplied) {
			document.documentElement.classList.remove("nv");
			if (localStorage.theme !== "dark") {
				document.documentElement.classList.remove("dark");
			}
			autoNightApplied = false;
		}
		syncDarkModeState();
	}

	function toggleAutoNight() {
		if (autoNightEnabled) {
			autoNightEnabled = false;
			stopAutoNight();
			persistAutoNightState();
			isMenuOpen = false;
			return;
		}
		if (autoNightLocation) {
			autoNightEnabled = true;
			persistAutoNightState();
			startAutoNight();
			isMenuOpen = false;
		} else {
			showAutoNightInput = true;
			autoNightError = "";
		}
	}

	function cancelAutoNightInput() {
		showAutoNightInput = false;
		autoNightLocationQuery = "";
		autoNightError = "";
	}

	async function saveAutoNightLocation() {
		const query = autoNightLocationQuery.trim();
		if (!query) {
			return;
		}
		const location = await geocodeLocation(query);
		if (!location) {
			autoNightError = "Could not find that place. Try a nearby town or city.";
			return;
		}
		autoNightLocation = location;
		autoNightLocationQuery = "";
		showAutoNightInput = false;
		autoNightEnabled = true;
		persistAutoNightState();
		startAutoNight();
		isMenuOpen = false;
	}

	onMount(() => {
		localforage
			.getItem("previousFeeds")
			.then((value) => {
				if (value instanceof Array) {
					previousFeeds = sortFeedsByStart(value);
				}
			})
			.then(() => {
				feedingChartComponent.updateFeedChart(previousFeeds);
				timelineComponent.updateTimeline(previousFeeds);
			});

		restoreLightDarkModeFromLocalStorage();
		syncDarkModeState();

		loadAutoNightState();
		if (autoNightEnabled && autoNightLocation) {
			startAutoNight();
		}
	});

	onDestroy(() => {
		clearTimeout(importStatusTimeout);
		clearAutoNightTimer();
	});
</script>

<main>
	<div
		class="w-auto h-full bg-blue-100 m-auto max-w-3xl p-4 rounded-lg dark:bg-slate-900"
	>
		<div class="flex justify-between max-w-xl m-auto">
			<h1 class="text-3xl">milkfeed</h1>
			<div class="flex gap-2">
				<div class="relative">
					<button
						on:click={toggleMenu}
						aria-haspopup="menu"
						aria-expanded={isMenuOpen}
						class="text-white bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-4 focus:ring-purple-300 font-medium rounded-full text-sm px-3 py-2.5 text-center mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900"
						><svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="feather feather-menu"
							><line x1="3" y1="12" x2="21" y2="12"></line><line
								x1="3"
								y1="6"
								x2="21"
								y2="6"
							></line><line
								x1="3"
								y1="18"
								x2="21"
								y2="18"
							></line></svg
						></button
					>
					{#if isMenuOpen}
						<div
							class="absolute right-0 z-10 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden dark:bg-gray-800 dark:border-gray-700"
						>
							{#if showAutoNightInput}
								<form
									on:submit|preventDefault={saveAutoNightLocation}
									class="p-2"
								>
									<input
										type="text"
										bind:value={autoNightLocationQuery}
										placeholder="Town or city"
										autocomplete="off"
										class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
									/>
									{#if autoNightError}
										<p class="mt-1 text-xs text-red-700 dark:text-red-200">
											{autoNightError}
										</p>
									{/if}
									<div class="flex gap-1 mt-2">
										<button
											type="submit"
											class="flex-1 text-white bg-emerald-600 hover:bg-emerald-700 font-medium rounded-lg text-sm px-3 py-1.5"
											>Save</button
										>
										<button
											type="button"
											on:click={cancelAutoNightInput}
											class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-1.5"
											>Cancel</button
										>
									</div>
								</form>
							{:else}
								<button
									on:click={toggleAutoNight}
									class="flex items-center justify-between w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
								>
									<span class="flex items-center gap-2">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="feather feather-sunset shrink-0"
											><path
												d="M17 18a5 5 0 0 0-10 0"
											></path><line
												x1="12"
												y1="9"
												x2="12"
												y2="2"
											></line><line
												x1="4.22"
												y1="10.22"
												x2="5.64"
												y2="11.64"
											></line><line x1="1" y1="18" x2="3" y2="18"
											></line><line x1="21" y1="18" x2="23" y2="18"
											></line><line
												x1="18.36"
												y1="11.64"
												x2="19.78"
												y2="10.22"
											></line><line x1="23" y1="22" x2="1" y2="22"
											></line><polyline
												points="16 5 12 9 8 5"
											></polyline></svg
										>
										<span class="flex flex-col items-start">
											<span>Auto night mode</span>
											{#if autoNightEnabled && autoNightLocation}
												<span
													class="text-xs text-gray-500 dark:text-gray-400"
												>
													{autoNightLocation.name}
												</span>
											{/if}
										</span>
									</span>
									{#if autoNightEnabled}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="feather feather-check shrink-0"
											><polyline
												points="20 6 9 17 4 12"
											></polyline></svg
										>
									{/if}
								</button>
								<button
									on:click={() => {
										handleExportCsv();
										isMenuOpen = false;
									}}
									class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
									>Export CSV</button
								>
								<button
									on:click={() => {
										fileInput.click();
										isMenuOpen = false;
									}}
									class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
									>Import CSV</button
								>
							{/if}
						</div>
					{/if}
				</div>
				<input
					type="file"
					accept=".csv,text/csv"
					class="hidden"
					bind:this={fileInput}
					on:change={handleImportCsv}
				/>
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
					on:click={handleToggleNightVision}
					class="text-white bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-4 focus:ring-purple-300 font-medium rounded-full text-sm px-5 py-2.5 text-center mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900"
					>night mode</button
				>
			</div>
		</div>

		<FeedingTimer {previousFeeds} on:newfeedfinished={handleNewFeedFinished} />

		{#if importStatus}
			<div
				role="status"
				class="max-w-xl m-auto mt-2 px-4 py-2 text-sm text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-lg dark:text-emerald-200 dark:bg-emerald-900 dark:border-emerald-700"
			>
				{importStatus}
			</div>
		{/if}

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
