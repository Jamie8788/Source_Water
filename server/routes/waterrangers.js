/**
 * Water Rangers API Proxy
 * Forwards requests to data.waterrangers.com to avoid CORS issues
 * API key stored server-side for security
 */
const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')

const WR_BASE = 'https://data.waterrangers.com'
const API_KEY = process.env.WATERRANGERS_API_KEY || process.env.VITE_WATERRANGERS_API_KEY

// ── AI GUARDRAIL (WetLab / Research-AI tab ONLY) ────────────────────────────
// A universal per-USER daily cap so 500 users can't run up an AI bill. The
// count lives in Postgres (table ai_usage), keyed by the logged-in user id —
// NOT the browser and NOT the IP. That means it holds across every tab, device,
// browser and network the same account signs in from, and survives instance
// restarts. The AI Lab is login-gated, so every caller has a real user id.
// Configurable via AI_DAILY_LIMIT (default 5). Provider-agnostic: the same
// guardrail protects free AI today and paid AI later — only AI_DAILY_LIMIT /
// AI_PROVIDER change. Applies ONLY to POST /api/wr/agent.
const AI_DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT || '5', 10)
const AI_LIMIT_MSG = `💧 You've used all ${AI_DAILY_LIMIT} of your daily drops (AI research questions). This limit keeps the assistant free and fast for everyone. The Charts, Trends and Anomaly tabs still work with no limit — your drops refill tomorrow.`

const utcDay = () => new Date().toISOString().slice(0, 10)

// Atomically reserve one drop for this user today. Returns { allowed, count,
// remaining, limit }. The ON CONFLICT ... WHERE count < limit makes the check
// and increment a single atomic statement, so concurrent tabs can't slip past.
async function reserveDrop(userId, limit = AI_DAILY_LIMIT) {
  const date = utcDay()
  const row = await db.get(
    `INSERT INTO ai_usage (user_id, usage_date, count) VALUES (?, ?, 1)
     ON CONFLICT (user_id, usage_date)
       DO UPDATE SET count = ai_usage.count + 1
       WHERE ai_usage.count < ?
     RETURNING count`,
    [String(userId), date, limit]
  )
  if (row && row.count != null) {
    return { allowed: true, count: row.count, remaining: Math.max(0, limit - row.count), limit }
  }
  // No row returned → already at the cap. Read current count for display.
  const cur = await db.get(`SELECT count FROM ai_usage WHERE user_id = ? AND usage_date = ?`, [String(userId), date])
  return { allowed: false, count: cur?.count ?? limit, remaining: 0, limit }
}

// Give a drop back — used when the AI itself fails, so an outage never costs
// the user one of their daily questions.
async function refundDrop(userId) {
  try {
    await db.run(`UPDATE ai_usage SET count = CASE WHEN count > 0 THEN count - 1 ELSE 0 END WHERE user_id = ? AND usage_date = ?`,
      [String(userId), utcDay()])
  } catch (e) { console.log('[WR Agent] refundDrop failed:', e.message) }
}

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
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
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
    // Groq retired the llama-3.x chat models; this account's live model list
    // (see /api/wr/ai-health) offers openai/gpt-oss-120b as the strongest free
    // general chat model. Override with GROQ_MODEL if the roster changes again.
    body: JSON.stringify({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b', messages, max_tokens: 2048, temperature: 0.3 }),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'No response'
}

// ── Anthropic (Claude) — enable later with ANTHROPIC_API_KEY + AI_PROVIDER=anthropic ──
async function callAnthropic(messages) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  const system = messages.find(m => m.role === 'system')?.content || ''
  const chat = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }))
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest', max_tokens: 1200, system, messages: chat }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const data = await res.json()
  return data.content?.[0]?.text || 'No response'
}

// ── OpenAI — enable later with OPENAI_API_KEY + AI_PROVIDER=openai ──
async function callOpenAI(messages) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', max_tokens: 1200, temperature: 0.3, messages }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'No response'
}

// ── xAI (Grok) — your key (starts with xai-). Set XAI_API_KEY + AI_PROVIDER=xai.
//    xAI's API is OpenAI-compatible, so the same message shape works. ──
async function callXAI(messages) {
  const key = process.env.XAI_API_KEY
  if (!key) throw new Error('XAI_API_KEY not set')
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.XAI_MODEL || 'grok-2-latest', max_tokens: 1200, temperature: 0.3, messages }),
  })
  if (!res.ok) throw new Error(`xAI ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'No response'
}

// ── Pollinations — FREE, no key, no credits. The permanent safety net so the
//    assistant is NEVER fully down and NEVER burns paid credits at 500 users. ──
async function callPollinationsFree(messages) {
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai', messages, max_tokens: 1024, temperature: 0.4 }),
  })
  if (!res.ok) throw new Error(`Pollinations ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'No response'
}

