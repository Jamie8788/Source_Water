/**
 * GeoAI Routes — Isolated proxy to geoai-service microservice
 * 
 * All routes are prefixed with /api/geoai and do NOT touch existing app logic
 * ZERO impact on users, dashboard, authentication, or existing features
 */

const router = require('express').Router()
const axios = require('axios')
const GEOAI_BASE_URL = process.env.GEOAI_SERVICE_URL || 'https://source-water-geoai.onrender.com'

router.get('/_proxy-version', (req, res) => {
  res.json({
    proxy: 'geoai',
    version: '2026-04-14-sync-redeploy-1',
    baseUrl: GEOAI_BASE_URL
  })
})

async function proxyGeoai(res, path, payload) {
  try {
    const resp = await axios.post(`${GEOAI_BASE_URL}${path}`, payload, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    })
    return res.status(resp.status).json(resp.data)
  } catch (err) {
    const status = err.response?.status || 500
    const upstream = err.response?.data
    const message = err.message || 'Unknown proxy error'
    console.error(`[geoai] proxy error ${path}:`, message)

    if (upstream) {
      return res.status(status).json(upstream)
    }

    return res.status(status).json({ error: 'GeoAI service error', msg: message })
  }
}

async function proxyGeoaiGet(res, path) {
  try {
    const resp = await axios.get(`${GEOAI_BASE_URL}${path}`, { timeout: 30000 })
    return res.status(resp.status).json(resp.data)
  } catch (err) {
    const status = err.response?.status || 500
    const upstream = err.response?.data
    const message = err.message || 'Unknown proxy error'
    console.error(`[geoai] proxy error ${path}:`, message)
    if (upstream) return res.status(status).json(upstream)
    return res.status(status).json({ error: 'GeoAI service error', msg: message })
  }
}

// ─── Water Detection ───────────────────────────────────────
router.post('/detect-water', async (req, res) => {
  try {
    const { latitude, longitude, date_start, date_end, resolution } = req.body
    
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude required' })
    }
    
    const payload = {
      latitude,
      longitude,
      date_start: date_start || new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
      date_end: date_end || new Date().toISOString().split('T')[0],
      resolution: resolution || '10m'
    }
    return proxyGeoai(res, '/api/geoai/detect-water', payload)
    
  } catch (err) {
    console.error('[geoai] detect-water validation error:', err.message)
    res.status(500).json({ error: 'GeoAI service error', msg: err.message })
  }
})

// ─── Wetland Mapping ───────────────────────────────────────
router.post('/map-wetlands', async (req, res) => {
  try {
    const { latitude, longitude, area_km_radius, model } = req.body
    
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude required' })
    }
    
    return proxyGeoai(res, '/api/geoai/map-wetlands', {
      latitude,
      longitude,
      area_km_radius: area_km_radius || 5,
      model: model || 'heuristic_proxy'
    })
    
  } catch (err) {
    console.error('[geoai] map-wetlands error:', err.message)
    res.status(500).json({ error: 'GeoAI service error', msg: err.message })
  }
})

// ─── Change Detection ──────────────────────────────────────
router.post('/detect-changes', async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      date_start,
      date_end,
      period_a_start,
      period_a_end,
      period_b_start,
      period_b_end,
      comparison_interval,
    } = req.body
    
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude required' })
    }
    
    return proxyGeoai(res, '/api/geoai/detect-changes', {
      latitude,
      longitude,
      date_start,
      date_end,
      period_a_start,
      period_a_end,
      period_b_start,
      period_b_end,
      comparison_interval: comparison_interval || 'monthly'
    })
    
  } catch (err) {
    console.error('[geoai] detect-changes error:', err.message)
    res.status(500).json({ error: 'GeoAI service error', msg: err.message })
  }
})

// ─── Water Quality Prediction ──────────────────────────────
router.post('/predict-quality', async (req, res) => {
  try {
    const { latitude, longitude, historical_observations } = req.body
    
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude required' })
    }
    
    return proxyGeoai(res, '/api/geoai/predict-quality', {
      latitude,
      longitude,
      historical_observations: historical_observations || []
    })
    
  } catch (err) {
    console.error('[geoai] predict-quality error:', err.message)
    res.status(500).json({ error: 'GeoAI service error', msg: err.message })
  }
})

// ─── Land Cover Classification ─────────────────────────────
router.post('/classify-landcover', async (req, res) => {
  try {
    const { latitude, longitude, zoom_level } = req.body
    
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude required' })
    }
    
    return proxyGeoai(res, '/api/geoai/classify-landcover', {
      latitude,
      longitude,
      zoom_level: zoom_level || 13
    })
    
  } catch (err) {
    console.error('[geoai] classify-landcover error:', err.message)
    res.status(500).json({ error: 'GeoAI service error', msg: err.message })
  }
})

// ─── Sentinel-2 Download ──────────────────────────────────
router.post('/download-sentinel', async (req, res) => {
  try {
    const { latitude, longitude, date_start, date_end, max_cloud_cover } = req.body
    
    if (latitude == null || longitude == null || !date_start || !date_end) {
      return res.status(400).json({ error: 'latitude, longitude, date_start, date_end required' })
    }
    
    return proxyGeoai(res, '/api/geoai/download-sentinel', {
      latitude,
      longitude,
      date_start,
      date_end,
      max_cloud_cover: max_cloud_cover || 20
    })
    
  } catch (err) {
    console.error('[geoai] download-sentinel error:', err.message)
    res.status(500).json({ error: 'GeoAI service error', msg: err.message })
  }
})

router.get('/capabilities', async (_req, res) => {
  return proxyGeoaiGet(res, '/capabilities')
})

// ─── Health check ─────────────────────────────────────────
router.get('/health', async (req, res) => {
  try {
    const resp = await axios.get(`${GEOAI_BASE_URL}/health`, { timeout: 15000 })
    res.status(resp.status).json(resp.data)
  } catch (err) {
    const status = err.response?.status || 503
    const upstream = err.response?.data
    if (upstream) {
      return res.status(status).json(upstream)
    }
    res.status(status).json({ status: 'unavailable', error: err.message })
  }
})

module.exports = router
