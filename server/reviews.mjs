// Human review of suggested Kalshi–Polymarket pairs: "verified" (same question) or "wrong" (not the same).
// Decisions are kept in one JSON file (REVIEWS_FILE, on a Railway volume in production) so they survive deploys.
import fs from 'node:fs';
import path from 'node:path';

const FILE = process.env.REVIEWS_FILE || path.join(process.cwd(), 'data', 'reviews.json');
const STATUSES = new Set(['verified', 'wrong']);

let byId = new Map();
let version = 0;
let writing = Promise.resolve();
let lastError = null;

export function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    byId = new Map((raw.reviews || []).filter((r) => r && r.id && r.k && r.p && STATUSES.has(r.status)).map((r) => [r.id, r]));
    console.log(`[reviews] ${byId.size} decisions loaded from ${FILE}`);
  } catch (err) {
    if (err.code === 'ENOENT') console.log(`[reviews] no decisions yet (${FILE})`);
    else { lastError = String(err.message); console.warn(`[reviews] could not read ${FILE}: ${err.message}`); }
  }
  version = Date.now();
}

// Write the whole file to a temporary name, then rename, so a crash never leaves half a file.
function save() {
  const body = JSON.stringify({ savedAt: Date.now(), reviews: [...byId.values()] }, null, 1);
  writing = writing.then(async () => {
    await fs.promises.mkdir(path.dirname(FILE), { recursive: true });
    await fs.promises.writeFile(`${FILE}.tmp`, body);
    await fs.promises.rename(`${FILE}.tmp`, FILE);
    lastError = null;
  }).catch((err) => { lastError = String(err.message); console.warn(`[reviews] save failed: ${err.message}`); });
  return writing;
}

export const get = (id) => byId.get(id) || null;
export const all = () => [...byId.values()];
export const getVersion = () => version;
export const status = () => ({ file: FILE, decisions: byId.size, verified: all().filter((r) => r.status === 'verified').length, wrong: all().filter((r) => r.status === 'wrong').length, lastError });

// rec: { id, k, p, status: 'verified' | 'wrong' | 'clear', note, kName, pName, score }
export async function set(rec) {
  if (rec.status === 'clear') byId.delete(rec.id);
  else if (STATUSES.has(rec.status)) {
    byId.set(rec.id, { id: rec.id, k: rec.k, p: rec.p, status: rec.status, note: String(rec.note || '').slice(0, 500),
      kName: String(rec.kName || '').slice(0, 300), pName: String(rec.pName || '').slice(0, 300), score: rec.score ?? null, at: Date.now() });
  } else throw new Error('Unknown status');
  version = Date.now();
  await save();
  if (lastError) throw new Error(`Could not save the decision: ${lastError}`);
  return get(rec.id);
}
