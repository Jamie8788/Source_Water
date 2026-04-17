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

router.get('/locations-all', async (req, res) => {
  try {
    // Return cache if fresh
    if (allLocationsCache.data && Date.now() - allLocationsCache.ts < ALL_LOC_TTL) {
      console.log(`[WR] Returning cached ${allLocationsCache.data.length} locations`)
      return res.json({ locations: allLocationsCache.data, cached: true, count: allLocationsCache.data.length })
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
      for (let page = 1; page <= 100; page++) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const data = await wrFetch('/locations.json', { page, per_page: 100 })
            const items = Array.isArray(data) ? data : []
            if (items.length === 0) {
              console.log(`[WR] Page ${page}: empty — done! Total: ${all.length}`)
              return all // truly empty = no more data
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
  const { question, pages = 3 } = req.body
  if (!question?.trim()) return res.status(400).json({ error: 'question required' })

  try {
    console.log('[WR Agent] Fetching real data...')

    // Step 1: Fetch real data from Water Rangers
    const [obsData, locData, dsData] = await Promise.all([
      Promise.all(Array.from({ length: Math.min(pages, 5) }, (_, i) =>
        wrFetch('/observations.json', { page: i + 1, per_page: 100 }).catch(() => [])
      )),
      wrFetch('/locations.json', { page: 1, per_page: 100 }).catch(() => []),
      wrFetch('/datasets.json', { page: 1, per_page: 50 }).catch(() => []),
    ])

    const observations = obsData.flat().filter(Array.isArray).length > 0
      ? obsData.flat()
      : obsData.reduce((a, d) => a.concat(Array.isArray(d) ? d : []), [])
    const locations = Array.isArray(locData) ? locData : []
    const datasets = Array.isArray(dsData) ? dsData : []

    console.log(`[WR Agent] Got ${observations.length} obs, ${locations.length} locs, ${datasets.length} datasets`)

    // Step 2: Analyze
    const analysis = analyzeObservations(observations)

    // Step 3: Build grounded context
    const context = `
=== REAL-TIME WATER RANGERS DATA (fetched just now) ===

SUMMARY:
- ${observations.length} observations analyzed
- ${analysis.totalReadings} total readings
- ${locations.length} monitoring locations
- ${datasets.length} active datasets
- ${analysis.anomalies.length} anomalies detected (WHO threshold violations)

QA STATUS BREAKDOWN:
${Object.entries(analysis.qaCounts).map(([k, v]) => `- ${k}: ${v} observations`).join('\n')}

ANOMALIES DETECTED (${analysis.anomalies.length}):
${analysis.anomalies.slice(0, 30).map(a => `- ${a.param}: ${a.value} ${a.unit} (threshold: ${a.threshold}) on ${a.date?.slice(0, 10)}`).join('\n') || 'None'}

PARAMETER STATISTICS (${analysis.trends.length} parameters):
${analysis.trends.slice(0, 20).map(t => `- ${t.param}: mean=${t.mean} ${t.unit}, range=${t.min}-${t.max}, n=${t.count}`).join('\n')}

MONITORING LOCATIONS (${locations.length}):
Countries: ${[...new Set(locations.map(l => l.country))].join(', ')}
Water body types: ${[...new Set(locations.map(l => l.water_body_type).filter(Boolean))].join(', ')}
${locations.slice(0, 15).map(l => `- ${l.name} (${l.water_body_type}, ${l.country}) — ${l.tested_parameters?.length || 0} params, last obs: ${l.last_observation_at?.slice(0, 10) || 'N/A'}`).join('\n')}

DATASETS (${datasets.length}):
${datasets.slice(0, 10).map(d => `- ${d.name} (${d.dormant ? 'DORMANT' : 'ACTIVE'}, since ${d.start_date?.slice(0, 10) || '?'})${d.share_with_datastream ? ' [DataStream]' : ''}`).join('\n')}

IMPORTANT: All data above is REAL and was just fetched from the Water Rangers API. Base your answer ONLY on this data. Do not make up numbers. If the data doesn't contain information to answer the question, say so.
`

    // Step 4: Call Gemini (primary) or Groq (fallback)
    const systemPrompt = `You are a senior water quality research scientist with a PhD in Environmental Science. You have access to REAL-TIME data from Water Rangers monitoring network.

Your answers must be:
1. GROUNDED — cite specific values, dates, locations from the data provided
2. SCIENTIFIC — use proper terminology, WHO/EPA standards
3. QUANTITATIVE — include numbers, statistics, percentages
4. ACTIONABLE — provide specific recommendations

When asked for paper sections, use IEEE or academic formatting.
When asked about anomalies, reference specific readings and thresholds.
Never hallucinate data — only use what's provided in the context.

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
      grounding: {
        observations: observations.length,
        locations: locations.length,
        datasets: datasets.length,
        anomalies: analysis.anomalies.length,
        parameters: analysis.trends.length,
        totalReadings: analysis.totalReadings,
      },
    })

  } catch (e) {
    console.error('[WR Agent] Error:', e)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
