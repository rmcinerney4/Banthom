// DEMO fixtures. Every venue, price, headline and source here is fictional or simulated.
// Real institutions (the Fed, BLS, OPEC+) appear only as the subject of simulated contracts.
import { dt, SNAPSHOT } from '../lib/time.js';

export const DEMO_NOTE = 'Simulated data. Venues, prices, headlines and sources are fictional.';

export const VENUES = {
  ARD: {
    id: 'ARD', name: 'Arden Exchange', short: 'Arden', currency: 'USD', nativeUnit: 'contracts', volumeBasis: 'contracts',
    feeCents: 1, feeLabel: 'Taker fee 1¢ per contract (simulated)', recentS: 120,
    about: 'Fictional order-book exchange used in this demo. Contracts settle at $1.00 in USD.',
    endpoint: 'demo://arden/v2/markets', heartbeatS: 10,
  },
  BRS: {
    id: 'BRS', name: 'Brisa Markets', short: 'Brisa', currency: 'USDC', nativeUnit: 'shares', volumeBasis: 'usd',
    feeCents: 0.5, feeLabel: 'Taker fee 0.5¢ per share (simulated)', recentS: 300,
    about: 'Fictional order-book market used in this demo. Shares settle at 1.00 USDC.',
    endpoint: 'demo://brisa/clob/v1', heartbeatS: 30,
  },
};

export const CATEGORIES = [
  { id: 'economics', label: 'Economics', icon: 'landmark', subs: ['Rates', 'Inflation', 'Labor', 'Growth'] },
  { id: 'politics', label: 'Politics', icon: 'vote', subs: ['Policy'] },
  { id: 'geopolitics', label: 'Geopolitics', icon: 'globe', subs: ['Energy', 'Trade', 'International relations'] },
];

export const EVENTS = [
  {
    id: 'fomc-dec-2026', context: [['2-year Treasury yield', 'Percent, daily close'], ['Fed funds futures path', 'Implied rate by meeting']], title: 'Fed decision: December 2026 meeting', category: 'economics', sub: 'Rates',
    keyDate: dt(2026, 12, 9, 14, 0), keyLabel: 'Statement and target range announcement',
    summary: 'Contracts on whether the FOMC lowers, holds or raises the federal funds target range after its December 8–9 meeting.',
    structure: 'Cut, hold and hike are mutually exclusive. “Cut by 50 bp or more” overlaps with “Cut”: a 50 bp cut resolves both Yes.',
    followers: true,
  },
  {
    id: 'cpi-oct-2026', context: [['5-year breakeven inflation', 'Percent, daily close'], ['Retail gasoline price', 'US average, weekly']], title: 'US CPI: October 2026 release', category: 'economics', sub: 'Inflation',
    keyDate: dt(2026, 11, 13, 8, 30), keyLabel: 'Consumer Price Index release',
    summary: 'Contracts on headline and core CPI for October 2026, settled on the first published BLS figures.',
    structure: 'Thresholds are independent contracts, not a single distribution. Compare definitions before comparing prices.',
    followers: true,
  },
  {
    id: 'jobs-nov-2026', context: [['Initial jobless claims', 'Weekly count'], ['2-year Treasury yield', 'Percent, daily close']], title: 'US jobs report: November 2026', category: 'economics', sub: 'Labor',
    keyDate: dt(2026, 12, 4, 8, 30), keyLabel: 'Employment Situation release',
    summary: 'Contracts on the unemployment rate and nonfarm payrolls in the November 2026 Employment Situation report.',
    structure: 'Unemployment and payroll contracts settle on different series in the same release.',
  },
  {
    id: 'gdp-q4-2026', context: [['GDP nowcast estimates', 'Annualized percent'], ['10-year Treasury yield', 'Percent, daily close']], title: 'US GDP: Q4 2026 advance estimate', category: 'economics', sub: 'Growth',
    keyDate: dt(2027, 1, 28, 8, 30), keyLabel: 'Advance GDP estimate',
    summary: 'Contracts on annualized real GDP growth in the advance estimate for the fourth quarter of 2026.',
    structure: 'Settles on the advance estimate only; later revisions do not change the result.',
  },
  {
    id: 'us-recession-2027', context: [['Yield curve, 10-year minus 3-month', 'Percentage points'], ['High-yield credit spread', 'Basis points']], title: 'US recession starting in 2027', category: 'economics', sub: 'Growth',
    keyDate: dt(2028, 12, 31, 23, 59), keyLabel: 'Resolution deadline',
    summary: 'Long-dated contract on whether a business-cycle peak dated by the NBER falls in 2027.',
    structure: 'Long-dated: prices include time value and capital lock-up, not only event likelihood.',
  },
  {
    id: 'funding-2027', context: [['1-month Treasury bill yield', 'Percent, daily close'], ['Congressional session calendar', 'Days in session']], title: 'Federal funding deadline: January 2027', category: 'politics', sub: 'Policy',
    keyDate: dt(2027, 1, 30, 23, 59), keyLabel: 'Simulated appropriations deadline',
    summary: 'Contracts on whether a lapse in federal appropriations begins before February 1, 2027.',
    structure: 'Venue definitions of a “shutdown” differ. See the comparison before treating the two contracts as the same.',
    followers: true,
  },
  {
    id: 'privacy-law-2027', context: [['Congressional session calendar', 'Days in session']], title: 'Federal consumer privacy law', category: 'politics', sub: 'Policy',
    keyDate: dt(2027, 12, 31, 23, 59), keyLabel: 'Resolution deadline',
    summary: 'Contract on whether a comprehensive federal consumer data privacy law is enacted by the end of 2027.',
    structure: 'Single contract on one venue.',
  },
  {
    id: 'min-wage-2027', context: [['Congressional session calendar', 'Days in session']], title: 'Federal minimum wage', category: 'politics', sub: 'Policy',
    keyDate: dt(2027, 12, 31, 23, 59), keyLabel: 'Resolution deadline',
    summary: 'Contract on whether Congress raises the federal minimum wage by the end of 2027.',
    structure: 'Single contract on one venue.',
  },
  {
    id: 'opec-dec-2026', context: [['Brent crude', 'USD per barrel'], ['WTI crude', 'USD per barrel']], title: 'OPEC+ output decision: winter 2026', category: 'geopolitics', sub: 'Energy',
    keyDate: dt(2026, 11, 30, 9, 0), keyLabel: 'Simulated ministerial meeting',
    summary: 'Contracts on whether OPEC+ announces lower production targets around its scheduled ministerial meeting.',
    structure: 'Venue windows differ: one includes the Nov 30 meeting, one counts December announcements only.',
    followers: true,
  },
  {
    id: 'g20-2026', context: [['Trade-weighted dollar index', 'Index level']], title: 'G20 leaders’ summit 2026', category: 'geopolitics', sub: 'International relations',
    keyDate: dt(2026, 12, 14, 9, 0), keyLabel: 'Summit opens (simulated date)',
    summary: 'Contract on whether leaders adopt a joint declaration at the 2026 summit.',
    structure: 'Single contract on one venue.',
  },
  {
    id: 'eu-us-trade-2027', context: [['EUR/USD', 'Exchange rate'], ['European autos equity index', 'Index level']], title: 'EU–US tariff agreement', category: 'geopolitics', sub: 'Trade',
    keyDate: dt(2027, 3, 31, 23, 59), keyLabel: 'Resolution deadline',
    summary: 'Contract on whether the EU and US sign a legally binding tariff agreement by the end of March 2027.',
    structure: 'Single contract on one venue.',
  },
  {
    id: 'ecb-dec-2026', context: [['2-year German government bond yield', 'Percent, daily close'], ['EUR/USD', 'Exchange rate']], title: 'ECB decision: December 2026', category: 'economics', sub: 'Rates',
    keyDate: dt(2026, 12, 17, 8, 15), keyLabel: 'Monetary policy decision (simulated time)',
    summary: 'Contract on whether the ECB lowers its deposit facility rate at its December meeting.',
    structure: 'Single contract on one venue.',
  },
  {
    id: 'cpi-sep-2026', context: [], title: 'US CPI: September 2026 release', category: 'economics', sub: 'Inflation',
    keyDate: dt(2026, 10, 15, 8, 30), keyLabel: 'Released',
    summary: 'Resolved contracts kept for history and calibration research.',
    structure: 'Resolved. Outcome shown is simulated.',
  },
  {
    id: 'claims-oct-2026', context: [], title: 'Weekly jobless claims: week ending Oct 31', category: 'economics', sub: 'Labor',
    keyDate: dt(2026, 11, 5, 8, 30), keyLabel: 'Released',
    summary: 'Resolved contract kept for history and calibration research.',
    structure: 'Resolved. Outcome shown is simulated.',
  },
];

