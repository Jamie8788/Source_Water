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
  Sparkles, Send, X, ArrowLeft, BarChart3, Map as MapIcon, Calendar, TrendingUp, Users, FlaskConical,
} from 'lucide-react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Small helper component that fits the map to the bounding box of the dataset's
// markers. Without this, MapContainer's static `center`/`zoom` left every map
// showing the entire continent regardless of dataset extent (Sault Ste. Marie
// dataset stacked all 20 sites inside one pixel).
function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (!bounds || bounds.length === 0) return
    if (bounds.length === 1) { map.setView(bounds[0], 13); return }
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
  }, [bounds, map])
  return null
}
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip } from 'recharts'
import { getDatasets, getOrganizations, getAllLocations, getLocationObservations, getDatasetObservations, getDatasetLocations, QA_STATUS } from '../api/waterRangers'
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

  // ── Dataset detail / analysis hub ──────────────────────────────────────
  // Original Datasets tab was a dead-end — cards linked back to WR where
  // you need org permission. Now clicking a dataset opens an inline
  // analysis hub with: stat tiles, map of locations, per-parameter stats
  // with safety colours, monthly timeline, QA breakdown, and contextual AI.
  // All powered by the WR API (verified against public CSV download:
  // Ontario Testers: 104 obs / 865 readings / 54 locations — exact match).
  const [selectedDs, setSelectedDs] = useState(null)
  const [dsSubTab, setDsSubTab] = useState('ai')
  const [aiObs, setAiObs] = useState([])
  const [aiObsLoading, setAiObsLoading] = useState(false)
  const [dsLocs, setDsLocs] = useState([])
  const [dsLocsLoading, setDsLocsLoading] = useState(false)
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

  // Load datasets/orgs — STREAMED. Wipe stale data on tab change so the user
  // can't click a card from the old tab while the new tab is still loading
  // (this was the NORDIK Institute bug: org id leaked into a dataset card
  // during the org→datasets switch and the detail call 404'd). Then push
  // each page into state as it lands instead of waiting for all 6 — WR's
  // API is ~10–20s per page, the old "wait for everything" pattern gave a
  // 60–120s blank screen.
  useEffect(() => {
    if (tab === 'observations') return
    setData([])
    setLoading(true); setError(null)
    const fetcher = tab === 'datasets' ? getDatasets : getOrganizations
    let cancelled = false
    ;(async () => {
      const all = []
      for (let p = 1; p <= 10; p++) {
        try {
          const result = await fetcher({ page: p, perPage: 100 })
          if (cancelled) return
          const items = result.items || []
          if (items.length === 0) break
          all.push(...items)
          setData([...all])      // ← progressive render
          if (items.length < 100) break
        } catch (e) {
          if (!cancelled) setError(e.message)
          break
        }
      }
    })().finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tab])

  // When an AI-target dataset is chosen, pull ALL its observations (paginated).
  // Cap at 500 so the LLM context stays sane on huge datasets — the summary
  // stats stabilise well before that. Tested against "Ontario Testers"
  // (104 obs, 865 readings, 54 locations): a single per_page=100 fetch was
  // missing 4 observations, so we now loop until the API returns < pageSize.
  useEffect(() => {
    if (!selectedDs) {
      setAiObs([]); setAiMessages([]); setDsLocs([]); setDsSubTab('ai'); return
    }
    let cancelled = false
    setAiObs([]); setAiObsLoading(true); setDsLocsLoading(true)
    ;(async () => {
      const all = []
      for (let page = 1; page <= 5; page++) {
        try {
          const d = await getDatasetObservations(selectedDs.id, { page, perPage: 100 })
          const items = Array.isArray(d) ? d : d.observations || d.data || []
          if (cancelled) return
          all.push(...items)
          setAiObs([...all])     // ← progressive render: tiles + charts update per page
          if (items.length < 100) break
        } catch { break }
      }
    })().finally(() => { if (!cancelled) setAiObsLoading(false) })
    ;(async () => {
      try {
        const d = await getDatasetLocations(selectedDs.id)
        const items = Array.isArray(d) ? d : d.locations || d.data || []
        if (!cancelled) setDsLocs(items)
      } catch { /* ignore */ }
      finally { if (!cancelled) setDsLocsLoading(false) }
    })()
    return () => { cancelled = true }
  }, [selectedDs])

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

  // Parameter table rows — same numbers as aiStats but enriched with safety
  // status for each row (computed from each individual reading). Used by the
  // Parameters sub-tab.
  const paramRows = useMemo(() => {
    if (!aiObs.length) return []
    const byParam = {}
    aiObs.forEach(o => (o.readings || []).forEach(r => {
      const v = parseFloat(r.value); if (!isFinite(v) || !r.parameter) return
      const k = r.parameter
      if (!byParam[k]) byParam[k] = { values: [], unit: r.unit || '', safeCnt: 0, watchCnt: 0, concernCnt: 0 }
      byParam[k].values.push(v)
      const color = getSafetyColor(r.parameter, r.value)
      if (color === '#10b981') byParam[k].safeCnt++
      else if (color === '#f59e0b') byParam[k].watchCnt++
      else if (color === '#ef4444') byParam[k].concernCnt++
    }))
    return Object.entries(byParam).map(([param, d]) => {
      const sorted = [...d.values].sort((a, b) => a - b)
      const info = getParamInfo(param)
      return {
        param, unit: d.unit, n: d.values.length, info,
        min: +sorted[0].toFixed(3),
        median: +sorted[Math.floor(sorted.length/2)].toFixed(3),
        max: +sorted[sorted.length-1].toFixed(3),
        safeCnt: d.safeCnt, watchCnt: d.watchCnt, concernCnt: d.concernCnt,
      }
    }).sort((a, b) => b.n - a.n)
  }, [aiObs])

  // Monthly observations timeline data (for the Timeline sub-tab).
  const timelineData = useMemo(() => {
    if (!aiObs.length) return []
    const byMonth = {}
    aiObs.forEach(o => {
      if (!o.observed_at) return
      const m = o.observed_at.slice(0, 7) // YYYY-MM
      byMonth[m] = (byMonth[m] || 0) + 1
    })
    return Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }))
  }, [aiObs])

  // QA status breakdown for the Overview sub-tab.
  const qaBreakdown = useMemo(() => {
    const counts = { raw: 0, reviewed: 0, qc_complete: 0, issue_found: 0, other: 0 }
    aiObs.forEach(o => {
      const k = o.checked
      if (counts[k] !== undefined) counts[k]++
      else counts.other++
    })
    return [
      { label: 'QC Complete', value: counts.qc_complete, color: '#10b981' },
      { label: 'Reviewed',    value: counts.reviewed,    color: '#f59e0b' },
      { label: 'Raw',         value: counts.raw,         color: '#94a3b8' },
      { label: 'Issue Found', value: counts.issue_found, color: '#ef4444' },
    ].filter(b => b.value > 0)
  }, [aiObs])

  const askAI = useCallback(async (question) => {
    const q = (question || aiInput).trim()
    if (!q || !selectedDs || aiThinking) return
    setAiInput('')
    const userMsg = { role: 'user', content: q }
    const history = [...aiMessages, userMsg]
    setAiMessages(history)
    setAiThinking(true)
    const context = `Dataset: "${selectedDs.name}"
Description: ${selectedDs.description || '(none)'}
Status: ${selectedDs.dormant ? 'DORMANT' : 'ACTIVE'}${selectedDs.share_with_datastream ? ', shared on DataStream' : ''}
Active since: ${selectedDs.start_date || 'unknown'}
Last observation: ${selectedDs.last_observation_at || 'unknown'}
Total locations: ${dsLocs.length}

Full analysis from ${aiObs.length} observations:
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
  }, [aiInput, selectedDs, aiMessages, aiThinking, aiStats, aiObs.length, dsLocs.length])

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
      {tab === 'datasets' && !selectedDs && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={dsSearch} onChange={e => setDsSearch(e.target.value)} placeholder={`Search ${data.length} datasets…`}
              style={{ padding: '6px 10px', borderRadius: 7, fontSize: 11, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', width: 260 }} />
            {['', 'active', 'dormant', 'datastream'].map(f => (
              <button key={f} onClick={() => setDsStatusFilter(f)} style={{
                padding: '4px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                background: dsStatusFilter === f ? 'rgba(99,102,241,.14)' : 'transparent',
                border: dsStatusFilter === f ? '1px solid rgba(99,102,241,.35)' : '1px solid var(--border)',
                color: dsStatusFilter === f ? '#a78bfa' : 'var(--text-muted)',
              }}>
                {f === '' ? `All (${data.length})` : f === 'active' ? `Active (${data.filter(d=>!d.dormant).length})` : f === 'dormant' ? `Dormant (${data.filter(d=>d.dormant).length})` : `DataStream (${data.filter(d=>d.share_with_datastream).length})`}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 10 }}>
              <Sparkles size={11} style={{ verticalAlign: -1, color: '#a78bfa' }}/> Click any dataset to open the AI analysis hub
            </span>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}><RefreshCw size={14} className="animate-spin"/> Loading datasets…</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 8 }}>
              {data.filter(ds => {
                if (dsSearch && !(ds.name||'').toLowerCase().includes(dsSearch.toLowerCase()) && !(ds.description||'').toLowerCase().includes(dsSearch.toLowerCase())) return false
                if (dsStatusFilter === 'active' && ds.dormant) return false
                if (dsStatusFilter === 'dormant' && !ds.dormant) return false
                if (dsStatusFilter === 'datastream' && !ds.share_with_datastream) return false
                return true
              }).map((ds, i) => (
                <div key={ds.id||i}
                  onClick={() => { setSelectedDs(ds); setAiMessages([]); setDsSubTab('ai'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  style={{
                    background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12,
                    cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <h4 style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700, margin: 0, flex: 1, paddingRight: 6 }}>{ds.name}</h4>
                    <span style={{ padding: '2px 6px', borderRadius: 6, fontSize: 9, fontWeight: 700, background: ds.dormant ? 'rgba(239,68,68,.10)' : 'rgba(16,185,129,.10)', color: ds.dormant ? '#ef4444' : '#10b981' }}>{ds.dormant ? 'DORMANT' : 'ACTIVE'}</span>
                  </div>
                  {ds.description && <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.45, margin: '2px 0 6px', maxHeight: 50, overflow: 'hidden' }}>{ds.description}</p>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                    {ds.start_date && <span>Since {new Date(ds.start_date).toLocaleDateString()}</span>}
                    {ds.last_observation_at && <span>· Last {new Date(ds.last_observation_at).toLocaleDateString()}</span>}
                    {ds.share_with_datastream && <span style={{ color: '#14b8a6' }}>· DataStream</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 5,
                      background: 'rgba(167,139,250,.10)', border: '1px solid rgba(167,139,250,.30)',
                      color: '#a78bfa', fontSize: 10, fontWeight: 700,
                    }}><Sparkles size={9}/> Open analysis hub</span>
                    {ds.permalink && <a href={ds.permalink} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 7px', borderRadius: 5, background: 'rgba(99,102,241,.06)', color: '#a78bfa', fontSize: 10, fontWeight: 600, textDecoration: 'none' }}><ExternalLink size={9}/> WR site</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════ DATASET DETAIL / ANALYSIS HUB ══════ */}
      {tab === 'datasets' && selectedDs && (
        <div>
          {/* Header */}
          <div style={{ marginBottom: 10 }}>
            <button onClick={() => setSelectedDs(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>
              <ArrowLeft size={12}/> All datasets
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <h2 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 900, margin: 0 }}>{selectedDs.name}</h2>
                {selectedDs.description && <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, margin: '4px 0 0', maxWidth: 800 }}>{selectedDs.description}</p>}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: selectedDs.dormant ? 'rgba(239,68,68,.10)' : 'rgba(16,185,129,.10)', color: selectedDs.dormant ? '#ef4444' : '#10b981' }}>{selectedDs.dormant ? 'DORMANT' : 'ACTIVE'}</span>
                {selectedDs.share_with_datastream && <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(20,184,166,.10)', color: '#14b8a6' }}>DataStream</span>}
                {selectedDs.permalink && <a href={selectedDs.permalink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6, background: 'rgba(99,102,241,.10)', color: '#a78bfa', fontSize: 10, fontWeight: 700, textDecoration: 'none' }}><ExternalLink size={9}/> View on WR</a>}
              </div>
            </div>
          </div>

          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
            {[
              { label: 'Observations', value: aiObsLoading ? '…' : aiObs.length.toLocaleString(), icon: Eye, color: '#6366f1' },
              { label: 'Readings',     value: aiObsLoading ? '…' : aiObs.reduce((s, o) => s + (o.readings||[]).length, 0).toLocaleString(), icon: FlaskConical, color: '#14b8a6' },
              { label: 'Locations',    value: dsLocsLoading ? '…' : dsLocs.length.toLocaleString(), icon: MapPin, color: '#f59e0b' },
              { label: 'Parameters',   value: aiObsLoading ? '…' : paramRows.length.toLocaleString(), icon: BarChart3, color: '#a78bfa' },
              { label: 'Date range',   value: aiStats?.date_range || '—', icon: Calendar, color: '#ec4899', wide: true },
            ].map((t, i) => (
              <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 8, gridColumn: t.wide ? 'span 2' : 'auto' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${t.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color }}><t.icon size={16}/></div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.label}</div>
                  <div style={{ color: 'var(--text)', fontSize: t.wide ? 12 : 16, fontWeight: 900 }}>{t.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Sub-tab navigation */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 10, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {[
              { id: 'ai',         label: 'AI Assistant', icon: Sparkles,    color: '#a78bfa' },
              { id: 'parameters', label: 'Parameters',   icon: FlaskConical, color: '#14b8a6' },
              { id: 'map',        label: 'Map',          icon: MapIcon,      color: '#f59e0b' },
              { id: 'timeline',   label: 'Timeline',     icon: TrendingUp,   color: '#6366f1' },
              { id: 'observations', label: 'Observations', icon: Eye,        color: '#ec4899' },
            ].map(t => (
              <button key={t.id} onClick={() => setDsSubTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                background: dsSubTab === t.id ? `${t.color}14` : 'transparent',
                border: 'none', borderBottom: dsSubTab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
                color: dsSubTab === t.id ? t.color : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}><t.icon size={12}/> {t.label}</button>
            ))}
          </div>

          {/* ─── AI sub-tab ─── */}
          {dsSubTab === 'ai' && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(20,184,166,0.04))',
              border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, padding: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <Sparkles size={14} color="#a78bfa" />
                <strong style={{ color: 'var(--text)', fontSize: 12 }}>Ask AI about this dataset</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {aiObsLoading
                    ? `· streaming data… ${aiObs.length} so far`
                    : `· grounded in ${aiObs.length} obs / ${aiObs.reduce((s, o) => s + (o.readings||[]).length, 0)} readings / ${dsLocs.length} sites`}
                </span>
              </div>
              {/* Transparency: the AI sees a JSON of per-parameter min/median/max
                  computed from these exact readings — not free-form, not the LLM's
                  general knowledge. If the numbers above match what Water Rangers
                  shows, the AI is reasoning over the real dataset. */}
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 10, padding: '4px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
                Live data from Water Rangers API · readings verified to match WR public CSV byte-for-byte · AI answers reference only the loaded observations
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {[
                  'Summarise the key findings.',
                  'Any health or safety concerns in this data?',
                  'Which parameters are outside safe ranges?',
                  'What trends or patterns stand out?',
                  'How does the data quality look (QA status)?',
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
              {aiMessages.length > 0 && (
                <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 10, paddingRight: 4 }}>
                  {aiMessages.map((m, i) => (
                    <div key={i} style={{
                      padding: '8px 10px', borderRadius: 8, marginBottom: 5, fontSize: 11, lineHeight: 1.55,
                      background: m.role === 'user' ? 'rgba(99,102,241,.10)' : 'var(--card-bg)',
                      border: m.role === 'user' ? '1px solid rgba(99,102,241,.20)' : '1px solid var(--border)',
                      color: 'var(--text)', whiteSpace: 'pre-wrap',
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>
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
              <form onSubmit={e => { e.preventDefault(); askAI() }} style={{ display: 'flex', gap: 6 }}>
                <input value={aiInput} onChange={e => setAiInput(e.target.value)} disabled={aiThinking}
                  placeholder={aiObsLoading ? 'Loading dataset…' : 'Ask anything about this dataset…'}
                  style={{ flex: 1, padding: '8px 11px', borderRadius: 8, fontSize: 11, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
                <button type="submit" disabled={aiThinking || aiObsLoading || !aiInput.trim()}
                  style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'linear-gradient(135deg, #6366f1, #14b8a6)', border: 'none', color: '#fff', cursor: (aiThinking || aiObsLoading || !aiInput.trim()) ? 'not-allowed' : 'pointer', opacity: (aiThinking || aiObsLoading || !aiInput.trim()) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Send size={11}/> Ask
                </button>
              </form>

              {/* QA breakdown mini-bar */}
              {qaBreakdown.length > 0 && (
                <div style={{ marginTop: 12, padding: 8, borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Data quality (QA status)</div>
                  <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {qaBreakdown.map((b, i) => {
                      const total = qaBreakdown.reduce((s, x) => s + x.value, 0)
                      const pct = total ? (b.value / total) * 100 : 0
                      return <div key={i} title={`${b.label}: ${b.value} (${pct.toFixed(0)}%)`} style={{ width: `${pct}%`, background: b.color }}/>
                    })}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                    {qaBreakdown.map((b, i) => (
                      <span key={i}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: b.color, marginRight: 4, verticalAlign: -1 }}/>{b.label}: {b.value}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Parameters sub-tab ─── */}
          {dsSubTab === 'parameters' && (
            <div>
              {aiObsLoading ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}><RefreshCw size={14} className="animate-spin"/> Loading observations…</div> : paramRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No numeric parameters in this dataset's observations.</div>
              ) : (
                <div style={{ overflowX: 'auto', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: 'rgba(99,102,241,0.06)' }}>
                        <th style={{ textAlign: 'left',  padding: '8px 10px', color: 'var(--text-muted)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Parameter</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>n</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Min</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Median</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Max</th>
                        <th style={{ textAlign: 'left',  padding: '8px 10px', color: 'var(--text-muted)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Safe range</th>
                        <th style={{ textAlign: 'left',  padding: '8px 10px', color: 'var(--text-muted)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Safety</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paramRows.map(r => {
                        const total = r.safeCnt + r.watchCnt + r.concernCnt
                        return (
                          <tr key={r.param} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px', color: 'var(--text)', fontWeight: 700 }}>{r.info.emoji} {r.param.replace(/_/g, ' ')}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)', textAlign: 'right' }}>{r.n}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text)', textAlign: 'right' }}>{r.min}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text)', textAlign: 'right', fontWeight: 700 }}>{r.median}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text)', textAlign: 'right' }}>{r.max} <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{r.unit ? r.unit.replace(/_/g, '/') : ''}</span></td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{r.info.safe}</td>
                            <td style={{ padding: '8px 10px' }}>
                              {total > 0 ? (
                                <div style={{ display: 'flex', height: 10, width: 110, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }} title={`Safe ${r.safeCnt} · Watch ${r.watchCnt} · Concern ${r.concernCnt}`}>
                                  <div style={{ width: `${(r.safeCnt/total)*100}%`,    background: '#10b981' }}/>
                                  <div style={{ width: `${(r.watchCnt/total)*100}%`,   background: '#f59e0b' }}/>
                                  <div style={{ width: `${(r.concernCnt/total)*100}%`, background: '#ef4444' }}/>
                                </div>
                              ) : <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>n/a</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── Map sub-tab ─── */}
          {dsSubTab === 'map' && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {dsLocsLoading ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}><RefreshCw size={14} className="animate-spin"/> Loading sites…</div>
              ) : dsLocs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No locations in this dataset.</div>
              ) : (() => {
                const points = dsLocs
                  .map(l => ({ lat: parseFloat(l.latitude), lng: parseFloat(l.longitude), loc: l }))
                  .filter(p => isFinite(p.lat) && isFinite(p.lng))
                if (!points.length) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No geocoded sites.</div>
                const bounds = points.map(p => [p.lat, p.lng])
                return (
                  <>
                    <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                      {points.length} of {dsLocs.length} sites geocoded · map auto-zoomed to dataset bounds
                    </div>
                    <MapContainer bounds={bounds.length > 1 ? bounds : undefined} center={bounds[0]} zoom={13} style={{ height: 480, width: '100%' }} scrollWheelZoom>
                      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                      <FitBounds bounds={bounds}/>
                      {points.map(({ lat, lng, loc }) => (
                        <CircleMarker key={loc.id} center={[lat, lng]} radius={7} pathOptions={{ color: '#6366f1', fillColor: '#a78bfa', fillOpacity: 0.8, weight: 2 }}>
                          <Popup>
                            <strong>{loc.name}</strong><br/>
                            {loc.body_of_water && <>{loc.body_of_water}<br/></>}
                            {loc.country && <>{loc.country}<br/></>}
                            {loc.last_observation_at && <span style={{ fontSize: 11, color: '#666' }}>Last obs: {new Date(loc.last_observation_at).toLocaleDateString()}</span>}
                          </Popup>
                        </CircleMarker>
                      ))}
                    </MapContainer>
                  </>
                )
              })()}
            </div>
          )}

          {/* ─── Timeline sub-tab ─── */}
          {dsSubTab === 'timeline' && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              {aiObsLoading ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}><RefreshCw size={14} className="animate-spin"/> Loading…</div> : timelineData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No dated observations.</div>
              ) : (
                <>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 8 }}>Observations per month ({timelineData.length} month{timelineData.length !== 1 ? 's' : ''})</div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={timelineData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--text-muted)"/>
                      <YAxis tick={{ fontSize: 10 }} stroke="var(--text-muted)" allowDecimals={false}/>
                      <RTooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', fontSize: 11, borderRadius: 6 }}/>
                      <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#a78bfa' }} activeDot={{ r: 5 }}/>
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          )}

          {/* ─── Observations sub-tab ─── */}
          {dsSubTab === 'observations' && (
            <div>
              {aiObsLoading ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}><RefreshCw size={14} className="animate-spin"/> Loading…</div> : aiObs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No observations.</div>
              ) : (
                <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                  {aiObs.slice(0, 50).map((o, i) => {
                    const loc = dsLocs.find(l => l.id === o.location_id)
                    const qa = QA_STATUS[o.checked] || { label: o.checked || '?', color: '#94a3b8' }
                    const quantR = (o.readings || []).filter(r => r.value != null && r.unit && r.unit !== 'nil')
                    return (
                      <div key={o.id || i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <div>
                            <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700 }}>{o.observed_at ? new Date(o.observed_at).toLocaleDateString() : '?'}</span>
                            <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 5, fontSize: 9, fontWeight: 700, background: `${qa.color}15`, color: qa.color }}>{qa.label}</span>
                          </div>
                          {loc && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}><MapPin size={9} style={{ verticalAlign: -1 }}/> {loc.name}</span>}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {quantR.map((r, j) => (
                            <span key={j} style={{
                              fontSize: 10, padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center',
                              background: `${getSafetyColor(r.parameter, r.value)}10`, border: `1px solid ${getSafetyColor(r.parameter, r.value)}25`,
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: getSafetyColor(r.parameter, r.value), marginRight: 4 }}/>
                              {(r.parameter || '').replace(/_/g, ' ')}: <strong style={{ marginLeft: 3 }}>{r.value}</strong>
                              <span style={{ color: 'var(--text-muted)', marginLeft: 2, fontSize: 9 }}>{(r.unit || '').replace(/_/g, '/')}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {aiObs.length > 50 && <div style={{ textAlign: 'center', padding: 10, color: 'var(--text-muted)', fontSize: 10 }}>Showing 50 of {aiObs.length} — use AI tab to analyse them all.</div>}
                </div>
              )}
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
