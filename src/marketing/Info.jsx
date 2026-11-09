import React from 'react';
import { Icon, Button, Badge, Segmented, MATCH_STATUS } from '../ui/core.jsx';
import { VENUES } from '../data/fixtures.js';
import { cx } from '../lib/format.js';
import { go } from '../lib/hooks.js';

const { useState, useEffect } = React;

// ---------------------------------------------------------------- Pricing
const PLANS = [
  { id: 'free', name: 'Free', price: 0, who: 'For getting oriented', cta: 'Create free account', href: '#sign-up',
    feats: ['Market explorer and contract rules', 'One watchlist, three alerts', '7 days of price history', 'Event pages and timelines'] },
  { id: 'plus', name: 'Plus', price: 29, who: 'For regular research', cta: 'Start with Plus', href: '#sign-up',
    feats: ['90 days of price history', 'Five watchlists, 25 alerts', 'Verified cross-venue comparisons', '50 AI research summaries a month'] },
  { id: 'pro', name: 'Pro', price: 99, who: 'For daily trading prep and analysis', cta: 'Start with Pro', href: '#sign-up', featured: true,
    feats: ['Full price history', 'Modeled depth, fees and spread estimates', 'Unlimited AI research with exports where licensed', '100 alerts and unlimited workspaces'] },
  { id: 'inst', name: 'Institutional', price: null, who: 'For teams with governance needs', cta: 'Contact sales', href: '#contact',
    feats: ['Everything in Pro', 'Team workspaces and permissions (planned)', 'Data rights reviewed for your use case', 'Named contact and onboarding'] },
];
const ROWS = [
  ['Explore', null],
  ['Market explorer and screener', ['yes', 'yes', 'yes', 'yes']],
  ['Saved views', ['1', '10', 'Unlimited', 'Unlimited']],
  ['Contract rules with source and timestamps', ['yes', 'yes', 'yes', 'yes']],
  ['Price history', ['7 days', '90 days', 'Full history', 'Full history']],
  ['Analyze', null],
  ['Event intelligence timelines', ['yes', 'yes', 'yes', 'yes']],
  ['Cross-venue comparison', ['Match status only', 'Verified pairs with prices', 'Adds modeled depth and fees', 'Adds modeled depth and fees']],
  ['AI research summaries', ['5 a month', '50 a month', 'Unlimited, fair use', 'Custom']],
  ['Monitor', null],
  ['Watchlists', ['1', '5', 'Unlimited', 'Unlimited']],
  ['Alerts (in-app; email after verification)', ['3', '25', '100', 'Custom']],
  ['Workspaces', ['no', '3', 'Unlimited', 'Shared (planned)']],
  ['Data', null],
  ['CSV export', ['no', 'no', 'Where licensed', 'Where licensed']],
  ['Support', ['Help center', 'Email', 'Priority email', 'Named contact']],
];

function Cell({ v }) {
  if (v === 'yes') return <><Icon n="check" size={16} className="up" /><span className="sr-only">Included</span></>;
  if (v === 'no') return <><span aria-hidden="true" className="muted">—</span><span className="sr-only">Not included</span></>;
  return <span>{v}</span>;
}

