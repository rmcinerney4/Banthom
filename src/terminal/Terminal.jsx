import React from 'react';
import { Sheet } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { useMedia } from '../lib/hooks.js';
import { cx } from '../lib/format.js';
import { MARKET_BY_ID, EVENT_BY_ID, MATCH_BY_ID, REPORT } from '../data/fixtures.js';
import { SidebarNav, DemoBanner, Topbar, MobileTabbar, MoreSheet, CommandPalette } from './Shell.jsx';
import { CATEGORY_LABEL } from './kit.jsx';
import { Dashboard } from './Dashboard.jsx';
import { Explorer } from './Explorer.jsx';
import { MarketDetail } from './MarketDetail.jsx';
import { EventPage } from './EventPage.jsx';
import { CompareList, CompareDetail } from './Compare.jsx';
import { Alerts } from './Alerts.jsx';
import { Watchlists } from './Watchlists.jsx';
import { Research, Report } from './Research.jsx';
import { Settings, Help, TerminalStub, TerminalNotFound } from './Misc.jsx';
import { LiveMarkets, LiveMarket, LiveOff, LiveBanner, LiveFeedPill } from './Live.jsx';
import { LIVE_VENUES } from '../data/live.js';

const { useState, useEffect, useLayoutEffect, useRef } = React;

export function parseApp(hash) {
  const h = hash.replace(/^app-?/, '');
  if (h === '' || h === 'dashboard') return { page: 'dashboard', nav: 'dashboard' };
  if (h === 'markets') return { page: 'markets', nav: 'markets' };
  if (h.startsWith('markets-')) return { page: 'markets', nav: `cat-${h.slice(8)}`, category: h.slice(8) };
  if (h.startsWith('market-') && MARKET_BY_ID[h.slice(7)]) return { page: 'market', nav: 'markets', id: h.slice(7) };
  if (h.startsWith('event-') && EVENT_BY_ID[h.slice(6)]) return { page: 'event', nav: 'markets', id: h.slice(6) };
  for (const v of Object.values(LIVE_VENUES)) {
    if (h === v.route) return { page: v.enabled ? 'live' : 'live-off', nav: v.route, venue: v.id };
    if (h.startsWith(`${v.route}-`)) return v.enabled ? { page: 'live-market', nav: v.route, venue: v.id, id: h.slice(v.route.length + 1) } : { page: 'live-off', nav: v.route, venue: v.id };
  }
  if (h === 'compare') return { page: 'compare', nav: 'compare' };
  if (h.startsWith('compare-') && MATCH_BY_ID[h.slice(8)]) return { page: 'compare-detail', nav: 'compare', id: h.slice(8) };
  if (h === 'research') return { page: 'research', nav: 'research' };
  if (h === `research-${REPORT.id}`) return { page: 'report', nav: 'research', id: REPORT.id };
  if (h === 'watchlists') return { page: 'watchlists', nav: 'watchlists' };
  if (h.startsWith('watchlists-')) return { page: 'watchlists', nav: 'watchlists', id: h.slice(11) };
  if (h === 'alerts') return { page: 'alerts', nav: 'alerts' };
  if (h === 'settings') return { page: 'settings', nav: 'settings' };
  if (h === 'help') return { page: 'help', nav: 'help' };
  if (h === 'workspaces' || h === 'analytics') return { page: 'stub', nav: h, id: h };
  return { page: 'missing', nav: null };
}

function crumbsFor(r) {
  const mk = r.page === 'market' ? MARKET_BY_ID[r.id] : null;
  const ev = r.page === 'event' ? EVENT_BY_ID[r.id] : mk ? EVENT_BY_ID[mk.eventId] : null;
  switch (r.page) {
    case 'dashboard': return [{ label: 'Overview' }];
    case 'markets': return r.category ? [{ label: 'Markets', href: '#app-markets' }, { label: CATEGORY_LABEL[r.category] || r.category }] : [{ label: 'Markets' }];
    case 'market': return [{ label: 'Markets', href: '#app-markets' }, { label: CATEGORY_LABEL[ev.category], href: `#app-markets-${ev.category}` }, { label: ev.title, href: `#app-event-${ev.id}` }, { label: mk.outcome }];
    case 'event': return [{ label: 'Markets', href: '#app-markets' }, { label: CATEGORY_LABEL[ev.category], href: `#app-markets-${ev.category}` }, { label: ev.title }];
    case 'live': case 'live-off': return [{ label: `${LIVE_VENUES[r.venue].name} markets` }];
    case 'live-market': return [{ label: `${LIVE_VENUES[r.venue].name} markets`, href: `#app-${LIVE_VENUES[r.venue].route}` }, { label: r.id }];
    case 'compare': return [{ label: 'Compare' }];
    case 'compare-detail': return [{ label: 'Compare', href: '#app-compare' }, { label: MATCH_BY_ID[r.id].canonical }];
    case 'research': return [{ label: 'Research' }];
    case 'report': return [{ label: 'Research', href: '#app-research' }, { label: 'Report' }];
    case 'watchlists': return [{ label: 'Watchlists' }];
    case 'alerts': return [{ label: 'Alerts' }];
    case 'settings': return [{ label: 'Settings' }];
    case 'help': return [{ label: 'Help' }];
    case 'stub': return [{ label: r.id === 'workspaces' ? 'Workspaces' : 'Analytics' }];
    default: return [{ label: 'Not found' }];
  }
}

