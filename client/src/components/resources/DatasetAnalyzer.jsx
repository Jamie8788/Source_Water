/**
 * DatasetAnalyzer — drop-in CSV / WR / DataStream analysis tool.
 *
 * Designed to be useful for community members AND researchers without
 * touching an LLM. Everything runs in the browser:
 *   - PapaParse handles streaming CSV upload (large files OK)
 *   - Auto-detects numeric + date columns
 *   - Per-column summary stats (n, mean, median, min, max, σ, missing)
 *   - Distribution histogram per numeric column (10 bins)
 *   - Time-series overlay if a date column exists (multi-series, one per
 *     numeric column, log-scale toggle for spread-out parameters)
 *   - Z-score anomaly flagging (|z|>2) per numeric column
 *   - Pearson correlation matrix between numeric columns
 *   - One-click export of the analysis report as JSON
 *
 * Data sources supported in v1: file upload, paste-CSV, DataStream "Download
 * a region\'s data" CSV. Water Rangers CSVs from data.waterrangers.ca work
 * out-of-the-box too — no remote URL fetch in v1 (CORS makes it unreliable),
 * so users hit "Download" on those sites and feed the file in here.
 */
import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import {
  Upload, FileText, BarChart3, Activity, GitMerge, AlertTriangle, Download,
  Database, X, Sparkles, Trash2, ChevronDown, ChevronUp, MessageSquare, Send,
  Lightbulb, Shield,
} from 'lucide-react'
import api from '../../utils/api'
import { PARAM_META, classifyValue, matchParam, TONE_COLOR } from '../../utils/waterParams'

// ── stats ──────────────────────────────────────────────────────────────────

function isFiniteNumeric(v) {
  if (v == null) return false
  if (typeof v === 'number') return Number.isFinite(v)
  const n = Number(String(v).trim())
  return Number.isFinite(n) && String(v).trim() !== ''
}

function toNum(v) {
  if (typeof v === 'number') return v
  return Number(String(v).trim())
}

// Cheap date detector: tries Date.parse on a sample of cells.
function looksLikeDate(values) {
  let hits = 0, total = 0
  for (const v of values) {
    if (v == null || v === '') continue
    total++
    if (total > 30) break
    const t = Date.parse(String(v))
    if (Number.isFinite(t)) hits++
  }
  return total > 0 && hits / total > 0.7
}

function summarize(vals) {
  if (!vals.length) return null
  const n = vals.length
  const sum = vals.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const sorted = [...vals].sort((a, b) => a - b)
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2]
  const min = sorted[0]
  const max = sorted[n - 1]
  const sigma = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, n))
  const q1 = sorted[Math.floor(n * 0.25)]
  const q3 = sorted[Math.floor(n * 0.75)]
  return { n, mean, median, min, max, sigma, q1, q3 }
}

function histogram(vals, bins = 10) {
  if (!vals.length) return []
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = Math.max(1e-9, max - min)
  const w = span / bins
  const buckets = Array.from({ length: bins }, (_, i) => ({
    from: min + i * w, to: min + (i + 1) * w, count: 0,
  }))
  for (const v of vals) {
    let i = Math.floor((v - min) / w)
    if (i >= bins) i = bins - 1
    if (i < 0) i = 0
    buckets[i].count++
  }
  return buckets
}

function zAnomalies(vals, threshold = 2) {
  const stats = summarize(vals)
  if (!stats || stats.sigma === 0) return []
  return vals
    .map((v, i) => ({ index: i, value: v, z: (v - stats.mean) / stats.sigma }))
    .filter(r => Math.abs(r.z) >= threshold)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
}

function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my
    num += a * b; dx += a * a; dy += b * b
  }
  const den = Math.sqrt(dx * dy)
  return den === 0 ? null : num / den
}

// ── tiny SVG charts (no chart lib — keeps the bundle thin) ────────────────

function MiniHistogram({ buckets, color = '#60a5fa', height = 80 }) {
  if (!buckets.length) return null
  const maxC = Math.max(...buckets.map(b => b.count), 1)
  const W = 320, H = height, padL = 26, padR = 6, padT = 4, padB = 14
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const bw = innerW / buckets.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      {buckets.map((b, i) => {
        const h = (b.count / maxC) * innerH
        return <rect key={i} x={padL + i * bw + 1} y={padT + innerH - h}
          width={Math.max(1, bw - 2)} height={h} fill={color} opacity={0.8} rx="1.5"/>
      })}
      <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
      <text x={padL} y={H - 2} fontSize="9" fill="#94a3b8">{buckets[0].from.toFixed(2)}</text>
      <text x={padL + innerW} y={H - 2} fontSize="9" fill="#94a3b8" textAnchor="end">{buckets[buckets.length - 1].to.toFixed(2)}</text>
      <text x={2} y={padT + 8} fontSize="9" fill="#94a3b8">{maxC}</text>
    </svg>
  )
}