// Market-wide simulated catalysts (pp moves are applied to the primary series of each event).
const FED_JUMPS = [[dt(2026, 10, 28, 14, 5), 5.2], [dt(2026, 11, 5, 10, 2), 1.8], [dt(2026, 11, 6, 8, 32), 2.4], [dt(2026, 11, 6, 12, 7), -0.6]];
const CPI_JUMPS = [[dt(2026, 10, 15, 8, 31), 6.5], [dt(2026, 11, 4, 11, 20), -2.4], [dt(2026, 11, 6, 9, 45), -1.6]];
const JOBS_JUMPS = [[dt(2026, 11, 6, 8, 32), 2.2]];
const SHUT_JUMPS = [[dt(2026, 11, 2, 16, 10), 4.1], [dt(2026, 11, 6, 11, 40), 2.9]];
const OPEC_JUMPS = [[dt(2026, 11, 4, 7, 15), -3.1], [dt(2026, 11, 6, 6, 50), -1.7]];

const ardGap = [[dt(2026, 10, 24, 2, 0), dt(2026, 10, 24, 4, 30)]];
const brsGap = [[dt(2026, 11, 3, 13, 40), dt(2026, 11, 3, 15, 10)]];

const m = (o) => ({ status: 'active', gaps: o.venue === 'BRS' ? brsGap : ardGap, sigma: 0.0045, ...o });

