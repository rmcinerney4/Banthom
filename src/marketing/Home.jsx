import React from 'react';
import { Icon, LogoMark, Button, Badge, VenueBadge, Delta, TrustTag, AiTag, MatchBadge, Tabs, TabPanel } from '../ui/core.jsx';
import { PriceChart, SERIES_STYLE } from '../charts/charts.jsx';
import { MARKET_BY_ID, TIMELINE, MATCH_BY_ID, VENUES } from '../data/fixtures.js';
import { seriesFor, markersFor } from '../data/series.js';
import { fmtCents, fmtTime, fmtDateShort, fmtDateTimeShort, fmtInt, cx } from '../lib/format.js';
import { useMedia } from '../lib/hooks.js';
import { SNAPSHOT } from '../lib/time.js';

const { useMemo, useRef, useEffect, useState } = React;

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

const FED = 'fed-dec26-cut-ard';
const centsLabel = (v, tick) => (tick ? `${Math.round(v)}¢` : fmtCents(v, 1));

// ---------------------------------------------------------------- Hero preview (fictional UI, simulated data)
function HeroPreview() {
  const mk = MARKET_BY_ID[FED];
  const s = useMemo(() => seriesFor(FED, '1W'), []);
  const markers = useMemo(() => markersFor(mk, s.from, s.to).filter((m) => m.move), [mk, s]);
  const movers = ['fed-dec26-cut-ard', 'shutdown-jan27-ard', 'cpi-oct26-yoy-ard', 'unrate-nov26-ard'].map((id) => MARKET_BY_ID[id]);
  return (
    <Inert className="preview" label="Illustrative preview of the Banthom terminal using simulated data: a December Fed rate-cut contract at 63 cents, up 4.6 percentage points in 24 hours, with a one-week price chart, a list of the largest changes and a sourced summary of what changed.">
      <div className="pv-window">
        <div className="pv-bar">
          <span className="pv-brand"><LogoMark size={16} />Banthom</span>
          <span className="pv-tabs"><span>Overview</span><span className="is-active">Fed · Dec 2026</span><span>Compare</span></span>
          <span className="pv-watermark">Illustrative data</span>
        </div>
        <div className="pv-body">
          <div className="pv-rail">
            {['layout-dashboard', 'list-filter', 'git-compare-arrows', 'newspaper', 'bell'].map((n, i) => (
              <span key={n} className={cx('pv-rail-icon', i === 1 && 'is-active')}><Icon n={n} size={16} /></span>
            ))}
          </div>
          <div className="pv-main">
            <div className="pv-card pv-chart-card">
              <div className="pv-meta"><VenueBadge venue="ARD" /><span>Economics / Fed decision: December 2026</span></div>
              <p className="pv-title">{mk.title}</p>
              <div className="pv-quote">
                <div className="pv-big"><span className="mono">63.0¢</span><span className="pv-big-label">Yes midpoint</span></div>
                <div className="pv-qcol"><span className="pv-q-k">24h</span><Delta value={4.6} /></div>
                <div className="pv-qcol"><span className="pv-q-k">Bid / ask</span><span className="mono pv-q-v">62¢ / 64¢</span></div>
                <div className="pv-qcol"><span className="pv-q-k">Implied chance</span><span className="mono pv-q-v">63% <span className="pv-ind">indicative</span></span></div>
              </div>
              <PriceChart compact series={[{ id: 'a', label: 'Arden Yes mid', points: s.points }]} from={s.from} to={s.to} height={176}
                markers={markers} gaps={[]} yFormat={centsLabel} showEndLabels={false} summary="" />
              <div className="pv-prov"><Icon n="database" size={12} />Arden · observed 2:14 PM ET · 30-minute midpoints · 3 marked catalysts</div>
            </div>
          </div>
          <div className="pv-side">
            <div className="pv-card">
              <p className="pv-card-title">Largest changes · 24h</p>
              {movers.map((m) => (
                <div key={m.id} className="pv-mover">
                  <VenueBadge venue={m.venue} />
                  <span className="pv-mover-name">{m.outcome}</span>
                  <span className="mono pv-mover-price">{fmtCents((m.bid + m.ask) / 2, 1)}</span>
                  <Delta value={m.ch24} />
                </div>
              ))}
            </div>
            <div className="pv-card">
              <p className="pv-card-title"><Icon n="sparkles" size={13} />What changed</p>
              <p className="pv-text">Cut pricing rose 2.4 pp in the hour after the 8:30 AM claims release.</p>
              <div className="pv-pills"><span className="src-pill">Ledger Daily · 8:41 AM</span><span className="src-pill">Price history</span></div>
              <div className="pv-tags"><TrustTag tag="observed" /><TrustTag tag="inferred" /></div>
            </div>
          </div>
        </div>
      </div>
    </Inert>
  );
}

