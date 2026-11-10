// Live data from the Banthom server (Kalshi). The server injects window.__BANTHOM__ into the
// page; without it (for example the static prototype), live data is off and nothing is fetched.
import React from 'react';
import { isNum } from '../lib/format.js';

const { useState, useEffect, useCallback, useSyncExternalStore } = React;

const CFG = (typeof window !== 'undefined' && window.__BANTHOM__) || null;
const on = (k) => !!(CFG && CFG.dataSources && CFG.dataSources[k] && CFG[k]);
const DEFAULT_CFG = { refreshSeconds: 180, recentSeconds: 480, categories: [] };

const api = (base) => ({
  status: `${base}/status`,
  list: (p) => `${base}/markets?${new URLSearchParams(p)}`,
  market: (t) => `${base}/markets/${encodeURIComponent(t)}`,
  book: (t) => `${base}/markets/${encodeURIComponent(t)}/orderbook`,
  history: (t, r) => `${base}/markets/${encodeURIComponent(t)}/history?range=${r}`,
});

// Per-venue wording and links for the live pages.
export const LIVE_VENUES = {
  kalshi: {
    id: 'kalshi', name: 'Kalshi', code: 'KAL', route: 'live', navLabel: 'Kalshi live', enabled: on('kalshi'), cfg: (CFG && CFG.kalshi) || DEFAULT_CFG,
    api: api('/api/kalshi'), site: 'https://kalshi.com', siteLabel: 'Kalshi.com',
    marketUrl: (ev) => (ev && ev.series ? `https://kalshi.com/markets/${encodeURIComponent(String(ev.series).toLowerCase())}` : 'https://kalshi.com'),
    volBasis: 'ct', volSub: 'Contracts', sizeUnit: 'contracts', unitNote: 'US cents per $1 contract', idLabel: 'Market ticker',
    sourceName: 'Kalshi public market data (Trade API v2)', priceUnits: 'US cents per contract ($1.00 payout)',
    histSeries: 'midpoint', histNote: 'Midpoint of Kalshi’s closing Yes bid and ask in each candle.',
    bookNote: 'Kalshi lists bids only. Yes asks are 100¢ minus No bids.',
    listNote: 'Kalshi’s multi-leg combo markets aren’t included.', ch24Sub: 'Yes midpoint',
  },
  polymarket: {
    id: 'polymarket', name: 'Polymarket', code: 'PM', route: 'poly', navLabel: 'Polymarket live', enabled: on('polymarket'), cfg: (CFG && CFG.polymarket) || DEFAULT_CFG,
    api: api('/api/polymarket'), site: 'https://polymarket.com', siteLabel: 'Polymarket.com',
    marketUrl: (ev) => (ev && ev.slug ? `https://polymarket.com/event/${encodeURIComponent(ev.slug)}` : 'https://polymarket.com'),
    volBasis: 'usd', volSub: 'USDC', sizeUnit: 'shares', unitNote: 'cents per share ($1.00 USDC payout)', idLabel: 'Market id',
    sourceName: 'Polymarket public market data (Gamma, CLOB and Data APIs)', priceUnits: 'Cents per share ($1.00 USDC payout)',
    histSeries: 'price', histNote: 'Polymarket’s recorded Yes price in each interval.',
    bookNote: 'Order book for the Yes outcome token on Polymarket’s CLOB.',
    listNote: 'Prices are in USDC; 1¢ = $0.01.', ch24Sub: 'Polymarket’s 24h price change',
  },
};
export const LIVE_LIST = Object.values(LIVE_VENUES).filter((v) => v.enabled);
export const LIVE = LIVE_LIST.length > 0;
export const venueByRoute = (r) => Object.values(LIVE_VENUES).find((v) => v.route === r) || null;

// Server clock offset, so data ages don't depend on the viewer's clock being right.
let skew = 0;
export const serverNow = () => Date.now() + skew;

async function getJSON(url, signal) {
  const res = await fetch(url, { signal, headers: { accept: 'application/json' }, cache: 'no-cache' });
  const st = Number(res.headers.get('x-server-time'));
  if (Number.isFinite(st) && st > 0) skew = st - Date.now();
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) {
    const err = new Error((body && body.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

// Fetch a URL and poll it. Keeps the last good data when a refresh fails.
export function usePolled(url, intervalMs, { keep = false } = {}) {
  const [st, setSt] = useState({ url: null, data: null, error: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!url) return undefined;
    let alive = true;
    let timer = null;
    let ctrl = null;
    const run = async () => {
      ctrl = new AbortController();
      try {
        const data = await getJSON(url, ctrl.signal);
        if (alive) setSt({ url, data, error: null });
      } catch (err) {
        if (alive && err.name !== 'AbortError') setSt((s) => ({ url, data: s.url === url ? s.data : null, error: err }));
      }
      if (alive && intervalMs) timer = setTimeout(run, document.hidden ? intervalMs * 4 : intervalMs);
    };
    run();
    return () => { alive = false; clearTimeout(timer); if (ctrl) ctrl.abort(); };
  }, [url, intervalMs, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const current = st.url === url;
  return { data: current || keep ? st.data : null, error: current ? st.error : null, loading: !current || (!st.data && !st.error), retry };
}

// One-second real clock (the demo screens use a simulated clock instead).
const clock = { now: serverNow(), subs: new Set(), timer: null };
function subscribe(cb) {
  clock.subs.add(cb);
  if (!clock.timer) clock.timer = setInterval(() => { clock.now = serverNow(); clock.subs.forEach((f) => f()); }, 1000);
  return () => {
    clock.subs.delete(cb);
    if (!clock.subs.size && clock.timer) { clearInterval(clock.timer); clock.timer = null; }
  };
}
export const useRealNow = () => useSyncExternalStore(subscribe, () => clock.now, () => clock.now);

export function liveFreshness(observedAt, now, recentSeconds = DEFAULT_CFG.recentSeconds) {
  if (!isNum(observedAt)) return { status: 'none', age: null };
  const age = Math.max(0, now - observedAt);
  return { status: age <= recentSeconds * 1000 ? 'recent' : 'delayed', age };
}

export const midOf2 = (b, a) => (isNum(b) && isNum(a) ? (b + a) / 2 : null);
// 24h change in the Yes midpoint, from Kalshi's quotes as of one day earlier.
export function change24(m) {
  if (isNum(m.ch24)) return m.ch24;
  const now = midOf2(m.bid, m.ask);
  const prev = midOf2(m.prevBid, m.prevAsk);
  return isNum(now) && isNum(prev) ? Math.round((now - prev) * 10) / 10 : null;
}