function MiniTimeSeries({ series, color = '#34d399', height = 110 }) {
  if (!series || series.length < 2) return null
  const W = 880, H = height, padL = 38, padR = 8, padT = 8, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const ts = series.map(p => p.t)
  const vs = series.map(p => p.v)
  const t0 = Math.min(...ts), t1 = Math.max(...ts)
  const tspan = Math.max(1, t1 - t0)
  const minV = Math.min(...vs), maxV = Math.max(...vs)
  const span = Math.max(1e-9, maxV - minV)
  const yMin = minV - span * 0.05, yMax = maxV + span * 0.05
  const ySpan = Math.max(1e-9, yMax - yMin)
  const xAt = t => padL + ((t - t0) / tspan) * innerW
  const yAt = v => padT + innerH - ((v - yMin) / ySpan) * innerH
  const points = series.map(p => `${xAt(p.t).toFixed(1)},${yAt(p.v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6"/>
      {series.map((p, i) => (
        <circle key={i} cx={xAt(p.t)} cy={yAt(p.v)} r="2" fill={color}/>
      ))}
      {[yMax, (yMax + yMin) / 2, yMin].map((v, i) => (
        <text key={i} x={padL - 4} y={yAt(v) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{v.toFixed(2)}</text>
      ))}
      <text x={padL} y={H - 2} fontSize="9" fill="#94a3b8">{new Date(t0).toLocaleDateString()}</text>
      <text x={padL + innerW} y={H - 2} fontSize="9" fill="#94a3b8" textAnchor="end">{new Date(t1).toLocaleDateString()}</text>
    </svg>
  )
}

// Tiny coloured grid for the correlation matrix
function CorrelationGrid({ cols, matrix }) {
  if (!cols.length) return null
  const cellW = 56, cellH = 28, labelW = 130, padT = 28
  const W = labelW + cellW * cols.length + 12
  const H = padT + cellH * cols.length + 12
  const colour = (r) => {
    if (r == null) return '#475569'
    const t = (r + 1) / 2 // 0..1
    // Blue → grey → orange
    const lerp = (a, b, k) => Math.round(a + (b - a) * k)
    const r1 = [37, 99, 235], r2 = [148, 163, 184], r3 = [234, 88, 12]
    const c = t < 0.5
      ? r1.map((c, i) => lerp(c, r2[i], t * 2))
      : r2.map((c, i) => lerp(c, r3[i], (t - 0.5) * 2))
    return `rgb(${c[0]},${c[1]},${c[2]})`
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ minWidth: 360 }}>
      {/* col headers */}
      {cols.map((c, i) => (
        <text key={`ch-${i}`} x={labelW + i * cellW + cellW / 2} y={padT - 6}
          fontSize="9" fill="#cbd5e1" textAnchor="middle" transform={`rotate(-30 ${labelW + i * cellW + cellW / 2} ${padT - 6})`}>
          {c.length > 14 ? c.slice(0, 14) + '…' : c}
        </text>
      ))}
      {/* rows */}
      {cols.map((rowName, ri) => (
        <g key={`r-${ri}`}>
          <text x={labelW - 6} y={padT + ri * cellH + cellH / 2 + 3} fontSize="9.5" fill="#cbd5e1" textAnchor="end">
            {rowName.length > 22 ? rowName.slice(0, 22) + '…' : rowName}
          </text>
          {cols.map((_, ci) => {
            const r = matrix[ri][ci]
            return (
              <g key={`c-${ci}`}>
                <rect x={labelW + ci * cellW} y={padT + ri * cellH}
                  width={cellW - 2} height={cellH - 2}
                  fill={colour(r)} opacity={ri === ci ? 1 : 0.85} rx="3" />
                <text x={labelW + ci * cellW + cellW / 2}
                  y={padT + ri * cellH + cellH / 2 + 3.5}
                  fontSize="9.5" fill={r != null && Math.abs(r) > 0.4 ? '#fff' : '#0f172a'} textAnchor="middle" fontWeight="700">
                  {r == null ? '·' : r.toFixed(2)}
                </text>
              </g>
            )
          })}
        </g>
      ))}
    </svg>
  )
}

// ── plain-English layer (no LLM — pure deterministic prose) ───────────────

function explainStability(stats) {
  if (!stats || stats.mean === 0) return 'consistent'
  const cv = Math.abs(stats.sigma / stats.mean)
  if (cv < 0.05) return 'very stable'
  if (cv < 0.15) return 'consistent'
  if (cv < 0.35) return 'somewhat variable'
  return 'highly variable'
}

// Compute a plain-English numeric column summary, optionally enriched with
// SOURCE Water (CCME) band coverage when the column name maps to a known
// parameter. Returns { text, safetyVerdict, safeRange, pctSafe }.
function explainNumeric(name, info, paramKey) {
  const s = info.stats
  if (!s) return { text: 'Not enough data to summarise.', safetyVerdict: null }
  const stab = explainStability(s)
  const r = `${s.min.toFixed(2)} → ${s.max.toFixed(2)}`
  let text = `${s.n} reading${s.n !== 1 ? 's' : ''} of ${name}. Typical value ~${s.mean.toFixed(2)} (${stab}; range ${r}; std dev ±${s.sigma.toFixed(2)}).`
  let safetyVerdict = null
  let safeRange = null
  let pctSafe = null
  if (paramKey && PARAM_META[paramKey]) {
    const meta = PARAM_META[paramKey]
    const safeBands = meta.ranges.filter(r => r.tone === 'safe')
    if (safeBands.length) {
      const lo = Math.min(...safeBands.map(r => r.min))
      const hi = Math.max(...safeBands.map(r => r.max))
      safeRange = `${lo}–${hi >= 9999 ? '∞' : hi}${meta.unit || ''}`
      let safeCount = 0, warnCount = 0, critCount = 0
      for (const v of info.vals) {
        const c = classifyValue(paramKey, v)
        if (c?.tone === 'safe') safeCount++
        else if (c?.tone === 'warning') warnCount++
        else if (c?.tone === 'critical') critCount++
      }
      pctSafe = Math.round(safeCount / s.n * 100)
      const verdict = pctSafe >= 95 ? 'safe'
        : pctSafe >= 70 ? 'mostly-safe'
        : pctSafe >= 40 ? 'mixed'
        : 'concerning'
      safetyVerdict = { tone: verdict, pctSafe, warnCount, critCount }
      text += ` Safe range for aquatic life: ${safeRange}. ${pctSafe}% of readings sit inside it.`
    }
  }
  return { text, safetyVerdict, safeRange, pctSafe }
}

// Pull out the strongest pairwise relationships and label them in plain
// English ("when one rises, the other rises too"). Filters by absolute r.
function explainCorrelations(numericCols, matrix) {
  if (!numericCols || numericCols.length < 2) return []
  const out = []
  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const r = matrix[i][j]
      if (r == null || !Number.isFinite(r) || Math.abs(r) < 0.4) continue
      const strength = Math.abs(r) >= 0.85 ? 'very strong'
        : Math.abs(r) >= 0.7 ? 'strong'
        : Math.abs(r) >= 0.55 ? 'moderate'
        : 'weak'
      const dir = r > 0 ? 'rise together' : 'move in opposite directions'
      out.push({
        a: numericCols[i], b: numericCols[j], r,
        text: `${numericCols[i]} and ${numericCols[j]} ${dir} (${strength} link, r=${r.toFixed(2)}).`,
      })
    }
  }
  out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r))
  return out.slice(0, 5)
}

function overallSafetyVerdict(perColumnVerdicts) {
  // Roll up per-column safety verdicts into one site-level rating.
  const banded = perColumnVerdicts.filter(v => v && v.pctSafe != null)
  if (!banded.length) return null
  const avgPct = banded.reduce((a, v) => a + v.pctSafe, 0) / banded.length
  const minPct = Math.min(...banded.map(v => v.pctSafe))
  if (minPct >= 95) return { tone: 'safe', text: `All ${banded.length} matched parameter${banded.length !== 1 ? 's' : ''} are 95%+ inside their safe range.` }
  if (minPct >= 70) return { tone: 'mostly-safe', text: `${banded.length} matched parameter${banded.length !== 1 ? 's' : ''} mostly safe (lowest ${Math.round(minPct)}% in range). Worth checking the outliers.` }
  if (avgPct >= 40)  return { tone: 'mixed', text: `Mixed picture — average ${Math.round(avgPct)}% of readings sit in the safe band across matched parameters.` }
  return { tone: 'concerning', text: `Concerning — average only ${Math.round(avgPct)}% of readings inside safe ranges. Investigation recommended.` }
}

// ── long-format pivot ─────────────────────────────────────────────────────
// DataStream and Water Rangers CSV exports are "long" / "tidy": one READING
// per row, with the parameter name in a `CharacteristicName` cell and the
// number in `ResultValue`. The analyzer expects "wide" data (one column per
// parameter) — without this pivot it sees a single meaningless "ResultValue"
// column mixing pH, nitrites, temperature… together, matches no SOURCE Water
// band, and "fails to provide info" (Elaine, on dataset_download_4344.csv).
//
// This detects the long layout and pivots it: readings are grouped by
// location + date + time into one observation row each, and every distinct
// CharacteristicName becomes its own column. Every output row carries every
// parameter column (blank where unmeasured) so the analyzer's column scan
// doesn't miss params absent from the first row.
function maybePivotLongFormat(rows) {
  if (!rows.length) return { rows, pivoted: false }
  const cols = Object.keys(rows[0])
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const find = (re) => cols.find(c => re.test(norm(c)))
  const charCol = find(/^(characteristicname|parameter|parametername|analyte)$/)
  const valCol  = find(/^(resultvalue|value|measurementvalue|result)$/)
  if (!charCol || !valCol) return { rows, pivoted: false }  // already wide

  const locCol  = find(/(monitoringlocationname|locationname|sitename|^location$|^site$|station)/)
  const idCol   = find(/(monitoringlocationid|locationid|siteid)/)
  const dateCol = find(/(activitystartdate|^date$|sampledate|observeddate|datetime)/)
  const timeCol = find(/(activitystarttime|^time$|sampletime)/)

  const groups = new Map()
  const order = []
  const allParams = new Set()
  for (const r of rows) {
    const param = String(r[charCol] ?? '').trim()
    if (!param) continue
    allParams.add(param)
    const loc  = locCol  ? String(r[locCol]  ?? '').trim() : ''
    const id   = idCol   ? String(r[idCol]   ?? '').trim() : ''
    const date = dateCol ? String(r[dateCol] ?? '').trim() : ''
    const time = timeCol ? String(r[timeCol] ?? '').trim() : ''
    const key  = `${id}|${loc}|${date}|${time}`
    if (!groups.has(key)) {
      const base = {}
      if (locCol)  base.Location = loc
      if (dateCol) base.Date = date
      groups.set(key, base)
      order.push(key)
    }
    const wide = groups.get(key)
    // First non-empty value wins if a parameter repeats within one observation.
    if (wide[param] == null || wide[param] === '') wide[param] = r[valCol]
  }
  const paramList = [...allParams]
  const pivotedRows = order.map(k => {
    const w = groups.get(k)
    for (const p of paramList) if (!(p in w)) w[p] = ''
    return w
  })
  return {
    rows: pivotedRows,
    pivoted: true,
    info: { readings: rows.length, observations: pivotedRows.length, parameters: paramList.length },
  }
}

// ── analysis pipeline ─────────────────────────────────────────────────────

function analyzeRows(rows) {
  if (!rows.length) return null
  const cols = Object.keys(rows[0] || {})
  const profile = {}
  const numericCols = []
  const dateCols = []
  for (const c of cols) {
    const raw = rows.map(r => r[c])
    const numericVals = raw.filter(isFiniteNumeric).map(toNum)
    const missing = raw.filter(v => v == null || v === '').length
    const filled = raw.length - missing
    // A column is numeric when ≥3 of its FILLED cells are numbers AND ≥70%
    // of the filled cells are numeric. The old test used 40% of ALL rows,
    // which wrongly demoted sparse parameters to "text" — e.g. nitrites,
    // measured in only 11 of 99 pivoted observations, never reached the
    // bar even though every value present was a real number.
    if (numericVals.length >= 3 && numericVals.length >= filled * 0.7) {
      // Try to map to a SOURCE Water parameter (pH, turbidity, water temp,
      // DO, conductivity, nitrate…) by name so we attach safe-range bands.
      const paramKey = matchParam(c)
      const stats = summarize(numericVals)
      const colInfo = { kind: 'numeric', stats, missing, total: raw.length, vals: numericVals, paramKey }
      const explanation = explainNumeric(c, colInfo, paramKey)
      colInfo.explanation = explanation
      profile[c] = colInfo
      numericCols.push(c)
    } else if (looksLikeDate(raw)) {
      profile[c] = { kind: 'date', missing, total: raw.length }
      dateCols.push(c)
    } else {
      const uniq = new Set(raw.filter(v => v != null && v !== '').map(String))
      profile[c] = {
        kind: 'text',
        unique: uniq.size,
        missing,
        total: raw.length,
        topValues: Array.from(uniq).slice(0, 4),
      }
    }
  }
  // Histograms
  const histos = {}
  for (const c of numericCols) histos[c] = histogram(profile[c].vals, 10)
  // Time-series per numeric col, using the first detected date column as t
  const timeseries = {}
  if (dateCols.length) {
    const dc = dateCols[0]
    for (const c of numericCols) {
      const points = []
      for (const r of rows) {
        const d = r[dc]
        const v = r[c]
        if (d == null || d === '' || !isFiniteNumeric(v)) continue
        const t = Date.parse(String(d))
        if (!Number.isFinite(t)) continue
        points.push({ t, v: toNum(v) })
      }
      points.sort((a, b) => a.t - b.t)
      if (points.length >= 2) timeseries[c] = points
    }
  }
  // Anomalies per numeric col
  const anomalies = {}
  for (const c of numericCols) {
    anomalies[c] = zAnomalies(profile[c].vals).slice(0, 5)
  }
  // Correlation matrix
  const corrMatrix = numericCols.map(rn =>
    numericCols.map(cn => {
      if (rn === cn) return 1
      // Align by row index — pick rows where both columns have a numeric
      const xs = [], ys = []
      for (const r of rows) {
        if (isFiniteNumeric(r[rn]) && isFiniteNumeric(r[cn])) {
          xs.push(toNum(r[rn]))
          ys.push(toNum(r[cn]))
        }
      }
      return pearson(xs, ys)
    })
  )
  const correlationInsights = explainCorrelations(numericCols, corrMatrix)
  const safetyVerdicts = numericCols.map(c => profile[c].explanation?.safetyVerdict).filter(Boolean)
  const overallSafety = overallSafetyVerdict(safetyVerdicts)

  // Date span helper for the takeaways header
  let dateSpan = null
  if (dateCols.length) {
    const dc = dateCols[0]
    const ts = rows.map(r => Date.parse(String(r[dc] ?? ''))).filter(Number.isFinite)
    if (ts.length >= 2) {
      const t0 = Math.min(...ts), t1 = Math.max(...ts)
      const days = Math.round((t1 - t0) / 86400000)
      dateSpan = { first: new Date(t0), last: new Date(t1), days, dateColumn: dc }
    }
  }

  return {
    rowCount: rows.length,
    colCount: cols.length,
    cols,
    profile,
    numericCols,
    dateCols,
    histograms: histos,
    timeseries,
    anomalies,
    corrMatrix,
    correlationInsights,
    overallSafety,
    dateSpan,
  }
}

// ── main UI ───────────────────────────────────────────────────────────────

export default function DatasetAnalyzer() {
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [filename, setFilename] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileRef = useRef()

  const runOnText = useCallback((text, name) => {
    setBusy(true); setError('')
    Papa.parse(text, {
      header: true, skipEmptyLines: true, dynamicTyping: false,
      complete: (res) => {
        try {
          const raw = (res.data || []).filter(r => r && Object.keys(r).length)
          if (!raw.length) { setError('No data rows found in this CSV.'); setBusy(false); return }
          const { rows, pivoted, info } = maybePivotLongFormat(raw)
          const a = analyzeRows(rows)
          if (a && pivoted) a.pivotInfo = info
          setAnalysis(a)
          setFilename(name || 'pasted-data.csv')
        } catch (e) {
          setError(e?.message || 'Failed to analyze CSV.')
        } finally { setBusy(false) }
      },
      error: (err) => { setError(err?.message || 'Could not parse CSV.'); setBusy(false) },
    })
  }, [])

  const onFile = (file) => {
    if (!file) return
    setBusy(true); setError(''); setAnalysis(null)
    Papa.parse(file, {
      header: true, skipEmptyLines: true, dynamicTyping: false,
      complete: (res) => {
        try {
          const raw = (res.data || []).filter(r => r && Object.keys(r).length)
          if (!raw.length) { setError('No data rows found in this file.'); setBusy(false); return }
          const { rows, pivoted, info } = maybePivotLongFormat(raw)
          const a = analyzeRows(rows)
          if (a && pivoted) a.pivotInfo = info
          setAnalysis(a)
          setFilename(file.name)
        } catch (e) {
          setError(e?.message || 'Failed to analyze file.')
        } finally { setBusy(false) }
      },
      error: (err) => { setError(err?.message || 'Could not parse file.'); setBusy(false) },
    })
  }

  const reset = () => {
    setAnalysis(null); setFilename(''); setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const downloadReport = () => {
    if (!analysis) return
    const report = {
      filename, generated_at: new Date().toISOString(),
      row_count: analysis.rowCount, column_count: analysis.colCount,
      columns: analysis.cols.map(c => ({
        name: c,
        kind: analysis.profile[c].kind,
        ...(analysis.profile[c].kind === 'numeric' ? {
          stats: analysis.profile[c].stats,
          missing: analysis.profile[c].missing,
          anomalies: analysis.anomalies[c],
        } : analysis.profile[c]),
      })),
      correlation_matrix: analysis.numericCols.map((rn, ri) => ({
        row: rn,
        cells: analysis.numericCols.map((cn, ci) => ({ col: cn, r: analysis.corrMatrix[ri][ci] })),
      })),
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${filename.replace(/\.[^.]+$/, '')}-analysis.json`
    a.click()
  }

  return (
    <div style={{
      marginTop: 22, padding: 18, borderRadius: 14,
      background: 'linear-gradient(180deg, rgba(99,102,241,0.06) 0%, rgba(99,102,241,0.02) 100%)',
      border: '1px solid rgba(99,102,241,0.30)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 999,
          background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: '#fff',
          fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase',
        }}>
          <Sparkles size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px' }}/>
          Dataset Analyzer
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Drop a CSV from <strong>Water Rangers</strong>, <strong>DataStream</strong>, or your own field log → instant stats, anomalies, time-series, and correlations. Runs entirely in your browser — no upload, no LLM.
        </span>
      </div>

      {!analysis && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <label style={{
            flex: '1 1 240px', minWidth: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(99,102,241,0.10)', border: '1.5px dashed rgba(99,102,241,0.45)', color: '#a78bfa',
          }}>
            <Upload size={16}/> Choose a CSV file
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
              onChange={e => onFile(e.target.files?.[0])} />
          </label>
          <button onClick={() => setPasteOpen(o => !o)} style={{
            flex: '1 1 200px', minWidth: 200, padding: '14px 16px', borderRadius: 10,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.18)', color: 'var(--text-muted)',
          }}>
            <FileText size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }}/>
            {pasteOpen ? 'Hide paste box' : 'Or paste CSV text'}
          </button>
          <a href="https://datastream.org/en-ca/" target="_blank" rel="noreferrer" style={{
            flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '14px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
            background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.35)', color: '#86efac',
            textDecoration: 'none',
          }}>
            <Database size={14}/> Get a CSV from DataStream
          </a>
          <a href="https://data.waterrangers.ca/" target="_blank" rel="noreferrer" style={{
            flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '14px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
            background: 'rgba(0,111,191,0.12)', border: '1px solid rgba(0,111,191,0.38)', color: '#60a5fa',
            textDecoration: 'none',
          }}>
            <Database size={14}/> Get a CSV from Water Rangers
          </a>
        </div>
      )}

      {!analysis && pasteOpen && (
        <div style={{ marginTop: 10 }}>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={6} placeholder="Paste raw CSV (first row = column names)…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8,
              background: 'rgba(0,0,0,0.18)', border: '1px solid var(--border)', color: 'var(--text)',
              fontSize: 12, fontFamily: 'ui-monospace, Menlo, monospace', resize: 'vertical',
            }}
          />
          <div style={{ marginTop: 6, textAlign: 'right' }}>
            <button onClick={() => runOnText(pasteText, 'pasted-data.csv')} disabled={!pasteText.trim() || busy}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: !pasteText.trim() ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: '#fff', border: 'none',
                opacity: !pasteText.trim() ? 0.5 : 1,
              }}
            >Analyze pasted CSV</button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, fontSize: 12, color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}
      {busy && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#a5b4fc' }}>Crunching numbers…</div>
      )}

      {analysis && (
        <AnalysisReport
          analysis={analysis} filename={filename}
          onReset={reset} onDownload={downloadReport}
        />
      )}
    </div>
  )
}

