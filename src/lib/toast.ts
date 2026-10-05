import { writable } from "svelte/store";

export type Toast = {
    id: string;
    message: string;
    actionLabel?: string;
    durationMs?: number;
};

type ToastWithCallback = Toast & { onAction?: () => void };

const toastsStore = writable<ToastWithCallback[]>([]);

export const toasts = { subscribe: toastsStore.subscribe };

let counter = 0;

function genId(): string {
    counter += 1;
    return `toast-${Date.now()}-${counter}`;
}

export function pushToast(
    message: string,
    opts: { actionLabel?: string; onAction?: () => void; durationMs?: number } = {},
): string {
    const id = genId();
    const toast: ToastWithCallback = {
        id,
        message,
        actionLabel: opts.actionLabel,
        onAction: opts.onAction,
        durationMs: opts.durationMs ?? 5000,
    };
    toastsStore.update((list) => [...list, toast]);
    const ms = toast.durationMs ?? 5000;
    if (ms > 0) {
        setTimeout(() => dismissToast(id), ms);
    }
    return id;
}

export function dismissToast(id: string): void {
    toastsStore.update((list) => list.filter((t) => t.id !== id));
}

export function clearToasts(): void {
    toastsStore.set([]);
}
