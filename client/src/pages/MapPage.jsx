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

const MAP_STYLES = {
  dark: {
    label: 'Dark',
    icon: '🌑',
    url: {
      version: 8,
      sources: {
        osm: { type: 'raster', tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 }
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
          paint: { 'raster-fade-duration': 100 }
        }
      ]
    }
  },
  light: {
    label: 'Light',
    icon: '☀️',
    url: {
      version: 8,
      sources: {
        osm: { type: 'raster', tiles: ['https://b.tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 }
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
          paint: { 'raster-fade-duration': 100 }
        }
      ]
    }
  },
  satellite: {
    label: 'Satellite',
    icon: '🛰️',
    url: {
      version: 8,
      sources: {
        sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 }
      },
      layers: [
        {
          id: 'sat',
          type: 'raster',
          source: 'sat',
          paint: { 'raster-fade-duration': 100 }
        }
      ]
    }
  }
}

const STATUS_COLORS = { active: '#22c55e', warning: '#f59e0b', critical: '#ef4444', inactive: '#94a3b8' }
const STATUS_GLOW   = { active: '0 0 16px #22c55e88', warning: '0 0 16px #f59e0b88', critical: '0 0 20px #ef444488', inactive: 'none' }

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

function ParamGauge({ param, value }) {
  const t = WHO[param]; if (!t || !value) return null
  const val = parseFloat(value)
  const max = param === 'dissolved_oxygen' ? 15 : t.max
  const pct = Math.min(100, Math.max(0, (val / max) * 100))
  const status = whoStatus(param, val)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0' }}>
      <span style={{ fontSize:15, flexShrink:0 }}>{t.emoji}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:'0.05em' }}>{t.label.toUpperCase()}</span>
          <span style={{ fontSize:11, fontWeight:800, color: status?.color || '#a5b4fc' }}>{val}{t.unit}</span>
        </div>
        <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:4, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${status?.color || '#6366f1'},${status?.color || '#a5b4fc'})`, borderRadius:4, transition:'width 1s cubic-bezier(0.34,1.56,0.64,1)', boxShadow:`0 0 8px ${status?.color || '#6366f1'}80` }}/>
        </div>
      </div>
    </div>
  )
}

function Sparkline({ data, color = '#6366f1' }) {
  if (!data?.length) return null
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const W = 80, H = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`).join(' ')
  const area = `${pts} ${W},${H} 0,${H}`
  return (
    <svg width={W} height={H} style={{ flexShrink:0 }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sg)"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      {data.length > 0 && (
        <circle cx={(data.length-1)/(data.length-1)*W} cy={H - ((data[data.length-1]-min)/range)*(H-4)-2} r="3" fill={color}/>
      )}
    </svg>
  )
}

const MAP_CSS = `
  @keyframes ring-expand {
    0%   { transform:translate(-50%,-50%) scale(0.6); opacity:0.9; }
    100% { transform:translate(-50%,-50%) scale(2.2); opacity:0; }
  }
  @keyframes ring-expand-fast {
    0%   { transform:translate(-50%,-50%) scale(0.6); opacity:1; }
    100% { transform:translate(-50%,-50%) scale(2.6); opacity:0; }
  }
  @keyframes scan-rotate {
    0%   { transform:translate(-50%,-50%) rotate(0deg); }
    100% { transform:translate(-50%,-50%) rotate(360deg); }
  }
  @keyframes dot-pulse {
    0%,100% { box-shadow: 0 0 0 0 currentColor; }
    50%      { box-shadow: 0 0 0 5px transparent; }
  }
  @keyframes marker-pop {
    0%   { transform:scale(0) translateY(6px); opacity:0; }
    70%  { transform:scale(1.2) translateY(-2px); opacity:1; }
    100% { transform:scale(1) translateY(0); opacity:1; }
  }
  @keyframes hud-slide-in {
    from { transform:translateX(-20px); opacity:0; }
    to   { transform:translateX(0); opacity:1; }
  }
  @keyframes counter-up {
    from { transform:translateY(8px); opacity:0; }
    to   { transform:translateY(0); opacity:1; }
  }
  @keyframes glow-breathe {
    0%,100% { opacity:0.6; }
    50%      { opacity:1; }
  }

  .site-html-marker { position:relative; cursor:pointer; }

  .site-html-marker .m-dot {
    width:14px; height:14px; border-radius:50%; border:2.5px solid rgba(255,255,255,0.9);
    position:relative; z-index:2; transition:transform 0.2s; color:transparent;
  }
  .site-html-marker:hover .m-dot { transform:scale(1.35); }
  .site-html-marker.selected .m-dot { transform:scale(1.5); border-color:#fff; border-width:3px; }

  .site-html-marker .m-ring {
    position:absolute; top:50%; left:50%;
    width:32px; height:32px; border-radius:50%; border:2px solid;
    pointer-events:none;
  }
  .site-html-marker.status-active    .m-dot { background:#22c55e; }
  .site-html-marker.status-warning   .m-dot { background:#f59e0b; }
  .site-html-marker.status-critical  .m-dot { background:#ef4444; }
  .site-html-marker.status-inactive  .m-dot { background:#94a3b8; }

  .site-html-marker.status-active   .m-ring { border-color:#22c55e; animation:ring-expand 2.4s ease-out infinite; }
  .site-html-marker.status-warning  .m-ring { border-color:#f59e0b; animation:ring-expand 1.6s ease-out infinite; }
  .site-html-marker.status-critical .m-ring { border-color:#ef4444; animation:ring-expand-fast 1s ease-out infinite; }
  .site-html-marker.status-inactive .m-ring { display:none; }

  .site-html-marker.status-critical .m-ring-2 {
    position:absolute; top:50%; left:50%;
    width:44px; height:44px; margin:-22px; border-radius:50%;
    border:1.5px dashed #ef4444;
    pointer-events:none;
    animation:scan-rotate 3s linear infinite;
  }

  .site-html-marker.selected .m-ring  { border-width:3px; animation-duration:0.8s !important; }
  .site-html-marker.selected::after {
    content:''; position:absolute; top:50%; left:50%;
    width:56px; height:56px; margin:-28px;
    border-radius:50%; border:2px solid #6366f1;
    animation:ring-expand 1.2s ease-out infinite;
    pointer-events:none;
  }

  .site-html-marker { animation:marker-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }

  .map-hud-stat { animation:hud-slide-in 0.4s ease both; }
  .map-hud-stat:nth-child(1) { animation-delay:0.05s; }
  .map-hud-stat:nth-child(2) { animation-delay:0.1s; }
  .map-hud-stat:nth-child(3) { animation-delay:0.15s; }

  .maplibregl-canvas { filter:saturate(1.15) contrast(1.05); }
`

