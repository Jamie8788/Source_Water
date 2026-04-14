/**
 * GeoAI Routes — Isolated proxy to geoai-service microservice
 * 
 * All routes are prefixed with /api/geoai and do NOT touch existing app logic
 * ZERO impact on users, dashboard, authentication, or existing features
 */

const router = require('express').Router()

// ─── Water Detection ───────────────────────────────────────
router.post('/detect-water', async (req, res) => {
  try {
    const { latitude, longitude, date_start, date_end, resolution } = req.body
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude required' })
    }
    
    const geoaiUrl = 'https://source-water-geoai.onrender.com'
    const payload = {
      latitude,
      longitude,
      date_start: date_start || new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
      date_end: date_end || new Date().toISOString().split('T')[0],
      resolution: resolution || '10m'
    }
    
    console.log(`[geoai] Fetching from: ${geoaiUrl}/api/geoai/detect-water with payload:`, payload)

    const resp = await fetch(`${geoaiUrl}/api/geoai/detect-water`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    })
    
    console.log(`[geoai] Response status: ${resp.status}`)
    const text = await resp.text()
    console.log(`[geoai] Response body: ${text.substring(0, 500)}`)
    
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Backend returned ${resp.status}`, details: text })
    }
    
    res.status(200).json(JSON.parse(text))
    
  } catch (err) {
    console.error('[geoai] detect-water CATCH block:', err.name, err.message)
    res.status(500).json({ error: 'GeoAI service error', msg: err.message, errName: err.name })
  }
})

// ─── Wetland Mapping ───────────────────────────────────────
router.post('/map-wetlands', async (req, res) => {
  try {
    const { latitude, longitude, area_km_radius, model } = req.body
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude required' })
    }
    
    const geoaiUrl = 'https://source-water-geoai.onrender.com'
    
    const resp = await fetch(`${geoaiUrl}/api/geoai/map-wetlands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude,
        longitude,
        area_km_radius: area_km_radius || 5,
        model: model || 'wetland_classifier_v2'
      }),
      timeout: 30000
    })
    
    const text = await resp.text()
    console.log(`[geoai] map-wetlands response ${resp.status}: ${text}`)
    
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Backend returned ${resp.status}`, details: text })
    }
    
    res.status(200).json(JSON.parse(text))
    
  } catch (err) {
    console.error('[geoai] map-wetlands error:', err.message)
    res.status(500).json({ error: 'GeoAI service error', msg: err.message })
  }
})

// ─── Change Detection ──────────────────────────────────────
router.post('/detect-changes', async (req, res) => {
  try {
    const { latitude, longitude, date_start, date_end, comparison_interval } = req.body
    
    if (!latitude || !longitude || !date_start || !date_end) {
      return res.status(400).json({ error: 'latitude, longitude, date_start, date_end required' })
    }
    
    const geoaiUrl = 'https://source-water-geoai.onrender.com'
    
    const resp = await fetch(`${geoaiUrl}/api/geoai/detect-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude,
        longitude,
        date_start,
        date_end,
        comparison_interval: comparison_interval || 'monthly'
      }),
      timeout: 30000
    })
    
    const text = await resp.text()
    console.log(`[geoai] detect-changes response ${resp.status}: ${text.substring(0, 200)}`)
    
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Backend returned ${resp.status}`, details: text })
    }
    
    res.status(200).json(JSON.parse(text))
    
  } catch (err) {
    console.error('[geoai] detect-changes error:', err.message)
    res.status(500).json({ error: 'GeoAI service error', msg: err.message })
  }
})

// ─── Water Quality Prediction ──────────────────────────────
router.post('/predict-quality', async (req, res) => {
  try {
    const { latitude, longitude, historical_observations } = req.body
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude required' })
    }
    
    const geoaiUrl = 'https://source-water-geoai.onrender.com'
    
    const resp = await fetch(`${geoaiUrl}/api/geoai/predict-quality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude,
        longitude,
        historical_observations: historical_observations || []
      }),
      timeout: 30000
    })
    
    const text = await resp.text()
    console.log(`[geoai] predict-quality response ${resp.status}: ${text.substring(0, 200)}`)
    
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Backend returned ${resp.status}`, details: text })
    }
    
    res.status(200).json(JSON.parse(text))
    
  } catch (err) {
    console.error('[geoai] predict-quality error:', err.message)
    res.status(500).json({ error: 'GeoAI service error', msg: err.message })
  }
})

// ─── Land Cover Classification ─────────────────────────────
router.post('/classify-landcover', async (req, res) => {
  try {
    const { latitude, longitude, zoom_level } = req.body
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude required' })
    }
    
    const geoaiUrl = 'https://source-water-geoai.onrender.com'
    
    const resp = await fetch(`${geoaiUrl}/api/geoai/classify-landcover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude,
        longitude,
        zoom_level: zoom_level || 13
      }),
      timeout: 30000
    })
    
    const text = await resp.text()
    console.log(`[geoai] classify-landcover response ${resp.status}: ${text.substring(0, 200)}`)
    
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Backend returned ${resp.status}`, details: text })
    }
    
    res.status(200).json(JSON.parse(text))
    
  } catch (err) {
    console.error('[geoai] classify-landcover error:', err.message)
    res.status(500).json({ error: 'GeoAI service error', msg: err.message })
  }
})

// ─── Sentinel-2 Download ──────────────────────────────────
router.post('/download-sentinel', async (req, res) => {
  try {
    const { latitude, longitude, date_start, date_end, max_cloud_cover } = req.body
    
    if (!latitude || !longitude || !date_start || !date_end) {
      return res.status(400).json({ error: 'latitude, longitude, date_start, date_end required' })
    }
    
    const geoaiUrl = 'https://source-water-geoai.onrender.com'
    
    const resp = await fetch(`${geoaiUrl}/api/geoai/download-sentinel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude,
        longitude,
        date_start,
        date_end,
        max_cloud_cover: max_cloud_cover || 20
      }),
      timeout: 30000
    })
    
    const text = await resp.text()
    console.log(`[geoai] download-sentinel response ${resp.status}: ${text.substring(0, 200)}`)
    
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Backend returned ${resp.status}`, details: text })
    }
    
    res.status(200).json(JSON.parse(text))
    
  } catch (err) {
    console.error('[geoai] download-sentinel error:', err.message)
    res.status(500).json({ error: 'GeoAI service error', msg: err.message })
  }
})

// ─── Health check ─────────────────────────────────────────
router.get('/health', async (req, res) => {
  try {
    const resp = await fetch('https://source-water-geoai.onrender.com/health')
    const data = await resp.json()
    res.status(resp.status).json(data)
  } catch (err) {
    res.status(503).json({ status: 'unavailable', error: err.message })
  }
})

module.exports = router
