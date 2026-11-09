import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, EmptyState, VenueBadge, Delta, Banner, MatchBadge, Check, Switch, KeyValue, Freshness, DemoTag, InfoTip, MATCH_STATUS } from '../ui/core.jsx';
import { PriceChart } from '../charts/charts.jsx';
import { useStore } from '../store.jsx';
import { useNow, useMedia } from '../lib/hooks.js';
import { useFeed, freshnessOf } from '../data/quotes.js';
import { MATCHES, MATCH_BY_ID, MARKET_BY_ID, EVENT_BY_ID, VENUES } from '../data/fixtures.js';
import { seriesFor, orderBook, walkBook } from '../data/series.js';
import { fmtCents, fmtSignedCents, fmtDate, fmtDateShort, fmtTimeSec, fmtAge, fmtInt, midOf, cx, isNum, pluralize } from '../lib/format.js';
import { useTitle } from './kit.jsx';
import { AlertEditor } from './Alerts.jsx';

const { useState, useMemo } = React;

// Best direction for a pair: buy Yes on one venue and No on the other. No price = 100¢ − Yes bid.
export function pairQuote(match, quotes) {
  const A = MARKET_BY_ID[match.a];
  const B = MARKET_BY_ID[match.b];
  const qa = quotes[A.id];
  const qb = quotes[B.id];
  const fees = VENUES[A.venue].feeCents + VENUES[B.venue].feeCents;
  const mk = (dir, l1, l2) => {
    if (!isNum(l1.price) || !isNum(l2.price)) return null;
    const gross = 100 - l1.price - l2.price;
    return { dir, legs: [l1, l2], gross, fees, net: gross - fees, size: Math.min(l1.size || 0, l2.size || 0) };
  };
  const d1 = mk(1, { m: A, side: 'Yes', price: qa.ask, size: qa.askSize }, { m: B, side: 'No', price: isNum(qb.bid) ? 100 - qb.bid : null, size: qb.bidSize });
  const d2 = mk(2, { m: A, side: 'No', price: isNum(qa.bid) ? 100 - qa.bid : null, size: qa.bidSize }, { m: B, side: 'Yes', price: qb.ask, size: qb.askSize });
  const best = [d1, d2].filter(Boolean).sort((x, y) => y.gross - x.gross)[0] || null;
  return { A, B, qa, qb, best };
}

function legText(l) {
  return `${VENUES[l.m.venue].short} ${l.side} @ ${fmtCents(l.price)}`;
}

