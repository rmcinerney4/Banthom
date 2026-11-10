// Pair review (password-protected, not in the navigation): read both venues' rules, then mark a
// suggested Kalshi–Polymarket pair as verified (same question) or wrong (hidden everywhere).
import React from 'react';
import { Icon, Button, Badge, Panel, PageHeader, EmptyState, Banner, Tabs, Field, Skeleton, KeyValue, VenueBadge, Kbd } from '../ui/core.jsx';
import { useStore } from '../store.jsx';
import { fmtCentsAuto, fmtDateTimeShort, fmtDate, fmtPP, fmtInt, cx, isNum } from '../lib/format.js';
import { LIVE_VENUES, reviewCall, marketHref } from '../data/live.js';
import { useTitle, rowName, volText, PairBadge } from './kit.jsx';

const { useState, useEffect, useCallback, useMemo, useRef } = React;
const KEY_SLOT = 'banthom:review-key';
const stored = () => { try { return sessionStorage.getItem(KEY_SLOT) || ''; } catch { return ''; } };
const remember = (k) => { try { if (k) sessionStorage.setItem(KEY_SLOT, k); else sessionStorage.removeItem(KEY_SLOT); } catch { /* private mode */ } };
const paras = (t) => String(t || '').split(/\n{2,}|\r?\n/).map((x) => x.trim()).filter(Boolean);
const nameOfPair = (p) => (p.k ? rowName(p.k) : p.kName || 'Closed market');

function Gate({ onUnlock }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!pw) { setErr('Enter the review password.'); return; }
    setBusy(true);
    try { const data = await reviewCall(pw); remember(pw); onUnlock(pw, data); } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };
  return (
    <Panel title="Reviewer sign-in" className="narrow-panel">
      <form className="stack" onSubmit={submit}>
        <Field id="rv-pw" label="Review password" error={err}>
          <input id="rv-pw" className="input" type="password" autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!err} aria-describedby={err ? 'rv-pw-err' : undefined} />
        </Field>
        <div className="row"><Button type="submit" variant="primary" loading={busy}>Unlock</Button></div>
        <p className="muted small">The password is kept for this browser tab only and is sent with each review request.</p>
      </form>
    </Panel>
  );
}

function Side({ r, detail, name }) {
  const v = LIVE_VENUES[r ? r.venue : name.venue];
  if (!r) return <Panel title={<span className="row"><VenueBadge venue={name.venue} full />{name.text || 'Closed market'}</span>}><p className="muted small">This market has closed, so its quote and rules are no longer available.</p></Panel>;
  const m = detail && detail.market;
  const text = m ? (r.venue === 'kalshi' ? [...paras(m.rulesPrimary), ...paras(m.rulesSecondary)] : paras(m.rules)) : [];
  return (
    <Panel title={<span className="row"><VenueBadge venue={r.venue} full />{rowName(r)}</span>}
      actions={<><Button size="sm" variant="ghost" href={marketHref(r.id)} target="_blank" rel="noopener">Banthom page</Button>
        <Button size="sm" variant="ghost" icon="external-link" href={v.marketUrl(detail && detail.event ? detail.event : null)} target="_blank" rel="noopener noreferrer">{v.name}</Button></>}>
      <KeyValue items={[
        ['Yes bid / ask', `${fmtCentsAuto(r.bid)} / ${fmtCentsAuto(r.ask)}`],
        ['Volume 24h', volText(r)],
        ['Closes', fmtDateTimeShort(r.closes)],
        ['Category', r.category],
        ...(m && m.resolutionSource ? [['Resolution source', m.resolutionSource.url
          ? <a href={m.resolutionSource.url} target="_blank" rel="noopener noreferrer">{m.resolutionSource.name}</a> : String(m.resolutionSource.name || '').slice(0, 120)]] : []),
        ...(detail && detail.event && detail.event.sources && detail.event.sources.length ? [['Settlement sources', detail.event.sources.map((x) => x.name).join(', ')]] : []),
      ]} />
      <p className="label rules-label">Rules as published by {v.name}</p>
      {detail === undefined ? <Skeleton h={120} /> : text.length ? <blockquote className="rules-quote rv-rules">{text.map((x, i) => <p key={i}>{x}</p>)}</blockquote>
        : <p className="muted small">{v.name} hasn’t published rule text for this market{detail === null ? ', or it could not be loaded' : ''}. Open it on {v.name} before deciding.</p>}
    </Panel>
  );
}

