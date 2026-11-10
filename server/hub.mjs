// Cross-venue market layer: one market list, events, quotes and an overview, read straight from
// each venue's in-memory snapshot (no copies). Queries keep only the top rows they return, and
// results are cached until either venue (or the pair finder) publishes new data.

const VENUE_KEYS = ['kalshi', 'polymarket'];
const DAY = 86400e3;
let V = {};
let matcher = null;

export function init(venues, pairFinder) { V = venues; matcher = pairFinder; }
const enabled = () => VENUE_KEYS.filter((k) => V[k] && V[k].enabled);
const snap = (k) => V[k].mod.snapshot();

// ---------------------------------------------------------------- Categories
// Kalshi categories and Polymarket sections, folded into one list.
const CAT = new Map(Object.entries({
  politics: 'Politics', elections: 'Elections', economics: 'Economics', economy: 'Economics',
  financials: 'Finance', finance: 'Finance', companies: 'Companies', earnings: 'Companies',
  crypto: 'Crypto', world: 'Geopolitics', geopolitics: 'Geopolitics',
  'science and technology': 'Science & Tech', tech: 'Science & Tech',
  'climate and weather': 'Climate & Weather', 'climate & science': 'Climate & Weather',
  sports: 'Sports', esports: 'Sports', entertainment: 'Culture', social: 'Culture', culture: 'Culture',
  health: 'Health', transportation: 'Transportation', mentions: 'Mentions', other: 'Other',
}));
export const CATEGORY_ORDER = ['Politics', 'Elections', 'Economics', 'Finance', 'Companies', 'Geopolitics', 'Crypto',
  'Science & Tech', 'Climate & Weather', 'Health', 'Culture', 'Sports', 'Mentions', 'Transportation', 'Other'];
export const slugOf = (c) => String(c).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const catMemo = new Map();
function unify(raw) {
  const key = raw ? String(raw).trim() : '';
  let c = catMemo.get(key);
  if (!c) {
    c = !key ? 'Other' : CAT.get(key.toLowerCase()) || key.replace(/\b\w/g, (x) => x.toUpperCase());
    catMemo.set(key, c);
  }
  return c;
}
export const categoryOf = (e) => unify(e && e.category);

// ---------------------------------------------------------------- Rows
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
// Kalshi reports volume in contracts and Polymarket in USDC; this approximate dollar figure lets
// the two be ranked together (Kalshi contracts × current price).
export function usd24(venue, m) {
  if (m.vol24 == null) return null;
  if (venue !== 'kalshi') return m.vol24;
  const p = m.mid ?? m.last;
  return m.vol24 * ((p == null ? 50 : p) / 100);
}

export function rowOf(venue, m, s, ev) {
  const e = ev || s.events.get(m.event);
  return {
    id: `${venue}:${m.ticker}`, venue, ticker: m.ticker, event: m.event, eventTitle: e ? e.title : m.event,
    label: m.label, yes: m.yes || null, no: m.no || null,
    bid: m.bid ?? null, ask: m.ask ?? null, mid: m.mid ?? null, last: m.last ?? null, ch24: m.ch24 ?? null,
    vol24: m.vol24 ?? null, volUnit: venue === 'kalshi' ? 'ct' : 'usd', usd24: round2(usd24(venue, m)), oi: m.oi ?? null,
    closes: m.closes ?? null, observedAt: m.observedAt ?? null, category: categoryOf(e),
    multi: ((s.byEvent.get(m.event) || []).length || 1) > 1, exclusive: !!(e && e.exclusive),
  };
}

export const split = (id) => {
  const i = String(id).indexOf(':');
  return i > 0 ? { venue: id.slice(0, i), ticker: id.slice(i + 1) } : null;
};
export function rowById(id) {
  const p = split(id);
  if (!p || !V[p.venue] || !V[p.venue].enabled) return null;
  const s = snap(p.venue);
  const m = s.markets.get(p.ticker);
  return m ? rowOf(p.venue, m, s) : null;
}

