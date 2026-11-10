// Overview: live markets across Kalshi and Polymarket, plus what you follow (saved in this browser).
import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, EmptyState, VenueBadge, Delta, Sheet, Switch, Skeleton } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { fmtCentsAuto, fmtPP, fmtTimeSec, fmtDateShort, fmtTime, fmtUntil, fmtInt, cx, pluralize, isNum } from '../lib/format.js';
import { usePolled, useRealNow, API2, marketHref, compareHref, venueName, VENUE_KEYS, CATEGORY_ICON } from '../data/live.js';
import { useTitle, MetricTile, MarketList, FeedBanners, Fresh, useSorted } from './kit.jsx';

const { useState } = React;

const PANELS = [['radar', 'Markets on your radar'], ['movers', 'Largest moves'], ['closing', 'Closing soon'], ['categories', 'Categories'], ['pairs', 'Suggested Kalshi–Polymarket pairs']];

function CompactTable({ rows, label, value }) {
  return (
    <div className="table-scroll">
      <table className="table table-compact">
        <caption className="sr-only">{label}</caption>
        <thead><tr><th scope="col">Market</th><th scope="col">Venue</th><th scope="col" className="num">Mid</th><th scope="col" className="num">{value === 'closes' ? 'Closes' : '24h'}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mkt-td"><div className="mkt-cell"><a href={marketHref(r.id)}>{r.multi ? r.label : r.eventTitle}</a><span className="mkt-cell-sub">{r.multi ? r.eventTitle : r.category}</span></div></td>
              <td><VenueBadge venue={r.venue} /></td>
              <td className="num">{fmtCentsAuto(r.mid)}</td>
              <td className="num">{value === 'closes' ? <span className="nowrap">{fmtDateShort(r.closes)}, {fmtTime(r.closes)}</span> : <Delta value={r.ch24} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard() {
  useTitle('Overview');
  const { prefs, setPref, watchlists, history, unread } = useStore();
  const now = useRealNow();
  const [customize, setCustomize] = useState(false);
  const hidden = prefs.hiddenPanels || [];
  const show = (id) => !hidden.includes(id);
  const { data: ov, error, loading, retry } = usePolled(API2.overview, 60000);
  const my = watchlists.find((w) => w.id === 'my-markets') || watchlists[0];
  const watchedIds = my ? my.items.map((i) => i.id) : [];
  const empty = watchedIds.length === 0;
  const { data: wq } = usePolled(API2.quotes(watchedIds), 30000);
  const watchedRows = (wq && wq.quotes ? wq.quotes : []).filter((q) => !q.missing);
  const [sort, setSort] = useState({ key: 'ch24abs', dir: 'desc' });
  const radarRows = useSorted(empty ? (ov ? ov.active : []) : watchedRows, empty ? { key: 'vol24', dir: 'desc' } : sort);
  const topMover = !empty ? [...watchedRows].filter((r) => isNum(r.ch24)).sort((a, b) => Math.abs(b.ch24) - Math.abs(a.ch24))[0] : null;
  const latest = history[0];
  const counts = ov ? ov.counts : {};
  const closingSoon = ov ? ov.closing : [];

  return (
    <div className="page-stack">
      <PageHeader title="Overview" sub="Live prediction-market prices from Kalshi and Polymarket"
        meta={<>{ov && VENUE_KEYS.filter((k) => ov.status[k]).map((k) => <span key={k} className="row-tight"><VenueBadge venue={k} /><Fresh venue={k} at={ov.status[k].lastSuccessAt} variant="badge" /></span>)}</>}
        actions={<Button variant="secondary" icon="layout-template" onClick={() => setCustomize(true)}>Customize</Button>} />
      {error && !ov && <EmptyState title="Couldn’t load live data." action={<Button variant="secondary" icon="refresh-cw" onClick={retry}>Try again</Button>}>{error.message}</EmptyState>}
      {ov && <FeedBanners status={ov.status} />}
      <div className="grid dash-grid">
        <div className="s-3 keep-6 m-order-2">
          <MetricTile label="Open markets tracked" value={ov ? fmtInt(ov.total) : '—'}
            sub={ov ? VENUE_KEYS.filter((k) => counts[k]).map((k) => `${fmtInt(counts[k].markets)} ${venueName(k)}`).join(' · ') : 'Loading…'} href="#app-markets" linkLabel="Browse markets" />
        </div>
        <div className="s-3 keep-6 m-order-2">
          <MetricTile label="Watched markets" value={watchedIds.length} sub={empty ? 'Star a market to follow it here.' : `${my.name}`} href="#app-watchlists" linkLabel="Open watchlists" />
        </div>
        <div className="s-3 keep-6 m-order-3">
          <MetricTile label="Biggest watched mover · 24h" value={topMover ? fmtPP(topMover.ch24) : '—'}
            sub={topMover ? `${topMover.multi ? topMover.label : topMover.eventTitle} · ${venueName(topMover.venue)}` : 'No watched markets yet.'}
            tip="Largest absolute 24-hour change among watched markets, in percentage points." />
        </div>
        <div className="s-3 keep-6 m-order-1">
          <MetricTile label="Unread alerts" value={unread} sub={latest ? latest.text : 'Alerts you set run in this browser.'} href="#app-alerts" linkLabel="Review alerts" />
        </div>

        {show('radar') && (
          <Panel title={empty ? 'Most active right now' : 'Markets on your radar'}
            sub={empty ? 'Highest 24-hour volume across both venues. Star any market to build your watchlist.' : `${my.name} · ${pluralize(watchedIds.length, 'market')}`}
            className="s-8 md-12 table-panel m-order-2 radar-panel" flush
            actions={<Button size="sm" variant="ghost" href={empty ? '#app-markets' : '#app-watchlists'} iconRight="arrow-right">{empty ? 'All markets' : 'Watchlists'}</Button>}>
            {!ov && loading && empty ? <div className="live-skeleton">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={36} />)}</div>
              : <MarketList rows={radarRows.slice(0, 12)} cols={['venue', 'bid', 'ask', 'ch24', 'vol24', 'age']} sort={empty ? undefined : sort} setSort={empty ? undefined : setSort}
                caption={empty ? 'Most active markets' : 'Markets on your radar'} />}
            {!empty && wq && wq.quotes.some((q) => q.missing) && (
              <p className="panel-note"><Icon n="info" size={14} />{pluralize(wq.quotes.filter((q) => q.missing).length, 'watched market')} closed or settled. Manage them in <a href="#app-watchlists">Watchlists</a>.</p>
            )}
          </Panel>
        )}
        <div className="s-4 md-12 col-stack m-order-3">
          {show('closing') && (
            <Panel title="Closing soon" sub="Active markets that stop trading in the next 7 days">
              {!ov ? <Skeleton h={160} /> : closingSoon.length ? (
                <ol className="sched">
                  {closingSoon.slice(0, 6).map((r) => (
                    <li key={r.id}>
                      <span className="sched-date" aria-hidden="true"><span>{fmtDateShort(r.closes).split(' ')[0]}</span><strong>{fmtDateShort(r.closes).split(' ')[1]}</strong></span>
                      <div className="grow">
                        <a href={marketHref(r.id)} className="link-plain sched-title">{r.multi ? `${r.eventTitle}: ${r.label}` : r.eventTitle}</a>
                        <p className="muted small">{fmtTime(r.closes)} · {fmtUntil(r.closes - now)} · {fmtCentsAuto(r.mid)} Yes</p>
                      </div>
                      <VenueBadge venue={r.venue} />
                    </li>
                  ))}
                </ol>
              ) : <EmptyState compact title="Nothing closing this week">No active market with meaningful volume closes in the next 7 days.</EmptyState>}
            </Panel>
          )}
          {show('categories') && ov && (
            <Panel title="Categories" sub="Open markets by topic, both venues">
              <ul className="cat-list">
                {ov.categories.slice(0, 10).map((c) => (
                  <li key={c.slug}>
                    <a href={`#app-markets-${c.slug}`} className="cat-link">
                      <Icon n={CATEGORY_ICON[c.label] || 'layers'} size={16} />
                      <span className="grow">{c.label}</span>
                      <span className="mono muted small">{fmtInt(c.total)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        {show('movers') && (
          <Panel title="Largest moves" sub="24 hours · markets with at least $1,000 traded" className="s-7 table-panel m-order-4" flush
            actions={<Button size="sm" variant="ghost" href="#app-markets" iconRight="arrow-right">Markets</Button>}>
            {!ov ? <div className="live-skeleton"><Skeleton h={200} /></div> : ov.movers.length
              ? <CompactTable rows={ov.movers.slice(0, 8)} label="Markets with the largest 24-hour change" />
              : <EmptyState compact title="No large moves yet">Moves appear once both venues report 24-hour changes.</EmptyState>}
          </Panel>
        )}
        {show('pairs') && (
          <Panel title="Same question, two venues" sub="Suggested Kalshi–Polymarket pairs with the widest price gap · unverified" className="s-5 m-order-5"
            actions={<Button size="sm" variant="ghost" href="#app-compare" iconRight="arrow-right">Compare</Button>}>
            {!ov ? <Skeleton h={160} /> : ov.pairs && ov.pairs.length ? (
              <ul className="related">
                {ov.pairs.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <a href={compareHref(p.id)} className="related-link">
                      <span className="grow related-name">{p.k.multi ? `${p.k.eventTitle}: ${p.k.label}` : p.k.eventTitle}</span>
                      <span className="mono small" data-tip="Kalshi Yes mid − Polymarket Yes mid">{fmtPP(p.gap)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compact title={ov.pairStatus && ov.pairStatus.builtAt ? 'No pairs found yet' : 'Finding pairs…'}>
              {ov.pairStatus && ov.pairStatus.builtAt ? 'No markets currently look like the same question on both venues.' : 'Banthom compares both venues a few minutes after the server starts.'}
            </EmptyState>}
            <p className="panel-note"><Icon n="info" size={14} />Pairs are matched from titles, numbers and dates. Check both venues’ rules before relying on a gap; prices exclude fees.</p>
          </Panel>
        )}
      </div>

      <Sheet open={customize} onClose={() => setCustomize(false)} title="Customize overview" sub="Choose what appears on Overview. Saved in this browser."
        footer={<Button variant="primary" onClick={() => setCustomize(false)}>Done</Button>}>
        <div className="stack">
          {PANELS.map(([id, label]) => (
            <Switch key={id} label={label} checked={show(id)} onChange={(v) => setPref('hiddenPanels', v ? hidden.filter((x) => x !== id) : [...hidden, id])} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
