import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, EmptyState, VenueBadge, Delta, AiTag, TrustTag, Sheet, Switch, Segmented, MATCH_STATUS } from '../ui/core.jsx';
import { Sparkline } from '../charts/charts.jsx';
import { useStore } from '../store.jsx';
import { useNow, go, useMedia } from '../lib/hooks.js';
import { useFeed, freshnessOf } from '../data/quotes.js';
import { MARKET_BY_ID, EVENT_BY_ID, SCHEDULE, RESEARCH, MARKETS, VENUES, marketsForEvent } from '../data/fixtures.js';
import { sparkline } from '../data/series.js';
import { fmtCents, fmtPP, fmtTime, fmtTimeSec, fmtDateShort, fmtWeekday, fmtUntil, fmtAge, midOf, cx, pluralize } from '../lib/format.js';
import { DAY } from '../lib/time.js';
import { useMarketRows, useTitle, QuoteNum, StarButton, DataAge, SortHeader, sortRows, rowKeyNav, StaleVenueBanner, MetricTile, useVenueStates } from './kit.jsx';

const { useState, useMemo, useCallback } = React;

const PANELS = [
  ['radar', 'Markets on your radar'], ['events', 'Key upcoming events'], ['sources', 'Source freshness'],
  ['movers', 'Largest changes'], ['research', 'Research updates'], ['map', 'Event intelligence map'],
];

