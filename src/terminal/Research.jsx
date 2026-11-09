import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, EmptyState, VenueBadge, Delta, Banner, TrustTag, AiTag, Sheet, Field, Segmented, Check, KeyValue, DemoTag } from '../ui/core.jsx';
import { PriceChart } from '../charts/charts.jsx';
import { useStore } from '../store.jsx';
import { useMedia, useCopy, go } from '../lib/hooks.js';
import { RESEARCH, REPORT, EVENT_BY_ID, MARKET_BY_ID, EVENTS, CATEGORIES, VENUES, marketsForEvent } from '../data/fixtures.js';
import { seriesFor, markersFor } from '../data/series.js';
import { useFeed, change24 } from '../data/quotes.js';
import { fmtCents, fmtDateTimeShort, fmtDateShort, fmtTime, midOf, cx, pluralize } from '../lib/format.js';
import { useTitle, CATEGORY_LABEL } from './kit.jsx';

const { useState, useMemo } = React;

const SUGGESTIONS = ['What changed over 7 days?', 'Compare contracts across venues', 'Summarize resolution rules'];

function Builder({ open, onClose }) {
  const { prefs, toast } = useStore();
  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState('fomc-dec-2026');
  const [range, setRange] = useState('7d');
  const [err, setErr] = useState(null);
  const down = prefs.scenario === 'ai-down';
  const submit = (e) => {
    e.preventDefault();
    if (!prompt.trim()) { setErr('Describe what the report should answer.'); return; }
    onClose();
    toast('This demo doesn’t run a model. Showing a saved sample report instead.', { tone: 'info' });
    go(`app-research-${REPORT.id}`);
  };
  return (
    <Sheet open={open} onClose={onClose} title="New report" sub="Reports cite sources and label each claim observed, inferred or unknown." width={480}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="rb-form" icon="sparkles" disabled={down}>Generate with citations</Button></>}>
      <form id="rb-form" className="stack" onSubmit={submit} noValidate>
        {down && <Banner tone="warning" icon="shield-alert" title="Unable to verify recent sources.">Generation is switched off until sources can be retrieved, so the report can’t include unsupported claims.</Banner>}
        <Field id="rb-prompt" label="Question" error={err}>
          <textarea id="rb-prompt" className="textarea" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What should the report answer?" aria-invalid={!!err} aria-describedby={err ? 'rb-prompt-err' : undefined} />
        </Field>
        <div className="chip-row" aria-label="Suggestions">
          {SUGGESTIONS.map((s) => <button key={s} type="button" className="chip chip-btn" onClick={() => { setPrompt(s); setErr(null); }}>{s}</button>)}
        </div>
        <Field id="rb-scope" label="Scope">
          <select id="rb-scope" className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
            {EVENTS.filter((ev) => !ev.id.startsWith('cpi-sep') && !ev.id.startsWith('claims')).map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
          </select>
        </Field>
        <div>
          <p className="field-label">Date range</p>
          <Segmented size="md" label="Date range" value={range} onChange={setRange} options={[{ id: '24h', label: '24 hours' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }]} />
        </div>
        <p className="muted small">Sources: permitted publications and Banthom price history only. The model and methodology version are saved with the report.</p>
      </form>
    </Sheet>
  );
}

