// Live Kalshi pages. Real market data from the Banthom server; nothing here is simulated.
import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, EmptyState, Delta, Segmented, Banner, KeyValue, InfoTip, Skeleton, Popover } from '../ui/core.jsx';
import { PriceChart, OrderLadder } from '../charts/charts.jsx';
import { useMedia, go } from '../lib/hooks.js';
import { fmtCentsAuto, fmtCents, fmtDate, fmtDateShort, fmtDateTimeShort, fmtTimeSec, fmtAge, fmtAgeLong, fmtInt, fmtChance, fmtVolume, cx, isNum, pluralize } from '../lib/format.js';
import { useTitle, SortHeader, rowKeyNav } from './kit.jsx';
import { LIVE_CFG, API, usePolled, useRealNow, liveFreshness, midOf2, change24, kalshiSeriesUrl } from '../data/live.js';

const { useState, useMemo, useEffect, useRef } = React;

const minutes = (s) => pluralize(Math.round(s / 60), 'minute');

// ---------------------------------------------------------------- Small pieces
export function KalshiBadge({ full }) {
  return (
    <span className="venue venue-kal" data-tip={full ? undefined : 'Kalshi (live data)'}>
      <span className="venue-code" aria-hidden={full ? undefined : 'true'}>KAL</span>
      {full ? <span className="venue-name">Kalshi</span> : <span className="sr-only">Kalshi</span>}
    </span>
  );
}

export function LiveTag() {
  return <span className="live-tag" data-tip="Real market data from Kalshi" tabIndex={0}>Live</span>;
}

function Fresh({ observedAt, variant = 'strip' }) {
  const now = useRealNow();
  const f = liveFreshness(observedAt, now);
  if (f.status === 'none') return <Badge tone="muted" icon="clock">Waiting for data</Badge>;
  if (f.status === 'delayed') {
    return <Badge tone="warning" icon="clock" tip={`Delayed. Last fetched from Kalshi ${fmtTimeSec(observedAt)}. Quotes may no longer be actionable.`}>Delayed · {fmtAge(f.age)}</Badge>;
  }
  if (variant === 'cell') return <span className="age" data-tip={`Fetched from Kalshi ${fmtTimeSec(observedAt)}`} data-tip-pos="left">{fmtAge(f.age)}</span>;
  return <Badge tone="success" icon="circle-dot" tip={`Fetched from Kalshi ${fmtTimeSec(observedAt)}`}>Recent · {fmtAge(f.age)}{variant === 'long' ? ' ago' : ''}</Badge>;
}

// Replaces the demo banner on live pages.
export function LiveBanner() {
  return (
    <div className="demo-banner live-banner" role="region" aria-label="Data notice">
      <LiveTag />
      <p className="demo-text">
        <span className="demo-long">Live market data from Kalshi. Other terminal screens still use simulated data.</span>
        <span className="demo-short">Live Kalshi data</span>
      </p>
      <div className="demo-controls">
        <a className="demo-btn" href="#app-dashboard"><Icon n="layout-dashboard" size={14} /><span className="demo-long">Back to demo</span><span className="demo-short">Demo</span></a>
      </div>
    </div>
  );
}

