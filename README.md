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

## Deploy (Railway)

`railway.json` builds with `npm run build` and starts `node server.mjs`, which serves
`dist/banthom.html` on `$PORT` with a health check at `/healthz` and flags at `/api/config`.

**Kalshi data is off.** `config/data-sources.mjs` enables Kalshi only when
`KALSHI_ENABLED=true` *and* `KALSHI_AUTHORIZATION_REF` (a reference to Kalshi's written
authorization) are both set. Leave them unset on Railway until that authorization is on file.
