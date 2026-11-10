// Compare: Kalshi and Polymarket markets that look like the same question (suggested, unverified).
import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, EmptyState, Banner, Segmented, Skeleton, KeyValue, VenueBadge, Delta } from '../ui/core.jsx';
import { PriceChart } from '../charts/charts.jsx';
import { useMedia, go } from '../lib/hooks.js';
import { fmtCentsAuto, fmtCents, fmtDate, fmtDateShort, fmtDateTimeShort, fmtTimeSec, fmtInt, fmtPP, isNum } from '../lib/format.js';
import { usePolled, API2, LIVE_VENUES, marketHref, compareHref, buildSeries } from '../data/live.js';
import { useTitle, SortHeader, rowKeyNav, FeedBanners, Fresh, StarButton, volText, usePageCrumbs, PairBadge } from './kit.jsx';

const { useState, useEffect, useMemo } = React;

const gapText = (g) => fmtPP(g);
const nameOf = (r) => (r.multi ? `${r.eventTitle}: ${r.label}` : r.eventTitle) + (r.yes ? ` (Yes = ${r.yes})` : '');

function Caveat({ status }) {
  if (status === 'verified') {
    return (
      <Banner tone="info" icon="badge-check" title="Verified pair.">
        A reviewer read both venues’ rules and confirmed they ask the same question. Prices still exclude fees, and the venues settle in different currencies.
      </Banner>
    );
  }
  return (
    <Banner tone="info" icon="circle-dashed" title={status ? 'Suggested pair, not yet verified.' : 'Verified pairs have been checked by a person. Suggested pairs have not.'}>
      Banthom suggests pairs whose titles, numbers, outcome names and closing dates line up. Until a pair is verified, the venues’ rules can still differ (sources, deadlines, edge cases), so read both before relying on a gap. Prices exclude fees.
    </Banner>
  );
}