export default function MapPage() {
  const { play } = useSound()
  const { user } = useAuth()
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markersRef = useRef({})
  const [sites, setSites] = useState([])
  const [selected, setSelected] = useState(null)
  const [observations, setObservations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [clickedPos, setClickedPos] = useState(null)
  const [is3D, setIs3D] = useState(false)
  const [mapStyle, setMapStyle] = useState('dark')
  const [searchVal, setSearchVal] = useState('')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [showLayers, setShowLayers] = useState(false)
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
  const [form, setForm] = useState({
    site_id:'', notes:'', weather_conditions:'', sampler_name:'',
    ph:'', turbidity:'', dissolved_oxygen:'', temperature:'',
    conductivity:'', nitrates:'', phosphorus:'',
  })
  // ── REAL ML PREDICTIONS STATE ──
  const [mlPredictions, setMlPredictions] = useState(null)
  const [mlLoading, setMlLoading] = useState(false)

  // Init map
  useEffect(() => {
    if (map.current || !mapContainer.current) return
    console.log('[MapPage] Initializing map, container:', mapContainer.current)
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLES.dark.url,
        center: [-84.3, 46.5],
        zoom: 6.5,
        pitch: 0,
        bearing: 0,
        antialias: true,
      })
      console.log('[MapPage] Map instance created:', map.current)

      map.current.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')
      map.current.addControl(new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }), 'top-right')
      map.current.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
      map.current.addControl(new maplibregl.FullscreenControl(), 'top-right')

      map.current.on('load', () => {
        console.log('[MapPage] Map loaded successfully')
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
        if (createSiteModeRef.current) {
          setCreateSitePos({ lat: e.lngLat.lat, lng: e.lngLat.lng })
          setShowCreateSite(true)
          setCreateSiteMode(false); createSiteModeRef.current = false
          return
        }
        if (patrolMode) {
          setPatrolPoints(p => [...p, [e.lngLat.lng, e.lngLat.lat]])
          return
        }
        setClickedPos({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        setForm(f => ({ ...f, site_id: '' }))
        setShowForm(true)
      })
    } catch (err) {
      console.error('[MapPage] Failed to initialize map:', err, err.stack)
    }

    return () => {
      if (map.current) { map.current.remove(); map.current = null }
    }
  }, [])

  // Load sites
  useEffect(() => {
    api.get('/sites').then(r => {
      const s = Array.isArray(r.data) ? r.data : (r.data.sites || r.data || [])
      setSites(s)
    }).catch(() => {})
  }, [])

  // ── FETCH REAL ML PREDICTIONS when site is selected ──
  useEffect(() => {
    if (!selected?.id) {
      setMlPredictions(null)
      return
    }
    
    setMlLoading(true)
    console.log(`[MapPage] Fetching ML predictions for site ${selected.id}`)
    
    api.post(`/ai/predict/${selected.id}`)
      .then(r => {
        console.log('[MapPage] ML predictions received:', r.data)
        setMlPredictions(r.data)
      })
      .catch(err => {
        console.error('[MapPage] Failed to fetch ML predictions:', err)
        setMlPredictions({ error: true, message: 'Could not load ML predictions' })
      })
      .finally(() => setMlLoading(false))
  }, [selected?.id])

  // Weather
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

  // HTML markers — replace whenever sites/filter/selected changes
  useEffect(() => {
    if (!mapLoaded || !map.current) return

    // Remove old markers
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    const filtered = statusFilter === 'all' ? sites : sites.filter(s => s.status === statusFilter)

    filtered.forEach((site, idx) => {
      const status = site.status || 'active'
      const el = document.createElement('div')
      el.className = `site-html-marker status-${status}${selected?.id === site.id ? ' selected' : ''}`
      el.style.animationDelay = `${idx * 40}ms`

      const ring = document.createElement('div')
      ring.className = 'm-ring'
      el.appendChild(ring)

      if (status === 'critical') {
        const ring2 = document.createElement('div')
        ring2.className = 'm-ring-2'
        el.appendChild(ring2)
      }

      const dot = document.createElement('div')
      dot.className = 'm-dot'
      el.appendChild(dot)

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        setSelected(site)
        api.get(`/sites/${site.id}/observations`).then(r => {
          setObservations(r.data.observations || [])
        }).catch(() => {})
        map.current.flyTo({
          center: [site.longitude, site.latitude],
          zoom: 13,
          speed: 1.4,
          pitch: is3D ? 55 : 35,
          bearing: is3D ? -20 : 0,
          duration: 1400,
        })
        play('click')
      })

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([site.longitude, site.latitude])
        .addTo(map.current)

      markersRef.current[site.id] = marker
    })
  }, [mapLoaded, sites, statusFilter, selected?.id])

  // MapLibre layers: heatmap + alert zones + cluster + patrol
  useEffect(() => {
    if (!mapLoaded || !sites.length) return

    const filtered = statusFilter === 'all' ? sites : sites.filter(s => s.status === statusFilter)

    const geojson = {
      type: 'FeatureCollection',
      features: filtered.map(s => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
        properties: { id: s.id, name: s.name, status: s.status || 'active', weight: s.status === 'critical' ? 1 : s.status === 'warning' ? 0.6 : 0.3 },
      }))
    }

    if (map.current.getSource('sites')) {
      map.current.getSource('sites').setData(geojson)
      if (map.current.getSource('heatmap-src')) map.current.getSource('heatmap-src').setData(geojson)
      return
    }

    // Cluster source
    map.current.addSource('sites', { type: 'geojson', data: geojson, cluster: true, clusterMaxZoom: 10, clusterRadius: 60 })

    // Cluster glow
    map.current.addLayer({
      id: 'cluster-glow',
      type: 'circle',
      source: 'sites',
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': ['step',['get','point_count'],32,5,40,10,50],
        'circle-color': ['step',['get','point_count'],'#6366f1',5,'#f59e0b',10,'#ef4444'],
        'circle-opacity': 0.12,
        'circle-blur': 1,
      }
    })
    // Cluster body
    map.current.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'sites',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step',['get','point_count'],'#4f46e5',5,'#d97706',10,'#dc2626'],
        'circle-radius': ['step',['get','point_count'],20,5,26,10,32],
        'circle-stroke-width': 2,
        'circle-stroke-color': ['step',['get','point_count'],'rgba(99,102,241,0.6)',5,'rgba(245,158,11,0.6)',10,'rgba(239,68,68,0.6)'],
        'circle-opacity': 0.92,
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

    // Heatmap
    map.current.addSource('heatmap-src', { type: 'geojson', data: geojson })
    map.current.addLayer({
      id: 'heatmap',
      type: 'heatmap',
      source: 'heatmap-src',
      maxzoom: 11,
      paint: {
        'heatmap-weight': ['interpolate',['linear'],['get','weight'],0,0,1,1],
        'heatmap-intensity': ['interpolate',['linear'],['zoom'],0,1,10,4],
        'heatmap-color': [
          'interpolate',['linear'],['heatmap-density'],
          0,'rgba(0,0,0,0)',
          0.15,'rgba(14,165,233,0.25)',
          0.4,'rgba(99,102,241,0.55)',
          0.65,'rgba(245,158,11,0.75)',
          1,'rgba(239,68,68,0.95)',
        ],
        'heatmap-radius': ['interpolate',['linear'],['zoom'],0,25,10,50],
        'heatmap-opacity': layers.heatmap ? 0.75 : 0,
      }
    }, 'clusters')

    // Alert zones
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
        'circle-radius': 48,
        'circle-color': ['match',['get','status'],'critical','#ef4444','warning','#f59e0b','transparent'],
        'circle-opacity': layers.alertZones ? 0.08 : 0,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['match',['get','status'],'critical','#ef4444','warning','#f59e0b','transparent'],
        'circle-stroke-opacity': layers.alertZones ? 0.5 : 0,
      }
    }, 'clusters')

    // Patrol line
    map.current.addSource('patrol', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } })
    map.current.addLayer({
      id: 'patrol-line',
      type: 'line',
      source: 'patrol',
      paint: {
        'line-color': '#f59e0b',
        'line-width': 3,
        'line-dasharray': [4, 3],
        'line-opacity': 0.95,
      }
    })

    // Cluster click
    map.current.on('click', 'clusters', (e) => {
      const features = map.current.queryRenderedFeatures(e.point, { layers: ['clusters'] })
      const clusterId = features[0].properties.cluster_id
      map.current.getSource('sites').getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return
        map.current.easeTo({ center: features[0].geometry.coordinates, zoom: zoom + 1, duration: 700 })
      })
    })
    map.current.on('mouseenter', 'clusters', () => { map.current.getCanvas().style.cursor = 'pointer' })
    map.current.on('mouseleave', 'clusters', () => { map.current.getCanvas().style.cursor = '' })

  }, [mapLoaded, sites, statusFilter])

  // 3D buildings toggle
  useEffect(() => {
    if (!mapLoaded || !map.current) return
    try {
      if (is3D) {
        if (!map.current.getLayer('3d-buildings')) {
          map.current.addLayer({
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 12,
            paint: {
              'fill-extrusion-color': '#1e1b4b',
              'fill-extrusion-height': ['interpolate',['linear'],['zoom'],12,0,12.05,['get','height']],
              'fill-extrusion-base': ['interpolate',['linear'],['zoom'],12,0,12.05,['get','min_height']],
              'fill-extrusion-opacity': 0.7,
            }
          })
        }
        map.current.setTerrain({ source: 'terrain', exaggeration: 2.0 })
        map.current.setSky({
          'sky-color': '#0a0a1a',
          'sky-horizon-blend': 0.5,
          'horizon-color': '#1e1b4b',
          'horizon-fog-blend': 0.5,
          'fog-color': '#0f0f2e',
          'fog-ground-blend': 0.5,
        })
      } else {
        if (map.current.getLayer('3d-buildings')) map.current.removeLayer('3d-buildings')
        map.current.setTerrain(null)
        map.current.setSky(null)
      }
    } catch {}
  }, [is3D, mapLoaded])

  // Layer toggle
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    try {
      if (map.current.getLayer('heatmap')) map.current.setPaintProperty('heatmap', 'heatmap-opacity', layers.heatmap ? 0.75 : 0)
      if (map.current.getLayer('alert-zones')) {
        map.current.setPaintProperty('alert-zones', 'circle-opacity', layers.alertZones ? 0.08 : 0)
        map.current.setPaintProperty('alert-zones', 'circle-stroke-opacity', layers.alertZones ? 0.5 : 0)
      }
    } catch {}
  }, [layers, mapLoaded])

  // Patrol line update
  useEffect(() => {
    if (!map.current?.getSource('patrol')) return
    map.current.getSource('patrol').setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: patrolPoints }
    })
  }, [patrolPoints])

  // Style change
  const changeStyle = useCallback((styleKey) => {
    setMapStyle(styleKey)
    if (!map.current) return
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}
    try {
      map.current.setStyle(MAP_STYLES[styleKey].url)
    } catch (e) {
      console.error('Style change error:', e)
    }
    map.current.once('styledata', () => {
      setMapLoaded(false)
      setTimeout(() => setMapLoaded(true), 600)
    })
  }, [])

  // Toggle 3D
  const toggle3D = () => {
    const next = !is3D
    setIs3D(next)
    if (map.current) {
      map.current.easeTo({ pitch: next ? 55 : 0, bearing: next ? -18 : 0, duration: 1000 })
    }
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
      const payload = {
        ph: form.ph, turbidity: form.turbidity, dissolved_oxygen: form.dissolved_oxygen,
        water_temp: form.temperature, conductivity: form.conductivity,
        nitrate_nitrogen: form.nitrates, phosphorus: form.phosphorus,
        notes: form.notes, current_weather_desc: form.weather_conditions,
        sample_id: `MAP-${Date.now()}`,
      }
      await api.post(`/sites/${siteId}/observations`, payload)
      play('success')
      setShowForm(false); setClickedPos(null)
      if (selected) api.get(`/sites/${selected.id}/observations`).then(r => setObservations(r.data.observations || [])).catch(() => {})
      setForm({ site_id:'', notes:'', weather_conditions:'', sampler_name:'', ph:'', turbidity:'', dissolved_oxygen:'', temperature:'', conductivity:'', nitrates:'', phosphorus:'' })
    } catch (err) { alert(err.response?.data?.error || err.message || 'Submission failed') }
    finally { setSubmitting(false) }
  }

  const latestObs = observations[0]
  const phTrend = observations.slice(0,8).map(o => parseFloat(o.ph)).filter(v => !isNaN(v)).reverse()
  const criticalCount = sites.filter(s => s.status === 'critical').length
  const warningCount  = sites.filter(s => s.status === 'warning').length
  const activeCount   = sites.filter(s => s.status === 'active').length

  // ── PANEL STYLES ─────────────────────────────────────────────
  const panelBase = {
    background: 'rgba(10,10,26,0.88)',
    border: '1px solid rgba(99,102,241,0.18)',
    backdropFilter: 'blur(16px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.04)',
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0, height:'calc(100vh - 100px)', position:'relative' }}>
      <style>{MAP_CSS}</style>

      {/* ── Top toolbar ── */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>

        {/* Search */}
        <div style={{ display:'flex', ...panelBase, borderRadius:12, overflow:'hidden', flex:1, minWidth:200, maxWidth:320 }}>
          <input value={searchVal} onChange={e => setSearchVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchLocation()}
            placeholder="Search location or site…"
            className="flex-1 text-sm px-3 py-2 outline-none"
            style={{ background:'transparent', color:'#e2e8f0', border:'none', fontSize:13, flex:1, padding:'8px 12px' }}/>
          <button onClick={searchLocation} style={{ paddingInline:14, background:'linear-gradient(135deg,#6366f1,#4f46e5)', border:'none', cursor:'pointer', display:'flex', alignItems:'center' }}>
            <Search style={{ width:14, height:14, color:'#fff' }}/>
          </button>
        </div>

        {/* HUD stats */}
        {[
          { label:'SITES',    value: sites.length,  color:'#818cf8', icon:'📡' },
          { label:'ACTIVE',   value: activeCount,   color:'#4ade80', icon:'🟢' },
          { label:'CRITICAL', value: criticalCount, color:'#f87171', icon:'🔴' },
        ].map((s,i) => (
          <div key={s.label} className="map-hud-stat" style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 14px', ...panelBase, borderRadius:10, fontSize:12, fontWeight:800, color:s.color, letterSpacing:'0.04em' }}>
            <span style={{ fontSize:13 }}>{s.icon}</span>
            <span style={{ fontSize:16, fontWeight:900 }}>{s.value}</span>
            <span style={{ fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.35)' }}>{s.label}</span>
          </div>
        ))}

        {/* Weather */}
        {weather && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', ...panelBase, borderRadius:10 }}>
            <span style={{ fontSize:18 }}>{weather.icon}</span>
            <span style={{ fontWeight:800, color:'#e2e8f0', fontSize:14 }}>{weather.temp}°C</span>
            <span style={{ color:'rgba(255,255,255,0.4)', fontSize:11 }}>{weather.wind} km/h</span>
          </div>
        )}

        {/* Style switcher */}
        <div style={{ display:'flex', gap:2, ...panelBase, borderRadius:10, padding:3 }}>
          {Object.entries(MAP_STYLES).map(([key, s]) => (
            <button key={key} onClick={() => changeStyle(key)} title={s.label}
              style={{ padding:'5px 10px', borderRadius:7, border:'none', cursor:'pointer', fontSize:14,
                background: mapStyle === key ? 'rgba(99,102,241,0.4)' : 'transparent',
                boxShadow: mapStyle === key ? '0 0 10px rgba(99,102,241,0.5)' : 'none',
                transition:'all 0.2s', color: mapStyle === key ? '#a5b4fc' : 'rgba(255,255,255,0.5)' }}>
              {s.icon}
            </button>
          ))}
        </div>

        {/* Layers */}
        <button onClick={() => setShowLayers(s => !s)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 13px', ...panelBase, color: showLayers ? '#a5b4fc' : 'rgba(255,255,255,0.5)', border: showLayers ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(99,102,241,0.18)', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:700, background: showLayers ? 'rgba(99,102,241,0.15)' : undefined }}>
          <Layers style={{ width:14, height:14 }}/> Layers
        </button>

        {/* Patrol */}
        <button onClick={() => { setPatrolMode(p => !p); if (!patrolMode) setPatrolPoints([]) }}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 13px', ...panelBase, color: patrolMode ? '#fbbf24' : 'rgba(255,255,255,0.5)', border: patrolMode ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(99,102,241,0.18)', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:700, background: patrolMode ? 'rgba(245,158,11,0.12)' : undefined }}>
          <Route style={{ width:14, height:14 }}/> {patrolMode ? `Route (${patrolPoints.length})` : 'Route'}
        </button>

        {/* 3D */}
        <button onClick={toggle3D}
          style={{ padding:'7px 16px', ...panelBase, color: is3D ? '#a5b4fc' : 'rgba(255,255,255,0.5)', border: is3D ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(99,102,241,0.18)', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:900, letterSpacing:'0.08em', background: is3D ? 'rgba(99,102,241,0.2)' : undefined, boxShadow: is3D ? '0 0 16px rgba(99,102,241,0.3)' : undefined }}>
          {is3D ? '3D ✦' : '2D'}
        </button>

        {/* Add Site */}
        <button onClick={() => { setCreateSiteMode(m => { const next=!m; createSiteModeRef.current=next; return next }) }}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 13px', ...panelBase, color: createSiteMode ? '#4ade80' : 'rgba(255,255,255,0.5)', border: createSiteMode ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(99,102,241,0.18)', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:700, background: createSiteMode ? 'rgba(34,197,94,0.1)' : undefined }}>
          <MapPin style={{ width:13, height:13 }}/> {createSiteMode ? 'Click map…' : 'Add Site'}
        </button>

        {/* Log Obs */}
        <button onClick={() => setShowForm(true)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', background:'linear-gradient(135deg,#6366f1,#14b8a6)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:800, marginLeft:'auto', boxShadow:'0 0 20px rgba(99,102,241,0.4)', letterSpacing:'0.02em' }}>
          <Plus style={{ width:13, height:13 }}/> Log Observation
        </button>
      </div>

      {/* ── Layer panel ── */}
      {showLayers && (
        <div style={{ position:'absolute', top:60, right:16, zIndex:40, ...panelBase, borderRadius:14, padding:16, minWidth:210, color:'#e2e8f0' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#a5b4fc', marginBottom:12, letterSpacing:'0.08em' }}>MAP LAYERS</div>
          {[
            { key:'heatmap', label:'Risk Heatmap', icon:'🔥' },
            { key:'alertZones', label:'Alert Zones', icon:'⚠️' },
          ].map(l => (
            <label key={l.key} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, cursor:'pointer', fontSize:12, fontWeight:600 }}>
              <div onClick={() => setLayers(prev => ({ ...prev, [l.key]: !prev[l.key] }))}
                style={{ width:32, height:18, borderRadius:9, background: layers[l.key] ? '#6366f1' : 'rgba(255,255,255,0.1)', position:'relative', cursor:'pointer', transition:'all 0.2s', border:'1px solid rgba(99,102,241,0.3)' }}>
                <div style={{ width:14, height:14, borderRadius:'50%', background:'white', position:'absolute', top:1, left: layers[l.key] ? 16 : 2, transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }}/>
              </div>
              {l.icon} {l.label}
            </label>
          ))}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:10, marginTop:4 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#a5b4fc', marginBottom:8, letterSpacing:'0.08em' }}>FILTER STATUS</div>
            {['all','active','warning','critical','inactive'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'5px 8px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, marginBottom:3,
                  background: statusFilter === s ? 'rgba(99,102,241,0.2)' : 'transparent',
                  color: statusFilter === s ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
                  borderLeft: statusFilter === s ? '2px solid #6366f1' : '2px solid transparent' }}>
                {s === 'all' ? '🌐 All' : s === 'active' ? '🟢 Active' : s === 'warning' ? '🟡 Warning' : s === 'critical' ? '🔴 Critical' : '⚫ Inactive'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Map + panel ── */}
      <div style={{ display:'flex', gap:12, flex:1, minHeight:0 }}>

        {/* Map */}
        <div style={{ flex:1, borderRadius:18, overflow:'hidden', position:'relative', boxShadow:'0 0 0 1px rgba(99,102,241,0.2), 0 8px 40px rgba(0,0,0,0.5)' }}>
          <div ref={mapContainer} style={{ width:'100%', height:'100%' }}/>

          {/* Corner scan lines */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:5,
            background:'linear-gradient(to bottom, rgba(99,102,241,0.03) 0%, transparent 15%, transparent 85%, rgba(99,102,241,0.05) 100%)' }}/>

          {/* Patrol banner */}
          {patrolMode && (
            <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', zIndex:20,
              background:'rgba(245,158,11,0.92)', backdropFilter:'blur(8px)', color:'white',
              padding:'8px 20px', borderRadius:20, fontSize:12, fontWeight:700,
              boxShadow:'0 4px 20px rgba(245,158,11,0.5)', display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap' }}>
              🗺️ Route Planning — click to add waypoints {patrolPoints.length > 0 && `(${patrolPoints.length})`}
              {patrolPoints.length > 0 && (
                <button onClick={() => { setPatrolPoints([]); map.current?.getSource('patrol')?.setData({type:'Feature',geometry:{type:'LineString',coordinates:[]}}) }}
                  style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'white', borderRadius:8, padding:'2px 8px', cursor:'pointer', fontSize:11 }}>Clear</button>
              )}
            </div>
          )}

          {/* Create site banner */}
          {createSiteMode && (
            <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', zIndex:20,
              background:'rgba(34,197,94,0.9)', backdropFilter:'blur(8px)', color:'white',
              padding:'8px 20px', borderRadius:20, fontSize:12, fontWeight:700,
              boxShadow:'0 4px 20px rgba(34,197,94,0.5)', display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap' }}>
              📍 Click map to place new monitoring site
              <button onClick={() => { setCreateSiteMode(false); createSiteModeRef.current = false }}
                style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'white', borderRadius:8, padding:'2px 8px', cursor:'pointer', fontSize:11 }}>Cancel</button>
            </div>
          )}

          {/* Legend */}
          <div style={{ position:'absolute', bottom:40, left:12, zIndex:10, ...panelBase, borderRadius:12, padding:'10px 14px', fontSize:11 }}>
            <div style={{ fontWeight:800, color:'rgba(255,255,255,0.7)', marginBottom:7, letterSpacing:'0.06em', fontSize:10 }}>SITE STATUS</div>
            {Object.entries(STATUS_COLORS).map(([s, c]) => (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4, color:'rgba(255,255,255,0.6)', textTransform:'capitalize', fontSize:11, fontWeight:600 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:c, boxShadow:`0 0 8px ${c}` }}/>
                {s} {s === 'critical' && criticalCount > 0 && <span style={{ color:c, fontWeight:900 }}>({criticalCount})</span>}
              </div>
            ))}
            {layers.heatmap && (
              <div style={{ marginTop:7, paddingTop:7, borderTop:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:700 }}>
                🔥 Heatmap = risk intensity
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div style={{ width:300, display:'flex', flexDirection:'column', gap:10, overflow:'hidden' }}>
          {selected ? (
            <div style={{ flex:1, overflow:'auto', ...panelBase, borderRadius:16, scrollbarWidth:'none' }}>
              {/* Header */}
              <div style={{ padding:'16px', background:'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(20,184,166,0.12))', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:900, color:'#e2e8f0', lineHeight:1.3 }}>{selected.name}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginTop:3 }}>📍 {selected.location_name}</div>
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    {user?.is_admin && (
                      <button onClick={async () => { if (!confirm('Delete this site?')) return; await api.delete(`/sites/${selected.id}`).catch(()=>{}); setSites(s => s.filter(x=>x.id!==selected.id)); setSelected(null) }}
                        style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', cursor:'pointer', color:'#f87171', padding:'4px 8px', borderRadius:6, fontSize:10, fontWeight:700 }}>
                        Delete
                      </button>
                    )}
                    <button onClick={() => setSelected(null)} style={{ background:'rgba(255,255,255,0.06)', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.5)', padding:'4px 6px', borderRadius:6 }}>
                      <X style={{ width:13, height:13 }}/>
                    </button>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:800, letterSpacing:'0.06em',
                    background: `${STATUS_COLORS[selected.status || 'active']}18`,
                    border: `1px solid ${STATUS_COLORS[selected.status || 'active']}40`,
                    color: STATUS_COLORS[selected.status || 'active'] }}>
                    <div style={{ width:5, height:5, borderRadius:'50%', background: STATUS_COLORS[selected.status || 'active'],
                      animation: selected.status !== 'inactive' ? 'glow-breathe 1.5s infinite' : 'none' }}/>
                    {(selected.status || 'active').toUpperCase()}
                  </div>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:600 }}>{observations.length} OBS</span>
                  {selected.body_of_water && <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:600 }}>💧 {selected.body_of_water}</span>}
                </div>

                {/* ── REAL ML PREDICTIONS ── */}
                {mlLoading ? (
                  <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(99,102,241,0.1)', borderRadius:8, textAlign:'center', fontSize:10, color:'#818cf8', fontWeight:600 }}>
                    🤖 Analyzing with real ML models…
                  </div>
                ) : mlPredictions && !mlPredictions.error ? (
                  <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(20,184,166,0.08)', border:'1px solid rgba(20,184,166,0.2)', borderRadius:8 }}>
                    <div style={{ fontSize:9, fontWeight:800, color:'rgba(20,184,166,1)', letterSpacing:'0.06em', marginBottom:6 }}>🤖 ML PREDICTIONS</div>
                    
                    {/* Risk Score */}
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, padding:'4px 8px', background:'rgba(255,255,255,0.04)', borderRadius:6 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', fontWeight:700 }}>Risk Score</div>
                        <div style={{ fontSize:12, fontWeight:900, color: mlPredictions.risk_score > 0.7 ? '#ef4444' : mlPredictions.risk_score > 0.4 ? '#f59e0b' : '#22c55e' }}>
                          {(mlPredictions.risk_score * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div style={{ width:40, height:24, background:'rgba(255,255,255,0.05)', borderRadius:4, overflow:'hidden', position:'relative' }}>
                        <div style={{ position:'absolute', height:'100%', width:`${mlPredictions.risk_score * 100}%`, background: mlPredictions.risk_score > 0.7 ? '#ef4444' : mlPredictions.risk_score > 0.4 ? '#f59e0b' : '#22c55e', transition:'width 0.5s' }}/>
                      </div>
                    </div>

                    {/* Anomalies */}
                    {mlPredictions.anomalies && mlPredictions.anomalies.length > 0 && (
                      <div style={{ marginBottom:6, padding:'4px 8px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:6 }}>
                        <div style={{ fontSize:8, color:'#ef4444', fontWeight:800, marginBottom:3 }}>⚠️ ANOMALIES DETECTED</div>
                        <div style={{ fontSize:9, color:'rgba(239,68,68,0.8)' }}>
                          {mlPredictions.anomalies.slice(0,2).map((a, i) => (
                            <div key={i} style={{ marginBottom:2 }}>• {typeof a === 'string' ? a : (a.parameter || 'Value') + ' anomaly'}</div>
                          ))}
                          {mlPredictions.anomalies.length > 2 && <div style={{ fontSize:8, color:'rgba(239,68,68,0.6)', marginTop:2 }}>+{mlPredictions.anomalies.length - 2} more</div>}
                        </div>
                      </div>
                    )}

                    {/* Quality Assessment */}
                    {mlPredictions.quality_assessment && (
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', padding:'4px 8px', background:'rgba(255,255,255,0.03)', borderRadius:6 }}>
                        <strong style={{ color:'rgba(255,255,255,0.6)' }}>Assessment:</strong> {mlPredictions.quality_assessment}
                      </div>
                    )}

                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.25)', marginTop:4, fontStyle:'italic' }}>
                      {mlPredictions.ml_model}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Latest readings */}
              {latestObs ? (
                <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)' }}>LATEST READING</span>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.25)', fontWeight:600 }}>{new Date(latestObs.collected_at).toLocaleDateString()}</span>
                  </div>
                  {Object.keys(WHO).map(param => latestObs[param] ? <ParamGauge key={param} param={param} value={latestObs[param]}/> : null)}
                </div>
              ) : (
                <div style={{ padding:'16px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:12 }}>
                  No readings yet
                </div>
              )}

              {/* pH trend */}
              {phTrend.length >= 3 && (
                <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em' }}>pH TREND</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:600, marginTop:2 }}>Last {phTrend.length} samples</div>
                  </div>
                  <Sparkline data={phTrend} color="#818cf8"/>
                </div>
              )}

              {/* Recent observations */}
              <div style={{ padding:'10px 14px' }}>
                <div style={{ fontSize:9, fontWeight:800, letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)', marginBottom:10 }}>RECENT OBSERVATIONS</div>
                {observations.length === 0 ? (
                  <div style={{ textAlign:'center', padding:20, color:'rgba(255,255,255,0.25)', fontSize:12 }}>No observations yet 🌊</div>
                ) : observations.slice(0,4).map(obs => (
                  <div key={obs.id} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'8px 10px', marginBottom:6, border:'1px solid rgba(255,255,255,0.05)', fontSize:11 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontWeight:700, color:'rgba(255,255,255,0.75)' }}>{obs.sampler_name || obs.display_name || 'Anonymous'}</span>
                      <span style={{ color:'rgba(255,255,255,0.25)', fontSize:10 }}>{new Date(obs.collected_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {['ph','temperature','dissolved_oxygen','turbidity'].filter(p => obs[p]).map(p => {
                        const status = whoStatus(p, parseFloat(obs[p]))
                        return (
                          <span key={p} style={{ padding:'2px 8px', borderRadius:20, background:`${status?.color || '#6366f1'}18`, color: status?.color || '#818cf8', fontWeight:700, fontSize:10, border:`1px solid ${status?.color || '#6366f1'}30` }}>
                            {WHO[p].emoji} {obs[p]}{WHO[p].unit}
                          </span>
                        )
                      })}
                    </div>
                    {obs.notes && <div style={{ marginTop:5, color:'rgba(255,255,255,0.3)', fontStyle:'italic', fontSize:10 }}>"{obs.notes}"</div>}
                  </div>
                ))}
                <button onClick={() => { setForm(f => ({ ...f, site_id: selected.id })); setShowForm(true) }}
                  style={{ width:'100%', padding:'9px 0', background:'linear-gradient(135deg,#6366f1,#14b8a6)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:800, marginTop:6, boxShadow:'0 4px 16px rgba(99,102,241,0.3)' }}>
                  <Plus style={{ width:11, height:11, display:'inline', marginRight:5 }}/>Add Observation
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Overview */}
              <div style={{ ...panelBase, borderRadius:14, padding:16 }}>
                <div style={{ fontSize:11, fontWeight:900, color:'#a5b4fc', marginBottom:4, letterSpacing:'0.06em' }}>🌊 WATER RANGER MAP</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', lineHeight:1.7, marginBottom:14 }}>
                  {sites.length} monitoring sites across Algoma region. Click any marker to view live readings.
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { icon:'📡', val: sites.length, label:'Total',    color:'#818cf8' },
                    { icon:'✅', val: activeCount,   label:'Active',   color:'#4ade80' },
                    { icon:'⚠️', val: warningCount,  label:'Warning',  color:'#fbbf24' },
                    { icon:'🚨', val: criticalCount, label:'Critical', color:'#f87171' },
                  ].map(s => (
                    <div key={s.label} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 12px', textAlign:'center', border:`1px solid ${s.color}20`, boxShadow: s.val > 0 ? `0 0 12px ${s.color}10` : 'none' }}>
                      <div style={{ fontSize:18, marginBottom:2 }}>{s.icon}</div>
                      <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.val}</div>
                      <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', fontWeight:700, letterSpacing:'0.06em' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...panelBase, borderRadius:14, padding:'12px 14px', flex:1, overflow:'auto', scrollbarWidth:'none' }}>
                <div style={{ fontSize:9, fontWeight:800, letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)', marginBottom:10 }}>ALL MONITORING SITES</div>
                {sites.map(site => (
                  <div key={site.id} onClick={() => {
                    setSelected(site)
                    api.get(`/sites/${site.id}/observations`).then(r => setObservations(r.data.observations || [])).catch(() => {})
                    map.current?.flyTo({ center:[site.longitude, site.latitude], zoom:13, speed:1.4, pitch: is3D ? 55 : 35, duration:1200 })
                  }}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, cursor:'pointer', marginBottom:4,
                      transition:'all 0.15s', border:'1px solid transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(99,102,241,0.1)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.25)' }}
                    onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background: STATUS_COLORS[site.status||'active'], boxShadow:`0 0 8px ${STATUS_COLORS[site.status||'active']}` }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.8)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{site.name}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{site.location_name}</div>
                    </div>
                    <ChevronDown style={{ width:11, height:11, color:'rgba(255,255,255,0.25)', transform:'rotate(-90deg)', flexShrink:0 }}/>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Observation Form Modal ── */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && (setShowForm(false), setClickedPos(null))}>
          <div style={{ ...panelBase, borderRadius:20, width:'100%', maxWidth:560, overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', background:'linear-gradient(135deg,#6366f1,#14b8a6)' }}>
              <h2 style={{ color:'white', fontWeight:900, fontSize:15, margin:0, letterSpacing:'0.02em' }}>💧 Log Water Observation</h2>
              <button onClick={() => { setShowForm(false); setClickedPos(null) }} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'white', width:28, height:28, borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X style={{ width:13, height:13 }}/>
              </button>
            </div>
            <form onSubmit={submit} style={{ padding:20, maxHeight:'72vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
              {clickedPos && (
                <div style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#fbbf24' }}>
                  📍 ({clickedPos.lat.toFixed(4)}, {clickedPos.lng.toFixed(4)}) — auto-assigns to nearest site
                </div>
              )}
              <div>
                <label style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:4, letterSpacing:'0.07em' }}>MONITORING SITE</label>
                <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} required={!clickedPos}
                  style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:9, fontSize:13, color:'#e2e8f0', outline:'none' }}>
                  <option value="">Select a site…</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name} — {s.location_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:4, letterSpacing:'0.07em' }}>YOUR NAME (OPTIONAL)</label>
                <input value={form.sampler_name} onChange={e => setForm(f => ({ ...f, sampler_name: e.target.value }))} placeholder="e.g. Jane Smith"
                  style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:9, fontSize:13, color:'#e2e8f0', outline:'none' }}/>
              </div>
              <div style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.4)', letterSpacing:'0.07em' }}>WATER QUALITY PARAMETERS</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { k:'ph', label:'🧪 pH', ph:'7.2', who:'6.5–8.5' },
                  { k:'temperature', label:'🌡️ Temp °C', ph:'15', who:'<25°C' },
                  { k:'dissolved_oxygen', label:'💨 DO mg/L', ph:'8.5', who:'>6 mg/L' },
                  { k:'turbidity', label:'🌊 Turbidity NTU', ph:'2.1', who:'<5 NTU' },
                  { k:'conductivity', label:'⚡ Conductivity µS/cm', ph:'450', who:'<1500' },
                  { k:'nitrates', label:'🌿 Nitrates mg/L', ph:'3.2', who:'<10 mg/L' },
                ].map(({ k, label, ph, who }) => (
                  <div key={k}>
                    <label style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)', display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span>{label}</span><span style={{ color:'#818cf8' }}>{who}</span>
                    </label>
                    <input type="number" step="0.01" placeholder={ph} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                      style={{ width:'100%', padding:'8px 10px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:9, fontSize:13, color:'#e2e8f0', outline:'none' }}/>
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:4, letterSpacing:'0.07em' }}>WEATHER</label>
                <input value={form.weather_conditions} onChange={e => setForm(f => ({ ...f, weather_conditions: e.target.value }))} placeholder="Clear, 18°C, light wind"
                  style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:9, fontSize:13, color:'#e2e8f0', outline:'none' }}/>
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:4, letterSpacing:'0.07em' }}>FIELD NOTES</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Unusual colours, odours, wildlife…"
                  style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:9, fontSize:13, color:'#e2e8f0', outline:'none', resize:'none' }}/>
              </div>
              <div style={{ display:'flex', gap:8, paddingTop:4 }}>
                <button type="button" onClick={() => { setShowForm(false); setClickedPos(null) }}
                  style={{ flex:1, padding:'10px 0', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.5)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  style={{ flex:2, padding:'10px 0', background:'linear-gradient(135deg,#6366f1,#14b8a6)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:800, opacity: submitting ? 0.6 : 1, boxShadow:'0 4px 20px rgba(99,102,241,0.4)' }}>
                  {submitting ? 'Submitting…' : '💧 Submit (+15 pts)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create Site Modal ── */}
      {showCreateSite && createSitePos && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && setShowCreateSite(false)}>
          <div style={{ ...panelBase, borderRadius:20, width:'100%', maxWidth:580, boxShadow:'0 24px 64px rgba(0,0,0,0.6)', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', background:'linear-gradient(135deg,#22c55e,#16a34a)' }}>
              <div>
                <h2 style={{ color:'white', fontWeight:900, fontSize:15, margin:0 }}>🗺️ Create Monitoring Site</h2>
                <div style={{ color:'rgba(255,255,255,0.7)', fontSize:11, marginTop:2 }}>📍 {createSitePos.lat.toFixed(5)}, {createSitePos.lng.toFixed(5)}</div>
              </div>
              <button onClick={() => setShowCreateSite(false)} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'white', width:30, height:30, borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X style={{ width:13, height:13 }}/>
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
                alert(`✅ Site "${newSite.name}" created!`)
              } catch(err) { alert('Failed: ' + (err.response?.data?.error || err.message)) }
              finally { setSiteSubmitting(false) }
            }} style={{ padding:20, maxHeight:'72vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  { span:true, key:'name', label:'SITE NAME *', placeholder:'e.g. Sault Ste. Marie River Inlet', required:true },
                  { key:'body_of_water', label:'BODY OF WATER *', placeholder:'e.g. St. Marys River', required:true },
                  { key:'organization', label:'ORGANIZATION', placeholder:'e.g. NORDIK Institute' },
                  { key:'community', label:'COMMUNITY', placeholder:'e.g. Algoma District' },
                ].map(({ span, key, label, placeholder, required }) => (
                  <div key={key} style={{ gridColumn: span ? '1/-1' : undefined }}>
                    <label style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.35)', display:'block', marginBottom:4, letterSpacing:'0.07em' }}>{label}</label>
                    <input required={required} value={siteForm[key]} onChange={e => setSiteForm(f=>({...f,[key]:e.target.value}))} placeholder={placeholder}
                      style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:9, fontSize:13, color:'#e2e8f0', outline:'none', boxSizing:'border-box' }}/>
                  </div>
                ))}
                <div>
                  <label style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.35)', display:'block', marginBottom:4, letterSpacing:'0.07em' }}>WATER TYPE</label>
                  <select value={siteForm.water_body_type} onChange={e => setSiteForm(f=>({...f,water_body_type:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:9, fontSize:13, color:'#e2e8f0', outline:'none' }}>
                    {['lake','river','stream','wetland','reservoir','coastal','groundwater','other'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.35)', display:'block', marginBottom:4, letterSpacing:'0.07em' }}>ACCESS RISK</label>
                  <select value={siteForm.access_risk} onChange={e => setSiteForm(f=>({...f,access_risk:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:9, fontSize:13, color:'#e2e8f0', outline:'none' }}>
                    {['Low','Moderate','High','Very High'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.35)', display:'block', marginBottom:4, letterSpacing:'0.07em' }}>DESCRIPTION</label>
                  <textarea rows={2} value={siteForm.description} onChange={e => setSiteForm(f=>({...f,description:e.target.value}))} placeholder="Describe the location, access, notable features…"
                    style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:9, fontSize:13, color:'#e2e8f0', outline:'none', resize:'none', boxSizing:'border-box' }}/>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.35)', display:'block', marginBottom:4, letterSpacing:'0.07em' }}>REFERENCE PHOTO</label>
                  <label style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:9, border:'1.5px dashed rgba(255,255,255,0.15)', cursor:'pointer', fontSize:12, color:'rgba(255,255,255,0.4)', background:'rgba(255,255,255,0.03)' }}>
                    📷 {sitePhoto ? sitePhoto.name : 'Choose photo (optional)'}
                    <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => setSitePhoto(e.target.files?.[0] || null)}/>
                  </label>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, paddingTop:4 }}>
                <button type="button" onClick={() => setShowCreateSite(false)}
                  style={{ flex:1, padding:'10px 0', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.5)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={siteSubmitting}
                  style={{ flex:2, padding:'10px 0', background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'white', border:'none', borderRadius:10, cursor:siteSubmitting?'not-allowed':'pointer', fontSize:13, fontWeight:800, opacity: siteSubmitting ? 0.6 : 1, boxShadow:'0 4px 16px rgba(34,197,94,0.3)' }}>
                  {siteSubmitting ? 'Creating…' : '🗺️ Create My Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
