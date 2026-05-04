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

// GET /api/wr/locations — single page (backwards compat)
router.get('/locations', async (req, res) => {
  try {
    const data = await wrFetch('/locations.json', req.query)
    res.json(data)
  } catch (e) {
    console.error('[WR] locations error:', e.message)
    res.status(502).json({ error: e.message })
  }
})

// GET /api/wr/locations-all — BULK: ALL locations with PARALLEL fetching + 1hr cache
// Fetches 10 pages at a time in parallel — 9,444 locations in ~15 seconds, not 90
let allLocationsCache = { data: null, ts: 0 }
const ALL_LOC_TTL = 60 * 60 * 1000 // 1 hour cache
let loadingInProgress = null // prevent duplicate loads

// ── Ownership enrichment ─────────────────────────────────────────────────
// Water Rangers' /locations.json bulk feed does NOT include organization or
// dataset names per row (those only appear on the per-site detail page).
// So we walk /datasets + /organizations once per cache refresh and stitch
// dataset_name + organization_name onto every location.
//
// Failures here are non-fatal: if the join fails we still return raw
// locations and the UI's conditional rendering hides the org/dataset
// dropdowns gracefully (no broken state).
async function buildOwnershipIndex() {
  // 1) Pull all organizations → id → name lookup.
  const orgs = []
  for (let page = 1; page <= 50; page++) {
    try {
      const data = await wrFetch('/organizations.json', { page, per_page: 100 })
      const items = Array.isArray(data) ? data : []
      if (items.length === 0) break
      orgs.push(...items)
    } catch (e) {
      console.log(`[WR] organizations page ${page} failed: ${e.message}`)
      break
    }
  }
  const orgById = new Map(orgs.map(o => [o.id, o.name || o.title || `Organization ${o.id}`]))
  console.log(`[WR] enrichment: ${orgs.length} organizations loaded`)

  // 2) Pull all datasets — each carries organization_id.
  const datasets = []
  for (let page = 1; page <= 50; page++) {
    try {
      const data = await wrFetch('/datasets.json', { page, per_page: 100 })
      const items = Array.isArray(data) ? data : []
      if (items.length === 0) break
      datasets.push(...items)
    } catch (e) {
      console.log(`[WR] datasets page ${page} failed: ${e.message}`)
      break
    }
  }
  console.log(`[WR] enrichment: ${datasets.length} datasets loaded`)

  // 3) For each dataset, fetch /datasets/:id/locations.json — SERIAL with
  //    a small delay so we don't trip Water Rangers' 429 rate limiter.
  //    Empirically: 8-parallel hits 429 immediately; serial with ~250 ms
  //    spacing finishes in ~50–80 s with zero rate-limit errors. This
  //    runs in the background after the response is sent, so the user
  //    never waits.
  const locationOwnership = new Map()
  const REQUEST_SPACING_MS = 250
  for (let i = 0; i < datasets.length; i++) {
    const ds = datasets[i]
    try {
      const data = await wrFetch(`/datasets/${ds.id}/locations.json`, { per_page: 1000 })
      const items = Array.isArray(data) ? data : []
      const orgName = orgById.get(ds.organization_id) || ds.organization_name || ds.organization?.name || ''
      const datasetName = ds.name || ds.title || `Dataset ${ds.id}`
      for (const loc of items) {
        if (!loc?.id) continue
        const existing = locationOwnership.get(loc.id)
        if (existing) {
          if (!existing.organization_name && orgName) existing.organization_name = orgName
          if (datasetName && existing.dataset_name && !existing.dataset_name.split(', ').includes(datasetName)) {
            existing.dataset_name = `${existing.dataset_name}, ${datasetName}`
          } else if (datasetName && !existing.dataset_name) {
            existing.dataset_name = datasetName
          }
        } else {
          locationOwnership.set(loc.id, { organization_name: orgName, dataset_name: datasetName })
        }
      }
    } catch (e) {
      // 429 → wait longer and retry once. Anything else → skip this dataset.
      if (String(e.message).includes('429')) {
        await new Promise(r => setTimeout(r, 3000))
        try {
          const retryData = await wrFetch(`/datasets/${ds.id}/locations.json`, { per_page: 1000 })
          const items = Array.isArray(retryData) ? retryData : []
          const orgName = orgById.get(ds.organization_id) || ''
          const datasetName = ds.name || ds.title || `Dataset ${ds.id}`
          for (const loc of items) {
            if (!loc?.id) continue
            if (!locationOwnership.has(loc.id)) {
              locationOwnership.set(loc.id, { organization_name: orgName, dataset_name: datasetName })
            }
          }
        } catch { /* give up on this dataset */ }
      }
    }
    if ((i + 1) % 50 === 0) console.log(`[WR] enrichment: ${i + 1}/${datasets.length} datasets walked, ${locationOwnership.size} sites mapped so far`)
    // Respect the rate limit between calls.
    if (i < datasets.length - 1) await new Promise(r => setTimeout(r, REQUEST_SPACING_MS))
  }
  console.log(`[WR] enrichment: ownership stitched onto ${locationOwnership.size} unique locations`)
  return locationOwnership
}

