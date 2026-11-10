// Terminal chrome: sidebar, top bar with venue status, phone tab bar, and the search palette.
import React from 'react';
import ReactDOM from 'react-dom';
import { Icon, IconButton, Logo, LogoMark, Kbd, Popover, MenuButton, Sheet, Breadcrumbs, VenueBadge } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { useFocusTrap, go } from '../lib/hooks.js';
import { cx, fmtTimeSec, fmtTime, fmtDateShort, fmtCentsAuto, fmtInt, isNum } from '../lib/format.js';
import { LIVE, LIVE_LIST, LIVE_VENUES, VENUE_KEYS, venueName, venueRecent, useStatus, useRealNow, liveFreshness, usePolled, API2, marketHref, eventHref, slugOf, CATEGORY_ICON, NAV_CATEGORIES } from '../data/live.js';
import { Fresh, rowName } from './kit.jsx';

const { useState, useRef, useMemo, useEffect } = React;

const BOTH = LIVE_LIST.length > 1; // Compare needs both venues
export const NAV_MAIN = [
  { id: 'dashboard', label: 'Overview', icon: 'layout-dashboard', href: '#app-dashboard' },
  { id: 'markets', label: 'Markets', icon: 'list-filter', href: '#app-markets' },
  ...(BOTH ? [{ id: 'compare', label: 'Compare', icon: 'git-compare-arrows', href: '#app-compare' }] : []),
  { id: 'sports', label: 'Sports', icon: 'trophy', href: '#app-sports' },
  { id: 'watchlists', label: 'Watchlists', icon: 'star', href: '#app-watchlists' },
  { id: 'alerts', label: 'Alerts', icon: 'bell', href: '#app-alerts' },
];
const NAV_VENUES = LIVE_LIST.map((v) => ({ id: `v-${v.id}`, label: v.name, venue: v.id, href: `#app-markets-v-${v.id}` }));
const NAV_CATS = NAV_CATEGORIES.map((c) => ({ id: `cat-${slugOf(c)}`, label: c, icon: CATEGORY_ICON[c] || 'layers', href: `#app-markets-${slugOf(c)}` }));
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
          {it.venue ? <span className="side-venue" aria-hidden="true"><VenueBadge venue={it.venue} /></span> : <Icon n={it.icon} size={18} />}
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
      <button type="button" className="side-search" onClick={onSearch} data-tip={collapsed ? 'Search (Ctrl K)' : undefined} data-tip-pos="right" aria-label="Search markets">
        <Icon n="search" size={16} />
        <span className="side-label">Search…</span>
        <span className="side-label side-kbd"><Kbd>⌘K</Kbd></span>
      </button>
      <nav aria-label="Terminal" className="side-nav">
        <ul>{NAV_MAIN.map(item)}</ul>
        {NAV_VENUES.length > 0 && (
          <div className="side-group">
            {!collapsed ? <p className="side-group-title">Venues</p> : <div className="side-sep" />}
            <ul>{NAV_VENUES.map(item)}</ul>
          </div>
        )}
        <div className="side-group">
          {!collapsed ? (
            <button type="button" className="side-group-btn" aria-expanded={catsOpen} onClick={() => setCatsOpen((o) => !o)}>
              <span>Categories</span><Icon n="chevron-down" size={14} />
            </button>
          ) : <div className="side-sep" />}
          {(catsOpen || collapsed) && <ul>{NAV_CATS.map(item)}</ul>}
        </div>
      </nav>
      <div className="side-foot">
        <ul>{NAV_FOOT.map(item)}</ul>
        <div className="side-profile">
          <span className="avatar" aria-hidden="true"><Icon n="user-round" size={16} /></span>
          <span className="side-label side-profile-text"><span className="strong">Guest</span><span className="muted small">Saved in this browser</span></span>
        </div>
        {collapsed && !inDrawer && <IconButton icon="panel-left-open" label="Expand sidebar" size="sm" onClick={onToggle} tipPos="right" className="side-expand" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Top bar
function FeedStatusPill() {
  const { data, error } = useStatus();
  const now = useRealNow();
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  const venues = (data && data.venues) || {};
  const rows = VENUE_KEYS.filter((k) => venues[k]).map((k) => ({ k, s: venues[k], f: liveFreshness(venues[k].lastSuccessAt, now, venueRecent(k)) }));
  const starting = rows.filter((r) => !isNum(r.s.lastPassAt));
  const delayed = rows.filter((r) => isNum(r.s.lastPassAt) && r.f.status !== 'recent');
  const latest = Math.max(0, ...rows.map((r) => r.s.lastSuccessAt || 0));
  const warn = !!error || delayed.length > 0;
  const text = error && !data ? 'Server unreachable' : !data ? 'Connecting…' : starting.length ? 'Starting up'
    : delayed.length ? `${delayed.length === rows.length ? 'Data' : venueName(delayed[0].k)} delayed` : 'All venues recent';
  const pairs = data && data.pairs;
  return (
    <div className="pop-wrap">
      <button ref={btn} type="button" className={cx('feed-pill', warn ? 'is-warn' : 'is-ok')} aria-expanded={open} onClick={() => setOpen((o) => !o)}
        aria-label={`Data status: ${text}.${latest ? ` Last full update ${fmtTimeSec(latest)}.` : ''}`}>
        <span className="feed-dot" aria-hidden="true" />
        <span className="feed-text">{text}</span>
        {latest > 0 && <span className="feed-time mono">{fmtTimeSec(latest).replace(' ET', '')}</span>}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} align="end" label="Data status" className="popover-pad feed-pop" width={340}>
        <p className="strong">Data status</p>
        <p className="muted small">Banthom refreshes every open market from each venue every few minutes. Market pages also fetch their own quote every 15 seconds.</p>
        <ul className="feed-list">
          {rows.map(({ k, s }) => (
            <li key={k}>
              <VenueBadge venue={k} />
              <span className="grow">{venueName(k)}<span className="muted small"> · {fmtInt(s.markets)} markets</span></span>
              {isNum(s.lastPassAt) ? <Fresh venue={k} at={s.lastSuccessAt} variant="badge" /> : <span className="muted small">Starting…</span>}
            </li>
          ))}
        </ul>
        {pairs && <p className="muted small">{pairs.builtAt ? `${fmtInt(pairs.pairs)} suggested Kalshi–Polymarket pairs, checked ${fmtTime(pairs.builtAt)}.` : 'Finding Kalshi–Polymarket pairs…'}</p>}
        <a href="#methodology" className="small" onClick={() => setOpen(false)}>Where the data comes from</a>
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
        ) : <p className="muted small">No alerts yet. Create one from any market page. Alerts run while Banthom is open in this browser.</p>}
        <a href="#app-alerts" className="btn btn-secondary btn-sm btn-block" onClick={() => setOpen(false)}>Open alerts</a>
      </Popover>
    </div>
  );
}