// ── Universal provider adapter — flip AI_PROVIDER to switch, no code change.
//    Values: 'auto' (default), 'anthropic', 'openai', 'xai', 'groq', 'gemini'.
//    KEY-AWARE: providers with no key configured are skipped, so we never
//    waste a call (or an error) on a provider that can't possibly answer.
//    Whatever key you paste in Render just starts working — no AI_PROVIDER
//    needed. 'auto' tries the FREE tiers first (Groq → Gemini) to protect
//    paid credits at 500 users, with Grok/Claude/OpenAI as premium backups.
async function askLLM(systemPrompt, question) {
  const provider = (process.env.AI_PROVIDER || 'auto').toLowerCase()
  const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: question }]

  // Which providers actually have a key right now.
  const has = {
    groq: !!GROQ_KEY,
    gemini: !!GEMINI_KEY,
    xai: !!process.env.XAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
  }

  // Preference order by AI_PROVIDER. Every case still falls through to the
  // free workhorses (groq, gemini) so one provider dying never takes the
  // assistant fully down.
  const preference =
    provider === 'anthropic' ? ['anthropic', 'groq', 'gemini', 'xai'] :
    provider === 'openai'    ? ['openai', 'groq', 'gemini', 'xai'] :
    provider === 'xai'       ? ['xai', 'groq', 'gemini'] :
    provider === 'gemini'    ? ['gemini', 'groq', 'xai'] :
    provider === 'groq'      ? ['groq', 'gemini', 'xai'] :
    /* auto */                 ['groq', 'gemini', 'xai', 'anthropic', 'openai']

  // Skip providers with no key, then always append pollinations as the free
  // last-ditch net (flaky lately — may 402 — but costs nothing to try).
  const order = [...preference.filter(p => has[p]), 'pollinations']

  // Cap each provider at 22s so a CPU-starved free instance fails over to the
  // next provider (or a clean friendly error) instead of hanging ~30s.
  const withTimeout = (promise, ms = 22000) => Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms)),
  ])
  let lastErr
  for (const p of order) {
    try {
      if (p === 'groq') return { text: await withTimeout(callGroq(messages)), provider: 'groq' }
      if (p === 'gemini') return { text: await withTimeout(callGemini(systemPrompt)), provider: 'gemini' }
      if (p === 'xai') return { text: await withTimeout(callXAI(messages)), provider: 'xai' }
      if (p === 'anthropic') return { text: await withTimeout(callAnthropic(messages)), provider: 'anthropic' }
      if (p === 'openai') return { text: await withTimeout(callOpenAI(messages)), provider: 'openai' }
      if (p === 'pollinations') return { text: await withTimeout(callPollinationsFree(messages), 15000), provider: 'pollinations(free)' }
    } catch (e) { lastErr = e; console.log(`[WR Agent] ${p} failed: ${e.message}`) }
  }
  throw lastErr || new Error('no AI provider available')
}

