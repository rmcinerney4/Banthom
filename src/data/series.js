// Deterministic price histories, order books and trade prints for the DEMO fixtures.
// Histories are 5-minute "Yes midpoint" observations; feed gaps are stored as NaN and never filled.
import { MARKET_BY_ID, TIMELINE } from './fixtures.js';
import { makeRng, hashString } from '../lib/rng.js';
import { SNAPSHOT, MIN, HOUR, DAY } from '../lib/time.js';

export const STEP = 5 * MIN;
const logit = (p) => Math.log(p / (1 - p));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const clampC = (v) => Math.min(99.3, Math.max(0.7, v));
const toX = (cents) => logit(clampC(cents) / 100);
const toC = (x) => 100 * sigmoid(x);
const cache = new Map();

const midOfFixture = (mk) => (mk.status === 'resolved' ? mk.end : (mk.bid + mk.ask) / 2);

function anchorList(mk, t0, end) {
  const list = [];
  if (!mk.derive) list.push([t0, mk.start]);
  for (const a of mk.anchors || []) if (a[0] > t0 && a[0] < end) list.push(a);
  if (mk.status !== 'resolved' && mk.ch24 != null) list.push([SNAPSHOT - DAY, midOfFixture(mk) - mk.ch24]);
  list.push([end, midOfFixture(mk)]);
  return list.sort((a, b) => a[0] - b[0]);
}

function interpAnchors(anchors, t) {
  if (t <= anchors[0][0]) return anchors[0][1];
  for (let k = 1; k < anchors.length; k++) {
    if (t <= anchors[k][0]) {
      const [ta, va] = anchors[k - 1];
      const [tb, vb] = anchors[k];
      return va + ((vb - va) * (t - ta)) / (tb - ta || 1);
    }
  }
  return anchors[anchors.length - 1][1];
}

export function baseSeries(id) {
  if (cache.has(id)) return cache.get(id);
  const mk = MARKET_BY_ID[id];
  const end = mk.status === 'resolved' ? mk.endAt : SNAPSHOT;
  const t0 = Math.ceil(mk.listed / STEP) * STEP;
  const n = Math.floor((end - t0) / STEP) + 1;
  const rng = makeRng(id + ':walk');
  const anchors = anchorList(mk, t0, t0 + (n - 1) * STEP);
  const y = new Float64Array(n);

  if (mk.derive) {
    const src = baseSeries(mk.derive.from);
    let d = 0;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * STEP;
      const j = Math.min(src.n - 1, Math.max(0, Math.round((t - src.t0) / STEP)));
      const sv = src.raw[j];
      d = d * (1 - 0.004) + rng.normal() * 0.004;
      const v = mk.derive.mode === 'invert' ? 100 - sv + mk.derive.offset : sv + mk.derive.offset;
      y[i] = toX(v) + d;
    }
  } else {
    const sigma = mk.sigma || 0.0045;
    const kappa = 0.0005;
    const jumps = (mk.jumps || []).map(([t, pp]) => {
      const p = clampC(interpAnchors(anchors, t)) / 100;
      return [Math.round((t - t0) / STEP), pp / 100 / (p * (1 - p))];
    });
    let d = 0;
    let J = 0;
    let jk = 0;
    const x0 = toX(mk.start);
    for (let i = 0; i < n; i++) {
      while (jk < jumps.length && jumps[jk][0] <= i) { J += jumps[jk][1]; jk++; }
      y[i] = x0 + d + J;
      d = d * (1 - kappa) + rng.normal() * sigma;
    }
  }

  // Pin the walk to the anchor values (piecewise-linear correction in logit space).
  const idx = anchors.map(([t, v]) => [Math.min(n - 1, Math.max(0, Math.round((t - t0) / STEP))), toX(v)]);
  const err = idx.map(([i, xv]) => [i, xv - y[i]]);
  if (!mk.derive) err[0][1] = 0;
  let k = 0;
  const raw = new Float32Array(n);
  const values = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    while (k < err.length - 1 && i > err[k + 1][0]) k++;
    let e;
    if (i <= err[0][0]) e = err[0][1];
    else if (k >= err.length - 1) e = err[err.length - 1][1];
    else {
      const [ia, ea] = err[k];
      const [ib, eb] = err[k + 1];
      e = ea + ((eb - ea) * (i - ia)) / (ib - ia || 1);
    }
    const c = toC(y[i] + e);
    raw[i] = c;
    values[i] = Math.round(c * 2) / 2; // midpoints of whole-cent quotes move in 0.5¢ steps
  }
  // Exact endpoints and anchors after rounding.
  for (const [t, v] of anchors) {
    const i = Math.min(n - 1, Math.max(0, Math.round((t - t0) / STEP)));
    values[i] = Math.round(v * 2) / 2;
  }
  for (const [a, b] of mk.gaps || []) {
    for (let i = Math.max(0, Math.ceil((a - t0) / STEP)); i < n && t0 + i * STEP < b; i++) values[i] = NaN;
  }
  const s = { id, t0, n, end: t0 + (n - 1) * STEP, raw, values };
  cache.set(id, s);
  return s;
}

const valueAt = (s, i) => (i >= 0 && i < s.n ? s.values[i] : NaN);

