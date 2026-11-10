// Market pages (Kalshi and Polymarket). Real market data from the Banthom server; nothing here is simulated.
import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, EmptyState, Delta, Segmented, Banner, KeyValue, InfoTip, Skeleton, Popover } from '../ui/core.jsx';
import { PriceChart, OrderLadder } from '../charts/charts.jsx';
import { useMedia, go } from '../lib/hooks.js';
import { fmtCentsAuto, fmtCents, fmtDate, fmtDateShort, fmtDateTimeShort, fmtTimeSec, fmtAge, fmtAgeLong, fmtInt, fmtChance, fmtVolume, fmtPP, cx, isNum, pluralize } from '../lib/format.js';
import { useTitle, SortHeader, rowKeyNav } from './kit.jsx';
import { LIVE_VENUES, usePolled, useRealNow, liveFreshness, midOf2, change24, API2, eventHref, marketHref, compareHref, venueName, slugOf, buildSeries } from '../data/live.js';
import { StarButton, WatchMenu, usePageCrumbs } from './kit.jsx';
import { AlertEditor } from './Alerts.jsx';

const { useState, useMemo, useEffect, useRef } = React;

const minutes = (s) => pluralize(Math.round(s / 60), 'minute');
const fresh = (v, at, now) => liveFreshness(at, now, v.cfg.recentSeconds);

// ---------------------------------------------------------------- Small pieces
export function VenueLiveBadge({ v, full }) {
  return (
    <span className={cx('venue', `venue-live-${v.id}`)} data-tip={full ? undefined : `${v.name} (live data)`}>
      <span className="venue-code" aria-hidden={full ? undefined : 'true'}>{v.code}</span>
      {full ? <span className="venue-name">{v.name}</span> : <span className="sr-only">{v.name}</span>}
    </span>
  );
}

export function LiveTag({ v }) {
  return <span className="live-tag" data-tip={`Real market data from ${v ? v.name : 'the venue'}`} tabIndex={0}>Live</span>;
}

function Fresh({ v, observedAt, variant = 'strip' }) {
  const now = useRealNow();
  const f = fresh(v, observedAt, now);
  if (f.status === 'none') return <Badge tone="muted" icon="clock">Waiting for data</Badge>;
  if (f.status === 'delayed') {
    return <Badge tone="warning" icon="clock" tip={`Delayed. Last fetched from ${v.name} ${fmtTimeSec(observedAt)}. Quotes may no longer be actionable.`}>Delayed · {fmtAge(f.age)}</Badge>;
  }
  if (variant === 'cell') return <span className="age" data-tip={`Fetched from ${v.name} ${fmtTimeSec(observedAt)}`} data-tip-pos="left">{fmtAge(f.age)}</span>;
  return <Badge tone="success" icon="circle-dot" tip={`Fetched from ${v.name} ${fmtTimeSec(observedAt)}`}>Recent · {fmtAge(f.age)}</Badge>;
}

// ---------------------------------------------------------------- Market detail
function QuoteStrip({ v, m, compact }) {
  const spread = isNum(m.bid) && isNum(m.ask) ? m.ask - m.bid : null;
  const mid = midOf2(m.bid, m.ask);
  const indicative = isNum(spread) && spread <= 5 ? mid : null;
  const cell = (k, val, sub, tip) => (
    <div className="qs-cell">
      <span className="qs-k">{k}{tip && <InfoTip text={tip} label={k} />}</span>
      <span className="qs-v">{val}</span>
      {sub && <span className="qs-sub">{sub}</span>}
    </div>
  );
  return (
    <div className={cx('qstrip', compact && 'is-compact')} role="group" aria-label="Quote">
      {cell('Yes bid', fmtCentsAuto(m.bid), isNum(m.bidSize) && isNum(m.bid) ? `${fmtInt(m.bidSize)} available` : null, `Highest price offered for Yes on ${v.name}.`)}
      {cell('Yes ask', fmtCentsAuto(m.ask), isNum(m.askSize) && isNum(m.ask) ? `${fmtInt(m.askSize)} available` : null, `Lowest price asked for Yes on ${v.name}.`)}
      {cell('Spread', fmtCentsAuto(spread), null, 'Ask minus bid.')}
      {cell('Last trade', fmtCentsAuto(m.last), null, 'Most recent trade. Never used in place of a missing bid or ask.')}
      {cell('24h change', <Delta value={change24(m)} size="lg" />, v.ch24Sub)}
      {!compact && cell('Volume 24h', fmtVolume(m.vol24, v.volBasis), v.volSub)}
      {cell('Implied chance', isNum(indicative) ? fmtChance(indicative) : '—', isNum(indicative) ? 'Indicative' : 'Spread too wide', 'The midpoint read as a share of the $1 payout. A market-implied proxy, not a guaranteed probability.')}
      <div className="qs-cell qs-fresh"><span className="qs-k">Data</span><Fresh v={v} observedAt={m.observedAt} /></div>
    </div>
  );
}

