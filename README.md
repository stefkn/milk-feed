# milk-feed

MilkFeed is a minimalist baby feed logging app built with SvelteKit. It uses:

- 🛠️ SvelteKit for the framework
- 📦 Vite for the build tool
- 🌬️ Tailwind & Flowbite CSS for styling
- 🔼 Vercel for deployment
- 💾 LocalForage for data persistence
- ⏰ formkit/tempo for handling time
- 📊 Chart.js for analytics
- 🧪 vitest for unit tests

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.

## Data and backups

Use **Add feed manually** to log a past bottle or breast feed. History groups can
be collapsed by day, and deletion toasts offer Undo for six seconds.

**Export CSV** exports active feeds for spreadsheet use. **Export JSON backup**
also preserves sync versions and deleted-feed tombstones. Import either format
from the menu. JSON imports merge with the current history: newer local or peer
versions win, so restoring an older backup does not revive deleted feeds. JSON
backups contain feed history; device preferences are stored separately.

## Verification and deployment

Use Node.js 24, then run `npm ci`, `npm run check`, `npm test -- --run`, and
`npm run build`. CI runs these checks for pushes and pull requests.

The app uses a pinned Vercel adapter and an explicit `nodejs24.x` runtime. Build
output is written to `.vercel/output`; the adapter is installed from the lockfile
rather than downloaded dynamically during deployment.
