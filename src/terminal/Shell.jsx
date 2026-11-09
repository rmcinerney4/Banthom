import React from 'react';
import ReactDOM from 'react-dom';
import { Icon, IconButton, Logo, LogoMark, Badge, Kbd, Popover, MenuButton, Sheet, Breadcrumbs, VenueBadge, DemoTag, Switch } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { useFocusTrap, go, useNow } from '../lib/hooks.js';
import { cx, fmtTimeSec, fmtAge, fmtTime, fmtCents, midOf, fmtDateShort } from '../lib/format.js';
import { MARKETS, EVENTS, VENUES, CATEGORIES } from '../data/fixtures.js';
import { useFeed } from '../data/quotes.js';
import { useVenueStates } from './kit.jsx';

const { useState, useRef, useMemo, useEffect } = React;

export const NAV_MAIN = [
  { id: 'dashboard', label: 'Overview', icon: 'layout-dashboard', href: '#app-dashboard' },
  { id: 'markets', label: 'Markets', icon: 'list-filter', href: '#app-markets' },
  { id: 'compare', label: 'Compare', icon: 'git-compare-arrows', href: '#app-compare' },
  { id: 'research', label: 'Research', icon: 'newspaper', href: '#app-research' },
  { id: 'watchlists', label: 'Watchlists', icon: 'star', href: '#app-watchlists' },
  { id: 'alerts', label: 'Alerts', icon: 'bell', href: '#app-alerts' },
  { id: 'workspaces', label: 'Workspaces', icon: 'panels-top-left', href: '#app-workspaces' },
  { id: 'analytics', label: 'Analytics', icon: 'chart-column', href: '#app-analytics' },
];
const NAV_FOOT = [
  { id: 'help', label: 'Help', icon: 'circle-help', href: '#app-help' },
  { id: 'settings', label: 'Settings', icon: 'settings', href: '#app-settings' },
];

