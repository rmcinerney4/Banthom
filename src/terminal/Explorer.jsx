import React from 'react';
import { Icon, Button, IconButton, Badge, Panel, PageHeader, EmptyState, VenueBadge, Delta, Popover, MenuButton, Sheet, Segmented, Check, Field, Tabs, MATCH_STATUS } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { useMedia, useNow, useStored, go, useCopy } from '../lib/hooks.js';
import { EVENT_BY_ID, CATEGORIES, VENUES, MARKETS } from '../data/fixtures.js';
import { fmtCents, fmtDate, fmtDateShort, fmtVolume, fmtInt, fmtTimeSec, cx, pluralize, isNum } from '../lib/format.js';
import { DAY } from '../lib/time.js';
import { useMarketRows, useTitle, QuoteNum, StarButton, DataAge, SortHeader, sortRows, rowKeyNav, StaleVenueBanner, CATEGORY_LABEL, StatusBadge, useVenueStates } from './kit.jsx';
import { pendingAlert } from './Alerts.jsx';

const { useState, useMemo, useEffect, useRef, useCallback } = React;

const COLS = [
  { id: 'venue', label: 'Venue', on: true },
  { id: 'bid', label: 'Yes bid', num: true, on: true, tip: 'Highest price offered for Yes. You could sell Yes here.' },
  { id: 'ask', label: 'Yes ask', num: true, on: true, tip: 'Lowest price asked for Yes. You could buy Yes here.' },
  { id: 'mid', label: 'Mid', num: true, on: true, tip: 'Average of the best bid and ask. Not a guaranteed executable price.' },
  { id: 'spread', label: 'Spread', num: true, on: false, tip: 'Ask minus bid, in cents.' },
  { id: 'ch24', label: '24h (pp)', num: true, on: true, tip: 'Change in the Yes midpoint over 24 hours, in percentage points.' },
  { id: 'vol', label: 'Volume 24h', num: true, on: true, tip: 'Venue basis differs: Arden in contracts, Brisa in USDC notional.' },
  { id: 'size', label: 'Size at ask', num: true, on: true, tip: 'Contracts available at the best ask.' },
  { id: 'oi', label: 'Open interest', num: true, on: false, tip: 'Contracts outstanding (Arden) or USDC notional (Brisa).' },
  { id: 'category', label: 'Category', on: false },
  { id: 'resolves', label: 'Resolves', on: true },
  { id: 'age', label: 'Data age', num: true, on: true, tip: 'Time since the venue last sent this quote.' },
];
const DEFAULT_COLS = COLS.filter((c) => c.on).map((c) => c.id);
const PRESETS = [
  { id: 'all', label: 'All markets' },
  { id: 'active', label: 'Most active' },
  { id: 'movers', label: 'Largest movers' },
  { id: 'closing', label: 'Closing soon' },
  { id: 'watchlist', label: 'Watchlist' },
];
const WITHIN = [['any', 'Any time'], ['7', 'Within 7 days'], ['30', 'Within 30 days'], ['90', 'Within 90 days']];
const DEFAULTS = { q: '', statuses: ['active', 'closing'], venues: ['ARD', 'BRS'], within: 'any', verifiedOnly: false, minVol: '', maxSpread: '', minSize: '' };

// Brisa volume is USDC notional; convert to contracts at the midpoint so "Most active" ranks on one basis.
const volContracts = (r) => (r.mk.venue === 'BRS' && isNum(r.mid) && r.mid > 0 ? r.vol / (r.mid / 100) : r.vol);

