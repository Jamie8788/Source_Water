import { useEffect, useMemo, useState } from 'react'
import { X, Download, Sparkles, AlertTriangle, TrendingUp } from 'lucide-react'
import { PARAM_META, classifyValue, latestValueFor, TONE_COLOR, matchParam } from '../utils/waterParams'
import api from '../utils/api'

// Slide-in deep-dive panel for a single water parameter at a single site.
// Goes far beyond what Water Rangers shows: full time-series with each reading
// dot-coloured by CCME aquatic-life band, site-specific statistics, anomaly
// flagging (out-of-band + > 2σ), real AI summary fetched from /api/ai/public-chat
// with the actual readings as context, and per-parameter CSV export.
//
// Surface-water / aquatic-life ONLY — no drinking water content (compliance:
// SOURCE Water never references potability).
export default function ParameterDeepDive({ paramKey, observations, onClose, siteName, siteId }) {
  const meta = PARAM_META[paramKey]
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)

  // ESC closes the panel
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Pull every numeric reading for this parameter from the observations array.
  // Handles both flat shape ({ ph: 7.2 }) and Water Rangers shape ({ readings: [...] }).
  const series = useMemo(() => {
    const out = []
    const obsList = Array.isArray(observations) ? observations : []
    for (const obs of obsList) {
      let n = null
      let unit = meta?.unit || ''
      // Flat shape — direct property by key OR by alias
      if (obs && obs[paramKey] != null && obs[paramKey] !== '') {
        n = Number(obs[paramKey])
      } else if (meta?.aliases) {
        for (const a of meta.aliases) {
          if (obs && obs[a] != null && obs[a] !== '') { n = Number(obs[a]); break }
        }
      }
      // WR readings shape
      if (n == null && Array.isArray(obs?.readings)) {
        for (const r of obs.readings) {
          const name = String(r?.parameter || '').toLowerCase()
          const aliasHit = meta
            ? meta.aliases?.some(a => name.includes(a))
            : name.includes(String(paramKey).toLowerCase())
          if (aliasHit) {
            n = Number(r?.value)
            if (r?.unit) unit = r.unit
            break
          }
        }
      }
      const at = obs?.observed_at || obs?.collected_at || obs?.created_at || null
      if (Number.isFinite(n)) out.push({ value: n, at, unit })
    }
    // Sort oldest → newest so charts and stats are chronological
    out.sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0
      const tb = b.at ? new Date(b.at).getTime() : 0
      return ta - tb
    })
    return out
  }, [paramKey, observations, meta])

  const latest = series.length ? series[series.length - 1] : null
  const cls = useMemo(() => (meta && latest) ? classifyValue(paramKey, latest.value) : null, [paramKey, latest, meta])

  // Site-specific statistics for THIS parameter at THIS location
  const stats = useMemo(() => {
    if (!series.length) return null
    const vals = series.map(s => s.value)
    const n = vals.length
    const sum = vals.reduce((a, b) => a + b, 0)
    const mean = sum / n
    const sorted = [...vals].sort((a, b) => a - b)
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2]
    const min = sorted[0]
    const max = sorted[n - 1]
    const sigma = Math.sqrt(vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / Math.max(1, n))
    // Sampling cadence — average days between consecutive readings
    let cadence = null
    let dateRange = null
    const dated = series.filter(s => s.at).map(s => new Date(s.at).getTime()).filter(Number.isFinite)
    if (dated.length >= 2) {
      const span = dated[dated.length - 1] - dated[0]
      cadence = (span / (dated.length - 1)) / 86400000
      dateRange = {
        first: new Date(dated[0]),
        last: new Date(dated[dated.length - 1]),
        spanDays: span / 86400000,
      }
    } else if (dated.length === 1) {
      dateRange = { first: new Date(dated[0]), last: new Date(dated[0]), spanDays: 0 }
    }
    return { n, mean, median, min, max, sigma, cadence, dateRange }
  }, [series])

  // Anomaly detection — flag readings that fall in CCME critical band or are > 2σ from site mean.
  // Only meaningful for parameters with PARAM_META definitions.
  const anomalies = useMemo(() => {
    if (!meta || !stats) return []
    const out = []
    for (const s of series) {
      const c = classifyValue(paramKey, s.value)
      const offBand = c?.tone === 'critical'
      const offSite = stats.sigma > 0 && Math.abs(s.value - stats.mean) > 2 * stats.sigma
      if (offBand || offSite) {
        out.push({
          ...s,
          tone: c?.tone || 'warning',
          label: c?.label || 'Outlier',
          offBand, offSite,
        })
      }
    }
    return out
  }, [series, stats, paramKey, meta])

  // Fetch a real AI summary tailored to this parameter + this site's actual readings.
  // Calls /api/ai/public-chat (no auth, used by Reports etc). NEVER show canned/fake text —
  // if the call fails, surface the error to the user instead of inventing something.
  useEffect(() => {
    if (!series.length) { setAiText(''); setAiError(null); return }
    let cancelled = false
    const ctl = new AbortController()
    setAiLoading(true); setAiError(null); setAiText('')

    const recent = series.slice(-12).map(s => ({
      v: s.value,
      d: s.at ? new Date(s.at).toISOString().slice(0, 10) : null,
    }))
    const paramLabel = meta?.label || (paramKey || '').replace(/_/g, ' ')
    const unitLabel = meta?.unit || ''
    const ranges = meta?.ranges
      ? meta.ranges.map(r => `${r.label} ${r.min}-${r.max >= 9999 ? '∞' : r.max}${unitLabel} (${r.tone})`).join('; ')
      : null

    const sys = `You are a freshwater scientist explaining surface-water observations to community volunteers in plain English. NEVER mention drinking water, potability, or human consumption — this platform covers aquatic life only. Reference CCME freshwater aquatic-life thresholds where relevant. Be concrete: name what the numbers mean for fish, insects, or plants at this site.`
    const statsLine = stats
      ? `n=${stats.n}, mean=${stats.mean.toFixed(2)}${unitLabel}, median=${stats.median.toFixed(2)}${unitLabel}, min=${stats.min}${unitLabel}, max=${stats.max}${unitLabel}, σ=${stats.sigma.toFixed(2)}, cadence=${stats.cadence ? stats.cadence.toFixed(1) + ' days between samples' : 'unknown'}`
      : ''
    const userMsg = `Parameter: ${paramLabel} (${unitLabel || 'no unit'})
Site: ${siteName || 'this monitoring site'}${siteId ? ` (id ${siteId})` : ''}
Site stats: ${statsLine}
${ranges ? `CCME aquatic-life bands: ${ranges}` : 'No CCME band reference is configured for this parameter — focus on relative trend.'}
Recent readings (oldest→newest, last 12): ${JSON.stringify(recent)}
Anomalies flagged: ${anomalies.length} reading(s)${anomalies.length ? ' — ' + anomalies.slice(0, 5).map(a => `${a.value}${unitLabel} on ${a.at ? new Date(a.at).toISOString().slice(0,10) : '?'}`).join(', ') : ''}

Write 3 short paragraphs (each 2-3 sentences):
1. What this parameter is and why it matters for aquatic life here.
2. What this site's actual numbers say — call out the trend, the typical range, and any anomalies. Use the real numbers above.
3. What a community volunteer should look for next or what could be driving the pattern (seasonal, watershed, sampling).
Keep it tight, concrete, and grounded in the numbers above. Do not invent readings.`

    api.post('/ai/public-chat', {
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userMsg },
      ],
      max_tokens: 500,
    }, { signal: ctl.signal })
      .then((r) => {
        if (cancelled) return
        const reply = String(r?.data?.reply || '').trim()
        if (!reply) { setAiError('AI returned an empty response.'); return }
        setAiText(reply)
      })
      .catch((e) => {
        if (cancelled || e?.name === 'CanceledError' || e?.name === 'AbortError') return
        setAiError(e?.response?.data?.error || e?.message || 'AI request failed.')
      })
      .finally(() => { if (!cancelled) setAiLoading(false) })

    return () => { cancelled = true; ctl.abort() }
  }, [paramKey, series, meta, stats, anomalies, siteName, siteId])

  // CSV download — just this parameter's readings at this site
  const downloadCSV = () => {
    const rows = [['date', 'value', 'unit', 'ccme_band']]
    for (const s of series) {
      const c = meta ? classifyValue(paramKey, s.value) : null
      rows.push([
        s.at ? new Date(s.at).toISOString() : '',
        s.value,
        s.unit || meta?.unit?.trim() || '',
        c?.label || '',
      ])
    }
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const safeName = (siteName || 'site').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    a.download = `${safeName}-${paramKey}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  // Range-bar pointer
  const minEdge = meta?.ranges?.[0]?.min
  const maxEdge = meta?.ranges?.[meta.ranges.length - 1]?.max
  const span = meta ? Math.max(1e-6, maxEdge - minEdge) : 0
  const pointerPct = (meta && latest) ? Math.max(0, Math.min(100, ((latest.value - minEdge) / span) * 100)) : null

  // Title for unmapped parameters — humanise the WR parameter string
  const displayLabel = meta?.label || (paramKey || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const displayUnit = meta?.unit || (latest?.unit ? ` ${latest.unit}` : '')
  const isUnmapped = !meta

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        style={{
          width: 'min(620px, 100%)', height: '100%', background: '#fff',
          boxShadow: '-12px 0 36px rgba(0,0,0,0.25)', overflowY: 'auto',
          borderLeft: '1px solid rgba(15,23,42,0.12)',
        }}
      >
        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2, background: '#0f172a', color: '#fff',
          padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 1, textTransform: 'uppercase' }}>Parameter Deep-Dive</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{displayLabel}</div>
            {siteName && (
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>at {siteName}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {series.length > 0 && (
              <button
                onClick={downloadCSV}
                title="Download this parameter's readings as CSV"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
              >
                <Download size={12} /> CSV
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 6 }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding: 18, color: '#0f172a' }}>
          {/* Plain-language intro */}
          {meta?.short && (
            <p style={{ fontSize: 14, lineHeight: 1.55, color: '#334155', marginTop: 0 }}>{meta.short}</p>
          )}
          {isUnmapped && (
            <p style={{ fontSize: 13, lineHeight: 1.55, color: '#475569', marginTop: 0, padding: 10, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              No CCME aquatic-life band reference is configured for this parameter yet. We still show the site's full reading history, statistics, and an AI summary based on the actual numbers.
            </p>
          )}

          {/* Current value card */}
          <div style={{
            marginTop: 14, padding: 14, borderRadius: 10,
            background: cls ? `${cls.color}14` : '#f1f5f9',
            border: `1px solid ${cls ? cls.color : '#cbd5e1'}55`,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Latest reading at this site
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>
                  {latest ? `${latest.value}${displayUnit}` : '—'}
                </div>
                {latest?.at && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Measured {new Date(latest.at).toLocaleDateString()}
                  </div>
                )}
              </div>
              {cls && (
                <div style={{
                  alignSelf: 'flex-start', padding: '4px 10px', borderRadius: 999,
                  background: cls.color, color: '#fff', fontSize: 12, fontWeight: 600,
                }}>{cls.label}</div>
              )}
            </div>
            {cls?.note && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#334155' }}>{cls.note}</div>
            )}
            {!latest && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                No readings for this parameter at this site yet.
              </div>
            )}
          </div>

          {/* Site-specific stats — only when we have observations */}
          {stats && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={14} color="#0ea5e9" /> Site statistics
              </h3>
              <StatsGrid stats={stats} unit={displayUnit} />
            </>
          )}

          {/* Range diagram — only for mapped parameters */}
          {meta && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8 }}>
                CCME aquatic-life bands
              </h3>
              <RangeBar meta={meta} pointerPct={pointerPct} pointerValue={latest?.value} />
            </>
          )}

          {/* Full time-series chart — every reading dot-coloured by CCME tone */}
          {series.length >= 2 && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8 }}>
                All readings at this site ({series.length})
              </h3>
              <TimeSeriesChart series={series} meta={meta} paramKey={paramKey} />
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                Each dot is a single reading. {meta ? 'Colour shows the CCME aquatic-life band: green = OK, amber = stress, red = critical.' : 'Colour-coding requires a CCME band definition for this parameter.'}
              </div>
            </>
          )}

          {/* Anomaly badges — only if we found any */}
          {anomalies.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} color="#f59e0b" /> Anomalies detected ({anomalies.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {anomalies.slice(0, 8).map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 10px', borderRadius: 8,
                    background: `${TONE_COLOR[a.tone] || '#f59e0b'}14`,
                    border: `1px solid ${TONE_COLOR[a.tone] || '#f59e0b'}33`,
                    fontSize: 12,
                  }}>
                    <span style={{ fontWeight: 700 }}>{a.value}{displayUnit}</span>
                    <span style={{ color: '#475569', flex: 1, marginLeft: 8 }}>
                      {a.offBand && a.offSite ? 'CCME critical + 2σ outlier' : a.offBand ? `CCME: ${a.label}` : '> 2σ from site mean'}
                    </span>
                    <span style={{ color: '#64748b', fontSize: 11 }}>
                      {a.at ? new Date(a.at).toLocaleDateString() : '—'}
                    </span>
                  </div>
                ))}
                {anomalies.length > 8 && (
                  <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>
                    + {anomalies.length - 8} more (download CSV for full list)
                  </div>
                )}
              </div>
            </>
          )}

          {/* AI summary — REAL call to /api/ai/public-chat with the actual readings.
              Loading + error states; never canned/fake text. */}
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color="#a78bfa" /> AI analysis of this site's data
          </h3>
          <div style={{
            padding: 12, borderRadius: 10,
            background: 'linear-gradient(180deg, rgba(167,139,250,0.06), rgba(99,102,241,0.04))',
            border: '1px solid rgba(167,139,250,0.25)',
          }}>
            {aiLoading && (
              <div style={{ fontSize: 12, color: '#6366f1' }}>
                Analysing {series.length} reading{series.length === 1 ? '' : 's'}…
              </div>
            )}
            {aiError && !aiLoading && (
              <div style={{ fontSize: 12, color: '#b91c1c' }}>
                Could not reach the AI service: {aiError}. The numbers above are still authoritative.
              </div>
            )}
            {!aiLoading && !aiError && aiText && (
              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                {aiText}
              </div>
            )}
            {!aiLoading && !aiError && !aiText && !series.length && (
              <div style={{ fontSize: 12, color: '#64748b' }}>
                AI summary appears once this site has at least one reading for this parameter.
              </div>
            )}
          </div>

          {/* Mechanism / story — mapped params only */}
          {meta?.mechanism && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8 }}>
                Why it changes
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: '#334155', margin: 0 }}>{meta.mechanism}</p>
            </>
          )}

          {/* Impacts diagram — three columns with mini icons */}
          {meta?.impacts && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8 }}>
                Who it affects
              </h3>
              <ImpactsRow impacts={meta.impacts} />
            </>
          )}

          {/* How measured */}
          {meta?.measured && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8 }}>
                How it's measured
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: '#334155', margin: 0 }}>{meta.measured}</p>
            </>
          )}

          <div style={{ marginTop: 22, padding: '10px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 11, color: '#64748b' }}>
            Bands shown are CCME freshwater <strong>aquatic-life</strong> references. SOURCE Water is a surface-water platform — these thresholds describe stress on fish, insects, and plants and are <strong>not drinking-water guidelines</strong>.
          </div>
        </div>
      </div>
    </div>
  )
}

function StatsGrid({ stats, unit }) {
  const cells = [
    { label: 'Readings', value: stats.n },
    { label: 'Mean', value: `${stats.mean.toFixed(2)}${unit}` },
    { label: 'Median', value: `${stats.median.toFixed(2)}${unit}` },
    { label: 'Min', value: `${stats.min}${unit}` },
    { label: 'Max', value: `${stats.max}${unit}` },
    { label: 'σ (variability)', value: stats.sigma.toFixed(2) },
  ]
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {cells.map(c => (
          <div key={c.label} style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{c.value}</div>
          </div>
        ))}
      </div>
      {stats.dateRange && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#475569' }}>
          {stats.dateRange.first.toLocaleDateString()} → {stats.dateRange.last.toLocaleDateString()}
          {stats.cadence != null && stats.cadence > 0 && (
            <> · ~{stats.cadence < 1 ? '< 1' : stats.cadence.toFixed(1)} day{stats.cadence >= 2 ? 's' : ''} between samples</>
          )}
        </div>
      )}
    </>
  )
}

// SVG range bar with tone-coloured bands and a pointer marker for the current value.
function RangeBar({ meta, pointerPct, pointerValue }) {
  const W = 580
  const H = 56
  const top = 16
  const barH = 14
  const minEdge = meta.ranges[0].min
  const maxEdge = meta.ranges[meta.ranges.length - 1].max
  const span = Math.max(1e-6, maxEdge - minEdge)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 36}`} width="100%" height="auto" role="img" aria-label="Parameter range diagram">
        {meta.ranges.map((r, i) => {
          const x1 = ((r.min - minEdge) / span) * W
          const x2 = ((r.max - minEdge) / span) * W
          return (
            <g key={i}>
              <rect x={x1} y={top} width={Math.max(0, x2 - x1)} height={barH} fill={TONE_COLOR[r.tone]} opacity={0.9} />
              {i === 0 && (
                <text x={x1} y={top + barH + 12} fontSize="10" fill="#475569">{r.min}</text>
              )}
              <text x={x2} y={top + barH + 12} fontSize="10" fill="#475569" textAnchor="end">
                {r.max >= 9999 ? '' : r.max}
              </text>
              <text x={(x1 + x2) / 2} y={top - 4} fontSize="9" fill="#0f172a" textAnchor="middle" fontWeight="600">
                {r.label}
              </text>
            </g>
          )
        })}

        {pointerPct != null && (
          <g>
            <line
              x1={(pointerPct / 100) * W} x2={(pointerPct / 100) * W}
              y1={top - 8} y2={top + barH + 6}
              stroke="#0f172a" strokeWidth="2"
            />
            <polygon
              points={`${(pointerPct / 100) * W - 5},${top - 10} ${(pointerPct / 100) * W + 5},${top - 10} ${(pointerPct / 100) * W},${top - 2}`}
              fill="#0f172a"
            />
            <text
              x={(pointerPct / 100) * W} y={top + barH + 26}
              fontSize="11" fontWeight="700" fill="#0f172a" textAnchor="middle"
            >
              {pointerValue}{meta.unit}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

// Time-series chart of all readings at this site for this parameter.
// Each reading is a dot coloured by its CCME band (when meta exists).
// Tooltip shows value + date on hover.
function TimeSeriesChart({ series, meta, paramKey }) {
  const [hover, setHover] = useState(null)
  const W = 580
  const H = 180
  const padL = 36, padR = 12, padT = 14, padB = 24
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const values = series.map(s => s.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1e-6, max - min)
  // Pad y-axis a touch so dots don't sit on the frame
  const yMin = min - span * 0.08
  const yMax = max + span * 0.08
  const ySpan = Math.max(1e-6, yMax - yMin)

  // X axis — index-based if no dates, time-based if dates available
  const dated = series.every(s => s.at)
  const xAt = (i, s) => {
    if (dated) {
      const t0 = new Date(series[0].at).getTime()
      const t1 = new Date(series[series.length - 1].at).getTime()
      const tspan = Math.max(1, t1 - t0)
      return padL + ((new Date(s.at).getTime() - t0) / tspan) * innerW
    }
    return padL + (i / Math.max(1, series.length - 1)) * innerW
  }
  const yAt = (v) => padT + innerH - ((v - yMin) / ySpan) * innerH

  const linePts = series.map((s, i) => `${xAt(i, s).toFixed(1)},${yAt(s.value).toFixed(1)}`).join(' ')

  // CCME band shading on y-axis (only when meta present)
  const bandRects = meta ? meta.ranges.map((r, i) => {
    const yTop = yAt(Math.min(r.max, yMax))
    const yBot = yAt(Math.max(r.min, yMin))
    if (yBot <= yTop) return null
    return (
      <rect key={i} x={padL} y={yTop} width={innerW} height={yBot - yTop}
        fill={TONE_COLOR[r.tone]} opacity={0.08} />
    )
  }) : null

  const yTicks = [yMin, (yMin + yMax) / 2, yMax].map(v => Number(v.toFixed(2)))

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img" aria-label="Time-series of readings at this site">
        {bandRects}
        {/* Frame */}
        <rect x={padL} y={padT} width={innerW} height={innerH} fill="none" stroke="#cbd5e1" strokeWidth="1" />
        {/* Y ticks */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL - 3} x2={padL} y1={yAt(t)} y2={yAt(t)} stroke="#94a3b8" />
            <text x={padL - 5} y={yAt(t) + 3} fontSize="9" fill="#475569" textAnchor="end">{t}</text>
          </g>
        ))}
        {/* Connecting line */}
        <polyline points={linePts} fill="none" stroke="#0ea5e9" strokeWidth="1.5" opacity={0.65} />
        {/* Dots */}
        {series.map((s, i) => {
          const x = xAt(i, s)
          const y = yAt(s.value)
          const c = meta ? classifyValue(paramKey, s.value) : null
          const fill = c?.color || '#0ea5e9'
          return (
            <circle key={i} cx={x} cy={y} r={hover === i ? 5 : 3.5} fill={fill}
              stroke="#fff" strokeWidth="1"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }} />
          )
        })}
        {/* X axis date labels — first / mid / last */}
        {dated && series.length > 1 && (
          <>
            <text x={padL} y={H - 6} fontSize="9" fill="#475569">
              {new Date(series[0].at).toLocaleDateString()}
            </text>
            <text x={W - padR} y={H - 6} fontSize="9" fill="#475569" textAnchor="end">
              {new Date(series[series.length - 1].at).toLocaleDateString()}
            </text>
          </>
        )}
      </svg>
      {hover != null && series[hover] && (
        <div style={{
          position: 'absolute', top: 4, right: 12,
          background: '#0f172a', color: '#fff', padding: '4px 8px',
          borderRadius: 6, fontSize: 11, pointerEvents: 'none',
        }}>
          {series[hover].value}{meta?.unit || (series[hover].unit ? ` ${series[hover].unit}` : '')}
          {series[hover].at && <> · {new Date(series[hover].at).toLocaleDateString()}</>}
        </div>
      )}
    </div>
  )
}

const IMPACT_GLYPHS = {
  Fish: '🐟',
  Insects: '🦟',
  Plants: '🌿',
}

function ImpactsRow({ impacts }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {impacts.map((it) => (
        <div key={it.group} style={{
          padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: 18 }} aria-hidden>{IMPACT_GLYPHS[it.group] || '•'}</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{it.group}</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4, lineHeight: 1.4 }}>{it.text}</div>
        </div>
      ))}
    </div>
  )
}
