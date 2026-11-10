// Marketing home. Every price here is real Kalshi or Polymarket data, fetched from the Banthom server.
import React from 'react';
import { Icon, LogoMark, Button, Badge, VenueBadge, Delta, Tabs, TabPanel, Skeleton } from '../ui/core.jsx';
import { PriceChart } from '../charts/charts.jsx';
import { fmtCentsAuto, fmtCents, fmtInt, fmtTime, fmtDateShort, fmtPP, cx, isNum } from '../lib/format.js';
import { useMedia } from '../lib/hooks.js';
import { LIVE, LIVE_LIST, LIVE_VENUES, usePolled, API2, compareHref, venueName, buildSeries } from '../data/live.js';
import { rowName, volText } from '../terminal/kit.jsx';

const { useRef, useEffect, useState, useMemo } = React;

// Previews are pictures of the terminal: not focusable, described by one sentence for screen readers.
function Inert({ children, className, label }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.setAttribute('inert', ''); }, []);
  return (
    <div className={className}>
      <p className="sr-only">{label}</p>
      <div ref={ref} aria-hidden="true">{children}</div>
    </div>
  );
}

const BOTH = LIVE_LIST.length > 1;
const centsLabel = (v, tick) => (tick ? `${Math.round(v)}¢` : fmtCents(v, 1));
const short = (r) => (r.multi ? r.label : r.eventTitle);
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s || '');
const firstPara = (t) => String(t || '').split(/\n+/).map((x) => x.trim()).find(Boolean) || '';
const gapText = (g) => fmtPP(g);
const inBand = (r) => isNum(r.mid) && r.mid >= 8 && r.mid <= 92;

// One overview poll for the page, the market featured in the hero (fixed once chosen) and the most active pair.
function useHomeData() {
  const { data: ov } = usePolled(LIVE ? API2.overview : null, 120000);
  const [pick, setPick] = useState(null);
  useEffect(() => {
    if (pick || !ov || !ov.active.length) return;
    setPick(ov.active.find((r) => inBand(r) && !r.multi) || ov.active.find(inBand) || ov.active[0]);
  }, [ov, pick]);
  const hero = pick && ov ? ov.active.find((r) => r.id === pick.id) || pick : pick;
  const { data: hist } = usePolled(pick ? LIVE_VENUES[pick.venue].api.history(pick.ticker, '1W') : null, 300000);
  const { data: pm } = usePolled(LIVE && BOTH ? API2.matches({ sort: 'activity', limit: 1 }) : null, 300000);
  const pair = pm && pm.pairs && pm.pairs[0] ? pm.pairs[0] : null;
  return { ov, hero, hist, pair };
}

function HeroChart({ hero, hist, height }) {
  const s = useMemo(() => buildSeries(hist), [hist]);
  const v = LIVE_VENUES[hero.venue];
  if (!hist || !s.points.some((p) => isNum(p.v))) return <Skeleton h={height} />;
  return (
    <PriceChart compact series={[{ id: 'a', label: `${v.name} Yes ${v.histSeries}`, points: s.points }]} from={hist.from} to={hist.to} height={height}
      gaps={s.gaps} yFormat={centsLabel} showEndLabels={false} summary="" />
  );
}

function HeroCard({ hero, hist, height, compact }) {
  if (!hero) return <div className="stack-sm"><Skeleton h={14} w="40%" /><Skeleton h={20} w="80%" /><Skeleton h={44} /><Skeleton h={height} /></div>;
  const v = LIVE_VENUES[hero.venue];
  return (
    <>
      <div className="pv-meta"><VenueBadge venue={hero.venue} /><span>{hero.category}{hero.multi && !compact ? ` / ${clip(hero.eventTitle, 60)}` : ''}</span>{compact && <span className="pv-watermark pv-live">Live data</span>}</div>
      <p className="pv-title">{rowName(hero)}</p>
      <div className="pv-quote">
        <div className="pv-big"><span className="mono">{fmtCentsAuto(hero.mid)}</span><span className="pv-big-label">Yes midpoint</span></div>
        <div className="pv-qcol"><span className="pv-q-k">24h</span><Delta value={hero.ch24} /></div>
        <div className="pv-qcol"><span className="pv-q-k">Bid / ask</span><span className="mono pv-q-v">{fmtCentsAuto(hero.bid)} / {fmtCentsAuto(hero.ask)}</span></div>
        {!compact && <div className="pv-qcol"><span className="pv-q-k">Volume 24h</span><span className="mono pv-q-v">{volText(hero)}</span></div>}
      </div>
      <HeroChart hero={hero} hist={hist} height={height} />
      <div className="pv-prov"><Icon n="database" size={12} />{v.name} · fetched {fmtTime(hero.observedAt)}{hist && hist.sampling ? ` · ${hist.sampling.toLowerCase()}, past week` : ''}</div>
    </>
  );
}