function matchQuery(r, q) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const ev = EVENT_BY_ID[r.mk.eventId];
  const hay = `${r.mk.title} ${r.mk.sourceTitle} ${r.mk.ref} ${r.mk.outcome} ${ev.title} ${ev.sub} ${ev.category} ${VENUES[r.mk.venue].name} ${r.mk.venue}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

function applyFilters(rows, f, ctx) {
  return rows.filter((r) => {
    const ev = EVENT_BY_ID[r.mk.eventId];
    if (ctx.cat !== 'all' && ev.category !== ctx.cat) return false;
    if (!f.statuses.includes(r.status)) return false;
    if (!f.venues.includes(r.mk.venue)) return false;
    if (f.within !== 'any' && r.mk.resolves - ctx.now > Number(f.within) * DAY) return false;
    if (f.verifiedOnly && !(r.match && r.match.status === 'verified')) return false;
    if (f.minVol && !(volContracts(r) >= Number(f.minVol))) return false;
    if (f.maxSpread && !(isNum(r.spread) && r.spread <= Number(f.maxSpread))) return false;
    if (f.minSize && !(isNum(r.size) && r.size >= Number(f.minSize))) return false;
    if (f.q && !matchQuery(r, f.q)) return false;
    if (ctx.view === 'watchlist' && !ctx.watched.includes(r.id)) return false;
    return true;
  });
}

function activeChips(f, setF) {
  const chips = [];
  const STATUS = { active: 'Active', closing: 'Closing soon', resolved: 'Resolved' };
  if (f.q) chips.push(['q', `Search: “${f.q}”`, () => setF({ ...f, q: '' })]);
  if (f.statuses.join() !== DEFAULTS.statuses.join()) chips.push(['statuses', `Status: ${f.statuses.map((s) => STATUS[s]).join(', ') || 'none'}`, () => setF({ ...f, statuses: DEFAULTS.statuses })]);
  if (f.venues.length !== 2) chips.push(['venues', `Venue: ${f.venues.map((v) => VENUES[v].short).join(', ') || 'none'}`, () => setF({ ...f, venues: DEFAULTS.venues })]);
  if (f.within !== 'any') chips.push(['within', `Resolves within ${f.within} days`, () => setF({ ...f, within: 'any' })]);
  if (f.verifiedOnly) chips.push(['verifiedOnly', 'Verified comparisons only', () => setF({ ...f, verifiedOnly: false })]);
  if (f.minVol) chips.push(['minVol', `Volume ≥ ${fmtInt(Number(f.minVol))} ct`, () => setF({ ...f, minVol: '' })]);
  if (f.maxSpread) chips.push(['maxSpread', `Spread ≤ ${f.maxSpread}¢`, () => setF({ ...f, maxSpread: '' })]);
  if (f.minSize) chips.push(['minSize', `Size at ask ≥ ${fmtInt(Number(f.minSize))}`, () => setF({ ...f, minSize: '' })]);
  return chips;
}

function MoreFilters({ f, setF, onClose, open, count, mobile }) {
  const [d, setD] = useState(f);
  useEffect(() => { if (open) setD(f); }, [open]);
  const num = (k, label, unit, hint) => (
    <Field id={`flt-${k}`} label={label} hint={hint}>
      <div className="input-wrap">
        <input id={`flt-${k}`} className="input has-unit" type="number" inputMode="decimal" min="0" value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} aria-describedby={hint ? `flt-${k}-hint` : undefined} placeholder="Any" />
        <span className="input-unit">{unit}</span>
      </div>
    </Field>
  );
  const toggle = (key, v) => setD({ ...d, [key]: d[key].includes(v) ? d[key].filter((x) => x !== v) : [...d[key], v] });
  return (
    <Sheet open={open} onClose={onClose} title="Filters" sub={mobile ? undefined : 'Thresholds apply on top of the toolbar filters.'} side={mobile ? 'bottom' : 'right'} width={400}
      footer={<><Button variant="ghost" onClick={() => setD({ ...DEFAULTS, q: d.q })}>Reset</Button><Button variant="primary" onClick={() => { setF(d); onClose(); }}>Show results</Button></>}>
      <div className="stack">
        {mobile && (
          <>
            <fieldset className="fieldset"><legend>Status</legend>
              <div className="stack-sm">{[['active', 'Active'], ['closing', 'Closing soon'], ['resolved', 'Resolved']].map(([v, l]) => <Check key={v} id={`m-st-${v}`} label={l} checked={d.statuses.includes(v)} onChange={() => toggle('statuses', v)} />)}</div>
            </fieldset>
            <fieldset className="fieldset"><legend>Venue</legend>
              <div className="stack-sm">{Object.values(VENUES).map((v) => <Check key={v.id} id={`m-v-${v.id}`} label={`${v.name} (fictional)`} checked={d.venues.includes(v.id)} onChange={() => toggle('venues', v.id)} />)}</div>
            </fieldset>
            <Field id="m-within" label="Resolves">
              <select id="m-within" className="select" value={d.within} onChange={(e) => setD({ ...d, within: e.target.value })}>{WITHIN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Field>
            <Check id="m-verified" label="Only markets with a verified comparison" checked={d.verifiedOnly} onChange={(v) => setD({ ...d, verifiedOnly: v })} />
            <div className="divider" />
          </>
        )}
        {num('minVol', 'Minimum volume, 24h', 'ct', 'Brisa notional is converted to contracts at the midpoint.')}
        {num('maxSpread', 'Maximum spread', '¢', 'Markets without both a bid and an ask are excluded.')}
        {num('minSize', 'Minimum size at best ask', 'ct')}
        <p className="muted small">{pluralize(count, 'market')} match the current filters.</p>
      </div>
    </Sheet>
  );
}

function VenuePicker({ f, setF }) {
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  const label = f.venues.length === 2 ? 'All venues' : f.venues.length === 1 ? VENUES[f.venues[0]].short : 'No venues';
  return (
    <div className="pop-wrap">
      <Button ref={btn} size="sm" variant="secondary" icon="building-2" iconRight="chevron-down" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>{label}</Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} label="Venues" className="popover-pad">
        <div className="stack-sm">
          {Object.values(VENUES).map((v) => (
            <Check key={v.id} id={`venue-${v.id}`} label={v.name} hint="Fictional demo venue" checked={f.venues.includes(v.id)}
              onChange={(on) => setF({ ...f, venues: on ? [...f.venues, v.id] : f.venues.filter((x) => x !== v.id) })} />
          ))}
        </div>
      </Popover>
    </div>
  );
}

function ColumnPicker({ cols, setCols }) {
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  return (
    <div className="pop-wrap">
      <Button ref={btn} size="sm" variant="ghost" icon="columns-3" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>Columns</Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} align="end" label="Visible columns" className="popover-pad">
        <p className="label">Market, watch and actions always show</p>
        <div className="stack-sm cols-list">
          {COLS.map((c) => (
            <Check key={c.id} id={`col-${c.id}`} label={c.label} checked={cols.includes(c.id)}
              onChange={(on) => setCols(on ? COLS.map((x) => x.id).filter((id) => id === c.id || cols.includes(id)) : cols.filter((x) => x !== c.id))} />
          ))}
        </div>
        <button type="button" className="btn btn-link small cols-reset" onClick={() => setCols(DEFAULT_COLS)}>Reset columns</button>
      </Popover>
    </div>
  );
}

function SaveView({ snapshot, onSaved }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const btn = useRef(null);
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Name the view.'); return; }
    onSaved({ name: name.trim(), ...snapshot });
    setOpen(false); setName(''); setErr(null);
  };
  return (
    <div className="pop-wrap">
      <Button ref={btn} variant="secondary" icon="save" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>Save view</Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} align="end" label="Save view" className="popover-pad" width={300}>
        <form onSubmit={submit} className="stack-sm">
          <Field id="view-name" label="View name" error={err} hint="Saves filters, sort, columns and density.">
            <input id="view-name" data-autofocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Macro, tight spreads" aria-invalid={!!err} aria-describedby={err ? 'view-name-err' : 'view-name-hint'} />
          </Field>
          <Button type="submit" variant="primary" size="sm">Save</Button>
        </form>
      </Popover>
    </div>
  );
}

function RowMenu({ r }) {
  const { toggleWatch, isWatched, toast } = useStore();
  const copy = useCopy();
  const link = `${window.location.href.split('#')[0]}#app-market-${r.id}`;
  return (
    <MenuButton label={`Actions for ${r.mk.outcome}`} items={[
      { label: 'Copy contract link', icon: 'link', onClick: async () => { const ok = await copy(link); toast(ok ? 'Contract link copied.' : `Copy failed. Link: ${link}`, { tone: ok ? 'success' : 'info' }); } },
      { label: 'Create alert', icon: 'bell-plus', onClick: () => { pendingAlert.current = { marketId: r.id }; go('app-alerts'); } },
      { label: isWatched(r.id, 'macro') ? 'Remove from Macro watchlist' : 'Add to Macro watchlist', icon: 'star', onClick: () => toggleWatch(r.id, 'macro') },
      { label: 'Open event', icon: 'calendar', onClick: () => go(`app-event-${r.mk.eventId}`) },
      { sep: true },
      { label: `Open on ${VENUES[r.mk.venue].short}`, icon: 'external-link', disabled: true, disabledReason: 'Fictional venue in this demo' },
    ]} />
  );
}