const RANGES = [{ id: '1D', label: '1D', aria: '1 day' }, { id: '1W', label: '1W', aria: '1 week' }, { id: '1M', label: '1M', aria: '1 month' }, { id: 'ALL', label: 'All', aria: 'Since listing' }];

function summarize(points, label) {
  const vals = points.filter((p) => isNum(p.v));
  if (!vals.length) return `${label}: no observations in this period.`;
  const first = vals[0];
  const last = vals[vals.length - 1];
  const dir = last.v > first.v ? 'rose' : last.v < first.v ? 'fell' : 'was unchanged';
  return `${label} ${dir} from ${fmtCents(first.v, 1)} to ${fmtCents(last.v, 1)} between ${fmtDateTimeShort(first.t)} and ${fmtDateTimeShort(last.t)}.`;
}

function LiveChart({ v, ticker, label }) {
  const [range, setRange] = useState('1W');
  const [side, setSide] = useState('yes');
  const [view, setView] = useState('chart');
  const mobile = useMedia('(max-width: 767px)');
  const { data, error, loading, retry } = usePolled(v.api.history(ticker, range), range === '1D' ? 60000 : 300000);
  const s = useMemo(() => buildSeries(data, side), [data, side]);
  const sideLabel = side === 'yes' ? 'Yes' : 'No';
  const has = s.points.some((p) => isNum(p.v));
  return (
    <Panel title="Price history" sub={`${sideLabel} ${v.histSeries}${data ? ` · ${data.sampling}` : ''} · ${v.name}`} className="chart-panel"
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
        <EmptyState compact title="No prices in this period">{v.name} has no price history for this market in the selected range. Try a longer range.</EmptyState>
      ) : (
        <PriceChart series={[{ id: 'main', label: `${v.name} ${sideLabel} ${v.histSeries}`, points: s.points }]} from={data.from} to={data.to} height={mobile ? 240 : 340}
          gaps={s.gaps} yFormat={(x) => fmtCents(x, 1)} sampling={data.sampling} priceType={`${sideLabel} ${v.histSeries}`} source={v.name} view={view}
          summary={summarize(s.points, `${label} ${sideLabel} ${v.histSeries}`)} ariaLabel={`${label} price chart, ${RANGES.find((r) => r.id === range).aria}`} />
      )}
      <div className="chart-foot">
        <span><Icon n="info" size={13} />{v.histNote}{side === 'no' ? ' No is 100¢ minus the Yes value.' : ''}</span>
        {s.gaps.length > 0 && <span><Icon n="unplug" size={13} />Shaded areas have no price. Lines are not drawn through them.</span>}
      </div>
    </Panel>
  );
}

function LiveBook({ v, ticker, compact }) {
  const { data, error, loading } = usePolled(v.api.book(ticker), 15000);
  return (
    <Panel title="Order book" sub={`Yes side · sizes in ${v.sizeUnit}`}>
      {loading && !data ? <Skeleton h={180} /> : error && !data ? <p className="muted small">Couldn’t load the order book. {error.message}</p> : (
        <>
          <OrderLadder book={{ bids: data.bids, asks: data.asks }} compact={compact} unit={v.sizeUnit} />
          <p className="panel-note"><Icon n="info" size={14} />{v.bookNote} Fetched {fmtTimeSec(data.observedAt)}.</p>
        </>
      )}
    </Panel>
  );
}

