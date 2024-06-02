<script>
    import PreviousFeed from "./previousFeed.svelte";
    import localforage from "localforage";
    import "../app.css";

    /**
     * @type {any[]}
     */
    export let previousFeeds = [];

    function deleteFeedHistory() {
        localforage.removeItem("previousFeeds").then(() => {
            previousFeeds = [];
        });
    }
</script>

<ul class="max-w-xl text-gray-500 list-disc list-inside dark:text-gray-400 m-auto">
    {#each previousFeeds as feed}
        <PreviousFeed {feed} />
    {/each}
    <button class="main-button bg-red-600 mt-4" on:click={deleteFeedHistory}>
        Delete all previous feeds
    </button>
</ul>
