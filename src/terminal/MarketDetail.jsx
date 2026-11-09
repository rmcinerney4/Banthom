import React from 'react';
import { Icon, Button, IconButton, Badge, Panel, PageHeader, EmptyState, VenueBadge, Delta, Segmented, Check, Tabs, TabPanel, Banner, KeyValue, MatchBadge, TrustTag, AiTag, DemoTag, Freshness, Field, InfoTip } from '../ui/core.jsx';
import { PriceChart, OrderLadder } from '../charts/charts.jsx';
import { useStore } from '../store.jsx';
import { useMedia, useNow, useCopy, go } from '../lib/hooks.js';
import { useQuote, freshnessOf, change24, useFeed } from '../data/quotes.js';
import { MARKET_BY_ID, EVENT_BY_ID, VENUES, rulesFor, matchForMarket, marketsForEvent, timelineForEvent } from '../data/fixtures.js';
import { seriesFor, markersFor, gapsIn, orderBook, tradePrints, TIMEFRAMES, baseSeries } from '../data/series.js';
import { fmtCents, fmtDate, fmtDateShort, fmtTime, fmtTimeSec, fmtDateTimeShort, fmtVolume, fmtInt, fmtChance, fmtPP, midOf, spreadOf, cx, isNum, pluralize } from '../lib/format.js';
import { useTitle, StarButton, StatusBadge, statusOf, QuoteNum } from './kit.jsx';
import { AlertEditor, ruleSentence } from './Alerts.jsx';

const { useState, useMemo } = React;

const cents = (v, tick) => (tick ? `${Math.round(v)}¢` : fmtCents(v, 1));
const invert = (pts) => pts.map((p) => ({ t: p.t, v: isNum(p.v) ? 100 - p.v : null }));

function summarize(points, label) {
  const vals = points.filter((p) => isNum(p.v));
  if (!vals.length) return `${label}: no observations in this period.`;
  const first = vals[0];
  const last = vals[vals.length - 1];
  const lo = vals.reduce((a, b) => (b.v < a.v ? b : a));
  const hi = vals.reduce((a, b) => (b.v > a.v ? b : a));
  const gaps = points.filter((p) => !isNum(p.v)).length;
  const dir = last.v > first.v ? 'rose' : last.v < first.v ? 'fell' : 'was unchanged';
  return `${label} ${dir} from ${fmtCents(first.v, 1)} to ${fmtCents(last.v, 1)}. Low ${fmtCents(lo.v, 1)} on ${fmtDateTimeShort(lo.t)}; high ${fmtCents(hi.v, 1)} on ${fmtDateTimeShort(hi.t)}.${gaps ? ` ${pluralize(gaps, 'interval')} without data.` : ''}`;
}

function QuoteStrip({ mk, q, compact }) {
  const ch = change24(mk, q);
  const spread = spreadOf(q);
  const mid = midOf(q);
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
      {cell('Yes bid', <QuoteNum value={q.bid} changedAt={q.changedAt} />, isNum(q.bidSize) ? `${fmtInt(q.bidSize)} available` : null, 'Highest price offered for Yes. You could sell Yes here.')}
      {cell('Yes ask', <QuoteNum value={q.ask} changedAt={q.changedAt} />, isNum(q.askSize) ? `${fmtInt(q.askSize)} available` : null, 'Lowest price asked for Yes. You could buy Yes here.')}
      {cell('Spread', fmtCents(spread), null, 'Ask minus bid.')}
      {cell('Last trade', fmtCents(q.last), q.lastAt ? fmtTime(q.lastAt) : null, 'Most recent trade. Never used in place of a missing bid or ask.')}
      {cell('24h change', <Delta value={ch} size="lg" />, 'Yes midpoint')}
      {!compact && cell('Volume 24h', fmtVolume(mk.vol, VENUES[mk.venue].volumeBasis === 'usd' ? 'usd' : 'ct'), VENUES[mk.venue].volumeBasis === 'usd' ? 'USDC notional' : 'Contracts')}
      {cell('Implied chance', isNum(indicative) ? fmtChance(indicative) : '—', isNum(indicative) ? 'Indicative' : 'Spread too wide', 'The midpoint read as a share of the $1 payout. A market-implied proxy, not a guaranteed probability.')}
      <div className="qs-cell qs-fresh"><span className="qs-k">Data</span><Freshness mk={mk} q={q} variant="strip" /></div>
    </div>
  );
}

