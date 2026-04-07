const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')

const POLLINATIONS = 'https://text.pollinations.ai/openai'
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY
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
  // 1. DeepSeek API (fast, reliable — requires DEEPSEEK_API_KEY in Render env)
  if (DEEPSEEK_KEY) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 20000)
      const res = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
        signal: ctrl.signal,
        body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: 1024, temperature: 0.7 }),
      })
      clearTimeout(timer)
      if (res.ok) {
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content
        if (text?.trim().length > 5) { console.log('[AI] DeepSeek'); return { text, model: 'DeepSeek V3' } }
      }
    } catch (e) { console.log(`[AI] DeepSeek failed: ${e.message}`) }
  }

  // 2. Groq — free tier, fast, reliable (llama-3.1-8b-instant)
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
