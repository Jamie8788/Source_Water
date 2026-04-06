/**
 * AI via Pollinations.ai — 100% free, no API key, no limits.
 * Uses mistral (fast, ~5s) as primary, falls back to openai, then server route.
 */

const POLLINATIONS = 'https://text.pollinations.ai/openai'

export async function askAI(messages, systemPrompt = '', maxTokens = 900) {
  const fullMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages

  // Try mistral first — much faster than openai (~3-6s vs 30-60s)
  for (const model of ['mistral', 'openai']) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 25000) // 25s timeout per model
      const res = await fetch(POLLINATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          model,
          messages: fullMessages,
          max_tokens: maxTokens,
          temperature: 0.6,
        }),
      })
      clearTimeout(timer)
      if (!res.ok) continue
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content
      if (text && text.length > 5) return text
    } catch { /* try next model */ }
  }

  // Fallback: server route
  try {
    const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
    const res = await fetch(`${API}/ai/public-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: fullMessages }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.reply && !data.reply.includes("having a moment")) return data.reply
    }
  } catch { /* final fallback */ }

  return null // caller handles null
}

// Smart context builder — compresses large files into an AI-friendly summary
// instead of dumping raw rows (which is slow and noisy)
// Also accepts {colStats} for backend-provided stats (Analysis.jsx)
export function buildFileContext(fileText, tableData, fileName, colStats = null) {
  if (!fileText && !tableData && !colStats) return ''

  // Backend-provided col_stats (from Analysis.jsx) — already computed
  if (colStats && Object.keys(colStats).length > 0) {
    const lines = Object.entries(colStats).map(([col, s]) =>
      `${col}: count=${s.count}, mean=${s.mean}, std=${s.std}, min=${s.min}, max=${s.max}, outliers=${s.outliers||0}`
    )
    return `FILE: ${fileName}\nCOLUMN STATISTICS:\n${lines.join('\n')}`
  }

  // For tabular data (CSV/XLSX), build a compact statistical summary
  if (tableData?.rows?.length > 0) {
    const { headers, rows } = tableData
    const n = rows.length

    // Compute per-column stats
    const colSummaries = headers.map(h => {
      const vals = rows.map(r => parseFloat(r[h])).filter(v => !isNaN(v))
      if (vals.length === 0) {
        // Categorical column — show unique values
        const uniq = [...new Set(rows.map(r => r[h]).filter(v => v !== '' && v != null))].slice(0, 8)
        return `${h}: categorical (${uniq.length} unique: ${uniq.slice(0,4).join(', ')}${uniq.length > 4 ? '…' : ''})`
      }
      const mean = (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(3)
      const sorted = [...vals].sort((a,b)=>a-b)
      const min = sorted[0].toFixed(3), max = sorted[sorted.length-1].toFixed(3)
      const std = Math.sqrt(vals.map(v=>(v-parseFloat(mean))**2).reduce((a,b)=>a+b,0)/vals.length).toFixed(3)
      const missing = n - vals.length
      return `${h}: n=${vals.length}${missing>0?` (${missing} missing)`:''},  mean=${mean}, std=${std}, min=${min}, max=${max}`
    })

    // Sample rows — first 5, middle 5, last 5
    const sampleIdx = [...new Set([...Array.from({length:Math.min(5,n)},(_,i)=>i), ...Array.from({length:Math.min(5,n)},(_,i)=>Math.floor(n/2)+i), ...Array.from({length:Math.min(5,n)},(_,i)=>n-5+i)].filter(i=>i>=0&&i<n))]
    const sampleRows = sampleIdx.map(i => headers.map(h => `${h}=${rows[i][h]??''}`).join(', '))

    return [
      `FILE: ${fileName}`,
      `DATASET: ${n.toLocaleString()} rows × ${headers.length} columns`,
      `COLUMNS: ${headers.join(', ')}`,
      ``,
      `COLUMN STATISTICS:`,
      ...colSummaries,
      ``,
      `SAMPLE ROWS (${sampleRows.length} of ${n}):`,
      ...sampleRows.map((r,i) => `Row ${sampleIdx[i]+1}: ${r}`),
    ].join('\n')
  }

  // For non-tabular files (PDF, DOCX, TXT) — send first 8000 chars
  return `FILE: ${fileName}\n\n${fileText.slice(0, 8000)}${fileText.length > 8000 ? '\n\n[…document continues, showing first 8000 chars…]' : ''}`
}

export const WATER_SYSTEM_PROMPT = `You are Water, the friendly AI assistant for SOURCE Water — a water quality monitoring platform for Northern Ontario, managed by NORDIK Institute at Algoma University.

You help community members, researchers, and students understand water quality data, learn about aquatic ecosystems, and engage with the platform. You are knowledgeable about:
- Water quality parameters (pH, turbidity, dissolved oxygen, nitrates, temperature, etc.)
- Northern Ontario watersheds and lakes (Lake Superior, Lake Huron, inland lakes)
- Indigenous water rights and stewardship
- Field sampling procedures, ML analysis, data interpretation
- Water treatment and safety standards (WHO/EPA guidelines)
- Algoma University research initiatives

Be friendly, encouraging, and educational. Use simple language when talking to community members, but can be technical with researchers. Always emphasize the importance of clean water and community stewardship.`