// Top-bar status pill for live pages.
export function KalshiFeedPill() {
  const { data } = usePolled('/api/kalshi/status', 30000);
  const now = useRealNow();
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  const s = data || {};
  const f = liveFreshness(s.lastSuccessAt, now);
  const warn = f.status !== 'recent';
  return (
    <div className="pop-wrap">
      <button ref={btn} type="button" className={cx('feed-pill', warn ? 'is-warn' : 'is-ok')} aria-expanded={open} onClick={() => setOpen((o) => !o)}
        aria-label={`Feed status: Kalshi, ${f.status === 'recent' ? 'recent' : f.status === 'delayed' ? 'delayed' : 'waiting for first update'}.`}>
        <span className="feed-dot" aria-hidden="true" />
        <span className="feed-text">{f.status === 'recent' ? 'Kalshi live' : f.status === 'delayed' ? 'Kalshi delayed' : 'Kalshi starting'}</span>
        {isNum(s.lastSuccessAt) && <span className="feed-time mono">{fmtTimeSec(s.lastSuccessAt).replace(' ET', '')}</span>}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} align="end" label="Kalshi feed" className="popover-pad feed-pop" width={320}>
        <p className="strong">Kalshi feed</p>
        <KeyValue items={[
          ['Last full update', isNum(s.lastSuccessAt) ? `${fmtTimeSec(s.lastSuccessAt)} (${fmtAgeLong(f.age)})` : 'Not yet'],
          ['Markets tracked', isNum(s.markets) ? `${fmtInt(s.markets)} in ${fmtInt(s.events)} events` : '—'],
          ['Refresh', `Every ${minutes(LIVE_CFG.refreshSeconds)}; open market pages every 15 seconds`],
          ['Delayed after', minutes(LIVE_CFG.recentSeconds)],
        ]} />
        {s.lastError && <p className="small muted">Last problem {fmtTimeSec(s.lastError.at)}: {s.lastError.message}</p>}
      </Popover>
    </div>
  );
}

function StatusBanners({ status, now }) {
  if (!status) return null;
  if (!isNum(status.lastPassAt)) {
    return status.consecutiveFailures
      ? <Banner tone="warning" icon="clock" title="Can’t reach Kalshi yet.">Banthom is retrying in the background. {status.lastError ? `Last error: ${status.lastError.message}` : ''}</Banner>
      : <Banner tone="info" icon="refresh-cw" title="Collecting the first snapshot from Kalshi.">This takes a minute or two after the server starts. The page updates by itself.</Banner>;
  }
  const f = liveFreshness(status.lastSuccessAt, now);
  if (status.consecutiveFailures || f.status === 'delayed') {
    return (
      <Banner tone="warning" icon="clock" title="Kalshi data is delayed.">
        Last full update {isNum(status.lastSuccessAt) ? `${fmtTimeSec(status.lastSuccessAt)} (${fmtAgeLong(f.age)})` : 'not completed'}. Banthom keeps retrying; quotes may no longer be actionable.
      </Banner>
    );
  }
  return null;
}

// ---------------------------------------------------------------- Market list
const COLS = [
  ['bid', 'Yes bid'], ['ask', 'Yes ask'], ['mid', 'Midpoint'], ['ch24', '24h'], ['vol24', 'Volume 24h'], ['oi', 'Open interest'], ['closes', 'Closes'],
];

