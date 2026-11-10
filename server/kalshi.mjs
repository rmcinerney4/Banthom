// Kalshi public market data for Banthom.
//
// A background collector keeps a snapshot of open Kalshi markets in the categories Banthom
// covers. Detail endpoints fetch one market's quote, order book and price history on demand.
// Kalshi's market-data endpoints need no API key (docs.kalshi.com, Trade API v2).
//
// Kalshi returns prices as dollar strings ("0.5600") and sizes as fixed-point counts
// ("13.00"). Everything here is converted to US cents and plain numbers. A missing bid or
// ask stays null and is never filled in.

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
const background = lane(100, 3);
const interactive = lane(40, 4);

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
            throw new HttpError(res.status, `Kalshi ${res.status} on ${path}${text ? `: ${text.slice(0, 160)}` : ''}`);
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
const byActivity = (a, b) => (b.vol24 ?? 0) - (a.vol24 ?? 0) || (b.oi ?? 0) - (a.oi ?? 0) || a.ticker.localeCompare(b.ticker);

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

function carryOver(t, next) {
  const ev = state.events.get(t);
  const tickers = state.byEvent.get(t);
  if (!ev || !tickers) return;
  next.events.set(t, ev);
  next.byEvent.set(t, tickers);
  for (const m of tickers) {
    if (state.markets.has(m)) next.markets.set(m, state.markets.get(m));
  }
}

async function runPass() {
  const t0 = Date.now();
  if (!state.series.size || t0 - state.seriesAt > SERIES_TTL) {
    try { await refreshSeries(); } catch (err) { noteError(err, 'series'); }
  }
  const open = await listOpenEvents();
  const keep = open.filter(inScope);
  const next = { events: new Map(), markets: new Map(), byEvent: new Map() };
  let failed = 0;
  for (let i = 0; i < keep.length; i += BATCH) {
    const batch = keep.slice(i, i + BATCH);
    try {
      const data = await getJSON('/events', { tickers: batch.map((e) => e.event_ticker).join(','), with_nested_markets: 'true', limit: BATCH });
      const at = Date.now();
      for (const e of data.events || []) {
        const ev = compactEvent(e);
        const tickers = [];
        for (const m of e.markets || []) {
          if (!ACTIVE.has(m.status)) continue;
          next.markets.set(m.ticker, withDerived(compactOf(detailMarket(m, at))));
          tickers.push(m.ticker);
        }
        if (tickers.length) { next.events.set(ev.ticker, ev); next.byEvent.set(ev.ticker, tickers); }
      }
    } catch (err) {
      failed++;
      noteError(err, 'markets');
      for (const e of batch) carryOver(e.event_ticker, next);
    }
  }
  const done = Date.now();
  Object.assign(state, next, { index: null, lastPassAt: done, lastPassMs: done - t0, eventsSeen: open.length, failedBatches: failed });
  if (!failed) { state.lastSuccessAt = done; state.lastError = null; }
  console.log(`[kalshi] ${next.markets.size} markets in ${next.events.size} events (${keep.length} of ${open.length} open events in scope) in ${((done - t0) / 1000).toFixed(1)}s${failed ? `; ${failed} batch(es) failed` : ''}`);
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
// The index is rebuilt once per collector pass; query results are cached until the next pass.
function index() {
  if (state.index) return state.index;
  const rows = [];
  const cats = new Map();
  for (const m of state.markets.values()) {
    const e = state.events.get(m.event);
    const category = (e && e.category) || 'Other';
    cats.set(category, (cats.get(category) || 0) + 1);
    const title = e ? e.title : m.event;
    rows.push({ m, category, title, sortTitle: `${title} ${m.label}`.toLowerCase(),
      hay: `${title} ${e ? e.sub : ''} ${m.label} ${m.ticker} ${m.event} ${category}`.toLowerCase() });
  }
  rows.sort((a, b) => byActivity(a.m, b.m));
  state.index = {
    rows,
    categories: [...cats.entries()].sort((a, b) => b[1] - a[1]),
    version: `${state.lastPassAt || 0}-${state.consecutiveFailures}`,
    results: new Map(),
  };
  return state.index;
}

const SORTS = new Set(['title', 'bid', 'ask', 'mid', 'ch24', 'vol24', 'oi', 'closes']);
const clean = (m) => { const { mid, ch24, ...rest } = m; return rest; };

export function listQuery(params) {
  const idx = index();
  const q = String(params.get('q') || '').trim().toLowerCase().slice(0, 120);
  const category = String(params.get('category') || 'all');
  const sort = SORTS.has(params.get('sort')) ? params.get('sort') : 'vol24';
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const offset = int(params.get('offset'), 0, 0, 1e7);
  const limit = int(params.get('limit'), 50, 1, 500);
  const key = JSON.stringify([q, category, sort, dir, offset, limit]);
  const etag = `"k${idx.version}-${Buffer.from(key).toString('base64url').slice(0, 60)}"`;
  const hit = idx.results.get(key);
  if (hit) return { body: hit, etag };

  const terms = q.split(/\s+/).filter(Boolean);
  let rows = idx.rows.filter((r) => (category === 'all' || r.category === category) && terms.every((t) => r.hay.includes(t)));
  if (sort !== 'vol24' || dir !== 'desc') {
    const k = sort;
    const mul = dir === 'asc' ? 1 : -1;
    const val = (r) => (k === 'title' ? r.sortTitle : r.m[k]);
    rows = [...rows].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * mul;
    });
  }
  const page = rows.slice(offset, offset + limit);
  const events = {};
  for (const r of page) {
    if (events[r.m.event]) continue;
    const e = state.events.get(r.m.event);
    if (e) events[r.m.event] = { title: e.title, sub: e.sub, category: e.category, series: e.series, exclusive: e.exclusive, markets: (state.byEvent.get(r.m.event) || []).length };
  }
  const body = JSON.stringify({
    status: status(), total: idx.rows.length, matched: rows.length, offset, limit,
    categories: idx.categories, events, markets: page.map((r) => clean(r.m)),
  });
  if (idx.results.size > 200) idx.results.clear();
  idx.results.set(key, body);
  return { body, etag };
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