export function CompareList() {
  useTitle('Compare');
  const mobile = useMedia('(max-width: 767px)');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'activity', dir: 'desc' });
  const [limit, setLimit] = useState(50);
  const [only, setOnly] = useState('all');
  useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 250); return () => clearTimeout(t); }, [qInput]);
  useEffect(() => { setLimit(50); }, [q, sort, only]);
  const { data, error, loading, retry } = usePolled(API2.matches({ q, sort: sort.key, limit, status: only === 'all' ? null : only }), 60000, { keep: true });
  const counts = data && data.counts;
  const ps = data && data.pairStatus;
  const rows = data ? data.pairs : [];
  return (
    <div className="page-stack">
      <PageHeader title="Compare" sub="The same question on Kalshi and Polymarket, side by side"
        meta={ps && ps.builtAt ? <span className="muted small"><Icon n="clock" size={13} /> Pairs updated {fmtTimeSec(ps.builtAt)} · {counts ? `${fmtInt(counts.verified)} verified · ${fmtInt(counts.suggested)} suggested` : `${fmtInt(ps.pairs)} pairs`}</span> : null} />
      <Caveat />
      {error && !data && <EmptyState title="Couldn’t load pairs." action={<Button variant="secondary" icon="refresh-cw" onClick={retry}>Try again</Button>}>{error.message}</EmptyState>}
      {data && <FeedBanners status={data.status} />}
      <Panel flush className="live-table-panel">
        <div className="live-toolbar">
          <div className="input-wrap live-search">
            <Icon n="search" size={16} />
            <input className="input" type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search pairs" aria-label="Search pairs" />
          </div>
          <Segmented label="Show" value={only} onChange={setOnly}
            options={[{ id: 'all', label: 'All' }, { id: 'verified', label: counts ? `Verified (${counts.verified})` : 'Verified' }, { id: 'suggested', label: 'Suggested' }]} />
          <Segmented label="Sort pairs by" value={sort.key} onChange={(k) => setSort({ key: k, dir: 'desc' })}
            options={[{ id: 'activity', label: 'Most active' }, { id: 'gap', label: 'Widest gap' }, { id: 'closes', label: 'Closing soonest' }]} />
          <span className="muted small live-count" aria-live="polite">{data ? `${fmtInt(data.matched)} ${data.matched === 1 ? 'pair' : 'pairs'}` : ''}</span>
        </div>
        {!data && loading ? <div className="live-skeleton">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={44} />)}</div>
          : !rows.length ? (
            <EmptyState title={ps && ps.builtAt ? (q ? 'No pairs match' : only === 'verified' ? 'No verified pairs yet' : 'No pairs found') : 'Finding pairs…'}>
              {ps && ps.builtAt ? (q ? 'Try a shorter search.' : only === 'verified' ? 'Pairs appear here once a reviewer has read both venues’ rules and confirmed them.' : 'No active markets currently look like the same question on both venues.') : 'Banthom compares both venues a few minutes after the server starts, then every ten minutes.'}
            </EmptyState>
          ) : mobile ? (
            <ul className="mcards">
              {rows.map((p) => (
                <li key={p.id} className="mcard">
                  <a href={compareHref(p.id)} className="mcard-title">{nameOf(p.k)}</a>
                  <div className="mcard-quote">
                    <span className="mcard-q"><VenueBadge venue="kalshi" />{fmtCentsAuto(p.k.mid)}</span>
                    <span className="mcard-q"><VenueBadge venue="polymarket" />{fmtCentsAuto(p.p.mid)}</span>
                    <span className="mcard-q"><span className="label">Gap</span><span className="mono">{gapText(p.gap)}</span></span>
                    <PairBadge status={p.status} size="sm" short />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="table-scroll">
              <table className="table live-table">
                <caption className="sr-only">Suggested Kalshi–Polymarket pairs. Gap is Kalshi Yes mid minus Polymarket Yes mid.</caption>
                <thead>
                  <tr>
                    <th scope="col">Question (Kalshi / Polymarket)</th>
                    <th scope="col" className="num">Kalshi mid</th>
                    <th scope="col" className="num">Polymarket mid</th>
                    <SortHeader col="gap" sort={sort} setSort={(s) => setSort({ key: s.key, dir: 'desc' })} num tip="Kalshi Yes midpoint minus Polymarket Yes midpoint, in percentage points. Excludes fees.">Gap</SortHeader>
                    <th scope="col" className="num">Volume 24h</th>
                    <th scope="col" className="num">Closes</th>
                    <th scope="col" className="num">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} tabIndex={0} onClick={() => go(compareHref(p.id).slice(1))} onKeyDown={(e) => { if (e.target === e.currentTarget) rowKeyNav(e, () => go(compareHref(p.id).slice(1))); }}>
                      <td className="live-mkt">
                        <div className="mkt-cell">
                          <a href={compareHref(p.id)} onClick={(e) => e.stopPropagation()}>{nameOf(p.k)}</a>
                          <span className="mkt-cell-sub">{nameOf(p.p)}</span>
                        </div>
                      </td>
                      <td className="num">{fmtCentsAuto(p.k.mid)}</td>
                      <td className="num">{fmtCentsAuto(p.p.mid)}</td>
                      <td className="num mono">{gapText(p.gap)}</td>
                      <td className="num"><span className="nowrap">{volText(p.k)}</span><br /><span className="nowrap muted small">{volText(p.p)}</span></td>
                      <td className="num"><span className="nowrap">{fmtDateShort(p.k.closes)}</span><br /><span className="nowrap muted small">{fmtDateShort(p.p.closes)}</span></td>
                      <td className="num"><PairBadge status={p.status} size="sm" short />{p.status !== 'verified' && <><br /><span className="muted small">Titles {Math.round(p.score * 100)}%</span></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        {data && data.matched > rows.length && (
          <div className="live-more">{limit < 500 ? <Button variant="secondary" size="sm" onClick={() => setLimit((n) => Math.min(500, n + 50))}>Show 50 more</Button> : <span className="muted small">Showing the first 500.</span>}</div>
        )}
      </Panel>
      <p className="muted small live-note">Verified pairs were confirmed by a reviewer who read both venues’ rules. For suggested pairs, the title % is how closely the two titles agree after normalising wording, numbers and dates; it is not a probability that the contracts are equivalent.</p>
    </div>
  );
}

// ---------------------------------------------------------------- Detail
const RANGES = [{ id: '1D', label: '1D', aria: '1 day' }, { id: '1W', label: '1W', aria: '1 week' }, { id: '1M', label: '1M', aria: '1 month' }];
const toPoints = (h) => buildSeries(h).points;

function OverlayChart({ k, p }) {
  const [range, setRange] = useState('1W');
  const mobile = useMedia('(max-width: 767px)');
  const { data: kh } = usePolled(LIVE_VENUES.kalshi.api.history(k.ticker, range), 300000);
  const { data: ph } = usePolled(LIVE_VENUES.polymarket.api.history(p.ticker, range), 300000);
  const series = useMemo(() => [
    { id: 'k', label: 'Kalshi Yes mid', points: toPoints(kh) },
    { id: 'p', label: 'Polymarket Yes price', points: toPoints(ph) },
  ], [kh, ph]);
  const has = series.some((s) => s.points.some((x) => isNum(x.v)));
  const from = Math.min(kh ? kh.from : Infinity, ph ? ph.from : Infinity);
  const to = Math.max(kh ? kh.to : 0, ph ? ph.to : 0);
  return (
    <Panel title="Price history, both venues" sub="Kalshi: midpoint of closing bid and ask · Polymarket: recorded price" className="chart-panel">
      <div className="chart-toolbar"><Segmented label="Time range" value={range} onChange={setRange} options={RANGES} /></div>
      {!kh && !ph ? <Skeleton h={mobile ? 240 : 320} /> : !has ? <EmptyState compact title="No price history in this period">Try a longer range.</EmptyState> : (
        <PriceChart series={series} from={from} to={to} height={mobile ? 240 : 320} yFormat={(x) => fmtCents(x, 1)} sampling={kh ? kh.sampling : ph ? ph.sampling : ''}
          priceType="Yes" source="Kalshi and Polymarket" summary={`Kalshi and Polymarket Yes prices for ${k.label}.`} ariaLabel={`Price history on both venues, ${RANGES.find((r) => r.id === range).aria}`} />
      )}
      <div className="chart-foot"><span><Icon n="info" size={13} />The two venues sample prices differently; small gaps in time are expected. Lines aren’t drawn through missing data.</span></div>
    </Panel>
  );
}

function VenueSide({ r, detail }) {
  const v = LIVE_VENUES[r.venue];
  const m = detail && detail.market;
  const paras = (t) => String(t || '').split(/\n{2,}|\r?\n/).map((x) => x.trim()).filter(Boolean);
  const text = m ? (r.venue === 'kalshi' ? [...paras(m.rulesPrimary), ...paras(m.rulesSecondary)] : paras(m.rules)) : [];
  const spread = isNum(r.bid) && isNum(r.ask) ? r.ask - r.bid : null;
  return (
    <Panel title={<span className="row"><VenueBadge venue={r.venue} full />{nameOf(r)}</span>} sub={r.multi ? null : r.category}
      actions={<><StarButton row={r} /><Button size="sm" variant="ghost" href={marketHref(r.id)} iconRight="arrow-right">Market</Button></>}>
      <KeyValue items={[
        ['Yes bid / ask', `${fmtCentsAuto(r.bid)} / ${fmtCentsAuto(r.ask)}`],
        ['Midpoint', fmtCentsAuto(r.mid)],
        ['Spread', fmtCentsAuto(spread)],
        ['24h change', <Delta value={r.ch24} />],
        ['Volume 24h', volText(r)],
        ['Closes', fmtDateTimeShort(r.closes)],
        ['Data', <Fresh venue={r.venue} at={r.observedAt} variant="badge" />],
      ]} />
      <p className="label rules-label">Rules as published by {v.name}</p>
      {!detail ? <Skeleton h={80} /> : text.length ? <blockquote className="rules-quote">{text.map((x, i) => <p key={i}>{x}</p>)}</blockquote> : <p className="muted small">{v.name} hasn’t published rule text for this market.</p>}
    </Panel>
  );
}

export function CompareDetail({ id }) {
  const { data, error, loading, retry } = usePolled(API2.match(id), 30000);
  const pr = data && data.pair;
  useTitle(pr ? `Compare: ${pr.k.label}` : 'Compare');
  usePageCrumbs(pr ? [{ label: 'Compare', href: '#app-compare' }, { label: nameOf(pr.k) }] : null);
  if (!data) {
    const gone = error && error.status === 404;
    return (
      <div className="page-stack">
        <PageHeader title={loading ? 'Loading pair…' : gone ? 'Pair no longer suggested' : 'Couldn’t load this pair'} crumbs={[{ label: 'Compare', href: '#app-compare' }, { label: 'Pair' }]} />
        {loading ? <Skeleton h={160} /> : (
          <EmptyState title={gone ? 'One of these markets closed, or the titles no longer line up.' : 'Banthom couldn’t reach a venue.'}
            action={gone ? <Button variant="secondary" href="#app-compare">All pairs</Button> : <Button variant="secondary" icon="refresh-cw" onClick={retry}>Try again</Button>}>
            {gone ? 'Pairs are re-checked every ten minutes.' : error && error.message}
          </EmptyState>
        )}
      </div>
    );
  }
  return (
    <div className="page-stack">
      <PageHeader title={nameOf(pr.k)} sub={`Polymarket: ${nameOf(pr.p)}`}
        crumbs={[{ label: 'Compare', href: '#app-compare' }, { label: pr.k.label }]}
        meta={<><PairBadge status={pr.status} />{pr.status === 'verified'
          ? <span className="muted small">Reviewed {fmtDate(pr.reviewedAt)}</span>
          : <span className="muted small">Title match {Math.round(pr.score * 100)}%</span>}</>} />
      <Caveat status={pr.status} />
      {pr.status === 'verified' && pr.note && <p className="muted small live-note"><Icon n="message-square" size={13} /> Reviewer’s note: {pr.note}</p>}
      <FeedBanners status={data.status} />
      <div className="qstrip qstrip-4" role="group" aria-label="Price gap">
        <div className="qs-cell"><span className="qs-k">Kalshi Yes mid</span><span className="qs-v">{fmtCentsAuto(pr.k.mid)}</span></div>
        <div className="qs-cell"><span className="qs-k">Polymarket Yes mid</span><span className="qs-v">{fmtCentsAuto(pr.p.mid)}</span></div>
        <div className="qs-cell"><span className="qs-k">Gap</span><span className="qs-v mono">{gapText(pr.gap)}</span><span className="qs-sub">Kalshi minus Polymarket, before fees</span></div>
        <div className="qs-cell"><span className="qs-k">Closes</span><span className="qs-v small">{fmtDate(pr.k.closes)}</span><span className="qs-sub">Polymarket: {fmtDate(pr.p.closes)}</span></div>
      </div>
      <OverlayChart k={pr.k} p={pr.p} />
      <div className="grid">
        <div className="s-6 md-12"><VenueSide r={pr.k} detail={data.kalshi} /></div>
        <div className="s-6 md-12"><VenueSide r={pr.p} detail={data.polymarket} /></div>
      </div>
    </div>
  );
}