const heroLabel = (hero) => (hero
  ? `Preview of the Banthom terminal with live data: “${rowName(hero)}” on ${venueName(hero.venue)}, Yes midpoint ${fmtCentsAuto(hero.mid)}${isNum(hero.ch24) && hero.ch24 !== 0 ? `, ${hero.ch24 > 0 ? 'up' : 'down'} ${Math.abs(hero.ch24).toFixed(1)} percentage points in 24 hours` : ''}, with a one-week price chart.`
  : 'Preview of the Banthom terminal. Live prices load here.');

function HeroPreview({ ov, hero, hist, pair }) {
  const movers = ov ? ov.movers.slice(0, 4) : [];
  return (
    <Inert className="preview" label={`${heroLabel(hero)} Beside it, the markets with the largest 24-hour changes${BOTH ? ' and one question listed on both Kalshi and Polymarket' : ''}.`}>
      <div className="pv-window">
        <div className="pv-bar">
          <span className="pv-brand"><LogoMark size={16} />Banthom</span>
          <span className="pv-tabs"><span>Overview</span><span className="is-active">{hero ? clip(short(hero), 30) : 'Markets'}</span>{BOTH && <span>Compare</span>}</span>
          <span className="pv-watermark pv-live">{hero ? `Live data · ${fmtTime(hero.observedAt)}` : 'Live data'}</span>
        </div>
        <div className="pv-body">
          <div className="pv-rail">
            {['layout-dashboard', 'list-filter', 'git-compare-arrows', 'star', 'bell'].map((n, i) => (
              <span key={n} className={cx('pv-rail-icon', i === 1 && 'is-active')}><Icon n={n} size={16} /></span>
            ))}
          </div>
          <div className="pv-main">
            <div className="pv-card pv-chart-card"><HeroCard hero={hero} hist={hist} height={176} /></div>
          </div>
          <div className="pv-side">
            <div className="pv-card">
              <p className="pv-card-title">Largest changes · 24h</p>
              {movers.length ? movers.map((m) => (
                <div key={m.id} className="pv-mover">
                  <VenueBadge venue={m.venue} />
                  <span className="pv-mover-name">{short(m)}</span>
                  <span className="mono pv-mover-price">{fmtCentsAuto(m.mid)}</span>
                  <Delta value={m.ch24} />
                </div>
              )) : <div className="stack-sm">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={22} />)}</div>}
            </div>
            {BOTH && (
              <div className="pv-card">
                <p className="pv-card-title"><Icon n="git-compare-arrows" size={13} />Same question, two venues</p>
                {pair ? (
                  <>
                    <p className="pv-text">{clip(rowName(pair.k), 72)}</p>
                    <div className="pv-mover pv-pair"><VenueBadge venue="kalshi" /><span className="pv-mover-name">Kalshi</span><span className="mono pv-mover-price">{fmtCentsAuto(pair.k.mid)}</span></div>
                    <div className="pv-mover pv-pair"><VenueBadge venue="polymarket" /><span className="pv-mover-name">Polymarket</span><span className="mono pv-mover-price">{fmtCentsAuto(pair.p.mid)}</span></div>
                    <div className="pv-tags"><Badge tone="warning" size="sm" icon="circle-dashed">Suggested · unverified</Badge></div>
                  </>
                ) : <Skeleton h={84} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </Inert>
  );
}

function HeroPreviewMobile({ hero, hist }) {
  return (
    <Inert className="preview-m" label={heroLabel(hero)}>
      <div className="pv-card pv-chart-card"><HeroCard hero={hero} hist={hist} height={150} compact /></div>
    </Inert>
  );
}

// ---------------------------------------------------------------- Workflow closeups (live)
function SearchCloseup({ ov }) {
  const rows = ov ? ov.active.slice(0, 3) : [];
  return (
    <div className="closeup">
      <div className="cu-search"><Icon n="search" size={16} /><span className="muted">Search {ov ? `${fmtInt(ov.total)} open markets` : 'every open market'}…</span></div>
      <div className="cu-results">
        <p className="cu-group">Most active right now</p>
        {rows.length ? rows.map((r) => (
          <div className="cu-row" key={r.id}><VenueBadge venue={r.venue} /><span className="grow cu-ellipsis">{rowName(r)}</span><span className="mono cu-price">{fmtCentsAuto(r.mid)}</span></div>
        )) : <div className="stack-sm">{[0, 1, 2].map((i) => <Skeleton key={i} h={28} />)}</div>}
      </div>
    </div>
  );
}

function TermsCloseup({ hero }) {
  const { data } = usePolled(hero ? API2.market(hero.venue, hero.ticker) : null, 0);
  const m = data && data.market;
  const rules = m ? firstPara(hero.venue === 'kalshi' ? m.rulesPrimary : m.rules) : '';
  const spread = hero && isNum(hero.bid) && isNum(hero.ask) ? hero.ask - hero.bid : null;
  return (
    <div className="closeup">
      <div className="cu-strip">
        {[['Yes bid', hero && hero.bid], ['Yes ask', hero && hero.ask], ['Spread', spread], ['Last trade', hero && hero.last]].map(([k, v]) => (
          <div key={k}><span className="cu-k">{k}</span><span className="mono cu-v">{fmtCentsAuto(v)}</span></div>
        ))}
      </div>
      <div className="cu-rules">
        <p className="cu-rules-title"><Icon n="scroll-text" size={14} />{hero ? `Rules as published by ${venueName(hero.venue)}` : 'Rules as published by the venue'}</p>
        {m ? <p>{clip(rules, 240) || 'The venue hasn’t published rule text for this market.'}</p> : <Skeleton h={60} />}
        {m && <p className="cu-rules-meta">{venueName(hero.venue)} · {clip(rowName(hero), 60)}{isNum(m.observedAt) ? ` · fetched ${fmtTime(m.observedAt)}` : ''}</p>}
      </div>
    </div>
  );
}

function PairCloseup({ pair }) {
  if (!pair) return <div className="closeup"><Skeleton h={140} /></div>;
  return (
    <div className="closeup">
      <p className="cu-pair-q">{clip(rowName(pair.k), 90)}</p>
      <div className="cu-strip cu-strip-3">
        <div><span className="cu-k">Kalshi mid</span><span className="mono cu-v">{fmtCentsAuto(pair.k.mid)}</span></div>
        <div><span className="cu-k">Polymarket mid</span><span className="mono cu-v">{fmtCentsAuto(pair.p.mid)}</span></div>
        <div><span className="cu-k">Gap</span><span className="mono cu-v">{gapText(pair.gap)}</span></div>
      </div>
      <div className="cu-rules">
        <p className="cu-rules-meta">On Polymarket: “{clip(rowName(pair.p), 90)}”</p>
        <span><Badge tone="warning" size="sm" icon="circle-dashed">Suggested · unverified</Badge></span>
      </div>
    </div>
  );
}

function ScreenerCloseup({ ov }) {
  const rows = ov ? ov.movers.slice(0, 5) : [];
  return (
    <div className="closeup closeup-wide">
      <div className="cu-chips">
        <span className="chip is-on">Largest movers</span><span className="chip is-on">At least $1,000 traded in 24h</span><span className="chip">Kalshi and Polymarket</span>
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table className="table table-compact cu-table">
            <thead><tr><th>Market</th><th>Venue</th><th className="num">Yes bid</th><th className="num">Yes ask</th><th className="num">Spread</th><th className="num">24h</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cu-ellipsis cu-mkt">{short(r)}{r.multi && <span className="muted"> · {clip(r.eventTitle, 28)}</span>}</td>
                  <td><VenueBadge venue={r.venue} /></td>
                  <td className="num">{fmtCentsAuto(r.bid)}</td><td className="num">{fmtCentsAuto(r.ask)}</td>
                  <td className="num">{isNum(r.bid) && isNum(r.ask) ? fmtCentsAuto(r.ask - r.bid) : '—'}</td>
                  <td className="num"><Delta value={r.ch24} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Skeleton h={180} />}
    </div>
  );
}

