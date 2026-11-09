// Clicks through the main interactions and reports any console or page errors.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const shim = fs.readFileSync('/home/claude/banthom/build/react-shim.js', 'utf8');
const OUT = '/tmp/claude-0/-home-claude/a5d686c4-6bad-5a33-be5b-134cd4c6254c/scratchpad/shots';
const page0 = fs.readFileSync('/home/claude/banthom/dist/banthom.html', 'utf8');
fs.writeFileSync('/home/claude/banthom/dist/test.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page0}</body></html>`);
const browser = await chromium.launch();
const errors = [];
async function page(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(3000);
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${width}] ${m.type()}: ${m.text()}`); });
  pg.on('pageerror', (e) => errors.push(`[${width}] pageerror: ${e.message}`));
  await pg.route('https://cdnjs.cloudflare.com/**', (r) => r.request().url().includes('/react/') ? r.fulfill({ body: shim, contentType: 'text/javascript' }) : r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  return pg;
}
let current = null;
const step = async (name, fn) => { try { await fn(); console.log('ok   ', name); } catch (e) { console.log('FAIL ', name, '-', e.message.split('\n').slice(0, 6).join(' | ')); if (current) await current.screenshot({ path: OUT + '/fail-' + name.replace(/[^a-z0-9]+/gi, '-') + '.png' }).catch(() => {}); } };

const pg = await page(1440);
current = pg;
await pg.goto('file:///home/claude/banthom/dist/test.html#app-dashboard');
await pg.waitForTimeout(500);
await step('palette opens with Ctrl+K', async () => { await pg.keyboard.press('Control+k'); await pg.waitForSelector('.palette', { timeout: 2000 }); });
await step('palette search + Enter navigates', async () => { await pg.keyboard.type('shutdown'); await pg.waitForTimeout(150); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300); const h = await pg.evaluate(() => location.hash); if (!h.includes('shutdown') && !h.includes('funding')) throw new Error('hash ' + h); });
await step('palette no-match state', async () => { await pg.keyboard.press('Control+k'); await pg.waitForTimeout(100); await pg.keyboard.type('zzzz'); await pg.waitForSelector('.palette-empty', { timeout: 1500 }); await pg.keyboard.press('Escape'); await pg.waitForTimeout(150); if (await pg.$('.palette')) throw new Error('palette still open'); });
await step('explorer filter to zero results shows suggestions', async () => { await pg.evaluate(() => { location.hash = 'app-markets'; }); await pg.waitForTimeout(300); await pg.fill('.xp-search input', 'opec'); await pg.click('#xp-verified'); await pg.waitForTimeout(200); await pg.waitForSelector('.empty-title', { timeout: 1500 }); const t = await pg.textContent('.empty'); if (!t.includes('Removing')) throw new Error(t.slice(0, 120)); });
await step('clear filters restores rows', async () => { await pg.click('text=Clear filters'); await pg.waitForTimeout(200); const n = await pg.$$eval('.xp-table tbody tr', (r) => r.length); if (n < 20) throw new Error('rows ' + n); });
await step('sort by 24h header', async () => { await pg.click('th:has-text("24h") .th-sort'); await pg.waitForTimeout(150); const s = await pg.getAttribute('th:has-text("24h")', 'aria-sort'); if (s === 'none') throw new Error('aria-sort ' + s); });
await step('star toggles with undo toast', async () => { await pg.click('.xp-table tbody tr:nth-child(2) .star-btn'); await pg.waitForSelector('.toast', { timeout: 1500 }); await pg.click('.toast-action'); });
await step('column picker hides Volume', async () => { await pg.click('text=Columns'); await pg.click('label[for="col-vol"]'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(100); const has = await pg.$('th:has-text("Volume 24h")'); if (has) throw new Error('still visible'); await pg.click('text=Columns'); await pg.click('label[for="col-vol"]'); await pg.keyboard.press('Escape'); });
await step('row menu -> create alert opens editor', async () => { await pg.click('.xp-table tbody tr:first-child td:last-child button'); await pg.click('role=menuitem[name="Create alert"]'); await pg.waitForTimeout(300); await pg.waitForSelector('#alert-form', { timeout: 1500 }); });
await step('alert validation then save', async () => { await pg.fill('#al-threshold', '150'); await pg.click('text=Save alert'); await pg.waitForSelector('#al-threshold-err', { timeout: 1500 }); await pg.fill('#al-threshold', '70'); await pg.click('text=Save alert'); await pg.waitForTimeout(300); if (await pg.$('#alert-form')) throw new Error('editor still open'); });
await step('market detail chart keyboard + table view', async () => { await pg.evaluate(() => { location.hash = 'app-market-fed-dec26-cut-ard'; }); await pg.waitForTimeout(400); await pg.focus('.chart-stage'); await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowLeft'); await pg.waitForSelector('.chart-tip', { timeout: 1000 }); await pg.click('text=Table view'); await pg.waitForSelector('.chart-table-wrap', { timeout: 1000 }); await pg.click('text=Chart view'); });
await step('overlay + timeframe 1H + No side', async () => { await pg.click('label[for="ov"]'); await pg.click('role=radio[name="1 hour"]'); await pg.click('role=radio[name="No"]'); await pg.waitForTimeout(200); await pg.hover('.chart-panel .chart-svg', { position: { x: 300, y: 120 }, force: true }); await pg.waitForTimeout(100); await pg.screenshot({ path: OUT + '/i-chart-hover.png' }); });
await step('market detail tabs', async () => { for (const t of ['Order book', 'Rules', 'Related', 'Sources', 'Activity']) { await pg.click(`role=tab[name="${t}"]`); await pg.waitForTimeout(60); } });
await step('ask about event', async () => { await pg.fill('#ask-fed-dec26-cut-ard', 'What moved this today?'); await pg.keyboard.press('Enter'); await pg.waitForSelector('.ask-answer', { timeout: 1000 }); });
await step('compare detail quantity 1000', async () => { await pg.evaluate(() => { location.hash = 'app-compare-gdp-q4'; }); await pg.waitForTimeout(300); await pg.click('role=button[name="1,000"]'); await pg.waitForTimeout(150); const t = await pg.textContent('.equation'); if (!t.includes('net')) throw new Error(t); await pg.screenshot({ path: OUT + '/i-compare-1000.png', fullPage: false }); });
await step('compare list toggle shows unverified group', async () => { await pg.evaluate(() => { location.hash = 'app-compare'; }); await pg.waitForTimeout(300); await pg.click('label[for="verified-only"]'); await pg.waitForSelector('.group-row', { timeout: 1000 }); });
await step('scenario: Brisa delayed shows banners', async () => { await pg.click('.demo-btn[aria-haspopup="dialog"]'); await pg.click('role=radio[name="Brisa feed delayed"]'); await pg.evaluate(() => { location.hash = 'app-dashboard'; }); await pg.waitForTimeout(400); await pg.waitForSelector('.banner-warning', { timeout: 1500 }); await pg.screenshot({ path: OUT + '/i-delayed.png' }); });
await step('scenario: empty account', async () => { await pg.click('.demo-btn[aria-haspopup="dialog"]'); await pg.click('role=radio[name="New account (empty)"]'); await pg.waitForTimeout(300); await pg.waitForSelector('.empty-inline', { timeout: 1500 }); await pg.screenshot({ path: OUT + '/i-empty.png' }); });
await step('scenario: research down', async () => { await pg.click('.demo-btn[aria-haspopup="dialog"]'); await pg.click('role=radio[name="Research sources unavailable"]'); await pg.evaluate(() => { location.hash = 'app-event-fomc-dec-2026'; }); await pg.waitForTimeout(400); const t = await pg.textContent('main'); if (!t.includes('Unable to verify recent sources')) throw new Error('no banner'); await pg.click('.demo-btn[aria-haspopup="dialog"]'); await pg.click('role=radio[name="Normal"]'); });
await step('customize dashboard hides research', async () => { await pg.evaluate(() => { location.hash = 'app-dashboard'; }); await pg.waitForTimeout(300); await pg.click('text=Customize dashboard'); await pg.click('role=switch[name="Research updates"]'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(150); if (await pg.$('text=Research updates')) throw new Error('still shown'); await pg.click('text=Customize dashboard'); await pg.click('role=switch[name="Research updates"]'); await pg.keyboard.press('Escape'); });
await step('watchlist rename + create', async () => { await pg.evaluate(() => { location.hash = 'app-watchlists'; }); await pg.waitForTimeout(300); await pg.click('role=button[name="Edit watchlist name"]'); await pg.fill('#edit-watchlist\\ name', 'My markets'); await pg.keyboard.press('Enter'); await pg.click('text=New watchlist'); await pg.fill('#wl-name', 'Election week'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); await pg.waitForSelector('text=No markets saved yet.', { timeout: 1000 }); });
await step('research builder -> sample report', async () => { await pg.evaluate(() => { location.hash = 'app-research'; }); await pg.waitForTimeout(300); await pg.click('text=New report'); await pg.click('text=What changed over 7 days?'); await pg.click('text=Generate with citations'); await pg.waitForTimeout(300); const h = await pg.evaluate(() => location.hash); if (!h.includes('rpt')) throw new Error(h); });
await step('sign-up validation and onboarding', async () => { await pg.evaluate(() => { location.hash = 'sign-up'; }); await pg.waitForTimeout(300); await pg.click('role=button[name="Create account"]'); await pg.waitForSelector('#auth-email-err', { timeout: 1000 }); await pg.fill('#auth-email', 'ana@example.com'); await pg.fill('#auth-password', 'correct horse 9'); await pg.click('label[for="auth-terms"] .check-box'); await pg.click('role=button[name="Create account"]'); await pg.waitForTimeout(1300); const h = await pg.evaluate(() => location.hash); if (h !== '#onboarding') throw new Error(h); });
await step('onboarding steps', async () => { await pg.click('role=radio[name*="Research-focused"]'); await pg.click('text=Continue'); await pg.click('role=button[name="Economics"]'); await pg.click('text=Continue'); await pg.click('text=Open my terminal'); await pg.waitForTimeout(300); const sub = await pg.textContent('.page-sub'); if (!sub.includes('Events you follow')) throw new Error(sub); });
await step('marketing nav dropdown + escape', async () => { await pg.evaluate(() => { location.hash = 'home'; }); await pg.waitForTimeout(300); await pg.click('role=button[name="Features"]'); await pg.waitForSelector('#dd-features', { timeout: 1000 }); await pg.keyboard.press('Escape'); await pg.waitForTimeout(100); if (await pg.$('#dd-features')) throw new Error('still open'); });
await step('FAQ opens', async () => { await pg.click('text=Is Banthom an exchange or a broker?'); });

const m = await page(390);
current = m;
await m.goto('file:///home/claude/banthom/dist/test.html#app-dashboard');
await m.waitForTimeout(500);
await step('mobile More sheet', async () => { await m.click('.tabbar button'); await m.waitForSelector('.more-sheet', { timeout: 1000 }); await m.screenshot({ path: OUT + '/i-more.png' }); await m.click('.more-sheet >> text=Alerts'); await m.waitForTimeout(300); const h = await m.evaluate(() => location.hash); if (h !== '#app-alerts') throw new Error(h); });
await step('mobile explorer filters sheet', async () => { await m.evaluate(() => { location.hash = 'app-markets'; }); await m.waitForTimeout(300); await m.click('text=Filters'); await m.waitForSelector('.sheet-bottom', { timeout: 1000 }); await m.screenshot({ path: OUT + '/i-filters.png' }); await m.click('text=Show results'); });
await step('mobile marketing drawer', async () => { await m.evaluate(() => { location.hash = 'home'; }); await m.waitForTimeout(300); await m.click('.mkt-menu-btn'); await m.waitForSelector('.mkt-drawer', { timeout: 1000 }); await m.keyboard.press('Escape'); });
await step('mobile market detail tabs', async () => { await m.evaluate(() => { location.hash = 'app-market-cpi-oct26-yoy-ard'; }); await m.waitForTimeout(400); for (const t of ['Rules', 'Research', 'Book', 'Overview']) await m.click(`.md-tabs >> role=radio[name="${t}"]`); await m.screenshot({ path: OUT + '/i-md-mobile.png', fullPage: true }); });

await browser.close();
console.log(errors.length ? '\nERRORS:\n' + [...new Set(errors)].slice(0, 20).join('\n') : '\nno console errors');
