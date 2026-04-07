/**
 * Research Hub backend — AI vision scanning + Canadian live water data
 * POST /api/research/scan          — scan photo of handwritten field notes
 * POST /api/research/observations  — save AI-extracted observation
 * GET  /api/research/observations  — list AI-extracted observations
 * GET  /api/research/live-water    — live ECCC hydrometric data near Sault Ste. Marie
 */
const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const db = require('../db/connection')
const multer = require('multer')

const POLLINATIONS = 'https://text.pollinations.ai/openai'
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
})

const EXTRACT_PROMPT = `You are a water quality field data extractor for SOURCE Water — a Canadian environmental monitoring platform for Northern Ontario (Sault Ste. Marie / Algoma region).

Analyze this image. It may show handwritten field notes, a paper observation form, lab printout, or any document containing water quality data.

Extract EVERY parameter you can find. Return ONLY a valid JSON object — no markdown, no extra text:
{
  "date": "YYYY-MM-DD or text as written, or null",
  "time": "HH:MM or text as written, or null",
  "location": "place name or site description, or null",
  "observer": "person name if visible, or null",
  "ph": null,
  "temperature_c": null,
  "turbidity_ntu": null,
  "dissolved_oxygen_mgl": null,
  "conductivity_us_cm": null,
  "nitrates_mgl": null,
  "phosphorus_mgl": null,
  "chlorine_mgl": null,
  "hardness_mgl": null,
  "alkalinity_mgl": null,
  "tds_mgl": null,
  "water_color": null,
  "odor": null,
  "weather": null,
  "wind": null,
  "cloud_cover": null,
  "notes": "any other text, observations, or comments visible on the paper",
  "confidence": 85,
  "fields_found": ["list of parameter names that had actual values"]
}

Be generous — extract partial values, estimated numbers, descriptive values (e.g. "clear", "cloudy"). Set confidence 0-100 based on image clarity and how many fields you found.`

async function callVisionAI(messages) {
  // 1. DeepSeek Vision
  if (DEEPSEEK_KEY) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 25000)
      const resp = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
        signal: ctrl.signal,
        body: JSON.stringify({ model: 'deepseek-vl2', messages, max_tokens: 1200, temperature: 0.1 }),
      })
      clearTimeout(timer)
      if (resp.ok) {
        const data = await resp.json()
        const text = data.choices?.[0]?.message?.content
        if (text?.trim()) return { text, model: 'DeepSeek Vision' }
      }
    } catch (e) { console.log('[scan] DeepSeek failed:', e.message) }
  }

  // 2. Pollinations GPT-4o vision (no key needed)
  for (const model of ['openai-large', 'openai']) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 35000)
      const resp = await fetch(POLLINATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({ model, messages, max_tokens: 1200, temperature: 0.1 }),
      })
      clearTimeout(timer)
      if (resp.ok) {
        const data = await resp.json()
        const text = data.choices?.[0]?.message?.content
        if (text?.trim()) return { text, model: `GPT-4o Vision (${model})` }
      }
    } catch (e) { console.log(`[scan] ${model} failed:`, e.message) }
  }
  return null
}