export const MARKETS = [
  // ---- Fed, December 2026
  m({ id: 'fed-dec26-cut-ard', eventId: 'fomc-dec-2026', venue: 'ARD', outcome: 'Cut (any size)',
    title: 'Will the Fed cut the target range at its December 2026 meeting?',
    sourceTitle: 'Fed funds target range lowered at the Dec 8–9, 2026 FOMC meeting?', ref: 'ARD-FOMC-26DEC-CUT',
    bid: 62, ask: 64, last: 63, bidSize: 4200, askSize: 3100, ch24: 4.6, vol: 84200, oi: 512000,
    closes: dt(2026, 12, 9, 13, 59), resolves: dt(2026, 12, 9, 14, 0), rulesUpdated: dt(2026, 10, 14, 10, 0),
    listed: dt(2026, 7, 20), start: 38, jumps: FED_JUMPS,
    anchors: [[dt(2026, 9, 16, 15, 0), 44], [dt(2026, 10, 28, 13, 55), 50.5], [dt(2026, 10, 30, 14, 15), 55.5]] }),
  m({ id: 'fed-dec26-hold-ard', eventId: 'fomc-dec-2026', venue: 'ARD', outcome: 'Hold',
    title: 'Will the Fed hold the target range at its December 2026 meeting?',
    sourceTitle: 'Fed funds target range unchanged at the Dec 8–9, 2026 FOMC meeting?', ref: 'ARD-FOMC-26DEC-HOLD',
    bid: 35, ask: 37, last: 36, bidSize: 2900, askSize: 3600, ch24: -4.3, vol: 61800, oi: 388000,
    closes: dt(2026, 12, 9, 13, 59), resolves: dt(2026, 12, 9, 14, 0), rulesUpdated: dt(2026, 10, 14, 10, 0),
    listed: dt(2026, 7, 20), derive: { from: 'fed-dec26-cut-ard', mode: 'invert', offset: -1.6 } }),
  m({ id: 'fed-dec26-hike-ard', eventId: 'fomc-dec-2026', venue: 'ARD', outcome: 'Hike',
    title: 'Will the Fed raise the target range at its December 2026 meeting?',
    sourceTitle: 'Fed funds target range raised at the Dec 8–9, 2026 FOMC meeting?', ref: 'ARD-FOMC-26DEC-HIKE',
    bid: 1, ask: 2, last: 1, bidSize: 12000, askSize: 8800, ch24: -0.2, vol: 5300, oi: 91000,
    closes: dt(2026, 12, 9, 13, 59), resolves: dt(2026, 12, 9, 14, 0), rulesUpdated: dt(2026, 10, 14, 10, 0),
    listed: dt(2026, 7, 20), start: 3, sigma: 0.003 }),
  m({ id: 'fed-dec26-cut50-ard', eventId: 'fomc-dec-2026', venue: 'ARD', outcome: 'Cut 50 bp or more',
    title: 'Will the Fed cut by 50 bp or more at its December 2026 meeting?',
    sourceTitle: 'Fed funds target range lowered by at least 50 bps at the Dec 8–9, 2026 FOMC meeting?', ref: 'ARD-FOMC-26DEC-C50',
    bid: 6, ask: 8, last: 7, bidSize: 5100, askSize: 2400, ch24: 1.1, vol: 12900, oi: 140000,
    closes: dt(2026, 12, 9, 13, 59), resolves: dt(2026, 12, 9, 14, 0), rulesUpdated: dt(2026, 10, 14, 10, 0),
    listed: dt(2026, 7, 20), start: 4, sigma: 0.004 }),
  m({ id: 'fed-dec26-cut-brs', eventId: 'fomc-dec-2026', venue: 'BRS', outcome: 'Cut (any size)',
    title: 'Will the Fed cut rates at its December 2026 meeting?',
    sourceTitle: 'Fed rate cut in December 2026?', ref: 'BRS/fed-rate-cut-december-2026',
    bid: 60, ask: 63, last: 61, bidSize: 18500, askSize: 9400, ch24: 3.9, vol: 412000, oi: 2300000,
    closes: dt(2026, 12, 9, 13, 0), resolves: dt(2026, 12, 9, 14, 0), rulesUpdated: dt(2026, 9, 30, 12, 0),
    listed: dt(2026, 7, 28), derive: { from: 'fed-dec26-cut-ard', mode: 'track', offset: -1.5 } }),

  // ---- CPI, October 2026
  m({ id: 'cpi-oct26-yoy-ard', eventId: 'cpi-oct-2026', venue: 'ARD', outcome: 'YoY above 2.9%',
    title: 'Will October 2026 CPI inflation (year over year) be above 2.9%?',
    sourceTitle: 'CPI-U 12-month change for Oct 2026 above 2.9%?', ref: 'ARD-CPI-26OCT-T2.9',
    bid: 47, ask: 49, last: 48, bidSize: 2600, askSize: 1900, ch24: -2.2, vol: 23400, oi: 160000,
    closes: dt(2026, 11, 13, 8, 29), resolves: dt(2026, 11, 13, 8, 30), rulesUpdated: dt(2026, 10, 16, 9, 0),
    listed: dt(2026, 9, 1), start: 44, jumps: CPI_JUMPS }),
  m({ id: 'cpi-oct26-yoy-brs', eventId: 'cpi-oct-2026', venue: 'BRS', outcome: 'YoY 2.9% or higher',
    title: 'Will October 2026 CPI inflation (year over year) be 2.9% or higher?',
    sourceTitle: 'October CPI inflation 2.9% or higher?', ref: 'BRS/october-cpi-2-9-or-higher',
    bid: 55, ask: 58, last: 56, bidSize: 7400, askSize: 5200, ch24: -1.4, vol: 96000, oi: 510000,
    closes: dt(2026, 11, 13, 8, 0), resolves: dt(2026, 11, 13, 8, 30), rulesUpdated: dt(2026, 10, 2, 15, 0),
    listed: dt(2026, 9, 10), derive: { from: 'cpi-oct26-yoy-ard', mode: 'track', offset: 8 } }),
  m({ id: 'cpi-oct26-mom-ard', eventId: 'cpi-oct-2026', venue: 'ARD', outcome: 'MoM 0.3% or more',
    title: 'Will October 2026 CPI rise 0.3% or more from September?',
    sourceTitle: 'CPI-U seasonally adjusted 1-month change for Oct 2026 at least 0.3%?', ref: 'ARD-CPI-26OCT-M0.3',
    bid: 38, ask: 41, last: 40, bidSize: 1400, askSize: 1100, ch24: 0.8, vol: 9100, oi: 74000,
    closes: dt(2026, 11, 13, 8, 29), resolves: dt(2026, 11, 13, 8, 30), rulesUpdated: dt(2026, 10, 16, 9, 0),
    listed: dt(2026, 9, 1), start: 46 }),
  m({ id: 'cpi-oct26-core-ard', eventId: 'cpi-oct-2026', venue: 'ARD', outcome: 'Core YoY 3.1% or higher',
    title: 'Will October 2026 core CPI (year over year) be 3.1% or higher?',
    sourceTitle: 'Core CPI-U 12-month change for Oct 2026 at least 3.1%?', ref: 'ARD-CCPI-26OCT-T3.1',
    bid: 33, ask: 36, last: 34, bidSize: 900, askSize: 1300, ch24: -1.0, vol: 6400, oi: 51000,
    closes: dt(2026, 11, 13, 8, 29), resolves: dt(2026, 11, 13, 8, 30), rulesUpdated: dt(2026, 10, 16, 9, 0),
    listed: dt(2026, 9, 1), start: 40 }),

  // ---- Jobs, November 2026
  m({ id: 'unrate-nov26-ard', eventId: 'jobs-nov-2026', venue: 'ARD', outcome: 'Unemployment 4.5% or higher',
    title: 'Will the November 2026 unemployment rate be 4.5% or higher?',
    sourceTitle: 'U-3 unemployment rate for Nov 2026 at least 4.5%?', ref: 'ARD-U3-26NOV-T4.5',
    bid: 41, ask: 43, last: 42, bidSize: 2100, askSize: 1700, ch24: 2.0, vol: 15800, oi: 98000,
    closes: dt(2026, 12, 4, 8, 29), resolves: dt(2026, 12, 4, 8, 30), rulesUpdated: dt(2026, 10, 9, 9, 0),
    listed: dt(2026, 9, 15), start: 30, jumps: JOBS_JUMPS }),
  m({ id: 'unrate-nov26-brs', eventId: 'jobs-nov-2026', venue: 'BRS', outcome: 'Unemployment 4.5% or higher',
    title: 'Will the November 2026 unemployment rate be 4.5% or higher?',
    sourceTitle: 'US unemployment at or above 4.5% in November 2026 jobs report?', ref: 'BRS/us-unemployment-4-5-nov-2026',
    bid: 44, ask: 47, last: 45, bidSize: 3300, askSize: 2600, ch24: 2.6, vol: 58000, oi: 300000,
    closes: dt(2026, 12, 4, 8, 0), resolves: dt(2026, 12, 4, 8, 30), rulesUpdated: dt(2026, 10, 1, 12, 0),
    listed: dt(2026, 9, 20), derive: { from: 'unrate-nov26-ard', mode: 'track', offset: 3 } }),
  m({ id: 'nfp-nov26-ard', eventId: 'jobs-nov-2026', venue: 'ARD', outcome: 'Payrolls above +100K',
    title: 'Will November 2026 nonfarm payrolls rise by more than 100,000?',
    sourceTitle: 'Total nonfarm payroll change for Nov 2026 above 100K?', ref: 'ARD-NFP-26NOV-100K',
    bid: 54, ask: 57, last: 55, bidSize: 1200, askSize: 1500, ch24: -1.8, vol: 11200, oi: 67000,
    closes: dt(2026, 12, 4, 8, 29), resolves: dt(2026, 12, 4, 8, 30), rulesUpdated: dt(2026, 10, 9, 9, 0),
    listed: dt(2026, 9, 15), start: 62 }),

  // ---- GDP, Q4 2026
  m({ id: 'gdp-q4-26-ard', eventId: 'gdp-q4-2026', venue: 'ARD', outcome: 'Growth above 2.0%',
    title: 'Will Q4 2026 real GDP growth (advance estimate) be above 2.0%?',
    sourceTitle: 'Real GDP, Q4 2026 advance estimate, annualized above 2.0%?', ref: 'ARD-GDP-26Q4-T2.0',
    bid: 52, ask: 54, last: 53, bidSize: 800, askSize: 900, ch24: 0.9, vol: 7300, oi: 45000,
    book: { bids: [[52, 800], [51, 1400], [50, 2100], [49, 900], [48, 2600], [47, 1800]], asks: [[54, 900], [55, 600], [56, 1500], [57, 2200], [58, 1100], [59, 2700]] },
    closes: dt(2027, 1, 28, 8, 29), resolves: dt(2027, 1, 28, 8, 30), rulesUpdated: dt(2026, 10, 20, 9, 0),
    listed: dt(2026, 10, 1), start: 47 }),
  m({ id: 'gdp-q4-26-brs', eventId: 'gdp-q4-2026', venue: 'BRS', outcome: 'Growth above 2.0%',
    title: 'Will Q4 2026 real GDP growth (advance estimate) be above 2.0%?',
    sourceTitle: 'Q4 2026 GDP growth above 2%?', ref: 'BRS/q4-2026-gdp-growth-above-2',
    bid: 57, ask: 60, last: 58, bidSize: 140, askSize: 2200, ch24: 1.6, vol: 31000, oi: 160000,
    book: { bids: [[57, 140], [56, 90], [55, 300], [54, 1200], [53, 2400], [52, 3100]], asks: [[60, 2200], [61, 1800], [62, 2600], [63, 900], [64, 3300], [65, 1500]] },
    closes: dt(2027, 1, 28, 8, 0), resolves: dt(2027, 1, 28, 8, 30), rulesUpdated: dt(2026, 10, 5, 12, 0),
    listed: dt(2026, 10, 3), derive: { from: 'gdp-q4-26-ard', mode: 'track', offset: 4.5 } }),
  m({ id: 'recession-2027-brs', eventId: 'us-recession-2027', venue: 'BRS', outcome: 'Recession begins in 2027',
    title: 'Will the NBER date a US recession as beginning in 2027?',
    sourceTitle: 'US recession in 2027 (NBER-dated)?', ref: 'BRS/us-recession-2027',
    bid: 24, ask: 27, last: 25, bidSize: 6100, askSize: 4800, ch24: 0.4, vol: 140000, oi: 1900000,
    closes: dt(2028, 12, 31, 12, 0), resolves: dt(2028, 12, 31, 23, 59), rulesUpdated: dt(2026, 8, 12, 12, 0),
    listed: dt(2026, 7, 10), start: 22, sigma: 0.0035 }),

  // ---- Politics
  m({ id: 'shutdown-jan27-ard', eventId: 'funding-2027', venue: 'ARD', outcome: 'Lapse begins before Feb 1',
    title: 'Will a lapse in federal appropriations begin before February 1, 2027?',
    sourceTitle: 'Federal government shutdown begins before Feb 1, 2027?', ref: 'ARD-GOVSHUT-27JAN',
    bid: 27, ask: 30, last: 28, bidSize: 3000, askSize: 2700, ch24: 3.2, vol: 20100, oi: 133000,
    closes: dt(2027, 1, 31, 23, 59), resolves: dt(2027, 2, 1, 10, 0), rulesUpdated: dt(2026, 10, 22, 9, 0),
    listed: dt(2026, 9, 25), start: 15, jumps: SHUT_JUMPS }),
  m({ id: 'shutdown-jan27-brs', eventId: 'funding-2027', venue: 'BRS', outcome: 'Shutdown over 24 hours',
    title: 'Will a US government shutdown lasting more than 24 hours begin before February 1, 2027?',
    sourceTitle: 'US government shutdown before February 2027?', ref: 'BRS/us-government-shutdown-before-february-2027',
    bid: 31, ask: 34, last: 32, bidSize: 5200, askSize: 4100, ch24: 2.7, vol: 77000, oi: 420000,
    closes: dt(2027, 1, 31, 12, 0), resolves: dt(2027, 2, 2, 12, 0), rulesUpdated: dt(2026, 10, 3, 12, 0),
    listed: dt(2026, 9, 28), derive: { from: 'shutdown-jan27-ard', mode: 'track', offset: 4 } }),
  m({ id: 'privacy-law-27-ard', eventId: 'privacy-law-2027', venue: 'ARD', outcome: 'Law enacted by end of 2027',
    title: 'Will a comprehensive federal consumer privacy law be enacted by December 31, 2027?',
    sourceTitle: 'Comprehensive federal data privacy law enacted by Dec 31, 2027?', ref: 'ARD-PRIVACY-27',
    bid: 11, ask: 13, last: 12, bidSize: 700, askSize: 600, ch24: 0, vol: 1900, oi: 38000,
    closes: dt(2027, 12, 31, 23, 59), resolves: dt(2028, 1, 1, 10, 0), rulesUpdated: dt(2026, 8, 30, 9, 0),
    listed: dt(2026, 8, 1), start: 14, sigma: 0.003 }),
  m({ id: 'min-wage-27-brs', eventId: 'min-wage-2027', venue: 'BRS', outcome: 'Raised by end of 2027',
    title: 'Will Congress raise the federal minimum wage by December 31, 2027?',
    sourceTitle: 'Federal minimum wage increase signed into law by end of 2027?', ref: 'BRS/federal-minimum-wage-increase-2027',
    bid: 6, ask: 9, last: 7, bidSize: 2500, askSize: 1900, ch24: -0.3, vol: 12000, oi: 140000,
    closes: dt(2027, 12, 31, 12, 0), resolves: dt(2028, 1, 1, 12, 0), rulesUpdated: dt(2026, 8, 15, 12, 0),
    listed: dt(2026, 8, 10), start: 9, sigma: 0.003 }),

  // ---- Geopolitics
  m({ id: 'opec-cut-ard', eventId: 'opec-dec-2026', venue: 'ARD', outcome: 'Cut announced by Dec 31',
    title: 'Will OPEC+ announce lower production targets by December 31, 2026?',
    sourceTitle: 'OPEC+ announces reduction in production targets by Dec 31, 2026?', ref: 'ARD-OPEC-26DEC-CUT',
    bid: 22, ask: 25, last: 23, bidSize: 900, askSize: 1300, ch24: -1.9, vol: 4800, oi: 41000,
    closes: dt(2026, 12, 31, 23, 59), resolves: dt(2027, 1, 1, 10, 0), rulesUpdated: dt(2026, 10, 12, 9, 0),
    listed: dt(2026, 9, 20), start: 31, jumps: OPEC_JUMPS }),
  m({ id: 'opec-cut-brs', eventId: 'opec-dec-2026', venue: 'BRS', outcome: 'Cut announced in December',
    title: 'Will OPEC+ announce a production cut during December 2026?',
    sourceTitle: 'OPEC+ production cut announced in December 2026?', ref: 'BRS/opec-production-cut-december-2026',
    bid: 19, ask: 23, last: 21, bidSize: 1800, askSize: 2400, ch24: -2.4, vol: 22000, oi: 120000,
    closes: dt(2026, 12, 31, 12, 0), resolves: dt(2027, 1, 1, 12, 0), rulesUpdated: dt(2026, 10, 1, 12, 0),
    listed: dt(2026, 9, 25), derive: { from: 'opec-cut-ard', mode: 'track', offset: -2 } }),
  m({ id: 'g20-declaration-brs', eventId: 'g20-2026', venue: 'BRS', outcome: 'Joint declaration adopted',
    title: 'Will G20 leaders adopt a joint leaders’ declaration at the 2026 summit?',
    sourceTitle: 'G20 2026 joint leaders’ declaration?', ref: 'BRS/g20-2026-joint-declaration',
    bid: 58, ask: 62, last: 60, bidSize: 2100, askSize: 1600, ch24: 1.2, vol: 45000, oi: 260000,
    closes: dt(2026, 12, 15, 12, 0), resolves: dt(2026, 12, 16, 12, 0), rulesUpdated: dt(2026, 9, 1, 12, 0),
    listed: dt(2026, 8, 20), start: 64 }),
  m({ id: 'eu-us-trade-ard', eventId: 'eu-us-trade-2027', venue: 'ARD', outcome: 'Agreement signed by Mar 31',
    title: 'Will the EU and US sign a legally binding tariff agreement by March 31, 2027?',
    sourceTitle: 'EU–US binding tariff agreement signed by Mar 31, 2027?', ref: 'ARD-EUUS-27Q1',
    bid: 29, ask: 33, last: 31, bidSize: 500, askSize: 700, ch24: 0.6, vol: 3600, oi: 29000,
    closes: dt(2027, 3, 31, 23, 59), resolves: dt(2027, 4, 1, 10, 0), rulesUpdated: dt(2026, 9, 12, 9, 0),
    listed: dt(2026, 8, 25), start: 24 }),
  m({ id: 'ecb-dec26-cut-brs', eventId: 'ecb-dec-2026', venue: 'BRS', outcome: 'Deposit rate lowered',
    title: 'Will the ECB lower its deposit facility rate in December 2026?',
    sourceTitle: 'ECB rate cut in December 2026?', ref: 'BRS/ecb-rate-cut-december-2026',
    bid: 18, ask: 21, last: 19, bidSize: 3900, askSize: 3100, ch24: -0.8, vol: 38000, oi: 210000,
    closes: dt(2026, 12, 17, 7, 0), resolves: dt(2026, 12, 17, 9, 0), rulesUpdated: dt(2026, 9, 18, 12, 0),
    listed: dt(2026, 8, 18), start: 26 }),

  // ---- Resolved (simulated outcomes, kept for history)
  m({ id: 'cpi-sep26-mom-ard', eventId: 'cpi-sep-2026', venue: 'ARD', outcome: 'MoM 0.3% or more', status: 'resolved', result: 'No',
    title: 'Will September 2026 CPI rise 0.3% or more from August?',
    sourceTitle: 'CPI-U seasonally adjusted 1-month change for Sep 2026 at least 0.3%?', ref: 'ARD-CPI-26SEP-M0.3',
    bid: null, ask: null, last: 1, bidSize: null, askSize: null, ch24: null, vol: 0, oi: 0,
    closes: dt(2026, 10, 15, 8, 29), resolves: dt(2026, 10, 15, 8, 30), rulesUpdated: dt(2026, 9, 2, 9, 0),
    listed: dt(2026, 8, 1), start: 45, end: 1, endAt: dt(2026, 10, 15, 8, 30), anchors: [[dt(2026, 10, 15, 8, 25), 36]] }),
  m({ id: 'claims-oct31-brs', eventId: 'claims-oct-2026', venue: 'BRS', outcome: 'Claims above 240K', status: 'resolved', result: 'Yes',
    title: 'Will initial jobless claims for the week ending October 31, 2026 exceed 240,000?',
    sourceTitle: 'Initial jobless claims above 240K (week ending Oct 31)?', ref: 'BRS/jobless-claims-240k-oct-31',
    bid: null, ask: null, last: 99, bidSize: null, askSize: null, ch24: null, vol: 0, oi: 0,
    closes: dt(2026, 11, 5, 8, 0), resolves: dt(2026, 11, 5, 8, 30), rulesUpdated: dt(2026, 10, 20, 12, 0),
    listed: dt(2026, 10, 20), start: 48, end: 99, endAt: dt(2026, 11, 5, 8, 30), anchors: [[dt(2026, 11, 5, 8, 25), 57]] }),
];

