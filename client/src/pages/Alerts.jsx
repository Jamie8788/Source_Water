import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { LineChart, Line, ReferenceLine, ReferenceArea, YAxis, XAxis, Tooltip as RTooltip, ResponsiveContainer } from 'recharts'
import api from '../utils/api'
import {
  AlertTriangle, Info, CheckCircle, Bell, BellOff,
  MapPin, Clock, RefreshCw, ChevronDown,
  Activity, Plus, Trash2, Power, PowerOff,
  Target, Database, Zap, BookOpen, Search, Globe,
  TrendingUp, TrendingDown, Minus, Sparkles,
} from 'lucide-react'

/* ── Parameter guidance (Canadian drinking water + CCME aquatic life) ── */
/* Sources: Health Canada Guidelines for Canadian Drinking Water Quality,
   CCME Water Quality Guidelines for Aquatic Life. Real values — not made up. */
const PARAM_GUIDE = {
  ph: { unit: '', safe: '6.5 – 8.5', ideal: '6.5 – 8.5',
    hint: 'Health Canada aesthetic objective. <6.5 = corrosive; >8.5 = scaling.',
    typicalAlgoma: '6.8 – 7.4 (Algoma lakes skew slightly acidic)' },
  dissolved_oxygen: { unit: 'mg/L', safe: '≥ 6.5', ideal: '8 – 12',
    hint: 'CCME cold-water aquatic life. <4 mg/L is stressful for fish; <2 mg/L is lethal.',
    typicalAlgoma: '8 – 11 mg/L' },
  turbidity: { unit: 'NTU', safe: '≤ 1', ideal: '< 0.1',
    hint: 'Health Canada: ≤1 NTU for treated water; <0.3 for filtered. High = sediment/runoff.',
    typicalAlgoma: '0.2 – 3 NTU' },
  water_temp: { unit: '°C', safe: 'site-dependent', ideal: 'varies',
    hint: 'No single threshold. >20°C stresses cold-water fish; trout spawning needs <10°C.',
    typicalAlgoma: 'Summer: 18 – 24°C; Winter: 0 – 4°C' },
  air_temp: { unit: '°C', safe: 'n/a', ideal: 'n/a',
    hint: 'Context for observation — not a water quality parameter itself.', typicalAlgoma: '—' },
  chlorine: { unit: 'mg/L', safe: '0.2 – 4.0', ideal: '0.5 – 2',
    hint: 'Health Canada: 0.2 mg/L residual minimum in distribution, 4 mg/L maximum.',
    typicalAlgoma: '0.3 – 1.5 mg/L in treated water' },
  conductivity: { unit: 'µS/cm', safe: '< 1000', ideal: '100 – 500',
    hint: 'CCME: sudden changes indicate contamination. Road salt spikes push this up.',
    typicalAlgoma: '80 – 250 µS/cm' },
  nitrate_nitrogen: { unit: 'mg/L', safe: '≤ 10', ideal: '< 3',
    hint: 'Health Canada MAC: 10 mg/L as N. Higher suggests fertilizer/septic runoff.',
    typicalAlgoma: '< 1 mg/L typically' },
  phosphorus: { unit: 'µg/L', safe: '≤ 20', ideal: '< 10',
    hint: 'CCME: >30 µg/L risks algal blooms. Main driver of eutrophication.',
    typicalAlgoma: '5 – 15 µg/L' },
  chlorophyll_a: { unit: 'µg/L', safe: '< 10', ideal: '< 2.5',
    hint: 'Proxy for algae. >10 µg/L = eutrophic; >25 = hypereutrophic / bloom likely.',
    typicalAlgoma: '1 – 5 µg/L' },
  hardness: { unit: 'mg/L CaCO₃', safe: 'n/a', ideal: '60 – 120',
    hint: 'Aesthetic: <60 = soft; 120–180 = hard; >180 = very hard (scaling).',
    typicalAlgoma: '20 – 60 mg/L (soft)' },
  alkalinity: { unit: 'mg/L CaCO₃', safe: '20 – 200', ideal: '60 – 120',
    hint: 'Buffers pH changes. <20 = vulnerable to acidification.',
    typicalAlgoma: '10 – 40 mg/L' },
  chloride: { unit: 'mg/L', safe: '≤ 250', ideal: '< 100',
    hint: 'Health Canada aesthetic: 250 mg/L. Road salt is the big source.',
    typicalAlgoma: '1 – 15 mg/L (rural); higher near highways' },
  nitrites: { unit: 'mg/L', safe: '≤ 1', ideal: '< 0.1',
    hint: 'Health Canada MAC: 1 mg/L as N. Short-lived; converts to nitrate.', typicalAlgoma: '< 0.05 mg/L' },
  tds: { unit: 'mg/L', safe: '≤ 500', ideal: '< 250',
    hint: 'Total Dissolved Solids. Aesthetic threshold — correlates with conductivity.',
    typicalAlgoma: '50 – 150 mg/L' },
  total_coliforms: { unit: 'CFU/100mL', safe: '0 (treated)', ideal: '0',
    hint: 'Health Canada: zero in treated water. Presence = contamination.', typicalAlgoma: '0 in treated supply' },
  secchi_depth: { unit: 'm', safe: 'site-dependent', ideal: '> 3',
    hint: 'Transparency. Lower = murkier. Lakes drop in clarity during blooms.',
    typicalAlgoma: '2 – 6 m in oligotrophic lakes' },
  water_depth: { unit: 'm', safe: 'n/a', ideal: 'n/a',
    hint: 'Physical measurement — context, not quality.', typicalAlgoma: '—' },
}

/* ── Pulse ring animation ── */
function PulseRing({ color, size = 10 }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'block', position: 'relative', zIndex: 1 }}/>
      <span style={{ position: 'absolute', width: size, height: size, borderRadius: '50%', background: color, opacity: 0.4, animation: 'alertPing 1.8s cubic-bezier(0,0,0.2,1) infinite' }}/>
    </span>
  )
}

