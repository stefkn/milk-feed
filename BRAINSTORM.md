# MilkFeed — Improvement Brainstorm

> Constraint: no persistent backend / no user accounts. Everything stays local (LocalForage / IndexedDB / memory) + P2P sync. All ideas below respect that.

This file is the raw brainstorm. **Implemented** marks the top few picked for immediate execution.

---

## 1) UI / UX Polish (high leverage, low effort)

- **Sticky timer refactor**: Current `pin to top / un-pin` text is confusing. Replace with an icon (📌) and persist preference. Make the timer card visually distinct (slightly elevated, backdrop-blur).
- **Bottom action bar on mobile**: Hamburger hides core actions (export/import/session). Move the 2-3 primary actions to a thumb-reachable row; keep secondary inside the menu.
- **Edit form contrast fix** (`src/components/previousFeed.svelte:66`): `bg-gray-500` inputs are unreadable in light mode. Use `bg-gray-50` / `dark:bg-gray-700` like the rest of the app.
- **Clamp & validate inputs everywhere**: `remainingMilk` should never exceed `bottleSize` (auto-clamp + inline warning). `start < end` validation in edit + quick-add, with red ring + helper text instead of silently clamping duration to 0.
- **Empty states + onboarding**: When `previousFeeds.length === 0`, show a friendly illustration, “No feeds yet — start a feed or add one manually”, plus a CTA that opens Quick Add and a subtle hint about importing demo CSV.
- **Consistent card language**: `src/routes/+page.svelte:320` header `milkfeed` lower-case vs `MilkFeed` elsewhere. Standardise.
- **Bottle preset customisation**: Long-press / settings sheet to edit the `[120,150,180,210]` presets (`src/components/feedingTimer.svelte:49`).
- **Visual feed-type distinction**: Already uses green vs purple in timeline; extend to list rows (left border colour) so bottle/breast is scannable without reading `ml`.

## 2) Timer & Night-Feed Ergonomics

- **[IMPLEMENTED] Wake Lock API** — while `isFeeding === true` request `navigator.wakeLock.request('screen')`; release on pause/stop/visibilitychange. Prevents the phone sleeping mid-feed at 3am. Graceful fallback when unsupported.
- **[IMPLEMENTED] Live page title + favicon while feeding** — `document.title = 02:34 • MilkFeed` so the timer is visible when the tab is backgrounded. Tiny, delightful.
- **Haptics & subtle sound**: `navigator.vibrate(50)` on start/stop, optional soft chime when reminder fires.
- **Breast side toggle (L/R)** — store `side: 'left'|'right'|'both'` for breast feeds; show L/R chip. Still local-only.
- **Pause reasons**: quick chips “burp”, “diaper”, “pause” that get saved as `note` on the feed for later analytics.

## 3) Data Entry

- **[IMPLEMENTED] Quick Add Manual Feed** — a modal to log a feed that already happened (past start/end pickers, type, amounts). Critical because the timer is not always used (forgot to start, fed at grandma’s, etc.). Uses the same `generateFeedId` / `stampFeed` path so sync stays trivial.
- **Duplicate feed detection**: on save, warn if a feed with same `feedId` or near-identical `start` already exists.
- **One-tap “log last 15 min”**: mini button that inserts a bottle feed for `now-15m → now` with last-used bottle size — fastest path for “I just fed but forgot the timer”.

## 4) History & Insights

- **[IMPLEMENTED] Group feeds by day** — replace flat list with collapsible per-day sections (`Today / Yesterday / 2024-12-19`) with daily subtotals. Much more scannable once you have 50+ rows.
- **[IMPLEMENTED] Undo delete (single + delete all) with toast** — tombstones make deletes reversible for sync, but today `confirm()` is irreversible from the UI. Add a 5-6s toast “Feed deleted — Undo” that restores the pre-delete snapshot.
- **Daily Goal tracker** — user-configurable target (default 500-700ml) persisted in LocalForage; show a progress bar + “320 / 600 ml” in both the timer card and the “Today” summary. Celebrate when hit.
- **Per-day aggregation chart** — toggle in `feedingChart.svelte` between “per feed” and “per day” bars. Day view answers “is intake dropping?”.
- **Stats strip**: avg feeds/day (last 7d), avg interval, longest night stretch, avg milk/feed — all computed from `activeFeeds` no new storage.
- **Search / filter**: filter by `type`, date range, min ml. Nice when diagnosing “did we have a low-intake day?”.
- **Weekly summary export**: extra CSV `milk-feed-weekly-YYYY-MM-DD.csv` grouped by day.

## 5) Analytics & Predictions (still local)