function HeroPreviewMobile() {
  const mk = MARKET_BY_ID[FED];
  const s = useMemo(() => seriesFor(FED, '1W'), []);
  return (
    <Inert className="preview-m" label="Illustrative preview using simulated data: a December Fed rate-cut contract at 63 cents, up 4.6 percentage points in 24 hours.">
      <div className="pv-card pv-chart-card">
        <div className="pv-meta"><VenueBadge venue="ARD" /><span>Fed decision: Dec 2026</span><span className="pv-watermark">Illustrative data</span></div>
        <p className="pv-title">{mk.title}</p>
        <div className="pv-quote">
          <div className="pv-big"><span className="mono">63.0¢</span><span className="pv-big-label">Yes midpoint</span></div>
          <div className="pv-qcol"><span className="pv-q-k">24h</span><Delta value={4.6} /></div>
          <div className="pv-qcol"><span className="pv-q-k">Bid / ask</span><span className="mono pv-q-v">62¢ / 64¢</span></div>
        </div>
        <PriceChart compact series={[{ id: 'a', label: 'Arden Yes mid', points: s.points }]} from={s.from} to={s.to} height={150} yFormat={centsLabel} showEndLabels={false} summary="" />
        <div className="pv-prov"><Icon n="database" size={12} />Arden · observed 2:14 PM ET</div>
      </div>
    </Inert>
  );
}

