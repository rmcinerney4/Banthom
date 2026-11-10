// Banthom web server: serves the single-page app and the live-data API. No dependencies.
import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { dataSources, sourceFlags } from './config/data-sources.mjs';
import * as kalshi from './server/kalshi.mjs';
import * as polymarket from './server/polymarket.mjs';
import * as hub from './server/hub.mjs';
import { createMatcher } from './server/matcher.mjs';

const PORT = Number(process.env.PORT) || 3000;
// Live venues: each module exposes the same interface (start, status, listQuery, marketDetail,
// orderbook, history, clientConfig).
const VENUES = {
  kalshi: { mod: kalshi, enabled: dataSources.kalshi.enabled, id: /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/, name: 'Kalshi' },
  polymarket: { mod: polymarket, enabled: dataSources.polymarket.enabled, id: /^[0-9]{1,20}$/, name: 'Polymarket' },
};
const config = { dataSources: sourceFlags() };
for (const [k, v] of Object.entries(VENUES)) config[k] = v.enabled ? v.mod.clientConfig() : null;

// Cross-venue layer and the Kalshi–Polymarket pair finder (needs both venues).
const matcher = VENUES.kalshi.enabled && VENUES.polymarket.enabled
  ? createMatcher({ kalshi, polymarket, usd24: hub.usd24, minUsd: Number(process.env.PAIRS_MIN_USD) || 100 })
  : null;
hub.init(VENUES, matcher);