// ---------------------------------------------------------------- Versioning and status
export function version() {
  return [...enabled().map((k) => snap(k).lastPassAt), matcher ? matcher.version() : 0].join('-');
}
export const venueStatus = () => Object.fromEntries(enabled().map((k) => [k, V[k].mod.status()]));

let cache = { version: null, results: new Map(), categories: null, overview: null, matches: new Map() };
function fresh() {
  const v = version();
  if (cache.version !== v) cache = { version: v, results: new Map(), categories: null, overview: null, matches: new Map() };
  return cache;
}

// ---------------------------------------------------------------- Top-K selection
// Keeps the k best items in a heap whose root is the worst kept, so a pass over hundreds of
// thousands of markets needs no full sort.
function topK(k, better) {
  const h = [];
  const swap = (i, j) => { const t = h[i]; h[i] = h[j]; h[j] = t; };
  const up = (i) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (better(h[p], h[i])) { swap(p, i); i = p; } else break;
    }
  };
  const down = (i) => {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let w = i;
      if (l < h.length && better(h[w], h[l])) w = l;
      if (r < h.length && better(h[w], h[r])) w = r;
      if (w === i) return;
      swap(i, w);
      i = w;
    }
  };
  return {
    push(x) {
      if (k <= 0) return;
      if (h.length < k) { h.push(x); up(h.length - 1); } else if (better(x, h[0])) { h[0] = x; down(0); }
    },
    sorted: () => h.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0)),
  };
}

const SORTS = {
  usd24: (vn, m) => usd24(vn, m),
  ch24: (vn, m) => m.ch24 ?? null,
  ch24abs: (vn, m) => (m.ch24 == null ? null : Math.abs(m.ch24)),
  mid: (vn, m) => m.mid ?? null,
  bid: (vn, m) => m.bid ?? null,
  ask: (vn, m) => m.ask ?? null,
  spread: (vn, m) => (m.bid != null && m.ask != null ? m.ask - m.bid : null),
  closes: (vn, m) => m.closes ?? null,
  oi: (vn, m) => m.oi ?? null,
};

function betterFor(dir) {
  const desc = dir !== 'asc';
  return (a, b) => {
    if (a.v == null) return b.v == null ? a.id < b.id : false;
    if (b.v == null) return true;
    if (a.v === b.v) return a.id < b.id;
    return desc ? a.v > b.v : a.v < b.v;
  };
}

