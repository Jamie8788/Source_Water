import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { LineChart, Line, ReferenceLine, ReferenceArea, YAxis, XAxis, Tooltip as RTooltip, ResponsiveContainer } from 'recharts'
import api from '../utils/api'
import { playNibiTTS } from '../utils/voice'
import { legacyGuideForParameter, getWRParameter, WR_NA, WR_DOCS_URL } from '../utils/wrParameters'
import {
  AlertTriangle, Info, CheckCircle, Bell, BellOff,
  MapPin, Clock, RefreshCw, ChevronDown,
  Activity, Plus, Trash2, Power, PowerOff,
  Target, Database, Zap, BookOpen, Search, Globe,
  TrendingUp, TrendingDown, Minus, Sparkles,
  Volume2, VolumeX, Wifi, Radio, Calendar, ExternalLink, ShieldAlert,
  Download,
} from 'lucide-react'

/* ── Parameter guidance ── */
// PARAM_GUIDE is now a Proxy that returns Water Rangers-cited info on every
// lookup. If WR doesn't publish a value for a field, the field equals
// WR_NA ("Not specified by Water Rangers") — we never invent thresholds.
// Source: https://data.waterrangers.com/supported-parameters
const PARAM_GUIDE = new Proxy({}, {
  get(_t, key) {
    if (typeof key !== 'string') return undefined
    return legacyGuideForParameter(key)
  },
  has(_t, key) {
    return typeof key === 'string' && legacyGuideForParameter(key)._wr != null
  },
})

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

// Severity → marker color. Same palette as the cards.
const SEV_MAP_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' }

