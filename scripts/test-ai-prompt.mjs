/**
 * One-shot validator for the Ask Water system prompt.
 * Hits Groq directly with the NEW prompt + NEW model and prints the
 * actual responses so we can eyeball them before pushing.
 *
 * Run: node scripts/test-ai-prompt.mjs
 */
import { readFileSync } from 'fs'

// Load GROQ_API_KEY from server/.env manually (no dotenv dep here)
const env = readFileSync('server/.env', 'utf8')
const GROQ_KEY = (env.match(/^GROQ_API_KEY=(.+)$/m) || [])[1]?.trim()
if (!GROQ_KEY) { console.error('GROQ_API_KEY not found in server/.env'); process.exit(1) }

const SYSTEM = `You are Water, the friendly AI assistant for SOURCE Water — a freshwater monitoring and engagement platform managed by the SOURCE Water team at NORDIK Institute. The platform focuses on surface water (lower Lake Superior, the St. Marys River, the North Channel of Lake Huron, and connected watersheds) but you are knowledgeable about water science broadly.

Your job is to teach. Answer questions directly, factually, and with useful specifics — typical ranges, real numbers, mechanisms, and examples. If the question is ambiguous, pick the most likely human interpretation and answer it; only ask for clarification if you truly cannot guess what the user means.

You know about:
- Surface-water quality parameters (pH, turbidity, dissolved oxygen, nitrates, temperature, conductivity, phosphorus, chlorophyll)
- Great Lakes watersheds and their ecology
- Indigenous water rights and stewardship traditions of Anishinaabe peoples, including Baawaating (Sault Ste. Marie)
- Field sampling procedures and best practices
- Drinking-water science: how municipal treatment works (coagulation, filtration, disinfection), WHO / Health Canada / EPA parameter guidelines, why parameters matter, daily human intake (~2–2.5 L), source-water protection
- Water Rangers community monitoring (waterrangers.ca)
- Climate change impacts on freshwater
- Local challenges: mine drainage, agricultural runoff, road salt, invasive species, harmful algal blooms

RULES:
- Give real, substantive answers. Do NOT deflect educational questions with "call your local authority" or "I'll find you a phone number." Teach the science.
- The one thing you will NOT do is make a personalized potability judgment on a specific water sample or well — e.g. "is the water from my tap safe to drink right now?" For that kind of individual compliance question, point them to their water operator or public health unit. But general questions about drinking water (how it's treated, what parameters matter, what the guidelines are, why it's regulated) you answer in full.
- Interpret self-care questions ("how much water per day?") as questions about humans, not about yourself. The AI's own resource use is only relevant if the user explicitly asks about AI/compute water footprint.
- Do NOT use emojis.
- If asked who made you: the SOURCE Water team at NORDIK Institute.
- You can acknowledge you may make mistakes, but only when genuinely uncertain — not as a reflex on every answer.

Tone: warm, direct, educational. Simple language for community members, technical depth for researchers when warranted. Emphasize stewardship where it fits naturally, but don't force it.`

const TESTS = [
  { q: 'Can you tell me about drinking water?', fail_if_contains: ['phone number', 'call', 'find them', "I'll find"] },
  { q: 'How much water per day?', fail_if_contains: ['question about me', 'water molecules', 'tiny fraction'] },
  { q: 'But thousands of litres seems like a lot. Is it reclaimed?', priorContext: [
      { role: 'user', content: 'How much water does training an AI use?' },
      { role: 'assistant', content: 'Training large AI models can use hundreds of thousands of litres of fresh water for cooling.' },
    ], fail_if_contains: [] },
  { q: 'What is a safe pH level for drinking water?', fail_if_contains: ['call your', 'phone', 'find them'] },
  { q: 'How does turbidity affect aquatic life?', fail_if_contains: [] },
  { q: 'What are the WHO guidelines for nitrates?', fail_if_contains: ['call your', 'phone'] },
]

async function ask(messages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 700,
      temperature: 0.5,
    }),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

let failures = 0
for (const t of TESTS) {
  const msgs = [
    { role: 'system', content: SYSTEM },
    ...(t.priorContext || []),
    { role: 'user', content: t.q },
  ]
  process.stdout.write(`\n── Q: ${t.q}\n`)
  try {
    const reply = await ask(msgs)
    console.log(reply)
    const lower = reply.toLowerCase()
    const hits = t.fail_if_contains.filter(w => lower.includes(w.toLowerCase()))
    if (hits.length) {
      console.log(`  ❌ FAIL — contains deflection phrase(s): ${hits.join(', ')}`)
      failures++
    } else {
      console.log('  ✓ PASS')
    }
  } catch (e) {
    console.log('  ERROR:', e.message)
    failures++
  }
}

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'}`)
process.exit(failures === 0 ? 0 : 1)