const int = (v, d, lo, hi) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Runs one filtered, sorted selection across venues. Returns { matched, items: [{venue, m, s}] }.
function select({ venues, q, category, closingDays, minUsd, midBand, sort, dir, k, requireCh24 }) {
  const terms = q ? q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8) : [];
  const now = Date.now();
  const sortKey = SORTS[sort] ? sort : sort === 'title' ? 'title' : 'usd24';
  const heap = topK(k, betterFor(dir));
  let matched = 0;
  for (const vn of venues) {
    const s = snap(vn);
    for (const m of s.markets.values()) {
      const e = s.events.get(m.event);
      if (category && slugOf(categoryOf(e)) !== category) continue;
      if (closingDays != null && !(m.closes != null && m.closes >= now && m.closes - now <= closingDays * DAY)) continue;
      if (minUsd != null) { const u = usd24(vn, m); if (u == null || u < minUsd) continue; }
      if (midBand && !(m.mid != null && m.mid >= midBand[0] && m.mid <= midBand[1])) continue;
      if (requireCh24 && m.ch24 == null) continue;
      if (terms.length) {
        const hay = `${e ? `${e.title} ${e.sub || ''}` : m.event} ${m.label} ${m.ticker} ${m.yes || ''} ${vn}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) continue;
      }
      matched++;
      const v = sortKey === 'title' ? `${e ? e.title : m.event} ${m.label}`.toLowerCase() : SORTS[sortKey](vn, m);
      heap.push({ v, id: `${vn}:${m.ticker}`, vn, m, s });
    }
  }
  return { matched, items: heap.sorted() };
}

function categories() {
  const c = fresh();
  if (c.categories) return c.categories;
  const counts = new Map();
  for (const vn of enabled()) {
    const s = snap(vn);
    for (const m of s.markets.values()) {
      const cat = categoryOf(s.events.get(m.event));
      let byV = counts.get(cat);
      if (!byV) counts.set(cat, (byV = { total: 0 }));
      byV.total++;
      byV[vn] = (byV[vn] || 0) + 1;
    }
  }
  const rank = (x) => { const i = CATEGORY_ORDER.indexOf(x); return i < 0 ? CATEGORY_ORDER.length - 1 : i; };
  c.categories = [...counts.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || b[1].total - a[1].total)
    .map(([label, n]) => ({ label, slug: slugOf(label), ...n }));
  return c.categories;
}

const etagFor = (tag, key) => `"${tag}${version()}-${Buffer.from(key).toString('base64url').slice(0, 80)}"`;

// ---------------------------------------------------------------- /api/markets
export function marketsQuery(params) {
  const c = fresh();
  const venueParam = String(params.get('venue') || 'all');
  const venues = venueParam === 'all' ? enabled() : enabled().filter((k) => k === venueParam);
  const q = String(params.get('q') || '').trim().slice(0, 120);
  const category = params.get('category') ? String(params.get('category')) : null;
  const sort = String(params.get('sort') || 'usd24');
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const offset = int(params.get('offset'), 0, 0, 5000);
  const limit = int(params.get('limit'), 50, 1, 500);
  const closingDays = num(params.get('closing'));
  const minUsd = num(params.get('minUsd'));
  const band = params.get('band') === '1' ? [2, 98] : null;
  const key = JSON.stringify([venues, q.toLowerCase(), category, sort, dir, offset, limit, closingDays, minUsd, band]);
  const etag = etagFor('m', key);
  let body = c.results.get(key);
  if (!body) {
    const { matched, items } = select({ venues, q, category, closingDays, minUsd, midBand: band, sort, dir, k: offset + limit, requireCh24: sort.startsWith('ch24') });
    const rows = items.slice(offset).map((x) => rowOf(x.vn, x.m, x.s));
    body = JSON.stringify({ version: c.version, status: venueStatus(), total: totalMarkets(venues), matched, offset, limit, categories: categories(), markets: rows });
    if (c.results.size > 300) c.results.clear();
    c.results.set(key, body);
  }
  return { body, etag };
}

function totalMarkets(venues = enabled()) {
  return venues.reduce((n, k) => n + snap(k).markets.size, 0);
}

// ---------------------------------------------------------------- /api/quotes
export function quotes(params) {
  const ids = String(params.get('ids') || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 300);
  return { status: venueStatus(), quotes: ids.map((id) => rowById(id) || { id, missing: true }) };
}

// ---------------------------------------------------------------- /api/overview
export function overview() {
  const c = fresh();
  if (c.overview) return c.overview;
  const venues = enabled();
  const pick = (opts, k = 10) => select({ venues, sort: 'usd24', dir: 'desc', k, ...opts }).items.map((x) => rowOf(x.vn, x.m, x.s));
  const counts = Object.fromEntries(venues.map((k) => [k, { markets: snap(k).markets.size, events: snap(k).events.size }]));
  c.overview = JSON.stringify({
    version: c.version,
    status: venueStatus(),
    counts,
    total: totalMarkets(venues),
    categories: categories(),
    active: pick({}),
    movers: pick({ sort: 'ch24abs', minUsd: 1000, midBand: [3, 97], requireCh24: true }),
    closing: pick({ sort: 'closes', dir: 'asc', closingDays: 7, minUsd: 1000 }),
    pairs: matcher ? matchesList(new URLSearchParams('sort=gap&limit=6')).pairs : [],
    pairStatus: matcher ? matcher.status() : null,
  });
  return c.overview;
}

// ---------------------------------------------------------------- /api/events/:venue/:id
export async function eventPage(venue, id) {
  const { event, markets } = await V[venue].mod.eventDetail(id);
  const s = snap(venue);
  const rows = markets.map((m) => rowOf(venue, m, s, event));
  if (event.exclusive) rows.sort((a, b) => (b.mid ?? -1) - (a.mid ?? -1));
  else rows.sort((a, b) => (a.closes ?? 0) - (b.closes ?? 0) || String(a.label).localeCompare(String(b.label), 'en', { numeric: true }));
  const mids = rows.map((r) => r.mid).filter((x) => x != null);
  return {
    status: venueStatus(),
    event: {
      id: `${venue}:${event.ticker}`, venue, ticker: event.ticker, title: event.title, sub: event.sub || '',
      category: categoryOf(event), exclusive: !!event.exclusive, slug: event.slug || null, series: event.series || null,
      strikeDate: event.strikeDate || null, sources: event.sources || [],
    },
    markets: rows,
    midSum: event.exclusive && mids.length === rows.length && rows.length > 1 ? Math.round(mids.reduce((a, b) => a + b, 0) * 10) / 10 : null,
    pairs: matcher ? rows.map((r) => matcher.forMarket(r.id)).filter(Boolean).map((p) => ({ id: p.id, k: p.k, p: p.p })) : [],
  };
}

// ---------------------------------------------------------------- Pairs (/api/matches)
function pairRow(p) {
  const k = rowById(p.k);
  const pm = rowById(p.p);
  if (!k || !pm) return null;
  const gap = k.mid != null && pm.mid != null ? Math.round((k.mid - pm.mid) * 10) / 10 : null;
  const activity = Math.min(k.usd24 ?? 0, pm.usd24 ?? 0);
  return { id: p.id, score: p.score, k, p: pm, gap, activity };
}

export function matchesList(params) {
  const c = fresh();
  const q = String(params.get('q') || '').trim().toLowerCase().slice(0, 120);
  const sort = ['gap', 'activity', 'closes', 'score'].includes(params.get('sort')) ? params.get('sort') : 'activity';
  const limit = int(params.get('limit'), 50, 1, 500);
  const offset = int(params.get('offset'), 0, 0, 5000);
  const key = JSON.stringify([q, sort, limit, offset]);
  let res = c.matches.get(key);
  if (!res) {
    const terms = q.split(/\s+/).filter(Boolean);
    let rows = (matcher ? matcher.pairs() : []).map(pairRow).filter(Boolean);
    if (terms.length) {
      rows = rows.filter((r) => {
        const hay = `${r.k.eventTitle} ${r.k.label} ${r.p.eventTitle} ${r.p.label} ${r.k.ticker}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      });
    }
    const val = { gap: (r) => (r.gap == null ? -1 : Math.abs(r.gap)), activity: (r) => r.activity, score: (r) => r.score,
      closes: (r) => -(Math.min(r.k.closes ?? Infinity, r.p.closes ?? Infinity)) }[sort];
    rows.sort((a, b) => val(b) - val(a));
    res = { version: c.version, status: venueStatus(), pairStatus: matcher ? matcher.status() : null, matched: rows.length, offset, limit, pairs: rows.slice(offset, offset + limit) };
    if (c.matches.size > 100) c.matches.clear();
    c.matches.set(key, res);
  }
  return res;
}

export async function matchDetail(id) {
  const p = matcher && matcher.get(id);
  if (!p) return null;
  const row = pairRow(p);
  if (!row) return null;
  const kp = split(p.k);
  const pp = split(p.p);
  const [kd, pd] = await Promise.all([
    V.kalshi.mod.marketDetail(kp.ticker).catch(() => null),
    V.polymarket.mod.marketDetail(pp.ticker).catch(() => null),
  ]);
  return { status: venueStatus(), pair: row, kalshi: kd, polymarket: pd };
}

export function pairForMarket(id) {
  const p = matcher && matcher.forMarket(id);
  if (!p) return null;
  const otherId = p.k === id ? p.p : p.k;
  const other = rowById(otherId);
  return other ? { id: p.id, score: p.score, other } : null;
}
