/**
 * WRAILab — Site-specific AI Analysis Lab
 * 1. Pick a monitoring site from 9,444 locations
 * 2. Load ALL its observations
 * 3. Run anomaly detection + trends on THAT site
 * 4. Charts for THAT site
 * 5. Research AI grounded in THAT site's real data
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ScatterChart, Scatter,
  ReferenceArea, ReferenceLine, ComposedChart,
} from 'recharts'
import {
  Brain, TrendingUp, AlertTriangle, Send, RefreshCw, Download,
  Loader, BarChart2, MapPin, Search, ExternalLink,
  Sparkles, CheckCircle2, AlertCircle, XCircle, Info, ArrowUpRight, ArrowDownRight, Minus,
  Volume2, VolumeX, Calendar, ShieldAlert, HeartPulse,
} from 'lucide-react'
import { getAllLocations, getLocationObservations } from '../api/waterRangers'
import api from '../utils/api'
import { playNibiTTS } from '../utils/voice'
import { matchParam } from '../utils/waterParams'
import { getWRParameter, WR_DOCS_URL } from '../utils/wrParameters'
import { getPlainEnglish } from '../utils/plainEnglishParams'
import ParameterDeepDive from '../components/ParameterDeepDive'

// WHO thresholds
const WHO = {
  ph: { min: 6.5, max: 8.5, unit: '', label: 'pH', explain: 'Acidity/alkalinity' },
  water_temperature: { min: 0, max: 30, unit: '°C', label: 'Water Temp', explain: 'Affects oxygen & life' },
  oxygen: { min: 6, max: 20, unit: 'mg/L', label: 'Dissolved Oxygen', explain: 'Fish need >6' },
  dissolved_oxygen: { min: 6, max: 20, unit: 'mg/L', label: 'DO', explain: 'Aquatic life oxygen' },
  conductivity: { min: 0, max: 1500, unit: 'µS/cm', label: 'Conductivity', explain: 'Mineral/salt content' },
  hardness: { min: 0, max: 500, unit: 'ppm', label: 'Hardness', explain: 'Calcium + magnesium' },
  alkalinity: { min: 20, max: 200, unit: 'ppm', label: 'Alkalinity', explain: 'pH buffer capacity' },
  chlorine: { min: 0, max: 5, unit: 'mg/L', label: 'Chlorine', explain: 'Disinfectant level' },
  phosphates: { min: 0, max: 0.1, unit: 'mg/L', label: 'Phosphates', explain: 'Algae bloom risk' },
  phosphorus: { min: 0, max: 0.03, unit: 'mg/L', label: 'Phosphorus', explain: 'Nutrient pollution' },
  nitrate: { min: 0, max: 10, unit: 'mg/L', label: 'Nitrate', explain: 'Fertilizer/sewage' },
}

function analyze(observations) {
  const anomalies = []
  const byParam = {}
  const qaBreakdown = {}
  // WR's "datapoints" count includes EVERY reading on every observation —
  // numeric, text, qualitative, anything. Their 773 vs our 604 is exactly that
  // gap: we drop non-numeric / no-unit / 'nil'-unit readings because you can't
  // chart "brown colour" or "no odour". Track both so the UI can be honest.
  let totalDatapointsRaw = 0

  for (const obs of observations) {
    qaBreakdown[obs.checked] = (qaBreakdown[obs.checked] || 0) + 1
    const readings = obs.readings || []
    totalDatapointsRaw += readings.length

    // Take ONE numeric reading per parameter per observation. Some sampling
    // visits log a parameter twice (e.g. test-strip + digital meter as a QA
    // cross-check). Counting both inflates the mean and makes our stats
    // disagree with ParameterDeepDive (which already uses one-per-obs) and
    // with Water Rangers' own "times sampled" count. First match wins —
    // matches DeepDive's behaviour so both views show the same numbers.
    const seenForObs = new Set()
    for (const r of readings) {
      const val = parseFloat(r.value)
      if (isNaN(val) || !r.unit || r.unit === 'nil') continue
      const param = r.parameter
      if (seenForObs.has(param)) continue
      seenForObs.add(param)
      if (!byParam[param]) byParam[param] = []
      byParam[param].push({ date: obs.observed_at, value: val, unit: r.unit, equipment: r.equipment })

      const thresh = Object.entries(WHO).find(([k]) => param.toLowerCase().includes(k))
      if (thresh) {
        const [, t] = thresh
        if (val < t.min || val > t.max) {
          anomalies.push({ param, value: val, unit: r.unit, threshold: `${t.min}–${t.max}`, date: obs.observed_at, equipment: r.equipment, severity: val < t.min * 0.5 || val > t.max * 1.5 ? 'critical' : 'warning', explain: t.explain })
        }
      }
    }
  }

  const trends = Object.entries(byParam).map(([param, pts]) => {
    pts.sort((a, b) => new Date(a.date) - new Date(b.date))
    const vals = pts.map(p => p.value)
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
    const trend = vals.length >= 3 ? (vals[vals.length - 1] - vals[0]) / vals.length : 0
    return {
      param, count: pts.length, mean: +mean.toFixed(3), std: +std.toFixed(3),
      min: +Math.min(...vals).toFixed(3), max: +Math.max(...vals).toFixed(3),
      trend: trend > 0.01 ? 'increasing' : trend < -0.01 ? 'decreasing' : 'stable',
      unit: pts[0]?.unit || '', points: pts, equipment: pts[0]?.equipment,
    }
  }).sort((a, b) => b.count - a.count)

  return {
    anomalies, trends, qaBreakdown,
    totalReadings: Object.values(byParam).reduce((s, p) => s + p.length, 0),
    totalDatapointsRaw, // matches Water Rangers' "datapoints" count (numeric + text + qualitative)
  }
}

// ── Rich Chart helpers (community-readable) ─────────────────────────────────
//
// Goal: turn raw scatter dots into a chart a non-scientist can act on.
//   - Safe-range band (from WHO thresholds) shaded behind the line
//   - Mean line for context
//   - Dots highlighted red when reading is outside safe range
//   - Plain-English status of the latest reading
//   - Trend slope per week + % of time the site has been safe
//
// All math is client-side and pure — no LLM calls, so this scales free for
// thousands of users with zero token cost.

function lookupWHO(param) {
  if (!param) return null
  const p = param.toLowerCase()
  for (const [k, v] of Object.entries(WHO)) if (p.includes(k)) return v
  return null
}

// Parse + sort + filter invalid dates (the old chart showed dates from 1969
// because Date.parse() returned NaN for bad strings and the chart sorted them
// at -Infinity). Returns [{ t: ms, v: number, raw: original }] sorted ascending.
function cleanSeries(points) {
  if (!points) return []
  return points
    .map(p => ({ t: new Date(p.date).getTime(), v: parseFloat(p.value), raw: p }))
    .filter(p => isFinite(p.t) && p.t > 0 && isFinite(p.v))
    .sort((a, b) => a.t - b.t)
}

// Linear regression slope — value per millisecond, converted to per-week.
function slopePerWeek(series) {
  const n = series.length
  if (n < 3) return 0
  const meanT = series.reduce((s, p) => s + p.t, 0) / n
  const meanV = series.reduce((s, p) => s + p.v, 0) / n
  let num = 0, den = 0
  for (const p of series) { num += (p.t - meanT) * (p.v - meanV); den += (p.t - meanT) ** 2 }
  if (den === 0) return 0
  return (num / den) * (7 * 24 * 60 * 60 * 1000)
}

function statusOfValue(value, who) {
  if (!who || value == null || !isFinite(value)) return { tone: 'neutral', label: 'No standard' }
  if (value < who.min || value > who.max) {
    const farOut = value < who.min * 0.5 || value > who.max * 1.5
    return farOut
      ? { tone: 'danger',  label: 'Outside safe range', icon: XCircle, color: '#ef4444' }
      : { tone: 'warn',    label: 'Borderline',         icon: AlertCircle, color: '#f59e0b' }
  }
  return { tone: 'safe', label: 'Within safe range', icon: CheckCircle2, color: '#10b981' }
}

function plainEnglish(stats, who, paramName) {
  const bits = []
  if (stats.latest != null) {
    if (who) {
      if (stats.latest < who.min) bits.push(`The most recent reading (${stats.latest}${who.unit ? ' ' + who.unit : ''}) is below the safe minimum of ${who.min}.`)
      else if (stats.latest > who.max) bits.push(`The most recent reading (${stats.latest}${who.unit ? ' ' + who.unit : ''}) is above the safe maximum of ${who.max}.`)
      else bits.push(`The most recent reading (${stats.latest}${who.unit ? ' ' + who.unit : ''}) sits inside the safe range (${who.min}–${who.max}).`)
    } else {
      bits.push(`The most recent reading is ${stats.latest}.`)
    }
  }
  if (who && stats.pctSafe != null) {
    bits.push(`${Math.round(stats.pctSafe)}% of all ${stats.n} readings have been within safe limits.`)
  }
  if (stats.slopeWeek != null && Math.abs(stats.slopeWeek) > 1e-4) {
    const dir = stats.slopeWeek > 0 ? 'rising' : 'falling'
    bits.push(`Trend is ${dir} by about ${Math.abs(stats.slopeWeek).toFixed(3)}${who?.unit ? ' ' + who.unit : ''} per week.`)
  } else if (stats.n >= 3) {
    bits.push(`The trend is essentially flat — readings are not drifting up or down.`)
  }
  if (stats.anomalyCount > 0) {
    bits.push(`${stats.anomalyCount} reading${stats.anomalyCount === 1 ? '' : 's'} stand out as unusually high or low compared to the average for this site.`)
  }
  return bits.join(' ')
}

// Custom dot that paints red when reading is anomalous (>2σ from mean) OR
// outside the WHO safe range — both flags get the same visual treatment so
// people see "this point is worth a second look".
function makeDotRenderer({ mean, std, who, glowId }) {
  return function AnomalyDot(props) {
    const { cx, cy, payload } = props
    if (cx == null || cy == null) return null
    const v = payload?.v
    const z = std > 0 ? Math.abs((v - mean) / std) : 0
    const outsideSafe = who ? (v < who.min || v > who.max) : false
    const anomalous = z > 2 || outsideSafe
    if (anomalous) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={6} fill="#ef4444" fillOpacity={0.25} filter={glowId ? `url(#glow-${glowId})` : undefined}/>
          <circle cx={cx} cy={cy} r={4.5} fill="#ef4444" stroke="#7f1d1d" strokeWidth={1.25}/>
        </g>
      )
    }
    return <circle cx={cx} cy={cy} r={2.5} fill="#a78bfa" stroke="#312e81" strokeWidth={0.5}/>
  }
}

// Overall site health: average of per-parameter latest-reading scores.
// safe=100, borderline=60, far-out=15, no-standard=excluded. Real numbers,
// no LLM, no random — same WHO bands and same series cleaning as the per-
// parameter charts so the score and the charts agree.
function computeHealthScore(trends) {
  const items = []
  for (const t of trends) {
    const series = cleanSeries(t.points)
    if (series.length < 1) continue
    const who = lookupWHO(t.param)
    if (!who) continue
    const latest = series[series.length - 1].v
    const status = statusOfValue(latest, who)
    let score
    if (status.tone === 'safe') score = 100
    else if (status.tone === 'warn') score = 60
    else if (status.tone === 'danger') score = 15
    else continue
    items.push({ param: t.param, score, status, latest, unit: who.unit, who })
  }
  if (!items.length) return { score: null, items: [], breakdown: { safe: 0, warn: 0, danger: 0 } }
  const score = Math.round(items.reduce((s, x) => s + x.score, 0) / items.length)
  const breakdown = items.reduce((a, x) => { a[x.status.tone] = (a[x.status.tone] || 0) + 1; return a }, { safe: 0, warn: 0, danger: 0 })
  return { score, items, breakdown }
}

function SiteHealthCard({ trends, siteName }) {
  const health = useMemo(() => computeHealthScore(trends), [trends])
  if (health.score == null) {
    return (
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12, color: 'var(--text-muted)', fontSize: 11 }}>
        <Info size={12} style={{ marginRight: 6, verticalAlign: '-2px' }}/>
        No parameters at <strong>{siteName}</strong> have a WHO standard defined yet, so a health score can't be computed.
      </div>
    )
  }
  const tone = health.score >= 85 ? '#10b981' : health.score >= 60 ? '#f59e0b' : '#ef4444'
  const verdict = health.score >= 85 ? 'Healthy' : health.score >= 60 ? 'Watch' : 'Concerning'
  return (
    <div style={{
      background: `linear-gradient(135deg, ${tone}11, transparent 60%), var(--card-bg)`,
      border: `1px solid ${tone}33`, borderRadius: 14, padding: 16, marginBottom: 12,
      display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'center',
    }}>
      {/* Big score */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Site Health</div>
        <div style={{ fontSize: 56, fontWeight: 900, color: tone, lineHeight: 1, marginTop: 2,
          textShadow: `0 0 24px ${tone}55` }}>
          {health.score}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: tone, marginTop: 2 }}>{verdict} · /100</div>
      </div>
      {/* Breakdown */}
      <div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <Chip color="#10b981" icon={CheckCircle2} label={`${health.breakdown.safe} safe`}/>
          <Chip color="#f59e0b" icon={AlertCircle} label={`${health.breakdown.warn} borderline`}/>
          <Chip color="#ef4444" icon={XCircle} label={`${health.breakdown.danger} concerning`}/>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {health.items.slice(0, 12).map(it => (
            <div key={it.param} title={`Latest: ${it.latest}${it.unit ? ' ' + it.unit : ''} (safe: ${it.who.min}–${it.who.max})`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 999,
                background: `${it.status.color}14`, border: `1px solid ${it.status.color}44`,
                color: it.status.color, fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
              }}>
              {it.param.replace(/_/g, ' ')}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Computed live from {health.items.length} parameter{health.items.length === 1 ? '' : 's'} with WHO drinking-water standards. Score weighs each parameter's latest reading equally — 100 means every recent reading sat inside its safe range.
        </div>
      </div>
    </div>
  )
}