const paras = (t) => String(t || '').split(/\n{2,}|\r?\n/).map((p) => p.trim()).filter(Boolean);
const extLink = (s, i) => (s.url ? <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : <span key={i}>{s.name}</span>);

function Rules({ v, m, ev, series }) {
  let text;
  let items;
  if (v.id === 'kalshi') {
    text = [...paras(m.rulesPrimary), ...paras(m.rulesSecondary)];
    const strike = m.strikeType && (isNum(m.floorStrike) || isNum(m.capStrike))
      ? `${m.strikeType.replace(/_/g, ' ')}${isNum(m.floorStrike) ? ` · floor ${m.floorStrike}` : ''}${isNum(m.capStrike) ? ` · cap ${m.capStrike}` : ''}` : null;
    items = [
      ['Trading closes', fmtDateTimeShort(m.closes)],
      ['Expected expiration', fmtDateTimeShort(m.expectedExpiration)],
      ['Latest expiration', fmtDateTimeShort(m.latestExpiration)],
      ['Can close early', m.canCloseEarly ? (m.earlyCloseCondition || 'Yes') : 'No'],
      ['Settlement', `$${((isNum(m.notional) ? m.notional : 100) / 100).toFixed(2)} per contract (USD)`],
    ];
    if (strike) items.push(['Strike', strike]);
    if (ev && ev.sources && ev.sources.length) items.push(['Settlement sources', <span className="live-links">{ev.sources.map(extLink)}</span>]);
    if (series && series.termsUrl) items.push(['Contract terms', <a href={series.termsUrl} target="_blank" rel="noopener noreferrer">Kalshi contract terms</a>]);
  } else {
    text = paras(m.rules);
    items = (m.facts || []).map(([k, val]) => [k, val && typeof val === 'object' && 'date' in val ? fmtDateTimeShort(val.date) : val]);
    if (m.resolutionSource) items.push(['Resolution source', <span className="live-links">{extLink(m.resolutionSource, 0)}</span>]);
  }
  return (
    <Panel title="About this contract" sub={`Rules as published by ${v.name}`} id="rules">
      {text.length ? <blockquote className="rules-quote">{text.map((p, i) => <p key={i}>{p}</p>)}</blockquote>
        : <p className="muted small">{v.name} hasn’t published rule text for this market.</p>}
      <KeyValue className="rules-kv" items={items} />
      <p className="panel-note"><Icon n="file-text" size={14} /><span>{v.name} market <span className="mono">{m.ticker}</span> · event <span className="mono">{m.event}</span>{isNum(m.updatedAt) ? ` · details updated ${fmtDate(m.updatedAt)}` : ''}</span></p>
    </Panel>
  );
}

function Siblings({ v, list, exclusive }) {
  if (!list.length) return <p className="muted small">No other open markets in this event.</p>;
  return (
    <>
      {exclusive && <p className="muted small live-sib-note">Outcomes in this event are mutually exclusive: at most one resolves Yes.</p>}
      <ul className="related">
        {list.slice(0, 12).map((s) => (
          <li key={s.ticker}>
            <a href={marketHref(`${v.id}:${s.ticker}`)} className="related-link">
              <span className="grow related-name">{s.label}</span>
              <span className="mono">{fmtCentsAuto(midOf2(s.bid, s.ask))}</span>
              <Delta value={change24(s)} />
            </a>
          </li>
        ))}
      </ul>
      {list.length > 12 && <p className="muted small">{pluralize(list.length - 12, 'more market')} in this event.</p>}
    </>
  );
}

