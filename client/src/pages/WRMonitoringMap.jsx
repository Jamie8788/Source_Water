/**
 * WRMonitoringMap — Water Rangers Monitoring Map
 * Real locations from Water Rangers API with site details, parameters, status
 */
import { useState, useEffect, useCallback } from 'react'
import { MapPin, RefreshCw, AlertTriangle, X, Droplets, Activity, Camera, Beaker } from 'lucide-react'
import { getLocations } from '../api/waterRangers'

function StatusBadge({ active }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      background: active ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.12)',
      color: active ? '#10b981' : '#ef4444',
      border: `1px solid ${active ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.25)'}`,
    }}>
      {active ? 'Active' : 'Dormant'}
    </span>
  )
}

function SiteCard({ site, onClick }) {
  const name = site.name || site.title || `Site #${site.id}`
  const waterBody = site.water_body_type || site.body_of_water_type || '—'
  const lat = site.latitude || site.lat
  const lng = site.longitude || site.lng || site.lon
  const obsCount = site.observations_count || site.total_observations || 0
  const active = site.status !== 'dormant' && site.status !== 'inactive'

  return (
    <div onClick={() => onClick(site)}
      style={{
        background: 'var(--card-bg, rgba(255,255,255,.04))',
        border: '1px solid var(--border, rgba(255,255,255,.08))',
        borderRadius: 12, padding: 14, cursor: 'pointer',
        transition: 'all .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,.4)'; e.currentTarget.style.background = 'rgba(99,102,241,.06)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, rgba(255,255,255,.08))'; e.currentTarget.style.background = 'var(--card-bg, rgba(255,255,255,.04))' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <h4 style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700, margin: 0, flex: 1 }}>{name}</h4>
        <StatusBadge active={active} />
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
        <span><Droplets size={11} style={{ marginRight: 3 }} />{waterBody}</span>
        <span><Activity size={11} style={{ marginRight: 3 }} />{obsCount} obs</span>
      </div>
      {lat && lng && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, opacity: .6 }}>
          {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
        </div>
      )}
    </div>
  )
}

function SiteDetail({ site, onClose }) {
  if (!site) return null
  const name = site.name || site.title || `Site #${site.id}`
  const desc = site.description || site.notes || ''
  const waterBody = site.water_body_type || site.body_of_water_type || '—'
  const equipment = site.equipment || site.devices || []
  const parameters = site.parameters || site.parameter_names || []
  const photos = site.photos || site.images || []
  const lat = site.latitude || site.lat
  const lng = site.longitude || site.lng || site.lon

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card-bg, #1a1a2e)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 24, maxWidth: 560, width: '90%', maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 800, margin: 0 }}>{name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {desc && <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>{desc}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'rgba(99,102,241,.08)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Water Body</div>
            <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700 }}>{waterBody}</div>
          </div>
          <div style={{ background: 'rgba(20,184,166,.08)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Coordinates</div>
            <div style={{ color: 'var(--text)', fontSize: 12, fontWeight: 600 }}>
              {lat ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : 'N/A'}
            </div>
          </div>
        </div>

        {Array.isArray(parameters) && parameters.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              <Beaker size={12} style={{ marginRight: 4 }} />Parameters Tested
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {parameters.map((p, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 6,
                  background: 'rgba(99,102,241,.1)', color: '#a78bfa',
                  border: '1px solid rgba(99,102,241,.2)',
                }}>{typeof p === 'string' ? p : p.name || p.label || JSON.stringify(p)}</span>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(equipment) && equipment.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Equipment</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {equipment.map((e, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 6,
                  background: 'rgba(20,184,166,.1)', color: '#14b8a6',
                  border: '1px solid rgba(20,184,166,.2)',
                }}>{typeof e === 'string' ? e : e.name || JSON.stringify(e)}</span>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(photos) && photos.length > 0 && (
          <div>
            <h4 style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              <Camera size={12} style={{ marginRight: 4 }} />Photos
            </h4>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {photos.slice(0, 4).map((p, i) => (
                <img key={i} src={typeof p === 'string' ? p : p.url || p.src}
                  alt="" style={{ width: 100, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
              ))}
            </div>
          </div>
        )}

        <pre style={{
          fontSize: 10, color: 'var(--text-muted)', background: 'rgba(0,0,0,.2)',
          borderRadius: 8, padding: 10, marginTop: 14, maxHeight: 120, overflowY: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {JSON.stringify(site, null, 2)}
        </pre>
      </div>
    </div>
  )
}

export default function WRMonitoringMap() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    // API key is server-side — just fetch
    setLoading(true); setError(null)
    try {
      const data = await getLocations({ page, perPage: 100 })
      const locs = Array.isArray(data) ? data : data.locations || data.data || []
      setLocations(prev => page === 1 ? locs : [...prev, ...locs])
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }, [page])

  useEffect(() => { load() }, [load])

  const filtered = locations.filter(l => {
    if (!search) return true
    const s = search.toLowerCase()
    const name = (l.name || l.title || '').toLowerCase()
    const body = (l.water_body_type || l.body_of_water_type || '').toLowerCase()
    return name.includes(s) || body.includes(s)
  })

  const stats = {
    total: locations.length,
    active: locations.filter(l => l.status !== 'dormant' && l.status !== 'inactive').length,
    withObs: locations.filter(l => (l.observations_count || 0) > 0).length,
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 130px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={22} color="#6366f1" /> Monitoring Map
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            Real monitoring locations from Water Rangers · {stats.total} sites loaded
          </p>
        </div>
        <button onClick={() => { setPage(1); load() }} disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.3)',
            borderRadius: 10, color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Sites', value: stats.total, color: '#6366f1' },
          { label: 'Active', value: stats.active, color: '#10b981' },
          { label: 'With Observations', value: stats.withObs, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 14, textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search sites by name or water body type..."
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          color: 'var(--text)', marginBottom: 16, boxSizing: 'border-box', outline: 'none',
        }}
      />

      {/* Error */}
      {error && (
        <div style={{
          padding: 14, borderRadius: 10, marginBottom: 16,
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
          color: '#fca5a5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Sites grid */}
      {loading && locations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
          Loading monitoring sites...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {filtered.map(site => (
              <SiteCard key={site.id} site={site} onClick={setSelected} />
            ))}
          </div>
          {filtered.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
              {search ? 'No sites match your search' : 'No sites found'}
            </div>
          )}
          {locations.length >= page * 100 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => setPage(p => p + 1)} disabled={loading}
                style={{
                  padding: '10px 24px', borderRadius: 10,
                  background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.3)',
                  color: '#a78bfa', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                {loading ? 'Loading...' : 'Load More Sites'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {selected && <SiteDetail site={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
