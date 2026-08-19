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
	let showJoinInput = false;
	let joinCode = "";
	let joinError = "";
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
		showJoinInput = false;
		joinError = "";
	}

	function openJoinInput() {
		showJoinInput = true;
		joinError = "";
	}

	function cancelJoinInput() {
		showJoinInput = false;
		joinCode = "";
		joinError = "";
	}

	function handleJoinSubmit() {
		const trimmed = joinCode.trim().toLowerCase();
		if (!trimmed) {
			return;
		}
		if (!isValidSessionCode(trimmed)) {
			joinError =
				"That session phrase looks wrong. It should be three words separated by dashes.";
			return;
		}
		joinSession(trimmed);
		joinCode = "";
		showJoinInput = false;
		isMenuOpen = false;
	}

	function handleStartSession() {
		isMenuOpen = false;
		startSession();
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
		const imported = feeds.map((feed) => stampFeed(feed));
		applyFeeds(mergeFeedsLWW(previousFeeds, imported));
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
				<button
					on:click={handleToggleNightVision}
					class="text-white bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-4 focus:ring-purple-300 font-medium rounded-full text-sm px-5 py-2.5 text-center mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900"
					>night mode</button
				>
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
							{#if showJoinInput}
								<form on:submit|preventDefault={handleJoinSubmit} class="p-2">
									<input
										type="text"
										bind:value={joinCode}
										placeholder="Enter session phrase"
										autocomplete="off"
										class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
									/>
									{#if joinError}
										<p class="mt-1 text-xs text-red-700 dark:text-red-200">
											{joinError}
										</p>
									{/if}
									<div class="flex gap-1 mt-2">
										<button
											type="submit"
											class="flex-1 text-white bg-emerald-600 hover:bg-emerald-700 font-medium rounded-lg text-sm px-3 py-1.5"
											>Join</button
										>
										<button
											type="button"
											on:click={cancelJoinInput}
											class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-1.5"
											>Cancel</button
										>
									</div>
								</form>
							{:else}
								<button
									on:click={() => {
										handleToggleLightDarkMode();
										isMenuOpen = false;
									}}
									class="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
								>
									{#if isDarkMode}
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
											class="feather feather-sun shrink-0"
											><circle cx="12" cy="12" r="5"></circle><line
												x1="12"
												y1="1"
												x2="12"
												y2="3"
											></line><line
												x1="12"
												y1="21"
												x2="12"
												y2="23"
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
											></line><line
												x1="1"
												y1="12"
												x2="3"
												y2="12"
											></line><line
												x1="21"
												y1="12"
												x2="23"
												y2="12"
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
										<span>Light mode</span>
									{:else}
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
											class="feather feather-moon shrink-0"
											><path
												d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
											></path></svg
										>
										<span>Dark mode</span>
									{/if}
								</button>
								<button
									on:click={handleStartSession}
									class="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
								>
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
										class="feather feather-radio shrink-0"
										><circle cx="12" cy="12" r="2"></circle><path
											d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"
										></path></svg
									>
									<span>Start shared session</span>
								</button>
								<button
									on:click={openJoinInput}
									class="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
								>
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
										class="feather feather-log-in shrink-0"
										><path
											d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"
										></path><polyline
											points="10 17 15 12 10 7"
										></polyline><line
											x1="15"
											y1="12"
											x2="3"
											y2="12"
										></line></svg
									>
									<span>Join shared session</span>
								</button>
								<button
									on:click={() => {
										handleExportCsv();
										isMenuOpen = false;
									}}
									class="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
								>
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
										class="feather feather-download shrink-0"
										><path
											d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
										></path><polyline
											points="7 10 12 15 17 10"
										></polyline><line
											x1="12"
											y1="15"
											x2="12"
											y2="3"
										></line></svg
									>
									<span>Export CSV</span>
								</button>
								<button
									on:click={() => {
										fileInput.click();
										isMenuOpen = false;
									}}
									class="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
								>
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
										class="feather feather-upload shrink-0"
										><path
											d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
										></path><polyline
											points="17 8 12 3 7 8"
										></polyline><line
											x1="12"
											y1="3"
											x2="12"
											y2="15"
										></line></svg
									>
									<span>Import CSV</span>
								</button>
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
			</div>
		</div>

		<SessionPanel
			status={sessionStatus}
			code={sessionCode}
			isHost={isHost}
			error={sessionError}
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
