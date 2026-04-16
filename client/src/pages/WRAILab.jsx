/**
 * WRAILab — AI/ML Intelligence Lab for Water Rangers Data
 * - Anomaly detection vs WHO thresholds
 * - Trend analysis with Recharts
 * - Research AI chat (paper writing, IEEE, summaries)
 * - CSV/report export
 * ALL real data from Water Rangers API
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ScatterChart, Scatter,
} from 'recharts'
import {
  Brain, TrendingUp, AlertTriangle, Send, RefreshCw, Download,
  Loader, BarChart2,
} from 'lucide-react'
import { getObservations } from '../api/waterRangers'
import api from '../utils/api'

// WHO thresholds
const WHO = {
  ph: { min: 6.5, max: 8.5, unit: '', label: 'pH' },
  water_temperature: { min: 0, max: 30, unit: '°C', label: 'Water Temp' },
  air_temperature: { min: -40, max: 50, unit: '°C', label: 'Air Temp' },
  oxygen: { min: 6, max: 20, unit: 'mg/L', label: 'Dissolved Oxygen' },
  dissolved_oxygen: { min: 6, max: 20, unit: 'mg/L', label: 'Dissolved Oxygen' },
  turbidity: { min: 0, max: 5, unit: 'NTU', label: 'Turbidity' },
  conductivity: { min: 0, max: 1500, unit: 'µS/cm', label: 'Conductivity' },
  nitrate: { min: 0, max: 10, unit: 'mg/L', label: 'Nitrate' },
  phosphorus: { min: 0, max: 0.03, unit: 'mg/L', label: 'Phosphorus' },
  phosphates: { min: 0, max: 0.1, unit: 'mg/L', label: 'Phosphates' },
  chlorine: { min: 0, max: 5, unit: 'mg/L', label: 'Chlorine' },
  hardness: { min: 0, max: 500, unit: 'ppm', label: 'Hardness' },
  alkalinity: { min: 20, max: 200, unit: 'ppm', label: 'Alkalinity' },
}

function findAnomalies(observations) {
  const anomalies = []
  for (const obs of observations) {
    for (const r of (obs.readings || [])) {
      const val = parseFloat(r.value)
      if (isNaN(val) || !r.unit || r.unit === 'nil') continue
      const param = (r.parameter || '').toLowerCase()
      const thresh = Object.entries(WHO).find(([k]) => param.includes(k))
      if (!thresh) continue
      const [, t] = thresh
      if (val < t.min || val > t.max) {
        anomalies.push({
          id: obs.id, date: obs.observed_at, location_id: obs.location_id,
          parameter: r.parameter, value: val, unit: r.unit,
          equipment: r.equipment || '—',
          threshold: `${t.min}–${t.max}`, label: t.label,
          severity: val < t.min * 0.5 || val > t.max * 1.5 ? 'critical' : 'warning',
        })
      }
    }
  }
  return anomalies
}

function computeTrends(observations) {
  const byParam = {}
  for (const obs of observations) {
    const date = obs.observed_at
    for (const r of (obs.readings || [])) {
      const val = parseFloat(r.value)
      if (isNaN(val) || !r.unit || r.unit === 'nil') continue
      const name = r.parameter
      if (!byParam[name]) byParam[name] = []
      byParam[name].push({ date, value: val, unit: r.unit })
    }
  }
  return Object.entries(byParam).map(([param, pts]) => {
    pts.sort((a, b) => new Date(a.date) - new Date(b.date))
    const vals = pts.map(p => p.value)
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
    const trend = vals.length >= 3 ? (vals[vals.length - 1] - vals[0]) / vals.length : 0
    return {
      parameter: param, count: pts.length, mean: +mean.toFixed(3), std: +std.toFixed(3),
      min: +Math.min(...vals).toFixed(3), max: +Math.max(...vals).toFixed(3),
      trend: trend > 0.01 ? 'increasing' : trend < -0.01 ? 'decreasing' : 'stable',
      unit: pts[0]?.unit || '', points: pts,
    }
  }).sort((a, b) => b.count - a.count)
}

// ── AI Chat with research focus ──────────────────────────────────────────────
function ResearchAI({ context }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const PRESETS = [
    { label: '📄 IEEE Abstract', prompt: 'Write an IEEE-format abstract summarizing the water quality findings from this dataset. Include key statistics, anomalies detected, and research significance.' },
    { label: '📊 Methodology', prompt: 'Generate a Methodology section for a research paper describing the data collection process, parameters measured, equipment used, and quality assurance workflow based on this Water Rangers dataset.' },
    { label: '🔍 Key Findings', prompt: 'Summarize the top 5 key findings from this water quality dataset. Cite specific values, anomalies, and trends. Format for inclusion in a research paper results section.' },
    { label: '⚠️ Anomaly Report', prompt: 'Generate a detailed anomaly report for this dataset. List each parameter that exceeded WHO/EPA thresholds, the severity, potential causes, and recommended follow-up actions.' },
    { label: '📈 Trend Summary', prompt: 'Analyze temporal trends in this dataset. Which parameters are increasing, decreasing, or stable? What are the implications for water quality management?' },
    { label: '🌊 Site Comparison', prompt: 'Compare the different monitoring sites in this dataset. Which sites show the best and worst water quality? What factors might explain the differences?' },
  ]

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      // Calls the WR Agent — fetches REAL data from Water Rangers, then sends to Gemini
      const { data } = await api.post('/wr/agent', { question: q, pages: 3 })
      const grounding = data.grounding
      const footer = `\n\n---\n*Grounded in ${grounding.observations} observations, ${grounding.locations} locations, ${grounding.anomalies} anomalies, ${grounding.totalReadings} readings — fetched live from Water Rangers*`
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer + footer }])
    } catch (e) {
      const msg = e.response?.data?.error || e.message
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    }
    setLoading(false)
  }

  return (
    <div>
      {/* Preset buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => send(p.prompt)} disabled={loading} style={{
            padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
            background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)',
            color: '#a78bfa', cursor: 'pointer',
          }}>{p.label}</button>
        ))}
      </div>

      {/* Chat */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ height: 380, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 30 }}>
              Use the presets above or ask anything about the data.<br />
              <span style={{ fontSize: 11, opacity: .6 }}>Generate IEEE paper sections, analyze anomalies, compare sites, summarize findings...</span>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%', padding: '10px 14px', borderRadius: 10,
              background: m.role === 'user' ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${m.role === 'user' ? 'rgba(99,102,241,.25)' : 'var(--border)'}`,
              color: 'var(--text)', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap',
            }}>{m.content}</div>
          ))}
          {loading && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}><Loader size={12} className="animate-spin" /> Fetching live Water Rangers data → analyzing → generating response...</div>}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about the data, request paper sections, compare sites..."
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
          <button onClick={() => send()} disabled={loading || !input.trim()} style={{
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: 'rgba(99,102,241,.12)', color: '#a78bfa', cursor: 'pointer',
          }}><Send size={13} /></button>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function WRAILab() {
  const [observations, setObservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('anomalies')
  const [selectedTrend, setSelectedTrend] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Load multiple pages for richer analysis
      const all = []
      for (let p = 1; p <= 5; p++) {
        const result = await getObservations({ page: p, perPage: 100 })
        const items = result.items || []
        if (items.length === 0) break
        all.push(...items)
        if (items.length < 100) break
      }
      setObservations(all)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const anomalies = useMemo(() => findAnomalies(observations), [observations])
  const trends = useMemo(() => computeTrends(observations), [observations])

  // Build context for AI
  const context = useMemo(() => {
    const readingCount = observations.reduce((s, o) => s + (o.readings || []).length, 0)
    const paramSet = new Set()
    observations.forEach(o => (o.readings || []).forEach(r => r.parameter && paramSet.add(r.parameter)))
    return `Dataset: ${observations.length} observations, ${readingCount} total readings, ${paramSet.size} unique parameters.\n\n` +
      `Anomalies (${anomalies.length}):\n${anomalies.slice(0, 20).map(a => `- ${a.label || a.parameter}: ${a.value} ${a.unit} (threshold: ${a.threshold}, severity: ${a.severity})`).join('\n')}\n\n` +
      `Trends (${trends.length} parameters):\n${trends.slice(0, 15).map(t => `- ${t.parameter}: mean=${t.mean} ${t.unit}, range=${t.min}-${t.max}, n=${t.count}, trend=${t.trend}`).join('\n')}\n\n` +
      `QA: ${observations.filter(o => o.checked === 'qc_complete').length} QC complete, ${observations.filter(o => o.checked === 'review_needed').length} review needed, ${observations.filter(o => o.checked === 'issue_found').length} issues found`
  }, [observations, anomalies, trends])

  // Export
  const exportCSV = () => {
    const rows = [['Date', 'Location', 'Parameter', 'Value', 'Unit', 'Equipment', 'Threshold', 'Severity']]
    anomalies.forEach(a => rows.push([a.date, a.location_id, a.parameter, a.value, a.unit, a.equipment, a.threshold, a.severity]))
    const csv = rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `anomaly-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  const TABS = [
    { id: 'anomalies', label: 'Anomaly Detection', icon: AlertTriangle, color: '#ef4444', count: anomalies.length },
    { id: 'trends', label: 'Trend Analysis', icon: TrendingUp, color: '#14b8a6', count: trends.length },
    { id: 'charts', label: 'Charts', icon: BarChart2, color: '#6366f1' },
    { id: 'ai', label: 'Research AI', icon: Brain, color: '#a78bfa' },
  ]

  return (
    <div style={{ minHeight: 'calc(100vh - 130px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={20} color="#a78bfa" /> AI Lab
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
            {observations.length} observations · {anomalies.length} anomalies · {trends.length} parameters tracked
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={exportCSV} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            background: 'rgba(20,184,166,.08)', border: '1px solid rgba(20,184,166,.2)',
            borderRadius: 8, color: '#14b8a6', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}><Download size={12} /> Anomaly CSV</button>
          <button onClick={load} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)',
            borderRadius: 8, color: '#a78bfa', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload</button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 8, marginBottom: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: 12 }}>
          <AlertTriangle size={13} style={{ marginRight: 6 }} />{error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
            background: tab === t.id ? `${t.color}12` : 'transparent',
            border: 'none', borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
            color: tab === t.id ? t.color : 'var(--text-muted)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            <t.icon size={13} /> {t.label}
            {t.count !== undefined && <span style={{ fontSize: 10, opacity: .6 }}>({t.count})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 8px' }} /> Loading & analyzing Water Rangers data...
        </div>
      ) : (
        <>
          {/* ── ANOMALIES ──────────────────────────────────────────── */}
          {tab === 'anomalies' && (
            <div style={{ overflowX: 'auto' }}>
              {anomalies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>No anomalies detected against WHO/EPA thresholds in {observations.length} observations</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Severity', 'Parameter', 'Value', 'Threshold', 'Equipment', 'Date'].map(h => (
                        <th key={h} style={{ padding: '8px 6px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 700, fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {anomalies.map((a, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px' }}>
                          <span style={{
                            padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                            background: a.severity === 'critical' ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.12)',
                            color: a.severity === 'critical' ? '#ef4444' : '#f59e0b',
                          }}>{a.severity}</span>
                        </td>
                        <td style={{ padding: '6px', color: 'var(--text)', fontWeight: 600 }}>{(a.label || a.parameter).replace(/_/g, ' ')}</td>
                        <td style={{ padding: '6px', color: '#ef4444', fontWeight: 700 }}>{a.value} {(a.unit || '').replace(/_/g, '/')}</td>
                        <td style={{ padding: '6px', color: 'var(--text-muted)' }}>{a.threshold}</td>
                        <td style={{ padding: '6px', color: 'var(--text-muted)', fontSize: 10 }}>{(a.equipment || '').replace(/_/g, ' ')}</td>
                        <td style={{ padding: '6px', color: 'var(--text-muted)' }}>{a.date ? new Date(a.date).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── TRENDS ─────────────────────────────────────────────── */}
          {tab === 'trends' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
              {trends.filter(t => t.count >= 2).map((t, i) => (
                <div key={i} onClick={() => setSelectedTrend(selectedTrend === i ? null : i)} style={{
                  background: 'var(--card-bg)', border: `1px solid ${selectedTrend === i ? 'rgba(99,102,241,.4)' : 'var(--border)'}`,
                  borderRadius: 10, padding: 12, cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700 }}>{t.parameter.replace(/_/g, ' ')}</span>
                    <span style={{
                      padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                      background: t.trend === 'increasing' ? 'rgba(239,68,68,.1)' : t.trend === 'decreasing' ? 'rgba(59,130,246,.1)' : 'rgba(16,185,129,.1)',
                      color: t.trend === 'increasing' ? '#ef4444' : t.trend === 'decreasing' ? '#3b82f6' : '#10b981',
                    }}>↕ {t.trend}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, fontSize: 10, marginBottom: 6 }}>
                    <div><div style={{ color: 'var(--text-muted)', fontSize: 9 }}>Mean</div><div style={{ color: 'var(--text)', fontWeight: 700 }}>{t.mean}</div></div>
                    <div><div style={{ color: 'var(--text-muted)', fontSize: 9 }}>Std Dev</div><div style={{ color: 'var(--text)', fontWeight: 600 }}>{t.std}</div></div>
                    <div><div style={{ color: 'var(--text-muted)', fontSize: 9 }}>Range</div><div style={{ color: 'var(--text)', fontWeight: 600 }}>{t.min}–{t.max}</div></div>
                    <div><div style={{ color: 'var(--text-muted)', fontSize: 9 }}>Samples</div><div style={{ color: 'var(--text)', fontWeight: 600 }}>{t.count}</div></div>
                  </div>
                  {/* Mini chart */}
                  {t.points.length >= 2 && (
                    <ResponsiveContainer width="100%" height={60}>
                      <LineChart data={t.points.map(p => ({ date: new Date(p.date).getTime(), value: p.value }))}>
                        <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── CHARTS ─────────────────────────────────────────────── */}
          {tab === 'charts' && (
            <div>
              {/* Parameter distribution */}
              <h3 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Parameter Value Distribution</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {trends.filter(t => t.count >= 3 && t.unit !== 'nil').slice(0, 6).map((t, i) => (
                  <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                    <h4 style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, margin: '0 0 8px' }}>
                      {t.parameter.replace(/_/g, ' ')} ({t.unit.replace(/_/g, '/')}) — {t.count} readings
                    </h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                        <XAxis dataKey="x" type="number" name="Date" tickFormatter={v => new Date(v).toLocaleDateString()} tick={{ fontSize: 9, fill: '#888' }} />
                        <YAxis dataKey="y" type="number" name={t.parameter} tick={{ fontSize: 9, fill: '#888' }} />
                        <Tooltip formatter={(v, n) => n === 'Date' ? new Date(v).toLocaleDateString() : v}
                          contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, fontSize: 11 }} />
                        <Scatter data={t.points.map(p => ({ x: new Date(p.date).getTime(), y: p.value }))} fill="#6366f1" r={3} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>

              {/* Anomaly severity breakdown */}
              {anomalies.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Anomalies by Parameter</h3>
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={(() => {
                        const counts = {}
                        anomalies.forEach(a => { counts[a.parameter] = (counts[a.parameter] || 0) + 1 })
                        return Object.entries(counts).map(([p, c]) => ({ parameter: p.replace(/_/g, ' '), count: c })).sort((a, b) => b.count - a.count)
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                        <XAxis dataKey="parameter" tick={{ fontSize: 9, fill: '#888' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#888' }} />
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, fontSize: 11 }} />
                        <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── RESEARCH AI ────────────────────────────────────────── */}
          {tab === 'ai' && <ResearchAI context={context} observations={observations} />}
        </>
      )}
    </div>
  )
}