export function LiveMarkets() {
  useTitle('Kalshi markets');
  const now = useRealNow();
  const mobile = useMedia('(max-width: 767px)');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState({ key: 'vol24', dir: 'desc' });
  const [limit, setLimit] = useState(50);
  useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 250); return () => clearTimeout(t); }, [qInput]);
  useEffect(() => { setLimit(50); }, [q, cat, sort]);
  const url = API.list({ q, category: cat, sort: sort.key, dir: sort.dir, limit });
  const { data, error, loading, retry } = usePolled(url, 60000, { keep: true });

  const rows = useMemo(() => (data ? data.markets.map((m) => {
    const ev = data.events[m.event] || {};
    const title = ev.title || m.event;
    return {
      id: m.ticker, m, title, label: m.label, category: ev.category || 'Other', multi: (ev.markets || 1) > 1,
      bid: m.bid, ask: m.ask, mid: midOf2(m.bid, m.ask), ch24: change24(m), vol24: m.vol24, oi: m.oi, closes: m.closes,
    };
  }) : []), [data]);
  const status = data && data.status;
  const cats = (data && data.categories) || [];
  const shownCols = mobile ? COLS.filter(([k]) => k === 'mid' || k === 'ch24') : COLS;
  const filtering = q !== '' || cat !== 'all';
  const stale = loading && !!data;

  return (
    <div className="page-stack">
      <PageHeader title="Kalshi markets"
        sub={`Live prices for every open Kalshi market${data ? ` (${fmtInt(data.total)})` : ''}. Sorted by 24-hour volume.`}
        meta={<><LiveTag /><KalshiBadge full />{status && <Fresh observedAt={status.lastSuccessAt} />}</>}
        actions={<Button variant="secondary" icon="external-link" href="https://kalshi.com" target="_blank" rel="noopener noreferrer">Kalshi.com</Button>} />
      {error && !data && (
        <Banner tone="danger" title="Couldn’t load Kalshi data." actions={<Button size="sm" variant="secondary" icon="refresh-cw" onClick={retry}>Retry</Button>}>{error.message}</Banner>
      )}
      <StatusBanners status={status} now={now} />
      <Panel flush className="live-table-panel">
        <div className="live-toolbar">
          <div className="input-wrap live-search">
            <Icon n="search" size={16} />
            <input className="input" type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search Kalshi markets" aria-label="Search Kalshi markets" />
          </div>
          <label className="sr-only" htmlFor="live-cat">Category</label>
          <select id="live-cat" className="select live-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All categories{data ? ` (${fmtInt(data.total)})` : ''}</option>
            {cats.map(([c, n]) => <option key={c} value={c}>{c} ({fmtInt(n)})</option>)}
          </select>
          <span className="muted small live-count" aria-live="polite">
            {data ? `${fmtInt(data.matched)} ${data.matched === 1 ? 'market' : 'markets'}${stale ? ' · updating…' : ''}` : ''}
          </span>
        </div>
        {!data && loading ? (
          <div className="live-skeleton">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h={36} />)}</div>
        ) : !data ? null : !rows.length && !filtering ? (
          <EmptyState title={status && isNum(status.lastPassAt) ? 'No open markets' : 'No Kalshi data yet'}>
            {status && isNum(status.lastPassAt) ? 'Kalshi has no open markets right now.' : 'Markets appear here after the first update from Kalshi.'}
          </EmptyState>
        ) : !rows.length ? (
          <EmptyState title="No markets match" action={<Button variant="secondary" size="sm" onClick={() => { setQInput(''); setQ(''); setCat('all'); }}>Clear search</Button>}>Try a shorter search or another category.</EmptyState>
        ) : (
          <div className={cx('table-scroll', stale && 'is-stale')}>
            <table className="table live-table">
              <caption className="sr-only">Open Kalshi markets. Prices in US cents per contract.</caption>
              <thead>
                <tr>
                  <SortHeader col="title" sort={sort} setSort={setSort}>Market</SortHeader>
                  {shownCols.map(([k, label]) => <SortHeader key={k} col={k} sort={sort} setSort={setSort} num>{label}</SortHeader>)}
                  {!mobile && <th scope="col" className="num">Data</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} tabIndex={0} aria-label={`${r.title}, ${r.label}`} onClick={() => go(`app-live-${r.id}`)}
                    onKeyDown={(e) => { if (e.target === e.currentTarget) rowKeyNav(e, () => go(`app-live-${r.id}`)); }}>
                    <td className="live-mkt">
                      <div className="mkt-cell">
                        <a href={`#app-live-${r.id}`} onClick={(e) => e.stopPropagation()}>{r.multi ? r.label : r.title}</a>
                        <span className="mkt-cell-sub">{r.multi ? r.title : r.category}</span>
                      </div>
                    </td>
                    {shownCols.map(([k]) => (
                      <td key={k} className="num">
                        {k === 'ch24' ? <Delta value={r.ch24} />
                          : k === 'vol24' || k === 'oi' ? fmtVolume(r[k], 'ct')
                            : k === 'closes' ? fmtDateShort(r.closes)
                              : fmtCentsAuto(r[k])}
                      </td>
                    ))}
                    {!mobile && <td className="num"><Fresh observedAt={r.m.observedAt} variant="cell" /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.matched > rows.length && (
          <div className="live-more">
            {limit < 500
              ? <Button variant="secondary" size="sm" loading={stale} onClick={() => setLimit((n) => Math.min(500, n + 50))}>Show 50 more</Button>
              : <span className="muted small">Showing the first 500. Narrow the search or pick a category to see others.</span>}
          </div>
        )}
      </Panel>
      <p className="muted small live-note">
        Prices are in US cents per $1 contract. Midpoint and 24h change use the Yes bid and ask; a missing bid or ask is shown as —, never filled in.
        Kalshi’s multi-leg combo markets aren’t included. Market list refreshes every {minutes(LIVE_CFG.refreshSeconds)}. Source: Kalshi public market data. Banthom doesn’t place orders.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Market detail
function QuoteStrip({ m, compact }) {
  const spread = isNum(m.bid) && isNum(m.ask) ? m.ask - m.bid : null;
  const mid = midOf2(m.bid, m.ask);
  const indicative = isNum(spread) && spread <= 5 ? mid : null;
  const cell = (k, v, sub, tip) => (
    <div className="qs-cell">
      <span className="qs-k">{k}{tip && <InfoTip text={tip} label={k} />}</span>
      <span className="qs-v">{v}</span>
      {sub && <span className="qs-sub">{sub}</span>}
    </div>
  );
  return (
    <div className={cx('qstrip', compact && 'is-compact')} role="group" aria-label="Quote">
      {cell('Yes bid', fmtCentsAuto(m.bid), isNum(m.bidSize) && isNum(m.bid) ? `${fmtInt(m.bidSize)} available` : null, 'Highest price offered for Yes on Kalshi.')}
      {cell('Yes ask', fmtCentsAuto(m.ask), isNum(m.askSize) && isNum(m.ask) ? `${fmtInt(m.askSize)} available` : null, 'Lowest price asked for Yes on Kalshi.')}
      {cell('Spread', fmtCentsAuto(spread), null, 'Ask minus bid.')}
      {cell('Last trade', fmtCentsAuto(m.last), null, 'Most recent trade. Never used in place of a missing bid or ask.')}
      {cell('24h change', <Delta value={change24(m)} size="lg" />, 'Yes midpoint')}
      {!compact && cell('Volume 24h', fmtVolume(m.vol24, 'ct'), 'Contracts')}
      {cell('Implied chance', isNum(indicative) ? fmtChance(indicative) : '—', isNum(indicative) ? 'Indicative' : 'Spread too wide', 'The midpoint read as a share of the $1 payout. A market-implied proxy, not a guaranteed probability.')}
      <div className="qs-cell qs-fresh"><span className="qs-k">Data</span><Fresh observedAt={m.observedAt} /></div>
    </div>
  );
}

const RANGES = [{ id: '1D', label: '1D', aria: '1 day' }, { id: '1W', label: '1W', aria: '1 week' }, { id: '1M', label: '1M', aria: '1 month' }, { id: 'ALL', label: 'All', aria: 'Since listing' }];

function buildSeries(h, side) {
  if (!h) return { points: [], gaps: [] };
  const step = h.interval * 60e3;
  const points = [];
  const gaps = [];
  let prev = null;
  for (const p of h.points) {
    const mid = midOf2(p.bid, p.ask);
    const v = isNum(mid) ? (side === 'yes' ? mid : 100 - mid) : null;
    if (prev && p.t - prev.t > step * 1.5) {
      points.push({ t: prev.t + step, v: null });
      gaps.push([prev.t, p.t]);
    }
    points.push({ t: p.t, v });
    prev = p;
  }
  // Intervals without a two-sided quote are gaps too.
  let start = null;
  points.forEach((p, i) => {
    if (!isNum(p.v) && start == null) start = i > 0 ? points[i - 1].t : p.t;
    if (isNum(p.v) && start != null) { gaps.push([start, p.t]); start = null; }
  });
  if (start != null && points.length) gaps.push([start, points[points.length - 1].t]);
  return { points, gaps };
}

function summarize(points, label) {
  const vals = points.filter((p) => isNum(p.v));
  if (!vals.length) return `${label}: no observations in this period.`;
  const first = vals[0];
  const last = vals[vals.length - 1];
  const dir = last.v > first.v ? 'rose' : last.v < first.v ? 'fell' : 'was unchanged';
  return `${label} ${dir} from ${fmtCents(first.v, 1)} to ${fmtCents(last.v, 1)} between ${fmtDateTimeShort(first.t)} and ${fmtDateTimeShort(last.t)}.`;
}

function LiveChart({ ticker, label }) {
  const [range, setRange] = useState('1W');
  const [side, setSide] = useState('yes');
  const [view, setView] = useState('chart');
  const mobile = useMedia('(max-width: 767px)');
  const { data, error, loading, retry } = usePolled(API.history(ticker, range), range === '1D' ? 60000 : 300000);
  const s = useMemo(() => buildSeries(data, side), [data, side]);
  const sideLabel = side === 'yes' ? 'Yes' : 'No';
  const has = s.points.some((p) => isNum(p.v));
  return (
    <Panel title="Price history" sub={`${sideLabel} midpoint${data ? ` · ${data.sampling}` : ''} · Kalshi`} className="chart-panel"
      actions={<Button size="sm" variant="ghost" icon={view === 'chart' ? 'table' : 'chart-line'} aria-pressed={view === 'table'} onClick={() => setView(view === 'chart' ? 'table' : 'chart')}>{view === 'chart' ? 'Table view' : 'Chart view'}</Button>}>
      <div className="chart-toolbar">
        <div className="chart-toolbar-group">
          <Segmented label="Time range" value={range} onChange={setRange} options={RANGES} />
          <Segmented label="Outcome side" value={side} onChange={setSide} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} />
        </div>
      </div>
      {loading && !data ? <Skeleton h={mobile ? 240 : 340} /> : error && !data ? (
        <Banner tone="warning" title="Couldn’t load price history." actions={<Button size="sm" variant="secondary" icon="refresh-cw" onClick={retry}>Retry</Button>}>{error.message}</Banner>
      ) : !has ? (
        <EmptyState compact title="No two-sided quotes in this period">Kalshi has no bid-and-ask history for this market in the selected range. Try a longer range.</EmptyState>
      ) : (
        <PriceChart series={[{ id: 'main', label: `Kalshi ${sideLabel} mid`, points: s.points }]} from={data.from} to={data.to} height={mobile ? 240 : 340}
          gaps={s.gaps} yFormat={(v) => fmtCents(v, 1)} sampling={data.sampling} priceType={`${sideLabel} midpoint`} source="Kalshi" view={view}
          summary={summarize(s.points, `${label} ${sideLabel} midpoint`)} ariaLabel={`${label} price chart, ${RANGES.find((r) => r.id === range).aria}`} />
      )}
      <div className="chart-foot">
        <span><Icon n="info" size={13} />Midpoint of Kalshi’s closing Yes bid and ask in each candle.{side === 'no' ? ' No is 100¢ minus the Yes midpoint.' : ''}</span>
        {s.gaps.length > 0 && <span><Icon n="unplug" size={13} />Shaded areas had no two-sided quote. Lines are not drawn through them.</span>}
      </div>
    </Panel>
  );
}

