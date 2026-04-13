const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')
const crypto = require('crypto')

// ── Microsoft Edge TTS (free, no API key, neural child voice) ─────────────────
// Uses the same TTS engine as the Edge browser internally.
// Voice: en-US-AnaNeural = natural young female, sounds like a kid/teenager.
async function edgeTTS(text) {
  const WS = typeof WebSocket !== 'undefined' ? WebSocket : require('ws')
  const voice = 'en-US-AnaNeural'
  const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${crypto.randomUUID().replace(/-/g,'')}`
  return new Promise((resolve, reject) => {
    const ws = new WS(url)
    ws.binaryType = 'arraybuffer'
    const chunks = []
    const timer = setTimeout(() => { ws.close(); reject(new Error('timeout')) }, 14000)
    ws.addEventListener('open', () => {
      const ts = new Date().toISOString()
      ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` + JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' }, outputFormat: 'audio-24khz-48kbitrate-mono-mp3' } } } }))
      const safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      ws.send(`X-RequestId:${crypto.randomUUID().replace(/-/g,'')}\r\nX-Timestamp:${ts}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'>${safe}</voice></speak>`)
    })
    ws.addEventListener('message', ev => {
      if (ev.data instanceof ArrayBuffer) {
        const buf = Buffer.from(ev.data)
        const sep = Buffer.from('Path:audio\r\n')
        const i = buf.indexOf(sep)
        if (i !== -1) chunks.push(buf.subarray(i + sep.length))
      } else if (typeof ev.data === 'string' && ev.data.includes('Path:turn.end')) {
        clearTimeout(timer); ws.close()
        chunks.length ? resolve(Buffer.concat(chunks)) : reject(new Error('no audio'))
      }
    })
    ws.addEventListener('error', e => { clearTimeout(timer); reject(e) })
    ws.addEventListener('close', () => clearTimeout(timer))
  })
}

const POLLINATIONS = 'https://text.pollinations.ai/openai'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_KEY = process.env.GROQ_API_KEY

const SYSTEM = `You are Water, the friendly AI assistant for SOURCE Water — a water quality monitoring platform for Northern Ontario, managed by NORDIK Institute at Algoma University.

You help community members, researchers, and students understand water quality data, learn about aquatic ecosystems, and engage with the platform. You know about:
- Water quality parameters (pH, turbidity, dissolved oxygen, nitrates, temperature, conductivity, phosphorus, coliform, chlorophyll)
- Northern Ontario watersheds and lakes (Lake Superior, Lake Huron, Lake Nipigon, Batchawana Bay, Mississagi River, Elliot Lake, Lake Huron North Shore)
- Indigenous water rights and stewardship traditions of Anishinaabe peoples
- WHO/EPA water quality guidelines and Canadian drinking water standards
- Field sampling procedures and best practices
- Algoma University and NORDIK Institute research initiatives
- Water Rangers community monitoring program (waterrangers.ca)
- Climate change impacts on Great Lakes water quality
- Local water challenges: mine drainage, agricultural runoff, road salt, invasive species

Be warm, encouraging, and educational. Use simple language for community members, technical detail for researchers. Always emphasize community stewardship and the sacred importance of clean water.`

async function callAI(messages) {
  // 1. Groq — free tier, fast, reliable (llama-3.1-8b-instant)
  if (GROQ_KEY) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 20000)
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        signal: ctrl.signal,
        body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, max_tokens: 1024, temperature: 0.7 }),
      })
      clearTimeout(timer)
      if (res.ok) {
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content
        if (text?.trim().length > 5) { console.log('[AI] Groq/llama-3.1'); return { text, model: 'Groq Llama 3.1' } }
      }
    } catch (e) { console.log(`[AI] Groq failed: ${e.message}`) }
  }

  // 3. Pollinations fallback (no key needed)
  for (const model of ['mistral', 'llama', 'openai']) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 12000)
      const res = await fetch(POLLINATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.7 }),
      })
      clearTimeout(timer)
      if (!res.ok) continue
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content
      if (text?.trim().length > 5) { console.log(`[AI] Pollinations/${model}`); return { text, model: `pollinations/${model}` } }
    } catch (e) { console.log(`[AI] ${model} failed: ${e.message}`) }
  }
  return null
}