function OutcomeCloseup({ ov }) {
  const pick = ov ? ov.active.find((r) => r.multi && r.exclusive) || ov.active.find((r) => r.multi) : null;
  const { data } = usePolled(pick ? API2.event(pick.venue, pick.event) : null, 0);
  const rows = data ? data.markets.filter((r) => isNum(r.mid)).slice(0, 5) : [];
  return (
    <div className="closeup closeup-wide">
      {data && rows.length ? (
        <>
          <p className="cu-chart-title">{data.event.title} · {venueName(pick.venue)} Yes midpoints</p>
          <ul className="cu-bars">
            {rows.map((r) => (
              <li key={r.id}>
                <span className="cu-bar-label">{r.label}</span>
                <span className="cu-bar-track"><span className="cu-bar-fill" style={{ width: `${Math.max(1, Math.min(100, r.mid))}%` }} /></span>
                <span className="mono cu-bar-v">{fmtCentsAuto(r.mid)}</span>
              </li>
            ))}
          </ul>
          <p className="cu-note">Each outcome is its own market with its own bid and ask{data.markets.length > rows.length ? `; ${fmtInt(data.markets.length - rows.length)} more outcomes on the event page` : ''}.</p>
        </>
      ) : <Skeleton h={200} />}
    </div>
  );
}

