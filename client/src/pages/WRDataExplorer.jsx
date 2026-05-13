/**
 * WRDataExplorer — Location-first Water Rangers Data Explorer
 * Tab 1: Pick a location → see its observations with safety colors + plain English
 * Tab 2: All datasets with filters
 * Tab 3: Organizations
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Database, Eye, RefreshCw, AlertTriangle,
  ExternalLink, Camera, Building2, Download, MapPin, Search,
  Sparkles, Send, X,
} from 'lucide-react'
import { getDatasets, getOrganizations, getAllLocations, getLocationObservations, getDatasetObservations, QA_STATUS } from '../api/waterRangers'
import api from '../utils/api'

// Plain English + safety for readings
const PARAM_INFO = {
  ph: { emoji: '🧪', safe: '6.5–8.5', explain: 'How acidic or basic. Outside 6.5–8.5 harms aquatic life.' },
  oxygen: { emoji: '💨', safe: '>6 mg/L', explain: 'Fish need at least 6 mg/L to survive.' },
  dissolved_oxygen: { emoji: '💨', safe: '>6 mg/L', explain: 'Oxygen for aquatic life. Below 6 is dangerous.' },
  conductivity: { emoji: '⚡', safe: '<1500 µS/cm', explain: 'Mineral/salt content. High = possible pollution.' },
  turbidity: { emoji: '👁️', safe: '<5 NTU', explain: 'Water cloudiness. Clearer = healthier.' },
  water_temperature: { emoji: '🌡️', safe: 'varies', explain: 'Warmer water holds less oxygen.' },
  air_temperature: { emoji: '🌡️', safe: '—', explain: 'Air temp when sampled.' },
  chlorine: { emoji: '🧴', safe: '0–5 mg/L', explain: 'Disinfectant. Should be present but not too high.' },
  hardness: { emoji: '💎', safe: '<500 ppm', explain: 'Calcium & magnesium. Very hard affects taste.' },
  alkalinity: { emoji: '🛡️', safe: '20–200 ppm', explain: 'Buffering capacity. Low = vulnerable to acid rain.' },
  phosphates: { emoji: '🌿', safe: '<0.1 mg/L', explain: 'Too much causes algae blooms that kill fish.' },
  phosphorus: { emoji: '🌿', safe: '<0.03 mg/L', explain: 'Even small amounts trigger algae blooms.' },
  nitrate: { emoji: '🌱', safe: '<10 mg/L', explain: 'From fertilizers/sewage. High = unsafe drinking.' },
  secchi_depth: { emoji: '📏', safe: 'deeper=clearer', explain: 'How far you can see down.' },
  chlorophyll_a: { emoji: '🟢', safe: '<10 µg/L', explain: 'Algae levels. High = potential bloom.' },
}

function getParamInfo(param) {
  const key = (param || '').toLowerCase().replace(/\s+/g, '_')
  return PARAM_INFO[key] || { emoji: '📋', safe: '—', explain: '' }
}

function getSafetyColor(param, value) {
  const val = parseFloat(value)
  if (isNaN(val)) return '#94a3b8'
  const key = (param || '').toLowerCase()
  if (key.includes('ph')) return (val >= 6.5 && val <= 8.5) ? '#10b981' : '#ef4444'
  if (key.includes('oxygen')) return val >= 6 ? '#10b981' : val >= 4 ? '#f59e0b' : '#ef4444'
  if (key.includes('conductivity')) return val <= 1500 ? '#10b981' : '#f59e0b'
  if (key.includes('phosphat') || key.includes('phosphorus')) return val <= 0.1 ? '#10b981' : '#ef4444'
  if (key.includes('turbidity')) return val <= 5 ? '#10b981' : '#f59e0b'
  if (key.includes('hardness')) return val <= 500 ? '#10b981' : '#f59e0b'
  if (key.includes('alkalinity')) return (val >= 20 && val <= 200) ? '#10b981' : '#f59e0b'
  if (key.includes('nitrate')) return val <= 10 ? '#10b981' : '#ef4444'
  return '#6366f1'
}

const TABS = [
  { id: 'observations', label: 'Observations', icon: Eye, color: '#6366f1' },
  { id: 'datasets', label: 'Datasets', icon: Database, color: '#14b8a6' },
  { id: 'organizations', label: 'Organizations', icon: Building2, color: '#f59e0b' },
]

export default function WRDataExplorer() {
  const [tab, setTab] = useState('observations')

  // Observations: location-first
  const [locations, setLocations] = useState([])
  const [locsLoading, setLocsLoading] = useState(true)
  const [locSearch, setLocSearch] = useState('')
  const [selectedLoc, setSelectedLoc] = useState(null)
  const [locObs, setLocObs] = useState([])
  const [locObsLoading, setLocObsLoading] = useState(false)
  const [expandedObs, setExpandedObs] = useState(null)

  // Datasets + orgs
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dsSearch, setDsSearch] = useState('')
  const [dsStatusFilter, setDsStatusFilter] = useState('')

  // ── AI contextual analysis (Datasets tab only) ─────────────────────────
  // The original Datasets tab just rendered cards — no way to actually
  // *use* the data without leaving for waterrangers.ca (where you also
  // need org permission to join a dataset). The AI bar pulls a sample of
  // observations for the picked dataset and feeds the user's question
  // through /ai/public-chat with that context. So a non-member can still
  // get real analysis out of WR data via our site.
  const [aiDataset, setAiDataset] = useState(null)
  const [aiObs, setAiObs] = useState([])
  const [aiObsLoading, setAiObsLoading] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState([])
  const [aiThinking, setAiThinking] = useState(false)

  // Load all locations (from server cache — should be instant)
  useEffect(() => {
    setLocsLoading(true)
    getAllLocations().then(locs => { setLocations(locs); setLocsLoading(false) }).catch(() => setLocsLoading(false))
  }, [])

  // When location selected, fetch its observations
  useEffect(() => {
    if (!selectedLoc) { setLocObs([]); return }
    setLocObsLoading(true)
    getLocationObservations(selectedLoc.id, { perPage: 100 })
      .then(result => {
        const items = Array.isArray(result) ? result : result.observations || result.data || []
        setLocObs(items)
      })
      .catch(e => setError(e.message))
      .finally(() => setLocObsLoading(false))
  }, [selectedLoc])

  // Load datasets/orgs
  useEffect(() => {
    if (tab === 'observations') return
    setLoading(true); setError(null)
    const fetcher = tab === 'datasets' ? getDatasets : getOrganizations
    ;(async () => {
      const all = []
      for (let p = 1; p <= 10; p++) {
        const result = await fetcher({ page: p, perPage: 100 })
        const items = result.items || []
        if (items.length === 0) break
        all.push(...items)
        if (items.length < 100) break
      }
      setData(all)
    })().catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [tab])

  // When an AI-target dataset is chosen, pull a sample of its observations
  useEffect(() => {
    if (!aiDataset) { setAiObs([]); setAiMessages([]); return }
    setAiObsLoading(true)
    getDatasetObservations(aiDataset.id, { perPage: 100 })
      .then(d => {
        const items = Array.isArray(d) ? d : d.observations || d.data || []
        setAiObs(items)
      })
      .catch(() => setAiObs([]))
      .finally(() => setAiObsLoading(false))
  }, [aiDataset])

  // Boil 100 observations into a compact stats blob the LLM can reason
  // over. Per-parameter min/median/max + sample size + date range.
  const aiStats = useMemo(() => {
    if (!aiObs.length) return null
    const byParam = {}
    let firstDate = null, lastDate = null
    aiObs.forEach(o => {
      const t = o.observed_at ? new Date(o.observed_at).getTime() : null
      if (t) {
        if (!firstDate || t < firstDate) firstDate = t
        if (!lastDate  || t > lastDate)  lastDate  = t
      }
      ;(o.readings || []).forEach(r => {
        const v = parseFloat(r.value)
        if (!isFinite(v) || !r.parameter) return
        const k = r.parameter.toLowerCase()
        if (!byParam[k]) byParam[k] = { values: [], unit: r.unit || '' }
        byParam[k].values.push(v)
      })
    })
    const summary = {}
    Object.entries(byParam).forEach(([p, { values, unit }]) => {
      const sorted = [...values].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      const info = getParamInfo(p)
      summary[p] = {
        n: values.length,
        min: +sorted[0].toFixed(3),
        median: +median.toFixed(3),
        max: +sorted[sorted.length - 1].toFixed(3),
        unit,
        safe_range: info.safe,
      }
    })
    return {
      observations_loaded: aiObs.length,
      date_range: firstDate && lastDate
        ? `${new Date(firstDate).toISOString().slice(0,10)} → ${new Date(lastDate).toISOString().slice(0,10)}`
        : 'unknown',
      parameters: summary,
    }
  }, [aiObs])

  const askAI = useCallback(async (question) => {
    const q = (question || aiInput).trim()
    if (!q || !aiDataset || aiThinking) return
    setAiInput('')
    const userMsg = { role: 'user', content: q }
    const history = [...aiMessages, userMsg]
    setAiMessages(history)
    setAiThinking(true)
    const context = `Dataset: "${aiDataset.name}"
Description: ${aiDataset.description || '(none)'}
Status: ${aiDataset.dormant ? 'DORMANT' : 'ACTIVE'}${aiDataset.share_with_datastream ? ', shared on DataStream' : ''}
Active since: ${aiDataset.start_date || 'unknown'}
Last observation: ${aiDataset.last_observation_at || 'unknown'}

Sample analysis from ${aiObs.length} most recent observations:
${aiStats ? JSON.stringify(aiStats, null, 2) : '(no observations loaded yet)'}`
    try {
      const { data } = await api.post('/ai/public-chat', {
        messages: [
          { role: 'system', content: `You are analysing a Water Rangers community-monitoring dataset. Use ONLY the context below to answer; cite specific parameter names, values, and the date range. If the data doesn't support an answer, say so plainly. Keep answers tight (max ~5 short paragraphs or bullets).\n\n${context}` },
          ...history,
        ],
        max_tokens: 600,
      })
      setAiMessages([...history, { role: 'assistant', content: data.reply || 'No response.' }])
    } catch (e) {
      setAiMessages([...history, { role: 'assistant', content: 'AI is unavailable right now. Try again in a moment.' }])
    } finally {
      setAiThinking(false)
    }
  }, [aiInput, aiDataset, aiMessages, aiThinking, aiStats, aiObs.length])

  // Filter locations
  const filteredLocs = useMemo(() => {
    if (!locSearch) return locations.slice(0, 50)
    const s = locSearch.toLowerCase()
    return locations.filter(l =>
      (l.name || '').toLowerCase().includes(s) ||
      (l.body_of_water || '').toLowerCase().includes(s) ||
      (l.country || '').toLowerCase().includes(s)
    ).slice(0, 50)
  }, [locations, locSearch])

  // CSV export
  const exportCSV = () => {
    if (tab === 'observations' && selectedLoc && locObs.length) {
      const h = ['Date', 'Location', 'QA', 'Parameter', 'Value', 'Unit', 'Equipment', 'Safety']
      const rows = []
      locObs.forEach(o => (o.readings || []).forEach(r => {
        const safe = getSafetyColor(r.parameter, r.value)
        rows.push([o.observed_at, selectedLoc.name, o.checked, r.parameter, r.value, r.unit || '', r.equipment || '', safe === '#10b981' ? 'SAFE' : safe === '#f59e0b' ? 'WATCH' : safe === '#ef4444' ? 'CONCERN' : ''])
      }))
      const csv = [h, ...rows].map(r => r.map(c => `"${(c||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${selectedLoc.name}-observations.csv`; a.click()
    } else if (tab === 'datasets') {
      const h = ['Name', 'Description', 'Start Date', 'Active', 'DataStream', 'Permalink']
      const csv = [h, ...data.map(d => [d.name, d.description||'', d.start_date||'', !d.dormant, d.share_with_datastream, d.permalink||''])].map(r => r.map(c => `"${(c||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'datasets.csv'; a.click()
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 130px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={20} color="#14b8a6" /> Data Explorer
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
            {tab === 'observations' ? `${locations.length.toLocaleString()} monitoring sites · Pick a location to see its data` : `${data.length} ${tab} loaded`}
          </p>
        </div>
        <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'rgba(20,184,166,.06)', border: '1px solid rgba(20,184,166,.15)', borderRadius: 8, color: '#14b8a6', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
          <Download size={11} /> Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
            background: tab === t.id ? `${t.color}12` : 'transparent',
            border: 'none', borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
            color: tab === t.id ? t.color : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}><t.icon size={13} /> {t.label}</button>
        ))}
      </div>

      {error && (
        <div style={{ padding: 8, borderRadius: 8, marginBottom: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', color: '#fca5a5', fontSize: 11 }}>
          <AlertTriangle size={12} style={{ marginRight: 4 }} />{error}
        </div>
      )}

      {/* ══════ OBSERVATIONS — Location-first ══════ */}
      {tab === 'observations' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedLoc ? '280px 1fr' : '1fr', gap: 12 }}>
          {/* Location picker */}
          <div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={locSearch} onChange={e => setLocSearch(e.target.value)}
                placeholder="Search 9,444 sites..."
                style={{ width: '100%', padding: '7px 8px 7px 28px', borderRadius: 8, fontSize: 11, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }} />
            </div>
            {locsLoading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 11 }}><RefreshCw size={14} className="animate-spin" /> Loading sites...</div>
            ) : (
              <div style={{ maxHeight: selectedLoc ? 500 : 400, overflowY: 'auto' }}>
                {filteredLocs.map(loc => (
                  <div key={loc.id} onClick={() => setSelectedLoc(loc)} style={{
                    padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 3,
                    background: selectedLoc?.id === loc.id ? 'rgba(99,102,241,.12)' : 'var(--card-bg)',
                    border: `1px solid ${selectedLoc?.id === loc.id ? 'rgba(99,102,241,.3)' : 'var(--border)'}`,
                  }}>
                    <div style={{ color: 'var(--text)', fontSize: 11, fontWeight: 600 }}>{loc.name}</div>
                    <div style={{ display: 'flex', gap: 6, fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                      <span>{loc.country}</span>
                      <span>·</span>
                      <span>{(loc.water_body_type || '').replace(/_/g, ' ')}</span>
                      <span>·</span>
                      <span>{(loc.tested_parameters || []).length} params</span>
                    </div>
                  </div>
                ))}
                {filteredLocs.length === 0 && <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>No sites match "{locSearch}"</div>}
                {!locSearch && <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: 9, textAlign: 'center' }}>Search to find specific sites from {locations.length.toLocaleString()} total</div>}
              </div>
            )}
          </div>

          {/* Observations for selected location */}
          {selectedLoc && (
            <div>
              {/* Location header */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 800, margin: 0 }}><MapPin size={14} style={{ marginRight: 4 }} />{selectedLoc.name}</h3>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {selectedLoc.body_of_water} · {(selectedLoc.water_body_type || '').replace(/_/g, ' ')} · {selectedLoc.country}
                    </div>
                  </div>
                  {selectedLoc.reference_photo_url && (
                    <img src={selectedLoc.reference_photo_url} alt="" style={{ width: 60, height: 45, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} onError={e => e.target.style.display='none'} />
                  )}
                </div>
                {selectedLoc.tested_parameters && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
                    {selectedLoc.tested_parameters.map((p, i) => (
                      <span key={i} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(99,102,241,.06)', color: '#a78bfa' }}>
                        {p.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
                {selectedLoc.permalink && (
                  <a href={selectedLoc.permalink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#6366f1', fontSize: 10, marginTop: 6 }}>
                    <ExternalLink size={9} /> View on Water Rangers
                  </a>
                )}
              </div>

              {/* Observations list */}
              {locObsLoading ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 11 }}><RefreshCw size={14} className="animate-spin" /> Loading observations...</div>
              ) : locObs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>No observations found for this site</div>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{locObs.length} observations at this site</div>
                  {/* Safety legend */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                    <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10b981', marginRight: 3 }}/>Safe</span>
                    <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', marginRight: 3 }}/>Watch</span>
                    <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#ef4444', marginRight: 3 }}/>Concern</span>
                  </div>
                  {locObs.map((o, i) => {
                    const quantR = (o.readings || []).filter(r => r.value != null && r.unit && r.unit !== 'nil')
                    const qualR = (o.readings || []).filter(r => !r.unit || r.unit === 'nil')
                    const isExp = expandedObs === (o.id || i)
                    const qa = QA_STATUS[o.checked] || { label: o.checked || '?', color: '#94a3b8' }
                    return (
                      <div key={o.id || i} onClick={() => setExpandedObs(isExp ? null : (o.id || i))} style={{
                        background: 'var(--card-bg)', border: `1px solid ${isExp ? 'rgba(99,102,241,.3)' : 'var(--border)'}`,
                        borderRadius: 10, padding: 10, marginBottom: 5, cursor: 'pointer',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700 }}>
                              {o.observed_at ? new Date(o.observed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '?'}
                            </span>
                            <span style={{ padding: '1px 6px', borderRadius: 5, fontSize: 9, fontWeight: 700, background: `${qa.color}15`, color: qa.color }}>{qa.label}</span>
                            {(o.photos||[]).length > 0 && <span style={{ fontSize: 10, color: '#ec4899' }}><Camera size={10}/> {o.photos.length}</span>}
                          </div>
                          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{isExp ? '▲' : '▼'} {quantR.length} readings</span>
                        </div>
                        {/* Reading badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {quantR.slice(0, isExp ? 999 : 6).map((r, j) => (
                            <span key={j} style={{
                              fontSize: 10, padding: '2px 5px', borderRadius: 4, display: 'flex', alignItems: 'center',
                              background: `${getSafetyColor(r.parameter, r.value)}10`, border: `1px solid ${getSafetyColor(r.parameter, r.value)}20`,
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: getSafetyColor(r.parameter, r.value), marginRight: 3 }}/>
                              {(r.parameter||'').replace(/_/g,' ')}: <strong style={{ marginLeft: 2 }}>{r.value}</strong>
                              <span style={{ color: 'var(--text-muted)', marginLeft: 2, fontSize: 9 }}>{(r.unit||'').replace(/_/g,'/')}</span>
                            </span>
                          ))}
                          {!isExp && quantR.length > 6 && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{quantR.length - 6}</span>}
                        </div>
                        {/* Expanded details */}
                        {isExp && (
                          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                            {o.qa_notes && <div style={{ padding: '5px 8px', borderRadius: 6, marginBottom: 6, background: 'rgba(245,158,11,.06)', fontSize: 11, color: '#fbbf24' }}>⚠️ {o.qa_notes}</div>}
                            {quantR.map((r, j) => {
                              const info = getParamInfo(r.parameter)
                              return (
                                <div key={j} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: getSafetyColor(r.parameter, r.value) }}/>
                                    <strong>{info.emoji} {(r.parameter||'').replace(/_/g,' ')}</strong>
                                    <span style={{ color: getSafetyColor(r.parameter, r.value), fontWeight: 800 }}>{r.value} {(r.unit||'').replace(/_/g,'/')}</span>
                                    {info.safe !== '—' && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>(safe: {info.safe})</span>}
                                  </div>
                                  {info.explain && <div style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 14 }}>{info.explain}</div>}
                                  {r.equipment && <div style={{ color: 'var(--text-muted)', fontSize: 9, marginLeft: 14 }}>🔬 {r.equipment.replace(/_/g,' ')}</div>}
                                </div>
                              )
                            })}
                            {qualR.length > 0 && (
                              <div style={{ marginTop: 6 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>👁️ Visual Observations</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                  {qualR.map((r, j) => <span key={j} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{(r.parameter||'').replace(/_/g,' ')}: {r.value}</span>)}
                                </div>
                              </div>
                            )}
                            {(o.photos||[]).length > 0 && (
                              <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                                {o.photos.map((p, j) => <img key={j} src={typeof p === 'string' ? p : p.url} alt="" style={{ height: 70, borderRadius: 6, border: '1px solid var(--border)' }} onError={e => e.target.style.display='none'}/>)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* No location selected */}
          {!selectedLoc && !locsLoading && (
            <div style={{ display: 'none' }}/>
          )}
        </div>
      )}

      {/* ══════ DATASETS ══════ */}
      {tab === 'datasets' && (
        <div>
          {/* AI contextual bar — appears at the top of the datasets tab.
              Idle state nudges the user to pick a dataset; active state
              shows the dataset name + quick-prompt chips + a small chat. */}
          <div style={{
            background: aiDataset ? 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(20,184,166,0.08))' : 'var(--card-bg)',
            border: `1px solid ${aiDataset ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
            borderRadius: 12, padding: 12, marginBottom: 10,
            boxShadow: aiDataset ? '0 6px 22px rgba(99,102,241,0.10)' : 'none',
            transition: 'all 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: aiDataset ? 8 : 0 }}>
              <Sparkles size={14} color="#a78bfa" />
              <strong style={{ color: 'var(--text)', fontSize: 12 }}>Ask AI about a dataset</strong>
              {!aiDataset && (
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  — click <em>Ask AI</em> on any dataset card below to start
                </span>
              )}
              {aiDataset && (
                <>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    background: 'rgba(99,102,241,.12)', color: '#a78bfa',
                    maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{aiDataset.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                    {aiObsLoading ? '· loading data…' : aiObs.length ? `· ${aiObs.length} obs sampled` : '· no observations'}
                  </span>
                  <button onClick={() => { setAiDataset(null); setAiMessages([]); setAiObs([]) }}
                    title="Clear" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                    <X size={12} /> close
                  </button>
                </>
              )}
            </div>

            {aiDataset && (
              <>
                {/* Quick prompts */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                  {[
                    'Summarise the key findings.',
                    'Any health or safety concerns in this data?',
                    'Which parameters are outside safe ranges?',
                    'What trends or patterns stand out?',
                  ].map(q => (
                    <button key={q} onClick={() => askAI(q)} disabled={aiThinking || aiObsLoading}
                      style={{
                        padding: '4px 9px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                        background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.25)',
                        color: '#a78bfa', cursor: (aiThinking || aiObsLoading) ? 'wait' : 'pointer',
                        opacity: (aiThinking || aiObsLoading) ? 0.5 : 1,
                      }}>{q}</button>
                  ))}
                </div>

                {/* Conversation */}
                {aiMessages.length > 0 && (
                  <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 8, paddingRight: 4 }}>
                    {aiMessages.map((m, i) => (
                      <div key={i} style={{
                        padding: '6px 9px', borderRadius: 8, marginBottom: 4, fontSize: 11, lineHeight: 1.5,
                        background: m.role === 'user' ? 'rgba(99,102,241,.10)' : 'var(--card-bg)',
                        border: m.role === 'user' ? '1px solid rgba(99,102,241,.20)' : '1px solid var(--border)',
                        color: 'var(--text)', whiteSpace: 'pre-wrap',
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
                          {m.role === 'user' ? 'You' : 'AI'}
                        </div>
                        {m.content}
                      </div>
                    ))}
                    {aiThinking && (
                      <div style={{ padding: '6px 9px', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <RefreshCw size={11} className="animate-spin" /> Thinking…
                      </div>
                    )}
                  </div>
                )}

                {/* Input */}
                <form onSubmit={e => { e.preventDefault(); askAI() }} style={{ display: 'flex', gap: 6 }}>
                  <input value={aiInput} onChange={e => setAiInput(e.target.value)} disabled={aiThinking}
                    placeholder={aiObsLoading ? 'Loading dataset…' : 'Ask anything about this dataset…'}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 11,
                      background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)',
                      outline: 'none',
                    }} />
                  <button type="submit" disabled={aiThinking || aiObsLoading || !aiInput.trim()}
                    style={{
                      padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      background: 'linear-gradient(135deg, #6366f1, #14b8a6)', border: 'none', color: '#fff',
                      cursor: (aiThinking || aiObsLoading || !aiInput.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (aiThinking || aiObsLoading || !aiInput.trim()) ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}><Send size={11} /> Ask</button>
                </form>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <input value={dsSearch} onChange={e => setDsSearch(e.target.value)} placeholder="Search datasets..."
              style={{ padding: '5px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(0,0,0,.1)', border: '1px solid var(--border)', color: 'var(--text)', width: 200 }} />
            {['', 'active', 'dormant', 'datastream'].map(f => (
              <button key={f} onClick={() => setDsStatusFilter(f)} style={{
                padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                background: dsStatusFilter === f ? 'rgba(99,102,241,.12)' : 'transparent',
                border: dsStatusFilter === f ? '1px solid rgba(99,102,241,.25)' : '1px solid transparent',
                color: dsStatusFilter === f ? '#a78bfa' : 'var(--text-muted)',
              }}>
                {f === '' ? `All (${data.length})` : f === 'active' ? `✅ Active (${data.filter(d=>!d.dormant).length})` : f === 'dormant' ? `💤 Dormant (${data.filter(d=>d.dormant).length})` : `🔗 DataStream (${data.filter(d=>d.share_with_datastream).length})`}
              </button>
            ))}
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}><RefreshCw size={14} className="animate-spin"/> Loading datasets...</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 8 }}>
              {data.filter(ds => {
                if (dsSearch && !(ds.name||'').toLowerCase().includes(dsSearch.toLowerCase()) && !(ds.description||'').toLowerCase().includes(dsSearch.toLowerCase())) return false
                if (dsStatusFilter === 'active' && ds.dormant) return false
                if (dsStatusFilter === 'dormant' && !ds.dormant) return false
                if (dsStatusFilter === 'datastream' && !ds.share_with_datastream) return false
                return true
              }).map((ds, i) => (
                <div key={ds.id||i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <h4 style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700, margin: 0, flex: 1 }}>{ds.name}</h4>
                    <span style={{ padding: '2px 6px', borderRadius: 6, fontSize: 9, fontWeight: 700, background: ds.dormant ? 'rgba(239,68,68,.08)' : 'rgba(16,185,129,.08)', color: ds.dormant ? '#ef4444' : '#10b981' }}>{ds.dormant ? '💤 Dormant' : '✅ Active'}</span>
                  </div>
                  {ds.description && <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, margin: '2px 0 6px', maxHeight: 50, overflow: 'hidden' }}>{ds.description}</p>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                    {ds.start_date && <span>📅 Since {new Date(ds.start_date).toLocaleDateString()}</span>}
                    {ds.last_observation_at && <span>🔬 Last: {new Date(ds.last_observation_at).toLocaleDateString()}</span>}
                    {ds.share_with_datastream && <span style={{ color: '#14b8a6' }}>🔗 DataStream</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => { setAiDataset(ds); setAiMessages([]); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 7px', borderRadius: 5,
                        background: aiDataset?.id === ds.id ? 'rgba(167,139,250,.20)' : 'rgba(167,139,250,.08)',
                        border: aiDataset?.id === ds.id ? '1px solid rgba(167,139,250,.45)' : '1px solid rgba(167,139,250,.20)',
                        color: '#a78bfa', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      }}>
                      <Sparkles size={9}/> {aiDataset?.id === ds.id ? 'Asking AI…' : 'Ask AI'}
                    </button>
                    {ds.permalink && <a href={ds.permalink} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 7px', borderRadius: 5, background: 'rgba(99,102,241,.06)', color: '#a78bfa', fontSize: 10, fontWeight: 600, textDecoration: 'none' }}><ExternalLink size={9}/> View Data</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════ ORGANIZATIONS ══════ */}
      {tab === 'organizations' && (
        loading ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}><RefreshCw size={14} className="animate-spin"/> Loading...</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
            {data.map((org, i) => (
              <div key={org.id||i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <h4 style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700, margin: '0 0 2px' }}>{org.name}</h4>
                {org.program_name && <div style={{ color: '#a78bfa', fontSize: 10, fontWeight: 600, marginBottom: 4 }}>{org.program_name}</div>}
                {org.short_description && <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, margin: '0 0 6px' }}>{org.short_description}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                  {org.primary_country && <span>🌍 {org.primary_country}</span>}
                  {org.nearest_town_city && <span>📍 {org.nearest_town_city}</span>}
                  {org.email && <span>✉️ {org.email}</span>}
                  {org.website && <a href={org.website} target="_blank" rel="noreferrer" style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: 2 }}><ExternalLink size={9}/> Website</a>}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