function ChartPanel({ mk, other, match }) {
  const [tf, setTf] = useState('1W');
  const [side, setSide] = useState('yes');
  const [overlay, setOverlay] = useState(false);
  const [events, setEvents] = useState(true);
  const [step, setStep] = useState(false);
  const [view, setView] = useState('chart');
  const mobile = useMedia('(max-width: 767px)');
  const s = useMemo(() => seriesFor(mk.id, tf), [mk.id, tf]);
  const o = useMemo(() => (overlay && other ? seriesFor(other.id, tf, s.to) : null), [overlay, other, tf, s.to]);
  const sideLabel = side === 'yes' ? 'Yes' : 'No';
  const series = [{ id: 'main', label: `${VENUES[mk.venue].short} ${sideLabel} mid`, points: side === 'yes' ? s.points : invert(s.points) }];
  if (o) series.push({ id: 'other', label: `${VENUES[other.venue].short} ${sideLabel} mid`, points: side === 'yes' ? o.points : invert(o.points) });
  const markers = events ? markersFor(mk, s.from, s.to) : [];
  const gaps = [...gapsIn(mk.id, s.from, s.to), ...(o ? gapsIn(other.id, s.from, s.to) : [])];
  const tfObj = TIMEFRAMES.find((t) => t.id === tf);
  return (
    <Panel title="Price history" sub={`${sideLabel} midpoint · ${tfObj.sampling}`} className="chart-panel"
      actions={<Button size="sm" variant="ghost" icon={view === 'chart' ? 'table' : 'chart-line'} aria-pressed={view === 'table'} onClick={() => setView(view === 'chart' ? 'table' : 'chart')}>{view === 'chart' ? 'Table view' : 'Chart view'}</Button>}>
      <div className="chart-toolbar">
        <div className="chart-toolbar-group">
          <Segmented label="Time range" value={tf} onChange={setTf} options={TIMEFRAMES.map((t) => ({ id: t.id, label: t.label, aria: t.name }))} />
          <Segmented label="Outcome side" value={side} onChange={setSide} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} />
        </div>
        <div className="chart-toolbar-group">
          {other && <Check id="ov" label={`Overlay ${VENUES[other.venue].short}`} checked={overlay} onChange={setOverlay} />}
          <Check id="ev" label="Events" checked={events} onChange={setEvents} />
          {!mobile && <Segmented label="Line style" value={step ? 'step' : 'line'} onChange={(v) => setStep(v === 'step')} options={[{ id: 'line', label: 'Line' }, { id: 'step', label: 'Step' }]} />}
        </div>
      </div>
      {overlay && match && match.status !== 'verified' && (
        <Banner tone="warning" className="chart-banner">Not a verified match. {VENUES[other.venue].short}’s contract may settle differently, so the two lines are not directly comparable.</Banner>
      )}
      <PriceChart series={series} from={s.from} to={s.to} height={mobile ? 240 : 340} markers={markers} gaps={gaps} yFormat={cents} step={step}
        sampling={tfObj.sampling} priceType={`${sideLabel} midpoint`} source={`${VENUES[mk.venue].name} (fictional)`} view={view}
        summary={summarize(series[0].points, series[0].label)} ariaLabel={`${mk.outcome} price chart, ${tfObj.name}`} />
      <div className="chart-foot">
        {side === 'no' && <span><Icon n="info" size={13} />No midpoint is derived as 100¢ minus the Yes midpoint.</span>}
        {gaps.length > 0 && <span><Icon n="unplug" size={13} />Shaded areas had no observations. Lines are not drawn through them.</span>}
        {markers.length > 0 && <span><Icon n="circle-dot" size={13} />Numbered markers show timing, not cause.</span>}
      </div>
    </Panel>
  );
}