// ---------------------------------------------------------------- Sections
function SectionHead({ eyebrow, title, lead, center, id }) {
  return (
    <div className={cx('sec-head', center && 'is-center')}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mkt-h2" id={id}>{title}</h2>
      {lead && <p className="sec-lead">{lead}</p>}
    </div>
  );
}

function CompareModule({ pair }) {
  const { data } = usePolled(pair ? API2.match(pair.id) : null, 0);
  const sameDay = pair && isNum(pair.k.closes) && isNum(pair.p.closes) && fmtDateShort(pair.k.closes) === fmtDateShort(pair.p.closes);
  const card = (r, d) => {
    const m = d && d.market;
    return (
      <div className="venue-card">
        <div className="row-between"><VenueBadge venue={r.venue} full /><span className="pv-watermark pv-live">Live</span></div>
        <p className="venue-card-title">“{clip(rowName(r), 110)}”</p>
        <div className="venue-quotes">
          <div><span className="cu-k">Yes bid</span><span className="mono cu-v">{fmtCentsAuto(r.bid)}</span>{m && isNum(m.bidSize) && isNum(r.bid) && <span className="muted small">{fmtInt(m.bidSize)} available</span>}</div>
          <div><span className="cu-k">Yes ask</span><span className="mono cu-v">{fmtCentsAuto(r.ask)}</span>{m && isNum(m.askSize) && isNum(r.ask) && <span className="muted small">{fmtInt(m.askSize)} available</span>}</div>
        </div>
        <p className="venue-card-foot">Settles {r.venue === 'kalshi' ? '$1.00 per contract' : '$1.00 USDC per share'} · closes {fmtDateShort(r.closes)}</p>
      </div>
    );
  };
  return (
    <section className="mkt-sec" aria-labelledby="compare-title">
      <div className="container split-60">
        <div className="split-text">
          <SectionHead id="compare-title" eyebrow="Cross-venue comparison" title="Compare venues without assuming the contracts match."
            lead="Banthom suggests where Kalshi and Polymarket list the same question, by lining up titles, numbers, outcome names and closing dates. It then puts both venues’ rules side by side, because similar titles can settle differently." />
          <ul className="check-list">
            <li><Icon n="circle-dashed" size={18} />Every pair is labelled suggested and unverified.</li>
            <li><Icon n="scroll-text" size={18} />Both venues’ rules, quoted in full on the comparison page.</li>
            <li><Icon n="calculator" size={18} />Price gaps are shown before fees. Read the rules before relying on one.</li>
          </ul>
          {pair && <Button variant="secondary" href={compareHref(pair.id)} iconRight="arrow-right">Open this comparison</Button>}
        </div>
        <Inert className="compare-visual" label={pair ? `Live example: “${rowName(pair.k)}” on Kalshi at ${fmtCentsAuto(pair.k.mid)} and “${rowName(pair.p)}” on Polymarket at ${fmtCentsAuto(pair.p.mid)}, suggested as the same question and not verified.` : 'Example comparison loading.'}>
          {pair ? (
            <>
              <div className="venue-pair">
                {card(pair.k, data && data.kalshi)}
                <div className="pair-link"><span className="pair-line" /><Badge tone="warning" size="sm" icon="circle-dashed">Suggested</Badge><span className="muted small">Title match {Math.round(pair.score * 100)}%</span><span className="pair-line" /></div>
                {card(pair.p, data && data.polymarket)}
              </div>
              <div className="term-diff">
                {[
                  ['Gap', `${gapText(pair.gap)} (Kalshi minus Polymarket mid)`, 'Before fees', 'muted', 'info'],
                  ['Closes', sameDay ? 'Same day on both venues' : `${fmtDateShort(pair.k.closes)} vs ${fmtDateShort(pair.p.closes)}`, sameDay ? 'Same' : 'Differs', sameDay ? 'muted' : 'warning', sameDay ? 'check' : 'triangle-alert'],
                  ['Settlement', 'US dollars vs USDC', 'Differs', 'warning', 'triangle-alert'],
                  ['Rules', 'Written separately by each venue', 'Check both', 'warning', 'scroll-text'],
                ].map(([k, v, b, tone, icon]) => (
                  <div key={k} className={cx('term-row', tone === 'warning' && 'is-diff')}>
                    <span className="term-k">{k}</span><span className="term-v">{v}</span><Badge tone={tone} size="sm" icon={icon}>{b}</Badge>
                  </div>
                ))}
                <p className="term-foot"><Icon n="triangle-alert" size={14} />Quotes can differ because the contracts settle differently. Review both rule sets before comparing prices.</p>
              </div>
            </>
          ) : <Skeleton h={320} />}
        </Inert>
      </div>
    </section>
  );
}