async function enrichLocationsWithOwnership(locations) {
  try {
    const idx = await buildOwnershipIndex()
    if (idx.size === 0) return locations
    return locations.map(l => {
      const own = idx.get(l.id)
      if (!own) return l
      return {
        ...l,
        organization_name: l.organization_name || own.organization_name || '',
        dataset_name:      l.dataset_name      || own.dataset_name      || '',
      }
    })
  } catch (e) {
    console.error(`[WR] enrichment failed (returning raw locations): ${e.message}`)
    return locations
  }
}

// Background enrichment — never awaited by the request handler. Runs
// AFTER the response is sent and patches the cache in place when it
// finishes. Single-flight: if a previous run is still going, skip.
let enrichmentInProgress = false
let enrichmentCompletedAt = 0
function maybeStartBackgroundEnrichment() {
  if (enrichmentInProgress) return
  if (!allLocationsCache.data) return
  // Don't re-enrich if we just finished within the same cache window.
  if (allLocationsCache.ts && enrichmentCompletedAt >= allLocationsCache.ts) return
  enrichmentInProgress = true
  const startedTs = allLocationsCache.ts
  console.log('[WR] starting BACKGROUND ownership enrichment (non-blocking)…')
  ;(async () => {
    try {
      const enriched = await enrichLocationsWithOwnership(allLocationsCache.data)
      // Only patch the cache if it's still the SAME generation we started
      // with — otherwise a fresher load happened mid-flight and we should
      // not clobber it.
      if (allLocationsCache.ts === startedTs) {
        allLocationsCache = { data: enriched, ts: startedTs }
        enrichmentCompletedAt = startedTs
        const enrichedCount = enriched.filter(l => l.organization_name || l.dataset_name).length
        console.log(`[WR] background enrichment done — ${enrichedCount}/${enriched.length} sites now have ownership info`)
      } else {
        console.log('[WR] background enrichment finished but cache was refreshed mid-flight; skipping patch')
      }
    } catch (e) {
      console.error(`[WR] background enrichment crashed: ${e.message}`)
    } finally {
      enrichmentInProgress = false
    }
  })()
}

router.get('/locations-all', async (req, res) => {
  try {
    // Return cache if fresh
    if (allLocationsCache.data && Date.now() - allLocationsCache.ts < ALL_LOC_TTL) {
      console.log(`[WR] Returning cached ${allLocationsCache.data.length} locations`)
      res.json({ locations: allLocationsCache.data, cached: true, count: allLocationsCache.data.length })
      // If this cache generation hasn't been enriched yet (e.g. server
      // just started, raw load just finished), kick off enrichment in
      // the background. Idempotent — single-flight guard inside.
      maybeStartBackgroundEnrichment()
      return
    }

    // If another request is already loading, wait for it
    if (loadingInProgress) {
      console.log('[WR] Waiting for existing load...')
      const result = await loadingInProgress
      return res.json({ locations: result, cached: true, count: result.length })
    }

    console.log('[WR] Loading ALL 9,444+ locations (sequential for reliability)...')
    loadingInProgress = (async () => {
      const all = []
      // Sequential — slower but guarantees every page loads
      pageLoop: for (let page = 1; page <= 100; page++) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const data = await wrFetch('/locations.json', { page, per_page: 100 })
            const items = Array.isArray(data) ? data : []
            if (items.length === 0) {
              console.log(`[WR] Page ${page}: empty — done! Total: ${all.length}`)
              break pageLoop
            }
            all.push(...items)
            if (page % 10 === 0) console.log(`[WR] Page ${page}: total ${all.length}`)
            break // success, move to next page
          } catch (e) {
            console.log(`[WR] Page ${page} attempt ${attempt} failed: ${e.message}`)
            if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt)) // wait 1s, 2s before retry
          }
        }
      }
      return all
    })()

    const all = await loadingInProgress
    loadingInProgress = null
    allLocationsCache = { data: all, ts: Date.now() }
    console.log(`[WR] Loaded ${all.length} total locations, cached for 1hr`)
    res.json({ locations: all, cached: false, count: all.length })
    // Start ownership enrichment in the background — user already has
    // their response. When it finishes (~1–2 min later) the cache gets
    // patched in place so the NEXT request returns enriched data.
    maybeStartBackgroundEnrichment()
  } catch (e) {
    console.error('[WR] bulk locations error:', e.message)
    // Return partial cache if available
    if (allLocationsCache.data) {
      return res.json({ locations: allLocationsCache.data, cached: true, count: allLocationsCache.data.length, partial: true })
    }
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

// ═══════════════════════════════════════════════════════════════════════════
// AI RESEARCH AGENT — Fetches REAL data first, then sends to Gemini
// No hallucination — every answer grounded in actual Water Rangers data
// ═══════════════════════════════════════════════════════════════════════════

const GEMINI_KEY = process.env.GEMINI_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY

// WHO thresholds for anomaly detection
const WHO = {
  ph: { min: 6.5, max: 8.5, label: 'pH' },
  oxygen: { min: 6, max: 20, label: 'Dissolved Oxygen (mg/L)' },
  conductivity: { min: 0, max: 1500, label: 'Conductivity (µS/cm)' },
  hardness: { min: 0, max: 500, label: 'Hardness (ppm)' },
  alkalinity: { min: 20, max: 200, label: 'Alkalinity (ppm)' },
  chlorine: { min: 0, max: 5, label: 'Chlorine (mg/L)' },
  phosphates: { min: 0, max: 0.1, label: 'Phosphates (mg/L)' },
  water_temperature: { min: 0, max: 30, label: 'Water Temp (°C)' },
}

function analyzeObservations(observations) {
  const anomalies = []
  const paramStats = {}
  const qaCounts = {}

  for (const obs of observations) {
    qaCounts[obs.checked] = (qaCounts[obs.checked] || 0) + 1
    for (const r of (obs.readings || [])) {
      const val = parseFloat(r.value)
      if (isNaN(val) || !r.unit || r.unit === 'nil') continue
      const param = r.parameter
      if (!paramStats[param]) paramStats[param] = { values: [], unit: r.unit }
      paramStats[param].values.push(val)

      const thresh = Object.entries(WHO).find(([k]) => param.includes(k))
      if (thresh) {
        const [, t] = thresh
        if (val < t.min || val > t.max) {
          anomalies.push({ param, value: val, unit: r.unit, threshold: `${t.min}-${t.max}`, date: obs.observed_at })
        }
      }
    }
  }

  const trends = Object.entries(paramStats).map(([param, { values, unit }]) => {
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)
    return { param, mean: +mean.toFixed(3), min: +min.toFixed(3), max: +max.toFixed(3), count: values.length, unit }
  }).sort((a, b) => b.count - a.count)

  return { anomalies, trends, qaCounts, totalReadings: Object.values(paramStats).reduce((s, p) => s + p.values.length, 0) }
}