function Sources({ v, m }) {
  return (
    <KeyValue items={[
      ['Source', v.sourceName],
      [v.idLabel, <span className="mono">{m.ticker}</span>],
      ['Fetched by Banthom', fmtTimeSec(m.observedAt)],
      ['Refresh', 'Every 15 seconds while this page is open'],
      ['Delayed after', minutes(v.cfg.recentSeconds)],
      ['Price units', v.priceUnits],
    ]} />
  );
}

function PairPanel({ pair, here }) {
  const o = pair.other;
  const gap = here != null && o.mid != null ? Math.round((here - o.mid) * 10) / 10 : null;
  return (
    <Panel title={`Also on ${venueName(o.venue)}`} sub="Suggested match · unverified">
      <a href={marketHref(o.id)} className="related-link">
        <VenueLiveBadge v={LIVE_VENUES[o.venue]} />
        <span className="grow related-name">{o.multi ? `${o.eventTitle}: ${o.label}` : o.eventTitle}{o.yes ? ` (Yes = ${o.yes})` : ''}</span>
        <span className="mono">{fmtCentsAuto(o.mid)}</span>
      </a>
      <p className="muted small">Price gap here vs {venueName(o.venue)}: <span className="mono">{fmtPP(gap)}</span>. Before treating these as the same question, compare both venues’ rules.</p>
      <Button size="sm" variant="secondary" icon="git-compare-arrows" href={compareHref(pair.id)}>Compare side by side</Button>
    </Panel>
  );
}