function LiveBook({ ticker, compact }) {
  const { data, error, loading } = usePolled(API.book(ticker), 15000);
  return (
    <Panel title="Order book" sub="Yes side · sizes in contracts">
      {loading && !data ? <Skeleton h={180} /> : error && !data ? <p className="muted small">Couldn’t load the order book. {error.message}</p> : (
        <>
          <OrderLadder book={{ bids: data.bids, asks: data.asks }} compact={compact} unit="contracts" />
          <p className="panel-note"><Icon n="info" size={14} />Kalshi lists bids only. Yes asks are 100¢ minus No bids. Fetched {fmtTimeSec(data.observedAt)}.</p>
        </>
      )}
    </Panel>
  );
}

function Rules({ m, ev, series }) {
  const paras = (t) => String(t || '').split(/\n{2,}|\r?\n/).map((p) => p.trim()).filter(Boolean);
  const strike = m.strikeType && (isNum(m.floorStrike) || isNum(m.capStrike))
    ? `${m.strikeType.replace(/_/g, ' ')}${isNum(m.floorStrike) ? ` · floor ${m.floorStrike}` : ''}${isNum(m.capStrike) ? ` · cap ${m.capStrike}` : ''}` : null;
  const items = [
    ['Trading closes', fmtDateTimeShort(m.closes)],
    ['Expected expiration', fmtDateTimeShort(m.expectedExpiration)],
    ['Latest expiration', fmtDateTimeShort(m.latestExpiration)],
    ['Can close early', m.canCloseEarly ? (m.earlyCloseCondition || 'Yes') : 'No'],
    ['Settlement', `$${((isNum(m.notional) ? m.notional : 100) / 100).toFixed(2)} per contract (USD)`],
  ];
  if (strike) items.push(['Strike', strike]);
  if (ev && ev.sources && ev.sources.length) {
    items.push(['Settlement sources', <span className="live-links">{ev.sources.map((s, i) => (s.url
      ? <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : <span key={i}>{s.name}</span>))}</span>]);
  }
  if (series && series.termsUrl) items.push(['Contract terms', <a href={series.termsUrl} target="_blank" rel="noopener noreferrer">Kalshi contract terms</a>]);
  return (
    <Panel title="About this contract" sub="Rules as published by Kalshi" id="rules">
      {m.rulesPrimary || m.rulesSecondary ? (
        <blockquote className="rules-quote">{[...paras(m.rulesPrimary), ...paras(m.rulesSecondary)].map((p, i) => <p key={i}>{p}</p>)}</blockquote>
      ) : <p className="muted small">Kalshi hasn’t published rule text for this market.</p>}
      <KeyValue className="rules-kv" items={items} />
      <p className="panel-note"><Icon n="file-text" size={14} /><span>Kalshi market <span className="mono">{m.ticker}</span> · event <span className="mono">{m.event}</span>{isNum(m.updatedAt) ? ` · details updated ${fmtDate(m.updatedAt)}` : ''}</span></p>
    </Panel>
  );
}

