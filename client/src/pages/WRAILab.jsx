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
} from 'lucide-react'
import { getAllLocations, getLocationObservations } from '../api/waterRangers'
import api from '../utils/api'

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

  for (const obs of observations) {
    qaBreakdown[obs.checked] = (qaBreakdown[obs.checked] || 0) + 1
    for (const r of (obs.readings || [])) {
      const val = parseFloat(r.value)
      if (isNaN(val) || !r.unit || r.unit === 'nil') continue
      const param = r.parameter
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

  return { anomalies, trends, qaBreakdown, totalReadings: Object.values(byParam).reduce((s, p) => s + p.length, 0) }
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

function RichParameterChart({ trend, siteName, timeRangeMs, gradientId }) {
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

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
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
            contentStyle={{ background: 'rgba(15,23,42,0.96)', border: '1px solid rgba(167,139,250,.4)', borderRadius: 8, fontSize: 11, padding: 8, backdropFilter: 'blur(6px)' }}
            labelFormatter={t => new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            formatter={(v) => {
              const safe = who ? (v >= who.min && v <= who.max) : null
              const tag = safe === null ? '' : (safe ? '  ✓ safe' : '  ⚠ outside safe')
              return [`${v}${tag}`, trend.param.replace(/_/g, ' ')]
            }}/>
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
        <div style={{ color: 'var(--text)', fontSize: 11, lineHeight: 1.55 }}>
          {plainEnglish(stats, who, trend.param)}
          {who?.explain && <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 10 }}>About {who.label}: {who.explain}.</div>}
        </div>
      </div>
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

function ChartsTab({ trends, siteName }) {
  const [range, setRange] = useState('all')
  const charted = trends.filter(t => t.count >= 3 && t.unit !== 'nil')
  if (charted.length === 0) {
    return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>Not enough readings yet to draw charts (need at least 3 per parameter).</div>
  }
  const activeMs = TIME_RANGES.find(r => r.key === range)?.ms || null

  return (
    <>
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
            timeRangeMs={activeMs} gradientId={`p${i}-${range}`}/>
        ))}
      </div>
    </>
  )
}

// ── Research AI Chat ─────────────────────────────────────────────────────────
function ResearchAI({ site, observations, analysis }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

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
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      // Send site-specific real data directly to Gemini via agent
      const { data } = await api.post('/wr/agent', {
        question: q,
        siteContext, // pass the real site data
        siteName: site.name,
      })
      const footer = `\n\n---\n*Based on ${observations.length} real observations at ${site.name} (${analysis.totalReadings} readings, ${analysis.anomalies.length} anomalies)*`
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer + footer }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.response?.data?.error || e.message}` }])
    }
    setLoading(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => send(p.prompt)} disabled={loading} style={{
            padding: '4px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
            background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.12)',
            color: '#a78bfa', cursor: 'pointer',
          }}>{p.label}</button>
        ))}
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ height: 350, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {messages.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>Ask anything about <strong>{site?.name}</strong> — the AI has access to all its real data</div>}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%', padding: '8px 12px', borderRadius: 10,
              background: m.role === 'user' ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${m.role === 'user' ? 'rgba(99,102,241,.25)' : 'var(--border)'}`,
              color: 'var(--text)', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap',
            }}>{m.content}</div>
          ))}
          {loading && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}><Loader size={12} className="animate-spin" /> Analyzing {site?.name} data...</div>}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={`Ask about ${site?.name}...`}
            style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
          <button onClick={() => send()} disabled={loading || !input.trim()} style={{
            padding: '7px 12px', borderRadius: 8, border: 'none', background: 'rgba(99,102,241,.12)', color: '#a78bfa', cursor: 'pointer',
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
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {observations.length} observations · {analysis.totalReadings} readings · {anomalies.length} anomalies · {trends.length} parameters
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
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            {['Severity', 'Parameter', 'Value', 'Safe Range', 'Why It Matters', 'Equipment', 'Date'].map(h => (
                              <th key={h} style={{ padding: '6px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 700, fontSize: 10 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {anomalies.map((a, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '5px' }}><span style={{ padding: '1px 6px', borderRadius: 5, fontSize: 9, fontWeight: 700, background: a.severity === 'critical' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)', color: a.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>{a.severity}</span></td>
                              <td style={{ padding: '5px', color: 'var(--text)', fontWeight: 600 }}>{a.param.replace(/_/g, ' ')}</td>
                              <td style={{ padding: '5px', color: '#ef4444', fontWeight: 700 }}>{a.value} {(a.unit || '').replace(/_/g, '/')}</td>
                              <td style={{ padding: '5px', color: 'var(--text-muted)' }}>{a.threshold}</td>
                              <td style={{ padding: '5px', color: 'var(--text-muted)', fontSize: 10 }}>{a.explain || ''}</td>
                              <td style={{ padding: '5px', color: 'var(--text-muted)', fontSize: 9 }}>{(a.equipment || '').replace(/_/g, ' ').slice(0, 30)}</td>
                              <td style={{ padding: '5px', color: 'var(--text-muted)' }}>{a.date ? new Date(a.date).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* TRENDS */}
                {tab === 'trends' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
                    {trends.filter(t => t.count >= 2).map((t, i) => (
                      <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
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
                  <ChartsTab trends={trends} siteName={selectedSite.name}/>
                )}

                {/* RESEARCH AI */}
                {tab === 'ai' && <ResearchAI site={selectedSite} observations={observations} analysis={analysis} />}
              </>
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
