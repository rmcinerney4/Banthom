// Kalshi public market data for Banthom.
//
// A background collector keeps a snapshot of open Kalshi markets in the categories Banthom
// covers. Detail endpoints fetch one market's quote, order book and price history on demand.
// Kalshi's market-data endpoints need no API key (docs.kalshi.com, Trade API v2).
//
// Kalshi returns prices as dollar strings ("0.5600") and sizes as fixed-point counts
// ("13.00"). Everything here is converted to US cents and plain numbers. A missing bid or
// ask stays null and is never filled in.

import { buildIndex, runQuery, byActivity, mem } from './list-index.mjs';

const env = process.env;
const BASE = (env.KALSHI_API_BASE || 'https://external-api.kalshi.com/trade-api/v2').replace(/\/+$/, '');
const int = (v, d, lo, hi) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
export const REFRESH_S = int(env.KALSHI_REFRESH_SECONDS, 180, 30, 3600);
// A full pass over every open Kalshi market can take a couple of minutes, so allow for it.
export const RECENT_S = 2 * REFRESH_S + 120;
const CATEGORIES = (env.KALSHI_CATEGORIES || 'all')
  .split(',').map((s) => s.trim()).filter(Boolean);
const ALL = CATEGORIES.some((c) => c.toLowerCase() === 'all');
const ALLOWED = new Set(CATEGORIES.map((c) => c.toLowerCase()));
const SERIES_TTL = 6 * 3600e3;
const BATCH = 20; // event tickers per request
const UA = 'Banthom/0.2 (prediction-market research terminal)';
const ACTIVE = new Set(['active', 'open']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Requests
// Two lanes keep Banthom well under Kalshi's basic read budget (about 20 requests a second):
// the collector runs one request at a time, page views get their own small lane.
// Kalshi answers bursts of public requests with 429, so every lane slows to a quarter of its
// pace for a minute after any 429 (and honours Retry-After when Kalshi sends it).
let slowUntil = 0;
function lane(spacingMs, concurrency) {
  let active = 0;
  let last = 0;
  let timer = null;
  const queue = [];
  const pump = () => {
    timer = null;
    while (active < concurrency && queue.length) {
      const wait = last + (Date.now() < slowUntil ? spacingMs * 4 : spacingMs) - Date.now();
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
const background = lane(200, 2);
const interactive = lane(60, 3);

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function getJSON(path, params, run = background) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params || {})) if (v != null && v !== '') url.searchParams.set(k, String(v));
  for (let attempt = 0; ; attempt++) {
    try {
      return await run(async () => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        try {
          const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: ctrl.signal });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            const err = new HttpError(res.status, `Kalshi ${res.status} on ${path}${text ? `: ${text.slice(0, 160)}` : ''}`);
            if (res.status === 429) {
              const ra = Number(res.headers.get('retry-after'));
              err.retryAfter = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1000 : 0;
              slowUntil = Date.now() + 60000;
            }
            throw err;
          }
          return await res.json();
        } finally {
          clearTimeout(timer);
        }
      });
    } catch (err) {
      const limited = err instanceof HttpError && err.status === 429;
      const retry = !(err instanceof HttpError) || limited || err.status >= 500;
      if (!retry || attempt >= (limited ? 5 : 3)) throw err;
      const backoff = limited ? Math.max(err.retryAfter || 0, 2000 * 2 ** attempt) : 1000 * 2 ** attempt;
      await sleep(Math.min(backoff, 30000) + Math.random() * 400);
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
// Dollar string -> cents. Falls back to a legacy integer-cents field when present.
const centsOf = (dollars, legacyCents) => {
  const d = num(dollars);
  if (d != null) return round4(d * 100);
  return num(legacyCents);
};
// A quote of 0¢ or 100¢ means there is no order on that side.
const quote = (c) => (c != null && c > 0 && c < 100 ? c : null);
const count = (fp, legacy) => num(fp) ?? num(legacy);
const ts = (iso) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};
const sources = (list) => (Array.isArray(list) ? list : [])
  .filter((s) => s && s.name).map((s) => ({ name: String(s.name), url: s.url ? String(s.url) : null }));

