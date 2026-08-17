<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { browser } from "$app/environment";
	import localforage from "localforage";
	import type { FeedLog, FeedingChartInterface, TimelineInterface } from "../lib/types";
	import { feedsToCsv, csvToFeedsWithStats } from "../lib/csv";
	import { sortFeedsByStart } from "../lib/feed";
	import { activeFeeds, mergeFeedsLWW, stampFeed } from "../lib/sync";
	import type { SyncMessage } from "../lib/sync";
	import {
		createSession,
		joinSession as joinPeerSession,
		type SessionHandle,
		type SessionStatus,
	} from "../lib/session";
	import { isValidSessionCode } from "../lib/sessionCode";

	import PreviousFeedsList from "../components/previousFeedsList.svelte";
	import FeedingTimer from "../components/feedingTimer.svelte";
	import FeedingChart from "../components/feedingChart.svelte";
	import FeedingTimeline from "../components/feedingTimeline.svelte";
	import SessionPanel from "../components/sessionPanel.svelte";

	import "../app.css";
	import {
		toggleLightDarkMode,
		toggleNightVision,
		restoreLightDarkModeFromLocalStorage,
	} from "../lib/lightDarkMode";

	export let previousFeeds: FeedLog[] = [];

	let feedingChartComponent: FeedingChartInterface;
	let timelineComponent: TimelineInterface;
	let fileInput: HTMLInputElement;
	let isMenuOpen = false;
	let importStatus = "";
	let importStatusTimeout: number | undefined;
	let isDarkMode: boolean = browser
		? document.documentElement.classList.contains("dark")
		: false;

	let session: SessionHandle | null = null;
	let sessionStatus: SessionStatus = "disconnected";
	let sessionCode = "";
	let sessionError = "";
	let isHost = false;

	$: activeFeedsList = activeFeeds(previousFeeds);

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	function persistFeeds() {
		localforage
			.setItem("previousFeeds", previousFeeds)
			.catch(function (err) {
				console.error(err);
			});
	}

	function broadcastFeeds() {
		session?.send({ type: "feeds", feeds: previousFeeds });
	}

	function refreshComponents() {
		const active = activeFeeds(previousFeeds);
		feedingChartComponent?.updateFeedChart(active);
		timelineComponent?.updateTimeline(active);
	}

	function applyFeeds(next: FeedLog[], broadcast = true) {
		previousFeeds = sortFeedsByStart(next);
		persistFeeds();
		if (broadcast) {
			broadcastFeeds();
		}
		refreshComponents();
	}

	function handleExportCsv() {
		if (!browser) {
			return;
		}

		const blob = new Blob([feedsToCsv(activeFeeds(previousFeeds))], {
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
		const existingIds = new Set(previousFeeds.map((feed) => feed.feedId));
		const imported = feeds.map((feed) =>
			existingIds.has(feed.feedId) ? feed : stampFeed(feed),
		);
		previousFeeds = sortFeedsByStart(mergeFeedsLWW(previousFeeds, imported));
		persistFeeds();
		broadcastFeeds();
		refreshComponents();
		input.value = "";

		const skippedNote = skipped > 0 ? ` (${skipped} skipped)` : "";
		importStatus = `Imported ${feeds.length} feeds${skippedNote}.`;
		window.clearTimeout(importStatusTimeout);
		importStatusTimeout = window.setTimeout(() => {
			importStatus = "";
		}, 4000);
	}

	function handleNewFeedFinished(event: CustomEvent<FeedLog>) {
		applyFeeds([...previousFeeds, stampFeed(event.detail)]);
	}

	function updatePreviousFeeds(event: CustomEvent<FeedLog[]>) {
		applyFeeds(event.detail);
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

	function handleSessionStatus(status: SessionStatus) {
		sessionStatus = status;
		if (status === "connected") {
			broadcastFeeds();
		}
	}

	function handleSessionMessage(message: SyncMessage) {
		if (message.type !== "feeds") {
			return;
		}
		const merged = mergeFeedsLWW(previousFeeds, message.feeds);
		applyFeeds(merged, false);
	}

	function sessionCallbacks() {
		return {
			onStatus: handleSessionStatus,
			onMessage: handleSessionMessage,
			onError: (message: string) => {
				sessionError = message;
			},
		};
	}

	async function teardownSession() {
		session?.close();
		session = null;
		sessionStatus = "disconnected";
		sessionCode = "";
		sessionError = "";
		isHost = false;
	}

	function persistSessionRole() {
		if (sessionCode) {
			localforage
				.setItem("sessionRole", { code: sessionCode, isHost })
				.catch(function (err) {
					console.error(err);
				});
		} else {
			localforage.removeItem("sessionRole").catch(function (err) {
				console.error(err);
			});
		}
	}

	async function startSession() {
		await teardownSession();
		try {
			session = await createSession(sessionCallbacks());
		} catch (err) {
			console.error("Failed to start session", err);
			sessionError = "Could not start a session. Please try again.";
			return;
		}
		sessionCode = session.code;
		isHost = session.isHost;
		persistSessionRole();
	}

	async function joinSession(code: string) {
		if (!isValidSessionCode(code)) {
			sessionError = "That session phrase looks wrong. Check it and try again.";
			return;
		}
		await teardownSession();
		try {
			session = await joinPeerSession(code, sessionCallbacks());
		} catch (err) {
			console.error("Failed to join session", err);
			sessionError = "Could not join the session. Please try again.";
			return;
		}
		sessionCode = session.code;
		isHost = session.isHost;
		persistSessionRole();
	}

	async function disconnectSession() {
		await teardownSession();
		persistSessionRole();
	}

	async function restoreSession() {
		const joinCode = browser
			? new URLSearchParams(window.location.search).get("session")
			: null;

		if (joinCode) {
			await joinSession(joinCode.trim().toLowerCase());
			return;
		}

		const saved = await localforage.getItem("sessionRole");
		if (!saved || typeof saved !== "object") {
			return;
		}
		const { code, isHost: host } = saved as { code: string; isHost: boolean };
		if (!code) {
			return;
		}
		try {
			session = host
				? await createSession(sessionCallbacks(), code)
				: await joinPeerSession(code, sessionCallbacks());
		} catch (err) {
			console.error("Failed to restore session", err);
			return;
		}
		sessionCode = session.code;
		isHost = session.isHost;
	}

	onMount(async () => {
		const stored = await localforage.getItem("previousFeeds");
		if (stored instanceof Array) {
			previousFeeds = sortFeedsByStart(stored);
		}
		refreshComponents();

		restoreLightDarkModeFromLocalStorage();
		syncDarkModeState();

		await restoreSession();
	});

	onDestroy(() => {
		clearTimeout(importStatusTimeout);
		session?.close();
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
							class="absolute right-0 z-10 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden dark:bg-gray-800 dark:border-gray-700"
						>
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

		<SessionPanel
			status={sessionStatus}
			code={sessionCode}
			isHost={isHost}
			error={sessionError}
			on:start={() => startSession()}
			on:join={(e) => joinSession(e.detail)}
			on:disconnect={() => disconnectSession()}
		/>

		<FeedingTimer previousFeeds={activeFeedsList} on:newfeedfinished={handleNewFeedFinished} />

		{#if importStatus}
			<div
				role="status"
				class="max-w-xl m-auto mt-2 px-4 py-2 text-sm text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-lg dark:text-emerald-200 dark:bg-emerald-900 dark:border-emerald-700"
			>
				{importStatus}
			</div>
		{/if}

		<FeedingTimeline previousFeeds={activeFeedsList} bind:this={timelineComponent} />

		<FeedingChart previousFeeds={activeFeedsList} bind:this={feedingChartComponent} />

		<div>
			<h2 class="mt-4 text-xl max-w-xl m-auto">Previous Feeds</h2>
			<PreviousFeedsList
				{previousFeeds}
				on:updatepreviousfeeds={updatePreviousFeeds}
			/>
		</div>
	</div>
</main>
