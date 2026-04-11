const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')

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
// Uses StreamElements → Amazon Polly "Ivy" (child voice, free, no limits documented)
// Proxied through backend to avoid browser CORS restrictions
// Fallback: tells client to use browser TTS (also free, runs on user device)
router.post('/tts', async (req, res) => {
  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'text required' })
  const clean = text.replace(/[*_`#[\]()\u200B-\uFEFF]/g, '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 500)

  // ── StreamElements → Amazon Polly Ivy (child voice, free, no key needed) ──
  // "Ivy" = US English child female voice. "Justin" = US English child male.
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

  // ── Tell client to fall back to browser TTS ────────────────────────────────
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

module.exports = router
