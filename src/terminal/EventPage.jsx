import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, EmptyState, VenueBadge, Delta, Segmented, Banner, TrustTag, AiTag, MatchBadge, DemoTag } from '../ui/core.jsx';
import { PriceChart, SERIES_STYLE } from '../charts/charts.jsx';
import { useStore } from '../store.jsx';
import { useNow, useMedia } from '../lib/hooks.js';
import { useFeed, change24, freshnessOf } from '../data/quotes.js';
import { EVENT_BY_ID, MARKET_BY_ID, VENUES, marketsForEvent, timelineForEvent, matchForMarket, rulesFor, RESEARCH, REPORT, SCHEDULE, CATEGORIES } from '../data/fixtures.js';
import { seriesFor, gapsIn, TIMEFRAMES } from '../data/series.js';
import { fmtCents, fmtDate, fmtDateTime, fmtDateTimeShort, fmtDateShort, fmtTime, fmtUntil, fmtAge, midOf, cx, isNum, pluralize } from '../lib/format.js';
import { useTitle, CATEGORY_LABEL } from './kit.jsx';

const { useState, useMemo } = React;
const cents = (v, tick) => (tick ? `${Math.round(v)}¢` : fmtCents(v, 1));

function Brief({ ev, mks }) {
  const { prefs, toast } = useStore();
  const [version, setVersion] = useState(2);
  const down = prefs.scenario === 'ai-down';
  const isFed = ev.id === 'fomc-dec-2026';
  const research = RESEARCH.filter((r) => r.eventId === ev.id);
  const tl = timelineForEvent(ev.id);
  if (down) {
    return (
      <Panel title="Research brief" actions={<AiTag />}>
        <Banner tone="warning" icon="shield-alert" title="Unable to verify recent sources.">The brief is partial. Only facts from Banthom’s own price history are shown, with retrieval times.</Banner>
        <div className="brief-cols">
          <section><h3 className="brief-h">What we know</h3><ul className="brief-list"><li><TrustTag tag="observed" /><span>{mks[0] ? `${mks[0].outcome} on ${VENUES[mks[0].venue].short} last observed at ${fmtCents(midOf(mks[0]), 1)}.` : 'No price data.'}</span></li></ul></section>
          <section><h3 className="brief-h">Sources</h3><p className="muted small">Retrieval failed at 1:15 PM ET. Next retry in 5 minutes.</p></section>
        </div>
        <div className="row"><Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => toast('Sources are still unavailable in this scenario.', { tone: 'info' })}>Retry</Button></div>
      </Panel>
    );
  }
  const known = isFed ? REPORT.findings.filter((f) => f.tag === 'observed').slice(0, 2) : research.slice(0, 1).map((r) => ({ tag: 'observed', text: r.summary.split('. ')[0] + '.' }));
  const changed = isFed ? REPORT.findings.filter((f) => f.tag !== 'observed') : tl.slice(-2).map((t) => ({ tag: t.link, text: `${t.title} (${fmtDateShort(t.t)}).${t.move ? ` ${t.move.pp > 0 ? 'Up' : 'Down'} ${Math.abs(t.move.pp)} pp in ${t.move.window}.` : ''}` }));
  const questions = isFed ? REPORT.questions : ['Which scheduled release is most likely to move these contracts next?', 'Do venue definitions differ in ways that matter for this event?'];
  return (
    <Panel title="Research brief" sub={`Generated Nov 6, 2026, 1:15 PM ET · Sources reviewed as of 1:10 PM ET · version ${version}`}
      actions={<><AiTag /><Button size="sm" variant="ghost" icon="refresh-cw" onClick={() => { setVersion((v) => v + 1); toast('Brief re-run on the same sources (demo). Version history updated.', { tone: 'info' }); }}>Re-run</Button><Button size="sm" variant="ghost" icon="bookmark" onClick={() => toast('Saved to your Macro workspace (demo).')}>Save</Button></>}>
      <div className="brief-cols">
        <section><h3 className="brief-h">What we know</h3>
          {known.length ? <ul className="brief-list">{known.map((f, i) => <li key={i}><TrustTag tag={f.tag} /><span>{f.text}</span></li>)}</ul> : <p className="muted small">Not enough reliable source evidence yet.</p>}
        </section>
        <section><h3 className="brief-h">What changed</h3>
          {changed.length ? <ul className="brief-list">{changed.map((f, i) => <li key={i}><TrustTag tag={f.tag} /><span>{f.text}</span></li>)}</ul> : <p className="muted small">No dated changes recorded.</p>}
        </section>
        <section><h3 className="brief-h">Open questions</h3><ul className="brief-q">{questions.map((q) => <li key={q}>{q}</li>)}</ul></section>
        <section><h3 className="brief-h">Sources</h3>
          <ul className="brief-src">
            {(isFed ? REPORT.citations : tl.map((t) => ({ title: t.title, outlet: t.source, t: t.t }))).slice(0, 4).map((c) => (
              <li key={c.title}><span className="strong small">{c.outlet}</span><span className="small">{c.title}</span><span className="muted small">{fmtDateTimeShort(c.t)}</span></li>
            ))}
          </ul>
        </section>
      </div>
      {isFed && <a className="btn btn-secondary btn-sm" href={`#app-research-${REPORT.id}`}>Open the full 7-day report<Icon n="arrow-right" size={14} /></a>}
    </Panel>
  );
}