const FAQ = [
  ['What is a prediction market?', 'A market where contracts pay out if an event happens, usually $1 per contract. The price is commonly read as a market-implied chance of the event. It reflects supply and demand on one venue at one time, not a guarantee.'],
  ['Where does the data come from?', 'From Kalshi’s and Polymarket’s public market data. Banthom refreshes every open market every few minutes and fetches a market’s quote, order book and price history when you open it. Every price shows its venue and when it was fetched.'],
  ['Is Banthom an exchange or a broker?', 'No. Banthom is a research tool. It doesn’t take orders, hold funds, store exchange credentials or route trades. Links open the market on the venue.'],
  ['Are the same questions on Kalshi and Polymarket the same contract?', 'Not always. Similar questions can settle on different sources, deadlines or edge cases. Banthom suggests pairs that look alike and labels them unverified; read both venues’ rules before comparing prices.'],
  ['Are the odds guaranteed?', 'No. A price is a market-implied proxy. It can be stale or thin, it can differ by venue, and an apparent edge can disappear after fees, slippage, order depth and execution timing.'],
  ['Do I need an account?', 'No. Banthom is free while in preview and has no sign-in yet. Watchlists and alerts are saved in your browser, and alerts only run while Banthom is open.'],
];

export function Home() {
  const isMobile = useMedia('(max-width: 767px)');
  const [tab, setTab] = useState('traders');
  const { ov, hero, hist, pair } = useHomeData();
  const steps = [
    ['Find a market', 'Search every open market on both venues. Results show the venue and the current Yes price.', <SearchCloseup key="a" ov={ov} />],
    ['Check the terms and the price', 'Read the venue’s own rules beside the bid, ask and spread, with the time each was fetched.', <TermsCloseup key="b" hero={hero} />],
    ...(BOTH ? [['Compare across venues', 'See where Kalshi and Polymarket list the same question, and how far apart their prices are.', <PairCloseup key="c" pair={pair} />]] : []),
  ];
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-glow" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Live data from {LIVE_LIST.length ? LIVE_LIST.map((v) => v.name).join(' and ') : 'Kalshi and Polymarket'}</p>
            <h1 className="mkt-h1" id="hero-title" tabIndex={-1} data-route-focus>
              <span>See the probability.</span> <span>Understand the market.</span>
            </h1>
            <p className="hero-sub">Research every open market on Kalshi and Polymarket, read each venue’s rules beside the price, and compare the same question across both, in one workspace.</p>
            <div className="hero-ctas">
              <Button variant="primary" size="lg" href="#app-dashboard" iconRight="arrow-right">Open the terminal</Button>
              <Button variant="secondary" size="lg" href="#how-it-works" onClick={(e) => { e.preventDefault(); const el = document.getElementById('how-it-works'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.focus({ preventScroll: true }); } }}>See how it works</Button>
            </div>
            <p className="hero-foot"><Icon n="shield-check" size={16} />Real market data. No account needed. Research only: no trading or deposits.</p>
          </div>
          <div className="hero-visual">
            {isMobile ? <HeroPreviewMobile hero={hero} hist={hist} /> : <HeroPreview ov={ov} hero={hero} hist={hist} pair={pair} />}
            {!LIVE && <p className="muted small hero-offline">Live prices appear here when Banthom runs with its data server.</p>}
          </div>
        </div>
      </section>

      <section className="coverage" aria-label="What Banthom covers">
        <div className="container coverage-grid">
          {[
            ['list-filter', 'Every open market', ov ? `${fmtInt(ov.total)} markets from Kalshi and Polymarket, refreshed every few minutes.` : 'Every open Kalshi and Polymarket market, refreshed every few minutes.'],
            ['activity', 'Quotes', 'Bid, ask, last and spread, each with its venue and the time it was fetched.'],
            ['git-compare-arrows', 'Compare', 'The same question on both venues, side by side, with the price gap.'],
            ['bell', 'Watchlists and alerts', 'Saved in your browser. Alerts on the thresholds you set.'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="coverage-item">
              <Icon n={icon} size={22} />
              <div><p className="coverage-title">{title}</p><p className="coverage-desc">{desc}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mkt-sec" id="how-it-works" tabIndex={-1} aria-labelledby="flow-title">
        <div className="container">
          <SectionHead id="flow-title" eyebrow="From question to context" title="From a headline to the market behind it."
            lead="Start with a question or a market. Banthom keeps the venue’s rules, the quote and the other venue’s price next to each other. Every example below is live." />
          <ol className="flow">
            {steps.map(([title, text, visual], i) => (
              <li key={title} className="flow-step">
                <div className="flow-text">
                  <span className="flow-num mono" aria-hidden="true">{i + 1}</span>
                  <h3 className="mkt-h3-sm">{title}</h3>
                  <p>{text}</p>
                </div>
                <Inert className="flow-visual" label={`Live example for step ${i + 1}: ${title}.`}>{visual}</Inert>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mkt-sec sec-split" aria-labelledby="workflows-title">
        <div className="container">
          <div className="row-between sec-head-row">
            <SectionHead id="workflows-title" eyebrow="Two workflows, one data model" title="Built for the trading desk and the research desk." />
            <Tabs idBase="wf" label="Workflow" value={tab} onChange={setTab} tabs={[{ id: 'traders', label: 'Traders', icon: 'activity' }, { id: 'researchers', label: 'Researchers', icon: 'microscope' }]} className="wf-tabs" />
          </div>
          <TabPanel idBase="wf" id="traders" value={tab} className="wf-panel">
            <Inert className="wf-visual" label="Live example: markets with the largest 24-hour price changes, with bid, ask, spread and change."><ScreenerCloseup ov={ov} /></Inert>
            <div className="wf-text">
              <h3 className="mkt-h3">Screen faster. Check the contract. See the spread.</h3>
              <ul className="check-list">
                <li><Icon n="list-filter" size={18} />Filter by venue, category and closing date; sort by volume, price or 24-hour move.</li>
                <li><Icon n="layers" size={18} />Bid and ask from each venue, with the order book one click away.</li>
                {BOTH && <li><Icon n="git-compare-arrows" size={18} />Suggested matches on the other venue, side by side.</li>}
                <li><Icon n="bell" size={18} />Alerts that only fire on current quotes.</li>
              </ul>
              <Button variant="secondary" href="#app-markets" iconRight="arrow-right">Open the market explorer</Button>
            </div>
          </TabPanel>
          <TabPanel idBase="wf" id="researchers" value={tab} className="wf-panel">
            <Inert className="wf-visual" label="Live example: the leading outcomes of one event, with each outcome’s Yes midpoint."><OutcomeCloseup ov={ov} /></Inert>
            <div className="wf-text">
              <h3 className="mkt-h3">Turn market prices into research-ready context.</h3>
              <ul className="check-list">
                <li><Icon n="chart-line" size={18} />Price history from each venue, with gaps shown, never smoothed over.</li>
                <li><Icon n="split" size={18} />Every outcome of an event side by side.</li>
                <li><Icon n="scroll-text" size={18} />The venue’s rules and settlement sources, quoted in full.</li>
                <li><Icon n="clock" size={18} />The fetch time on every quote, so you know how current it is.</li>
              </ul>
              <Button variant="secondary" href="#app-markets" iconRight="arrow-right">Browse markets</Button>
            </div>
          </TabPanel>
        </div>
      </section>

      {BOTH && <CompareModule pair={pair} />}

      <section className="mkt-sec" aria-labelledby="plans-title">
        <div className="container">
          <SectionHead id="plans-title" eyebrow="Plans" title="Free while in preview." lead="Everything on this page works today without an account. Paid plans are planned; their prices below are placeholders." />
          <div className="plan-teaser">
            {[
              ['Preview', '$0', 'Available now, no account', ['Every open Kalshi and Polymarket market', 'Market pages with order books and history', 'Suggested cross-venue pairs', 'Watchlists and alerts saved in your browser'], 'Open the terminal', '#app-dashboard', 'primary'],
              ['Pro', '$99', 'Planned, for daily research and trading prep', ['Accounts with watchlists on every device', 'Email alerts that run while you’re away', 'Full price history and exports where licensed', 'Saved views and workspaces'], 'Compare plans', '#pricing', 'secondary'],
            ].map(([name, price, who, feats, cta, href, variant]) => (
              <div key={name} className={cx('plan-card', variant === 'primary' && 'is-featured')}>
                <div className="plan-head"><h3 className="plan-name">{name}</h3><p className="muted">{who}</p></div>
                <p className="plan-price"><span className="mono">{price}</span><span className="muted">/month</span></p>
                <ul className="plan-feats">{feats.map((f) => <li key={f}><Icon n="check" size={16} />{f}</li>)}</ul>
                <Button variant={variant} href={href} block>{cta}</Button>
              </div>
            ))}
          </div>
          <p className="plan-note"><Icon n="info" size={16} />Paid plan prices are placeholders from the design brief, not final. <a href="#pricing">Compare all plans</a></p>
        </div>
      </section>

      <section className="mkt-sec" aria-labelledby="faq-title">
        <div className="container faq-grid">
          <SectionHead id="faq-title" eyebrow="Questions" title="Before you start" lead="Plain answers about what Banthom is and isn’t." />
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q} className="faq-item">
                <summary><span>{q}</span><Icon n="plus" size={18} /></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="closing" aria-labelledby="closing-title">
        <div className="container closing-inner">
          <h2 className="mkt-h2" id="closing-title">Make your next market decision better informed.</h2>
          <div className="row">
            <Button variant="primary" size="lg" href="#app-dashboard">Open the terminal</Button>
            <Button variant="ghost" size="lg" href="#methodology">How the data works</Button>
          </div>
        </div>
      </section>
    </>
  );
}