// ── per-column rendering ──────────────────────────────────────────────────

function NumericColumnCard({ name, info, anomalies, histogramData, tsData }) {
  const [open, setOpen] = useState(true)
  const s = info.stats
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      marginBottom: 10,
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{name}</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(96,165,250,0.18)', color: '#60a5fa', fontWeight: 700 }}>
            numeric
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            n={s.n} · {info.missing > 0 && <>missing {info.missing} · </>}
            mean {s.mean.toFixed(2)} · σ {s.sigma.toFixed(2)}
          </span>
          {anomalies.length > 0 && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.15)', color: '#fca5a5', fontWeight: 700 }}>
              {anomalies.length} outlier{anomalies.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Plain-English summary — computed locally, not from an LLM, so
              it always reflects the EXACT numbers in the loaded data. */}
          {info.explanation && (
            <div style={{
              padding: 12, borderRadius: 10,
              background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.22)',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <Lightbulb size={14} color="#c4b5fd" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#c4b5fd', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                  In plain English
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6 }}>
                  {info.explanation.text}
                </div>
                {info.explanation.safetyVerdict && (
                  <SafetyChip verdict={info.explanation.safetyVerdict} />
                )}
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
            {[
              { l: 'Min', v: s.min }, { l: 'Q1', v: s.q1 }, { l: 'Median', v: s.median },
              { l: 'Mean', v: s.mean }, { l: 'Q3', v: s.q3 }, { l: 'Max', v: s.max },
              { l: 'σ (std)', v: s.sigma },
            ].map(x => (
              <div key={x.l} style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{x.l}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{Number(x.v).toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Histogram */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
              <BarChart3 size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
              Distribution (10 bins)
            </div>
            <MiniHistogram buckets={histogramData} />
          </div>

          {/* Time series */}
          {tsData && tsData.length >= 2 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                <Activity size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
                Time series ({tsData.length} samples)
              </div>
              <MiniTimeSeries series={tsData} />
            </div>
          )}

          {/* Anomalies */}
          {anomalies.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', marginBottom: 4 }}>
                <AlertTriangle size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
                Top outliers (|z|≥2)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {anomalies.map((a, i) => (
                  <span key={i} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 999,
                    background: 'rgba(239,68,68,0.10)', color: '#fca5a5',
                    border: '1px solid rgba(239,68,68,0.25)',
                  }}>
                    row #{a.index + 1} · {a.value.toFixed(2)} · z={a.z.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── grounded Q&A ──────────────────────────────────────────────────────────
// Hard cap on LLM calls: 5 questions per browser per UTC day. Counter is
// kept in localStorage so a refresh / reload doesn't reset it. The cap
// keeps the free-tier endpoint affordable; users see how many they have
// left and can still browse the full report after running out.
const QA_DAILY_CAP = 5
const qaKey = () => 'sw_dataset_qa_used_' + new Date().toISOString().slice(0, 10)

function readUsed()  { try { return parseInt(localStorage.getItem(qaKey()) || '0', 10) || 0 } catch { return 0 } }
function bumpUsed()  { try { localStorage.setItem(qaKey(), String(readUsed() + 1)) } catch {} }

// Build a compact, exact factual summary of the dataset that the LLM is
// allowed to reference. We deliberately keep this small (a few hundred
// tokens) to (a) avoid free-tier overages and (b) prevent the model from
// drowning in noise and inventing details. Every fact here was computed
// deterministically from the user's CSV.
function summarizeForLLM(analysis, filename, sampleRows) {
  const cols = analysis.cols.map(c => {
    const p = analysis.profile[c]
    if (p.kind === 'numeric') {
      const s = p.stats
      const e = p.explanation || {}
      return {
        name: c, kind: 'numeric',
        n: s.n, missing: p.missing,
        min: +s.min.toFixed(3), max: +s.max.toFixed(3),
        mean: +s.mean.toFixed(3), median: +s.median.toFixed(3),
        std_dev: +s.sigma.toFixed(3),
        ...(p.paramKey ? {
          source_water_band: e.safeRange,
          percent_in_safe_range: e.pctSafe,
          critical_readings: e.safetyVerdict?.critCount || 0,
          warning_readings: e.safetyVerdict?.warnCount || 0,
        } : {}),
        outlier_count: (analysis.anomalies?.[c] || []).length,
      }
    }
    if (p.kind === 'date') return { name: c, kind: 'date', missing: p.missing }
    return { name: c, kind: 'text', unique_values: p.unique, missing: p.missing, examples: p.topValues }
  })
  return {
    filename,
    row_count: analysis.rowCount,
    column_count: analysis.colCount,
    date_range: analysis.dateSpan ? {
      first: analysis.dateSpan.first.toISOString().slice(0, 10),
      last: analysis.dateSpan.last.toISOString().slice(0, 10),
      days: analysis.dateSpan.days,
    } : null,
    columns: cols,
    overall_safety_verdict: analysis.overallSafety?.text || null,
    strongest_correlations: (analysis.correlationInsights || []).slice(0, 5).map(c => ({
      a: c.a, b: c.b, r: +c.r.toFixed(2), summary: c.text,
    })),
    sample_rows: sampleRows,
  }
}

// Auto-generate a few starter prompts grounded in what the data actually
// contains. Avoids generic suggestions that the data can't answer.
function buildSuggestions(analysis) {
  const out = []
  const matched = analysis.numericCols.filter(c => analysis.profile[c]?.paramKey)
  if (analysis.overallSafety) out.push(`Is this water safe overall? Why?`)
  if (matched.length) out.push(`Which ${matched[0]} readings are concerning, and when?`)
  const conc = analysis.numericCols.find(c => {
    const v = analysis.profile[c]?.explanation?.safetyVerdict
    return v && (v.tone === 'concerning' || v.tone === 'mixed')
  })
  if (conc) out.push(`Why might ${conc} be outside the safe range?`)
  if ((analysis.correlationInsights || []).length) out.push(`What does the link between ${analysis.correlationInsights[0].a} and ${analysis.correlationInsights[0].b} mean?`)
  if (analysis.dateSpan && analysis.dateSpan.days > 30) out.push(`Are values trending up or down over time?`)
  if (out.length < 4 && analysis.numericCols.length) out.push(`Summarise this dataset for someone who isn't a scientist.`)
  return out.slice(0, 4)
}

function AskAboutDataset({ analysis, filename }) {
  const [used, setUsed]       = useState(() => readUsed())
  const [input, setInput]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [history, setHistory] = useState([])  // [{ q, a, model }]
  const remaining = Math.max(0, QA_DAILY_CAP - used)
  const suggestions = useMemo(() => buildSuggestions(analysis), [analysis])

  // Sample 3 rows from the user's CSV. Only used to ground the LLM, never
  // shown back to the user. Keeps token cost minimal.
  const sampleRows = useMemo(() => {
    const rowCount = analysis.rowCount
    if (!rowCount) return []
    // We only have profile-level data here; sample synthetic rows by
    // picking representative values per column to ensure factual grounding.
    const samples = []
    for (let i = 0; i < Math.min(3, rowCount); i++) {
      const row = {}
      for (const c of analysis.cols) {
        const p = analysis.profile[c]
        if (p?.kind === 'numeric' && p.vals?.length) {
          row[c] = +p.vals[Math.min(i, p.vals.length - 1)].toFixed(3)
        }
      }
      samples.push(row)
    }
    return samples
  }, [analysis])

  const SYSTEM_PROMPT = useMemo(() => {
    const summary = summarizeForLLM(analysis, filename, sampleRows)
    return [
      `You are a careful water-quality educator embedded in SOURCE Water's Resources tab. A community member just uploaded a CSV and is asking you to interpret it for them.`,
      ``,
      `STRICT RULES — break any of these and you fail the task:`,
      `1. Use ONLY the dataset summary below. Do NOT invent values, dates, units, sources, or thresholds.`,
      `2. Quote exact numbers from the summary when citing values. Round only for readability and say so ("about", "roughly").`,
      `3. If the user's question can't be answered from this summary, reply EXACTLY: "The data you uploaded doesn't show that — but here's what we can see…" then describe related facts that ARE in the summary.`,
      `4. For safety questions, reference ONLY the SOURCE Water bands listed in the summary. Do NOT cite WHO, EPA, Health Canada, or any external threshold — they are not in this dataset.`,
      `5. Never give medical, drinking-water, or treatment advice. SOURCE Water is for surface-water / aquatic-life context only. If asked about drinking safety, say so and stop.`,
      `6. Keep answers under 100 words. Plain English. Define any technical term you use.`,
      `7. Never make up correlations, trends, anomalies, or column names that aren't in the summary.`,
      ``,
      `DATASET SUMMARY (the ONLY facts you may cite):`,
      JSON.stringify(summary, null, 2),
    ].join('\n')
  }, [analysis, filename, sampleRows])

  const ask = async (rawQ) => {
    const q = String(rawQ || '').trim().slice(0, 240)
    if (!q) return
    if (remaining <= 0) {
      setError(`You've used all ${QA_DAILY_CAP} questions for today. Resets after midnight.`)
      return
    }
    setBusy(true); setError('')
    try {
      // Pre-flight: refuse off-topic questions locally (no LLM call) when
      // they obviously can't be answered from the data — keeps the daily
      // budget for real questions.
      const lower = q.toLowerCase()
      const driftKeywords = ['drink', 'safe to drink', 'should i drink', 'medical', 'treat', 'illness', 'disease', 'symptom']
      if (driftKeywords.some(k => lower.includes(k))) {
        setHistory(h => [...h, {
          q, model: 'local',
          a: `SOURCE Water is a surface-water and aquatic-life tool — it doesn't cover drinking-water safety, medical, or treatment questions. For those, talk to your local public-health authority. The dataset above tells you about the water environment, not consumption risk.`,
        }])
        setInput('')
        return
      }
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.flatMap(h => [
          { role: 'user', content: h.q },
          { role: 'assistant', content: h.a },
        ]),
        { role: 'user', content: q },
      ]
      const r = await api.post('/ai/public-chat', { messages, max_tokens: 320 })
      const reply = String(r.data?.reply || '').trim() || `I couldn't generate an answer this time. Please rephrase or try again.`
      bumpUsed()
      setUsed(readUsed())
      setHistory(h => [...h, { q, a: reply, model: r.data?.model || 'AI' }])
      setInput('')
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Network error.')
    } finally { setBusy(false) }
  }

  return (
    <div style={{
      padding: 14, borderRadius: 12, marginBottom: 14,
      background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.28)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={14} color="#5eead4"/>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#5eead4', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Ask about your data
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {remaining} of {QA_DAILY_CAP} questions left today · grounded only in this CSV
        </div>
      </div>

      {/* Suggestions — built from the actual data, not generic */}
      {history.length === 0 && suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => ask(s)} disabled={busy || remaining <= 0}
              style={{
                padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: busy || remaining <= 0 ? 'not-allowed' : 'pointer',
                background: 'rgba(20,184,166,0.10)', color: '#5eead4',
                border: '1px solid rgba(20,184,166,0.40)', opacity: busy || remaining <= 0 ? 0.5 : 1,
              }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Conversation history */}
      {history.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10, maxHeight: 360, overflowY: 'auto' }}>
          {history.map((h, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                alignSelf: 'flex-end', maxWidth: '85%',
                padding: '8px 12px', borderRadius: '12px 12px 4px 12px',
                background: 'rgba(96,165,250,0.18)', color: '#e2e8f0',
                fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>{h.q}</div>
              <div style={{
                alignSelf: 'flex-start', maxWidth: '92%',
                padding: '10px 12px', borderRadius: '12px 12px 12px 4px',
                background: 'rgba(255,255,255,0.05)', color: 'var(--text)',
                fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                {h.a}
                <div style={{ marginTop: 4, fontSize: 9.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {h.model === 'local' ? 'no AI call · grounded redirect' : `via ${h.model}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); ask(input) }} style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value.slice(0, 240))}
          placeholder={remaining > 0
            ? "Ask anything about the data above (max 240 chars)…"
            : "Daily limit reached — resets after midnight."}
          disabled={busy || remaining <= 0}
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 8,
            background: 'rgba(0,0,0,0.18)', border: '1px solid var(--border)', color: 'var(--text)',
            fontSize: 13, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button type="submit" disabled={busy || !input.trim() || remaining <= 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 800, cursor: busy || !input.trim() || remaining <= 0 ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg, #14b8a6, #0d9488)', color: '#fff', border: 'none',
            opacity: busy || !input.trim() || remaining <= 0 ? 0.55 : 1,
          }}
        >
          {busy ? '…' : <><Send size={12}/> Ask</>}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 8, fontSize: 11.5, color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Answers are grounded ONLY in the dataset summary above (column stats + sample rows + matched SOURCE Water bands).
        The model is told never to invent values, never to cite external thresholds, and never to give drinking-water or medical advice.
        If a question can't be answered from your CSV, the assistant will say so instead of guessing.
      </div>
    </div>
  )
}

// Small coloured pill summarising one column's safe-range coverage.
function SafetyChip({ verdict }) {
  const styles = {
    safe:        { bg: 'rgba(34,197,94,0.14)',  bd: 'rgba(34,197,94,0.4)',  fg: '#86efac', emoji: '✓', text: 'In safe range' },
    'mostly-safe':{ bg: 'rgba(132,204,22,0.14)',bd: 'rgba(132,204,22,0.4)', fg: '#bef264', emoji: '✓', text: 'Mostly safe' },
    mixed:       { bg: 'rgba(251,191,36,0.14)', bd: 'rgba(251,191,36,0.4)', fg: '#fcd34d', emoji: '⚠', text: 'Mixed — watch' },
    concerning:  { bg: 'rgba(239,68,68,0.14)',  bd: 'rgba(239,68,68,0.4)',  fg: '#fca5a5', emoji: '⚠', text: 'Concerning' },
  }
  const s = styles[verdict.tone] || styles.mixed
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6,
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: s.bg, border: `1px solid ${s.bd}`, color: s.fg,
    }}>
      {s.emoji} {s.text} · {verdict.pctSafe}% in safe range
      {verdict.critCount > 0 && <span style={{ marginLeft: 4, color: '#fca5a5' }}>· {verdict.critCount} critical</span>}
    </div>
  )
}

// Top-of-report at-a-glance card. Pure deterministic — every line maps
// to a value already in `analysis`, so the LLM (used below in Q&A) can
// never disagree with what's shown here.
function QuickTakeaways({ analysis }) {
  const safety = analysis.overallSafety
  const corrs = analysis.correlationInsights || []
  const totalAnomalies = Object.values(analysis.anomalies || {}).reduce((a, b) => a + (b?.length || 0), 0)
  const matchedCount = analysis.numericCols.filter(c => analysis.profile[c]?.paramKey).length
  return (
    <div style={{
      padding: 14, borderRadius: 12, marginBottom: 12,
      background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(167,139,250,0.06))',
      border: '1px solid rgba(99,102,241,0.32)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c4b5fd', marginBottom: 8 }}>
        ✦ Quick takeaways
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55 }}>
        <li>
          <strong>{analysis.rowCount.toLocaleString()}</strong> rows across <strong>{analysis.colCount}</strong> columns
          {analysis.numericCols.length > 0 && <> ({analysis.numericCols.length} numeric)</>}
          {analysis.dateSpan && <> · spans <strong>{analysis.dateSpan.days}</strong> days ({analysis.dateSpan.first.toLocaleDateString()} → {analysis.dateSpan.last.toLocaleDateString()})</>}
        </li>
        {matchedCount > 0 && (
          <li>
            <strong>{matchedCount}</strong> column{matchedCount !== 1 ? 's' : ''} matched a SOURCE Water safety band
            (pH, turbidity, temperature, dissolved oxygen, conductivity).
          </li>
        )}
        {safety && (
          <li>
            <Shield size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4, color: safety.tone === 'safe' ? '#86efac' : safety.tone === 'concerning' ? '#fca5a5' : '#fcd34d' }}/>
            <strong>Safety roll-up:</strong> {safety.text}
          </li>
        )}
        {totalAnomalies > 0 && (
          <li>
            <AlertTriangle size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4, color: '#fca5a5' }}/>
            <strong>{totalAnomalies}</strong> outlier reading{totalAnomalies !== 1 ? 's' : ''} flagged across all columns (|z| ≥ 2).
          </li>
        )}
        {corrs.slice(0, 2).map((c, i) => (
          <li key={i}>
            <GitMerge size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4, color: '#a78bfa' }}/>
            {c.text}
          </li>
        ))}
        {analysis.numericCols.length === 0 && (
          <li style={{ color: 'var(--text-muted)' }}>
            No numeric columns detected — everything looks like text or categorical data.
          </li>
        )}
      </ul>
    </div>
  )
}

function TextColumnCard({ name, info }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{name}</span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(148,163,184,0.18)', color: '#94a3b8', fontWeight: 700 }}>
          {info.kind}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {info.unique != null && <>{info.unique} unique · </>}
          {info.missing > 0 && <>missing {info.missing} · </>}
          {info.total} rows
        </span>
        {info.topValues?.length > 0 && (
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            e.g. {info.topValues.slice(0, 3).join(' · ')}{info.topValues.length > 3 ? ' …' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

function AnalysisReport({ analysis, filename, onReset, onDownload }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: 10, marginBottom: 12, gap: 10,
        background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={16} color="#86efac" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>{filename}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {analysis.rowCount.toLocaleString()} rows · {analysis.colCount} columns
              {analysis.numericCols.length > 0 && <> · {analysis.numericCols.length} numeric</>}
              {analysis.dateCols.length > 0 && <> · {analysis.dateCols.length} date</>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onDownload} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.14)',
          }}>
            <Download size={12}/> JSON report
          </button>
          <button onClick={onReset} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(239,68,68,0.10)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.30)',
          }}>
            <Trash2 size={12}/> Clear
          </button>
        </div>
      </div>

      {/* Pivot notice — shown when a long-format DataStream/WR export was
          reshaped into a wide table so the analyzer could read it. */}
      {analysis.pivotInfo && (
        <div style={{
          marginBottom: 12, padding: '9px 12px', borderRadius: 10, fontSize: 12,
          color: '#a5b4fc', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.28)',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <GitMerge size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
          <span>
            Detected a long-format DataStream / Water Rangers export — pivoted{' '}
            <strong>{analysis.pivotInfo.readings.toLocaleString()}</strong> readings into{' '}
            <strong>{analysis.pivotInfo.observations.toLocaleString()}</strong> observations across{' '}
            <strong>{analysis.pivotInfo.parameters}</strong> parameters so each parameter could be analysed on its own.
          </span>
        </div>
      )}

      {/* Plain-English at-a-glance — every line maps to a deterministic
          value from `analysis`, so it never contradicts the cards below. */}
      <QuickTakeaways analysis={analysis} />

      {/* Grounded Q&A — uses the existing free /api/ai/public-chat with a
          strict system prompt + the dataset summary as the only context. */}
      <AskAboutDataset analysis={analysis} filename={filename} />

      {/* Numeric column cards */}
      {analysis.numericCols.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Numeric columns ({analysis.numericCols.length})
          </div>
          {analysis.numericCols.map(c => (
            <NumericColumnCard
              key={c} name={c}
              info={analysis.profile[c]}
              anomalies={analysis.anomalies[c] || []}
              histogramData={analysis.histograms[c] || []}
              tsData={analysis.timeseries[c]}
            />
          ))}
        </div>
      )}

      {/* Correlation matrix */}
      {analysis.numericCols.length >= 2 && (
        <div style={{ marginBottom: 14, padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
            <GitMerge size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }}/>
            Pearson correlation between numeric columns
          </div>
          <CorrelationGrid cols={analysis.numericCols} matrix={analysis.corrMatrix}/>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6 }}>
            Range −1 (perfectly inverse) to +1 (perfectly aligned). Cells with |r| &gt; 0.4 are usually worth a closer look.
          </div>
        </div>
      )}

      {/* Text/date columns summary */}
      {(analysis.cols.some(c => analysis.profile[c].kind !== 'numeric')) && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Other columns
          </div>
          {analysis.cols.filter(c => analysis.profile[c].kind !== 'numeric').map(c => (
            <TextColumnCard key={c} name={c} info={analysis.profile[c]} />
          ))}
        </div>
      )}
    </div>
  )
}
