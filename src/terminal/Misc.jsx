import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, Switch, Segmented, Field, Kbd, KeyValue } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { useTitle } from './kit.jsx';
import { SCENARIOS } from './Shell.jsx';

export function Settings() {
  useTitle('Settings');
  const { prefs, setPref, resetDemo } = useStore();
  return (
    <div className="page-stack">
      <PageHeader title="Settings" sub="Appearance and demo preferences. Saved in this browser only." />
      <div className="grid">
        <nav className="s-3 settings-nav" aria-label="Settings sections">
          <ul>
            {[['Appearance', true], ['Profile'], ['Notifications'], ['Security'], ['Billing'], ['Data preferences']].map(([l, on]) => (
              <li key={l}><span className={on ? 'is-active' : 'is-planned'} aria-current={on ? 'page' : undefined}>{l}{!on && <Badge tone="muted" size="sm">Planned</Badge>}</span></li>
            ))}
          </ul>
        </nav>
        <div className="s-9 col-stack">
          <Panel title="Appearance">
            <div className="settings-row">
              <div><p className="switch-label">Theme</p><p className="switch-hint">The terminal is dark by default. A light terminal is planned for phase 2.</p></div>
              <Segmented label="Theme" value="dark" onChange={() => {}} options={[{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light (planned)', tip: 'Not available yet' }]} />
            </div>
            <div className="settings-row">
              <div><p className="switch-label">Table density</p><p className="switch-hint">Row height in tables: 32, 40 or 48 pixels.</p></div>
              <Segmented label="Table density" value={prefs.density} onChange={(v) => setPref('density', v)} options={[{ id: 'compact', label: 'Compact' }, { id: 'standard', label: 'Standard' }, { id: 'comfortable', label: 'Comfortable' }]} />
            </div>
            <Switch label="Highlight price changes" hint="Briefly tints a price when it updates. No flashing." checked={prefs.highlight} onChange={(v) => setPref('highlight', v)} />
            <div className="settings-row">
              <div><p className="switch-label">Timezone</p><p className="switch-hint">Times are stored in UTC. This demo displays Eastern time; choosing a timezone is planned.</p></div>
              <select className="select input-sm settings-select" aria-label="Timezone" disabled value="et"><option value="et">Eastern Time (ET)</option></select>
            </div>
            <div className="settings-row">
              <div><p className="switch-label">Reduced motion</p><p className="switch-hint">Follows your system setting. Charts never animate while data updates.</p></div>
              <Badge tone="muted">System</Badge>
            </div>
          </Panel>
          <Panel title="Demo controls" sub="Only in this prototype">
            <Switch label="Simulated updates" hint="When paused, timestamps stop advancing and records turn Delayed, as they would with a real outage." checked={prefs.updates} onChange={(v) => setPref('updates', v)} />
            <div className="settings-row">
              <div><p className="switch-label">Scenario</p><p className="switch-hint">Preview empty, delayed and source-failure states.</p></div>
              <select className="select input-sm settings-select" aria-label="Scenario" value={prefs.scenario} onChange={(e) => setPref('scenario', e.target.value)}>
                {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="settings-row">
              <div><p className="switch-label">Reset demo data</p><p className="switch-hint">Restores the sample watchlists, alerts and preferences.</p></div>
              <Button variant="destructive" size="sm" icon="rotate-ccw" onClick={resetDemo}>Reset</Button>
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
    ['Verified match', 'Two venues’ contracts reviewed by a person and found to settle the same way.'],
    ['Delayed', 'A source hasn’t updated within its freshness threshold.'],
  ];
  return (
    <div className="page-stack">
      <PageHeader title="Help" sub="Keyboard shortcuts, terms and where to get support" />
      <div className="grid">
        <Panel title="Keyboard shortcuts" className="s-6">
          <ul className="keys">{keys.map(([k, d]) => <li key={d}><span className="keys-k">{k.map((x) => <Kbd key={x}>{x}</Kbd>)}</span><span>{d}</span></li>)}</ul>
        </Panel>
        <Panel title="Glossary" className="s-6">
          <dl className="gloss">{glossary.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
          <a href="#methodology" className="btn btn-ghost btn-sm panel-more">Full methodology<Icon n="arrow-right" size={14} /></a>
        </Panel>
        <Panel title="Support" className="s-12">
          <p className="muted">In the full product this links to the help center and a support ticket form. <a href="#contact">Contact page</a></p>
        </Panel>
      </div>
    </div>
  );
}

const STUBS = {
  workspaces: {
    title: 'Workspaces', sub: 'Saved terminal layouts', spec: '4.19',
    items: ['Templates: Trader, Macro Research, Event Monitor', '12-column canvas with movable, resizable panels on desktop', 'Panels for screener, chart, event feed, watchlist and notes', 'Autosave with a visible Saved state, history and reset', 'Mobile: prioritized vertical panels with Move up and Move down'],
  },
  analytics: {
    title: 'Analytics', sub: 'Historical and calibration overview', spec: '4.20',
    items: ['Category trends and average movement by interval', 'Resolved-contract calibration, only with a reliable historical dataset', 'Source coverage statistics', 'Sampling and selection-bias explainer before any statistic', 'Export gated by permission and licence'],
  },
};

export function TerminalStub({ id }) {
  const s = STUBS[id];
  useTitle(s.title);
  return (
    <div className="page-stack">
      <PageHeader title={s.title} sub={s.sub} />
      <Panel title="Planned for the full build" sub={`Specified in DESIGN_SPEC §${s.spec}. Not built in this prototype.`} className="stub-panel">
        <ul className="planned">{s.items.map((i) => <li key={i}><Icon n="circle-dashed" size={16} />{i}</li>)}</ul>
        <div className="row"><Button variant="secondary" href="#app-dashboard">Back to Overview</Button></div>
      </Panel>
    </div>
  );
}

export function TerminalNotFound() {
  useTitle('Not found');
  return (
    <div className="page-stack">
      <PageHeader title="We couldn’t find that page" sub="The link may point to a market or report that isn’t in this demo." />
      <div className="row"><Button variant="primary" href="#app-markets">Open the Market Explorer</Button><Button variant="ghost" href="#app-dashboard">Overview</Button></div>
    </div>
  );
}
