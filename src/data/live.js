// Live data from the Banthom server (Kalshi). The server injects window.__BANTHOM__ into the
// page; without it (for example the static prototype), live data is off and nothing is fetched.
import React from 'react';
import { isNum } from '../lib/format.js';

const { useState, useEffect, useCallback, useSyncExternalStore } = React;

const CFG = (typeof window !== 'undefined' && window.__BANTHOM__) || null;
export const LIVE = !!(CFG && CFG.dataSources && CFG.dataSources.kalshi && CFG.kalshi);
export const LIVE_CFG = (CFG && CFG.kalshi) || { refreshSeconds: 180, recentSeconds: 360, categories: [] };

export const API = {
  list: '/api/kalshi/markets',
  market: (t) => `/api/kalshi/markets/${encodeURIComponent(t)}`,
  book: (t) => `/api/kalshi/markets/${encodeURIComponent(t)}/orderbook`,
  history: (t, r) => `/api/kalshi/markets/${encodeURIComponent(t)}/history?range=${r}`,
};
export const kalshiSeriesUrl = (series) => `https://kalshi.com/markets/${encodeURIComponent(String(series || '').toLowerCase())}`;

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
export function usePolled(url, intervalMs) {
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
  return { data: current ? st.data : null, error: current ? st.error : null, loading: !current || (!st.data && !st.error), retry };
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

export function liveFreshness(observedAt, now) {
  if (!isNum(observedAt)) return { status: 'none', age: null };
  const age = Math.max(0, now - observedAt);
  return { status: age <= LIVE_CFG.recentSeconds * 1000 ? 'recent' : 'delayed', age };
}

export const midOf2 = (b, a) => (isNum(b) && isNum(a) ? (b + a) / 2 : null);
// 24h change in the Yes midpoint, from Kalshi's quotes as of one day earlier.
export function change24(m) {
  const now = midOf2(m.bid, m.ask);
  const prev = midOf2(m.prevBid, m.prevAsk);
  return isNum(now) && isNum(prev) ? Math.round((now - prev) * 10) / 10 : null;
}
