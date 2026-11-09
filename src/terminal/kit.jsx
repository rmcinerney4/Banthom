// Shared terminal building blocks: market rows, quote cells, freshness, tiles.
import React from 'react';
import { Icon, IconButton, Badge, Banner, Button, InfoTip } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { useFeed, freshnessOf, venueStatus, change24 } from '../data/quotes.js';
import { MARKETS, EVENT_BY_ID, VENUES, CATEGORIES, matchForMarket } from '../data/fixtures.js';
import { useNow } from '../lib/hooks.js';
import { fmtCents, fmtTime, fmtTimeSec, fmtAge, fmtAgeLong, midOf, spreadOf, cx, isNum } from '../lib/format.js';
import { DAY, demoNow } from '../lib/time.js';

const { useEffect, useMemo } = React;

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
export const shortEvent = (mk) => EVENT_BY_ID[mk.eventId].title;

export function statusOf(mk, now) {
  if (mk.status === 'resolved') return 'resolved';
  return mk.closes - now <= 7 * DAY ? 'closing' : 'active';
}
export const STATUS_LABEL = { active: 'Active', closing: 'Closing soon', resolved: 'Resolved' };

export function useTitle(title) {
  useEffect(() => { document.title = `${title} · Banthom`; }, [title]);
}

// One row per market with the live quote and derived values.
export function useMarketRows(filterFn) {
  const feed = useFeed();
  return useMemo(() => {
    const now = demoNow();
    return MARKETS.filter((mk) => (filterFn ? filterFn(mk) : true)).map((mk) => {
      const q = feed.quotes[mk.id];
      return {
        mk, q, id: mk.id,
        bid: q.bid, ask: q.ask, mid: midOf(q), spread: spreadOf(q), last: q.last,
        ch24: change24(mk, q), vol: mk.vol, size: q.askSize, oi: mk.oi,
        resolves: mk.resolves, observedAt: q.observedAt, match: matchForMarket(mk.id),
        status: statusOf(mk, now),
      };
    });
  }, [feed, filterFn]);
}

// Price cell: re-mounts on change so the 300ms tint plays once (no blinking).
export function QuoteNum({ value, changedAt, digits = 0, className }) {
  const { prefs } = useStore();
  const fresh = !!(prefs.highlight && changedAt && demoNow() - changedAt < 1500);
  return (
    <span key={fresh ? changedAt : 'static'} className={cx('qnum', fresh && 'tick-flash', className)}>
      {isNum(value) ? fmtCents(value, digits) : <span className="muted" data-tip="Not available">—</span>}
    </span>
  );
}

export function StarButton({ id, listId = 'my-markets', size = 'sm' }) {
  const { isWatched, toggleWatch } = useStore();
  const on = isWatched(id, listId);
  return (
    <button type="button" className={cx('star-btn', on && 'is-on', `star-${size}`)} aria-pressed={on}
      aria-label={on ? 'Remove from My markets' : 'Add to My markets'} data-tip={on ? 'Remove from My markets' : 'Add to My markets'}
      onClick={(e) => { e.stopPropagation(); toggleWatch(id, listId); }}>
      <Icon n="star" size={size === 'lg' ? 18 : 16} strokeWidth={on ? 0 : 1.75} style={on ? { fill: 'currentColor' } : undefined} />
    </button>
  );
}

export function DataAge({ mk, q }) {
  const now = useNow();
  const f = freshnessOf(mk, q, now);
  if (f.status === 'resolved') return <span className="muted">Resolved</span>;
  if (f.status === 'delayed') {
    return <span className="age age-stale" data-tip={`Delayed. Last updated ${fmtTimeSec(q.observedAt)}`} data-tip-pos="left"><Icon n="clock" size={12} strokeWidth={2} />{fmtAge(f.age)}<span className="sr-only"> (delayed)</span></span>;
  }
  return <span className="age" data-tip={`Observed ${fmtTimeSec(q.observedAt)}`} data-tip-pos="left">{fmtAge(f.age)}</span>;
}

export function StatusBadge({ status, result }) {
  if (status === 'resolved') return <Badge tone="neutral" icon="circle-check">Resolved {result ? `${result} (simulated)` : ''}</Badge>;
  if (status === 'closing') return <Badge tone="info" icon="timer">Closing soon</Badge>;
  return <Badge tone="muted" icon="circle-dot">Active</Badge>;
}

// Venue feed state for banners and the top bar.
export function useVenueStates() {
  const feed = useFeed();
  const now = useNow();
  return Object.keys(VENUES).map((v) => ({ venue: v, ...venueStatus(v, feed, now) }));
}

export function StaleVenueBanner({ compact }) {
  const states = useVenueStates();
  const { toast } = useStore();
  const stale = states.filter((s) => s.status === 'delayed');
  if (!stale.length) return null;
  return (
    <div className="stack-sm">
      {stale.map((s) => (
        <Banner key={s.venue} tone="warning" icon="clock" title={`${VENUES[s.venue].name} data is delayed.`}
          actions={!compact && (
            <>
              <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => toast(`Still no update from ${VENUES[s.venue].short}. Banthom keeps retrying in the background.`, { tone: 'info' })}>Retry</Button>
            </>
          )}>
          Last update {fmtTimeSec(s.lastAt)} ({fmtAgeLong(s.age)}). {VENUES[s.venue].short} quotes may no longer be actionable; spread estimates that use them are switched off.
        </Banner>
      ))}
    </div>
  );
}

export function MetricTile({ label, value, unit, sub, delta, href, linkLabel, tip, children, className }) {
  return (
    <div className={cx('tile', className)}>
      <p className="tile-label">{label}{tip && <InfoTip text={tip} label={label} />}</p>
      <p className="tile-value"><span>{value}</span>{unit && <span className="tile-unit">{unit}</span>}{delta}</p>
      {sub && <p className="tile-sub">{sub}</p>}
      {children}
      {href && <a className="tile-link" href={href}>{linkLabel}<Icon n="arrow-right" size={14} /></a>}
    </div>
  );
}

export function SortHeader({ col, sort, setSort, children, num, tip, className }) {
  const active = sort.key === col;
  const dir = active ? sort.dir : null;
  return (
    <th scope="col" className={cx(num && 'num', className)} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-sort" onClick={() => setSort({ key: col, dir: active && dir === 'desc' ? 'asc' : 'desc' })}>
        {children}
        <Icon n={!active ? 'chevrons-up-down' : dir === 'asc' ? 'arrow-up' : 'arrow-down'} size={13} />
      </button>
      {tip && <InfoTip text={tip} label={typeof children === 'string' ? children : 'Column'} pos="bottom" />}
    </th>
  );
}

export function sortRows(rows, sort) {
  const { key, dir } = sort;
  const m = dir === 'asc' ? 1 : -1;
  const val = (r) => {
    if (key === 'title') return r.mk.title;
    if (key === 'venue') return r.mk.venue;
    if (key === 'ch24abs') return isNum(r.ch24) ? Math.abs(r.ch24) : null;
    return r[key];
  };
  return [...rows].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string') return va.localeCompare(vb) * m;
    return (va - vb) * m;
  });
}

export function rowKeyNav(e, open) {
  if (e.key === 'Enter') { e.preventDefault(); open(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const tr = e.currentTarget;
    const next = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
    if (next && next.tabIndex === 0) next.focus();
  }
}

export { fmtTime };