const SEV_CONFIG = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.2)',  badge: 'rgba(239,68,68,0.12)',  badgeText: '#ef4444', icon: AlertTriangle, label: 'Critical' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', badge: 'rgba(245,158,11,0.12)', badgeText: '#f59e0b', icon: AlertTriangle, label: 'Warning' },
  low:    { color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)', badge: 'rgba(16,185,129,0.12)', badgeText: '#10b981', icon: Info,          label: 'Advisory' },
  info:   { color: '#0ea5e9', bg: 'rgba(14,165,233,0.06)', border: 'rgba(14,165,233,0.2)', badge: 'rgba(14,165,233,0.12)', badgeText: '#0ea5e9', icon: Info,          label: 'Info' },
}

function timeAgo(d) {
  if (!d) return ''
  const diff = Date.now() - new Date(d)
  if (diff < 60000)   return 'just now'
  if (diff < 3600000) return Math.floor(diff / 60000)   + 'min ago'
  if (diff < 86400000)return Math.floor(diff / 3600000) + 'h ago'
  return Math.floor(diff / 86400000) + 'd ago'
}

/* ── Map of watched sites ── */
function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const coords = points.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng])
    if (coords.length === 1) map.setView(coords[0], 10)
    else if (coords.length > 1) map.fitBounds(coords, { padding: [40, 40] })
  }, [points, map])
  return null
}

