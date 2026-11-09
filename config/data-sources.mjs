// Live data-source switches. Any future collector or API route MUST check these
// before calling a venue API.
//
// Kalshi stays OFF until Kalshi's prior written authorization (developer agreement
// v1.1, §3.1/§3.7) or counsel's written reasoning is on file with the project.
// Only an explicit KALSHI_ENABLED=true AND a recorded basis turn it on.
const truthy = (v) => String(v || '').toLowerCase() === 'true';

export const dataSources = {
  kalshi: {
    enabled: truthy(process.env.KALSHI_ENABLED) && Boolean(process.env.KALSHI_AUTHORIZATION_REF),
    reason: 'Awaiting Kalshi written authorization for third-party data use',
  },
  polymarket: {
    enabled: truthy(process.env.POLYMARKET_ENABLED),
  },
};

export function assertSourceEnabled(name) {
  if (!dataSources[name]?.enabled) throw new Error(`Data source "${name}" is disabled`);
}
