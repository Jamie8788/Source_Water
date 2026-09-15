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
// Built for 1k+ users: rules live in a tiny in-memory cache, so a permission
// check is a Map lookup (microseconds), not a DB hit per request. The cache
// refreshes every 30s on its own AND is invalidated the instant an admin
// changes a rule — so a revoke takes effect immediately, not in 30s.
const db = require('../db/connection')
const { FEATURES } = require('./features')

let cache = null // { rMap, oMap, ts }

async function loadCache() {
  const [rules, overrides] = await Promise.all([
    db.all('SELECT role, feature, allowed FROM access_rules', []).catch(() => []),
    db.all('SELECT user_id, feature, allowed FROM access_overrides', []).catch(() => []),
  ])
  const rMap = new Map(), oMap = new Map()
  for (const r of rules) rMap.set(r.role + '|' + r.feature, Number(r.allowed) ? 1 : 0)
  for (const o of overrides) oMap.set(String(o.user_id) + '|' + o.feature, Number(o.allowed) ? 1 : 0)
  cache = { rMap, oMap, ts: Date.now() }
}

function invalidate() { cache = null }

async function ensure() {
  if (!cache || Date.now() - cache.ts > 30_000) await loadCache()
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

module.exports = { canAccess, accessMap, invalidate }
