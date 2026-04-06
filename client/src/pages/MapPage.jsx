import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import api from '../utils/api'
import { useSound } from '../context/SoundContext'
import { useAuth } from '../context/AuthContext'
import {
  Plus, X, Send, Search, Layers, Navigation, Map as MapIcon,
  Maximize2, Thermometer, Droplets, Wind, Eye, AlertTriangle,
  CheckCircle, Activity, Filter, ChevronDown, ChevronUp,
  Crosshair, Ruler, Route, ZoomIn, ZoomOut, RefreshCw,
  Cloud, Sun, Info, BarChart2, TrendingUp, MapPin, Flame,
  Shield, FlaskConical, Users, Award,
} from 'lucide-react'

// Free MapLibre styles — no API key needed
const MAP_STYLES = {
  liberty:  { label: 'Street',   icon: '🗺️',  url: 'https://tiles.openfreemap.org/styles/liberty' },
  bright:   { label: 'Bright',   icon: '☀️',  url: 'https://tiles.openfreemap.org/styles/bright' },
  positron: { label: 'Clean',    icon: '🌐',  url: 'https://tiles.openfreemap.org/styles/positron' },
  dark:     { label: 'Dark',     icon: '🌑',  url: 'https://tiles.openfreemap.org/styles/dark-matter' },
}

const STATUS_COLORS = { active: '#22c55e', warning: '#f59e0b', critical: '#ef4444', inactive: '#94a3b8' }

const WHO = {
  ph:               { min: 6.5,  max: 8.5,   unit: '',       label: 'pH',           emoji: '🧪' },
  turbidity:        { min: 0,    max: 5,     unit: ' NTU',   label: 'Turbidity',    emoji: '🌊' },
  dissolved_oxygen: { min: 6,    max: 999,   unit: ' mg/L',  label: 'DO',           emoji: '💨' },
  temperature:      { min: 0,    max: 25,    unit: ' °C',    label: 'Temp',         emoji: '🌡️' },
  nitrates:         { min: 0,    max: 10,    unit: ' mg/L',  label: 'Nitrates',     emoji: '🌿' },
  conductivity:     { min: 0,    max: 1500,  unit: ' µS/cm', label: 'Conductivity', emoji: '⚡' },
}

function whoStatus(param, val) {
  const t = WHO[param]; if (!t || isNaN(val)) return null
  if (val < t.min) return { label:'Low', color:'#0ea5e9', ok: false }
  if (val > t.max) return { label:'Exceeds limit', color:'#ef4444', ok: false }
  return { label:'Safe ✓', color:'#10b981', ok: true }
}

// Gauge component for WHO parameters
function ParamGauge({ param, value }) {
  const t = WHO[param]; if (!t || !value) return null
  const val = parseFloat(value)
  const max = param === 'dissolved_oxygen' ? 15 : t.max
  const pct = Math.min(100, Math.max(0, (val / max) * 100))
  const status = whoStatus(param, val)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
      <span style={{ fontSize:14, flexShrink:0 }}>{t.emoji}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
          <span style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)' }}>{t.label}</span>
          <span style={{ fontSize:10, fontWeight:700, color: status?.color || 'var(--text)' }}>{val}{t.unit}</span>
        </div>
        <div style={{ height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background: status?.color || '#6366f1', borderRadius:3, transition:'width 0.6s ease' }}/>
        </div>
      </div>
    </div>
  )
}