export function MarketPage({ venue, ticker }) {
  const v = LIVE_VENUES[venue];
  const { data, error, loading, retry } = usePolled(API2.market(venue, ticker), 15000);
  const now = useRealNow();
  const mobile = useMedia('(max-width: 767px)');
  const [alertOpen, setAlertOpen] = useState(false);
  const m = data && data.market;
  const ev = data && data.event;
  const title = ev ? ev.title : ticker;
  useTitle(m ? `${m.label} · ${title}` : `${v.name} market`);
  const multi = !!(data && data.siblings.length > 0);
  const evLink = ev ? eventHref(venue, ev.ticker) : null;
  const crumbs = m ? [
    { label: 'Markets', href: '#app-markets' },
    ...(data.category ? [{ label: data.category, href: `#app-markets-${slugOf(data.category)}` }] : []),
    ...(multi && evLink ? [{ label: title, href: evLink }, { label: m.label }] : [{ label: title }]),
  ] : null;
  usePageCrumbs(crumbs);

  if (!data) {
    const notFound = error && error.status === 404;
    return (
      <div className="page-stack">
        <PageHeader title={loading ? 'Loading market…' : notFound ? 'Market not found' : 'Couldn’t load this market'}
          crumbs={[{ label: 'Markets', href: '#app-markets' }, { label: ticker }]} meta={<VenueLiveBadge v={v} full />} />
        {loading ? <Skeleton h={88} /> : (
          <EmptyState title={notFound ? `${v.name} has no open market ${ticker}.` : `${v.name} didn’t respond.`}
            action={notFound ? <Button variant="secondary" href="#app-markets">Browse markets</Button> : <Button variant="secondary" icon="refresh-cw" onClick={retry}>Try again</Button>}>
            {notFound ? 'It may have closed, settled or been archived, or the link may be wrong.' : error && error.message}
          </EmptyState>
        )}
      </div>
    );
  }

  const row = { id: data.id, venue, label: m.label, eventTitle: title, multi };
  const fr = fresh(v, m.observedAt, now);
  const active = m.status === 'active' || m.status === 'open';
  const yesMeans = m.yesLabel && m.yesLabel !== 'Yes' ? m.yesLabel : m.label;
  const header = (
    <PageHeader title={multi ? m.label : title}
      crumbs={crumbs}
      sub={multi ? <a className="link-quiet" href={evLink}>{title}</a> : ev && ev.sub ? ev.sub : null}
      meta={<>
        <VenueLiveBadge v={v} full />
        <LiveTag v={v} />
        {active ? <Badge tone="muted" icon="circle-dot">Open</Badge> : <Badge tone="neutral" icon="circle-check">{m.status ? m.status[0].toUpperCase() + m.status.slice(1) : 'Not trading'}</Badge>}
        {data.category && <Badge tone="muted">{data.category}</Badge>}
      </>}
      actions={<>
        <StarButton row={row} size="lg" />
        <WatchMenu row={row} />
        <Button variant="secondary" icon="bell-plus" onClick={() => setAlertOpen(true)}>Create alert</Button>
        <Button variant="secondary" icon="external-link" href={v.marketUrl(ev)} target="_blank" rel="noopener noreferrer">Open on {v.name}</Button>
      </>}>
      <p className="page-subline">
        <span>Closes {fmtDate(m.closes)}</span><span aria-hidden="true">•</span>
        <span>Yes means “{yesMeans}”</span><span aria-hidden="true">•</span>
        {multi && evLink && <><a href={evLink}>{pluralize(data.siblings.length + 1, 'outcome')} in this event</a><span aria-hidden="true">•</span></>}
        <span>Fetched from {v.name} {fmtTimeSec(m.observedAt)}</span>
      </p>
    </PageHeader>
  );
  const banners = (
    <>
      {!active && <Banner tone="neutral" icon="circle-check" title="This market isn’t trading.">{v.name} lists its status as “{m.status}”{m.result ? ` with result “${m.result}”` : ''}. Quotes are not actionable.</Banner>}
      {active && fr.status === 'delayed' && <Banner tone="warning" icon="clock" title="Delayed data.">Last fetched {fmtTimeSec(m.observedAt)}. Quotes may no longer be actionable.</Banner>}
      {error && <Banner tone="warning" icon="clock" title="Refresh failed.">Showing the last data Banthom received. {error.message}</Banner>}
    </>
  );
  const sib = <Panel title="Other outcomes in this event" sub={ev ? ev.title : null} actions={evLink ? <Button size="sm" variant="ghost" href={evLink} iconRight="arrow-right">Event</Button> : null}><Siblings v={v} list={data.siblings} exclusive={ev && ev.exclusive} /></Panel>;
  const pair = data.pair ? <PairPanel pair={data.pair} here={midOf2(m.bid, m.ask)} /> : null;
  const editor = <AlertEditor open={alertOpen} onClose={() => setAlertOpen(false)} initial={{ marketId: data.id, venue, label: m.label, eventTitle: title, multi }} />;

  if (mobile) {
    return (
      <div className="page-stack md-page">
        {header}
        {banners}
        <QuoteStrip v={v} m={m} compact />
        <LiveChart v={v} ticker={ticker} label={m.label} />
        {pair}
        <LiveBook v={v} ticker={ticker} compact />
        <Rules v={v} m={m} ev={ev} series={data.series} />
        {multi && sib}
        <Panel title="Sources"><Sources v={v} m={m} /></Panel>
        {editor}
      </div>
    );
  }
  return (
    <div className="page-stack">
      {header}
      {banners}
      <QuoteStrip v={v} m={m} />
      <div className="grid">
        <div className="s-8 col-stack">
          <LiveChart v={v} ticker={ticker} label={m.label} />
          <Rules v={v} m={m} ev={ev} series={data.series} />
        </div>
        <div className="s-4 col-stack">
          {pair}
          <LiveBook v={v} ticker={ticker} compact />
          {multi && sib}
          <Panel title="Sources"><Sources v={v} m={m} /></Panel>
        </div>
      </div>
      {editor}
    </div>
  );
}

// Shown when the page runs without the Banthom server (for example a static copy), or a venue is switched off.
export function LiveOff({ name = 'Live' }) {
  useTitle(`${name} markets`);
  return (
    <div className="page-stack">
      <PageHeader title={`${name} markets`} crumbs={[{ label: `${name} markets` }]} />
      <EmptyState title={`Live ${name} data isn’t available here.`} action={<Button variant="secondary" href="#app-dashboard">Back to overview</Button>}>
        Live data comes from the Banthom server. This copy runs without it, or this venue is switched off.
      </EmptyState>
    </div>
  );
}
