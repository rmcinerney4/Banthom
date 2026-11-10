import React from 'react';

const { useState, useEffect, useRef, useLayoutEffect, useSyncExternalStore, useCallback } = React;

// ---- Hash routing (artifact links only carry a plain #name, so routes are hyphenated names)
const readHash = () => {
  try { return decodeURIComponent((window.location.hash || '').replace(/^#/, '')); } catch { return ''; }
};
const subscribeHash = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
export const useHash = () => useSyncExternalStore(subscribeHash, readHash, () => '');
export function go(name) {
  if (readHash() === name) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = name;
}

// ---- Media queries
export function useMedia(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on));
  }, [query]);
  return match;
}
export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');

// ---- Per-viewer storage (a convenience only: every read and write may fail)
const PREFIX = 'banthom:v1:';
export function readStored(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
export function writeStored(key, value) {
  try { window.localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
export function useStored(key, initial) {
  const [value, setValue] = useState(() => readStored(key, typeof initial === 'function' ? initial() : initial));
  useEffect(() => { writeStored(key, value); }, [key, value]);
  return [value, setValue];
}

// ---- Element width
export function useWidth(ref) {
  const [w, setW] = useState(0);
  const [el, setEl] = useState(null);
  useLayoutEffect(() => { if (ref.current !== el) setEl(ref.current); });
  useLayoutEffect(() => {
    if (!el) return undefined;
    setW(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0] && entries[0].contentRect.width;
      if (cw) setW(Math.round(cw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return w;
}

// ---- Dialog focus management: trap Tab, close on Escape, restore focus to the opener.
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function useFocusTrap(ref, active, onEscape, { lockScroll = true } = {}) {
  const esc = useRef(onEscape);
  esc.current = onEscape;
  useEffect(() => {
    if (!active) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const opener = document.activeElement;
    const list = () => [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length > 0);
    const focusFirst = () => {
      const target = el.querySelector('[data-autofocus]') || list()[0] || el;
      if (target && target.focus) target.focus({ preventScroll: true });
    };
    focusFirst();
    const t = setTimeout(() => { if (!el.contains(document.activeElement)) focusFirst(); }, 30);
    const onKey = (e) => {
      if (e.key === 'Escape' && esc.current) { e.stopPropagation(); e.preventDefault(); esc.current(); return; }
      if (e.key !== 'Tab') return;
      const f = list();
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      el.removeEventListener('keydown', onKey);
      if (lockScroll) document.body.style.overflow = prevOverflow;
      if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [active]);
}

// ---- Close a popover when clicking outside it or pressing Escape
export function useDismiss(refs, open, onClose) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => {
      const inside = refs.some((r) => r.current && r.current.contains(e.target));
      if (!inside) cb.current();
    };
    const key = (e) => { if (e.key === 'Escape') { cb.current(); } };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
}

export function useInterval(fn, ms, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (!enabled || !ms) return undefined;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}

export function useStableId(prefix = 'id') {
  const ref = useRef(null);
  if (ref.current == null) ref.current = `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  return ref.current;
}

export function useCopy() {
  return useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);
}
