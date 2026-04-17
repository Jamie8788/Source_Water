/**
 * WRAILab — Site-specific AI Analysis Lab
 * 1. Pick a monitoring site from 9,444 locations
 * 2. Load ALL its observations
 * 3. Run anomaly detection + trends on THAT site
 * 4. Charts for THAT site
 * 5. Research AI grounded in THAT site's real data
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ScatterChart, Scatter,
} from 'recharts'
import {
  Brain, TrendingUp, AlertTriangle, Send, RefreshCw, Download,
  Loader, BarChart2, MapPin, Search, ExternalLink,
} from 'lucide-react'
import { getAllLocations, getLocationObservations } from '../api/waterRangers'
import api from '../utils/api'

// WHO thresholds
const WHO = {
  ph: { min: 6.5, max: 8.5, unit: '', label: 'pH', explain: 'Acidity/alkalinity' },
  water_temperature: { min: 0, max: 30, unit: '°C', label: 'Water Temp', explain: 'Affects oxygen & life' },
  oxygen: { min: 6, max: 20, unit: 'mg/L', label: 'Dissolved Oxygen', explain: 'Fish need >6' },
  dissolved_oxygen: { min: 6, max: 20, unit: 'mg/L', label: 'DO', explain: 'Aquatic life oxygen' },
  conductivity: { min: 0, max: 1500, unit: 'µS/cm', label: 'Conductivity', explain: 'Mineral/salt content' },
  hardness: { min: 0, max: 500, unit: 'ppm', label: 'Hardness', explain: 'Calcium + magnesium' },
  alkalinity: { min: 20, max: 200, unit: 'ppm', label: 'Alkalinity', explain: 'pH buffer capacity' },
  chlorine: { min: 0, max: 5, unit: 'mg/L', label: 'Chlorine', explain: 'Disinfectant level' },
  phosphates: { min: 0, max: 0.1, unit: 'mg/L', label: 'Phosphates', explain: 'Algae bloom risk' },
  phosphorus: { min: 0, max: 0.03, unit: 'mg/L', label: 'Phosphorus', explain: 'Nutrient pollution' },
  nitrate: { min: 0, max: 10, unit: 'mg/L', label: 'Nitrate', explain: 'Fertilizer/sewage' },
}

function analyze(observations) {
  const anomalies = []
  const byParam = {}
  const qaBreakdown = {}

  for (const obs of observations) {
    qaBreakdown[obs.checked] = (qaBreakdown[obs.checked] || 0) + 1
    for (const r of (obs.readings || [])) {
      const val = parseFloat(r.value)
      if (isNaN(val) || !r.unit || r.unit === 'nil') continue
      const param = r.parameter
      if (!byParam[param]) byParam[param] = []
      byParam[param].push({ date: obs.observed_at, value: val, unit: r.unit, equipment: r.equipment })

      const thresh = Object.entries(WHO).find(([k]) => param.toLowerCase().includes(k))
      if (thresh) {
        const [, t] = thresh
        if (val < t.min || val > t.max) {
          anomalies.push({ param, value: val, unit: r.unit, threshold: `${t.min}–${t.max}`, date: obs.observed_at, equipment: r.equipment, severity: val < t.min * 0.5 || val > t.max * 1.5 ? 'critical' : 'warning', explain: t.explain })
        }
      }
    }
  }

  const trends = Object.entries(byParam).map(([param, pts]) => {
    pts.sort((a, b) => new Date(a.date) - new Date(b.date))
    const vals = pts.map(p => p.value)
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
    const trend = vals.length >= 3 ? (vals[vals.length - 1] - vals[0]) / vals.length : 0
    return {
      param, count: pts.length, mean: +mean.toFixed(3), std: +std.toFixed(3),
      min: +Math.min(...vals).toFixed(3), max: +Math.max(...vals).toFixed(3),
      trend: trend > 0.01 ? 'increasing' : trend < -0.01 ? 'decreasing' : 'stable',
      unit: pts[0]?.unit || '', points: pts, equipment: pts[0]?.equipment,
    }
  }).sort((a, b) => b.count - a.count)

  return { anomalies, trends, qaBreakdown, totalReadings: Object.values(byParam).reduce((s, p) => s + p.length, 0) }
}

// ── Research AI Chat ─────────────────────────────────────────────────────────
function ResearchAI({ site, observations, analysis }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const PRESETS = [
    { label: '📄 IEEE Abstract', prompt: `Write an IEEE-format abstract about water quality at ${site?.name}. Use the real data provided.` },
    { label: '📊 Methodology', prompt: `Write a Methodology section for a research paper about monitoring ${site?.name}. Include data collection methods, parameters, equipment, and QA process.` },
    { label: '🔍 Key Findings', prompt: `List the top 5 findings from the ${site?.name} dataset. Cite specific values, dates, and anomalies.` },
    { label: '⚠️ Anomaly Report', prompt: `Generate a detailed anomaly report for ${site?.name}. What exceeded WHO thresholds? What are the likely causes and recommended actions?` },
    { label: '📈 Trend Report', prompt: `Analyze all parameter trends at ${site?.name}. Which are improving, worsening, or stable? What does this mean for water quality?` },
    { label: '🏠 Community Summary', prompt: `Write a simple, non-technical summary of water quality at ${site?.name} that a community member with no science background can understand. Is the water safe? What should they know?` },
  ]

  // Build REAL context from THIS site's actual loaded data
  const siteContext = useMemo(() => {
    if (!site || !observations.length) return ''
    const a = analysis
    return `
=== REAL DATA FOR: ${site.name} ===
Location: ${site.name}, ${site.body_of_water || ''}, ${(site.water_body_type||'').replace(/_/g,' ')}, ${site.country}
Coordinates: ${site.latitude}, ${site.longitude}
Parameters tested: ${(site.tested_parameters||[]).join(', ')}
Equipment: ${(site.tested_equipment||[]).join(', ')}
First observation: ${site.first_observation_at || '?'}
Last observation: ${site.last_observation_at || '?'}

Total observations loaded: ${observations.length}
Total readings: ${a.totalReadings}
Anomalies detected: ${a.anomalies.length}
QA breakdown: ${Object.entries(a.qaBreakdown).map(([k,v])=>`${k}: ${v}`).join(', ')}

ANOMALIES (${a.anomalies.length}):
${a.anomalies.map(x => `- ${x.param}: ${x.value} ${x.unit} (safe: ${x.threshold}) on ${x.date?.slice(0,10)} — ${x.explain}`).join('\n') || 'None'}

PARAMETER TRENDS (${a.trends.length}):
${a.trends.map(t => `- ${t.param}: mean=${t.mean} ${t.unit}, range=${t.min}-${t.max}, n=${t.count}, trend=${t.trend}`).join('\n')}

IMPORTANT: This is REAL data loaded directly from Water Rangers API for this specific site. Only cite these actual numbers. Do not make up data.`
  }, [site, observations, analysis])

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      // Send site-specific real data directly to Gemini via agent
      const { data } = await api.post('/wr/agent', {
        question: q,
        siteContext, // pass the real site data
        siteName: site.name,
      })
      const footer = `\n\n---\n*Based on ${observations.length} real observations at ${site.name} (${analysis.totalReadings} readings, ${analysis.anomalies.length} anomalies)*`
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer + footer }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.response?.data?.error || e.message}` }])
    }
    setLoading(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => send(p.prompt)} disabled={loading} style={{
            padding: '4px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
            background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.12)',
            color: '#a78bfa', cursor: 'pointer',
          }}>{p.label}</button>
        ))}
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ height: 350, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {messages.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>Ask anything about <strong>{site?.name}</strong> — the AI has access to all its real data</div>}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%', padding: '8px 12px', borderRadius: 10,
              background: m.role === 'user' ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${m.role === 'user' ? 'rgba(99,102,241,.25)' : 'var(--border)'}`,
              color: 'var(--text)', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap',
            }}>{m.content}</div>
          ))}
          {loading && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}><Loader size={12} className="animate-spin" /> Analyzing {site?.name} data...</div>}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={`Ask about ${site?.name}...`}
            style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
          <button onClick={() => send()} disabled={loading || !input.trim()} style={{
            padding: '7px 12px', borderRadius: 8, border: 'none', background: 'rgba(99,102,241,.12)', color: '#a78bfa', cursor: 'pointer',
          }}><Send size={13} /></button>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function WRAILab() {
  const [locations, setLocations] = useState([])
  const [locsLoading, setLocsLoading] = useState(true)
  const [locSearch, setLocSearch] = useState('')
  const [selectedSite, setSelectedSite] = useState(null)
  const [observations, setObservations] = useState([])
  const [obsLoading, setObsLoading] = useState(false)
  const [tab, setTab] = useState('anomalies')
  const [error, setError] = useState(null)

  // Load locations
  useEffect(() => {
    getAllLocations().then(l => { setLocations(l); setLocsLoading(false) }).catch(() => setLocsLoading(false))
  }, [])

  // When site selected, load ALL its observations
  useEffect(() => {
    if (!selectedSite) { setObservations([]); return }
    setObsLoading(true); setError(null)
    ;(async () => {
      const all = []
      for (let page = 1; page <= 20; page++) {
        try {
          const result = await getLocationObservations(selectedSite.id, { page, perPage: 100 })
          const items = Array.isArray(result) ? result : result.observations || result.data || []
          if (items.length === 0) break
          all.push(...items)
          if (items.length < 100) break
        } catch { break }
      }
      setObservations(all)
    })().catch(e => setError(e.message)).finally(() => setObsLoading(false))
  }, [selectedSite])

  const analysis = useMemo(() => analyze(observations), [observations])
  const { anomalies, trends } = analysis

  const filteredLocs = useMemo(() => {
    if (!locSearch) return locations.slice(0, 50)
    const s = locSearch.toLowerCase()
    return locations.filter(l => (l.name || '').toLowerCase().includes(s) || (l.body_of_water || '').toLowerCase().includes(s) || (l.country || '').toLowerCase().includes(s)).slice(0, 50)
  }, [locations, locSearch])

  // CSV export
  const exportCSV = () => {
    if (!selectedSite || anomalies.length === 0) return
    const rows = [['Site', 'Severity', 'Parameter', 'Value', 'Unit', 'Threshold', 'Why It Matters', 'Equipment', 'Date']]
    anomalies.forEach(a => rows.push([selectedSite.name, a.severity, a.param, a.value, a.unit, a.threshold, a.explain || '', a.equipment || '', a.date || '']))
    const csv = rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${selectedSite.name}-anomaly-report.csv`; a.click()
  }

  const TABS = [
    { id: 'anomalies', label: 'Anomaly Detection', icon: AlertTriangle, color: '#ef4444', count: anomalies.length },
    { id: 'trends', label: 'Trends', icon: TrendingUp, color: '#14b8a6', count: trends.length },
    { id: 'charts', label: 'Charts', icon: BarChart2, color: '#6366f1' },
    { id: 'ai', label: 'Research AI', icon: Brain, color: '#a78bfa' },
  ]

  return (
    <div style={{ minHeight: 'calc(100vh - 130px)' }}>
      <div style={{ marginBottom: 10 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={20} color="#a78bfa" /> AI Lab
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
          Pick a monitoring site → get full analysis, anomalies, trends, and AI-powered research
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedSite ? '260px 1fr' : '1fr', gap: 12 }}>
        {/* Location picker */}
        <div>
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={locSearch} onChange={e => setLocSearch(e.target.value)} placeholder="Search sites..."
              style={{ width: '100%', padding: '7px 8px 7px 26px', borderRadius: 8, fontSize: 11, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          {locsLoading ? (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 11 }}><RefreshCw size={13} className="animate-spin" /> Loading sites...</div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {filteredLocs.map(loc => (
                <div key={loc.id} onClick={() => { setSelectedSite(loc); setTab('anomalies') }} style={{
                  padding: '7px 8px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                  background: selectedSite?.id === loc.id ? 'rgba(99,102,241,.12)' : 'var(--card-bg)',
                  border: `1px solid ${selectedSite?.id === loc.id ? 'rgba(99,102,241,.3)' : 'var(--border)'}`,
                }}>
                  <div style={{ color: 'var(--text)', fontSize: 11, fontWeight: 600 }}>{loc.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {loc.country} · {(loc.water_body_type || '').replace(/_/g, ' ')} · {(loc.tested_parameters || []).length} params
                  </div>
                </div>
              ))}
              {!locSearch && <div style={{ padding: 6, fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>Search {locations.length.toLocaleString()} sites</div>}
            </div>
          )}
        </div>

        {/* Analysis panel */}
        {selectedSite && (
          <div>
            {/* Site header */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 800, margin: 0 }}>
                  <MapPin size={14} style={{ marginRight: 4 }} />{selectedSite.name}
                </h3>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {selectedSite.body_of_water} · {(selectedSite.water_body_type || '').replace(/_/g, ' ')} · {selectedSite.country}
                </div>
                {obsLoading ? (
                  <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 2 }}><RefreshCw size={10} className="animate-spin" /> Loading all observations...</div>
                ) : (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {observations.length} observations · {analysis.totalReadings} readings · {anomalies.length} anomalies · {trends.length} parameters
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', background: 'rgba(20,184,166,.06)', border: '1px solid rgba(20,184,166,.12)', borderRadius: 6, color: '#14b8a6', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                  <Download size={10} /> CSV
                </button>
                {selectedSite.permalink && (
                  <a href={selectedSite.permalink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.12)', borderRadius: 6, color: '#a78bfa', fontSize: 10, fontWeight: 600, textDecoration: 'none' }}>
                    <ExternalLink size={10} /> WR
                  </a>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                  background: tab === t.id ? `${t.color}12` : 'transparent',
                  border: 'none', borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
                  color: tab === t.id ? t.color : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>
                  <t.icon size={12} /> {t.label}
                  {t.count !== undefined && <span style={{ fontSize: 9, opacity: .6 }}>({t.count})</span>}
                </button>
              ))}
            </div>

            {obsLoading ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}><RefreshCw size={16} className="animate-spin" style={{ margin: '0 auto 6px' }} /> Loading observations for {selectedSite.name}...</div>
            ) : observations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>No observations found for this site</div>
            ) : (
              <>
                {/* ANOMALIES */}
                {tab === 'anomalies' && (
                  anomalies.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#10b981', fontSize: 13 }}>✅ No anomalies at {selectedSite.name} — all readings within WHO thresholds</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            {['Severity', 'Parameter', 'Value', 'Safe Range', 'Why It Matters', 'Equipment', 'Date'].map(h => (
                              <th key={h} style={{ padding: '6px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 700, fontSize: 10 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {anomalies.map((a, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '5px' }}><span style={{ padding: '1px 6px', borderRadius: 5, fontSize: 9, fontWeight: 700, background: a.severity === 'critical' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)', color: a.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>{a.severity}</span></td>
                              <td style={{ padding: '5px', color: 'var(--text)', fontWeight: 600 }}>{a.param.replace(/_/g, ' ')}</td>
                              <td style={{ padding: '5px', color: '#ef4444', fontWeight: 700 }}>{a.value} {(a.unit || '').replace(/_/g, '/')}</td>
                              <td style={{ padding: '5px', color: 'var(--text-muted)' }}>{a.threshold}</td>
                              <td style={{ padding: '5px', color: 'var(--text-muted)', fontSize: 10 }}>{a.explain || ''}</td>
                              <td style={{ padding: '5px', color: 'var(--text-muted)', fontSize: 9 }}>{(a.equipment || '').replace(/_/g, ' ').slice(0, 30)}</td>
                              <td style={{ padding: '5px', color: 'var(--text-muted)' }}>{a.date ? new Date(a.date).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* TRENDS */}
                {tab === 'trends' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
                    {trends.filter(t => t.count >= 2).map((t, i) => (
                      <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700 }}>{t.param.replace(/_/g, ' ')}</span>
                          <span style={{ padding: '2px 6px', borderRadius: 5, fontSize: 9, fontWeight: 700, background: t.trend === 'increasing' ? 'rgba(239,68,68,.08)' : t.trend === 'decreasing' ? 'rgba(59,130,246,.08)' : 'rgba(16,185,129,.08)', color: t.trend === 'increasing' ? '#ef4444' : t.trend === 'decreasing' ? '#3b82f6' : '#10b981' }}>
                            {t.trend === 'increasing' ? '📈' : t.trend === 'decreasing' ? '📉' : '➡️'} {t.trend}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                          {t.count} readings at {selectedSite.name} · {t.unit.replace(/_/g, '/')}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, fontSize: 10, marginBottom: 4 }}>
                          <div><div style={{ fontSize: 8, color: 'var(--text-muted)' }}>Mean</div><div style={{ color: 'var(--text)', fontWeight: 700 }}>{t.mean}</div></div>
                          <div><div style={{ fontSize: 8, color: 'var(--text-muted)' }}>Std</div><div style={{ color: 'var(--text)' }}>{t.std}</div></div>
                          <div><div style={{ fontSize: 8, color: 'var(--text-muted)' }}>Range</div><div style={{ color: 'var(--text)' }}>{t.min}–{t.max}</div></div>
                          <div><div style={{ fontSize: 8, color: 'var(--text-muted)' }}>N</div><div style={{ color: 'var(--text)' }}>{t.count}</div></div>
                        </div>
                        {t.points.length >= 2 && (
                          <ResponsiveContainer width="100%" height={60}>
                            <LineChart data={t.points.map(p => ({ x: new Date(p.date).getTime(), y: p.value }))}>
                              <Line type="monotone" dataKey="y" stroke="#6366f1" strokeWidth={1.5} dot={{ r: 2 }} />
                              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, fontSize: 10 }}
                                formatter={v => [v, t.param.replace(/_/g, ' ')]} labelFormatter={v => new Date(v).toLocaleDateString()} />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* CHARTS */}
                {tab === 'charts' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {trends.filter(t => t.count >= 3 && t.unit !== 'nil').slice(0, 8).map((t, i) => (
                      <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                        <h4 style={{ color: 'var(--text)', fontSize: 11, fontWeight: 700, margin: '0 0 6px' }}>
                          {t.param.replace(/_/g, ' ')} ({t.unit.replace(/_/g, '/')}) — {t.count} readings at {selectedSite.name}
                        </h4>
                        <ResponsiveContainer width="100%" height={140}>
                          <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
                            <XAxis dataKey="x" type="number" tickFormatter={v => new Date(v).toLocaleDateString()} tick={{ fontSize: 8, fill: '#888' }} />
                            <YAxis dataKey="y" type="number" tick={{ fontSize: 8, fill: '#888' }} />
                            <Tooltip formatter={(v, n) => n === 'x' ? new Date(v).toLocaleDateString() : v}
                              contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, fontSize: 10 }} />
                            <Scatter data={t.points.map(p => ({ x: new Date(p.date).getTime(), y: p.value }))} fill="#6366f1" r={3} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                )}

                {/* RESEARCH AI */}
                {tab === 'ai' && <ResearchAI site={selectedSite} observations={observations} analysis={analysis} />}
              </>
            )}
          </div>
        )}

        {/* No site selected */}
        {!selectedSite && !locsLoading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <Brain size={32} style={{ margin: '0 auto 10px', opacity: .3 }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>Select a monitoring site to analyze</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Search from {locations.length.toLocaleString()} sites — get anomalies, trends, charts, and AI research</div>
          </div>
        )}
      </div>
    </div>
  )
}