function AboutContract({ mk }) {
  const r = rulesFor(mk);
  return (
    <Panel title="About this contract" sub={`Exact rules from ${VENUES[mk.venue].name} (simulated wording)`} id="rules">
      <blockquote className="rules-quote">{r.text.map((p, i) => <p key={i}>{p}</p>)}</blockquote>
      <KeyValue className="rules-kv" items={[
        ['Settlement source', r.source],
        ['Trading cutoff', r.cutoff],
        ['Deadline timezone', r.timezone],
        ['Edge cases', r.edge],
        ['If undeterminable or cancelled', r.void],
        ['Settlement', r.unit],
        ['Eligibility', r.restrictions],
      ]} />
      <p className="panel-note"><Icon n="file-text" size={14} /><span>Venue title “{mk.sourceTitle}” · ID <span className="mono">{mk.ref}</span> · Rules updated {fmtDate(mk.rulesUpdated)}</span></p>
    </Panel>
  );
}

function ResearchPanel({ mk }) {
  const { prefs, toast } = useStore();
  const items = timelineForEvent(mk.eventId).slice(-4).reverse();
  const [ask, setAsk] = useState('');
  const [answer, setAnswer] = useState(null);
  const down = prefs.scenario === 'ai-down';
  const submit = (e) => {
    e.preventDefault();
    if (!ask.trim()) return;
    setAnswer({ q: ask.trim(), t: Date.now() });
    setAsk('');
  };
  return (
    <Panel title="What changed" sub="Dated events around this contract" actions={<AiTag />}>
      {down && <Banner tone="warning" icon="shield-alert" title="Unable to verify recent sources.">Summaries are paused. Price history and rules are unaffected.</Banner>}
      {items.length ? (
        <ol className="wc-list">
          {items.map((t) => (
            <li key={t.id}>
              <span className="wc-time mono">{fmtDateTimeShort(t.t)}</span>
              <span className="wc-title">{t.title}</span>
              <span className="row">{t.move ? <><Delta value={t.move.pp} /><span className="muted small">in {t.move.window}</span></> : <span className="muted small">No price data</span>}<TrustTag tag={t.link} /></span>
              <span className="muted small">{t.source}</span>
            </li>
          ))}
        </ol>
      ) : <EmptyState compact title="No dated events yet">When releases or headlines are linked to this event, they appear here with their sources.</EmptyState>}
      <form className="ask" onSubmit={submit}>
        <label htmlFor={`ask-${mk.id}`} className="field-label">Ask about this event</label>
        <div className="ask-row">
          <input id={`ask-${mk.id}`} className="input" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="e.g. What moved this market today?" disabled={down} />
          <Button type="submit" variant="secondary" icon="send" disabled={down} aria-label="Ask" />
        </div>
      </form>
      {answer && (
        <div className="ask-answer" role="status">
          <p className="muted small">You asked: “{answer.q}”</p>
          <p>This demo doesn’t run a model. In the full product, the answer would cite sources like the items above and label each claim observed, inferred or unknown.</p>
          <div className="row"><AiTag>AI-assisted</AiTag><span className="muted small">Sources reviewed as of Nov 6, 2026, 1:15 PM ET</span></div>
        </div>
      )}
      <a href={`#app-event-${mk.eventId}`} className="btn btn-ghost btn-sm panel-more">Open event intelligence<Icon n="arrow-right" size={14} /></a>
    </Panel>
  );
}

