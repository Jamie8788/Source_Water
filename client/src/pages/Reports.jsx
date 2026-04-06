/**
 * Reports.jsx — Research Intelligence Workspace
 * Dark theme · Markdown rendering · Persistent chat · Auto charts · Download reports
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  Cell, Area, AreaChart, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import {
  Upload, Trash2, Send, Loader, AlertTriangle,
  Database, AlertCircle, BarChart2, Activity, X, Bot, User,
  Sparkles, Download, FileText, RefreshCw, TrendingUp, Zap,
  GitCompare, FlaskConical, Shield, Eye, ChevronDown, ChevronRight,
} from 'lucide-react'
import axios from 'axios'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { askAI, buildFileContext } from '../utils/openrouter'

const BACKEND = import.meta.env.VITE_ANALYSIS_URL || 'http://localhost:8001'

// ── WHO thresholds ─────────────────────────────────────────────────────────────
const WHO = {
  ph:               { min: 6.5,  max: 8.5,  unit: '',       label: 'pH' },
  turbidity:        { min: 0,    max: 5,    unit: ' NTU',   label: 'Turbidity' },
  dissolved_oxygen: { min: 6,    max: 999,  unit: ' mg/L',  label: 'DO' },
  temperature:      { min: 0,    max: 25,   unit: ' °C',    label: 'Temp' },
  nitrates:         { min: 0,    max: 10,   unit: ' mg/L',  label: 'Nitrates' },
  conductivity:     { min: 0,    max: 1500, unit: ' µS/cm', label: 'Conductivity' },
  phosphorus:       { min: 0,    max: 0.03, unit: ' mg/L',  label: 'Phosphorus' },
  ecoli:            { min: 0,    max: 0,    unit: ' CFU',   label: 'E. coli' },
  tss:              { min: 0,    max: 30,   unit: ' mg/L',  label: 'TSS' },
  chlorophyll:      { min: 0,    max: 15,   unit: ' µg/L',  label: 'Chlorophyll' },
}
function whoMatch(col) {
  const key = col.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z_]/g,'')
  return Object.entries(WHO).find(([k]) => key.includes(k))
}
function whoStatus(col, mean) {
  const m = whoMatch(col); if (!m) return null
  const [, t] = m
  if (mean < t.min) return { label:'Below', color:'#0ea5e9', bg:'rgba(14,165,233,0.12)' }
  if (mean > t.max) return { label:'EXCEEDS', color:'#ef4444', bg:'rgba(239,68,68,0.12)' }
  return { label:'Safe ✓', color:'#10b981', bg:'rgba(16,185,129,0.12)' }
}

// ── File ext → type label ──────────────────────────────────────────────────────
function fileType(name) {
  const e = (name ?? '').split('.').pop().toLowerCase()
  if (e === 'pdf')  return { label: 'PDF',   color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
  if (e === 'csv')  return { label: 'CSV',   color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
  if (e === 'xlsx' || e === 'xls') return { label: 'Excel', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
  if (e === 'docx' || e === 'doc') return { label: 'DOCX',  color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' }
  if (e === 'txt')  return { label: 'TXT',   color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' }
  if (e === 'json') return { label: 'JSON',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
  return { label: 'FILE', color: '#64748b', bg: 'rgba(100,116,139,0.15)' }
}

// ── Extract text from file (client-side) ───────────────────────────────────────
async function extractText(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'txt' || ext === 'json') {
    return new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = e => res(e.target.result); r.onerror = rej; r.readAsText(file)
    })
  }
  if (ext === 'csv') {
    return new Promise((res, rej) => {
      Papa.parse(file, {
        complete: r => res(r.data.slice(0, 800).map(row => row.join(', ')).join('\n')),
        error: rej,
      })
    })
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' })
          const lines = []
          wb.SheetNames.forEach(n => {
            lines.push(`=== Sheet: ${n} ===`)
            lines.push(XLSX.utils.sheet_to_csv(wb.Sheets[n]).split('\n').slice(0, 400).join('\n'))
          })
          res(lines.join('\n'))
        } catch (err) { rej(err) }
      }
      r.onerror = rej; r.readAsArrayBuffer(file)
    })
  }
  if (ext === 'pdf') {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
    GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
    const ab = await file.arrayBuffer()
    const pdf = await getDocument({ data: ab }).promise
    const nPages = Math.min(pdf.numPages, 150)
    const texts = []
    for (let i = 1; i <= nPages; i++) {
      const page = await pdf.getPage(i)
      const c = await page.getTextContent()
      texts.push(c.items.map(s => s.str).join(' '))
    }
    const full = texts.join('\n')
    return pdf.numPages > 150 ? full + `\n\n[Note: ${pdf.numPages} pages total — showing first 150.]` : full
  }
  if (ext === 'docx') return `[DOCX: ${file.name} — convert to PDF or TXT for full text extraction]`
  return `[File: ${file.name}]`
}

// ── Parse CSV/XLSX into row/col structure for charts ──────────────────────────
async function parseTableData(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'csv') {
    return new Promise(res => {
      Papa.parse(file, {
        header: true, dynamicTyping: true, skipEmptyLines: true,
        complete: r => res({ headers: r.meta.fields || [], rows: r.data.slice(0, 2000) }),
        error: () => res(null),
      })
    })
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return new Promise(res => {
      const r = new FileReader()
      r.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
          const headers = rows.length ? Object.keys(rows[0]) : []
          res({ headers, rows: rows.slice(0, 2000) })
        } catch { res(null) }
      }
      r.onerror = () => res(null); r.readAsArrayBuffer(file)
    })
  }
  return null
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function MarkdownLine({ line }) {
  // Convert inline bold/italic
  const renderInline = (text) => {
    const parts = []
    let remaining = text
    let key = 0
    // bold **text** or __text__
    while (remaining) {
      const m = remaining.match(/(\*\*|__)(.*?)\1/)
      if (!m) { parts.push(<span key={key++}>{remaining}</span>); break }
      if (m.index > 0) parts.push(<span key={key++}>{remaining.slice(0, m.index)}</span>)
      parts.push(<strong key={key++} style={{ color: '#f1f5f9', fontWeight: 700 }}>{m[2]}</strong>)
      remaining = remaining.slice(m.index + m[0].length)
    }
    return parts
  }
  return <>{renderInline(line)}</>
}

function MarkdownRenderer({ content }) {
  if (!content) return null
  const lines = content.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // H3
    if (line.startsWith('### ')) {
      elements.push(
        <div key={i} style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', marginTop: 14, marginBottom: 4, letterSpacing: '0.03em', textTransform: 'uppercase', borderBottom: '1px solid rgba(56,189,248,0.2)', paddingBottom: 4 }}>
          {line.slice(4)}
        </div>
      )
      i++; continue
    }
    // H2
    if (line.startsWith('## ')) {
      elements.push(
        <div key={i} style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', marginTop: 16, marginBottom: 6 }}>
          {line.slice(3)}
        </div>
      )
      i++; continue
    }
    // H1
    if (line.startsWith('# ')) {
      elements.push(
        <div key={i} style={{ fontSize: 17, fontWeight: 900, color: '#f1f5f9', marginTop: 16, marginBottom: 8 }}>
          {line.slice(2)}
        </div>
      )
      i++; continue
    }
    // HR
    if (line.startsWith('---') || line.startsWith('===')) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0' }} />)
      i++; continue
    }
    // Bullet
    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      const txt = line.startsWith('* ') && line.endsWith('*') ? line.slice(2, -1) : line.slice(2)
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 3 }}>
          <span style={{ color: '#38bdf8', marginTop: 2, flexShrink: 0 }}>•</span>
          <span style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }}><MarkdownLine line={txt} /></span>
        </div>
      )
      i++; continue
    }
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s(.*)/);
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 3 }}>
          <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 12, minWidth: 18, flexShrink: 0 }}>{num[1]}.</span>
          <span style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }}><MarkdownLine line={num[2]} /></span>
        </div>
      )
      i++; continue
    }
    // Code block
    if (line.startsWith('```')) {
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      elements.push(
        <pre key={i} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#a5f3fc', overflowX: 'auto', margin: '8px 0', lineHeight: 1.5 }}>
          {codeLines.join('\n')}
        </pre>
      )
      i++; continue
    }
    // Inline code
    if (line.includes('`')) {
      const parts = line.split('`')
      elements.push(
        <div key={i} style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.7, marginBottom: 2 }}>
          {parts.map((p, j) => j % 2 === 0
            ? <span key={j}><MarkdownLine line={p} /></span>
            : <code key={j} style={{ background: 'rgba(0,0,0,0.35)', padding: '1px 6px', borderRadius: 4, fontSize: 11, color: '#a5f3fc' }}>{p}</code>
          )}
        </div>
      )
      i++; continue
    }
    // Empty line → spacer
    if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 6 }} />)
      i++; continue
    }
    // Regular paragraph
    elements.push(
      <div key={i} style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.7, marginBottom: 2 }}>
        <MarkdownLine line={line} />
      </div>
    )
    i++
  }
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>
}

// ── Auto charts from table data ────────────────────────────────────────────────
function AutoCharts({ tableData }) {
  const [expanded, setExpanded] = useState(false)
  if (!tableData?.rows?.length) return null

  const numCols = (tableData.headers || []).filter(h => {
    const vals = tableData.rows.map(r => r[h]).filter(v => v !== '' && v !== null && !isNaN(parseFloat(v)))
    return vals.length > 0
  }).slice(0, 6)

  if (numCols.length === 0) return null

  const COLORS = ['#38bdf8','#10b981','#f59e0b','#a78bfa','#f87171','#34d399']

  const makeHistogram = (col) => {
    const vals = tableData.rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v))
    if (vals.length === 0) return []
    const mn = Math.min(...vals), mx = Math.max(...vals)
    if (mn === mx) return [{ range: mn.toFixed(1), count: vals.length }]
    const buckets = 8
    const step = (mx - mn) / buckets
    const bins = Array.from({ length: buckets }, (_, i) => ({
      range: (mn + i * step).toFixed(1),
      count: 0,
    }))
    vals.forEach(v => {
      const idx = Math.min(Math.floor((v - mn) / step), buckets - 1)
      bins[idx].count++
    })
    return bins
  }

  const makeStats = (col) => {
    const vals = tableData.rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v))
    if (!vals.length) return null
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const std = Math.sqrt(vals.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / vals.length)
    const sorted = [...vals].sort((a, b) => a - b)
    return {
      mean: mean.toFixed(2), std: std.toFixed(2),
      min: sorted[0].toFixed(2), max: sorted[sorted.length - 1].toFixed(2),
      median: sorted[Math.floor(sorted.length / 2)].toFixed(2),
      n: vals.length,
    }
  }

  const shownCols = expanded ? numCols : numCols.slice(0, 3)

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Auto Data Charts · {numCols.length} numeric columns · {tableData.rows.length} rows
        </div>
        {numCols.length > 3 && (
          <button onClick={() => setExpanded(e => !e)} style={{ fontSize: 10, color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            {expanded ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
            {expanded ? 'Show less' : `+${numCols.length - 3} more`}
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {shownCols.map((col, ci) => {
          const hist = makeHistogram(col)
          const stats = makeStats(col)
          const who = stats ? whoStatus(col, parseFloat(stats.mean)) : null
          const color = COLORS[ci % COLORS.length]
          return (
            <div key={col} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{col}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {who && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: who.bg, color: who.color }}>{who.label}</span>}
                </div>
              </div>
              {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
                  {[['Mean', stats.mean], ['Std', stats.std], ['Median', stats.median]].map(([l, v]) => (
                    <div key={l} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '4px 0' }}>
                      <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase' }}>{l}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
              <ResponsiveContainer width="100%" height={60}>
                <BarChart data={hist} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <XAxis dataKey="range" tick={{ fill: '#334155', fontSize: 7 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 10 }} formatter={(v) => [v, 'count']}/>
                  <Bar dataKey="count" fill={color} radius={[2,2,0,0]} fillOpacity={0.8}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Data quality score ─────────────────────────────────────────────────────────
function dataQuality(tableData) {
  if (!tableData?.rows?.length) return null
  const { headers, rows } = tableData
  const total = headers.length * rows.length
  const missing = headers.reduce((sum, h) => sum + rows.filter(r => r[h] === '' || r[h] === null || r[h] === undefined).length, 0)
  const completeness = Math.round((1 - missing / total) * 100)
  const numCols = headers.filter(h => rows.some(r => !isNaN(parseFloat(r[h])) && r[h] !== '')).length
  return { completeness, rows: rows.length, cols: headers.length, numCols, missing }
}

// ── Quick prompts ──────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon: '📋', label: 'Full Report',   prompt: 'Generate a detailed structured research report from this data. Include: Executive Summary, Key Findings with specific numbers, Data Quality Assessment, Statistical Highlights, Risk Flags, and Recommended Actions. Be specific and cite actual values from the data.' },
  { icon: '🔍', label: 'Key Findings',  prompt: 'What are the 5 most important findings in this data? Be specific with numbers and reference actual values you see.' },
  { icon: '⚠️', label: 'Risk Analysis', prompt: 'Identify all risks, violations, and concerns in this data. Compare against WHO/EPA water quality standards where relevant. Rank by severity.' },
  { icon: '📊', label: 'Statistics',    prompt: 'Provide a detailed statistical summary: means, ranges, distributions, outliers, and trends for each numeric column.' },
  { icon: '💡', label: 'Insights',      prompt: 'What patterns, correlations, or unusual observations do you notice? What would you recommend a water quality researcher investigate further?' },
  { icon: '🏷️', label: 'Summarize',    prompt: 'Give me a concise 3-paragraph executive summary of this document. What is it about, what are the key points, and what are the main conclusions?' },
]

// ── AI Chat ────────────────────────────────────────────────────────────────────
function AIChatDialog({ file, fileText, tableData: td, messages, onMessages }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setError(null)

    const newMessages = [...messages, { role: 'user', content: q }]
    onMessages(newMessages)
    setLoading(true)

    // Build compact context — stats summary for tabular data, truncated text for docs
    const ctx = (fileText || td) ? buildFileContext(fileText, td, file?.name || '') : ''
    const sys = ctx
      ? `You are an expert AI research assistant and data scientist. Analyze the following file data and answer the user's question. Be specific — cite actual numbers and values from the data. Use clear sections and bullet points.\n\n${ctx}`
      : `You are an expert AI research assistant. Help with data analysis and research questions.`

    try {
      const resp = await askAI(newMessages.map(m => ({ role: m.role, content: m.content })), sys, 900)
      if (resp && !resp.includes("having a moment") && !resp.includes("having trouble")) {
        onMessages([...newMessages, { role: 'assistant', content: resp }])
      } else {
        setError('AI is temporarily unavailable. Please retry.')
        onMessages(newMessages.slice(0, -1))
      }
    } catch {
      setError('Connection error. Please try again.')
      onMessages(newMessages.slice(0, -1))
    }
    setLoading(false)
  }

  const retry = () => {
    if (messages.length < 2) return
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (lastUser) {
      onMessages(messages.slice(0, -1))
      setError(null)
      sendMessage(lastUser.content)
    }
  }

  const exportChat = () => {
    const text = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n---\n\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    a.download = `chat-${(file?.name || 'session').replace(/\.[^.]+$/, '')}-${new Date().toISOString().slice(0,10)}.txt`
    a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(8,12,26,0.98)', borderRadius: 14, border: '1px solid rgba(99,102,241,0.25)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(14,165,233,0.12))', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <Bot size={18} color="#818cf8" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>AI Research Chat</div>
          <div style={{ fontSize: 10, color: '#475569' }}>{file ? `📎 ${file.name}` : 'Select a file to start analysis'}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {messages.length > 0 && (
            <button onClick={exportChat} title="Export chat" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', color: '#64748b', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Download size={10}/> Export
            </button>
          )}
          <span style={{ fontSize: 9, padding: '3px 8px', background: 'rgba(16,185,129,0.15)', borderRadius: 20, color: '#10b981', fontWeight: 700 }}>FREE AI</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧪</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>Research Intelligence Workspace</div>
            <div style={{ fontSize: 12, color: '#334155', marginTop: 6, lineHeight: 1.6 }}>
              Upload any file and select it to begin.<br/>
              Ask for reports, statistics, risk analysis, or visualizations.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: 9, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: msg.role === 'user' ? 'rgba(99,102,241,0.3)' : 'rgba(14,165,233,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {msg.role === 'user' ? <User size={13} color="#818cf8"/> : <Bot size={13} color="#38bdf8"/>}
            </div>
            <div style={{
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
              background: msg.role === 'user' ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.04)',
              border: msg.role === 'user' ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.07)',
            }}>
              {msg.role === 'user'
                ? <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6 }}>{msg.content}</div>
                : <MarkdownRenderer content={msg.content} />
              }
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(14,165,233,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={13} color="#38bdf8"/>
            </div>
            <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px 16px 16px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0,1,2].map(j => (
                <div key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8', animation: `bounce 1.2s ease-in-out ${j*0.2}s infinite` }}/>
              ))}
              <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
            </div>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
            <AlertCircle size={15} color="#f87171"/>
            <span style={{ flex: 1, fontSize: 12, color: '#fca5a5' }}>{error}</span>
            <button onClick={retry} style={{ fontSize: 11, color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={11}/> Retry
            </button>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Quick prompts */}
      {file && messages.length <= 1 && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 5, flexWrap: 'wrap', flexShrink: 0 }}>
          {QUICK_PROMPTS.map(p => (
            <button key={p.label} onClick={() => sendMessage(p.prompt)} disabled={loading}
              style={{ padding: '5px 11px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, color: '#a5b4fc', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0, background: 'rgba(0,0,0,0.25)' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder={file ? `Ask anything about ${file.name}… (Enter to send)` : 'Select a file first, or ask any research question…'}
          rows={1}
          style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e2e8f0', fontSize: 13, padding: '9px 12px', outline: 'none', fontFamily: 'inherit', resize: 'none', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }}
        />
        <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
          style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: loading || !input.trim() ? 'rgba(99,102,241,0.2)' : '#6366f1', border: 'none', color: '#fff', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }}/> : <Send size={14}/>}
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </button>
      </div>
    </div>
  )
}

