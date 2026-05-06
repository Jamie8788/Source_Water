import { useEffect, useMemo, useState } from 'react'
import { X, Download, Sparkles, AlertTriangle, TrendingUp } from 'lucide-react'
import { PARAM_META, classifyValue, latestValueFor, TONE_COLOR, matchParam } from '../utils/waterParams'
import { getWRParameter, formatQaRange, WR_NA, WR_DOCS_URL } from '../utils/wrParameters'
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
      // WR readings shape — use matchParam so air/atmospheric readings are excluded
      // (otherwise "Air temperature" gets pulled in as water temperature). Skip
      // matches that have non-numeric values rather than breaking — otherwise an
      // earlier weather/text reading can swallow the loop and leave n=null.
      if (n == null && Array.isArray(obs?.readings)) {
        for (const r of obs.readings) {
          const name = String(r?.parameter || '').toLowerCase().replace(/_/g, ' ')
          let isMatch = false
          if (meta) {
            isMatch = matchParam(r?.parameter) === paramKey
          } else {
            const target = String(paramKey).toLowerCase().replace(/_/g, ' ')
            isMatch = name === target || name.includes(target)
          }
          if (isMatch) {
            const candidate = Number(r?.value)
            if (Number.isFinite(candidate)) {
              n = candidate
              if (r?.unit) unit = r.unit
              break
            }
            // Matched param name but value isn't numeric — keep looking
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

    // Pull the Water Rangers reference for this parameter so the AI can cite
    // it instead of guessing. If WR publishes nothing, we tell the AI that
    // explicitly and forbid it from inventing a "safe range".
    const wr = getWRParameter(paramKey || paramLabel)
    const wrSafe = wr ? formatQaRange(wr.qaSafe, wr.unit) : null
    const wrExtreme = wr ? formatQaRange(wr.qaExtreme, wr.unit) : null
    const wrEquipmentLine = wr?.equipment?.length
      ? wr.equipment.slice(0, 4).map(e => `${e.name} (${e.range}${e.unit ? ' ' + e.unit : ''})`).join('; ')
      : null

    const wrBlock = wr
      ? [
          `Water Rangers parameter label: ${wr.label} (unit: ${wr.unit || 'unitless'}).`,
          wrSafe    ? `WR Automatic-QA "Needs review" band: ${wrSafe}.`        : `WR does NOT publish a numeric "Needs review" band for this parameter.`,
          wrExtreme ? `WR Automatic-QA "Issue detected" outside: ${wrExtreme}.` : `WR does NOT publish a numeric "Issue detected" band for this parameter.`,
          wr.whatIsIt    ? `WR popup — What is it: ${wr.whatIsIt}`               : null,
          wr.whyImportant? `WR popup — Why important: ${wr.whyImportant}`       : null,
          Array.isArray(wr.bands) && wr.bands.length
            ? `WR popup — interpretation bands: ${wr.bands.map(b => `${b.range}: ${b.label}`).join('; ')}.`
            : null,
          wrEquipmentLine ? `WR-listed equipment: ${wrEquipmentLine}.` : null,
          `WR source page: ${WR_DOCS_URL}`,
        ].filter(Boolean).join('\n')
      : `Water Rangers does not publish a parameter entry that matches "${paramLabel}". Treat this analysis as trend-only and explicitly tell the volunteer that no Water Rangers reference range exists for this parameter.`

    const sys = [
      `You are a freshwater scientist explaining a Water Rangers community-science reading in plain English.`,
      `Citation rule (HARD): the ONLY external reference you may cite for "safe ranges" or "what counts as elevated" is Water Rangers (data.waterrangers.com/supported-parameters). The full WR reference for this parameter is supplied below.`,
      `If Water Rangers does not publish a numeric range for this parameter, you MUST say so plainly (e.g. "Water Rangers does not publish a needs-review range for this parameter") and then describe the trend at this site only.`,
      `NEVER invent a threshold. NEVER cite CCME, Health Canada, EPA, WHO or other bodies — even if you know their numbers. Stay strictly inside what Water Rangers publishes.`,
      `NEVER mention drinking water, potability, or human consumption.`,
      `Be concrete: name what the numbers mean for fish, insects, or plants only when WR's "Why important" / "What does it mean" content lets you.`,
    ].join(' ')

    const statsLine = stats
      ? `n=${stats.n}, mean=${stats.mean.toFixed(2)}${unitLabel}, median=${stats.median.toFixed(2)}${unitLabel}, min=${stats.min}${unitLabel}, max=${stats.max}${unitLabel}, σ=${stats.sigma.toFixed(2)}, cadence=${stats.cadence ? stats.cadence.toFixed(1) + ' days between samples' : 'unknown'}`
      : ''
    const userMsg = `Parameter: ${paramLabel} (${unitLabel || 'no unit'})
Site: ${siteName || 'this monitoring site'}${siteId ? ` (id ${siteId})` : ''}
Site stats: ${statsLine}

WATER RANGERS REFERENCE (the only external source you are allowed to cite):
${wrBlock}

Recent readings (oldest→newest, last 12): ${JSON.stringify(recent)}
Anomalies flagged: ${anomalies.length} reading(s)${anomalies.length ? ' — ' + anomalies.slice(0, 5).map(a => `${a.value}${unitLabel} on ${a.at ? new Date(a.at).toISOString().slice(0,10) : '?'}`).join(', ') : ''}

Write 3 short paragraphs (each 2-3 sentences):
1. What this parameter is — using Water Rangers' definition if provided, otherwise just describe the variable in neutral terms without inventing a "safe range".
2. What this site's actual numbers say — call out the trend, the typical range AT THIS SITE, and any anomalies. Compare to the WR-published band ONLY if one exists; if WR doesn't publish a band, say so explicitly.
3. What a community volunteer should look for next or what could be driving the pattern (seasonal, watershed, sampling cadence). Stay grounded in the numbers above. Do not invent readings.`

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

  // Plain-English summary of the latest reading — explains the band in real-world
  // terms with no jargon. Falls back gracefully when no reading exists.
  const plainEnglishSummary = (() => {
    if (!latest) return null
    if (!meta || !cls) {
      return `The most recent reading is ${latest.value}${displayUnit}. We don't have an aquatic-life threshold for this parameter yet, so on its own that number doesn't tell you "good" or "bad" — the AI summary below will compare it to the site's own history.`
    }
    if (cls.tone === 'safe')     return `The most recent reading is ${latest.value}${displayUnit}. That's inside the healthy range for fish, insects, and water plants — nothing to worry about right now.`
    if (cls.tone === 'warning')  return `The most recent reading is ${latest.value}${displayUnit}. That's outside the comfort zone for sensitive species like trout or mayfly larvae. Not an emergency, but the water is putting stress on aquatic life.`
    if (cls.tone === 'critical') return `The most recent reading is ${latest.value}${displayUnit}. That's in the danger zone — at this level, fish kills and ecosystem damage become likely. This is the kind of reading water managers act on.`
    return `The most recent reading is ${latest.value}${displayUnit}.`
  })()

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(15,23,42,0.65)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 16px', overflowY: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        style={{
          width: 'min(960px, 100%)', background: '#fff',
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
          borderRadius: 16,
          border: '1px solid rgba(15,23,42,0.12)',
          marginBottom: 24,
        }}
      >
        {/* Header — sticks to the top of the modal */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2, background: '#0f172a', color: '#fff',
          padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
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

        <div style={{ padding: '22px 28px 28px', color: '#0f172a' }}>
          {/* Plain-language intro */}
          {meta?.short && (
            <p style={{ fontSize: 15, lineHeight: 1.6, color: '#334155', marginTop: 0 }}>{meta.short}</p>
          )}
          {isUnmapped && (
            <p style={{ fontSize: 13, lineHeight: 1.55, color: '#475569', marginTop: 0, padding: 10, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              We don't have an aquatic-life threshold for this parameter yet, but we still show every reading at this site, the site's own statistics, and an AI summary based on the actual numbers.
            </p>
          )}

          {/* Plain-English "what this means" — the most important block on the page,
              answers the question every visitor actually has: is this good or bad? */}
          {plainEnglishSummary && (
            <div style={{
              marginTop: 14, padding: '12px 14px', borderRadius: 10,
              background: '#fef3c7', border: '1px solid #fcd34d',
              fontSize: 14, lineHeight: 1.55, color: '#78350f',
            }}>
              <strong style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, color: '#92400e' }}>
                💬 What this means in plain English
              </strong>
              {plainEnglishSummary}
            </div>
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
              <SectionHeader icon={<TrendingUp size={16} color="#0ea5e9" />} title="What this site's history shows"
                hint="Quick numbers from every sample ever taken at this exact spot." />
              <StatsGrid stats={stats} unit={displayUnit} />
            </>
          )}

          {/* Range diagram — only for mapped parameters */}
          {meta && (
            <>
              <SectionHeader icon="🎯" title="Where this reading falls"
                hint="The coloured bar shows the science-based safety zones. Green = healthy. Amber = stressful for sensitive species. Red = dangerous. The black arrow is this site's most recent reading." />
              <RangeBar meta={meta} pointerPct={pointerPct} pointerValue={latest?.value} />
              <ScaleLegend meta={meta} currentBandIndex={cls?.index ?? null} unit={displayUnit} />
            </>
          )}

          {/* Full time-series chart — every reading dot-coloured by CCME tone */}
          {series.length >= 2 && (
            <>
              <SectionHeader icon="📈" title={`Every reading over time (${series.length} samples)`}
                hint={meta
                  ? 'Each dot is one water sample. Green dots are healthy readings, amber are stressful, red are critical. Hover any dot to see the value and date.'
                  : 'Each dot is one water sample. Hover any dot to see the value and date.'} />
              <TimeSeriesChart series={series} meta={meta} paramKey={paramKey} />
            </>
          )}

          {/* Anomaly badges — only if we found any */}
          {anomalies.length > 0 && (
            <>
              <SectionHeader
                icon={<AlertTriangle size={16} color="#f59e0b" />}
                title={`Unusual readings (${anomalies.length})`}
                hint="These readings either landed in the danger zone or were way different from the site's normal range. Worth a closer look." />
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
                      {a.offBand && a.offSite ? 'In danger zone AND way outside normal' : a.offBand ? `Danger zone — ${a.label}` : 'Way outside this site\'s normal range'}
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
          <SectionHeader
            icon={<Sparkles size={16} color="#a78bfa" />}
            title="AI explainer (using this site's actual data)"
            hint="A water scientist–style summary of what these specific readings mean — not a generic explanation. Updates every time you open this panel." />

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
              <SectionHeader icon="🧪" title="Why this number goes up and down"
                hint="The real-world drivers behind changes in this parameter." />
              <p style={{ fontSize: 14, lineHeight: 1.65, color: '#334155', margin: 0 }}>{meta.mechanism}</p>
            </>
          )}

          {/* Impacts diagram — three columns with mini icons */}
          {meta?.impacts && (
            <>
              <SectionHeader icon="🐟" title="Who in the water this affects"
                hint="Plain-English impact on fish, insects, and water plants." />
              <ImpactsRow impacts={meta.impacts} />
            </>
          )}

          {/* How measured */}
          {meta?.measured && (
            <>
              <SectionHeader icon="📏" title="How a volunteer measures this"
                hint="What gear is used out in the field to take this reading." />
              <p style={{ fontSize: 14, lineHeight: 1.65, color: '#334155', margin: 0 }}>{meta.measured}</p>
            </>
          )}

          <div style={{ marginTop: 24, padding: '12px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>
            ℹ️ Numeric "needs review" / "issue detected" bands shown anywhere in this app come directly from{' '}
            <a href={WR_DOCS_URL} target="_blank" rel="noreferrer" style={{ color: '#0ea5e9', textDecoration: 'underline' }}>
              Water Rangers' supported-parameters page
            </a>
            . If Water Rangers does not publish a band for a parameter, the app says so — it never invents thresholds. Drinking-water guidelines are out of scope: this is a surface-water / aquatic-life platform.
          </div>
        </div>
      </div>
    </div>
  )
}

// Standard section heading + plain-English hint. Used everywhere instead of
// raw <h3> so every section gets a consistent layman-friendly subtitle.
function SectionHeader({ icon, title, hint }) {
  return (
    <div style={{ marginTop: 26, marginBottom: 10 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
        {typeof icon === 'string' ? <span aria-hidden style={{ fontSize: 18 }}>{icon}</span> : icon}
        {title}
      </h3>
      {hint && (
        <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 0', lineHeight: 1.45 }}>{hint}</p>
      )}
    </div>
  )
}

function StatsGrid({ stats, unit }) {
  // Each cell carries a plain-English caption explaining what the number actually
  // means — so a community volunteer doesn't need to know what "σ" or "median" is.
  const cells = [
    { label: 'How many readings', value: stats.n,
      hint: 'Total water-quality samples taken at this site.' },
    { label: 'Typical value', value: `${stats.mean.toFixed(2)}${unit}`,
      hint: 'The average — what you\'d expect on a "normal" day.' },
    { label: 'Middle value', value: `${stats.median.toFixed(2)}${unit}`,
      hint: 'Half the readings were higher, half lower. Less skewed by outliers than the average.' },
    { label: 'Lowest reading', value: `${stats.min}${unit}`,
      hint: 'The single lowest value ever recorded here.' },
    { label: 'Highest reading', value: `${stats.max}${unit}`,
      hint: 'The single highest value ever recorded here.' },
    { label: 'How much it bounces', value: stats.sigma.toFixed(2),
      hint: 'Low number = readings are consistent. High number = the water swings around a lot.' },
  ]
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {cells.map(c => (
          <div key={c.label} style={{ padding: 12, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginTop: 2, lineHeight: 1.1 }}>{c.value}</div>
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 6, lineHeight: 1.35 }}>{c.hint}</div>
          </div>
        ))}
      </div>
      {stats.dateRange && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#475569' }}>
          📅 First sample {stats.dateRange.first.toLocaleDateString()} · most recent {stats.dateRange.last.toLocaleDateString()}
          {stats.cadence != null && stats.cadence > 0 && (
            <> · samples come in roughly every {stats.cadence < 1 ? 'day or less' : `${stats.cadence.toFixed(1)} days`}</>
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

// Plain-English breakdown of every band on the scale. Renders below the
// RangeBar so a layman reader can understand what each colour zone means
// for this specific parameter — not just the band the current reading
// happens to fall into. The band the current reading falls into gets a
// stronger left-border treatment so it's easy to spot at a glance.
function ScaleLegend({ meta, currentBandIndex, unit }) {
  if (!meta?.ranges?.length) return null
  const fmtRange = (r) => {
    const u = unit || meta.unit || ''
    const lo = r.min
    const hi = r.max
    if (hi >= 9999) return `${lo}${u} and above`
    if (lo === 0)   return `Up to ${hi}${u}`
    return `${lo}${u} – ${hi}${u}`
  }
  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden="true">📖</span> Scale explained — what each zone means
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {meta.ranges.map((r, i) => {
          const color = TONE_COLOR[r.tone] || '#94a3b8'
          const isCurrent = i === currentBandIndex
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '8px 1fr', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              background: isCurrent ? `${color}14` : '#f8fafc',
              border: `1px solid ${isCurrent ? `${color}66` : '#e2e8f0'}`,
              borderLeft: `4px solid ${color}`,
            }}>
              <div />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{r.label}</span>
                  <span style={{ fontSize: 11, color: '#475569', background: '#fff', border: '1px solid #e2e8f0', padding: '1px 7px', borderRadius: 999 }}>
                    {fmtRange(r)}
                  </span>
                  {isCurrent && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: color, padding: '2px 7px', borderRadius: 999, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      This site
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#334155' }}>
                  {r.plain || r.note}
                </div>
              </div>
            </div>
          )
        })}
      </div>
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
