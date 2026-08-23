const CACHE_NAME = "milk-feed-v1";
const PRECACHE_URLS = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(PRECACHE_URLS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME)
					.map((key) => caches.delete(key)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") {
		return;
	}

	event.respondWith(
		(async () => {
			try {
				const response = await fetch(event.request);
				if (
					response.ok &&
					new URL(event.request.url).origin === self.location.origin
				) {
					event.waitUntil(
						caches
							.open(CACHE_NAME)
							.then((cache) =>
								cache.put(event.request, response.clone()),
							),
					);
				}
				return response;
			} catch (err) {
				const cached = await caches.match(event.request);
				if (cached) {
					return cached;
				}
				if (event.request.mode === "navigate") {
					const shell = await caches.match("/");
					if (shell) {
						return shell;
					}
				}
				return new Response(
					"You're offline and this page isn't cached yet.",
					{
						status: 503,
						statusText: "Service Unavailable",
						headers: { "Content-Type": "text/plain" },
					},
				);
			}
		})(),
	);
});