function Chip({ color, icon: Icon, label }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999,
      background: `${color}14`, border: `1px solid ${color}44`, color, fontSize: 11, fontWeight: 700,
    }}>
      <Icon size={12}/>{label}
    </div>
  )
}

// Custom Recharts tooltip — date is the headline, value + status secondary,
// safe-range shown for context. Fixes the previous tooltip where the date
// was a tiny label that often hid behind the value text.
function ChartHoverCard({ active, payload, who, paramName, unit }) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0]?.payload
  if (!p) return null
  const v = p.v
  const t = p.t
  const safe = who ? (v >= who.min && v <= who.max) : null
  const tone = safe === null ? '#a78bfa' : safe ? '#10b981' : '#ef4444'
  const tag = safe === null ? 'no standard' : safe ? '✓ within safe range' : '⚠ outside safe range'
  const dateStr = new Date(t).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
  return (
    <div style={{
      background: 'rgba(15,23,42,0.97)', border: `1.5px solid ${tone}aa`,
      borderRadius: 10, padding: '10px 12px', minWidth: 200,
      boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${tone}33`,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 2, letterSpacing: '0.02em' }}>{dateStr}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {paramName.replace(/_/g, ' ')}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 5 }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: tone }}>{v}</span>
        {unit && unit !== 'nil' && <span style={{ fontSize: 10, color: '#94a3b8' }}>{unit.replace(/_/g, '/')}</span>}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: tone }}>{tag}</div>
      {who && (
        <div style={{ marginTop: 4, fontSize: 9, color: '#94a3b8' }}>
          Safe range: {who.min}–{who.max}{who.unit ? ' ' + who.unit : ''}
        </div>
      )}
    </div>
  )
}

function RichParameterChart({ trend, siteName, timeRangeMs, gradientId, onOpenDetail }) {
  const series = useMemo(() => {
    const cleaned = cleanSeries(trend.points)
    if (!timeRangeMs || !cleaned.length) return cleaned
    // Anchor the window to the most recent reading, not Date.now() — historical
    // data can be years old; "last 90 days" means the 90 days before the
    // freshest reading we actually have for this site.
    const latestT = cleaned[cleaned.length - 1].t
    return cleaned.filter(p => p.t >= latestT - timeRangeMs)
  }, [trend.points, timeRangeMs])
  const who = useMemo(() => lookupWHO(trend.param), [trend.param])

  const stats = useMemo(() => {
    if (!series.length) return { n: 0 }
    const vals = series.map(p => p.v)
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, vals.length - 1))
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const latest = vals[vals.length - 1]
    const earliest = vals[0]
    const pctSafe = who
      ? (vals.filter(v => v >= who.min && v <= who.max).length / vals.length) * 100
      : null
    const anomalyCount = vals.filter((v, i) => {
      const z = std > 0 ? Math.abs((v - mean) / std) : 0
      return z > 2 || (who && (v < who.min || v > who.max))
    }).length
    return {
      n: vals.length, mean, std, min, max, latest, earliest, pctSafe, anomalyCount,
      slopeWeek: slopePerWeek(series),
      timeSpanDays: (series[series.length - 1].t - series[0].t) / 86400000,
      latestT: series[series.length - 1].t,
    }
  }, [series, who])

  const latestStatus = statusOfValue(stats.latest, who)
  const dotRenderer = useMemo(() => makeDotRenderer({ mean: stats.mean || 0, std: stats.std || 0, who, glowId: gradientId }), [stats.mean, stats.std, who, gradientId])

  if (series.length < 2) return null

  // Y-axis padding so the safe band always shows even if all readings sit at the edge
  const allVals = [...series.map(p => p.v), ...(who ? [who.min, who.max] : [])]
  const yMin = Math.min(...allVals)
  const yMax = Math.max(...allVals)
  const yPad = (yMax - yMin) * 0.12 || 1
  const yDomain = [yMin - yPad, yMax + yPad]

  const chartData = series.map(p => ({ t: p.t, v: p.v }))

  const trendIcon = !stats.slopeWeek ? Minus : (stats.slopeWeek > 0 ? ArrowUpRight : ArrowDownRight)
  const TrendIcon = trendIcon
  const trendColor = !stats.slopeWeek || Math.abs(stats.slopeWeek) < 1e-4 ? '#94a3b8'
    : stats.slopeWeek > 0 ? '#ef4444' : '#3b82f6'

  const isClickable = !!onOpenDetail
  const handleOpen = () => { if (onOpenDetail) onOpenDetail(trend.param) }
  const handleKey = (e) => { if (onOpenDetail && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpenDetail(trend.param) } }

  return (
    <div
      onClick={isClickable ? handleOpen : undefined}
      onKeyDown={isClickable ? handleKey : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `Open detailed analysis for ${trend.param.replace(/_/g, ' ')}` : undefined}
      style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 14,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={isClickable ? (e) => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.18)' } : undefined}
      onMouseLeave={isClickable ? (e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' } : undefined}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 800, textTransform: 'capitalize' }}>
            {trend.param.replace(/_/g, ' ')}
            {who && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>({who.label})</span>}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            {stats.n} readings · {trend.unit?.replace(/_/g, '/') || who?.unit || ''} · {Math.round(stats.timeSpanDays)} days
          </div>
          {stats.latestT && (
            <div style={{ marginTop: 3, fontSize: 10, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={10}/> Last reading {timeAgo(stats.latestT)}
            </div>
          )}
        </div>
        {latestStatus.icon && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999,
            background: `${latestStatus.color}1a`, border: `1px solid ${latestStatus.color}55`, color: latestStatus.color, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
            <latestStatus.icon size={11}/> {latestStatus.label}
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={`fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.45}/>
              <stop offset="60%"  stopColor="#6366f1" stopOpacity={0.10}/>
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.00}/>
            </linearGradient>
            <filter id={`glow-${gradientId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']}
            tickFormatter={t => new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
            tick={{ fontSize: 9, fill: '#94a3b8' }} stroke="rgba(255,255,255,.1)" />
          <YAxis domain={yDomain} tick={{ fontSize: 9, fill: '#94a3b8' }} stroke="rgba(255,255,255,.1)" width={36} />
          {who && (
            <ReferenceArea y1={who.min} y2={who.max} fill="#10b981" fillOpacity={0.10}
              stroke="#10b981" strokeOpacity={0.30} strokeDasharray="2 3"
              label={{ value: 'safe range', position: 'insideTopLeft', fill: '#10b981', fontSize: 9, fontWeight: 700 }} />
          )}
          {stats.mean != null && isFinite(stats.mean) && (
            <ReferenceLine y={stats.mean} stroke="#a78bfa" strokeDasharray="4 3" strokeOpacity={0.55}
              label={{ value: `mean ${stats.mean.toFixed(2)}`, position: 'right', fill: '#a78bfa', fontSize: 9 }} />
          )}
          <Tooltip
            cursor={{ stroke: '#a78bfa', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={(p) => <ChartHoverCard active={p.active} payload={p.payload} who={who} paramName={trend.param} unit={trend.unit}/>}/>
          <Area type="monotone" dataKey="v" stroke="none" fill={`url(#fill-${gradientId})`} isAnimationActive={true} animationDuration={650}/>
          <Line type="monotone" dataKey="v" stroke="#a78bfa" strokeWidth={2.25}
            dot={dotRenderer} activeDot={{ r: 5, fill: '#fff', stroke: '#a78bfa', strokeWidth: 2, filter: `url(#glow-${gradientId})` }}
            isAnimationActive={true} animationDuration={650}/>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10 }}>
        <Stat label="Latest" value={stats.latest != null ? stats.latest.toFixed(2) : '—'} color={latestStatus.color}/>
        <Stat label="Safe range" value={who ? `${who.min}–${who.max}` : 'no standard'} color="#10b981"/>
        <Stat label="% time safe" value={stats.pctSafe != null ? `${Math.round(stats.pctSafe)}%` : '—'}
          color={stats.pctSafe == null ? '#94a3b8' : stats.pctSafe >= 90 ? '#10b981' : stats.pctSafe >= 60 ? '#f59e0b' : '#ef4444'}/>
        <Stat label="Trend / wk" value={stats.slopeWeek ? (stats.slopeWeek > 0 ? '+' : '') + stats.slopeWeek.toFixed(3) : '~ flat'} color={trendColor} icon={TrendIcon}/>
      </div>

      {/* Plain English */}
      <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, color: '#a78bfa', fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          <Info size={10}/> What this means
        </div>
        <div style={{ color: 'var(--text)', fontSize: 12, lineHeight: 1.6 }}>
          {plainEnglish(stats, who, trend.param)}
          {who?.explain && <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 11 }}>About {who.label}: {who.explain}.</div>}
        </div>
      </div>

      {/* What should I do? — only shown when latest reading is borderline or outside safe range */}
      {(() => {
        const action = paramAction(latestStatus, who, trend.param)
        if (!action) return null
        const tone = latestStatus.color
        return (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: `${tone}10`, border: `1px solid ${tone}44` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, color: tone, fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              <ShieldAlert size={10}/> What should I do?
            </div>
            <div style={{ color: 'var(--text)', fontSize: 12, lineHeight: 1.6 }}>{action}</div>
          </div>
        )
      })()}
    </div>
  )
}

