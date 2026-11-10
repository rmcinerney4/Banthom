// Event: every open market (outcome) in one Kalshi or Polymarket event.
import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, EmptyState, Skeleton, KeyValue, VenueBadge } from '../ui/core.jsx';
import { fmtCentsAuto, fmtDate, fmtTimeSec, pluralize, isNum } from '../lib/format.js';
import { usePolled, API2, LIVE_VENUES, compareHref, venueName, slugOf } from '../data/live.js';
import { useTitle, MarketList, FeedBanners, Fresh, useSorted, usePageCrumbs } from './kit.jsx';

const { useState } = React;

export function EventPage({ venue, id }) {
  const v = LIVE_VENUES[venue];
  const { data, error, loading, retry } = usePolled(API2.event(venue, id), 30000);
  const ev = data && data.event;
  const [sort, setSort] = useState(null);
  const def = ev && ev.exclusive ? { key: 'mid', dir: 'desc' } : { key: 'closes', dir: 'asc' };
  const rows = useSorted(data ? data.markets : [], sort || def);
  useTitle(ev ? ev.title : `${v ? v.name : ''} event`);
  const crumbs = ev ? [{ label: 'Markets', href: '#app-markets' }, { label: ev.category, href: `#app-markets-${slugOf(ev.category)}` }, { label: ev.title }] : null;
  usePageCrumbs(crumbs);

  if (!v) return <EmptyState title="Unknown venue">This link doesn’t point to Kalshi or Polymarket.</EmptyState>;
  if (!data) {
    const notFound = error && error.status === 404;
    return (
      <div className="page-stack">
        <PageHeader title={loading ? 'Loading event…' : notFound ? 'Event not found' : 'Couldn’t load this event'} crumbs={[{ label: 'Markets', href: '#app-markets' }, { label: id }]} meta={<VenueBadge venue={venue} full />} />
        {loading ? <Skeleton h={160} /> : (
          <EmptyState title={notFound ? `${v.name} has no open event ${id}.` : `${v.name} didn’t respond.`}
            action={notFound ? <Button variant="secondary" href="#app-markets">Browse markets</Button> : <Button variant="secondary" icon="refresh-cw" onClick={retry}>Try again</Button>}>
            {notFound ? 'It may have closed or settled.' : error && error.message}
          </EmptyState>
        )}
      </div>
    );
  }

  const closes = rows.map((r) => r.closes).filter(isNum);
  const lastObs = Math.max(0, ...rows.map((r) => r.observedAt || 0));
  const facts = [
    ['Venue', venueName(venue)],
    ['Outcomes', pluralize(rows.length, 'open market')],
    ['Closes', closes.length ? (Math.min(...closes) === Math.max(...closes) ? fmtDate(closes[0]) : `${fmtDate(Math.min(...closes))} – ${fmtDate(Math.max(...closes))}`) : '—'],
    ['Outcomes are', ev.exclusive ? 'Mutually exclusive (at most one resolves Yes)' : 'Independent'],
  ];
  if (ev.sources && ev.sources.length) facts.push(['Settlement sources', <span className="live-links">{ev.sources.map((s, i) => (s.url ? <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : <span key={i}>{s.name}</span>))}</span>]);

  return (
    <div className="page-stack">
      <PageHeader title={ev.title} sub={ev.sub || null}
        crumbs={crumbs}
        meta={<><VenueBadge venue={venue} full /><Badge tone="muted">{ev.category}</Badge>{ev.exclusive && <Badge tone="muted" icon="split">Mutually exclusive</Badge>}{lastObs > 0 && <Fresh venue={venue} at={lastObs} variant="badge" />}</>}
        actions={<Button variant="secondary" icon="external-link" href={v.marketUrl({ series: ev.series, slug: ev.slug })} target="_blank" rel="noopener noreferrer">Open on {v.name}</Button>} />
      <FeedBanners status={data.status} />
      <div className="grid">
        <div className="s-8 md-12 col-stack">
          <Panel title="Outcomes" sub={ev.exclusive ? 'Sorted by Yes midpoint' : 'Sorted by closing date'} flush className="table-panel">
            {rows.length ? <MarketList rows={rows} cols={['bid', 'ask', 'mid', 'ch24', 'vol24', 'closes', 'age']} sort={sort || def} setSort={setSort} caption={`Outcomes for ${ev.title}`} />
              : <EmptyState compact title="No open outcomes">Every market in this event has closed.</EmptyState>}
            {isNum(data.midSum) && (
              <p className="panel-note"><Icon n="sigma" size={14} />The Yes midpoints add up to {fmtCentsAuto(data.midSum)}. In a mutually exclusive event they would sum to 100¢ with no spreads or fees; the difference reflects bid-ask spreads and venue pricing, not a probability.</p>
            )}
          </Panel>
        </div>
        <div className="s-4 md-12 col-stack">
          <Panel title="About this event"><KeyValue items={facts} /><p className="panel-note"><Icon n="clock" size={14} />Prices fetched from {v.name}; last update {lastObs ? fmtTimeSec(lastObs) : '—'}.</p></Panel>
          {data.pairs && data.pairs.length > 0 && (
            <Panel title={`Also on ${venue === 'kalshi' ? 'Polymarket' : 'Kalshi'}`} sub="Suggested matches · unverified">
              <ul className="related">
                {data.pairs.map((p) => {
                  const mine = rows.find((r) => r.id === (venue === 'kalshi' ? p.k : p.p));
                  return (
                    <li key={p.id}>
                      <a href={compareHref(p.id)} className="related-link">
                        <span className="grow related-name">{mine ? mine.label : 'Outcome'}</span>
                        <Icon n="git-compare-arrows" size={14} />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