- **Next-feed confidence bar**: current `medianFeedInterval` is solid; add a ± band (p25/p75) so “in 1h 30m” reads as “1h – 2h” when the pattern is noisy.
- **Night vs Day split**: show “night feeds: 2 (40%)” — helps spot when baby drops night feeds.
- **Trend arrows**: compare last 3 days vs previous 3 days for intake & frequency.

## 6) Import / Export & Data Hygiene

- **JSON backup/restore** — `feedsToCsv` is lossy (drops `updatedAt/deletedAt`). Add `feedsToJson` / `jsonToFeeds` for lossless backup that preserves sync tombstones, plus a “compact” button that hard-deletes tombstones older than 30d after confirmation.
- **Import preview** — before merging, show “12 new, 3 would overwrite, 0 skipped” and let user pick `merge vs replace`.
- **Auto-backup reminder**: if >7d since export, show a gentle banner.

## 7) Sharing / P2P

- **Copy phrase vs copy link**: SessionPanel currently copies the full URL; also offer “Copy phrase” (the 3-word code) for manual relay.
- **Session QR dark-mode aware**: ensure QR has white quiet zone in dark mode so it scans.
- **Connection quality dot**: `connected / connecting / idle` with retry countdown (already tracked in `session.ts:19`).

## 8) PWA & Platform

- **Install prompt**: capture `beforeinstallprompt`, show “Install MilkFeed” button when eligible.
- **Offline indicator**: tiny “Offline — changes will sync when back online” banner using `navigator.onLine` events.
- **Safe-area + 100dvh**: ensure bottom buttons aren’t hidden behind iOS home indicator (already partially handled with `env(safe-area-inset-*)`).

## 9) Accessibility & i18n

- **Keyboard**: Space → start/pause/stop, `n` → new manual feed, `?` → shortcuts sheet.
- **ARIA**: hamburger `aria-controls`, toast `role=status` + `aria-live=polite`, chart `role=img` with `aria-label`.
- **Reduced motion**: respect `prefers-reduced-motion` for spinner + zoom animation.
- **Internationalisation**: tempo already supports locales; expose a locale picker (date formats follow).

## 10) Code Health (not user-visible)

- Extract `BOTTLE_PRESETS` + `mlPerMinute` persistence into `lib/preferences.ts` so timer/chart/list don’t each touch LocalForage.
- Unify `activeFeeds(previousFeeds)` calls — the page passes both `previousFeeds` and `activeFeedsList`; children should pick one convention.
- Add `vitest` coverage for `dailyGoal` + `toast` + `groupByDay`.
- `svelte-check` in CI.

---

## What was implemented immediately

Chosen for **highest value / lowest risk** and **no new deps**:

1. **Wake Lock + live `document.title`** (`feedingTimer.svelte`)
2. **Daily Goal tracker** (`lib/dailyGoal.ts`, UI in `feedingTimer` + `previousFeedsList`)
3. **Quick Add Manual Feed** (`components/quickAddFeed.svelte`)
4. **Grouped-by-day history + Undo + Toast** (`lib/toast.ts`, `components/toast.svelte`, `previousFeedsList.svelte`)

All are local-only, additive, and keep the existing `stampFeed` / `mergeFeedsLWW` / tombstone sync model.

## Review follow-up (2026-10-05)

Implemented in the current working tree:

- Sync-safe Undo restores only feeds deleted by that action with fresh versions,
  retaining subsequent additions, edits, and deletions. Bulk deletion skips
  existing tombstones. Equal-version peer edits now resolve deterministically.
- Wake locks release on pause, hidden tabs, stop, and teardown, including late
  pending requests. The screen-awake badge reflects a granted lock. Haptics run
  only on timer actions; server rendering no longer accesses `document` at teardown.
- Quick Add resets dates on each opening, uses a native keyboard-accessible modal,
  validates amounts and dates, and respects the configured breast-feed estimate rate.
- Grouped history is collapsible, and Yesterday follows local calendar days across DST.
- Timer pin preference persists, reduced motion disables the timer spinner, edit
  form labels use unique IDs, and branding uses MilkFeed consistently.
- Lossless JSON feed backups preserve instants, versions, and tombstones. Import
  validates the whole JSON backup before merging and reports errors without changing history.
- Regression tests cover Undo, backup validation, concurrent sync versions, wake
  locks, daily goals, history, and toasts. CI checks types, tests, and Vercel builds.
- Deployment uses a pinned Vercel adapter and updated SvelteKit 2 with an explicit
  Node 24 runtime, avoiding adapter-auto v3's installation of obsolete adapter v4.

Deferred: tombstone compaction (can revive deleted feeds from long-offline peers),
medical intake recommendations, and broader analytics/UI additions.
