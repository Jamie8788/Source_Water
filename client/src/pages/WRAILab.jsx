/**
 * WRAILab — AI/ML Intelligence Lab
 * Real analysis on Water Rangers data
 * - Anomaly detection on observations
 * - Trend analysis across parameters
 * - AI-powered dataset summaries
 * - Report/paper generation
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Brain, TrendingUp, AlertTriangle, Send,
  RefreshCw, Download, Loader,
} from 'lucide-react'
import { getObservations } from '../api/waterRangers'
import { askAI } from '../utils/openrouter'

// ── WHO Water Quality Thresholds ─────────────────────────────────────────────
const THRESHOLDS = {
  ph: { min: 6.5, max: 8.5, unit: '', label: 'pH' },
  temperature: { min: 0, max: 30, unit: '°C', label: 'Temperature' },
  dissolved_oxygen: { min: 6, max: 20, unit: 'mg/L', label: 'Dissolved Oxygen' },
  turbidity: { min: 0, max: 5, unit: 'NTU', label: 'Turbidity' },
  conductivity: { min: 0, max: 1500, unit: 'µS/cm', label: 'Conductivity' },
  nitrate: { min: 0, max: 10, unit: 'mg/L', label: 'Nitrate' },
  phosphorus: { min: 0, max: 0.03, unit: 'mg/L', label: 'Phosphorus' },
}

function findAnomalies(observations) {
  const anomalies = []
  for (const obs of observations) {
    const readings = obs.readings || obs.tested_parameters || []
    for (const r of readings) {
      const param = (r.parameter || r.name || '').toLowerCase().replace(/\s+/g, '_')
      const val = parseFloat(r.value)
      if (isNaN(val)) continue
      const thresh = Object.entries(THRESHOLDS).find(([k]) => param.includes(k))
      if (thresh) {
        const [, t] = thresh
        if (val < t.min || val > t.max) {
          anomalies.push({
            observation_id: obs.id,
            date: obs.observed_at,
            location: obs.location?.name || obs.location_name || '?',
            parameter: r.parameter || r.name,
            value: val,
            unit: r.unit || t.unit,
            threshold: `${t.min}–${t.max}`,
            severity: val < t.min * 0.5 || val > t.max * 1.5 ? 'critical' : 'warning',
          })
        }
      }
    }
  }
  return anomalies
}

function computeTrends(observations) {
  const byParam = {}
  for (const obs of observations) {
    const readings = obs.readings || obs.tested_parameters || []
    const date = obs.observed_at || obs.created_at
    for (const r of readings) {
      const name = r.parameter || r.name
      if (!name) continue
      const val = parseFloat(r.value)
      if (isNaN(val)) continue
      if (!byParam[name]) byParam[name] = []
      byParam[name].push({ date, value: val, unit: r.unit })
    }
  }

  return Object.entries(byParam).map(([param, points]) => {
    points.sort((a, b) => new Date(a.date) - new Date(b.date))
    const values = points.map(p => p.value)
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
    const trend = values.length >= 3 ? (values[values.length - 1] - values[0]) / values.length : 0
    return {
      parameter: param,
      count: points.length,
      mean: mean.toFixed(2),
      std: std.toFixed(2),
      min: Math.min(...values).toFixed(2),
      max: Math.max(...values).toFixed(2),
      trend: trend > 0.01 ? 'increasing' : trend < -0.01 ? 'decreasing' : 'stable',
      trendValue: trend.toFixed(4),
      unit: points[0]?.unit || '',
    }
  }).sort((a, b) => b.count - a.count)
}

// ── AI Chat ──────────────────────────────────────────────────────────────────
function AIChat({ context }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      const systemMsg = `You are a water quality research assistant. You have access to the following Water Rangers data context:\n\n${context}\n\nProvide scientific analysis, identify patterns, suggest methodology improvements, and help generate research-quality summaries. Be precise and cite specific data points. Format for academic use when asked.`
      const reply = await askAI([
        { role: 'system', content: systemMsg },
        ...messages.slice(-8),
        { role: 'user', content: q },
      ])
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }])
    }
    setLoading(false)
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Brain size={14} color="#a78bfa" />
        <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700 }}>Research AI Assistant</span>
      </div>
      <div style={{ height: 280, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>
            Ask about the data — anomalies, trends, methodology, or generate a research summary
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%', padding: '8px 12px', borderRadius: 10,
            background: m.role === 'user' ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.04)',
            border: `1px solid ${m.role === 'user' ? 'rgba(99,102,241,.3)' : 'var(--border)'}`,
            color: 'var(--text)', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap',
          }}>{m.content}</div>
        ))}
        {loading && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}><Loader size={12} className="animate-spin" /> Analyzing...</div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about this data..."
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12,
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            color: 'var(--text)', outline: 'none',
          }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{
          padding: '8px 14px', borderRadius: 8, border: 'none',
          background: 'rgba(99,102,241,.15)', color: '#a78bfa',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
        }}><Send size={13} /></button>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function WRAILab() {
  const [observations, setObservations] = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [trends, setTrends] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('anomalies')

  const load = useCallback(async () => {
    // API key is server-side
    setLoading(true); setError(null)
    try {
      const result = await getObservations({ page: 1, perPage: 100 })
      const obs = result.items || []
      setObservations(obs)
      setAnomalies(findAnomalies(obs))
      setTrends(computeTrends(obs))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const contextSummary = `${observations.length} observations analyzed. ${anomalies.length} anomalies found. ${trends.length} parameters tracked.\n\nAnomalies:\n${anomalies.slice(0, 10).map(a => `- ${a.parameter}: ${a.value}${a.unit} at ${a.location} (threshold: ${a.threshold})`).join('\n')}\n\nTrend Summary:\n${trends.slice(0, 10).map(t => `- ${t.parameter}: mean=${t.mean}, trend=${t.trend}, n=${t.count}`).join('\n')}`

  const exportCSV = () => {
    const rows = [['Parameter', 'Location', 'Value', 'Unit', 'Threshold', 'Severity', 'Date']]
    anomalies.forEach(a => rows.push([a.parameter, a.location, a.value, a.unit, a.threshold, a.severity, a.date]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'water-rangers-anomalies.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const TABS = [
    { id: 'anomalies', label: 'Anomaly Detection', icon: AlertTriangle, color: '#ef4444', count: anomalies.length },
    { id: 'trends', label: 'Trend Analysis', icon: TrendingUp, color: '#14b8a6', count: trends.length },
    { id: 'ai', label: 'Research AI', icon: Brain, color: '#a78bfa' },
  ]

  return (
    <div style={{ minHeight: 'calc(100vh - 130px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={22} color="#a78bfa" /> AI Lab
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            ML analysis on real Water Rangers data · {observations.length} observations loaded
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={exportCSV} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px',
            background: 'rgba(20,184,166,.1)', border: '1px solid rgba(20,184,166,.25)',
            borderRadius: 8, color: '#14b8a6', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}><Download size={12} /> Export CSV</button>
          <button onClick={load} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px',
            background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.25)',
            borderRadius: 8, color: '#a78bfa', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload</button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, marginBottom: 14, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#fca5a5', fontSize: 12 }}>
          <AlertTriangle size={13} style={{ marginRight: 6 }} />{error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px',
            background: tab === t.id ? `${t.color}12` : 'transparent',
            border: 'none', borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
            color: tab === t.id ? t.color : 'var(--text-muted)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            <t.icon size={13} /> {t.label}
            {t.count !== undefined && <span style={{ fontSize: 10, opacity: .7 }}>({t.count})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} /> Analyzing data...
        </div>
      ) : (
        <>
          {/* Anomalies */}
          {tab === 'anomalies' && (
            <div>
              {anomalies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>No anomalies detected against WHO thresholds</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Severity', 'Parameter', 'Value', 'Threshold', 'Location', 'Date'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {anomalies.map((a, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                              background: a.severity === 'critical' ? 'rgba(239,68,68,.15)' : 'rgba(245,158,11,.15)',
                              color: a.severity === 'critical' ? '#ef4444' : '#f59e0b',
                            }}>{a.severity}</span>
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--text)', fontWeight: 600 }}>{a.parameter}</td>
                          <td style={{ padding: '8px 10px', color: '#ef4444', fontWeight: 700 }}>{a.value} {a.unit}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{a.threshold} {a.unit}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{a.location}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{a.date ? new Date(a.date).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Trends */}
          {tab === 'trends' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {trends.map((t, i) => (
                <div key={i} style={{
                  background: 'var(--card-bg)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: 14,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700 }}>{t.parameter}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                      background: t.trend === 'increasing' ? 'rgba(239,68,68,.12)' : t.trend === 'decreasing' ? 'rgba(59,130,246,.12)' : 'rgba(16,185,129,.12)',
                      color: t.trend === 'increasing' ? '#ef4444' : t.trend === 'decreasing' ? '#3b82f6' : '#10b981',
                    }}>↕ {t.trend}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11 }}>
                    <div><div style={{ color: 'var(--text-muted)', fontSize: 9 }}>Mean</div><div style={{ color: 'var(--text)', fontWeight: 700 }}>{t.mean} {t.unit}</div></div>
                    <div><div style={{ color: 'var(--text-muted)', fontSize: 9 }}>Range</div><div style={{ color: 'var(--text)', fontWeight: 600 }}>{t.min}–{t.max}</div></div>
                    <div><div style={{ color: 'var(--text-muted)', fontSize: 9 }}>Samples</div><div style={{ color: 'var(--text)', fontWeight: 600 }}>{t.count}</div></div>
                  </div>
                </div>
              ))}
              {trends.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
                  No trend data available yet
                </div>
              )}
            </div>
          )}

          {/* AI Chat */}
          {tab === 'ai' && <AIChat context={contextSummary} />}
        </>
      )}
    </div>
  )
}