function seriesEntry(s) {
  return {
    ticker: s.ticker, title: s.title || s.ticker, category: s.category || '', categories: s.categories || [],
    frequency: s.frequency || '', sources: sources(s.settlement_sources),
    termsUrl: s.contract_terms_url || null, contractUrl: s.contract_url || null,
  };
}

function compactEvent(e) {
  const s = state.series.get(e.series_ticker);
  return {
    ticker: e.event_ticker, series: e.series_ticker, title: e.title || e.event_ticker, sub: e.sub_title || '',
    category: (s && s.category) || e.category || 'Other', exclusive: !!e.mutually_exclusive,
    strikeDate: ts(e.strike_date), sources: sources(e.settlement_sources).length ? sources(e.settlement_sources) : (s ? s.sources : []),
  };
}

function detailMarket(m, observedAt) {
  return {
    ticker: m.ticker,
    event: m.event_ticker,
    label: m.yes_sub_title || m.subtitle || m.title || m.ticker,
    noLabel: m.no_sub_title || null,
    status: m.status || null,
    type: m.market_type || 'binary',
    bid: quote(centsOf(m.yes_bid_dollars, m.yes_bid)),
    ask: quote(centsOf(m.yes_ask_dollars, m.yes_ask)),
    bidSize: count(m.yes_bid_size_fp),
    askSize: count(m.yes_ask_size_fp),
    last: quote(centsOf(m.last_price_dollars, m.last_price)),
    prevBid: quote(centsOf(m.previous_yes_bid_dollars, m.previous_yes_bid)),
    prevAsk: quote(centsOf(m.previous_yes_ask_dollars, m.previous_yes_ask)),
    prevLast: quote(centsOf(m.previous_price_dollars, m.previous_price)),
    vol24: count(m.volume_24h_fp, m.volume_24h),
    vol: count(m.volume_fp, m.volume),
    oi: count(m.open_interest_fp, m.open_interest),
    opens: ts(m.open_time),
    closes: ts(m.close_time),
    expectedExpiration: ts(m.expected_expiration_time),
    latestExpiration: ts(m.latest_expiration_time),
    canCloseEarly: !!m.can_close_early,
    earlyCloseCondition: m.early_close_condition || null,
    result: m.result || '',
    notional: centsOf(m.notional_value_dollars, m.notional_value),
    strikeType: m.strike_type || null,
    floorStrike: num(m.floor_strike),
    capStrike: num(m.cap_strike),
    priceRanges: (Array.isArray(m.price_ranges) ? m.price_ranges : [])
      .map((r) => ({ start: centsOf(r.start), end: centsOf(r.end), step: centsOf(r.step) })),
    rulesPrimary: m.rules_primary || '',
    rulesSecondary: m.rules_secondary || '',
    updatedAt: ts(m.updated_time),
    observedAt,
  };
}

// The fields the market list needs (keeps the list payload small).
const LIST_FIELDS = ['ticker', 'event', 'label', 'bid', 'ask', 'bidSize', 'askSize', 'last', 'prevBid', 'prevAsk', 'vol24', 'oi', 'closes', 'observedAt'];
const compactOf = (d) => Object.fromEntries(LIST_FIELDS.map((k) => [k, d[k] ?? null]));
const mid2 = (b, a) => (b != null && a != null ? (b + a) / 2 : null);
const withDerived = (c) => {
  const now = mid2(c.bid, c.ask);
  const prev = mid2(c.prevBid, c.prevAsk);
  return { ...c, mid: now, ch24: now != null && prev != null ? Math.round((now - prev) * 10) / 10 : null };
};