function Stat({ label, value, color, icon: Icon }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px' }}>
      <div style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, color, fontSize: 12, fontWeight: 800, marginTop: 1 }}>
        {Icon && <Icon size={11}/>}
        {value}
      </div>
    </div>
  )
}

const TIME_RANGES = [
  { key: '1m',  label: '1M',  ms: 30  * 86400000 },
  { key: '3m',  label: '3M',  ms: 90  * 86400000 },
  { key: '1y',  label: '1Y',  ms: 365 * 86400000 },
  { key: 'all', label: 'All', ms: null },
]

// "3 days ago" / "2 months ago" / "5 years ago" — gentle, readable, no science.
function timeAgo(ms) {
  if (!ms || !isFinite(ms)) return null
  const diff = Date.now() - ms
  if (diff < 0) return 'in the future'
  const day = 86400000
  if (diff < day) return 'today'
  if (diff < 2 * day) return 'yesterday'
  if (diff < 30 * day) return `${Math.round(diff / day)} days ago`
  if (diff < 365 * day) return `${Math.round(diff / (30 * day))} months ago`
  const years = (diff / (365 * day)).toFixed(1)
  return `${years} year${years === '1.0' ? '' : 's'} ago`
}

// Shared TTS — backend Microsoft Ana neural voice (free, no API key)
// with browser fallback. Same /api/ai/tts endpoint Ask Water uses, so
// this read-aloud sounds identical to Ask Water (real young-female voice
// rather than the OS-default male sore-throat voice on Windows).
let _ttsCtrl = null
function speak(text) {
  try {
    _ttsCtrl?.stop?.()
    _ttsCtrl = playNibiTTS(text)
    return _ttsCtrl
  } catch { return null }
}
function stopSpeaking() { _ttsCtrl?.stop?.() }