export const MARKET_BY_ID = Object.fromEntries(MARKETS.map((x) => [x.id, x]));
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((x) => [x.id, x]));
export const marketsForEvent = (eventId) => MARKETS.filter((x) => x.eventId === eventId);

// ---- Contract rules (source-native language, simulated)
const ARDEN_VOID = 'If the underlying event is cancelled or the settlement source does not publish by the expiration date, the Exchange may extend expiration once by up to 30 days, after which the contract settles at the last fair price determined under Rule 7.4 (simulated rulebook).';
const BRISA_VOID = 'If the outcome cannot be determined by the resolution date, the market resolves 50/50 (each share pays 0.50 USDC).';

export const RULES = {
  'fed-dec26-cut-ard': {
    text: [
      'The contract resolves to “Yes” if the Federal Open Market Committee announces a reduction to the target range for the federal funds rate in the policy statement issued following its meeting scheduled for December 8–9, 2026.',
      'The contract resolves to “No” if the target range is maintained or increased. A change announced between scheduled meetings counts only if it is restated in the December 9 statement.',
      'Expiration is 2:00 PM ET on December 9, 2026, or the release of the statement, whichever is later.',
    ],
    source: 'Federal Reserve Board press release and Implementation Note', cutoff: 'Trading closes Dec 9, 2026, 1:59 PM ET',
    timezone: 'ET', void: ARDEN_VOID, unit: '$1.00 per contract (USD)', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'Intermeeting cuts count only if restated in the December statement.',
  },
  'fed-dec26-cut-brs': {
    text: [
      'This market resolves to “Yes” if the Federal Reserve lowers the upper bound of the federal funds target range in the statement released after its December 8–9, 2026 meeting. Otherwise it resolves “No”.',
      'Any change announced between scheduled meetings is counted only if the December statement reports a lower range than the previous statement.',
      'The resolution source is the official FOMC statement. Trading closes one hour before the scheduled release.',
    ],
    source: 'Official FOMC statement', cutoff: 'Trading closes Dec 9, 2026, 1:00 PM ET', timezone: 'ET',
    void: BRISA_VOID, unit: '1.00 USDC per share', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'Intermeeting cuts count only if the December statement shows a lower range.',
  },
  'cpi-oct26-yoy-ard': {
    text: [
      'The contract resolves to “Yes” if the 12-month percent change in the CPI-U (not seasonally adjusted, all items) for October 2026, as first published by the Bureau of Labor Statistics, is greater than 2.9%.',
      'The value is evaluated as published, to one decimal place. A published value of exactly 2.9% resolves “No”. Subsequent revisions are disregarded.',
    ],
    source: 'BLS Consumer Price Index news release (first print)', cutoff: 'Trading closes Nov 13, 2026, 8:29 AM ET', timezone: 'ET',
    void: ARDEN_VOID, unit: '$1.00 per contract (USD)', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'A print of exactly 2.9% resolves No.',
  },
  'cpi-oct26-yoy-brs': {
    text: [
      'Resolves “Yes” if the year-over-year CPI inflation rate for October 2026 reported by the BLS is 2.9% or higher. Otherwise resolves “No”.',
      'The figure in the initial release is used. If the release is delayed past November 30, 2026, the market resolves on the first release after that date.',
    ],
    source: 'BLS CPI release (initial)', cutoff: 'Trading closes Nov 13, 2026, 8:00 AM ET', timezone: 'ET',
    void: BRISA_VOID, unit: '1.00 USDC per share', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'A print of exactly 2.9% resolves Yes.',
  },
  'unrate-nov26-ard': {
    text: [
      'The contract resolves to “Yes” if the seasonally adjusted U-3 unemployment rate for November 2026, as first published in the BLS Employment Situation release, is 4.5% or higher.',
      'The value is evaluated as published to one decimal place. Subsequent revisions are disregarded.',
    ],
    source: 'BLS Employment Situation release (first print)', cutoff: 'Trading closes Dec 4, 2026, 8:29 AM ET', timezone: 'ET',
    void: ARDEN_VOID, unit: '$1.00 per contract (USD)', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'Evaluated to one decimal place as published.',
  },
  'unrate-nov26-brs': {
    text: [
      'Resolves “Yes” if the US unemployment rate for November 2026, as reported in the initial BLS Employment Situation release, is at or above 4.5%.',
      'The seasonally adjusted headline (U-3) rate is used. Revisions after the initial release are ignored.',
    ],
    source: 'BLS Employment Situation release (initial)', cutoff: 'Trading closes Dec 4, 2026, 8:00 AM ET', timezone: 'ET',
    void: BRISA_VOID, unit: '1.00 USDC per share', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'Seasonally adjusted U-3, one decimal place.',
  },
  'gdp-q4-26-ard': {
    text: [
      'The contract resolves to “Yes” if the seasonally adjusted annualized rate of change in real GDP for Q4 2026, as first published in the BEA advance estimate, is greater than 2.0%.',
      'Later estimates and annual revisions are disregarded.',
    ],
    source: 'BEA GDP advance estimate', cutoff: 'Trading closes Jan 28, 2027, 8:29 AM ET', timezone: 'ET',
    void: ARDEN_VOID, unit: '$1.00 per contract (USD)', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'A print of exactly 2.0% resolves No.',
  },
  'gdp-q4-26-brs': {
    text: [
      'Resolves “Yes” if the BEA advance estimate of annualized real GDP growth for Q4 2026 is above 2.0%. Otherwise resolves “No”.',
      'Only the advance estimate is used. A print of exactly 2.0% resolves “No”.',
    ],
    source: 'BEA GDP advance estimate', cutoff: 'Trading closes Jan 28, 2027, 8:00 AM ET', timezone: 'ET',
    void: BRISA_VOID, unit: '1.00 USDC per share', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'A print of exactly 2.0% resolves No.',
  },
  'shutdown-jan27-ard': {
    text: [
      'The contract resolves to “Yes” if a lapse in appropriations for the federal government begins before 12:00 AM ET on February 1, 2027, as evidenced by an OMB memorandum directing agencies to execute shutdown plans.',
      'A lapse of any duration counts.',
    ],
    source: 'Office of Management and Budget memoranda', cutoff: 'Trading closes Jan 31, 2027, 11:59 PM ET', timezone: 'ET',
    void: ARDEN_VOID, unit: '$1.00 per contract (USD)', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'Any lapse counts, regardless of duration.',
  },
  'shutdown-jan27-brs': {
    text: [
      'Resolves “Yes” if the US federal government enters a shutdown that lasts more than 24 hours and begins before February 1, 2027 (UTC). Otherwise resolves “No”.',
      'Resolution relies on credible reporting; a lapse that is resolved within 24 hours does not count.',
    ],
    source: 'Credible media reporting (venue discretion)', cutoff: 'Trading closes Jan 31, 2027, 12:00 PM ET', timezone: 'UTC',
    void: BRISA_VOID, unit: '1.00 USDC per share', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'Lapses shorter than 24 hours do not count.',
  },
  'opec-cut-ard': {
    text: [
      'The contract resolves to “Yes” if OPEC+ announces a reduction to its collective production targets between listing and 11:59 PM ET on December 31, 2026, as published on the official OPEC website.',
      'Voluntary cuts announced by individual members do not count unless adopted collectively.',
    ],
    source: 'Official OPEC press releases', cutoff: 'Trading closes Dec 31, 2026, 11:59 PM ET', timezone: 'ET',
    void: ARDEN_VOID, unit: '$1.00 per contract (USD)', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'Window includes the scheduled Nov 30 meeting.',
  },
  'opec-cut-brs': {
    text: [
      'Resolves “Yes” if OPEC+ announces a production cut during the calendar month of December 2026 (UTC). Announcements made before December 1, 2026 do not count.',
      'Voluntary cuts by a group of members that OPEC+ publishes as an alliance decision count.',
    ],
    source: 'OPEC announcements and credible reporting', cutoff: 'Trading closes Dec 31, 2026, 12:00 PM ET', timezone: 'UTC',
    void: BRISA_VOID, unit: '1.00 USDC per share', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'Announcements before Dec 1 do not count, which excludes the Nov 30 meeting.',
  },
};