// ---------------------------------------------------------------- Collector
const state = {
  startedAt: Date.now(),
  series: new Map(),
  seriesAt: 0,
  events: new Map(),
  markets: new Map(),
  byEvent: new Map(),
  eventsSeen: 0,
  lastPassAt: null,
  lastSuccessAt: null,
  lastPassMs: null,
  failedBatches: 0,
  consecutiveFailures: 0,
  lastError: null,
  index: null,
};

function noteError(err, phase) {
  state.lastError = { phase, message: String((err && err.message) || err).slice(0, 300), at: Date.now() };
  console.warn(`[kalshi] ${phase} failed: ${state.lastError.message}`);
}

async function refreshSeries() {
  const data = await getJSON('/series');
  const map = new Map();
  for (const s of data.series || []) if (s && s.ticker) map.set(s.ticker, seriesEntry(s));
  if (map.size) { state.series = map; state.seriesAt = Date.now(); }
}

function inScope(e) {
  if (ALL) return true;
  const s = state.series.get(e.series_ticker);
  const cats = s ? [s.category, ...s.categories] : [e.category];
  return cats.some((c) => c && ALLOWED.has(String(c).toLowerCase()));
}

async function listOpenEvents() {
  const out = [];
  let cursor = '';
  for (let page = 0; page < 500; page++) {
    const data = await getJSON('/events', { status: 'open', limit: 200, cursor });
    out.push(...(data.events || []));
    cursor = data.cursor || '';
    if (!cursor) break;
  }
  return out;
}

// Updates the snapshot in place (no second copy during a pass), two requests at a time.
async function runPass() {
  const t0 = Date.now();
  if (!state.series.size || t0 - state.seriesAt > SERIES_TTL) {
    try { await refreshSeries(); } catch (err) { noteError(err, 'series'); }
  }
  const open = await listOpenEvents();
  const keep = open.filter(inScope);
  const batches = [];
  for (let i = 0; i < keep.length; i += BATCH) batches.push(keep.slice(i, i + BATCH));
  const seen = new Set();
  const seenEvents = new Set();
  const failedEvents = new Set();
  let failed = 0;
  let nextBatch = 0;
  const worker = async () => {
    while (nextBatch < batches.length) {
      const batch = batches[nextBatch++];
      try {
        const data = await getJSON('/events', { tickers: batch.map((e) => e.event_ticker).join(','), with_nested_markets: 'true', limit: BATCH });
        const at = Date.now();
        for (const e of data.events || []) {
          const ev = compactEvent(e);
          const tickers = [];
          for (const m of e.markets || []) {
            if (!ACTIVE.has(m.status)) continue;
            const fresh = withDerived(compactOf(detailMarket(m, at)));
            const cur = state.markets.get(m.ticker);
            if (cur) Object.assign(cur, fresh); else state.markets.set(m.ticker, fresh);
            seen.add(m.ticker);
            tickers.push(m.ticker);
          }
          if (tickers.length) {
            const curE = state.events.get(ev.ticker);
            if (curE) Object.assign(curE, ev); else state.events.set(ev.ticker, ev);
            state.byEvent.set(ev.ticker, tickers);
            seenEvents.add(ev.ticker);
          }
        }
      } catch (err) {
        failed++;
        noteError(err, 'markets');
        for (const e of batch) failedEvents.add(e.event_ticker);
      }
    }
  };
  await Promise.all([worker(), worker()]);
  // Drop markets and events that are no longer open. Ones from failed batches are kept and age into Delayed.
  for (const [t, m] of state.markets) if (!seen.has(t) && !failedEvents.has(m.event)) state.markets.delete(t);
  for (const t of [...state.events.keys()]) {
    if (!seenEvents.has(t) && !failedEvents.has(t)) { state.events.delete(t); state.byEvent.delete(t); }
  }
  const done = Date.now();
  Object.assign(state, { index: null, lastPassAt: done, lastPassMs: done - t0, eventsSeen: open.length, failedBatches: failed });
  // A pass counts as successful if almost every batch came back; markets from failed batches keep
  // their own (older) fetch times and age into Delayed on their own.
  if (failed <= Math.floor(batches.length * 0.05)) state.lastSuccessAt = done;
  if (!failed) state.lastError = null;
  console.log(`[kalshi] ${state.markets.size} markets in ${state.events.size} events (${keep.length} of ${open.length} open events in scope) in ${((done - t0) / 1000).toFixed(1)}s${failed ? `; ${failed} batch(es) failed` : ''} · ${mem()}`);
}