function WatchesMap({ watches, sites }) {
  const points = useMemo(() => {
    const bySite = new Map(sites.map(s => [s.id, s]))
    return watches.map(w => {
      const s = bySite.get(w.site_id)
      if (!s || !s.latitude || !s.longitude) return null
      return {
        ...w,
        lat: parseFloat(s.latitude),
        lng: parseFloat(s.longitude),
        site_name: s.name,
        body_of_water: s.body_of_water,
      }
    }).filter(Boolean)
  }, [watches, sites])

  if (watches.length === 0) return null

  if (points.length === 0) {
    return (
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
        Your watched sites don't have coordinates on file — map view unavailable.
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin style={{ width: 14, height: 14, color: '#6366f1' }}/>
          <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>Watched Sites Map</div>
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <LegendDot color="#ef4444" label="Triggered"/>
          <LegendDot color="#10b981" label="OK"/>
          <LegendDot color="#64748b" label="No data"/>
        </div>
      </div>
      <div style={{ height: 280, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <MapContainer center={[46.5, -84]} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <FitBounds points={points}/>
          {points.map(p => {
            const color = !p.has_data ? '#64748b' : p.triggered ? '#ef4444' : '#10b981'
            return (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={p.triggered ? 11 : 8}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: p.triggered ? 0.85 : 0.6,
                  weight: p.triggered ? 3 : 2,
                }}>
                <Popup>
                  <div style={{ fontSize: 12, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.site_name}</div>
                    <div style={{ color: '#64748b', marginBottom: 6 }}>{p.body_of_water || 'Water body'}</div>
                    <div style={{ padding: '6px 8px', borderRadius: 6, background: p.triggered ? '#fee2e2' : '#dcfce7', border: `1px solid ${p.triggered ? '#fecaca' : '#bbf7d0'}` }}>
                      <div style={{ fontWeight: 700 }}>
                        {p.parameter_label || p.parameter} {p.comparator} {p.threshold}
                      </div>
                      <div style={{ marginTop: 3 }}>
                        Latest: <strong>{p.current_value ?? '—'}</strong>
                        {p.triggered && <span style={{ color: '#dc2626', marginLeft: 6 }}>⚠ triggered</span>}
                      </div>
                      {p.observed_at && <div style={{ color: '#64748b', marginTop: 3 }}>{timeAgo(p.observed_at)}</div>}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }}/>
      {label}
    </span>
  )
}

/* ── Stats utilities (pure math, no AI, no mocks) ──
   All numbers computed client-side from real observation rows returned by
   /alert-watches/:id/history. For WR-LIVE watches that endpoint pulls fresh
   observations from the Water Rangers API on every request. */

function parseSafeRange(safeStr) {
  if (!safeStr) return null
  const s = String(safeStr).trim().toLowerCase()
  if (s.includes('site-dependent') || s === 'n/a' || s.includes('treated')) return null
  let m = s.match(/^([\d.]+)\s*[–\-]\s*([\d.]+)/)
  if (m) return { min: parseFloat(m[1]), max: parseFloat(m[2]) }
  m = s.match(/^[≥]\s*([\d.]+)/) || s.match(/^>=?\s*([\d.]+)/)
  if (m) return { min: parseFloat(m[1]), max: null }
  m = s.match(/^[≤]\s*([\d.]+)/) || s.match(/^<=?\s*([\d.]+)/)
  if (m) return { min: null, max: parseFloat(m[1]) }
  return null
}

function inSafe(v, sr) {
  if (!sr) return null
  if (sr.min != null && v < sr.min) return false
  if (sr.max != null && v > sr.max) return false
  return true
}

function isBreach(v, threshold, comparator) {
  const t = parseFloat(threshold)
  if (!isFinite(t) || !isFinite(v)) return false
  if (comparator === '>')  return v > t
  if (comparator === '<')  return v < t
  if (comparator === '>=') return v >= t
  if (comparator === '<=') return v <= t
  return false
}

function computeStats(points, threshold, comparator, safeRange) {
  if (!points || points.length === 0) return null
  const clean = points
    .map((p, i) => ({ ...p, _i: i, _v: typeof p.value === 'number' ? p.value : parseFloat(p.value), _ts: new Date(p.observed_at).getTime() }))
    .filter(p => isFinite(p._v) && isFinite(p._ts))
  if (clean.length === 0) return null

  const values = clean.map(p => p._v)
  const n = values.length
  const mean = values.reduce((s, v) => s + v, 0) / n
  let mn = values[0], mx = values[0]
  for (const v of values) { if (v < mn) mn = v; if (v > mx) mx = v }
  const variance = n > 1 ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0
  const stddev = Math.sqrt(variance)

  let pctInSafe = null
  if (safeRange) {
    const inCount = values.filter(v => inSafe(v, safeRange)).length
    pctInSafe = (inCount / n) * 100
  }

  let lastBreachDate = null
  let breachCount = 0
  for (const p of clean) {
    if (isBreach(p._v, threshold, comparator)) {
      breachCount++
      if (!lastBreachDate || p._ts > new Date(lastBreachDate).getTime()) lastBreachDate = p.observed_at
    }
  }

  let slopePerWeek = null
  let timeSpanDays = null
  if (clean.length >= 3) {
    const meanX = clean.reduce((s, p) => s + p._ts, 0) / clean.length
    const meanY = mean
    let num = 0, den = 0
    for (const p of clean) {
      num += (p._ts - meanX) * (p._v - meanY)
      den += (p._ts - meanX) ** 2
    }
    if (den > 0) slopePerWeek = (num / den) * 7 * 24 * 3600 * 1000
    const tsMin = Math.min(...clean.map(p => p._ts))
    const tsMax = Math.max(...clean.map(p => p._ts))
    timeSpanDays = (tsMax - tsMin) / (24 * 3600 * 1000)
  }

  const anomalyIdx = new Set()
  if (stddev > 0) {
    clean.forEach(p => {
      if (Math.abs(p._v - mean) > 2 * stddev) anomalyIdx.add(p._i)
    })
  }

  return { n, mean, min: mn, max: mx, stddev, pctInSafe, lastBreachDate, breachCount, slopePerWeek, timeSpanDays, anomalyIdx }
}

/* ── Stats strip: 6 small cards explaining the chart in plain words ── */
function StatsStrip({ stats, guide, watch }) {
  const unit = guide?.unit || ''
  const fmt = (v, d = 2) => (v == null || !isFinite(v) ? '—' : v.toFixed(d))
  const slopeIcon = stats.slopePerWeek == null ? Minus
    : stats.slopePerWeek >  Math.max(stats.stddev * 0.05, 0.005) ? TrendingUp
    : stats.slopePerWeek < -Math.max(stats.stddev * 0.05, 0.005) ? TrendingDown
    : Minus
  const slopeColor = slopeIcon === TrendingUp ? '#f59e0b'
    : slopeIcon === TrendingDown ? '#0ea5e9'
    : '#64748b'
  const slopeText = stats.slopePerWeek == null ? 'Stable'
    : slopeIcon === Minus ? 'Stable'
    : `${stats.slopePerWeek > 0 ? '+' : ''}${fmt(stats.slopePerWeek, 3)}${unit ? ' ' + unit : ''}/wk`

  const safePctColor = stats.pctInSafe == null ? 'var(--text)'
    : stats.pctInSafe >= 90 ? '#10b981'
    : stats.pctInSafe >= 70 ? '#f59e0b'
    : '#ef4444'

  const cards = [
    { label: 'Average', value: `${fmt(stats.mean)}${unit ? ' ' + unit : ''}`, hint: `Mean of all ${stats.n} readings` },
    { label: 'Range', value: `${fmt(stats.min)} – ${fmt(stats.max)}`, sub: unit, hint: 'Lowest to highest reading on record' },
    { label: 'Variability', value: `± ${fmt(stats.stddev)}${unit ? ' ' + unit : ''}`, hint: '1 standard deviation. Smaller = readings cluster tightly around the average.' },
    stats.pctInSafe != null && {
      label: 'In safe range', value: `${fmt(stats.pctInSafe, 0)}%`, color: safePctColor,
      hint: `% of readings inside the Health Canada / CCME guideline range (${guide.safe}${unit ? ' ' + unit : ''})`,
    },
    {
      label: 'Trend (per week)', value: slopeText, color: slopeColor, IconC: slopeIcon,
      hint: 'Linear trend across the time window. ↑ rising, ↓ falling, — stable.',
    },
    {
      label: 'Last breach',
      value: stats.lastBreachDate ? timeAgo(stats.lastBreachDate) : 'Never',
      color: stats.lastBreachDate ? '#f59e0b' : '#10b981',
      hint: `Last reading that crossed your threshold (${watch.comparator} ${watch.threshold}). Total breaches: ${stats.breachCount}.`,
    },
  ].filter(Boolean)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: 6, marginBottom: 10 }}>
      {cards.map(c => {
        const Icon = c.IconC
        return (
          <div key={c.label} title={c.hint}
            style={{ padding: '7px 10px', borderRadius: 9, background: 'rgba(0,0,0,0.025)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: c.color || 'var(--text)', lineHeight: 1.15, display: 'flex', alignItems: 'center', gap: 4 }}>
              {Icon && <Icon style={{ width: 13, height: 13 }}/>}
              <span>{c.value}</span>
            </div>
            {c.sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>}
          </div>
        )
      })}
    </div>
  )
}

/* ── Plain-language interpretation: tells the story the stats already prove ── */
function Interpretation({ stats, guide, watch }) {
  const unit = guide?.unit ? ' ' + guide.unit : ''
  const paramName = watch.parameter_label || watch.parameter
  const sentences = []

  if (stats.slopePerWeek != null && stats.timeSpanDays >= 7) {
    const significant = Math.abs(stats.slopePerWeek) > Math.max(stats.stddev * 0.05, 0.005)
    if (!significant) {
      sentences.push(`${paramName} has been stable over the last ${Math.round(stats.timeSpanDays)} days.`)
    } else if (stats.slopePerWeek > 0) {
      sentences.push(`${paramName} is rising — about ${stats.slopePerWeek.toFixed(3)}${unit} per week across ${Math.round(stats.timeSpanDays)} days of readings.`)
    } else {
      sentences.push(`${paramName} is falling — about ${Math.abs(stats.slopePerWeek).toFixed(3)}${unit} per week across ${Math.round(stats.timeSpanDays)} days of readings.`)
    }
  }

  if (stats.pctInSafe != null) {
    if (stats.pctInSafe >= 95)      sentences.push(`${stats.pctInSafe.toFixed(0)}% of readings sit inside the safe guideline range — healthy.`)
    else if (stats.pctInSafe >= 70) sentences.push(`${stats.pctInSafe.toFixed(0)}% inside the safe range, ${(100 - stats.pctInSafe).toFixed(0)}% outside — worth watching.`)
    else                            sentences.push(`Only ${stats.pctInSafe.toFixed(0)}% of readings are inside the safe range — frequent excursions.`)
  }

  const anomalyN = stats.anomalyIdx?.size || 0
  if (anomalyN > 0) {
    sentences.push(`${anomalyN} reading${anomalyN === 1 ? '' : 's'} stand${anomalyN === 1 ? 's' : ''} out as unusually ${anomalyN === 1 ? 'high or low' : 'high/low'} (more than 2σ from the average) — marked red on the chart.`)
  }

  if (stats.breachCount > 0) {
    sentences.push(`Your threshold (${watch.comparator} ${watch.threshold}) was crossed ${stats.breachCount} time${stats.breachCount === 1 ? '' : 's'}, most recently ${timeAgo(stats.lastBreachDate)}.`)
  } else {
    sentences.push(`No reading has crossed your threshold (${watch.comparator} ${watch.threshold}).`)
  }

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(99,102,241,0.04)', border: '1px dashed rgba(99,102,241,0.25)', borderRadius: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        <Sparkles style={{ width: 11, height: 11, color: '#6366f1' }}/>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#6366f1', letterSpacing: '0.05em', textTransform: 'uppercase' }}>What this means</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.55 }}>{sentences.join(' ')}</div>
      {guide?.hint && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text)' }}>Guideline:</strong> {guide.hint}
          {guide.typicalAlgoma && guide.typicalAlgoma !== '—' && <> · <strong style={{ color: 'var(--text)' }}>Typical Algoma:</strong> {guide.typicalAlgoma}</>}
        </div>
      )}
    </div>
  )
}

