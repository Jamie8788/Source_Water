/**
 * WRMonitoringMap — Real Water Rangers locations on Leaflet map
 * Every marker = real location from Water Rangers API
 * Filters: country, water body type, active/dormant, parameter
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapPin, RefreshCw, AlertTriangle, X, Droplets, Activity,
  Camera, Beaker, Filter, Download, Globe, ChevronDown,
  ExternalLink, Search,
} from 'lucide-react'
import { getLocations } from '../api/waterRangers'

// Fix default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Color markers by water body type
const BODY_COLORS = {
  river_or_stream: '#3b82f6',
  lake: '#06b6d4',
  pond: '#14b8a6',
  wetland: '#10b981',
  ocean: '#1d4ed8',
  estuary: '#6366f1',
  canal: '#8b5cf6',
  reservoir: '#0ea5e9',
  spring: '#22d3ee',
  ditch: '#a3a3a3',
}

function makeIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  })
}

// Fit map to markers
function FitBounds({ locations }) {
  const map = useMap()
  useEffect(() => {
    if (locations.length === 0) return
    const bounds = locations
      .filter(l => l.latitude && l.longitude)
      .map(l => [parseFloat(l.latitude), parseFloat(l.longitude)])
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 })
  }, [locations, map])
  return null
}

export default function WRMonitoringMap() {
  const [allLocations, setAllLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loadedPages, setLoadedPages] = useState(0)
  const [selected, setSelected] = useState(null)

  // Filters
  const [countryFilter, setCountryFilter] = useState('')
  const [bodyFilter, setBodyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paramFilter, setParamFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Load ALL locations (paginate through)
  const loadAll = useCallback(async () => {
    setLoading(true); setError(null); setAllLocations([]); setLoadedPages(0)
    try {
      const all = []
      for (let page = 1; page <= 20; page++) {
        const result = await getLocations({ page, perPage: 100 })
        const items = result.items || []
        if (items.length === 0) break
        all.push(...items)
        setAllLocations([...all])
        setLoadedPages(page)
        if (items.length < 100) break
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Extract unique values for filters
  const countries = useMemo(() => [...new Set(allLocations.map(l => l.country).filter(Boolean))].sort(), [allLocations])
  const bodyTypes = useMemo(() => [...new Set(allLocations.map(l => l.water_body_type).filter(Boolean))].sort(), [allLocations])
  const allParams = useMemo(() => {
    const s = new Set()
    allLocations.forEach(l => (l.tested_parameters || []).forEach(p => s.add(p)))
    return [...s].sort()
  }, [allLocations])

  // Apply filters
  const filtered = useMemo(() => {
    return allLocations.filter(l => {
      if (countryFilter && l.country !== countryFilter) return false
      if (bodyFilter && l.water_body_type !== bodyFilter) return false
      if (statusFilter === 'active' && !l.last_observation_at) return false
      if (statusFilter === 'dormant' && l.last_observation_at) {
        const last = new Date(l.last_observation_at)
        const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1)
        if (last > yearAgo) return false
      }
      if (paramFilter && !(l.tested_parameters || []).includes(paramFilter)) return false
      if (searchText) {
        const s = searchText.toLowerCase()
        if (!(l.name || '').toLowerCase().includes(s) && !(l.body_of_water || '').toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [allLocations, countryFilter, bodyFilter, statusFilter, paramFilter, searchText])

  const mappable = filtered.filter(l => l.latitude && l.longitude)

  // CSV export
  const exportCSV = () => {
    const headers = ['Name', 'Latitude', 'Longitude', 'Country', 'Water Body', 'Type', 'Parameters', 'First Obs', 'Last Obs', 'Permalink']
    const rows = filtered.map(l => [
      l.name, l.latitude, l.longitude, l.country, l.body_of_water,
      l.water_body_type, (l.tested_parameters || []).join('; '),
      l.first_observation_at || '', l.last_observation_at || '', l.permalink || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `water-rangers-locations-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 130px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={20} color="#6366f1" /> Monitoring Map
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
            {allLocations.length} real Water Rangers sites loaded
            {loading && ` · Loading page ${loadedPages + 1}...`}
            {!loading && ` · ${mappable.length} shown on map`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowFilters(f => !f)} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            background: showFilters ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${showFilters ? 'rgba(99,102,241,.3)' : 'var(--border)'}`,
            borderRadius: 8, color: showFilters ? '#a78bfa' : 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}><Filter size={12} /> Filters</button>
          <button onClick={exportCSV} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            background: 'rgba(20,184,166,.08)', border: '1px solid rgba(20,184,166,.2)',
            borderRadius: 8, color: '#14b8a6', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}><Download size={12} /> CSV</button>
          <button onClick={loadAll} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)',
            borderRadius: 8, color: '#a78bfa', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Total Sites', value: allLocations.length, color: '#6366f1' },
          { label: 'Countries', value: countries.length, color: '#f59e0b' },
          { label: 'Water Body Types', value: bodyTypes.length, color: '#14b8a6' },
          { label: 'Shown on Map', value: mappable.length, color: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 12, marginBottom: 12,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8,
        }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Search</label>
            <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Site name or water body..."
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(0,0,0,.15)', border: '1px solid var(--border)', color: 'var(--text)', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Country</label>
            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(0,0,0,.15)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              <option value="">All countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Water Body Type</label>
            <select value={bodyFilter} onChange={e => setBodyFilter(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(0,0,0,.15)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              <option value="">All types</option>
              {bodyTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(0,0,0,.15)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              <option value="">All</option>
              <option value="active">Active (obs in past year)</option>
              <option value="dormant">Dormant</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Parameter Tested</label>
            <select value={paramFilter} onChange={e => setParamFilter(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(0,0,0,.15)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              <option value="">All parameters</option>
              {allParams.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={() => { setCountryFilter(''); setBodyFilter(''); setStatusFilter(''); setParamFilter(''); setSearchText('') }}
              style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', cursor: 'pointer' }}>
              Clear All
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: 10, borderRadius: 8, marginBottom: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: 12 }}>
          <AlertTriangle size={13} style={{ marginRight: 6 }} />{error}
        </div>
      )}

      {/* Map */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', height: 480, marginBottom: 12 }}>
        <MapContainer center={[45, -75]} zoom={4} style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true} zoomControl={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds locations={mappable} />
          {mappable.map(loc => {
            const color = BODY_COLORS[loc.water_body_type] || '#6366f1'
            return (
              <Marker key={loc.id} position={[parseFloat(loc.latitude), parseFloat(loc.longitude)]}
                icon={makeIcon(color)}
                eventHandlers={{ click: () => setSelected(loc) }}>
                <Popup maxWidth={320}>
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                    <strong style={{ fontSize: 13 }}>{loc.name}</strong><br />
                    <span style={{ color: '#666' }}>{loc.body_of_water} · {(loc.water_body_type || '').replace(/_/g, ' ')}</span><br />
                    <span style={{ color: '#666' }}>{loc.country}</span><br />
                    {loc.tested_parameters && (
                      <div style={{ marginTop: 4 }}>
                        <strong>Parameters:</strong> {loc.tested_parameters.slice(0, 5).map(p => p.replace(/_/g, ' ')).join(', ')}
                        {loc.tested_parameters.length > 5 && ` +${loc.tested_parameters.length - 5} more`}
                      </div>
                    )}
                    {loc.last_observation_at && <div style={{ marginTop: 2, color: '#888' }}>Last obs: {new Date(loc.last_observation_at).toLocaleDateString()}</div>}
                    {loc.permalink && <a href={loc.permalink} target="_blank" rel="noreferrer" style={{ color: '#6366f1', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4 }}>View on Water Rangers ↗</a>}
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, padding: 10,
        background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10,
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginRight: 4 }}>Legend:</span>
        {Object.entries(BODY_COLORS).map(([type, color]) => (
          <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            {type.replace(/_/g, ' ')}
          </span>
        ))}
      </div>

      {/* Sites list below map */}
      <h3 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
        All Sites ({filtered.length})
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Name', 'Water Body', 'Type', 'Country', 'Parameters', 'Last Observation', 'Link'].map(h => (
                <th key={h} style={{ padding: '8px 6px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 700, fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,.04)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '6px', color: 'var(--text)', fontWeight: 600 }}>{l.name}</td>
                <td style={{ padding: '6px', color: 'var(--text-muted)' }}>{l.body_of_water || '—'}</td>
                <td style={{ padding: '6px' }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                    background: `${BODY_COLORS[l.water_body_type] || '#666'}15`,
                    color: BODY_COLORS[l.water_body_type] || '#666',
                  }}>{(l.water_body_type || '—').replace(/_/g, ' ')}</span>
                </td>
                <td style={{ padding: '6px', color: 'var(--text-muted)' }}>{l.country || '—'}</td>
                <td style={{ padding: '6px', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(l.tested_parameters || []).slice(0, 4).map(p => p.replace(/_/g, ' ')).join(', ')}
                  {(l.tested_parameters || []).length > 4 && ` +${l.tested_parameters.length - 4}`}
                </td>
                <td style={{ padding: '6px', color: 'var(--text-muted)' }}>{l.last_observation_at ? new Date(l.last_observation_at).toLocaleDateString() : '—'}</td>
                <td style={{ padding: '6px' }}>
                  {l.permalink && <a href={l.permalink} target="_blank" rel="noreferrer" style={{ color: '#6366f1', fontSize: 10 }}>↗</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 200 && (
          <div style={{ textAlign: 'center', padding: 10, color: 'var(--text-muted)', fontSize: 11 }}>
            Showing 200 of {filtered.length} — use filters to narrow down
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--card-bg, #1e1e2e)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 20, maxWidth: 520, width: '90%', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 900, margin: 0 }}>{selected.name}</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12, fontSize: 12 }}>
              <div style={{ background: 'rgba(99,102,241,.06)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Water Body</div>
                <div style={{ color: 'var(--text)', fontWeight: 700 }}>{selected.body_of_water || '—'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{(selected.water_body_type || '').replace(/_/g, ' ')}</div>
              </div>
              <div style={{ background: 'rgba(20,184,166,.06)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Location</div>
                <div style={{ color: 'var(--text)', fontWeight: 700 }}>{selected.country || '—'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{selected.latitude}, {selected.longitude}</div>
              </div>
              <div style={{ background: 'rgba(245,158,11,.06)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>First Observation</div>
                <div style={{ color: 'var(--text)', fontWeight: 700 }}>{selected.first_observation_at ? new Date(selected.first_observation_at).toLocaleDateString() : '—'}</div>
              </div>
              <div style={{ background: 'rgba(16,185,129,.06)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Last Observation</div>
                <div style={{ color: 'var(--text)', fontWeight: 700 }}>{selected.last_observation_at ? new Date(selected.last_observation_at).toLocaleDateString() : '—'}</div>
              </div>
            </div>

            {selected.tested_parameters && selected.tested_parameters.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Parameters Tested ({selected.tested_parameters.length})</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selected.tested_parameters.map((p, i) => (
                    <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'rgba(99,102,241,.08)', color: '#a78bfa', border: '1px solid rgba(99,102,241,.15)' }}>
                      {p.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selected.tested_equipment && selected.tested_equipment.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Equipment ({selected.tested_equipment.length})</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selected.tested_equipment.map((e, i) => (
                    <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'rgba(20,184,166,.08)', color: '#14b8a6', border: '1px solid rgba(20,184,166,.15)' }}>
                      {e.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selected.reference_photo_url && (
              <img src={selected.reference_photo_url} alt={selected.name}
                style={{ width: '100%', borderRadius: 8, marginBottom: 12, border: '1px solid var(--border)' }}
                onError={e => e.target.style.display = 'none'} />
            )}

            {selected.permalink && (
              <a href={selected.permalink} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8,
                background: 'rgba(99,102,241,.1)', color: '#a78bfa', fontSize: 12, fontWeight: 600,
                textDecoration: 'none', border: '1px solid rgba(99,102,241,.2)',
              }}><ExternalLink size={12} /> View on Water Rangers</a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
