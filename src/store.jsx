import React from 'react';
import { useStored } from './lib/hooks.js';
import { DEFAULT_WATCHLISTS, DEFAULT_ALERTS, ALERT_HISTORY, MARKET_BY_ID } from './data/fixtures.js';
import { setUpdates, setFeedScenario } from './data/quotes.js';
import { demoNow } from './lib/time.js';

const { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } = React;
const StoreCtx = createContext(null);

const DEFAULT_PREFS = {
  highlight: true, updates: true, density: 'standard', scenario: 'normal',
  intent: null, interests: [], onboarded: false, railCollapsed: null,
};

export function StoreProvider({ children }) {
  const [watchlists, setWatchlists] = useStored('watchlists', DEFAULT_WATCHLISTS);
  const [alerts, setAlerts] = useStored('alerts', DEFAULT_ALERTS);
  const [history, setHistory] = useStored('alert-history', ALERT_HISTORY);
  const [prefs, setPrefs] = useStored('prefs', DEFAULT_PREFS);
  const [emptyLists, setEmptyLists] = useState(() => DEFAULT_WATCHLISTS.map((w) => ({ ...w, ids: [] })));
  const [emptyAlerts, setEmptyAlerts] = useState([]);
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const p = { ...DEFAULT_PREFS, ...prefs };
  const empty = p.scenario === 'empty';

  useEffect(() => { setUpdates(p.updates); }, [p.updates]);
  useEffect(() => { setFeedScenario(p.scenario === 'brs-delayed' ? 'brs-delayed' : 'normal'); }, [p.scenario]);
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

  const lists = empty ? emptyLists : watchlists;
  const setLists = empty ? setEmptyLists : setWatchlists;
  const ruleList = empty ? emptyAlerts : alerts;
  const setRules = empty ? setEmptyAlerts : setAlerts;

  const isWatched = useCallback((id, listId = 'my-markets') => {
    const l = lists.find((x) => x.id === listId);
    return !!l && l.ids.includes(id);
  }, [lists]);

  const toggleWatch = useCallback((id, listId = 'my-markets') => {
    const list = lists.find((x) => x.id === listId);
    if (!list) return;
    const has = list.ids.includes(id);
    const apply = (add) => setLists((ls) => ls.map((x) => (x.id !== listId ? x : {
      ...x, ids: add ? (x.ids.includes(id) ? x.ids : [...x.ids, id]) : x.ids.filter((y) => y !== id),
    })));
    apply(!has);
    const mk = MARKET_BY_ID[id];
    const short = mk ? mk.outcome : 'Market';
    toast(has ? `Removed “${short}” from ${list.name}.` : `Added “${short}” to ${list.name}.`, {
      action: { label: 'Undo', onClick: () => apply(has) },
    });
  }, [lists, setLists, toast]);

  const createList = useCallback((name) => {
    const id = 'wl-' + Math.random().toString(36).slice(2, 7);
    setLists((ls) => [...ls, { id, name, description: '', ids: [] }]);
    toast(`Created ${name}.`);
    return id;
  }, [setLists, toast]);

  const updateList = useCallback((id, patch) => setLists((ls) => ls.map((x) => (x.id === id ? { ...x, ...patch } : x))), [setLists]);

  const saveAlert = useCallback((rule) => {
    setRules((rs) => {
      const exists = rs.some((r) => r.id === rule.id);
      return exists ? rs.map((r) => (r.id === rule.id ? rule : r)) : [...rs, rule];
    });
  }, [setRules]);
  const removeAlert = useCallback((id) => {
    let removed = null;
    setRules((rs) => { removed = rs.find((r) => r.id === id); return rs.filter((r) => r.id !== id); });
    toast('Alert deleted.', { action: { label: 'Undo', onClick: () => removed && setRules((rs) => [...rs, removed]) } });
  }, [setRules, toast]);
  const toggleAlert = useCallback((id) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))), [setRules]);

  const markRead = useCallback((id) => setHistory((h) => h.map((x) => (id == null || x.id === id ? { ...x, unread: false } : x))), [setHistory]);
  const shownHistory = empty ? [] : history;
  const unread = shownHistory.filter((h) => h.unread).length;

  const resetDemo = useCallback(() => {
    setWatchlists(DEFAULT_WATCHLISTS);
    setAlerts(DEFAULT_ALERTS);
    setHistory(ALERT_HISTORY);
    setPrefs(DEFAULT_PREFS);
    toast('Demo data reset.');
  }, [setWatchlists, setAlerts, setHistory, setPrefs, toast]);

  const value = useMemo(() => ({
    prefs: p, setPref, toasts, toast, dismissToast,
    watchlists: lists, isWatched, toggleWatch, createList, updateList,
    alerts: ruleList, saveAlert, removeAlert, toggleAlert,
    history: shownHistory, unread, markRead, resetDemo, now: demoNow,
  }), [p, setPref, toasts, toast, dismissToast, lists, isWatched, toggleWatch, createList, updateList, ruleList, saveAlert, removeAlert, toggleAlert, shownHistory, unread, markRead, resetDemo]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);
