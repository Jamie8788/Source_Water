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
import ParameterDeepDive from '../components/ParameterDeepDive'
import { PARAM_META, PARAM_ORDER, classifyValue, TONE_COLOR } from '../utils/waterParams'

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
    // Carto's CDN now requires an API key (watermarks tiles). Esri's free,
    // no-key light grey canvas gives the same look with no key.
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
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
  @keyframes swPulse {
    0%   { transform: scale(1);   opacity: 0.55; }
    70%  { transform: scale(1.6); opacity: 0;    }
    100% { transform: scale(1.6); opacity: 0;    }
  }
  .sw-param-chip {
    cursor: pointer;
    transition: background 0.15s;
  }
  .sw-param-chip:hover {
    background: #e0f2fe;
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
function createMonitoringIcon(number, isAI = false, overrideColor = null, pulse = false) {
  const bgColor = overrideColor || (isAI ? '#06b6d4' : '#22c55e') // Green for sites, cyan for USGS, custom for heatmap
  const ring = pulse
    ? `<div style="position:absolute;inset:-8px;border-radius:50%;border:3px solid ${bgColor};opacity:0.55;animation:swPulse 1.6s ease-out infinite"></div>`
    : ''
  const html = `
    <div style="position:relative;width:36px;height:36px;">
      ${ring}
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
        position: relative;
        z-index: 1;
      ">${number || '•'}</div>
    </div>
  `
  return L.divIcon({
    html,
    iconSize: [36, 36],
    className: 'monitoring-point-icon',
  })
}

// Compact dot icon — used when WR national toggle is on (1000s of sites; numbers
// would be unreadable). Coloured by heatmap band when active.
function createWrDotIcon(color = '#0ea5e9', pulse = false) {
  const ring = pulse
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.55;animation:swPulse 1.6s ease-out infinite"></div>`
    : ''
  const html = `
    <div style="position:relative;width:18px;height:18px;">
      ${ring}
      <div style="
        width:18px;height:18px;border-radius:50%;background:${color};
        border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);position:relative;z-index:1;
      "></div>
    </div>
  `
  return L.divIcon({ html, iconSize: [18, 18], className: 'monitoring-point-icon' })
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
function SiteMarker({ site, index, onSelect, heatmapParam, isAnomaly }) {
  const handlePopupClick = () => onSelect({ type: 'site', payload: site })

  let overrideColor = null
  let bandLabel = null
  if (heatmapParam) {
    const v = Number(site?.[heatmapParam])
    if (Number.isFinite(v)) {
      const cls = classifyValue(heatmapParam, v)
      if (cls) { overrideColor = cls.color; bandLabel = cls.label }
    } else {
      overrideColor = '#cbd5e1' // grey when no reading for this parameter
    }
  }

  return (
    <Marker
      position={[site.latitude, site.longitude]}
      icon={createMonitoringIcon(index + 1, false, overrideColor, isAnomaly)}
      eventHandlers={{
        click: handlePopupClick,
      }}
      title={site.name}
    >
      <Popup>
        <MonitoringPopup
          title={site.name || 'Monitoring Site'}
          subtitle={site.organization || 'Source Water'}
          description={
            heatmapParam && bandLabel
              ? `${PARAM_META[heatmapParam].label}: ${site[heatmapParam]}${PARAM_META[heatmapParam].unit} — ${bandLabel}`
              : site.body_of_water || site.location_name || 'Great Lakes Region'
          }
          onDive={handlePopupClick}
        />
      </Popup>
    </Marker>
  )
}

// WR national location marker — small dot, opens detail panel.
function WrMarker({ loc, onSelect, heatmapParam }) {
  const handle = () => onSelect({ type: 'wr', payload: loc })
  let color = '#0ea5e9'
  if (heatmapParam) {
    const v = Number(loc?.latest?.[heatmapParam])
    if (Number.isFinite(v)) color = classifyValue(heatmapParam, v)?.color || color
    else color = '#cbd5e1'
  }
  return (
    <Marker
      position={[loc.latitude, loc.longitude]}
      icon={createWrDotIcon(color)}
      eventHandlers={{ click: handle }}
      title={loc.name}
    >
      <Popup>
        <MonitoringPopup
          title={loc.name || 'Water Rangers Site'}
          subtitle={loc.organization_name || 'Water Rangers community'}
          description={loc.body_of_water || loc.location_description || 'Community monitoring location'}
          onDive={handle}
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
function MapControls({ sites, usgsRows, wrRows, selected, onSelect, heatmapParam, anomalyIds }) {
  return (
    <>
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        showCoverageOnHover={true}
        disableClusteringAtZoom={11}
      >
        {sites.map((site, idx) => (
          <SiteMarker
            key={`site-${site.id}`}
            site={site}
            index={idx}
            onSelect={onSelect}
            heatmapParam={heatmapParam}
            isAnomaly={anomalyIds?.has(site.id)}
          />
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

      {wrRows && wrRows.length > 0 && (
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={60}
          showCoverageOnHover={true}
          disableClusteringAtZoom={12}
        >
          {wrRows.map((loc) => (
            <WrMarker key={`wr-${loc.id}`} loc={loc} onSelect={onSelect} heatmapParam={heatmapParam} />
          ))}
        </MarkerClusterGroup>
      )}
    </>
  )
}

export default function MapPage() {
  const [sites, setSites] = useState([])
  const [usgsRows, setUsgsRows] = useState([])
  const [usgsLoading, setUsgsLoading] = useState(false)
  const [usgsError, setUsgsError] = useState('')
  const [radarTemplate, setRadarTemplate] = useState('')
  const [selected, setSelected] = useState(null)
  const [siteObservations, setSiteObservations] = useState([])
  const [siteIntelligence, setSiteIntelligence] = useState(null)
  const [siteIntelligenceLoading, setSiteIntelligenceLoading] = useState(false)

  // Water Rangers national community sites (9,444+) — loaded on demand
  const [wrSites, setWrSites] = useState([])
  const [wrLoading, setWrLoading] = useState(false)
  const [wrError, setWrError] = useState('')
  const [wrLoaded, setWrLoaded] = useState(false)

  // WR site detail (when user clicks a WR pin)
  const [wrDetail, setWrDetail] = useState(null)
  const [wrDetailLoading, setWrDetailLoading] = useState(false)

  // Parameter Deep-Dive panel (Map tab feature: click any param chip → full explainer)
  const [deepDiveParam, setDeepDiveParam] = useState(null)

  const [filters, setFilters] = useState({
    source: 'all',
    status: 'all',
    parameter: 'all',
    dateRange: '365',
    recency: 'all',
    alertLevel: 'all',
    searchText: '',
    basemap: 'light',
    radar: false,
    nationalWR: false,        // toggle: load all 9,444 WR sites across Canada
    heatmapParam: '',         // '' | 'ph' | 'turbidity' | ... — colours sites by CCME band
    timeWindowDays: 365,      // time-travel slider (anything between 7..365)
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



    setUsgsLoading(true)
    setUsgsError('')
    api.get('/geoai/usgs-live')
      .then((resp) => {
        const payload = resp.data || {}
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
          const latestVar = row.variables
            .filter((v) => v?.observedAt)
            .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())[0] || row.variables[0]

          const lastUpdated = latestVar?.observedAt ? new Date(latestVar.observedAt) : null

          return {
            ...row,
            lastValueLabel: latestVar?.observedValue ? `${latestVar.variableName}: ${latestVar.observedValue}` : 'No live value',
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

    api.get('/geoai/radar-meta')
      .then((resp) => {
        const tpl = resp.data?.tileTemplate || ''
        setRadarTemplate(typeof tpl === 'string' ? tpl : '')
      })
      .catch((err) => {
        console.error('[MapPage] radar metadata load failed', err)
        setRadarTemplate('')
      })
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

  // Load Water Rangers national locations on demand from real /api/wr/locations-all
  useEffect(() => {
    if (!filters.nationalWR || wrLoaded) return
    setWrLoading(true)
    setWrError('')
    api.get('/wr/locations-all', { timeout: 120000 })
      .then((resp) => {
        const list = Array.isArray(resp.data?.locations) ? resp.data.locations : []
        // Normalise: ensure latitude/longitude are numeric and present
        const norm = list
          .map((loc) => ({
            ...loc,
            latitude: Number(loc.latitude ?? loc.lat),
            longitude: Number(loc.longitude ?? loc.lng ?? loc.lon),
          }))
          .filter((l) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude))
        setWrSites(norm)
        setWrLoaded(true)
      })
      .catch((err) => {
        console.error('[MapPage] WR national load failed', err)
        setWrError('Could not load Water Rangers national sites — please try again in a moment.')
      })
      .finally(() => setWrLoading(false))
  }, [filters.nationalWR, wrLoaded])

  // When a WR site is selected, fetch its real observations from the WR API
  useEffect(() => {
    if (!selected || selected.type !== 'wr') {
      setWrDetail(null)
      return
    }
    const loc = selected.payload
    setWrDetailLoading(true)
    api.get(`/wr/locations/${loc.id}/observations`)
      .then((resp) => {
        const obs = Array.isArray(resp.data?.observations)
          ? resp.data.observations
          : Array.isArray(resp.data)
            ? resp.data
            : []
        setWrDetail({ location: loc, observations: obs })
      })
      .catch((err) => {
        console.error('[MapPage] WR observations load failed', err)
        setWrDetail({ location: loc, observations: [], error: true })
      })
      .finally(() => setWrDetailLoading(false))
  }, [selected])

  const cutoffDate = useMemo(() => {
    const days = Number(filters.dateRange)
    if (!Number.isFinite(days) || days <= 0) return null
    return Date.now() - days * 86400000
  }, [filters.dateRange])

  // Time-travel cutoff (lets users see only sites with observations newer than N days)
  const timeWindowCutoff = useMemo(() => {
    const days = Number(filters.timeWindowDays)
    if (!Number.isFinite(days) || days <= 0) return null
    return Date.now() - days * 86400000
  }, [filters.timeWindowDays])



  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      if (filters.source === 'usgs' || filters.source === 'wr') return false
      const status = statusBand(site.status)
      if (filters.status !== 'all' && status !== filters.status) return false
      if (filters.alertLevel !== 'all') {
        if (filters.alertLevel === 'high' && status !== 'critical') return false
        if (filters.alertLevel === 'medium' && status !== 'warning') return false
        if (filters.alertLevel === 'low' && status !== 'active') return false
      }

      // Time-travel — only sites with a measurement inside the chosen window
      if (timeWindowCutoff) {
        const ts = new Date(site.last_observation_at || site.observed_at || site.updated_at || 0).getTime()
        if (Number.isFinite(ts) && ts > 0 && ts < timeWindowCutoff) return false
      }

      if (filters.searchText.trim()) {
        const q = filters.searchText.trim().toLowerCase()
        const haystack = `${site?.name || ''} ${site?.organization || ''} ${site?.body_of_water || ''} ${site?.location_name || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [sites, filters, timeWindowCutoff])

  // WR national sites — only shown when nationalWR toggle is on
  const filteredWr = useMemo(() => {
    if (!filters.nationalWR || !wrSites.length) return []
    return wrSites.filter((loc) => {
      if (filters.source === 'sites' || filters.source === 'usgs') return false
      if (filters.searchText.trim()) {
        const q = filters.searchText.trim().toLowerCase()
        const hay = `${loc?.name || ''} ${loc?.organization_name || ''} ${loc?.body_of_water || ''} ${loc?.location_description || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [wrSites, filters])

  // Anomaly pulse — flag sites whose latest reading lands in a 'critical' CCME band
  const anomalyIds = useMemo(() => {
    const ids = new Set()
    for (const s of filteredSites) {
      for (const key of PARAM_ORDER) {
        const v = Number(s?.[key])
        if (!Number.isFinite(v)) continue
        const cls = classifyValue(key, v)
        if (cls?.tone === 'critical') { ids.add(s.id); break }
      }
    }
    return ids
  }, [filteredSites])

  const filteredUsgs = useMemo(() => {
    return usgsRows.filter((station) => {
      if (filters.source === 'sites') return false

      if (filters.status !== 'all' && filters.status !== 'live') return false

      if (cutoffDate) {
        const newest = (station.variables || [])
          .map((v) => new Date(v?.observedAt || '').getTime())
          .filter((t) => Number.isFinite(t))
          .sort((a, b) => b - a)[0]

        if (Number.isFinite(newest) && newest < cutoffDate) return false
      }

      if (filters.searchText.trim()) {
        const q = filters.searchText.trim().toLowerCase()
        const haystack = `${station?.siteName || ''} ${station?.siteCode || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [usgsRows, filters, cutoffDate])

  const publicStats = useMemo(() => {
    const totalSites = filteredSites.length
    const totalUsgs = filteredUsgs.length
    const totalWr = filteredWr.length
    const criticalSites = anomalyIds.size
    return { totalSites, totalUsgs, totalWr, criticalSites }
  }, [filteredSites, filteredUsgs, filteredWr, anomalyIds])

  const selectedSite = selected?.type === 'site' ? selected.payload : null
  const selectedUsgs = selected?.type === 'usgs' ? selected.payload : null
  const latestSiteObservation = siteObservations[0] || null
  const siteParameterList = parameterSummary(latestSiteObservation)

  const siteTrends = useMemo(() => {
    if (!siteObservations.length) return []
    return ['ph', 'turbidity', 'dissolved_oxygen'].map((k) => ({ key: k, ...computeTrend(siteObservations, k) }))
  }, [siteObservations])

  const latestMeasuredTimestamp = useMemo(() => {
    const timestamps = [
      ...filteredUsgs.flatMap((s) => (s.variables || []).map((v) => new Date(v?.observedAt || '').getTime())),
    ]
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)

    return timestamps.length ? formatDate(timestamps[0]) : 'Unknown'
  }, [filteredUsgs])

  const downloadVisibleData = () => {
    const rows = []

    filteredUsgs.forEach((station) => {
      const vars = station.variables || []
      const valuesByVar = (needle) => vars.find((v) => String(v.variableName || '').toLowerCase().includes(needle))?.observedValue || ''

      rows.push({
        source: 'usgs_live',
        id: station.siteCode,
        name: station.siteName || '',
        organization: 'USGS',
        latitude: station.latitude,
        longitude: station.longitude,
        status: 'live',
        observed_at: station.lastUpdatedLabel || '',
        ph: valuesByVar('ph'),
        turbidity: valuesByVar('turbidity'),
        temperature: valuesByVar('temperature'),
        dissolved_oxygen: valuesByVar('dissolved oxygen'),
        conductivity: valuesByVar('specific conductance'),
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
        <span className="font-semibold">Real-time water quality monitoring</span> with measured data from USGS and local monitoring sites. Designed for water researchers.{' '}
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
          <div className="absolute left-3 top-3 z-20 rounded-lg bg-white px-4 py-3 shadow-lg" style={{ maxWidth: 'calc(100% - 24px)' }}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Sites: {publicStats.totalSites} | USGS Live: {publicStats.totalUsgs}
                {filters.nationalWR && ` | WR Canada: ${publicStats.totalWr}`}
                {anomalyIds.size > 0 && (
                  <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-red-700">
                    ⚠ {anomalyIds.size} critical
                  </span>
                )}
              </span>
              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                Latest Measured Data: {latestMeasuredTimestamp}
              </span>
              <button
                onClick={downloadVisibleData}
                className="rounded bg-slate-800 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-700"
              >
                Export Measured CSV
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={filters.nationalWR}
                  onChange={(e) => setFilters((f) => ({ ...f, nationalWR: e.target.checked }))}
                />
                Show all 9,444 Water Rangers sites (Canada)
              </label>
              {wrLoading && (
                <span className="rounded bg-sky-50 px-2 py-1 text-[11px] text-sky-700">
                  Loading national community sites…
                </span>
              )}
              {wrError && (
                <span className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">{wrError}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
              <input
                value={filters.searchText}
                onChange={(e) => setFilters((f) => ({ ...f, searchText: e.target.value }))}
                placeholder="Search station/site"
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
                <option value="all">All Measured Data</option>
                <option value="sites">Monitoring Sites Only</option>
                <option value="usgs">USGS Live Only</option>
              </select>

              <label className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={filters.radar}
                  onChange={(e) => setFilters((f) => ({ ...f, radar: e.target.checked }))}
                />
                Live Radar
              </label>

              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
              >
                <option value="all">All Status</option>
                <option value="active">Stable</option>
                <option value="warning">Watch</option>
                <option value="critical">Critical</option>
                <option value="live">Live</option>
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

            {/* Heatmap parameter + time-travel slider */}
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-700">Heatmap by:</span>
                <select
                  value={filters.heatmapParam}
                  onChange={(e) => setFilters((f) => ({ ...f, heatmapParam: e.target.value }))}
                  className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  <option value="">Off (status colours)</option>
                  {PARAM_ORDER.map((k) => (
                    <option key={k} value={k}>{PARAM_META[k].label} (CCME aquatic-life bands)</option>
                  ))}
                </select>
                {filters.heatmapParam && (
                  <button
                    onClick={() => setDeepDiveParam(filters.heatmapParam)}
                    className="rounded bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-700"
                    title="Open the deep-dive explainer for this parameter"
                  >
                    Deep-Dive
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-700">Time-travel:</span>
                <input
                  type="range"
                  min="7"
                  max="365"
                  step="7"
                  value={filters.timeWindowDays}
                  onChange={(e) => setFilters((f) => ({ ...f, timeWindowDays: Number(e.target.value) }))}
                  className="flex-1"
                  aria-label="Show only sites with measurements in the past N days"
                />
                <span className="text-[11px] tabular-nums text-slate-700">past {filters.timeWindowDays} days</span>
              </div>
            </div>

            {/* Heatmap legend (inline SVG) */}
            {filters.heatmapParam && PARAM_META[filters.heatmapParam] && (
              <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700">
                    {PARAM_META[filters.heatmapParam].label} bands
                  </span>
                  <span className="text-[10px] text-slate-500">CCME aquatic-life</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded">
                  {PARAM_META[filters.heatmapParam].ranges.map((r, i) => (
                    <div
                      key={i}
                      title={`${r.label} (${r.min}–${r.max >= 9999 ? '∞' : r.max}${PARAM_META[filters.heatmapParam].unit}): ${r.note}`}
                      style={{ flex: 1, background: TONE_COLOR[r.tone] }}
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  {PARAM_META[filters.heatmapParam].ranges.map((r, i) => (
                    <span key={i}>{r.label}</span>
                  ))}
                </div>
              </div>
            )}
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
            {filters.radar && Boolean(radarTemplate) && (
              <TileLayer
                key={`radar-${radarTemplate}`}
                url={radarTemplate}
                opacity={0.45}
                zIndex={3}
              />
            )}
            <ScaleControl />
            <MapControls
              sites={filteredSites}
              usgsRows={filteredUsgs}
              wrRows={filteredWr}
              selected={selected}
              onSelect={setSelected}
              heatmapParam={filters.heatmapParam}
              anomalyIds={anomalyIds}
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
                    <li>• Click green markers for monitoring sites (real observations)</li>
                    <li>• Click cyan USGS markers for live federal station measurements</li>
                    <li>• Toggle live radar for active precipitation context</li>
                    <li>• Use filters to narrow results by source, status, and date range</li>
                    <li>• Export measured data to CSV for analysis</li>
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
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Latest Readings</span>
                    <span className="text-[10px] text-slate-500">click for deep-dive</span>
                  </div>
                  {siteParameterList.length === 0 && <div className="text-xs text-slate-500">No recent data</div>}
                  {siteParameterList.map((p) => {
                    const cls = classifyValue(p.key, p.value)
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setDeepDiveParam(p.key)}
                        className="sw-param-chip mb-1 flex w-full items-center justify-between rounded px-1.5 py-1 text-xs"
                        style={{ background: 'transparent' }}
                        title={`Open ${p.label} explainer with CCME aquatic-life bands`}
                      >
                        <span className="flex items-center gap-2 text-slate-700">
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cls?.color || '#cbd5e1', display: 'inline-block' }} />
                          {p.label}
                        </span>
                        <span className="font-semibold text-slate-800">{p.value}{p.unit}</span>
                      </button>
                    )
                  })}
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

            {selected?.type === 'wr' && (
              <div className="space-y-4 text-sm text-slate-700">
                <div className="rounded bg-slate-50 p-3">
                  <h3 className="font-bold">{selected.payload.name || 'Water Rangers Site'}</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {selected.payload.body_of_water || selected.payload.location_description || 'Community monitoring location'}
                  </p>
                  <p className="text-xs text-slate-500">{selected.payload.organization_name || 'Water Rangers community'}</p>
                </div>

                {wrDetailLoading && (
                  <div className="rounded bg-sky-50 p-3 text-xs text-sky-800">Loading observations from Water Rangers…</div>
                )}

                {!wrDetailLoading && wrDetail && (
                  <div className="rounded bg-cyan-50 p-3 border border-cyan-100">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-cyan-900">Latest Community Readings</span>
                      <span className="text-[10px] text-cyan-700">click for deep-dive</span>
                    </div>
                    {(() => {
                      const obs = wrDetail.observations?.[0]
                      if (!obs) return <div className="text-xs text-cyan-800">No recent observations from this site.</div>
                      const rows = []
                      // Try inline shape first
                      for (const k of PARAM_ORDER) {
                        const v = Number(obs[k])
                        if (Number.isFinite(v)) rows.push({ key: k, value: v })
                      }
                      // Fallback: WR readings array
                      if (!rows.length && Array.isArray(obs.readings)) {
                        for (const r of obs.readings) {
                          const name = String(r?.parameter || '').toLowerCase()
                          for (const k of PARAM_ORDER) {
                            if (PARAM_META[k].aliases.some(a => name.includes(a))) {
                              const v = Number(r.value)
                              if (Number.isFinite(v) && !rows.find(x => x.key === k)) rows.push({ key: k, value: v })
                            }
                          }
                        }
                      }
                      if (!rows.length) return <div className="text-xs text-cyan-800">Observation present but no recognised parameter readings.</div>
                      return rows.map((p) => {
                        const meta = PARAM_META[p.key]
                        const cls = classifyValue(p.key, p.value)
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => setDeepDiveParam(p.key)}
                            className="sw-param-chip mb-1 flex w-full items-center justify-between rounded px-1.5 py-1 text-xs"
                            style={{ background: 'transparent' }}
                          >
                            <span className="flex items-center gap-2 text-cyan-900">
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cls?.color || '#cbd5e1', display: 'inline-block' }} />
                              {meta.label}
                            </span>
                            <span className="font-semibold text-cyan-900">{p.value}{meta.unit}</span>
                          </button>
                        )
                      })
                    })()}
                    <div className="mt-2 text-[10px] text-cyan-700">
                      Source: Water Rangers community API · Last fetched {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                )}

                <a
                  href={`https://app.waterrangers.com/locations/${selected.payload.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  Open on Water Rangers
                </a>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Parameter Deep-Dive panel — full explainer with inline SVG diagrams,
          site-specific stats, anomaly detection, and real AI summary */}
      {deepDiveParam && (
        <ParameterDeepDive
          paramKey={deepDiveParam}
          observations={
            selected?.type === 'wr'
              ? (wrDetail?.observations || [])
              : siteObservations
          }
          siteName={
            selected?.type === 'wr'
              ? (selected.payload?.name || wrDetail?.location?.name)
              : (selected?.payload?.name || selected?.payload?.location_name)
          }
          siteId={selected?.payload?.id}
          onClose={() => setDeepDiveParam(null)}
        />
      )}
    </div>
  )
}
