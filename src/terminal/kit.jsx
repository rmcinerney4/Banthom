// Shared terminal building blocks for live data: market tables and cards, freshness, tiles.
import React from 'react';
import { Icon, Badge, Banner, InfoTip, VenueBadge, Delta, MenuButton } from '../ui/core.jsx';
import { useStore, itemOf } from '../store.jsx';
import { go, useMedia } from '../lib/hooks.js';
import { fmtCentsAuto, fmtDateShort, fmtTimeSec, fmtAge, fmtAgeLong, fmtVolume, cx, isNum } from '../lib/format.js';
import { useRealNow, liveFreshness, venueRecent, venueName, marketHref, eventHref, usePolled, API2 } from '../data/live.js';

const { useEffect, useMemo, useState } = React;

export function useTitle(title) {
  useEffect(() => { document.title = `${title} · Banthom`; }, [title]);
}

// Pages that load their own titles (market, event, pair) publish breadcrumbs to the top bar.
export const CrumbCtx = React.createContext(() => {});
export function usePageCrumbs(crumbs) {
  const set = React.useContext(CrumbCtx);
  const key = crumbs ? JSON.stringify(crumbs) : '';
  useEffect(() => { set(crumbs || null); }, [key]);
  useEffect(() => () => set(null), []);
}

export const volText = (r) => fmtVolume(r.vol24, r.volUnit === 'ct' ? 'ct' : 'usd');
export const volTip = 'Kalshi reports volume in contracts and Polymarket in USDC. Rankings across both venues use an approximate dollar figure.';
// One-line name for a market row: "Event: outcome" for multi-outcome events, otherwise the question.
export const rowName = (r) => {
  const base = r.multi ? `${r.eventTitle}: ${r.label}` : r.eventTitle || r.label;
  return r.yes ? `${base} (Yes = ${r.yes})` : base;
};

