import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import PageAmbience from '../components/layout/PageAmbience'
import api from '../utils/api'
import {
  MapPin,
  AlertTriangle,
  TrendingUp,
  Activity,
  Shield,
  Waves,
  CalendarDays,
  FlaskConical,
  X,
} from 'lucide-react'

const MAP_STYLE = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
    },
  },
  layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
}

const STATUS_COLORS = {
  active: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  inactive: '#94a3b8',
}

const RISK_COLORS = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
}

const PARAMS = [
  { key: 'ph', label: 'pH', unit: '' },
  { key: 'turbidity', label: 'Turbidity', unit: ' NTU' },
  { key: 'temperature', label: 'Temp', unit: ' C' },
  { key: 'dissolved_oxygen', label: 'DO', unit: ' mg/L' },
  { key: 'conductivity', label: 'Conductivity', unit: ' uS/cm' },
]

const MAP_CSS = `
  .sw-map-wrap { height: calc(100vh - 106px); min-height: 680px; }
  .sw-map-canvas .maplibregl-popup-content {
    background: #0f172a;
    color: #e2e8f0;
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 10px;
    box-shadow: 0 10px 24px rgba(0,0,0,0.35);
  }
  .sw-map-canvas .maplibregl-popup-tip { border-top-color: #0f172a !important; }
  .sw-card {
    background: rgba(15, 23, 42, 0.88);
    border: 1px solid rgba(148, 163, 184, 0.22);
    box-shadow: 0 8px 24px rgba(2, 6, 23, 0.35);
    backdrop-filter: blur(12px);
  }
  .sw-chip {
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: rgba(30, 41, 59, 0.8);
  }
`

function riskBand(score) {
  const n = Number(score || 0)
  if (n >= 0.7) return 'high'
  if (n >= 0.4) return 'medium'
  return 'low'
}

function statusBand(status) {
  if (!status) return 'active'
  const s = String(status).toLowerCase()
  if (s.includes('crit')) return 'critical'
  if (s.includes('warn') || s.includes('watch')) return 'warning'
  if (s.includes('inactive')) return 'inactive'
  return 'active'
}

function formatDate(value) {
  if (!value) return 'Unknown'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleDateString()
}

function getObsTime(obs) {
  return obs?.collected_at || obs?.observed_at || obs?.created_at || null
}

function recencyBand(daysOld) {
  if (daysOld <= 2) return 'fresh'
  if (daysOld <= 14) return 'recent'
  return 'stale'
}

function calcDaysOld(ts) {
  if (!ts) return 9999
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 9999
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function computeTrend(observations, key) {
  const values = observations
    .map((o) => Number(o?.[key]))
    .filter((v) => Number.isFinite(v))
    .slice(0, 8)
    .reverse()

  if (values.length < 3) return { direction: 'insufficient', delta: 0 }
  const start = values[0]
  const end = values[values.length - 1]
  const delta = end - start
  if (Math.abs(delta) < 0.12) return { direction: 'stable', delta }
  return { direction: delta > 0 ? 'up' : 'down', delta }
}

function parameterSummary(obs) {
  if (!obs) return []
  return PARAMS.map((p) => {
    const raw = obs[p.key]
    if (raw === null || raw === undefined || raw === '') return null
    const num = Number(raw)
    if (!Number.isFinite(num)) return null
    return { ...p, value: num }
  }).filter(Boolean)
}

function createSiteFeature(site) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [site.longitude, site.latitude] },
    properties: {
      id: site.id,
      source_type: 'site',
      name: site.name || 'Monitoring Site',
      organization: site.organization || 'Source Water',
      status: statusBand(site.status),
      water_body: site.body_of_water || site.location_name || '',
      latitude: site.latitude,
      longitude: site.longitude,
      weight: site.status === 'critical' ? 1 : site.status === 'warning' ? 0.6 : 0.35,
    },
  }
}

function createCommunityFeature(row) {
  const enrichment = row.ai_enrichment || {}
  const risk = Number(enrichment.ai_risk_score || 0)
  const risk_level = riskBand(risk)
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
    properties: {
      id: row.id,
      source_type: 'community',
      name: row.site_name || 'Community Site',
      organization: row.organization || 'Community',
      status: risk_level === 'high' ? 'critical' : risk_level === 'medium' ? 'warning' : 'active',
      risk_score: risk,
      risk_level,
      satellite_validation: enrichment.satellite_validation || 'unknown',
      anomaly_flag: enrichment.anomaly_flag ? 'true' : 'false',
      trend_prediction: enrichment.trend_prediction || 'monitoring advised',
      summary_message: enrichment.summary_message || 'Community observation available',
      timestamp: row.timestamp || '',
      weight: risk_level === 'high' ? 1 : risk_level === 'medium' ? 0.65 : 0.3,
    },
  }
}

