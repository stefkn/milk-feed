<script>
    import { format } from "@formkit/tempo";

    export let feed = {
        start: new Date(),
        end: new Date(),
        duration: 0,
        bottleSize: 0,
    };
</script>

<li
    class="block max-w-2xl m-auto p-2 my-2 bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700"
>
    <div class="flex justify-between">
        <span>
            🍼 {format(feed.start, {
                date: "full",
                time: "short",
            })} - {format(feed.end, { time: "short" })}
        </span>
        <span>
            {feed.duration} seconds
        </span>
        <span>
            {feed.bottleSize}ml
        </span>
    </div>
</li>
