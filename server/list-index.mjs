// Server-side search, filter, sort and paging over one venue's market snapshot.
// Kept lean for hundreds of thousands of markets: one small row per market, and search
// text is built per query (and cached per query) instead of being stored per market.

const int = (v, d, lo, hi) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Most active first: 24h volume, then open interest, then ticker.
export const byActivity = (a, b) => (b.vol24 ?? 0) - (a.vol24 ?? 0) || (b.oi ?? 0) - (a.oi ?? 0) || cmp(a.ticker, b.ticker);

export const mem = () => {
  const u = process.memoryUsage();
  return `heap ${Math.round(u.heapUsed / 1048576)} MB, rss ${Math.round(u.rss / 1048576)} MB`;
};

export function buildIndex(markets, events, version) {
  const rows = [];
  const cats = new Map();
  const evText = new Map();
  for (const m of markets.values()) {
    const e = events.get(m.event);
    const category = (e && e.category) || 'Other';
    cats.set(category, (cats.get(category) || 0) + 1);
    if (!evText.has(m.event)) {
      evText.set(m.event, (e ? `${e.title} ${e.sub || ''} ${e.slug || ''} ${m.event} ${category}` : m.event).toLowerCase());
    }
    rows.push({ m, category });
  }
  rows.sort((a, b) => byActivity(a.m, b.m));
  return { rows, evText, categories: [...cats.entries()].sort((a, b) => b[1] - a[1]), version, results: new Map() };
}

const SORTS = new Set(['title', 'bid', 'ask', 'mid', 'ch24', 'vol24', 'oi', 'closes']);

// venue: { tag, events, byEvent, status(), clean(m), eventInfo(e) }
export function runQuery(idx, params, venue) {
  const q = String(params.get('q') || '').trim().toLowerCase().slice(0, 120);
  const category = String(params.get('category') || 'all');
  const sort = SORTS.has(params.get('sort')) ? params.get('sort') : 'vol24';
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const offset = int(params.get('offset'), 0, 0, 1e7);
  const limit = int(params.get('limit'), 50, 1, 500);
  const key = JSON.stringify([q, category, sort, dir, offset, limit]);
  const etag = `"${venue.tag}${idx.version}-${Buffer.from(key).toString('base64url').slice(0, 60)}"`;
  const hit = idx.results.get(key);
  if (hit) return { body: hit, etag };

  let rows = idx.rows;
  if (category !== 'all') rows = rows.filter((r) => r.category === category);
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length) {
    rows = rows.filter((r) => {
      const h = `${idx.evText.get(r.m.event) || ''} ${r.m.label} ${r.m.ticker}`.toLowerCase();
      return terms.every((t) => h.includes(t));
    });
  }
  if (sort !== 'vol24' || dir !== 'desc') {
    const mul = dir === 'asc' ? 1 : -1;
    if (sort === 'title') {
      const keyed = rows.map((r) => {
        const e = venue.events.get(r.m.event);
        return [`${e ? e.title : r.m.event} ${r.m.label}`.toLowerCase(), r];
      });
      keyed.sort((a, b) => cmp(a[0], b[0]) * mul);
      rows = keyed.map((k) => k[1]);
    } else {
      rows = [...rows].sort((a, b) => {
        const va = a.m[sort];
        const vb = b.m[sort];
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return (va - vb) * mul;
      });
    }
  }
  const page = rows.slice(offset, offset + limit);
  const events = {};
  for (const r of page) {
    if (events[r.m.event]) continue;
    const e = venue.events.get(r.m.event);
    if (e) events[r.m.event] = { ...venue.eventInfo(e), markets: (venue.byEvent.get(r.m.event) || []).length };
  }
  const body = JSON.stringify({
    status: venue.status(), total: idx.rows.length, matched: rows.length, offset, limit,
    categories: idx.categories, events, markets: page.map((r) => venue.clean(r.m)),
  });
  if (idx.results.size > 200) idx.results.clear();
  idx.results.set(key, body);
  return { body, etag };
}