export function Topbar({ crumbs, mode, onMenu, onSearch }) {
  return (
    <header className="topbar">
      {(mode === 'drawer' || mode === 'mobile') && (
        <IconButton icon="menu" label="Open navigation" onClick={onMenu} className={cx(mode === 'mobile' && 'hide-mobile')} tip={false} />
      )}
      {mode === 'mobile' && <a href="#app-dashboard" className="topbar-logo" aria-label="Banthom overview"><LogoMark size={26} /></a>}
      <div className="topbar-crumbs">{crumbs && <Breadcrumbs items={crumbs} />}</div>
      <button type="button" className="topbar-search" onClick={onSearch} aria-label="Search markets (Ctrl K)">
        <Icon n="search" size={16} />
        <span className="topbar-search-text">Search Kalshi and Polymarket…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <div className="topbar-right">
        {LIVE && <FeedStatusPill />}
        <AlertsBell />
        <MenuButton label="Account menu" icon="user-round" variant="ghost" size="md" align="end" items={[
          { label: 'Settings', icon: 'settings', onClick: () => go('app-settings') },
          { label: 'Help and shortcuts', icon: 'keyboard', onClick: () => go('app-help') },
          { sep: true },
          { label: 'Back to website', icon: 'arrow-left', onClick: () => go('home') },
        ]} />
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- Mobile tab bar and More sheet
const TABS = [
  ['dashboard', 'Home', 'layout-dashboard', '#app-dashboard'],
  ['markets', 'Markets', 'list-filter', '#app-markets'],
  ['sports', 'Sports', 'trophy', '#app-sports'],
  ...(BOTH ? [['compare', 'Compare', 'git-compare-arrows', '#app-compare']] : [['watchlists', 'Watchlists', 'star', '#app-watchlists']]),
];
const TAB_IDS = TABS.map((t) => t[0]);

export function MobileTabbar({ active, onMore }) {
  const { unread } = useStore();
  const moreActive = !TAB_IDS.includes(active);
  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map(([id, label, icon, href]) => (
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
  const items = [...NAV_MAIN.filter((n) => !TAB_IDS.includes(n.id)), ...NAV_VENUES, ...NAV_FOOT];
  return (
    <Sheet open={open} onClose={onClose} title="More" side="bottom" className="more-sheet">
      <ul className="more-list">
        {items.map((it) => (
          <li key={it.id}>
            <a href={it.href} className={cx('more-link', active === it.id && 'is-active')} onClick={onClose} aria-current={active === it.id ? 'page' : undefined}>
              {it.venue ? <VenueBadge venue={it.venue} /> : <Icon n={it.icon} size={20} />}<span className="grow">{it.venue ? `${it.label} markets` : it.label}</span>
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
  ...NAV_FOOT.map((n) => ({ label: n.label, href: n.href, icon: n.icon })),
];
const HELP = [
  { label: 'Where the data comes from', href: '#methodology', icon: 'book-open' },
  { label: 'How Kalshi–Polymarket pairs are suggested', href: '#methodology', icon: 'git-compare-arrows' },
  { label: 'Keyboard shortcuts', href: '#app-help', icon: 'keyboard' },
];
const VIEWS = [
  { label: 'Most active markets', href: '#app-markets', icon: 'activity', view: 'active' },
  { label: 'Largest movers', href: '#app-markets', icon: 'trending-up', view: 'movers' },
  { label: 'Closing soon', href: '#app-markets', icon: 'timer', view: 'closing' },
  { label: 'My markets', href: '#app-markets', icon: 'star', view: 'watchlist' },
];
const CATS = Object.keys(CATEGORY_ICON).map((c) => ({ label: c, slug: slugOf(c), icon: CATEGORY_ICON[c] }));
const catHref = (c) => (c.label === 'Sports' ? '#app-sports-markets' : `#app-markets-${c.slug}`);
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s.%-]/g, ' ');

// "venue:kalshi cat:politics fed" -> filters plus free text.
export function parseQuery(raw) {
  const filters = {};
  const q = raw.replace(/\b(venue|cat|category):(\S+)/gi, (_, k, v) => {
    const val = v.toLowerCase();
    if (k.toLowerCase() === 'venue') {
      const hit = VENUE_KEYS.find((x) => x.startsWith(val) || LIVE_VENUES[x].code.toLowerCase() === val);
      if (hit) filters.venue = hit;
    } else {
      const hit = CATS.find((c) => c.slug.startsWith(val));
      if (hit) filters.category = hit.slug;
    }
    return '';
  }).replace(/\s+/g, ' ').trim();
  return { q, filters };
}

export function CommandPalette({ open, onClose, onView }) {
  const ref = useRef(null);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sel, setSel] = useState(0);
  useFocusTrap(ref, open, onClose);
  useEffect(() => { if (open) { setText(''); setDebounced(''); setSel(0); } }, [open]);
  useEffect(() => { const t = setTimeout(() => setDebounced(text), 180); return () => clearTimeout(t); }, [text]);
  const { q, filters } = useMemo(() => parseQuery(debounced), [debounced]);
  const searching = open && LIVE && (q.length >= 2 || filters.venue || filters.category);
  const { data, loading } = usePolled(searching ? API2.markets({ q, ...filters, limit: 8 }) : null, 0, { keep: true });
  const terms = norm(text).split(/\s+/).filter((t) => t && !t.includes(':'));
  const hit = (s) => terms.every((t) => norm(s).includes(t));
  const markets = searching && data ? data.markets : [];
  const events = [];
  for (const r of markets) {
    if (r.multi && !events.some((e) => e.venue === r.venue && e.event === r.event) && events.length < 3) events.push(r);
  }
  const groups = [
    ['Markets', markets.map((r) => ({ key: r.id, label: rowName(r), venue: r.venue, meta: fmtCentsAuto(r.mid), href: marketHref(r.id) }))],
    ['Events', events.map((r) => ({ key: `${r.venue}:${r.event}`, label: r.eventTitle, venue: r.venue, meta: 'Event', href: eventHref(r.venue, r.event) }))],
    ['Categories', terms.length ? CATS.filter((c) => hit(c.label)).slice(0, 4).map((c) => ({ key: c.slug, label: c.label, icon: c.icon, href: catHref(c) })) : []],
    ['Views', terms.length ? VIEWS.filter((v) => hit(v.label)).map((v) => ({ key: v.label, label: v.label, icon: v.icon, href: v.href, view: v.view })) : []],
    ['Pages', (terms.length ? PAGES.filter((p) => hit(p.label)) : PAGES.slice(0, 5)).map((p) => ({ key: p.label, label: p.label, icon: p.icon, href: p.href }))],
    ['Help', terms.length ? HELP.filter((h) => hit(h.label)).map((h) => ({ key: h.label, label: h.label, icon: h.icon, href: h.href })) : []],
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
  useEffect(() => { setSel(0); }, [data, debounced]);
  useEffect(() => {
    const el = ref.current && ref.current.querySelector(`[data-idx="${sel}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [sel]);
  if (!open) return null;
  let idx = -1;
  const optId = (i) => `cmd-opt-${i}`;
  const pending = searching && (loading || debounced !== text);
  return ReactDOM.createPortal(
    <div className="overlay overlay-top" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette-input">
          <Icon n="search" size={18} />
          <input data-autofocus className="palette-field" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
            placeholder="Search Kalshi and Polymarket markets…" role="combobox" aria-expanded="true" aria-controls="cmd-list" aria-autocomplete="list"
            aria-activedescendant={flat[sel] ? optId(sel) : undefined} aria-label="Search" />
          {text && <button type="button" className="palette-clear" onClick={() => setText('')} aria-label="Clear search"><Icon n="x" size={16} /></button>}
          <Kbd>Esc</Kbd>
        </div>
        <div className="palette-body" id="cmd-list" role="listbox" aria-label="Results" aria-busy={pending || undefined}>
          {!flat.length ? (
            <div className="palette-empty">
              {pending ? <p className="muted">Searching…</p> : (
                <>
                  <p className="strong">No matches for “{text}”</p>
                  <p className="muted small">Try a topic (inflation), a name (Lakers), a venue (venue:kalshi) or a category (cat:politics).</p>
                </>
              )}
              <div className="row">{['fed', 'bitcoin', 'election', 'nba'].map((s) => <button key={s} type="button" className="chip chip-btn" onClick={() => setText(s)}>{s}</button>)}</div>
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
                    {it.venue ? <VenueBadge venue={it.venue} /> : <Icon n={it.icon} size={16} />}
                    <span className="palette-label">{it.label}</span>
                    {it.meta && <span className="palette-meta mono">{it.meta}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="palette-foot">
          <span><Kbd>↑</Kbd><Kbd>↓</Kbd> to move</span><span><Kbd>Enter</Kbd> to open</span><span className="palette-syntax">Filters: <code>venue:kalshi</code> <code>cat:politics</code></span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
