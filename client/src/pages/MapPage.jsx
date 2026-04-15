import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
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

// OSM base map center & zoom (Great Lakes region)
const MAP_CENTER = [45.5, -75.7]
const MAP_ZOOM = 6

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

const BASEMAPS = {
  light: {
    label: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  topo: {
    label: 'Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM | OpenTopoMap',
  },
}

const MAP_CSS = `
  .sw-map-wrap { 
    flex: 1;
    display: flex;
    gap: 0;
    overflow: hidden;
    background: white;
  }
  .map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #fff;
  }
  .leaflet-container {
    background: #fff;
    z-index: 1;
  }
  .leaflet-popup-content-wrapper { 
    border-radius: 8px;
    padding: 0;
  }
  .leaflet-popup-content { 
    margin: 0; 
    padding: 0;
    font-size: 14px;
  }
  .leaflet-popup-close-button {
    padding: 4px 8px;
  }
  .monitoring-point-icon {
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  }
  .sw-card {
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(15, 23, 42, 0.12);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.1);
  }
  .sw-chip {
    border: 1px solid rgba(15, 23, 42, 0.12);
    background: rgba(248, 250, 252, 0.98);
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

// Numbered marker styling for monitoring points
function createMonitoringIcon(number, isAI = false) {
  const bgColor = isAI ? '#06b6d4' : '#22c55e' // Green for sites, cyan for AI/community
  const html = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background-color: ${bgColor};
      border: 3px solid white;
      border-radius: 50%;
      font-weight: bold;
      font-size: 14px;
      color: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">${number || '•'}</div>
  `
  return L.divIcon({
    html,
    iconSize: [36, 36],
    className: 'monitoring-point-icon',
  })
}

