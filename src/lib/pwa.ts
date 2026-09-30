import { dev } from "$app/environment";

export function registerServiceWorker() {
	if (dev || !("serviceWorker" in navigator)) {
		return;
	}
	navigator.serviceWorker.register("/sw.js").catch((err) => {
		console.error("Service worker registration failed", err);
	});
}