export function rulesFor(mk) {
  if (RULES[mk.id]) return RULES[mk.id];
  const ard = mk.venue === 'ARD';
  return {
    text: [
      `${ard ? 'The contract resolves to “Yes”' : 'Resolves “Yes”'} if the condition in the title is met according to the settlement source by the resolution date. ${ard ? 'Otherwise the contract resolves to “No”.' : 'Otherwise resolves “No”.'}`,
      'Exact source-native wording is shown here when the venue publishes it. This demo uses simulated rule text.',
    ],
    source: ard ? 'Named official publication (simulated)' : 'Official source or credible reporting (simulated)',
    cutoff: `Trading closes ${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(mk.closes)} ET`,
    timezone: ard ? 'ET' : 'UTC', void: ard ? ARDEN_VOID : BRISA_VOID,
    unit: ard ? '$1.00 per contract (USD)' : '1.00 USDC per share', restrictions: 'Eligibility set by venue terms (fictional).',
    edge: 'No additional edge-case clauses published.',
  };
}

// ---- Cross-venue matches
export const MATCHES = [
  {
    id: 'fed-dec-cut', a: 'fed-dec26-cut-ard', b: 'fed-dec26-cut-brs', status: 'verified', confidence: 0.97,
    reviewedAt: dt(2026, 11, 2, 11, 20), reviewer: 'Data review (demo)', revalidate: dt(2026, 11, 30),
    canonical: 'Fed cuts at the December 2026 meeting',
    summary: 'Same predicate, same meeting and same settlement source. Settlement currency and trading cutoff differ.',
    terms: [
      ['Outcome definition', 'Target range lowered in the statement after the Dec 8–9 meeting', 'Upper bound of target range lowered in the statement after the Dec 8–9 meeting', 'same'],
      ['Resolution source', 'Fed press release and Implementation Note', 'Official FOMC statement', 'same'],
      ['Deadline and timezone', 'Dec 9, 2026, 2:00 PM ET', 'Dec 9, 2026, 2:00 PM ET', 'same'],
      ['Intermeeting changes', 'Count only if restated in the December statement', 'Count only if the December statement shows a lower range', 'same'],
      ['Cancellation or void', 'Expiration extended once, then fair-price settlement', 'Resolves 50/50 if undeterminable', 'differs'],
      ['Trading cutoff', 'Dec 9, 1:59 PM ET', 'Dec 9, 1:00 PM ET', 'differs'],
      ['Settlement unit', '$1.00 per contract (USD)', '1.00 USDC per share', 'differs'],
    ],
  },
  {
    id: 'unrate-nov', a: 'unrate-nov26-ard', b: 'unrate-nov26-brs', status: 'verified', confidence: 0.95,
    reviewedAt: dt(2026, 10, 29, 15, 5), reviewer: 'Data review (demo)', revalidate: dt(2026, 11, 27),
    canonical: 'Unemployment rate 4.5% or higher in November 2026',
    summary: 'Same series (seasonally adjusted U-3), same threshold and first-print rule. Void policies differ.',
    terms: [
      ['Outcome definition', 'U-3 rate for Nov 2026 is 4.5% or higher', 'Unemployment rate at or above 4.5%', 'same'],
      ['Resolution source', 'BLS Employment Situation, first print', 'BLS Employment Situation, initial release', 'same'],
      ['Deadline and timezone', 'Dec 4, 2026, 8:30 AM ET', 'Dec 4, 2026, 8:30 AM ET', 'same'],
      ['Rounding and revisions', 'One decimal as published; revisions ignored', 'One decimal; revisions ignored', 'same'],
      ['Cancellation or void', 'Expiration extended once, then fair-price settlement', 'Resolves 50/50 if undeterminable', 'differs'],
      ['Settlement unit', '$1.00 per contract (USD)', '1.00 USDC per share', 'differs'],
    ],
  },
  {
    id: 'gdp-q4', a: 'gdp-q4-26-ard', b: 'gdp-q4-26-brs', status: 'verified', confidence: 0.96,
    reviewedAt: dt(2026, 11, 4, 10, 40), reviewer: 'Data review (demo)', revalidate: dt(2026, 12, 15),
    canonical: 'Q4 2026 real GDP growth above 2.0% (advance)',
    summary: 'Same advance-estimate rule and the same treatment of a 2.0% print. Brisa shows little size at its best bid.',
    terms: [
      ['Outcome definition', 'Annualized real GDP growth above 2.0%', 'Annualized real GDP growth above 2.0%', 'same'],
      ['Resolution source', 'BEA advance estimate', 'BEA advance estimate', 'same'],
      ['Deadline and timezone', 'Jan 28, 2027, 8:30 AM ET', 'Jan 28, 2027, 8:30 AM ET', 'same'],
      ['Exactly 2.0%', 'Resolves No', 'Resolves No', 'same'],
      ['Cancellation or void', 'Expiration extended once, then fair-price settlement', 'Resolves 50/50 if undeterminable', 'differs'],
      ['Settlement unit', '$1.00 per contract (USD)', '1.00 USDC per share', 'differs'],
    ],
  },
  {
    id: 'cpi-oct-yoy', a: 'cpi-oct26-yoy-ard', b: 'cpi-oct26-yoy-brs', status: 'candidate', confidence: 0.88,
    reviewedAt: null, reviewer: null, revalidate: null,
    canonical: 'October 2026 CPI year over year around 2.9%',
    summary: 'Thresholds differ: Arden needs a print above 2.9%; Brisa counts 2.9% itself. A 2.9% print settles them in opposite directions.',
    terms: [
      ['Outcome definition', 'CPI-U 12-month change greater than 2.9%', 'CPI inflation 2.9% or higher', 'differs'],
      ['Exactly 2.9%', 'Resolves No', 'Resolves Yes', 'differs'],
      ['Resolution source', 'BLS CPI release, first print', 'BLS CPI release, initial', 'same'],
      ['Release delay', 'Expiration extended once, then fair-price settlement', 'Resolves on the first release after Nov 30', 'differs'],
      ['Settlement unit', '$1.00 per contract (USD)', '1.00 USDC per share', 'differs'],
    ],
  },
  {
    id: 'opec-cut', a: 'opec-cut-ard', b: 'opec-cut-brs', status: 'candidate', confidence: 0.81,
    reviewedAt: null, reviewer: null, revalidate: null,
    canonical: 'OPEC+ production cut, winter 2026',
    summary: 'Algorithmic candidate. The windows differ: Brisa excludes announcements before December 1, so the Nov 30 meeting only counts on Arden.',
    terms: [
      ['Outcome definition', 'Collective reduction in production targets', 'Production cut, including published group cuts', 'differs'],
      ['Window', 'Listing to Dec 31, 2026 (includes Nov 30 meeting)', 'Dec 1–31, 2026 UTC only', 'differs'],
      ['Resolution source', 'Official OPEC press releases', 'OPEC announcements and credible reporting', 'differs'],
      ['Settlement unit', '$1.00 per contract (USD)', '1.00 USDC per share', 'differs'],
    ],
  },
  {
    id: 'shutdown-jan27', a: 'shutdown-jan27-ard', b: 'shutdown-jan27-brs', status: 'nonequivalent', confidence: 0.74,
    reviewedAt: dt(2026, 11, 3, 16, 30), reviewer: 'Data review (demo)', revalidate: null,
    canonical: 'Federal shutdown before February 1, 2027',
    summary: 'Reviewed and marked not equivalent. Brisa requires a lapse longer than 24 hours and uses UTC; Arden counts any lapse that triggers an OMB shutdown memo.',
    terms: [
      ['Outcome definition', 'Lapse in appropriations of any duration', 'Shutdown lasting more than 24 hours', 'differs'],
      ['Resolution source', 'OMB memoranda', 'Credible media reporting', 'differs'],
      ['Deadline and timezone', 'Before Feb 1, 2027, 12:00 AM ET', 'Before Feb 1, 2027 UTC', 'differs'],
      ['Settlement unit', '$1.00 per contract (USD)', '1.00 USDC per share', 'differs'],
    ],
  },
];
export const MATCH_BY_ID = Object.fromEntries(MATCHES.map((x) => [x.id, x]));
export const matchForMarket = (id) => MATCHES.find((x) => x.a === id || x.b === id) || null;

