export function toggleLightDarkMode() {
    if (document.documentElement.classList.contains("nv")) {
        document.documentElement.classList.remove("nv");
        document.documentElement.classList.add("dark");
        localStorage.theme = "dark";
        return;
    }
    if (document.documentElement.classList.contains("dark")) {
        document.documentElement.classList.remove("dark");
        localStorage.theme = "light";
    } else {
        document.documentElement.classList.add("dark");
        localStorage.theme = "dark";
    }
}

export function toggleNightVision() {
    if (document.documentElement.classList.contains("nv")) {
        document.documentElement.classList.remove("nv");
        localStorage.theme = "dark";
    } else {
        document.documentElement.classList.add("nv");
        document.documentElement.classList.add("dark");
        localStorage.theme = "nv";
    }
}

export function restoreLightDarkModeFromLocalStorage() {
    if (
        localStorage.theme === "dark" ||
        (!("theme" in localStorage) &&
            window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}