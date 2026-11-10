// Settings, help and not-found pages for the terminal.
import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, Segmented, Kbd } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { pluralize } from '../lib/format.js';
import { useTitle } from './kit.jsx';

const { useState } = React;

export function Settings() {
  useTitle('Settings');
  const { prefs, setPref, watchlists, alerts, history, clearAll } = useStore();
  const [confirm, setConfirm] = useState(false);
  const saved = watchlists.reduce((n, w) => n + w.items.length, 0);
  return (
    <div className="page-stack">
      <PageHeader title="Settings" sub="Preferences for this browser. Banthom doesn’t have accounts yet." />
      <div className="grid">
        <div className="s-8 md-12 col-stack">
          <Panel title="Appearance">
            <div className="settings-row">
              <div><p className="switch-label">Theme</p><p className="switch-hint">The terminal uses a dark theme. A light terminal is planned.</p></div>
              <Segmented label="Theme" value="dark" onChange={() => {}} options={[{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light (planned)', tip: 'Not available yet' }]} />
            </div>
            <div className="settings-row">
              <div><p className="switch-label">Table density</p><p className="switch-hint">Row height in tables: 32, 40 or 48 pixels.</p></div>
              <Segmented label="Table density" value={prefs.density} onChange={(v) => setPref('density', v)} options={[{ id: 'compact', label: 'Compact' }, { id: 'standard', label: 'Standard' }, { id: 'comfortable', label: 'Comfortable' }]} />
            </div>
            <div className="settings-row">
              <div><p className="switch-label">Timezone</p><p className="switch-hint">Times are shown in US Eastern time, which both venues use for most schedules.</p></div>
              <select className="select input-sm settings-select" aria-label="Timezone" disabled value="et"><option value="et">Eastern Time (ET)</option></select>
            </div>
            <div className="settings-row">
              <div><p className="switch-label">Reduced motion</p><p className="switch-hint">Follows your system setting. Charts never animate while data updates.</p></div>
              <Badge tone="muted">System</Badge>
            </div>
          </Panel>
          <Panel title="Saved in this browser" sub="Nothing here is sent to Banthom’s server or shared with other devices.">
            <ul className="plain-list">
              <li>{pluralize(watchlists.length, 'watchlist')} with {pluralize(saved, 'saved market')}</li>
              <li>{pluralize(alerts.length, 'alert rule')} and {pluralize(history.length, 'alert in history', 'alerts in history')}</li>
              <li>Display preferences</li>
            </ul>
            <div className="settings-row">
              <div><p className="switch-label">Clear saved data</p><p className="switch-hint">Deletes your watchlists, alerts and preferences from this browser. This can’t be undone.</p></div>
              {confirm ? (
                <span className="row">
                  <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Cancel</Button>
                  <Button variant="destructive" size="sm" icon="trash-2" onClick={() => { clearAll(); setConfirm(false); }}>Clear everything</Button>
                </span>
              ) : <Button variant="secondary" size="sm" icon="trash-2" onClick={() => setConfirm(true)}>Clear…</Button>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function Help() {
  useTitle('Help');
  const keys = [
    [['⌘', 'K'], 'Open search (Ctrl K on Windows)'],
    [['/'], 'Open search from anywhere outside a text field'],
    [['↑', '↓'], 'Move between rows in a table'],
    [['Enter'], 'Open the focused market'],
    [['←', '→'], 'Read values along a focused chart (Shift for larger steps)'],
    [['Esc'], 'Close a dialog, menu or search'],
  ];
  const glossary = [
    ['Yes bid', 'The highest price someone will pay for Yes right now.'],
    ['Yes ask', 'The lowest price someone will sell Yes for right now.'],
    ['Midpoint', 'Average of bid and ask. Not a guaranteed executable price.'],
    ['Spread', 'Ask minus bid.'],
    ['Percentage points (pp)', 'Change in a price read as a chance: 58¢ to 63¢ is +5 pp.'],
    ['Volume', 'Kalshi reports contracts traded; Polymarket reports USDC traded. Cross-venue rankings use an approximate dollar figure.'],
    ['Suggested pair', 'A Kalshi and a Polymarket market whose titles, numbers and dates line up. Not verified: read both venues’ rules.'],
    ['Delayed', 'Banthom hasn’t completed a refresh from a venue within its expected time, so quotes may be out of date.'],
  ];
  return (
    <div className="page-stack">
      <PageHeader title="Help" sub="Keyboard shortcuts, terms and where the data comes from" />
      <div className="grid">
        <Panel title="Keyboard shortcuts" className="s-6 md-12">
          <ul className="keys">{keys.map(([k, d]) => <li key={d}><span className="keys-k">{k.map((x) => <Kbd key={x}>{x}</Kbd>)}</span><span>{d}</span></li>)}</ul>
        </Panel>
        <Panel title="Glossary" className="s-6 md-12">
          <dl className="gloss">{glossary.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
          <a href="#methodology" className="btn btn-ghost btn-sm panel-more">Full methodology<Icon n="arrow-right" size={14} /></a>
        </Panel>
        <Panel title="About the data" className="s-12">
          <p className="muted">Banthom reads Kalshi’s and Polymarket’s public market data. It refreshes every open market every few minutes and fetches a market’s quote, order book and history when you open it. Banthom doesn’t hold funds or place orders; trade on the venues themselves.</p>
        </Panel>
      </div>
    </div>
  );
}

export function TerminalNotFound() {
  useTitle('Not found');
  return (
    <div className="page-stack">
      <PageHeader title="We couldn’t find that page" sub="The link may be wrong, or it may point to something that no longer exists." />
      <div className="row"><Button variant="primary" href="#app-markets">Browse markets</Button><Button variant="ghost" href="#app-dashboard">Overview</Button></div>
    </div>
  );
}