function Siblings({ list, exclusive }) {
  if (!list.length) return <p className="muted small">No other open markets in this event.</p>;
  return (
    <>
      {exclusive && <p className="muted small live-sib-note">Outcomes in this event are mutually exclusive: at most one resolves Yes.</p>}
      <ul className="related">
        {list.slice(0, 12).map((s) => (
          <li key={s.ticker}>
            <a href={`#app-live-${s.ticker}`} className="related-link">
              <span className="grow related-name">{s.label}</span>
              <span className="mono">{fmtCentsAuto(midOf2(s.bid, s.ask))}</span>
              <Delta value={change24(s)} />
            </a>
          </li>
        ))}
      </ul>
      {list.length > 12 && <p className="muted small">{pluralize(list.length - 12, 'more market')} in this event. <a href="#app-live">Search the market list</a>.</p>}
    </>
  );
}

function Sources({ m }) {
  return (
    <KeyValue items={[
      ['Source', 'Kalshi public market data (Trade API v2)'],
      ['Market ticker', <span className="mono">{m.ticker}</span>],
      ['Fetched by Banthom', fmtTimeSec(m.observedAt)],
      ['Refresh', 'Every 15 seconds while this page is open'],
      ['Delayed after', minutes(LIVE_CFG.recentSeconds)],
      ['Price units', 'US cents per contract ($1.00 payout)'],
    ]} />
  );
}