/* ── Watch analysis: stats strip + chart with anomaly dots + interpretation ──
   Uses the same /alert-watches/:id/history endpoint already in production.
   For WR-adopted sites the server fetches observations from data.waterrangers.com
   on every call — so these numbers reflect live citizen monitoring data. */
function WatchAnalysis({ watch, severityColor }) {
  const [data, setData] = useState([])
  const [source, setSource] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    api.get(`/alert-watches/${watch.id}/history`)
      .then(r => { if (cancelled) return; setData(r.data?.points || []); setSource(r.data?.source || null); setLoaded(true) })
      .catch(e => { if (!cancelled) { setErr(e.response?.data?.error || 'Could not load history'); setLoaded(true) } })
    return () => { cancelled = true }
  }, [watch.id])

  const guide = PARAM_GUIDE[watch.parameter]
  const safeRange = useMemo(() => parseSafeRange(guide?.safe), [guide])
  const stats = useMemo(() => computeStats(data, watch.threshold, watch.comparator, safeRange), [data, watch.threshold, watch.comparator, safeRange])

  if (!loaded) return <div style={{ padding: '12px 0', fontSize: 11, color: 'var(--text-muted)' }}>Loading observations…</div>
  if (err)     return <div style={{ padding: '12px 0', fontSize: 11, color: '#ef4444' }}>{err}</div>
  if (data.length < 2) return <div style={{ padding: '12px 0', fontSize: 11, color: 'var(--text-muted)' }}>Only {data.length} observation{data.length === 1 ? '' : 's'} on record — need at least 2 to analyze.</div>

  const chartData = data.map((p, i) => ({
    ...p,
    isAnomaly: stats?.anomalyIdx?.has(i) ?? false,
  }))
  const threshold = parseFloat(watch.threshold)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {data.length} reading{data.length === 1 ? '' : 's'}{stats?.timeSpanDays ? ` · ${Math.round(stats.timeSpanDays)} days` : ''}
        </div>
        {source === 'waterrangers' && (
          <span title="Pulled live from data.waterrangers.com on this request"
            style={{ padding: '2px 7px', borderRadius: 20, fontSize: 9, fontWeight: 800, background: 'rgba(14,165,233,0.12)', color: '#0ea5e9', display: 'inline-flex', alignItems: 'center', gap: 3, letterSpacing: '0.04em' }}>
            <Globe style={{ width: 9, height: 9 }}/> WR LIVE
          </span>
        )}
      </div>

      {stats && <StatsStrip stats={stats} guide={guide} watch={watch}/>}

      <div style={{ height: 140, marginTop: 4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
            <XAxis dataKey="observed_at" hide/>
            <YAxis hide domain={['auto', 'auto']}/>
            <RTooltip
              contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', fontSize: 11, borderRadius: 8 }}
              labelFormatter={(_, p) => p?.[0]?.payload?.observed_at ? new Date(p[0].payload.observed_at).toLocaleString() : ''}
              formatter={(v, _n, p) => [`${v}${guide?.unit ? ' ' + guide.unit : ''}${p?.payload?.isAnomaly ? '  ⚠ anomaly' : ''}`, watch.parameter_label || watch.parameter]}
            />
            {safeRange?.min != null && safeRange?.max != null && (
              <ReferenceArea y1={safeRange.min} y2={safeRange.max} fill="#10b981" fillOpacity={0.07} stroke="none"/>
            )}
            {safeRange?.min != null && safeRange?.max == null && (
              <ReferenceLine y={safeRange.min} stroke="#10b981" strokeDasharray="2 4" strokeWidth={1} label={{ value: 'min safe', position: 'insideBottomLeft', fontSize: 9, fill: '#10b981' }}/>
            )}
            {safeRange?.max != null && safeRange?.min == null && (
              <ReferenceLine y={safeRange.max} stroke="#10b981" strokeDasharray="2 4" strokeWidth={1} label={{ value: 'max safe', position: 'insideTopLeft', fontSize: 9, fill: '#10b981' }}/>
            )}
            {isFinite(threshold) && (
              <ReferenceLine y={threshold} stroke={severityColor} strokeDasharray="3 3" strokeWidth={1.5} label={{ value: `your threshold (${watch.comparator} ${watch.threshold})`, position: 'insideTopRight', fontSize: 9, fill: severityColor }}/>
            )}
            <Line type="monotone" dataKey="value" stroke={severityColor} strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload, index } = props
                if (payload?.isAnomaly) return <circle key={`anom-${index}`} cx={cx} cy={cy} r={4.5} fill="#ef4444" stroke="#fff" strokeWidth={1.5}/>
                return <circle key={`pt-${index}`} cx={cx} cy={cy} r={0} fill="transparent"/>
              }}
              activeDot={{ r: 4, fill: severityColor }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 16, height: 2, background: severityColor, borderRadius: 2 }}/> reading
        </span>
        {safeRange && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 8, background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 2 }}/> safe range
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 16, height: 2, background: severityColor, borderRadius: 2, borderTop: `2px dashed ${severityColor}`, opacity: 0.7 }}/> your threshold
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, background: '#ef4444', borderRadius: '50%', border: '1.5px solid #fff' }}/> anomaly (&gt;2σ)
        </span>
      </div>

      {stats && <Interpretation stats={stats} guide={guide} watch={watch}/>}
    </div>
  )
}

