import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, EmptyState, VenueBadge, Delta, Popover, Field } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { useMedia, go } from '../lib/hooks.js';
import { EVENT_BY_ID, MARKET_BY_ID, VENUES } from '../data/fixtures.js';
import { fmtCents, fmtTimeSec, pluralize, cx, midOf } from '../lib/format.js';
import { useMarketRows, useTitle, QuoteNum, StarButton, DataAge, SortHeader, sortRows, rowKeyNav } from './kit.jsx';

const { useState, useMemo, useRef, useCallback, useEffect } = React;

function NewList({ onCreate }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const btn = useRef(null);
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Name the watchlist.'); return; }
    onCreate(name.trim());
    setName(''); setErr(null); setOpen(false);
  };
  return (
    <div className="pop-wrap">
      <Button ref={btn} variant="primary" icon="plus" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>New watchlist</Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} align="end" label="New watchlist" className="popover-pad" width={300}>
        <form className="stack-sm" onSubmit={submit}>
          <Field id="wl-name" label="Name" error={err}>
            <input id="wl-name" data-autofocus className="input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err} aria-describedby={err ? 'wl-name-err' : undefined} placeholder="e.g. Election week" />
          </Field>
          <Button type="submit" variant="primary" size="sm">Create</Button>
        </form>
      </Popover>
    </div>
  );
}

function EditableText({ value, onSave, label, heading, placeholder }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (edit) {
    return (
      <form className="editable-form" onSubmit={(e) => { e.preventDefault(); onSave(v.trim()); setEdit(false); }}>
        <label className="sr-only" htmlFor={`edit-${label}`}>{label}</label>
        <input id={`edit-${label}`} className="input input-sm" value={v} autoFocus onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setV(value); setEdit(false); } }} />
        <Button type="submit" size="sm" variant="primary">Save</Button>
        <Button size="sm" variant="ghost" onClick={() => { setV(value); setEdit(false); }}>Cancel</Button>
      </form>
    );
  }
  return (
    <div className="editable">
      {heading ? <h2 className="panel-title">{value}</h2> : <p className="panel-sub">{value || <span className="muted">{placeholder}</span>}</p>}
      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEdit(true)} aria-label={`Edit ${label}`}><Icon n="pencil" size={14} />Edit</button>
    </div>
  );
}