export function EventPage({ id }) {
  const ev = EVENT_BY_ID[id];
  useTitle(ev.title);
  const now = useNow();
  const feed = useFeed();
  const { toast } = useStore();
  const mobile = useMedia('(max-width: 767px)');
  const [following, setFollowing] = useState(!!ev.followers);
  const [tf, setTf] = useState('1M');
  const [showAll, setShowAll] = useState(false);
  const mks = marketsForEvent(id);
  const active = mks.filter((m) => m.status !== 'resolved');
  const primaryVenue = active.some((m) => m.venue === 'ARD') ? 'ARD' : 'BRS';
  const chartMks = active.filter((m) => m.venue === primaryVenue).slice(0, 3);
  const s0 = useMemo(() => (chartMks[0] ? seriesFor(chartMks[0].id, tf) : null), [id, tf]);
  const series = useMemo(() => chartMks.map((m, i) => ({ id: m.id, label: m.outcome, ...SERIES_STYLE[i], points: seriesFor(m.id, tf).points })), [id, tf]);
  const tl = timelineForEvent(id);
  const markers = s0 ? tl.filter((t) => t.t >= s0.from && t.t <= s0.to) : [];
  const next = SCHEDULE.find((x) => x.eventId === id && x.t > now);
  const outcomes = [...new Set(mks.map((m) => m.outcome))];
  const venues = Object.keys(VENUES);
  const tiles = active.filter((m) => m.venue === primaryVenue);
  const tfObj = TIMEFRAMES.find((t) => t.id === tf);
  const shownTiles = mobile && !showAll ? tiles.slice(0, 3) : tiles;

  return (
    <div className="page-stack">
      <PageHeader title={ev.title} crumbs={[{ label: 'Markets', href: '#app-markets' }, { label: ev.title }]}
        sub={ev.summary}
        meta={<>
          <Badge tone="muted" icon={CATEGORIES.find((c) => c.id === ev.category).icon}>{CATEGORY_LABEL[ev.category]} · {ev.sub}</Badge>
          <span><Icon n="calendar" size={13} /> {ev.keyLabel}: {fmtDateTime(ev.keyDate)}{ev.keyDate > now ? ` · ${fmtUntil(ev.keyDate - now)}` : ''}</span>
          {next && next.t !== ev.keyDate && <span>Next: {next.title}, {fmtDateShort(next.t)}</span>}
          <DemoTag />
        </>}
        actions={<Button variant={following ? 'secondary' : 'primary'} icon={following ? 'check' : 'plus'} aria-pressed={following}
          onClick={() => { setFollowing(!following); toast(following ? 'Stopped following this event.' : 'Following. Key dates appear on your Overview.'); }}>{following ? 'Following' : 'Follow event'}</Button>} />

      <section aria-labelledby="ev-metrics">
        <h2 id="ev-metrics" className="sr-only">Headline outcomes</h2>
        <div className="grid">
          {shownTiles.map((m) => {
            const q = feed.quotes[m.id];
            return (
              <a key={m.id} href={`#app-market-${m.id}`} className={cx('tile tile-link-card', tiles.length > 3 ? 's-3' : 's-4', 'keep-6')}>
                <span className="tile-label"><VenueBadge venue={m.venue} />{m.outcome}</span>
                <span className="tile-value"><span>{fmtCents(midOf(q), 1)}</span><Delta value={change24(m, q)} /></span>
                <span className="tile-sub">Yes midpoint · bid {fmtCents(q.bid)} / ask {fmtCents(q.ask)}</span>
              </a>
            );
          })}
        </div>
        {mobile && tiles.length > 3 && <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `View all ${tiles.length} outcomes`}</Button>}
        <p className="panel-note ev-note"><Icon n="info" size={14} />{ev.structure} Prices are shown separately and never added together.</p>
      </section>

      <div className="grid">
        <div className="s-8 col-stack">
          {s0 && (
            <Panel title="Outcome prices" sub={`${VENUES[primaryVenue].name} · Yes midpoints · ${tfObj.sampling}`}
              actions={<Segmented label="Time range" value={tf} onChange={setTf} options={TIMEFRAMES.filter((t) => t.id !== '1H').map((t) => ({ id: t.id, label: t.label, aria: t.name }))} />}>
              <PriceChart series={series} from={s0.from} to={s0.to} height={mobile ? 240 : 320} markers={markers} gaps={gapsIn(chartMks[0].id, s0.from, s0.to)}
                yFormat={cents} fullScale={series.length > 1} sampling={tfObj.sampling} priceType="Yes midpoint" source={`${VENUES[primaryVenue].name} (fictional)`}
                summary={`Yes midpoints for ${series.map((x) => x.label).join(', ')} over ${tfObj.name.toLowerCase()}.`} ariaLabel={`${ev.title} outcome prices`} />
              <div className="chart-foot"><span><Icon n="circle-dot" size={13} />Markers match the numbered timeline. They show timing, not cause.</span></div>
            </Panel>
          )}
          <Panel title="Event timeline" sub="Dated announcements, sources and observed price changes">
            {tl.length ? (
              <ol className="timeline">
                {tl.map((t, i) => (
                  <li key={t.id} className="tl-item">
                    <span className="tl-num" aria-hidden="true">{markers.indexOf(t) >= 0 ? markers.indexOf(t) + 1 : '·'}</span>
                    <div className="tl-body">
                      <p className="tl-when"><span className="mono">{fmtDateTimeShort(t.t)}</span><Badge tone="muted" size="sm">{t.kind}</Badge></p>
                      <p className="tl-title">{t.title}</p>
                      <p className="tl-detail">{t.detail}</p>
                      <div className="row">
                        {t.move ? <><Delta value={t.move.pp} /><span className="muted small">{VENUES[MARKET_BY_ID[t.move.marketId].venue].short} · in {t.move.window}</span></> : <span className="muted small">No observations</span>}
                        <TrustTag tag={t.link} />
                        <span className="src-pill">{t.source}</span>
                      </div>
                      <p className="tl-note">{t.link === 'unknown' ? <><Icon n="circle-help" size={13} />Cause unknown. </> : null}{t.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <EmptyState compact title="No timeline entries yet">Releases and headlines appear here once they are linked to this event, with their sources.</EmptyState>}
          </Panel>
          <Brief ev={ev} mks={active} />
        </div>
        <div className="s-4 col-stack">
          <Panel title="Contracts by venue" sub="Yes bid / ask and data age" flush className="table-panel">
            <div className="table-scroll">
              <table className="table table-compact matrix">
                <caption className="sr-only">Outcome matrix: each outcome’s Yes bid and ask on each venue</caption>
                <thead><tr><th scope="col">Outcome</th>{venues.map((v) => <th key={v} scope="col" className="num">{VENUES[v].short}</th>)}</tr></thead>
                <tbody>
                  {outcomes.map((o) => (
                    <tr key={o}>
                      <th scope="row" className="matrix-o">{o}</th>
                      {venues.map((v) => {
                        const m = mks.find((x) => x.outcome === o && x.venue === v);
                        if (!m) return <td key={v} className="num muted">Not listed</td>;
                        const q = feed.quotes[m.id];
                        const f = freshnessOf(m, q, now);
                        return (
                          <td key={v} className="num">
                            <a href={`#app-market-${m.id}`} className="link-plain">{m.status === 'resolved' ? `Resolved ${m.result}` : `${fmtCents(q.bid)} / ${fmtCents(q.ask)}`}</a>
                            {m.status !== 'resolved' && <span className={cx('matrix-age', f.status === 'delayed' && 'age-stale')}>{f.status === 'delayed' ? 'Delayed ' : ''}{fmtAge(f.age)}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-foot">
              {mks.map((m) => matchForMarket(m.id)).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).map((mt) => (
                <a key={mt.id} href={`#app-compare-${mt.id}`} className="matrix-match"><MatchBadge status={mt.status} short /><span>{mt.canonical}</span></a>
              ))}
              {!mks.some((m) => matchForMarket(m.id)) && <span>No cross-venue pairs for this event.</span>}
            </div>
          </Panel>
          <Panel title="Cross-asset context" sub="Shown only when licensed">
            <ul className="ctx-list">
              {(ev.context || []).map(([n, u]) => (
                <li key={n}><Icon n="lock" size={14} /><div className="grow"><p className="small strong">{n}</p><p className="muted small">{u} · not licensed in this demo</p></div></li>
              ))}
            </ul>
            <p className="panel-note"><Icon n="info" size={14} />When added, each series shows its units, source and how comparable it is with contract prices.</p>
          </Panel>
          <Panel title="Resolution and key rules">
            <ul className="rules-list">
              {mks.map((m) => {
                const r = rulesFor(m);
                return (
                  <li key={m.id}>
                    <p className="row"><VenueBadge venue={m.venue} /><a href={`#app-market-${m.id}`} className="link-plain strong small">{m.outcome}</a></p>
                    <p className="muted small">{r.source} · {r.cutoff} · deadline in {r.timezone}</p>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