// ── ML Stats Panel ────────────────────────────────────────────────────────────
function MLStatsPanel({ file, tableData }) {
  const dq = dataQuality(tableData)
  const [showAll, setShowAll] = useState(false)
  if (!file) return null

  const ft = fileType(file.name)
  const riskScore = file.riskScore ?? 0
  const riskLevel = file.riskLevel ?? 'unknown'
  const riskColor = riskLevel === 'critical' ? '#ef4444' : riskLevel === 'elevated' ? '#f59e0b' : riskLevel === 'low' ? '#10b981' : '#64748b'

  return (
    <div style={{ background: 'rgba(8,12,26,0.98)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* File header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 24 }}>{ft.label === 'PDF' ? '📄' : ft.label === 'CSV' || ft.label === 'Excel' ? '📊' : ft.label === 'JSON' ? '🗂️' : '📁'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: ft.bg, color: ft.color }}>{ft.label}</span>
            {riskLevel !== 'unknown' && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${riskColor}18`, color: riskColor }}>
                {riskLevel.toUpperCase()}
              </span>
            )}
            {dq && <span style={{ fontSize: 9, color: '#475569' }}>{dq.rows.toLocaleString()} rows · {dq.cols} cols</span>}
          </div>
        </div>
      </div>

      {/* Risk + quality bar */}
      {(riskScore > 0 || dq) && (
        <div style={{ display: 'grid', gridTemplateColumns: riskScore > 0 && dq ? '1fr 1fr' : '1fr', gap: 8 }}>
          {riskScore > 0 && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: `${riskColor}0e`, border: `1px solid ${riskColor}30` }}>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Score</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: riskColor }}>{riskScore.toFixed(0)}<span style={{ fontSize: 11, fontWeight: 400, color: '#475569' }}>/100</span></div>
              {file.violations > 0 && <div style={{ fontSize: 10, color: riskColor, marginTop: 2 }}>⚠️ {file.violations} violations</div>}
            </div>
          )}
          {dq && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Data Quality</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: dq.completeness >= 90 ? '#10b981' : dq.completeness >= 70 ? '#f59e0b' : '#ef4444' }}>{dq.completeness}%</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>completeness · {dq.missing} missing</div>
            </div>
          )}
        </div>
      )}

      {/* Violations */}
      {file.risk?.violations?.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={11} color="#f59e0b"/> Violations ({file.risk.violations.length})
          </div>
          {(showAll ? file.risk.violations : file.risk.violations.slice(0, 3)).map((v, i) => (
            <div key={i} style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 5, fontSize: 11, color: '#fca5a5' }}>
              <span style={{ fontWeight: 700 }}>{v.column}:</span> {v.issue}
            </div>
          ))}
          {file.risk.violations.length > 3 && (
            <button onClick={() => setShowAll(s => !s)} style={{ fontSize: 10, color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer' }}>
              {showAll ? 'Show less' : `+${file.risk.violations.length - 3} more violations`}
            </button>
          )}
        </div>
      )}

      {/* Column stats */}
      {file.stats?.col_stats && Object.keys(file.stats.col_stats).length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Column Statistics</div>
          {Object.entries(file.stats.col_stats).slice(0, 6).map(([col, stats]) => {
            const who = whoStatus(col, parseFloat(stats.mean))
            return (
              <div key={col} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{col}</div>
                  {who && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: who.bg, color: who.color }}>{who.label}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['μ', stats.mean?.toFixed(2)], ['σ', stats.std?.toFixed(2)], ['min', stats.min?.toFixed(2)], ['max', stats.max?.toFixed(2)]].map(([l, v]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase' }}>{l}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Auto charts */}
      {tableData && <AutoCharts tableData={tableData} />}

      {/* Download buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {file._file && (
          <button
            onClick={() => {
              const a = document.createElement('a')
              a.href = URL.createObjectURL(file._file)
              a.download = file.name; a.click()
            }}
            style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Download size={11}/> Download Original
          </button>
        )}
        {tableData?.rows?.length > 0 && (
          <button
            onClick={() => {
              const csv = [tableData.headers.join(','), ...tableData.rows.map(r => tableData.headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n')
              const a = document.createElement('a')
              a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
              a.download = `${file.name.replace(/\.[^.]+$/,'.csv')}`; a.click()
            }}
            style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Download size={11}/> Export CSV
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Reports page ──────────────────────────────────────────────────────────
export default function Reports() {
  const [files, setFiles] = useState([])
  const [uploaded, setUploaded] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [tableData, setTableData] = useState(null)
  // Persistent chat keyed by file id/name — survives tab switches
  const [chatHistory, setChatHistory] = useState({})
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'stats'

  const onDrop = useCallback(f => setFiles(p => [...p, ...f]), [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/json': ['.json'],
    },
  })

  const handleUpload = async () => {
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        const res = await axios.post(`${BACKEND}/upload`, formData, { timeout: 30000 })
        const d = res.data
        setUploaded(p => [...p, {
          id: d.id ?? Date.now() + Math.random(),
          name: d.filename ?? file.name,
          _file: file,
          riskScore: d.risk?.score ?? 0,
          riskLevel: d.risk?.level ?? 'unknown',
          violations: d.risk?.violations?.length ?? 0,
          anomalies: d.anomalies?.anomaly_rate ?? 0,
          stats: d.stats ?? {},
          risk: d.risk ?? {},
        }])
      } catch {
        // Backend unavailable — add for AI chat only
        setUploaded(p => [...p, {
          id: Date.now() + Math.random(),
          name: file.name,
          _file: file,
          riskScore: 0, riskLevel: 'unknown', violations: 0, anomalies: 0, stats: {}, risk: {},
        }])
      }
    }
    setFiles([])
    setUploading(false)
  }

  const handleSelectFile = async (file) => {
    setSelectedFile(file)
    setTableData(null)
    setSelectedText('')
    if (file._file) {
      setExtracting(true)
      try {
        const [text, tbl] = await Promise.all([
          extractText(file._file),
          parseTableData(file._file),
        ])
        setSelectedText(text)
        setTableData(tbl)
        // Init chat greeting if not yet started for this file
        if (!chatHistory[file.id]) {
          setChatHistory(h => ({
            ...h,
            [file.id]: [{
              role: 'assistant',
              content: `I've read **${file.name}**${tbl ? ` (${tbl.rows.length.toLocaleString()} rows · ${tbl.headers.length} columns)` : ` (${(file._file.size / 1024).toFixed(0)} KB)`}.\n\nAsk me anything — I can generate a full report, find key findings, run risk analysis, summarize, or answer specific questions about the data.`,
            }],
          }))
        }
      } catch { setSelectedText('') }
      setExtracting(false)
    }
  }

  const chatMessages = selectedFile ? (chatHistory[selectedFile.id] || []) : []
  const setChatMessages = (msgs) => {
    if (!selectedFile) return
    setChatHistory(h => ({ ...h, [selectedFile.id]: msgs }))
  }

  const tabs = [
    { id: 'chat',  label: '💬 AI Chat', badge: chatMessages.length > 1 ? chatMessages.length - 1 : null },
    { id: 'stats', label: '📊 ML Stats' },
  ]

  const totalFiles = uploaded.length + files.length

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #060a18 0%, #0c1428 50%, #080f22 100%)', padding: '24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FlaskConical size={24} color="#fff"/>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9' }}>Research Intelligence Workspace</div>
            <div style={{ fontSize: 12, color: '#475569' }}>Upload any file · ML analysis · AI chat · Auto charts · Export · 100% free</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {[
              { icon: '📊', label: 'Statistical Analysis', desc: 'WHO thresholds, outliers' },
              { icon: '🤖', label: 'ML Anomaly Detection', desc: 'IsolationForest' },
              { icon: '💬', label: 'AI Research Chat', desc: 'RAG + ML' },
            ].map(f => (
              <div key={f.label} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, textAlign: 'center', minWidth: 100 }}>
                <div style={{ fontSize: 16, marginBottom: 2 }}>{f.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{f.label}</div>
                <div style={{ fontSize: 9, color: '#334155' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>

          {/* ── LEFT: File Panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Drop zone */}
            <div
              {...getRootProps()}
              style={{
                padding: '24px 16px', borderRadius: 14,
                border: `2px dashed ${isDragActive ? '#6366f1' : 'rgba(255,255,255,0.12)'}`,
                background: isDragActive ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
              }}
            >
              <input {...getInputProps()}/>
              <Upload size={32} color={isDragActive ? '#818cf8' : '#334155'} style={{ margin: '0 auto 8px' }}/>
              <div style={{ fontSize: 13, fontWeight: 700, color: isDragActive ? '#a5b4fc' : '#64748b' }}>
                {isDragActive ? 'Drop it!' : 'Drag & drop files'}
              </div>
              <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>or click to select</div>
              <div style={{ fontSize: 10, color: '#1e293b', marginTop: 6 }}>PDF · CSV · XLSX · DOCX · TXT · JSON</div>
            </div>

            {/* Pending files */}
            {files.length > 0 && (
              <div style={{ padding: '12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc', marginBottom: 8 }}>📁 {files.length} file(s) ready</div>
                <div style={{ maxHeight: 100, overflowY: 'auto', marginBottom: 8 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, marginBottom: 3 }}>
                      <span style={{ color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <span style={{ color: '#334155', fontSize: 10, flexShrink: 0, marginLeft: 6 }}>{(f.size/1024).toFixed(0)}K</span>
                    </div>
                  ))}
                </div>
                <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '9px 0', background: uploading ? 'rgba(99,102,241,0.3)' : '#6366f1', border: 'none', borderRadius: 9, color: '#fff', fontSize: 12, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {uploading ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }}/> Uploading…</> : <><Upload size={13}/> Upload & Analyze</>}
                </button>
              </div>
            )}

            {/* File list */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Database size={11}/> Files ({uploaded.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                {uploaded.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#1e293b', fontSize: 12 }}>
                    No files yet.<br/>Upload to begin.
                  </div>
                ) : (
                  uploaded.map(file => {
                    const ft = fileType(file.name)
                    const isActive = selectedFile?.id === file.id
                    const hasChatHistory = (chatHistory[file.id]?.length ?? 0) > 1
                    return (
                      <div key={file.id} onClick={() => handleSelectFile(file)}
                        style={{
                          padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                          border: isActive ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)',
                          background: isActive ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? '#a5b4fc' : '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: ft.bg, color: ft.color }}>{ft.label}</span>
                              {hasChatHistory && <span style={{ fontSize: 9, color: '#475569' }}>💬 chat saved</span>}
                              {file.riskLevel !== 'unknown' && (
                                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, background: file.riskLevel === 'critical' ? 'rgba(239,68,68,0.15)' : file.riskLevel === 'elevated' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', color: file.riskLevel === 'critical' ? '#f87171' : file.riskLevel === 'elevated' ? '#fbbf24' : '#34d399', fontWeight: 700 }}>
                                  {file.riskLevel.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={e => {
                            e.stopPropagation()
                            setUploaded(p => p.filter(f => f.id !== file.id))
                            if (selectedFile?.id === file.id) { setSelectedFile(null); setSelectedText(''); setTableData(null) }
                          }} style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', padding: 3, flexShrink: 0 }}>
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Main workspace ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 0 }}>

            {/* Tab bar */}
            {selectedFile && (
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 14, flexShrink: 0 }}>
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    style={{ padding: '9px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: activeTab === t.id ? 700 : 400, color: activeTab === t.id ? '#a5b4fc' : '#475569', borderBottom: activeTab === t.id ? '2px solid #6366f1' : '2px solid transparent', transition: 'all 0.15s', position: 'relative' }}>
                    {t.label}
                    {t.badge && <span style={{ marginLeft: 5, fontSize: 9, background: 'rgba(99,102,241,0.3)', color: '#a5b4fc', padding: '1px 5px', borderRadius: 20 }}>{t.badge}</span>}
                  </button>
                ))}
              </div>
            )}

            {extracting ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#64748b', background: 'rgba(8,12,26,0.98)', borderRadius: 14, border: '1px solid rgba(99,102,241,0.2)', minHeight: 400 }}>
                <Loader size={28} color="#818cf8" style={{ animation: 'spin 1s linear infinite' }}/>
                <div style={{ fontSize: 13 }}>Reading {selectedFile?.name}…</div>
              </div>
            ) : activeTab === 'stats' && selectedFile ? (
              <MLStatsPanel file={selectedFile} tableData={tableData}/>
            ) : (
              <div style={{ flex: 1, minHeight: 600 }}>
                <AIChatDialog
                  file={selectedFile?._file ?? null}
                  fileText={selectedText}
                  tableData={tableData}
                  messages={chatMessages}
                  onMessages={setChatMessages}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