// Plain-English action guidance for elderly / non-technical users. Always
// honest about uncertainty — never tells someone the water is fine when
// readings are flagged.
function whatToDo(verdict) {
  if (verdict === 'safe') return {
    title: 'What this means for you',
    color: '#10b981',
    icon: CheckCircle2,
    body: 'Recent readings at this site look healthy. Keep checking back — water quality can change with weather, season, and upstream activity.',
  }
  if (verdict === 'watch') return {
    title: 'Worth keeping an eye on',
    color: '#f59e0b',
    icon: AlertCircle,
    body: 'Some readings are close to the safe limit but not over it. Avoid drinking unfiltered water from this source. If you swim or fish here, check again before your next visit.',
  }
  return {
    title: 'Take this seriously',
    color: '#ef4444',
    icon: ShieldAlert,
    body: 'One or more recent readings are outside safe drinking-water limits. Do not drink water from this source. Contact your local water authority or the Water Rangers community to flag this site for follow-up sampling.',
  }
}

// Per-parameter "what should I do?" — only shown when the latest reading is
// borderline or outside safe range. Keeps the green-state UI clean.
function paramAction(latestStatus, who, paramName) {
  if (!who || latestStatus.tone === 'safe' || latestStatus.tone === 'neutral') return null
  const name = paramName.replace(/_/g, ' ')
  if (latestStatus.tone === 'warn') {
    return `The latest ${name} reading is close to the safe limit but not over it. This is worth tracking — if the next few readings keep drifting in the same direction, consider reporting it to local water monitors.`
  }
  return `The latest ${name} reading is outside the safe range. ${who.explain ? `${who.label} matters because: ${who.explain.toLowerCase()}.` : ''} Do not drink unfiltered water from this site, and consider flagging it to a local environmental authority.`
}

// Site-wide one-sentence verdict for the headline. Speaks to a community
// member with no science background. Names the parameters that need attention.
function siteHeadline(siteName, health, latestObsTs) {
  if (!health || health.score == null) {
    return { verdict: 'unknown', text: `Not enough drinking-water standards apply to the parameters tracked at ${siteName} yet to give an overall verdict. The charts below still show the data we have.` }
  }
  const when = latestObsTs ? ` (last reading ${timeAgo(latestObsTs)})` : ''
  const concerning = health.items.filter(i => i.status.tone === 'danger').map(i => i.param.replace(/_/g, ' '))
  const watch = health.items.filter(i => i.status.tone === 'warn').map(i => i.param.replace(/_/g, ' '))
  if (health.score >= 85) return {
    verdict: 'safe',
    text: `Recent readings at ${siteName} look healthy${when}. ${health.breakdown.safe} parameter${health.breakdown.safe === 1 ? '' : 's'} sit comfortably inside safe drinking-water limits.`,
  }
  if (health.score >= 60) return {
    verdict: 'watch',
    text: `${siteName} is mostly fine${when}, but a few readings are worth watching: ${watch.join(', ') || 'borderline values detected'}. None are over the safe limit yet, but the next sampling round should be checked carefully.`,
  }
  return {
    verdict: 'danger',
    text: `${siteName} needs attention${when}. ${concerning.length ? `${concerning.join(', ')} are outside safe drinking-water limits` : 'multiple readings are outside safe limits'}. Do not drink water from this site without treatment, and consider flagging it to local monitors.`,
  }
}

function HeadlineSummary({ siteName, health, latestObsTs, totalReadings, observationsCount }) {
  const [speaking, setSpeaking] = useState(false)
  const headline = useMemo(() => siteHeadline(siteName, health, latestObsTs), [siteName, health, latestObsTs])
  const verdictColor = headline.verdict === 'safe' ? '#10b981'
    : headline.verdict === 'watch' ? '#f59e0b'
    : headline.verdict === 'danger' ? '#ef4444'
    : '#94a3b8'
  const VerdictIcon = headline.verdict === 'safe' ? CheckCircle2
    : headline.verdict === 'watch' ? AlertCircle
    : headline.verdict === 'danger' ? ShieldAlert
    : Info
  const speech = `${headline.text}. This is based on ${totalReadings || 0} water quality readings from ${observationsCount || 0} observations at ${siteName}.`

  // Stop any speech if we unmount
  useEffect(() => () => stopSpeaking(), [])

  const onReadAloud = () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return }
    const ctrl = speak(speech)
    if (!ctrl) return
    setSpeaking(true)
    ctrl.onEnd?.(() => setSpeaking(false))
  }

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `linear-gradient(135deg, ${verdictColor}1a, ${verdictColor}08 60%, var(--card-bg))`,
      border: `1.5px solid ${verdictColor}55`, borderRadius: 16, padding: 18, marginBottom: 12,
      display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: 14, alignItems: 'center',
      boxShadow: `0 0 32px ${verdictColor}22`,
    }}>
      {/* Big verdict icon */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 72, height: 72, borderRadius: 16,
        background: `${verdictColor}22`, border: `1.5px solid ${verdictColor}66`,
      }}>
        <VerdictIcon size={42} color={verdictColor} strokeWidth={2}/>
      </div>

      {/* Headline + sub */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: verdictColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <HeartPulse size={12}/> Plain-language summary for {siteName}
        </div>
        <div style={{ color: 'var(--text)', fontSize: 15, lineHeight: 1.5, fontWeight: 600 }}>{headline.text}</div>
        {latestObsTs && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={11}/> Latest sample: {timeAgo(latestObsTs)} ({new Date(latestObsTs).toLocaleDateString()})
          </div>
        )}
      </div>

      {/* Read aloud */}
      <button onClick={onReadAloud}
        title={speaking ? 'Stop reading' : 'Read this aloud'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 14px', borderRadius: 10,
          background: speaking ? `${verdictColor}` : `${verdictColor}22`,
          border: `1.5px solid ${verdictColor}`, color: speaking ? '#fff' : verdictColor,
          fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
        {speaking ? <VolumeX size={14}/> : <Volume2 size={14}/>}
        {speaking ? 'Stop' : 'Read aloud'}
      </button>
    </div>
  )
}