// ---------------------------------------------------------------- Market search (server-side)
// Combobox over every open market on both venues. Used by the alert editor, watchlists and the command palette.
export function MarketSearch({ id, onPick, placeholder = 'Search markets', exclude, invalid, describedBy, autoFocus, label = 'Markets' }) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 200); return () => clearTimeout(t); }, [text]);
  const { data, loading } = usePolled(q.length >= 2 ? API2.markets({ q, limit: 8 }) : null, 0, { keep: true });
  const results = q.length >= 2 && data ? data.markets.filter((r) => !exclude || !exclude(r.id)).slice(0, 6) : [];
  const pick = (r) => { onPick(r); setText(''); setQ(''); setOpen(false); setSel(0); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && open && results[sel]) { e.preventDefault(); pick(results[sel]); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
  };
  const listId = `${id}-list`;
  const show = open && q.length >= 2;
  return (
    <div className="combo">
      <div className="input-wrap">
        <Icon n="search" size={16} />
        <input id={id} className="input" type="search" value={text} placeholder={placeholder} role="combobox" autoComplete="off" autoFocus={autoFocus}
          aria-expanded={show && results.length > 0} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={show && results[sel] ? `${id}-opt-${sel}` : undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy}
          onChange={(e) => { setText(e.target.value); setOpen(true); setSel(0); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          onBlur={() => setTimeout(() => setOpen(false), 120)} />
      </div>
      {show && results.length > 0 && (
        <ul id={listId} role="listbox" className="combo-list" aria-label={label}>
          {results.map((r, i) => (
            <li key={r.id} id={`${id}-opt-${i}`} role="option" aria-selected={sel === i} className={cx('combo-opt', sel === i && 'is-sel')}
              onMouseDown={(e) => { e.preventDefault(); pick(r); }} onMouseEnter={() => setSel(i)}>
              <VenueBadge venue={r.venue} /><span className="grow">{rowName(r)}</span><span className="mono small muted">{fmtCentsAuto(r.mid)}</span>
            </li>
          ))}
        </ul>
      )}
      {show && !results.length && <p className="muted small combo-none" role="status">{loading || q !== text.trim() ? 'Searching…' : `No open markets match “${q}”.`}</p>}
    </div>
  );
}

// Add or remove a market from any watchlist (the star only covers My markets).
export function WatchMenu({ row }) {
  const { watchlists, isWatched, toggleWatch } = useStore();
  const items = watchlists.map((w) => {
    const on = isWatched(row.id, w.id);
    return { label: `${on ? 'Remove from' : 'Add to'} ${w.name}`, icon: on ? 'check' : 'plus', onClick: () => toggleWatch(itemOf(row), w.id) };
  });
  return <MenuButton label="Watchlists" icon="list-plus" items={[...items, { sep: true }, { label: 'Manage watchlists', icon: 'list', onClick: () => go('app-watchlists') }]} />;
}

// ---------------------------------------------------------------- Freshness
export function Fresh({ venue, at, variant = 'cell' }) {
  const now = useRealNow();
  const f = liveFreshness(at, now, venueRecent(venue));
  const where = venueName(venue);
  if (f.status === 'none') return variant === 'cell' ? <span className="muted">—</span> : <Badge tone="muted" icon="clock">Waiting for data</Badge>;
  if (f.status === 'delayed') {
    return variant === 'cell'
      ? <span className="age age-stale" data-tip={`Delayed. Last fetched from ${where} ${fmtTimeSec(at)}`} data-tip-pos="left"><Icon n="clock" size={12} strokeWidth={2} />{fmtAge(f.age)}<span className="sr-only"> (delayed)</span></span>
      : <Badge tone="warning" icon="clock" tip={`Delayed. Last fetched from ${where} ${fmtTimeSec(at)}. Quotes may no longer be actionable.`}>Delayed · {fmtAge(f.age)}</Badge>;
  }
  if (variant === 'cell') return <span className="age" data-tip={`Fetched from ${where} ${fmtTimeSec(at)}`} data-tip-pos="left">{fmtAge(f.age)}</span>;
  return <Badge tone="success" icon="circle-dot" tip={`Fetched from ${where} ${fmtTimeSec(at)}`}>Recent · {fmtAge(f.age)}</Badge>;
}

// Banner for any venue whose last full update is old (status from /api/status, /api/markets or /api/overview).
export function FeedBanners({ status }) {
  const now = useRealNow();
  if (!status) return null;
  const rows = Object.entries(status).map(([k, s]) => ({ k, s, f: liveFreshness(s.lastSuccessAt, now, venueRecent(k)) }));
  const starting = rows.filter((x) => !isNum(x.s.lastPassAt));
  const delayed = rows.filter((x) => isNum(x.s.lastPassAt) && (x.f.status === 'delayed' || x.s.consecutiveFailures));
  return (
    <>
      {starting.length > 0 && (
        <Banner tone="info" icon="refresh-cw" title={`Collecting the first snapshot from ${starting.map((x) => venueName(x.k)).join(' and ')}.`}>
          This takes a few minutes after the server starts. The page updates by itself.
        </Banner>
      )}
      {delayed.map(({ k, s, f }) => (
        <Banner key={k} tone="warning" icon="clock" title={`${venueName(k)} data is delayed.`}>
          Last full update {isNum(s.lastSuccessAt) ? `${fmtTimeSec(s.lastSuccessAt)} (${fmtAgeLong(f.age)})` : 'not completed'}. Banthom keeps retrying; {venueName(k)} quotes may no longer be actionable.
        </Banner>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- Watch star
export function StarButton({ row, listId = 'my-markets', size = 'sm' }) {
  const { isWatched, toggleWatch } = useStore();
  const on = isWatched(row.id, listId);
  return (
    <button type="button" className={cx('star-btn', on && 'is-on', `star-${size}`)} aria-pressed={on}
      aria-label={`Watch ${rowName(row)} in My markets`} data-tip={on ? 'Remove from My markets' : 'Add to My markets'}
      onClick={(e) => { e.stopPropagation(); toggleWatch(itemOf(row), listId); }}>
      <Icon n="star" size={size === 'lg' ? 18 : 16} strokeWidth={on ? 0 : 1.75} style={on ? { fill: 'currentColor' } : undefined} />
    </button>
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

export function rowKeyNav(e, open) {
  if (e.key === 'Enter') { e.preventDefault(); open(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const tr = e.currentTarget;
    const next = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
    if (next && next.tabIndex === 0) next.focus();
  }
}

// Client-side sort for small sets (watchlists, events).
export function sortRows(rows, { key, dir }) {
  const m = dir === 'asc' ? 1 : -1;
  const val = (r) => {
    if (key === 'title') return `${r.eventTitle} ${r.label}`.toLowerCase();
    if (key === 'venue') return r.venue;
    if (key === 'ch24abs') return isNum(r.ch24) ? Math.abs(r.ch24) : null;
    if (key === 'vol24') return r.usd24;
    return r[key];
  };
  return [...rows].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * m;
  });
}

// ---------------------------------------------------------------- Market table and cards
export const COLUMNS = {
  venue: { label: 'Venue' },
  bid: { label: 'Yes bid', num: true, tip: 'Highest price offered for Yes.' },
  ask: { label: 'Yes ask', num: true, tip: 'Lowest price asked for Yes.' },
  mid: { label: 'Mid', num: true, tip: 'Average of the best bid and ask. Not a guaranteed executable price.' },
  ch24: { label: '24h', num: true, sortKey: 'ch24abs', tip: 'Change in the Yes midpoint (Kalshi) or price (Polymarket) over 24 hours, in percentage points.' },
  vol24: { label: 'Volume 24h', num: true, sortKey: 'vol24', tip: volTip },
  closes: { label: 'Closes', num: true },
  age: { label: 'Data', num: true, tip: 'Time since Banthom fetched this quote from the venue.' },
};

export function MarketCell({ r, sub }) {
  const named = r.yes && r.label === r.eventTitle ? `${r.label} · Yes = ${r.yes}` : r.multi ? r.label : r.eventTitle || r.label;
  return (
    <div className="mkt-cell">
      <a href={marketHref(r.id)} onClick={(e) => e.stopPropagation()}>{named}</a>
      <span className="mkt-cell-sub">{sub || (r.multi ? <a className="link-quiet" href={eventHref(r.venue, r.event)} onClick={(e) => e.stopPropagation()}>{r.eventTitle}</a> : r.category)}</span>
    </div>
  );
}

function cell(col, r) {
  switch (col) {
    case 'venue': return <VenueBadge venue={r.venue} />;
    case 'bid': case 'ask': case 'mid': return fmtCentsAuto(r[col]);
    case 'ch24': return <Delta value={r.ch24} />;
    case 'vol24': return volText(r);
    case 'closes': return fmtDateShort(r.closes);
    case 'age': return <Fresh venue={r.venue} at={r.observedAt} />;
    default: return null;
  }
}

export function MarketTable({ rows, cols, sort, setSort, caption, star = true, extra, className, stale }) {
  const open = (r) => go(marketHref(r.id).slice(1));
  return (
    <div className={cx('table-scroll', stale && 'is-stale', className)}>
      <table className="table live-table">
        <caption className="sr-only">{caption || 'Markets'}. Prices in cents for the Yes side; 24h change in percentage points.</caption>
        <thead>
          <tr>
            {star && <th scope="col" className="cell-tight"><span className="sr-only">Watch</span></th>}
            {setSort ? <SortHeader col="title" sort={sort} setSort={setSort}>Market</SortHeader> : <th scope="col">Market</th>}
            {cols.map((c) => {
              const d = COLUMNS[c];
              return setSort && c !== 'age' && c !== 'venue'
                ? <SortHeader key={c} col={d.sortKey || c} sort={sort} setSort={setSort} num={d.num} tip={d.tip}>{d.label}</SortHeader>
                : <th key={c} scope="col" className={cx(d.num && 'num')}>{d.label}</th>;
            })}
            {extra && <th scope="col" className="cell-tight"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} tabIndex={0} aria-label={`${r.eventTitle}, ${r.label}`} onClick={() => open(r)}
              onKeyDown={(e) => { if (e.target === e.currentTarget) rowKeyNav(e, () => open(r)); }}>
              {star && <td className="cell-tight" onClick={(e) => e.stopPropagation()}><StarButton row={r} /></td>}
              <td className="live-mkt"><MarketCell r={r} /></td>
              {cols.map((c) => <td key={c} className={cx(COLUMNS[c].num && 'num')}>{cell(c, r)}</td>)}
              {extra && <td className="cell-tight" onClick={(e) => e.stopPropagation()}>{extra(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketCards({ rows, extra, star = true }) {
  return (
    <ul className="mcards">
      {rows.map((r) => (
        <li key={r.id} className="mcard">
          <div className="mcard-top">
            <div className="grow"><MarketCell r={r} /></div>
            {star && <StarButton row={r} />}
            {extra && extra(r)}
          </div>
          <div className="mcard-quote">
            <VenueBadge venue={r.venue} />
            <span className="mcard-q"><span className="label">Bid</span>{fmtCentsAuto(r.bid)}</span>
            <span className="mcard-q"><span className="label">Ask</span>{fmtCentsAuto(r.ask)}</span>
            <span className="mcard-q"><span className="label">24h</span><Delta value={r.ch24} /></span>
            <span className="mcard-q mcard-age"><span className="label">Data</span><Fresh venue={r.venue} at={r.observedAt} /></span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Table on wider screens, cards on phones.
export function MarketList({ rows, cols, sort, setSort, caption, extra, stale, phoneCards = true, star = true }) {
  const mobile = useMedia('(max-width: 767px)');
  if (mobile && phoneCards) return <MarketCards rows={rows} extra={extra} star={star} />;
  return <MarketTable rows={rows} cols={cols} sort={sort} setSort={setSort} caption={caption} extra={extra} stale={stale} star={star} />;
}

export function useSorted(rows, sort) {
  return useMemo(() => sortRows(rows || [], sort), [rows, sort]);
}
