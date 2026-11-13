# Trade Journal

A self-hosted journal for crypto futures traders. Import your Binance history, review every trade, track P2P cash flow in and out of the exchange, and see which sessions and habits actually make you money.

Built with **SvelteKit 2 (Svelte 5 runes)** on the front end and **Convex** as a reactive, typed backend.

## Features

- **Dashboard**: PnL calendar with daily totals that match Binance, win rate and equity stats, and a UTC/local timezone toggle that re-buckets trades into the right calendar day.
- **Trades**
  - Import Binance Futures _Trade History_ CSV exports. Partial fills are merged into one position and duplicates are skipped by order ID.
  - Combine partial closes into a single trade group with net PnL and remaining quantity.
  - Journal fields for strategy, timeframes, confidence, risk %, and pre-/post-trade notes.
- **P2P Ledger**
  - Import Binance C2C order history.
  - Track fiat deposits and withdrawals, and allocate withdrawals against the deposits they release (many-to-many), so you always know your open balance.
- **Liquidations**: log liquidations manually or from a trade marked as liquidated, and keep them in sync with the trade log.
- **Sessions**: break down performance by market session (Asian, London, NY, overnight, or your own custom window), with a daily journal.
- **Mistakes**: keep a journal of recurring mistakes and link them to trades.
- **Auth and multi-user**: email/password sign-in via Convex Auth. Every query and mutation is scoped to the signed-in user.
- Light and dark themes, and a collapsible sidebar.

## Tech stack

| Layer    | Choice                                                    |
| -------- | --------------------------------------------------------- |
| Frontend | SvelteKit 2, Svelte 5, Tailwind CSS 4, Chart.js           |
| Backend  | Convex (database, server functions, auth)                 |
| Auth     | `@convex-dev/auth` (Password provider) + httpOnly cookies |
| Parsing  | PapaParse                                                 |
| Testing  | Vitest + `convex-test` (in-memory backend)                |
| Hosting  | Vercel (`adapter-vercel`)                                 |

## Project structure

```
convex/              Backend: schema, queries and mutations, auth
  lib/               Shared domain logic (trade grouping, import, liquidation sync)
  *.test.ts          Backend tests running against an in-memory Convex
src/
  hooks.server.ts    Session handling and token refresh
  lib/utils/         Binance / C2C CSV parsers, session helpers
  lib/components/    Sidebar, theme toggle, loaders
  routes/(app)/      Authenticated pages: dashboard, trades, ledger, ...
  routes/api/        CSV import endpoints
```

## Getting started

**Prerequisites:** Node.js 20+ and a free [Convex](https://convex.dev) account.

```sh
git clone <this-repo>
cd trade-journal
npm install
```

1. **Start Convex.** This creates a dev deployment and writes `CONVEX_DEPLOYMENT` and the URL to `.env.local`:

   ```sh
   npx convex dev
   ```

2. **Configure auth** on the Convex deployment. This one-time step generates `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL`:

   ```sh
   npx @convex-dev/auth
   ```

3. **Set the app's env vars.** Copy `.env.example` to `.env` and set `PUBLIC_CONVEX_URL` to your deployment URL.

4. **Run the app** in a second terminal:

   ```sh
   npm run dev
   ```

   Open <http://localhost:5173> and create an account.

## Importing data

| Data             | Where to export it in Binance                   | Import page      |
| ---------------- | ----------------------------------------------- | ---------------- |
| Futures trades   | Orders → Futures → Trade History → Export (CSV) | `/trades/import` |
| P2P / C2C orders | Orders → P2P → Order History → Export (CSV)     | `/ledger/import` |

Imports run in your browser, and the parsed rows are sent to your own Convex deployment. You can re-import the same file safely, because rows whose order ID already exists are skipped.

## Scripts

| Command          | Purpose                      |
| ---------------- | ---------------------------- |
| `npm run dev`    | Start the dev server         |
| `npm run build`  | Production build             |
| `npm test`       | Run backend and parser tests |
| `npm run check`  | Type-check (svelte-check)    |
| `npm run lint`   | Prettier + ESLint            |
| `npm run format` | Format with Prettier         |

## Deployment

1. Deploy the backend:

   ```sh
   npx convex deploy
   ```

2. Import the repo into Vercel and set `PUBLIC_CONVEX_URL` to the production deployment URL.
3. On the production Convex deployment, set `SITE_URL` to your Vercel domain:

   ```sh
   npx convex env set SITE_URL https://your-app.vercel.app --prod
   ```

## License

[MIT](LICENSE)

## Disclaimer

This is a personal journaling tool, not financial advice. It is not affiliated with Binance.