export default function MapPage() {
  const mapRef = useRef(null)
  const mapContainerRef = useRef(null)
  const popupRef = useRef(null)

  const [mapReady, setMapReady] = useState(false)
  const [sites, setSites] = useState([])
  const [communityRows, setCommunityRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [siteObservations, setSiteObservations] = useState([])
  const [siteIntelligence, setSiteIntelligence] = useState(null)
  const [siteIntelligenceLoading, setSiteIntelligenceLoading] = useState(false)

  const [filters, setFilters] = useState({
    source: 'all',
    status: 'all',
    parameter: 'all',
    dateRange: '365',
    recency: 'all',
    alertLevel: 'all',
  })

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [-84.3, 46.5],
      zoom: 6.4,
      pitch: 0,
      bearing: 0,
      antialias: true,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    map.on('load', () => {
      setMapReady(true)
    })

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['sites-points', 'community-points', 'sites-clusters', 'community-clusters'],
      })
      if (!features.length) return

      const f = features[0]
      const layerId = f.layer?.id || ''
      if (layerId.endsWith('clusters')) {
        const source = layerId.startsWith('community') ? 'community-src' : 'sites-src'
        const clusterId = f.properties?.cluster_id
        map.getSource(source)?.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return
          map.easeTo({ center: f.geometry.coordinates, zoom: zoom + 1, duration: 700 })
        })
        return
      }

      const sourceType = f.properties?.source_type
      if (sourceType === 'site') {
        const site = sites.find((s) => String(s.id) === String(f.properties?.id))
        if (site) {
          setSelected({ type: 'site', payload: site })
          map.easeTo({ center: [site.longitude, site.latitude], zoom: Math.max(map.getZoom(), 11), duration: 650 })
        }
      } else {
        const row = communityRows.find((r) => String(r.id) === String(f.properties?.id))
        if (row) {
          setSelected({ type: 'community', payload: row })
          map.easeTo({ center: [row.lon, row.lat], zoom: Math.max(map.getZoom(), 11), duration: 650 })
        }
      }
    })

    map.on('mousemove', (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['sites-points', 'community-points', 'sites-clusters', 'community-clusters'],
      })
      map.getCanvas().style.cursor = features.length ? 'pointer' : ''

      const top = features[0]
      if (!top || !top.layer?.id.endsWith('points')) {
        popupRef.current?.remove()
        popupRef.current = null
        return
      }

      const html = top.properties?.source_type === 'site'
        ? `<div style="min-width:200px"><div style="font-weight:800;font-size:12px">${top.properties?.name || 'Site'}</div><div style="font-size:10px;color:#94a3b8">${top.properties?.organization || ''}</div><div style="margin-top:6px;font-size:10px">Status: <strong>${top.properties?.status || 'active'}</strong></div></div>`
        : `<div style="min-width:220px"><div style="font-weight:800;font-size:12px">${top.properties?.name || 'Community Site'}</div><div style="font-size:10px;color:#94a3b8">${top.properties?.organization || ''}</div><div style="margin-top:6px;font-size:10px">AI Risk: <strong>${Math.round((Number(top.properties?.risk_score || 0)) * 100)}%</strong></div><div style="font-size:10px">Satellite: <strong>${top.properties?.satellite_validation || 'unknown'}</strong></div></div>`

      popupRef.current?.remove()
      popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
        .setLngLat(top.geometry.coordinates)
        .setHTML(html)
        .addTo(map)
    })

    mapRef.current = map
    return () => {
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [sites, communityRows])

  useEffect(() => {
    api.get('/sites')
      .then((r) => {
        const rows = Array.isArray(r.data) ? r.data : (r.data?.sites || [])
        setSites(rows)
      })
      .catch((err) => {
        console.error('[MapPage] sites load failed', err)
        setSites([])
      })

    api.get('/geoai/community-observations', {
      params: { include_enrichment: true, limit: 700 },
    })
      .then((r) => {
        const rows = Array.isArray(r.data?.data) ? r.data.data : []
        setCommunityRows(rows)
      })
      .catch((err) => {
        console.error('[MapPage] community load failed', err)
        setCommunityRows([])
      })
  }, [])

  useEffect(() => {
    if (!selected || selected.type !== 'site') {
      setSiteObservations([])
      setSiteIntelligence(null)
      return
    }

    const site = selected.payload
    api.get(`/sites/${site.id}/observations`)
      .then((r) => setSiteObservations(Array.isArray(r.data?.observations) ? r.data.observations : []))
      .catch(() => setSiteObservations([]))

    setSiteIntelligenceLoading(true)
    api.post(`/ai/predict/${site.id}`)
      .then((r) => setSiteIntelligence(r.data || null))
      .catch(() => setSiteIntelligence(null))
      .finally(() => setSiteIntelligenceLoading(false))
  }, [selected])

  const cutoffDate = useMemo(() => {
    const days = Number(filters.dateRange)
    if (!Number.isFinite(days) || days <= 0) return null
    return Date.now() - days * 86400000
  }, [filters.dateRange])

  const filteredCommunity = useMemo(() => {
    return communityRows.filter((row) => {
      if (filters.source === 'sites') return false

      const ts = new Date(row.timestamp || '').getTime()
      if (cutoffDate && Number.isFinite(ts) && ts < cutoffDate) return false

      const recency = recencyBand(calcDaysOld(row.timestamp))
      if (filters.recency !== 'all' && recency !== filters.recency) return false

      const risk = riskBand(row?.ai_enrichment?.ai_risk_score)
      if (filters.alertLevel !== 'all' && risk !== filters.alertLevel) return false

      if (filters.status !== 'all') {
        const mapped = risk === 'high' ? 'critical' : risk === 'medium' ? 'warning' : 'active'
        if (mapped !== filters.status) return false
      }

      if (filters.parameter !== 'all') {
        const val = row?.parameters?.[filters.parameter]
        if (val === null || val === undefined || val === '') return false
      }

      return true
    })
  }, [communityRows, cutoffDate, filters])

  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      if (filters.source === 'community') return false
      const status = statusBand(site.status)
      if (filters.status !== 'all' && status !== filters.status) return false
      if (filters.alertLevel !== 'all') {
        if (filters.alertLevel === 'high' && status !== 'critical') return false
        if (filters.alertLevel === 'medium' && status !== 'warning') return false
        if (filters.alertLevel === 'low' && status !== 'active') return false
      }
      return true
    })
  }, [sites, filters])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const siteData = {
      type: 'FeatureCollection',
      features: filteredSites.map(createSiteFeature),
    }

    const communityData = {
      type: 'FeatureCollection',
      features: filteredCommunity.map(createCommunityFeature),
    }

    const upsertSource = (name, data) => {
      if (map.getSource(name)) {
        map.getSource(name).setData(data)
      } else {
        map.addSource(name, {
          type: 'geojson',
          data,
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 10,
        })
      }
    }

    upsertSource('sites-src', siteData)
    upsertSource('community-src', communityData)

    const ensureLayer = (id, spec, before) => {
      if (map.getLayer(id)) return
      map.addLayer({ id, ...spec }, before)
    }

    ensureLayer('sites-clusters', {
      type: 'circle',
      source: 'sites-src',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#334155',
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 21, 30, 27],
        'circle-opacity': 0.88,
        'circle-stroke-color': '#f8fafc',
        'circle-stroke-width': 1.5,
      },
    })

    ensureLayer('sites-cluster-count', {
      type: 'symbol',
      source: 'sites-src',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 11,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: { 'text-color': '#f8fafc' },
    })

    ensureLayer('sites-points', {
      type: 'circle',
      source: 'sites-src',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 7.5,
        'circle-color': [
          'match',
          ['get', 'status'],
          'critical', STATUS_COLORS.critical,
          'warning', STATUS_COLORS.warning,
          'inactive', STATUS_COLORS.inactive,
          STATUS_COLORS.active,
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.8,
      },
    })

    ensureLayer('community-clusters', {
      type: 'circle',
      source: 'community-src',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#0f766e',
        'circle-radius': ['step', ['get', 'point_count'], 14, 8, 18, 20, 24],
        'circle-opacity': 0.84,
        'circle-stroke-color': '#ecfeff',
        'circle-stroke-width': 1.4,
      },
    })

    ensureLayer('community-cluster-count', {
      type: 'symbol',
      source: 'community-src',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 10,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: { 'text-color': '#f8fafc' },
    })

    ensureLayer('community-points', {
      type: 'circle',
      source: 'community-src',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 6.5,
        'circle-color': [
          'match',
          ['get', 'risk_level'],
          'high', RISK_COLORS.high,
          'medium', RISK_COLORS.medium,
          RISK_COLORS.low,
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.4,
        'circle-opacity': 0.95,
      },
    })
  }, [mapReady, filteredSites, filteredCommunity])

  const publicStats = useMemo(() => {
    const totalSites = filteredSites.length
    const totalCommunity = filteredCommunity.length
    const criticalSites = filteredSites.filter((s) => statusBand(s.status) === 'critical').length
    const mediumOrHighCommunity = filteredCommunity.filter((c) => riskBand(c?.ai_enrichment?.ai_risk_score) !== 'low').length
    return { totalSites, totalCommunity, criticalSites, mediumOrHighCommunity }
  }, [filteredSites, filteredCommunity])

  const selectedSite = selected?.type === 'site' ? selected.payload : null
  const selectedCommunity = selected?.type === 'community' ? selected.payload : null
  const latestSiteObservation = siteObservations[0] || null
  const siteParameterList = parameterSummary(latestSiteObservation)

  const siteTrends = useMemo(() => {
    if (!siteObservations.length) return []
    return ['ph', 'turbidity', 'dissolved_oxygen'].map((k) => ({ key: k, ...computeTrend(siteObservations, k) }))
  }, [siteObservations])

  return (
    <PageAmbience>
      <style>{MAP_CSS}</style>
      <div className="sw-map-wrap relative grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
        <div className="relative overflow-hidden rounded-2xl border border-slate-300/20 bg-slate-900/70">
          <div className="absolute left-3 right-3 top-3 z-20 rounded-xl px-3 py-2 sw-card">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-200">
              <span className="inline-flex items-center gap-1 font-semibold text-cyan-100">
                <Waves size={14} /> Great Lakes Monitoring Map
              </span>
              <span className="rounded-md px-2 py-1 sw-chip">Sites: {publicStats.totalSites}</span>
              <span className="rounded-md px-2 py-1 sw-chip">Community Points: {publicStats.totalCommunity}</span>
              <span className="rounded-md px-2 py-1 sw-chip">Critical Sites: {publicStats.criticalSites}</span>
              <span className="rounded-md px-2 py-1 sw-chip">Watchlist: {publicStats.mediumOrHighCommunity}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <select
                value={filters.source}
                onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
                className="rounded-md border border-slate-500/30 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-100"
              >
                <option value="all">All Sources</option>
                <option value="sites">Monitoring Sites</option>
                <option value="community">Community + AI</option>
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="rounded-md border border-slate-500/30 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-100"
              >
                <option value="all">All Status</option>
                <option value="active">Stable</option>
                <option value="warning">Watch</option>
                <option value="critical">Critical</option>
                <option value="inactive">Inactive</option>
              </select>

              <select
                value={filters.parameter}
                onChange={(e) => setFilters((f) => ({ ...f, parameter: e.target.value }))}
                className="rounded-md border border-slate-500/30 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-100"
              >
                <option value="all">All Parameters</option>
                {PARAMS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>

              <select
                value={filters.dateRange}
                onChange={(e) => setFilters((f) => ({ ...f, dateRange: e.target.value }))}
                className="rounded-md border border-slate-500/30 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-100"
              >
                <option value="30">Past 30 Days</option>
                <option value="90">Past 90 Days</option>
                <option value="365">Past 12 Months</option>
              </select>

              <select
                value={filters.recency}
                onChange={(e) => setFilters((f) => ({ ...f, recency: e.target.value }))}
                className="rounded-md border border-slate-500/30 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-100"
              >
                <option value="all">Any Recency</option>
                <option value="fresh">Fresh (0-2d)</option>
                <option value="recent">Recent (3-14d)</option>
                <option value="stale">Older (&gt;14d)</option>
              </select>

              <select
                value={filters.alertLevel}
                onChange={(e) => setFilters((f) => ({ ...f, alertLevel: e.target.value }))}
                className="rounded-md border border-slate-500/30 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-100"
              >
                <option value="all">All Priorities</option>
                <option value="low">Stable</option>
                <option value="medium">Watch</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

          <div ref={mapContainerRef} className="sw-map-canvas h-full w-full" />
        </div>

        <aside className="sw-card flex h-full min-h-[540px] flex-col overflow-hidden rounded-2xl">
          <div className="border-b border-slate-400/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-wide text-slate-100">Site Intelligence Panel</h2>
              {selected && (
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-md border border-slate-500/35 bg-slate-800/70 px-2 py-1 text-xs text-slate-200"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-300/80">
              Explore trusted monitoring data with AI-assisted risk and trend context.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {!selected && (
              <div className="space-y-3 text-sm text-slate-200">
                <div className="rounded-lg border border-slate-500/25 bg-slate-800/70 p-3">
                  <div className="mb-2 text-xs font-semibold tracking-wide text-cyan-200">How To Use</div>
                  <ul className="space-y-1 text-xs text-slate-300">
                    <li>1. Select a marker to inspect a site or community observation.</li>
                    <li>2. Use filters to focus by status, parameter, source, and recency.</li>
                    <li>3. Review trends, alerts, and AI/satellite cross-check insights.</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-500/25 bg-slate-800/70 p-3">
                  <div className="mb-2 text-xs font-semibold tracking-wide text-cyan-200">Legend</div>
                  <div className="space-y-1 text-xs text-slate-300">
                    <div><span className="font-semibold" style={{ color: STATUS_COLORS.active }}>Green</span> = Stable</div>
                    <div><span className="font-semibold" style={{ color: STATUS_COLORS.warning }}>Yellow</span> = Watch</div>
                    <div><span className="font-semibold" style={{ color: STATUS_COLORS.critical }}>Red</span> = High Priority</div>
                  </div>
                </div>
              </div>
            )}

            {selectedSite && (
              <div className="space-y-4 text-slate-100">
                <div className="rounded-lg border border-slate-500/25 bg-slate-800/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold">{selectedSite.name || 'Monitoring Site'}</h3>
                      <p className="mt-1 text-xs text-slate-300">
                        {selectedSite.body_of_water || selectedSite.location_name || 'Great Lakes Region'}
                      </p>
                      <p className="text-xs text-slate-400">{selectedSite.organization || 'Source Water'}</p>
                    </div>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-bold uppercase"
                      style={{
                        background: `${STATUS_COLORS[statusBand(selectedSite.status)]}22`,
                        color: STATUS_COLORS[statusBand(selectedSite.status)],
                        border: `1px solid ${STATUS_COLORS[statusBand(selectedSite.status)]}55`,
                      }}
                    >
                      {statusBand(selectedSite.status)}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-500/25 bg-slate-800/70 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-cyan-200">
                    <FlaskConical size={14} /> Latest Readings
                  </div>
                  {!latestSiteObservation && <div className="text-xs text-slate-400">No observations available.</div>}
                  {!!latestSiteObservation && (
                    <div className="grid grid-cols-2 gap-2">
                      {siteParameterList.map((p) => (
                        <div key={p.key} className="rounded-md border border-slate-500/25 bg-slate-900/45 px-2 py-1">
                          <div className="text-[10px] text-slate-400">{p.label}</div>
                          <div className="text-xs font-semibold text-slate-100">{p.value}{p.unit}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-500/25 bg-slate-800/70 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-cyan-200">
                    <TrendingUp size={14} /> Trend Summary
                  </div>
                  {siteTrends.length === 0 && <div className="text-xs text-slate-400">Insufficient history for trends.</div>}
                  {siteTrends.map((t) => (
                    <div key={t.key} className="mb-1 flex items-center justify-between text-xs">
                      <span className="uppercase tracking-wide text-slate-300">{t.key.replace('_', ' ')}</span>
                      <span className="font-semibold text-slate-100">
                        {t.direction === 'up' ? 'Rising' : t.direction === 'down' ? 'Falling' : t.direction === 'stable' ? 'Stable' : 'Insufficient'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-500/25 bg-slate-800/70 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-cyan-200">
                    <Shield size={14} /> AI Validation
                  </div>
                  {siteIntelligenceLoading && <div className="text-xs text-slate-400">Computing intelligence...</div>}
                  {!siteIntelligenceLoading && !siteIntelligence && (
                    <div className="text-xs text-slate-400">No AI validation available for this site.</div>
                  )}
                  {!siteIntelligenceLoading && siteIntelligence && (
                    <div className="space-y-1 text-xs text-slate-200">
                      <div>
                        Risk Score:{' '}
                        <strong>
                          {Math.round(Number(siteIntelligence.risk_score || siteIntelligence.ai_risk_score || 0) * 100)}%
                        </strong>
                      </div>
                      <div>
                        Alert State:{' '}
                        <strong>
                          {siteIntelligence.anomalies?.length ? 'Anomaly / Watch' : 'No major anomaly'}
                        </strong>
                      </div>
                      <div>
                        Monitoring Priority:{' '}
                        <strong>
                          {Number(siteIntelligence.risk_score || 0) >= 0.7 ? 'High' : Number(siteIntelligence.risk_score || 0) >= 0.4 ? 'Medium' : 'Routine'}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-500/25 bg-slate-800/70 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-cyan-200">
                    <CalendarDays size={14} /> Observation Timeline
                  </div>
                  <div className="space-y-2">
                    {siteObservations.slice(0, 8).map((o) => (
                      <div key={o.id} className="rounded-md border border-slate-500/20 bg-slate-900/45 px-2 py-1">
                        <div className="text-[10px] text-slate-400">{formatDate(getObsTime(o))}</div>
                        <div className="text-xs text-slate-200">
                          {['ph', 'turbidity', 'dissolved_oxygen'].map((k) => {
                            const v = o?.[k]
                            if (v === null || v === undefined || v === '') return null
                            return <span key={k} className="mr-2">{k}: <strong>{v}</strong></span>
                          })}
                        </div>
                      </div>
                    ))}
                    {siteObservations.length === 0 && <div className="text-xs text-slate-400">No timeline entries.</div>}
                  </div>
                </div>
              </div>
            )}

            {selectedCommunity && (
              <div className="space-y-4 text-slate-100">
                <div className="rounded-lg border border-slate-500/25 bg-slate-800/70 p-3">
                  <h3 className="text-sm font-bold">{selectedCommunity.site_name || 'Community Site'}</h3>
                  <p className="text-xs text-slate-300">{selectedCommunity.organization || 'Community Monitoring'}</p>
                  <p className="mt-1 text-xs text-slate-400">Observed: {formatDate(selectedCommunity.timestamp)}</p>
                </div>

                <div className="rounded-lg border border-slate-500/25 bg-slate-800/70 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-cyan-200">
                    <Activity size={14} /> Community Observation
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PARAMS.map((p) => {
                      const v = selectedCommunity?.parameters?.[p.key]
                      if (v === null || v === undefined || v === '') return null
                      return (
                        <div key={p.key} className="rounded-md border border-slate-500/25 bg-slate-900/45 px-2 py-1">
                          <div className="text-[10px] text-slate-400">{p.label}</div>
                          <div className="text-xs font-semibold text-slate-100">{v}{p.unit}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-500/25 bg-slate-800/70 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-cyan-200">
                    <Shield size={14} /> AI + Satellite Interpretation
                  </div>
                  <div className="space-y-1 text-xs text-slate-200">
                    <div>
                      AI Risk Score:{' '}
                      <strong style={{ color: RISK_COLORS[riskBand(selectedCommunity?.ai_enrichment?.ai_risk_score)] }}>
                        {Math.round(Number(selectedCommunity?.ai_enrichment?.ai_risk_score || 0) * 100)}%
                      </strong>
                    </div>
                    <div>
                      Anomaly Flag:{' '}
                      <strong>{selectedCommunity?.ai_enrichment?.anomaly_flag ? 'Yes' : 'No'}</strong>
                    </div>
                    <div>
                      Trend:{' '}
                      <strong>{selectedCommunity?.ai_enrichment?.trend_prediction || 'monitoring advised'}</strong>
                    </div>
                    <div>
                      Satellite Validation:{' '}
                      <strong>{selectedCommunity?.ai_enrichment?.satellite_validation || 'unknown'}</strong>
                    </div>
                  </div>
                  <div className="mt-2 rounded-md border border-slate-500/20 bg-slate-900/45 p-2 text-xs text-slate-300">
                    {selectedCommunity?.ai_enrichment?.summary_message || 'Community and intelligence summary unavailable.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </PageAmbience>
  )
}