export function Terminal({ hash }) {
  const route = parseApp(hash);
  const { prefs, setPref } = useStore();
  const wide = useMedia('(min-width: 1440px)');
  const laptop = useMedia('(min-width: 1024px)');
  const tablet = useMedia('(min-width: 768px)');
  const [drawer, setDrawer] = useState(false);
  const [more, setMore] = useState(false);
  const [palette, setPalette] = useState(false);
  const [viewReq, setViewReq] = useState(null);
  const collapsed = prefs.railCollapsed == null ? !wide : prefs.railCollapsed;
  const mode = laptop ? (collapsed ? 'rail' : 'expanded') : tablet ? 'drawer' : 'mobile';

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setPalette(true); }
      else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setPalette(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const scrollRoute = route.page + (route.id || '') + (route.category || '');
  useLayoutEffect(() => { window.scrollTo(0, 0); setDrawer(false); setMore(false); }, [scrollRoute]);

  const crumbs = crumbsFor(route);
  const liveV = (route.page === 'live' || route.page === 'live-market') && route.venue ? LIVE_VENUES[route.venue] : null;
  const isLive = !!(liveV && liveV.enabled);
  let page;
  switch (route.page) {
    case 'dashboard': page = <Dashboard />; break;
    case 'markets': page = <Explorer category={route.category} viewRequest={viewReq} />; break;
    case 'market': page = <MarketDetail key={route.id} id={route.id} />; break;
    case 'event': page = <EventPage key={route.id} id={route.id} />; break;
    case 'live': page = <LiveMarkets key={route.venue} v={LIVE_VENUES[route.venue]} />; break;
    case 'live-market': page = <LiveMarket key={`${route.venue}-${route.id}`} v={LIVE_VENUES[route.venue]} ticker={route.id} />; break;
    case 'live-off': page = <LiveOff name={LIVE_VENUES[route.venue].name} />; break;
    case 'compare': page = <CompareList />; break;
    case 'compare-detail': page = <CompareDetail key={route.id} id={route.id} />; break;
    case 'research': page = <Research />; break;
    case 'report': page = <Report />; break;
    case 'watchlists': page = <Watchlists listId={route.id} />; break;
    case 'alerts': page = <Alerts />; break;
    case 'settings': page = <Settings />; break;
    case 'help': page = <Help />; break;
    case 'stub': page = <TerminalStub id={route.id} />; break;
    default: page = <TerminalNotFound />;
  }

  const toggleRail = () => setPref('railCollapsed', !collapsed);
  const side = (inDrawer) => (
    <SidebarNav active={route.nav} collapsed={!inDrawer && mode === 'rail'} inDrawer={inDrawer}
      onNavigate={() => setDrawer(false)} onSearch={() => { setDrawer(false); setPalette(true); }} onToggle={toggleRail} />
  );

  return (
    <div className={cx('term', `term-${mode}`)}>
      {(mode === 'expanded' || mode === 'rail') && <aside className="sidebar" aria-label="Sidebar">{side(false)}</aside>}
      <div className="term-col">
        {isLive ? <LiveBanner v={liveV} /> : <DemoBanner />}
        <Topbar crumbs={crumbs} mode={mode} onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} pill={isLive ? <LiveFeedPill key={liveV.id} v={liveV} /> : null} />
        <main id="main" className="term-main">{page}</main>
        <footer className="term-foot">
          <span>Banthom prototype · Research only, not investment advice · Prices are market-implied proxies, not guaranteed probabilities.</span>
          <a href="#methodology">Methodology</a>
          <a href="#home">Website</a>
        </footer>
      </div>
      {mode === 'drawer' && (
        <Sheet open={drawer} onClose={() => setDrawer(false)} title="Navigation" side="left" width={280} className="nav-sheet">{side(true)}</Sheet>
      )}
      {mode === 'mobile' && (
        <>
          <MobileTabbar active={route.nav} onMore={() => setMore(true)} />
          <MoreSheet open={more} onClose={() => setMore(false)} active={route.nav} />
        </>
      )}
      <CommandPalette open={palette} onClose={() => setPalette(false)} onView={(v) => setViewReq({ view: v, n: Date.now() })} />
    </div>
  );
}
