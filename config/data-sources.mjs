// Live data-source switches. The collector and every /api route check these before
// calling a venue API.
//
// Kalshi: ON. The owner confirmed on Nov 9, 2026 that Kalshi has given permission to use
// its API data in Banthom (developer agreement v1.1 §3.1/§3.7 require prior written
// authorization). Keep the written authorization with the project files.
// Set KALSHI_ENABLED=false to switch Kalshi data off without a code change.
//
// Polymarket: OFF unless POLYMARKET_ENABLED=true. No Polymarket integration exists yet.
const flag = (v, fallback) => {
  if (v == null || v === '') return fallback;
  return !['false', '0', 'off', 'no'].includes(String(v).trim().toLowerCase());
};

export const dataSources = {
  kalshi: {
    enabled: flag(process.env.KALSHI_ENABLED, true),
    basis: 'Owner-confirmed Kalshi permission, Nov 9, 2026',
  },
  polymarket: {
    enabled: flag(process.env.POLYMARKET_ENABLED, false),
  },
};

export const sourceFlags = () => Object.fromEntries(Object.entries(dataSources).map(([k, v]) => [k, v.enabled]));

export function assertSourceEnabled(name) {
  if (!dataSources[name]?.enabled) throw new Error(`Data source "${name}" is disabled`);
}
