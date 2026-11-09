import React from 'react';
import { useWidth, useStableId } from '../lib/hooks.js';
import { dt, MIN, HOUR, DAY } from '../lib/time.js';
import { etParts, fmtCents, fmtCentsAuto, fmtDateTimeShort, fmtDateShort, fmtTimeBare, fmtMonth, cx, isNum, fmtInt } from '../lib/format.js';

const { useMemo, useRef, useState, useCallback } = React;

export const SERIES_STYLE = [
  { color: 'var(--chart-1)', dash: null, key: 'solid' },
  { color: 'var(--chart-2)', dash: '6 4', key: 'dashed' },
  { color: 'var(--chart-3)', dash: '1.5 3.5', key: 'dotted' },
];

// ---- scales and ticks
function niceStep(range, target) {
  const raw = range / Math.max(1, target);
  const steps = [0.5, 1, 2, 5, 10, 20, 25, 50];
  return steps.find((s) => s >= raw) || 50;
}
function yDomain(series, fullScale, domain, zeroLine) {
  if (domain) return domain;
  if (fullScale) return [0, 100];
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series) for (const p of s.points) if (isNum(p.v)) { lo = Math.min(lo, p.v); hi = Math.max(hi, p.v); }
  if (zeroLine) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (!Number.isFinite(lo)) return [0, 100];
  const pad = Math.max((hi - lo) * 0.12, 1.5);
  lo -= pad; hi += pad;
  if (!zeroLine) { lo = Math.max(0, lo); hi = Math.min(100, hi); }
  return [lo, hi];
}
function yTicks([lo, hi], target = 4) {
  const step = niceStep(hi - lo, target);
  const start = Math.ceil(lo / step) * step;
  const out = [];
  for (let v = start; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}
const UNIT_MS = { m: MIN, h: HOUR, d: DAY, M: 30 * DAY };
const TICK_STEPS = [[1, 'm'], [5, 'm'], [10, 'm'], [15, 'm'], [30, 'm'], [1, 'h'], [2, 'h'], [3, 'h'], [6, 'h'], [12, 'h'], [1, 'd'], [2, 'd'], [7, 'd'], [14, 'd'], [1, 'M'], [2, 'M'], [3, 'M']];
function xTicks(from, to, width, minGap) {
  const span = to - from;
  const maxTicks = Math.max(2, Math.floor(width / minGap));
  const [k, u] = TICK_STEPS.find(([kk, uu]) => span / (kk * UNIT_MS[uu]) <= maxTicks) || [3, 'M'];
  const p = etParts(from);
  const out = [];
  if (u === 'm' || u === 'h') {
    const stepMin = u === 'm' ? k : k * 60;
    let total = Math.ceil((p.hour * 60 + p.minute) / stepMin) * stepMin;
    for (let i = 0; i < 400; i++) {
      const t = dt(p.year, p.month, p.day, 0, total);
      if (t > to) break;
      if (t >= from) out.push(t);
      total += stepMin;
    }
  } else if (u === 'd') {
    for (let i = 0; i < 400; i++) {
      const t = dt(p.year, p.month, p.day + i, 0, 0);
      if (t > to) break;
      if (t >= from && (k === 1 || (k === 7 || k === 14 ? new Date(t).getUTCDay() === 1 : i % k === 0))) out.push(t);
    }
    if (k === 14) for (let i = out.length - 1; i >= 0; i -= 2) out.splice(i, 1);
  } else {
    for (let i = 0; i < 60; i++) {
      const t = dt(p.year, p.month + i, 1, 0, 0);
      if (t > to) break;
      if (t >= from && i % k === 0) out.push(t);
    }
  }
  return { ticks: out, unit: u };
}
function tickLabel(t, unit) {
  if (unit === 'M') return fmtMonth(t);
  if (unit === 'd') return fmtDateShort(t);
  const p = etParts(t);
  if (p.hour === 0 && p.minute === 0) return fmtDateShort(t);
  return fmtTimeBare(t);
}

function buildPath(points, x, y, step) {
  let d = '';
  let prev = null;
  for (const p of points) {
    if (!isNum(p.v)) { prev = null; continue; }
    const X = x(p.t);
    const Y = y(p.v);
    if (!prev) d += `M${X.toFixed(1)},${Y.toFixed(1)}`;
    else if (step) d += `H${X.toFixed(1)}V${Y.toFixed(1)}`;
    else d += `L${X.toFixed(1)},${Y.toFixed(1)}`;
    prev = p;
  }
  return d;
}
function buildAreas(points, x, y, base, step) {
  const segs = [];
  let cur = [];
  for (const p of points) {
    if (!isNum(p.v)) { if (cur.length) segs.push(cur); cur = []; } else cur.push(p);
  }
  if (cur.length) segs.push(cur);
  return segs.filter((s) => s.length > 1).map((s) => {
    let d = `M${x(s[0].t).toFixed(1)},${base}`;
    s.forEach((p, i) => {
      if (step && i > 0) d += `H${x(p.t).toFixed(1)}`;
      d += `L${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`;
    });
    d += `L${x(s[s.length - 1].t).toFixed(1)},${base}Z`;
    return d;
  });
}

// ---- Price chart: crosshair + tooltip, gaps never interpolated, keyboard inspection, table twin.
export function PriceChart({
  series, from, to, height = 320, markers = [], gaps = [], yFormat = (v) => fmtCents(v, 1), fullScale, domain,
  step, compact, sampling, priceType = 'Yes midpoint', source, summary, zeroLine, view = 'chart', showEndLabels = true,
  markerLabel, ariaLabel = 'Price chart',
}) {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const [hover, setHover] = useState(null);
  const [kbd, setKbd] = useState(false);
  const descId = useStableId('chart-desc');
  const primary = series[0];
  const n = primary ? primary.points.length : 0;

  const m = compact
    ? { l: 36, r: showEndLabels ? 48 : 10, t: 10, b: 24 }
    : { l: 44, r: showEndLabels ? 64 : 12, t: 12, b: markers.length ? 40 : 28 };
  const W = Math.max(width, 120);
  const H = height;
  const plotB = H - m.b;
  const dom = useMemo(() => yDomain(series, fullScale, domain, zeroLine), [series, fullScale, domain, zeroLine]);
  const x = useCallback((t) => m.l + ((t - from) / (to - from || 1)) * (W - m.l - m.r), [from, to, W, m.l, m.r]);
  const y = useCallback((v) => m.t + (1 - (v - dom[0]) / (dom[1] - dom[0] || 1)) * (plotB - m.t), [dom, plotB, m.t]);
  const yt = useMemo(() => yTicks(dom, compact ? 3 : H > 260 ? 5 : 4), [dom, compact, H]);
  const xt = useMemo(() => xTicks(from, to, W - m.l - m.r, compact ? 96 : 84), [from, to, W, m.l, m.r, compact]);

  const paths = useMemo(() => series.map((s) => buildPath(s.points, x, y, step)), [series, x, y, step]);
  const areas = useMemo(() => (primary && series.length === 1 ? buildAreas(primary.points, x, y, plotB, step) : []), [series, primary, x, y, plotB, step]);

  const ends = useMemo(() => {
    const raw = series.map((s, i) => {
      for (let j = s.points.length - 1; j >= 0; j--) if (isNum(s.points[j].v)) return { i, t: s.points[j].t, v: s.points[j].v, y: y(s.points[j].v) };
      return null;
    }).filter(Boolean);
    const sorted = [...raw].sort((a, b) => a.y - b.y);
    let prev = -Infinity;
    for (const e of sorted) { e.ly = Math.max(e.y, prev + 15); prev = e.ly; }
    const over = sorted.length ? sorted[sorted.length - 1].ly - (plotB - 4) : 0;
    if (over > 0) for (const e of sorted) e.ly -= over;
    return raw;
  }, [series, y, plotB]);

  const idxFromX = (px) => {
    if (!n) return null;
    const t = from + ((px - m.l) / (W - m.l - m.r)) * (to - from);
    const t0 = primary.points[0].t;
    const stepMs = n > 1 ? primary.points[1].t - t0 : 1;
    return Math.max(0, Math.min(n - 1, Math.round((t - t0) / stepMs)));
  };
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (px < m.l - 4 || px > W - m.r + 4) { setHover(null); return; }
    setKbd(false);
    setHover(idxFromX(px));
  };
  const onKey = (e) => {
    if (!n) return;
    let i = hover == null ? n - 1 : hover;
    const big = Math.max(1, Math.round(n / 12));
    if (e.key === 'ArrowLeft') i -= e.shiftKey ? big : 1;
    else if (e.key === 'ArrowRight') i += e.shiftKey ? big : 1;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = n - 1;
    else if (e.key === 'Escape') { setHover(null); return; }
    else return;
    e.preventDefault();
    setKbd(true);
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  // Marker badges keep their true x for the guide line but spread apart so numbers never overlap.
  const markerPos = useMemo(() => {
    const list = markers.map((mk, i) => ({ mk, i, X: x(mk.t) })).filter((o) => o.X >= m.l && o.X <= W - m.r);
    let prev = -Infinity;
    for (const o of list) { o.cxPos = Math.max(o.X, prev + 18); prev = o.cxPos; }
    const over = list.length ? list[list.length - 1].cxPos - (W - 4) : 0;
    if (over > 0) for (const o of list) o.cxPos -= over;
    return list;
  }, [markers, x, m.l, m.r, W]);
  const hoverT = hover != null && primary ? primary.points[hover].t : null;
  const stepMs = n > 1 ? primary.points[1].t - primary.points[0].t : HOUR;
  const nearMarker = hoverT != null ? markers.find((mk) => Math.abs(mk.t - hoverT) <= stepMs * 1.5) : null;
  const tipLeft = hoverT != null ? x(hoverT) : 0;
  const flip = tipLeft > W - 240;

  if (view === 'table') {
    return (
      <figure className={cx('chart', compact && 'chart-compact')} ref={wrap}>
        <ChartTable series={series} yFormat={yFormat} sampling={sampling} />
        <figcaption className="sr-only">{summary}</figcaption>
      </figure>
    );
  }

  return (
    <figure className={cx('chart', compact && 'chart-compact')} ref={wrap}>
      {series.length > 1 && (
        <div className="chart-legend" aria-hidden="true">
          {series.map((s, i) => (
            <span key={s.id} className="legend-item">
              <svg width="22" height="8"><line x1="1" x2="21" y1="4" y2="4" stroke={s.color || SERIES_STYLE[i].color} strokeWidth="2" strokeDasharray={s.dash || SERIES_STYLE[i].dash || undefined} strokeLinecap="round" /></svg>
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="chart-stage" style={{ height: H }} tabIndex={0} role="group" aria-roledescription="interactive chart"
        aria-label={`${ariaLabel}. Use left and right arrow keys to read values.`} aria-describedby={descId}
        onKeyDown={onKey} onBlur={() => kbd && setHover(null)}>
        {width > 0 && (
          <svg width={W} height={H} className="chart-svg" onPointerMove={onMove} onPointerLeave={() => !kbd && setHover(null)} aria-hidden="true">
            {gaps.map(([a, b], i) => {
              const xa = Math.max(m.l, x(a));
              const xb = Math.min(W - m.r, x(b));
              if (xb - xa < 1) return null;
              return (
                <g key={i}>
                  <rect x={xa} y={m.t} width={Math.max(2, xb - xa)} height={plotB - m.t} className="chart-gap" />
                  {xb - xa > 46 && <text x={(xa + xb) / 2} y={m.t + 12} className="chart-gap-label" textAnchor="middle">No data</text>}
                </g>
              );
            })}
            {yt.map((v) => (
              <g key={v}>
                <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className={cx('chart-grid', zeroLine && v === 0 && 'chart-zero')} />
                <text x={m.l - 8} y={y(v) + 4} className="chart-tick" textAnchor="end">{yFormat(v, true)}</text>
              </g>
            ))}
            <line x1={m.l} x2={W - m.r} y1={plotB} y2={plotB} className="chart-axis" />
            {xt.ticks.map((t) => (
              <text key={t} x={x(t)} y={plotB + 17} className="chart-tick" textAnchor="middle">{tickLabel(t, xt.unit)}</text>
            ))}
            {areas.map((d, i) => <path key={i} d={d} fill={primary.color || SERIES_STYLE[0].color} opacity="0.1" />)}
            {markerPos.map(({ mk, i, X, cxPos }) => (
              <g key={mk.id} className={cx('chart-marker', nearMarker && nearMarker.id === mk.id && 'is-active')}>
                <line x1={X} x2={X} y1={m.t} y2={plotB} />
                {!compact && (
                  <>
                    {Math.abs(cxPos - X) > 1 && <line x1={X} x2={cxPos} y1={plotB + 2} y2={plotB + 22} className="chart-marker-leader" />}
                    <circle cx={cxPos} cy={plotB + 30} r="8" />
                    <text x={cxPos} y={plotB + 33.5} textAnchor="middle">{markerLabel ? markerLabel(mk, i) : i + 1}</text>
                  </>
                )}
              </g>
            ))}
            {series.map((s, i) => (
              <path key={s.id} d={paths[i]} fill="none" stroke={s.color || SERIES_STYLE[i].color} strokeWidth="2"
                strokeDasharray={s.dash || SERIES_STYLE[i].dash || undefined} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {showEndLabels && ends.map((e) => {
              const s = series[e.i];
              const X = x(e.t);
              return (
                <g key={s.id}>
                  {Math.abs(e.ly - e.y) > 2 && <line x1={X + 5} y1={e.y} x2={W - m.r + 6} y2={e.ly} className="chart-leader" />}
                  <circle cx={X} cy={e.y} r="4" fill={s.color || SERIES_STYLE[e.i].color} stroke="var(--chart-surface)" strokeWidth="2" />
                  <text x={W - m.r + 8} y={e.ly + 4} className="chart-endlabel">{yFormat(e.v)}</text>
                </g>
              );
            })}
            {hoverT != null && (
              <g className="chart-cross">
                <line x1={x(hoverT)} x2={x(hoverT)} y1={m.t} y2={plotB} />
                {series.map((s, i) => {
                  const p = s.points[hover];
                  if (!p || !isNum(p.v)) return null;
                  return <circle key={s.id} cx={x(p.t)} cy={y(p.v)} r="4.5" fill={s.color || SERIES_STYLE[i].color} stroke="var(--chart-surface)" strokeWidth="2" />;
                })}
              </g>
            )}
            <rect x="0" y="0" width={W} height={H} fill="transparent" />
          </svg>
        )}
        {hoverT != null && (
          <div className={cx('chart-tip', flip && 'is-flipped')} style={{ left: flip ? tipLeft - 12 : tipLeft + 12 }}>
            <div className="chart-tip-time">{fmtDateTimeShort(hoverT)}</div>
            {series.map((s, i) => {
              const p = s.points[hover];
              return (
                <div className="chart-tip-row" key={s.id}>
                  <svg width="16" height="8" aria-hidden="true"><line x1="1" x2="15" y1="4" y2="4" stroke={s.color || SERIES_STYLE[i].color} strokeWidth="2" strokeDasharray={s.dash || SERIES_STYLE[i].dash || undefined} /></svg>
                  <strong>{p && isNum(p.v) ? yFormat(p.v) : 'No observation'}</strong>
                  <span>{s.label}</span>
                </div>
              );
            })}
            <div className="chart-tip-meta">{priceType}{sampling ? ` · ${sampling}` : ''}{source ? ` · ${source}` : ''}</div>
            {nearMarker && <div className="chart-tip-event"><span className="chart-tip-pin">{(markers.indexOf(nearMarker) + 1)}</span>{nearMarker.title}</div>}
          </div>
        )}
      </div>
      <figcaption id={descId} className="sr-only">{summary}</figcaption>
      {kbd && hoverT != null && (
        <p className="sr-only" aria-live="polite">
          {fmtDateTimeShort(hoverT)}: {series.map((s) => `${s.label} ${isNum(s.points[hover] && s.points[hover].v) ? yFormat(s.points[hover].v) : 'no observation'}`).join(', ')}
        </p>
      )}
    </figure>
  );
}

export function ChartTable({ series, yFormat, sampling, maxRows = 120 }) {
  const primary = series[0];
  const rows = [];
  for (let i = primary.points.length - 1; i >= 0 && rows.length < maxRows; i--) rows.push(i);
  return (
    <div className="table-scroll chart-table-wrap">
      <table className="table table-compact">
        <caption className="table-caption">Data table: {series.map((s) => s.label).join(', ')}. {sampling}. Most recent first{primary.points.length > maxRows ? `, latest ${maxRows} rows` : ''}.</caption>
        <thead>
          <tr><th scope="col">Time (ET)</th>{series.map((s) => <th key={s.id} scope="col" className="num">{s.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i}>
              <td>{fmtDateTimeShort(primary.points[i].t)}</td>
              {series.map((s) => {
                const p = s.points[i];
                return <td key={s.id} className="num">{p && isNum(p.v) ? yFormat(p.v) : <span className="muted" title="No observation in this interval">—</span>}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Sparkline: neutral line, accent endpoint (trend, not identity)
export function Sparkline({ points, width = 88, height = 26, label, className }) {
  const vals = points.filter((p) => isNum(p.v));
  if (vals.length < 2) return <span className="muted">—</span>;
  let lo = Math.min(...vals.map((p) => p.v));
  let hi = Math.max(...vals.map((p) => p.v));
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const x = (t) => 2 + ((t - t0) / (t1 - t0 || 1)) * (width - 6);
  const y = (v) => 3 + (1 - (v - lo) / (hi - lo)) * (height - 6);
  const d = buildPath(points, x, y, false);
  const last = vals[vals.length - 1];
  return (
    <svg width={width} height={height} className={cx('spark', className)} role="img" aria-label={label} focusable="false">
      <path d={d} fill="none" stroke="var(--spark)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.t)} cy={y(last.v)} r="2.5" fill="var(--accent)" />
    </svg>
  );
}

// ---- Order book ladder (bars encode resting size; not good/bad)
export function OrderLadder({ book, unit = 'contracts', compact }) {
  const asks = book.asks.slice(0, compact ? 4 : 6);
  const bids = book.bids.slice(0, compact ? 4 : 6);
  const max = Math.max(1, ...asks.map((l) => l.size), ...bids.map((l) => l.size));
  const spread = asks[0] && bids[0] ? asks[0].price - bids[0].price : null;
  if (!asks.length && !bids.length) return <p className="muted small">No resting orders.</p>;
  const row = (l, side) => (
    <tr key={side + l.price} className={`ladder-${side}`}>
      <td className="num ladder-price">{fmtCentsAuto(l.price)}</td>
      <td className="ladder-bar-cell">
        <span className="ladder-bar" style={{ width: `${Math.max(3, (l.size / max) * 100)}%` }} />
      </td>
      <td className="num">{fmtInt(l.size)}</td>
    </tr>
  );
  return (
    <table className="ladder">
      <caption className="sr-only">Order book for the Yes side. Sizes in {unit}.</caption>
      <thead>
        <tr><th scope="col" className="num">Price</th><th scope="col"><span className="sr-only">Size bar</span></th><th scope="col" className="num">Size</th></tr>
      </thead>
      <tbody>
        <tr className="ladder-label"><th colSpan={3} scope="rowgroup">Asks · buy Yes at</th></tr>
        {[...asks].reverse().map((l) => row(l, 'ask'))}
        <tr className="ladder-spread"><td colSpan={3}>Spread {spread != null ? fmtCentsAuto(spread) : '—'}</td></tr>
        <tr className="ladder-label"><th colSpan={3} scope="rowgroup">Bids · sell Yes at</th></tr>
        {bids.map((l) => row(l, 'bid'))}
      </tbody>
    </table>
  );
}
