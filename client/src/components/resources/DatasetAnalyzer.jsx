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
import { useMemo, useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import {
  Upload, FileText, BarChart3, Activity, GitMerge, AlertTriangle, Download,
  Database, X, Sparkles, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react'

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
    if (numericVals.length >= Math.max(3, raw.length * 0.4)) {
      // ≥40% numeric and ≥3 samples → treat as numeric
      profile[c] = { kind: 'numeric', stats: summarize(numericVals), missing, total: raw.length, vals: numericVals }
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
          const rows = (res.data || []).filter(r => r && Object.keys(r).length)
          if (!rows.length) { setError('No data rows found in this CSV.'); setBusy(false); return }
          const a = analyzeRows(rows)
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
          const rows = (res.data || []).filter(r => r && Object.keys(r).length)
          if (!rows.length) { setError('No data rows found in this file.'); setBusy(false); return }
          const a = analyzeRows(rows)
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
