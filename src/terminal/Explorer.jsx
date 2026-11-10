// Markets: every open market on Kalshi and Polymarket, searched, filtered and sorted on the server.
import React from 'react';
import { Icon, Button, Panel, PageHeader, EmptyState, Segmented, Skeleton, VenueBadge } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { fmtInt } from '../lib/format.js';
import { usePolled, API2, LIVE_VENUES, VENUE_KEYS, venueName } from '../data/live.js';
import { useTitle, MarketList, FeedBanners, Fresh, useSorted } from './kit.jsx';

const { useState, useEffect, useMemo } = React;

const PRESETS = [
  { id: 'all', label: 'All markets', sort: { key: 'vol24', dir: 'desc' } },
  { id: 'active', label: 'Most active', sort: { key: 'vol24', dir: 'desc' }, minUsd: 1000 },
  { id: 'movers', label: 'Largest movers', sort: { key: 'ch24abs', dir: 'desc' }, minUsd: 1000, band: '1' },
  { id: 'closing', label: 'Closing soon', sort: { key: 'closes', dir: 'asc' }, closing: 7, minUsd: 100 },
  { id: 'watchlist', label: 'My markets' },
];
const WITHIN = [['any', 'Any time'], ['1', 'Within 1 day'], ['7', 'Within 7 days'], ['30', 'Within 30 days']];
const COLS = ['venue', 'bid', 'ask', 'mid', 'ch24', 'vol24', 'closes', 'age'];
const serverSort = (k) => (k === 'vol24' ? 'usd24' : k);