// Last observation per bucket. Buckets with no observation are null (rendered as gaps).
export function sampleSeries(id, from, to, step) {
  const s = baseSeries(id);
  const out = [];
  const start = Math.ceil(from / step) * step;
  for (let t = start; t <= to + 1; t += step) {
    let v = null;
    if (t >= s.t0 && t - step <= s.end) {
      if (step < STEP) {
        // Minute view: hold each 5-minute observation, switching to the next one at a deterministic minute.
        const i = Math.floor((t - s.t0) / STEP);
        const a = valueAt(s, i);
        const b = valueAt(s, i + 1);
        const switchAt = 1 + (hashString(id + i) % 4);
        const minute = Math.round(((t - s.t0) % STEP) / MIN);
        const pick = minute >= switchAt && !Number.isNaN(b) && t + STEP <= s.end + STEP ? b : a;
        v = Number.isNaN(pick) ? null : pick;
        if (t > s.end) v = null;
      } else {
        const iHi = Math.min(s.n - 1, Math.floor((t - s.t0) / STEP));
        const iLo = Math.max(0, Math.floor((t - step - s.t0) / STEP) + 1);
        for (let i = iHi; i >= iLo; i--) {
          const val = s.values[i];
          if (!Number.isNaN(val)) { v = val; break; }
        }
      }
    }
    out.push({ t, v });
  }
  // Close the window with the latest observation so the line ends where the quote is.
  const lastT = out.length ? out[out.length - 1].t : start - step;
  if (to - lastT > 1000 && step >= STEP) {
    let v = null;
    const iHi = Math.min(s.n - 1, Math.floor((to - s.t0) / STEP));
    const iLo = Math.max(0, Math.floor((lastT - s.t0) / STEP) + 1);
    for (let i = iHi; i >= iLo; i--) { const val = s.values[i]; if (!Number.isNaN(val)) { v = val; break; } }
    if (to >= s.t0 && lastT <= s.end) out.push({ t: to, v });
  }
  return out;
}

export const TIMEFRAMES = [
  { id: '1H', label: '1H', name: '1 hour', span: HOUR, step: MIN, sampling: '1-minute last observation' },
  { id: '1D', label: '1D', name: '1 day', span: DAY, step: 5 * MIN, sampling: '5-minute last observation' },
  { id: '1W', label: '1W', name: '1 week', span: 7 * DAY, step: 30 * MIN, sampling: '30-minute last observation' },
  { id: '1M', label: '1M', name: '1 month', span: 30 * DAY, step: 2 * HOUR, sampling: '2-hour last observation' },
  { id: 'ALL', label: 'All', name: 'Since listing', span: null, step: 6 * HOUR, sampling: '6-hour last observation' },
];

export function seriesFor(id, tfId, endT) {
  const tf = TIMEFRAMES.find((x) => x.id === tfId) || TIMEFRAMES[2];
  const s = baseSeries(id);
  const end = Math.min(endT || SNAPSHOT, s.end);
  const from = tf.span ? end - tf.span : s.t0;
  return { points: sampleSeries(id, from, end, tf.step), from, to: end, tf };
}

export function sparkline(id, days = 7) {
  const s = baseSeries(id);
  const end = s.end;
  return sampleSeries(id, end - days * DAY, end, 3 * HOUR);
}

export function valueAtTime(id, t) {
  const s = baseSeries(id);
  const i = Math.round((t - s.t0) / STEP);
  const v = valueAt(s, i);
  return Number.isNaN(v) ? null : v;
}

export function markersFor(mk, from, to) {
  return TIMELINE.filter((e) => e.eventId === mk.eventId && e.t >= from && e.t <= to).sort((a, b) => a.t - b.t);
}

export function gapsIn(id, from, to) {
  const mk = MARKET_BY_ID[id];
  return (mk.gaps || []).filter(([a, b]) => b > from && a < to);
}

// ---- Order book (top levels). Explicit fixtures where the comparison math depends on them.
export function orderBook(mk, q) {
  if (q.bid == null && q.ask == null) return { bids: [], asks: [] };
  if (mk.book && q.bid === mk.bid && q.ask === mk.ask) {
    return { bids: mk.book.bids.map(([price, size]) => ({ price, size })), asks: mk.book.asks.map(([price, size]) => ({ price, size })) };
  }
  const rng = makeRng(mk.id + ':book');
  const side = (best, top, dir) => {
    const lv = [];
    let size = top;
    for (let k = 0; k < 6; k++) {
      const price = best + dir * k;
      if (price < 1 || price > 99) break;
      if (k > 0) size = Math.max(100, Math.round((size * (0.7 + rng.next() * 1.1)) / 50) * 50);
      lv.push({ price, size: k === 0 ? top : size });
    }
    return lv;
  };
  return { bids: q.bid != null ? side(q.bid, q.bidSize || 500, -1) : [], asks: q.ask != null ? side(q.ask, q.askSize || 500, 1) : [] };
}

// Average cost of walking the book for `qty` contracts. Returns null if depth runs out.
export function walkBook(levels, qty) {
  let left = qty;
  let cost = 0;
  for (const l of levels) {
    const take = Math.min(left, l.size);
    cost += take * l.price;
    left -= take;
    if (left <= 0) break;
  }
  return left > 0 ? null : cost / qty;
}

export function tradePrints(mk, q, count = 14) {
  if (mk.status === 'resolved' || q.last == null) return [];
  const rng = makeRng(mk.id + ':prints');
  const prints = [];
  let t = q.lastAt || SNAPSHOT - 40e3;
  let price = q.last;
  for (let i = 0; i < count; i++) {
    const side = rng.next() > 0.5 ? 'Yes' : 'No';
    prints.push({ t, price, side, size: Math.round((20 + rng.next() * 900) / 10) * 10 });
    t -= Math.round((40 + rng.next() * 520) * 1000);
    if (rng.next() > 0.65) price = Math.max(1, Math.min(99, price + (rng.next() > 0.5 ? 1 : -1)));
  }
  return prints;
}