// Popup style for point details
function MonitoringPopup({ title, subtitle, description, onDive }) {
  return (
    <div style={{ 
      background: 'white', 
      padding: '14px', 
      minWidth: '240px',
      borderRadius: '4px',
      fontSize: '14px',
      color: '#333',
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px', color: '#1f2937' }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
          {subtitle}
        </div>
      )}
      {description && (
        <div style={{ fontSize: '12px', color: '#555', marginBottom: '12px', lineHeight: '1.4' }}>
          {description}
        </div>
      )}
      {onDive && (
        <button
          onClick={onDive}
          style={{
            background: '#2d5a8c',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          View Details
        </button>
      )}
    </div>
  )
}

// Site marker component
function SiteMarker({ site, index, onSelect }) {
  const handlePopupClick = () => onSelect({ type: 'site', payload: site })
  
  return (
    <Marker
      position={[site.latitude, site.longitude]}
      icon={createMonitoringIcon(index + 1, false)}
      eventHandlers={{
        click: handlePopupClick,
      }}
      title={site.name}
    >
      <Popup>
        <MonitoringPopup
          title={site.name || 'Monitoring Site'}
          subtitle={site.organization || 'Source Water'}
          description={site.body_of_water || site.location_name || 'Great Lakes Region'}
          onDive={handlePopupClick}
        />
      </Popup>
    </Marker>
  )
}

// Community marker component
function CommunityMarker({ obs, index, onSelect }) {
  const risk = Number(obs?.ai_enrichment?.ai_risk_score || 0)
  const riskPercent = Math.round(risk * 100)
  const handlePopupClick = () => onSelect({ type: 'community', payload: obs })

  return (
    <Marker
      position={[obs.lat, obs.lon]}
      icon={createMonitoringIcon(index + 1, true)}
      eventHandlers={{
        click: handlePopupClick,
      }}
      title={`${obs.site_name} (AI: ${riskPercent}%)`}
    >
      <Popup>
        <MonitoringPopup
          title={obs.site_name || 'Community Observation'}
          subtitle={`${obs.organization || 'Community'} • AI Risk: ${riskPercent}%`}
          description={`Satellite: ${obs.ai_enrichment?.satellite_validation || 'unknown'} | Anomaly: ${obs.ai_enrichment?.anomaly_flag ? 'Yes' : 'No'}`}
          onDive={handlePopupClick}
        />
      </Popup>
    </Marker>
  )
}

function UsgsMarker({ station, index, onSelect }) {
  const handlePopupClick = () => onSelect({ type: 'usgs', payload: station })

  return (
    <Marker
      position={[station.latitude, station.longitude]}
      icon={createMonitoringIcon(index + 1, true)}
      eventHandlers={{
        click: handlePopupClick,
      }}
      title={`${station.siteName} (${station.siteCode})`}
    >
      <Popup>
        <MonitoringPopup
          title={station.siteName || 'USGS Station'}
          subtitle={`USGS Site ${station.siteCode}`}
          description={`Latest: ${station.lastValueLabel || 'No live value'} • Updated: ${station.lastUpdatedLabel || 'Unknown'}`}
          onDive={handlePopupClick}
        />
      </Popup>
    </Marker>
  )
}

function ScaleControl() {
  const map = useMap()

  useEffect(() => {
    const scale = L.control.scale({ metric: true, imperial: false })
    scale.addTo(map)
    return () => scale.remove()
  }, [map])

  return null
}

// Clustered map layers
function MapControls({ sites, communityRows, usgsRows, selected, onSelect }) {
  return (
    <>
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        showCoverageOnHover={true}
        disableClusteringAtZoom={11}
      >
        {sites.map((site, idx) => (
          <SiteMarker key={`site-${site.id}`} site={site} index={idx} onSelect={onSelect} />
        ))}
      </MarkerClusterGroup>

      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        showCoverageOnHover={true}
        disableClusteringAtZoom={11}
      >
        {communityRows.map((obs, idx) => (
          <CommunityMarker key={`community-${obs.id}`} obs={obs} index={idx} onSelect={onSelect} />
        ))}
      </MarkerClusterGroup>

      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        showCoverageOnHover={true}
        disableClusteringAtZoom={11}
      >
        {usgsRows.map((station, idx) => (
          <UsgsMarker key={`usgs-${station.siteCode}`} station={station} index={idx} onSelect={onSelect} />
        ))}
      </MarkerClusterGroup>
    </>
  )
}

export default function MapPage() {
  const [sites, setSites] = useState([])
  const [communityRows, setCommunityRows] = useState([])
  const [usgsRows, setUsgsRows] = useState([])
  const [usgsLoading, setUsgsLoading] = useState(false)
  const [usgsError, setUsgsError] = useState('')
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
    searchText: '',
    basemap: 'light',
  })

  // Load initial data
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

    setUsgsLoading(true)
    setUsgsError('')
    fetch('https://waterservices.usgs.gov/nwis/iv/?format=json&siteStatus=active&parameterCd=00010,00095,00300&bBox=-93,41,-74,49')
      .then((res) => {
        if (!res.ok) throw new Error(`USGS request failed (${res.status})`)
        return res.json()
      })
      .then((payload) => {
        const series = payload?.value?.timeSeries || []
        const bySite = new Map()

        series.forEach((entry) => {
          const sourceInfo = entry?.sourceInfo || {}
          const geo = sourceInfo?.geoLocation?.geogLocation || {}
          const siteCode = sourceInfo?.siteCode?.[0]?.value
          if (!siteCode) return

          const latitude = Number(geo?.latitude)
          const longitude = Number(geo?.longitude)
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

          const observed = entry?.values?.[0]?.value?.[0]
          const observedValue = observed?.value
          const observedAt = observed?.dateTime
          const variableName = entry?.variable?.variableName || ''

          if (!bySite.has(siteCode)) {
            bySite.set(siteCode, {
              siteCode,
              siteName: sourceInfo?.siteName || siteCode,
              latitude,
              longitude,
              lastValueLabel: '',
              lastUpdatedLabel: '',
              variables: [],
            })
          }

          const item = bySite.get(siteCode)
          item.variables.push({
            variableName,
            observedValue,
            observedAt,
          })
        })

        const normalized = Array.from(bySite.values()).map((row) => {
          const firstVar = row.variables[0]
          const lastUpdated = firstVar?.observedAt ? new Date(firstVar.observedAt) : null

          return {
            ...row,
            lastValueLabel: firstVar?.observedValue ? `${firstVar.variableName}: ${firstVar.observedValue}` : 'No live value',
            lastUpdatedLabel: lastUpdated && Number.isFinite(lastUpdated.getTime())
              ? `${lastUpdated.toLocaleDateString()} ${lastUpdated.toLocaleTimeString()}`
              : 'Unknown',
          }
        })

        setUsgsRows(normalized)
      })
      .catch((err) => {
        console.error('[MapPage] USGS load failed', err)
        setUsgsRows([])
        setUsgsError('USGS live stations are temporarily unavailable.')
      })
      .finally(() => setUsgsLoading(false))
  }, [])

  // Load site intelligence when selected
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
      if (filters.source === 'sites' || filters.source === 'usgs') return false

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

      if (filters.searchText.trim()) {
        const q = filters.searchText.trim().toLowerCase()
        const haystack = `${row?.site_name || ''} ${row?.organization || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [communityRows, cutoffDate, filters])

  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      if (filters.source === 'community' || filters.source === 'usgs') return false
      const status = statusBand(site.status)
      if (filters.status !== 'all' && status !== filters.status) return false
      if (filters.alertLevel !== 'all') {
        if (filters.alertLevel === 'high' && status !== 'critical') return false
        if (filters.alertLevel === 'medium' && status !== 'warning') return false
        if (filters.alertLevel === 'low' && status !== 'active') return false
      }

      if (filters.searchText.trim()) {
        const q = filters.searchText.trim().toLowerCase()
        const haystack = `${site?.name || ''} ${site?.organization || ''} ${site?.body_of_water || ''} ${site?.location_name || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [sites, filters])

  const filteredUsgs = useMemo(() => {
    return usgsRows.filter((station) => {
      if (filters.source === 'sites' || filters.source === 'community') return false

      if (filters.searchText.trim()) {
        const q = filters.searchText.trim().toLowerCase()
        const haystack = `${station?.siteName || ''} ${station?.siteCode || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [usgsRows, filters])

  const publicStats = useMemo(() => {
    const totalSites = filteredSites.length
    const totalCommunity = filteredCommunity.length
    const totalUsgs = filteredUsgs.length
    const criticalSites = filteredSites.filter((s) => statusBand(s.status) === 'critical').length
    const mediumOrHighCommunity = filteredCommunity.filter((c) => riskBand(c?.ai_enrichment?.ai_risk_score) !== 'low').length
    return { totalSites, totalCommunity, totalUsgs, criticalSites, mediumOrHighCommunity }
  }, [filteredSites, filteredCommunity, filteredUsgs])

  const selectedSite = selected?.type === 'site' ? selected.payload : null
  const selectedCommunity = selected?.type === 'community' ? selected.payload : null
  const selectedUsgs = selected?.type === 'usgs' ? selected.payload : null
  const latestSiteObservation = siteObservations[0] || null
  const siteParameterList = parameterSummary(latestSiteObservation)

  const siteTrends = useMemo(() => {
    if (!siteObservations.length) return []
    return ['ph', 'turbidity', 'dissolved_oxygen'].map((k) => ({ key: k, ...computeTrend(siteObservations, k) }))
  }, [siteObservations])

  const latestCommunityTimestamp = useMemo(() => {
    const timestamps = filteredCommunity
      .map((r) => new Date(r?.timestamp || '').getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)

    return timestamps.length ? formatDate(timestamps[0]) : 'Unknown'
  }, [filteredCommunity])

  const downloadVisibleData = () => {
    const rows = []

    filteredSites.forEach((site) => {
      rows.push({
        source: 'site',
        id: site.id,
        name: site.name || '',
        organization: site.organization || '',
        latitude: site.latitude,
        longitude: site.longitude,
        status: statusBand(site.status),
        observed_at: '',
        ph: '',
        turbidity: '',
        temperature: '',
        dissolved_oxygen: '',
        conductivity: '',
        ai_risk_score: '',
        anomaly_flag: '',
        satellite_validation: '',
      })
    })

    filteredCommunity.forEach((row) => {
      rows.push({
        source: 'community',
        id: row.id,
        name: row.site_name || '',
        organization: row.organization || '',
        latitude: row.lat,
        longitude: row.lon,
        status: riskBand(row?.ai_enrichment?.ai_risk_score),
        observed_at: row.timestamp || '',
        ph: row?.parameters?.ph ?? '',
        turbidity: row?.parameters?.turbidity ?? '',
        temperature: row?.parameters?.temperature ?? '',
        dissolved_oxygen: row?.parameters?.dissolved_oxygen ?? '',
        conductivity: row?.parameters?.conductivity ?? '',
        ai_risk_score: row?.ai_enrichment?.ai_risk_score ?? '',
        anomaly_flag: row?.ai_enrichment?.anomaly_flag ?? '',
        satellite_validation: row?.ai_enrichment?.satellite_validation ?? '',
      })
    })

    filteredUsgs.forEach((station) => {
      rows.push({
        source: 'usgs_live',
        id: station.siteCode,
        name: station.siteName || '',
        organization: 'USGS',
        latitude: station.latitude,
        longitude: station.longitude,
        status: 'live',
        observed_at: station.lastUpdatedLabel || '',
        ph: '',
        turbidity: '',
        temperature: '',
        dissolved_oxygen: '',
        conductivity: '',
        ai_risk_score: '',
        anomaly_flag: '',
        satellite_validation: '',
      })
    })

    if (!rows.length) return

    const headers = Object.keys(rows[0])
    const toCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => toCell(r[h])).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `visible-water-data-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <style>{MAP_CSS}</style>

      {/* Header banner */}
      <div className="border-b border-slate-200 bg-yellow-50 px-4 py-2 text-center text-xs text-slate-700">
        <span className="font-semibold">Real-time water quality monitoring</span> with community data and AI-assisted analysis.{' '}
        <a href="#" className="font-semibold text-blue-600 hover:underline">
          Learn more
        </a>
      </div>

      {/* Navy header with navigation */}
      <div className="flex items-center justify-between bg-slate-800 px-6 py-3">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Waves size={24} className="text-green-500" />
            <span className="text-lg font-bold text-white">Live Monitoring Map</span>
          </div>
          <nav className="hidden gap-6 md:flex">
            <a href="#" className="text-sm text-slate-200 hover:text-white">Data Home</a>
            <a href="#" className="text-sm text-slate-200 hover:text-white">Explore Data</a>
            <a href="#" className="text-sm text-slate-200 hover:text-white">About</a>
          </nav>
        </div>
        <div className="flex gap-4">
          <button className="text-sm text-slate-200 hover:text-white">Sign up</button>
          <button className="text-sm text-slate-200 hover:text-white">Login</button>
        </div>
      </div>

      {/* Main map and sidebar */}
      <div className="sw-map-wrap">
        {/* Map container */}
        <div className="flex-1 relative overflow-hidden">
          {/* Filter bar - overlaid on map */}
          <div className="absolute left-3 top-3 z-20 rounded-lg bg-white px-4 py-3 shadow-lg">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Sites: {publicStats.totalSites} | Community: {publicStats.totalCommunity} | USGS: {publicStats.totalUsgs}
              </span>
              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                Latest Community Data: {latestCommunityTimestamp}
              </span>
              <button
                onClick={downloadVisibleData}
                className="rounded bg-slate-800 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-700"
              >
                Export Visible CSV
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
              <input
                value={filters.searchText}
                onChange={(e) => setFilters((f) => ({ ...f, searchText: e.target.value }))}
                placeholder="Search site or org"
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
              />

              <select
                value={filters.basemap}
                onChange={(e) => setFilters((f) => ({ ...f, basemap: e.target.value }))}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
              >
                {Object.entries(BASEMAPS).map(([key, layer]) => (
                  <option key={key} value={key}>{layer.label} Basemap</option>
                ))}
              </select>

              <select
                value={filters.source}
                onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
              >
                <option value="all">All Sources</option>
                <option value="sites">Monitoring Sites</option>
                <option value="community">Community + AI</option>
                <option value="usgs">USGS Live Stations</option>
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
              >
                <option value="all">All Status</option>
                <option value="active">Stable</option>
                <option value="warning">Watch</option>
                <option value="critical">Critical</option>
              </select>

              <select
                value={filters.dateRange}
                onChange={(e) => setFilters((f) => ({ ...f, dateRange: e.target.value }))}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
              >
                <option value="30">Past 30 Days</option>
                <option value="90">Past 90 Days</option>
                <option value="365">Past 12 Months</option>
              </select>

              <select
                value={filters.alertLevel}
                onChange={(e) => setFilters((f) => ({ ...f, alertLevel: e.target.value }))}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
              >
                <option value="all">All Priorities</option>
                <option value="low">Stable</option>
                <option value="medium">Watch</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

          <MapContainer
            center={MAP_CENTER}
            zoom={MAP_ZOOM}
            className="map-container"
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              key={filters.basemap}
              url={BASEMAPS[filters.basemap]?.url || BASEMAPS.light.url}
              attribution={BASEMAPS[filters.basemap]?.attribution || BASEMAPS.light.attribution}
              maxZoom={18}
            />
            <ScaleControl />
            <MapControls
              sites={filteredSites}
              communityRows={filteredCommunity}
              usgsRows={filteredUsgs}
              selected={selected}
              onSelect={setSelected}
            />
          </MapContainer>
        </div>

        {/* Right sidebar - Site Intelligence */}
        <aside className="w-80 border-l border-slate-200 bg-white overflow-y-auto flex flex-col">
          <div className="border-b border-slate-200 px-4 py-4 flex-shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Details</h2>
              {selected && (
                <button
                  onClick={() => setSelected(null)}
                  className="rounded hover:bg-slate-100 p-1"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-600">Click on a marker to see details and trends</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {!!usgsError && (
              <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {usgsError}
              </div>
            )}
            {usgsLoading && (
              <div className="mb-3 rounded border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                Loading USGS live stations...
              </div>
            )}

            {!selected && (
              <div className="space-y-3 text-sm text-slate-600">
                <div className="rounded bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-700">How to Use</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Click green markers for monitoring sites</li>
                    <li>• Click cyan markers for community observations with AI enrichment</li>
                    <li>• Click USGS markers for live federal station measurements</li>
                    <li>• Use filters to narrow results by source, status, and date range</li>
                    <li>• View trends and AI-assisted risk scoring on the right</li>
                  </ul>
                </div>
              </div>
            )}

            {selectedSite && (
              <div className="space-y-4 text-sm text-slate-700">
                <div className="rounded bg-slate-50 p-3">
                  <h3 className="font-bold">{selectedSite.name || 'Monitoring Site'}</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {selectedSite.body_of_water || selectedSite.location_name || 'Great Lakes Region'}
                  </p>
                  <p className="text-xs text-slate-500">{selectedSite.organization || 'Source Water'}</p>
                </div>

                <div className="rounded bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-700">Latest Readings</div>
                  {siteParameterList.length === 0 && <div className="text-xs text-slate-500">No recent data</div>}
                  {siteParameterList.map((p) => (
                    <div key={p.key} className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-600">{p.label}</span>
                      <span className="font-semibold text-slate-700">{p.value}{p.unit}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-700">Trend Analysis</div>
                  {siteTrends.map((t) => (
                    <div key={t.key} className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-600">{t.key.replace('_', ' ').toUpperCase()}</span>
                      <span className="font-semibold text-slate-700">
                        {t.direction === 'up' ? '↑ Rising' : t.direction === 'down' ? '↓ Falling' : '→ Stable'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-700">AI + Satellite Validation</div>
                  {siteIntelligenceLoading && <div className="text-xs text-slate-500">Computing...</div>}
                  {!siteIntelligenceLoading && siteIntelligence && (
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Risk Score:</span>
                        <strong>{Math.round(Number(siteIntelligence.risk_score || 0) * 100)}%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Anomalies:</span>
                        <strong>{siteIntelligence.anomalies?.length ? 'Yes' : 'No'}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedCommunity && (
              <div className="space-y-4 text-sm text-slate-700">
                <div className="rounded bg-slate-50 p-3">
                  <h3 className="font-bold">{selectedCommunity.site_name || 'Community Observation'}</h3>
                  <p className="text-xs text-slate-600 mt-1">{selectedCommunity.organization || 'Community Monitoring'}</p>
                  <p className="text-xs text-slate-500">{formatDate(selectedCommunity.timestamp)}</p>
                </div>

                <div className="rounded bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-700">Water Parameters</div>
                  <div className="space-y-1">
                    {PARAMS.map((p) => {
                      const v = selectedCommunity?.parameters?.[p.key]
                      if (v === null || v === undefined) return null
                      return (
                        <div key={p.key} className="flex justify-between text-xs">
                          <span className="text-slate-600">{p.label}</span>
                          <span className="font-semibold text-slate-700">{v}{p.unit}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded bg-blue-50 p-3 border border-blue-100">
                  <div className="mb-2 text-xs font-semibold text-blue-900">AI Intelligence</div>
                  <div className="space-y-1 text-xs text-blue-800">
                    <div className="flex justify-between">
                      <span>Risk Score:</span>
                      <strong>{Math.round(Number(selectedCommunity?.ai_enrichment?.ai_risk_score || 0) * 100)}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Anomaly Flag:</span>
                      <strong>{selectedCommunity?.ai_enrichment?.anomaly_flag ? 'Alert' : 'Normal'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Satellite:</span>
                      <strong>{selectedCommunity?.ai_enrichment?.satellite_validation || 'unknown'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Trend:</span>
                      <strong>{selectedCommunity?.ai_enrichment?.trend_prediction || 'monitoring'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedUsgs && (
              <div className="space-y-4 text-sm text-slate-700">
                <div className="rounded bg-slate-50 p-3">
                  <h3 className="font-bold">{selectedUsgs.siteName || 'USGS Station'}</h3>
                  <p className="text-xs text-slate-600 mt-1">USGS Site Code: {selectedUsgs.siteCode}</p>
                  <p className="text-xs text-slate-500">Last Update: {selectedUsgs.lastUpdatedLabel || 'Unknown'}</p>
                </div>

                <div className="rounded bg-blue-50 p-3 border border-blue-100">
                  <div className="mb-2 text-xs font-semibold text-blue-900">Live Measurements</div>
                  <div className="space-y-1 text-xs text-blue-800">
                    {selectedUsgs.variables?.length ? selectedUsgs.variables.map((v, i) => (
                      <div key={`${v.variableName}-${i}`} className="flex justify-between gap-2">
                        <span>{v.variableName}</span>
                        <strong>{v.observedValue || 'N/A'}</strong>
                      </div>
                    )) : (
                      <div>No live measurements available.</div>
                    )}
                  </div>
                </div>

                <a
                  href={`https://waterdata.usgs.gov/monitoring-location/${selectedUsgs.siteCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  Open Official USGS Station
                </a>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