/* ── Alert Card ── */
function AlertCard({ alert, onExpand, expanded }) {
  const cfg = SEV_CONFIG[alert.severity] || SEV_CONFIG.info
  const Icon = cfg.icon
  const isActive = alert.active === 1 || alert.active === true
  const guide = PARAM_GUIDE[alert.parameter]

  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 14,
      border: `1px solid ${expanded ? cfg.color + '60' : cfg.border}`,
      overflow: 'hidden', transition: 'all 0.2s',
      boxShadow: expanded ? `0 0 24px ${cfg.color}18` : 'none',
    }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}60)` }}/>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
            <Icon style={{ width: 17, height: 17, color: cfg.color }}/>
            {isActive && (
              <span style={{ position: 'absolute', top: -3, right: -3 }}>
                <PulseRing color={cfg.color} size={7}/>
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.3 }}>
                {alert.message || `${alert.parameter || 'Parameter'} alert`}
              </div>
              <button onClick={() => onExpand(alert.id)}
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}>
                <ChevronDown style={{ width: 15, height: 15, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.badge, color: cfg.badgeText }}>
                {cfg.label}
              </span>
              {isActive
                ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                    <PulseRing color="#10b981" size={6}/> Active
                  </span>
                : <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(100,116,139,0.1)', color: '#64748b' }}>Resolved</span>
              }
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, color: 'var(--text-muted)', background: 'var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock style={{ width: 10, height: 10 }}/> {timeAgo(alert.created_at)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              {alert.site_name && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin style={{ width: 11, height: 11 }}/>{alert.site_name}</span>}
              {alert.parameter && <span>· {alert.parameter}</span>}
            </div>
          </div>
        </div>

        {(alert.current_value != null || alert.threshold_value != null) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {alert.current_value != null && (
              <div style={{ padding: '5px 12px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>Current</span>
                <span style={{ marginLeft: 6, fontWeight: 700, color: cfg.color }}>{alert.current_value}</span>
              </div>
            )}
            {alert.threshold_value != null && (
              <div style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>Threshold</span>
                <span style={{ marginLeft: 6, fontWeight: 700, color: 'var(--text)' }}>{alert.threshold_value}</span>
              </div>
            )}
          </div>
        )}

        {expanded && guide && (
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.18)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <BookOpen style={{ width: 12, height: 12, color: '#0ea5e9' }}/>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Context</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, marginBottom: 4 }}>
              <strong>Safe range:</strong> {guide.safe} {guide.unit} · <strong>Ideal:</strong> {guide.ideal} {guide.unit}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{guide.hint}</div>
            {guide.typicalAlgoma !== '—' && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 3 }}>
                <strong>Typical Algoma:</strong> {guide.typicalAlgoma}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Stats Bar ── */
function StatsBar({ alerts, watchCount }) {
  const active = alerts.filter(a => a.active === 1 || a.active === true)
  const high   = active.filter(a => a.severity === 'high').length
  const medium = active.filter(a => a.severity === 'medium').length
  const low    = active.filter(a => a.severity === 'low').length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
      {[
        { label: 'Active Alerts', value: active.length, color: '#ef4444', icon: Bell, pulse: active.length > 0 },
        { label: 'Critical',      value: high,           color: '#ef4444', icon: AlertTriangle },
        { label: 'Warnings',      value: medium,         color: '#f59e0b', icon: AlertTriangle },
        { label: 'Advisories',    value: low,            color: '#10b981', icon: Info },
        { label: 'My Watches',    value: watchCount,     color: '#6366f1', icon: Activity },
      ].map(s => (
        <div key={s.label} style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 100% 0%, ${s.color}08, transparent 60%)`, pointerEvents: 'none' }}/>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
            <s.icon style={{ width: 16, height: 16, color: s.color }}/>
            {s.pulse && s.value > 0 && <span style={{ position: 'absolute', top: -2, right: -2 }}><PulseRing color={s.color} size={7}/></span>}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.value > 0 ? s.color : 'var(--text-muted)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── How Alerts Work — 3-step explainer ── */
