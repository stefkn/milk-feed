<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { browser } from "$app/environment";
	import type { SessionStatus } from "$lib/session";

	export let status: SessionStatus = "disconnected";
	export let code: string = "";
	export let isHost: boolean = false;
	export let error: string = "";

	const dispatch = createEventDispatcher();

	let qrDataUrl = "";
	let shareUrl = "";
	let copied = false;
	let qrRequestId = 0;

	async function refreshQr() {
		if (!browser || !isHost || !code) {
			qrRequestId += 1;
			qrDataUrl = "";
			shareUrl = "";
			return;
		}
		const requestId = ++qrRequestId;
		shareUrl = `${window.location.origin}${window.location.pathname}?session=${encodeURIComponent(code)}`;
		const { toDataURL } = await import("qrcode");
		const dataUrl = await toDataURL(shareUrl, {
			width: 200,
			margin: 1,
		});
		if (requestId !== qrRequestId) {
			return;
		}
		qrDataUrl = dataUrl;
	}

	$: code, isHost, refreshQr();

	async function handleCopy() {
		if (!browser) {
			return;
		}
		try {
			await navigator.clipboard.writeText(shareUrl || code);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error("Failed to copy session invite", err);
		}
	}

	function handleDisconnect() {
		dispatch("disconnect");
	}

	const statusLabel =
		status === "connected"
			? "Connected"
			: isHost
				? "Waiting for partner…"
				: "Connecting…";
</script>

<div class="max-w-xl m-auto mt-2">
	{#if code}
		<div
			class="p-4 bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700"
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<span
						class="inline-block w-2.5 h-2.5 rounded-full {status ===
						'connected'
							? 'bg-emerald-500'
							: 'bg-yellow-500'}"
					></span>
					<p class="text-sm font-medium text-gray-900 dark:text-white">
						{statusLabel}
					</p>
				</div>
				<button
					on:click={handleDisconnect}
					class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
					>Leave session</button
				>
			</div>

			{#if isHost}
				<div class="flex flex-col sm:flex-row items-center gap-4 mt-3">
					<div class="text-center">
						{#if qrDataUrl}
							<img
								src={qrDataUrl}
								alt="Session QR code"
								class="w-40 h-40 rounded"
							/>
						{:else}
							<div class="w-40 h-40 bg-gray-100 dark:bg-gray-700 rounded"></div>
						{/if}
					</div>
					<div class="flex flex-col gap-2">
						<p class="text-sm text-gray-600 dark:text-gray-300">
							Share this phrase (or the QR code) with your partner:
						</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Both devices need a working internet connection (Wi-Fi or
							mobile data) for the session to connect.
						</p>
						<p
							class="text-2xl font-mono tracking-wide text-gray-900 dark:text-white"
						>
							{code}
						</p>
						<button
							on:click={handleCopy}
							class="text-white bg-cyan-600 hover:bg-cyan-700 font-medium rounded-full text-sm px-4 py-2"
						>
							{copied ? "Copied!" : "Copy invite link"}
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if error}
		<p
			class="mt-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-lg p-2 dark:text-red-200 dark:bg-red-900 dark:border-red-700"
		>
			{error}
		</p>
	{/if}
</div>