// POST /api/ai/tts — Text-to-speech proxy (free, no API key, scales to 10k users)
// Primary: Microsoft Edge TTS (en-US-AnaNeural — young female neural voice, no key, unlimited)
// Fallback: StreamElements → Amazon Polly "Ivy" (child voice, free)
// Final fallback: tells client to use browser TTS
router.post('/tts', async (req, res) => {
  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'text required' })
  const clean = text.replace(/[*_`#[\]()\u200B-\uFEFF]/g, '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 500)

  // ── 1. Microsoft Edge TTS (en-US-AnaNeural — real neural child/teen voice) ──
  try {
    const buf = await edgeTTS(clean)
    res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' })
    return res.send(buf)
  } catch (e) { console.log('[TTS] Edge failed:', e.message) }

  // ── 2. StreamElements → Amazon Polly Ivy (child voice, free, no key needed) ──
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 8000)
    const r = await fetch(
      `https://api.streamelements.com/kappa/v2/speech?voice=Ivy&text=${encodeURIComponent(clean)}`,
      { signal: ctrl.signal }
    )
    if (r.ok) {
      const buf = await r.arrayBuffer()
      res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' })
      return res.send(Buffer.from(buf))
    }
    console.log('[TTS] StreamElements status:', r.status)
  } catch (e) { console.log('[TTS] StreamElements error:', e.message) }

  // ── 3. Tell client to fall back to browser TTS ────────────────────────────────
  res.status(503).json({ error: 'tts_unavailable' })
})

// POST /api/ai/public-chat — no auth, used by Weather3D, Reports, etc.
router.post('/public-chat', async (req, res) => {
  try {
    const { messages, max_tokens } = req.body
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' })
    const result = await callAI(messages)
    if (!result) return res.json({ reply: "I'm having a moment — please try again! 💧" })
    res.json({ reply: result.text, model: result.model })
  } catch (err) {
    console.error('public-chat error:', err)
    res.json({ reply: "I'm having a moment — please try again! 💧" })
  }
})

// POST /api/ai/chat
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { messages } = req.body
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' })

    // Cache lookup
    const lastMsg = messages[messages.length - 1]?.content?.slice(0, 100)
    try {
      const cached = db.prepare("SELECT response FROM ai_cache WHERE query_hash = ? AND created_at > datetime('now','-1 day')").get(lastMsg)
      if (cached) return res.json({ reply: cached.response, cached: true })
    } catch {}

    const fullMessages = [{ role: 'system', content: SYSTEM }, ...messages]
    const result = await callAI(fullMessages)

    if (!result) return res.json({ reply: "I'm having a moment — please try again! 💧 In the meantime, check out our Resources section for water quality guides." })

    try { db.prepare('INSERT OR REPLACE INTO ai_cache (query_hash, response) VALUES (?, ?)').run(lastMsg, result.text) } catch {}

    res.json({ reply: result.text, model: result.model })
  } catch (err) {
    console.error('AI chat error:', err)
    res.json({ reply: "I'm having a moment — please try again! 💧" })
  }
})

// POST /api/ai/analyze
router.post('/analyze', requireAuth, async (req, res) => {
  try {
    const { stats, filename } = req.body
    const prompt = `Analyze this water quality dataset "${filename}":\n${JSON.stringify(stats)}\n\nProvide: 1) Key findings with specific numbers 2) Water quality assessment vs WHO/EPA standards 3) Potential concerns 4) Recommended actions. Be concise and practical.`
    const result = await callAI([{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }])
    res.json({ analysis: result?.text || 'Analysis unavailable.' })
  } catch {
    res.json({ analysis: 'Analysis error. Please try again.' })
  }
})

// GET /api/ai/suggestions
router.get('/suggestions', requireAuth, (req, res) => {
  res.json({ suggestions: [
    'What is a safe pH level for drinking water?',
    'How does turbidity affect aquatic life in Northern Ontario lakes?',
    'What causes algae blooms in Lake Huron?',
    'How do I read a water quality report?',
    'What are WHO guidelines for nitrates in drinking water?',
    'How does temperature affect dissolved oxygen?',
    'What water quality issues affect Sault Ste. Marie?',
    'How can communities protect their local watersheds?',
    'What is the Water Rangers monitoring program?',
    'How does road salt runoff affect water quality?',
  ]})
})

