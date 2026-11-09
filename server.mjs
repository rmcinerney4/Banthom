// Banthom web server: serves the single-page app and the live-data API. No dependencies.
import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { dataSources, sourceFlags } from './config/data-sources.mjs';
import * as kalshi from './server/kalshi.mjs';

const PORT = Number(process.env.PORT) || 3000;
const KALSHI = dataSources.kalshi.enabled;
const config = { dataSources: sourceFlags(), kalshi: KALSHI ? kalshi.clientConfig() : null };

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

// ---- Market list: one serialized body per collector pass, revalidated with an ETag.
let listGz = { etag: null, buf: null };
function sendList(req, res) {
  const { body, etag } = kalshi.listBody();
  const extra = { 'cache-control': 'no-cache', etag, 'x-server-time': String(Date.now()) };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ...BASE_HEADERS, ...extra });
    return res.end();
  }
  if (listGz.etag !== etag) listGz = { etag, buf: zlib.gzipSync(body) };
  return send(req, res, 200, body, 'application/json; charset=utf-8', extra, listGz.buf);
}

const TICKER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

async function route(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(req, res, 405, 'Method not allowed', 'text/plain; charset=utf-8', { allow: 'GET, HEAD' });
  }
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  if (p === '/healthz') return send(req, res, 200, 'ok', 'text/plain; charset=utf-8', { 'cache-control': 'no-store' });
  if (p === '/api/config') return json(req, res, 200, config);

  if (p === '/api/kalshi' || p.startsWith('/api/kalshi/')) {
    if (!KALSHI) return json(req, res, 503, { error: 'Kalshi data is switched off.' });
    if (p === '/api/kalshi/status') return json(req, res, 200, kalshi.status());
    if (p === '/api/kalshi/markets') return sendList(req, res);
    const m = p.match(/^\/api\/kalshi\/markets\/([^/]+)(?:\/(orderbook|history))?$/);
    if (m) {
      let ticker = '';
      try { ticker = decodeURIComponent(m[1]); } catch { /* invalid escape */ }
      if (!TICKER.test(ticker)) return json(req, res, 400, { error: 'Invalid market ticker.' });
      try {
        const data = m[2] === 'orderbook' ? await kalshi.orderbook(ticker)
          : m[2] === 'history' ? await kalshi.history(ticker, url.searchParams.get('range'))
            : await kalshi.marketDetail(ticker);
        return json(req, res, 200, data);
      } catch (err) {
        const notFound = err && err.status === 404;
        if (!notFound) console.warn(`[kalshi] ${p}: ${err && err.message}`);
        return json(req, res, notFound ? 404 : 502, { error: notFound ? 'Kalshi has no market with this ticker.' : 'Kalshi did not respond. Try again shortly.' });
      }
    }
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
  if (KALSHI) kalshi.start();
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
