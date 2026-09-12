// ── microCache: a tiny in-memory cache for SHARED, read-only responses ──────
//
// Purpose: some endpoints compute the exact same answer for every user (the
// monthly leaderboard, the active sponsors list). Recomputing them on every
// request — and especially under a burst of concurrent users — hammers the
// database for no reason. This keeps the last computed answer in the server's
// memory for a short time and hands it back instantly.
//
// Two protections, both important under load:
//   • TTL cache      — the answer is reused for `ttlMs`, so 1,000 requests in a
//                      minute run the query ONCE, not 1,000 times.
//   • in-flight dedup — if the cache is empty and many requests arrive at the
//                      same instant, only the FIRST runs the work; the rest
//                      await that same result. No thundering herd on the DB.
//
// Deliberately dependency-free and in-process: it is pure JavaScript memory,
// so it carries over to ANY host (Render, Hostinger, anything) with zero
// change and no external service (no Redis, no Supabase coupling). It is a
// cache, never the source of truth — if it is empty or wrong, the real query
// simply runs again. Use it ONLY for data that is the same for all users and
// safe to be a few seconds stale. Never use it for per-user or secret data.
//
// Note on scaling to multiple server instances: each instance keeps its own
// copy (same as the Water Rangers "shelf"). That is fine — worst case each
// instance runs the query once per TTL. If you later run many instances and
// want a single shared cache, this same call site swaps to Redis unchanged.

function makeCache(ttlMs) {
  const store = new Map()     // key -> { body, exp }
  const inflight = new Map()  // key -> Promise<body>  (dedupes concurrent misses)

  // get(key, computeFn): return the cached body, or run computeFn() once and
  // cache it. computeFn MUST resolve to the value you want cached & sent.
  async function get(key, computeFn) {
    const now = Date.now()
    const hit = store.get(key)
    if (hit && hit.exp > now) return hit.body        // fresh → instant

    if (inflight.has(key)) return inflight.get(key)  // already computing → share it

    const p = (async () => {
      const body = await computeFn()
      store.set(key, { body, exp: Date.now() + ttlMs })
      return body
    })()
    // Clear the in-flight marker whether it succeeded or failed. On failure we
    // do NOT cache anything, so the next request retries cleanly.
    inflight.set(key, p)
    p.finally(() => { inflight.delete(key) }).catch(() => {})
    return p
  }

  // Drop a cached key (or everything) — call after a write so a change shows
  // up immediately instead of waiting out the TTL.
  function invalidate(key) {
    if (key === undefined) store.clear()
    else store.delete(key)
  }

  return { get, invalidate }
}

module.exports = { makeCache }
