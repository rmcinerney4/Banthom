// Renders routes in Chromium at several widths, reports console errors and horizontal overflow,
// and saves screenshots. Usage: node build/check.mjs [--full] [--out DIR] w1,w2 route1 route2 ...
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const ROOT = '/home/claude/banthom';
const args = process.argv.slice(2);
const full = args.includes('--full');
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? args[outIdx + 1] : '/tmp/claude-0/-home-claude/a5d686c4-6bad-5a33-be5b-134cd4c6254c/scratchpad/shots';
const rest = args.filter((a, i) => !a.startsWith('--') && (outIdx < 0 || (i !== outIdx + 1)));
const widths = (rest[0] || '1440').split(',').map(Number);
const routes = rest.slice(1).length ? rest.slice(1) : ['home'];
fs.mkdirSync(OUT, { recursive: true });

const page = fs.readFileSync(path.join(ROOT, 'dist/banthom.html'), 'utf8');
const shell = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page}</body></html>`;
fs.writeFileSync(path.join(ROOT, 'dist/test.html'), shell);
const shim = fs.readFileSync(path.join(ROOT, 'build/react-shim.js'), 'utf8');

const browser = await chromium.launch();
let problems = 0;
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  pg.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await pg.route('https://cdnjs.cloudflare.com/**', (r) => r.request().url().includes('/react/') ? r.fulfill({ body: shim, contentType: 'text/javascript' }) : r.fulfill({ body: '/* react-dom provided by shim */', contentType: 'text/javascript' }));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await pg.goto('file://' + path.join(ROOT, 'dist/test.html') + '#' + routes[0]);
  await pg.waitForTimeout(400);
  for (const route of routes) {
    errors.length = 0;
    await pg.evaluate((h) => { location.hash = h; }, route);
    await pg.waitForTimeout(350);
    const info = await pg.evaluate(() => {
      const de = document.documentElement;
      const wide = [];
      if (de.scrollWidth > de.clientWidth + 1) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.right > de.clientWidth + 1 && r.width > 0) {
            let p = el.parentElement, clipped = false;
            while (p) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { clipped = true; break; } p = p.parentElement; }
            if (!clipped) wide.push(`${el.tagName.toLowerCase()}.${(el.className && el.className.baseVal === undefined ? el.className : '').toString().split(' ').slice(0, 2).join('.')} right=${Math.round(r.right)}`);
          }
          if (wide.length > 6) break;
        }
      }
      const h1s = [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).slice(0, 3);
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, h1s, title: document.title, wide };
    });
    const file = path.join(OUT, `${route || 'home'}@${w}.png`);
    await pg.screenshot({ path: file, fullPage: full });
    const over = info.scrollW > info.clientW + 1;
    if (over || errors.length || info.h1s.length !== 1) problems++;
    console.log(`${w}px #${route}: h1=${JSON.stringify(info.h1s)}${over ? `  OVERFLOW ${info.scrollW}>${info.clientW} ${info.wide.join(' | ')}` : ''}${errors.length ? '\n   ' + errors.slice(0, 6).join('\n   ') : ''}`);
  }
  await ctx.close();
}
await browser.close();
console.log(problems ? `${problems} route(s) need attention` : 'all routes clean');