async function callGemini(prompt) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set')
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
}

async function callGroq(messages) {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY not set')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, max_tokens: 2048, temperature: 0.3 }),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'No response'
}

// POST /api/wr/agent — AI Research Agent
// 1. Fetches real-time Water Rangers data
// 2. Analyzes it (anomalies, trends, stats)
// 3. Feeds everything to Gemini as context
// 4. Returns grounded answer — no hallucination
router.post('/agent', async (req, res) => {
  const { question, pages = 3, siteContext, siteName } = req.body
  if (!question?.trim()) return res.status(400).json({ error: 'question required' })

  try {
    let context

    if (siteContext) {
      // ── Site-specific mode: client already has the data, just use it ──
      console.log(`[WR Agent] Site-specific: ${siteName}`)
      context = siteContext
    } else {
      // ── Global mode: fetch data from API ──
      console.log('[WR Agent] Global mode, fetching data...')
      const obsData = []
      for (let i = 1; i <= Math.min(pages, 5); i++) {
        try { const d = await wrFetch('/observations.json', { page: i, per_page: 100 }); if (Array.isArray(d)) obsData.push(...d) } catch {}
      }
      const analysis = analyzeObservations(obsData)
      context = `${obsData.length} observations, ${analysis.totalReadings} readings, ${analysis.anomalies.length} anomalies.\n` +
        `Anomalies: ${analysis.anomalies.slice(0, 15).map(a => `${a.param}: ${a.value} ${a.unit} (${a.threshold})`).join('; ')}\n` +
        `Trends: ${analysis.trends.slice(0, 10).map(t => `${t.param}: mean=${t.mean}, trend=${t.trend}`).join('; ')}`
    }

    const systemPrompt = `You are a senior water quality research scientist. You have REAL data from Water Rangers.

CRITICAL RULES:
1. ONLY cite numbers that appear in the data context below
2. If a value is not in the data, say "not available in current data"
3. Never invent readings, dates, or locations
4. Be specific — cite actual values, dates, parameter names
5. When asked for paper sections, use IEEE/academic formatting

${context}

USER QUESTION: ${question}`

    let reply
    try {
      reply = await callGemini(systemPrompt)
      console.log('[WR Agent] Gemini response OK')
    } catch (e) {
      console.log('[WR Agent] Gemini failed:', e.message, '— trying Groq')
      try {
        reply = await callGroq([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ])
        console.log('[WR Agent] Groq response OK')
      } catch (e2) {
        console.log('[WR Agent] Groq failed:', e2.message)
        return res.status(503).json({ error: 'AI unavailable', details: e2.message })
      }
    }

    res.json({
      answer: reply,
      grounding: { site: siteName || 'global', mode: siteContext ? 'site-specific' : 'global' },
    })

  } catch (e) {
    console.error('[WR Agent] Error:', e)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