let started = false;
export function start() {
  if (started) return;
  started = true;
  console.log(`[kalshi] collector on: ${new URL(BASE).host}, every ${REFRESH_S}s, categories ${ALL ? 'all' : CATEGORIES.join(', ')}`);
  (async () => {
    for (;;) {
      const t0 = Date.now();
      try {
        await runPass();
        state.consecutiveFailures = 0;
      } catch (err) {
        state.consecutiveFailures++;
        state.index = null;
        noteError(err, 'events');
      }
      const wait = state.consecutiveFailures
        ? Math.min(REFRESH_S * 1000, 15000 * 2 ** Math.min(state.consecutiveFailures - 1, 4))
        : Math.max(5000, REFRESH_S * 1000 - (Date.now() - t0));
      await sleep(wait);
    }
  })();
}

export const clientConfig = () => ({ refreshSeconds: REFRESH_S, recentSeconds: RECENT_S, categories: ALL ? [] : CATEGORIES });

export function status() {
  return {
    source: 'Kalshi',
    api: new URL(BASE).host,
    refreshSeconds: REFRESH_S,
    recentSeconds: RECENT_S,
    categories: ALL ? [] : CATEGORIES,
    startedAt: state.startedAt,
    lastPassAt: state.lastPassAt,
    lastSuccessAt: state.lastSuccessAt,
    lastPassSeconds: state.lastPassMs == null ? null : Math.round(state.lastPassMs / 100) / 10,
    openEventsSeen: state.eventsSeen,
    events: state.events.size,
    markets: state.markets.size,
    failedBatches: state.failedBatches,
    consecutiveFailures: state.consecutiveFailures,
    lastError: state.lastError,
  };
}

// Search, filter, sort and page on the server: the full set is too big to send to browsers.
const clean = (m) => { const { mid, ch24, ...rest } = m; return rest; };

export function listQuery(params) {
  if (!state.index) state.index = buildIndex(state.markets, state.events, `${state.lastPassAt || 0}-${state.consecutiveFailures}`);
  return runQuery(state.index, params, {
    tag: 'k', events: state.events, byEvent: state.byEvent, status, clean,
    eventInfo: (e) => ({ title: e.title, sub: e.sub, category: e.category, series: e.series, exclusive: e.exclusive }),
  });
}

// ---------------------------------------------------------------- On-demand detail
const caches = { market: new Map(), event: new Map(), series: new Map(), book: new Map(), history: new Map() };

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

const eventInfo = (t) => cached(caches.event, t, 10 * 60e3, async () => {
  const data = await getJSON(`/events/${encodeURIComponent(t)}`, { with_nested_markets: 'true' }, interactive);
  const e = data.event;
  if (!e) throw new HttpError(404, 'Event not found');
  const at = Date.now();
  const markets = (e.markets || data.markets || []).filter((m) => ACTIVE.has(m.status)).map((m) => compactOf(detailMarket(m, at)));
  return { ev: compactEvent(e), siblings: markets };
});

const seriesInfo = (t) => cached(caches.series, t, SERIES_TTL, async () => {
  const data = await getJSON(`/series/${encodeURIComponent(t)}`, null, interactive);
  if (!data.series) throw new HttpError(404, 'Series not found');
  return seriesEntry(data.series);
});