export function Review() {
  useTitle('Pair review');
  const { toast } = useStore();
  const [key, setKey] = useState(stored);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('suggested');
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(undefined);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const noteRef = useRef(null);

  const load = useCallback(async (k = key) => {
    try { setData(await reviewCall(k)); setError(null); } catch (ex) {
      if (ex.status === 401 || ex.status === 429) { remember(''); setKey(''); setData(null); }
      setError(ex);
    }
  }, [key]);
  useEffect(() => { if (key && !data) load(); }, [key]);

  const lists = useMemo(() => {
    const all = data ? data.pairs : [];
    return { suggested: all.filter((p) => p.status === 'suggested'), verified: all.filter((p) => p.status === 'verified'), wrong: all.filter((p) => p.status === 'wrong') };
  }, [data]);
  const rows = lists[tab];
  const cur = rows.find((p) => p.id === sel) || rows[0] || null;
  const curId = cur ? cur.id : null;

  useEffect(() => {
    setNote(cur && cur.note ? cur.note : '');
    setDetail(undefined);
    if (!curId || !cur.k || !cur.p) { setDetail(null); return undefined; }
    let alive = true;
    reviewCall(key, `/${curId}`).then((d) => { if (alive) setDetail(d); }).catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [curId]);

  const decide = useCallback(async (status) => {
    if (!cur || busy) return;
    setBusy(true);
    const i = rows.findIndex((p) => p.id === cur.id);
    const next = rows[i + 1] || rows[i - 1] || null;
    try {
      await reviewCall(key, `/${cur.id}`, { status, note: note.trim() });
      toast(status === 'verified' ? 'Marked verified. It now shows as Verified on the site.' : status === 'wrong' ? 'Marked wrong. It is hidden everywhere and won’t be suggested again.' : 'Decision undone. The pair is back in the queue.');
      setSel(next ? next.id : null);
      await load();
    } catch (ex) { toast(ex.message, { tone: 'error' }); }
    setBusy(false);
  }, [cur, busy, rows, key, note, load, toast]);
  const skip = useCallback(() => { if (!cur) return; const i = rows.findIndex((p) => p.id === cur.id); setSel((rows[i + 1] || rows[0]).id); }, [cur, rows]);

  useEffect(() => {
    if (tab !== 'suggested') return undefined;
    const onKey = (e) => {
      const t = e.target;
      if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'))) return;
      if (e.key === 'v') { e.preventDefault(); decide('verified'); }
      else if (e.key === 'x') { e.preventDefault(); decide('wrong'); }
      else if (e.key === 's') { e.preventDefault(); skip(); }
      else if (e.key === 'n') { e.preventDefault(); if (noteRef.current) noteRef.current.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, decide, skip]);

  if (!key || !data) {
    return (
      <div className="page-stack">
        <PageHeader title="Pair review" sub="Confirm which Kalshi–Polymarket pairs really ask the same question" />
        {error && error.status !== 401 && <Banner tone="warning" icon="circle-alert" title="Review isn’t available.">{error.message}</Banner>}
        {key && !error ? <Skeleton h={160} /> : <Gate onUnlock={(k, d) => { setKey(k); setData(d); setError(null); }} />}
      </div>
    );
  }

  const gap = cur && cur.k && cur.p && isNum(cur.k.mid) && isNum(cur.p.mid) ? cur.k.mid - cur.p.mid : null;
  return (
    <div className="page-stack">
      <PageHeader title="Pair review" sub="Read both venues’ rules. Verify a pair only if every outcome would settle the same way on both."
        meta={<span className="muted small">{fmtInt(lists.suggested.length)} to review · {fmtInt(lists.verified.length)} verified · {fmtInt(lists.wrong.length)} marked wrong</span>}
        actions={<><Button variant="ghost" icon="refresh-cw" onClick={() => load()}>Refresh</Button><Button variant="ghost" icon="lock" onClick={() => { remember(''); setKey(''); setData(null); }}>Lock</Button></>} />
      {data.store && data.store.lastError && <Banner tone="warning" icon="circle-alert" title="Decisions aren’t being saved.">{data.store.lastError}</Banner>}
      <Tabs idBase="rv" label="Review lists" value={tab} onChange={(t) => { setTab(t); setSel(null); }}
        tabs={[{ id: 'suggested', label: 'To review', count: lists.suggested.length }, { id: 'verified', label: 'Verified', count: lists.verified.length }, { id: 'wrong', label: 'Marked wrong', count: lists.wrong.length }]} />
      {!rows.length ? (
        <Panel><EmptyState title={tab === 'suggested' ? 'Nothing left to review.' : tab === 'verified' ? 'No verified pairs yet.' : 'No pairs marked wrong.'}>
          {tab === 'suggested' ? 'New suggestions appear as markets open; pairs are re-checked every ten minutes.' : 'Decisions you make in “To review” are listed here, and can be undone.'}
        </EmptyState></Panel>
      ) : (
        <div className="grid rv-grid">
          <div className="s-4 md-12">
            <Panel flush title={tab === 'suggested' ? 'Most active first' : 'Decisions'} className="rv-list-panel">
              <ul className="rv-list" aria-label="Pairs">
                {rows.map((p) => (
                  <li key={p.id}>
                    <button type="button" className={cx('rv-item', cur && p.id === cur.id && 'is-active')} aria-current={cur && p.id === cur.id ? 'true' : undefined} onClick={() => setSel(p.id)}>
                      <span className="rv-item-name">{nameOfPair(p)}</span>
                      <span className="rv-item-meta mono">{p.k && p.p ? `${fmtCentsAuto(p.k.mid)} / ${fmtCentsAuto(p.p.mid)}` : 'closed'}{tab === 'suggested' ? ` · titles ${Math.round(p.score * 100)}%` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <div className="s-8 md-12 col-stack">
            <Panel title="Decision" sub={cur.reviewedAt ? `Decided ${fmtDate(cur.reviewedAt)}` : 'Same question on both venues?'}
              actions={tab !== 'suggested' ? <PairBadge status={cur.status === 'verified' ? 'verified' : 'suggested'} /> : null}>
              <div className="rv-facts">
                <span>Gap <strong className="mono">{fmtPP(gap)}</strong></span>
                {cur.k && cur.p && <span>Closes <strong>{fmtDate(cur.k.closes)}</strong> vs <strong>{fmtDate(cur.p.closes)}</strong></span>}
                <span>Title match <strong>{Math.round(cur.score * 100)}%</strong></span>
              </div>
              <Field id="rv-note" label="Note" optional hint="Shown on the comparison page for verified pairs. For wrong pairs it’s kept for your records.">
                <input id="rv-note" ref={noteRef} className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} aria-describedby="rv-note-hint" placeholder="e.g. Both settle on the Fed’s statement of Dec 9" />
              </Field>
              {tab === 'suggested' ? (
                <div className="row rv-actions">
                  <Button variant="primary" icon="badge-check" loading={busy} onClick={() => decide('verified')}>Same question: verify</Button>
                  <Button variant="destructive" icon="ban" disabled={busy} onClick={() => decide('wrong')}>Different: hide</Button>
                  <Button variant="ghost" disabled={busy} onClick={skip}>Skip</Button>
                  <span className="muted small rv-keys"><Kbd>V</Kbd> verify <Kbd>X</Kbd> hide <Kbd>S</Kbd> skip <Kbd>N</Kbd> note</span>
                </div>
              ) : (
                <div className="row rv-actions">
                  <Button variant="secondary" icon="undo-2" loading={busy} onClick={() => decide('clear')}>Undo this decision</Button>
                  {tab === 'verified' && <Button variant="ghost" disabled={busy} onClick={() => decide('verified')}>Save note</Button>}
                </div>
              )}
            </Panel>
            <div className="grid">
              <div className="s-6 md-12"><Side r={cur.k} detail={detail === undefined ? undefined : detail && detail.kalshi} name={{ venue: 'kalshi', text: cur.kName }} /></div>
              <div className="s-6 md-12"><Side r={cur.p} detail={detail === undefined ? undefined : detail && detail.polymarket} name={{ venue: 'polymarket', text: cur.pName }} /></div>
            </div>
            <p className="muted small live-note"><Icon n="info" size={13} /> Check the outcome definition, the resolution source, the deadline and timezone, and what happens in edge cases (postponement, ties, voided events). If any differ, hide the pair.</p>
          </div>
        </div>
      )}
    </div>
  );
}
