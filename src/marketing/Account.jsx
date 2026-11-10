import React from 'react';
import { Icon, Logo, LogoMark, Button, Field, describedBy, Check, Banner, Switch } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { go } from '../lib/hooks.js';
import { cx } from '../lib/format.js';

const { useState } = React;

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

// ---------------------------------------------------------------- Auth (sign up, sign in, password reset)
export function Auth({ mode }) {
  const { toast } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [remember, setRemember] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const pwRules = [
    ['At least 12 characters', password.length >= 12],
    ['A number or symbol', /[\d\W_]/.test(password)],
  ];
  const errs = {
    email: !email ? 'Enter your email address.' : !emailOk(email) ? 'Enter an email address like name@company.com.' : null,
    password: mode === 'forgot' ? null : !password ? 'Enter a password.' : mode === 'sign-up' && !pwRules.every((r) => r[1]) ? 'Password doesn’t meet the requirements below.' : null,
    terms: mode === 'sign-up' && !terms ? 'Accept the terms and privacy notice to continue.' : null,
  };
  const show = (k) => (touched[k] || submitted) && errs[k];
  const submit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errs).some(Boolean)) {
      const first = ['email', 'password', 'terms'].find((k) => errs[k]);
      const el = document.getElementById(`auth-${first}`);
      if (el) el.focus();
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (mode === 'forgot') { setSent(true); return; }
      toast('Accounts aren’t available yet, so nothing was created or signed in. Your watchlists and alerts are saved in this browser.', { tone: 'info' });
      go(mode === 'sign-up' ? 'onboarding' : 'app-dashboard');
    }, 900);
  };

  const titles = {
    'sign-up': ['Create your research workspace', 'Free to start. No card required.'],
    'sign-in': ['Log in to Banthom', 'Welcome back.'],
    forgot: ['Reset your password', 'Enter the email you use for Banthom and we’ll send a reset link.'],
  };
  const [h1, sub] = titles[mode];

  return (
    <div className="auth">
      <aside className="auth-brand" aria-hidden="true">
        <Logo href="#home" />
        <div className="auth-brand-body">
          <p className="auth-quote">See the probability. Understand the market.</p>
          <ul className="auth-points">
            <li><Icon n="list-filter" size={18} />Every Kalshi and Polymarket market in one screener</li>
            <li><Icon n="scroll-text" size={18} />The venue’s rules beside every price</li>
            <li><Icon n="git-compare-arrows" size={18} />The same question compared across venues</li>
          </ul>
        </div>
        <svg className="auth-line" viewBox="0 0 400 120" preserveAspectRatio="none" focusable="false">
          <path d="M0 96 L40 90 L70 92 L110 78 L150 80 L170 64 L210 66 L250 52 L280 56 L320 38 L360 42 L400 26" fill="none" stroke="var(--chart-1)" strokeWidth="2" />
        </svg>
      </aside>
      <main id="main" className="auth-main">
        <div className="auth-top"><Logo href="#home" /><a href="#home" className="small muted-link">Back to website</a></div>
        <div className="auth-card">
          <h1 className="auth-title" tabIndex={-1} data-route-focus>{h1}</h1>
          <p className="muted">{sub}</p>
          {sent ? (
            <div className="stack auth-sent" role="status">
              <Banner tone="info" icon="mail" title="Check your email.">If an account exists for that address, we’ve sent a one-time reset link. It expires in 30 minutes.</Banner>
              <Button variant="secondary" href="#sign-in" block>Back to log in</Button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit} noValidate>
              {mode !== 'forgot' && (
                <>
                  <Button variant="secondary" size="lg" block icon="building-2" onClick={() => toast('Single sign-on isn’t available yet.', { tone: 'info' })}>Continue with single sign-on</Button>
                  <div className="auth-or"><span>or use email</span></div>
                </>
              )}
              <Field id="auth-email" label="Email" error={show('email')}>
                <input id="auth-email" className="input" type="email" autoComplete="email" inputMode="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  aria-invalid={!!show('email')} aria-describedby={describedBy('auth-email', null, show('email'))} placeholder="name@company.com" />
              </Field>
              {mode !== 'forgot' && (
                <Field id="auth-password" label="Password" error={show('password')}>
                  <div className="input-wrap">
                    <input id="auth-password" className="input pw-input" type={showPw ? 'text' : 'password'} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                      value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                      aria-invalid={!!show('password')} aria-describedby={cx(describedBy('auth-password', null, show('password')), mode === 'sign-up' && 'pw-rules') || undefined} />
                    <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)} aria-pressed={showPw}>{showPw ? 'Hide' : 'Show'}</button>
                  </div>
                </Field>
              )}
              {mode === 'sign-up' && (
                <ul className="pw-rules" id="pw-rules" aria-label="Password requirements">
                  {pwRules.map(([l, ok]) => <li key={l} className={ok ? 'is-ok' : ''}><Icon n={ok ? 'circle-check' : 'circle-dashed'} size={14} />{l}<span className="sr-only">{ok ? ' (met)' : ' (not met)'}</span></li>)}
                </ul>
              )}
              {mode === 'sign-in' && (
                <div className="row-between">
                  <Check id="auth-remember" checked={remember} onChange={setRemember} label="Stay signed in on this device" />
                  <a href="#forgot-password" className="small">Forgot password?</a>
                </div>
              )}
              {mode === 'sign-up' && (
                <div className="stack auth-consents">
                  <div>
                    <Check id="auth-terms" checked={terms} onChange={(v) => { setTerms(v); setTouched((t) => ({ ...t, terms: true })); }}
                      label={<>I agree to the <a href="#legal-terms">terms of service</a> and <a href="#legal-privacy">privacy notice</a>.</>} />
                    {show('terms') && <p className="field-error auth-terms-err" id="auth-terms-err"><Icon n="circle-alert" size={14} />{errs.terms}</p>}
                  </div>
                  <Check id="auth-marketing" checked={marketing} onChange={setMarketing} label="Send me occasional product updates (optional)." />
                </div>
              )}
              <Button type="submit" variant="primary" size="lg" block loading={loading}>
                {mode === 'sign-up' ? 'Create account' : mode === 'sign-in' ? 'Log in' : 'Send reset link'}
              </Button>
              <p className="auth-switch">
                {mode === 'sign-up' && <>Already have an account? <a href="#sign-in">Log in</a></>}
                {mode === 'sign-in' && <>New to Banthom? <a href="#sign-up">Create a free account</a></>}
                {mode === 'forgot' && <><a href="#sign-in">Back to log in</a></>}
              </p>
            </form>
          )}
          <p className="auth-demo"><Icon n="info" size={14} />Accounts aren’t available yet: this form validates but nothing is sent or stored. You don’t need an account to use the terminal. <a href="#app-dashboard">Open the terminal</a></p>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- First-run onboarding
