<script lang="ts">
	import { onMount } from "svelte";
	import { registerServiceWorker } from "$lib/pwa";

	onMount(() => {
		registerServiceWorker();
	});
</script>

<slot />
