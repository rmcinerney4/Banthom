// Polymarket public market data for Banthom (polymarket.com, the international venue).
//
// A background collector keeps a snapshot of every open Polymarket market from the Gamma API.
// Detail endpoints fetch one market, its order book (CLOB API) and price history (Data API)
// on demand. These endpoints are public and need no API key (docs.polymarket.com).
//
// Polymarket prices are USDC per share, 0–1. Everything here is converted to cents so the
// pages read the same as Kalshi's. A missing bid or ask stays null and is never filled in.

import { buildIndex, runQuery, byActivity, mem } from './list-index.mjs';

const env = process.env;
const GAMMA = (env.POLYMARKET_GAMMA_BASE || 'https://gamma-api.polymarket.com').replace(/\/+$/, '');
const CLOB = (env.POLYMARKET_CLOB_BASE || 'https://clob.polymarket.com').replace(/\/+$/, '');
const DATA = (env.POLYMARKET_DATA_BASE || 'https://data-api.polymarket.com').replace(/\/+$/, '');
const int = (v, d, lo, hi) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
export const REFRESH_S = int(env.POLYMARKET_REFRESH_SECONDS, 180, 30, 3600);
export const RECENT_S = 2 * REFRESH_S + 120;
const UA = 'Banthom/0.3 (prediction-market research terminal)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Requests
// Polymarket's limits are per 10 seconds and throttle rather than reject. One collector
// request at a time (the keyset cursor is sequential) and a small lane for page views.
function lane(spacingMs, concurrency) {
  let active = 0;
  let last = 0;
  let timer = null;
  const queue = [];
  const pump = () => {
    timer = null;
    while (active < concurrency && queue.length) {
      const wait = last + spacingMs - Date.now();
      if (wait > 0) { timer = setTimeout(pump, wait); return; }
      last = Date.now();
      const job = queue.shift();
      active++;
      job().finally(() => { active--; if (!timer) pump(); });
    }
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push(() => fn().then(resolve, reject));
    if (!timer) pump();
  });
}
const background = lane(60, 1);
const interactive = lane(40, 4);

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function getJSON(base, path, params, run = background) {
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
    else if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  for (let attempt = 0; ; attempt++) {
    try {
      return await run(async () => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 25000);
        try {
          const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: ctrl.signal });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new HttpError(res.status, `Polymarket ${res.status} on ${path}${text ? `: ${text.slice(0, 160)}` : ''}`);
          }
          return await res.json();
        } finally {
          clearTimeout(timer);
        }
      });
    } catch (err) {
      const retry = !(err instanceof HttpError) || err.status === 429 || err.status >= 500;
      if (!retry || attempt >= 3) throw err;
      await sleep(1000 * 2 ** attempt + Math.random() * 400);
    }
  }
}

// ---------------------------------------------------------------- Parsing
const num = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const round4 = (v) => Math.round(v * 1e4) / 1e4;
const cents = (p) => { const n = num(p); return n == null ? null : round4(n * 100); };
const quote = (c) => (c != null && c > 0 && c < 100 ? c : null);
const ts = (iso) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};
const jsonList = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string' || !v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; }
};
const tokensOf = (m) => (m.version === 'v2' ? jsonList(m.positionIds) : jsonList(m.clobTokenIds)).map(String);
const isOpen = (m) => !m.closed && m.active !== false && !m.archived && m.enableOrderBook !== false;

function eventOf(m) {
  const e = (Array.isArray(m.events) && m.events[0]) || {};
  const tag = Array.isArray(e.tags) && e.tags.find((t) => t && t.label);
  return {
    ticker: String(e.id || `m${m.id}`),
    title: e.title || m.question || String(m.id),
    sub: e.subtitle || '',
    category: e.category || m.category || (tag && tag.label) || 'Other',
    slug: e.slug || m.slug || '',
    exclusive: !!(e.negRisk || e.enableNegRisk),
  };
}

function compactMarket(m, observedAt) {
  const bid = quote(cents(m.bestBid));
  const ask = quote(cents(m.bestAsk));
  const ch = num(m.oneDayPriceChange);
  return {
    ticker: String(m.id),
    event: eventOf(m).ticker,
    label: m.groupItemTitle || m.question || String(m.id),
    bid,
    ask,
    bidSize: null,
    askSize: null,
    last: quote(cents(m.lastTradePrice)),
    prevBid: null,
    prevAsk: null,
    ch24: ch == null ? null : Math.round(ch * 1000) / 10,
    vol24: num(m.volume24hr),
    oi: null,
    closes: ts(m.endDate || m.endDateIso),
    observedAt,
  };
}
const mid2 = (b, a) => (b != null && a != null ? (b + a) / 2 : null);

// ---------------------------------------------------------------- Collector
const state = {
  startedAt: Date.now(),
  events: new Map(),
  markets: new Map(),
  byEvent: new Map(),
  lastPassAt: null,
  lastSuccessAt: null,
  lastPassMs: null,
  consecutiveFailures: 0,
  lastError: null,
  index: null,
};

