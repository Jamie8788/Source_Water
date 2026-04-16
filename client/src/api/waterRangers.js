/**
 * Water Rangers API v2.0 Service
 * Real data from https://data.waterrangers.com
 * Docs: https://data.waterrangers.com/api
 *
 * Endpoints: locations, observations, datasets, organizations, forms, POIs
 * Auth: api_key query param on all requests
 * Pagination: page + per_page (max 100)
 * Photos: signed URLs, expire in 7 days
 */

const API_KEY = import.meta.env.VITE_WATERRANGERS_API_KEY
const BASE = 'https://data.waterrangers.com'

// In-memory cache with TTL
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null }
  return entry.data
}
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }) }

async function apiFetch(endpoint, params = {}) {
  if (!API_KEY) throw new Error('Water Rangers API key not configured. Set VITE_WATERRANGERS_API_KEY in .env.local')
  const url = new URL(`${BASE}${endpoint}`)
  url.searchParams.set('api_key', API_KEY)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })
  const cacheKey = url.toString()
  const cached = getCached(cacheKey)
  if (cached) return cached

  const res = await fetch(url.toString())
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Water Rangers API ${res.status}: ${text || res.statusText}`)
  }
  const data = await res.json()
  setCache(cacheKey, data)
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
  const params = { page, per_page: perPage, ...rest }
  if (country) params.country = country
  const data = await apiFetch('/locations.json', params)
  return { raw: data, items: norm(data, 'locations'), page }
}

export const getLocation = (id) => apiFetch(`/locations/${id}.json`)
export const getLocationObservations = (id, opts = {}) =>
  apiFetch(`/locations/${id}/observations.json`, { page: opts.page || 1, per_page: opts.perPage || 50 })

// ── Observations ─────────────────────────────────────────────────────────────
export async function getObservations(opts = {}) {
  const { page = 1, perPage = 50, locationId, datasetId, ...rest } = opts
  const params = { page, per_page: perPage, ...rest }
  if (locationId) params.location_id = locationId
  if (datasetId) params.dataset_id = datasetId
  const data = await apiFetch('/observations.json', params)
  return { raw: data, items: norm(data, 'observations'), page }
}

export const getObservation = (id) => apiFetch(`/observations/${id}.json`)

// ── Datasets ─────────────────────────────────────────────────────────────────
export async function getDatasets(opts = {}) {
  const { page = 1, perPage = 50, ...rest } = opts
  const data = await apiFetch('/datasets.json', { page, per_page: perPage, ...rest })
  return { raw: data, items: norm(data, 'datasets'), page }
}

export const getDataset = (id) => apiFetch(`/datasets/${id}.json`)
export const getDatasetLocations = (id) => apiFetch(`/datasets/${id}/locations.json`)
export const getDatasetObservations = (id, opts = {}) =>
  apiFetch(`/datasets/${id}/observations.json`, { page: opts.page || 1, per_page: opts.perPage || 50 })
export const getDatasetForm = (id) => apiFetch(`/datasets/${id}/form.json`)

// ── Organizations ────────────────────────────────────────────────────────────
export async function getOrganizations(opts = {}) {
  const { page = 1, perPage = 50 } = opts
  const data = await apiFetch('/organizations.json', { page, per_page: perPage })
  return { raw: data, items: norm(data, 'organizations'), page }
}

export const getOrganization = (id) => apiFetch(`/organizations/${id}.json`)

// ── Points of Interest ───────────────────────────────────────────────────────
export async function getPOIs(opts = {}) {
  const { page = 1, perPage = 50 } = opts
  const data = await apiFetch('/poi.json', { page, per_page: perPage })
  return { raw: data, items: norm(data, 'poi'), page }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export const isConfigured = () => !!API_KEY
export const clearCache = () => cache.clear()

// QA status labels
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
  getPOIs,
  isConfigured, clearCache, QA_STATUS,
}