function MarketCard({ r }) {
  const ev = EVENT_BY_ID[r.mk.eventId];
  return (
    <li className="mcard">
      <div className="mcard-top">
        <div className="grow">
          <a href={`#app-market-${r.id}`} className="mcard-title">{r.mk.title}</a>
          <p className="mkt-cell-sub">{ev.title}</p>
        </div>
        <StarButton id={r.id} />
      </div>
      <div className="mcard-quote">
        <VenueBadge venue={r.mk.venue} />
        <span className="mcard-q"><span className="label">Bid</span><QuoteNum value={r.bid} changedAt={r.q.changedAt} /></span>
        <span className="mcard-q"><span className="label">Ask</span><QuoteNum value={r.ask} changedAt={r.q.changedAt} /></span>
        <span className="mcard-q"><span className="label">24h</span><Delta value={r.ch24} /></span>
        <span className="mcard-q mcard-age"><span className="label">Age</span><DataAge mk={r.mk} q={r.q} /></span>
      </div>
    </li>
  );
}

export function Explorer({ category, viewRequest }) {
  useTitle('Market Explorer');
  const { watchlists, toast } = useStore();
  const now = useNow();
  const mobile = useMedia('(max-width: 767px)');
  const [cat, setCat] = useState(category || 'all');
  const [f, setF] = useState(DEFAULTS);
  const [view, setView] = useState('all');
  const [sort, setSort] = useState({ key: 'vol', dir: 'desc' });
  const [cols, setCols] = useStored('explorer-cols', DEFAULT_COLS);
  const [saved, setSaved] = useStored('explorer-views', []);
  const [more, setMore] = useState(false);
  const [sortSheet, setSortSheet] = useState(false);
  useEffect(() => { setCat(category || 'all'); }, [category]);
  useEffect(() => { if (viewRequest) applyPreset(viewRequest.view); }, [viewRequest && viewRequest.n]);

  const watched = (watchlists.find((w) => w.id === 'my-markets') || { ids: [] }).ids;
  const all = useMarketRows(null);
  const ctx = { cat, now, view, watched };
  const rows = useMemo(() => applyFilters(all, f, ctx), [all, f, cat, view, watched, Math.floor(now / 60000)]);
  const sorted = useMemo(() => {
    if (sort.key === 'vol') return [...rows].sort((a, b) => (sort.dir === 'asc' ? 1 : -1) * (volContracts(a) - volContracts(b)));
    return sortRows(rows, sort);
  }, [rows, sort]);
  const catCounts = useMemo(() => Object.fromEntries(['all', ...CATEGORIES.map((c) => c.id)].map((c) => [c, applyFilters(all, f, { ...ctx, cat: c }).length])), [all, f, view, watched]);

  function applyPreset(id) {
    setView(id);
    if (id === 'active') setSort({ key: 'vol', dir: 'desc' });
    else if (id === 'movers') setSort({ key: 'ch24abs', dir: 'desc' });
    else if (id === 'closing') { setSort({ key: 'resolves', dir: 'asc' }); setF((x) => ({ ...x, statuses: ['closing'] })); }
    else if (id === 'all' || id === 'watchlist') { if (f.statuses.join() === 'closing') setF((x) => ({ ...x, statuses: DEFAULTS.statuses })); }
    if (id !== 'closing' && f.statuses.join() === 'closing') setF((x) => ({ ...x, statuses: DEFAULTS.statuses }));
  }
  const chips = activeChips(f, setF);
  const clearAll = () => { setF(DEFAULTS); setView('all'); setCat('all'); };
  const toggleStatus = (s) => setF({ ...f, statuses: f.statuses.includes(s) ? f.statuses.filter((x) => x !== s) : [...f.statuses, s] });
  const statusCount = (s) => applyFilters(all, { ...f, statuses: [s] }, ctx).length;
  const suggestions = useMemo(() => {
    if (rows.length) return [];
    return chips.map(([key, label]) => {
      const relaxed = { ...f, [key]: DEFAULTS[key] };
      return [label, applyFilters(all, relaxed, ctx).length];
    }).filter(([, n]) => n > 0);
  }, [rows.length, f, all]);
  const venueStates = useVenueStates();
  const delayed = venueStates.filter((s) => s.status === 'delayed');
  const visible = COLS.filter((c) => cols.includes(c.id));
  const snapshot = { f, sort, view, cat, cols };

  const statusToggles = (
    <div className="chip-row" role="group" aria-label="Status">
      {[['active', 'Active'], ['closing', 'Closing soon'], ['resolved', 'Resolved']].map(([s, l]) => (
        <button key={s} type="button" className="toggle-chip" aria-pressed={f.statuses.includes(s)} onClick={() => toggleStatus(s)}>
          {f.statuses.includes(s) && <Icon n="check" size={13} />}{l}<span className="count">{statusCount(s)}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="page-stack">
      <PageHeader title="Market Explorer" sub="Discover and compare event contracts"
        actions={<>
          {saved.length > 0 && (
            <MenuButton triggerLabel={`Saved views (${saved.length})`} icon="bookmark" variant="ghost" size="md" items={saved.map((s) => ({
              label: s.name, icon: 'bookmark', onClick: () => { setF(s.f); setSort(s.sort); setView(s.view); setCat(s.cat); setCols(s.cols); toast(`Applied “${s.name}”.`, { tone: 'info' }); },
            }))} />
          )}
          <SaveView snapshot={snapshot} onSaved={(v) => { setSaved((s) => [...s.filter((x) => x.name !== v.name), v]); toast(`Saved view “${v.name}”.`); }} />
        </>} />
      <StaleVenueBanner compact />

      <div className="xp-toolbar">
        <div className="xp-row">
          <div className="input-wrap xp-search">
            <Icon n="search" size={16} />
            <input className="input" type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search events, markets, venues…" aria-label="Search markets" />
          </div>
          {!mobile && <Segmented size="md" label="Saved view presets" value={view} onChange={applyPreset} options={PRESETS} className="xp-presets" />}
          <span className={cx('xp-live', delayed.length ? 'is-warn' : 'is-ok')} role="status">
            <span className="feed-dot" aria-hidden="true" />{delayed.length ? `${VENUES[delayed[0].venue].short} delayed` : 'All sources recent'}
          </span>
        </div>
        <Tabs idBase="cat" label="Category" value={cat} onChange={setCat} className="xp-cats"
          tabs={[{ id: 'all', label: 'All', count: catCounts.all }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon, count: catCounts[c.id] }))]} />
        {mobile ? (
          <div className="xp-row xp-mobile-actions">
            <Button size="sm" variant="secondary" icon="sliders-horizontal" onClick={() => setMore(true)}>Filters{chips.length ? ` (${chips.length})` : ''}</Button>
            <Button size="sm" variant="secondary" icon="arrow-up-down" onClick={() => setSortSheet(true)}>Sort</Button>
            <select className="select xp-preset-select" aria-label="Saved view presets" value={view} onChange={(e) => applyPreset(e.target.value)}>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        ) : (
          <div className="xp-row xp-filters">
            {statusToggles}
            <span className="xp-sep" aria-hidden="true" />
            <VenuePicker f={f} setF={setF} />
            <select className="select input-sm xp-within" aria-label="Resolution date" value={f.within} onChange={(e) => setF({ ...f, within: e.target.value })}>
              {WITHIN.map(([v, l]) => <option key={v} value={v}>{v === 'any' ? 'Resolves: any time' : `Resolves ${l.toLowerCase()}`}</option>)}
            </select>
            <Check id="xp-verified" label="Verified pairs only" checked={f.verifiedOnly} onChange={(v) => setF({ ...f, verifiedOnly: v })} />
            <Button size="sm" variant="ghost" icon="sliders-horizontal" onClick={() => setMore(true)}>More filters</Button>
          </div>
        )}
        <div className="xp-row xp-summary">
          <p className="muted small" role="status" aria-live="polite">{pluralize(sorted.length, 'market')}{view !== 'all' ? ` · ${PRESETS.find((p) => p.id === view).label}` : ''} · Sources as of {fmtTimeSec(now - (now % 1000))}</p>
          {chips.length > 0 && (
            <div className="chip-row">
              {chips.map(([key, label, remove]) => (
                <span key={key} className="chip-x">{label}<button type="button" onClick={remove} aria-label={`Remove filter: ${label}`}><Icon n="x" size={12} /></button></span>
              ))}
              <button type="button" className="btn btn-link small" onClick={clearAll}>Clear all</button>
            </div>
          )}
          {!mobile && <span className="xp-cols"><ColumnPicker cols={cols} setCols={setCols} /></span>}
        </div>
      </div>

      {sorted.length === 0 ? (
        <Panel>
          <EmptyState title="No markets match these filters." action={<Button variant="primary" onClick={clearAll}>Clear filters</Button>}>
            {chips.length ? `Filters in use: ${chips.map((c) => c[1]).join('; ')}.` : 'Try widening the date range or removing a venue.'}
            {suggestions.length > 0 && <span className="empty-sugg">{suggestions.map(([l, n]) => `Removing “${l}” would show ${pluralize(n, 'market')}.`).join(' ')}</span>}
          </EmptyState>
        </Panel>
      ) : mobile ? (
        <ul className="mcards" aria-label="Markets">{sorted.map((r) => <MarketCard key={r.id} r={r} />)}</ul>
      ) : (
        <div className="panel table-panel xp-table-panel">
          <div className="table-scroll xp-scroll" tabIndex={-1}>
            <table className="table xp-table">
              <caption className="sr-only">Markets. Yes-side prices in cents, change in percentage points. Use arrow keys to move between rows and Enter to open a market.</caption>
              <thead>
                <tr>
                  <th scope="col" className="cell-tight sticky-col xp-star"><span className="sr-only">Watch</span></th>
                  <SortHeader col="title" sort={sort} setSort={setSort} className="sticky-col xp-mkt">Market</SortHeader>
                  {visible.map((c) => (c.id === 'category' || c.id === 'resolves' || c.id === 'venue' ? (
                    <SortHeader key={c.id} col={c.id === 'category' ? 'title' : c.id} sort={sort} setSort={setSort}>{c.label}</SortHeader>
                  ) : c.id === 'age' ? (
                    <SortHeader key={c.id} col="observedAt" sort={sort} setSort={setSort} num tip={c.tip}>{c.label}</SortHeader>
                  ) : (
                    <SortHeader key={c.id} col={c.id === 'ch24' ? 'ch24abs' : c.id} sort={sort} setSort={setSort} num={c.num} tip={c.tip}>{c.label}</SortHeader>
                  )))}
                  <th scope="col" className="cell-tight"><span className="sr-only">Comparison</span></th>
                  <th scope="col" className="cell-tight"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const ev = EVENT_BY_ID[r.mk.eventId];
                  return (
                    <tr key={r.id} tabIndex={0} aria-label={`${r.mk.title}, ${VENUES[r.mk.venue].short}`} onKeyDown={(e) => { if (e.target === e.currentTarget) rowKeyNav(e, () => go(`app-market-${r.id}`)); }}>
                      <td className="cell-tight sticky-col xp-star"><StarButton id={r.id} /></td>
                      <td className="sticky-col xp-mkt">
                        <div className="mkt-cell">
                          <a href={`#app-market-${r.id}`} tabIndex={-1} title={r.mk.title}>{r.mk.title}</a>
                          <span className="mkt-cell-sub">{ev.title}{r.status !== 'active' && <> · <span className={r.status === 'closing' ? 'info-text' : ''}>{r.status === 'closing' ? 'Closing soon' : `Resolved ${r.mk.result} (simulated)`}</span></>}</span>
                        </div>
                      </td>
                      {visible.map((c) => {
                        switch (c.id) {
                          case 'venue': return <td key={c.id}><VenueBadge venue={r.mk.venue} /></td>;
                          case 'bid': return <td key={c.id} className="num"><QuoteNum value={r.bid} changedAt={r.q.changedAt} /></td>;
                          case 'ask': return <td key={c.id} className="num"><QuoteNum value={r.ask} changedAt={r.q.changedAt} /></td>;
                          case 'mid': return <td key={c.id} className="num">{isNum(r.mid) ? fmtCents(r.mid, 1) : <span className="muted" data-tip="Needs both a bid and an ask">—</span>}</td>;
                          case 'spread': return <td key={c.id} className="num">{fmtCents(r.spread)}</td>;
                          case 'ch24': return <td key={c.id} className="num"><Delta value={r.ch24} /></td>;
                          case 'vol': return <td key={c.id} className="num">{fmtVolume(r.vol, VENUES[r.mk.venue].volumeBasis === 'usd' ? 'usd' : 'ct')}</td>;
                          case 'size': return <td key={c.id} className="num">{isNum(r.size) ? fmtInt(r.size) : '—'}</td>;
                          case 'oi': return <td key={c.id} className="num">{fmtVolume(r.oi, VENUES[r.mk.venue].volumeBasis === 'usd' ? 'usd' : 'ct')}</td>;
                          case 'category': return <td key={c.id}>{CATEGORY_LABEL[ev.category]}</td>;
                          case 'resolves': return <td key={c.id} className="nowrap">{fmtDate(r.mk.resolves)}</td>;
                          case 'age': return <td key={c.id} className="num"><DataAge mk={r.mk} q={r.q} /></td>;
                          default: return null;
                        }
                      })}
                      <td className="cell-tight">
                        {r.match ? (
                          <a href={`#app-compare-${r.match.id}`} className="btn btn-ghost btn-sm btn-icon" aria-label={`Comparison: ${MATCH_STATUS[r.match.status].label}`} data-tip={MATCH_STATUS[r.match.status].label} data-tip-pos="left">
                            <Icon n={r.match.status === 'verified' ? 'git-compare-arrows' : MATCH_STATUS[r.match.status].icon} size={16} />
                          </a>
                        ) : <span className="sr-only">No comparison</span>}
                      </td>
                      <td className="cell-tight"><RowMenu r={r} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="panel-foot xp-foot">
            <span><Icon n="info" size={13} /> “Most active” ranks Brisa volume converted to contracts at the midpoint. Prices are simulated.</span>
            <span>Columns can be shown or hidden; resizing and reordering are planned.</span>
          </div>
        </div>
      )}

      <MoreFilters open={more} onClose={() => setMore(false)} f={f} setF={setF} mobile={mobile} count={sorted.length} />
      <Sheet open={sortSheet} onClose={() => setSortSheet(false)} title="Sort markets" side="bottom" footer={<Button variant="primary" onClick={() => setSortSheet(false)}>Done</Button>}>
        <div role="radiogroup" aria-label="Sort by" className="scenario-list">
          {[['vol', 'desc', 'Volume, high to low'], ['ch24abs', 'desc', 'Largest 24h change'], ['resolves', 'asc', 'Resolves soonest'], ['ask', 'desc', 'Yes ask, high to low'], ['ask', 'asc', 'Yes ask, low to high'], ['title', 'asc', 'Market name, A to Z']].map(([k, d, l]) => (
            <button key={k + d} type="button" role="radio" aria-checked={sort.key === k && sort.dir === d} className="scenario-opt" onClick={() => setSort({ key: k, dir: d })}>
              <span className="radio-dot" aria-hidden="true" />{l}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
