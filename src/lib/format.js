// Formatting rules from DESIGN_SPEC §5.4: cents for venue prices, percentage points for change,
// explicit ET timezone, em dash for missing values (never 0).
export const MINUS = '−';
export const DASH = '—';

const et = (opts) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', ...opts });
const F = {
  time: et({ hour: 'numeric', minute: '2-digit' }),
  timeSec: et({ hour: 'numeric', minute: '2-digit', second: '2-digit' }),
  date: et({ month: 'short', day: 'numeric', year: 'numeric' }),
  dateShort: et({ month: 'short', day: 'numeric' }),
  weekdayShort: et({ weekday: 'short', month: 'short', day: 'numeric' }),
  hour: et({ hour: 'numeric' }),
  monthShort: et({ month: 'short' }),
  monthYear: et({ month: 'short', year: 'numeric' }),
  parts: et({ year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false }),
};

export const fmtTime = (t) => (t == null ? DASH : `${F.time.format(t)} ET`);
export const fmtTimeBare = (t) => (t == null ? DASH : F.time.format(t));
export const fmtTimeSec = (t) => (t == null ? DASH : `${F.timeSec.format(t)} ET`);
export const fmtDate = (t) => (t == null ? DASH : F.date.format(t));
export const fmtDateShort = (t) => (t == null ? DASH : F.dateShort.format(t));
export const fmtWeekday = (t) => (t == null ? DASH : F.weekdayShort.format(t));
export const fmtDateTime = (t) => (t == null ? DASH : `${F.date.format(t)} • ${F.time.format(t)} ET`);
export const fmtDateTimeShort = (t) => (t == null ? DASH : `${F.dateShort.format(t)}, ${F.time.format(t)} ET`);
export const fmtHour = (t) => F.hour.format(t);
export const fmtMonth = (t) => F.monthShort.format(t);
export const fmtMonthYear = (t) => F.monthYear.format(t);

// ET calendar parts, used for tick placement.
export function etParts(t) {
  const p = {};
  for (const { type, value } of F.parts.formatToParts(t)) p[type] = Number(value);
  if (p.hour === 24) p.hour = 0;
  return p;
}

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const fmtCents = (v, d = 0) => (isNum(v) ? `${v.toFixed(d)}¢` : DASH);
export const fmtCentsAuto = (v) => (isNum(v) ? fmtCents(v, Math.abs(v - Math.round(v)) > 0.001 ? 1 : 0) : DASH);
export const fmtChance = (v) => (isNum(v) ? `${Math.round(v)}%` : DASH);

export function fmtPP(v, d = 1, unit = ' pp') {
  if (!isNum(v)) return DASH;
  const r = Number(v.toFixed(d));
  const sign = r > 0 ? '+' : r < 0 ? MINUS : '';
  return `${sign}${Math.abs(r).toFixed(d)}${unit}`;
}
export function fmtSignedCents(v, d = 1) {
  if (!isNum(v)) return DASH;
  const r = Number(v.toFixed(d));
  const sign = r > 0 ? '+' : r < 0 ? MINUS : '';
  return `${sign}${Math.abs(r).toFixed(d)}¢`;
}
export const fmtPPLong = (v, window = '24 hours') =>
  isNum(v) ? `${fmtPP(v, 1, '')} percentage points in ${window}` : 'Change not available';

export function fmtCompact(n) {
  if (!isNum(n)) return DASH;
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
export const fmtInt = (n) => (isNum(n) ? Math.round(n).toLocaleString('en-US') : DASH);

export function fmtAge(ms) {
  if (!isNum(ms)) return DASH;
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
export function fmtAgeLong(ms) {
  if (!isNum(ms)) return 'Not available';
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} second${s === 1 ? '' : 's'} ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}
export function fmtUntil(ms) {
  if (!isNum(ms)) return DASH;
  const d = ms / 86400e3;
  if (d >= 2) return `in ${Math.round(d)} days`;
  const h = ms / 3600e3;
  if (h >= 1) return `in ${Math.round(h)} h`;
  return `in ${Math.max(1, Math.round(ms / 60e3))} min`;
}

export const midOf = (q) => (q && isNum(q.bid) && isNum(q.ask) ? (q.bid + q.ask) / 2 : null);
export const spreadOf = (q) => (q && isNum(q.bid) && isNum(q.ask) ? q.ask - q.bid : null);

// Volume basis differs by venue (contracts vs USD notional), so the unit is always printed.
export function fmtVolume(n, basis) {
  if (!isNum(n)) return DASH;
  return basis === 'usd' ? `$${fmtCompact(n)}` : `${fmtCompact(n)} ct`;
}

export const pluralize = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const cx = (...a) => a.filter(Boolean).join(' ');
