import React from 'react';
import { useStored } from './lib/hooks.js';
import { LIVE, API2, fetchJSON, venueRecent, venueName } from './data/live.js';
import { fmtCentsAuto, fmtPP, isNum } from './lib/format.js';

const { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } = React;
const StoreCtx = createContext(null);

// Everything here is saved in this browser only (no accounts yet).
const DEFAULT_PREFS = {
  highlight: true, density: 'standard', intent: null, interests: [], onboarded: false, railCollapsed: null, hiddenPanels: [], browserNotify: false,
};
const DEFAULT_LISTS = [{ id: 'my-markets', name: 'My markets', description: '', items: [] }];

// What a watchlist or alert remembers about a market, so it can still be named after the market closes.
export const itemOf = (r) => ({ id: r.id, venue: r.venue, label: r.label, eventTitle: r.eventTitle || '', multi: !!r.multi });
export const itemName = (it) => (it.multi && it.eventTitle ? `${it.eventTitle}: ${it.label}` : it.eventTitle || it.label);

// ---------------------------------------------------------------- Alert rules
export const METRICS = {
  mid: { label: 'Yes midpoint', unit: '¢' },
  bid: { label: 'Yes bid', unit: '¢' },
  ask: { label: 'Yes ask', unit: '¢' },
  last: { label: 'Last trade', unit: '¢' },
  change: { label: '24h change', unit: 'pp' },
};
export const COOLDOWNS = [[15, '15 minutes'], [60, '1 hour'], [240, '4 hours'], [1440, '1 day']];
const valueOf = (metric, q) => (metric === 'change' ? q.ch24 : q[metric]);
export function ruleText(r) {
  const m = METRICS[r.metric] || METRICS.mid;
  const v = r.metric === 'change' ? `${r.threshold} pp` : `${r.threshold}¢`;
  const where = `“${itemName(r)}” on ${venueName(r.venue)}`;
  if (r.metric === 'change') {
    return r.op === 'absgte' ? `24h change on ${where} reaches ${v} either way`
      : `24h change on ${where} ${r.op === 'gte' ? 'rises by' : 'falls by'} at least ${v}`;
  }
  return `${m.label} on ${where} ${r.op === 'gte' ? 'rises to' : 'falls to'} ${v} or ${r.op === 'gte' ? 'higher' : 'lower'}`;
}
export function ruleHit(r, q) {
  const v = valueOf(r.metric, q);
  if (!isNum(v)) return false;
  if (r.op === 'absgte') return Math.abs(v) >= r.threshold;
  if (r.metric === 'change' && r.op === 'lte') return v <= -Math.abs(r.threshold);
  return r.op === 'gte' ? v >= r.threshold : v <= r.threshold;
}
export const fmtMetric = (metric, v) => (!isNum(v) ? '—' : metric === 'change' ? fmtPP(v) : fmtCentsAuto(v));

// Checks enabled alerts against live quotes every 30 seconds while the site is open.
function AlertWatcher({ rules, onFire }) {
  const ids = useMemo(() => [...new Set(rules.filter((r) => r.enabled).map((r) => r.marketId))].sort(), [rules]);
  const latest = useRef({ rules, onFire });
  latest.current = { rules, onFire };
  useEffect(() => {
    if (!LIVE || !ids.length) return undefined;
    let alive = true;
    let timer = null;
    const run = async () => {
      try {
        const data = await fetchJSON(API2.quotes(ids));
        const byId = Object.fromEntries((data.quotes || []).filter((q) => !q.missing).map((q) => [q.id, q]));
        const now = Date.now();
        for (const r of latest.current.rules) {
          if (!r.enabled) continue;
          const q = byId[r.marketId];
          if (!q || !isNum(q.observedAt) || now - q.observedAt > venueRecent(q.venue) * 1000) continue; // only on current data
          if (r.lastFiredAt && now - r.lastFiredAt < r.cooldown * 60e3) continue;
          if (ruleHit(r, q)) latest.current.onFire(r, q, now);
        }
      } catch { /* try again next round */ }
      if (alive) timer = setTimeout(run, 30000);
    };
    run();
    return () => { alive = false; clearTimeout(timer); };
  }, [ids.join(',')]);
  return null;
}

