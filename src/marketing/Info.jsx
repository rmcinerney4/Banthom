import React from 'react';
import { Icon, Button, Badge, Segmented } from '../ui/core.jsx';
import { cx } from '../lib/format.js';
import { go } from '../lib/hooks.js';

const { useState, useEffect } = React;

// ---------------------------------------------------------------- Pricing
const PLANS = [
  { id: 'free', name: 'Free', price: 0, who: 'For getting oriented', cta: 'Open the terminal', href: '#app-dashboard',
    feats: ['Market explorer and venue rules', 'Price history and order books', 'One watchlist, three alerts', 'Event pages'] },
  { id: 'plus', name: 'Plus', price: 29, who: 'For regular research', cta: 'Get in touch', href: '#contact',
    feats: ['Watchlists on every device', 'Five watchlists, 25 alerts', 'Email alerts', 'Suggested cross-venue pairs with prices'] },
  { id: 'pro', name: 'Pro', price: 99, who: 'For daily trading prep and analysis', cta: 'Get in touch', href: '#contact', featured: true,
    feats: ['Unlimited watchlists, 100 alerts', 'Modeled depth, fees and spread estimates', 'Exports where licensed', 'Unlimited saved views and workspaces'] },
  { id: 'inst', name: 'Institutional', price: null, who: 'For teams with governance needs', cta: 'Contact sales', href: '#contact',
    feats: ['Everything in Pro', 'Team workspaces and permissions', 'Data rights reviewed for your use case', 'Named contact and onboarding'] },
];
const ROWS = [
  ['Explore', null],
  ['Market explorer across Kalshi and Polymarket', ['yes', 'yes', 'yes', 'yes']],
  ['Venue rules, order books and price history', ['yes', 'yes', 'yes', 'yes']],
  ['Saved views', ['1', '10', 'Unlimited', 'Unlimited']],
  ['Compare', null],
  ['Suggested Kalshi–Polymarket pairs', ['Pairs only', 'With prices', 'Adds modeled depth and fees', 'Adds modeled depth and fees']],
  ['Monitor', null],
  ['Watchlists', ['1', '5', 'Unlimited', 'Unlimited']],
  ['Alerts', ['3, in the app', '25, in the app and by email', '100, in the app and by email', 'Custom']],
  ['Workspaces', ['no', '3', 'Unlimited', 'Shared']],
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
          <p className="hero-sub">Banthom is free while in preview. The plans below are what we plan to offer once accounts exist; limits will depend on permitted data access and will be shown before checkout.</p>
          <div className="pricing-toggle">
            <Segmented size="md" label="Billing cycle" value={cycle} onChange={setCycle} options={[{ id: 'monthly', label: 'Monthly' }, { id: 'annual', label: 'Annual' }]} />
            {cycle === 'annual' && <span className="muted small">Annual pricing is pending approval. Monthly prices are shown.</span>}
          </div>
        </div>
      </section>
      <section className="mkt-sec pt-0" aria-label="Plans">
        <div className="container">
          <div className="placeholder-note"><Icon n="info" size={16} />Today everything in the terminal is free and needs no account: every market, comparisons, and watchlists and alerts saved in your browser. Prices below are placeholders from the design brief; final prices, limits and trial terms are not decided.</div>
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
              <p>Banthom refreshes every open Kalshi and Polymarket market every few minutes and fetches a market’s quote and order book when you open it. It doesn’t promise real-time data: every quote shows when it was fetched, and a venue that falls behind is marked Delayed.</p>
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
                ['Is there a free trial?', 'Everything is free while Banthom is in preview. Trial terms for paid plans are not decided yet.'],
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
          <div className="row"><Button variant="primary" size="lg" href="#app-dashboard">Open the terminal</Button><Button variant="ghost" size="lg" href="#methodology">How the data works</Button></div>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- Methodology
const TOC = [
  ['coverage', 'Sources and coverage'],
  ['entities', 'Events, markets and outcomes'],
  ['prices', 'Price definitions'],
  ['freshness', 'Timestamps and freshness'],
  ['volume', 'Volume and open interest'],
  ['charts', 'Price history and missing data'],
  ['matching', 'Suggested and verified pairs'],
  ['closed', 'Closed and settled markets'],
  ['saved', 'Watchlists and alerts'],
  ['changes', 'Methodology change log'],
  ['contact', 'Contact the data team'],
];
const SOURCES = [
  ['Kalshi', 'Trade API v2, public market data', 'Every few minutes (one pass covers every open market)', '8 min', '$1.00 per contract, US dollars', 'Contracts'],
  ['Polymarket', 'Gamma, CLOB and Data APIs, public market data', 'Every few minutes (one pass covers every open market)', '8 min', '$1.00 USDC per share', 'USDC'],
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
          <p className="hero-sub">Every number in Banthom comes from Kalshi or Polymarket. This page explains where each one comes from, how current it is and where it stops being reliable.</p>
          <div className="row"><Button variant="secondary" onClick={() => jump('prices')} iconRight="arrow-down">Read the price definitions</Button><Badge tone="muted">Version 0.3 · Nov 10, 2026</Badge></div>
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
                  <li>Contracts on Kalshi and Polymarket can look alike and still settle differently.</li>
                  <li>A quoted price difference can disappear because of execution timing, order depth, fees, slippage, limits or availability.</li>
                </ul>
              </div>
            </div>

            <section id="m-coverage" tabIndex={-1}>
              <h2>Sources and coverage</h2>
              <p>Banthom reads Kalshi’s and Polymarket’s public market data. It lists every open market on both venues except Kalshi’s multi-leg combination markets. A background pass collects every open market’s quote; when you open a market, Banthom also fetches its quote, order book and price history directly from the venue.</p>
              <div className="table-scroll"><table className="table">
                <caption className="table-caption">Sources shown in Banthom</caption>
                <thead><tr><th scope="col">Venue</th><th scope="col">Data</th><th scope="col">Full refresh</th><th scope="col">Recent if updated within</th><th scope="col">Settlement</th><th scope="col">Volume unit</th></tr></thead>
                <tbody>
                  {SOURCES.map(([name, data, refresh, recent, settle, vol]) => (
                    <tr key={name}><td className="strong">{name}</td><td>{data}</td><td>{refresh}</td><td className="num">{recent}</td><td>{settle}</td><td>{vol}</td></tr>
                  ))}
                </tbody>
              </table></div>
              <p>When a venue can’t be reached, Banthom keeps showing its last good data, marks it Delayed and keeps retrying. The other venue keeps working.</p>
            </section>

            <section id="m-entities" tabIndex={-1}>
              <h2>Events, markets and outcomes</h2>
              <p>These are separate things with separate identifiers, and the terminal never mixes them up.</p>
              <ol className="entity-chain">
                <li><span className="entity-k">Event</span><span>A real-world question with one or more possible results, such as who wins a championship.</span></li>
                <li><span className="entity-k">Market</span><span>One contract on one venue, such as “Will this team win?” within that event.</span></li>
                <li><span className="entity-k">Outcome</span><span>A side of that market (Yes or No), with its own quotes. Some Polymarket markets name their sides, such as two teams.</span></li>
                <li><span className="entity-k">Quote</span><span>A bid, ask or trade price, with the time Banthom fetched it.</span></li>
              </ol>
              <p>Titles, tickers and rule text are shown as each venue publishes them. Categories are folded into one shared list: Kalshi’s categories and Polymarket’s tags are mapped onto the same headings, such as Politics, Economics or Sports.</p>
            </section>

            <section id="m-prices" tabIndex={-1}>
              <h2>Price definitions</h2>
              <dl className="defs">
                <div><dt>Yes bid</dt><dd>The highest price someone is currently offering to pay for Yes. You could sell Yes at this price, for the size shown.</dd></div>
                <div><dt>Yes ask</dt><dd>The lowest price someone is currently offering to sell Yes at. On Kalshi, which lists bids only, the Yes ask is 100¢ minus the best No bid.</dd></div>
                <div><dt>Last trade</dt><dd>The price of the most recent trade. It can be old, and it is never used in place of a missing bid or ask.</dd></div>
                <div><dt>Midpoint</dt><dd>The average of the best bid and ask. It is not a guaranteed executable price. <code className="formula">mid = (bid + ask) / 2</code></dd></div>
                <div><dt>Spread</dt><dd>Ask minus bid, in cents. <code className="formula">spread = ask − bid</code></dd></div>
                <div><dt>Implied chance (indicative)</dt><dd>The midpoint read as a share of the $1.00 payout. Shown only when both a bid and an ask exist and the spread is 5¢ or less. <code className="formula">implied chance ≈ mid ÷ 100¢</code></dd></div>
                <div><dt>24h change</dt><dd>Kalshi: the change in the Yes midpoint from the quote a day earlier. Polymarket: the venue’s own 24-hour price change.</dd></div>
                <div><dt>Percentage points (pp)</dt><dd>Change in a price expressed as a chance. A move from 58¢ to 63¢ is +5 pp, not +5% (which would be a move to about 60.9¢).</dd></div>
              </dl>
              <p>A missing bid or ask is shown as —. Banthom never fills one in from another number.</p>
            </section>

            <section id="m-freshness" tabIndex={-1}>
              <h2>Timestamps and freshness</h2>
              <p>Every quote carries the time Banthom fetched it from the venue. Times are shown in US Eastern time.</p>
              <ul className="status-legend">
                <li><Badge tone="success" icon="circle-dot">Recent</Badge><span>Fetched within 8 minutes. A full pass over every open market takes a few minutes on each venue.</span></li>
                <li><Badge tone="warning" icon="clock">Delayed</Badge><span>Older than that. The last quote stays visible with its time; alerts don’t fire on it.</span></li>
                <li><Badge tone="muted" icon="clock">Waiting for data</Badge><span>Banthom hasn’t received this quote yet, for example right after the server starts.</span></li>
              </ul>
              <p>The “Live” tag on a market page means the data is real and comes from the venue. It doesn’t mean streaming: how current a quote is always appears next to it.</p>
            </section>

            <section id="m-volume" tabIndex={-1}>
              <h2>Volume and open interest</h2>
              <p><strong>Volume</strong> is what traded over the last 24 hours. Kalshi reports contracts and Polymarket reports USDC, so the unit is printed with every figure. To rank markets across both venues, Banthom converts Kalshi volume to an approximate dollar figure (contracts × the Yes price) and uses Polymarket’s USDC figure as it is. <strong>Open interest</strong> is the number of contracts outstanding, where the venue reports it.</p>
            </section>

            <section id="m-charts" tabIndex={-1}>
              <h2>Price history and missing data</h2>
              <p>Price history comes from each venue: 1-minute values for one day, hourly values for one week and one month, and daily values since listing. Kalshi charts plot the midpoint of each candle’s closing Yes bid and ask; Polymarket charts plot the venue’s recorded Yes price. The interval is named under every chart.</p>
              <p>When a venue has no price for an interval, the chart shows a gap. Gaps are never filled in, and lines are never drawn across them.</p>
            </section>

            <section id="m-matching" tabIndex={-1}>
              <h2>Suggested and verified pairs</h2>
              <p>Banthom suggests where Kalshi and Polymarket list the same question. Every ten minutes it compares active markets that traded at least $100 in the past 24 hours:</p>
              <ul>
                <li>Titles are normalised (common words dropped, synonyms such as “cut” and “decrease” aligned) and compared word by word.</li>
                <li>Numbers must agree (thresholds, basis points, prices), years must agree, and direction words such as “above” and “below” must agree.</li>
                <li>Closing dates must be within seven days of each other.</li>
                <li>For Polymarket markets with named sides, the Yes side must appear in the Kalshi market.</li>
                <li>A pair is kept only when each market is the other’s best match.</li>
              </ul>
              <p>A new pair is labelled <strong>suggested</strong> and <strong>unverified</strong>: nobody has reviewed the rules yet, and the venues can still settle differently (different sources, deadlines, timezones or edge cases). The match percentage measures how closely the titles agree; it isn’t a probability that the contracts are equivalent.</p>
              <p>A reviewer then reads both venues’ rules. A pair that asks the same question is marked <strong>Verified</strong> and stays paired for as long as both markets are open. A pair that doesn’t is removed and never suggested again. Verified means the questions match; fees, settlement currency and order depth still differ between venues.</p>
              <p className="formula-block"><code>gap = Kalshi Yes midpoint − Polymarket Yes midpoint</code><span>In percentage points, before fees, order depth, execution timing, settlement currency and venue limits. A gap is not an opportunity until both rule sets have been read.</span></p>
            </section>

            <section id="m-closed" tabIndex={-1}>
              <h2>Closed and settled markets</h2>
              <p>Banthom lists open markets. A market that closes or settles drops out of lists at the next refresh. Its page keeps loading for as long as the venue serves it, with its status shown. Watchlists keep the market’s name so you can remove it.</p>
            </section>

            <section id="m-saved" tabIndex={-1}>
              <h2>Watchlists and alerts</h2>
              <p>Banthom has no accounts yet. Watchlists, alert rules and alert history are saved in your browser and never sent to Banthom’s server. Alerts are checked every 30 seconds while Banthom is open, only against quotes fetched within the freshness window, and at most once per rule’s cooldown.</p>
            </section>

            <section id="m-changes" tabIndex={-1}>
              <h2>Methodology change log</h2>
              <ul className="changelog">
                <li><span className="mono">v0.3</span><span>Nov 10, 2026</span><span>Pairs can be reviewed: verified pairs are labelled, pairs found to differ are removed.</span></li>
                <li><span className="mono">v0.2</span><span>Nov 10, 2026</span><span>Real Kalshi and Polymarket data replaces the simulated venues. Suggested cross-venue pairs replace reviewed matches. Research summaries are removed until real sources are in place.</span></li>
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
