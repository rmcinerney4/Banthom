// Demo clock. Every timestamp in the prototype is UTC-backed and displayed in US Eastern time.
// The fixtures describe a simulated snapshot taken Nov 6, 2026 at 2:15 PM ET.

const nthSunday = (y, month0, n) => {
  const first = new Date(Date.UTC(y, month0, 1)).getUTCDay();
  return 1 + ((7 - first) % 7) + (n - 1) * 7;
};

// US Eastern wall-clock time -> UTC milliseconds (handles EDT/EST).
export function dt(y, m, d, h = 0, mi = 0) {
  const dstStart = Date.UTC(y, 2, nthSunday(y, 2, 2), 2);
  const dstEnd = Date.UTC(y, 10, nthSunday(y, 10, 1), 2);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  const offsetH = wall >= dstStart && wall < dstEnd ? 4 : 5;
  return wall + offsetH * 3600e3;
}

export const SNAPSHOT = dt(2026, 11, 6, 14, 15);
export const MIN = 60e3;
export const HOUR = 3600e3;
export const DAY = 86400e3;

const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
// Simulated "now": the snapshot plus however long this page has been open.
export const demoNow = () => SNAPSHOT + ((typeof performance !== 'undefined' ? performance.now() : 0) - t0);