function Related({ mk, match, other }) {
  const feed = useFeed();
  const list = marketsForEvent(mk.eventId).filter((m) => m.id !== mk.id);
  return (
    <ul className="related">
      {list.map((m) => {
        const q = feed.quotes[m.id];
        const isMatch = other && other.id === m.id;
        return (
          <li key={m.id}>
            <a href={`#app-market-${m.id}`} className="related-link">
              <VenueBadge venue={m.venue} />
              <span className="grow related-name">{m.outcome}{isMatch && <span className="related-match"><MatchBadge status={match.status} short /></span>}</span>
              <span className="mono">{fmtCents(midOf(q), 1)}</span>
              <Delta value={change24(m, q)} />
            </a>
          </li>
        );
      })}
      {!list.length && <li className="muted small">No other contracts on this event.</li>}
    </ul>
  );
}

function ActivityTab({ mk, q }) {
  const prints = tradePrints(mk, q, 12);
  const s = baseSeries(mk.id);
  let lo = Infinity, hi = -Infinity;
  const from = s.n - 30 * 288;
  for (let i = Math.max(0, from); i < s.n; i++) { const v = s.values[i]; if (!Number.isNaN(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
  return (
    <div className="grid">
      <div className="s-5">
        <KeyValue items={[
          ['Volume 24h', fmtVolume(mk.vol, VENUES[mk.venue].volumeBasis === 'usd' ? 'usd' : 'ct')],
          ['Open interest', fmtVolume(mk.oi, VENUES[mk.venue].volumeBasis === 'usd' ? 'usd' : 'ct')],
          ['30-day range (mid)', Number.isFinite(lo) ? `${fmtCents(lo, 1)} – ${fmtCents(hi, 1)}` : '—'],
          ['Tick size', '1¢'],
          ['Listed', fmtDate(mk.listed)],
          ['Trading closes', fmtDateTimeShort(mk.closes)],
        ]} />
      </div>
      <div className="s-7">
        {prints.length ? (
          <div className="table-scroll">
            <table className="table table-compact">
              <caption className="table-caption">Recent trades (simulated prints)</caption>
              <thead><tr><th scope="col">Time</th><th scope="col">Taker bought</th><th scope="col" className="num">Price</th><th scope="col" className="num">Size</th></tr></thead>
              <tbody>{prints.map((p, i) => <tr key={i}><td className="mono small">{fmtTimeSec(p.t)}</td><td>{p.side}</td><td className="num">{fmtCents(p.side === 'Yes' ? p.price : 100 - p.price)}</td><td className="num">{fmtInt(p.size)}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <EmptyState compact title="No recent trades" />}
      </div>
    </div>
  );
}

function SourcesTab({ mk, q }) {
  const v = VENUES[mk.venue];
  return (
    <KeyValue items={[
      ['Venue', `${v.name} (fictional)`],
      ['Venue market ID', <span className="mono">{mk.ref}</span>],
      ['Endpoint', <span className="mono">{v.endpoint}</span>],
      ['Venue timestamp', fmtTimeSec(q.observedAt)],
      ['Received by Banthom', fmtTimeSec(q.ingestedAt)],
      ['Freshness threshold', `${v.recentS / 60} minutes`],
      ['Price units', `${v.currency === 'USD' ? 'US cents' : 'USDC cents'} per ${v.nativeUnit === 'shares' ? 'share' : 'contract'}`],
      ['Fees (assumption)', v.feeLabel],
      ['Methodology', 'v0.1 draft'],
    ]} />
  );
}

export function MarketDetail({ id }) {
  const mk = MARKET_BY_ID[id];
  const ev = EVENT_BY_ID[mk.eventId];
  useTitle(`${mk.outcome} · ${ev.title}`);
  const q = useQuote(id);
  const now = useNow();
  const { alerts, toast } = useStore();
  const copy = useCopy();
  const mobile = useMedia('(max-width: 767px)');
  const match = matchForMarket(id);
  const other = match ? MARKET_BY_ID[match.a === id ? match.b : match.a] : null;
  const fr = freshnessOf(mk, q, now);
  const status = statusOf(mk, now);
  const [tab, setTab] = useState('activity');
  const [mtab, setMtab] = useState('overview');
  const [editor, setEditor] = useState(false);
  const book = orderBook(mk, q);
  const myAlerts = alerts.filter((a) => a.marketId === id);
  const share = async () => {
    const link = `${window.location.href.split('#')[0]}#app-market-${id}`;
    const ok = await copy(link);
    toast(ok ? 'Link copied. Shared links show the snapshot time and methodology version.' : `Copy failed. Link: ${link}`, { tone: ok ? 'success' : 'info' });
  };
  const crumbs = [{ label: 'Markets', href: '#app-markets' }, { label: ev.title, href: `#app-event-${ev.id}` }, { label: mk.outcome }];

  const header = (
    <PageHeader title={mk.title} crumbs={crumbs}
      meta={<>
        <VenueBadge venue={mk.venue} full />
        <StatusBadge status={status} result={mk.result} />
        {match && <a href={`#app-compare-${match.id}`} className="badge-link"><MatchBadge status={match.status} /></a>}
        <DemoTag />
      </>}
      actions={<>
        <StarButton id={id} size="lg" />
        <Button variant="secondary" icon="share-2" onClick={share}>Share</Button>
        <Button variant="secondary" icon="external-link" aria-disabled="true" data-tip="Fictional venue in this demo" onClick={() => toast('Arden and Brisa are fictional, so there is no original page to open.', { tone: 'info' })}>Open on {VENUES[mk.venue].short}</Button>
        {!mobile && <Button variant="primary" icon="bell-plus" onClick={() => setEditor(true)} disabled={mk.status === 'resolved'}>Set alert</Button>}
      </>}>
      <p className="page-subline">
        <span>Resolves on {fmtDate(mk.resolves)}</span><span aria-hidden="true">•</span>
        <span>Rules updated {fmtDate(mk.rulesUpdated)}</span><span aria-hidden="true">•</span>
        <span>Source last observed {fmtTimeSec(q.observedAt)}</span>
      </p>
    </PageHeader>
  );

  const banners = (
    <>
      {mk.status === 'resolved' && <Banner tone="neutral" icon="circle-check" title={`Resolved ${mk.result} (simulated outcome).`}>Settled on {fmtDateTimeShort(mk.endAt)}. History is kept for research; there are no live quotes.</Banner>}
      {fr.status === 'delayed' && <Banner tone="warning" icon="clock" title="Delayed data.">Last updated {fmtTimeSec(q.observedAt)}. Quotes may no longer be actionable.</Banner>}
    </>
  );

  const bookPanel = (
    <Panel title="Top of book" sub={`Yes side · sizes in ${VENUES[mk.venue].nativeUnit}`}>
      <OrderLadder book={book} compact unit={VENUES[mk.venue].nativeUnit} />
      <p className="panel-note"><Icon n="info" size={14} />Depth shown where the venue’s terms allow. Simulated.</p>
    </Panel>
  );
  const monitorPanel = (
    <Panel title="Monitor" sub={myAlerts.length ? pluralize(myAlerts.length, 'alert rule') : 'No alerts on this market'}>
      {myAlerts.map((a) => <p key={a.id} className="small monitor-rule"><Icon n={a.enabled ? 'bell-ring' : 'bell'} size={14} />{ruleSentence(a)}</p>)}
      <div className="row">
        <Button size="sm" variant="secondary" icon="bell-plus" onClick={() => setEditor(true)} disabled={mk.status === 'resolved'}>Create alert</Button>
        <Button size="sm" variant="ghost" href="#app-alerts">All alerts</Button>
      </div>
    </Panel>
  );

  if (mobile) {
    return (
      <div className="page-stack md-page">
        <div className="md-sticky" aria-hidden="true">
          <span className="md-sticky-title">{mk.outcome}</span>
          <span className="mono">{fmtCents(q.bid)} / {fmtCents(q.ask)}</span>
          <Delta value={change24(mk, q)} />
        </div>
        {header}
        {banners}
        <QuoteStrip mk={mk} q={q} compact />
        <ChartPanel mk={mk} other={other} match={match} />
        <Segmented size="md" label="Market sections" value={mtab} onChange={setMtab} className="md-tabs"
          options={[{ id: 'overview', label: 'Overview' }, { id: 'rules', label: 'Rules' }, { id: 'research', label: 'Research' }, { id: 'book', label: 'Book' }]} />
        {mtab === 'overview' && <><Panel title="Market statistics"><ActivityTab mk={mk} q={q} /></Panel><Panel title="Related contracts"><Related mk={mk} match={match} other={other} /></Panel></>}
        {mtab === 'rules' && <AboutContract mk={mk} />}
        {mtab === 'research' && <ResearchPanel mk={mk} />}
        {mtab === 'book' && <>{bookPanel}<Panel title="Sources"><SourcesTab mk={mk} q={q} /></Panel></>}
        {mk.status !== 'resolved' && <div className="md-cta"><Button variant="primary" size="lg" block icon="bell-plus" onClick={() => setEditor(true)}>Set alert</Button></div>}
        <AlertEditor open={editor} onClose={() => setEditor(false)} initial={{ marketId: id }} />
      </div>
    );
  }

  return (
    <div className="page-stack">
      {header}
      {banners}
      <QuoteStrip mk={mk} q={q} />
      <div className="grid">
        <div className="s-8 col-stack">
          <ChartPanel mk={mk} other={other} match={match} />
          <AboutContract mk={mk} />
          <Panel flush className="tabs-panel">
            <Tabs idBase="md" label="Market details" value={tab} onChange={setTab} className="panel-tabs"
              tabs={[{ id: 'activity', label: 'Activity' }, { id: 'book', label: 'Order book' }, { id: 'rules', label: 'Rules' }, { id: 'related', label: 'Related' }, { id: 'sources', label: 'Sources' }]} />
            <div className="tabs-body">
              <TabPanel idBase="md" id="activity" value={tab}><ActivityTab mk={mk} q={q} /></TabPanel>
              <TabPanel idBase="md" id="book" value={tab}>
                <div className="grid"><div className="s-6"><OrderLadder book={book} unit={VENUES[mk.venue].nativeUnit} /></div>
                  <div className="s-6"><p className="muted small">Bars show resting size at each price. Buying Yes walks up the asks; selling Yes walks down the bids. Banthom doesn’t place orders.</p></div></div>
              </TabPanel>
              <TabPanel idBase="md" id="rules" value={tab}>
                <ol className="hist">
                  <li><span className="hist-time mono">{fmtDateShort(mk.rulesUpdated)}</span><div className="grow"><p>Current rules (version 2). Clarified the treatment of changes announced between meetings.</p><p className="muted small">Text hash <span className="mono">7f3a…c21e</span> · simulated</p></div></li>
                  <li><span className="hist-time mono">{fmtDateShort(mk.listed)}</span><div className="grow"><p>Listed with version 1 rules.</p></div></li>
                </ol>
                <a href="#rules" className="small" onClick={(e) => { e.preventDefault(); document.getElementById('rules').scrollIntoView({ behavior: 'smooth' }); }}>Read the current rules above</a>
              </TabPanel>
              <TabPanel idBase="md" id="related" value={tab}><Related mk={mk} match={match} other={other} /></TabPanel>
              <TabPanel idBase="md" id="sources" value={tab}><SourcesTab mk={mk} q={q} /></TabPanel>
            </div>
          </Panel>
        </div>
        <div className="s-4 col-stack">
          {bookPanel}
          <ResearchPanel mk={mk} />
          <Panel title="Related contracts" sub={ev.structure}><Related mk={mk} match={match} other={other} /></Panel>
          {monitorPanel}
        </div>
      </div>
      <AlertEditor open={editor} onClose={() => setEditor(false)} initial={{ marketId: id }} />
    </div>
  );
}
