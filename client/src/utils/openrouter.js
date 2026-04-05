/**
 * AI via Pollinations.ai — 100% free, no API key, no account, no limits.
 * Falls back to server route if needed.
 */

const POLLINATIONS = 'https://text.pollinations.ai/openai'

export async function askAI(messages, systemPrompt = '', maxTokens = 1024) {
  const fullMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages

  try {
    const res = await fetch(POLLINATIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: fullMessages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content
    if (text && text.length > 3) return text
  } catch { /* fall through to server */ }

  // Fallback: server route
  try {
    const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
    const res = await fetch(`${API}/ai/public-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: fullMessages }),
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    return data.reply || "I'm having trouble connecting. Please try again. 💧"
  } catch { /* final fallback */ }

  return "I'm having trouble connecting right now. Please try again. 💧"
}

export const WATER_SYSTEM_PROMPT = `You are Water, the friendly AI assistant for SOURCE Water — a water quality monitoring and engagement platform for Northern Ontario, managed by NORDIK Institute at Algoma University.

You help community members, researchers, and students understand water quality data, learn about aquatic ecosystems, and engage with the platform. You are knowledgeable about:
- Water quality parameters (pH, turbidity, dissolved oxygen, nitrates, temperature, etc.)
- Northern Ontario watersheds and lakes (Lake Superior, Lake Huron, inland lakes)
- Indigenous water rights and stewardship
- Field sampling procedures, ML analysis, data interpretation
- Water treatment and safety standards (WHO/EPA guidelines)
- Algoma University research initiatives

Be friendly, encouraging, and educational. Use simple language when talking to community members, but can be technical with researchers. Always emphasize the importance of clean water and community stewardship.`