export function StoreProvider({ children }) {
  const [watchlists, setWatchlists] = useStored('v2-watchlists', DEFAULT_LISTS);
  const [alerts, setAlerts] = useStored('v2-alerts', []);
  const [history, setHistory] = useStored('v2-alert-history', []);
  const [prefs, setPrefs] = useStored('prefs', DEFAULT_PREFS);
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});
  const p = { ...DEFAULT_PREFS, ...prefs };

  useEffect(() => { document.documentElement.dataset.density = p.density; }, [p.density]);
  const setPref = useCallback((key, value) => setPrefs((cur) => ({ ...DEFAULT_PREFS, ...cur, [key]: value })), [setPrefs]);

  const dismissToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current[id]);
  }, []);
  const toast = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, message, tone: opts.tone || 'success', action: opts.action || null }]);
    timers.current[id] = setTimeout(() => dismissToast(id), opts.action ? 6000 : 4500);
    return id;
  }, [dismissToast]);

  // ---- Watchlists
  const lists = Array.isArray(watchlists) && watchlists.length ? watchlists.map((w) => ({ ...w, items: w.items || [] })) : DEFAULT_LISTS;
  const isWatched = useCallback((id, listId = 'my-markets') => {
    const l = lists.find((x) => x.id === listId);
    return !!l && l.items.some((it) => it.id === id);
  }, [lists]);
  const setItems = useCallback((listId, fn) => setWatchlists((ls) => (Array.isArray(ls) && ls.length ? ls : DEFAULT_LISTS)
    .map((x) => (x.id !== listId ? x : { ...x, items: fn(x.items || []) }))), [setWatchlists]);
  const toggleWatch = useCallback((item, listId = 'my-markets') => {
    const list = lists.find((x) => x.id === listId);
    if (!list) return;
    const has = list.items.some((it) => it.id === item.id);
    const apply = (add) => setItems(listId, (items) => (add ? (items.some((it) => it.id === item.id) ? items : [...items, item]) : items.filter((it) => it.id !== item.id)));
    apply(!has);
    toast(has ? `Removed “${itemName(item)}” from ${list.name}.` : `Added “${itemName(item)}” to ${list.name}.`, { action: { label: 'Undo', onClick: () => apply(has) } });
  }, [lists, setItems, toast]);
  const removeFromList = useCallback((listId, id) => setItems(listId, (items) => items.filter((it) => it.id !== id)), [setItems]);
  const createList = useCallback((name) => {
    const id = 'wl-' + Math.random().toString(36).slice(2, 7);
    setWatchlists((ls) => [...(Array.isArray(ls) ? ls : DEFAULT_LISTS), { id, name, description: '', items: [] }]);
    toast(`Created ${name}.`);
    return id;
  }, [setWatchlists, toast]);
  const updateList = useCallback((id, patch) => setWatchlists((ls) => ls.map((x) => (x.id === id ? { ...x, ...patch } : x))), [setWatchlists]);
  const deleteList = useCallback((id) => {
    let removed = null;
    setWatchlists((ls) => { removed = ls.find((x) => x.id === id); return ls.filter((x) => x.id !== id); });
    toast('Watchlist deleted.', { action: { label: 'Undo', onClick: () => removed && setWatchlists((ls) => [...ls, removed]) } });
  }, [setWatchlists, toast]);

  // ---- Alerts
  const rules = Array.isArray(alerts) ? alerts : [];
  const saveAlert = useCallback((rule) => setAlerts((rs) => {
    const cur = Array.isArray(rs) ? rs : [];
    return cur.some((r) => r.id === rule.id) ? cur.map((r) => (r.id === rule.id ? rule : r)) : [...cur, rule];
  }), [setAlerts]);
  const removeAlert = useCallback((id) => {
    let removed = null;
    setAlerts((rs) => { removed = rs.find((r) => r.id === id); return rs.filter((r) => r.id !== id); });
    toast('Alert deleted.', { action: { label: 'Undo', onClick: () => removed && setAlerts((rs) => [...rs, removed]) } });
  }, [setAlerts, toast]);
  const toggleAlert = useCallback((id) => setAlerts((rs) => rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))), [setAlerts]);

  const hist = Array.isArray(history) ? history : [];
  const prefsRef = useRef(p);
  prefsRef.current = p;
  const onFire = useCallback((r, q, now) => {
    const text = `${ruleText(r)}: now ${fmtMetric(r.metric, valueOf(r.metric, q))}.`;
    setAlerts((rs) => rs.map((x) => (x.id === r.id ? { ...x, lastFiredAt: now } : x)));
    setHistory((h) => [{ id: Math.random().toString(36).slice(2), ruleId: r.id, marketId: r.marketId, venue: r.venue, label: itemName(r), text, value: valueOf(r.metric, q), t: now, unread: true }, ...(Array.isArray(h) ? h : [])].slice(0, 200));
    toast(text, { tone: 'info' });
    // Optional system notification, so an alert is seen when this tab is in the background.
    if (prefsRef.current.browserNotify && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification('Banthom alert', { body: text, tag: r.id }); } catch { /* some browsers only allow this from a service worker */ }
    }
  }, [setAlerts, setHistory, toast]);
  const markRead = useCallback((id) => setHistory((h) => h.map((x) => (id == null || x.id === id ? { ...x, unread: false } : x))), [setHistory]);
  const clearHistory = useCallback(() => setHistory([]), [setHistory]);
  const unread = hist.filter((h) => h.unread).length;
  // Removes everything Banthom saved in this browser.
  const clearAll = useCallback(() => {
    setWatchlists(DEFAULT_LISTS); setAlerts([]); setHistory([]); setPrefs(DEFAULT_PREFS);
    toast('Cleared watchlists, alerts and settings saved in this browser.');
  }, [setWatchlists, setAlerts, setHistory, setPrefs, toast]);

  const value = useMemo(() => ({
    prefs: p, setPref, toasts, toast, dismissToast,
    watchlists: lists, isWatched, toggleWatch, removeFromList, createList, updateList, deleteList,
    alerts: rules, saveAlert, removeAlert, toggleAlert,
    history: hist, unread, markRead, clearHistory, clearAll,
  }), [p, setPref, toasts, toast, dismissToast, lists, isWatched, toggleWatch, removeFromList, createList, updateList, deleteList, rules, saveAlert, removeAlert, toggleAlert, hist, unread, markRead, clearHistory, clearAll]);

  return (
    <StoreCtx.Provider value={value}>
      {children}
      <AlertWatcher rules={rules} onFire={onFire} />
    </StoreCtx.Provider>
  );
}

export const useStore = () => useContext(StoreCtx);