export function Research() {
  useTitle('Research');
  const { prefs } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [onlyNew, setOnlyNew] = useState(false);
  const [builder, setBuilder] = useState(false);
  const down = prefs.scenario === 'ai-down';
  const items = RESEARCH.filter((r) => {
    const ev = EVENT_BY_ID[r.eventId];
    if (cat !== 'all' && ev.category !== cat) return false;
    if (onlyNew && r.t < Date.UTC(2026, 10, 6, 15)) return false;
    if (q && !`${r.title} ${r.summary} ${ev.title}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  return (
    <div className="page-stack">
      <PageHeader title="Research" sub="Sources and signals behind market moves" actions={<Button variant="primary" icon="sparkles" onClick={() => setBuilder(true)}>New report</Button>} />
      {down && <Banner tone="warning" icon="shield-alert" title="Unable to verify recent sources.">New summaries are paused. Existing summaries below show when their sources were last reviewed.</Banner>}
      <div className="xp-row research-filters">
        <div className="input-wrap xp-search"><Icon n="search" size={16} /><input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search research…" aria-label="Search research" /></div>
        <Segmented size="md" label="Category" value={cat} onChange={setCat} options={[{ id: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))]} />
        <Check id="r-new" label="New since last visit" checked={onlyNew} onChange={setOnlyNew} />
      </div>
      {items.length === 0 ? <Panel><EmptyState title="No research matches these filters." action={<Button variant="secondary" onClick={() => { setQ(''); setCat('all'); setOnlyNew(false); }}>Clear filters</Button>} /></Panel> : (
        <div className="grid">
          {items.map((r) => {
            const ev = EVENT_BY_ID[r.eventId];
            const mk = MARKET_BY_ID[r.marketId];
            const href = r.id === 'rs-fed-claims' ? `#app-research-${REPORT.id}` : `#app-event-${r.eventId}`;
            return (
              <article key={r.id} className="s-6 md-12 panel rfeed">
                <div className="row-between"><span className="label">{ev.title}</span><span className="muted small">{fmtDateShort(r.t)}, {fmtTime(r.t)}</span></div>
                <h2 className="rfeed-title"><a href={href} className="link-plain">{r.title}</a></h2>
                <p className="rfeed-sum">{r.summary}</p>
                <div className="rfeed-move"><VenueBadge venue={mk.venue} /><span className="small">{mk.outcome}</span><Delta value={r.move} /><span className="muted small">24h</span></div>
                <div className="chip-row">{r.sources.map((s) => <span key={s} className="src-pill">{s}</span>)}</div>
                <div className="row-between rfeed-foot">
                  <span className="row"><AiTag />{r.trust.map((t) => <TrustTag key={t} tag={t} />)}</span>
                  <a href={href} className="btn btn-ghost btn-sm">{r.id === 'rs-fed-claims' ? 'Read report' : 'Open event'}<Icon n="arrow-right" size={14} /></a>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="muted small">Summaries are generated from fictional sources for this demo and are labelled AI-assisted. They are not independently verified.</p>
      <Builder open={builder} onClose={() => setBuilder(false)} />
    </div>
  );
}

export function Report() {
  const r = REPORT;
  useTitle('Report');
  const { toast } = useStore();
  const copy = useCopy();
  const mobile = useMedia('(max-width: 1023px)');
  const feed = useFeed();
  const mk = MARKET_BY_ID[r.marketId];
  const s = useMemo(() => seriesFor(r.marketId, '1W'), []);
  const markers = markersFor(mk, s.from, s.to);
  const [srcOpen, setSrcOpen] = useState(false);
  const related = marketsForEvent(r.eventId).filter((m) => m.status !== 'resolved');
  const sources = (
    <ol className="cites">
      {r.citations.map((c, i) => (
        <li key={c.title}><span className="cite-n mono">[{i + 1}]</span><div><p className="strong small">{c.title}</p><p className="muted small">{c.outlet} · {fmtDateTimeShort(c.t)}</p></div></li>
      ))}
    </ol>
  );
  return (
    <div className="page-stack report">
      <PageHeader title={r.title} crumbs={[{ label: 'Research', href: '#app-research' }, { label: 'Report' }]}
        meta={<><AiTag>AI-generated synthesis</AiTag><span>Generated {fmtDateTimeShort(r.generatedAt)}</span><span>Market and sources as of {fmtDateTimeShort(r.asOf)}</span><span>Version {r.version}</span><DemoTag /></>}
        actions={<>
          <Button variant="secondary" icon="link" onClick={async () => { const ok = await copy(`${window.location.href.split('#')[0]}#app-research-${r.id}`); toast(ok ? 'Link copied. It includes the snapshot time and methodology version.' : 'Copy failed.', { tone: ok ? 'success' : 'info' }); }}>Copy link</Button>
          <Button variant="secondary" icon="download" aria-disabled="true" data-tip="Export isn’t permitted for demo data">Export</Button>
          <Button variant="primary" icon="bookmark" onClick={() => toast('Saved to your Macro workspace (demo).')}>Save to workspace</Button>
          {mobile && <Button variant="ghost" icon="quote" onClick={() => setSrcOpen(true)}>Sources ({r.citations.length})</Button>}
        </>} />
      <div className="grid">
        <div className="s-8 col-stack">
          <Panel title="Executive summary"><p className="report-lead">{r.summary}</p></Panel>
          <Panel title="Findings" sub="Each finding is labelled by evidence type">
            <ul className="findings">
              {r.findings.map((f, i) => <li key={i}><TrustTag tag={f.tag} /><span>{f.text}</span></li>)}
            </ul>
          </Panel>
          <Panel title="Evidence" sub="Arden Yes midpoint, past 7 days, with the timeline entries used above">
            <PriceChart series={[{ id: 'a', label: 'Arden Yes mid', points: s.points }]} from={s.from} to={s.to} height={260} markers={markers}
              yFormat={(v, t) => (t ? `${Math.round(v)}¢` : fmtCents(v, 1))} sampling="30-minute last observation" source="Arden (fictional)"
              summary="Arden December cut contract over the past week, rising from 55.5 cents to 63 cents." ariaLabel="Evidence chart" />
            <ol className="ev-list">{markers.map((m, i) => <li key={m.id}><span className="tl-num">{i + 1}</span><span className="mono small">{fmtDateTimeShort(m.t)}</span><span className="grow">{m.title}</span>{m.move && <Delta value={m.move.pp} />}<TrustTag tag={m.link} /></li>)}</ol>
          </Panel>
          <Panel title="Open questions"><ul className="brief-q">{r.questions.map((x) => <li key={x}>{x}</li>)}</ul></Panel>
          <Panel title="Corrections and versions">
            <ol className="hist">{r.versions.map((v) => <li key={v.v}><span className="hist-time mono">v{v.v}<br />{fmtDateShort(v.t)}</span><div className="grow"><p>{v.note}</p><p className="muted small">{fmtDateTimeShort(v.t)} · {r.model}</p></div></li>)}</ol>
            <p className="panel-note"><Icon n="info" size={14} />Earlier versions stay readable. Exported copies are never rewritten silently.</p>
          </Panel>
        </div>
        <div className="s-4 col-stack">
          {!mobile && <Panel title="Citations" sub="Source title, outlet and time">{sources}</Panel>}
          <Panel title="Related contracts">
            <ul className="related">
              {related.map((m) => {
                const q = feed.quotes[m.id];
                return (
                  <li key={m.id}><a className="related-link" href={`#app-market-${m.id}`}><VenueBadge venue={m.venue} /><span className="grow related-name">{m.outcome}</span><span className="mono">{fmtCents(midOf(q), 1)}</span><Delta value={change24(m, q)} /></a></li>
                );
              })}
            </ul>
          </Panel>
          <Panel title="About this report">
            <KeyValue items={[['Model', r.model], ['Scope', EVENT_BY_ID[r.eventId].title], ['Date range', 'Oct 30 – Nov 6, 2026'], ['Data', 'Simulated quotes, fictional sources']]} />
          </Panel>
        </div>
      </div>
      <Sheet open={srcOpen} onClose={() => setSrcOpen(false)} title="Sources" side="bottom">{sources}</Sheet>
    </div>
  );
}