function RadarTable({ rows, label }) {
  const [sort, setSort] = useState({ key: 'ch24abs', dir: 'desc' });
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  return (
    <div className="table-scroll">
      <table className="table">
        <caption className="sr-only">{label}. Prices in cents for the Yes side. Change in percentage points over 24 hours.</caption>
        <thead>
          <tr>
            <th scope="col" className="cell-tight"><span className="sr-only">Watch</span></th>
            <SortHeader col="title" sort={sort} setSort={setSort}>Market</SortHeader>
            <SortHeader col="venue" sort={sort} setSort={setSort}>Venue</SortHeader>
            <SortHeader col="bid" sort={sort} setSort={setSort} num>Yes bid</SortHeader>
            <SortHeader col="ask" sort={sort} setSort={setSort} num>Yes ask</SortHeader>
            <SortHeader col="ch24abs" sort={sort} setSort={setSort} num>24h</SortHeader>
            <th scope="col" className="hide-md">7 days</th>
            <SortHeader col="observedAt" sort={sort} setSort={setSort} num>Age</SortHeader>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} tabIndex={0} onKeyDown={(e) => rowKeyNav(e, () => go(`app-market-${r.id}`))} aria-label={r.mk.title}>
              <td className="cell-tight"><StarButton id={r.id} /></td>
              <td className="mkt-td">
                <div className="mkt-cell">
                  <a href={`#app-market-${r.id}`} tabIndex={-1}>{r.mk.outcome}</a>
                  <span className="mkt-cell-sub">{EVENT_BY_ID[r.mk.eventId].title}</span>
                </div>
              </td>
              <td><VenueBadge venue={r.mk.venue} /></td>
              <td className="num"><QuoteNum value={r.bid} changedAt={r.q.changedAt} /></td>
              <td className="num"><QuoteNum value={r.ask} changedAt={r.q.changedAt} /></td>
              <td className="num"><Delta value={r.ch24} /></td>
              <td className="hide-md"><Sparkline points={sparkline(r.id)} label={`7-day trend for ${r.mk.outcome}`} /></td>
              <td className="num"><DataAge mk={r.mk} q={r.q} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceFreshness() {
  const states = useVenueStates();
  return (
    <ul className="fresh-inline" aria-label="Source freshness">
      {states.map((s) => (
        <li key={s.venue}>
          <VenueBadge venue={s.venue} />
          <Badge tone={s.status === 'delayed' ? 'warning' : 'success'} icon={s.status === 'delayed' ? 'clock' : 'circle-dot'} size="sm">
            {s.status === 'delayed' ? `Delayed · ${fmtAge(s.age)}` : 'Recent'}
          </Badge>
          <span className="muted small">updated {fmtTimeSec(s.lastAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function RadarCards({ rows }) {
  const sorted = sortRows(rows, { key: 'ch24abs', dir: 'desc' });
  return (
    <ul className="mcards radar-cards">
      {sorted.map((r) => (
        <li key={r.id} className="mcard">
          <div className="mcard-top">
            <div className="grow"><a href={`#app-market-${r.id}`} className="mcard-title">{r.mk.outcome}</a><p className="mkt-cell-sub">{EVENT_BY_ID[r.mk.eventId].title}</p></div>
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
      ))}
    </ul>
  );
}

function EventMap({ eventIds }) {
  const feed = useFeed();
  const now = useNow();
  return (
    <div className="emap">
      {eventIds.map((id) => {
        const ev = EVENT_BY_ID[id];
        const mks = marketsForEvent(id).filter((m) => m.status !== 'resolved').slice(0, 4);
        return (
          <div key={id} className="emap-row">
            <a className="emap-event" href={`#app-event-${id}`}>
              <span className="label">{ev.sub}</span>
              <span className="emap-title">{ev.title}</span>
              <span className="muted small emap-date"><Icon n="calendar" size={13} />{fmtDateShort(ev.keyDate)} · {fmtUntil(ev.keyDate - now)}</span>
            </a>
            <div className="emap-links" aria-hidden="true"><span /></div>
            <ul className="emap-contracts">
              {mks.map((m) => {
                const q = feed.quotes[m.id];
                return (
                  <li key={m.id}>
                    <a href={`#app-market-${m.id}`} className="emap-contract">
                      <VenueBadge venue={m.venue} />
                      <span className="grow emap-name">{m.outcome}</span>
                      <span className="mono">{fmtCents(midOf(q), 1)}</span>
                      <Delta value={m.ch24} />
                    </a>
                  </li>
                );
              })}
            </ul>
            <div className="emap-links" aria-hidden="true"><span /></div>
            <div className="emap-context">
              {(ev.context || []).map(([c, unit]) => (
                <span key={c} className="ctx-chip" data-tip={`${unit}. Not licensed in this demo. When licensed, the source and how comparable it is with contract prices are shown here.`}><Icon n="lock" size={12} />{c}</span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Dashboard() {
  useTitle('Overview');
  const { prefs, setPref, watchlists, history, unread } = useStore();
  const now = useNow();
  const mobile = useMedia('(max-width: 767px)');
  const [customize, setCustomize] = useState(false);
  const hidden = prefs.hiddenPanels || [];
  const show = (id) => !hidden.includes(id);
  const my = watchlists.find((w) => w.id === 'my-markets');
  const watched = my ? my.ids : [];
  const empty = watched.length === 0;
  const radarFilter = useCallback((mk) => watched.includes(mk.id), [watched]);
  const exampleFilter = useCallback((mk) => ['fed-dec26-cut-ard', 'cpi-oct26-yoy-ard', 'shutdown-jan27-ard', 'opec-cut-ard'].includes(mk.id), []);
  const radar = useMarketRows(empty ? exampleFilter : radarFilter);
  const activeFilter = useCallback((mk) => mk.status !== 'resolved', []);
  const all = useMarketRows(activeFilter);
  const movers = useMemo(() => sortRows(all, { key: 'ch24abs', dir: 'desc' }).slice(0, 8), [all]);
  const followed = useMemo(() => {
    const ids = [...new Set(watched.map((id) => MARKET_BY_ID[id].eventId))];
    return ids.length ? ids : ['fomc-dec-2026', 'cpi-oct-2026', 'funding-2027'];
  }, [watched]);
  const upcoming = SCHEDULE.filter((s) => s.t > now && (empty || followed.includes(s.eventId))).slice(0, 5);
  const thisWeek = upcoming.filter((s) => s.t - now <= 7 * DAY);
  const topMover = empty ? null : sortRows(radar, { key: 'ch24abs', dir: 'desc' })[0];
  const intent = prefs.intent;
  const sub = intent === 'trade' ? 'Markets you follow, and what moved' : intent === 'research' ? 'Events you follow, and what changed' : 'Markets you follow, and what changed';
  const research = RESEARCH.slice(0, 3);
  const researchFirst = intent === 'research';
  const latest = history[0];

  const moversPanel = show('movers') && (
    <Panel key="movers" title="Largest changes" sub="All active markets · 24 hours" className={cx('table-panel', researchFirst ? 's-5' : 's-7', 'm-order-4')}
      actions={<Button size="sm" variant="ghost" href="#app-markets" iconRight="arrow-right">Explorer</Button>} flush>
      <div className="table-scroll">
        <table className="table table-compact">
          <caption className="sr-only">Markets with the largest 24-hour change</caption>
          <thead><tr><th scope="col">Market</th><th scope="col">Venue</th><th scope="col" className="num">Mid</th><th scope="col" className="num">24h</th></tr></thead>
          <tbody>
            {movers.map((r) => (
              <tr key={r.id}>
                <td className="mkt-td"><div className="mkt-cell"><a href={`#app-market-${r.id}`}>{r.mk.outcome}</a><span className="mkt-cell-sub">{EVENT_BY_ID[r.mk.eventId].title}</span></div></td>
                <td><VenueBadge venue={r.mk.venue} /></td>
                <td className="num"><QuoteNum value={r.mid} digits={1} changedAt={r.q.changedAt} /></td>
                <td className="num"><Delta value={r.ch24} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
  const researchPanel = show('research') && (
    <Panel key="research" title="Research updates" sub="AI-assisted summaries of cited sources" className={cx(researchFirst ? 's-7' : 's-5', 'm-order-5')}
      actions={<Button size="sm" variant="ghost" href="#app-research" iconRight="arrow-right">All research</Button>}>
      {prefs.scenario === 'ai-down' ? (
        <EmptyState compact title="Unable to verify recent sources">Research summaries are paused until sources can be retrieved again. Price history is still available.</EmptyState>
      ) : (
        <ul className="rcards">
          {research.map((r) => (
            <li key={r.id} className="rcard">
              <div className="rcard-top"><span className="label">{EVENT_BY_ID[r.eventId].title}</span><Delta value={r.move} /></div>
              <a className="rcard-title" href={r.id === 'rs-fed-claims' ? '#app-research-rpt-fed-7d' : `#app-event-${r.eventId}`}>{r.title}</a>
              <p className="rcard-sum">{r.summary}</p>
              <div className="rcard-meta"><AiTag /><span className="muted small">{pluralize(r.sources.length, 'source')} · {fmtTime(r.t)}</span></div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );

  return (
    <div className="page-stack">
      <PageHeader title="Overview" sub={sub}
        meta={<><span><Icon n="clock" size={13} /> Sources as of {fmtTimeSec(now - (now % 1000))}</span><span>Simulated snapshot · Nov 6, 2026</span></>}
        actions={<Button variant="secondary" icon="layout-template" onClick={() => setCustomize(true)}>Customize dashboard</Button>} />
      <StaleVenueBanner />
      <div className="grid dash-grid">
        <div className="s-3 keep-6 m-order-2"><MetricTile label="Watched markets" value={watched.length} sub={empty ? 'Star a market to follow it here.' : `Across ${pluralize(new Set(watched.map((id) => MARKET_BY_ID[id].eventId)).size, 'event')}`} href="#app-watchlists" linkLabel="Open watchlist" /></div>
        <div className="s-3 keep-6 m-order-3">
          <MetricTile label="Biggest watched mover · 24h" value={topMover ? fmtPP(topMover.ch24) : '—'} sub={topMover ? `${topMover.mk.outcome} · ${topMover.mk.venue}` : 'No watched markets yet.'}
            tip="Largest absolute change in the Yes midpoint over 24 hours among watched markets, in percentage points.">
            {topMover && <Sparkline points={sparkline(topMover.id)} width={120} height={24} label="7-day trend" />}
          </MetricTile>
        </div>
        <div className="s-3 keep-6 m-order-3"><MetricTile label="Key dates in the next 7 days" value={thisWeek.length} sub={upcoming[0] ? `Next: ${upcoming[0].title}, ${fmtDateShort(upcoming[0].t)}` : 'Nothing scheduled.'} /></div>
        <div className="s-3 keep-6 m-order-1"><MetricTile label="Unread alerts" value={unread} sub={latest ? latest.text : 'No alerts have fired yet.'} href="#app-alerts" linkLabel="Review alerts" /></div>

        {show('radar') && (
          <Panel title={empty ? 'Example markets' : 'Markets on your radar'} sub={empty ? 'Labelled examples. Star any market to start your watchlist.' : `${my.name} · ${pluralize(watched.length, 'market')}`}
            className="s-8 md-12 table-panel m-order-2 radar-panel" flush
            footer={show('sources') ? <SourceFreshness /> : null}
            actions={<Button size="sm" variant="ghost" href="#app-watchlists" iconRight="arrow-right">Watchlists</Button>}>
            {empty && (
              <div className="empty-inline">
                <p><strong>Build your first watchlist.</strong> Markets you star appear here with their latest quotes.</p>
                <Button variant="primary" size="sm" href="#app-markets">Explore markets</Button>
              </div>
            )}
            {mobile ? <RadarCards rows={radar} /> : <RadarTable rows={radar} label={empty ? 'Example markets' : 'Markets on your radar'} />}
          </Panel>
        )}
        <div className="s-4 md-12 col-stack m-order-3">
          {show('events') && (
            <Panel title="Key upcoming events" sub="Scheduled releases and decisions for events you follow">
              {upcoming.length ? (
                <ol className="sched">
                  {upcoming.map((s) => (
                    <li key={s.t + s.title}>
                      <span className="sched-date" aria-hidden="true"><span>{fmtDateShort(s.t).split(' ')[0]}</span><strong>{fmtDateShort(s.t).split(' ')[1]}</strong></span>
                      <div className="grow">
                        <a href={`#app-event-${s.eventId}`} className="link-plain sched-title">{s.title}</a>
                        <p className="muted small"><span className="sr-only">{fmtWeekday(s.t)}, </span>{fmtTime(s.t)} · {fmtUntil(s.t - now)}</p>
                      </div>
                      <Badge tone="muted" size="sm">{s.kind}</Badge>
                    </li>
                  ))}
                </ol>
              ) : <EmptyState compact title="Nothing scheduled">Follow an event to see its key dates here.</EmptyState>}
            </Panel>
          )}
        </div>

        {researchFirst ? [researchPanel, moversPanel] : [moversPanel, researchPanel]}

        {show('map') && (
          <Panel title={<span className="row">Event intelligence map <Badge tone="info" size="sm">Early access</Badge></span>} sub="Events you follow, their contracts, and related indicators"
            className="s-12 m-order-6" actions={<Button size="sm" variant="ghost" href="#app-event-fomc-dec-2026" iconRight="arrow-right">Open an event</Button>}>
            <EventMap eventIds={followed.slice(0, 3)} />
            <p className="panel-note"><Icon n="info" size={14} />Links show which contracts belong to each event. They do not imply that indicators move the contracts.</p>
          </Panel>
        )}
      </div>

      <Sheet open={customize} onClose={() => setCustomize(false)} title="Customize dashboard" sub="Choose what appears on Overview. Saved in this browser."
        footer={<Button variant="primary" onClick={() => setCustomize(false)}>Done</Button>}>
        <div className="stack">
          <div>
            <p className="field-label">Layout emphasis</p>
            <Segmented size="md" label="Layout emphasis" value={prefs.intent || 'both'} onChange={(v) => setPref('intent', v === 'both' ? null : v)}
              options={[{ id: 'trade', label: 'Trading' }, { id: 'both', label: 'Balanced' }, { id: 'research', label: 'Research' }]} />
          </div>
          <div className="divider" />
          {PANELS.map(([id, label]) => (
            <Switch key={id} label={label} checked={show(id)} onChange={(v) => setPref('hiddenPanels', v ? hidden.filter((x) => x !== id) : [...hidden, id])} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