const INTENTS = [
  ['trade', 'Trade-focused', 'Screeners, bid and ask, and cross-venue comparisons first.', 'activity'],
  ['research', 'Research-focused', 'Price history, events and venue rules first.', 'microscope'],
  ['both', 'Both', 'A balanced dashboard. You can change this any time.', 'layers'],
];
const TAGS = ['Fed', 'Inflation', 'Elections', 'Bitcoin', 'NFL', 'NBA', 'Weather', 'AI'];

export function Onboarding() {
  const { setPref, prefs, toast } = useStore();
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState(null);
  const [cats, setCats] = useState([]);
  const [tags, setTags] = useState([]);
  const [inApp, setInApp] = useState(true);
  const [digest, setDigest] = useState(false);
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const finish = (skipped) => {
    setPref('onboarded', true);
    if (!skipped) { setPref('intent', intent); setPref('interests', [...cats, ...tags]); }
    toast(skipped ? 'Setup skipped. You can personalize the terminal in Settings.' : 'Your terminal is ready.', { tone: skipped ? 'info' : 'success' });
    go('app-dashboard');
  };
  const steps = ['How you’ll use Banthom', 'What you follow', 'Notifications'];
  const canNext = step === 0 ? !!intent : true;
  return (
    <div className="onb">
      <header className="onb-top"><Logo href="#home" /><button type="button" className="btn btn-ghost btn-sm" onClick={() => finish(true)}>Skip setup</button></header>
      <main id="main" className="onb-main">
        <p className="label">Step {step + 1} of 3</p>
        <ol className="onb-steps" aria-label="Setup progress">
          {steps.map((s, i) => <li key={s} className={cx(i < step && 'is-done', i === step && 'is-current')} aria-current={i === step ? 'step' : undefined}><span className="sr-only">{i < step ? 'Completed: ' : i === step ? 'Current: ' : ''}</span>{s}</li>)}
        </ol>
        <h1 className="onb-title" tabIndex={-1} data-route-focus>Make the terminal yours.</h1>
        {step === 0 && (
          <fieldset className="fieldset">
            <legend className="onb-legend">How will you mostly use Banthom?</legend>
            <div className="choice-grid" role="radiogroup" aria-label="Intended use">
              {INTENTS.map(([id, label, desc, icon]) => (
                <button key={id} type="button" role="radio" aria-checked={intent === id} className={cx('choice', intent === id && 'is-on')} onClick={() => setIntent(id)}>
                  <Icon n={icon} size={20} /><span className="choice-label">{label}</span><span className="choice-desc">{desc}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {step === 1 && (
          <div className="stack">
            <fieldset className="fieldset">
              <legend className="onb-legend">Categories</legend>
              <div className="choice-grid">
                {[['Politics', 'landmark'], ['Elections', 'vote'], ['Economics', 'trending-up'], ['Finance', 'banknote'], ['Crypto', 'bitcoin'], ['Sports', 'trophy'], ['Geopolitics', 'globe'], ['Science & Tech', 'cpu']].map(([c, icon]) => (
                  <button key={c} type="button" aria-pressed={cats.includes(c)} className={cx('choice choice-sm', cats.includes(c) && 'is-on')} onClick={() => toggle(cats, setCats, c)}>
                    <Icon n={icon} size={18} /><span className="choice-label">{c}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="fieldset">
              <legend className="onb-legend">Topics <span className="muted">(optional)</span></legend>
              <div className="row">{TAGS.map((t) => <button key={t} type="button" aria-pressed={tags.includes(t)} className={cx('chip chip-btn', tags.includes(t) && 'is-on')} onClick={() => toggle(tags, setTags, t)}>{tags.includes(t) && <Icon n="check" size={13} />}{t}</button>)}</div>
            </fieldset>
          </div>
        )}
        {step === 2 && (
          <div className="onb-panel">
            <Switch label="In-app alerts" hint="Notifications inside the terminal when an alert rule fires, while Banthom is open." checked={inApp} onChange={setInApp} />
            <Switch label="Daily email digest" hint="Needs an account. Not available yet." checked={digest} onChange={setDigest} disabled />
            <p className="muted small onb-note"><Icon n="info" size={14} />Banthom only asks for browser notification permission if you turn it on under Alerts → Delivery.</p>
          </div>
        )}
        <div className="onb-actions">
          {step > 0 ? <Button variant="ghost" icon="arrow-left" onClick={() => setStep(step - 1)}>Back</Button> : <span />}
          {step < 2 ? (
            <Button variant="primary" iconRight="arrow-right" onClick={() => canNext && setStep(step + 1)} aria-disabled={!canNext} title={!canNext ? 'Choose an option to continue' : undefined}>Continue</Button>
          ) : (
            <Button variant="primary" onClick={() => finish(false)}>Open my terminal</Button>
          )}
        </div>
        {step === 0 && !intent && <p className="muted small onb-hint">Choose one to continue. Nothing is preselected.</p>}
        {prefs.onboarded && <p className="muted small onb-hint">You’ve set this up before. Finishing again replaces your earlier choices.</p>}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- Pages specified but not built yet
const STUBS = {
  product: ['4.2', 'Product', 'One terminal. The full picture.', 'Browse, verify, compare and monitor event contracts in one workspace, with the evidence beside every number.',
    ['Who it helps: trader and researcher toggle', 'Browse and screen markets', 'Analyze contract charts and rulebooks', 'Compare venues', 'Explain change with cited research', 'Save and monitor', 'Security and data methodology', 'Call to action'], ['Open the terminal', '#app-dashboard']],
  features: ['4.3', 'Features', 'A complete toolkit for event-driven analysis.', 'Screener, comparison, watchlists and alerts, each built on real Kalshi and Polymarket data.',
    ['Feature cards: screener, comparison, watchlists and alerts', 'Supporting capabilities: price history, order books, venue rules', 'Availability by plan', 'FAQ and call to action'], ['Open the market explorer', '#app-markets']],
  'features-market-screener': ['4.4', 'Market screener', 'Find the markets that matter, fast.', 'Every open Kalshi and Polymarket market, with sortable columns and top-of-book prices showing when each was fetched.',
    ['The problem', 'Three product behaviors', 'Annotated interface', 'Workflow example', 'Caveats and methodology', 'Related use cases', 'FAQ'], ['Open the market explorer', '#app-markets']],
  'features-market-comparison': ['4.4', 'Market comparison', 'Compare contracts, not just titles.', 'Suggested Kalshi–Polymarket pairs with both venues’ rules side by side. Every pair is labelled unverified until someone has read both rule sets.',
    ['The problem', 'Three product behaviors', 'Annotated interface', 'Workflow example', 'Caveats and methodology', 'Related use cases', 'FAQ'], ['Open Compare', '#app-compare']],
  'features-alerts-watchlists': ['4.4', 'Alerts and watchlists', 'Know when a market crosses your threshold.', 'Thresholds with units, cooldowns and alerts that only fire on current quotes. Saved in your browser for now.',
    ['The problem', 'Three product behaviors', 'Annotated interface', 'Sample alert', 'Caveats and methodology', 'Related use cases', 'FAQ'], ['Open alerts', '#app-alerts']],
  'solutions-traders': ['4.5', 'For traders', 'Screen faster. Verify the contract. See the spread.', 'Analyze the whole market, not just one venue. Compare contracts, inspect liquidity and monitor price movement, with contract differences and fees made clear.',
    ['Market discovery', 'Quote depth and executable price', 'Cross-exchange qualification', 'Alerts and watchlists', 'Market detail screenshot', 'Risks and FAQ'], ['Open the market explorer', '#app-markets']],
  'solutions-researchers': ['4.5', 'For researchers', 'Turn market prices into research-ready context.', 'Study price history, every outcome of an event and the venues’ own rules, across Kalshi and Polymarket.',
    ['Event and category dashboards', 'Historical prices', 'Venue rules and settlement sources', 'Related financial data', 'Methodology and exports', 'FAQ'], ['Browse markets', '#app-markets']],
  resources: ['4.8', 'Resources', 'Learn to read event markets.', 'Guides on contract probabilities, settlement risk, liquidity and the difference between market pricing and outcome frequency.',
    ['Featured guide', 'Search and categories', 'Article grid', 'Glossary', 'Newsletter sign-up with consent', 'Call to action'], ['Read the methodology', '#methodology']],
  security: ['4.8', 'Security', 'Built for trustworthy research.', 'How data access, accounts and retention work. Only certifications actually held will be listed.',
    ['Data access boundaries', 'Account protections', 'Verified subprocessors', 'Retention and privacy', 'Incident contact', 'Disclosure status'], ['Read the methodology', '#methodology']],
  about: ['4.8', 'About', 'Clarity in uncertain markets.', 'Mission, product values and a non-binding roadmap. Team members appear only with verified names and credentials.',
    ['Mission', 'Product values', 'Roadmap (non-binding)', 'Verified team credentials', 'Contact and press'], ['Contact us', '#contact']],
  contact: ['4.8', 'Contact', 'Talk to our team.', 'Sales, support, data rights and press enquiries.',
    ['Reason selector: Sales, Support, Data rights, Press', 'Form: name, work email, organization (optional), message', 'Expected response wording (no invented SLA)', 'Support links', 'Privacy disclosure'], ['Back to home', '#home']],
  changelog: ['4.8', 'Changelog', 'Changelog', 'Product changes, data-source updates and historical corrections, newest first.', ['Version filters', 'Reverse-chronological entries', 'Corrections log', 'RSS feed if implemented'], ['Back to home', '#home']],
  status: ['2.1', 'Status', 'Service status', 'Linked to a real status provider at launch, with per-source health.', ['Current status', 'Per-source freshness', 'Incident history'], ['Back to home', '#home']],
  'legal-terms': ['2.1', 'Legal', 'Terms of service', 'Legal-approved terms will be published here before launch.', ['Published only after legal review'], ['Back to home', '#home']],
  'legal-privacy': ['2.1', 'Legal', 'Privacy notice', 'A legal-approved privacy notice will be published here before launch.', ['Published only after legal review'], ['Back to home', '#home']],
  'legal-disclosures': ['2.1', 'Legal', 'Market data and risk disclosures', 'Approved disclosures covering data sources and market risk will be published here.', ['Market data and attribution', 'Risk disclosure'], ['Read the methodology', '#methodology']],
};
export const STUB_ROUTES = Object.keys(STUBS);

export function Stub({ route }) {
  const [spec, eyebrow, title, sub, sections, [cta, href]] = STUBS[route];
  return (
    <section className="page-hero stub">
      <div className="container page-hero-inner">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mkt-h1 page-hero-h1" tabIndex={-1} data-route-focus>{title}</h1>
        <p className="hero-sub">{sub}</p>
        <div className="stub-card">
          <p className="stub-flag"><Icon n="layout-template" size={16} />Specified in DESIGN_SPEC §{spec}. Not built yet.</p>
          <p className="label">Planned sections</p>
          <ol className="stub-list">{sections.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
        <div className="row"><Button variant="primary" href={href} iconRight="arrow-right">{cta}</Button><Button variant="ghost" href="#home">Home</Button></div>
      </div>
    </section>
  );
}

export function NotFound() {
  return (
    <section className="page-hero stub">
      <div className="container page-hero-inner">
        <p className="eyebrow">Not found</p>
        <h1 className="mkt-h1 page-hero-h1" tabIndex={-1} data-route-focus>This page doesn’t exist.</h1>
        <p className="hero-sub">The link may be out of date. Try the terminal or go back to the homepage.</p>
        <div className="row"><Button variant="primary" href="#app-dashboard">Open the terminal</Button><Button variant="ghost" href="#home">Home</Button></div>
      </div>
    </section>
  );
}

export { LogoMark };