// POST /api/wr/agent — AI Research Agent
// 1. Fetches real-time Water Rangers data
// 2. Analyzes it (anomalies, trends, stats)
// 3. Feeds everything to Gemini as context
// 4. Returns grounded answer — no hallucination
router.post('/agent', requireAuth, async (req, res) => {
  const { question, pages = 3, siteContext, siteName } = req.body
  if (!question?.trim()) return res.status(400).json({ error: 'question required' })

  // ── Per-user daily guardrail (Postgres-backed). Reserve one drop up front;
  //    if the user is at their cap, refuse before spending any AI. ──
  const userId = req.user?.id
  let drop
  try {
    drop = await reserveDrop(userId)
  } catch (e) {
    console.error('[WR Agent] reserveDrop failed:', e.message)
    drop = { allowed: true, remaining: null, limit: AI_DAILY_LIMIT } // fail-open on DB hiccup, never block a paying feature
  }
  if (drop && drop.allowed === false) {
    return res.status(429).json({
      error: 'daily_limit',
      answer: AI_LIMIT_MSG,
      quota: { limit: drop.limit, remaining: 0, used: drop.count },
    })
  }

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

    let result
    try {
      result = await askLLM(systemPrompt, question)
      console.log(`[WR Agent] ${result.provider} response OK`)
    } catch (e) {
      console.log('[WR Agent] all AI providers failed:', e.message)
      // The AI never answered — give the reserved drop back so an outage
      // doesn't cost the user one of their daily questions.
      await refundDrop(userId)
      return res.status(503).json({
        error: 'AI unavailable',
        answer: 'The research assistant is momentarily unavailable — the AI service did not respond. Your site data, charts, anomalies and trends all still work; please try the assistant again in a minute. (This attempt did not use one of your drops.)',
        details: e.message,
      })
    }

    // Real per-user quota straight from the DB reservation above.
    res.json({
      answer: result.text,
      provider: result.provider,
      grounding: { site: siteName || 'global', mode: siteContext ? 'site-specific' : 'global' },
      quota: {
        limit: drop?.limit ?? AI_DAILY_LIMIT,
        used: drop?.count ?? null,
        remaining: drop?.remaining ?? null,
      },
    })

  } catch (e) {
    console.error('[WR Agent] Error:', e)
    // Unexpected server error after reserving — refund so a crash isn't charged.
    await refundDrop(userId)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/wr/my-drops — the logged-in user's real remaining drops for today,
// so the UI shows the correct number the moment the tab opens (on any device),
// not just after the first question.
router.get('/my-drops', requireAuth, async (req, res) => {
  try {
    const cur = await db.get(`SELECT count FROM ai_usage WHERE user_id = ? AND usage_date = ?`, [String(req.user.id), utcDay()])
    const used = cur?.count ?? 0
    res.json({ limit: AI_DAILY_LIMIT, used, remaining: Math.max(0, AI_DAILY_LIMIT - used) })
  } catch (e) {
    res.json({ limit: AI_DAILY_LIMIT, used: null, remaining: null, error: e.message })
  }
})

// ── Water Rangers test-page slugs (their public education pages live at
//    waterrangers.com/testkits/tests/<slug>/). Used for the "Learn more" link
//    and the best-effort live prose fetch below. Unknown params fall back to a
//    slug derived from the label; a wrong slug just 404s and we degrade to the
//    app's own plain-English layer — nothing breaks. ──
const WR_TEST_SLUGS = {
  oxygen: 'dissolved-oxygen', alkalinity: 'alkalinity', ph: 'ph',
  water_temperature: 'water-temperature', air_temperature: 'air-temperature',
  conductivity: 'conductivity', turbidity: 'turbidity', secchi_depth: 'water-clarity',
  water_depth: 'water-depth', nitrate: 'nitrates', nitrite: 'nitrites',
  phosphate: 'phosphates', total_phosphorus: 'phosphorus', chloride: 'chloride',
  salinity: 'salinity', hardness: 'hardness', tds: 'total-dissolved-solids',
  ammonia: 'ammonia', e_coli: 'e-coli', total_coliform: 'coliforms', flow: 'flow-rate',
}
function wrSlugFor(name) {
  const key = String(name || '').toLowerCase().trim().replace(/\s+/g, '_')
  return WR_TEST_SLUGS[key] || key.replace(/_/g, '-')
}

// 24h cache for the scraped WR education prose (separate from the 5-min data cache).
const wrGuideCache = new Map()
const WR_GUIDE_TTL = 24 * 60 * 60 * 1000

// ── GET /api/wr/param-guide?name=<parameter> — BEST-EFFORT. Fetches Water
//    Rangers' own test-page prose (What is it / Why important / What does it
//    mean / How to test) server-side, where egress to their site is allowed.
//    Always returns 200 with { ok: true, guide } or { ok: false } — never
//    throws to the client, so the UI can safely fall back to its own layer. ──
router.get('/param-guide', async (req, res) => {
  const name = req.query.name
  if (!name) return res.json({ ok: false, reason: 'no name' })
  const slug = wrSlugFor(name)
  const cached = wrGuideCache.get(slug)
  if (cached && Date.now() - cached.at < WR_GUIDE_TTL) return res.json(cached.payload)

  const url = `https://www.waterrangers.com/testkits/tests/${slug}/`
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'SourceWater/1.0' } })
    clearTimeout(timer)
    if (!r.ok) throw new Error(`WR ${r.status}`)
    const html = await r.text()

    // Strip tags to plain text, decode entities (incl. numeric curly quotes /
    // en-dashes), then pull sections by heading.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ').trim()
    const between = (startRe, endRes) => {
      const m = text.match(startRe)
      if (!m) return null
      const from = m.index + m[0].length
      let to = text.length
      for (const e of endRes) { const em = text.slice(from).search(e); if (em >= 0) to = Math.min(to, from + em) }
      const seg = text.slice(from, to).trim()
      return seg.length > 8 ? seg.slice(0, 750) : null
    }
    // WR headings are parameter-specific — "What is dissolved oxygen?",
    // "Why is X important?", "What impacts X levels?", "What does a X
    // measurement mean?" — so match the SHAPE, not fixed words.
    const H = {
      what:    /What is\s+[^?]{2,45}\?/i,
      why:     /Why is\s+[^?]{2,45}important\?/i,
      impacts: /What impacts\s+[^?]{2,45}\?/i,
      means:   /What does\s+[^?]{2,60}mean\?/i,
      common:  /Some common values/i,
      howto:   /How to test/i,
      watch:   /Watch the protocol/i,
      learn:   /Learn more/i,
    }
    const guide = {
      whatIsIt:     between(H.what,    [H.why, H.impacts, H.means, H.common, H.howto, H.watch]),
      whyImportant: between(H.why,     [H.impacts, H.means, H.common, H.howto, H.watch, H.learn]),
      whatImpacts:  between(H.impacts, [H.means, H.common, H.howto, H.watch, H.learn]),
      whatItMeans:  between(H.means,   [H.common, H.howto, H.watch, H.learn]),
      url,
    }
    const ok = !!(guide.whatIsIt || guide.whyImportant || guide.whatItMeans || guide.whatImpacts)
    // Debug mode (?debug=1): return a sample of the cleaned text so we can see
    // WR's real page structure and fix the parser. Not cached.
    if (req.query.debug) {
      return res.json({ ok, url, textLength: text.length, textSample: text.slice(0, 3500), parsed: guide })
    }
    const payload = ok ? { ok: true, source: 'waterrangers.com', guide } : { ok: false, reason: 'no sections parsed', url }
    wrGuideCache.set(slug, { at: Date.now(), payload })
    res.json(payload)
  } catch (e) {
    const payload = { ok: false, reason: e.message, url }
    // Cache negatives briefly (5 min) so a blocked/500 site isn't hammered.
    wrGuideCache.set(slug, { at: Date.now() - (WR_GUIDE_TTL - 5 * 60 * 1000), payload })
    res.json(payload)
  }
})

