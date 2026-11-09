import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dataSources } from './config/data-sources.mjs';

const page = readFileSync(new URL('./dist/banthom.html', import.meta.url));
const port = Number(process.env.PORT) || 3000;
const flags = Object.fromEntries(Object.entries(dataSources).map(([k, v]) => [k, v.enabled]));

http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (req.url === '/api/config') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ dataSources: flags }));
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
  res.end(page);
}).listen(port, () => console.log(`Banthom on :${port}`, flags));