function ChartsTab({ trends, siteName, observationsCount, totalReadings, onOpenDetail }) {
  const [range, setRange] = useState('all')
  const charted = trends.filter(t => t.count >= 3 && t.unit !== 'nil')
  if (charted.length === 0) {
    return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>Not enough readings yet to draw charts (need at least 3 per parameter).</div>
  }
  const activeMs = TIME_RANGES.find(r => r.key === range)?.ms || null

  // Latest observation timestamp across all parameters — used by headline.
  const latestObsTs = useMemo(() => {
    let max = 0
    for (const t of charted) for (const p of (t.points || [])) {
      const ts = new Date(p.date).getTime()
      if (isFinite(ts) && ts > max) max = ts
    }
    return max || null
  }, [charted])
  const health = useMemo(() => computeHealthScore(charted), [charted])

  return (
    <>
      <HeadlineSummary
        siteName={siteName} health={health} latestObsTs={latestObsTs}
        observationsCount={observationsCount} totalReadings={totalReadings}/>
      <SiteHealthCard trends={charted} siteName={siteName}/>

      {/* Toolbar: time range + legend hint */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
        marginBottom: 12, padding: '8px 12px', borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(167,139,250,0.04))',
        border: '1px solid rgba(167,139,250,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11 }}>
          <Sparkles size={12} color="#a78bfa"/>
          <span>Safe-range bands · mean line · anomaly dots in red. Hover any point for details.</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {TIME_RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)} style={{
              padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 800,
              cursor: 'pointer',
              border: '1px solid', borderColor: range === r.key ? '#a78bfa' : 'rgba(255,255,255,0.12)',
              background: range === r.key ? 'rgba(167,139,250,0.18)' : 'transparent',
              color: range === r.key ? '#c4b5fd' : 'var(--text-muted)',
              letterSpacing: '0.04em',
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 12 }}>
        {charted.map((t, i) => (
          <RichParameterChart key={`${t.param}-${i}-${range}`} trend={t} siteName={siteName}
            timeRangeMs={activeMs} gradientId={`p${i}-${range}`}
            onOpenDetail={onOpenDetail}/>
        ))}
      </div>
    </>
  )
}

