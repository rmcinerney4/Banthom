// Time helpers. Timestamps are UTC milliseconds, displayed in US Eastern time.

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

export const MIN = 60e3;
export const HOUR = 3600e3;
export const DAY = 86400e3;
