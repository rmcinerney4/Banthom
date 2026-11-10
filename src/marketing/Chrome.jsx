import React from 'react';
import { Icon, Logo, Button, IconButton, Sheet } from '../ui/core.jsx';
import { useDismiss } from '../lib/hooks.js';
import { cx } from '../lib/format.js';

const { useState, useEffect, useRef } = React;

export const NAV = {
  features: [
    { href: '#features-market-screener', icon: 'list-filter', label: 'Market screener', desc: 'Filter by category, venue and closing date.' },
    { href: '#features-market-comparison', icon: 'git-compare-arrows', label: 'Market comparison', desc: 'The same question on Kalshi and Polymarket.' },
    { href: '#features-alerts-watchlists', icon: 'bell', label: 'Alerts and watchlists', desc: 'Thresholds and cooldowns you control.' },
  ],
  solutions: [
    { href: '#solutions-traders', icon: 'activity', label: 'For traders', desc: 'Screen faster, verify the contract, see the spread.' },
    { href: '#solutions-researchers', icon: 'microscope', label: 'For researchers', desc: 'Price history, every outcome, the venues’ rules.' },
  ],
  resources: [
    { href: '#resources', icon: 'book-open', label: 'Guides', desc: 'Learn to read event markets.' },
    { href: '#methodology', icon: 'scale', label: 'Methodology', desc: 'What every number means.' },
    { href: '#changelog', icon: 'history', label: 'Changelog', desc: 'Product and data updates.' },
    { href: '#status', icon: 'activity', label: 'Status', desc: 'Service and source health.' },
  ],
};

function NavDropdown({ id, label, items, open, setOpen, wide }) {
  const btn = useRef(null);
  const panel = useRef(null);
  const isOpen = open === id;
  useDismiss([btn, panel], isOpen, () => setOpen(null));
  const onPanelKey = (e) => {
    if (e.key === 'Escape') { setOpen(null); btn.current && btn.current.focus(); }
  };
  return (
    <div className="nav-dd">
      <button ref={btn} type="button" className="nav-link" aria-expanded={isOpen} aria-controls={`dd-${id}`}
        onClick={() => setOpen(isOpen ? null : id)}>
        {label}<Icon n="chevron-down" size={14} className="nav-caret" />
      </button>
      {isOpen && (
        <div ref={panel} id={`dd-${id}`} className={cx('nav-panel', wide && 'is-wide')} onKeyDown={onPanelKey}>
          <ul>
            {items.map((it) => (
              <li key={it.href}>
                <a href={it.href} className="nav-item" onClick={() => setOpen(null)}>
                  <span className="nav-item-icon"><Icon n={it.icon} size={18} /></span>
                  <span><span className="nav-item-label">{it.label}</span><span className="nav-item-desc">{it.desc}</span></span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function MarketingHeader({ route }) {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(null);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { setOpen(null); setDrawer(false); }, [route]);
  const overHero = route === 'home' || route === '';
  return (
    <header className={cx('mkt-nav', (solid || !overHero) && 'is-solid')}>
      <div className="container mkt-nav-inner">
        <Logo />
        <nav aria-label="Main" className="mkt-links">
          <ul>
            <li className="nav-xl"><a className="nav-link" href="#product">Product</a></li>
            <li><NavDropdown id="features" label="Features" items={NAV.features} open={open} setOpen={setOpen} wide /></li>
            <li><NavDropdown id="solutions" label="Solutions" items={NAV.solutions} open={open} setOpen={setOpen} /></li>
            <li><a className="nav-link" href="#pricing" aria-current={route === 'pricing' ? 'page' : undefined}>Pricing</a></li>
            <li className="nav-xl"><NavDropdown id="resources" label="Resources" items={NAV.resources} open={open} setOpen={setOpen} /></li>
            <li className="nav-lg-only">
              <NavDropdown id="more" label="More" items={[{ href: '#product', icon: 'layout-dashboard', label: 'Product tour', desc: 'One terminal, the full picture.' }, ...NAV.resources]} open={open} setOpen={setOpen} />
            </li>
          </ul>
        </nav>
        <div className="mkt-actions">
          <Button variant="primary" href="#app-dashboard" className="nav-cta">Open the terminal</Button>
          <IconButton icon="menu" label="Open menu" className="mkt-menu-btn" onClick={() => setDrawer(true)} aria-expanded={drawer} tip={false} />
        </div>
      </div>
      <Sheet open={drawer} onClose={() => setDrawer(false)} title="Menu" width={380} className="mkt-drawer">
        <nav aria-label="Mobile" className="drawer-nav">
          <a href="#product" className="drawer-link">Product tour</a>
          <p className="drawer-group">Features</p>
          {NAV.features.map((it) => <a key={it.href} href={it.href} className="drawer-link drawer-sub"><Icon n={it.icon} size={18} />{it.label}</a>)}
          <p className="drawer-group">Solutions</p>
          {NAV.solutions.map((it) => <a key={it.href} href={it.href} className="drawer-link drawer-sub"><Icon n={it.icon} size={18} />{it.label}</a>)}
          <a href="#pricing" className="drawer-link">Pricing</a>
          <p className="drawer-group">Resources</p>
          {NAV.resources.map((it) => <a key={it.href} href={it.href} className="drawer-link drawer-sub"><Icon n={it.icon} size={18} />{it.label}</a>)}
        </nav>
        <div className="drawer-ctas">
          <Button variant="primary" size="lg" block href="#app-dashboard">Open the terminal</Button>
          <p className="muted small">No account needed. Watchlists and alerts are saved in your browser.</p>
        </div>
      </Sheet>
    </header>
  );
}

export function MarketingFooter() {
  const cols = [
    ['Product', [['Product tour', '#product'], ['Features', '#features'], ['Pricing', '#pricing'], ['Methodology', '#methodology'], ['Changelog', '#changelog'], ['Status', '#status']]],
    ['Solutions', [['For traders', '#solutions-traders'], ['For researchers', '#solutions-researchers'], ['Institutional', '#contact']]],
    ['Resources', [['Guides', '#resources'], ['Market screener', '#features-market-screener'], ['Comparison methodology', '#features-market-comparison'], ['Security', '#security']]],
    ['Company and legal', [['About', '#about'], ['Contact', '#contact'], ['Terms', '#legal-terms'], ['Privacy', '#legal-privacy'], ['Disclosures', '#legal-disclosures']]],
  ];
  return (
    <footer className="mkt-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Logo />
            <p>The intelligence layer for prediction markets. Research and analytics only: Banthom is not an exchange, broker or investment adviser.</p>
          </div>
          <nav aria-label="Footer" className="footer-cols">
            {cols.map(([title, links]) => (
              <div key={title}>
                <h2 className="footer-title">{title}</h2>
                <ul>{links.map(([l, h]) => <li key={l}><a href={h}>{l}</a></li>)}</ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="footer-bottom">
          <p className="footer-disclaimer">
            Prices on Banthom come from Kalshi’s and Polymarket’s public market data and are attributed to their venue wherever they
            appear. They are market-implied proxies, not guaranteed probabilities, and nothing here is investment advice.
          </p>
          <div className="footer-legal">
            <span>© 2026 Banthom (working name)</span>
            <a href="#legal-privacy">Privacy</a>
            <a href="#legal-terms">Terms</a>
            <a href="#legal-disclosures">Disclosures</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
