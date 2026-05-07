/**
 * CompareDeepDive — full-screen, parameter-by-parameter comparison of two
 * Water Rangers sites with charts, CCME bands, stats per side, and a
 * plain-English verdict for each parameter.
 *
 * This is the "really cool, immersive" view referenced from the bottom
 * CompareDrawer's "Open full deep-dive" button. ParameterDeepDive.jsx is
 * intentionally NOT touched — every helper here is a small re-implementation
 * tuned for two-site overlay charts.
 *
 * Data source: same `obsA` / `obsB` arrays the drawer already has from
 * getLocationObservations(). No extra WR API calls.
 */
import { useEffect, useMemo } from 'react'
import { X, Sparkles, ChevronUp, ChevronDown, Minus, ExternalLink, MapPin, Droplets, Calendar } from 'lucide-react'
import { PARAM_META, classifyValue, latestValueFor, matchParam, TONE_COLOR } from '../../utils/waterParams'

// ── helpers ────────────────────────────────────────────────────────────────

function prettyParamName(s) {
  return String(s || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ')
    .map(w => w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function buildParamRows(obsA, obsB) {
  const seen = new Map()
  const collect = (obs) => {
    for (const o of obs || []) {
      if (!Array.isArray(o?.readings)) continue
      for (const r of o.readings) {
        if (!r?.parameter) continue
        if (!Number.isFinite(Number(r.value))) continue
        const raw = String(r.parameter)
        const key = raw.toLowerCase().trim()
        if (seen.has(key)) continue
        seen.set(key, { rawName: raw, paramKey: matchParam(raw), displayName: prettyParamName(raw) })
      }
    }
  }
  collect(obsA); collect(obsB)
  const META_RANK = { ph: 0, turbidity: 1, temperature: 2, dissolved_oxygen: 3, conductivity: 4 }
  const arr = Array.from(seen.values())
  arr.sort((x, y) => {
    const xR = x.paramKey != null ? (META_RANK[x.paramKey] ?? 99) : 100
    const yR = y.paramKey != null ? (META_RANK[y.paramKey] ?? 99) : 100
    if (xR !== yR) return xR - yR
    return x.displayName.localeCompare(y.displayName)
  })
  return arr
}

// Pull every numeric reading for a parameter out of an observations array.
// Sorted oldest → newest so charts and trend math read chronologically.
function extractSeries(param, obs) {
  if (!obs || !param) return []
  const out = []
  for (const o of obs) {
    if (!Array.isArray(o?.readings)) continue
    for (const r of o.readings) {
      if (!r?.parameter) continue
      const isMatch = param.paramKey
        ? matchParam(r.parameter) === param.paramKey
        : String(r.parameter).toLowerCase() === String(param.rawName).toLowerCase()
      if (!isMatch) continue
      const v = Number(r.value)
      if (Number.isFinite(v)) {
        out.push({
          value: v,
          unit: r.unit || '',
          at: o.observed_at || o.collected_at || o.created_at || null,
        })
      }
    }
  }
  out.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0
    const tb = b.at ? new Date(b.at).getTime() : 0
    return ta - tb
  })
  return out
}

function computeStats(series, paramKey) {
  if (!series.length) return null
  const vals = series.map(s => s.value)
  const n = vals.length
  const sum = vals.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const sorted = [...vals].sort((a, b) => a - b)
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2]
  const min = sorted[0]
  const max = sorted[n - 1]
  const sigma = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, n))

  // Trend per week — simple linear regression on time
  let trendPerWeek = null
  const dated = series.filter(s => s.at)
  if (dated.length >= 2) {
    const ts = dated.map(s => new Date(s.at).getTime())
    const t0 = ts[0]
    const xs = ts.map(t => (t - t0) / (7 * 86400000))
    const ys = dated.map(s => s.value)
    const xMean = xs.reduce((a, b) => a + b, 0) / xs.length
    const yMean = ys.reduce((a, b) => a + b, 0) / ys.length
    let num = 0, den = 0
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - xMean) * (ys[i] - yMean)
      den += (xs[i] - xMean) ** 2
    }
    trendPerWeek = den > 0 ? num / den : 0
  }

  // % time inside the safe (CCME) band — only meaningful for banded params
  let pctSafe = null
  if (paramKey && PARAM_META[paramKey]) {
    let safeCount = 0
    for (const v of vals) {
      const c = classifyValue(paramKey, v)
      if (c?.tone === 'safe') safeCount++
    }
    pctSafe = Math.round((safeCount / n) * 100)
  }

  return {
    n, mean, median, min, max, sigma, trendPerWeek, pctSafe,
    latest: series[series.length - 1],
  }
}

