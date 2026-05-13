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

// Global circuit breaker — when WR returns 429 with a
// "next_request_allowed_at" timestamp, BACKGROUND callers (bulk
// locations loader, ownership enrichment) honor it so we don't burn
// the rest of our quota with retries that are guaranteed to fail.
//
// IMPORTANT: user-initiated requests (a click on a single site for
// observations, a search on a specific site) are NOT blocked by the
// breaker. The user paid the click; they deserve a real attempt and
// a real error message. Otherwise the whole app appears broken every
// time a background job exhausts the rate limit.
let wrRateLimitedUntil = 0

async function wrFetch(endpoint, query = {}, opts = {}) {
  if (!API_KEY) throw new Error('WATERRANGERS_API_KEY not set')
  const { respectBreaker = false } = opts

  // Background jobs short-circuit when the breaker is open. User
  // requests fall through and try the API directly.
  if (respectBreaker && wrRateLimitedUntil > Date.now()) {
    const waitMs = wrRateLimitedUntil - Date.now()
    throw new Error(`Water Rangers 429: rate-limited for another ${Math.ceil(waitMs / 1000)}s`)
  }

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
    // Parse next_request_allowed_at and trip the circuit breaker so
    // future BACKGROUND callers stop hammering the API. User requests
    // ignore the breaker, so they'll keep going (they may also see
    // 429 — that's an honest signal to the user, not noise).
    if (res.status === 429) {
      try {
        const j = JSON.parse(text)
        if (j?.next_request_allowed_at) {
          const t = new Date(j.next_request_allowed_at).getTime()
          if (Number.isFinite(t) && t > Date.now()) {
            wrRateLimitedUntil = t
            console.log(`[WR] rate-limit circuit OPEN until ${j.next_request_allowed_at} (${Math.ceil((t - Date.now())/1000)}s)`)
          }
        }
      } catch { /* fall through with raw text */ }
    }
    throw new Error(`Water Rangers ${res.status}: ${text || res.statusText}`)
  }

  const data = await res.json()
  cache.set(cacheKey, { data, ts: Date.now() })
  return data
}

// Convenience helper for background callers that should pause on 429.
const wrFetchBackground = (endpoint, query) => wrFetch(endpoint, query, { respectBreaker: true })

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

router.get('/locations-all', async (req, res) => {
  try {
    // Return cache if fresh AND non-empty. An empty cache (e.g. from a
    // load that ran during a hard rate-limit window) should not stick.
    if (allLocationsCache.data && allLocationsCache.data.length > 0 && Date.now() - allLocationsCache.ts < ALL_LOC_TTL) {
      console.log(`[WR] Returning cached ${allLocationsCache.data.length} locations`)
      res.json({ locations: allLocationsCache.data, cached: true, count: allLocationsCache.data.length })
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
        // CRITICAL: the bulk locations fetch is what makes the entire
        // map work. We do NOT bail on 429 here — we wait the rate-limit
        // window out and continue. If the breaker is open, sleep until
        // it closes, then resume. Better to take 2 min to load than to
        // serve a 0-site map for an hour.
        if (wrRateLimitedUntil > Date.now()) {
          const waitMs = Math.min(wrRateLimitedUntil - Date.now() + 500, 5 * 60_000)
          console.log(`[WR] bulk fetch hit rate-limit at page ${page}, waiting ${Math.ceil(waitMs / 1000)}s for breaker to close (have ${all.length} so far)`)
          await new Promise(r => setTimeout(r, waitMs))
        }
        let pageOK = false
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const data = await wrFetch('/locations.json', { page, per_page: 100 })
            const items = Array.isArray(data) ? data : []
            if (items.length === 0) {
              console.log(`[WR] Page ${page}: empty — done! Total: ${all.length}`)
              pageOK = true
              break pageLoop
            }
            all.push(...items)
            if (page % 10 === 0) console.log(`[WR] Page ${page}: total ${all.length}`)
            pageOK = true
            break
          } catch (e) {
            // 429 — wait for the deadline WR told us about, then retry.
            if (String(e.message).includes('429') || wrRateLimitedUntil > Date.now()) {
              const waitMs = Math.min((wrRateLimitedUntil - Date.now()) + 500, 5 * 60_000)
              if (waitMs > 0) {
                console.log(`[WR] Page ${page} attempt ${attempt} hit 429 — sleeping ${Math.ceil(waitMs / 1000)}s before retry`)
                await new Promise(r => setTimeout(r, waitMs))
              }
              continue
            }
            console.log(`[WR] Page ${page} attempt ${attempt} failed: ${e.message}`)
            if (attempt < 4) await new Promise(r => setTimeout(r, 1000 * attempt))
          }
        }
        // If a single page exhausted retries without 429, skip it but keep going.
        // We'd rather have 9,400 of 9,484 locations than zero.
        if (!pageOK) console.log(`[WR] Page ${page} skipped after retries`)
      }
      return all
    })()

    const all = await loadingInProgress
    loadingInProgress = null
    // CRITICAL: never cache an empty bulk response. If the WR API was
    // rate-limited the whole time and we got back 0 locations, leaving
    // the empty array in the cache poisons the next hour for every user.
    // Better to let the next request retry a fresh fetch.
    if (all.length > 0) {
      allLocationsCache = { data: all, ts: Date.now() }
      console.log(`[WR] Loaded ${all.length} total locations, cached for 1hr`)
    } else {
      console.log(`[WR] Loaded 0 locations — NOT caching empty result so next request can retry`)
    }
    res.json({ locations: all, cached: false, count: all.length })
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
// Paginates until WR stops returning a full page. The WR locations endpoint
// defaults to 20 per page when per_page isn't set, which caused us to ship
// the Locations stat tile + map markers with only 20 of (for example) 78
// real sites in County Sustainability Group. We always want every site.
router.get('/datasets/:id/locations', async (req, res) => {
  try {
    const all = []
    for (let page = 1; page <= 20; page++) {
      const data = await wrFetch(
        `/datasets/${req.params.id}/locations.json`,
        { ...req.query, per_page: 100, page }
      )
      const items = Array.isArray(data) ? data : data.locations || data.data || []
      all.push(...items)
      if (items.length < 100) break
    }
    res.json({ locations: all })
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