export function Explorer({ category, venue: venueRoute, viewRequest }) {
  const { watchlists } = useStore();
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [venue, setVenue] = useState(venueRoute || 'all');
  const [cat, setCat] = useState(category || 'all');
  const [preset, setPreset] = useState('all');
  const [within, setWithin] = useState('any');
  const [sort, setSort] = useState({ key: 'vol24', dir: 'desc' });
  const [limit, setLimit] = useState(50);
  useEffect(() => { setCat(category || 'all'); }, [category]);
  useEffect(() => { setVenue(venueRoute || 'all'); }, [venueRoute]);
  useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 250); return () => clearTimeout(t); }, [qInput]);
  useEffect(() => { setLimit(50); }, [q, venue, cat, preset, within, sort]);

  const p = PRESETS.find((x) => x.id === preset) || PRESETS[0];
  const watch = preset === 'watchlist';
  const choosePreset = (id) => {
    const np = PRESETS.find((x) => x.id === id) || PRESETS[0];
    setPreset(np.id);
    if (np.sort) setSort(np.sort);
    if (np.closing) setWithin(String(np.closing));
    else if (id !== 'watchlist') setWithin('any');
  };
  useEffect(() => { if (viewRequest && viewRequest.view) choosePreset(viewRequest.view); }, [viewRequest]);

  const url = watch ? null : API2.markets({
    venue, q, category: cat, sort: serverSort(sort.key), dir: sort.dir, limit,
    closing: within === 'any' ? null : within, minUsd: p.minUsd, band: p.band,
  });
  const { data, error, loading, retry } = usePolled(url, 60000, { keep: true });
  // "My markets" works on your watchlist instead of a server query.
  const my = watchlists.find((w) => w.id === 'my-markets') || watchlists[0];
  const ids = my ? my.items.map((i) => i.id) : [];
  const { data: wq } = usePolled(watch ? API2.quotes(ids) : null, 30000);
  const watchRows = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (wq && wq.quotes ? wq.quotes : []).filter((r) => !r.missing
      && (venue === 'all' || r.venue === venue)
      && (cat === 'all' || r.category.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-') === cat)
      && terms.every((t) => `${r.eventTitle} ${r.label} ${r.ticker}`.toLowerCase().includes(t)));
  }, [wq, q, venue, cat]);
  const watchSorted = useSorted(watchRows, sort);

  const rows = watch ? watchSorted : data ? data.markets : [];
  const cats = (data && data.categories) || [];
  const catLabel = cats.find((c) => c.slug === cat);
  const stale = loading && !!data && !watch;
  const title = catLabel ? catLabel.label : venue !== 'all' ? `${venueName(venue)} markets` : 'Markets';
  useTitle(title);
  const status = data && data.status;

  return (
    <div className="page-stack">
      <PageHeader title={title}
        sub={`Every open market on ${venue === 'all' ? 'Kalshi and Polymarket' : venueName(venue)}${data ? ` · ${fmtInt(data.total)} in total` : ''}. Prices in cents for the Yes side.`}
        meta={status ? <>{VENUE_KEYS.filter((k) => status[k] && (venue === 'all' || venue === k)).map((k) => <span key={k} className="row-tight"><VenueBadge venue={k} /><Fresh venue={k} at={status[k].lastSuccessAt} variant="badge" /></span>)}</> : null} />
      {error && !data && !watch && <EmptyState title="Couldn’t load markets." action={<Button variant="secondary" icon="refresh-cw" onClick={retry}>Try again</Button>}>{error.message}</EmptyState>}
      {status && <FeedBanners status={status} />}
      <Panel flush className="live-table-panel">
        <div className="live-toolbar">
          <div className="input-wrap live-search">
            <Icon n="search" size={16} />
            <input className="input" type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search markets, events, tickers" aria-label="Search markets" />
          </div>
          <Segmented label="Venue" value={venue} onChange={setVenue}
            options={[{ id: 'all', label: 'All' }, ...VENUE_KEYS.filter((k) => LIVE_VENUES[k].enabled).map((k) => ({ id: k, label: venueName(k) }))]} />
          <label className="sr-only" htmlFor="xp-cat">Category</label>
          <select id="xp-cat" className="select live-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All categories</option>
            {cats.map((c) => <option key={c.slug} value={c.slug}>{c.label} ({fmtInt(venue === 'all' ? c.total : c[venue] || 0)})</option>)}
          </select>
          <label className="sr-only" htmlFor="xp-preset">View</label>
          <select id="xp-preset" className="select live-cat" value={preset} onChange={(e) => choosePreset(e.target.value)}>
            {PRESETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          {!watch && (
            <>
              <label className="sr-only" htmlFor="xp-within">Closes</label>
              <select id="xp-within" className="select live-cat" value={within} onChange={(e) => setWithin(e.target.value)}>
                {WITHIN.map(([id, label]) => <option key={id} value={id}>{id === 'any' ? 'Closes: any time' : `Closes ${label.toLowerCase()}`}</option>)}
              </select>
            </>
          )}
          <span className="muted small live-count" aria-live="polite">
            {watch ? `${fmtInt(watchRows.length)} of ${fmtInt(ids.length)} watched` : data ? `${fmtInt(data.matched)} ${data.matched === 1 ? 'market' : 'markets'}${stale ? ' · updating…' : ''}` : ''}
          </span>
        </div>
        {(watch ? !wq && ids.length > 0 : !data && loading) ? (
          <div className="live-skeleton">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h={36} />)}</div>
        ) : watch && !ids.length ? (
          <EmptyState title="No watched markets yet" action={<Button variant="secondary" size="sm" onClick={() => choosePreset('all')}>Browse all markets</Button>}>Star a market to add it to My markets.</EmptyState>
        ) : !rows.length ? (
          <EmptyState title="No markets match" action={<Button variant="secondary" size="sm" onClick={() => { setQInput(''); setQ(''); setCat('all'); setVenue('all'); choosePreset('all'); }}>Clear filters</Button>}>
            Try a shorter search, another category or a longer closing window.
          </EmptyState>
        ) : (
          <MarketList rows={rows} cols={COLS} sort={sort} setSort={setSort} caption={title} stale={stale} />
        )}
        {!watch && data && data.matched > rows.length && (
          <div className="live-more">
            {limit < 500
              ? <Button variant="secondary" size="sm" loading={stale} onClick={() => setLimit((n) => Math.min(500, n + 50))}>Show 50 more</Button>
              : <span className="muted small">Showing the first 500. Narrow the search or pick a category to see others.</span>}
          </div>
        )}
      </Panel>
      <p className="muted small live-note">
        Kalshi prices are US cents per $1 contract; Polymarket prices are cents per $1 USDC share. Volume is in contracts on Kalshi and USDC on Polymarket; sorting by volume uses an approximate dollar figure for both.
        A missing bid or ask is shown as —, never filled in. Kalshi’s multi-leg combo markets aren’t included. Banthom doesn’t place orders.
      </p>
    </div>
  );
}