// ---------------------------------------------------------------- Sidebar (232px / 68px rail)
export function SidebarNav({ active, collapsed, onNavigate, onSearch, onToggle, inDrawer }) {
  const { unread } = useStore();
  const [catsOpen, setCatsOpen] = useState(true);
  const item = (it) => {
    const isActive = active === it.id;
    const badge = it.id === 'alerts' && unread ? unread : null;
    return (
      <li key={it.id}>
        <a href={it.href} className={cx('side-link', isActive && 'is-active')} aria-current={isActive ? 'page' : undefined}
          data-tip={collapsed ? it.label : undefined} data-tip-pos="right" onClick={onNavigate}>
          <Icon n={it.icon} size={18} />
          <span className="side-label">{it.label}</span>
          {badge ? <span className="side-badge" aria-label={`${badge} unread`}>{badge}</span> : null}
        </a>
      </li>
    );
  };
  return (
    <div className={cx('side-inner', collapsed && 'is-collapsed')}>
      <div className="side-top">
        {collapsed ? <Logo href="#app-dashboard" hideWord label="Banthom overview" /> : <Logo href="#app-dashboard" label="Banthom overview" />}
        {!collapsed && !inDrawer && <IconButton icon="panel-left-close" label="Collapse sidebar" size="sm" onClick={onToggle} tipPos="right" />}
      </div>
      <button type="button" className="side-search" onClick={onSearch} data-tip={collapsed ? 'Search (Ctrl K)' : undefined} data-tip-pos="right" aria-label="Search events, markets, venues">
        <Icon n="search" size={16} />
        <span className="side-label">Search…</span>
        <span className="side-label side-kbd"><Kbd>⌘K</Kbd></span>
      </button>
      <nav aria-label="Terminal" className="side-nav">
        <ul>{NAV_MAIN.map(item)}</ul>
        <div className="side-group">
          {!collapsed ? (
            <button type="button" className="side-group-btn" aria-expanded={catsOpen} onClick={() => setCatsOpen((o) => !o)}>
              <span>Categories</span><Icon n="chevron-down" size={14} />
            </button>
          ) : <div className="side-sep" />}
          {(catsOpen || collapsed) && (
            <ul>
              {CATEGORIES.map((c) => item({ id: `cat-${c.id}`, label: c.label, icon: c.icon, href: `#app-markets-${c.id}` }))}
            </ul>
          )}
        </div>
      </nav>
      <div className="side-foot">
        <ul>{NAV_FOOT.map(item)}</ul>
        <div className="side-profile">
          <span className="avatar" aria-hidden="true">DA</span>
          <span className="side-label side-profile-text"><span className="strong">Demo analyst</span><span className="muted small">Sample workspace</span></span>
        </div>
        {collapsed && !inDrawer && <IconButton icon="panel-left-open" label="Expand sidebar" size="sm" onClick={onToggle} tipPos="right" className="side-expand" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Demo banner (conspicuous DEMO label + scenario controls)
export const SCENARIOS = [
  { id: 'normal', label: 'Normal' },
  { id: 'brs-delayed', label: 'Brisa feed delayed' },
  { id: 'empty', label: 'New account (empty)' },
  { id: 'ai-down', label: 'Research sources unavailable' },
];
export function DemoBanner() {
  const { prefs, setPref } = useStore();
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  return (
    <div className="demo-banner" role="region" aria-label="Demo notice">
      <DemoTag />
      <p className="demo-text"><span className="demo-long">Simulated data. Venues, prices, headlines and sources are fictional.</span><span className="demo-short">Simulated data</span></p>
      <div className="demo-controls">
        <button type="button" className="demo-btn" aria-pressed={!prefs.updates} onClick={() => setPref('updates', !prefs.updates)}>
          <Icon n={prefs.updates ? 'pause' : 'play'} size={14} /><span className="demo-long">{prefs.updates ? 'Pause updates' : 'Resume updates'}</span><span className="demo-short">{prefs.updates ? 'Pause' : 'Resume'}</span>
        </button>
        <div className="pop-wrap">
          <button ref={btn} type="button" className="demo-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
            <Icon n="sliders-horizontal" size={14} /><span className="demo-long">Scenario: </span>{SCENARIOS.find((s) => s.id === prefs.scenario)?.label || 'Normal'}<Icon n="chevron-down" size={12} />
          </button>
          <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} align="end" label="Demo scenarios" className="popover-pad scenario-pop">
            <p className="label">Show the terminal in a different state</p>
            <div role="radiogroup" aria-label="Scenario" className="scenario-list">
              {SCENARIOS.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={prefs.scenario === s.id} className="scenario-opt"
                  onClick={() => { setPref('scenario', s.id); setOpen(false); }}>
                  <span className="radio-dot" aria-hidden="true" />{s.label}
                </button>
              ))}
            </div>
            <div className="scenario-sep" />
            <Switch label="Highlight price changes" checked={prefs.highlight} onChange={(v) => setPref('highlight', v)} />
          </Popover>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Top bar
function FeedStatusPill() {
  const states = useVenueStates();
  const { prefs } = useStore();
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  const delayed = states.filter((s) => s.status === 'delayed').length;
  const latest = Math.max(...states.map((s) => s.lastAt));
  return (
    <div className="pop-wrap">
      <button ref={btn} type="button" className={cx('feed-pill', delayed ? 'is-warn' : 'is-ok')} aria-expanded={open} onClick={() => setOpen((o) => !o)}
        aria-label={`Feed status: demo feed, ${delayed ? `${delayed} source delayed` : 'all sources recent'}. Last update ${fmtTimeSec(latest)}.`}>
        <span className="feed-dot" aria-hidden="true" />
        <span className="feed-text">{delayed ? `${delayed} source delayed` : 'Demo feed'}</span>
        <span className="feed-time mono">{fmtTimeSec(latest).replace(' ET', '')}</span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} align="end" label="Source freshness" className="popover-pad feed-pop" width={320}>
        <p className="strong">Source freshness</p>
        <p className="muted small">{prefs.updates ? 'Simulated feed. Never labelled Live.' : 'Updates paused. Timestamps have stopped advancing.'}</p>
        <ul className="feed-list">
          {states.map((s) => (
            <li key={s.venue}>
              <VenueBadge venue={s.venue} />
              <span className="grow">{VENUES[s.venue].name}</span>
              <Badge tone={s.status === 'delayed' ? 'warning' : 'success'} icon={s.status === 'delayed' ? 'clock' : 'circle-dot'}>
                {s.status === 'delayed' ? `Delayed · ${fmtAge(s.age)}` : `Recent · ${fmtAge(s.age)}`}
              </Badge>
            </li>
          ))}
        </ul>
        <a href="#methodology" className="small">How freshness is defined</a>
      </Popover>
    </div>
  );
}

function AlertsBell() {
  const { history, unread, markRead } = useStore();
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  return (
    <div className="pop-wrap">
      <IconButton ref={btn} icon="bell" label={unread ? `Alerts, ${unread} unread` : 'Alerts'} badge={unread || null} aria-expanded={open} onClick={() => setOpen((o) => !o)} tipPos="bottom" />
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} align="end" label="Recent alerts" className="popover-pad alerts-pop" width={360}>
        <div className="row-between"><p className="strong">Recent alerts</p>{unread ? <button type="button" className="btn btn-link small" onClick={() => markRead(null)}>Mark all read</button> : null}</div>
        {history.length ? (
          <ul className="alert-mini">
            {history.slice(0, 3).map((h) => (
              <li key={h.id} className={cx(h.unread && 'is-unread')}>
                <span className="mono muted small">{fmtDateShort(h.t)}, {fmtTime(h.t)}</span>
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">No alerts yet. Create one from any market.</p>}
        <a href="#app-alerts" className="btn btn-secondary btn-sm btn-block" onClick={() => setOpen(false)}>Open alerts</a>
      </Popover>
    </div>
  );
}

export function Topbar({ crumbs, mode, onMenu, onSearch }) {
  const { resetDemo } = useStore();
  return (
    <header className="topbar">
      {(mode === 'drawer' || mode === 'mobile') && (
        <IconButton icon="menu" label="Open navigation" onClick={onMenu} className={cx(mode === 'mobile' && 'hide-mobile')} tip={false} />
      )}
      {mode === 'mobile' && <a href="#app-dashboard" className="topbar-logo" aria-label="Banthom overview"><LogoMark size={26} /></a>}
      <div className="topbar-crumbs">{crumbs && <Breadcrumbs items={crumbs} />}</div>
      <button type="button" className="topbar-search" onClick={onSearch} aria-label="Search events, markets, venues (Ctrl K)">
        <Icon n="search" size={16} />
        <span className="topbar-search-text">Search events, markets, venues…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <div className="topbar-right">
        <FeedStatusPill />
        <AlertsBell />
        <span className="plan-badge" data-tip="Sample workspace on simulated data" data-tip-pos="bottom" tabIndex={0}>Demo plan</span>
        <MenuButton label="Account menu" icon="user-round" variant="ghost" size="md" align="end" items={[
          { label: 'Settings', icon: 'settings', onClick: () => go('app-settings') },
          { label: 'Help and shortcuts', icon: 'keyboard', onClick: () => go('app-help') },
          { sep: true },
          { label: 'Reset demo data', icon: 'rotate-ccw', onClick: resetDemo },
          { label: 'Back to website', icon: 'arrow-left', onClick: () => go('home') },
        ]} />
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- Mobile tab bar and More sheet
export function MobileTabbar({ active, onMore }) {
  const { unread } = useStore();
  const tabs = [
    ['dashboard', 'Home', 'layout-dashboard', '#app-dashboard'],
    ['markets', 'Markets', 'list-filter', '#app-markets'],
    ['compare', 'Compare', 'git-compare-arrows', '#app-compare'],
    ['research', 'Research', 'newspaper', '#app-research'],
  ];
  const moreActive = !['dashboard', 'markets', 'compare', 'research'].includes(active);
  return (
    <nav className="tabbar" aria-label="Primary">
      {tabs.map(([id, label, icon, href]) => (
        <a key={id} href={href} className={cx('tabbar-item', active === id && 'is-active')} aria-current={active === id ? 'page' : undefined}>
          <Icon n={icon} size={20} /><span>{label}</span>
        </a>
      ))}
      <button type="button" className={cx('tabbar-item', moreActive && 'is-active')} onClick={onMore} aria-haspopup="dialog">
        <span className="tabbar-icon"><Icon n="ellipsis" size={20} />{unread ? <span className="tabbar-dot" aria-hidden="true" /> : null}</span>
        <span>More{unread ? <span className="sr-only">, {unread} unread alerts</span> : null}</span>
      </button>
    </nav>
  );
}

export function MoreSheet({ open, onClose, active }) {
  const { unread } = useStore();
  const items = [...NAV_MAIN.filter((n) => !['dashboard', 'markets', 'compare', 'research'].includes(n.id)), ...NAV_FOOT];
  return (
    <Sheet open={open} onClose={onClose} title="More" side="bottom" className="more-sheet">
      <ul className="more-list">
        {items.map((it) => (
          <li key={it.id}>
            <a href={it.href} className={cx('more-link', active === it.id && 'is-active')} onClick={onClose} aria-current={active === it.id ? 'page' : undefined}>
              <Icon n={it.icon} size={20} /><span className="grow">{it.label}</span>
              {it.id === 'alerts' && unread ? <span className="side-badge">{unread}</span> : <Icon n="chevron-right" size={16} />}
            </a>
          </li>
        ))}
        <li><a href="#home" className="more-link" onClick={onClose}><Icon n="arrow-left" size={20} /><span className="grow">Back to website</span></a></li>
      </ul>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Command palette (Ctrl/Cmd K or /)
const PAGES = [
  ...NAV_MAIN.map((n) => ({ label: n.label, href: n.href, icon: n.icon })),
  { label: 'Settings', href: '#app-settings', icon: 'settings' },
];
const HELP = [
  { label: 'Price definitions: bid, ask, midpoint, spread', href: '#methodology', icon: 'book-open' },
  { label: 'How contract matching works', href: '#methodology', icon: 'badge-check' },
  { label: 'Keyboard shortcuts', href: '#app-help', icon: 'keyboard' },
];
const VIEWS = [
  { label: 'Most active', href: '#app-markets', icon: 'activity', view: 'active' },
  { label: 'Largest movers', href: '#app-markets', icon: 'trending-up', view: 'movers' },
  { label: 'Closing soon', href: '#app-markets', icon: 'timer', view: 'closing' },
  { label: 'Watchlist', href: '#app-markets', icon: 'star', view: 'watchlist' },
];
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s.%-]/g, ' ');

export function searchAll(raw) {
  let q = raw.trim();
  const filters = {};
  q = q.replace(/\b(venue|cat|category):(\S+)/gi, (_, k, v) => { filters[k.toLowerCase().startsWith('cat') ? 'cat' : 'venue'] = v.toLowerCase(); return ''; }).trim();
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const hit = (text) => terms.every((t) => norm(text).includes(t));
  const okVenue = (v) => !filters.venue || v.toLowerCase() === filters.venue || VENUES[v].name.toLowerCase().includes(filters.venue);
  const okCat = (c) => !filters.cat || c.startsWith(filters.cat);
  const events = EVENTS.filter((e) => okCat(e.category) && (!terms.length || hit(`${e.title} ${e.sub} ${e.category} ${e.summary}`))).slice(0, terms.length ? 5 : 3);
  const contracts = MARKETS.filter((m) => okVenue(m.venue) && okCat(EVENTS.find((e) => e.id === m.eventId).category)
    && (!terms.length || hit(`${m.title} ${m.sourceTitle} ${m.ref} ${m.venue} ${VENUES[m.venue].name} ${m.outcome}`))).slice(0, terms.length ? 7 : 4);
  const views = terms.length ? VIEWS.filter((v) => hit(v.label)) : [];
  const pages = terms.length ? PAGES.filter((p) => hit(p.label)) : PAGES.slice(0, 4);
  const help = terms.length ? HELP.filter((h) => hit(h.label)) : [];
  return { events, contracts, views, pages, help, filters, terms };
}

export function CommandPalette({ open, onClose, onView }) {
  const ref = useRef(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const feed = useFeed();
  useFocusTrap(ref, open, onClose);
  useEffect(() => { if (open) { setQ(''); setSel(0); } }, [open]);
  const res = useMemo(() => searchAll(q), [q]);
  const groups = [
    ['Events', res.events.map((e) => ({ key: e.id, label: e.title, meta: `${e.sub} · ${MARKETS.filter((m) => m.eventId === e.id).length} markets`, icon: 'calendar', href: `#app-event-${e.id}` }))],
    ['Contracts', res.contracts.map((m) => ({ key: m.id, label: m.title, venue: m.venue, meta: fmtCents(midOf(feed.quotes[m.id]), 1), icon: null, href: `#app-market-${m.id}` }))],
    ['Saved views', res.views.map((v) => ({ key: v.label, label: v.label, icon: v.icon, href: v.href, view: v.view }))],
    ['Pages', res.pages.map((p) => ({ key: p.label, label: p.label, icon: p.icon, href: p.href }))],
    ['Help', res.help.map((h) => ({ key: h.label, label: h.label, icon: h.icon, href: h.href }))],
  ].filter(([, items]) => items.length);
  const flat = groups.flatMap(([, items]) => items);
  const choose = (it) => {
    onClose();
    if (it.view && onView) onView(it.view);
    setTimeout(() => go(it.href.slice(1)), 10);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && flat[sel]) { e.preventDefault(); choose(flat[sel]); }
  };
  useEffect(() => {
    const el = ref.current && ref.current.querySelector(`[data-idx="${sel}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [sel]);
  if (!open) return null;
  let idx = -1;
  const optId = (i) => `cmd-opt-${i}`;
  return ReactDOM.createPortal(
    <div className="overlay overlay-top" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette-input">
          <Icon n="search" size={18} />
          <input data-autofocus className="palette-field" value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey}
            placeholder="Search events, markets, venues…" role="combobox" aria-expanded="true" aria-controls="cmd-list" aria-autocomplete="list"
            aria-activedescendant={flat[sel] ? optId(sel) : undefined} aria-label="Search" />
          {q && <button type="button" className="palette-clear" onClick={() => { setQ(''); setSel(0); }} aria-label="Clear search"><Icon n="x" size={16} /></button>}
          <Kbd>Esc</Kbd>
        </div>
        <div className="palette-body" id="cmd-list" role="listbox" aria-label="Results">
          {!flat.length ? (
            <div className="palette-empty">
              <p className="strong">No matches for “{q}”</p>
              <p className="muted small">Try a topic (inflation), an outcome (cut), a venue (venue:BRS) or a category (cat:politics).</p>
              <div className="row">{['fed', 'cpi', 'shutdown', 'opec'].map((s) => <button key={s} type="button" className="chip chip-btn" onClick={() => setQ(s)}>{s}</button>)}</div>
            </div>
          ) : groups.map(([g, items]) => (
            <div key={g} role="group" aria-label={g} className="palette-group">
              <p className="palette-group-title">{g}</p>
              {items.map((it) => {
                idx += 1;
                const i = idx;
                return (
                  <div key={it.key} id={optId(i)} data-idx={i} role="option" aria-selected={sel === i} className={cx('palette-opt', sel === i && 'is-sel')}
                    onMouseEnter={() => setSel(i)} onMouseDown={(e) => { e.preventDefault(); choose(it); }}>
                    {it.venue ? <VenueBadge venue={it.venue} full={false} /> : <Icon n={it.icon} size={16} />}
                    <span className="palette-label">{it.label}</span>
                    {it.meta && <span className="palette-meta mono">{it.meta}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="palette-foot">
          <span><Kbd>↑</Kbd><Kbd>↓</Kbd> to move</span><span><Kbd>Enter</Kbd> to open</span><span className="palette-syntax">Filters: <code>venue:ARD</code> <code>cat:politics</code></span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