// ---- Simulated timelines (headlines and sources are fictional)
export const TIMELINE = [
  { id: 'tl-fed-1', eventId: 'fomc-dec-2026', t: dt(2026, 10, 28, 14, 0), kind: 'Statement', title: 'October meeting statement released',
    detail: 'Statement language on the labor market softened compared with September (simulated summary).',
    source: 'Policy statement summary (demo)', move: { marketId: 'fed-dec26-cut-ard', pp: 5.2, window: '60 min' }, link: 'inferred',
    note: 'The move began within five minutes of release. The timing is observed; the reason is inferred.' },
  { id: 'tl-fed-2', eventId: 'fomc-dec-2026', t: dt(2026, 11, 3, 13, 40), kind: 'Data incident', title: 'Brisa feed gap: no observations for 90 minutes',
    detail: 'No Brisa quotes were received between 1:40 and 3:10 PM ET. The chart shows a gap instead of a line.',
    source: 'Banthom ingest log (demo)', move: null, link: 'observed', note: 'Missing data is shown as a gap and never filled in.' },
  { id: 'tl-fed-3', eventId: 'fomc-dec-2026', t: dt(2026, 11, 5, 10, 0), kind: 'Release', title: 'Services activity survey published',
    detail: 'Two fictional wire reports describe the reading as weaker than expected.',
    source: 'Northbridge Wire (fictional)', move: { marketId: 'fed-dec26-cut-ard', pp: 1.8, window: '30 min' }, link: 'inferred',
    note: 'Consistent with softer activity data, but other releases landed the same morning.' },
  { id: 'tl-fed-4', eventId: 'fomc-dec-2026', t: dt(2026, 11, 6, 8, 30), kind: 'Release', title: 'Weekly jobless claims published',
    detail: 'Claims rose for a third straight week in the simulated release.',
    source: 'Ledger Daily (fictional)', move: { marketId: 'fed-dec26-cut-ard', pp: 2.4, window: '60 min' }, link: 'inferred',
    note: 'The largest single move this week. The jobs report on Dec 4 is the next scheduled labor release.' },
  { id: 'tl-fed-5', eventId: 'fomc-dec-2026', t: dt(2026, 11, 6, 12, 5), kind: 'Remarks', title: 'Fed governor remarks at a policy forum',
    detail: 'Prepared remarks did not address the December meeting directly (simulated).',
    source: 'Event transcript (demo)', move: { marketId: 'fed-dec26-cut-ard', pp: -0.6, window: '30 min' }, link: 'unknown',
    note: 'The small move is within normal intraday range. No cause is assigned.' },
  { id: 'tl-cpi-1', eventId: 'cpi-oct-2026', t: dt(2026, 10, 15, 8, 30), kind: 'Release', title: 'September CPI published',
    detail: 'Headline inflation came in above the prior month in the simulated release.',
    source: 'Northbridge Wire (fictional)', move: { marketId: 'cpi-oct26-yoy-ard', pp: 6.5, window: '15 min' }, link: 'inferred',
    note: 'The prior month’s print is a direct input to forecasts of the next one.' },
  { id: 'tl-cpi-2', eventId: 'cpi-oct-2026', t: dt(2026, 11, 4, 11, 20), kind: 'Headline', title: 'Gasoline prices fall for a second week',
    detail: 'Fictional wire coverage of retail fuel prices.', source: 'Ledger Daily (fictional)',
    move: { marketId: 'cpi-oct26-yoy-ard', pp: -2.4, window: '2 h' }, link: 'inferred', note: 'Energy is a volatile CPI component.' },
  { id: 'tl-cpi-3', eventId: 'cpi-oct-2026', t: dt(2026, 11, 6, 9, 45), kind: 'Market', title: 'Price drifted lower without a matching headline',
    detail: 'No scheduled release or verified headline coincides with this move.', source: 'Banthom price history (demo)',
    move: { marketId: 'cpi-oct26-yoy-ard', pp: -1.6, window: '3 h' }, link: 'unknown', note: 'There is not enough reliable source evidence to explain this move.' },
  { id: 'tl-shut-1', eventId: 'funding-2027', t: dt(2026, 11, 2, 16, 0), kind: 'Headline', title: 'Appropriations talks pause for the week',
    detail: 'Fictional reporting says negotiators will not meet again until after Nov 9.', source: 'Capitol Ledger (fictional)',
    move: { marketId: 'shutdown-jan27-ard', pp: 4.1, window: '2 h' }, link: 'inferred', note: 'Timing is observed; reporting is single-sourced.' },
  { id: 'tl-shut-2', eventId: 'funding-2027', t: dt(2026, 11, 6, 11, 30), kind: 'Statement', title: 'Committee chair statement on stopgap funding',
    detail: 'The simulated statement rules out a short-term extension before December.', source: 'Committee release (demo)',
    move: { marketId: 'shutdown-jan27-ard', pp: 2.9, window: '60 min' }, link: 'inferred', note: 'Brisa’s contract moved less, consistent with its 24-hour requirement.' },
  { id: 'tl-opec-1', eventId: 'opec-dec-2026', t: dt(2026, 11, 4, 7, 0), kind: 'Headline', title: 'Delegates signal output levels will hold',
    detail: 'Fictional wire report citing unnamed delegates.', source: 'Northbridge Wire (fictional)',
    move: { marketId: 'opec-cut-ard', pp: -3.1, window: '90 min' }, link: 'inferred', note: 'Unnamed-source reporting; treat as low confidence.' },
  { id: 'tl-opec-2', eventId: 'opec-dec-2026', t: dt(2026, 11, 6, 6, 45), kind: 'Headline', title: 'Ministers confirm Nov 30 meeting format',
    detail: 'Meeting will be held online, according to fictional coverage.', source: 'Energy Desk (fictional)',
    move: { marketId: 'opec-cut-ard', pp: -1.7, window: '60 min' }, link: 'unknown', note: 'No clear link between the format change and the move.' },
  { id: 'tl-jobs-1', eventId: 'jobs-nov-2026', t: dt(2026, 11, 6, 8, 30), kind: 'Release', title: 'Weekly jobless claims published',
    detail: 'Claims rose for a third straight week in the simulated release.', source: 'Ledger Daily (fictional)',
    move: { marketId: 'unrate-nov26-ard', pp: 2.2, window: '60 min' }, link: 'inferred', note: 'Same release that moved Fed December pricing.' },
];
export const timelineForEvent = (id) => TIMELINE.filter((x) => x.eventId === id).sort((a, b) => a.t - b.t);