// AlertsMap: plots one marker per site that has alerts in the
// CURRENTLY-FILTERED list. The filter row above (Critical / Warnings /
// Active / etc.) drives both the list AND the map — change a filter and
// markers disappear with the cards. If the filtered list is empty but
// there are watches, falls back to plotting watches in green/grey so the
// map isn't blank when there's nothing triggered.
function AlertsMap({ filteredAlerts, watches, sites, totalAlerts, filterLabel }) {
  const bySite = useMemo(() => new Map(sites.map(s => [s.id, s])), [sites])

  // Group filtered alerts by site_id so a site with multiple alerts gets
  // one marker. Marker color = highest severity at that site.
  const alertPoints = useMemo(() => {
    const bySiteId = new Map()
    const sevRank = { high: 3, medium: 2, low: 1 }
    for (const a of filteredAlerts) {
      const sid = a.site_id
      const site = bySite.get(sid)
      if (!site || !site.latitude || !site.longitude) continue
      const existing = bySiteId.get(sid)
      if (!existing) {
        bySiteId.set(sid, {
          site_id: sid,
          lat: parseFloat(site.latitude),
          lng: parseFloat(site.longitude),
          site_name: site.name || a.site_name,
          body_of_water: site.body_of_water,
          alerts: [a],
          topSeverity: a.severity,
        })
      } else {
        existing.alerts.push(a)
        if ((sevRank[a.severity] || 0) > (sevRank[existing.topSeverity] || 0)) {
          existing.topSeverity = a.severity
        }
      }
    }
    return Array.from(bySiteId.values())
  }, [filteredAlerts, bySite])

  // Watch-only fallback points (when filter shows zero alerts but there
  // are watches set up). Lets the user still see "where my watches live".
  const watchPoints = useMemo(() => {
    const alertedSites = new Set(alertPoints.map(p => p.site_id))
    return watches
      .filter(w => !alertedSites.has(w.site_id))
      .map(w => {
        const site = bySite.get(w.site_id)
        if (!site || !site.latitude || !site.longitude) return null
        // A watch can be currently triggered (latest reading violates the
        // threshold) without yet having an alert row in the DB — alerts
        // only fire on "Check now" or the auto-check loop. Without this
        // we'd show pH < 8 with latest=7.2 as green "Watch OK". So we
        // recompute the breach state client-side from the latest known
        // value the watch row carries (current_value + comparator +
        // threshold).
        const v = w.current_value
        const t = parseFloat(w.threshold)
        const breached =
          w.has_data && Number.isFinite(t) && Number.isFinite(Number(v))
            ? (w.comparator === '>'  ? Number(v) >  t
             : w.comparator === '<'  ? Number(v) <  t
             : w.comparator === '>=' ? Number(v) >= t
             : w.comparator === '<=' ? Number(v) <= t : false)
            : false
        return {
          watch_id: w.id,
          site_id: w.site_id,
          lat: parseFloat(site.latitude),
          lng: parseFloat(site.longitude),
          site_name: site.name,
          body_of_water: site.body_of_water,
          parameter: w.parameter_label || w.parameter,
          comparator: w.comparator,
          threshold: w.threshold,
          current_value: v,
          observed_at: w.observed_at,
          severity: w.severity,
          active: w.active === 1 || w.active === true,
          has_data: !!w.has_data,
          triggered: breached,
        }
      })
      .filter(Boolean)
  }, [watches, alertPoints, bySite])

  // Hide the whole map when there's nothing to show at all.
  const totalPoints = alertPoints.length + watchPoints.length
  if (watches.length === 0 && totalAlerts === 0) return null
  if (totalPoints === 0) {
    return (
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
        No watches or alerts have coordinates on file{filterLabel ? ` for "${filterLabel}"` : ''} — map view unavailable.
      </div>
    )
  }

  // FitBounds key forces a re-fit when the filtered set changes.
  const fitPoints = [...alertPoints, ...watchPoints]

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin style={{ width: 14, height: 14, color: '#6366f1' }}/>
          <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>
            Alerts &amp; Watches Map
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              {alertPoints.length} site{alertPoints.length === 1 ? '' : 's'} alerting
              {filterLabel ? ` · filter: ${filterLabel}` : ''}
              {watchPoints.length ? ` · ${watchPoints.length} other watched site${watchPoints.length === 1 ? '' : 's'}` : ''}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <LegendDot color={SEV_MAP_COLOR.high}   label="Critical"/>
          <LegendDot color={SEV_MAP_COLOR.medium} label="Warning"/>
          <LegendDot color={SEV_MAP_COLOR.low}    label="Advisory"/>
          <LegendDot color="#10b981" label="Watch OK"/>
          <LegendDot color="#64748b" label="No data"/>
        </div>
      </div>
      <div key={`alerts-map-${alertPoints.length}-${watchPoints.length}`}
        style={{ height: 280, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <MapContainer center={[46.5, -84]} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer
            attribution='Tiles &copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          />
          <FitBounds points={fitPoints}/>
          {/* Alerted sites — colored by highest severity at that site */}
          {alertPoints.map(p => {
            const color = SEV_MAP_COLOR[p.topSeverity] || '#ef4444'
            return (
              <CircleMarker
                key={`alert-${p.site_id}`}
                center={[p.lat, p.lng]}
                radius={p.alerts.length > 1 ? 13 : 11}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 3 }}>
                <Popup>
                  <div style={{ fontSize: 12, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.site_name}</div>
                    {p.body_of_water && <div style={{ color: '#64748b', marginBottom: 6 }}>{p.body_of_water}</div>}
                    <div style={{ padding: '6px 8px', borderRadius: 6, background: '#fee2e2', border: '1px solid #fecaca' }}>
                      <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                        {p.alerts.length} alert{p.alerts.length === 1 ? '' : 's'} matching filter
                      </div>
                      {p.alerts.slice(0, 4).map((a, i) => (
                        <div key={i} style={{ fontSize: 11, marginTop: i === 0 ? 0 : 3, color: '#1f2937' }}>
                          <strong>{a.parameter_label || a.parameter}</strong> {a.comparator} {a.threshold_value}
                          {a.current_value != null && <> · latest: <strong style={{ color: '#dc2626' }}>{a.current_value}</strong></>}
                          {a.severity && (
                            <span style={{ marginLeft: 4, fontSize: 9, padding: '0 5px', borderRadius: 8, background: SEV_MAP_COLOR[a.severity] + '22', color: SEV_MAP_COLOR[a.severity] }}>
                              {a.severity === 'high' ? 'Critical' : a.severity === 'medium' ? 'Warning' : 'Advisory'}
                            </span>
                          )}
                        </div>
                      ))}
                      {p.alerts.length > 4 && <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>+{p.alerts.length - 4} more</div>}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
          {/* Watch-only sites with no current alerts in the filtered set.
              If the watch is in breach (latest reading violates the
              threshold) we color by severity even if no alert row
              exists yet — otherwise a paused watch is grey, an active
              watch with no breach is green, no-data is grey-dashed. */}
          {watchPoints.map(p => {
            let color, fillOpacity, weight, radius, dashArray
            if (!p.has_data) {
              color = '#64748b'; fillOpacity = 0.5; weight = 2; radius = 6; dashArray = '3 3'
            } else if (p.triggered && p.active) {
              color = SEV_MAP_COLOR[p.severity] || '#ef4444'
              fillOpacity = 0.85; weight = 3; radius = 11; dashArray = null
            } else if (p.active) {
              color = '#10b981'; fillOpacity = 0.5; weight = 2; radius = 6; dashArray = null
            } else {
              color = '#64748b'; fillOpacity = 0.4; weight = 2; radius = 6; dashArray = '3 3'
            }
            const triggered = p.triggered && p.active
            return (
              <CircleMarker
                key={`watch-${p.watch_id}`}
                center={[p.lat, p.lng]}
                radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity, weight, dashArray }}>
                <Popup>
                  <div style={{ fontSize: 12, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.site_name}</div>
                    {p.body_of_water && <div style={{ color: '#64748b', marginBottom: 6 }}>{p.body_of_water}</div>}
                    <div style={{
                      padding: '6px 8px', borderRadius: 6,
                      background: triggered ? '#fee2e2' : '#dcfce7',
                      border: `1px solid ${triggered ? '#fecaca' : '#bbf7d0'}`,
                    }}>
                      <div style={{ fontWeight: 700, color: triggered ? '#991b1b' : '#1f2937' }}>
                        {p.parameter} {p.comparator} {p.threshold}
                      </div>
                      {p.has_data && p.current_value != null && (
                        <div style={{ marginTop: 3, fontSize: 11, color: triggered ? '#dc2626' : '#16a34a' }}>
                          Latest: <strong>{p.current_value}</strong>
                          {triggered && <> · <strong>in breach</strong></>}
                        </div>
                      )}
                      <div style={{ marginTop: 3, fontSize: 11, color: triggered ? '#dc2626' : '#16a34a' }}>
                        {!p.active
                          ? 'Watch paused'
                          : !p.has_data
                            ? 'Watch active — no observations yet'
                            : triggered
                              ? 'Watch in breach — press "Check now" to fire alert'
                              : 'Watch active — within threshold'}
                      </div>
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
  // Treat WR's "Not specified" sentinel + the legacy n/a strings as "no band".
  if (s === WR_NA.toLowerCase() || s.includes('not specified')) return null
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
/* ── Live Sync Status Bar ──
   Shows the user that the alerts page is actively pulling from Water Rangers
   and the local DB. Animated pulse + countdown + auto-refresh toggle.
   No new backend calls — pure UI on top of the existing 30s poll. */
function LiveSyncBar({ lastSync, autoCheck, setAutoCheck, autoCheckInterval, setAutoCheckInterval, onRefresh, refreshing, onCheckNow, checking, soundOn, setSoundOn, totalAlerts, activeWatches }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const elapsed = Math.max(0, Math.round((now - lastSync) / 1000))
  const nextSyncIn = Math.max(0, 30 - (elapsed % 30))
  const elapsedLabel = elapsed < 60 ? `${elapsed}s ago` : elapsed < 3600 ? `${Math.round(elapsed/60)}m ago` : `${Math.round(elapsed/3600)}h ago`

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(99,102,241,0.04) 60%, var(--card-bg))',
      border: '1.5px solid rgba(16,185,129,0.25)',
      borderRadius: 14, padding: '12px 16px', marginBottom: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      boxShadow: '0 0 24px rgba(16,185,129,0.06)',
    }}>
      {/* Left: live status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 4px rgba(16,185,129,0.18)' }}/>
            <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', background: '#10b981', opacity: 0.45, animation: 'liveSyncPing 1.6s ease-out infinite' }}/>
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 11 }}>
          <Wifi size={11}/> Last synced <strong style={{ color: 'var(--text)' }}>{elapsedLabel}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 11 }}>
          <RefreshCw size={11}/> Next refresh in <strong style={{ color: 'var(--text)' }}>{nextSyncIn}s</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 11 }}>
          <Database size={11}/> {totalAlerts} alert{totalAlerts === 1 ? '' : 's'} · {activeWatches} watch{activeWatches === 1 ? '' : 'es'}
        </div>
      </div>

      {/* Right: controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {/* Auto-check select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 8, background: autoCheck ? 'rgba(99,102,241,0.12)' : 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Radio size={11} color={autoCheck ? '#a78bfa' : 'var(--text-muted)'}/>
          <label style={{ fontSize: 10, fontWeight: 700, color: autoCheck ? '#a78bfa' : 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoCheck} onChange={e => setAutoCheck(e.target.checked)} style={{ marginRight: 4, verticalAlign: '-1px' }}/>
            Auto-check watches
          </label>
          {autoCheck && (
            <select value={autoCheckInterval} onChange={e => setAutoCheckInterval(parseInt(e.target.value))}
              style={{ marginLeft: 4, padding: '2px 4px', borderRadius: 5, fontSize: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#a78bfa' }}>
              <option value={5}>every 5 min</option>
              <option value={10}>every 10 min</option>
              <option value={30}>every 30 min</option>
              <option value={60}>hourly</option>
            </select>
          )}
        </div>
        {/* Sound toggle */}
        <button onClick={() => setSoundOn(s => !s)}
          title={soundOn ? 'Sound on for new alerts' : 'Sound muted'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 8,
            background: soundOn ? 'rgba(245,158,11,0.12)' : 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: soundOn ? '#f59e0b' : 'var(--text-muted)',
            fontSize: 10, fontWeight: 700, cursor: 'pointer',
          }}>
          {soundOn ? <Volume2 size={11}/> : <VolumeX size={11}/>}
          {soundOn ? 'Sound' : 'Muted'}
        </button>
        {/* Manual check */}
        <button onClick={onCheckNow} disabled={checking}
          title="Re-evaluate every active watch against the latest live data"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8,
            background: 'rgba(99,102,241,0.16)', border: '1px solid rgba(99,102,241,0.35)',
            color: '#a78bfa', fontSize: 11, fontWeight: 800, cursor: checking ? 'wait' : 'pointer',
            opacity: checking ? 0.6 : 1,
          }}>
          <Zap size={11} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }}/>
          {checking ? 'Checking…' : 'Check now'}
        </button>
        {/* Manual refresh */}
        <button onClick={onRefresh} disabled={refreshing}
          title="Reload alerts and watches from the server"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: refreshing ? 'wait' : 'pointer',
          }}>
          <RefreshCw size={11} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}/>
        </button>
      </div>

      <style>{`
        @keyframes liveSyncPing { 70%, 100% { transform: scale(2); opacity: 0; } }
      `}</style>
    </div>
  )
}

