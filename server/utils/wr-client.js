/**
 * Lightweight Water Rangers API client used by the alert-watches checker.
 *
 * Intentionally separate from server/routes/waterrangers.js so we don't have
 * to refactor that route module. The cost is a duplicate in-memory cache,
 * which is fine — it's a few KB per process.
 */
const WR_BASE = 'https://data.waterrangers.com'
const API_KEY = process.env.WATERRANGERS_API_KEY || process.env.VITE_WATERRANGERS_API_KEY

const cache = new Map()
const TTL = 5 * 60 * 1000 // 5 min — same as waterrangers.js route cache

async function wrFetch(endpoint, query = {}) {
  if (!API_KEY) throw new Error('WATERRANGERS_API_KEY not set')

  const url = new URL(`${WR_BASE}${endpoint}`)
  url.searchParams.set('api_key', API_KEY)
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })

  const cacheKey = url.toString()
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < TTL) return cached.data

  const res = await fetch(url.toString())
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Water Rangers ${res.status}: ${text || res.statusText}`)
  }
  const data = await res.json()
  cache.set(cacheKey, { data, ts: Date.now() })
  return data
}

// Get a single WR location's metadata.
async function getWRLocation(wrId) {
  return wrFetch(`/locations/${wrId}.json`)
}

// Get observations for a WR location (newest first per WR convention).
// per_page caps at 100 in WR's API.
async function getWRObservations(wrId, perPage = 50) {
  return wrFetch(`/locations/${wrId}/observations.json`, { per_page: perPage })
}

module.exports = { wrFetch, getWRLocation, getWRObservations }
