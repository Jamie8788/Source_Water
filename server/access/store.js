// ── Access resolver: decides whether a user may use a feature, live.
//
// Resolution order (first match wins):
//   1. Admins bypass everything (always allowed).
//   2. Per-user override for (user, feature), if set.
//   3. Role default for (user.role, feature), if set.
//   4. Otherwise ALLOWED (opt-out model — a feature is on for everyone until
//      an admin explicitly turns it off, so nothing breaks by default and a
//      new feature is visible until you decide otherwise).
//
// Built for 1k+ users AND multiple app instances (Render/Hostinger may run
// more than one). Rules live in a tiny in-memory cache, so a permission check
// is a Map lookup (microseconds), not a DB hit per request.
//
// Cross-instance freshness without Redis (migration-safe, Postgres only):
//   • Every write bumps a single integer in access_meta ('version').
//   • Each instance polls that ONE tiny PK row at most every POLL_MS. If the
//     number moved (another instance changed a rule), it reloads its cache;
//     otherwise it keeps serving from memory with zero further DB work.
//   • A change on THIS instance drops the local cache immediately (instant),
//     and the version bump makes every OTHER instance converge within POLL_MS.
// So a revoke takes effect in <POLL_MS everywhere, and a full self-heal
// reload happens at most every FULL_TTL as a backstop.
const db = require('../db/connection')
const { FEATURES } = require('./features')

let cache = null       // { rMap, oMap, ts, ver }
let lastVerCheck = 0   // when we last read the version counter

const POLL_MS = 5_000     // max cross-instance staleness
const FULL_TTL = 60_000   // backstop: force a full reload at least this often

async function readVersion() {
  try {
    const row = await db.get(`SELECT v FROM access_meta WHERE k = 'version'`, [])
    return row ? Number(row.v) : 0
  } catch { return cache ? cache.ver : 0 }
}

// Bump the shared version counter so every instance reloads on its next poll.
async function bumpVersion() {
  try {
    await db.get(
      `INSERT INTO access_meta (k, v) VALUES ('version', 1)
       ON CONFLICT (k) DO UPDATE SET v = access_meta.v + 1
       RETURNING v`, [])
  } catch (_) { /* non-fatal — local invalidate still applied */ }
}

async function loadCache() {
  const [rules, overrides, ver] = await Promise.all([
    db.all('SELECT role, feature, allowed FROM access_rules', []).catch(() => []),
    db.all('SELECT user_id, feature, allowed FROM access_overrides', []).catch(() => []),
    readVersion(),
  ])
  const rMap = new Map(), oMap = new Map()
  for (const r of rules) rMap.set(r.role + '|' + r.feature, Number(r.allowed) ? 1 : 0)
  for (const o of overrides) oMap.set(String(o.user_id) + '|' + o.feature, Number(o.allowed) ? 1 : 0)
  cache = { rMap, oMap, ts: Date.now(), ver }
  lastVerCheck = Date.now()
}

// Drop the local cache (same instance only). Next ensure() reloads.
function invalidate() { cache = null }

// Signal a rule change to EVERY instance: bump the shared version AND drop the
// local cache so this instance is instant and others converge within POLL_MS.
// The admin routes call this after a successful write.
async function signalChange() {
  await bumpVersion()
  cache = null
}

async function ensure() {
  const now = Date.now()
  // No cache, or the backstop TTL elapsed → full reload.
  if (!cache || now - cache.ts > FULL_TTL) return loadCache()
  // Otherwise only poll the tiny version counter every POLL_MS. Another
  // instance's bump tells us to reload; if unchanged we keep serving from
  // memory with a single cheap PK lookup per POLL_MS (not per request).
  if (now - lastVerCheck > POLL_MS) {
    lastVerCheck = now
    const ver = await readVersion()
    if (ver !== cache.ver) return loadCache()
  }
}

// canAccess(user, featureKey) → boolean
async function canAccess(user, feature) {
  if (!user) return false
  if (user.is_admin) return true
  await ensure()
  const ov = cache.oMap.get(String(user.id) + '|' + feature)
  if (ov != null) return !!ov
  const rd = cache.rMap.get((user.role || '') + '|' + feature)
  if (rd != null) return !!rd
  return true // default allow
}

// The full feature→allowed map for one user (what the client renders from).
async function accessMap(user) {
  if (!user) return {}
  await ensure()
  const map = {}
  for (const f of FEATURES) {
    if (user.is_admin) { map[f.key] = true; continue }
    const ov = cache.oMap.get(String(user.id) + '|' + f.key)
    const rd = cache.rMap.get((user.role || '') + '|' + f.key)
    map[f.key] = ov != null ? !!ov : (rd != null ? !!rd : true)
  }
  return map
}

module.exports = { canAccess, accessMap, invalidate, signalChange }