function noteError(err, phase) {
  state.lastError = { phase, message: String((err && err.message) || err).slice(0, 300), at: Date.now() };
  console.warn(`[polymarket] ${phase} failed: ${state.lastError.message}`);
}

// Updates the snapshot in place (no second copy during a pass). Keyset paging is sequential.
async function runPass() {
  const t0 = Date.now();
  const seen = new Set();
  const byEvent = new Map();
  let cursor = '';
  let pages = 0;
  do {
    const data = await getJSON(GAMMA, '/markets/keyset', { closed: 'false', limit: 100, version: ['v1', 'v2'], after_cursor: cursor });
    const at = Date.now();
    for (const m of data.markets || []) {
      if (!m || m.id == null || !isOpen(m)) continue;
      const c = compactMarket(m, at);
      c.mid = mid2(c.bid, c.ask);
      const cur = state.markets.get(c.ticker);
      if (cur) Object.assign(cur, c); else state.markets.set(c.ticker, c);
      seen.add(c.ticker);
      const ev = eventOf(m);
      const curE = state.events.get(ev.ticker);
      if (!curE) state.events.set(ev.ticker, ev);
      else if (!byEvent.has(ev.ticker)) Object.assign(curE, ev);
      const list = byEvent.get(ev.ticker);
      if (list) list.push(c.ticker); else byEvent.set(ev.ticker, [c.ticker]);
    }
    cursor = data.next_cursor || '';
    pages++;
  } while (cursor && pages < 5000);
  // Full pass completed: drop markets and events that are no longer open.
  for (const t of state.markets.keys()) if (!seen.has(t)) state.markets.delete(t);
  for (const t of state.events.keys()) if (!byEvent.has(t)) state.events.delete(t);
  const done = Date.now();
  Object.assign(state, { byEvent, index: null, lastPassAt: done, lastSuccessAt: done, lastPassMs: done - t0, lastError: null });
  console.log(`[polymarket] ${state.markets.size} markets in ${state.events.size} events (${pages} pages) in ${((done - t0) / 1000).toFixed(1)}s · ${mem()}`);
}

let started = false;
export function start() {
  if (started) return;
  started = true;
  console.log(`[polymarket] collector on: ${new URL(GAMMA).host}, every ${REFRESH_S}s`);
  (async () => {
    for (;;) {
      const t0 = Date.now();
      try {
        await runPass();
        state.consecutiveFailures = 0;
      } catch (err) {
        state.consecutiveFailures++;
        state.index = null;
        noteError(err, 'markets');
      }
      const wait = state.consecutiveFailures
        ? Math.min(REFRESH_S * 1000, 15000 * 2 ** Math.min(state.consecutiveFailures - 1, 4))
        : Math.max(5000, REFRESH_S * 1000 - (Date.now() - t0));
      await sleep(wait);
    }
  })();
}

export const clientConfig = () => ({ refreshSeconds: REFRESH_S, recentSeconds: RECENT_S, categories: [] });

export function status() {
  return {
    source: 'Polymarket',
    api: new URL(GAMMA).host,
    refreshSeconds: REFRESH_S,
    recentSeconds: RECENT_S,
    categories: [],
    startedAt: state.startedAt,
    lastPassAt: state.lastPassAt,
    lastSuccessAt: state.lastSuccessAt,
    lastPassSeconds: state.lastPassMs == null ? null : Math.round(state.lastPassMs / 100) / 10,
    events: state.events.size,
    markets: state.markets.size,
    failedBatches: 0,
    consecutiveFailures: state.consecutiveFailures,
    lastError: state.lastError,
  };
}

// ---------------------------------------------------------------- List queries
const clean = (m) => { const { mid, ...rest } = m; return rest; };

export function listQuery(params) {
  if (!state.index) state.index = buildIndex(state.markets, state.events, `${state.lastPassAt || 0}-${state.consecutiveFailures}`);
  return runQuery(state.index, params, {
    tag: 'p', events: state.events, byEvent: state.byEvent, status, clean,
    eventInfo: (e) => ({ title: e.title, sub: e.sub, category: e.category, slug: e.slug, exclusive: e.exclusive }),
  });
}

// ---------------------------------------------------------------- On-demand detail
const caches = { market: new Map(), book: new Map(), history: new Map() };

function cached(map, key, ttl, fn, max = 400) {
  const hit = map.get(key);
  if (hit && hit.value !== undefined && Date.now() - hit.at < ttl) return Promise.resolve(hit.value);
  if (hit && hit.pending) return hit.pending;
  const pending = fn().then(
    (value) => {
      map.delete(key);
      map.set(key, { at: Date.now(), value });
      while (map.size > max) map.delete(map.keys().next().value);
      return value;
    },
    (err) => {
      if (hit && hit.value !== undefined) map.set(key, { at: hit.at, value: hit.value });
      else map.delete(key);
      throw err;
    },
  );
  map.set(key, { ...(hit || {}), pending });
  return pending;
}

const fmtUsd = (n) => (n == null ? null : `$${Math.round(n).toLocaleString('en-US')}`);

