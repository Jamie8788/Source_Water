// ── Lightweight Markdown → JSX ───────────────────────────────────────────────
// Shared by the Research AI chat and the Trends parameter deep-dive so both
// render AI answers the same clean way — no external dependency. Handles
// headings, **bold**, *italic*, `code`, bullet + numbered lists and GFM tables,
// and strips the 【…】 citation tags the model sometimes emits.
//
// Theme-agnostic: text uses `inherit` (so it takes the parent's colour — dark
// chat bubble or white deep-dive alike) and table/code chrome uses neutral
// greys that read on both light and dark backgrounds.

function mdInline(str) {
  const out = []
  let rest = String(str).replace(/【[^】]*】/g, '')
  const re = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`)/
  let key = 0, m
  while ((m = rest.match(re))) {
    if (m.index > 0) out.push(rest.slice(0, m.index))
    if (m[2] != null) out.push(<strong key={key++}>{m[2]}</strong>)
    else if (m[3] != null) out.push(<em key={key++}>{m[3]}</em>)
    else if (m[4] != null) out.push(<code key={key++} style={{ background: 'rgba(127,127,127,.16)', padding: '0 4px', borderRadius: 4, fontSize: '0.92em' }}>{m[4]}</code>)
    rest = rest.slice(m.index + m[0].length)
  }
  if (rest) out.push(rest)
  return out
}

export default function MarkdownLite({ text }) {
  const clean = String(text || '').replace(/【[^】]*】/g, '')
  const lines = clean.split('\n')
  const blocks = []
  let i = 0, key = 0
  const isSep = (s) => s && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(s) && s.includes('-')
  const bd = '1px solid rgba(127,127,127,.35)'
  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()
    if (!t) { i++; continue }
    if (/^(---+|\*\*\*+|___+)$/.test(t)) { blocks.push(<hr key={key++} style={{ border: 'none', borderTop: ' 1px solid rgba(127,127,127,.3)', margin: '8px 0' }} />); i++; continue }
    const h = t.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const lvl = h[1].length
      blocks.push(<div key={key++} style={{ fontWeight: 800, fontSize: lvl <= 1 ? 16 : lvl === 2 ? 14.5 : 13, margin: '10px 0 4px' }}>{mdInline(h[2])}</div>)
      i++; continue
    }
    if (t.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const cut = (s) => s.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const header = cut(t)
      i += 2
      const rows = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(cut(lines[i])); i++ }
      blocks.push(
        <div key={key++} style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
            <thead><tr>{header.map((c, ci) => <th key={ci} style={{ border: bd, padding: '4px 8px', textAlign: 'left', background: 'rgba(127,127,127,.14)', fontWeight: 700 }}>{mdInline(c)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri} style={{ background: ri % 2 ? 'rgba(127,127,127,.06)' : 'transparent' }}>{r.map((c, ci) => <td key={ci} style={{ border: bd, padding: '4px 8px', verticalAlign: 'top' }}>{mdInline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
      continue
    }
    if (/^[-*]\s+/.test(t)) {
      const items = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].trim().replace(/^[-*]\s+/, '')); i++ }
      blocks.push(<ul key={key++} style={{ margin: '4px 0', paddingLeft: 18 }}>{items.map((it, ii) => <li key={ii} style={{ margin: '2px 0' }}>{mdInline(it)}</li>)}</ul>)
      continue
    }
    if (/^\d+\.\s+/.test(t)) {
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].trim().replace(/^\d+\.\s+/, '')); i++ }
      blocks.push(<ol key={key++} style={{ margin: '4px 0', paddingLeft: 20 }}>{items.map((it, ii) => <li key={ii} style={{ margin: '2px 0' }}>{mdInline(it)}</li>)}</ol>)
      continue
    }
    const para = [line]; i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*]\s|\d+\.\s|---+$)/.test(lines[i].trim()) && !(lines[i].includes('|') && isSep(lines[i + 1] || ''))) { para.push(lines[i]); i++ }
    blocks.push(<p key={key++} style={{ margin: '4px 0', lineHeight: 1.6 }}>{mdInline(para.join(' '))}</p>)
  }
  return <div>{blocks}</div>
}