// ── GET /api/wr/ai-health — diagnostic. Open this in a browser to see, in
//    plain language, which AI providers actually work right now, which keys
//    are set (booleans only — never the secret), and the current provider
//    order. Turns "AI still broken??" into an exact answer. Safe, read-only. ──
router.get('/ai-health', async (req, res) => {
  const withTimeout = (p, ms) => Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms)),
  ])
  const probe = async (name, fn) => {
    const t0 = Date.now()
    try {
      const text = await withTimeout(fn(), 12000)
      return { provider: name, ok: true, ms: Date.now() - t0, sample: String(text).slice(0, 40) }
    } catch (e) {
      return { provider: name, ok: false, ms: Date.now() - t0, error: e.message }
    }
  }
  const ping = [{ role: 'user', content: 'Reply with the single word: OK' }]
  const results = []
  if (GROQ_KEY) results.push(await probe('groq', () => callGroq(ping)))
  if (GEMINI_KEY) results.push(await probe('gemini', () => callGemini('Reply with the single word: OK')))
  if (process.env.XAI_API_KEY) results.push(await probe('xai', () => callXAI(ping)))
  if (process.env.ANTHROPIC_API_KEY) results.push(await probe('anthropic', () => callAnthropic(ping)))
  if (process.env.OPENAI_API_KEY) results.push(await probe('openai', () => callOpenAI(ping)))

  // Ask each account which models it actually allows — the definitive fix for
  // 404s. This lists real, usable model IDs for THESE keys so we stop guessing.
  const available = {}
  if (GROQ_KEY) {
    try {
      const r = await withTimeout(fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${GROQ_KEY}` },
      }), 12000)
      available.groq = r.ok
        ? (await r.json()).data?.map(m => m.id).sort()
        : { httpStatus: r.status, body: (await r.text()).slice(0, 300) }
    } catch (e) { available.groq = { error: e.message } }
  }
  if (GEMINI_KEY) {
    try {
      const r = await withTimeout(fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`), 12000)
      available.gemini = r.ok
        ? (await r.json()).models?.filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => m.name.replace('models/', '')).filter(n => /flash|pro/.test(n)).sort()
        : { httpStatus: r.status, body: (await r.text()).slice(0, 300) }
    } catch (e) { available.gemini = { error: e.message } }
  }

  const working = results.filter(r => r.ok).map(r => r.provider)
  res.json({
    summary: working.length
      ? `✅ Working now: ${working.join(', ')}. The AI Lab will answer.`
      : `❌ No provider answered. Look at "availableModels" for the model IDs your keys actually allow, and "results" for the exact error.`,
    aiProvider: process.env.AI_PROVIDER || 'auto',
    keysPresent: {
      GROQ_API_KEY: !!GROQ_KEY,
      GEMINI_API_KEY: !!GEMINI_KEY,
      XAI_API_KEY: !!process.env.XAI_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    },
    modelsTried: {
      groq: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      gemini: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    },
    availableModels: available,
    results,
    note: '"availableModels" is the real list your keys can use. If groq/gemini there is an object with httpStatus 401, the KEY is invalid/revoked. If it is a list of IDs but our modelsTried is not in it, the MODEL name is the problem — set GROQ_MODEL / GEMINI_MODEL to one from the list (or tell Claude and it will bake it in).',
  })
})

module.exports = router
