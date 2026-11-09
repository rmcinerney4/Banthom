// Simulated quote feed. Prices only change when the demo feed "ticks"; when updates are paused or a
// scenario stalls a venue, timestamps stop advancing and records go Delayed — nothing is fabricated.
import React from 'react';
import { MARKETS, MARKET_BY_ID, VENUES } from './fixtures.js';
import { makeRng } from '../lib/rng.js';
import { SNAPSHOT, demoNow, MIN } from '../lib/time.js';
import { midOf } from '../lib/format.js';

const rng = makeRng('feed');
const listeners = new Set();
const state = {
  quotes: {},
  venueBeat: { ARD: SNAPSHOT - 6e3, BRS: SNAPSHOT - 24e3 },
  updates: true,
  scenario: 'normal',
  nextPriceTick: 0,
  version: 0,
};

for (const mk of MARKETS) {
  const r = makeRng(mk.id + ':age');
  const age = mk.venue === 'ARD' ? 3e3 + r.next() * 20e3 : 12e3 + r.next() * 50e3;
  state.quotes[mk.id] = {
    bid: mk.bid, ask: mk.ask, last: mk.last, bidSize: mk.bidSize, askSize: mk.askSize,
    observedAt: mk.status === 'resolved' ? mk.endAt : SNAPSHOT - age,
    ingestedAt: mk.status === 'resolved' ? mk.endAt : SNAPSHOT - age + 400 + r.next() * 900,
    lastAt: mk.status === 'resolved' ? mk.endAt : SNAPSHOT - age - (30e3 + r.next() * 600e3),
    changedAt: 0, dir: 0,
  };
}

let snapshot = { ...state, quotes: { ...state.quotes } };
const emit = () => {
  state.version++;
  snapshot = { quotes: { ...state.quotes }, venueBeat: { ...state.venueBeat }, updates: state.updates, scenario: state.scenario, version: state.version };
  listeners.forEach((l) => l());
};

const stalled = (venue) => !state.updates || (state.scenario === 'brs-delayed' && venue === 'BRS');

function tick() {
  const now = demoNow();
  let changed = false;
  for (const v of Object.keys(VENUES)) {
    if (stalled(v)) continue;
    if (now - state.venueBeat[v] >= VENUES[v].heartbeatS * 1000) {
      state.venueBeat[v] = now;
      for (const mk of MARKETS) {
        if (mk.venue !== v || mk.status === 'resolved') continue;
        const q = state.quotes[mk.id];
        const jitter = rng.next() * 1500;
        state.quotes[mk.id] = { ...q, observedAt: now - jitter, ingestedAt: now - jitter + 350 };
      }
      changed = true;
    }
  }
  if (state.updates && now >= state.nextPriceTick) {
    state.nextPriceTick = now + 4000 + rng.next() * 5000;
    const pool = MARKETS.filter((mk) => mk.status !== 'resolved' && !stalled(mk.venue) && mk.bid != null && mk.bid > 2 && mk.ask < 98);
    const count = rng.next() > 0.6 ? 2 : 1;
    for (let c = 0; c < count; c++) {
      const mk = rng.pick(pool);
      const q = state.quotes[mk.id];
      const up = rng.next() > 0.5;
      let { bid, ask } = q;
      const side = rng.next();
      if (side < 0.4) bid = up ? Math.min(bid + 1, ask - 1) : bid - 1;
      else if (side < 0.8) ask = up ? ask + 1 : Math.max(ask - 1, bid + 1);
      else { bid += up ? 1 : -1; ask += up ? 1 : -1; }
      // Keep the demo close to the fixture so narrative numbers stay readable.
      if (Math.abs(midOf({ bid, ask }) - midOf(mk)) > 2.5 || bid < 1 || ask > 99 || ask - bid > 6) continue;
      const traded = rng.next() > 0.5;
      state.quotes[mk.id] = {
        ...q, bid, ask, observedAt: now, ingestedAt: now + 300,
        last: traded ? (up ? ask : bid) : q.last, lastAt: traded ? now : q.lastAt,
        changedAt: now, dir: up ? 1 : -1,
      };
      changed = true;
    }
  }
  if (changed) emit();
}

let timer = null;
function ensureTimer() {
  if (!timer && typeof window !== 'undefined') timer = setInterval(tick, 1000);
}

export function subscribeQuotes(cb) {
  listeners.add(cb);
  ensureTimer();
  return () => listeners.delete(cb);
}
export const getQuotes = () => snapshot;
export const useFeed = () => React.useSyncExternalStore(subscribeQuotes, getQuotes, getQuotes);
export const useQuote = (id) => useFeed().quotes[id];

export function setUpdates(on) {
  state.updates = on;
  emit();
}
export function setFeedScenario(s) {
  const prev = state.scenario;
  state.scenario = s;
  if (s === 'brs-delayed' && prev !== 'brs-delayed') {
    const frozen = demoNow() - 7 * MIN - 12e3;
    state.venueBeat.BRS = frozen;
    for (const mk of MARKETS) {
      if (mk.venue === 'BRS' && mk.status !== 'resolved') state.quotes[mk.id] = { ...state.quotes[mk.id], observedAt: frozen, ingestedAt: frozen + 300 };
    }
  }
  emit();
}

// ---- Derived helpers
export function freshnessOf(mk, q, now) {
  if (mk.status === 'resolved') return { status: 'resolved', age: null };
  const age = Math.max(0, now - q.observedAt);
  return { status: age <= VENUES[mk.venue].recentS * 1000 ? 'recent' : 'delayed', age };
}

export function venueStatus(venue, feed, now) {
  const age = Math.max(0, now - feed.venueBeat[venue]);
  return { status: age <= VENUES[venue].recentS * 1000 ? 'recent' : 'delayed', age, lastAt: feed.venueBeat[venue] };
}

export function change24(mk, q) {
  if (mk.ch24 == null) return null;
  const m0 = midOf(mk);
  const m1 = midOf(q);
  if (m0 == null || m1 == null) return mk.ch24;
  return Math.round((mk.ch24 + (m1 - m0)) * 10) / 10;
}

export const marketById = (id) => MARKET_BY_ID[id];