export function Watchlists({ listId }) {
  useTitle('Watchlists');
  const { watchlists, createList, updateList, alerts } = useStore();
  const mobile = useMedia('(max-width: 767px)');
  const [sel, setSel] = useState(listId || (watchlists[0] && watchlists[0].id));
  const [sort, setSort] = useState({ key: 'ch24abs', dir: 'desc' });
  const list = watchlists.find((w) => w.id === sel) || watchlists[0];
  const ids = list ? list.ids : [];
  const filter = useCallback((mk) => ids.includes(mk.id), [ids]);
  const rows = useMarketRows(filter);
  const allRows = useMarketRows(null);
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const listAlerts = alerts.filter((a) => ids.includes(a.marketId));
  const summary = (w) => {
    const rs = allRows.filter((r) => w.ids.includes(r.id));
    const top = sortRows(rs, { key: 'ch24abs', dir: 'desc' })[0];
    const latest = rs.length ? Math.max(...rs.map((r) => r.q.observedAt)) : null;
    return { top, latest, n: rs.length };
  };

  return (
    <div className="page-stack">
      <PageHeader title="Watchlists" sub="Saved markets, with their latest quotes and alerts" actions={<NewList onCreate={(name) => setSel(createList(name))} />} />
      {mobile && (
        <div className="field">
          <label htmlFor="wl-select" className="field-label">Watchlist</label>
          <select id="wl-select" className="select" value={list ? list.id : ''} onChange={(e) => setSel(e.target.value)}>
            {watchlists.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.ids.length})</option>)}
          </select>
        </div>
      )}
      <div className="grid">
        {!mobile && (
          <div className="s-4 col-stack" role="list" aria-label="Your watchlists">
            {watchlists.map((w) => {
              const s = summary(w);
              const active = list && w.id === list.id;
              return (
                <button key={w.id} type="button" role="listitem" className={cx('wl-tile', active && 'is-active')} aria-current={active ? 'true' : undefined} onClick={() => setSel(w.id)}>
                  <span className="row-between"><span className="strong">{w.name}</span><Badge tone="muted" size="sm">{pluralize(s.n, 'market')}</Badge></span>
                  <span className="muted small">{s.latest ? `Latest update ${fmtTimeSec(s.latest)}` : 'No markets yet'}</span>
                  {s.top && <span className="wl-mover"><span className="small">Largest mover: {s.top.mk.outcome} ({VENUES[s.top.mk.venue].short})</span><Delta value={s.top.ch24} /></span>}
                </button>
              );
            })}
            <p className="muted small">Sharing watchlists with a team is planned for a later phase.</p>
          </div>
        )}
        <div className={mobile ? 's-12' : 's-8'}>
          {list && (
            <Panel flush className="table-panel">
              <div className="wl-head">
                <div className="grow">
                  <EditableText heading value={list.name} label="watchlist name" onSave={(v) => v && updateList(list.id, { name: v })} />
                  <EditableText value={list.description} label="description" placeholder="Add a description" onSave={(v) => updateList(list.id, { description: v })} />
                </div>
                <Button size="sm" variant="ghost" icon="download" aria-disabled="true" data-tip="Export isn’t permitted for demo data. Where licensed, exports include snapshot time and methodology version.">Export</Button>
              </div>
              {ids.length === 0 ? (
                <EmptyState title="No markets saved yet." action={<Button variant="primary" href="#app-markets">Explore markets</Button>}>Explore markets to build this list. Star a market to add it to My markets.</EmptyState>
              ) : mobile ? (
                <ul className="mcards wl-cards">
                  {sorted.map((r) => (
                    <li key={r.id} className="mcard">
                      <div className="mcard-top"><div className="grow"><a href={`#app-market-${r.id}`} className="mcard-title">{r.mk.title}</a><p className="mkt-cell-sub">{EVENT_BY_ID[r.mk.eventId].title}</p></div><StarButton id={r.id} listId={list.id} /></div>
                      <div className="mcard-quote"><VenueBadge venue={r.mk.venue} /><span className="mcard-q"><span className="label">Bid</span><QuoteNum value={r.bid} changedAt={r.q.changedAt} /></span><span className="mcard-q"><span className="label">Ask</span><QuoteNum value={r.ask} changedAt={r.q.changedAt} /></span><span className="mcard-q"><span className="label">24h</span><Delta value={r.ch24} /></span></div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <caption className="sr-only">{list.name}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="cell-tight"><span className="sr-only">Remove</span></th>
                        <SortHeader col="title" sort={sort} setSort={setSort}>Market</SortHeader>
                        <SortHeader col="venue" sort={sort} setSort={setSort}>Venue</SortHeader>
                        <SortHeader col="bid" sort={sort} setSort={setSort} num>Yes bid</SortHeader>
                        <SortHeader col="ask" sort={sort} setSort={setSort} num>Yes ask</SortHeader>
                        <SortHeader col="ch24abs" sort={sort} setSort={setSort} num>24h</SortHeader>
                        <SortHeader col="observedAt" sort={sort} setSort={setSort} num>Age</SortHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r) => (
                        <tr key={r.id} tabIndex={0} onKeyDown={(e) => { if (e.target === e.currentTarget) rowKeyNav(e, () => go(`app-market-${r.id}`)); }} aria-label={r.mk.title}>
                          <td className="cell-tight"><StarButton id={r.id} listId={list.id} /></td>
                          <td className="mkt-td"><div className="mkt-cell"><a href={`#app-market-${r.id}`} tabIndex={-1}>{r.mk.title}</a><span className="mkt-cell-sub">{EVENT_BY_ID[r.mk.eventId].title}</span></div></td>
                          <td><VenueBadge venue={r.mk.venue} /></td>
                          <td className="num"><QuoteNum value={r.bid} changedAt={r.q.changedAt} /></td>
                          <td className="num"><QuoteNum value={r.ask} changedAt={r.q.changedAt} /></td>
                          <td className="num"><Delta value={r.ch24} /></td>
                          <td className="num"><DataAge mk={r.mk} q={r.q} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {ids.length > 0 && (
                <div className="panel-foot row-between">
                  <span>{listAlerts.length ? `${pluralize(listAlerts.filter((a) => a.enabled).length, 'active alert')} on these markets.` : 'No alerts on these markets.'} <a href="#app-alerts">Manage alerts</a></span>
                  <span>Removing a market shows an undo option.</span>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
      {mobile && <a href="#app-markets" className="fab" aria-label="Find markets to add"><Icon n="plus" size={22} /></a>}
    </div>
  );
}
