/**
 * WRDataExplorer — Real Water Rangers Data Explorer
 * Observations with full readings table, QA status, CSV export
 * Datasets with metadata, forms, status
 * Organizations browser
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Database, Eye, Calendar, RefreshCw, AlertTriangle,
  ExternalLink, Camera, Building2, Download,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { getObservations, getDatasets, getOrganizations, QA_STATUS } from '../api/waterRangers'

const TABS = [
  { id: 'observations', label: 'Observations', icon: Eye, color: '#6366f1' },
  { id: 'datasets', label: 'Datasets', icon: Database, color: '#14b8a6' },
  { id: 'organizations', label: 'Organizations', icon: Building2, color: '#f59e0b' },
]

function QABadge({ status }) {
  const qa = QA_STATUS[status] || QA_STATUS.raw
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 8, fontSize: 9, fontWeight: 700,
      background: `${qa.color}18`, color: qa.color,
    }}>{qa.label}</span>
  )
}

export default function WRDataExplorer() {
  const [tab, setTab] = useState('observations')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [sortCol, setSortCol] = useState('observed_at')
  const [sortDir, setSortDir] = useState('desc')
  const [qaFilter, setQaFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      let result
      if (tab === 'observations') result = await getObservations({ page, perPage: 100 })
      else if (tab === 'datasets') result = await getDatasets({ page, perPage: 100 })
      else result = await getOrganizations({ page, perPage: 100 })
      setData(prev => page === 1 ? result.items : [...prev, ...result.items])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [tab, page])

  useEffect(() => { setData([]); setPage(1) }, [tab])
  useEffect(() => { load() }, [load])

  // Sort helper
  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }
  const SortIcon = ({ col }) => sortCol === col
    ? (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
    : <ChevronDown size={10} style={{ opacity: .3 }} />

  // Filter + sort observations
  const sortedObs = useMemo(() => {
    let items = [...data]
    if (qaFilter) items = items.filter(o => o.checked === qaFilter)
    items.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol]
      if (sortCol === 'observed_at') { va = new Date(va || 0); vb = new Date(vb || 0) }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return items
  }, [data, sortCol, sortDir, qaFilter])

  // CSV export
  const exportCSV = () => {
    let csv = ''
    if (tab === 'observations') {
      const headers = ['Date', 'Location ID', 'QA Status', 'QA Notes', 'Parameter', 'Value', 'Unit', 'Equipment']
      const rows = []
      data.forEach(o => {
        (o.readings || []).forEach(r => {
          rows.push([o.observed_at, o.location_id, o.checked, o.qa_notes || '', r.parameter, r.value, r.unit || '', r.equipment || ''])
        })
      })
      csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    } else if (tab === 'datasets') {
      const headers = ['Name', 'Description', 'Start Date', 'Dormant', 'DataStream', 'Permalink']
      const rows = data.map(d => [d.name, d.description || '', d.start_date || '', d.dormant, d.share_with_datastream, d.permalink || ''])
      csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    } else {
      const headers = ['Name', 'Country', 'City', 'Email', 'Website']
      const rows = data.map(o => [o.name, o.primary_country || '', o.nearest_town_city || '', o.email || '', o.website || ''])
      csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `water-rangers-${tab}-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 130px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={20} color="#14b8a6" /> Data Explorer
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
            {data.length} {tab} loaded from Water Rangers
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={exportCSV} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            background: 'rgba(20,184,166,.08)', border: '1px solid rgba(20,184,166,.2)',
            borderRadius: 8, color: '#14b8a6', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}><Download size={12} /> Export CSV</button>
          <button onClick={() => { setPage(1); load() }} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)',
            borderRadius: 8, color: '#a78bfa', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
            background: tab === t.id ? `${t.color}12` : 'transparent',
            border: 'none', borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
            color: tab === t.id ? t.color : 'var(--text-muted)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}><t.icon size={13} /> {t.label}</button>
        ))}
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 8, marginBottom: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: 12 }}>
          <AlertTriangle size={13} style={{ marginRight: 6 }} />{error}
        </div>
      )}

      {/* QA filter for observations */}
      {tab === 'observations' && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: '24px', marginRight: 4 }}>QA:</span>
          {['', 'raw', 'review_needed', 'reviewed', 'qc_complete', 'issue_found'].map(q => (
            <button key={q} onClick={() => setQaFilter(q)} style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
              background: qaFilter === q ? 'rgba(99,102,241,.12)' : 'transparent',
              border: qaFilter === q ? '1px solid rgba(99,102,241,.3)' : '1px solid transparent',
              color: qaFilter === q ? '#a78bfa' : 'var(--text-muted)', cursor: 'pointer',
            }}>{q || 'All'}</button>
          ))}
        </div>
      )}

      {loading && data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 8px' }} /> Loading {tab}...
        </div>
      ) : tab === 'observations' ? (
        /* ── OBSERVATIONS TABLE ─────────────────────────────────────── */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {[
                  { key: 'observed_at', label: 'Date' },
                  { key: 'checked', label: 'QA' },
                  { key: 'location_id', label: 'Location' },
                  { key: 'readings', label: 'Readings' },
                  { key: 'qa_notes', label: 'QA Notes' },
                  { key: 'photos', label: 'Photos' },
                ].map(h => (
                  <th key={h.key} onClick={() => toggleSort(h.key)} style={{
                    padding: '8px 6px', color: 'var(--text-muted)', textAlign: 'left',
                    fontWeight: 700, fontSize: 10, cursor: 'pointer', userSelect: 'none',
                  }}>{h.label} <SortIcon col={h.key} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedObs.map((o, i) => (
                <tr key={o.id || i} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '6px', color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {o.observed_at ? new Date(o.observed_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '6px' }}><QABadge status={o.checked} /></td>
                  <td style={{ padding: '6px', color: 'var(--text-muted)', fontSize: 10, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(o.location_id || '').slice(0, 8)}...
                  </td>
                  <td style={{ padding: '6px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {(o.readings || []).filter(r => r.value !== null && r.value !== undefined && r.unit !== 'nil').slice(0, 6).map((r, j) => (
                        <span key={j} style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 4,
                          background: 'rgba(99,102,241,.07)', color: '#a78bfa',
                        }}>
                          {(r.parameter || '').replace(/_/g, ' ')}: <strong>{r.value}</strong>{r.unit && r.unit !== 'nil' ? ` ${r.unit.replace(/_/g, '/')}` : ''}
                        </span>
                      ))}
                      {(o.readings || []).length > 6 && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{o.readings.length - 6}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '6px', color: o.qa_notes ? '#fbbf24' : 'var(--text-muted)', fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.qa_notes || '—'}
                  </td>
                  <td style={{ padding: '6px', color: 'var(--text-muted)' }}>
                    {(o.photos || []).length > 0 ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Camera size={10} /> {o.photos.length}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'datasets' ? (
        /* ── DATASETS ───────────────────────────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
          {data.map((ds, i) => (
            <div key={ds.id || i} style={{
              background: 'var(--card-bg)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 14, cursor: 'pointer',
            }} onClick={() => setSelected(ds)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h4 style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700, margin: 0, flex: 1 }}>{ds.name || `#${ds.id}`}</h4>
                <span style={{
                  padding: '2px 7px', borderRadius: 8, fontSize: 9, fontWeight: 700,
                  background: ds.dormant ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)',
                  color: ds.dormant ? '#ef4444' : '#10b981',
                }}>{ds.dormant ? 'Dormant' : 'Active'}</span>
              </div>
              {ds.description && <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, margin: '0 0 8px', maxHeight: 44, overflow: 'hidden' }}>{ds.description}</p>}
              <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-muted)' }}>
                {ds.start_date && <span><Calendar size={10} style={{ marginRight: 2 }} />{new Date(ds.start_date).toLocaleDateString()}</span>}
                {ds.last_observation_at && <span>Last obs: {new Date(ds.last_observation_at).toLocaleDateString()}</span>}
                {ds.share_with_datastream && <span style={{ color: '#14b8a6' }}>DataStream ✓</span>}
              </div>
              {ds.permalink && (
                <a href={ds.permalink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#6366f1', fontSize: 10, marginTop: 6 }}>
                  <ExternalLink size={9} /> View on Water Rangers
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* ── ORGANIZATIONS ──────────────────────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
          {data.map((org, i) => (
            <div key={org.id || i} style={{
              background: 'var(--card-bg)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 14,
            }}>
              <h4 style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>{org.name}</h4>
              {org.short_description && <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, margin: '0 0 6px' }}>{org.short_description}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                {org.primary_country && <span><Globe2 size={9} style={{ marginRight: 2 }} />{org.primary_country}</span>}
                {org.nearest_town_city && <span>{org.nearest_town_city}</span>}
                {org.email && <span>{org.email}</span>}
                {org.website && <a href={org.website} target="_blank" rel="noreferrer" style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: 2 }}><ExternalLink size={9} /> Site</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {data.length > 0 && data.length >= page * (tab === 'observations' ? 100 : 100) && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button onClick={() => setPage(p => p + 1)} disabled={loading} style={{
            padding: '8px 20px', borderRadius: 8, background: 'rgba(99,102,241,.08)',
            border: '1px solid rgba(99,102,241,.2)', color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{loading ? 'Loading...' : 'Load More'}</button>
        </div>
      )}

      {/* Detail modal for datasets */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--card-bg, #1e1e2e)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 20, maxWidth: 600, width: '92%', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 800, margin: 0 }}>{selected.name}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            {selected.description && <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>{selected.description}</p>}
            <pre style={{
              fontSize: 10, color: 'var(--text-muted)', background: 'rgba(0,0,0,.2)',
              borderRadius: 8, padding: 10, maxHeight: 300, overflowY: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

// Small globe icon fallback
function Globe2(props) {
  return <svg width={props.size||12} height={props.size||12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={props.style}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
}