function HowItWorks() {
  const steps = [
    { icon: Target,   color: '#6366f1', title: 'You set a rule', body: 'Pick a site, a parameter (pH, DO, turbidity, etc.), a comparator (>, <, ≥, ≤) and a number. That\'s your watch.' },
    { icon: Database, color: '#0ea5e9', title: 'We read real data', body: 'The checker pulls the latest observation for that site+parameter from the database — Water Rangers & Algoma partner data. No AI, no guessing.' },
    { icon: Zap,      color: '#f59e0b', title: 'Alert only if it crosses', body: 'Pure math: if latest value crosses your threshold, one alert fires. We never create a duplicate while an alert is still active.' },
  ]
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Activity style={{ width: 15, height: 15, color: '#0ea5e9' }}/>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>How alerts work</span>
        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#10b981', letterSpacing: '0.05em' }}>NO FAKE DATA</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ position: 'relative', padding: '12px 14px', borderRadius: 11, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)' }}>
            <div style={{ position: 'absolute', top: -8, left: 12, padding: '2px 8px', borderRadius: 20, background: s.color, color: '#fff', fontSize: 10, fontWeight: 800 }}>
              STEP {i + 1}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${s.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon style={{ width: 14, height: 14, color: s.color }}/>
              </div>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{s.title}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Parameter guidance card (shown inside Add Watch form) ── */
function GuidanceCard({ param }) {
  const g = PARAM_GUIDE[param]
  if (!g) return null
  return (
    <div style={{ gridColumn: '1 / -1', padding: '10px 12px', background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.18)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <BookOpen style={{ width: 12, height: 12, color: '#0ea5e9' }}/>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Guidance</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, fontSize: 12, color: 'var(--text)' }}>
        <div><strong>Safe:</strong> {g.safe} {g.unit}</div>
        <div><strong>Ideal:</strong> {g.ideal} {g.unit}</div>
        <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{g.hint}</div>
        {g.typicalAlgoma !== '—' && (
          <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <strong>Typical Algoma:</strong> {g.typicalAlgoma}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Water Rangers site typeahead ──
   Lazy-loads /api/wr/locations-all (server caches 1hr) the first time the
   user opens the WR picker. Search is purely client-side filter to keep it
   snappy on 9,400 rows. Picking a result calls /sites/adopt-wr which
   returns a local sites row id we can attach a watch to. */
function WRSiteSearch({ onPicked, onError }) {
  const [allLocs, setAllLocs] = useState(null) // null = not loaded
  const [loadingList, setLoadingList] = useState(false)
  const [query, setQuery] = useState('')
  const [adopting, setAdopting] = useState(null) // wr_id currently being adopted
  const [picked, setPicked] = useState(null)     // { wr_id, name } once adopted

  useEffect(() => {
    if (allLocs !== null) return
    setLoadingList(true)
    api.get('/wr/locations-all')
      .then(r => setAllLocs(Array.isArray(r.data?.locations) ? r.data.locations : []))
      .catch(() => { setAllLocs([]); onError?.('Could not reach Water Rangers') })
      .finally(() => setLoadingList(false))
  }, [allLocs, onError])

  const results = useMemo(() => {
    if (!allLocs) return []
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return allLocs.filter(l => {
      const hay = `${l.name || ''} ${l.body_of_water || ''} ${l.location_description || ''} ${l.organization_name || ''}`.toLowerCase()
      return hay.includes(q)
    }).slice(0, 30)
  }, [allLocs, query])

  const adopt = async (loc) => {
    setAdopting(loc.id)
    try {
      const r = await api.post('/sites/adopt-wr', { wr_id: loc.id })
      const s = r.data?.site
      if (s?.id) {
        setPicked({ wr_id: loc.id, name: s.name, site_id: s.id })
        onPicked(s)
      }
    } catch (err) {
      onError?.(err.response?.data?.error || 'Adoption failed')
    }
    setAdopting(null)
  }

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}/>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={loadingList ? 'Loading 9,400+ Water Rangers sites…' : 'Type a lake / river / community (min 2 chars)…'}
          disabled={loadingList || picked != null}
          style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}
        />
      </div>

      {picked ? (
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span><CheckCircle style={{ width: 12, height: 12, color: '#10b981', marginRight: 6, verticalAlign: 'middle' }}/>
            <strong>{picked.name}</strong> — ready to watch
          </span>
          <button onClick={() => { setPicked(null); setQuery('') }}
            style={{ background: 'transparent', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Change</button>
        </div>
      ) : results.length > 0 ? (
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card-bg)' }}>
          {results.map(loc => (
            <button key={loc.id} onClick={() => adopt(loc)} disabled={adopting != null}
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid var(--border)', background: adopting === loc.id ? 'rgba(99,102,241,0.08)' : 'transparent', cursor: adopting != null ? 'wait' : 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {loc.body_of_water || loc.location_description || 'Water Rangers site'}{loc.organization_name ? ` · ${loc.organization_name}` : ''}
                </div>
              </span>
              <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                {adopting === loc.id ? 'Adding…' : 'Pick →'}
              </span>
            </button>
          ))}
        </div>
      ) : query.trim().length >= 2 && !loadingList ? (
        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          No Water Rangers sites match "{query}".
        </div>
      ) : null}
    </div>
  )
}

/* ── My Watches Panel ── */
function WatchesPanel({ watches, sites, options, onCreate, onDelete, onToggle, onCheck, checking, onToast, onSitesChanged }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ site_id: '', parameter: '', comparator: '>', threshold: '', severity: 'medium' })
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [source, setSource] = useState('local') // 'local' | 'wr'

  const reset = () => {
    setForm({ site_id: '', parameter: '', comparator: '>', threshold: '', severity: 'medium' })
    setAdding(false)
    setSource('local')
  }

  const submit = async () => {
    if (!form.site_id || !form.parameter || form.threshold === '') return
    setBusy(true)
    const ok = await onCreate({ ...form, threshold: parseFloat(form.threshold), site_id: parseInt(form.site_id) })
    setBusy(false)
    if (ok) reset()
  }

  const onWRPicked = (site) => {
    setForm(f => ({ ...f, site_id: site.id }))
    onSitesChanged?.()
  }

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>My Watches</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Custom thresholds on real monitoring sites. Each watch reads the latest observation and fires an alert if your condition is met.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCheck} disabled={checking || watches.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: watches.length ? 'pointer' : 'not-allowed', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', opacity: watches.length ? 1 : 0.5 }}>
            <RefreshCw style={{ width: 13, height: 13, animation: checking ? 'spin 1s linear infinite' : 'none' }}/>
            Check now
          </button>
          <button onClick={() => setAdding(a => !a)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#6366f1', color: '#fff' }}>
            <Plus style={{ width: 13, height: 13 }}/>
            {adding ? 'Cancel' : 'Add watch'}
          </button>
        </div>
      </div>

      {adding && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, padding: 12, marginBottom: 12, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10 }}>
          {/* Source toggle: pick from our local list or search 9,400+ Water Rangers sites */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { setSource('local'); setForm(f => ({ ...f, site_id: '' })) }}
              style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, background: source === 'local' ? '#6366f1' : 'var(--border)', color: source === 'local' ? '#fff' : 'var(--text-muted)' }}>
              <Database style={{ width: 12, height: 12 }}/> Our sites ({sites.length})
            </button>
            <button type="button" onClick={() => { setSource('wr'); setForm(f => ({ ...f, site_id: '' })) }}
              style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, background: source === 'wr' ? '#0ea5e9' : 'var(--border)', color: source === 'wr' ? '#fff' : 'var(--text-muted)' }}>
              <Globe style={{ width: 12, height: 12 }}/> Water Rangers (9,400+)
            </button>
          </div>

          {source === 'local' ? (
            <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}>
              <option value="">Site…</option>
              {sites.filter(s => s.external_source !== 'waterrangers').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : (
            <WRSiteSearch onPicked={onWRPicked} onError={msg => onToast?.({ type: 'error', text: msg })}/>
          )}
          <select value={form.parameter} onChange={e => setForm(f => ({ ...f, parameter: e.target.value }))}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}>
            <option value="">Parameter…</option>
            {options.parameters?.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={form.comparator} onChange={e => setForm(f => ({ ...f, comparator: e.target.value }))}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}>
            {(options.comparators || ['>','<','>=','<=']).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" step="any" placeholder={form.parameter && PARAM_GUIDE[form.parameter] ? `e.g. ${PARAM_GUIDE[form.parameter].ideal.split(' ')[0]}` : 'Threshold'} value={form.threshold}
            onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}/>
          <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}>
            <option value="low">Advisory</option>
            <option value="medium">Warning</option>
            <option value="high">Critical</option>
          </select>
          <button onClick={submit} disabled={busy || !form.site_id || !form.parameter || form.threshold === ''}
            style={{ padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: '#10b981', color: '#fff', opacity: (busy || !form.site_id || !form.parameter || form.threshold === '') ? 0.5 : 1 }}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <GuidanceCard param={form.parameter}/>
        </div>
      )}

      {watches.length === 0 ? (
        <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          No watches yet. Add one to be notified when a parameter at a site you care about crosses your threshold.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {watches.map(w => {
            const sevCfg = SEV_CONFIG[w.severity] || SEV_CONFIG.info
            const isOpen = expandedId === w.id
            const guide = PARAM_GUIDE[w.parameter]
            return (
              <div key={w.id} style={{
                padding: '10px 12px',
                borderRadius: 10, border: `1px solid ${w.triggered ? sevCfg.border : 'var(--border)'}`,
                background: w.triggered ? sevCfg.bg : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: sevCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                    <Activity style={{ width: 14, height: 14, color: sevCfg.color }}/>
                    {w.triggered && <span style={{ position: 'absolute', top: -2, right: -2 }}><PulseRing color={sevCfg.color} size={6}/></span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>{w.parameter_label || w.parameter}</span>
                      <span style={{ color: sevCfg.color }}>{w.comparator} {w.threshold}{guide?.unit ? ` ${guide.unit}` : ''}</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>at {w.site_name}</span>
                      {w.is_external && (
                        <span title="Live from Water Rangers API on every check"
                          style={{ padding: '2px 7px', borderRadius: 20, fontSize: 9, fontWeight: 800, background: 'rgba(14,165,233,0.12)', color: '#0ea5e9', display: 'inline-flex', alignItems: 'center', gap: 3, letterSpacing: '0.04em' }}>
                          <Globe style={{ width: 9, height: 9 }}/> WR LIVE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {w.has_data
                        ? <>Latest: <strong style={{ color: w.triggered ? sevCfg.color : 'var(--text)' }}>{w.current_value}</strong> · {timeAgo(w.observed_at)}</>
                        : <em>No observations recorded yet</em>}
                      {w.last_checked_at && <> · checked {timeAgo(w.last_checked_at)}</>}
                    </div>
                  </div>
                  <button onClick={() => setExpandedId(isOpen ? null : w.id)} title={isOpen ? 'Hide history' : 'Show history'}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: 'var(--text-muted)' }}>
                    <ChevronDown style={{ width: 14, height: 14, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
                  </button>
                  <button onClick={() => onToggle(w)} title={w.active ? 'Pause' : 'Activate'}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: w.active ? '#10b981' : 'var(--text-muted)' }}>
                    {w.active ? <Power style={{ width: 14, height: 14 }}/> : <PowerOff style={{ width: 14, height: 14 }}/>}
                  </button>
                  <button onClick={() => onDelete(w.id)} title="Delete"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: '#ef4444' }}>
                    <Trash2 style={{ width: 14, height: 14 }}/>
                  </button>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                    <WatchAnalysis watch={w} severityColor={sevCfg.color}/>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Alerts() {
  const [alerts, setAlerts]       = useState([])
  const [watches, setWatches]     = useState([])
  const [sites, setSites]         = useState([])
  const [options, setOptions]     = useState({ parameters: [], comparators: ['>','<','>=','<='], severities: ['low','medium','high'] })
  const [filter, setFilter]       = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [loading, setLoading]     = useState(false)
  const [checking, setChecking]   = useState(false)
  const [toast, setToast]         = useState(null)

  const loadAlerts = async () => {
    try {
      const r = await api.get('/admin/alerts')
      setAlerts(Array.isArray(r.data?.alerts) ? r.data.alerts : [])
    } catch { setAlerts([]) }
  }
  const loadWatches = async () => {
    try {
      const r = await api.get('/alert-watches')
      setWatches(Array.isArray(r.data?.watches) ? r.data.watches : [])
    } catch { setWatches([]) }
  }
  const loadSites = async () => {
    try {
      const r = await api.get('/sites')
      setSites(Array.isArray(r.data) ? r.data : [])
    } catch { setSites([]) }
  }
  const loadOptions = async () => {
    try {
      const r = await api.get('/alert-watches/options')
      if (r.data) setOptions(r.data)
    } catch {}
  }

  useEffect(() => {
    loadAlerts(); loadWatches(); loadSites(); loadOptions()
    const t = setInterval(() => { loadAlerts(); loadWatches() }, 30000)
    return () => clearInterval(t)
  }, [])

  const refreshAll = async () => {
    setLoading(true)
    await Promise.all([loadAlerts(), loadWatches()])
    setLoading(false)
  }

  const createWatch = async (payload) => {
    try {
      await api.post('/alert-watches', payload)
      await loadWatches()
      return true
    } catch (err) {
      setToast({ type: 'error', text: err.response?.data?.error || 'Failed to create watch' })
      setTimeout(() => setToast(null), 3000)
      return false
    }
  }
  const deleteWatch = async (id) => {
    if (!confirm('Delete this watch?')) return
    await api.delete(`/alert-watches/${id}`).catch(() => {})
    loadWatches()
  }
  const toggleWatch = async (w) => {
    await api.put(`/alert-watches/${w.id}`, { active: !w.active }).catch(() => {})
    loadWatches()
  }
  const checkNow = async () => {
    setChecking(true)
    try {
      const r = await api.post('/alert-watches/check')
      const fired = (r.data?.results || []).filter(x => x.alert_created).length
      setToast({
        type: fired > 0 ? 'fire' : 'ok',
        text: fired > 0 ? `${fired} new alert${fired === 1 ? '' : 's'} created` : 'All watches checked — none triggered'
      })
      setTimeout(() => setToast(null), 3500)
      await Promise.all([loadAlerts(), loadWatches()])
    } catch (err) {
      setToast({ type: 'error', text: err.response?.data?.error || 'Check failed' })
      setTimeout(() => setToast(null), 3000)
    }
    setChecking(false)
  }

  const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id)

  const filtered = useMemo(() => alerts.filter(a => {
    const isActive = a.active === 1 || a.active === true
    if (filter === 'all')      return true
    if (filter === 'active')   return isActive
    if (filter === 'resolved') return !isActive
    return a.severity === filter
  }), [alerts, filter])

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <PageAmbience variant="dashboard"/>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '0 4px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#ef4444,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(239,68,68,0.3)' }}>
                <Bell style={{ width: 18, height: 18, color: '#fff' }}/>
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: 0 }}>Water Quality Alerts</h1>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Every alert is derived from a real observation row — no demo data, no AI guessing.</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setNotifEnabled(n => !n)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: notifEnabled ? 'rgba(99,102,241,0.1)' : 'var(--border)', color: notifEnabled ? '#818cf8' : 'var(--text-muted)' }}>
              {notifEnabled ? <Bell style={{ width: 14, height: 14 }}/> : <BellOff style={{ width: 14, height: 14 }}/>}
              {notifEnabled ? 'Notifications On' : 'Muted'}
            </button>
            <button onClick={refreshAll}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--border)', color: 'var(--text-muted)' }}>
              <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }}/>
            </button>
          </div>
        </div>

        <StatsBar alerts={alerts} watchCount={watches.length}/>

        <HowItWorks/>

        <WatchesMap watches={watches} sites={sites}/>

        <WatchesPanel
          watches={watches}
          sites={sites}
          options={options}
          onCreate={createWatch}
          onDelete={deleteWatch}
          onToggle={toggleWatch}
          onCheck={checkNow}
          checking={checking}
          onToast={t => { setToast(t); setTimeout(() => setToast(null), 3000) }}
          onSitesChanged={loadSites}
        />

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { v: 'all',      label: 'All' },
            { v: 'active',   label: 'Active' },
            { v: 'high',     label: 'Critical' },
            { v: 'medium',   label: 'Warnings' },
            { v: 'low',      label: 'Advisories' },
            { v: 'resolved', label: 'Resolved' },
          ].map(f => (
            <button key={f.v} onClick={() => setFilter(f.v)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filter === f.v ? 'rgba(99,102,241,0.15)' : 'var(--border)',
                color: filter === f.v ? '#818cf8' : 'var(--text-muted)',
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Alert list */}
        {filtered.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
            <CheckCircle style={{ width: 44, height: 44, color: '#10b981', margin: '0 auto 12px' }}/>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>All Clear</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {alerts.length === 0
                ? 'No alerts have been raised yet. Add a watch above to be notified when a parameter crosses your threshold.'
                : 'No alerts match this filter.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(a => (
              <AlertCard key={a.id} alert={a} expanded={expandedId === a.id} onExpand={toggleExpand}/>
            ))}
          </div>
        )}

        {/* Data provenance footer */}
        <div style={{ marginTop: 24, background: 'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(99,102,241,0.04))', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Database style={{ width: 15, height: 15, color: '#0ea5e9' }}/>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Where does this data come from?</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            Observations come from Water Rangers (citizen monitoring) and Algoma District partners that have been imported
            into this platform. When you press "Check now," each active watch reads the most recent row in the observations
            table for its site and parameter. Alerts are pure threshold math — no AI, no predictions — so every alert can
            be traced back to one exact measurement. Safe ranges shown in guidance cards are from Health Canada Guidelines
            for Canadian Drinking Water Quality and CCME Water Quality Guidelines for Aquatic Life.
          </p>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 50,
          padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'fire' ? '#f59e0b' : '#10b981',
          color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          {toast.text}
        </div>
      )}

      <style>{`
        @keyframes alertPing {
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
