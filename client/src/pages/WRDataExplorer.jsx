/**
 * WRDataExplorer — Unified Water Rangers Data Explorer
 * Tab 1: Observations (readings, QA status, parameters, photos)
 * Tab 2: Datasets (programs, metadata, forms, status)
 * Tab 3: Organizations
 * All real data from Water Rangers API
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Database, Eye, Calendar, MapPin,
  RefreshCw, AlertTriangle, Search, ExternalLink, Camera,
  Building2,
} from 'lucide-react'
import { getObservations, getDatasets, getOrganizations, QA_STATUS } from '../api/waterRangers'

const TABS = [
  { id: 'observations', label: 'Observations', icon: Eye, color: '#6366f1' },
  { id: 'datasets', label: 'Datasets & Programs', icon: Database, color: '#14b8a6' },
  { id: 'organizations', label: 'Organizations', icon: Building2, color: '#f59e0b' },
]

function QABadge({ status }) {
  const qa = QA_STATUS[status] || QA_STATUS.raw
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
      background: `${qa.color}18`, color: qa.color,
      border: `1px solid ${qa.color}30`,
    }}>{qa.label}</span>
  )
}

// ── Observation Card ─────────────────────────────────────────────────────────
function ObsCard({ obs, onSelect }) {
  const date = obs.observed_at || obs.created_at || ''
  const qaStatus = obs.checked || 'raw'
  const readings = obs.readings || obs.tested_parameters || []
  const photos = obs.photos || []
  const locationName = obs.location?.name || obs.location_name || `Location #${obs.location_id || '?'}`

  return (
    <div onClick={() => onSelect(obs)} style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'border-color .15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,.4)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={12} color="#6366f1" />
          <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700 }}>{locationName}</span>
        </div>
        <QABadge status={qaStatus} />
      </div>

      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
        <span><Calendar size={10} style={{ marginRight: 3 }} />{date ? new Date(date).toLocaleDateString() : '—'}</span>
        {photos.length > 0 && <span><Camera size={10} style={{ marginRight: 3 }} />{photos.length} photo{photos.length > 1 ? 's' : ''}</span>}
      </div>

      {Array.isArray(readings) && readings.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {readings.slice(0, 6).map((r, i) => (
            <span key={i} style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 6,
              background: 'rgba(99,102,241,.08)', color: '#a78bfa',
              border: '1px solid rgba(99,102,241,.15)',
            }}>
              {r.parameter || r.name || 'param'}: {r.value ?? '—'}{r.unit ? ` ${r.unit}` : ''}
            </span>
          ))}
          {readings.length > 6 && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{readings.length - 6} more</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Dataset Card ─────────────────────────────────────────────────────────────
function DatasetCard({ ds, onSelect }) {
  const dormant = ds.dormant === true || ds.dormant === 'true'
  return (
    <div onClick={() => onSelect(ds)} style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'border-color .15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(20,184,166,.4)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <h4 style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700, margin: 0, flex: 1 }}>
          {ds.name || `Dataset #${ds.id}`}
        </h4>
        <span style={{
          padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
          background: dormant ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)',
          color: dormant ? '#ef4444' : '#10b981',
        }}>{dormant ? 'Dormant' : 'Active'}</span>
      </div>
      {ds.description && (
        <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, margin: '4px 0 8px', maxHeight: 40, overflow: 'hidden' }}>
          {ds.description}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-muted)' }}>
        {ds.start_date && <span><Calendar size={10} style={{ marginRight: 3 }} />Since {new Date(ds.start_date).getFullYear()}</span>}
        {ds.share_with_datastream && <span style={{ color: '#14b8a6' }}>DataStream ✓</span>}
      </div>
    </div>
  )
}

// ── Org Card ─────────────────────────────────────────────────────────────────
function OrgCard({ org }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 14,
    }}>
      <h4 style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>
        {org.name || `Org #${org.id}`}
      </h4>
      {org.short_description && (
        <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, margin: '0 0 6px' }}>{org.short_description}</p>
      )}
      <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-muted)' }}>
        {org.country && <span>{org.country}</span>}
        {org.city && <span>{org.city}</span>}
        {org.website && (
          <a href={org.website} target="_blank" rel="noreferrer" style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: 3 }}>
            <ExternalLink size={9} /> Website
          </a>
        )}
      </div>
    </div>
  )
}

// ── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ item, type, onClose }) {
  if (!item) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card-bg, #1a1a2e)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 24, maxWidth: 640, width: '92%', maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 800, margin: 0 }}>
            {type === 'observation' ? 'Observation Detail' : 'Dataset Detail'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* QA info for observations */}
        {type === 'observation' && item.qa_notes && (
          <div style={{
            background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)',
            borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: '#fbbf24',
          }}>
            <strong>QA Notes:</strong> {item.qa_notes}
          </div>
        )}

        {/* Readings table for observations */}
        {type === 'observation' && Array.isArray(item.readings || item.tested_parameters) && (
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Readings</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Parameter', 'Value', 'Unit', 'Equipment', 'Limit'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(item.readings || item.tested_parameters || []).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px', color: 'var(--text)', fontWeight: 600 }}>{r.parameter || r.name || '—'}</td>
                      <td style={{ padding: '6px 8px', color: '#a78bfa', fontWeight: 700 }}>{r.value ?? '—'}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{r.unit || '—'}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{r.equipment || '—'}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{r.equipment_limit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Photos */}
        {Array.isArray(item.photos) && item.photos.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Photos</h4>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {item.photos.map((p, i) => (
                <img key={i} src={typeof p === 'string' ? p : p.url || p.src} alt=""
                  style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                  onError={e => e.target.style.display = 'none'} />
              ))}
            </div>
          </div>
        )}

        <pre style={{
          fontSize: 10, color: 'var(--text-muted)', background: 'rgba(0,0,0,.2)',
          borderRadius: 8, padding: 10, maxHeight: 200, overflowY: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>{JSON.stringify(item, null, 2)}</pre>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function WRDataExplorer() {
  const [tab, setTab] = useState('observations')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    // API key is server-side
    setLoading(true); setError(null)
    try {
      let result
      if (tab === 'observations') result = await getObservations({ page, perPage: 50 })
      else if (tab === 'datasets') result = await getDatasets({ page, perPage: 50 })
      else result = await getOrganizations({ page, perPage: 50 })
      setData(prev => page === 1 ? result.items : [...prev, ...result.items])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [tab, page])

  useEffect(() => { setData([]); setPage(1) }, [tab])
  useEffect(() => { load() }, [load])

  return (
    <div style={{ minHeight: 'calc(100vh - 130px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 900, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={22} color="#14b8a6" /> Data Explorer
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Browse real Water Rangers observations, datasets, and organizations
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 1 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: tab === t.id ? `${t.color}15` : 'transparent',
            border: 'none', borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
            color: tab === t.id ? t.color : 'var(--text-muted)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
          }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${tab}...`}
            style={{
              width: '100%', padding: '9px 14px 9px 34px', borderRadius: 10, fontSize: 12,
              background: 'var(--card-bg)', border: '1px solid var(--border)',
              color: 'var(--text)', boxSizing: 'border-box', outline: 'none',
            }} />
        </div>
        <button onClick={() => { setPage(1); load() }} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px',
          background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.25)',
          borderRadius: 10, color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: 12, borderRadius: 10, marginBottom: 14,
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)',
          color: '#fca5a5', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
        }}><AlertTriangle size={14} /> {error}</div>
      )}

      {/* Content */}
      {loading && data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          Loading {tab}...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
            {data.map((item, i) => {
              if (tab === 'observations') return <ObsCard key={item.id || i} obs={item} onSelect={o => setSelected({ item: o, type: 'observation' })} />
              if (tab === 'datasets') return <DatasetCard key={item.id || i} ds={item} onSelect={d => setSelected({ item: d, type: 'dataset' })} />
              return <OrgCard key={item.id || i} org={item} />
            })}
          </div>

          {data.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No {tab} found</div>
          )}

          {data.length >= page * 50 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => setPage(p => p + 1)} disabled={loading} style={{
                padding: '10px 24px', borderRadius: 10,
                background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.25)',
                color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{loading ? 'Loading...' : 'Load More'}</button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {selected && <DetailModal item={selected.item} type={selected.type} onClose={() => setSelected(null)} />}
    </div>
  )
}