// ── Research AI Chat ─────────────────────────────────────────────────────────
// ── One anomaly row that expands into a rich, honest explanation. ───────────
// Layers, clearly separated so nothing is faked or mis-attributed:
//   1. "What this reading means" — computed from THIS reading vs the real WR band
//   2. "In plain English" — our own general-science explainer (labelled ours)
//   3. "From Water Rangers" — WR's own text if the app has it, else honest note
//   4. Live WR prose (best-effort from the server; silently skipped if absent)
// No AI call, so this costs nothing.
function AnomalyRow({ a }) {
  const [open, setOpen] = useState(false)
  const [wrLive, setWrLive] = useState(null)   // { ok, guide } from /wr/param-guide
  const [tried, setTried] = useState(false)
  const unit = (a.unit || '').replace(/_/g, '/')
  const wr = getWRParameter(a.param)
  const pe = getPlainEnglish(a.param)
  const learnUrl = (wr && wr.sources && wr.sources[0]) || WR_DOCS_URL

  // Parse the "min–max" band string and say, honestly, where this reading sits.
  const parts = String(a.threshold || '').split(/[–—-]/).map(s => parseFloat(s))
  const lo = parts[0], hi = parts[1]
  let position = 'outside the safe band'
  if (Number.isFinite(lo) && a.value < lo) position = `below the safe band (min ${lo})`
  else if (Number.isFinite(hi) && a.value > hi) position = `above the safe band (max ${hi})`
  const dateStr = a.date ? new Date(a.date).toLocaleDateString() : 'an unknown date'
  const interp = `On ${dateStr}, ${a.param.replace(/_/g, ' ')} read ${a.value}${unit ? ' ' + unit : ''}. ` +
    `Water Rangers' review band for this site is ${a.threshold}${unit ? ' ' + unit : ''}, so this reading is ${position} — which is why it's flagged as ${a.severity}.`
  const direction = Number.isFinite(hi) && a.value > hi ? 'high' : 'low'

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !tried) {
      setTried(true)
      api.get(`/wr/param-guide?name=${encodeURIComponent(a.param)}`)
        .then(r => setWrLive(r.data)).catch(() => setWrLive({ ok: false }))
    }
  }

  const Section = ({ title, color, children }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', color, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text)' }}>{children}</div>
    </div>
  )

  return (
    <>
      <tr onClick={toggle} style={{ borderBottom: open ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}>
        <td style={{ padding: '5px' }}><span style={{ padding: '1px 6px', borderRadius: 5, fontSize: 9, fontWeight: 700, background: a.severity === 'critical' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)', color: a.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>{a.severity}</span></td>
        <td style={{ padding: '5px', color: 'var(--text)', fontWeight: 600 }}>
          <span style={{ display: 'inline-block', width: 10, color: 'var(--text-muted)', transition: 'transform .15s', transform: open ? 'rotate(90deg)' : 'none' }}>▸</span>
          {a.param.replace(/_/g, ' ')}
        </td>
        <td style={{ padding: '5px', color: '#ef4444', fontWeight: 700 }}>{a.value} {unit}</td>
        <td style={{ padding: '5px', color: 'var(--text-muted)' }}>{a.threshold}</td>
        <td style={{ padding: '5px', color: 'var(--text-muted)', fontSize: 10 }}>{a.explain || ''}</td>
        <td style={{ padding: '5px', color: 'var(--text-muted)', fontSize: 9 }}>{(a.equipment || '').replace(/_/g, ' ').slice(0, 30)}</td>
        <td style={{ padding: '5px', color: 'var(--text-muted)' }}>{a.date ? new Date(a.date).toLocaleDateString() : '—'}</td>
      </tr>
      {open && (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <td colSpan={7} style={{ padding: '4px 12px 14px 26px', background: 'rgba(99,102,241,.03)' }}>
            <Section title="📊 What this reading means" color="#38bdf8">{interp}</Section>
            {pe && (
              <Section title="💬 In plain English (our explainer)" color="#a78bfa">
                <div>{pe.plain}</div>
                <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{pe.whyCare}</div>
                <div style={{ marginTop: 4 }}><strong>This reading is {direction}.</strong> {direction === 'high' ? pe.highMeans : pe.lowMeans}</div>
              </Section>
            )}
            {(wr && (wr.whatIsIt || wr.whyImportant)) ? (
              <Section title="🌊 From Water Rangers" color="#10b981">
                {wr.whatIsIt && <div>{wr.whatIsIt}</div>}
                {wr.whyImportant && <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{wr.whyImportant}</div>}
              </Section>
            ) : wrLive && wrLive.ok && wrLive.guide ? (
              <Section title="🌊 From Water Rangers" color="#10b981">
                {wrLive.guide.whatIsIt && <div>{wrLive.guide.whatIsIt}</div>}
                {wrLive.guide.whyImportant && <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{wrLive.guide.whyImportant}</div>}
                {wrLive.guide.whatImpacts && <div style={{ marginTop: 4 }}>{wrLive.guide.whatImpacts}</div>}
                {wrLive.guide.whatItMeans && <div style={{ marginTop: 4 }}>{wrLive.guide.whatItMeans}</div>}
                <div style={{ marginTop: 5, fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic' }}>Pulled live from waterrangers.com</div>
              </Section>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic' }}>
                Water Rangers hasn't published an inline guide for this parameter{tried && wrLive && !wrLive.ok ? '' : '…'} — the plain-English note above explains it, and the link below goes to their reference.
              </div>
            )}
            {a.equipment && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                <strong>Measured with:</strong> {(a.equipment || '').replace(/_/g, ' ')}
              </div>
            )}
            <a href={learnUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
              Learn more at Water Rangers ↗
            </a>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Lightweight Markdown → JSX for AI answers ────────────────────────────────
// The AI returns Markdown (**bold**, ## headings, | tables |, lists). Rendering
// it raw showed the symbols literally and looked broken. This turns the common
// shapes into clean, styled elements — no external dependency — and strips the
// 【…】 citation tags the model sometimes emits.
function mdInline(str) {
  const out = []
  let rest = String(str).replace(/【[^】]*】/g, '')
  const re = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`)/
  let key = 0, m
  while ((m = rest.match(re))) {
    if (m.index > 0) out.push(rest.slice(0, m.index))
    if (m[2] != null) out.push(<strong key={key++}>{m[2]}</strong>)
    else if (m[3] != null) out.push(<em key={key++}>{m[3]}</em>)
    else if (m[4] != null) out.push(<code key={key++} style={{ background: 'rgba(99,102,241,.12)', padding: '0 4px', borderRadius: 4, fontSize: '0.92em' }}>{m[4]}</code>)
    rest = rest.slice(m.index + m[0].length)
  }
  if (rest) out.push(rest)
  return out
}

function MarkdownLite({ text }) {
  const clean = String(text || '').replace(/【[^】]*】/g, '')
  const lines = clean.split('\n')
  const blocks = []
  let i = 0, key = 0
  const isSep = (s) => s && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(s) && s.includes('-')
  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()
    if (!t) { i++; continue }
    if (/^(---+|\*\*\*+|___+)$/.test(t)) { blocks.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />); i++; continue }
    const h = t.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const lvl = h[1].length
      blocks.push(<div key={key++} style={{ fontWeight: 800, fontSize: lvl <= 1 ? 16 : lvl === 2 ? 14.5 : 13, margin: '10px 0 4px', color: 'var(--text)' }}>{mdInline(h[2])}</div>)
      i++; continue
    }
    // GFM table: a row with pipes followed by a --- separator row
    if (t.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const cut = (s) => s.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const header = cut(t)
      i += 2
      const rows = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(cut(lines[i])); i++ }
      blocks.push(
        <div key={key++} style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
            <thead><tr>{header.map((c, ci) => <th key={ci} style={{ border: '1px solid var(--border)', padding: '4px 8px', textAlign: 'left', background: 'rgba(99,102,241,.1)', fontWeight: 700 }}>{mdInline(c)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri} style={{ background: ri % 2 ? 'rgba(99,102,241,.03)' : 'transparent' }}>{r.map((c, ci) => <td key={ci} style={{ border: '1px solid var(--border)', padding: '4px 8px', verticalAlign: 'top' }}>{mdInline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
      continue
    }
    if (/^[-*]\s+/.test(t)) {
      const items = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].trim().replace(/^[-*]\s+/, '')); i++ }
      blocks.push(<ul key={key++} style={{ margin: '4px 0', paddingLeft: 18 }}>{items.map((it, ii) => <li key={ii} style={{ margin: '2px 0' }}>{mdInline(it)}</li>)}</ul>)
      continue
    }
    if (/^\d+\.\s+/.test(t)) {
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].trim().replace(/^\d+\.\s+/, '')); i++ }
      blocks.push(<ol key={key++} style={{ margin: '4px 0', paddingLeft: 20 }}>{items.map((it, ii) => <li key={ii} style={{ margin: '2px 0' }}>{mdInline(it)}</li>)}</ol>)
      continue
    }
    const para = [line]; i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*]\s|\d+\.\s|---+$)/.test(lines[i].trim()) && !(lines[i].includes('|') && isSep(lines[i + 1] || ''))) { para.push(lines[i]); i++ }
    blocks.push(<p key={key++} style={{ margin: '4px 0', lineHeight: 1.6 }}>{mdInline(para.join(' '))}</p>)
  }
  return <div>{blocks}</div>
}

function ResearchAI({ site, observations, analysis }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  // ── Daily "drops" guardrail — HARD client-side stop so cost can't run away.
  // The server also limits, but a free instance can restart and lose its count;
  // the browser count (per calendar day) is the reliable wall for real users.
  // Bumped to the server's number whenever the server says fewer remain. ──
  const DAILY_LIMIT = 5
  const dropsKey = `wr_drops_${new Date().toISOString().slice(0, 10)}`
  const readUsed = () => { try { return parseInt(localStorage.getItem(dropsKey) || '0', 10) || 0 } catch { return 0 } }
  const [used, setUsed] = useState(readUsed())
  const persistUsed = (n) => { setUsed(n); try { localStorage.setItem(dropsKey, String(n)) } catch { /* ignore */ } }
  const remaining = Math.max(0, DAILY_LIMIT - used)
  const outOfDrops = remaining <= 0

  // On open, sync to the server's real per-user count (authoritative across
  // devices/tabs/networks). Reconcile upward so we never show more than allowed.
  useEffect(() => {
    let alive = true
    api.get('/wr/my-drops').then(r => {
      if (!alive || r?.data?.used == null) return
      const serverUsed = r.data.used
      if (serverUsed > readUsed()) persistUsed(serverUsed)
    }).catch(() => { /* offline / not logged in — keep local count */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const PRESETS = [
    { label: '📄 IEEE Abstract', prompt: `Write an IEEE-format abstract about water quality at ${site?.name}. Use the real data provided.` },
    { label: '📊 Methodology', prompt: `Write a Methodology section for a research paper about monitoring ${site?.name}. Include data collection methods, parameters, equipment, and QA process.` },
    { label: '🔍 Key Findings', prompt: `List the top 5 findings from the ${site?.name} dataset. Cite specific values, dates, and anomalies.` },
    { label: '⚠️ Anomaly Report', prompt: `Generate a detailed anomaly report for ${site?.name}. What exceeded WHO thresholds? What are the likely causes and recommended actions?` },
    { label: '📈 Trend Report', prompt: `Analyze all parameter trends at ${site?.name}. Which are improving, worsening, or stable? What does this mean for water quality?` },
    { label: '🏠 Community Summary', prompt: `Write a simple, non-technical summary of water quality at ${site?.name} that a community member with no science background can understand. Is the water safe? What should they know?` },
  ]

  // Build REAL context from THIS site's actual loaded data
  const siteContext = useMemo(() => {
    if (!site || !observations.length) return ''
    const a = analysis
    return `
=== REAL DATA FOR: ${site.name} ===
Location: ${site.name}, ${site.body_of_water || ''}, ${(site.water_body_type||'').replace(/_/g,' ')}, ${site.country}
Coordinates: ${site.latitude}, ${site.longitude}
Parameters tested: ${(site.tested_parameters||[]).join(', ')}
Equipment: ${(site.tested_equipment||[]).join(', ')}
First observation: ${site.first_observation_at || '?'}
Last observation: ${site.last_observation_at || '?'}

Total observations loaded: ${observations.length}
Total readings: ${a.totalReadings}
Anomalies detected: ${a.anomalies.length}
QA breakdown: ${Object.entries(a.qaBreakdown).map(([k,v])=>`${k}: ${v}`).join(', ')}

ANOMALIES (${a.anomalies.length}):
${a.anomalies.map(x => `- ${x.param}: ${x.value} ${x.unit} (safe: ${x.threshold}) on ${x.date?.slice(0,10)} — ${x.explain}`).join('\n') || 'None'}

PARAMETER TRENDS (${a.trends.length}):
${a.trends.map(t => `- ${t.param}: mean=${t.mean} ${t.unit}, range=${t.min}-${t.max}, n=${t.count}, trend=${t.trend}`).join('\n')}

IMPORTANT: This is REAL data loaded directly from Water Rangers API for this specific site. Only cite these actual numbers. Do not make up data.`
  }, [site, observations, analysis])

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    // HARD STOP: out of drops → don't even hit the server (protects cost).
    if (outOfDrops) {
      setMessages(prev => [...prev, { role: 'assistant', content: `💧 You've used all ${DAILY_LIMIT} of your daily drops. They refill tomorrow. The Charts, Trends and Anomaly tabs still work with no limit.` }])
      return
    }
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      const { data } = await api.post('/wr/agent', {
        question: q,
        siteContext, // pass the real site data
        siteName: site.name,
      })
      const footer = `\n\n---\n*Based on ${observations.length} real observations at ${site.name} (${analysis.totalReadings} readings, ${analysis.anomalies.length} anomalies)*`
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer + footer }])
      // Count this drop. Reconcile with the server: if it says fewer remain
      // (e.g. asked from another device), jump the local count up to match.
      let n = readUsed() + 1
      if (data.quota && data.quota.remaining != null) n = Math.max(n, DAILY_LIMIT - data.quota.remaining)
      persistUsed(n)
    } catch (e) {
      const friendly = e.response?.data?.answer
        || (e.response?.status === 429 ? "You've reached today's AI question limit. The other tabs still work — try again tomorrow." : null)
        || `The research assistant hit a snag (${e.response?.data?.error || e.message}). Your data and charts are unaffected — please try again in a moment.`
      setMessages(prev => [...prev, { role: 'assistant', content: friendly }])
      // Server-enforced limit hit → mark all drops spent locally too.
      if (e.response?.status === 429 || e.response?.data?.quota?.remaining === 0) persistUsed(DAILY_LIMIT)
    }
    setLoading(false)
  }

  const dropsLeft = remaining
  const dropsLimit = DAILY_LIMIT

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          💧 Each answer uses one <strong>drop</strong> — {dropsLimit} free AI drops a day
        </div>
        {dropsLeft != null && (
          <div title="Your daily AI questions (drops) reset every 24 hours" style={{
            fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap',
            background: dropsLeft === 0 ? 'rgba(239,68,68,.12)' : 'rgba(56,189,248,.12)',
            border: `1px solid ${dropsLeft === 0 ? 'rgba(239,68,68,.3)' : 'rgba(56,189,248,.3)'}`,
            color: dropsLeft === 0 ? '#f87171' : '#38bdf8',
          }}>
            {dropsLeft === 0
              ? '💧 0 drops left — refills tomorrow'
              : `💧 ${dropsLeft} of ${dropsLimit} drops left today`}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => send(p.prompt)} disabled={loading || outOfDrops} style={{
            padding: '4px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
            background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.12)',
            color: '#a78bfa', cursor: (loading || outOfDrops) ? 'not-allowed' : 'pointer',
            opacity: (loading || outOfDrops) ? 0.45 : 1,
          }}>{p.label}</button>
        ))}
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ height: 350, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {messages.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>Ask anything about <strong>{site?.name}</strong> — the AI has access to all its real data</div>}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: m.role === 'user' ? '88%' : '94%', padding: '8px 12px', borderRadius: 10,
              background: m.role === 'user' ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${m.role === 'user' ? 'rgba(99,102,241,.25)' : 'var(--border)'}`,
              color: 'var(--text)', fontSize: 12, lineHeight: 1.7,
              whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal',
            }}>{m.role === 'assistant' ? <MarkdownLite text={m.content} /> : m.content}</div>
          ))}
          {loading && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}><Loader size={12} className="animate-spin" /> Analyzing {site?.name} data...</div>}
          <div ref={bottomRef} />
        </div>
        {outOfDrops && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'rgba(239,68,68,.08)', fontSize: 11, color: '#f87171', lineHeight: 1.5 }}>
            💧 <strong>Out of drops for today.</strong> Your {DAILY_LIMIT} free AI questions refill tomorrow. The Charts, Trends and Anomaly tabs still work with no limit. <span style={{ color: 'var(--text-muted)' }}>(Unlimited paid AI is coming as an upgrade.)</span>
          </div>
        )}
        <div style={{ padding: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !outOfDrops && send()}
            disabled={loading || outOfDrops}
            placeholder={outOfDrops ? 'Out of drops — refills tomorrow' : `Ask about ${site?.name}...`}
            style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', opacity: outOfDrops ? 0.6 : 1, cursor: outOfDrops ? 'not-allowed' : 'text' }} />
          <button onClick={() => send()} disabled={loading || !input.trim() || outOfDrops} style={{
            padding: '7px 12px', borderRadius: 8, border: 'none', background: 'rgba(99,102,241,.12)', color: '#a78bfa',
            cursor: (loading || !input.trim() || outOfDrops) ? 'not-allowed' : 'pointer', opacity: (loading || outOfDrops) ? 0.5 : 1,
          }}><Send size={13} /></button>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function WRAILab() {
  const [locations, setLocations] = useState([])
  const [locsLoading, setLocsLoading] = useState(true)
  const [locSearch, setLocSearch] = useState('')
  const [selectedSite, setSelectedSite] = useState(null)
  const [observations, setObservations] = useState([])
  const [obsLoading, setObsLoading] = useState(false)
  const [tab, setTab] = useState('anomalies')
  const [error, setError] = useState(null)

  // Load locations
  useEffect(() => {
    getAllLocations().then(l => { setLocations(l); setLocsLoading(false) }).catch(() => setLocsLoading(false))
  }, [])

  // When site selected, load ALL its observations
  useEffect(() => {
    if (!selectedSite) { setObservations([]); return }
    setObsLoading(true); setError(null)
    ;(async () => {
      const all = []
      for (let page = 1; page <= 20; page++) {
        try {
          const result = await getLocationObservations(selectedSite.id, { page, perPage: 100 })
          const items = Array.isArray(result) ? result : result.observations || result.data || []
          if (items.length === 0) break
          all.push(...items)
          if (items.length < 100) break
        } catch { break }
      }
      setObservations(all)
    })().catch(e => setError(e.message)).finally(() => setObsLoading(false))
  }, [selectedSite])

  const analysis = useMemo(() => analyze(observations), [observations])
  const { anomalies, trends } = analysis

  // Click any chart card → open the full ParameterDeepDive panel for that param.
  // We pass the canonical key (matchParam) so the deep-dive's CCME bands and
  // explanation lookups work; if there's no canonical match, fall back to a
  // sanitised raw key so the panel can still pull values via parameter-name match.
  const [deepDiveParam, setDeepDiveParam] = useState(null)
  const openDetail = (rawParam) => {
    const key = matchParam(rawParam) || (rawParam || '').toLowerCase().replace(/\s+/g, '_')
    setDeepDiveParam(key)
  }

  const filteredLocs = useMemo(() => {
    if (!locSearch) return locations.slice(0, 50)
    const s = locSearch.toLowerCase()
    return locations.filter(l => (l.name || '').toLowerCase().includes(s) || (l.body_of_water || '').toLowerCase().includes(s) || (l.country || '').toLowerCase().includes(s)).slice(0, 50)
  }, [locations, locSearch])

  // CSV export
  const exportCSV = () => {
    if (!selectedSite || anomalies.length === 0) return
    const rows = [['Site', 'Severity', 'Parameter', 'Value', 'Unit', 'Threshold', 'Why It Matters', 'Equipment', 'Date']]
    anomalies.forEach(a => rows.push([selectedSite.name, a.severity, a.param, a.value, a.unit, a.threshold, a.explain || '', a.equipment || '', a.date || '']))
    const csv = rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${selectedSite.name}-anomaly-report.csv`; a.click()
  }

  const TABS = [
    { id: 'anomalies', label: 'Anomaly Detection', icon: AlertTriangle, color: '#ef4444', count: anomalies.length },
    { id: 'trends', label: 'Trends', icon: TrendingUp, color: '#14b8a6', count: trends.length },
    { id: 'charts', label: 'Charts', icon: BarChart2, color: '#6366f1' },
    { id: 'ai', label: 'Research AI', icon: Brain, color: '#a78bfa' },
  ]

  return (
    <div style={{ minHeight: 'calc(100vh - 130px)' }}>
      <div style={{ marginBottom: 10 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={20} color="#a78bfa" /> AI Lab
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
          Pick a monitoring site → get full analysis, anomalies, trends, and AI-powered research
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedSite ? '260px 1fr' : '1fr', gap: 12 }}>
        {/* Location picker */}
        <div>
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={locSearch} onChange={e => setLocSearch(e.target.value)} placeholder="Search sites..."
              style={{ width: '100%', padding: '7px 8px 7px 26px', borderRadius: 8, fontSize: 11, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          {locsLoading ? (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 11 }}><RefreshCw size={13} className="animate-spin" /> Loading sites...</div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {filteredLocs.map(loc => (
                <div key={loc.id} onClick={() => { setSelectedSite(loc); setTab('anomalies') }} style={{
                  padding: '7px 8px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                  background: selectedSite?.id === loc.id ? 'rgba(99,102,241,.12)' : 'var(--card-bg)',
                  border: `1px solid ${selectedSite?.id === loc.id ? 'rgba(99,102,241,.3)' : 'var(--border)'}`,
                }}>
                  <div style={{ color: 'var(--text)', fontSize: 11, fontWeight: 600 }}>{loc.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {loc.country} · {(loc.water_body_type || '').replace(/_/g, ' ')} · {(loc.tested_parameters || []).length} params
                  </div>
                </div>
              ))}
              {!locSearch && <div style={{ padding: 6, fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>Search {locations.length.toLocaleString()} sites</div>}
            </div>
          )}
        </div>

        {/* Analysis panel */}
        {selectedSite && (
          <div>
            {/* Site header */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 800, margin: 0 }}>
                  <MapPin size={14} style={{ marginRight: 4 }} />{selectedSite.name}
                </h3>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {selectedSite.body_of_water} · {(selectedSite.water_body_type || '').replace(/_/g, ' ')} · {selectedSite.country}
                </div>
                {obsLoading ? (
                  <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 2 }}><RefreshCw size={10} className="animate-spin" /> Loading all observations...</div>
                ) : (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span><strong style={{ color: 'var(--text)' }}>{observations.length}</strong> observations (sampling visits)</span>
                    <span>·</span>
                    <span title={`Water Rangers reports this as "datapoints" — every reading on every observation, including non-numeric notes like "brown colour" or "no odour".`}>
                      <strong style={{ color: 'var(--text)' }}>{analysis.totalDatapointsRaw}</strong> total datapoints
                    </span>
                    <span>·</span>
                    <span title={`One numeric reading per parameter per sampling visit. Where a visit logged the same parameter twice (e.g. test-strip + digital meter for QA), only the first is counted so duplicate cross-checks don't skew the mean. This is the count the charts and statistics use.`}>
                      <strong style={{ color: 'var(--text)' }}>{analysis.totalReadings}</strong> chartable readings
                    </span>
                    <span>·</span>
                    <span><strong style={{ color: 'var(--text)' }}>{anomalies.length}</strong> anomalies</span>
                    <span>·</span>
                    <span><strong style={{ color: 'var(--text)' }}>{trends.length}</strong> parameters</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', background: 'rgba(20,184,166,.06)', border: '1px solid rgba(20,184,166,.12)', borderRadius: 6, color: '#14b8a6', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                  <Download size={10} /> CSV
                </button>
                {selectedSite.permalink && (
                  <a href={selectedSite.permalink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.12)', borderRadius: 6, color: '#a78bfa', fontSize: 10, fontWeight: 600, textDecoration: 'none' }}>
                    <ExternalLink size={10} /> WR
                  </a>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                  background: tab === t.id ? `${t.color}12` : 'transparent',
                  border: 'none', borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
                  color: tab === t.id ? t.color : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>
                  <t.icon size={12} /> {t.label}
                  {t.count !== undefined && <span style={{ fontSize: 9, opacity: .6 }}>({t.count})</span>}
                </button>
              ))}
            </div>

            {obsLoading ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}><RefreshCw size={16} className="animate-spin" style={{ margin: '0 auto 6px' }} /> Loading observations for {selectedSite.name}...</div>
            ) : observations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>No observations found for this site</div>
            ) : (
              <>
                {/* ANOMALIES */}
                {tab === 'anomalies' && (
                  anomalies.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#10b981', fontSize: 13 }}>✅ No anomalies at {selectedSite.name} — all readings within WHO thresholds</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                        ▸ Click any row to expand a plain-English explanation of what it means and why it matters.
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            {['Severity', 'Parameter', 'Value', 'Safe Range', 'Why It Matters', 'Equipment', 'Date'].map(h => (
                              <th key={h} style={{ padding: '6px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 700, fontSize: 10 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {anomalies.map((a, i) => (<AnomalyRow key={i} a={a} />))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* TRENDS */}
                {tab === 'trends' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
                    {trends.filter(t => t.count >= 2).map((t, i) => (
                      <div key={i}
                        onClick={() => openDetail(t.param)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(t.param) } }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open detailed analysis for ${t.param.replace(/_/g, ' ')}`}
                        style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, cursor: 'pointer', transition: 'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.18)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700 }}>{t.param.replace(/_/g, ' ')}</span>
                          <span style={{ padding: '2px 6px', borderRadius: 5, fontSize: 9, fontWeight: 700, background: t.trend === 'increasing' ? 'rgba(239,68,68,.08)' : t.trend === 'decreasing' ? 'rgba(59,130,246,.08)' : 'rgba(16,185,129,.08)', color: t.trend === 'increasing' ? '#ef4444' : t.trend === 'decreasing' ? '#3b82f6' : '#10b981' }}>
                            {t.trend === 'increasing' ? '📈' : t.trend === 'decreasing' ? '📉' : '➡️'} {t.trend}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                          {t.count} readings at {selectedSite.name} · {t.unit.replace(/_/g, '/')}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, fontSize: 10, marginBottom: 4 }}>
                          <div><div style={{ fontSize: 8, color: 'var(--text-muted)' }}>Mean</div><div style={{ color: 'var(--text)', fontWeight: 700 }}>{t.mean}</div></div>
                          <div><div style={{ fontSize: 8, color: 'var(--text-muted)' }}>Std</div><div style={{ color: 'var(--text)' }}>{t.std}</div></div>
                          <div><div style={{ fontSize: 8, color: 'var(--text-muted)' }}>Range</div><div style={{ color: 'var(--text)' }}>{t.min}–{t.max}</div></div>
                          <div><div style={{ fontSize: 8, color: 'var(--text-muted)' }}>N</div><div style={{ color: 'var(--text)' }}>{t.count}</div></div>
                        </div>
                        {t.points.length >= 2 && (
                          <ResponsiveContainer width="100%" height={60}>
                            <LineChart data={t.points.map(p => ({ x: new Date(p.date).getTime(), y: p.value }))}>
                              <Line type="monotone" dataKey="y" stroke="#6366f1" strokeWidth={1.5} dot={{ r: 2 }} />
                              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, fontSize: 10 }}
                                formatter={v => [v, t.param.replace(/_/g, ' ')]} labelFormatter={v => new Date(v).toLocaleDateString()} />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* CHARTS — community-readable: safe-range bands, anomaly dots, plain English */}
                {tab === 'charts' && (
                  <ChartsTab trends={trends} siteName={selectedSite.name}
                    observationsCount={observations.length} totalReadings={analysis.totalReadings}
                    onOpenDetail={openDetail}/>
                )}

                {/* RESEARCH AI */}
                {tab === 'ai' && <ResearchAI site={selectedSite} observations={observations} analysis={analysis} />}
              </>
            )}

            {/* Click-to-drill-down: full ParameterDeepDive panel for the selected parameter.
                Reuses the same component used by the Monitoring Map, fed by THIS site's
                already-loaded observations — no extra API calls, no duplicate data. */}
            {deepDiveParam && (
              <ParameterDeepDive
                paramKey={deepDiveParam}
                observations={observations}
                siteName={selectedSite.name}
                siteId={selectedSite.id}
                onClose={() => setDeepDiveParam(null)}
              />
            )}
          </div>
        )}

        {/* No site selected */}
        {!selectedSite && !locsLoading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <Brain size={32} style={{ margin: '0 auto 10px', opacity: .3 }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>Select a monitoring site to analyze</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Search from {locations.length.toLocaleString()} sites — get anomalies, trends, charts, and AI research</div>
          </div>
        )}
      </div>
    </div>
  )
}