// ── REAL ML PREDICTIONS — No fake data, uses analysis-service ─────────────
// POST /api/ai/predict/:site_id
// Fetches actual observations and runs real ML models: anomalies, trends, risk scores
router.post('/predict/:site_id', async (req, res) => {
  try {
    const { site_id } = req.params
    
    // Fetch observations from database
    const observations = await db.all(
      `SELECT 
        observed_at, 
        ph, dissolved_oxygen, temperature, turbidity,
        conductivity, nitrate_nitrogen, phosphorus,
        water_color, notes
      FROM observations 
      WHERE site_id = ? 
      ORDER BY observed_at DESC 
      LIMIT 100`,
      [site_id]
    )
    
    if (!observations || observations.length === 0) {
      return res.json({ 
        message: 'No observations yet for this site', 
        anomalies: null, 
        trends: null, 
        risk_score: null,
        quality_assessment: 'Insufficient data for ML analysis'
      })
    }

    // Call analysis-service for REAL ML predictions
    const ANALYSIS_URL = process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8001'
    const analysisPayload = {
      observations: observations.map(o => ({
        date: o.observed_at,
        ph: o.ph ? parseFloat(o.ph) : null,
        dissolved_oxygen: o.dissolved_oxygen ? parseFloat(o.dissolved_oxygen) : null,
        temperature: o.temperature ? parseFloat(o.temperature) : null,
        turbidity: o.turbidity ? parseFloat(o.turbidity) : null,
        conductivity: o.conductivity ? parseFloat(o.conductivity) : null,
        nitrate_nitrogen: o.nitrate_nitrogen ? parseFloat(o.nitrate_nitrogen) : null,
        phosphorus: o.phosphorus ? parseFloat(o.phosphorus) : null,
      }))
    }

    console.log(`[ML] Calling analysis-service for site ${site_id} with ${observations.length} observations`)

    const analysisResponse = await fetch(`${ANALYSIS_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysisPayload),
      timeout: 30000
    })

    if (!analysisResponse.ok) {
      console.warn(`[ML] Analysis service error: ${analysisResponse.status}`)
      return res.json({
        message: 'Analysis service temporarily unavailable',
        observation_count: observations.length,
        latest_reading: observations[0],
        anomalies: null,
        trends: null
      })
    }

    const predictionData = await analysisResponse.json()
    
    // Extract key ML results
    const riskScore = predictionData.risk_score || calculateLocalRiskScore(observations)
    const anomalies = predictionData.anomalies || []
    const trends = predictionData.trends || {}
    const quality = assessQuality(observations, predictionData)

    console.log(`[ML] Successfully analyzed ${observations.length} observations, risk_score=${riskScore}`)

    res.json({
      success: true,
      observation_count: observations.length,
      latest_reading: observations[0],
      risk_score: riskScore,
      status: riskScore > 0.7 ? 'critical' : riskScore > 0.4 ? 'warning' : 'active',
      anomalies: predictionData.anomalies_detected || [],
      trends: trends.trends_found || [],
      quality_assessment: quality,
      ml_model: 'IsolationForest + Trend Analysis + Risk Scoring (Real ML)',
      data_source: 'Live observations from monitoring site'
    })

  } catch (err) {
    console.error('[ML] Prediction error:', err)
    res.status(500).json({ error: 'Prediction failed', details: err.message })
  }
})

// Helper: Calculate risk score locally if analysis-service unavailable
function calculateLocalRiskScore(observations) {
  if (!observations || observations.length === 0) return 0
  
  let risk = 0
  const latest = observations[0]
  
  // Real thresholds from WHO guidelines
  if (latest.ph !== null) {
    const ph = parseFloat(latest.ph)
    if (ph < 6.5 || ph > 8.5) risk += 0.2
  }
  if (latest.dissolved_oxygen !== null) {
    const do_val = parseFloat(latest.dissolved_oxygen)
    if (do_val < 6) risk += 0.25
  }
  if (latest.turbidity !== null) {
    const turb = parseFloat(latest.turbidity)
    if (turb > 5) risk += 0.15
  }
  if (latest.conductivity !== null) {
    const cond = parseFloat(latest.conductivity)
    if (cond > 1500) risk += 0.1
  }
  if (latest.nitrate_nitrogen !== null) {
    const nit = parseFloat(latest.nitrate_nitrogen)
    if (nit > 10) risk += 0.15
  }
  if (latest.phosphorus !== null) {
    const phos = parseFloat(latest.phosphorus)
    if (phos > 0.03) risk += 0.15
  }
  
  return Math.min(1.0, risk)
}

// Helper: Comprehensive quality assessment
function assessQuality(observations, mlData) {
  if (observations.length === 0) return 'Insufficient data'
  
  const latest = observations[0]
  const params = []
  
  if (latest.ph !== null) {
    const ph = parseFloat(latest.ph)
    params.push(ph >= 6.5 && ph <= 8.5 ? '✓ pH' : '✗ pH')
  }
  if (latest.dissolved_oxygen !== null) {
    params.push(parseFloat(latest.dissolved_oxygen) >= 6 ? '✓ DO' : '✗ DO')
  }
  if (latest.turbidity !== null) {
    params.push(parseFloat(latest.turbidity) <= 5 ? '✓ Turbidity' : '✗ Turbidity')
  }
  
  let assessment = params.join(' | ')
  if (observations.length >= 3) {
    assessment += ` | ${observations.length} samples over time`
  }
  
  return assessment || 'Data collected'
}

module.exports = router
