// Watchlists: markets you follow, saved in this browser, with live Kalshi and Polymarket quotes.
import React from 'react';
import { Icon, Button, IconButton, Badge, Panel, PageHeader, EmptyState, VenueBadge, Popover, Field, MenuButton } from '../ui/core.jsx';
import { useStore, itemOf, itemName } from '../store.jsx';
import { useMedia } from '../lib/hooks.js';
import { fmtTimeSec, pluralize, cx } from '../lib/format.js';
import { usePolled, API2, marketHref } from '../data/live.js';
import { useTitle, MarketList, MarketSearch, useSorted, FeedBanners } from './kit.jsx';

const { useState, useRef, useEffect } = React;
const MAX_QUOTED = 200;

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
            <input id="wl-name" autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err} aria-describedby={err ? 'wl-name-err' : undefined} placeholder="e.g. Election week" maxLength={60} />
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
  const id = `edit-${label.replace(/\s+/g, '-')}`;
  if (edit) {
    return (
      <form className="editable-form" onSubmit={(e) => { e.preventDefault(); onSave(v.trim()); setEdit(false); }}>
        <label className="sr-only" htmlFor={id}>{label}</label>
        <input id={id} className="input input-sm" value={v} autoFocus maxLength={heading ? 60 : 200} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setV(value); setEdit(false); } }} />
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
  const { watchlists, createList, updateList, deleteList, toggleWatch, alerts } = useStore();
  const mobile = useMedia('(max-width: 767px)');
  const [sel, setSel] = useState(listId || (watchlists[0] && watchlists[0].id));
  useEffect(() => { if (listId) setSel(listId); }, [listId]);
  const [sort, setSort] = useState({ key: 'ch24abs', dir: 'desc' });
  const list = watchlists.find((w) => w.id === sel) || watchlists[0];
  const items = list ? list.items : [];
  const ids = items.map((it) => it.id);
  const { data, error } = usePolled(API2.quotes(ids), 30000);
  const quotes = data && data.quotes ? data.quotes : [];
  const live = quotes.filter((q) => !q.missing);
  const gone = items.filter((it) => quotes.some((q) => q.missing && q.id === it.id));
  const rows = useSorted(live, sort);
  const listAlerts = alerts.filter((a) => ids.includes(a.marketId));
  const latest = live.length ? Math.max(...live.map((r) => r.observedAt || 0)) : null;
  const remove = (it) => toggleWatch(it, list.id);
  const removeBtn = (r) => <IconButton icon="x" size="sm" label={`Remove ${itemName(r)} from ${list.name}`} tipPos="left" onClick={() => remove(itemOf(r))} />;

  return (
    <div className="page-stack">
      <PageHeader title="Watchlists" sub="Markets you follow, with live quotes. Saved in this browser." actions={<NewList onCreate={(name) => setSel(createList(name))} />} />
      {data && <FeedBanners status={data.status} />}
      {mobile && (
        <div className="field">
          <label htmlFor="wl-select" className="field-label">Watchlist</label>
          <select id="wl-select" className="select" value={list ? list.id : ''} onChange={(e) => setSel(e.target.value)}>
            {watchlists.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.items.length})</option>)}
          </select>
        </div>
      )}
      <div className="grid">
        {!mobile && (
          <div className="s-3 col-stack" role="list" aria-label="Your watchlists">
            {watchlists.map((w) => {
              const active = list && w.id === list.id;
              return (
                <button key={w.id} type="button" role="listitem" className={cx('wl-tile', active && 'is-active')} aria-current={active ? 'true' : undefined} onClick={() => setSel(w.id)}>
                  <span className="row-between"><span className="strong">{w.name}</span><Badge tone="muted" size="sm">{pluralize(w.items.length, 'market')}</Badge></span>
                  {w.description && <span className="muted small">{w.description}</span>}
                </button>
              );
            })}
            <p className="muted small">Watchlists live in this browser. Sign-in and sharing come later.</p>
          </div>
        )}
        <div className={mobile ? 's-12' : 's-9'}>
          {list && (
            <Panel flush className="table-panel">
              <div className="wl-head">
                <div className="grow">
                  <EditableText heading value={list.name} label="watchlist name" onSave={(v) => v && updateList(list.id, { name: v })} />
                  <EditableText value={list.description} label="description" placeholder="Add a description" onSave={(v) => updateList(list.id, { description: v })} />
                </div>
                {list.id !== 'my-markets' && (
                  <MenuButton label={`Actions for ${list.name}`} items={[{ label: 'Delete watchlist', icon: 'trash-2', danger: true, onClick: () => { deleteList(list.id); setSel('my-markets'); } }]} />
                )}
              </div>
              <div className="wl-add">
                <label className="sr-only" htmlFor="wl-add">Add a market to {list.name}</label>
                <MarketSearch id="wl-add" placeholder={`Add a market to ${list.name}`} exclude={(id) => ids.includes(id)}
                  onPick={(r) => toggleWatch(itemOf(r), list.id)} />
              </div>
              {items.length === 0 ? (
                <EmptyState title="No markets in this list yet." action={<Button variant="secondary" href="#app-markets">Browse markets</Button>}>
                  Search above, or use the star or the list button on any market.
                </EmptyState>
              ) : error && !data ? (
                <EmptyState compact title="Couldn’t load quotes.">{error.message}</EmptyState>
              ) : !data ? (
                <p className="muted small wl-loading">Loading quotes…</p>
              ) : (
                <>
                  {rows.length > 0 && <MarketList rows={rows} cols={['venue', 'bid', 'ask', 'mid', 'ch24', 'closes', 'age']} sort={sort} setSort={setSort} caption={list.name} extra={removeBtn} star={false} />}
                  {gone.length > 0 && (
                    <div className="wl-gone">
                      <p className="label">No longer trading</p>
                      <ul className="related">
                        {gone.map((it) => (
                          <li key={it.id} className="related-link">
                            <VenueBadge venue={it.venue} />
                            <span className="grow related-name">{itemName(it)}</span>
                            <Button size="sm" variant="ghost" onClick={() => remove(it)}>Remove</Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              {items.length > 0 && (
                <div className="panel-foot row-between">
                  <span>{listAlerts.length ? `${pluralize(listAlerts.filter((a) => a.enabled).length, 'alert')} on these markets.` : 'No alerts on these markets.'} <a href="#app-alerts">Manage alerts</a></span>
                  <span>{latest ? `Latest quote ${fmtTimeSec(latest)}` : ''}{items.length > MAX_QUOTED ? ` · Quotes shown for the first ${MAX_QUOTED}` : ''}</span>
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
