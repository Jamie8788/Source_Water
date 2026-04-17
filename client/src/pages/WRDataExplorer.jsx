/**
 * WRDataExplorer — Community-friendly Water Rangers Data Explorer
 * - Observations with plain English readings + safety indicators
 * - Datasets with download access + program info
 * - Organizations browser
 * - CSV export on everything
 * - Photos from observations
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Database, Eye, RefreshCw, AlertTriangle,
  ExternalLink, Camera, Building2, Download,
} from 'lucide-react'
import { getObservations, getDatasets, getOrganizations, QA_STATUS } from '../api/waterRangers'

// Plain English for readings
const PARAM_INFO = {
  ph: { emoji: '🧪', safe: '6.5–8.5', explain: 'How acidic or basic the water is. Outside 6.5–8.5 can harm aquatic life.' },
  oxygen: { emoji: '💨', safe: '>6 mg/L', explain: 'Oxygen dissolved in water. Fish need at least 6 mg/L to survive.' },
  dissolved_oxygen: { emoji: '💨', safe: '>6 mg/L', explain: 'Oxygen for fish and aquatic life. Below 6 is stressful, below 2 is deadly.' },
  conductivity: { emoji: '⚡', safe: '<1500 µS/cm', explain: 'How many minerals/salts are dissolved. High values may indicate pollution.' },
  turbidity: { emoji: '👁️', safe: '<5 NTU', explain: 'Water cloudiness. Clearer water is generally healthier.' },
  water_temperature: { emoji: '🌡️', safe: 'varies', explain: 'Warmer water holds less oxygen. Sudden changes stress wildlife.' },
  air_temperature: { emoji: '🌡️', safe: '—', explain: 'Air temperature when the sample was taken.' },
  chlorine: { emoji: '🧴', safe: '0–5 mg/L', explain: 'Disinfectant in treated water. Should be present but not too high.' },
  hardness: { emoji: '💎', safe: '<500 ppm', explain: 'Calcium and magnesium content. Very hard water can affect pipes and taste.' },
  alkalinity: { emoji: '🛡️', safe: '20–200 ppm', explain: 'Ability to resist pH changes. Low alkalinity = vulnerable to acid rain.' },
  phosphates: { emoji: '🌿', safe: '<0.1 mg/L', explain: 'Nutrient pollution. Too much causes algae blooms that kill fish.' },
  phosphorus: { emoji: '🌿', safe: '<0.03 mg/L', explain: 'Key nutrient. Even small amounts can trigger algae blooms in lakes.' },
  nitrate: { emoji: '🌱', safe: '<10 mg/L', explain: 'From fertilizers and sewage. High levels unsafe for drinking.' },
  secchi_depth: { emoji: '📏', safe: 'deeper=clearer', explain: 'How far down you can see. Measures water clarity.' },
  chlorophyll_a: { emoji: '🟢', safe: '<10 µg/L', explain: 'Algae levels. High values mean potential algae bloom.' },
  water_level: { emoji: '📊', safe: '—', explain: 'Current water height relative to normal.' },
  clarity: { emoji: '👁️', safe: '—', explain: 'Visual assessment of how clear the water looks.' },
  colour: { emoji: '🎨', safe: '—', explain: 'What color the water appears.' },
  algae: { emoji: '🟢', safe: 'none', explain: 'Whether algae growth is visible at the site.' },
  flow: { emoji: '🌊', safe: '—', explain: 'How fast the water is moving.' },
}

function getReadingInfo(param) {
  const key = (param || '').toLowerCase().replace(/\s+/g, '_')
  return PARAM_INFO[key] || { emoji: '📋', safe: '—', explain: '' }
}

// Safety color for a reading
function getSafetyColor(param, value) {
  const val = parseFloat(value)
  if (isNaN(val)) return '#94a3b8' // gray for non-numeric
  const key = (param || '').toLowerCase()
  if (key.includes('ph')) return (val >= 6.5 && val <= 8.5) ? '#10b981' : '#ef4444'
  if (key.includes('oxygen')) return val >= 6 ? '#10b981' : val >= 4 ? '#f59e0b' : '#ef4444'
  if (key.includes('conductivity')) return val <= 1500 ? '#10b981' : '#f59e0b'
  if (key.includes('phosphat') || key.includes('phosphorus')) return val <= 0.1 ? '#10b981' : '#ef4444'
  if (key.includes('turbidity')) return val <= 5 ? '#10b981' : '#f59e0b'
  if (key.includes('hardness')) return val <= 500 ? '#10b981' : '#f59e0b'
  if (key.includes('alkalinity')) return (val >= 20 && val <= 200) ? '#10b981' : '#f59e0b'
  if (key.includes('chlorine')) return (val >= 0 && val <= 5) ? '#10b981' : '#f59e0b'
  if (key.includes('nitrate')) return val <= 10 ? '#10b981' : '#ef4444'
  return '#6366f1' // default purple
}

function SafetyDot({ param, value }) {
  const color = getSafetyColor(param, value)
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, marginRight: 4, flexShrink: 0 }} />
}

function QABadge({ status }) {
  const qa = QA_STATUS[status] || { label: status || 'Unknown', color: '#94a3b8' }
  return (
    <span style={{
      padding: '2px 6px', borderRadius: 6, fontSize: 9, fontWeight: 700,
      background: `${qa.color}15`, color: qa.color,
    }}>{qa.label}</span>
  )
}

const TABS = [
  { id: 'observations', label: 'Observations', icon: Eye, color: '#6366f1' },
  { id: 'datasets', label: 'Datasets', icon: Database, color: '#14b8a6' },
  { id: 'organizations', label: 'Organizations', icon: Building2, color: '#f59e0b' },
]

export default function WRDataExplorer() {
  const [tab, setTab] = useState('observations')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(null) // expanded observation
  const [qaFilter, setQaFilter] = useState('')
  const [sortCol] = useState('observed_at')
  const [sortDir] = useState('desc')

  const [dsSearch, setDsSearch] = useState('')
  const [dsStatusFilter, setDsStatusFilter] = useState('')

  // Load ALL pages for datasets/orgs (they're small), paginated for observations
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      if (tab === 'observations') {
        const result = await getObservations({ page, perPage: 100 })
        setData(prev => page === 1 ? result.items : [...prev, ...result.items])
      } else {
        // Load ALL pages for datasets and orgs
        const all = []
        const fetcher = tab === 'datasets' ? getDatasets : getOrganizations
        for (let p = 1; p <= 10; p++) {
          const result = await fetcher({ page: p, perPage: 100 })
          const items = result.items || []
          if (items.length === 0) break
          all.push(...items)
          if (items.length < 100) break
        }
        setData(all)
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [tab, page])

  useEffect(() => { setData([]); setPage(1); setExpanded(null) }, [tab])
  useEffect(() => { load() }, [load])

  // QA counts from actual data
  const qaCounts = useMemo(() => {
    const c = {}
    data.forEach(o => { const s = o.checked || 'unknown'; c[s] = (c[s] || 0) + 1 })
    return c
  }, [data])

  // Sort + filter observations
  const sortedObs = useMemo(() => {
    let items = [...data]
    if (qaFilter) items = items.filter(o => o.checked === qaFilter)
    items.sort((a, b) => {
      let va = a[sortCol] || '', vb = b[sortCol] || ''
      if (sortCol === 'observed_at') { va = new Date(va || 0); vb = new Date(vb || 0) }
      return sortDir === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1)
    })
    return items
  }, [data, sortCol, sortDir, qaFilter])

  // Sort is available via sortCol/sortDir state if needed later

  // CSV export
  const exportCSV = () => {
    let csv = ''
    if (tab === 'observations') {
      const h = ['Date', 'QA Status', 'QA Notes', 'Location ID', 'Parameter', 'Value', 'Unit', 'Equipment', 'Equipment Limit', 'Safety']
      const rows = []
      data.forEach(o => (o.readings || []).forEach(r => {
        const safe = getSafetyColor(r.parameter, r.value)
        rows.push([o.observed_at, o.checked, o.qa_notes || '', o.location_id, r.parameter, r.value, r.unit || '', r.equipment || '', r.equipment_limit || '', safe === '#10b981' ? 'SAFE' : safe === '#f59e0b' ? 'WARNING' : safe === '#ef4444' ? 'CONCERN' : ''])
      }))
      csv = [h, ...rows].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    } else if (tab === 'datasets') {
      const h = ['Name', 'Description', 'Start Date', 'Last Observation', 'Active', 'DataStream', 'Permalink']
      csv = [h, ...data.map(d => [d.name, d.description || '', d.start_date || '', d.last_observation_at || '', !d.dormant, d.share_with_datastream, d.permalink || ''])].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    } else {
      const h = ['Name', 'Program', 'Country', 'City', 'Email', 'Website', 'Description']
      csv = [h, ...data.map(o => [o.name, o.program_name || '', o.primary_country || '', o.nearest_town_city || '', o.email || '', o.website || '', o.short_description || ''])].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `water-rangers-${tab}-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
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
            {data.length} {tab} from Water Rangers · Click any row to see details
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'rgba(20,184,166,.06)', border: '1px solid rgba(20,184,166,.15)', borderRadius: 8, color: '#14b8a6', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
            <Download size={11} /> Export CSV
          </button>
          <button onClick={() => { setPage(1); load() }} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)', borderRadius: 8, color: '#a78bfa', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Reload
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
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

      {loading && data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <RefreshCw size={16} className="animate-spin" style={{ margin: '0 auto 8px' }} /> Loading {tab}...
        </div>
      ) : tab === 'observations' ? (
        /* ══════ OBSERVATIONS ══════ */
        <div>
          {/* QA filters with counts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: '22px', marginRight: 2 }}>QA:</span>
            <button onClick={() => setQaFilter('')} style={{ padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 600, background: !qaFilter ? 'rgba(99,102,241,.12)' : 'transparent', border: !qaFilter ? '1px solid rgba(99,102,241,.25)' : '1px solid transparent', color: !qaFilter ? '#a78bfa' : 'var(--text-muted)', cursor: 'pointer' }}>All ({data.length})</button>
            {Object.entries(qaCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <button key={status} onClick={() => setQaFilter(qaFilter === status ? '' : status)} style={{ padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 600, background: qaFilter === status ? 'rgba(99,102,241,.12)' : 'transparent', border: qaFilter === status ? '1px solid rgba(99,102,241,.25)' : '1px solid transparent', color: qaFilter === status ? '#a78bfa' : 'var(--text-muted)', cursor: 'pointer' }}>{status} ({count})</button>
            ))}
          </div>

          {/* Safety legend */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 10, color: 'var(--text-muted)' }}>
            <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10b981', marginRight: 3 }} />Safe</span>
            <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', marginRight: 3 }} />Watch</span>
            <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#ef4444', marginRight: 3 }} />Concern</span>
          </div>

          {/* Observation cards */}
          {sortedObs.map((o, i) => {
            const quantReadings = (o.readings || []).filter(r => r.value != null && r.unit && r.unit !== 'nil')
            const qualReadings = (o.readings || []).filter(r => !r.unit || r.unit === 'nil')
            const isExpanded = expanded === o.id
            return (
              <div key={o.id || i} style={{
                background: 'var(--card-bg)', border: `1px solid ${isExpanded ? 'rgba(99,102,241,.3)' : 'var(--border)'}`,
                borderRadius: 10, padding: 10, marginBottom: 6, cursor: 'pointer',
              }} onClick={() => setExpanded(isExpanded ? null : o.id)}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700 }}>
                      {o.observed_at ? new Date(o.observed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date'}
                    </span>
                    <QABadge status={o.checked} />
                    {(o.photos || []).length > 0 && <span style={{ fontSize: 10, color: '#ec4899' }}><Camera size={10} /> {o.photos.length}</span>}
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{isExpanded ? '▲' : '▼'} {quantReadings.length} readings</span>
                </div>

                {/* Quick reading badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {quantReadings.slice(0, isExpanded ? 999 : 6).map((r, j) => (
                    <span key={j} style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 5, display: 'flex', alignItems: 'center',
                      background: `${getSafetyColor(r.parameter, r.value)}10`,
                      border: `1px solid ${getSafetyColor(r.parameter, r.value)}25`,
                      color: 'var(--text)',
                    }}>
                      <SafetyDot param={r.parameter} value={r.value} />
                      {(r.parameter || '').replace(/_/g, ' ')}: <strong style={{ marginLeft: 3 }}>{r.value}</strong>
                      {r.unit && <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>{r.unit.replace(/_/g, '/')}</span>}
                      {r.equipment_limit && <span style={{ color: '#f59e0b', marginLeft: 2, fontWeight: 700 }}>{r.equipment_limit}</span>}
                    </span>
                  ))}
                  {!isExpanded && quantReadings.length > 6 && <span style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: '20px' }}>+{quantReadings.length - 6} more</span>}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    {/* QA info */}
                    {o.qa_notes && (
                      <div style={{ padding: '6px 8px', borderRadius: 6, marginBottom: 6, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.12)', fontSize: 11, color: '#fbbf24' }}>
                        ⚠️ <strong>QA Note:</strong> {o.qa_notes}
                      </div>
                    )}
                    {o.qa_admin_notes && (
                      <div style={{ padding: '6px 8px', borderRadius: 6, marginBottom: 6, background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.12)', fontSize: 11, color: '#a78bfa' }}>
                        📋 <strong>Admin Note:</strong> {o.qa_admin_notes}
                      </div>
                    )}

                    {/* Detailed readings with explanations */}
                    <h4 style={{ color: 'var(--text)', fontSize: 11, fontWeight: 700, margin: '0 0 4px' }}>📊 Readings Explained</h4>
                    {quantReadings.map((r, j) => {
                      const info = getReadingInfo(r.parameter)
                      return (
                        <div key={j} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <SafetyDot param={r.parameter} value={r.value} />
                            <strong style={{ color: 'var(--text)' }}>{info.emoji} {(r.parameter || '').replace(/_/g, ' ')}</strong>
                            <span style={{ color: getSafetyColor(r.parameter, r.value), fontWeight: 800 }}>{r.value} {(r.unit || '').replace(/_/g, '/')}</span>
                            {info.safe !== '—' && <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>(safe: {info.safe})</span>}
                          </div>
                          {info.explain && <div style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 15, marginTop: 1 }}>{info.explain}</div>}
                          {r.equipment && <div style={{ color: 'var(--text-muted)', fontSize: 9, marginLeft: 15 }}>🔬 {r.equipment.replace(/_/g, ' ')}</div>}
                        </div>
                      )
                    })}

                    {/* Qualitative readings */}
                    {qualReadings.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <h4 style={{ color: 'var(--text)', fontSize: 11, fontWeight: 700, margin: '0 0 4px' }}>👁️ Visual Observations</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {qualReadings.map((r, j) => (
                            <span key={j} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                              {(r.parameter || '').replace(/_/g, ' ')}: {r.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Photos */}
                    {(o.photos || []).length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <h4 style={{ color: 'var(--text)', fontSize: 11, fontWeight: 700, margin: '0 0 4px' }}>📸 Photos</h4>
                        <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
                          {o.photos.map((p, j) => (
                            <img key={j} src={typeof p === 'string' ? p : p.url} alt="" style={{ height: 80, borderRadius: 6, border: '1px solid var(--border)' }} onError={e => e.target.style.display = 'none'} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {sortedObs.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
            {qaFilter ? `No observations with "${qaFilter}" status — click All to see everything` : 'No observations found'}
          </div>}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Showing {sortedObs.length} of {data.length}</div>
        </div>
      ) : tab === 'datasets' ? (
        /* ══════ DATASETS ══════ */
        <div>
          {/* Dataset filters */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <input value={dsSearch} onChange={e => setDsSearch(e.target.value)} placeholder="Search datasets..."
              style={{ padding: '5px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(0,0,0,.1)', border: '1px solid var(--border)', color: 'var(--text)', width: 200 }} />
            <button onClick={() => setDsStatusFilter('')} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: !dsStatusFilter ? 'rgba(99,102,241,.12)' : 'transparent', border: !dsStatusFilter ? '1px solid rgba(99,102,241,.25)' : '1px solid transparent', color: !dsStatusFilter ? '#a78bfa' : 'var(--text-muted)', cursor: 'pointer' }}>All ({data.length})</button>
            <button onClick={() => setDsStatusFilter('active')} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: dsStatusFilter === 'active' ? 'rgba(16,185,129,.12)' : 'transparent', border: dsStatusFilter === 'active' ? '1px solid rgba(16,185,129,.25)' : '1px solid transparent', color: dsStatusFilter === 'active' ? '#10b981' : 'var(--text-muted)', cursor: 'pointer' }}>✅ Active ({data.filter(d => !d.dormant).length})</button>
            <button onClick={() => setDsStatusFilter('dormant')} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: dsStatusFilter === 'dormant' ? 'rgba(239,68,68,.12)' : 'transparent', border: dsStatusFilter === 'dormant' ? '1px solid rgba(239,68,68,.25)' : '1px solid transparent', color: dsStatusFilter === 'dormant' ? '#ef4444' : 'var(--text-muted)', cursor: 'pointer' }}>💤 Dormant ({data.filter(d => d.dormant).length})</button>
            <button onClick={() => setDsStatusFilter('datastream')} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: dsStatusFilter === 'datastream' ? 'rgba(20,184,166,.12)' : 'transparent', border: dsStatusFilter === 'datastream' ? '1px solid rgba(20,184,166,.25)' : '1px solid transparent', color: dsStatusFilter === 'datastream' ? '#14b8a6' : 'var(--text-muted)', cursor: 'pointer' }}>🔗 DataStream ({data.filter(d => d.share_with_datastream).length})</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 8 }}>
          {data.filter(ds => {
            if (dsSearch && !(ds.name || '').toLowerCase().includes(dsSearch.toLowerCase()) && !(ds.description || '').toLowerCase().includes(dsSearch.toLowerCase())) return false
            if (dsStatusFilter === 'active' && ds.dormant) return false
            if (dsStatusFilter === 'dormant' && !ds.dormant) return false
            if (dsStatusFilter === 'datastream' && !ds.share_with_datastream) return false
            return true
          }).map((ds, i) => (
            <div key={ds.id || i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h4 style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700, margin: 0, flex: 1 }}>{ds.name || `#${ds.id}`}</h4>
                <span style={{ padding: '2px 6px', borderRadius: 6, fontSize: 9, fontWeight: 700, background: ds.dormant ? 'rgba(239,68,68,.08)' : 'rgba(16,185,129,.08)', color: ds.dormant ? '#ef4444' : '#10b981' }}>
                  {ds.dormant ? '💤 Dormant' : '✅ Active'}
                </span>
              </div>
              {ds.description && <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, margin: '2px 0 6px', maxHeight: 50, overflow: 'hidden' }}>{ds.description}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                {ds.start_date && <span>📅 Since {new Date(ds.start_date).toLocaleDateString()}</span>}
                {ds.last_observation_at && <span>🔬 Last: {new Date(ds.last_observation_at).toLocaleDateString()}</span>}
                {ds.share_with_datastream && <span style={{ color: '#14b8a6' }}>🔗 DataStream</span>}
                {ds.certification_requirements && <span>📜 {ds.certification_requirements}</span>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {ds.permalink && <a href={ds.permalink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', borderRadius: 6, background: 'rgba(99,102,241,.06)', color: '#a78bfa', fontSize: 10, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(99,102,241,.12)' }}>
                  <ExternalLink size={9} /> View Data
                </a>}
                {ds.datastream_dataset_url && <a href={ds.datastream_dataset_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', borderRadius: 6, background: 'rgba(20,184,166,.06)', color: '#14b8a6', fontSize: 10, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(20,184,166,.12)' }}>
                  <ExternalLink size={9} /> DataStream
                </a>}
              </div>
            </div>
          ))}
          </div>
        </div>
      ) : (
        /* ══════ ORGANIZATIONS ══════ */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
          {data.map((org, i) => (
            <div key={org.id || i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <h4 style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700, margin: '0 0 2px' }}>{org.name}</h4>
              {org.program_name && <div style={{ color: '#a78bfa', fontSize: 10, fontWeight: 600, marginBottom: 4 }}>{org.program_name}</div>}
              {org.short_description && <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, margin: '0 0 6px' }}>{org.short_description}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                {org.primary_country && <span>🌍 {org.primary_country}</span>}
                {org.nearest_town_city && <span>📍 {org.nearest_town_city}</span>}
                {org.email && <span>✉️ {org.email}</span>}
                {org.website && <a href={org.website} target="_blank" rel="noreferrer" style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: 2 }}><ExternalLink size={9} /> Website</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {data.length > 0 && data.length >= page * 100 && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button onClick={() => setPage(p => p + 1)} disabled={loading} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)', color: '#a78bfa', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Loading...' : `Load More ${tab}`}
          </button>
        </div>
      )}
    </div>
  )
}
