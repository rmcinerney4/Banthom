// Terminal routes. Every data page reads live Kalshi and Polymarket data from the Banthom server.
import React from 'react';
import { Sheet } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { useMedia } from '../lib/hooks.js';
import { cx } from '../lib/format.js';
import { SidebarNav, Topbar, MobileTabbar, MoreSheet, CommandPalette } from './Shell.jsx';
import { CrumbCtx } from './kit.jsx';
import { Dashboard } from './Dashboard.jsx';
import { Explorer } from './Explorer.jsx';
import { EventPage } from './EventPage.jsx';
import { CompareList, CompareDetail } from './Compare.jsx';
import { Alerts } from './Alerts.jsx';
import { Watchlists } from './Watchlists.jsx';
import { Settings, Help, TerminalNotFound } from './Misc.jsx';
import { MarketPage, LiveOff } from './Live.jsx';
import { Review } from './Review.jsx';
import { LIVE, LIVE_VENUES, venueName, slugOf, CATEGORY_ICON } from '../data/live.js';

const { useState, useEffect, useLayoutEffect } = React;

const CATEGORY_BY_SLUG = Object.fromEntries(Object.keys(CATEGORY_ICON).map((c) => [slugOf(c), c]));
const VENUE_PAGE = /^(market|event)-(kalshi|polymarket)-(.+)$/;

export function parseApp(hash) {
  const h = hash.replace(/^app-?/, '');
  if (h === '' || h === 'dashboard') return { page: 'dashboard', nav: 'dashboard' };
  if (h === 'markets') return { page: 'markets', nav: 'markets' };
  if (h.startsWith('markets-v-')) {
    const v = h.slice(10);
    return LIVE_VENUES[v] ? { page: 'markets', nav: `v-${v}`, venue: v } : { page: 'missing', nav: null };
  }
  if (h.startsWith('markets-')) return { page: 'markets', nav: `cat-${h.slice(8)}`, category: h.slice(8) };
  const m = h.match(VENUE_PAGE);
  if (m) return { page: m[1], nav: 'markets', venue: m[2], id: m[3] };
  // Links from earlier versions: #app-live, #app-live-<ticker>, #app-poly, #app-poly-<id>.
  for (const v of Object.values(LIVE_VENUES)) {
    if (h === v.route) return { page: 'markets', nav: `v-${v.id}`, venue: v.id };
    if (h.startsWith(`${v.route}-`)) return { page: 'market', nav: 'markets', venue: v.id, id: h.slice(v.route.length + 1) };
  }
  if (h === 'compare') return { page: 'compare', nav: 'compare' };
  if (h.startsWith('compare-')) return { page: 'compare-detail', nav: 'compare', id: h.slice(8) };
  if (h === 'watchlists') return { page: 'watchlists', nav: 'watchlists' };
  if (h.startsWith('watchlists-')) return { page: 'watchlists', nav: 'watchlists', id: h.slice(11) };
  if (h === 'alerts') return { page: 'alerts', nav: 'alerts' };
  if (h === 'review') return { page: 'review', nav: 'compare' };
  if (h === 'settings') return { page: 'settings', nav: 'settings' };
  if (h === 'help') return { page: 'help', nav: 'help' };
  return { page: 'missing', nav: null };
}

// Default top-bar breadcrumbs; market, event and pair pages replace them once their data loads.
function crumbsFor(r) {
  switch (r.page) {
    case 'dashboard': return [{ label: 'Overview' }];
    case 'markets':
      if (r.venue) return [{ label: 'Markets', href: '#app-markets' }, { label: venueName(r.venue) }];
      return r.category ? [{ label: 'Markets', href: '#app-markets' }, { label: CATEGORY_BY_SLUG[r.category] || r.category }] : [{ label: 'Markets' }];
    case 'market': return [{ label: 'Markets', href: '#app-markets' }, { label: `${venueName(r.venue)} market` }];
    case 'event': return [{ label: 'Markets', href: '#app-markets' }, { label: `${venueName(r.venue)} event` }];
    case 'compare': return [{ label: 'Compare' }];
    case 'compare-detail': return [{ label: 'Compare', href: '#app-compare' }, { label: 'Pair' }];
    case 'watchlists': return [{ label: 'Watchlists' }];
    case 'alerts': return [{ label: 'Alerts' }];
    case 'review': return [{ label: 'Compare', href: '#app-compare' }, { label: 'Pair review' }];
    case 'settings': return [{ label: 'Settings' }];
    case 'help': return [{ label: 'Help' }];
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
  const [pageCrumbs, setPageCrumbs] = useState(null);
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

  const scrollRoute = `${route.page}|${route.venue || ''}|${route.id || ''}|${route.category || ''}`;
  useLayoutEffect(() => { window.scrollTo(0, 0); setDrawer(false); setMore(false); }, [scrollRoute]);

  let page;
  if (!LIVE && !['settings', 'help', 'missing'].includes(route.page)) page = <LiveOff name="Kalshi and Polymarket" />;
  else {
    switch (route.page) {
      case 'dashboard': page = <Dashboard />; break;
      case 'markets': page = <Explorer category={route.category} venue={route.venue} viewRequest={viewReq} />; break;
      case 'market': page = LIVE_VENUES[route.venue].enabled ? <MarketPage key={`${route.venue}-${route.id}`} venue={route.venue} ticker={route.id} /> : <LiveOff name={venueName(route.venue)} />; break;
      case 'event': page = LIVE_VENUES[route.venue].enabled ? <EventPage key={`${route.venue}-${route.id}`} venue={route.venue} id={route.id} /> : <LiveOff name={venueName(route.venue)} />; break;
      case 'compare': page = <CompareList />; break;
      case 'compare-detail': page = <CompareDetail key={route.id} id={route.id} />; break;
      case 'watchlists': page = <Watchlists listId={route.id} />; break;
      case 'alerts': page = <Alerts />; break;
      case 'review': page = <Review />; break;
      case 'settings': page = <Settings />; break;
      case 'help': page = <Help />; break;
      default: page = <TerminalNotFound />;
    }
  }

  const toggleRail = () => setPref('railCollapsed', !collapsed);
  const side = (inDrawer) => (
    <SidebarNav active={route.nav} collapsed={!inDrawer && mode === 'rail'} inDrawer={inDrawer}
      onNavigate={() => setDrawer(false)} onSearch={() => { setDrawer(false); setPalette(true); }} onToggle={toggleRail} />
  );

  return (
    <CrumbCtx.Provider value={setPageCrumbs}>
      <div className={cx('term', `term-${mode}`)}>
        {(mode === 'expanded' || mode === 'rail') && <aside className="sidebar" aria-label="Sidebar">{side(false)}</aside>}
        <div className="term-col">
          <Topbar crumbs={pageCrumbs || crumbsFor(route)} mode={mode} onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
          <main id="main" className="term-main">{page}</main>
          <footer className="term-foot">
            <span>Banthom · Prices from Kalshi’s and Polymarket’s public market data · Research only, not investment advice. Banthom doesn’t place orders.</span>
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
    </CrumbCtx.Provider>
  );
}
