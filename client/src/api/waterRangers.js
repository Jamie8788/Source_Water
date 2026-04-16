/**
 * Water Rangers API Client
 * Calls through backend proxy at /api/wr/* to avoid CORS
 * Server-side: WATERRANGERS_API_KEY env var
 */
import api from '../utils/api'

// In-memory cache with 5 min TTL
const cache = new Map()
const TTL = 5 * 60 * 1000

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > TTL) { cache.delete(key); return null }
  return entry.data
}

async function wrGet(path, params = {}) {
  // Build cache key from path + params
  const cacheKey = path + JSON.stringify(params)
  const cached = getCached(cacheKey)
  if (cached) return cached

  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.set(k, v)
  })
  const qs = query.toString()
  const url = `/wr${path}${qs ? '?' + qs : ''}`

  const { data } = await api.get(url)
  cache.set(cacheKey, { data, ts: Date.now() })
  return data
}

// Normalize response — API may return array or {key: array}
function norm(data, key) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data[key])) return data[key]
  if (data && Array.isArray(data.data)) return data.data
  return []
}

// ── Locations ────────────────────────────────────────────────────────────────
export async function getLocations(opts = {}) {
  const { page = 1, perPage = 100, country, ...rest } = opts
  const data = await wrGet('/locations', { page, per_page: perPage, country, ...rest })
  return { raw: data, items: norm(data, 'locations'), page }
}

export const getLocation = (id) => wrGet(`/locations/${id}`)
export const getLocationObservations = (id, opts = {}) =>
  wrGet(`/locations/${id}/observations`, { page: opts.page || 1, per_page: opts.perPage || 50 })

// ── Observations ─────────────────────────────────────────────────────────────
export async function getObservations(opts = {}) {
  const { page = 1, perPage = 50, locationId, datasetId, ...rest } = opts
  const params = { page, per_page: perPage, ...rest }
  if (locationId) params.location_id = locationId
  if (datasetId) params.dataset_id = datasetId
  const data = await wrGet('/observations', params)
  return { raw: data, items: norm(data, 'observations'), page }
}

export const getObservation = (id) => wrGet(`/observations/${id}`)

// ── Datasets ─────────────────────────────────────────────────────────────────
export async function getDatasets(opts = {}) {
  const { page = 1, perPage = 50, ...rest } = opts
  const data = await wrGet('/datasets', { page, per_page: perPage, ...rest })
  return { raw: data, items: norm(data, 'datasets'), page }
}

export const getDataset = (id) => wrGet(`/datasets/${id}`)
export const getDatasetLocations = (id) => wrGet(`/datasets/${id}/locations`)
export const getDatasetObservations = (id, opts = {}) =>
  wrGet(`/datasets/${id}/observations`, { page: opts.page || 1, per_page: opts.perPage || 50 })
export const getDatasetForm = (id) => wrGet(`/datasets/${id}/form`)

// ── Organizations ────────────────────────────────────────────────────────────
export async function getOrganizations(opts = {}) {
  const { page = 1, perPage = 50 } = opts
  const data = await wrGet('/organizations', { page, per_page: perPage })
  return { raw: data, items: norm(data, 'organizations'), page }
}

export const getOrganization = (id) => wrGet(`/organizations/${id}`)

// ── Points of Interest ───────────────────────────────────────────────────────
export async function getPOIs(opts = {}) {
  const { page = 1, perPage = 50 } = opts
  const data = await wrGet('/poi', { page, per_page: perPage })
  return { raw: data, items: norm(data, 'poi'), page }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export const isConfigured = () => true  // Key is server-side now
export const clearCache = () => cache.clear()

export const QA_STATUS = {
  raw: { label: 'Raw', color: '#94a3b8', desc: 'Unreviewed data' },
  reviewed: { label: 'Reviewed', color: '#f59e0b', desc: 'Initial review done' },
  qc_complete: { label: 'QC Complete', color: '#10b981', desc: 'Quality control passed' },
  issue_found: { label: 'Issue Found', color: '#ef4444', desc: 'Data quality issue detected' },
}

export default {
  getLocations, getLocation, getLocationObservations,
  getObservations, getObservation,
  getDatasets, getDataset, getDatasetLocations, getDatasetObservations, getDatasetForm,
  getOrganizations, getOrganization,
  getPOIs, isConfigured, clearCache, QA_STATUS,
}