// ---- Upcoming schedule
export const SCHEDULE = [
  { t: dt(2026, 11, 10, 10, 0), eventId: 'fomc-dec-2026', title: 'Fed vice chair remarks (simulated)', kind: 'Remarks' },
  { t: dt(2026, 11, 13, 8, 30), eventId: 'cpi-oct-2026', title: 'October CPI release', kind: 'Release' },
  { t: dt(2026, 11, 18, 14, 0), eventId: 'fomc-dec-2026', title: 'Minutes of the October meeting', kind: 'Release' },
  { t: dt(2026, 11, 30, 9, 0), eventId: 'opec-dec-2026', title: 'OPEC+ ministerial meeting (simulated)', kind: 'Meeting' },
  { t: dt(2026, 12, 4, 8, 30), eventId: 'jobs-nov-2026', title: 'November jobs report', kind: 'Release' },
  { t: dt(2026, 12, 9, 14, 0), eventId: 'fomc-dec-2026', title: 'FOMC decision and statement', kind: 'Decision' },
  { t: dt(2026, 12, 14, 9, 0), eventId: 'g20-2026', title: 'G20 leaders’ summit opens (simulated)', kind: 'Meeting' },
  { t: dt(2026, 12, 17, 8, 15), eventId: 'ecb-dec-2026', title: 'ECB monetary policy decision', kind: 'Decision' },
  { t: dt(2027, 1, 28, 8, 30), eventId: 'gdp-q4-2026', title: 'Q4 GDP advance estimate', kind: 'Release' },
  { t: dt(2027, 1, 30, 23, 59), eventId: 'funding-2027', title: 'Appropriations deadline (simulated)', kind: 'Deadline' },
];

