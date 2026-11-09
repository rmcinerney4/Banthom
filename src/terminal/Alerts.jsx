import React from 'react';
import { Icon, Button, IconButton, Badge, Panel, PageHeader, EmptyState, VenueBadge, Sheet, Field, Check, Switch, Tabs, TabPanel, Banner, MenuButton } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { useMedia, useNow } from '../lib/hooks.js';
import { useFeed, change24 } from '../data/quotes.js';
import { MARKETS, MARKET_BY_ID, EVENT_BY_ID, VENUES, METRICS, OPS, matchForMarket } from '../data/fixtures.js';
import { fmtCents, fmtTime, fmtTimeSec, fmtDateShort, fmtPP, cx, isNum } from '../lib/format.js';
import { useTitle } from './kit.jsx';

const { useState, useEffect, useMemo, useRef } = React;

// Lets other screens open the editor prefilled ("Create alert" from a row menu).
export const pendingAlert = { current: null };

const COOLDOWNS = [[5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour'], [240, '4 hours'], [1440, '1 day']];
const cooldownLabel = (m) => (COOLDOWNS.find((c) => c[0] === m) || [m, `${m} min`])[1];

function unitText(metric, v) {
  if (!isNum(v)) return '—';
  if (metric === 'change') return `${v} pp`;
  if (metric === 'volume') return `${v.toLocaleString('en-US')} ct`;
  if (metric === 'closing') return `${v} h`;
  if (metric === 'netspread') return `${v > 0 ? '+' : ''}${v}¢`;
  return `${v}¢`;
}
export function ruleSentence(r) {
  const mk = MARKET_BY_ID[r.marketId];
  if (!mk) return '';
  const label = METRICS[r.metric].label;
  const metric = label.startsWith('Yes') ? label : label.charAt(0).toLowerCase() + label.slice(1);
  const where = `${VENUES[mk.venue].short}’s “${mk.outcome}” contract`;
  const v = unitText(r.metric, r.threshold);
  let cond;
  if (r.metric === 'closing') cond = `${where} is within ${v} of closing`;
  else if (r.metric === 'netspread') cond = `the net spread on the verified “${mk.outcome}” pair reaches ${v} or more`;
  else if (r.metric === 'change') cond = r.op === 'absgte' ? `the 24h change on ${where} reaches ${v} in either direction` : `the 24h change on ${where} ${r.op === 'gte' ? 'rises' : 'falls'} by at least ${v}`;
  else cond = `the ${metric} on ${where} ${r.op === 'gte' ? 'rises to' : 'falls to'} ${v} or ${r.op === 'gte' ? 'higher' : 'lower'}`;
  return `Notify me in the app when ${cond}, at most once every ${cooldownLabel(r.cooldown)}${r.onlyFresh ? ', only while quote data is current' : ''}.`;
}

function currentValue(metric, mk, q) {
  if (!q) return null;
  if (metric === 'bid') return q.bid;
  if (metric === 'ask') return q.ask;
  if (metric === 'last') return q.last;
  if (metric === 'change') return change24(mk, q);
  if (metric === 'volume') return mk.vol;
  return null;
}

function MarketPicker({ value, onChange, error }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const mk = value ? MARKET_BY_ID[value] : null;
  const results = useMemo(() => {
    const t = q.toLowerCase().split(/\s+/).filter(Boolean);
    return MARKETS.filter((m) => m.status !== 'resolved' && t.every((w) => `${m.title} ${m.outcome} ${m.venue} ${EVENT_BY_ID[m.eventId].title}`.toLowerCase().includes(w))).slice(0, 6);
  }, [q]);
  const pick = (m) => { onChange(m.id); setQ(''); setOpen(false); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && open && results[sel]) { e.preventDefault(); pick(results[sel]); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
  };
  return (
    <Field id="al-market" label="Market" error={error}>
      {mk && (
        <div className="picked">
          <VenueBadge venue={mk.venue} />
          <span className="grow picked-title">{mk.title}</span>
          <button type="button" className="btn btn-link small" onClick={() => onChange(null)}>Change</button>
        </div>
      )}
      {!mk && (
        <div className="combo">
          <div className="input-wrap">
            <Icon n="search" size={16} />
            <input id="al-market" className="input" value={q} placeholder="Search markets…" role="combobox" aria-expanded={open && results.length > 0}
              aria-controls="al-market-list" aria-autocomplete="list" aria-activedescendant={open && results[sel] ? `al-opt-${sel}` : undefined}
              aria-invalid={!!error} aria-describedby={error ? 'al-market-err' : undefined}
              onChange={(e) => { setQ(e.target.value); setOpen(true); setSel(0); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
              onBlur={() => setTimeout(() => setOpen(false), 120)} />
          </div>
          {open && results.length > 0 && (
            <ul id="al-market-list" role="listbox" className="combo-list" aria-label="Markets">
              {results.map((m, i) => (
                <li key={m.id} id={`al-opt-${i}`} role="option" aria-selected={sel === i} className={cx('combo-opt', sel === i && 'is-sel')}
                  onMouseDown={(e) => { e.preventDefault(); pick(m); }} onMouseEnter={() => setSel(i)}>
                  <VenueBadge venue={m.venue} /><span className="grow">{m.title}</span>
                </li>
              ))}
            </ul>
          )}
          {open && q && !results.length && <p className="muted small combo-none">No active markets match “{q}”.</p>}
        </div>
      )}
    </Field>
  );
}

const blank = (marketId) => ({ id: null, marketId: marketId || null, metric: 'ask', op: 'gte', threshold: '', cooldown: 30, channel: 'in-app', onlyFresh: true, enabled: true, lastTriggered: null });

export function AlertEditor({ open, onClose, initial }) {
  const { saveAlert, alerts, toast } = useStore();
  const mobile = useMedia('(max-width: 767px)');
  const feed = useFeed();
  const [d, setD] = useState(blank());
  const [errs, setErrs] = useState({});
  useEffect(() => {
    if (open) {
      const base = initial && initial.id ? { ...initial, threshold: String(initial.threshold) } : blank(initial && initial.marketId);
      if (!initial || !initial.id) {
        const q = base.marketId ? feed.quotes[base.marketId] : null;
        if (initial && initial.metric === 'netspread') { base.metric = 'netspread'; base.op = 'gte'; base.threshold = '1'; }
        else if (q && isNum(q.ask)) base.threshold = String(Math.min(99, q.ask + 2));
      }
      setD(base);
      setErrs({});
    }
  }, [open]);
  const mk = d.marketId ? MARKET_BY_ID[d.marketId] : null;
  const q = mk ? feed.quotes[mk.id] : null;
  const match = mk ? matchForMarket(mk.id) : null;
  const verified = match && match.status === 'verified';
  const metrics = Object.entries(METRICS).filter(([k]) => k !== 'netspread' || verified);
  const opsFor = (m) => (m === 'closing' ? [['lte', 'is within']] : m === 'change' ? [['absgte', 'moves by at least (either direction)'], ['gte', 'rises by at least'], ['lte', 'falls by at least']] : [['gte', 'is at or above'], ['lte', 'is at or below']]);
  const setMetric = (m) => setD({ ...d, metric: m, op: opsFor(m)[0][0], threshold: '' });
  const num = Number(d.threshold);
  const cur = mk ? currentValue(d.metric, mk, q) : null;
  const already = isNum(cur) && d.threshold !== '' && ((d.op === 'gte' && cur >= num) || (d.op === 'lte' && cur <= num));

  const validate = () => {
    const e = {};
    if (!mk) e.market = 'Choose a market.';
    if (d.threshold === '' || !Number.isFinite(num)) e.threshold = `Enter a threshold in ${METRICS[d.metric].unit === '¢' ? 'cents' : METRICS[d.metric].unit === 'pp' ? 'percentage points' : METRICS[d.metric].unit === 'h' ? 'hours' : 'contracts'}.`;
    else if (['bid', 'ask', 'last'].includes(d.metric) && (num < 1 || num > 99)) e.threshold = 'Prices run from 1¢ to 99¢.';
    else if (d.metric === 'change' && (num <= 0 || num > 50)) e.threshold = 'Use a change between 0.1 and 50 pp.';
    else if (d.metric === 'closing' && (num < 1 || num > 720)) e.threshold = 'Use between 1 and 720 hours.';
    else if (d.metric === 'volume' && num <= 0) e.threshold = 'Volume must be above 0.';
    else if (d.metric === 'netspread' && (num < -10 || num > 20)) e.threshold = 'Use a net spread between −10¢ and +20¢.';
    if (!e.market && !e.threshold && alerts.some((a) => a.id !== d.id && a.marketId === d.marketId && a.metric === d.metric && a.op === d.op && Number(a.threshold) === num)) e.form = 'You already have a rule with this market, metric and threshold.';
    return e;
  };
  const save = (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) {
      const first = e.market ? 'al-market' : e.threshold ? 'al-threshold' : null;
      if (first) { const el = document.getElementById(first); if (el) el.focus(); }
      return;
    }
    const rule = { ...d, id: d.id || `al-${Math.random().toString(36).slice(2, 7)}`, threshold: num, matchId: d.metric === 'netspread' ? match.id : undefined };
    saveAlert(rule);
    toast(d.id ? 'Alert updated.' : 'Alert saved. It fires only while quote data is current.' );
    onClose();
  };
  const unit = METRICS[d.metric].unit;
  return (
    <Sheet open={open} onClose={onClose} title={d.id ? 'Edit alert' : 'Create alert'} sub="In-app alerts. Email needs a verified address." width={480} side={mobile ? 'bottom' : 'right'}
      className={mobile ? 'sheet-tall' : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="alert-form">{d.id ? 'Save changes' : 'Save alert'}</Button></>}>
      <form id="alert-form" className="stack" onSubmit={save} noValidate>
        <MarketPicker value={d.marketId} onChange={(id) => setD({ ...d, marketId: id, metric: d.metric === 'netspread' ? 'ask' : d.metric })} error={errs.market} />
        {mk && q && <p className="muted small picked-now">Now: bid {fmtCents(q.bid)} · ask {fmtCents(q.ask)} · last {fmtCents(q.last)} · observed {fmtTimeSec(q.observedAt)}</p>}
        <div className="form-2">
          <Field id="al-metric" label="Metric">
            <select id="al-metric" className="select" value={d.metric} onChange={(e) => setMetric(e.target.value)}>
              {metrics.map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </Field>
          <Field id="al-op" label="Condition">
            <select id="al-op" className="select" value={d.op} onChange={(e) => setD({ ...d, op: e.target.value })}>
              {opsFor(d.metric).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field id="al-threshold" label={`Threshold (${unit === '¢' ? 'cents' : unit === 'pp' ? 'percentage points' : unit === 'h' ? 'hours' : 'contracts'})`} error={errs.threshold}
          hint={d.metric === 'netspread' ? 'Net of the fee schedule, at top-of-book size. Only verified pairs.' : undefined}>
          <div className="input-wrap">
            <input id="al-threshold" className="input has-unit" type="number" inputMode="decimal" step={unit === 'pp' ? '0.1' : unit === '¢' ? '0.5' : '1'}
              value={d.threshold} onChange={(e) => setD({ ...d, threshold: e.target.value })} aria-invalid={!!errs.threshold}
              aria-describedby={errs.threshold ? 'al-threshold-err' : d.metric === 'netspread' ? 'al-threshold-hint' : undefined} />
            <span className="input-unit">{unit}</span>
          </div>
        </Field>
        {already && <Banner tone="info" icon="info">The condition is already met ({unitText(d.metric, cur)} now). The first alert fires right after you save.</Banner>}
        <Field id="al-cooldown" label="Cooldown" hint="Minimum time between two alerts from this rule.">
          <select id="al-cooldown" className="select" value={d.cooldown} onChange={(e) => setD({ ...d, cooldown: Number(e.target.value) })} aria-describedby="al-cooldown-hint">
            {COOLDOWNS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <fieldset className="fieldset">
          <legend>Delivery</legend>
          <div className="stack-sm">
            <Check id="al-inapp" label="In-app notification" checked onChange={() => {}} disabled hint="Always on for this demo." />
            <Check id="al-email" label="Email" checked={false} onChange={() => {}} disabled hint="Verify your email address to enable." />
          </div>
        </fieldset>
        <Check id="al-fresh" label="Only while quote data is current" hint="Skips alerts when the venue’s data is delayed, so a stale price can’t trigger one." checked={d.onlyFresh} onChange={(v) => setD({ ...d, onlyFresh: v })} />
        <div className="preview-box" aria-live="polite">
          <p className="label">Preview</p>
          <p>{mk && d.threshold !== '' ? ruleSentence({ ...d, threshold: num }) : 'Choose a market and a threshold to see the rule in plain words.'}</p>
        </div>
        {errs.form && <p className="field-error" role="alert"><Icon n="circle-alert" size={14} />{errs.form}</p>}
      </form>
    </Sheet>
  );
}

export function Alerts() {
  useTitle('Alerts');
  const { alerts, history, unread, markRead, toggleAlert, removeAlert, prefs } = useStore();
  const mobile = useMedia('(max-width: 767px)');
  const [tab, setTab] = useState('rules');
  const [editor, setEditor] = useState({ open: false, initial: null });
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    if (pendingAlert.current) { setEditor({ open: true, initial: pendingAlert.current }); pendingAlert.current = null; }
  }, []);
  const open = (initial) => setEditor({ open: true, initial });
  return (
    <div className="page-stack">
      <PageHeader title="Alerts" sub="Know when a market crosses your threshold" actions={<Button variant="primary" icon="bell-plus" onClick={() => open(null)}>Create alert</Button>} />
      <Tabs idBase="al" label="Alerts sections" value={tab} onChange={setTab}
        tabs={[{ id: 'rules', label: 'Active rules', count: alerts.length }, { id: 'history', label: 'Trigger history', count: unread || undefined }, { id: 'delivery', label: 'Delivery settings' }]} />
      <TabPanel idBase="al" id="rules" value={tab}>
        {alerts.length === 0 ? (
          <Panel><EmptyState title="No alert rules yet." action={<Button variant="primary" icon="bell-plus" onClick={() => open(null)}>Create alert</Button>}>Create a rule on any market. Banthom notifies you in the app when it fires, and only while the quote is current.</EmptyState></Panel>
        ) : mobile ? (
          <ul className="acards">
            {alerts.map((a) => {
              const mk = MARKET_BY_ID[a.marketId];
              return (
                <li key={a.id} className={cx('acard', !a.enabled && 'is-off')}>
                  <div className="row-between"><span className="row"><VenueBadge venue={mk.venue} /><a href={`#app-market-${mk.id}`} className="link-plain strong">{mk.outcome}</a></span>
                    <Switch label={<span className="sr-only">Enabled</span>} checked={a.enabled} onChange={() => toggleAlert(a.id)} /></div>
                  <p className="small">{ruleSentence(a)}</p>
                  <div className="row-between"><span className="muted small">Last triggered {a.lastTriggered ? `${fmtDateShort(a.lastTriggered)}, ${fmtTime(a.lastTriggered)}` : 'never'}</span>
                    <span className="row"><Button size="sm" variant="ghost" onClick={() => open(a)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => removeAlert(a.id)}>Delete</Button></span></div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="panel table-panel">
            <div className="table-scroll">
              <table className="table">
                <caption className="sr-only">Alert rules</caption>
                <thead><tr><th scope="col">Market</th><th scope="col">Metric</th><th scope="col">Condition</th><th scope="col">Cooldown</th><th scope="col">Channel</th><th scope="col">Last triggered</th><th scope="col">Enabled</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {alerts.map((a) => {
                    const mk = MARKET_BY_ID[a.marketId];
                    return (
                      <tr key={a.id} className={cx(!a.enabled && 'row-off')}>
                        <td className="mkt-td"><div className="mkt-cell"><a href={`#app-market-${mk.id}`}>{mk.outcome}</a><span className="mkt-cell-sub">{VENUES[mk.venue].short} · {EVENT_BY_ID[mk.eventId].title}</span></div></td>
                        <td>{METRICS[a.metric].label}</td>
                        <td className="mono nowrap">{OPS[a.op]} {unitText(a.metric, a.threshold)}{a.onlyFresh && <span className="muted"> · current data</span>}</td>
                        <td>{cooldownLabel(a.cooldown)}</td>
                        <td>In-app</td>
                        <td className="nowrap">{a.lastTriggered ? `${fmtDateShort(a.lastTriggered)}, ${fmtTime(a.lastTriggered)}` : <span className="muted">Never</span>}</td>
                        <td><Switch label={<span className="sr-only">Enable rule for {mk.outcome}</span>} checked={a.enabled} onChange={() => toggleAlert(a.id)} /></td>
                        <td className="cell-tight"><MenuButton label={`Actions for alert on ${mk.outcome}`} items={[{ label: 'Edit', icon: 'pencil', onClick: () => open(a) }, { label: 'Delete', icon: 'trash-2', danger: true, onClick: () => removeAlert(a.id) }]} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="panel-note tab-note"><Icon n="info" size={14} />Alerts describe what the data showed. They don’t imply a trade could be executed at that price.</p>
      </TabPanel>
      <TabPanel idBase="al" id="history" value={tab}>
        <Panel title="Trigger history" sub="Newest first" actions={unread ? <Button size="sm" variant="ghost" icon="check" onClick={() => markRead(null)}>Mark all as read</Button> : null}>
          {history.length === 0 ? <EmptyState compact title="Nothing has fired yet." /> : (
            <ol className="hist">
              {history.map((h) => (
                <li key={h.id} className={cx(h.unread && 'is-unread', h.suppressed && 'is-suppressed')}>
                  <span className="hist-time mono">{fmtDateShort(h.t)}<br />{fmtTime(h.t)}</span>
                  <div className="grow">
                    <p>{h.text}</p>
                    {h.suppressed && <Badge tone="warning" icon="clock" size="sm">Suppressed: delayed data</Badge>}
                  </div>
                  {h.unread && <button type="button" className="btn btn-link small" onClick={() => markRead(h.id)}>Mark read</button>}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </TabPanel>
      <TabPanel idBase="al" id="delivery" value={tab}>
        <Panel title="Delivery settings" className="narrow-panel">
          <Switch label="In-app notifications" hint="Shown in the alerts menu and on this page." checked onChange={() => {}} disabled />
          <Switch label="Email digest" hint="Available after you verify your email address." checked={false} onChange={() => {}} disabled />
          <Switch label="Quiet hours, 10 PM to 7 AM ET" hint="Alerts that fire during quiet hours wait in your history." checked={quiet} onChange={setQuiet} />
          <div className="switch-row">
            <div className="switch-text"><p className="switch-label">Browser notifications</p><p className="switch-hint">Banthom asks for permission only after you choose this, never on page load. Not available in this demo frame.</p></div>
            <Button size="sm" variant="secondary" disabled>Enable</Button>
          </div>
        </Panel>
      </TabPanel>
      <AlertEditor open={editor.open} initial={editor.initial} onClose={() => setEditor({ open: false, initial: null })} />
    </div>
  );
}
