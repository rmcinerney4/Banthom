// Suggests Kalshi and Polymarket markets that appear to ask the same question.
//
// Neither venue publishes a mapping, so pairs come from text: titles and outcome names are reduced
// to words and numbers, words are weighted by rarity, and a pair needs a high similarity, the same
// numbers, the same direction ("above" vs "below"), compatible closing dates and the same named
// outcome. Only mutual best matches are kept. These are suggestions: the rules can still differ.

const DAY = 86400e3;
const RARE_EVENTS = 5; // a title word used by this many events or fewer (both venues) counts as distinctive
const tick = () => new Promise((r) => setImmediate(r));

const STOP = new Set(('a an the of in on at by for to from with and or be is are was were will would should could can do does did ' +
  'this that these those it its as than then what which who whom whose when where how many much any each other another ' +
  'there their they he she his her them we our you your yes no not market markets price prices end ending before after ' +
  'during between into over under about up down out off per vs versus v reach reaches hit hits get gets have has had ' +
  'happen happens occur occurs announce announced announces next new first last least most').split(' '));

const SYN = new Map(Object.entries({
  decrease: 'cut', decreases: 'cut', lower: 'cut', lowers: 'cut', reduce: 'cut', reduces: 'cut', cuts: 'cut',
  hike: 'hike', hikes: 'hike', raise: 'hike', raises: 'hike', increase: 'hike', increases: 'hike',
  hold: 'hold', unchanged: 'hold', pause: 'hold',
  wins: 'win', winner: 'win', won: 'win', winning: 'win',
  presidential: 'president', presidency: 'president', nominee: 'nomination', nominated: 'nomination',
  elected: 'election', elections: 'election', btc: 'bitcoin', eth: 'ethereum', sol: 'solana',
  usa: 'us', america: 'us', american: 'us', federal: 'fed', reserve: 'fed', fomc: 'fed',
  jan: 'january', feb: 'february', mar: 'march', apr: 'april', jun: 'june', jul: 'july', aug: 'august',
  sep: 'september', sept: 'september', oct: 'october', nov: 'november', dec: 'december',
  gop: 'republican', republicans: 'republican', democrats: 'democrat', democratic: 'democrat', dem: 'democrat', dems: 'democrat',
}));
const UP = new Set(['above', 'over', 'greater', 'more', 'higher', 'exceed', 'exceeds', 'least', 'or_more']);
const DOWN = new Set(['below', 'under', 'less', 'lower', 'fewer', 'or_less']);

const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec';

// A bucket such as "$104,000 to $104,499" or "between 3% and 3.5%". Seasons such as "2025-26" are not ranges.
function isRange(t) {
  if (/\bbetween\b/.test(t)) return true;
  const re = /(\$?\d+(?:\.\d+)?)\s*(?:k|m|%|°f?|°c?)?\s*(?:to|-|–)\s*\$?\d/g;
  let m;
  while ((m = re.exec(t))) if (!/^\$?20[2-4]\d$/.test(m[1])) return true;
  return false;
}

const monthOf = (m) => SYN.get(m) || m;

function parse(text) {
  const dates = new Set();
  const date = (mo, d) => { dates.add(`${monthOf(mo)}-${Number(d)}`); return ` ${mo} `; };
  let t = ` ${String(text || '').toLowerCase()} `;
  t = t.replace(/u\.s\.|united states/g, ' us ').replace(/no change/g, ' hold ')
    .replace(/or more|or higher|or above/g, ' or_more ').replace(/or less|or lower|or below/g, ' or_less ')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/\b(20[2-4]\d)\s*[-–\/]\s*(\d\d)\b/g, ' $1 20$2 ') // seasons: "2025-26" covers 2025 and 2026
    // Days of the month are dates, not strikes: "Nov 11" becomes the date november-11, kept apart from the numbers.
    .replace(new RegExp(`\\b(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'g'), (all, mo, d) => date(mo, d))
    .replace(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})\\b`, 'g'), (all, d, mo) => date(mo, d));
  const range = isRange(t);
  const nums = new Set();
  const years = new Set();
  const words = new Set();
  let dir = null;
  t = t.replace(/\$?(\d+(?:\.\d+)?)\s*(k|m|bn|b|bps|%)?(?![a-z0-9])/g, (all, n, suf) => {
    let v = Number(n);
    if (suf === 'k') v *= 1e3; else if (suf === 'm') v *= 1e6; else if (suf === 'b' || suf === 'bn') v *= 1e9;
    if (suf === 'bps') words.add('bps');
    if (!suf && Number.isInteger(v) && v >= 2020 && v <= 2040) years.add(String(v));
    else nums.add(String(Math.round(v * 1e4) / 1e4));
    return ' ';
  });
  for (let w of t.split(/[^a-z0-9_]+/)) {
    if (!w) continue;
    if (UP.has(w)) { dir = dir === 'down' ? 'mixed' : 'up'; continue; }
    if (DOWN.has(w)) { dir = dir === 'up' ? 'mixed' : 'down'; continue; }
    w = SYN.get(w) || w;
    if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    if (w.length < 2 || STOP.has(w)) continue;
    words.add(w);
  }
  // A range is its own kind of question: it never pairs with an "above" or "below" market.
  return { words: [...words], nums, years, dates, dir: range ? 'range' : dir };
}
export { parse };