// ---- Research feed (AI-assisted summaries of fictional sources)
export const RESEARCH = [
  { id: 'rs-fed-claims', eventId: 'fomc-dec-2026', marketId: 'fed-dec26-cut-ard', t: dt(2026, 11, 6, 13, 15),
    title: 'December cut pricing rose after the jobless-claims release',
    summary: 'Arden’s December cut contract gained 2.4 pp in the hour after the 8:30 AM claims release. Two fictional wire reports describe claims as higher than expected.',
    move: 4.6, sources: ['Ledger Daily (fictional) · 8:41 AM', 'Northbridge Wire (fictional) · 9:05 AM', 'Banthom price history'], trust: ['observed', 'inferred'] },
  { id: 'rs-shutdown', eventId: 'funding-2027', marketId: 'shutdown-jan27-ard', t: dt(2026, 11, 6, 12, 40),
    title: 'Shutdown contracts rose after a statement on stopgap funding',
    summary: 'Arden’s contract is up 3.2 pp in 24 hours. Brisa’s similar-looking contract requires a lapse longer than 24 hours, so the two are not directly comparable.',
    move: 3.2, sources: ['Committee release (demo) · 11:30 AM', 'Capitol Ledger (fictional) · Nov 2'], trust: ['observed', 'inferred'] },
  { id: 'rs-cpi', eventId: 'cpi-oct-2026', marketId: 'cpi-oct26-yoy-ard', t: dt(2026, 11, 6, 11, 5),
    title: 'Inflation contracts drift lower ahead of the Nov 13 release',
    summary: 'The “above 2.9%” contract is down 2.2 pp in 24 hours. An earlier drop on Nov 4 coincides with lower fuel prices in fictional coverage; today’s move has no matching headline.',
    move: -2.2, sources: ['Ledger Daily (fictional) · Nov 4', 'Banthom price history'], trust: ['observed', 'inferred', 'unknown'] },
  { id: 'rs-opec', eventId: 'opec-dec-2026', marketId: 'opec-cut-ard', t: dt(2026, 11, 6, 9, 20),
    title: 'Output-cut contracts slipped on delegate comments',
    summary: 'Arden’s contract fell 1.9 pp over 24 hours after fictional reports that output levels will hold. Sources are unnamed delegates.',
    move: -1.9, sources: ['Northbridge Wire (fictional) · Nov 4', 'Energy Desk (fictional) · 6:45 AM'], trust: ['inferred', 'unknown'] },
  { id: 'rs-unrate', eventId: 'jobs-nov-2026', marketId: 'unrate-nov26-ard', t: dt(2026, 11, 6, 10, 10),
    title: 'Unemployment contracts moved with claims data',
    summary: 'Both venues’ 4.5% contracts rose after the claims release. The pair is a verified match; prices still differ by venue.',
    move: 2.0, sources: ['Ledger Daily (fictional) · 8:41 AM', 'Banthom match review · Oct 29'], trust: ['observed'] },
  { id: 'rs-g20', eventId: 'g20-2026', marketId: 'g20-declaration-brs', t: dt(2026, 11, 5, 16, 30),
    title: 'Summit declaration contract steady ahead of sherpa talks',
    summary: 'Brisa’s contract is up 1.2 pp in 24 hours with no verified headline. Liquidity is thin: 1,600 shares at the best ask.',
    move: 1.2, sources: ['Banthom price history'], trust: ['observed', 'unknown'] },
];

export const REPORT = {
  id: 'rpt-fed-7d', eventId: 'fomc-dec-2026', marketId: 'fed-dec26-cut-ard',
  title: 'What changed in December Fed pricing over the past 7 days?',
  generatedAt: dt(2026, 11, 6, 13, 15), asOf: dt(2026, 11, 6, 13, 10), version: 2, model: 'Research model (demo) · methodology v0.3',
  summary: 'Arden’s December cut contract rose from 55.5¢ to 63.0¢ over seven days. About half of the change came in two windows that follow scheduled releases. The data does not establish why prices moved.',
  findings: [
    { tag: 'observed', text: 'The Yes midpoint on Arden rose 7.5 pp between Oct 30 and Nov 6, from 55.5¢ to 63.0¢.' },
    { tag: 'observed', text: 'Two windows account for 4.2 pp: the 30 minutes after the Nov 5 services survey (+1.8 pp) and the hour after the Nov 6 claims release (+2.4 pp).' },
    { tag: 'inferred', text: 'Both moves are consistent with softer activity and labor data, as described in two fictional wire reports.' },
    { tag: 'unknown', text: 'About 4 pp of the change happened outside any window with a verified headline.' },
    { tag: 'observed', text: 'Brisa’s verified-equivalent contract tracked within 3 pp throughout, except during its Nov 3 feed gap, when no data was recorded.' },
  ],
  questions: ['Does the Nov 18 release of October meeting minutes change the read on labor-market language?', 'How much of the move reflects positioning ahead of the Dec 4 jobs report?'],
  citations: [
    { title: 'Weekly claims rise for a third week', outlet: 'Ledger Daily (fictional)', t: dt(2026, 11, 6, 8, 41) },
    { title: 'Services survey weaker than forecast', outlet: 'Northbridge Wire (fictional)', t: dt(2026, 11, 5, 10, 12) },
    { title: 'October meeting statement', outlet: 'Policy statement summary (demo)', t: dt(2026, 10, 28, 14, 0) },
    { title: 'Arden and Brisa quote history, 5-minute last observations', outlet: 'Banthom price history (demo)', t: SNAPSHOT },
  ],
  versions: [
    { v: 2, t: dt(2026, 11, 6, 13, 15), note: 'Added Nov 6 claims window; corrected Brisa gap duration from 60 to 90 minutes.' },
    { v: 1, t: dt(2026, 11, 5, 16, 2), note: 'First version.' },
  ],
};

// ---- Default user state (sample account)
export const DEFAULT_WATCHLISTS = [
  { id: 'my-markets', name: 'My markets', description: 'Default list. Star any market to add it here.',
    ids: ['fed-dec26-cut-ard', 'cpi-oct26-yoy-ard', 'unrate-nov26-ard', 'shutdown-jan27-ard', 'opec-cut-ard', 'gdp-q4-26-ard', 'fed-dec26-cut-brs'] },
  { id: 'macro', name: 'Macro watchlist', description: 'Rates, inflation and growth contracts for the weekly macro note.',
    ids: ['fed-dec26-cut-ard', 'fed-dec26-hold-ard', 'cpi-oct26-mom-ard', 'nfp-nov26-ard', 'ecb-dec26-cut-brs', 'recession-2027-brs'] },
];

export const DEFAULT_ALERTS = [
  { id: 'al-1', marketId: 'fed-dec26-cut-ard', metric: 'ask', op: 'gte', threshold: 65, cooldown: 30, channel: 'in-app', onlyFresh: true, enabled: true, lastTriggered: null },
  { id: 'al-2', marketId: 'cpi-oct26-yoy-ard', metric: 'change', op: 'absgte', threshold: 5, cooldown: 120, channel: 'in-app', onlyFresh: true, enabled: true, lastTriggered: dt(2026, 11, 5, 15, 12) },
  { id: 'al-3', marketId: 'shutdown-jan27-ard', metric: 'bid', op: 'lte', threshold: 25, cooldown: 60, channel: 'in-app', onlyFresh: true, enabled: false, lastTriggered: null },
  { id: 'al-4', marketId: 'gdp-q4-26-ard', metric: 'netspread', op: 'gte', threshold: 1, cooldown: 60, channel: 'in-app', onlyFresh: true, enabled: true, lastTriggered: dt(2026, 11, 6, 13, 48), matchId: 'gdp-q4' },
];

export const ALERT_HISTORY = [
  { id: 'h-1', alertId: 'al-4', t: dt(2026, 11, 6, 13, 48), unread: true,
    text: 'Q4 GDP pair net spread reached +1.5¢ (target ≥ +1.0¢) at 1:48 PM ET. Brisa source updated 1:47 PM ET. Top-of-book size is 140 contracts.' },
  { id: 'h-2', alertId: 'al-1', t: dt(2026, 11, 6, 9, 31), unread: true,
    text: 'Fed December cut Yes ask reached 64¢ (target ≥ 63¢) at 9:31 AM ET. Source updated 9:31 AM ET. Rule threshold has since been raised to 65¢.' },
  { id: 'h-3', alertId: 'al-2', t: dt(2026, 11, 5, 15, 12), unread: false,
    text: 'October CPI “above 2.9%” changed −5.3 pp in 24 hours (target |Δ| ≥ 5 pp) at 3:12 PM ET. Source updated 3:12 PM ET.' },
  { id: 'h-4', alertId: 'al-3', t: dt(2026, 11, 2, 10, 4), unread: false,
    text: 'Shutdown Yes bid fell to 24¢ (target ≤ 25¢) at 10:04 AM ET. Source updated 10:03 AM ET. Rule was later paused.' },
  { id: 'h-5', alertId: 'al-1', t: dt(2026, 11, 1, 14, 22), unread: false, suppressed: true,
    text: 'Not sent: Fed December cut ask crossed 63¢ at 2:22 PM ET while Arden data was delayed. Rule only fires on current quotes.' },
];

export const METRICS = {
  bid: { label: 'Yes bid', unit: '¢' },
  ask: { label: 'Yes ask', unit: '¢' },
  last: { label: 'Last trade', unit: '¢' },
  change: { label: '24h change', unit: 'pp' },
  volume: { label: 'Volume 24h', unit: 'ct' },
  closing: { label: 'Closing within', unit: 'h' },
  netspread: { label: 'Net spread (verified pair)', unit: '¢' },
};
export const OPS = { gte: '≥', lte: '≤', absgte: '|Δ| ≥' };
