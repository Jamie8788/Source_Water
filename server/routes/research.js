/**
 * Research Hub backend — Gemini 2.5 Flash vision + conversational AI + live water data
 * POST /api/research/chat         — multimodal chat (image + text, follow-ups)
 * POST /api/research/scan         — legacy structured extraction (kept for compat)
 * POST /api/research/observations — save AI-extracted observation
 * GET  /api/research/observations — list saved observations
 * GET  /api/research/live-water   — live ECCC hydrometric data
 */
const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const db = require('../db/connection')
const multer = require('multer')

const GEMINI_KEY  = process.env.GEMINI_API_KEY
const GROQ_KEY    = process.env.GROQ_API_KEY
const GEMINI_URL  = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const GROQ_URL    = 'https://api.groq.com/openai/v1/chat/completions'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const WATER_AI_SYSTEM = `You are a water quality research AI assistant for SOURCE Water — an environmental monitoring platform for Northern Ontario, Canada (Sault Ste. Marie / Algoma region), operated by NORDIK Institute at Algoma University.

You specialize in:
- Analyzing water quality images: handwritten field notes, lab printouts, test strips, water samples
- Extracting and interpreting water parameters: pH, turbidity, dissolved oxygen, temperature, nitrates, phosphorus, conductivity, chlorine, hardness, alkalinity, TDS
- Comparing values against WHO/Health Canada drinking water standards
- Assessing contamination risk, algae bloom potential, and ecosystem health
- Northern Ontario watersheds: Lake Superior, Lake Huron, Batchawana Bay, Mississagi River, Elliot Lake, St. Mary's River
- Indigenous water rights and Anishinaabe water stewardship

When analyzing an image with water quality data:
1. Extract EVERY visible parameter with its value and unit
2. Assess each against WHO/Health Canada standards (flag high/low/ok)
3. Give an overall water quality verdict and risk level
4. Note any concerns or recommended actions
5. Always include a JSON extraction block at the end wrapped in <extraction>...</extraction> tags with all found parameters

JSON extraction format:
<extraction>{"ph":7.2,"temperature_c":18.5,"turbidity_ntu":2.3,"dissolved_oxygen_mgl":8.1,"conductivity_us_cm":320,"nitrates_mgl":1.2,"phosphorus_mgl":0.02,"chlorine_mgl":null,"hardness_mgl":null,"alkalinity_mgl":null,"tds_mgl":null,"water_color":null,"odor":null,"location":null,"date":null,"observer":null,"notes":null,"confidence":85}</extraction>

For follow-up questions, be a knowledgeable, concise water quality expert. Use markdown formatting.`

// ── Gemini 2.5 Flash ──────────────────────────────────────────────────────────
async function callGemini(contents) {
  if (!GEMINI_KEY) { console.log('[gemini] No GEMINI_API_KEY set'); return null }
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 45000)
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: WATER_AI_SYSTEM }] },
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
    })
    clearTimeout(timer)
    if (!res.ok) {
      const err = await res.text()
      console.log('[gemini] HTTP error:', res.status, err.slice(0, 200))
      return null
    }
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (text?.trim()) { console.log('[gemini] OK'); return { text, model: 'Gemini 2.5 Flash' } }
  } catch (e) { console.log('[gemini] failed:', e.message) }
  return null
}

// ── Groq text fallback ────────────────────────────────────────────────────────
async function callGroq(messages) {
  if (!GROQ_KEY) return null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 20000)
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      signal: ctrl.signal,
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, max_tokens: 1024, temperature: 0.3 }),
    })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content
      if (text?.trim()) { console.log('[groq] OK'); return { text, model: 'Groq Llama 3.1' } }
    }
  } catch (e) { console.log('[groq] failed:', e.message) }
  return null
}

// ── Groq vision (legacy) ──────────────────────────────────────────────────────
async function callGroqVision(imageBase64, mime, prompt) {
  if (!GROQ_KEY) return null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 30000)
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } }] }],
        max_tokens: 1200, temperature: 0.1,
      }),
    })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content
      if (text?.trim()) { console.log('[groq-vision] OK'); return { text, model: 'Groq Llama Vision' } }
    }
  } catch (e) { console.log('[groq-vision] failed:', e.message) }
  return null
}