// ── POST /scan ────────────────────────────────────────────────────────────────
router.post('/scan', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' })

    const base64 = req.file.buffer.toString('base64')
    const mime = req.file.mimetype || 'image/jpeg'

    const messages = [{
      role: 'user',
      content: [
        { type: 'text', text: EXTRACT_PROMPT },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
      ],
    }]

    const result = await callVisionAI(messages)
    if (!result) return res.status(503).json({ error: 'Vision AI unavailable — please try again' })

    // Parse JSON from AI response
    let parsed = {}
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
      else parsed = { notes: result.text, confidence: 40 }
    } catch {
      parsed = { notes: result.text, confidence: 40 }
    }

    res.json({ extracted: parsed, model: result.model })
  } catch (err) {
    console.error('[scan] error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /observations ────────────────────────────────────────────────────────
router.post('/observations', requireAuth, (req, res) => {
  try {
    const {
      location_name, ph, temperature_c, turbidity_ntu, dissolved_oxygen,
      conductivity, nitrates, phosphorus, chlorine, hardness, alkalinity, tds,
      water_color, odor, notes, observed_at, ai_model,
    } = req.body

    // Auto-create a site for the location if needed
    let siteId = req.body.site_id || null
    if (!siteId) {
      const r = db.prepare(
        `INSERT INTO sites (name, latitude, longitude, water_body_type, created_by) VALUES (?, 0, 0, 'field', ?)`
      ).run(location_name || 'Field Observation', req.user.id)
      siteId = r.lastInsertRowid
    }

    const r = db.prepare(`
      INSERT INTO observations (
        site_id, observer_id, observed_at,
        ph, water_temp, turbidity, dissolved_oxygen,
        conductivity, nitrates, phosphorus, chlorine, hardness, alkalinity, tds,
        water_color, water_odor, notes, qa_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai_extracted')
    `).run(
      siteId, req.user.id, observed_at || new Date().toISOString(),
      ph ?? null, temperature_c ?? null, turbidity_ntu ?? null,
      dissolved_oxygen ?? null, conductivity ?? null, nitrates ?? null,
      phosphorus ?? null, chlorine ?? null, hardness ?? null, alkalinity ?? null, tds ?? null,
      water_color ?? null, odor ?? null,
      `[Scanned by ${ai_model || 'AI Vision'}] ${notes || ''}`.trim()
    )

    res.json({ id: r.lastInsertRowid, site_id: siteId, success: true })
  } catch (err) {
    console.error('[obs save] error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /observations ─────────────────────────────────────────────────────────
router.get('/observations', requireAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT o.id, o.observed_at, o.ph, o.water_temp, o.turbidity,
             o.dissolved_oxygen, o.conductivity, o.nitrates, o.phosphorus,
             o.water_color, o.water_odor, o.notes, o.qa_status,
             s.name as site_name, u.display_name as observer_name
      FROM observations o
      LEFT JOIN sites s ON o.site_id = s.id
      LEFT JOIN users u ON o.observer_id = u.id
      WHERE o.qa_status = 'ai_extracted'
      ORDER BY o.observed_at DESC LIMIT 100
    `).all()
    res.json({ observations: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /live-water — ECCC hydrometric data near Sault Ste. Marie ─────────────
router.get('/live-water', async (req, res) => {
  const STATIONS = [
    { id: '02CD003', name: "St. Mary's River", location: 'Sault Ste. Marie, ON' },
    { id: '02BB022', name: 'Mississagi River',  location: 'Aubrey Falls, ON' },
    { id: '02CF007', name: 'Spanish River',     location: 'Agnew, ON' },
    { id: '02BF001', name: 'Batchawana River',  location: 'Batchawana, ON' },
  ]

  const fetchStation = async (station) => {
    try {
      const url = `https://wateroffice.ec.gc.ca/services/real_time_json.php?stations[]=${station.id}&parameters[]=46,47,5`
      const ctrl = new AbortController()
      setTimeout(() => ctrl.abort(), 8000)
      const resp = await fetch(url, { signal: ctrl.signal })
      if (!resp.ok) return { ...station, error: `HTTP ${resp.status}`, readings: [] }
      const data = await resp.json()
      // Parse ECCC response structure
      const stationData = data[station.id] || {}
      const readings = []
      for (const [paramId, paramData] of Object.entries(stationData)) {
        if (paramData?.data) {
          const latest = paramData.data[paramData.data.length - 1]
          readings.push({
            param_id: paramId,
            param_name: paramId === '46' ? 'Water Level (m)' : paramId === '47' ? 'Discharge (m³/s)' : 'Water Temp (°C)',
            value: latest?.[1],
            unit: paramId === '46' ? 'm' : paramId === '47' ? 'm³/s' : '°C',
            timestamp: latest?.[0],
          })
        }
      }
      return { ...station, readings, raw: data }
    } catch (e) {
      return { ...station, error: e.message, readings: [] }
    }
  }

  try {
    const results = await Promise.all(STATIONS.map(fetchStation))
    res.json({ stations: results, fetched_at: new Date().toISOString(), source: 'Environment and Climate Change Canada (ECCC)' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