function loadMarket(id) {
  return cached(caches.market, id, 10e3, async () => {
    const m = await getJSON(GAMMA, `/markets/${encodeURIComponent(id)}`, null, interactive);
    if (!m || m.id == null) throw new HttpError(404, 'Market not found');
    return m;
  });
}

export async function marketDetail(id) {
  const m = await loadMarket(id);
  const at = Date.now();
  const c = compactMarket(m, at);
  const ev = eventOf(m);
  const outcomes = jsonList(m.outcomes).map(String);
  const yes = outcomes[0] || 'Yes';
  const no = outcomes[1] || 'No';
  const status = m.closed ? 'closed' : m.acceptingOrders === false ? 'paused' : 'active';
  const facts = [
    ['Trading closes', { date: ts(m.endDate || m.endDateIso) }],
    ['Outcomes', yes === 'Yes' && no === 'No' ? null : `“${yes}” is shown as Yes; “${no}” as No`],
    ['Settlement', '$1.00 USDC per winning share'],
    ['Minimum tick', num(m.orderPriceMinTickSize) != null ? `${round4(num(m.orderPriceMinTickSize) * 100)}¢` : null],
    ['Liquidity', fmtUsd(num(m.liquidityNum ?? m.liquidity))],
    ['Total volume', fmtUsd(num(m.volumeNum ?? m.volume))],
    ['Resolution status', m.umaResolutionStatus || null],
  ].filter(([, v]) => v != null && !(v.date === null));
  const source = String(m.resolutionSource || (m.events && m.events[0] && m.events[0].resolutionSource) || '').trim();
  const siblings = (state.byEvent.get(ev.ticker) || []).filter((t) => t !== c.ticker).map((t) => state.markets.get(t)).filter(Boolean)
    .sort(byActivity).slice(0, 60).map(clean);
  return {
    market: {
      ...c,
      status,
      yesLabel: yes,
      noLabel: no,
      rules: String(m.description || ''),
      facts,
      resolutionSource: /^https?:\/\//.test(source) ? { name: new URL(source).host, url: source } : source ? { name: source, url: null } : null,
      slug: m.slug || '',
      opens: ts(m.startDate || m.startDateIso),
      updatedAt: ts(m.updatedAt),
    },
    event: { ...ev, series: null, sources: [] },
    series: null,
    siblings,
  };
}

// Token ids are long; they're read from the (cached) market instead of being kept for every market.
async function yesToken(id) {
  const m = await loadMarket(id);
  const t = tokensOf(m)[0];
  if (!t) throw new HttpError(404, 'No order book for this market');
  return t;
}

export function orderbook(id) {
  return cached(caches.book, id, 8e3, async () => {
    const token = await yesToken(id);
    const data = await getJSON(CLOB, '/book', { token_id: token }, interactive);
    const levels = (arr) => (Array.isArray(arr) ? arr : [])
      .map((l) => ({ price: cents(l.price), size: num(l.size) }))
      .filter((l) => l.price != null && l.size != null && l.size > 0);
    // Polymarket lists bids ascending and asks descending (best last); show best first.
    return {
      ticker: id,
      bids: levels(data.bids).sort((a, b) => b.price - a.price).slice(0, 10),
      asks: levels(data.asks).sort((a, b) => a.price - b.price).slice(0, 10),
      observedAt: Date.now(),
    };
  });
}

const RANGES = {
  '1D': { interval: '1d', bucket: 60, ttl: 60e3, sampling: '1-minute prices' },
  '1W': { interval: '1w', bucket: 3600, ttl: 5 * 60e3, sampling: 'Hourly prices' },
  '1M': { interval: '1m', bucket: 3600, ttl: 15 * 60e3, sampling: 'Hourly prices' },
  ALL: { interval: 'max', bucket: 86400, ttl: 30 * 60e3, sampling: 'Daily prices' },
};

export async function history(id, rangeId) {
  const key = RANGES[rangeId] ? rangeId : '1W';
  const r = RANGES[key];
  return cached(caches.history, `${id}|${key}`, r.ttl, async () => {
    const token = await yesToken(id);
    const points = [];
    let cursor = '';
    for (let page = 0; page < 5; page++) {
      const data = await getJSON(DATA, '/v2/prices-history', cursor ? { token_id: token, cursor } : { token_id: token, interval: r.interval, bucket_seconds: r.bucket }, interactive);
      for (const p of data.data || []) {
        const t = num(p.timestamp);
        const v = cents(p.price);
        if (t != null) points.push({ t: t * 1000, mid: v != null && v >= 0 && v <= 100 ? v : null });
      }
      const pg = data.pagination || {};
      if (!pg.has_more || !pg.next_cursor) break;
      cursor = pg.next_cursor;
    }
    points.sort((a, b) => a.t - b.t);
    const now = Date.now();
    const spans = { '1D': 86400e3, '1W': 7 * 86400e3, '1M': 30 * 86400e3 };
    return {
      ticker: id, range: key, interval: r.bucket / 60, sampling: r.sampling,
      from: spans[key] ? now - spans[key] : (points[0] ? points[0].t : now - 86400e3), to: now,
      points, observedAt: now,
    };
  });
}