export function LiveMarket({ ticker }) {
  const { data, error, loading, retry } = usePolled(API.market(ticker), 15000);
  const now = useRealNow();
  const mobile = useMedia('(max-width: 767px)');
  const m = data && data.market;
  const ev = data && data.event;
  const title = ev ? ev.title : ticker;
  useTitle(m ? `${m.label} · ${title}` : 'Kalshi market');

  if (!data) {
    const notFound = error && error.status === 404;
    return (
      <div className="page-stack">
        <PageHeader title={loading ? 'Loading market…' : notFound ? 'Market not found' : 'Couldn’t load this market'}
          crumbs={[{ label: 'Kalshi markets', href: '#app-live' }, { label: ticker }]} meta={<KalshiBadge full />} />
        {loading ? <Skeleton h={88} /> : (
          <EmptyState title={notFound ? `Kalshi has no market called ${ticker}.` : 'Kalshi didn’t respond.'}
            action={notFound ? <Button variant="secondary" href="#app-live">Browse Kalshi markets</Button> : <Button variant="secondary" icon="refresh-cw" onClick={retry}>Try again</Button>}>
            {notFound ? 'It may have been settled and archived, or the link may be wrong.' : error && error.message}
          </EmptyState>
        )}
      </div>
    );
  }

  const fr = liveFreshness(m.observedAt, now);
  const active = m.status === 'active' || m.status === 'open';
  const multi = data.siblings.length > 0;
  const header = (
    <PageHeader title={multi ? m.label : title} crumbs={[{ label: 'Kalshi markets', href: '#app-live' }, ...(multi ? [{ label: title }] : []), { label: multi ? m.label : m.ticker }]}
      sub={multi ? title : ev && ev.sub ? ev.sub : null}
      meta={<>
        <KalshiBadge full />
        <LiveTag />
        {active ? <Badge tone="muted" icon="circle-dot">Open</Badge> : <Badge tone="neutral" icon="circle-check">{m.status ? m.status[0].toUpperCase() + m.status.slice(1) : 'Not trading'}</Badge>}
        {ev && <Badge tone="muted">{ev.category}</Badge>}
      </>}
      actions={ev && <Button variant="secondary" icon="external-link" href={kalshiSeriesUrl(ev.series)} target="_blank" rel="noopener noreferrer">Open on Kalshi</Button>}>
      <p className="page-subline">
        <span>Closes {fmtDate(m.closes)}</span><span aria-hidden="true">•</span>
        <span>Yes means “{m.label}”</span><span aria-hidden="true">•</span>
        <span>Fetched from Kalshi {fmtTimeSec(m.observedAt)}</span>
      </p>
    </PageHeader>
  );
  const banners = (
    <>
      {!active && <Banner tone="neutral" icon="circle-check" title="This market isn’t trading.">Kalshi lists its status as “{m.status}”{m.result ? ` with result “${m.result}”` : ''}. Quotes are not actionable.</Banner>}
      {active && fr.status === 'delayed' && <Banner tone="warning" icon="clock" title="Delayed data.">Last fetched {fmtTimeSec(m.observedAt)}. Quotes may no longer be actionable.</Banner>}
      {error && <Banner tone="warning" icon="clock" title="Refresh failed.">Showing the last data Banthom received. {error.message}</Banner>}
    </>
  );
  const sib = <Panel title="Other outcomes in this event" sub={ev ? ev.title : null}><Siblings list={data.siblings} exclusive={ev && ev.exclusive} /></Panel>;

  if (mobile) {
    return (
      <div className="page-stack md-page">
        {header}
        {banners}
        <QuoteStrip m={m} compact />
        <LiveChart ticker={ticker} label={m.label} />
        <LiveBook ticker={ticker} compact />
        <Rules m={m} ev={ev} series={data.series} />
        {multi && sib}
        <Panel title="Sources"><Sources m={m} /></Panel>
      </div>
    );
  }
  return (
    <div className="page-stack">
      {header}
      {banners}
      <QuoteStrip m={m} />
      <div className="grid">
        <div className="s-8 col-stack">
          <LiveChart ticker={ticker} label={m.label} />
          <Rules m={m} ev={ev} series={data.series} />
        </div>
        <div className="s-4 col-stack">
          <LiveBook ticker={ticker} compact />
          {multi && sib}
          <Panel title="Sources"><Sources m={m} /></Panel>
        </div>
      </div>
    </div>
  );
}

// Shown when a live link is opened in a copy without the Banthom server (for example the static prototype).
export function LiveOff() {
  useTitle('Kalshi markets');
  return (
    <div className="page-stack">
      <PageHeader title="Kalshi markets" crumbs={[{ label: 'Kalshi markets' }]} />
      <EmptyState title="Live Kalshi data isn’t available here." action={<Button variant="secondary" href="#app-dashboard">Back to overview</Button>}>
        Live data comes from the Banthom server. This copy of the prototype runs without it, so only simulated data is shown.
      </EmptyState>
    </div>
  );
}

// Overview callout linking to the live pages.
export function LiveCallout() {
  return (
    <Banner tone="info" icon="radio" title="Live Kalshi markets are on." actions={<Button size="sm" variant="secondary" href="#app-live">Open Kalshi markets</Button>}>
      Real prices, order books and rules from Kalshi. This overview still uses simulated data.
    </Banner>
  );
}
