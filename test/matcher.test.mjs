// Regression cases for suggested Kalshi–Polymarket pairs (run: npm test). Wrong pairs come from production audits.
import { createMatcher } from '../server/matcher.mjs';
// Each case: Kalshi event [title, [labels]], Polymarket event [title, [labels]] (label === title means a single market).
const close = Date.UTC(2026, 11, 20);
const cases = [
  // Production false positives (Nov 10): must NOT pair
  ['no', ["Time's Person of the Year for 2026", ['Mojtaba Khamenei', 'Donald Trump']], ['Iran leader end of 2026?', ['Mojtaba Khamenei', 'Ali Khamenei']]],
  ['no', ['Next Fed rate hike?', ['Before 2027', 'Before July 2026']], ['What will Fed Rate hit before 2027?', ['↑ 4.5%', '↓ 3.0%']]],
  ['no', ['Finland vs San Marino', ['Finland', 'Tie']], ['Finland vs. San Marino', ['San Marino', 'Draw']]],
  ['no', ['English Premier League Champion', ['Liverpool', 'Arsenal']], ['English Premier League Top 6 Finishers (2026-27)', ['Liverpool', 'Chelsea']]],
  ['no', ['Bitcoin price range on Nov 11, 2026?', ['$104,000 to 104,499.99', '$104,500 to 104,999.99']], ['Bitcoin above $104,000 on November 11?', ['Bitcoin above $104,000 on November 11?']]],
  ['no', ['Lowest temperature in Miami on Nov 10, 2026?', ['72° to 73°', '74° to 75°']], ['Lowest temperature in Miami on November 7?', ['72-73°F', '74-75°F']]],
  ['no', ['Who will Donald Trump talk to in Nov 2026?', ['Mohammed bin Salman', 'Xi Jinping']], ['Who will Trump meet with by November 30?', ['Mohammed bin Salman', 'Xi Jinping']]],
  ['no', ['Champions League Winner', ['Real Madrid', 'Arsenal']], ['LaLiga: Team to qualify for the 2027-28 UEFA Champions League', ['Real Madrid', 'Barcelona']]],
  ['no', ['Which AI company will have the best coding model at the end of 2026?', ['Google', 'Anthropic']], ['Which company has best AI model end of 2026?', ['Google', 'OpenAI']]],
  ['no', ['Cameroon vs Namibia', ['BTTS: Both Teams To Score']], ['Cameroon vs. Namibia', ['Cameroon', 'Draw', 'Namibia']]],
  // Known good pairs: MUST pair
  ['yes', ['Fed decision in December 2026?', ['Cut 25bps', 'Hold']], ['Will the Fed hold rates in December?', ['Will the Fed hold rates in December?']]],
  ['yes', ['Lowest temperature in Miami on Nov 10, 2026?', ['72° to 73°', '74° to 75°']], ['Lowest temperature in Miami on November 10?', ['72-73°F', '74-75°F']]],
  ['yes', ['Fed decision in December 2026?', ['Cut 25bps', 'Hold']], ['Fed decision in December?', ['25 bps decrease', 'No change']]],
  ['yes', ['Lakers vs Celtics', ['Lakers', 'Celtics']], ['Lakers vs. Celtics', ['Lakers vs. Celtics']], { yes: 'Lakers', no: 'Celtics' }],
  ['yes', ['2025-26 NBA Champion', ['Oklahoma City', 'Boston']], ['NBA Champion 2026', ['Oklahoma City Thunder', 'Boston Celtics']]],
  ['yes', ['Bitcoin price on Nov 11, 2026?', ['$104,000 or above', '$105,000 or above']], ['Bitcoin above $104,000 on November 11?', ['Bitcoin above $104,000 on November 11?']]],
  ['yes', ['Democratic nominee for President in 2028?', ['Gavin Newsom', 'Pete Buttigieg']], ['Democratic Presidential Nominee 2028', ['Gavin Newsom', 'Alexandria Ocasio-Cortez']]],
  ['yes', ['Government shutdown before February 2027?', ['Shutdown before Feb 1, 2027']], ['Government shutdown before February 1, 2027?', ['Government shutdown before February 1, 2027?']]],
];
let bad = 0;
for (const [want, [kt, kl], [pt, pl], named] of cases) {
  const km = kl.map((label, i) => ({ ticker: `K${i}`, event: 'KE', label, mid: 50, bid: 49, ask: 51, closes: close, vol24: 9000 - i }));
  const pm = pl.map((label, i) => ({ ticker: `${900 + i}`, event: 'PE', label, mid: 50, bid: 49.5, ask: 50.5, closes: close, vol24: 90000 - i, ...(named ? { yes: named.yes, no: named.no } : {}) }));
  const bg = Array.from({ length: 8 }, (_, i) => ({ ticker: `BG${i}`, event: `BGE${i}`, label: `zzq${i}`, mid: 50, bid: 49, ask: 51, closes: close + 400 * 86400e3, vol24: 500 }));
  const BGT = 'fed rate hold decision win champion december november trump temperature highest lowest company best model team league';
  const snap = (ms, title, ev) => ({ markets: new Map([...ms, ...bg.map((b) => ({ ...b, closes: b.closes + (ev === 'KE' ? 0 : 60 * 86400e3) }))].map((m) => [m.ticker, m])), events: new Map([[ev, { ticker: ev, title }], ...bg.map((b) => [b.event, { ticker: b.event, title: BGT }])]),
    byEvent: new Map([[ev, ms.map((m) => m.ticker)], ...bg.map((b) => [b.event, [b.ticker]])]), lastPassAt: 1 });
  const m = createMatcher({ kalshi: { snapshot: () => snap(km, kt, 'KE') }, polymarket: { snapshot: () => snap(pm, pt, 'PE') }, usd24: (v, x) => x.vol24 });
  const log = console.log; console.log = () => {}; await m.build(); console.log = log;
  const got = m.pairs().map((p) => `${km[+p.k.split(':K')[1]].label} <-> ${pm.find((x) => `polymarket:${x.ticker}` === p.p).label}`);
  const pass = want === 'yes' ? got.length > 0 : got.length === 0;
  if (!pass) bad++;
  console.log(`${pass ? 'PASS' : 'FAIL'} want=${want.padEnd(3)} ${kt}  ||  ${pt}  →  ${got.join(' ; ') || 'no pair'}`);
}
console.log(bad ? `${bad} failing` : 'all pass');
if (bad) process.exitCode = 1;
