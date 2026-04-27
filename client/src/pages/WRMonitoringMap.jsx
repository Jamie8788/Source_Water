/**
 * WRMonitoringMap — ALL Water Rangers locations (9,444+) on interactive map
 * - Real Leaflet map with every monitoring site
 * - Color-coded by water body type
 * - Photos from locations
 * - Plain English: "What's monitored here?"
 * - Filters: country, water body type, parameter, active/dormant
 * - CSV export
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapPin, RefreshCw, AlertTriangle, X, Download, Filter,
  ExternalLink, Search, Globe, Droplets, Camera, Activity, ChevronRight, Sparkles,
} from 'lucide-react'
import { getAllLocations, getLocations, getLocationObservations } from '../api/waterRangers'
import { matchParam } from '../utils/waterParams'
import ParameterDeepDive from '../components/ParameterDeepDive'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import { MapToolsLayer, MapToolsToolbar, WaypointModal } from '../components/MapTools'

// Color by water body type
const BODY_COLORS = {
  river_or_stream: '#3b82f6', lake: '#06b6d4', pond: '#14b8a6',
  wetland: '#10b981', ocean: '#1d4ed8', estuary: '#6366f1',
  canal: '#8b5cf6', reservoir: '#0ea5e9', spring: '#22d3ee',
  channelized_stream: '#a78bfa', ditch: '#a3a3a3', other: '#f59e0b',
}

// Plain English for water body types
const BODY_LABELS = {
  river_or_stream: 'River / Stream', lake: 'Lake', pond: 'Pond',
  wetland: 'Wetland', ocean: 'Ocean', estuary: 'Estuary',
  canal: 'Canal', reservoir: 'Reservoir', spring: 'Spring',
  channelized_stream: 'Channelized Stream', ditch: 'Ditch',
  other: 'Other / Unclassified',
}

// Known water body types — anything NOT in here is treated as "other"
// and rendered with the orange fallback color. Keeps the legend honest.
const KNOWN_BODY_TYPES = new Set([
  'river_or_stream','lake','pond','wetland','ocean','estuary',
  'canal','reservoir','spring','channelized_stream','ditch',
])

// Plain English for common parameters
const PARAM_EXPLAIN = {
  ph: '🧪 pH — How acidic or basic the water is (safe: 6.5–8.5)',
  oxygen: '💨 Dissolved Oxygen — How much oxygen fish and wildlife can breathe (need >6 mg/L)',
  dissolved_oxygen: '💨 Dissolved Oxygen — Oxygen available for aquatic life',
  conductivity: '⚡ Conductivity — Mineral/salt content in water',
  turbidity: '👁️ Turbidity — How clear or cloudy the water is',
  water_temperature: '🌡️ Water Temperature — Affects all aquatic life',
  air_temperature: '🌡️ Air Temperature — Weather conditions during sampling',
  chlorine: '🧴 Chlorine — Disinfectant level (in treated water)',
  hardness: '💎 Hardness — Mineral content (calcium & magnesium)',
  alkalinity: '🛡️ Alkalinity — Water\'s ability to resist pH changes',
  phosphates: '🌿 Phosphates — Nutrient that can cause algae blooms',
  phosphorus: '🌿 Phosphorus — Nutrient pollution indicator',
  nitrate: '🌱 Nitrate — Fertilizer/sewage indicator',
  secchi_depth: '📏 Secchi Depth — How deep you can see (water clarity)',
  chlorophyll_a: '🟢 Chlorophyll — Algae levels in the water',
  water_level: '📊 Water Level — Current water height',
  water_depth: '📏 Water Depth — How deep the water is',
  clarity: '👁️ Clarity — Visual assessment of water clearness',
  colour: '🎨 Water Colour — Visual assessment',
  algae: '🟢 Algae — Presence of algae growth',
  flow: '🌊 Flow Rate — How fast the water is moving',
}

function getParamExplain(param) {
  const key = param?.toLowerCase().replace(/\s+/g, '_')
  return PARAM_EXPLAIN[key] || `📋 ${param?.replace(/_/g, ' ')}`
}

function FitBounds({ locations }) {
  const map = useMap()
  useEffect(() => {
    if (locations.length === 0) return
    const bounds = locations.filter(l => l.latitude && l.longitude)
      .map(l => [parseFloat(l.latitude), parseFloat(l.longitude)])
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 })
  }, [locations.length > 0]) // only fit on first load
  return null
}

export default function WRMonitoringMap() {
  const { user } = useAuth()
  const isAuthed = !!user

  const [allLocations, setAllLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  // ── Map tools (additive overlay — never touches WR data) ──
  const [toolMode, setToolMode] = useState('off')           // 'off' | 'measure' | 'waypoint'
  const [measurePoints, setMeasurePoints] = useState([])
  const [measureClosed, setMeasureClosed] = useState(false)
  const [waypoints, setWaypoints] = useState([])
  const [waypointsVisible, setWaypointsVisible] = useState(true)
  const [wpModal, setWpModal] = useState({ open: false, mode: 'create', latlng: null, initial: null })
  const [wpBusy, setWpBusy] = useState(false)
  const [wpError, setWpError] = useState(null)

  // Load this user's personal waypoints (scoped server-side by user_id)
  useEffect(() => {
    if (!isAuthed) { setWaypoints([]); return }
    let cancelled = false
    api.get('/waypoints')
      .then(r => { if (!cancelled) setWaypoints(r.data?.waypoints || []) })
      .catch(() => { /* silent — toolbar still works for measure */ })
    return () => { cancelled = true }
  }, [isAuthed])

  const clearMeasure = () => { setMeasurePoints([]); setMeasureClosed(false) }

  const openCreateWaypoint = (latlng) => {
    if (!isAuthed) return
    setWpError(null)
    setWpModal({ open: true, mode: 'create', latlng, initial: null })
  }
  const openEditWaypoint = (w) => {
    setWpError(null)
    setWpModal({ open: true, mode: 'edit', latlng: { lat: w.latitude, lng: w.longitude }, initial: w })
  }
  const closeWaypointModal = () => { if (!wpBusy) setWpModal({ open: false, mode: 'create', latlng: null, initial: null }) }

  const saveWaypoint = async (form) => {
    setWpBusy(true); setWpError(null)
    try {
      if (wpModal.mode === 'edit' && wpModal.initial) {
        const r = await api.put(`/waypoints/${wpModal.initial.id}`, form)
        const updated = r.data?.waypoint
        setWaypoints(list => list.map(w => w.id === updated.id ? updated : w))
      } else {
        const payload = { ...form, latitude: wpModal.latlng.lat, longitude: wpModal.latlng.lng }
        const r = await api.post('/waypoints', payload)
        const created = r.data?.waypoint
        setWaypoints(list => [created, ...list])
        setToolMode('off')
      }
      setWpModal({ open: false, mode: 'create', latlng: null, initial: null })
    } catch (e) {
      setWpError(e?.response?.data?.error || e?.message || 'Could not save waypoint')
    } finally {
      setWpBusy(false)
    }
  }

  const deleteWaypoint = async (id) => {
    if (!confirm('Delete this waypoint? This cannot be undone.')) return
    try {
      await api.delete(`/waypoints/${id}`)
      setWaypoints(list => list.filter(w => w.id !== id))
    } catch (e) {
      alert(e?.response?.data?.error || e?.message || 'Could not delete waypoint')
    }
  }

  // Site observations + deep-dive panel state — fetched on demand when a site is selected
  const [siteObs, setSiteObs] = useState([])
  const [siteObsLoading, setSiteObsLoading] = useState(false)
  const [siteObsError, setSiteObsError] = useState(null)
  const [deepDiveParam, setDeepDiveParam] = useState(null)

  // Filters — initial searchText comes from ?q= so the global TopBar search
  // can deep-link straight into the map with the user's query already applied.
  const [searchParams, setSearchParams] = useSearchParams()
  const [countryFilter, setCountryFilter] = useState('')
  const [bodyFilter, setBodyFilter] = useState('')
  const [paramFilter, setParamFilter] = useState('')
  const [searchText, setSearchText] = useState(() => searchParams.get('q') || '')
  const [activeOnly, setActiveOnly] = useState(false)

  // Keep state and URL in sync — clearing the search drops ?q= from the URL too.
  useEffect(() => {
    const current = searchParams.get('q') || ''
    if (current === searchText) return
    const next = new URLSearchParams(searchParams)
    if (searchText) next.set('q', searchText); else next.delete('q')
    setSearchParams(next, { replace: true })
  }, [searchText])

  const [loadMsg, setLoadMsg] = useState('')

  // Load ALL locations via bulk endpoint (server fetches in parallel, cached 1hr)
  const loadAll = useCallback(async () => {
    setLoading(true); setError(null)
    setLoadMsg('Connecting to Water Rangers...')
    try {
      const locations = await getAllLocations()
      setAllLocations(locations)
      setLoadMsg('')
    } catch (e) {
      setError(e.message)
      setLoadMsg('')
    }
    finally { setLoading(false) }
  }, [])

  // Fetch this site's observations whenever a new one is selected.
  // We need real readings for the deep-dive panels (chart, anomalies, AI).
  useEffect(() => {
    if (!selected) { setSiteObs([]); setSiteObsError(null); return }
    let cancelled = false
    setSiteObsLoading(true); setSiteObsError(null); setSiteObs([])
    getLocationObservations(selected.id, { perPage: 200 })
      .then(data => {
        if (cancelled) return
        const items = Array.isArray(data?.observations) ? data.observations
          : Array.isArray(data) ? data
          : Array.isArray(data?.data) ? data.data : []
        setSiteObs(items)
      })
      .catch(e => { if (!cancelled) setSiteObsError(e?.message || 'Could not load observations.') })
      .finally(() => { if (!cancelled) setSiteObsLoading(false) })
    return () => { cancelled = true }
  }, [selected])

  useEffect(() => {
    loadAll()
    // Update loading message while waiting
    const msgs = [
      'Fetching monitoring sites from Water Rangers...',
      'Loading locations across Canada, US, UK...',
      'Almost there — caching for instant future loads...',
      'First load takes ~15 seconds, then it\'s instant...',
    ]
    let i = 0
    const iv = setInterval(() => { i = (i + 1) % msgs.length; setLoadMsg(msgs[i]) }, 4000)
    return () => clearInterval(iv)
  }, [loadAll])

  // Unique values for filters
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
      if (bodyFilter) {
        if (bodyFilter === 'other') {
          if (KNOWN_BODY_TYPES.has(l.water_body_type)) return false
        } else if (l.water_body_type !== bodyFilter) return false
      }
      if (paramFilter && !(l.tested_parameters || []).includes(paramFilter)) return false
      if (activeOnly) {
        if (!l.last_observation_at) return false
        const last = new Date(l.last_observation_at)
        const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1)
        if (last < yearAgo) return false
      }
      if (searchText) {
        const s = searchText.toLowerCase()
        if (!(l.name || '').toLowerCase().includes(s) && !(l.body_of_water || '').toLowerCase().includes(s) && !(l.country || '').toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [allLocations, countryFilter, bodyFilter, paramFilter, searchText, activeOnly])

  const mappable = filtered.filter(l => l.latitude && l.longitude)
  const withPhotos = allLocations.filter(l => l.reference_photo_url).length

  // Country stats
  const countryStats = useMemo(() => {
    const c = {}
    allLocations.forEach(l => { c[l.country || 'Unknown'] = (c[l.country || 'Unknown'] || 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [allLocations])

  // CSV export
  const exportCSV = () => {
    const headers = ['Name', 'Latitude', 'Longitude', 'Country', 'Water Body', 'Type', 'Parameters', 'Equipment', 'First Obs', 'Last Obs', 'Has Photo', 'Investigative', 'Permalink']
    const rows = filtered.map(l => [
      l.name, l.latitude, l.longitude, l.country, l.body_of_water,
      l.water_body_type, (l.tested_parameters || []).join('; '),
      (l.tested_equipment || []).join('; '),
      l.first_observation_at || '', l.last_observation_at || '',
      l.reference_photo_url ? 'Yes' : 'No', l.investigative || false, l.permalink || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `water-rangers-all-locations-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 130px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={20} color="#6366f1" /> Monitoring Map
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
            {loading ? 'Loading all Water Rangers sites...' : `${allLocations.length.toLocaleString()} real monitoring sites · ${mappable.length.toLocaleString()} shown`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setShowFilters(f => !f)} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
            background: showFilters ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.04)',
            border: `1px solid ${showFilters ? 'rgba(99,102,241,.3)' : 'var(--border)'}`,
            borderRadius: 8, color: showFilters ? '#a78bfa' : 'var(--text-muted)', fontSize: 10, fontWeight: 600, cursor: 'pointer',
          }}><Filter size={11} /> Filters</button>
          <button onClick={exportCSV} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
            background: 'rgba(20,184,166,.06)', border: '1px solid rgba(20,184,166,.15)',
            borderRadius: 8, color: '#14b8a6', fontSize: 10, fontWeight: 600, cursor: 'pointer',
          }}><Download size={11} /> CSV</button>
          <button onClick={loadAll} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
            background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)',
            borderRadius: 8, color: '#a78bfa', fontSize: 10, fontWeight: 600, cursor: 'pointer',
          }}><RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Reload</button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Sites', value: allLocations.length.toLocaleString(), color: '#6366f1', icon: '📍' },
          { label: 'Countries', value: countries.length, color: '#f59e0b', icon: '🌍' },
          { label: 'With Photos', value: withPhotos.toLocaleString(), color: '#ec4899', icon: '📸' },
          { label: 'Parameters Tracked', value: allParams.length, color: '#14b8a6', icon: '🧪' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 14 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
        {countryStats.slice(0, 4).map(([country, count]) => (
          <div key={country} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 12px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{count.toLocaleString()}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{country}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 10, marginBottom: 10,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 6,
        }}>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Search</label>
            <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Name, water body, country..."
              style={{ width: '100%', padding: '5px 7px', borderRadius: 6, fontSize: 11, background: 'rgba(0,0,0,.12)', border: '1px solid var(--border)', color: 'var(--text)', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Country</label>
            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
              style={{ width: '100%', padding: '5px 7px', borderRadius: 6, fontSize: 11, background: 'rgba(0,0,0,.12)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              <option value="">All ({allLocations.length})</option>
              {countries.map(c => <option key={c} value={c}>{c} ({allLocations.filter(l => l.country === c).length})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Water Body Type</label>
            <select value={bodyFilter} onChange={e => setBodyFilter(e.target.value)}
              style={{ width: '100%', padding: '5px 7px', borderRadius: 6, fontSize: 11, background: 'rgba(0,0,0,.12)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              <option value="">All types</option>
              {bodyTypes.map(t => <option key={t} value={t}>{BODY_LABELS[t] || t} ({allLocations.filter(l => l.water_body_type === t).length})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Parameter</label>
            <select value={paramFilter} onChange={e => setParamFilter(e.target.value)}
              style={{ width: '100%', padding: '5px 7px', borderRadius: 6, fontSize: 11, background: 'rgba(0,0,0,.12)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              <option value="">All parameters</option>
              {allParams.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} /> Active only
            </label>
            <button onClick={() => { setCountryFilter(''); setBodyFilter(''); setParamFilter(''); setSearchText(''); setActiveOnly(false) }}
              style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', color: '#f87171', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: 8, borderRadius: 8, marginBottom: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', color: '#fca5a5', fontSize: 11 }}>
          <AlertTriangle size={12} style={{ marginRight: 4 }} />{error}
        </div>
      )}

      {/* Active filter summary */}
      {(countryFilter || bodyFilter || paramFilter || searchText || activeOnly) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, padding: '6px 10px', background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)', borderRadius: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700 }}>🔍 Showing {mappable.length.toLocaleString()} of {allLocations.length.toLocaleString()}:</span>
          {countryFilter && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,.1)', color: '#f59e0b' }}>🌍 {countryFilter}</span>}
          {bodyFilter && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(20,184,166,.1)', color: '#14b8a6' }}>{BODY_LABELS[bodyFilter] || bodyFilter}</span>}
          {paramFilter && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,.1)', color: '#a78bfa' }}>🧪 {paramFilter.replace(/_/g, ' ')}</span>}
          {searchText && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,.06)', color: 'var(--text-muted)' }}>"{searchText}"</span>}
          {activeOnly && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(16,185,129,.1)', color: '#10b981' }}>Active only</span>}
        </div>
      )}

      {/* Map — key changes on filter to force clean re-render */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', height: 500, marginBottom: 10, position: 'relative' }}
        key={`map-${countryFilter}-${bodyFilter}-${paramFilter}-${activeOnly}-${searchText}-${mappable.length}`}>
        {loading && (
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(0,0,0,.8)', color: 'white', padding: '8px 16px', borderRadius: 10, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, maxWidth: 340, textAlign: 'center' }}>
            <RefreshCw size={12} className="animate-spin" /> {loadMsg || `Loading ${allLocations.length.toLocaleString()} sites...`}
          </div>
        )}
        <MapContainer center={[45, -40]} zoom={3} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true} preferCanvas={true}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <FitBounds locations={mappable} />
          <MapToolsLayer
            mode={toolMode}
            measurePoints={measurePoints} setMeasurePoints={setMeasurePoints}
            measureClosed={measureClosed} setMeasureClosed={setMeasureClosed}
            onWaypointMapClick={openCreateWaypoint}
            waypoints={waypoints}
            waypointsVisible={waypointsVisible}
            onWaypointEdit={openEditWaypoint}
            onWaypointDelete={deleteWaypoint}
          />
          {mappable.map(loc => {
            const color = BODY_COLORS[loc.water_body_type] || BODY_COLORS.other
            return (
              <CircleMarker key={loc.id} center={[parseFloat(loc.latitude), parseFloat(loc.longitude)]}
                radius={5} fillColor={color} color={color} weight={1} opacity={0.8} fillOpacity={0.6}
                eventHandlers={{ click: () => setSelected(loc) }}>
                <Popup maxWidth={340}>
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                    <strong style={{ fontSize: 13 }}>{loc.name}</strong><br />
                    <span style={{ color: '#666' }}>{BODY_LABELS[loc.water_body_type] || loc.water_body_type} · {loc.country}</span><br />
                    {loc.body_of_water && <span style={{ color: '#888' }}>{loc.body_of_water}</span>}
                    {loc.reference_photo_url && (
                      <img src={loc.reference_photo_url} alt={loc.name} style={{ width: '100%', borderRadius: 6, marginTop: 6, maxHeight: 120, objectFit: 'cover' }}
                        onError={e => e.target.style.display = 'none'} />
                    )}
                    {loc.tested_parameters && (
                      <div style={{ marginTop: 4, fontSize: 11 }}>
                        <strong>What's monitored here:</strong><br />
                        {loc.tested_parameters.slice(0, 5).map(p => getParamExplain(p)).join('\n')}
                        {loc.tested_parameters.length > 5 && `\n+${loc.tested_parameters.length - 5} more`}
                      </div>
                    )}
                    {loc.permalink && <a href={loc.permalink} target="_blank" rel="noreferrer" style={{ color: '#6366f1', fontSize: 11, display: 'block', marginTop: 4 }}>View on Water Rangers ↗</a>}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
        <MapToolsToolbar
          mode={toolMode} setMode={setToolMode}
          measurePoints={measurePoints} measureClosed={measureClosed} clearMeasure={clearMeasure}
          waypoints={waypoints}
          waypointsVisible={waypointsVisible} setWaypointsVisible={setWaypointsVisible}
          isAuthed={isAuthed}
        />
      </div>

      <WaypointModal
        open={wpModal.open}
        mode={wpModal.mode}
        latlng={wpModal.latlng}
        initial={wpModal.initial}
        onClose={closeWaypointModal}
        onSave={saveWaypoint}
        busy={wpBusy}
        error={wpError}
      />

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, padding: '6px 10px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
        {Object.entries(BODY_COLORS).filter(([type]) => {
          // Show a legend chip if any site matches this exact type, OR for
          // the "other" swatch if any site has an unknown type that falls
          // through to BODY_COLORS.other on the map.
          if (type === 'other') return allLocations.some(l => !KNOWN_BODY_TYPES.has(l.water_body_type))
          return allLocations.some(l => l.water_body_type === type)
        }).map(([type, color]) => (
          <button key={type} onClick={() => setBodyFilter(bodyFilter === type ? '' : type)} style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 6px', borderRadius: 4,
            color: bodyFilter === type ? 'white' : 'var(--text-muted)', cursor: 'pointer',
            background: bodyFilter === type ? color : 'transparent', border: 'none',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            {BODY_LABELS[type] || type}
          </button>
        ))}
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
            borderRadius: 14, padding: 20, maxWidth: 520, width: '92%', maxHeight: '85vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 900, margin: 0 }}>{selected.name}</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            {selected.reference_photo_url && (
              <img src={selected.reference_photo_url} alt={selected.name}
                style={{ width: '100%', borderRadius: 10, marginBottom: 12, maxHeight: 200, objectFit: 'cover', border: '1px solid var(--border)' }}
                onError={e => e.target.style.display = 'none'} />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12, fontSize: 12 }}>
              <div style={{ background: 'rgba(99,102,241,.06)', borderRadius: 8, padding: 8 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Water Body</div>
                <div style={{ color: 'var(--text)', fontWeight: 700 }}>{selected.body_of_water || '—'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{BODY_LABELS[selected.water_body_type] || selected.water_body_type}</div>
              </div>
              <div style={{ background: 'rgba(20,184,166,.06)', borderRadius: 8, padding: 8 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Location</div>
                <div style={{ color: 'var(--text)', fontWeight: 700 }}>{selected.country || '—'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{Number(selected.latitude).toFixed(4)}, {Number(selected.longitude).toFixed(4)}</div>
              </div>
              <div style={{ background: 'rgba(245,158,11,.06)', borderRadius: 8, padding: 8 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Monitoring Since</div>
                <div style={{ color: 'var(--text)', fontWeight: 700 }}>{selected.first_observation_at ? new Date(selected.first_observation_at).toLocaleDateString() : 'No data yet'}</div>
              </div>
              <div style={{ background: 'rgba(16,185,129,.06)', borderRadius: 8, padding: 8 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Last Checked</div>
                <div style={{ color: 'var(--text)', fontWeight: 700 }}>{selected.last_observation_at ? new Date(selected.last_observation_at).toLocaleDateString() : 'Never'}</div>
              </div>
            </div>

            {selected.investigative && (
              <div style={{ padding: '6px 10px', borderRadius: 8, marginBottom: 10, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', color: '#fbbf24', fontSize: 11 }}>
                🔍 <strong>Investigative Site</strong> — This location is being monitored to investigate a specific concern
              </div>
            )}

            {/* What's monitored — every parameter is now a clickable deep-dive trigger.
                Click → opens ParameterDeepDive with this site's actual observations,
                CCME band analysis, anomaly detection, and a real AI summary. */}
            {selected.tested_parameters && selected.tested_parameters.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🧪 What's Monitored Here ({selected.tested_parameters.length} parameters)</span>
                  {siteObsLoading && <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)' }}>loading readings…</span>}
                  {!siteObsLoading && siteObs.length > 0 && <span style={{ fontSize: 9, fontWeight: 500, color: '#10b981' }}>{siteObs.length} readings loaded</span>}
                </h4>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={10} color="#a78bfa" /> Click any parameter for full chart, CCME bands, anomalies, and AI analysis of this site
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selected.tested_parameters.map((p, i) => {
                    const mapped = matchParam(p)
                    const key = mapped || (p?.toLowerCase().replace(/\s+/g, '_'))
                    return (
                      <button
                        key={i}
                        onClick={() => setDeepDiveParam(key)}
                        disabled={siteObsLoading}
                        title={mapped ? 'Open full CCME deep-dive' : 'Open AI-powered analysis (no CCME band defined yet)'}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          width: '100%', textAlign: 'left',
                          fontSize: 11, color: 'var(--text-muted)', padding: '6px 8px',
                          borderRadius: 6, border: '1px solid var(--border)',
                          background: 'rgba(99,102,241,0.04)',
                          cursor: siteObsLoading ? 'wait' : 'pointer',
                        }}
                        onMouseEnter={e => { if (!siteObsLoading) e.currentTarget.style.background = 'rgba(99,102,241,0.12)' }}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
                      >
                        <span>{getParamExplain(p)}</span>
                        <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                      </button>
                    )
                  })}
                </div>
                {siteObsError && (
                  <div style={{ marginTop: 6, fontSize: 10, color: '#fca5a5' }}>
                    Could not load readings: {siteObsError}. Deep-dive will still show CCME bands and AI context.
                  </div>
                )}
              </div>
            )}

            {/* Equipment */}
            {selected.tested_equipment && selected.tested_equipment.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>🔬 Equipment Used</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {selected.tested_equipment.map((e, i) => (
                    <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(20,184,166,.06)', color: '#14b8a6', border: '1px solid rgba(20,184,166,.12)' }}>
                      {e.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selected.permalink && (
              <a href={selected.permalink} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 8,
                background: 'rgba(99,102,241,.08)', color: '#a78bfa', fontSize: 11, fontWeight: 600,
                textDecoration: 'none', border: '1px solid rgba(99,102,241,.15)',
              }}><ExternalLink size={11} /> View on Water Rangers</a>
            )}
          </div>
        </div>
      )}

      {/* Parameter deep-dive — slides in over the site modal when a chip is clicked */}
      {deepDiveParam && selected && (
        <ParameterDeepDive
          paramKey={deepDiveParam}
          observations={siteObs}
          siteName={selected.name}
          siteId={selected.id}
          onClose={() => setDeepDiveParam(null)}
        />
      )}
    </div>
  )
}