function fmtNum(v, unit) {
  if (v == null || !Number.isFinite(v)) return '—'
  const abs = Math.abs(+v)
  const formatted = abs >= 100 ? (+v).toFixed(1).replace(/\.0$/, '') : (+v).toFixed(2).replace(/\.00$/, '')
  return `${formatted}${unit || ''}`
}

// ── chart: two-site overlay ────────────────────────────────────────────────

function OverlayChart({ paramKey, seriesA, seriesB }) {
  const meta = paramKey ? PARAM_META[paramKey] : null
  const W = 880, H = 240
  const padL = 56, padR = 18, padT = 16, padB = 30
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const allVals = [...seriesA, ...seriesB].map(s => s.value)
  if (allVals.length === 0) {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.08)' }}>
        No numeric readings to chart for this parameter at either site.
      </div>
    )
  }

  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const span = Math.max(1e-6, maxV - minV)
  const yMin = minV - span * 0.08
  const yMax = maxV + span * 0.08
  const ySpan = Math.max(1e-6, yMax - yMin)

  const datedA = seriesA.filter(s => s.at)
  const datedB = seriesB.filter(s => s.at)
  const allDates = [...datedA, ...datedB].map(s => new Date(s.at).getTime())
  const useDates = allDates.length > 0
  const t0 = useDates ? Math.min(...allDates) : 0
  const t1 = useDates ? Math.max(...allDates) : 1
  const tspan = Math.max(1, t1 - t0)

  const yAt = v => padT + innerH - ((v - yMin) / ySpan) * innerH
  const xAtTime = t => padL + ((t - t0) / tspan) * innerW
  const xAtIdx = (i, total) => padL + (i / Math.max(1, total - 1)) * innerW

  const lineFor = (series) => {
    if (useDates) {
      return series.filter(s => s.at)
        .map(s => `${xAtTime(new Date(s.at).getTime()).toFixed(1)},${yAt(s.value).toFixed(1)}`)
        .join(' ')
    }
    return series.map((s, i) => `${xAtIdx(i, series.length).toFixed(1)},${yAt(s.value).toFixed(1)}`).join(' ')
  }

  const dotsFor = (series, color) => {
    if (useDates) {
      return series.filter(s => s.at).map((s, i) => (
        <circle key={i} cx={xAtTime(new Date(s.at).getTime())} cy={yAt(s.value)} r="3.5"
          fill={color} stroke="#0f172a" strokeWidth="0.7" />
      ))
    }
    return series.map((s, i) => (
      <circle key={i} cx={xAtIdx(i, series.length)} cy={yAt(s.value)} r="3.5"
        fill={color} stroke="#0f172a" strokeWidth="0.7" />
    ))
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img"
      style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* CCME band shading (banded params only) */}
      {meta?.ranges?.map((r, i) => {
        const yTop = yAt(Math.min(r.max, yMax))
        const yBot = yAt(Math.max(r.min, yMin))
        if (yBot <= yTop) return null
        return <rect key={i} x={padL} y={yTop} width={innerW} height={yBot - yTop}
          fill={TONE_COLOR[r.tone]} opacity={0.10} />
      })}

      {/* Lines */}
      {seriesA.length > 0 && <polyline points={lineFor(seriesA)} fill="none" stroke="#60a5fa" strokeWidth="2" />}
      {seriesB.length > 0 && <polyline points={lineFor(seriesB)} fill="none" stroke="#34d399" strokeWidth="2" />}

      {/* Dots */}
      {dotsFor(seriesA, '#60a5fa')}
      {dotsFor(seriesB, '#34d399')}

      {/* Y ticks */}
      {[yMax, (yMax + yMin) / 2, yMin].map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={yAt(v)} x2={padL + innerW} y2={yAt(v)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
          <text x={padL - 8} y={yAt(v) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">
            {Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* X labels (dates only) */}
      {useDates && (
        <>
          <text x={padL} y={padT + innerH + 18} fontSize="10" fill="#94a3b8">
            {new Date(t0).toLocaleDateString()}
          </text>
          <text x={padL + innerW} y={padT + innerH + 18} textAnchor="end" fontSize="10" fill="#94a3b8">
            {new Date(t1).toLocaleDateString()}
          </text>
        </>
      )}

      {/* Frame */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
      <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
    </svg>
  )
}

// ── stat box (one cell) ────────────────────────────────────────────────────
function StatBox({ label, value, sub, color }) {
  return (
    <div style={{
      padding: '10px 11px', borderRadius: 8,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || '#fff', marginTop: 3, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function trendColor(t) {
  if (t == null) return '#94a3b8'
  if (Math.abs(t) < 0.001) return '#cbd5e1'
  return t > 0 ? '#fbbf24' : '#a78bfa'
}

function TrendIcon({ t }) {
  if (t == null) return null
  if (Math.abs(t) < 0.001) return <Minus size={11} />
  return t > 0 ? <ChevronUp size={11}/> : <ChevronDown size={11}/>
}

function SideStatsCard({ accent, name, stats, unit, paramKey, latestClassification, safeRangeText }) {
  const trendDisplay = stats?.trendPerWeek == null ? '—'
    : `${stats.trendPerWeek > 0 ? '+' : ''}${stats.trendPerWeek.toFixed(3)}`
  return (
    <div style={{ flex: '1 1 320px', minWidth: 280, padding: 12, borderRadius: 12, background: `${accent}10`, border: `1px solid ${accent}45` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: accent, lineHeight: 1.1 }}>
          {name}
        </div>
        {latestClassification && (
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
            color: '#fff', background: TONE_COLOR[latestClassification.tone],
          }}>{latestClassification.label}</span>
        )}
      </div>
      {!stats ? (
        <div style={{ padding: '10px 0', fontSize: 12, color: '#94a3b8' }}>
          No reading at this site for this parameter.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          <StatBox
            label="Latest"
            value={fmtNum(stats.latest.value, unit)}
            sub={stats.latest.at ? new Date(stats.latest.at).toLocaleDateString() : `${stats.n} samples`}
          />
          <StatBox
            label="Safe Range"
            value={safeRangeText || 'no standard'}
            sub={paramKey ? 'SOURCE band' : '—'}
            color={safeRangeText ? '#a7f3d0' : '#94a3b8'}
          />
          <StatBox
            label="% Time Safe"
            value={stats.pctSafe != null ? `${stats.pctSafe}%` : '—'}
            sub={`${stats.n} reading${stats.n !== 1 ? 's' : ''}`}
            color={stats.pctSafe == null ? '#94a3b8' : stats.pctSafe >= 90 ? '#34d399' : stats.pctSafe >= 60 ? '#fbbf24' : '#f87171'}
          />
          <StatBox
            label="Trend / wk"
            value={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <TrendIcon t={stats.trendPerWeek}/> {trendDisplay}
              </span>
            }
            sub="linear fit"
            color={trendColor(stats.trendPerWeek)}
          />
        </div>
      )}
    </div>
  )
}

// ── plain-English verdict ──────────────────────────────────────────────────
function compareVerdict({ paramKey, statsA, statsB, classifyA, classifyB, siteA, siteB }) {
  if (!statsA && !statsB) return 'No readings at either site for this parameter yet.'
  if (!statsA) return `Only ${siteB.name} has reported readings for this parameter so far.`
  if (!statsB) return `Only ${siteA.name} has reported readings for this parameter so far.`

  const parts = []

  // Banded comparison
  if (paramKey && classifyA && classifyB) {
    const order = { safe: 3, warning: 2, critical: 1, unknown: 0 }
    const ta = order[classifyA.tone] ?? 0
    const tb = order[classifyB.tone] ?? 0
    if (ta === tb) {
      parts.push(`Both sites' latest readings sit in the "${classifyA.label}" band.`)
    } else if (ta > tb) {
      parts.push(`${siteA.name}'s latest reading is in the safer band (${classifyA.label}); ${siteB.name} is in ${classifyB.label}.`)
    } else {
      parts.push(`${siteB.name}'s latest reading is in the safer band (${classifyB.label}); ${siteA.name} is in ${classifyA.label}.`)
    }
  }

  // Magnitude
  const a = statsA.latest.value, b = statsB.latest.value
  const diff = a - b
  const ref = (Math.abs(a) + Math.abs(b)) / 2
  if (ref > 0) {
    const pct = Math.round(Math.abs(diff) / ref * 100)
    if (pct > 5) {
      parts.push(`Latest at ${diff > 0 ? siteA.name : siteB.name} is about ${pct}% higher.`)
    }
  }

  // Trends
  const ta = statsA.trendPerWeek, tb = statsB.trendPerWeek
  if (ta != null && tb != null) {
    const dirA = Math.abs(ta) < 0.001 ? 'flat' : ta > 0 ? 'rising' : 'falling'
    const dirB = Math.abs(tb) < 0.001 ? 'flat' : tb > 0 ? 'rising' : 'falling'
    if (dirA === dirB && dirA !== 'flat') {
      parts.push(`Both series are ${dirA} over time.`)
    } else if (dirA !== dirB && dirA !== 'flat' && dirB !== 'flat') {
      parts.push(`${siteA.name} is ${dirA} while ${siteB.name} is ${dirB}.`)
    }
  }

  // % time safe
  if (statsA.pctSafe != null && statsB.pctSafe != null) {
    if (Math.abs(statsA.pctSafe - statsB.pctSafe) >= 5) {
      const lead = statsA.pctSafe > statsB.pctSafe ? siteA.name : siteB.name
      const leadPct = Math.max(statsA.pctSafe, statsB.pctSafe)
      parts.push(`${lead} has been in the safe band ${leadPct}% of the time.`)
    } else if (statsA.pctSafe >= 95 && statsB.pctSafe >= 95) {
      parts.push(`Both sites have stayed in the safe band ≥95% of the time.`)
    }
  }

  return parts.join(' ') || 'Both sites have data for this parameter.'
}

// ── per-parameter card ─────────────────────────────────────────────────────
function ParamCard({ param, obsA, obsB, siteA, siteB }) {
  const meta = param.paramKey ? PARAM_META[param.paramKey] : null
  const seriesA = useMemo(() => extractSeries(param, obsA), [param, obsA])
  const seriesB = useMemo(() => extractSeries(param, obsB), [param, obsB])
  const statsA = useMemo(() => computeStats(seriesA, param.paramKey), [seriesA, param.paramKey])
  const statsB = useMemo(() => computeStats(seriesB, param.paramKey), [seriesB, param.paramKey])

  const classifyA = (param.paramKey && statsA?.latest) ? classifyValue(param.paramKey, statsA.latest.value) : null
  const classifyB = (param.paramKey && statsB?.latest) ? classifyValue(param.paramKey, statsB.latest.value) : null
  const unit = meta?.unit || (statsA?.latest?.unit ? ` ${statsA.latest.unit}` : statsB?.latest?.unit ? ` ${statsB.latest.unit}` : '')
  const sectionTitle = meta?.label || param.displayName

  // SOURCE Water "safe range" text (the banded subset's "safe" tone)
  const safeRangeText = (() => {
    if (!meta) return null
    const safeBands = meta.ranges.filter(r => r.tone === 'safe')
    if (!safeBands.length) return null
    const lo = Math.min(...safeBands.map(r => r.min))
    const hi = Math.max(...safeBands.map(r => r.max))
    return `${lo}–${hi >= 9999 ? '∞' : hi}`
  })()

  const verdict = compareVerdict({
    paramKey: param.paramKey, statsA, statsB, classifyA, classifyB, siteA, siteB,
  })

  return (
    <div style={{
      padding: 18, borderRadius: 14,
      background: 'rgba(15, 23, 42, 0.72)', border: '1px solid rgba(255,255,255,0.08)',
      marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>{sectionTitle}</h3>
        {meta ? (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.18)', color: '#a78bfa', fontWeight: 800, letterSpacing: '0.04em' }}>
            CCME band
          </span>
        ) : (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(148,163,184,0.15)', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.04em' }}>
            raw value · no SOURCE band
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
          {seriesA.length} + {seriesB.length} reading{(seriesA.length + seriesB.length) !== 1 ? 's' : ''} · {unit?.trim() || 'unitless'}
        </span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <OverlayChart paramKey={param.paramKey} seriesA={seriesA} seriesB={seriesB} />
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#cbd5e1', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 3, background: '#60a5fa', borderRadius: 2 }} />
            {siteA.name} · {seriesA.length} sample{seriesA.length !== 1 ? 's' : ''}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 3, background: '#34d399', borderRadius: 2 }} />
            {siteB.name} · {seriesB.length} sample{seriesB.length !== 1 ? 's' : ''}
          </span>
          {meta && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
              Shaded bands = SOURCE Water safety zones for this parameter
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <SideStatsCard
          accent="#60a5fa" name={siteA.name}
          stats={statsA} unit={unit} paramKey={param.paramKey}
          latestClassification={classifyA} safeRangeText={safeRangeText}
        />
        <SideStatsCard
          accent="#34d399" name={siteB.name}
          stats={statsB} unit={unit} paramKey={param.paramKey}
          latestClassification={classifyB} safeRangeText={safeRangeText}
        />
      </div>

      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.22)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#c4b5fd', letterSpacing: '0.06em', marginBottom: 4 }}>
          ✦ WHAT THIS COMPARISON SHOWS
        </div>
        <div style={{ fontSize: 12.5, color: '#e2e8f0', lineHeight: 1.55 }}>{verdict}</div>
      </div>
    </div>
  )
}

// ── site header card ──────────────────────────────────────────────────────
function SiteHeaderCard({ site, accent, badge, obs }) {
  const obsCount = Array.isArray(obs) ? obs.length : 0
  const dates = (obs || []).map(o => o?.observed_at || o?.collected_at || o?.created_at).filter(Boolean)
  const lastObs = dates.length ? new Date(dates.reduce((a, b) => new Date(a) > new Date(b) ? a : b)) : null
  const firstObs = site.first_observation_at ? new Date(site.first_observation_at) : null
  return (
    <div style={{
      flex: '1 1 360px', minWidth: 300,
      padding: 14, borderRadius: 14,
      background: `${accent}10`, border: `1px solid ${accent}55`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: accent, color: '#fff' }}>
          {badge}
        </span>
        <strong style={{ fontSize: 15, color: '#fff', lineHeight: 1.2 }}>{site.name}</strong>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: '#cbd5e1', marginBottom: 8 }}>
        {site.country && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={11}/> {site.country}</span>}
        {site.body_of_water && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Droplets size={11}/> {site.body_of_water}</span>}
        {firstObs && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={11}/> Since {firstObs.getFullYear()}</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
        <span style={{ padding: '2px 8px', borderRadius: 999, background: `${accent}33`, color: '#fff', fontWeight: 700 }}>
          {obsCount} obs loaded
        </span>
        {lastObs && <span style={{ color: '#cbd5e1' }}>· last {lastObs.toLocaleDateString()}</span>}
        {site.permalink && (
          <a href={site.permalink} target="_blank" rel="noreferrer"
            style={{ marginLeft: 'auto', color: '#a5b4fc', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            WR <ExternalLink size={11}/>
          </a>
        )}
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────
export default function CompareDeepDive({ open, siteA, siteB, obsA, obsB, onClose, loading }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const paramRows = useMemo(() => buildParamRows(obsA, obsB), [obsA, obsB])

  if (!open || !siteA || !siteB) return null

  return (
    <div
      role="dialog" aria-label="Full comparison"
      style={{
        position: 'fixed', inset: 0, zIndex: 1400,
        background: 'rgba(0, 0, 0, 0.86)', backdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.85) 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 999,
            background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: '#fff',
            fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase',
          }}>
            <Sparkles size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px' }}/>
            Full Comparison
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 13.5, flexWrap: 'wrap' }}>
            <span style={{ background: '#60a5fa', color: '#fff', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>A</span>
            <strong>{siteA.name}</strong>
            <span style={{ color: '#94a3b8' }}>vs</span>
            <span style={{ background: '#34d399', color: '#fff', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>B</span>
            <strong>{siteB.name}</strong>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{
          padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', cursor: 'pointer', display: 'flex',
        }}><X size={16}/></button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          {/* Site header strip */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            <SiteHeaderCard site={siteA} accent="#60a5fa" badge="SITE A" obs={obsA} />
            <SiteHeaderCard site={siteB} accent="#34d399" badge="SITE B" obs={obsB} />
          </div>

          {loading && (
            <div style={{ padding: 12, marginBottom: 14, borderRadius: 10, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', color: '#a5b4fc', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={12}/> Loading observations from Water Rangers…
            </div>
          )}

          {paramRows.length === 0 ? (
            <div style={{ padding: 28, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', color: '#cbd5e1', fontSize: 13 }}>
              Water Rangers hasn't returned numeric readings for either site yet.
              The full comparison populates as soon as observations are available.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                {paramRows.length} parameter{paramRows.length !== 1 ? 's' : ''} returned by Water Rangers · banded first, raw below
              </div>
              {paramRows.map(p => (
                <ParamCard
                  key={p.paramKey || `r-${p.rawName}`}
                  param={p}
                  obsA={obsA} obsB={obsB}
                  siteA={siteA} siteB={siteB}
                />
              ))}
            </>
          )}

          <div style={{ marginTop: 20, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#94a3b8', lineHeight: 1.55 }}>
            All readings pulled live from the public Water Rangers API · charts overlay both sites' time series ·
            stats are computed from the loaded observations · "% Time Safe" only computes for parameters with a published SOURCE Water band.
          </div>
        </div>
      </div>
    </div>
  )
}