export function Pricing() {
  const [cycle, setCycle] = useState('monthly');
  return (
    <>
      <section className="page-hero">
        <div className="container page-hero-inner">
          <p className="eyebrow">Pricing</p>
          <h1 className="mkt-h1 page-hero-h1" tabIndex={-1} data-route-focus>Research with the right level of detail.</h1>
          <p className="hero-sub">Start free; add advanced tools when you need them. Plan limits depend on permitted data access and are shown before checkout.</p>
          <div className="pricing-toggle">
            <Segmented size="md" label="Billing cycle" value={cycle} onChange={setCycle} options={[{ id: 'monthly', label: 'Monthly' }, { id: 'annual', label: 'Annual' }]} />
            {cycle === 'annual' && <span className="muted small">Annual pricing is pending approval. Monthly prices are shown.</span>}
          </div>
        </div>
      </section>
      <section className="mkt-sec pt-0" aria-label="Plans">
        <div className="container">
          <div className="placeholder-note"><Icon n="info" size={16} />Placeholder pricing from the design brief. Final prices, limits and trial terms are not decided.</div>
          <div className="plans">
            {PLANS.map((p) => (
              <div key={p.id} className={cx('plan-card', p.featured && 'is-featured')}>
                <div className="plan-head">
                  <div className="row-between"><h2 className="plan-name">{p.name}</h2>{p.featured && <Badge tone="accent">Most complete</Badge>}</div>
                  <p className="muted">{p.who}</p>
                </div>
                <p className="plan-price">
                  {p.price == null ? <span className="plan-custom">Custom</span> : <><span className="mono">${p.price}</span><span className="muted">/month</span></>}
                </p>
                <ul className="plan-feats">{p.feats.map((f) => <li key={f}><Icon n="check" size={16} />{f}</li>)}</ul>
                <Button variant={p.featured ? 'primary' : 'secondary'} href={p.href} block>{p.cta}</Button>
              </div>
            ))}
          </div>

          <h2 className="mkt-h3 sec-gap">Compare plans</h2>
          <div className="table-scroll compare-plans" role="region" aria-label="Plan comparison table, scrolls horizontally" tabIndex={0}>
            <table className="table plan-table">
              <caption className="sr-only">Features included in each plan</caption>
              <thead>
                <tr><th scope="col" className="sticky-col">Feature</th>{PLANS.map((p) => <th key={p.id} scope="col">{p.name}</th>)}</tr>
              </thead>
              <tbody>
                {ROWS.map(([label, vals]) => (vals == null ? (
                  <tr key={label} className="plan-group"><th scope="rowgroup" colSpan={5} className="sticky-col">{label}</th></tr>
                ) : (
                  <tr key={label}>
                    <th scope="row" className="sticky-col">{label}</th>
                    {vals.map((v, i) => <td key={i}><Cell v={v} /></td>)}
                  </tr>
                )))}
              </tbody>
            </table>
          </div>

          <div className="info-cols">
            <div>
              <h2 className="mkt-h3-sm">Data coverage and latency</h2>
              <p>Quotes refresh as often as each venue’s terms and connection allow. Banthom does not promise real-time data: every quote shows when it was observed, and sources that fall behind are marked Delayed.</p>
            </div>
            <div>
              <h2 className="mkt-h3-sm">Export restrictions</h2>
              <p>Exports are available only where a source’s redistribution terms permit them. Where they don’t, the export control is switched off and the reason is shown next to it.</p>
            </div>
            <div>
              <h2 className="mkt-h3-sm">No trading</h2>
              <p>No plan includes order placement, deposits or custody. Banthom is a research tool; links open the original venue where that is allowed.</p>
            </div>
          </div>

          <div className="faq-grid sec-gap">
            <div className="sec-head"><h2 className="mkt-h2">Billing questions</h2></div>
            <div className="faq">
              {[
                ['Is there a free trial?', 'Trial terms are not decided yet. The Free plan stays available with no time limit.'],
                ['Can I change plans later?', 'Yes. Upgrades and downgrades happen in Settings → Billing, and the amount due is shown before you confirm.'],
                ['How do I cancel?', 'Cancel from Settings → Billing at any time. You keep paid features until the end of the billing period, then move to Free. Saved filters remain available.'],
                ['Do you offer refunds?', 'The refund policy will be published with the final terms before launch.'],
                ['Are taxes included?', 'Prices exclude applicable taxes. The payment provider calculates tax at checkout based on your location.'],
              ].map(([q, a]) => (
                <details key={q} className="faq-item"><summary><span>{q}</span><Icon n="plus" size={18} /></summary><p>{a}</p></details>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="closing" aria-labelledby="pricing-cta">
        <div className="container closing-inner">
          <h2 className="mkt-h2" id="pricing-cta">Start researching for free.</h2>
          <div className="row"><Button variant="primary" size="lg" href="#sign-up">Create free account</Button><Button variant="ghost" size="lg" href="#app-dashboard">Explore the demo</Button></div>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- Methodology
const TOC = [
  ['coverage', 'Source coverage and permissions'],
  ['entities', 'Events, markets and outcomes'],
  ['prices', 'Price definitions'],
  ['freshness', 'Timestamps and feed freshness'],
  ['volume', 'Volume, liquidity and open interest'],
  ['charts', 'Chart aggregation and missing data'],
  ['matching', 'Contract matching'],
  ['revisions', 'Revisions and resolutions'],
  ['ai', 'AI source standards'],
  ['changes', 'Methodology change log'],
  ['contact', 'Contact the data team'],
];

export function Methodology() {
  const [active, setActive] = useState('coverage');
  useEffect(() => {
    const els = TOC.map(([id]) => document.getElementById(`m-${id}`)).filter(Boolean);
    if (!('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id.slice(2));
    }, { rootMargin: '-80px 0px -60% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  const jump = (id) => {
    const el = document.getElementById(`m-${id}`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.focus({ preventScroll: true }); }
  };
  return (
    <>
      <section className="page-hero">
        <div className="container page-hero-inner">
          <p className="eyebrow">Methodology and data</p>
          <h1 className="mkt-h1 page-hero-h1" tabIndex={-1} data-route-focus>Know what each number means.</h1>
          <p className="hero-sub">Every number has a definition. Every data point has a source. This page explains both, including where the numbers stop being reliable.</p>
          <div className="row"><Button variant="secondary" onClick={() => jump('prices')} iconRight="arrow-down">Read the price definitions</Button><Badge tone="muted">Version 0.1 · draft for review</Badge></div>
        </div>
      </section>
      <section className="mkt-sec pt-0">
        <div className="container method">
          <nav className="method-toc" aria-label="On this page">
            <label htmlFor="toc-select" className="sr-only">Jump to section</label>
            <select id="toc-select" className="select method-select" value={active} onChange={(e) => { setActive(e.target.value); jump(e.target.value); }}>
              {TOC.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
            <p className="label method-toc-title">On this page</p>
            <ul>
              {TOC.map(([id, l]) => (
                <li key={id}><a href={`#methodology`} onClick={(e) => { e.preventDefault(); jump(id); }} aria-current={active === id ? 'true' : undefined}>{l}</a></li>
              ))}
            </ul>
          </nav>
          <div className="method-body prose">
            <div className="callout">
              <Icon n="triangle-alert" size={18} />
              <div>
                <strong>The three things to remember</strong>
                <ul>
                  <li>A contract price is a market-implied proxy, not a certain probability.</li>
                  <li>Contracts on different venues can look alike and still settle differently.</li>
                  <li>A quoted price difference can disappear because of execution timing, order depth, fees, slippage, limits or availability.</li>
                </ul>
              </div>
            </div>

            <section id="m-coverage" tabIndex={-1}>
              <h2>Source coverage and permissions</h2>
              <p>Banthom ingests data only from venues and publishers whose current commercial terms allow display, and only within the limits those terms set. When a venue is unavailable, the terminal keeps working with the venues that are.</p>
              <div className="table-scroll"><table className="table">
                <caption className="table-caption">Sources in this prototype. Both venues are fictional.</caption>
                <thead><tr><th scope="col">Venue</th><th scope="col">Data</th><th scope="col">Recent if updated within</th><th scope="col">Settlement</th><th scope="col">Export</th></tr></thead>
                <tbody>
                  {Object.values(VENUES).map((v) => (
                    <tr key={v.id}><td><span className="strong">{v.name}</span> <span className="muted">({v.id})</span></td><td>Quotes, trades, rules (simulated)</td><td className="num">{v.recentS / 60} min</td><td>{v.currency === 'USD' ? '$1.00 per contract' : '1.00 USDC per share'}</td><td>Not permitted in demo</td></tr>
                  ))}
                </tbody>
              </table></div>
            </section>

            <section id="m-entities" tabIndex={-1}>
              <h2>Events, markets and outcomes</h2>
              <p>These are separate things with separate identifiers, and the terminal never mixes them up.</p>
              <ol className="entity-chain">
                <li><span className="entity-k">Event</span><span>A real-world topic, such as the Fed’s December 2026 decision.</span></li>
                <li><span className="entity-k">Market</span><span>One contract question on one venue, such as “Will the Fed cut at its December 2026 meeting?” on Arden.</span></li>
                <li><span className="entity-k">Outcome</span><span>A side of that market (Yes or No), with its own quotes.</span></li>
                <li><span className="entity-k">Quote</span><span>A bid, ask or trade observed at a specific time.</span></li>
              </ol>
              <p>Clean titles are written for reading. The venue’s own title and identifier are always kept and shown on the market page.</p>
            </section>

            <section id="m-prices" tabIndex={-1}>
              <h2>Price definitions</h2>
              <dl className="defs">
                <div><dt>Yes bid</dt><dd>The highest price someone is currently offering to pay for a Yes contract. You could sell Yes at this price, for the size shown.</dd></div>
                <div><dt>Yes ask</dt><dd>The lowest price someone is currently offering to sell a Yes contract at. You could buy Yes at this price, for the size shown.</dd></div>
                <div><dt>Last trade</dt><dd>The price of the most recent trade. It can be old, and it is never used in place of a missing bid or ask.</dd></div>
                <div><dt>Midpoint</dt><dd>The average of the displayed best bid and ask. It is not a guaranteed executable price. <code className="formula">mid = (bid + ask) / 2</code></dd></div>
                <div><dt>Spread</dt><dd>Ask minus bid, in cents. <code className="formula">spread = ask − bid</code></dd></div>
                <div><dt>Implied chance (indicative)</dt><dd>The midpoint read as a share of the $1.00 payout. Shown only when both a bid and an ask exist and the spread is 5¢ or less. <code className="formula">implied chance ≈ mid ÷ 100¢</code></dd></div>
                <div><dt>Percentage points (pp)</dt><dd>Change in a price expressed as a chance. A move from 58¢ to 63¢ is +5 pp, not +5% (which would be a move to about 60.9¢).</dd></div>
              </dl>
            </section>

            <section id="m-freshness" tabIndex={-1}>
              <h2>Timestamps and feed freshness</h2>
              <p>Every quote carries the venue’s timestamp and the time Banthom received it. Both are stored in UTC and displayed in your chosen timezone (Eastern time in this prototype).</p>
              <ul className="status-legend">
                <li><Badge tone="success" icon="radio">Live</Badge><span>Actively streaming and current. Never shown for a record older than its threshold.</span></li>
                <li><Badge tone="success" icon="circle-dot">Recent</Badge><span>Updated within the venue’s threshold (2 minutes for Arden, 5 for Brisa in this demo).</span></li>
                <li><Badge tone="warning" icon="clock">Delayed</Badge><span>The threshold has passed. The last valid quote stays visible with its time, and claims of executable pricing are switched off.</span></li>
                <li><Badge tone="muted" icon="wifi-off">Unavailable</Badge><span>No usable data from the source. Shown with the last valid timestamp.</span></li>
              </ul>
              <p>The demo feed is simulated, so it is labelled “Demo feed” and never “Live”.</p>
            </section>

            <section id="m-volume" tabIndex={-1}>
              <h2>Volume, liquidity and open interest</h2>
              <p><strong>Volume</strong> is what traded over a period. Venues measure it differently: Arden reports contracts, Brisa reports notional value in USDC, so the unit is always printed and volumes are not added across venues. <strong>Liquidity</strong> here means the size available at the best bid or ask right now. <strong>Open interest</strong> is the number of contracts outstanding.</p>
            </section>

            <section id="m-charts" tabIndex={-1}>
              <h2>Chart aggregation and missing data</h2>
              <p>Charts plot the last observation in each interval: 1 minute for the 1-hour view, 5 minutes for 1 day, 30 minutes for 1 week, 2 hours for 1 month and 6 hours since listing. The tooltip names the interval. When a source sends nothing, the chart shows a gap. Gaps are never filled in, and lines are never smoothed over large steps.</p>
              <p>Markers on a chart show when something happened. A move that follows a headline is labelled inferred unless a source establishes the link.</p>
            </section>

            <section id="m-matching" tabIndex={-1}>
              <h2>Contract matching</h2>
              <p>An algorithm proposes pairs of similar contracts across venues. A reviewer then compares the rules clause by clause: outcome definition, resolution source, deadline and timezone, edge cases, and cancellation or void policy.</p>
              <ul className="status-legend">
                {['verified', 'candidate', 'nonequivalent', 'unknown'].map((k) => (
                  <li key={k}><Badge tone={MATCH_STATUS[k].tone} icon={MATCH_STATUS[k].icon}>{MATCH_STATUS[k].label}</Badge>
                    <span>{{ verified: 'Reviewed by a person and still current. Price differences are shown, after fees.', candidate: 'Proposed by the algorithm, not yet reviewed. No price comparison is shown.', nonequivalent: 'Reviewed and found to settle differently. No price comparison is shown.', unknown: 'Rules are missing or unreadable. No price comparison is shown.' }[k]}</span>
                  </li>
                ))}
              </ul>
              <p>No automated confidence score is treated as equivalence. Verified matches carry a review date and are re-checked when either venue changes its rules.</p>
              <p className="formula-block"><code>indicative gross margin per pair = 100¢ − Yes ask (venue A) − No ask (venue B)</code><span>Only for verified, economically equivalent $1 contracts, and before fees, capital lock-up, execution risk and venue limits. If parity is not confirmed, the figure is suppressed.</span></p>
            </section>

            <section id="m-revisions" tabIndex={-1}>
              <h2>Revisions and resolutions</h2>
              <p>Raw observations are stored separately from derived values, so any chart point can be reproduced. Corrections are recorded with what changed and why. Resolved markets keep their full history and the source used to settle them.</p>
            </section>

            <section id="m-ai" tabIndex={-1}>
              <h2>AI source standards</h2>
              <p>Research summaries are built only from permitted sources and Banthom’s own price history. Each claim links to its evidence and is labelled observed, inferred or unknown. The model and methodology version are recorded with every summary, and earlier versions stay visible after a correction.</p>
              <p>If recent sources can’t be retrieved, Banthom says “Unable to verify recent sources” and doesn’t generate unsupported claims.</p>
            </section>

            <section id="m-changes" tabIndex={-1}>
              <h2>Methodology change log</h2>
              <ul className="changelog">
                <li><span className="mono">v0.1</span><span>Nov 6, 2026</span><span>Draft methodology for the prototype review.</span></li>
              </ul>
            </section>

            <section id="m-contact" tabIndex={-1}>
              <h2>Contact the data team</h2>
              <p>Questions about a number, a source or a correction? <a href="#contact">Contact us</a> and choose “Data rights” or “Support”.</p>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}

export function goTop() { go('home'); }
