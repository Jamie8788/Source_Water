/**
 * Water Rangers API Proxy
 * Forwards requests to data.waterrangers.com to avoid CORS issues
 * API key stored server-side for security
 */
const router = require('express').Router()

const WR_BASE = 'https://data.waterrangers.com'
const API_KEY = process.env.WATERRANGERS_API_KEY || process.env.VITE_WATERRANGERS_API_KEY

// Simple in-memory cache (5 min TTL)
const cache = new Map()
const TTL = 5 * 60 * 1000

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

// GET /api/wr/locations
router.get('/locations', async (req, res) => {
  try {
    const data = await wrFetch('/locations.json', req.query)
    res.json(data)
  } catch (e) {
    console.error('[WR] locations error:', e.message)
    res.status(502).json({ error: e.message })
  }
})

// GET /api/wr/locations/:id
router.get('/locations/:id', async (req, res) => {
  try {
    const data = await wrFetch(`/locations/${req.params.id}.json`)
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// GET /api/wr/locations/:id/observations
router.get('/locations/:id/observations', async (req, res) => {
  try {
    const data = await wrFetch(`/locations/${req.params.id}/observations.json`, req.query)
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// GET /api/wr/observations
router.get('/observations', async (req, res) => {
  try {
    const data = await wrFetch('/observations.json', req.query)
    res.json(data)
  } catch (e) {
    console.error('[WR] observations error:', e.message)
    res.status(502).json({ error: e.message })
  }
})

// GET /api/wr/observations/:id
router.get('/observations/:id', async (req, res) => {
  try {
    const data = await wrFetch(`/observations/${req.params.id}.json`)
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// GET /api/wr/datasets
router.get('/datasets', async (req, res) => {
  try {
    const data = await wrFetch('/datasets.json', req.query)
    res.json(data)
  } catch (e) {
    console.error('[WR] datasets error:', e.message)
    res.status(502).json({ error: e.message })
  }
})

// GET /api/wr/datasets/:id
router.get('/datasets/:id', async (req, res) => {
  try {
    const data = await wrFetch(`/datasets/${req.params.id}.json`)
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// GET /api/wr/datasets/:id/form
router.get('/datasets/:id/form', async (req, res) => {
  try {
    const data = await wrFetch(`/datasets/${req.params.id}/form.json`)
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// GET /api/wr/datasets/:id/locations
router.get('/datasets/:id/locations', async (req, res) => {
  try {
    const data = await wrFetch(`/datasets/${req.params.id}/locations.json`)
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// GET /api/wr/datasets/:id/observations
router.get('/datasets/:id/observations', async (req, res) => {
  try {
    const data = await wrFetch(`/datasets/${req.params.id}/observations.json`, req.query)
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// GET /api/wr/organizations
router.get('/organizations', async (req, res) => {
  try {
    const data = await wrFetch('/organizations.json', req.query)
    res.json(data)
  } catch (e) {
    console.error('[WR] organizations error:', e.message)
    res.status(502).json({ error: e.message })
  }
})

// GET /api/wr/poi
router.get('/poi', async (req, res) => {
  try {
    const data = await wrFetch('/poi.json', req.query)
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

module.exports = router