// ---- Page: the built app wrapped in a full document, with the runtime config injected.
let fragment;
try {
  fragment = fs.readFileSync(new URL('./dist/banthom.html', import.meta.url), 'utf8');
} catch {
  console.error('dist/banthom.html is missing. Run `npm run build` first.');
  process.exit(1);
}
const cut = fragment.indexOf('<div id="root"');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script>window.__BANTHOM__ = ${JSON.stringify(config).replace(/</g, '\\u003c')};</script>
${cut >= 0 ? fragment.slice(0, cut) : fragment}
</head>
<body>
${cut >= 0 ? fragment.slice(cut) : ''}
</body>
</html>
`;
const htmlGz = zlib.gzipSync(html);

const BASE_HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' };
const wantsGzip = (req) => /\bgzip\b/.test(req.headers['accept-encoding'] || '');

function send(req, res, status, body, type, extra = {}, gz = null) {
  const headers = { ...BASE_HEADERS, 'content-type': type, ...extra };
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  if (buf.length > 1024 && wantsGzip(req)) {
    buf = gz || zlib.gzipSync(buf);
    headers['content-encoding'] = 'gzip';
    headers.vary = 'accept-encoding';
  }
  headers['content-length'] = buf.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : buf);
}
const json = (req, res, status, obj, extra = {}) => send(req, res, status, JSON.stringify(obj), 'application/json; charset=utf-8',
  { 'cache-control': 'no-store', 'x-server-time': String(Date.now()), ...extra });

// ---- Cached JSON bodies (lists, overview), revalidated with an ETag and gzipped once.
const gzCache = new Map();
function sendCached(req, res, { body, etag }) {
  const extra = { 'cache-control': 'no-cache', etag, 'x-server-time': String(Date.now()) };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ...BASE_HEADERS, ...extra });
    return res.end();
  }
  let gz = gzCache.get(etag);
  if (!gz) {
    gz = zlib.gzipSync(body);
    if (gzCache.size > 300) gzCache.clear();
    gzCache.set(etag, gz);
  }
  return send(req, res, 200, body, 'application/json; charset=utf-8', extra, gz);
}

const venueError = (req, res, venue, err, where) => {
  const notFound = err && err.status === 404;
  if (!notFound) console.warn(`[${venue.name.toLowerCase()}] ${where}: ${err && err.message}`);
  return json(req, res, notFound ? 404 : 502, { error: notFound ? `${venue.name} has no market or event with this id.` : `${venue.name} did not respond. Try again shortly.` });
};

async function marketRoute(req, res, vk, rawId, sub, params) {
  const venue = VENUES[vk];
  if (!venue || !venue.enabled) return json(req, res, 503, { error: 'This venue is switched off.' });
  let id = '';
  try { id = decodeURIComponent(rawId); } catch { /* invalid escape */ }
  if (!venue.id.test(id)) return json(req, res, 400, { error: 'Invalid market id.' });
  try {
    if (sub === 'orderbook') return json(req, res, 200, await venue.mod.orderbook(id));
    if (sub === 'history') return json(req, res, 200, await venue.mod.history(id, params.get('range')));
    const data = await venue.mod.marketDetail(id);
    const full = `${vk}:${id}`;
    return json(req, res, 200, { ...data, venue: vk, id: full, category: hub.categoryOf(data.event), pair: hub.pairForMarket(full) });
  } catch (err) {
    return venueError(req, res, venue, err, `market ${id}`);
  }
}

async function route(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(req, res, 405, 'Method not allowed', 'text/plain; charset=utf-8', { allow: 'GET, HEAD' });
  }
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  if (p === '/healthz') return send(req, res, 200, 'ok', 'text/plain; charset=utf-8', { 'cache-control': 'no-store' });
  if (p === '/api/config') return json(req, res, 200, config);

  // ---- Cross-venue API
  if (p === '/api/status') return json(req, res, 200, { venues: hub.venueStatus(), pairs: matcher ? matcher.status() : null });
  if (p === '/api/markets') return sendCached(req, res, hub.marketsQuery(url.searchParams));
  if (p === '/api/overview') return sendCached(req, res, { body: hub.overview(), etag: `"o${hub.version()}"` });
  if (p === '/api/quotes') return json(req, res, 200, hub.quotes(url.searchParams));
  if (p === '/api/matches') return json(req, res, 200, hub.matchesList(url.searchParams));
  let m = p.match(/^\/api\/matches\/([A-Za-z0-9_-]{1,64})$/);
  if (m) {
    const d = await hub.matchDetail(m[1]);
    return d ? json(req, res, 200, d) : json(req, res, 404, { error: 'This pair is no longer suggested.' });
  }
  m = p.match(/^\/api\/markets\/(kalshi|polymarket)\/([^/]+)(?:\/(orderbook|history))?$/);
  if (m) return marketRoute(req, res, m[1], m[2], m[3], url.searchParams);
  m = p.match(/^\/api\/events\/(kalshi|polymarket)\/([^/]+)$/);
  if (m) {
    const venue = VENUES[m[1]];
    if (!venue.enabled) return json(req, res, 503, { error: `${venue.name} data is switched off.` });
    let id = '';
    try { id = decodeURIComponent(m[2]); } catch { /* invalid escape */ }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) return json(req, res, 400, { error: 'Invalid event id.' });
    try { return json(req, res, 200, await hub.eventPage(m[1], id)); } catch (err) { return venueError(req, res, venue, err, `event ${id}`); }
  }

  // ---- Per-venue routes (kept for existing links)
  const vm = p.match(/^\/api\/(kalshi|polymarket)(\/.*)?$/);
  if (vm) {
    const venue = VENUES[vm[1]];
    const rest = vm[2] || '';
    if (!venue.enabled) return json(req, res, 503, { error: `${venue.name} data is switched off.` });
    if (rest === '/status') return json(req, res, 200, venue.mod.status());
    if (rest === '/markets') {
      const params = new URLSearchParams(url.searchParams);
      params.set('venue', vm[1]);
      return sendCached(req, res, hub.marketsQuery(params));
    }
    const mm = rest.match(/^\/markets\/([^/]+)(?:\/(orderbook|history))?$/);
    if (mm) return marketRoute(req, res, vm[1], mm[1], mm[2], url.searchParams);
    return json(req, res, 404, { error: 'Not found.' });
  }
  if (p.startsWith('/api/')) return json(req, res, 404, { error: 'Not found.' });
  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }

  // Everything else is the single-page app; its routes live in the URL hash.
  return send(req, res, 200, html, 'text/html; charset=utf-8', { 'cache-control': 'no-cache' }, htmlGz);
}

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) json(req, res, 500, { error: 'Server error.' });
    else res.end();
  });
});

server.listen(PORT, () => {
  console.log(`Banthom listening on :${PORT} · data sources ${JSON.stringify(config.dataSources)}`);
  for (const v of Object.values(VENUES)) if (v.enabled) v.mod.start();
  if (matcher) matcher.start();
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