// ── Parse extraction JSON from AI response ────────────────────────────────────
function parseExtraction(text) {
  try {
    const xmlMatch = text.match(/<extraction>([\s\S]*?)<\/extraction>/)
    if (xmlMatch) return JSON.parse(xmlMatch[1])
  } catch {}
  try {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)```/)
    if (jsonMatch) return JSON.parse(jsonMatch[1])
  } catch {}
  try {
    const match = text.match(/\{[\s\S]*?"ph"[\s\S]*?\}/)
    if (match) return JSON.parse(match[0])
  } catch {}
  return null
}

// ── POST /chat — main multimodal chat endpoint ─────────────────────────────────
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { message, imageBase64, imageMime, history = [], extractedContext } = req.body
    if (!message) return res.status(400).json({ error: 'message required' })

    let result = null

    if (imageBase64) {
      // ── Vision request: build Gemini multi-turn contents ──────────────────
      const contents = []

      // If there's prior history, include it
      for (const h of history) {
        contents.push({
          role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.content || h.text || '' }],
        })
      }

      // Current message — attach image
      contents.push({
        role: 'user',
        parts: [
          { inline_data: { mime_type: imageMime || 'image/jpeg', data: imageBase64 } },
          { text: message },
        ],
      })

      result = await callGemini(contents)

      // Groq vision fallback
      if (!result) result = await callGroqVision(imageBase64, imageMime || 'image/jpeg', message)

    } else {
      // ── Text-only follow-up — build conversation history ──────────────────
      // Include extracted data as context if available
      const systemWithContext = extractedContext
        ? `${WATER_AI_SYSTEM}\n\nCurrent sample context (from image already analyzed):\n${JSON.stringify(extractedContext, null, 2)}`
        : WATER_AI_SYSTEM

      const contents = []
      for (const h of history) {
        contents.push({
          role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.content || h.text || '' }],
        })
      }
      contents.push({ role: 'user', parts: [{ text: message }] })

      // Try Gemini text first
      if (GEMINI_KEY) {
        result = await callGemini(contents)
      }

      // Groq text fallback
      if (!result) {
        const groqMsgs = [
          { role: 'system', content: systemWithContext },
          ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : h.role, content: h.content || h.text || '' })),
          { role: 'user', content: message },
        ]
        result = await callGroq(groqMsgs)
      }
    }

    if (!result) return res.status(503).json({ error: 'AI unavailable — please try again' })

    const extracted = imageBase64 ? parseExtraction(result.text) : null

    // Strip the extraction tag from the displayed text
    const displayText = result.text.replace(/<extraction>[\s\S]*?<\/extraction>/g, '').trim()

    res.json({ reply: displayText, model: result.model, extracted })
  } catch (err) {
    console.error('[research/chat]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /scan — legacy structured extraction ─────────────────────────────────
router.post('/scan', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' })

    const base64 = req.file.buffer.toString('base64')
    const mime   = req.file.mimetype || 'image/jpeg'

    const PROMPT = `Analyze this water quality image. Extract ALL parameters. Return ONLY a JSON object:
{"date":null,"time":null,"location":null,"observer":null,"ph":null,"temperature_c":null,"turbidity_ntu":null,"dissolved_oxygen_mgl":null,"conductivity_us_cm":null,"nitrates_mgl":null,"phosphorus_mgl":null,"chlorine_mgl":null,"hardness_mgl":null,"alkalinity_mgl":null,"tds_mgl":null,"water_color":null,"odor":null,"weather":null,"notes":null,"confidence":85,"fields_found":[]}`

    let result = null

    if (GEMINI_KEY) {
      result = await callGemini([{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mime, data: base64 } },
          { text: PROMPT },
        ],
      }])
    }
    if (!result) result = await callGroqVision(base64, mime, PROMPT)
    if (!result) return res.status(503).json({ error: 'Vision AI unavailable' })

    let parsed = {}
    try {
      const m = result.text.match(/\{[\s\S]*\}/)
      if (m) parsed = JSON.parse(m[0])
      else parsed = { notes: result.text, confidence: 40 }
    } catch { parsed = { notes: result.text, confidence: 40 } }

    res.json({ extracted: parsed, model: result.model })
  } catch (err) {
    console.error('[scan]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /observations ────────────────────────────────────────────────────────
router.post('/observations', requireAuth, (req, res) => {
  try {
    const { location_name, ph, temperature_c, turbidity_ntu, dissolved_oxygen, conductivity, nitrates, phosphorus, chlorine, hardness, alkalinity, tds, water_color, odor, notes, observed_at, ai_model } = req.body
    let siteId = req.body.site_id || null
    if (!siteId) {
      const r = db.prepare('INSERT INTO sites (name, latitude, longitude, water_body_type, created_by) VALUES (?, 0, 0, ?, ?)').run(location_name || 'Field Observation', 'field', req.user.id)
      siteId = r.lastInsertRowid
    }
    const r = db.prepare(`INSERT INTO observations (site_id, observer_id, observed_at, ph, water_temp, turbidity, dissolved_oxygen, conductivity, nitrates, phosphorus, chlorine, hardness, alkalinity, tds, water_color, water_odor, notes, qa_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai_extracted')`).run(
      siteId, req.user.id, observed_at || new Date().toISOString(),
      ph ?? null, temperature_c ?? null, turbidity_ntu ?? null, dissolved_oxygen ?? null,
      conductivity ?? null, nitrates ?? null, phosphorus ?? null, chlorine ?? null,
      hardness ?? null, alkalinity ?? null, tds ?? null, water_color ?? null, odor ?? null,
      `[Scanned by ${ai_model || 'AI Vision'}] ${notes || ''}`.trim()
    )
    res.json({ id: r.lastInsertRowid, site_id: siteId, success: true })
  } catch (err) {
    console.error('[obs save]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /observations ─────────────────────────────────────────────────────────
router.get('/observations', requireAuth, (req, res) => {
  try {
    const rows = db.prepare(`SELECT o.id, o.observed_at, o.ph, o.water_temp, o.turbidity, o.dissolved_oxygen, o.conductivity, o.nitrates, o.phosphorus, o.water_color, o.water_odor, o.notes, o.qa_status, s.name as site_name, u.display_name as observer_name FROM observations o LEFT JOIN sites s ON o.site_id = s.id LEFT JOIN users u ON o.observer_id = u.id WHERE o.qa_status = 'ai_extracted' ORDER BY o.observed_at DESC LIMIT 100`).all()
    res.json({ observations: rows })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── GET /live-water ───────────────────────────────────────────────────────────
router.get('/live-water', async (req, res) => {
  const STATIONS = [
    { id: '02CD003', name: "St. Mary's River",  location: 'Sault Ste. Marie, ON' },
    { id: '02BB022', name: 'Mississagi River',   location: 'Aubrey Falls, ON' },
    { id: '02CF007', name: 'Spanish River',      location: 'Agnew, ON' },
    { id: '02BF001', name: 'Batchawana River',   location: 'Batchawana, ON' },
  ]
  const fetchStation = async (station) => {
    try {
      const url = `https://wateroffice.ec.gc.ca/services/real_time_json.php?stations[]=${station.id}&parameters[]=46,47,5`
      const ctrl = new AbortController()
      setTimeout(() => ctrl.abort(), 8000)
      const resp = await fetch(url, { signal: ctrl.signal })
      if (!resp.ok) return { ...station, error: `HTTP ${resp.status}`, readings: [] }
      const data = await resp.json()
      const stationData = data[station.id] || {}
      const readings = []
      for (const [paramId, paramData] of Object.entries(stationData)) {
        if (paramData?.data) {
          const latest = paramData.data[paramData.data.length - 1]
          readings.push({ param_id: paramId, param_name: paramId === '46' ? 'Water Level (m)' : paramId === '47' ? 'Discharge (m³/s)' : 'Water Temp (°C)', value: latest?.[1], unit: paramId === '46' ? 'm' : paramId === '47' ? 'm³/s' : '°C', timestamp: latest?.[0] })
        }
      }
      return { ...station, readings, raw: data }
    } catch (e) { return { ...station, error: e.message, readings: [] } }
  }
  try {
    const results = await Promise.all(STATIONS.map(fetchStation))
    res.json({ stations: results, fetched_at: new Date().toISOString(), source: 'Environment and Climate Change Canada (ECCC)' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