// Stable id for a pair (same markets → same id across rebuilds), so Compare links keep working.
function fnv(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
export const pairId = (k, p) => fnv(`${k}|${p}`, 2166136261) + fnv(`${p}|${k}`, 2166136261 ^ 0x9e3779b9);

const subset = (a, b) => { for (const x of a) if (!b.has(x)) return false; return true; };
// Strike numbers must match exactly: "top 6" is not "champion", and "4.5%" is not "before 2027".
const numsAgree = (a, b) => a.size === b.size && subset(a, b);
// Outcome names agree when the shorter name's words all appear in the longer one ("Oklahoma City" / "Oklahoma City Thunder").
const namesAgree = (a, b) => {
  if (!a.length || !b.length) return !a.length && !b.length;
  const [x, y] = a.length <= b.length ? [a, b] : [b, a];
  return x.every((w) => y.includes(w));
};
const yearsAgree = (a, b) => !a.size || !b.size || [...a].some((y) => b.has(y));

export function createMatcher({ kalshi, polymarket, usd24, minUsd = 100, maxPerVenue = 40000, threshold = 0.6 }) {
  let pairs = [];
  let byMarket = new Map();
  let byId = new Map();
  let builtAt = 0;
  let lastMs = null;
  let running = false;
  let lastError = null;

  // Most active markets per venue, as candidate texts.
  function candidates(venue, s) {
    const out = [];
    for (const m of s.markets.values()) {
      const u = usd24(venue, m);
      if (u == null || u < minUsd) continue;
      out.push({ venue, m, u });
    }
    out.sort((a, b) => b.u - a.u);
    return out.slice(0, maxPerVenue).map(({ m }) => {
      const e = s.events.get(m.event);
      const title = e ? e.title : '';
      const text = venue === 'kalshi' ? `${title} ${m.label}` : `${title} ${m.label === title ? '' : m.label}`;
      const p = parse(text);
      const lp = parse(m.label);
      // One outcome of an event with several (a team, a candidate, a bracket).
      const multi = ((s.byEvent.get(m.event) || []).length || 1) > 1;
      return { id: `${venue}:${m.ticker}`, m, ...p, multi, tw: parse(title).words, lw: lp.words, ln: lp.nums,
        label: venue === 'kalshi' ? lp.words : null, yes: m.yes ? parse(m.yes).words : null, no: m.no ? parse(m.no).words : null };
    });
  }

  async function build() {
    if (running) return;
    const ks = kalshi.snapshot();
    const ps = polymarket.snapshot();
    if (!ks.lastPassAt || !ps.lastPassAt) return;
    running = true;
    const t0 = Date.now();
    try {
      const K = candidates('kalshi', ks);
      await tick();
      const P = candidates('polymarket', ps);
      await tick();
      // How many events use each title word. A rare title word on one side only means a different question.
      const edf = new Map();
      const seenEvents = new Set();
      for (const c of [...K, ...P]) {
        const key = `${c.id.slice(0, 2)}|${c.m.event}`;
        if (seenEvents.has(key)) continue;
        seenEvents.add(key);
        for (const w of c.tw) edf.set(w, (edf.get(w) || 0) + 1);
      }
      const rare = (w) => (edf.get(w) || 0) <= RARE_EVENTS;
      // Word weights from both venues' candidates.
      const df = new Map();
      for (const c of K) for (const w of c.words) df.set(w, (df.get(w) || 0) + 1);
      for (const c of P) for (const w of c.words) df.set(w, (df.get(w) || 0) + 1);
      const N = K.length + P.length || 1;
      const idf = (w) => Math.log(1 + N / (df.get(w) || 1));
      const norm = (c) => Math.sqrt(c.words.reduce((a, w) => a + idf(w) ** 2, 0)) || 1;
      for (const c of K) c.n = norm(c);
      for (const c of P) c.n = norm(c);
      // Inverted index of Kalshi words, skipping very common ones.
      const inv = new Map();
      K.forEach((c, i) => { for (const w of c.words) { if ((df.get(w) || 0) > 4000) continue; let l = inv.get(w); if (!l) inv.set(w, (l = [])); l.push(i); } });
      await tick();

      const bestForP = new Array(P.length).fill(null);
      const bestForK = new Map();
      const acc = new Map();
      for (let pi = 0; pi < P.length; pi++) {
        if (pi % 1000 === 999) await tick();
        const pc = P[pi];
        acc.clear();
        for (const w of pc.words) {
          const l = inv.get(w);
          if (!l) continue;
          const wt = idf(w) ** 2;
          for (const ki of l) acc.set(ki, (acc.get(ki) || 0) + wt);
        }
        if (!acc.size) continue;
        const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
        let best = null;
        for (const [ki, dot] of top) {
          const kc = K[ki];
          const score = dot / (kc.n * pc.n);
          if (score < threshold || (best && score <= best.score)) continue;
          let shared = 0;
          for (const w of pc.words) if (kc.words.includes(w)) shared++;
          if (shared < 2) continue;
          if (!numsAgree(kc.nums, pc.nums) || !yearsAgree(kc.years, pc.years)) continue;
          // Same kind of question on both sides: above with above, below with below, range with range, or neither.
          if (kc.dir !== pc.dir) continue;
          if (kc.m.closes && pc.m.closes && Math.abs(kc.m.closes - pc.m.closes) > 7 * DAY) continue;
          // Named outcomes (e.g. two teams): Polymarket's "Yes" name must be the Kalshi outcome, and its "No" name must not be.
          if (pc.yes && !pc.yes.every((w) => kc.words.includes(w))) continue;
          if (pc.no && kc.label && kc.label.length && pc.no.every((w) => kc.label.includes(w))) continue;
          // Two outcomes of multi-outcome events must name the same outcome ("Finland" is not "San Marino").
          if (kc.multi && pc.multi && (!namesAgree(kc.lw, pc.lw) || !numsAgree(kc.ln, pc.ln))) continue;
          // One outcome against a single question: the question must name that outcome ("Cameroon" is not "Both teams to score").
          if (kc.multi && !pc.multi && !kc.lw.every((w) => pc.words.includes(w))) continue;
          if (pc.multi && !kc.multi && !namesAgree(kc.lw, pc.lw)) continue;
          // The events themselves must share a word beyond the outcome name ("Person of the Year" is not "Iran leader").
          if (!kc.tw.some((w) => pc.tw.includes(w))) continue;
          // Explicit dates must agree ("Nov 10" is not "November 7").
          if (kc.dates.size && pc.dates.size && ![...kc.dates].some((d) => pc.dates.has(d))) continue;
          // A rare title word on one side only ("coding model" vs "AI model", "talk to" vs "meet with").
          if (kc.tw.some((w) => rare(w) && !pc.words.includes(w)) || pc.tw.some((w) => rare(w) && !kc.words.includes(w))) continue;
          best = { ki, score };
        }
        if (!best) continue;
        bestForP[pi] = best;
        const cur = bestForK.get(best.ki);
        if (!cur || best.score > cur.score) bestForK.set(best.ki, { pi, score: best.score });
      }
      const next = [];
      const kept = [];
      bestForP.forEach((b, pi) => {
        if (!b) return;
        const back = bestForK.get(b.ki);
        if (!back || back.pi !== pi) return;
        const k = K[b.ki].id;
        const p = P[pi].id;
        next.push({ id: pairId(k, p), k, p, score: Math.round(b.score * 100) / 100 });
        kept.push([K[b.ki], P[pi]]);
      });
      pairs = next;
      byMarket = new Map();
      byId = new Map();
      for (const pr of next) { byMarket.set(pr.k, pr); byMarket.set(pr.p, pr); byId.set(pr.id, pr); }
      builtAt = Date.now();
      lastMs = builtAt - t0;
      lastError = null;
      console.log(`[pairs] ${next.length} suggested pairs from ${K.length} Kalshi and ${P.length} Polymarket candidates in ${(lastMs / 1000).toFixed(1)}s`);
      // The widest gaps are where a wrong pair shows first; log them so pairs can be audited from the logs.
      const name = (c, s) => { const t = (s.events.get(c.m.event) || {}).title || ''; return (t && t !== c.m.label ? `${t}: ${c.m.label}` : c.m.label).slice(0, 70); };
      const gaps = kept.map(([kc, pc]) => ({ kc, pc, gap: kc.m.mid != null && pc.m.mid != null ? kc.m.mid - pc.m.mid : null }))
        .filter((g) => g.gap != null).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 5);
      if (gaps.length) console.log(`[pairs] widest gaps: ${gaps.map((g) => `"${name(g.kc, ks)}" ${Math.round(g.kc.m.mid)}¢ vs "${name(g.pc, ps)}" ${Math.round(g.pc.m.mid)}¢`).join(' | ')}`);
    } catch (err) {
      lastError = { message: String((err && err.message) || err).slice(0, 300), at: Date.now() };
      console.warn(`[pairs] build failed: ${lastError.message}`);
    } finally {
      running = false;
    }
  }

  let started = false;
  return {
    start(everyMs = 10 * 60e3) {
      if (started) return;
      started = true;
      // Build as soon as both venues have data, then every ten minutes.
      const first = setInterval(() => { if (!builtAt) build(); else clearInterval(first); }, 30e3);
      setInterval(build, everyMs);
    },
    build,
    version: () => builtAt,
    pairs: () => pairs,
    get: (id) => byId.get(id) || null,
    forMarket: (id) => byMarket.get(id) || null,
    status: () => ({ builtAt: builtAt || null, pairs: pairs.length, seconds: lastMs == null ? null : Math.round(lastMs / 100) / 10, lastError, minUsd }),
  };
}
