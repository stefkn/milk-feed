# milk-feed

MilkFeed is a minimalist baby feed logging app built with SvelteKit. It uses:

- 🛠️ SvelteKit for the framework
- 📦 Vite for the build tool
- 🌬️ Tailwind & Flowbite CSS for styling
- 🔼 Vercel for deployment
- 💾 LocalForage for data persistence
- ⏰ formkit/tempo for handling time
- 🖨️ csv-generate for .csv export
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