export async function marketDetail(ticker) {
  const market = await cached(caches.market, ticker, 10e3, async () => {
    const data = await getJSON(`/markets/${encodeURIComponent(ticker)}`, null, interactive);
    if (!data.market) throw new HttpError(404, 'Market not found');
    return detailMarket(data.market, Date.now());
  });
  let event = state.events.get(market.event) || null;
  let siblings = (state.byEvent.get(market.event) || []).map((t) => state.markets.get(t)).filter(Boolean);
  if (!event) {
    const info = await eventInfo(market.event).catch(() => null);
    if (info) { event = info.ev; siblings = info.siblings; }
  }
  const series = event ? (state.series.get(event.series) || await seriesInfo(event.series).catch(() => null)) : null;
  return {
    market,
    event,
    series: series && { ticker: series.ticker, title: series.title, category: series.category, frequency: series.frequency, termsUrl: series.termsUrl, contractUrl: series.contractUrl },
    siblings: siblings.filter((m) => m.ticker !== ticker).sort(byActivity).slice(0, 60).map(clean),
  };
}

export function orderbook(ticker) {
  return cached(caches.book, ticker, 8e3, async () => {
    const data = await getJSON(`/markets/${encodeURIComponent(ticker)}/orderbook`, { depth: 10 }, interactive);
    const ob = data.orderbook_fp || {};
    const levels = (arr) => (Array.isArray(arr) ? arr : [])
      .map(([p, q]) => ({ price: centsOf(p), size: num(q) }))
      .filter((l) => l.price != null && l.size != null && l.size > 0);
    // Kalshi lists bids only, best price last. A No bid at p is a Yes ask at 100 − p.
    const bids = levels(ob.yes_dollars).sort((a, b) => b.price - a.price);
    const asks = levels(ob.no_dollars).map((l) => ({ price: round4(100 - l.price), size: l.size })).sort((a, b) => a.price - b.price);
    return { ticker, bids, asks, observedAt: Date.now() };
  });
}

const RANGES = {
  '1D': { span: 86400, interval: 1, ttl: 60e3, sampling: '1-minute candles' },
  '1W': { span: 7 * 86400, interval: 60, ttl: 5 * 60e3, sampling: 'Hourly candles' },
  '1M': { span: 30 * 86400, interval: 60, ttl: 15 * 60e3, sampling: 'Hourly candles' },
  ALL: { span: null, interval: 1440, ttl: 30 * 60e3, sampling: 'Daily candles' },
};

export async function history(ticker, rangeId) {
  const id = RANGES[rangeId] ? rangeId : '1W';
  const r = RANGES[id];
  return cached(caches.history, `${ticker}|${id}`, r.ttl, async () => {
    const d = await marketDetail(ticker);
    const series = d.event && d.event.series;
    if (!series) throw new HttpError(404, 'No series for this market');
    const end = Math.floor(Date.now() / 1000);
    const opened = d.market.opens ? Math.floor(d.market.opens / 1000) : end - 365 * 86400;
    const start = r.span ? Math.max(opened, end - r.span) : opened;
    const base = { ticker, range: id, interval: r.interval, sampling: r.sampling, from: start * 1000, to: end * 1000, observedAt: Date.now() };
    if (start >= end) return { ...base, points: [] };
    const data = await getJSON(`/series/${encodeURIComponent(series)}/markets/${encodeURIComponent(ticker)}/candlesticks`,
      { start_ts: start, end_ts: end, period_interval: r.interval }, interactive);
    const side = (o, k) => (o ? centsOf(o[`${k}_dollars`], o[k]) : null);
    const points = (data.candlesticks || []).map((c) => {
      const t = num(c.end_period_ts);
      return {
        t: t == null ? NaN : t * 1000,
        bid: quote(side(c.yes_bid, 'close')),
        ask: quote(side(c.yes_ask, 'close')),
        last: quote(side(c.price, 'close')),
        vol: count(c.volume_fp, c.volume),
      };
    }).filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
    return { ...base, points };
  });
}