export function CompareList() {
  useTitle('Compare');
  const feed = useFeed();
  const now = useNow();
  const mobile = useMedia('(max-width: 767px)');
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const rows = useMemo(() => MATCHES.map((m) => {
    const p = pairQuote(m, feed.quotes);
    const fa = freshnessOf(p.A, p.qa, now);
    const fb = freshnessOf(p.B, p.qb, now);
    return { m, ...p, stale: fa.status === 'delayed' || fb.status === 'delayed', age: Math.max(fa.age || 0, fb.age || 0) };
  }), [feed, Math.floor(now / 5000)]);
  const verified = rows.filter((r) => r.m.status === 'verified').sort((a, b) => (b.best ? b.best.net : -99) - (a.best ? a.best.net : -99));
  const others = rows.filter((r) => r.m.status !== 'verified');
  const shown = verifiedOnly ? verified : [...verified, ...others];

  const metric = (r, key) => {
    if (r.m.status !== 'verified') return <span className="muted small" data-tip="Parity not confirmed, so price differences are not shown.">Suppressed</span>;
    if (!r.best) return '—';
    const v = r.best[key];
    return <span className={cx(r.stale && 'is-stale-num')}>{key === 'fees' ? fmtCents(v, 1) : fmtSignedCents(v, 1)}</span>;
  };

  return (
    <div className="page-stack">
      <PageHeader title="Compare markets across venues" sub="Review matching rules, prices and available liquidity"
        actions={<Check id="verified-only" label="Verified equivalence only" checked={verifiedOnly} onChange={setVerifiedOnly} />} />
      <Banner tone="neutral" icon="scale">
        A pair is compared on price only after a reviewer confirms the contracts settle the same way. Estimates are at top-of-book size, after the simulated fee schedule, and before slippage, capital lock-up and execution risk. <a href="#methodology">How matching works</a>
      </Banner>
      {mobile ? (
        <ul className="ccards">
          {shown.map((r) => (
            <li key={r.m.id} className="ccard">
              <div className="row-between"><MatchBadge status={r.m.status} />{r.stale && <Badge tone="warning" icon="clock" size="sm">Delayed</Badge>}</div>
              <a href={`#app-compare-${r.m.id}`} className="ccard-title">{r.m.canonical}</a>
              {r.m.status === 'verified' && r.best ? (
                <div className="ccard-grid">
                  <span className="label">Leg 1</span><span className="mono">{legText(r.best.legs[0])}</span>
                  <span className="label">Leg 2</span><span className="mono">{legText(r.best.legs[1])}</span>
                  <span className="label">Gross</span><span className="mono">{fmtSignedCents(r.best.gross, 1)}</span>
                  <span className="label">Net of fees</span><span className="mono strong">{fmtSignedCents(r.best.net, 1)}</span>
                  <span className="label">Top-of-book size</span><span className="mono">{fmtInt(r.best.size)}</span>
                </div>
              ) : <p className="muted small">{r.m.summary}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="panel table-panel">
          <div className="table-scroll">
            <table className="table cmp-table">
              <caption className="sr-only">Cross-venue pairs. Verified pairs first, sorted by estimated net spread. Unverified pairs are not ranked.</caption>
              <thead>
                <tr>
                  <th scope="col">Canonical event</th>
                  <th scope="col">Match status</th>
                  <th scope="col">Leg 1 · price / size</th>
                  <th scope="col">Leg 2 · price / size</th>
                  <th scope="col" className="num">Gross <InfoTip text="100¢ minus the cost of both legs, per pair." pos="bottom" /></th>
                  <th scope="col" className="num">Est. fees</th>
                  <th scope="col" className="num">Est. net <InfoTip text="Gross minus taker fees on both venues, at top-of-book size. Before slippage and capital lock-up." pos="bottom" /></th>
                  <th scope="col" className="num">Data age</th>
                  <th scope="col">Rulebooks</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <React.Fragment key={r.m.id}>
                    {!verifiedOnly && i === verified.length && others.length > 0 && (
                      <tr className="group-row"><th colSpan={9} scope="rowgroup">Not verified · listed for review, never ranked</th></tr>
                    )}
                    <tr className={cx(r.m.status !== 'verified' && 'row-muted')}>
                      <td className="mkt-td"><div className="mkt-cell"><a href={`#app-compare-${r.m.id}`}>{r.m.canonical}</a><span className="mkt-cell-sub">{EVENT_BY_ID[r.A.eventId].title}</span></div></td>
                      <td><MatchBadge status={r.m.status} short /></td>
                      {r.best ? r.best.legs.map((l, k) => (
                        <td key={k} className="nowrap"><VenueBadge venue={l.m.venue} /> <span className="mono">{l.side} {fmtCents(l.price)}</span> <span className="muted mono small">/ {fmtInt(l.size)}</span></td>
                      )) : <><td>—</td><td>—</td></>}
                      <td className="num">{metric(r, 'gross')}</td>
                      <td className="num">{metric(r, 'fees')}</td>
                      <td className="num">{metric(r, 'net')}</td>
                      <td className="num">{r.stale ? <span className="age age-stale"><Icon n="clock" size={12} />{fmtAge(r.age)}</span> : <span className="age">{fmtAge(r.age)}</span>}</td>
                      <td className="nowrap"><a href={`#app-market-${r.A.id}`} className="small">{VENUES[r.A.venue].short}</a> · <a href={`#app-market-${r.B.id}`} className="small">{VENUES[r.B.venue].short}</a></td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-foot">Never treated as risk-free. Quoted differences can disappear because of execution timing, order depth, fees, slippage, limits or availability. Venue data is simulated.</div>
        </div>
      )}
      {verifiedOnly && others.length > 0 && <p className="muted small">{pluralize(others.length, 'unverified pair')} hidden. Turn off “Verified equivalence only” to review them.</p>}
    </div>
  );
}

function DepthModel({ p }) {
  const [qty, setQty] = useState(100);
  const n = Math.max(1, Math.min(100000, Math.round(Number(qty) || 0)));
  const ba = orderBook(p.A, p.qa);
  const bb = orderBook(p.B, p.qb);
  const dir = p.best.dir;
  // dir 1: Yes on A (walk A asks) + No on B (walk B bids). dir 2: No on A (walk A bids) + Yes on B (walk B asks).
  const l1 = dir === 1 ? walkBook(ba.asks, n) : walkBook(ba.bids, n);
  const l2 = dir === 1 ? walkBook(bb.bids, n) : walkBook(bb.asks, n);
  const c1 = l1 == null ? null : dir === 1 ? l1 : 100 - l1;
  const c2 = l2 == null ? null : dir === 1 ? 100 - l2 : l2;
  const top1 = p.best.legs[0].price;
  const top2 = p.best.legs[1].price;
  const fees = p.best.fees;
  const gross = c1 != null && c2 != null ? 100 - c1 - c2 : null;
  const net = gross != null ? gross - fees : null;
  const maxDepth = (lv) => lv.reduce((s, l) => s + l.size, 0);
  const depth = Math.min(maxDepth(dir === 1 ? ba.asks : ba.bids), maxDepth(dir === 1 ? bb.bids : bb.asks));
  const row = (leg, avg, top) => (
    <tr>
      <th scope="row"><VenueBadge venue={leg.m.venue} /> Buy {leg.side}</th>
      <td className="num">{avg != null ? fmtCents(avg, 2) : '—'}</td>
      <td className="num">{fmtCents(top)}</td>
      <td className="num">{avg != null ? fmtSignedCents(avg - top, 2) : '—'}</td>
      <td className="num">{fmtCents(VENUES[leg.m.venue].feeCents, 1)}</td>
    </tr>
  );
  return (
    <Panel title="Modeled cost for a quantity" sub="Walks the simulated order books on both venues">
      <div className="depth-controls">
        <label htmlFor="qty" className="field-label">Pairs</label>
        <div className="input-wrap qty-input"><input id="qty" className="input has-unit" type="number" min="1" step="10" value={qty} onChange={(e) => setQty(e.target.value)} /><span className="input-unit">pairs</span></div>
        <div className="row">{[100, 500, 1000].map((v) => <button key={v} type="button" className="toggle-chip" aria-pressed={n === v} onClick={() => setQty(v)}>{fmtInt(v)}</button>)}</div>
      </div>
      {gross == null ? (
        <Banner tone="warning" icon="layers">Depth runs out at about {fmtInt(depth)} pairs on the thinner side. Lower the quantity to model a fill.</Banner>
      ) : (
        <>
          <div className="table-scroll">
            <table className="table table-compact">
              <caption className="table-caption">Average fill price per contract for {fmtInt(n)} {n === 1 ? 'pair' : 'pairs'}</caption>
              <thead><tr><th scope="col">Leg</th><th scope="col" className="num">Average</th><th scope="col" className="num">Top of book</th><th scope="col" className="num">Slippage</th><th scope="col" className="num">Fee</th></tr></thead>
              <tbody>{row(p.best.legs[0], c1, top1)}{row(p.best.legs[1], c2, top2)}</tbody>
            </table>
          </div>
          <div className="equation" aria-label="Margin calculation">
            <code>100¢ − {fmtCents(c1, 2)} − {fmtCents(c2, 2)} = <strong>{fmtSignedCents(gross, 2)}</strong> gross per pair</code>
            <code>{fmtSignedCents(gross, 2)} − {fmtCents(fees, 1)} fees = <strong className={net >= 0 ? 'up' : 'down'}>{fmtSignedCents(net, 2)}</strong> net per pair · {fmtSignedCents(net * n / 100, 2).replace('¢', '')} USD for {fmtInt(n)}</code>
          </div>
          <p className="panel-note"><Icon n="info" size={14} />{net < 0 ? 'At this size the difference is gone after fees and slippage.' : 'Before capital lock-up until settlement, execution timing and venue limits. Not risk-free.'}</p>
        </>
      )}
    </Panel>
  );
}

function PayoffMatrix({ p }) {
  const n = 100;
  const [l1, l2] = p.best.legs;
  const cost = (l1.price + l2.price) * n / 100;
  const pays = (leg, outcomeYes) => ((leg.side === 'Yes') === outcomeYes ? n : 0);
  const rows = [
    ['Event happens (both settle Yes)', pays(l1, true) + pays(l2, true)],
    ['Event doesn’t happen (both settle No)', pays(l1, false) + pays(l2, false)],
    ['Brisa can’t determine the outcome and pays 50/50', (l1.m.venue === 'BRS' ? n / 2 : pays(l1, true)) + (l2.m.venue === 'BRS' ? n / 2 : pays(l2, true))],
  ];
  return (
    <Panel title="Hypothetical payoff" sub={`${fmtInt(n)} pairs at top of book · before fees · illustrative`}>
      <div className="table-scroll">
        <table className="table table-compact">
          <caption className="sr-only">Payoff by outcome for 100 pairs</caption>
          <thead><tr><th scope="col">Scenario</th><th scope="col" className="num">Payout</th><th scope="col" className="num">Cost</th><th scope="col" className="num">Result</th></tr></thead>
          <tbody>
            {rows.map(([label, payout]) => (
              <tr key={label}><th scope="row" className="payoff-label">{label}</th><td className="num">${fmtInt(payout)}</td><td className="num">${cost.toFixed(2)}</td><td className={cx('num', payout - cost >= 0 ? 'up' : 'down')}>{payout - cost >= 0 ? '+' : '−'}${Math.abs(payout - cost).toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="panel-note"><Icon n="triangle-alert" size={14} />The third row is why void and cancellation clauses matter: a pair that looks hedged can still lose when venues settle differently.</p>
    </Panel>
  );
}

export function CompareDetail({ id }) {
  const m = MATCH_BY_ID[id];
  useTitle(m.canonical);
  const feed = useFeed();
  const now = useNow();
  const { toggleWatch, isWatched, toast } = useStore();
  const [editor, setEditor] = useState(false);
  const p = pairQuote(m, feed.quotes);
  const verified = m.status === 'verified';
  const fa = freshnessOf(p.A, p.qa, now);
  const fb = freshnessOf(p.B, p.qb, now);
  const stale = fa.status === 'delayed' || fb.status === 'delayed';
  const spread = useMemo(() => {
    const a = seriesFor(m.a, '1M');
    const b = seriesFor(m.b, '1M', a.to);
    return { from: a.from, to: a.to, points: a.points.map((pt, i) => ({ t: pt.t, v: isNum(pt.v) && b.points[i] && isNum(b.points[i].v) ? b.points[i].v - pt.v : null })) };
  }, [id]);
  const S = MATCH_STATUS[m.status];
  const card = (mk, q, f) => (
    <div className="snap">
      <div className="row-between"><VenueBadge venue={mk.venue} full /><Freshness mk={mk} q={q} variant="long" /></div>
      <a className="snap-title" href={`#app-market-${mk.id}`}>“{mk.sourceTitle}”</a>
      <div className="snap-q">
        <div><span className="qs-k">Yes bid</span><span className="qs-v">{fmtCents(q.bid)}</span><span className="qs-sub">{fmtInt(q.bidSize)} available</span></div>
        <div><span className="qs-k">Yes ask</span><span className="qs-v">{fmtCents(q.ask)}</span><span className="qs-sub">{fmtInt(q.askSize)} available</span></div>
        <div><span className="qs-k">Midpoint</span><span className="qs-v">{fmtCents(midOf(q), 1)}</span><span className="qs-sub">Observed {fmtTimeSec(q.observedAt)}</span></div>
      </div>
      <p className="muted small">{VENUES[mk.venue].feeLabel} · settles {mk.venue === 'ARD' ? '$1.00 per contract' : '1.00 USDC per share'}</p>
    </div>
  );
  return (
    <div className="page-stack">
      <PageHeader title={m.canonical} crumbs={[{ label: 'Compare', href: '#app-compare' }, { label: m.canonical }]}
        meta={<><MatchBadge status={m.status} />{m.reviewedAt && <span>Reviewed {fmtDate(m.reviewedAt)} by {m.reviewer}</span>}{m.revalidate && <span>Re-check by {fmtDate(m.revalidate)}</span>}<DemoTag /></>}
        actions={<>
          <Button variant="secondary" icon="external-link" aria-disabled="true" onClick={() => toast('Both venues are fictional, so there are no originals to open.', { tone: 'info' })}>Open both originals</Button>
          <Button variant="secondary" icon="star" onClick={() => { if (!isWatched(m.a)) toggleWatch(m.a); if (!isWatched(m.b)) toggleWatch(m.b); }}>Add both to watchlist</Button>
          {verified && <Button variant="primary" icon="bell-plus" onClick={() => setEditor(true)}>Create spread alert</Button>}
        </>}>
        <ul className="pair-names">
          <li><VenueBadge venue={p.A.venue} /><span>“{p.A.sourceTitle}”</span></li>
          <li><VenueBadge venue={p.B.venue} /><span>“{p.B.sourceTitle}”</span></li>
        </ul>
      </PageHeader>

      {!verified && <Banner tone="warning" icon={S.icon} title={m.status === 'candidate' ? 'Potential match, review required.' : 'Not equivalent.'}>{m.summary} Price differences are suppressed until parity is confirmed.</Banner>}
      {verified && stale && <Banner tone="warning" icon="clock" title="Delayed data on one venue.">Spread estimates use a stale quote and may no longer be actionable.</Banner>}

      <div className="grid">
        <div className="s-7 col-stack">
          <Panel title="Contract terms side by side" sub="Clause-level review" flush className="table-panel">
            <div className="table-scroll">
              <table className="table terms-table">
                <caption className="sr-only">Contract terms compared</caption>
                <thead><tr><th scope="col">Clause</th><th scope="col">{VENUES[p.A.venue].name}</th><th scope="col">{VENUES[p.B.venue].name}</th><th scope="col"><span className="sr-only">Same or different</span></th></tr></thead>
                <tbody>
                  {m.terms.map(([k, a, b, st]) => (
                    <tr key={k} className={cx(st === 'differs' && 'is-diff')}>
                      <th scope="row">{k}</th><td>{a}</td><td>{b}</td>
                      <td className="cell-tight"><Badge tone={st === 'same' ? 'muted' : 'warning'} size="sm" icon={st === 'same' ? 'check' : 'triangle-alert'}>{st === 'same' ? 'Same' : 'Differs'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-foot">Review status: {S.label}. Algorithmic similarity {Math.round(m.confidence * 100)}% (a starting point for review, never a verdict).</div>
          </Panel>
          <div className="snaps">{card(p.A, p.qa, fa)}{card(p.B, p.qb, fb)}</div>
          {verified && (
            <Panel title="Historical spread" sub="Brisa minus Arden Yes midpoint · 2-hour last observation · 1 month">
              <PriceChart series={[{ id: 'sp', label: 'Brisa − Arden mid', points: spread.points }]} from={spread.from} to={spread.to} height={220} zeroLine
                yFormat={(v, tick) => (tick ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}¢` : fmtSignedCents(v, 1))} priceType="Midpoint difference" sampling="2-hour last observation"
                summary="Difference between the two venues’ Yes midpoints over the past month." ariaLabel="Historical spread between venues" />
            </Panel>
          )}
        </div>
        <div className="s-5 col-stack">
          {verified && p.best ? (
            <>
              <Panel title="Indicative margin at top of book" sub={`${legText(p.best.legs[0])} + ${legText(p.best.legs[1])}`}>
                <KeyValue items={[
                  ['Cost per pair', fmtCents(p.best.legs[0].price + p.best.legs[1].price)],
                  ['Gross per pair', fmtSignedCents(p.best.gross, 1)],
                  ['Fees per pair', fmtCents(p.best.fees, 1)],
                  ['Net per pair', <strong className={p.best.net >= 0 ? 'up' : 'down'}>{fmtSignedCents(p.best.net, 1)}</strong>],
                  ['Available at these prices', `${fmtInt(p.best.size)} pairs`],
                ]} />
                <p className="formula-inline"><code>1 − effective Yes cost − effective No cost</code> per $1 pair, before fees, capital lock-up, execution risk and settlement differences.</p>
              </Panel>
              <DepthModel p={p} />
              <PayoffMatrix p={p} />
            </>
          ) : (
            <Panel title="Spread metrics suppressed">
              <EmptyState compact title="Parity not confirmed">
                {m.status === 'candidate' ? 'A reviewer has not confirmed these contracts settle the same way. Compare the clauses on the left first.' : 'Reviewed and found to settle differently, so a price difference between them is not meaningful.'}
              </EmptyState>
              {m.id === 'cpi-oct-yoy' && (
                <div className="table-scroll">
                  <table className="table table-compact">
                    <caption className="table-caption">How a boundary print would settle</caption>
                    <thead><tr><th scope="col">Published CPI (YoY)</th><th scope="col">Arden</th><th scope="col">Brisa</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">2.8%</th><td>No</td><td>No</td></tr>
                      <tr className="is-diff"><th scope="row">2.9%</th><td>No</td><td>Yes</td></tr>
                      <tr><th scope="row">3.0%</th><td>Yes</td><td>Yes</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
          <Panel title="Caveats">
            <ul className="caveats">
              <li>Quotes are simulated and come from fictional venues.</li>
              <li>Settlement currency differs: USD on Arden, USDC on Brisa. A 1:1 rate is assumed.</li>
              <li>Fees are a simplified taker schedule. Maker rebates, withdrawal costs and taxes are excluded.</li>
              <li>Both legs lock capital until settlement{p.A.resolves ? ` (${fmtDateShort(p.A.resolves)})` : ''}.</li>
              <li>Fills can change between legs; the second leg may not fill at the quoted price.</li>
            </ul>
          </Panel>
        </div>
      </div>
      {verified && <AlertEditor open={editor} onClose={() => setEditor(false)} initial={{ marketId: m.a, metric: 'netspread' }} />}
    </div>
  );
}
