import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import api from '../utils/api'
import { useSound } from '../context/SoundContext'
import { Plus, X, Send, Search, Layers, Navigation, Satellite, Map as MapIcon, Maximize2 } from 'lucide-react'

const MAP_STYLES = {
  street:    { label: 'Street',    icon: '🗺️',  url: 'https://demotiles.maplibre.org/style.json' },
  satellite: { label: 'Satellite', icon: '🛰️',  url: 'https://api.maptiler.com/maps/hybrid/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL' },
  topo:      { label: 'Terrain',   icon: '⛰️',  url: 'https://api.maptiler.com/maps/topo/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL' },
}

// Free OpenFreeMap style — no key needed
const FREE_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

const STATUS_COLORS = {
  active:   '#22c55e',
  warning:  '#f59e0b',
  critical: '#ef4444',
  inactive: '#94a3b8',
}

export default function MapPage() {
  const { play } = useSound()
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markersRef = useRef([])
  const [sites, setSites] = useState([])
  const [selected, setSelected] = useState(null)
  const [observations, setObservations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [clickedPos, setClickedPos] = useState(null)
  const [is3D, setIs3D] = useState(false)
  const [mapStyle, setMapStyle] = useState('street')
  const [searchVal, setSearchVal] = useState('')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [form, setForm] = useState({
    site_id: '', notes: '', weather_conditions: '', sampler_name: '',
    ph: '', turbidity: '', dissolved_oxygen: '', temperature: '',
    conductivity: '', nitrates: '', phosphorus: '',
  })

  // Init map
  useEffect(() => {
    if (map.current) return
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: FREE_STYLE,
      center: [-84.3, 46.5],
      zoom: 6.5,
      pitch: 0,
      bearing: 0,
      antialias: true,
    })

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')
    map.current.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }), 'top-right')
    map.current.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
    map.current.addControl(new maplibregl.FullscreenControl(), 'top-right')

    map.current.on('load', () => {
      setMapLoaded(true)
      // 3D terrain (free Maptiler terrain)
      map.current.addSource('terrain', {
        type: 'raster-dem',
        url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
        tileSize: 256,
      })
    })

    // Click handler for new observations
    map.current.on('click', (e) => {
      // Only trigger if not clicking a marker
      const features = map.current.queryRenderedFeatures(e.point, { layers: ['site-circles'] })
      if (features.length === 0) {
        setClickedPos({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        setForm(f => ({ ...f, site_id: '' }))
        setShowForm(true)
      }
    })

    return () => {
      if (map.current) { map.current.remove(); map.current = null }
    }
  }, [])

  // Load sites
  useEffect(() => {
    api.get('/sites').then(r => setSites(r.data.sites || [])).catch(() => {})
  }, [])

  // Add site markers when map loaded + sites ready
  useEffect(() => {
    if (!mapLoaded || !sites.length) return

    // Clear old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    // Add GeoJSON source for site circles
    if (map.current.getSource('sites')) {
      map.current.getSource('sites').setData({
        type: 'FeatureCollection',
        features: sites.map(s => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
          properties: { id: s.id, name: s.name, status: s.status || 'active', location: s.location_name },
        }))
      })
    } else {
      map.current.addSource('sites', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: sites.map(s => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
            properties: { id: s.id, name: s.name, status: s.status || 'active', location: s.location_name },
          }))
        }
      })

      // Glow layer
      map.current.addLayer({
        id: 'site-glow',
        type: 'circle',
        source: 'sites',
        paint: {
          'circle-radius': 18,
          'circle-color': ['match', ['get', 'status'], 'active', '#22c55e', 'warning', '#f59e0b', 'critical', '#ef4444', '#94a3b8'],
          'circle-opacity': 0.15,
          'circle-blur': 1,
        }
      })

      // Main circle
      map.current.addLayer({
        id: 'site-circles',
        type: 'circle',
        source: 'sites',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 6, 10, 12, 14, 16],
          'circle-color': ['match', ['get', 'status'], 'active', '#22c55e', 'warning', '#f59e0b', 'critical', '#ef4444', '#94a3b8'],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': 'white',
          'circle-opacity': 0.9,
        }
      })

      // Labels
      map.current.addLayer({
        id: 'site-labels',
        type: 'symbol',
        source: 'sites',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-offset': [0, 1.6],
          'text-anchor': 'top',
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': 'white',
          'text-halo-width': 2,
        }
      })

      // Click on site
      map.current.on('click', 'site-circles', (e) => {
        const props = e.features[0].properties
        const site = sites.find(s => s.id == props.id)
        if (site) {
          setSelected(site)
          api.get(`/sites/${site.id}/observations`).then(r => setObservations(r.data.observations || [])).catch(() => {})
          map.current.flyTo({ center: [site.longitude, site.latitude], zoom: 12, speed: 1.2, pitch: is3D ? 45 : 0 })
        }
      })

      map.current.on('mouseenter', 'site-circles', () => { map.current.getCanvas().style.cursor = 'pointer' })
      map.current.on('mouseleave', 'site-circles', () => { map.current.getCanvas().style.cursor = '' })
    }
  }, [mapLoaded, sites])

  // Toggle 3D
  const toggle3D = () => {
    if (!map.current) return
    const next = !is3D
    setIs3D(next)
    map.current.easeTo({ pitch: next ? 55 : 0, bearing: next ? -15 : 0, duration: 800 })
    if (next) {
      try {
        map.current.setTerrain({ source: 'terrain', exaggeration: 1.5 })
      } catch {}
    } else {
      try { map.current.setTerrain(null) } catch {}
    }
  }

  // Search location via Nominatim (free, no key)
  const searchLocation = async () => {
    if (!searchVal.trim()) return
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchVal + ', Ontario, Canada')}&format=json&limit=1`)
      const data = await r.json()
      if (data[0]) {
        map.current.flyTo({ center: [parseFloat(data[0].lon), parseFloat(data[0].lat)], zoom: 12, speed: 1.5 })
      }
    } catch {}
  }

  const submit = async e => {
    e.preventDefault()
    if (!form.site_id && !clickedPos) return alert('Please select a monitoring site.')
    setSubmitting(true)
    try {
      const payload = { ...form }
      if (clickedPos && !form.site_id) {
        const nearest = sites.reduce((best, s) => {
          const d = Math.sqrt((s.latitude - clickedPos.lat) ** 2 + (s.longitude - clickedPos.lng) ** 2)
          return (!best || d < best.d) ? { s, d } : best
        }, null)
        if (nearest) payload.site_id = nearest.s.id
        else return alert('No monitoring sites found.')
      }
      await api.post('/sites/observations', payload)
      play('success')
      setShowForm(false)
      setClickedPos(null)
      if (selected) api.get(`/sites/${selected.id}/observations`).then(r => setObservations(r.data.observations || [])).catch(() => {})
      setForm({ site_id: '', notes: '', weather_conditions: '', sampler_name: '', ph: '', turbidity: '', dissolved_oxygen: '', temperature: '', conductivity: '', nitrates: '', phosphorus: '' })
      alert('✅ Observation submitted! +15 points earned!')
    } catch (err) {
      alert(err.response?.data?.error || 'Submission failed')
    }
    setSubmitting(false)
  }

  return (
    <div className="flex flex-col gap-0" style={{ height: 'calc(100vh - 100px)', position: 'relative' }}>
      {/* Map toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="page-header flex-1 mb-0 py-3 px-5">
          <div className="text-3xl">🗺️</div>
          <div>
            <h1 className="text-white text-lg font-bold">Interactive Map</h1>
            <p className="text-blue-100 text-xs">{sites.length} monitoring sites · Click anywhere to log an observation</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="ml-auto flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition-all text-sm font-bold">
            <Plus className="w-4 h-4"/> Log Observation
          </button>
        </div>
      </div>

      {/* Map container */}
      <div className="flex gap-3 flex-1 min-h-0">
        <div className="flex-1 rounded-2xl overflow-hidden relative shadow-xl border border-gray-200">
          <div ref={mapContainer} className="w-full h-full"/>

          {/* Search overlay */}
          <div className="absolute top-3 left-3 z-10 flex gap-2">
            <div className="flex bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
              <input
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchLocation()}
                placeholder="Search location..."
                className="px-3 py-2 text-sm w-52 border-none outline-none"
                style={{ border: 'none !important', boxShadow: 'none !important' }}
              />
              <button onClick={searchLocation} className="px-3 bg-indigo-500 text-white hover:bg-indigo-600 transition-colors">
                <Search className="w-4 h-4"/>
              </button>
            </div>
          </div>

          {/* Map style + 3D controls */}
          <div className="absolute bottom-12 left-3 z-10 flex flex-col gap-2">
            <button onClick={toggle3D}
              className="flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg text-xs font-bold transition-all"
              style={{
                background: is3D ? '#6366f1' : 'white',
                color: is3D ? 'white' : '#374151',
                border: '1px solid #e2e8f0',
              }}>
              <Layers className="w-3.5 h-3.5"/>
              {is3D ? '3D ON' : '2D'}
            </button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 right-3 z-10 bg-white rounded-xl shadow-lg border border-gray-200 px-3 py-2">
            <div className="text-xs font-bold text-gray-500 mb-1.5">Site Status</div>
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-2 text-xs text-gray-600 capitalize mb-0.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }}/>
                {status}
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        {selected && (
          <div className="w-72 card overflow-y-auto flex-shrink-0 fade-in-up">
            <div className="p-4 border-b border-gray-100 flex items-start justify-between"
              style={{ background: 'linear-gradient(135deg, #f0f9ff, #ecfdf5)' }}>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">{selected.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selected.location_name}</p>
                <span className={`badge mt-1.5 ${selected.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  ● {selected.status || 'active'}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4"/>
              </button>
            </div>
            {selected.description && (
              <p className="px-4 py-3 text-xs text-gray-600 border-b border-gray-100">{selected.description}</p>
            )}
            <div className="p-4">
              <h4 className="font-bold text-gray-700 mb-3 text-xs uppercase tracking-wide">Recent Observations</h4>
              {observations.length === 0
                ? <p className="text-sm text-gray-400 text-center py-4">No observations yet. Be the first! 🌊</p>
                : observations.slice(0, 5).map(obs => (
                  <div key={obs.id} className="rounded-xl p-3 mb-2 text-xs border border-gray-100 bg-gray-50">
                    <div className="flex justify-between mb-1.5">
                      <span className="font-bold text-gray-700">{obs.sampler_name || obs.username || 'Anonymous'}</span>
                      <span className="text-gray-400">{new Date(obs.collected_at).toLocaleDateString()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {obs.ph && <span>🧪 pH: <strong>{obs.ph}</strong></span>}
                      {obs.temperature && <span>🌡️ {obs.temperature}°C</span>}
                      {obs.dissolved_oxygen && <span>💨 DO: {obs.dissolved_oxygen}</span>}
                      {obs.turbidity && <span>🌊 Turb: {obs.turbidity}</span>}
                    </div>
                  </div>
                ))
              }
              <button onClick={() => { setForm(f => ({ ...f, site_id: selected.id })); setShowForm(true) }}
                className="btn-primary w-full mt-2 py-2 text-xs">
                <Plus className="w-3.5 h-3.5"/> Add Observation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Observation form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4"
              style={{ background: 'linear-gradient(135deg, #6366f1, #14b8a6)' }}>
              <h2 className="text-white font-bold flex items-center gap-2">💧 Submit Water Observation</h2>
              <button onClick={() => { setShowForm(false); setClickedPos(null) }} className="text-white/80 hover:text-white">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {clickedPos && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700 flex items-center gap-2">
                  📍 Logging at ({clickedPos.lat.toFixed(4)}, {clickedPos.lng.toFixed(4)}) — will auto-assign to nearest site.
                </div>
              )}
              <div>
                <label>Monitoring Site</label>
                <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} required={!clickedPos}>
                  <option value="">Select a site{clickedPos ? ' (or use clicked location)' : ''}...</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name} — {s.location_name}</option>)}
                </select>
              </div>
              <div>
                <label>Your Name (optional)</label>
                <input placeholder="e.g. Jane Smith" value={form.sampler_name} onChange={e => setForm(f => ({ ...f, sampler_name: e.target.value }))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: 'ph', label: '🧪 pH (0–14)', ph: '7.2' },
                  { k: 'temperature', label: '🌡️ Temperature (°C)', ph: '15' },
                  { k: 'dissolved_oxygen', label: '💨 Dissolved O₂ (mg/L)', ph: '8.5' },
                  { k: 'turbidity', label: '🌊 Turbidity (NTU)', ph: '2.1' },
                  { k: 'conductivity', label: '⚡ Conductivity (µS/cm)', ph: '450' },
                  { k: 'nitrates', label: '🌿 Nitrates (mg/L)', ph: '3.2' },
                ].map(({ k, label, ph }) => (
                  <div key={k}>
                    <label>{label}</label>
                    <input type="number" step="0.01" placeholder={ph} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}/>
                  </div>
                ))}
              </div>
              <div>
                <label>Weather Conditions</label>
                <input placeholder="e.g. Clear, 18°C, light wind" value={form.weather_conditions} onChange={e => setForm(f => ({ ...f, weather_conditions: e.target.value }))}/>
              </div>
              <div>
                <label>Field Notes</label>
                <textarea rows={3} placeholder="Unusual colours, odours, wildlife observations..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="resize-none"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setClickedPos(null) }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">
                  {submitting ? 'Submitting...' : <><Send className="w-4 h-4"/> Submit (+15 pts)</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
