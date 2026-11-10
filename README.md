# Banthom prototype

Clickable front-end prototype of the Banthom marketing site and research terminal, built from
`DESIGN_SPEC.md` v1.0 (Signal Terminal handoff). All data is simulated; both venues are fictional.
See `BUILD_NOTES.md` for decisions, spec conflicts and what is not built.

## Build

```
npm install
npm run build        # writes dist/banthom.html (single self-contained page)
```

React 18.3.1 and IBM Plex load from public CDNs at runtime. Everything else is inlined.
`npm run icons` regenerates `src/icons.js` from the Lucide set in `react-icons`.

## Layout

- `src/data/` deterministic fixtures, price histories (5-minute observations, gaps kept as gaps), simulated quote feed
- `src/lib/` ET time handling, number formatting (cents, percentage points, data age), hooks
- `src/ui/` primitives (buttons, badges, status indicators, tabs, sheets, menus, toasts)
- `src/charts/` price chart with crosshair, keyboard reading and table view; sparkline; order-book ladder
- `src/marketing/` public pages; `src/terminal/` shell and terminal screens
- `src/styles/` tokens and styles, concatenated in filename order
- `build/check.mjs` and `build/interact.mjs` are the Playwright checks used during the build (they expect a local React test shim from `build/shim.mjs`)

## Live Kalshi data

Kalshi data is **on** (owner confirmed Kalshi's permission on Nov 9, 2026; keep the written
authorization with the project). The terminal gets a **Kalshi live** section (`#app-live`): a list
of every open Kalshi market (Kalshi's multi-leg combo markets excepted), and a page per market with
live quotes, price history, order book and Kalshi's rule text. All other screens still use the
simulated demo data and say so.

- `server/kalshi.mjs` polls Kalshi's public Trade API v2 (no API key needed) every 3 minutes and
  fetches a market's quote, order book and candles on demand while its page is open. Search,
  category filter, sorting and paging run on the server (`/api/kalshi/markets?q=&category=&sort=&dir=&limit=`),
  because the full set is too large to send to a browser.
- Prices are converted to cents; a missing bid or ask is shown as —, never filled in. Data older
  than 2× the refresh interval plus 2 minutes (8 minutes by default) is labelled Delayed.
- `config/data-sources.mjs` holds the switch. `KALSHI_ENABLED=false` turns Kalshi off.

API: `/api/kalshi/markets`, `/api/kalshi/markets/:ticker`, `…/orderbook`, `…/history?range=1D|1W|1M|ALL`,
`/api/kalshi/status`, plus `/healthz` and `/api/config`.

## Live Polymarket data

Polymarket (polymarket.com) data is **on** (owner reported clearance for the Polymarket APIs on
Nov 6, 2026). The terminal gets a **Polymarket live** section (`#app-poly`) built from the same
pages as Kalshi: every open market, with live quotes, price history, order book and the market's
own resolution text.

- `server/polymarket.mjs` walks Gamma's `/markets/keyset` (v1 and v2 markets, 100 per page) every
  3 minutes; order books come from the CLOB API (`/book`) and price history from the Data API
  (`/v2/prices-history`), fetched on demand. All are public and need no API key.
- Prices are USDC per share, shown in cents. Polymarket US (the CFTC-regulated exchange) is a
  separate venue with its own approved-member API and is not connected.
- `POLYMARKET_ENABLED=false` turns it off. API: `/api/polymarket/…` with the same routes as Kalshi.

## Deploy (Railway)

Railway builds this repo with its default builder (Railpack) and needs no config file: it runs
`npm install`, `npm run build` (writes `dist/banthom.html`) and `npm start` (`node server.mjs`,
listening on `$PORT`).

1. Railway → New project → Deploy from GitHub repo → `rmcinerney4/Banthom`.
2. Service → Settings → Networking → Generate domain.
3. Optional: Settings → Deploy → Healthcheck path `/healthz`.
4. Optional variables: see `.env.example`. No variables are needed for Kalshi to be on.

Railway's old `railway.json` ("Config as Code") is not read for new services and stops being read
on Dec 1, 2026, so this repo doesn't use it.