// Mini sparkline
function Sparkline({ data, color = '#6366f1' }) {
  if (!data?.length) return null
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const W = 80, H = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`).join(' ')
  return (
    <svg width={W} height={H} style={{ flexShrink:0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function MapPage() {
  const { play } = useSound()
  const { user } = useAuth()
  const mapContainer = useRef(null)
  const map = useRef(null)
  const [sites, setSites] = useState([])
  const [selected, setSelected] = useState(null)
  const [observations, setObservations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [clickedPos, setClickedPos] = useState(null)
  const [is3D, setIs3D] = useState(false)
  const [mapStyle, setMapStyle] = useState('liberty')
  const [searchVal, setSearchVal] = useState('')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [showLayers, setShowLayers] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [layers, setLayers] = useState({ heatmap: true, alertZones: true, labels: true, terrain: false })
  const [patrolMode, setPatrolMode] = useState(false)
  const [patrolPoints, setPatrolPoints] = useState([])
  const [weather, setWeather] = useState(null)
  const [showCreateSite, setShowCreateSite] = useState(false)
  const [createSitePos, setCreateSitePos] = useState(null)
  const [createSiteMode, setCreateSiteMode] = useState(false)
  const createSiteModeRef = useRef(false)
  const [siteForm, setSiteForm] = useState({ name:'', description:'', body_of_water:'', water_body_type:'lake', organization:'', community:'', access_risk:'Low' })
  const [sitePhoto, setSitePhoto] = useState(null)
  const [siteSubmitting, setSiteSubmitting] = useState(false)
  const [mapStats, setMapStats] = useState({ total: 0, active: 0, critical: 0, totalObs: 0 })
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
      style: MAP_STYLES.liberty.url,
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
      try {
        map.current.addSource('terrain', {
          type: 'raster-dem',
          url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
          tileSize: 256,
        })
      } catch {}
    })

    map.current.on('click', (e) => {
      const features = map.current.queryRenderedFeatures(e.point, { layers: ['site-circles'] })
      if (features.length > 0) return
      if (createSiteModeRef.current) {
        setCreateSitePos({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        setShowCreateSite(true)
        setCreateSiteMode(false); createSiteModeRef.current = false
        return
      }
      setClickedPos({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      setForm(f => ({ ...f, site_id: '' }))
      setShowForm(true)
    })

    return () => {
      if (map.current) { map.current.remove(); map.current = null }
    }
  }, [])

  // Load sites
  useEffect(() => {
    api.get('/sites').then(r => {
      const s = Array.isArray(r.data) ? r.data : (r.data.sites || r.data || [])
      setSites(s)
      setMapStats({
        total: s.length,
        active: s.filter(x => x.status === 'active').length,
        critical: s.filter(x => x.status === 'critical').length,
        totalObs: 0,
      })
    }).catch(() => {})
  }, [])

  // Fetch simple weather via Open-Meteo (free, no key)
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=46.5&longitude=-84.3&current=temperature_2m,wind_speed_10m,weathercode&timezone=America/Toronto')
      .then(r => r.json())
      .then(d => {
        const c = d.current
        const code = c.weathercode
        const icon = code === 0 ? '☀️' : code <= 3 ? '🌤️' : code <= 50 ? '🌥️' : code <= 67 ? '🌧️' : code <= 77 ? '❄️' : '⛈️'
        setWeather({ temp: Math.round(c.temperature_2m), wind: Math.round(c.wind_speed_10m), icon })
      }).catch(() => {})
  }, [])

  // Add site layers when map loads
  useEffect(() => {
    if (!mapLoaded || !sites.length) return

    const filtered = statusFilter === 'all' ? sites : sites.filter(s => s.status === statusFilter)
    const geojson = {
      type: 'FeatureCollection',
      features: filtered.map(s => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
        properties: { id: s.id, name: s.name, status: s.status || 'active', location: s.location_name },
      }))
    }

    // Update or add
    if (map.current.getSource('sites')) {
      map.current.getSource('sites').setData(geojson)
      return
    }

    map.current.addSource('sites', { type: 'geojson', data: geojson, cluster: true, clusterMaxZoom: 9, clusterRadius: 50 })

    // Cluster circles
    map.current.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'sites',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step',['get','point_count'],'#6366f1',5,'#f59e0b',10,'#ef4444'],
        'circle-radius': ['step',['get','point_count'],18,5,24,10,30],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      }
    })
    map.current.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'sites',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Semibold','Arial Unicode MS Bold'],
        'text-size': 13,
      },
      paint: { 'text-color': '#fff' }
    })

    // Heatmap layer (observation density proxy from site positions)
    map.current.addSource('heatmap-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: filtered.map(s => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
        properties: { weight: s.status === 'critical' ? 1 : s.status === 'warning' ? 0.6 : 0.3 },
      }))}
    })
    map.current.addLayer({
      id: 'heatmap',
      type: 'heatmap',
      source: 'heatmap-src',
      maxzoom: 10,
      paint: {
        'heatmap-weight': ['interpolate',['linear'],['get','weight'],0,0,1,1],
        'heatmap-intensity': ['interpolate',['linear'],['zoom'],0,1,9,3],
        'heatmap-color': [
          'interpolate',['linear'],['heatmap-density'],
          0,'rgba(0,0,255,0)',0.2,'rgba(14,165,233,0.3)',0.4,'rgba(99,102,241,0.5)',0.6,'rgba(245,158,11,0.7)',1,'rgba(239,68,68,0.9)',
        ],
        'heatmap-radius': ['interpolate',['linear'],['zoom'],0,20,9,40],
        'heatmap-opacity': layers.heatmap ? 0.7 : 0,
      }
    }, 'clusters')

    // Alert zone circles for critical/warning sites
    map.current.addSource('alert-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: filtered.filter(s => s.status === 'critical' || s.status === 'warning').map(s => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
        properties: { status: s.status },
      }))}
    })
    map.current.addLayer({
      id: 'alert-zones',
      type: 'circle',
      source: 'alert-src',
      paint: {
        'circle-radius': 35,
        'circle-color': ['match',['get','status'],'critical','#ef4444','warning','#f59e0b','transparent'],
        'circle-opacity': layers.alertZones ? 0.12 : 0,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['match',['get','status'],'critical','#ef4444','warning','#f59e0b','transparent'],
        'circle-stroke-opacity': layers.alertZones ? 0.4 : 0,
      }
    }, 'clusters')

    // Glow
    map.current.addLayer({
      id: 'site-glow',
      type: 'circle',
      source: 'sites',
      filter: ['!',['has','point_count']],
      paint: {
        'circle-radius': 20,
        'circle-color': ['match',['get','status'],'active','#22c55e','warning','#f59e0b','critical','#ef4444','#94a3b8'],
        'circle-opacity': 0.12,
        'circle-blur': 1,
      }
    })

    // Main circles
    map.current.addLayer({
      id: 'site-circles',
      type: 'circle',
      source: 'sites',
      filter: ['!',['has','point_count']],
      paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'],5,7,10,13,14,18],
        'circle-color': ['match',['get','status'],'active','#22c55e','warning','#f59e0b','critical','#ef4444','#94a3b8'],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': 'white',
        'circle-opacity': 0.95,
      }
    })

    // Labels
    map.current.addLayer({
      id: 'site-labels',
      type: 'symbol',
      source: 'sites',
      filter: ['!',['has','point_count']],
      layout: {
        'text-field': ['get','name'],
        'text-font': ['Open Sans Semibold','Arial Unicode MS Bold'],
        'text-size': 11,
        'text-offset': [0,1.8],
        'text-anchor': 'top',
        'text-max-width': 8,
        'visibility': layers.labels ? 'visible' : 'none',
      },
      paint: { 'text-color': '#0f172a', 'text-halo-color': 'white', 'text-halo-width': 2 }
    })

    // Patrol route line
    map.current.addSource('patrol', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } })
    map.current.addLayer({
      id: 'patrol-line',
      type: 'line',
      source: 'patrol',
      paint: {
        'line-color': '#f59e0b',
        'line-width': 3,
        'line-dasharray': [2,2],
        'line-opacity': 0.9,
      }
    })

    // Site click
    map.current.on('click', 'site-circles', (e) => {
      const props = e.features[0].properties
      const site = sites.find(s => s.id == props.id)
      if (site) {
        setSelected(site)
        api.get(`/sites/${site.id}/observations`).then(r => {
          const obs = r.data.observations || []
          setObservations(obs)
          setMapStats(prev => ({ ...prev, totalObs: obs.length }))
        }).catch(() => {})
        map.current.flyTo({ center: [site.longitude, site.latitude], zoom: 12, speed: 1.2, pitch: is3D ? 45 : 0 })
      }
    })

    // Cluster click → zoom in
    map.current.on('click', 'clusters', (e) => {
      const features = map.current.queryRenderedFeatures(e.point, { layers: ['clusters'] })
      const clusterId = features[0].properties.cluster_id
      map.current.getSource('sites').getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return
        map.current.easeTo({ center: features[0].geometry.coordinates, zoom })
      })
    })

    map.current.on('mouseenter', 'site-circles', () => { map.current.getCanvas().style.cursor = 'pointer' })
    map.current.on('mouseleave', 'site-circles', () => { map.current.getCanvas().style.cursor = '' })
    map.current.on('mouseenter', 'clusters', () => { map.current.getCanvas().style.cursor = 'pointer' })
    map.current.on('mouseleave', 'clusters', () => { map.current.getCanvas().style.cursor = '' })
  }, [mapLoaded, sites, statusFilter])

  // Update patrol line
  useEffect(() => {
    if (!map.current?.getSource('patrol') || patrolPoints.length < 2) return
    map.current.getSource('patrol').setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: patrolPoints }
    })
  }, [patrolPoints])

  // Layer toggle effects
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    try {
      if (map.current.getLayer('heatmap')) map.current.setPaintProperty('heatmap', 'heatmap-opacity', layers.heatmap ? 0.7 : 0)
      if (map.current.getLayer('alert-zones')) {
        map.current.setPaintProperty('alert-zones', 'circle-opacity', layers.alertZones ? 0.12 : 0)
        map.current.setPaintProperty('alert-zones', 'circle-stroke-opacity', layers.alertZones ? 0.4 : 0)
      }
      if (map.current.getLayer('site-labels')) map.current.setLayoutProperty('site-labels', 'visibility', layers.labels ? 'visible' : 'none')
    } catch {}
  }, [layers, mapLoaded])

  // Change map style
  const changeStyle = useCallback((styleKey) => {
    setMapStyle(styleKey)
    if (!map.current) return
    map.current.setStyle(MAP_STYLES[styleKey].url)
    map.current.once('styledata', () => setMapLoaded(false))
    setTimeout(() => setMapLoaded(true), 500)
  }, [])

  // Toggle 3D
  const toggle3D = () => {
    if (!map.current) return
    const next = !is3D
    setIs3D(next)
    map.current.easeTo({ pitch: next ? 55 : 0, bearing: next ? -15 : 0, duration: 800 })
    if (next) { try { map.current.setTerrain({ source: 'terrain', exaggeration: 1.5 }) } catch {} }
    else { try { map.current.setTerrain(null) } catch {} }
  }

  // Search
  const searchLocation = async () => {
    if (!searchVal.trim()) return
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchVal + ', Ontario, Canada')}&format=json&limit=1`)
      const data = await r.json()
      if (data[0]) map.current.flyTo({ center: [parseFloat(data[0].lon), parseFloat(data[0].lat)], zoom: 12, speed: 1.5 })
    } catch {}
  }

  // Submit observation
  const submit = async e => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let siteId = form.site_id
      if (!siteId && clickedPos) {
        const nearest = sites.reduce((best, s) => {
          const d = Math.sqrt((s.latitude - clickedPos.lat) ** 2 + (s.longitude - clickedPos.lng) ** 2)
          return (!best || d < best.d) ? { s, d } : best
        }, null)
        if (nearest) siteId = nearest.s.id
      }
      if (!siteId) { alert('Please select a monitoring site'); setSubmitting(false); return }
      // Map form field names to what the server expects
      const payload = {
        ph: form.ph,
        turbidity: form.turbidity,
        dissolved_oxygen: form.dissolved_oxygen,
        water_temp: form.temperature,
        conductivity: form.conductivity,
        nitrate_nitrogen: form.nitrates,
        phosphorus: form.phosphorus,
        notes: form.notes,
        current_weather_desc: form.weather_conditions,
        sample_id: `MAP-${Date.now()}`,
      }
      await api.post(`/sites/${siteId}/observations`, payload)
      play('success')
      setShowForm(false); setClickedPos(null)
      if (selected) api.get(`/sites/${selected.id}/observations`).then(r => setObservations(Array.isArray(r.data) ? r.data : [])).catch(() => {})
      setForm({ site_id:'', notes:'', weather_conditions:'', sampler_name:'', ph:'', turbidity:'', dissolved_oxygen:'', temperature:'', conductivity:'', nitrates:'', phosphorus:'' })
    } catch (err) { alert(err.response?.data?.error || err.message || 'Submission failed') }
    finally { setSubmitting(false) }
  }

  const latestObs = observations[0]
  const phTrend = observations.slice(0,8).map(o => parseFloat(o.ph)).filter(v => !isNaN(v)).reverse()

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0, height:'calc(100vh - 100px)', position:'relative' }}>

      {/* ── Top toolbar ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
        {/* Search */}
        <div style={{ display:'flex', background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', flex:1, minWidth:200, maxWidth:360 }}>
          <input value={searchVal} onChange={e => setSearchVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchLocation()}
            placeholder="Search location, site..." className="flex-1 text-sm px-3 py-2 outline-none"
            style={{ background:'transparent', color:'var(--text)', border:'none' }}/>
          <button onClick={searchLocation} style={{ paddingInline:12, background:'#6366f1', border:'none', cursor:'pointer', display:'flex', alignItems:'center' }}>
            <Search style={{ width:15, height:15, color:'#fff' }}/>
          </button>
        </div>

        {/* Stats bar */}
        {[
          { label:'Sites', value: sites.length, color:'#6366f1', icon:'📍' },
          { label:'Active', value: sites.filter(s => s.status !== 'inactive').length, color:'#10b981', icon:'✅' },
          { label:'Critical', value: sites.filter(s => s.status === 'critical').length, color:'#ef4444', icon:'🚨' },
        ].map(s => (
          <div key={s.label} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700, color:s.color }}>
            <span>{s.icon}</span>{s.value} <span style={{ fontSize:11, fontWeight:500, color:'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}

        {/* Weather */}
        {weather && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:10, fontSize:13 }}>
            <span style={{ fontSize:16 }}>{weather.icon}</span>
            <span style={{ fontWeight:700, color:'var(--text)' }}>{weather.temp}°C</span>
            <span style={{ color:'var(--text-muted)', fontSize:11 }}>{weather.wind} km/h</span>
          </div>
        )}

        {/* Map style switcher */}
        <div style={{ display:'flex', gap:2, background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:10, padding:2 }}>
          {Object.entries(MAP_STYLES).map(([key, s]) => (
            <button key={key} onClick={() => changeStyle(key)} title={s.label}
              style={{ padding:'5px 10px', borderRadius:8, border:'none', cursor:'pointer', fontSize:14, background: mapStyle === key ? '#6366f1' : 'transparent', transition:'all 0.15s' }}>
              {s.icon}
            </button>
          ))}
        </div>

        {/* Layers toggle */}
        <button onClick={() => setShowLayers(s => !s)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background: showLayers ? '#6366f1' : 'var(--card-bg)', color: showLayers ? 'white' : 'var(--text-muted)', border:'1px solid var(--border)', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:600 }}>
          <Layers style={{ width:14, height:14 }}/> Layers
        </button>

        {/* Patrol route */}
        <button onClick={() => { setPatrolMode(p => !p); if (!patrolMode) setPatrolPoints([]) }}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background: patrolMode ? '#f59e0b' : 'var(--card-bg)', color: patrolMode ? 'white' : 'var(--text-muted)', border:'1px solid var(--border)', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:600 }}>
          <Route style={{ width:14, height:14 }}/> {patrolMode ? `Route (${patrolPoints.length}pts)` : 'Plan Route'}
        </button>

        {/* 3D */}
        <button onClick={toggle3D}
          style={{ padding:'7px 14px', background: is3D ? '#6366f1' : 'var(--card-bg)', color: is3D ? 'white' : 'var(--text-muted)', border:'1px solid var(--border)', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
          {is3D ? '3D' : '2D'}
        </button>

        {/* Add My Site */}
        <button onClick={() => { setCreateSiteMode(m => { const next=!m; createSiteModeRef.current=next; return next }) }}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background: createSiteMode ? '#22c55e' : 'var(--card-bg)', color: createSiteMode ? 'white' : 'var(--text-muted)', border:'1px solid var(--border)', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:600 }}>
          <MapPin style={{ width:14, height:14 }}/> {createSiteMode ? 'Click map to place' : 'Add My Site'}
        </button>

        {/* Log observation */}
        <button onClick={() => setShowForm(true)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', background:'linear-gradient(135deg,#6366f1,#14b8a6)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, marginLeft:'auto' }}>
          <Plus style={{ width:14, height:14 }}/> Log Observation
        </button>
      </div>

      {/* ── Layer control panel ── */}
      {showLayers && (
        <div style={{ position:'absolute', top:60, right:16, zIndex:40, background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:14, padding:16, minWidth:200, boxShadow:'0 8px 32px rgba(0,0,0,0.15)' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:12 }}>Map Layers</div>
          {[
            { key:'heatmap', label:'Water Quality Heatmap', icon:'🔥' },
            { key:'alertZones', label:'Alert Zones', icon:'⚠️' },
            { key:'labels', label:'Site Labels', icon:'🏷️' },
            { key:'terrain', label:'3D Terrain', icon:'⛰️' },
          ].map(l => (
            <label key={l.key} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={layers[l.key]} onChange={() => setLayers(prev => ({ ...prev, [l.key]: !prev[l.key] }))} style={{ width:15, height:15 }}/>
              <span>{l.icon} {l.label}</span>
            </label>
          ))}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginTop:4 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:8 }}>Filter by Status</div>
            {['all','active','warning','critical','inactive'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'4px 8px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, marginBottom:2, background: statusFilter === s ? 'rgba(99,102,241,0.12)' : 'transparent', color: statusFilter === s ? '#6366f1' : 'var(--text-muted)' }}>
                {s === 'all' ? '🌐 All sites' : s === 'active' ? '🟢 Active' : s === 'warning' ? '🟡 Warning' : s === 'critical' ? '🔴 Critical' : '⚫ Inactive'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Map + side panel ── */}
      <div style={{ display:'flex', gap:12, flex:1, minHeight:0 }}>
        {/* Map */}
        <div style={{ flex:1, borderRadius:16, overflow:'hidden', position:'relative', boxShadow:'0 4px 24px rgba(0,0,0,0.12)', border:'1px solid var(--border)' }}>
          <div ref={mapContainer} style={{ width:'100%', height:'100%' }}/>

          {/* Patrol mode indicator */}
          {patrolMode && (
            <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', zIndex:20, background:'rgba(245,158,11,0.95)', color:'white', padding:'8px 20px', borderRadius:20, fontSize:12, fontWeight:700, boxShadow:'0 4px 16px rgba(245,158,11,0.4)' }}>
              🗺️ Route Planning Mode — click map to add waypoints {patrolPoints.length > 0 && `(${patrolPoints.length} points)`}
              {patrolPoints.length > 0 && (
                <button onClick={() => { setPatrolPoints([]); if(map.current?.getSource('patrol')) map.current.getSource('patrol').setData({type:'Feature',geometry:{type:'LineString',coordinates:[]}}) }}
                  style={{ marginLeft:10, background:'rgba(255,255,255,0.2)', border:'none', color:'white', borderRadius:8, padding:'2px 8px', cursor:'pointer', fontSize:11 }}>Clear</button>
              )}
            </div>
          )}

          {/* Legend */}
          <div style={{ position:'absolute', bottom:12, right:12, zIndex:10, background:'rgba(255,255,255,0.95)', backdropFilter:'blur(8px)', borderRadius:12, boxShadow:'0 2px 12px rgba(0,0,0,0.1)', padding:'10px 14px', fontSize:11 }}>
            <div style={{ fontWeight:700, color:'#374151', marginBottom:6 }}>Site Status</div>
            {Object.entries(STATUS_COLORS).map(([s, c]) => (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3, color:'#374151', textTransform:'capitalize' }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:c, boxShadow:`0 0 6px ${c}60` }}/>
                {s}
              </div>
            ))}
            {layers.heatmap && <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid #e5e7eb', color:'#374151', fontWeight:600 }}>🔥 Heatmap: risk intensity</div>}
          </div>
        </div>

        {/* Side panel */}
        <div style={{ width:300, display:'flex', flexDirection:'column', gap:10, overflow:'hidden' }}>
          {selected ? (
            /* Site detail panel */
            <div style={{ flex:1, overflow:'auto', background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:14 }}>
              {/* Header */}
              <div style={{ padding:'14px 16px', background:'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(20,184,166,0.06))', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>{selected.name}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>📍 {selected.location_name}</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}>
                    <X style={{ width:14, height:14 }}/>
                  </button>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background: selected.status === 'critical' ? 'rgba(239,68,68,0.12)' : selected.status === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', color: STATUS_COLORS[selected.status || 'active'] }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background: STATUS_COLORS[selected.status || 'active'], animation: selected.status === 'active' ? 'pulse 2s infinite' : 'none' }}/>
                    {(selected.status || 'active').toUpperCase()}
                  </div>
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>{observations.length} observations</span>
                </div>
              </div>

              {/* Latest reading gauges */}
              {latestObs && (
                <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:8 }}>LATEST READING · {new Date(latestObs.collected_at).toLocaleDateString()}</div>
                  {Object.keys(WHO).map(param => latestObs[param] ? <ParamGauge key={param} param={param} value={latestObs[param]}/> : null)}
                </div>
              )}

              {/* pH trend sparkline */}
              {phTrend.length >= 3 && (
                <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em' }}>pH TREND</div>
                    <div style={{ fontSize:11, color:'var(--text)' }}>Last {phTrend.length} readings</div>
                  </div>
                  <Sparkline data={phTrend} color="#6366f1"/>
                </div>
              )}

              {/* Recent observations */}
              <div style={{ padding:'10px 16px' }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:8 }}>RECENT OBSERVATIONS</div>
                {observations.length === 0 ? (
                  <div style={{ textAlign:'center', padding:20, color:'var(--text-muted)', fontSize:13 }}>No observations yet — be the first! 🌊</div>
                ) : observations.slice(0,4).map(obs => (
                  <div key={obs.id} style={{ background:'var(--page-bg)', borderRadius:10, padding:'8px 10px', marginBottom:6, border:'1px solid var(--border)', fontSize:11 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontWeight:700, color:'var(--text)' }}>{obs.sampler_name || obs.display_name || 'Anonymous'}</span>
                      <span style={{ color:'var(--text-muted)' }}>{new Date(obs.collected_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {['ph','temperature','dissolved_oxygen','turbidity'].filter(p => obs[p]).map(p => {
                        const status = whoStatus(p, parseFloat(obs[p]))
                        return (
                          <span key={p} style={{ padding:'1px 7px', borderRadius:20, background:`${status?.color || '#6366f1'}15`, color: status?.color || '#6366f1', fontWeight:600, fontSize:10 }}>
                            {WHO[p].emoji} {obs[p]}{WHO[p].unit}
                          </span>
                        )
                      })}
                    </div>
                    {obs.notes && <div style={{ marginTop:4, color:'var(--text-muted)', fontStyle:'italic', fontSize:10 }}>"{obs.notes}"</div>}
                  </div>
                ))}
                <button onClick={() => { setForm(f => ({ ...f, site_id: selected.id })); setShowForm(true) }}
                  style={{ width:'100%', padding:'8px 0', background:'linear-gradient(135deg,#6366f1,#14b8a6)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:700, marginTop:4 }}>
                  <Plus style={{ width:12, height:12, display:'inline', marginRight:5 }}/>Add Observation
                </button>
              </div>
            </div>
          ) : (
            /* Overview panel — no site selected */
            <>
              <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:14, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:800, color:'var(--text)', marginBottom:12 }}>🗺️ Water Ranger Map</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.6, marginBottom:12 }}>
                  Monitor {sites.length} water quality sites across the Algoma region. Click any site marker to view readings and log observations.
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { icon:'📍', val: sites.length, label:'Total Sites' },
                    { icon:'✅', val: sites.filter(s=>s.status==='active').length, label:'Active' },
                    { icon:'⚠️', val: sites.filter(s=>s.status==='warning').length, label:'Warning' },
                    { icon:'🚨', val: sites.filter(s=>s.status==='critical').length, label:'Critical' },
                  ].map(s => (
                    <div key={s.label} style={{ background:'var(--page-bg)', borderRadius:10, padding:'10px 12px', textAlign:'center', border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:18 }}>{s.icon}</div>
                      <div style={{ fontSize:20, fontWeight:900, color:'var(--text)' }}>{s.val}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:14, padding:16, flex:1, overflow:'auto' }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:10 }}>ALL MONITORING SITES</div>
                {sites.map(site => (
                  <div key={site.id} onClick={() => {
                    setSelected(site)
                    api.get(`/sites/${site.id}/observations`).then(r => setObservations(r.data.observations || [])).catch(() => {})
                    map.current?.flyTo({ center:[site.longitude, site.latitude], zoom:11, speed:1.2 })
                  }}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, cursor:'pointer', marginBottom:4, transition:'all 0.12s', border:'1px solid transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(99,102,241,0.06)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent' }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', flexShrink:0, background: STATUS_COLORS[site.status||'active'], boxShadow:`0 0 6px ${STATUS_COLORS[site.status||'active']}60` }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{site.name}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{site.location_name}</div>
                    </div>
                    <ChevronDown style={{ width:12, height:12, color:'var(--text-muted)', transform:'rotate(-90deg)', flexShrink:0 }}/>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Observation form modal ── */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && (setShowForm(false), setClickedPos(null))}>
          <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:560, overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', background:'linear-gradient(135deg,#6366f1,#14b8a6)' }}>
              <h2 style={{ color:'white', fontWeight:800, fontSize:16, margin:0 }}>💧 Log Water Observation</h2>
              <button onClick={() => { setShowForm(false); setClickedPos(null) }} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'white', width:28, height:28, borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X style={{ width:14, height:14 }}/>
              </button>
            </div>
            <form onSubmit={submit} style={{ padding:20, maxHeight:'72vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
              {clickedPos && (
                <div style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#92400e' }}>
                  📍 Logging at ({clickedPos.lat.toFixed(4)}, {clickedPos.lng.toFixed(4)}) — will auto-assign to nearest site
                </div>
              )}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Monitoring Site</label>
                <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} required={!clickedPos}
                  style={{ width:'100%', padding:'8px 12px', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', outline:'none' }}>
                  <option value="">Select a site{clickedPos ? ' (or use map position)' : ''}...</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name} — {s.location_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Your Name (optional)</label>
                <input value={form.sampler_name} onChange={e => setForm(f => ({ ...f, sampler_name: e.target.value }))} placeholder="e.g. Jane Smith"
                  style={{ width:'100%', padding:'8px 12px', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', outline:'none' }}/>
              </div>

              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:-4 }}>WATER QUALITY PARAMETERS</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { k:'ph', label:'🧪 pH (0–14)', ph:'7.2', who:'6.5–8.5' },
                  { k:'temperature', label:'🌡️ Temperature °C', ph:'15', who:'<25°C' },
                  { k:'dissolved_oxygen', label:'💨 Dissolved O₂ mg/L', ph:'8.5', who:'>6 mg/L' },
                  { k:'turbidity', label:'🌊 Turbidity NTU', ph:'2.1', who:'<5 NTU' },
                  { k:'conductivity', label:'⚡ Conductivity µS/cm', ph:'450', who:'<1500' },
                  { k:'nitrates', label:'🌿 Nitrates mg/L', ph:'3.2', who:'<10 mg/L' },
                ].map(({ k, label, ph, who }) => (
                  <div key={k}>
                    <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span>{label}</span>
                      <span style={{ color:'#818cf8' }}>WHO: {who}</span>
                    </label>
                    <input type="number" step="0.01" placeholder={ph} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                      style={{ width:'100%', padding:'8px 10px', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', outline:'none' }}/>
                  </div>
                ))}
              </div>

              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Weather Conditions</label>
                <input value={form.weather_conditions} onChange={e => setForm(f => ({ ...f, weather_conditions: e.target.value }))} placeholder="Clear, 18°C, light wind"
                  style={{ width:'100%', padding:'8px 12px', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', outline:'none' }}/>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Field Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Unusual colours, odours, wildlife observations..."
                  style={{ width:'100%', padding:'8px 12px', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', outline:'none', resize:'none' }}/>
              </div>

              <div style={{ display:'flex', gap:8, paddingTop:4 }}>
                <button type="button" onClick={() => { setShowForm(false); setClickedPos(null) }}
                  style={{ flex:1, padding:'10px 0', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, color:'var(--text-muted)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  style={{ flex:2, padding:'10px 0', background:'linear-gradient(135deg,#6366f1,#14b8a6)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Submitting…' : '💧 Submit (+15 pts)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create Site mode banner ── */}
      {createSiteMode && (
        <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', zIndex:600, background:'rgba(34,197,94,0.95)', color:'white', padding:'10px 24px', borderRadius:20, fontSize:13, fontWeight:700, boxShadow:'0 4px 20px rgba(34,197,94,0.4)', display:'flex', alignItems:'center', gap:10 }}>
          📍 Click anywhere on the map to place your new monitoring site
          <button onClick={() => { setCreateSiteMode(false); createSiteModeRef.current = false }}
            style={{ background:'rgba(255,255,255,0.25)', border:'none', color:'white', borderRadius:8, padding:'3px 10px', cursor:'pointer', fontSize:12 }}>Cancel</button>
        </div>
      )}

      {/* ── Create Site Modal ── */}
      {showCreateSite && createSitePos && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && setShowCreateSite(false)}>
          <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:580, boxShadow:'0 24px 64px rgba(0,0,0,0.35)', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', background:'linear-gradient(135deg,#22c55e,#16a34a)' }}>
              <div>
                <h2 style={{ color:'white', fontWeight:800, fontSize:16, margin:0 }}>🗺️ Create My Monitoring Site</h2>
                <div style={{ color:'rgba(255,255,255,0.8)', fontSize:12, marginTop:2 }}>📍 {createSitePos.lat.toFixed(5)}, {createSitePos.lng.toFixed(5)}</div>
              </div>
              <button onClick={() => setShowCreateSite(false)} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'white', width:30, height:30, borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X style={{ width:14, height:14 }}/>
              </button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault(); setSiteSubmitting(true)
              try {
                const fd = new FormData()
                fd.append('name', siteForm.name)
                fd.append('description', siteForm.description)
                fd.append('latitude', createSitePos.lat)
                fd.append('longitude', createSitePos.lng)
                fd.append('body_of_water', siteForm.body_of_water)
                fd.append('water_body_type', siteForm.water_body_type)
                fd.append('organization', siteForm.organization)
                fd.append('community', siteForm.community)
                fd.append('access_risk', siteForm.access_risk)
                fd.append('dataset_name', siteForm.name)
                if (sitePhoto) fd.append('reference_photo', sitePhoto)
                const r = await api.post('/sites', fd)
                const newSite = r.data
                setSites(prev => [...prev, { ...newSite, parameters_tested: [], observation_count: 0 }])
                setShowCreateSite(false)
                setSiteForm({ name:'', description:'', body_of_water:'', water_body_type:'lake', organization:'', community:'', access_risk:'Low' })
                setSitePhoto(null)
                alert(`✅ Site "${newSite.name}" created! It will appear on the map.`)
              } catch(err) { alert('Failed to create site: ' + (err.response?.data?.error || err.message)) }
              finally { setSiteSubmitting(false) }
            }} style={{ padding:20, maxHeight:'72vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>SITE NAME *</label>
                  <input required value={siteForm.name} onChange={e => setSiteForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Sault Ste. Marie River Inlet"
                    style={{ width:'100%', padding:'9px 12px', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', outline:'none', boxSizing:'border-box' }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>BODY OF WATER *</label>
                  <input required value={siteForm.body_of_water} onChange={e => setSiteForm(f=>({...f,body_of_water:e.target.value}))} placeholder="e.g. St. Marys River"
                    style={{ width:'100%', padding:'9px 12px', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', outline:'none', boxSizing:'border-box' }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>WATER TYPE</label>
                  <select value={siteForm.water_body_type} onChange={e => setSiteForm(f=>({...f,water_body_type:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', outline:'none' }}>
                    {['lake','river','stream','wetland','reservoir','coastal','groundwater','other'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>ORGANIZATION</label>
                  <input value={siteForm.organization} onChange={e => setSiteForm(f=>({...f,organization:e.target.value}))} placeholder="e.g. NORDIK Institute"
                    style={{ width:'100%', padding:'9px 12px', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', outline:'none', boxSizing:'border-box' }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>COMMUNITY</label>
                  <input value={siteForm.community} onChange={e => setSiteForm(f=>({...f,community:e.target.value}))} placeholder="e.g. Algoma District"
                    style={{ width:'100%', padding:'9px 12px', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', outline:'none', boxSizing:'border-box' }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>ACCESS RISK</label>
                  <select value={siteForm.access_risk} onChange={e => setSiteForm(f=>({...f,access_risk:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', outline:'none' }}>
                    {['Low','Moderate','High','Very High'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>DESCRIPTION</label>
                  <textarea rows={2} value={siteForm.description} onChange={e => setSiteForm(f=>({...f,description:e.target.value}))} placeholder="Describe the location, access, notable features..."
                    style={{ width:'100%', padding:'9px 12px', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', outline:'none', resize:'none', boxSizing:'border-box' }}/>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>REFERENCE PHOTO</label>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:9, border:'1.5px dashed var(--border)', cursor:'pointer', fontSize:12, color:'var(--text-muted)', background:'var(--page-bg)' }}>
                      📷 {sitePhoto ? sitePhoto.name : 'Choose photo (optional)'}
                      <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => setSitePhoto(e.target.files?.[0] || null)}/>
                    </label>
                    {sitePhoto && <button type="button" onClick={() => setSitePhoto(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:12 }}>✕ Remove</button>}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, paddingTop:4 }}>
                <button type="button" onClick={() => setShowCreateSite(false)}
                  style={{ flex:1, padding:'10px 0', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, color:'var(--text-muted)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={siteSubmitting}
                  style={{ flex:2, padding:'10px 0', background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'white', border:'none', borderRadius:10, cursor:siteSubmitting?'not-allowed':'pointer', fontSize:13, fontWeight:700, opacity: siteSubmitting ? 0.6 : 1 }}>
                  {siteSubmitting ? 'Creating...' : '🗺️ Create My Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