// Tiny WAV chime generated in JS so we don't ship an audio asset. ~120ms.
// Two-tone (E5 then A5) — gentle, not alarming.
function playAlertChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const tones = [{ f: 659.25, t: 0 }, { f: 880.00, t: 0.13 }] // E5, A5
    for (const tone of tones) {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = tone.f
      g.gain.setValueAtTime(0, ctx.currentTime + tone.t)
      g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + tone.t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + tone.t + 0.32)
      o.connect(g); g.connect(ctx.destination)
      o.start(ctx.currentTime + tone.t); o.stop(ctx.currentTime + tone.t + 0.35)
    }
    setTimeout(() => ctx.close(), 1000)
  } catch {}
}

function AlertCard({ alert, onExpand, expanded, siteRow }) {
  const cfg = SEV_CONFIG[alert.severity] || SEV_CONFIG.info
  const Icon = cfg.icon
  const isActive = alert.active === 1 || alert.active === true
  const guide = PARAM_GUIDE[alert.parameter]
  const isCritical = alert.severity === 'high' && isActive
  const isWR = siteRow?.external_source === 'waterrangers'
  const wrUrl = isWR && siteRow?.external_id
    ? `https://data.waterrangers.com/locations/${siteRow.external_id}`
    : null

  // "Active for X days" — distance between when the alert was first raised and now.
  const ageMs = alert.created_at ? (Date.now() - new Date(alert.created_at).getTime()) : null
  const ageLabel = (() => {
    if (!ageMs || ageMs < 0) return null
    const day = 86400000
    if (ageMs < day) return `Active for ${Math.round(ageMs / 3600000)}h`
    if (ageMs < 30 * day) return `Active for ${Math.round(ageMs / day)}d`
    return `Active for ${Math.round(ageMs / (30 * day))} months`
  })()

  // Plain-English summary of why this alert fired — pure rule-based, no LLM.
  // Uses the parameter guide + the comparison between current value and threshold.
  const plainSummary = useMemo(() => {
    const bits = []
    const v = alert.current_value, t = alert.threshold_value
    const param = (alert.parameter || 'parameter').replace(/_/g, ' ')
    if (v != null && t != null) {
      const diff = (v - t).toFixed(2)
      if (alert.severity === 'high') {
        bits.push(`The latest ${param} reading at ${alert.site_name || 'this site'} is ${v}, which is ${Math.abs(diff)} ${diff > 0 ? 'above' : 'below'} your threshold of ${t}.`)
      } else {
        bits.push(`The latest ${param} reading is ${v}, just past your watch threshold of ${t}.`)
      }
    } else if (v != null) {
      bits.push(`The latest ${param} reading at ${alert.site_name || 'this site'} is ${v}.`)
    }
    if (guide?.safe && guide.safe !== 'n/a' && guide.safe !== 'site-dependent') {
      bits.push(`The reference safe range is ${guide.safe}${guide.unit ? ' ' + guide.unit : ''}.`)
    }
    if (guide?.hint) bits.push(guide.hint)
    if (guide?.typicalAlgoma && guide.typicalAlgoma !== '—') {
      bits.push(`For context, typical Algoma readings are ${guide.typicalAlgoma}.`)
    }
    return bits.join(' ')
  }, [alert, guide])

  // Read aloud — uses the same /api/ai/tts (Microsoft AnaNeural — free,
  // sounds like a real young woman) as Ask Water. No more sore-throat voice.
  const [speaking, setSpeaking] = useState(false)
  const ttsCtrlRef = useRef(null)
  const speechText = useMemo(() => {
    const parts = [`${cfg.label} alert.`, plainSummary]
    if (ageLabel) parts.push(ageLabel + '.')
    return parts.join(' ')
  }, [cfg, plainSummary, ageLabel])

  useEffect(() => () => { ttsCtrlRef.current?.stop?.() }, [])
  const onReadAloud = (e) => {
    e.stopPropagation()
    if (speaking) { ttsCtrlRef.current?.stop?.(); setSpeaking(false); return }
    setSpeaking(true)
    const ctrl = playNibiTTS(speechText)
    ttsCtrlRef.current = ctrl
    ctrl.onEnd(() => setSpeaking(false))
  }

  return (
    <div style={{
      background: isCritical
        ? `linear-gradient(135deg, ${cfg.color}10, transparent 70%), var(--card-bg)`
        : 'var(--card-bg)',
      borderRadius: 14,
      border: `1px solid ${expanded ? cfg.color + '60' : cfg.border}`,
      overflow: 'hidden', transition: 'all 0.2s',
      boxShadow: expanded
        ? `0 0 24px ${cfg.color}18`
        : isCritical ? `0 0 18px ${cfg.color}10` : 'none',
      position: 'relative',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <button onClick={onReadAloud}
                  title={speaking ? 'Stop reading' : 'Read this alert aloud'}
                  style={{
                    background: speaking ? cfg.color : 'transparent', border: 'none', cursor: 'pointer',
                    color: speaking ? '#fff' : cfg.color, padding: 5, borderRadius: 6,
                    display: 'flex', alignItems: 'center',
                  }}>
                  {speaking ? <VolumeX style={{ width: 13, height: 13 }}/> : <Volume2 style={{ width: 13, height: 13 }}/>}
                </button>
                <button onClick={() => onExpand(alert.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}>
                  <ChevronDown style={{ width: 15, height: 15, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
                </button>
              </div>
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
              {ageLabel && isActive && (
                <span title="How long this alert has been firing without being resolved"
                  style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar style={{ width: 10, height: 10 }}/> {ageLabel}
                </span>
              )}
              {isWR && (
                <span title="Live data — this alert is fed by data.waterrangers.com on every check"
                  style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, color: '#0ea5e9', background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.35)', display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.04em' }}>
                  <Globe style={{ width: 10, height: 10 }}/> WR LIVE
                </span>
              )}
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

        {expanded && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* What this means — rule-based plain English (no LLM call) */}
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: `linear-gradient(135deg, ${cfg.color}10, transparent 70%), rgba(255,255,255,0.02)`,
              border: `1px solid ${cfg.color}30`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: cfg.color, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <Info style={{ width: 11, height: 11 }}/> What this means
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6 }}>{plainSummary}</div>
            </div>

            {/* What should I do? — only when active and we have a guide hint */}
            {isActive && guide && (
              <div style={{
                padding: '12px 14px', borderRadius: 10,
                background: `${cfg.color}0d`,
                border: `1px solid ${cfg.color}40`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: cfg.color, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  <ShieldAlert style={{ width: 11, height: 11 }}/> What should I do?
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
                  {alert.severity === 'high'
                    ? `Do not drink water from this site without treatment. Flag this reading to a local water authority (Algoma Public Health, Conservation Authority, or your local Water Rangers chapter).`
                    : alert.severity === 'medium'
                      ? `Track this. If the next sampling round confirms the same direction, escalate to your local water authority. Avoid drinking unfiltered water from this site in the meantime.`
                      : `Awareness only — keep an eye on subsequent readings. No immediate action required.`}
                </div>
              </div>
            )}

            {/* Reference card — every value comes from the Water Rangers
                supported-parameters page. When WR doesn't publish a value
                the field reads "Not specified by Water Rangers" — we
                never invent thresholds. */}
            {guide && (
              <div style={{ padding: '10px 12px', background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.18)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BookOpen style={{ width: 12, height: 12, color: '#0ea5e9' }}/>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reference (Water Rangers)</span>
                  </div>
                  <a href={WR_DOCS_URL} target="_blank" rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 10, color: '#0ea5e9', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                    Source <ExternalLink style={{ width: 9, height: 9, opacity: 0.7 }}/>
                  </a>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, fontSize: 11.5, color: 'var(--text)' }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>WR QA "Needs review" band</div>
                    <div style={{ fontWeight: 700 }}>{guide.safe === WR_NA ? <em style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{WR_NA}</em> : `${guide.safe}${guide.unit ? '' : ''}`}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>WR Equipment listed</div>
                    <div style={{ fontWeight: 700 }}>{guide._wr?.equipment?.length ? `${guide._wr.equipment.length} option${guide._wr.equipment.length === 1 ? '' : 's'}` : <em style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{WR_NA}</em>}</div>
                  </div>
                </div>
                {guide.hint !== WR_NA && (
                  <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>{guide.hint}</div>
                )}

                {/* WR-style info popup content — only rendered if WR publishes it */}
                {guide._wr?.whatIsIt && (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(14,165,233,0.04)', borderRadius: 8, border: '1px dashed rgba(14,165,233,0.25)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>What is it?</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text)', lineHeight: 1.5 }}>{guide._wr.whatIsIt}</div>
                    {guide._wr.whyImportant && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 8, marginBottom: 4 }}>Why is it important?</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text)', lineHeight: 1.5 }}>{guide._wr.whyImportant}</div>
                      </>
                    )}
                    {Array.isArray(guide._wr.bands) && guide._wr.bands.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 8, marginBottom: 4 }}>What does it mean?</div>
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: 'var(--text)', lineHeight: 1.5 }}>
                          {guide._wr.bands.map((b, i) => (
                            <li key={i}><strong>{b.range}</strong> — {b.label}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {Array.isArray(guide._wr.howToTest) && guide._wr.howToTest.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 8, marginBottom: 4 }}>How to test</div>
                        <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--text)', lineHeight: 1.45 }}>
                          {guide._wr.howToTest.map((step, i) => <li key={i} style={{ marginBottom: 2 }}>{step}</li>)}
                        </ol>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons — open WR site directly OR view on map */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {wrUrl && (
                <a href={wrUrl} target="_blank" rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open this exact site on data.waterrangers.com"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.35)',
                    color: '#0ea5e9', textDecoration: 'none', cursor: 'pointer',
                  }}>
                  <Globe style={{ width: 12, height: 12 }}/> View on Water Rangers <ExternalLink style={{ width: 10, height: 10, opacity: 0.7 }}/>
                </a>
              )}
              {alert.site_id && (
                <a href={`/monitoring`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.30)',
                    color: '#a78bfa', textDecoration: 'none', cursor: 'pointer',
                  }}>
                  <MapPin style={{ width: 12, height: 12 }}/> Open in Site Map
                </a>
              )}
              <a href={`/ai-lab`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.30)',
                  color: '#a78bfa', textDecoration: 'none', cursor: 'pointer',
                }}>
                <Sparkles style={{ width: 12, height: 12 }}/> Analyze in AI Lab
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Stats Bar ── */
function StatsBar({ alerts, watches }) {
  const active = alerts.filter(a => a.active === 1 || a.active === true)
  const high   = active.filter(a => a.severity === 'high').length
  const medium = active.filter(a => a.severity === 'medium').length
  const low    = active.filter(a => a.severity === 'low').length
  const watchesActive = watches.filter(w => w.active === 1 || w.active === true).length
  const watchesPaused = watches.length - watchesActive
  // Watches breakdown displayed as "active / total" so a researcher
  // can see at a glance whether some watches are paused.
  const watchSubtitle = watchesPaused > 0 ? `${watchesActive} active / ${watches.length} total` : 'My Watches'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
      {[
        { label: 'Active Alerts', value: active.length, color: '#ef4444', icon: Bell, pulse: active.length > 0 },
        { label: 'Critical',      value: high,           color: '#ef4444', icon: AlertTriangle },
        { label: 'Warnings',      value: medium,         color: '#f59e0b', icon: AlertTriangle },
        { label: 'Advisories',    value: low,            color: '#10b981', icon: Info },
        { label: watchSubtitle,   value: watches.length, color: '#6366f1', icon: Activity },
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
  const [source, setSource] = useState('wr') // 'wr' | 'local' — default to 9,400+ Water Rangers search

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
          {/* Source toggle: search 9,400+ Water Rangers sites (default) or pick from already-adopted local list */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => { setSource('wr'); setForm(f => ({ ...f, site_id: '' })) }}
              style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, background: source === 'wr' ? '#0ea5e9' : 'var(--border)', color: source === 'wr' ? '#fff' : 'var(--text-muted)' }}>
              <Globe style={{ width: 12, height: 12 }}/> Water Rangers (9,400+)
            </button>
            <button type="button" onClick={() => { setSource('local'); setForm(f => ({ ...f, site_id: '' })) }}
              style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, background: source === 'local' ? '#6366f1' : 'var(--border)', color: source === 'local' ? '#fff' : 'var(--text-muted)' }}>
              <Database style={{ width: 12, height: 12 }}/> Already adopted ({sites.filter(s => s.external_source !== 'waterrangers').length + sites.filter(s => s.external_source === 'waterrangers').length})
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Search any lake / river / community across Canada — pick a site, then set the parameter and threshold below.
            </span>
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
  // Researcher filters — text search, parameter, site, sort, time range.
  // All client-side because the alerts list is small and filtering is instant.
  const [search, setSearch]       = useState('')
  const [paramFilter, setParamFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [sortBy, setSortBy]       = useState('recent') // recent | oldest | severity | parameter | site
  const [timeRange, setTimeRange] = useState('all')    // all | 24h | 7d | 30d | 90d
  const [expandedId, setExpandedId] = useState(null)
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [loading, setLoading]     = useState(false)
  const [checking, setChecking]   = useState(false)
  const [toast, setToast]         = useState(null)

  // ── Premium live-sync controls ──
  const [lastSync, setLastSync] = useState(Date.now())
  const [autoCheck, setAutoCheck] = useState(() => { try { return localStorage.getItem('sw_alerts_autocheck') === '1' } catch { return false } })
  const [autoCheckInterval, setAutoCheckInterval] = useState(() => { try { return parseInt(localStorage.getItem('sw_alerts_autocheck_min') || '10') } catch { return 10 } })
  const [soundOn, setSoundOn] = useState(() => { try { return localStorage.getItem('sw_alerts_sound') !== '0' } catch { return true } })
  const knownAlertIds = useRef(new Set())  // for sound-on-new-alert detection
  const firstLoad = useRef(true)
  useEffect(() => { try { localStorage.setItem('sw_alerts_autocheck', autoCheck ? '1' : '0') } catch {} }, [autoCheck])
  useEffect(() => { try { localStorage.setItem('sw_alerts_autocheck_min', String(autoCheckInterval)) } catch {} }, [autoCheckInterval])
  useEffect(() => { try { localStorage.setItem('sw_alerts_sound', soundOn ? '1' : '0') } catch {} }, [soundOn])

  const loadAlerts = async () => {
    try {
      const r = await api.get('/admin/alerts')
      const list = Array.isArray(r.data?.alerts) ? r.data.alerts : []
      // Detect newly-arrived alert IDs (skip on first load to avoid chiming on page open)
      if (!firstLoad.current && soundOn) {
        const fresh = list.filter(a => !knownAlertIds.current.has(a.id) && (a.active === 1 || a.active === true))
        if (fresh.length > 0) playAlertChime()
      }
      knownAlertIds.current = new Set(list.map(a => a.id))
      firstLoad.current = false
      setAlerts(list)
      setLastSync(Date.now())
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

  // Auto-check: when enabled, re-evaluates every active watch against the
  // latest live observation (Water Rangers for adopted sites, local DB
  // otherwise) on the chosen interval. Pauses when the tab is hidden so
  // the dashboard doesn't keep firing checks in the background.
  useEffect(() => {
    if (!autoCheck) return
    const ms = Math.max(1, autoCheckInterval) * 60_000
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      checkNow()
    }
    const t = setInterval(tick, ms)
    return () => clearInterval(t)
  }, [autoCheck, autoCheckInterval])

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

  // Counts per severity / state — used to show "(n)" next to each filter
  // pill so a researcher knows how many alerts match before clicking.
  const counts = useMemo(() => {
    const c = { all: alerts.length, active: 0, resolved: 0, high: 0, medium: 0, low: 0 }
    for (const a of alerts) {
      const isActive = a.active === 1 || a.active === true
      if (isActive) c.active++; else c.resolved++
      if (a.severity && c[a.severity] != null) c[a.severity]++
    }
    return c
  }, [alerts])

  // Distinct parameter & site options for the dropdown filters — derived
  // from the actual alert list so we never offer an option that has no
  // matching alert.
  const paramOptions = useMemo(() => {
    const m = new Map()
    for (const a of alerts) {
      const k = a.parameter || ''
      if (!k) continue
      m.set(k, (a.parameter_label || k).toString())
    }
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [alerts])
  const siteOptions = useMemo(() => {
    const m = new Map()
    for (const a of alerts) {
      const k = a.site_id || a.site_name || ''
      if (!k) continue
      m.set(String(k), (a.site_name || `Site ${k}`).toString())
    }
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [alerts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = Date.now()
    const rangeMs = timeRange === '24h' ? 86400000
                  : timeRange === '7d'  ? 7 * 86400000
                  : timeRange === '30d' ? 30 * 86400000
                  : timeRange === '90d' ? 90 * 86400000
                  : null

    let list = alerts.filter(a => {
      const isActive = a.active === 1 || a.active === true
      // Severity / state pill
      if (filter === 'active'   && !isActive) return false
      if (filter === 'resolved' &&  isActive) return false
      if (['high','medium','low'].includes(filter) && a.severity !== filter) return false
      // Parameter dropdown
      if (paramFilter && a.parameter !== paramFilter) return false
      // Site dropdown
      if (siteFilter && String(a.site_id || a.site_name || '') !== siteFilter) return false
      // Time range
      if (rangeMs && a.created_at) {
        const t = new Date(a.created_at).getTime()
        if (!isFinite(t) || (now - t) > rangeMs) return false
      }
      // Free-text search across site name + parameter + message
      if (q) {
        const hay = `${a.site_name || ''} ${a.parameter || ''} ${a.parameter_label || ''} ${a.message || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    // Sort
    const sevRank = { high: 3, medium: 2, low: 1 }
    list = list.slice().sort((a, b) => {
      if (sortBy === 'oldest')    return new Date(a.created_at || 0) - new Date(b.created_at || 0)
      if (sortBy === 'severity')  return (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0)
      if (sortBy === 'parameter') return String(a.parameter || '').localeCompare(String(b.parameter || ''))
      if (sortBy === 'site')      return String(a.site_name || '').localeCompare(String(b.site_name || ''))
      // 'recent' default
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })
    return list
  }, [alerts, filter, search, paramFilter, siteFilter, sortBy, timeRange])

  // CSV export of the currently-filtered list — researcher convenience.
  const exportCSV = () => {
    const rows = [['id','severity','active','site_id','site_name','parameter','comparator','threshold','current_value','created_at','message']]
    for (const a of filtered) {
      rows.push([
        a.id, a.severity, (a.active === 1 || a.active === true) ? 'active' : 'resolved',
        a.site_id || '', a.site_name || '', a.parameter || '', a.comparator || '',
        a.threshold_value ?? '', a.current_value ?? '', a.created_at || '', (a.message || '').replace(/\n/g, ' '),
      ])
    }
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `alerts-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  const resetFilters = () => {
    setFilter('all'); setSearch(''); setParamFilter(''); setSiteFilter(''); setSortBy('recent'); setTimeRange('all')
  }

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
          </div>
        </div>

        <LiveSyncBar
          lastSync={lastSync}
          autoCheck={autoCheck} setAutoCheck={setAutoCheck}
          autoCheckInterval={autoCheckInterval} setAutoCheckInterval={setAutoCheckInterval}
          onRefresh={refreshAll} refreshing={loading}
          onCheckNow={checkNow} checking={checking}
          soundOn={soundOn} setSoundOn={setSoundOn}
          totalAlerts={alerts.length}
          activeWatches={watches.filter(w => w.active === 1 || w.active === true).length}
        />

        <StatsBar alerts={alerts} watches={watches}/>

        <HowItWorks/>

        <AlertsMap
          filteredAlerts={filtered}
          watches={watches}
          sites={sites}
          totalAlerts={alerts.length}
          filterLabel={(() => {
            const bits = []
            if (filter !== 'all') bits.push(filter === 'high' ? 'Critical' : filter === 'medium' ? 'Warning' : filter === 'low' ? 'Advisory' : filter[0].toUpperCase() + filter.slice(1))
            if (paramFilter)      bits.push(paramFilter.replace(/_/g, ' '))
            if (siteFilter)       { const opt = siteOptions.find(o => o[0] === siteFilter); bits.push(opt ? opt[1] : siteFilter) }
            if (timeRange !== 'all') bits.push(`last ${timeRange}`)
            if (search.trim())    bits.push(`"${search.trim()}"`)
            return bits.join(' · ')
          })()}
        />

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

        {/* Researcher toolbar — severity pills + search + parameter/site/time/sort + CSV export.
            Counts in parentheses come from the unfiltered alerts list so a
            researcher can see how many would match before clicking. */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          {/* Row 1: severity pills with live counts */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {[
              { v: 'all',      label: 'All',        n: counts.all,      pillColor: '#6366f1' },
              { v: 'active',   label: 'Active',     n: counts.active,   pillColor: '#10b981' },
              { v: 'high',     label: 'Critical',   n: counts.high,     pillColor: '#ef4444' },
              { v: 'medium',   label: 'Warnings',   n: counts.medium,   pillColor: '#f59e0b' },
              { v: 'low',      label: 'Advisories', n: counts.low,      pillColor: '#10b981' },
              { v: 'resolved', label: 'Resolved',   n: counts.resolved, pillColor: '#64748b' },
            ].map(f => {
              const sel = filter === f.v
              return (
                <button key={f.v} onClick={() => setFilter(f.v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700,
                    background: sel ? `${f.pillColor}1f` : 'var(--border)',
                    color: sel ? f.pillColor : 'var(--text-muted)',
                  }}>
                  {f.label}
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    padding: '1px 7px', borderRadius: 20,
                    background: sel ? f.pillColor : 'rgba(255,255,255,0.06)',
                    color: sel ? '#fff' : 'var(--text-muted)',
                  }}>{f.n}</span>
                </button>
              )
            })}
          </div>

          {/* Row 2: search + dropdowns + CSV */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12, pointerEvents: 'none' }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search site, parameter, or message…"
                style={{
                  width: '100%', padding: '7px 10px 7px 28px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--page-bg)', color: 'var(--text)',
                  fontSize: 12,
                }}
              />
            </div>
            <select value={paramFilter} onChange={e => setParamFilter(e.target.value)}
              title="Filter by parameter"
              style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12 }}>
              <option value="">All parameters</option>
              {paramOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}
              title="Filter by site"
              style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12, maxWidth: 200 }}>
              <option value="">All sites</option>
              {siteOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
              title="Filter by alert age"
              style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12 }}>
              <option value="all">All time</option>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              title="Sort order"
              style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12 }}>
              <option value="recent">Sort: most recent</option>
              <option value="oldest">Sort: oldest first</option>
              <option value="severity">Sort: severity</option>
              <option value="parameter">Sort: parameter</option>
              <option value="site">Sort: site</option>
            </select>
            <button onClick={exportCSV} disabled={filtered.length === 0}
              title={filtered.length ? `Download ${filtered.length} matching alert${filtered.length === 1 ? '' : 's'} as CSV` : 'No matching alerts to export'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 8, border: 'none', cursor: filtered.length ? 'pointer' : 'not-allowed',
                fontSize: 12, fontWeight: 700,
                background: 'rgba(14,165,233,0.12)', color: '#0ea5e9',
                opacity: filtered.length ? 1 : 0.5,
              }}>
              <Download style={{ width: 12, height: 12 }}/> CSV ({filtered.length})
            </button>
            {(search || paramFilter || siteFilter || timeRange !== 'all' || sortBy !== 'recent' || filter !== 'all') && (
              <button onClick={resetFilters}
                title="Clear all filters"
                style={{
                  padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, background: 'transparent', color: 'var(--text-muted)',
                }}>
                Clear
              </button>
            )}
          </div>

          {/* Result count line */}
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            Showing <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> of {alerts.length} alert{alerts.length === 1 ? '' : 's'}
            {sortBy !== 'recent' && ` · sorted by ${sortBy === 'oldest' ? 'oldest first' : sortBy}`}
          </div>
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
              <AlertCard key={a.id} alert={a} expanded={expandedId === a.id} onExpand={toggleExpand}
                siteRow={sites.find(s => s.id === a.site_id)}/>
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
            be traced back to one exact measurement. "Needs review" / "issue detected" bands and equipment lists shown in
            the reference cards come directly from{' '}
            <a href={WR_DOCS_URL} target="_blank" rel="noreferrer" style={{ color: '#0ea5e9' }}>Water Rangers' supported-parameters page</a>
            ; if Water Rangers does not publish a value, the card says so — we never invent thresholds.
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
