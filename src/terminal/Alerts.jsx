// Alerts: rules on live Kalshi and Polymarket quotes. Saved and checked in this browser while Banthom is open.
import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, EmptyState, VenueBadge, Delta, Sheet, Field, Switch, Tabs, TabPanel, Banner, MenuButton } from '../ui/core.jsx';
import { useStore, METRICS, COOLDOWNS, ruleText, ruleHit, fmtMetric, itemName } from '../store.jsx';
import { useMedia } from '../lib/hooks.js';
import { fmtCentsAuto, fmtTime, fmtTimeSec, fmtDateShort, cx, isNum, pluralize } from '../lib/format.js';
import { usePolled, API2, marketHref } from '../data/live.js';
import { useTitle, MarketSearch, Fresh } from './kit.jsx';

const { useState, useEffect, useMemo } = React;
const lcFirst = (s) => (/^Yes\b/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

const OPS = {
  price: [['gte', 'rises to or above'], ['lte', 'falls to or below']],
  change: [['absgte', 'moves by at least (either way)'], ['gte', 'rises by at least'], ['lte', 'falls by at least']],
};
const opsFor = (metric) => (metric === 'change' ? OPS.change : OPS.price);
const cooldownLabel = (m) => (COOLDOWNS.find((c) => c[0] === m) || [m, `${m} minutes`])[1];
const valueOf = (metric, q) => (!q ? null : metric === 'change' ? q.ch24 : q[metric]);
const when = (t) => `${fmtDateShort(t)}, ${fmtTime(t)}`;

// Short form for tables: "Yes midpoint ≥ 60¢", "24h change ±5 pp or more".
export function condText(r) {
  const t = r.threshold;
  if (r.metric === 'change') return r.op === 'absgte' ? `24h change ±${t} pp or more` : r.op === 'gte' ? `24h change +${t} pp or more` : `24h change −${t} pp or more`;
  return `${(METRICS[r.metric] || METRICS.mid).label} ${r.op === 'gte' ? '≥' : '≤'} ${t}¢`;
}

const blank = (m) => ({
  id: null, marketId: m ? m.marketId : null, venue: m ? m.venue : null, label: m ? m.label : '', eventTitle: m ? m.eventTitle || '' : '', multi: !!(m && m.multi),
  metric: 'mid', op: 'gte', threshold: '', cooldown: 60, enabled: true, lastFiredAt: null,
});

export function AlertEditor({ open, onClose, initial }) {
  const { saveAlert, alerts, toast } = useStore();
  const mobile = useMedia('(max-width: 767px)');
  const [d, setD] = useState(() => blank());
  const [errs, setErrs] = useState({});
  useEffect(() => {
    if (!open) return;
    setD(initial && initial.id ? { ...initial, threshold: String(initial.threshold) } : blank(initial && initial.marketId ? initial : null));
    setErrs({});
  }, [open]);
  const { data: qd } = usePolled(open && d.marketId ? API2.quotes([d.marketId]) : null, 30000);
  const first = qd && qd.quotes ? qd.quotes[0] : null;
  const q = first && !first.missing ? first : null;
  const closed = !!(first && first.missing);
  const num = Number(d.threshold);
  const unit = METRICS[d.metric].unit;
  const cur = valueOf(d.metric, q);
  const already = !!q && d.threshold !== '' && Number.isFinite(num) && ruleHit({ ...d, threshold: num }, q);

  const pick = (r) => setD((x) => ({ ...x, marketId: r.id, venue: r.venue, label: r.label, eventTitle: r.eventTitle || '', multi: !!r.multi }));
  const setMetric = (m) => setD((x) => ({ ...x, metric: m, op: opsFor(m)[0][0], threshold: '' }));
  const validate = () => {
    const e = {};
    if (!d.marketId) e.market = 'Choose a market.';
    if (d.threshold === '' || !Number.isFinite(num)) e.threshold = d.metric === 'change' ? 'Enter a change in percentage points.' : 'Enter a price in cents.';
    else if (d.metric !== 'change' && (num <= 0 || num >= 100)) e.threshold = 'Prices are between 0¢ and 100¢.';
    else if (d.metric === 'change' && (num <= 0 || num > 100)) e.threshold = 'Use a change above 0 and up to 100 pp.';
    if (!e.market && !e.threshold && alerts.some((a) => a.id !== d.id && a.marketId === d.marketId && a.metric === d.metric && a.op === d.op && Number(a.threshold) === num)) {
      e.form = 'You already have this rule.';
    }
    return e;
  };
  const save = (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) {
      const el = document.getElementById(e.market ? 'al-market' : e.threshold ? 'al-threshold' : '');
      if (el) el.focus();
      return;
    }
    saveAlert({ ...d, id: d.id || `al-${Math.random().toString(36).slice(2, 9)}`, threshold: num, createdAt: d.createdAt || Date.now() });
    toast(d.id ? 'Alert updated.' : 'Alert saved. Banthom checks it every 30 seconds while this site is open in this browser.');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={d.id ? 'Edit alert' : 'Create alert'} sub="Checked against live quotes while Banthom is open in this browser."
      width={480} side={mobile ? 'bottom' : 'right'} className={mobile ? 'sheet-tall' : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="alert-form">{d.id ? 'Save changes' : 'Save alert'}</Button></>}>
      <form id="alert-form" className="stack" onSubmit={save} noValidate>
        <Field id="al-market" label="Market" error={errs.market}>
          {d.marketId ? (
            <div className="picked">
              <VenueBadge venue={d.venue} />
              <span className="grow picked-title">{itemName(d)}</span>
              {!d.id && <button type="button" className="btn btn-link small" onClick={() => setD((x) => ({ ...x, marketId: null }))}>Change</button>}
            </div>
          ) : (
            <MarketSearch id="al-market" onPick={pick} placeholder="Search Kalshi and Polymarket" invalid={!!errs.market} describedBy={errs.market ? 'al-market-err' : undefined} />
          )}
        </Field>
        {q && (
          <p className="muted small picked-now">
            Now: bid {fmtCentsAuto(q.bid)} · ask {fmtCentsAuto(q.ask)} · mid {fmtCentsAuto(q.mid)} · 24h <Delta value={q.ch24} /> · <Fresh venue={q.venue} at={q.observedAt} />
          </p>
        )}
        {closed && <Banner tone="warning" icon="circle-alert" title="This market is no longer trading.">It closed or settled, so this rule can’t fire.</Banner>}
        <div className="form-2">
          <Field id="al-metric" label="Watch">
            <select id="al-metric" className="select" value={d.metric} onChange={(e) => setMetric(e.target.value)}>
              {Object.entries(METRICS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </Field>
          <Field id="al-op" label="Condition">
            <select id="al-op" className="select" value={d.op} onChange={(e) => setD((x) => ({ ...x, op: e.target.value }))}>
              {opsFor(d.metric).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field id="al-threshold" label={`Threshold (${unit === 'pp' ? 'percentage points' : 'cents'})`} error={errs.threshold}
          hint={isNum(cur) ? `Currently ${fmtMetric(d.metric, cur)}.` : undefined}>
          <div className="input-wrap">
            <input id="al-threshold" className="input has-unit" type="number" inputMode="decimal" step={unit === 'pp' ? '0.5' : '0.1'} min="0" max="100"
              value={d.threshold} onChange={(e) => setD((x) => ({ ...x, threshold: e.target.value }))} aria-invalid={!!errs.threshold}
              aria-describedby={errs.threshold ? 'al-threshold-err' : isNum(cur) ? 'al-threshold-hint' : undefined} />
            <span className="input-unit">{unit}</span>
          </div>
        </Field>
        {already && <Banner tone="info" icon="info">The condition is already met. The first alert fires within about 30 seconds of saving.</Banner>}
        <Field id="al-cooldown" label="Cooldown" hint="Minimum time between two alerts from this rule.">
          <select id="al-cooldown" className="select" value={d.cooldown} onChange={(e) => setD((x) => ({ ...x, cooldown: Number(e.target.value) }))} aria-describedby="al-cooldown-hint">
            {COOLDOWNS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <div className="preview-box" aria-live="polite">
          <p className="label">Preview</p>
          <p>{d.marketId && d.threshold !== '' && Number.isFinite(num) ? `Notify me when the ${lcFirst(ruleText({ ...d, threshold: num }))}, at most once every ${cooldownLabel(d.cooldown)}.` : 'Choose a market and a threshold to see the rule in plain words.'}</p>
        </div>
        <p className="muted small"><Icon n="info" size={13} /> Banthom only checks rules on current data, so a delayed quote can’t trigger one. Alerts describe prices, not trades you could make at them.</p>
        {errs.form && <p className="field-error" role="alert"><Icon n="circle-alert" size={14} />{errs.form}</p>}
      </form>
    </Sheet>
  );
}

function Delivery() {
  const { prefs, setPref, toast } = useStore();
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported');
  const on = !!prefs.browserNotify && perm === 'granted';
  const change = async (v) => {
    if (!v) { setPref('browserNotify', false); return; }
    let p = perm;
    if (p === 'default') {
      try { p = await Notification.requestPermission(); } catch { p = 'denied'; }
      setPerm(p);
    }
    if (p === 'granted') { setPref('browserNotify', true); toast('Browser notifications are on.'); }
    else toast('Your browser blocked notifications. You can allow them in its site settings.', { tone: 'error' });
  };
  const hint = perm === 'unsupported' ? 'This browser doesn’t support notifications.'
    : perm === 'denied' ? 'Blocked in this browser’s site settings. Allow notifications for this site, then reload.'
      : 'A system notification when a rule fires, even if this tab is in the background. Banthom still has to be open.';
  return (
    <Panel title="Delivery" className="narrow-panel">
      <Switch label="In-app notices" hint="Always on. Shown at the bottom of the screen and in the alerts menu." checked onChange={() => {}} disabled />
      <Switch label="Browser notifications" hint={hint} checked={on} onChange={change} disabled={perm === 'unsupported' || perm === 'denied'} />
      <Switch label="Email" hint="Needs an account. Banthom doesn’t have sign-in yet." checked={false} onChange={() => {}} disabled />
    </Panel>
  );
}

export function Alerts() {
  useTitle('Alerts');
  const { alerts, history, unread, markRead, clearHistory, toggleAlert, removeAlert } = useStore();
  const mobile = useMedia('(max-width: 767px)');
  const [tab, setTab] = useState('rules');
  const [editor, setEditor] = useState({ open: false, initial: null });
  const ids = useMemo(() => [...new Set(alerts.map((a) => a.marketId))], [alerts]);
  const { data } = usePolled(API2.quotes(ids), 30000);
  const quotes = useMemo(() => Object.fromEntries(((data && data.quotes) || []).map((x) => [x.id, x])), [data]);
  const open = (initial) => setEditor({ open: true, initial });
  const nowCell = (a) => {
    const q = quotes[a.marketId];
    if (!q) return <span className="muted">—</span>;
    if (q.missing) return <Badge tone="muted" size="sm">Closed</Badge>;
    const v = valueOf(a.metric, q);
    return <span className={cx('mono', a.enabled && ruleHit(a, q) && 'strong')}>{fmtMetric(a.metric, v)}</span>;
  };
  const actions = (a) => [{ label: 'Edit', icon: 'pencil', onClick: () => open(a) }, { label: a.enabled ? 'Pause' : 'Resume', icon: a.enabled ? 'pause' : 'play', onClick: () => toggleAlert(a.id) }, { label: 'Delete', icon: 'trash-2', danger: true, onClick: () => removeAlert(a.id) }];

  return (
    <div className="page-stack">
      <PageHeader title="Alerts" sub="Get notified when a market crosses your threshold" actions={<Button variant="primary" icon="bell-plus" onClick={() => open(null)}>Create alert</Button>} />
      <Banner tone="info" icon="monitor" title="Alerts run in this browser while Banthom is open.">
        Rules and history are saved in this browser only. Banthom checks enabled rules every 30 seconds against current Kalshi and Polymarket quotes; nothing is checked while every Banthom tab is closed.
      </Banner>
      <Tabs idBase="al" label="Alerts sections" value={tab} onChange={setTab}
        tabs={[{ id: 'rules', label: 'Rules', count: alerts.length }, { id: 'history', label: 'History', count: unread || undefined }, { id: 'delivery', label: 'Delivery' }]} />
      <TabPanel idBase="al" id="rules" value={tab}>
        {alerts.length === 0 ? (
          <Panel><EmptyState title="No alert rules yet." action={<Button variant="primary" icon="bell-plus" onClick={() => open(null)}>Create alert</Button>}>Create a rule on any Kalshi or Polymarket market, or use “Create alert” on a market page.</EmptyState></Panel>
        ) : mobile ? (
          <ul className="acards">
            {alerts.map((a) => (
              <li key={a.id} className={cx('acard', !a.enabled && 'is-off')}>
                <div className="row-between">
                  <span className="row"><VenueBadge venue={a.venue} /><a href={marketHref(a.marketId)} className="link-plain strong">{itemName(a)}</a></span>
                  <Switch label={<span className="sr-only">Enabled</span>} checked={a.enabled} onChange={() => toggleAlert(a.id)} />
                </div>
                <p className="small">{condText(a)} · now {nowCell(a)}</p>
                <div className="row-between">
                  <span className="muted small">Last fired {a.lastFiredAt ? when(a.lastFiredAt) : 'never'} · cooldown {cooldownLabel(a.cooldown)}</span>
                  <MenuButton label={`Actions for alert on ${itemName(a)}`} items={actions(a)} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="panel table-panel">
            <div className="table-scroll">
              <table className="table">
                <caption className="sr-only">Alert rules</caption>
                <thead><tr><th scope="col">Market</th><th scope="col">Rule</th><th scope="col" className="num">Now</th><th scope="col">Cooldown</th><th scope="col">Last fired</th><th scope="col">On</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id} className={cx(!a.enabled && 'row-off')}>
                      <td className="mkt-td"><div className="mkt-cell"><a href={marketHref(a.marketId)}>{a.multi ? a.label : itemName(a)}</a><span className="mkt-cell-sub"><VenueBadge venue={a.venue} />{a.multi ? ` ${a.eventTitle}` : ''}</span></div></td>
                      <td className="nowrap">{condText(a)}</td>
                      <td className="num">{nowCell(a)}</td>
                      <td>{cooldownLabel(a.cooldown)}</td>
                      <td className="nowrap">{a.lastFiredAt ? when(a.lastFiredAt) : <span className="muted">Never</span>}</td>
                      <td><Switch label={<span className="sr-only">Rule on {itemName(a)} enabled</span>} checked={a.enabled} onChange={() => toggleAlert(a.id)} /></td>
                      <td className="cell-tight"><MenuButton label={`Actions for alert on ${itemName(a)}`} items={actions(a)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {alerts.length > 0 && <p className="panel-note tab-note"><Icon n="info" size={14} />{pluralize(alerts.filter((a) => a.enabled).length, 'rule')} on. A rule fires at most once per cooldown, and only on quotes Banthom fetched within the last few minutes.</p>}
      </TabPanel>
      <TabPanel idBase="al" id="history" value={tab}>
        <Panel title="History" sub="Newest first · last 200 kept in this browser"
          actions={history.length ? <>{unread > 0 && <Button size="sm" variant="ghost" icon="check" onClick={() => markRead(null)}>Mark all as read</Button>}<Button size="sm" variant="ghost" icon="trash-2" onClick={clearHistory}>Clear</Button></> : null}>
          {history.length === 0 ? <EmptyState compact title="Nothing has fired yet.">Fired alerts appear here with the value that triggered them.</EmptyState> : (
            <ol className="hist">
              {history.map((h) => (
                <li key={h.id} className={cx(h.unread && 'is-unread')}>
                  <span className="hist-time mono">{fmtDateShort(h.t)}<br />{fmtTimeSec(h.t)}</span>
                  <div className="grow">
                    <p>{h.text}</p>
                    {h.marketId && <a className="small" href={marketHref(h.marketId)}>Open market</a>}
                  </div>
                  {h.unread && <button type="button" className="btn btn-link small" onClick={() => markRead(h.id)}>Mark read</button>}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </TabPanel>
      <TabPanel idBase="al" id="delivery" value={tab}><Delivery /></TabPanel>
      <AlertEditor open={editor.open} initial={editor.initial} onClose={() => setEditor({ open: false, initial: null })} />
    </div>
  );
}