// ---------------------------------------------------------------- Workflow closeups
function SearchCloseup() {
  const rows = [['ARD', 'Fed cuts at its December 2026 meeting', '63.0¢'], ['BRS', 'Fed rate cut in December 2026?', '61.5¢'], ['ARD', 'Fed holds at its December 2026 meeting', '36.0¢']];
  return (
    <div className="closeup">
      <div className="cu-search"><Icon n="search" size={16} /><span className="cu-typed">fed december</span><span className="cu-caret" /></div>
      <div className="cu-results">
        <p className="cu-group">Events</p>
        <div className="cu-row"><Icon n="calendar" size={14} /><span className="grow">Fed decision: December 2026 meeting</span><span className="muted small">5 markets</span></div>
        <p className="cu-group">Contracts</p>
        {rows.map(([v, t, p]) => (
          <div className="cu-row" key={t}><VenueBadge venue={v} /><span className="grow cu-ellipsis">{t}</span><span className="mono cu-price">{p}</span></div>
        ))}
      </div>
    </div>
  );
}
function TermsCloseup() {
  return (
    <div className="closeup">
      <div className="cu-strip">
        {[['Yes bid', '62¢'], ['Yes ask', '64¢'], ['Spread', '2¢'], ['Last trade', '63¢']].map(([k, v]) => (
          <div key={k}><span className="cu-k">{k}</span><span className="mono cu-v">{v}</span></div>
        ))}
      </div>
      <div className="cu-rules">
        <p className="cu-rules-title"><Icon n="scroll-text" size={14} />About this contract</p>
        <p>Resolves “Yes” if the FOMC announces a reduction to the target range in the statement issued after its December 8–9 meeting.</p>
        <p className="cu-rules-meta">Source: Fed press release · Rules updated Oct 14 · Observed 2:14 PM ET</p>
      </div>
    </div>
  );
}
function CatalystCloseup() {
  const items = TIMELINE.filter((t) => t.eventId === 'fomc-dec-2026' && t.move).slice(-3);
  return (
    <div className="closeup">
      <ol className="cu-timeline">
        {items.map((t) => (
          <li key={t.id}>
            <span className="cu-time mono">{fmtDateShort(t.t)}, {fmtTime(t.t).replace(' ET', '')}</span>
            <span className="cu-tl-title">{t.title}</span>
            <span className="row"><Delta value={t.move.pp} /><span className="muted small">in {t.move.window}</span><TrustTag tag={t.link} /></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ScreenerCloseup() {
  const ids = ['fed-dec26-cut-ard', 'fed-dec26-cut-brs', 'unrate-nov26-ard', 'gdp-q4-26-ard', 'shutdown-jan27-ard'];
  return (
    <div className="closeup closeup-wide">
      <div className="cu-chips">
        <span className="chip is-on">Economics</span><span className="chip is-on">Resolves within 90 days</span><span className="chip is-on">Spread ≤ 3¢</span><span className="chip"><Icon n="badge-check" size={13} />Verified comparisons only</span>
      </div>
      <div className="table-scroll">
        <table className="table table-compact cu-table">
          <thead><tr><th>Market</th><th>Venue</th><th className="num">Yes bid</th><th className="num">Yes ask</th><th className="num">Spread</th><th className="num">Size at ask</th><th className="num">24h</th></tr></thead>
          <tbody>
            {ids.map((id) => {
              const m = MARKET_BY_ID[id];
              return (
                <tr key={id}>
                  <td className="cu-ellipsis cu-mkt">{m.outcome} <span className="muted">· {m.eventId.includes('fomc') ? 'Fed Dec' : m.eventId.includes('jobs') ? 'Nov jobs' : m.eventId.includes('gdp') ? 'Q4 GDP' : 'Funding'}</span></td>
                  <td><VenueBadge venue={m.venue} /></td>
                  <td className="num">{fmtCents(m.bid)}</td><td className="num">{fmtCents(m.ask)}</td><td className="num">{fmtCents(m.ask - m.bid)}</td>
                  <td className="num">{fmtInt(m.askSize)}</td><td className="num"><Delta value={m.ch24} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OutcomeCloseup() {
  const ids = ['fed-dec26-cut-ard', 'fed-dec26-hold-ard', 'fed-dec26-hike-ard'];
  const labels = ['Cut', 'Hold', 'Hike'];
  const data = useMemo(() => ids.map((id, i) => ({ id, label: labels[i], ...SERIES_STYLE[i], points: seriesFor(id, '1M').points })), []);
  const s = useMemo(() => seriesFor(ids[0], '1M'), []);
  return (
    <div className="closeup closeup-wide closeup-chart">
      <p className="cu-chart-title">Fed decision, December 2026 · Arden Yes midpoints · 1 month</p>
      <PriceChart series={data} from={s.from} to={s.to} height={230} yFormat={centsLabel} fullScale summary="Cut rose from the mid-40s to 63 cents over the month while hold fell to 36 cents; hike stayed near 2 cents." />
      <p className="cu-note">Mutually exclusive outcomes are shown side by side and never added together.</p>
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

function EventEngine() {
  const mk = MARKET_BY_ID[FED];
  const s = useMemo(() => seriesFor(FED, '1W'), []);
  const markers = useMemo(() => markersFor(mk, s.from, s.to), [mk, s]);
  return (
    <section className="mkt-sec sec-engine" aria-labelledby="engine-title">
      <div className="container">
        <SectionHead id="engine-title" eyebrow="Event intelligence" title="See what moved the odds, and how sure anyone can be."
          lead="Banthom lines up dated announcements, headlines and quote movements on one timeline, then labels each link as observed, inferred or unknown." />
        <div className="engine-board">
          <div className="engine-chart">
            <div className="engine-chart-head">
              <div>
                <p className="label">Fed decision: December 2026 · Cut (any size)</p>
                <p className="engine-price"><span className="mono">63.0¢</span><Delta value={7.5} /><span className="muted small">past 7 days</span></p>
              </div>
              <span className="pv-watermark">Illustrative data</span>
            </div>
            <PriceChart series={[{ id: 'a', label: 'Arden Yes midpoint', points: s.points }]} from={s.from} to={s.to} height={260}
              markers={markers} gaps={[]} yFormat={centsLabel} sampling="30-minute last observation" source="Arden (fictional)"
              summary="Over the past week the Arden December cut contract rose from 55.5 cents to 63 cents. Numbered markers show five timeline entries." />
          </div>
          <ol className="engine-list">
            {markers.map((t, i) => (
              <li key={t.id} className="engine-item">
                <span className="engine-num" aria-hidden="true">{i + 1}</span>
                <div className="engine-body">
                  <p className="engine-when"><span className="mono">{fmtDateTimeShort(t.t)}</span><Badge tone="muted" size="sm">{t.kind}</Badge></p>
                  <p className="engine-title">{t.title}</p>
                  <p className="row">
                    {t.move ? <><Delta value={t.move.pp} /><span className="muted small">in {t.move.window}</span></> : <span className="muted small">No price observations</span>}
                    <TrustTag tag={t.link} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="engine-note"><Icon n="info" size={16} />Markers show timing, not cause. A move that follows a headline is labelled inferred unless a source establishes the link.</p>
      </div>
    </section>
  );
}

function CompareModule() {
  const match = MATCH_BY_ID['fed-dec-cut'];
  const a = MARKET_BY_ID[match.a];
  const b = MARKET_BY_ID[match.b];
  const card = (m) => (
    <div className="venue-card">
      <div className="row-between"><VenueBadge venue={m.venue} full /><span className="pv-watermark">Fictional venue</span></div>
      <p className="venue-card-title">“{m.sourceTitle}”</p>
      <div className="venue-quotes">
        <div><span className="cu-k">Yes bid</span><span className="mono cu-v">{fmtCents(m.bid)}</span><span className="muted small">{fmtInt(m.bidSize)} available</span></div>
        <div><span className="cu-k">Yes ask</span><span className="mono cu-v">{fmtCents(m.ask)}</span><span className="muted small">{fmtInt(m.askSize)} available</span></div>
      </div>
      <p className="venue-card-foot">Settles {VENUES[m.venue].currency === 'USD' ? '$1.00 per contract' : '1.00 USDC per share'} · {VENUES[m.venue].feeLabel.replace(' (simulated)', '')}</p>
    </div>
  );
  return (
    <section className="mkt-sec" aria-labelledby="compare-title">
      <div className="container split-60">
        <div className="split-text">
          <SectionHead id="compare-title" eyebrow="Cross-venue comparison" title="Compare venues without assuming the contracts match."
            lead="Similar titles can settle on different rules. Banthom reviews the terms clause by clause before it shows a price difference, and nets out fees before it calls anything a spread." />
          <ul className="check-list">
            <li><Icon n="badge-check" size={18} />Verified, candidate and not-equivalent pairs are labelled separately.</li>
            <li><Icon n="calculator" size={18} />Fees, available size and settlement currency are part of every estimate.</li>
            <li><Icon n="ban" size={18} />Unverified pairs are never ranked as opportunities.</li>
          </ul>
          <Button variant="secondary" href="#app-compare-fed-dec-cut" iconRight="arrow-right">Open this comparison in the demo</Button>
        </div>
        <Inert className="compare-visual" label="Illustration: two fictional venues quote the December Fed cut contract. Arden shows 62 cents bid and 64 cents ask; Brisa shows 60 cents bid and 63 cents ask. The rule match is reviewed and verified, with differences in trading cutoff and settlement currency.">
          <div className="venue-pair">
            {card(a)}
            <div className="pair-link"><span className="pair-line" /><MatchBadge status="verified" /><span className="muted small">Reviewed {fmtDateShort(match.reviewedAt)}</span><span className="pair-line" /></div>
            {card(b)}
          </div>
          <div className="term-diff">
            {match.terms.slice(0, 2).concat(match.terms.slice(5)).map(([k, va, vb, st]) => (
              <div key={k} className={cx('term-row', st === 'differs' && 'is-diff')}>
                <span className="term-k">{k}</span>
                <span className="term-v">{st === 'same' ? 'Same on both venues' : `${va} vs ${vb}`}</span>
                <Badge tone={st === 'same' ? 'muted' : 'warning'} size="sm" icon={st === 'same' ? 'check' : 'triangle-alert'}>{st === 'same' ? 'Same' : 'Differs'}</Badge>
              </div>
            ))}
            <p className="term-foot"><Icon n="triangle-alert" size={14} />Quotes can differ in settlement criteria. Review the rules before comparing prices.</p>
          </div>
        </Inert>
      </div>
    </section>
  );
}

function ResearchDemo() {
  return (
    <section className="mkt-sec sec-research" aria-labelledby="research-title">
      <div className="container split-60 is-reversed">
        <div className="split-text">
          <SectionHead id="research-title" eyebrow="Research assistant" title="Answers that show their sources."
            lead="Ask what changed and get an outline built from cited sources and price history. Every line says whether it is observed, inferred or unknown, and when the sources were last checked." />
          <ul className="check-list">
            <li><Icon n="quote" size={18} />Timestamped citations on every claim.</li>
            <li><Icon n="history" size={18} />Versioned summaries with visible corrections.</li>
            <li><Icon n="shield-alert" size={18} />When sources can’t be verified, it says so instead of guessing.</li>
          </ul>
        </div>
        <Inert className="ra-visual" label="Illustration: a user asks why December cut odds rose this week. An AI-generated outline answers with three labelled findings and source pills, reviewed as of Nov 6, 2026, 1:15 PM ET.">
          <div className="ra-question"><span className="ra-avatar"><Icon n="user" size={14} /></span>Why did December cut odds rise this week?</div>
          <div className="ra-answer">
            <div className="row-between"><AiTag>AI-generated synthesis</AiTag><span className="muted small">Sources reviewed as of Nov 6, 2026, 1:15 PM ET</span></div>
            <ul className="ra-points">
              <li><TrustTag tag="observed" /><span>Arden’s Yes midpoint rose 7.5 pp over seven days, from 55.5¢ to 63.0¢.</span></li>
              <li><TrustTag tag="inferred" /><span>Moves after the services survey and claims release are consistent with softer data.</span><span className="src-pill">Ledger Daily · Nov 6</span><span className="src-pill">Northbridge Wire · Nov 5</span></li>
              <li><TrustTag tag="unknown" /><span>About 4 pp happened outside any window with a verified headline.</span></li>
            </ul>
            <p className="ra-foot">Headlines and outlets in this demo are fictional.</p>
          </div>
        </Inert>
      </div>
    </section>
  );
}

const FAQ = [
  ['What is a prediction market?', 'A market where contracts pay out if an event happens, often $1 per contract. The price people pay is commonly read as a market-implied chance of the event. It reflects supply and demand on one venue at one time, not a guarantee.'],
  ['Is Banthom an exchange or a broker?', 'No. Banthom is a research and analytics product. It does not take orders, hold funds, store exchange credentials or route trades. Where permitted, links open the original venue.'],
  ['Where does the data come from?', 'Only from venues and publishers whose terms allow it to be displayed. Every quote shows its venue, the time it was observed and whether it is current. This prototype uses simulated data from fictional venues.'],
  ['Are the odds guaranteed?', 'No. A price is a market-implied proxy. It can be stale or thin, it can differ by venue, and an apparent edge can disappear after fees, slippage, order depth and execution timing.'],
  ['Can I export data?', 'Where a source’s redistribution terms allow it, paid plans can export price histories with timestamps and the methodology version. Where they don’t, export is switched off and the reason is shown.'],
  ['What is free?', 'The market explorer, contract rules, one watchlist and recent price history. Limits are shown before checkout and depend on the data licences in place.'],
];

export function Home() {
  const isMobile = useMedia('(max-width: 767px)');
  const [tab, setTab] = useState('traders');
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-glow" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">The intelligence layer for prediction markets</p>
            <h1 className="mkt-h1" id="hero-title" tabIndex={-1} data-route-focus>
              <span>See the probability.</span> <span>Understand the event.</span>
            </h1>
            <p className="hero-sub">Research markets across venues, compare contract terms, and follow the signals moving the odds, all in one professional workspace.</p>
            <div className="hero-ctas">
              <Button variant="primary" size="lg" href="#app-dashboard" iconRight="arrow-right">Explore the terminal</Button>
              <Button variant="secondary" size="lg" href="#how-it-works" onClick={(e) => { e.preventDefault(); const el = document.getElementById('how-it-works'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.focus({ preventScroll: true }); } }}>See how it works</Button>
            </div>
            <p className="hero-foot"><Icon n="shield-check" size={16} />Read-only sample. No account needed. Research only: no trading or deposits.</p>
          </div>
          <div className="hero-visual">{isMobile ? <HeroPreviewMobile /> : <HeroPreview />}</div>
        </div>
      </section>

      <section className="coverage" aria-label="What Banthom covers">
        <div className="container coverage-grid">
          {[
            ['list-filter', 'Markets', 'Economics, politics and geopolitics contracts in one screener.'],
            ['activity', 'Quotes', 'Bid, ask, last and spread, each with its venue and observed time.'],
            ['newspaper', 'Event research', 'Sourced timelines and cited summaries for every event.'],
            ['bell', 'Watchlists', 'Saved markets and alerts on the thresholds you set.'],
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
          <SectionHead id="flow-title" eyebrow="From question to context" title="Three steps from a headline to a defensible view."
            lead="Start with a question or a market. Banthom keeps the contract terms, the quote and the evidence next to each other." />
          <ol className="flow">
            {[
              ['Find a market', 'Search events, contracts and venues together. Results show the venue and the current Yes price.', <SearchCloseup key="a" />],
              ['Verify terms and pricing', 'Read the exact settlement language beside the bid, ask and spread, with the time each was observed.', <TermsCloseup key="b" />],
              ['Analyze catalysts', 'Follow the dated releases and headlines around each move, with the evidence labelled.', <CatalystCloseup key="c" />],
            ].map(([title, text, visual], i) => (
              <li key={title} className="flow-step">
                <div className="flow-text">
                  <span className="flow-num mono" aria-hidden="true">{i + 1}</span>
                  <h3 className="mkt-h3-sm">{title}</h3>
                  <p>{text}</p>
                </div>
                <Inert className="flow-visual" label={`Illustration for step ${i + 1}: ${title}.`}>{visual}</Inert>
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
            <Inert className="wf-visual" label="Illustration: a screener filtered to economics contracts with spreads of 3 cents or less, showing bid, ask, spread, size at the ask and 24-hour change."><ScreenerCloseup /></Inert>
            <div className="wf-text">
              <h3 className="mkt-h3">Screen faster. Verify the contract. See the spread.</h3>
              <ul className="check-list">
                <li><Icon n="list-filter" size={18} />Filter by venue, liquidity, spread and time to expiry, then save the view.</li>
                <li><Icon n="layers" size={18} />Top-of-book size next to every price, so you know what is actually available.</li>
                <li><Icon n="git-compare-arrows" size={18} />Jump to verified equivalents on another venue in one click.</li>
                <li><Icon n="bell" size={18} />Alerts that only fire on current quotes.</li>
              </ul>
              <Button variant="secondary" href="#app-markets" iconRight="arrow-right">Open the market explorer</Button>
            </div>
          </TabPanel>
          <TabPanel idBase="wf" id="researchers" value={tab} className="wf-panel">
            <Inert className="wf-visual" label="Illustration: one-month chart of cut, hold and hike contracts for the December Fed meeting."><OutcomeCloseup /></Inert>
            <div className="wf-text">
              <h3 className="mkt-h3">Turn market probabilities into research-ready insight.</h3>
              <ul className="check-list">
                <li><Icon n="chart-line" size={18} />Historical probabilities with gaps shown, never smoothed over.</li>
                <li><Icon n="calendar-days" size={18} />Catalyst timelines that link releases to observed moves.</li>
                <li><Icon n="file-text" size={18} />Cited reports with version history and methodology notes.</li>
                <li><Icon n="download" size={18} />Exports with snapshot timestamps where data rights allow.</li>
              </ul>
              <Button variant="secondary" href="#app-event-fomc-dec-2026" iconRight="arrow-right">Open an event in the demo</Button>
            </div>
          </TabPanel>
        </div>
      </section>

      <EventEngine />
      <CompareModule />
      <ResearchDemo />

      <section className="mkt-sec" aria-labelledby="plans-title">
        <div className="container">
          <SectionHead id="plans-title" eyebrow="Plans" title="Start free. Upgrade when you need more depth." lead="Plan limits depend on permitted data access and are shown before checkout." />
          <div className="plan-teaser">
            {[
              ['Free', '$0', 'For getting oriented', ['Market explorer and contract rules', 'One watchlist and three alerts', '7 days of price history', 'Event pages and timelines'], 'Create free account', '#sign-up', 'secondary'],
              ['Pro', '$99', 'For daily research and trading prep', ['Full price history and exports where licensed', 'Cross-venue comparison with modeled depth', 'Cited AI research reports', '100 alerts and saved workspaces'], 'Start with Pro', '#sign-up', 'primary'],
            ].map(([name, price, who, feats, cta, href, variant]) => (
              <div key={name} className={cx('plan-card', variant === 'primary' && 'is-featured')}>
                <div className="plan-head"><h3 className="plan-name">{name}</h3><p className="muted">{who}</p></div>
                <p className="plan-price"><span className="mono">{price}</span><span className="muted">/month</span></p>
                <ul className="plan-feats">{feats.map((f) => <li key={f}><Icon n="check" size={16} />{f}</li>)}</ul>
                <Button variant={variant} href={href} block>{cta}</Button>
              </div>
            ))}
          </div>
          <p className="plan-note"><Icon n="info" size={16} />Prices are placeholders from the design brief, not final. <a href="#pricing">Compare all plans</a></p>
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
            <Button variant="primary" size="lg" href="#sign-up">Create free account</Button>
            <Button variant="ghost" size="lg" href="#app-dashboard">Explore the demo first</Button>
          </div>
        </div>
      </section>
    </>
  );
}
