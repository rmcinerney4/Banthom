import React from 'react';
import { useHash } from './lib/hooks.js';
import { StoreProvider } from './store.jsx';
import { Toaster } from './ui/core.jsx';
import { MarketingHeader, MarketingFooter } from './marketing/Chrome.jsx';
import { Home } from './marketing/Home.jsx';
import { Pricing, Methodology } from './marketing/Info.jsx';
import { Auth, Onboarding, Stub, STUB_ROUTES, NotFound } from './marketing/Account.jsx';
import { Terminal } from './terminal/Terminal.jsx';

const { useEffect, useLayoutEffect, useRef } = React;

const AUTH = { 'sign-up': 'sign-up', 'sign-in': 'sign-in', 'forgot-password': 'forgot' };
const TITLES = {
  home: 'Banthom · Prediction market research', pricing: 'Pricing · Banthom', methodology: 'Methodology · Banthom', 'sign-up': 'Create account · Banthom',
  'sign-in': 'Log in · Banthom', 'forgot-password': 'Reset password · Banthom', onboarding: 'Set up · Banthom',
};

export function parseRoute(raw) {
  const h = raw || 'home';
  if (h === 'home') return { kind: 'mkt', page: 'home', key: h };
  if (h === 'pricing' || h === 'methodology') return { kind: 'mkt', page: h, key: h };
  if (STUB_ROUTES.includes(h)) return { kind: 'mkt', page: 'stub', route: h, key: h };
  if (AUTH[h]) return { kind: 'auth', mode: AUTH[h], key: h };
  if (h === 'onboarding') return { kind: 'onboarding', key: h };
  if (h === 'app' || h.startsWith('app-')) return { kind: 'app', hash: h === 'app' ? 'app-dashboard' : h, key: h };
  return { kind: 'mkt', page: '404', key: h };
}

function SkipLink() {
  return (
    <a className="skip-link" href="#home" onClick={(e) => {
      e.preventDefault();
      const main = document.getElementById('main');
      if (main) { main.setAttribute('tabindex', '-1'); main.focus(); }
    }}>Skip to main content</a>
  );
}

function useRouteEffects(route) {
  const first = useRef(true);
  useLayoutEffect(() => {
    if (route.kind !== 'app') window.scrollTo(0, 0);
  }, [route.key]);
  useEffect(() => {
    if (route.kind !== 'app') document.title = TITLES[route.key] || 'Banthom';
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      const el = document.querySelector('[data-route-focus]');
      if (el) el.focus({ preventScroll: true });
    }, 30);
    return () => clearTimeout(t);
  }, [route.key]);
}

function Router() {
  const hash = useHash();
  const route = parseRoute(hash);
  useRouteEffects(route);
  let body;
  if (route.kind === 'app') body = <Terminal hash={route.hash} />;
  else if (route.kind === 'auth') body = <Auth key={route.mode} mode={route.mode} />;
  else if (route.kind === 'onboarding') body = <Onboarding />;
  else {
    const page = route.page === 'home' ? <Home />
      : route.page === 'pricing' ? <Pricing />
      : route.page === 'methodology' ? <Methodology />
      : route.page === 'stub' ? <Stub route={route.route} />
      : <NotFound />;
    body = (
      <div className="mkt">
        <MarketingHeader route={route.page} />
        <main id="main">{page}</main>
        <MarketingFooter />
      </div>
    );
  }
  return (
    <>
      <SkipLink />
      {body}
      <Toaster />
    </>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}
