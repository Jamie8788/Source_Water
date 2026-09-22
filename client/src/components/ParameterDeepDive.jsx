import { useEffect, useMemo, useState } from 'react'
import { X, Download, Sparkles, AlertTriangle, TrendingUp, ChevronDown, RefreshCw, Maximize2, Minimize2 } from 'lucide-react'
import { PARAM_META, classifyValue, latestValueFor, TONE_COLOR, matchParam } from '../utils/waterParams'
import { getWRParameter, formatQaRange, WR_NA, WR_DOCS_URL } from '../utils/wrParameters'
import { getPlainEnglish, unitPlain } from '../utils/plainEnglishParams'
import api from '../utils/api'
import MarkdownLite from './MarkdownLite'

// ── AI explainer cache ───────────────────────────────────────────────────────
// The deep-dive used to re-call the AI on EVERY open of this panel, which burns
// tokens fast at 500 users. Cache each explainer per site + parameter + a
// data-fingerprint, in memory (this tab) and localStorage (24h across reloads),
// so each site/parameter is generated at most once a day — unless the readings
// change or the user clicks Regenerate. This is the main cost-saver here.
const AI_TTL = 24 * 60 * 60 * 1000
const aiMemCache = new Map()
// Bump when the explainer PROMPT changes so users stop getting the old
// (blander) cached text and regenerate against the new insight-led prompt.
const AI_PROMPT_VER = 'v3-structured'
function aiCacheKey(siteId, paramKey, series) {
  const last = series.length ? series[series.length - 1].value : ''
  return `ddai:${AI_PROMPT_VER}:${siteId || 'site'}:${paramKey}:${series.length}:${last}`
}
function readAiCache(key) {
  if (aiMemCache.has(key)) return aiMemCache.get(key)
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const { text, at } = JSON.parse(raw)
      if (text && Date.now() - at < AI_TTL) { aiMemCache.set(key, text); return text }
    }
  } catch { /* private mode / disabled storage — just skip the cache */ }
  return null
}
function writeAiCache(key, text) {
  aiMemCache.set(key, text)
  try { localStorage.setItem(key, JSON.stringify({ text, at: Date.now() })) } catch { /* ignore */ }
}
function clearAiCache(key) {
  aiMemCache.delete(key)
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

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
  const [aiCached, setAiCached] = useState(false) // true = served from cache (no AI call)
  const [aiReload, setAiReload] = useState(0)      // bump to force a fresh generation
  const [maximized, setMaximized] = useState(false) // full-width view toggle

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

  // ── Local, zero-cost analytics ("signals") ──────────────────────────────────
  // Everything here is computed from the real readings in the browser — no AI
  // call, no invented numbers. It powers (a) an instant "what stands out" strip
  // the user sees even if the AI is slow/unavailable, and (b) a grounded prompt
  // so the AI writes about THIS site's specific behaviour instead of generic
  // textbook facts. This is the core of "show what's actually happening here
  // without spending tokens".
  const signals = useMemo(() => {
    if (!series.length || !stats) return null
    const vals = series.map(s => s.value)
    const n = vals.length
    const out = { n }

    // Perfectly flat data is itself a finding (and percentiles/records become
    // meaningless — "above 0% of its own history" was a confusing artefact).
    out.constant = n >= 3 && stats.max === stats.min

    // Where the latest reading sits inside this site's own history — only
    // meaningful when the readings actually spread.
    if (n >= 4 && latest && stats.max > stats.min) {
      const below = vals.filter(v => v < latest.value).length
      out.latestPct = Math.round((below / n) * 100)
      out.latestIsMax = latest.value >= stats.max
      out.latestIsMin = latest.value <= stats.min
    }

    // Volatility, unit-free, so we can say "stable" vs "swingy" honestly.
    if (stats.mean !== 0) out.cv = Math.abs(stats.sigma / stats.mean)

    // Dated points for trend + seasonality.
    const dated = series
      .filter(s => s.at && Number.isFinite(new Date(s.at).getTime()))
      .map(s => ({ t: new Date(s.at).getTime(), v: s.value, m: new Date(s.at).getMonth() }))

    // Least-squares linear trend over time + Pearson r so we only claim a
    // trend when the points actually line up.
    if (dated.length >= 4) {
      const t0 = dated[0].t
      const xs = dated.map(d => (d.t - t0) / 86400000) // days since first sample
      const ys = dated.map(d => d.v)
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length
      const my = ys.reduce((a, b) => a + b, 0) / ys.length
      let sxy = 0, sxx = 0, syy = 0
      for (let i = 0; i < xs.length; i++) {
        sxy += (xs[i] - mx) * (ys[i] - my)
        sxx += (xs[i] - mx) ** 2
        syy += (ys[i] - my) ** 2
      }
      if (sxx > 0 && syy > 0) {
        const slopePerDay = sxy / sxx
        const spanDays = xs[xs.length - 1] - xs[0]
        const r = sxy / Math.sqrt(sxx * syy)
        out.trend = {
          perYear: slopePerDay * 365,
          total: slopePerDay * spanDays,
          r,
          dir: slopePerDay > 0 ? 'rising' : slopePerDay < 0 ? 'falling' : 'flat',
          strong: Math.abs(r) >= 0.4, // only surface a trend chip when r is decent
        }
      }
    }

    // Recent third vs earliest third — catches a step change a straight-line
    // trend can miss.
    if (n >= 6) {
      const k = Math.max(2, Math.floor(n / 3))
      const early = vals.slice(0, k)
      const recent = vals.slice(-k)
      const em = early.reduce((a, b) => a + b, 0) / early.length
      const rm = recent.reduce((a, b) => a + b, 0) / recent.length
      out.shift = { early: em, recent: rm, deltaPct: em !== 0 ? ((rm - em) / Math.abs(em)) * 100 : null }
    }

    // Seasonality — warm months (Apr–Sep) vs cold, only if both are sampled.
    if (dated.length >= 6) {
      const warm = dated.filter(d => d.m >= 3 && d.m <= 8).map(d => d.v)
      const cold = dated.filter(d => d.m < 3 || d.m > 8).map(d => d.v)
      if (warm.length >= 2 && cold.length >= 2) {
        const wm = warm.reduce((a, b) => a + b, 0) / warm.length
        const cm = cold.reduce((a, b) => a + b, 0) / cold.length
        const base = Math.abs((wm + cm) / 2) || 1
        out.season = { warm: wm, cold: cm, warmN: warm.length, coldN: cold.length, relDiff: Math.abs(wm - cm) / base }
      }
    }

    // Band distribution for mapped (CCME-scaled) parameters — how often this
    // site has sat in each safety tone.
    if (meta) {
      const counts = {}
      for (const v of vals) {
        const c = classifyValue(paramKey, v)
        const t = c?.tone || 'unknown'
        counts[t] = (counts[t] || 0) + 1
      }
      out.bands = counts
    }

    return out
  }, [series, stats, meta, paramKey, latest])

  // Fetch a real AI summary tailored to this parameter + this site's actual readings.
  // Calls /api/ai/public-chat (no auth, used by Reports etc). NEVER show canned/fake text —
  // if the call fails, surface the error to the user instead of inventing something.
  useEffect(() => {
    if (!series.length) { setAiText(''); setAiError(null); return }

    // Cost saver: serve a cached explainer if we have a fresh one for this exact
    // site + parameter + data. Only call the AI on a cache miss (or Regenerate).
    const cacheKey = aiCacheKey(siteId, paramKey, series)
    const cached = readAiCache(cacheKey)
    if (cached) {
      setAiText(cached); setAiCached(true); setAiLoading(false); setAiError(null)
      return
    }

    let cancelled = false
    const ctl = new AbortController()
    setAiLoading(true); setAiError(null); setAiText(''); setAiCached(false)

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
      `You are a freshwater scientist giving a sharp, specific read on ONE parameter at ONE monitoring site for a community-science audience.`,
      `Your value is insight they can't get from a chart: what is genuinely notable about THIS site's numbers. Lead with the single most interesting, non-obvious finding — a trend, a record reading, a seasonal pattern, unusual stability or swinginess, or a recent shift — using the pre-computed SITE SIGNALS supplied below. Do not open with a textbook definition.`,
      `Every quantitative claim you make about the site MUST come from the stats, signals, or readings given below — never estimate or round into new numbers, and never describe a pattern the signals don't support.`,
      `Citation rule (HARD): the ONLY external reference you may cite for "safe ranges" or "what counts as elevated" is Water Rangers (data.waterrangers.com/supported-parameters). The full WR reference for this parameter is supplied below.`,
      `If Water Rangers does not publish a numeric range for this parameter, say so plainly once, then talk purely about how this site behaves over time.`,
      `NEVER invent a threshold. NEVER cite CCME, Health Canada, EPA, WHO or other bodies — even if you know their numbers. Stay strictly inside what Water Rangers publishes.`,
      `NEVER mention drinking water, potability, or human consumption.`,
      `Be concrete about aquatic life (fish, insects, plants) only where WR's "Why important"/"What does it mean" content supports it; otherwise stay descriptive.`,
      `Honesty about data volume: with only a handful of readings, say the pattern is preliminary rather than dressing it up. Never imply more certainty than the sample size allows.`,
      `Plain language, no emojis, no bullet lists. Bold key numbers with **like this**.`,
      `OUTPUT FORMAT — follow it EXACTLY so the app can lay it out as titled cards:`,
      `HEADLINE: <one vivid sentence naming the single most notable thing about THIS site — a record, trend, seasonal pattern, unusual steadiness, or the latest value in context>`,
      `### What this is`,
      `<1-2 plain sentences: what the parameter measures and why it matters to aquatic life, using WR content where given>`,
      `### What's happening here`,
      `<2-4 sentences on THIS site's actual numbers and signals — the trend, typical range, records, seasonality, anomalies. Compare to the WR band only if one exists.>`,
      `### What to watch next`,
      `<1-2 sentences: what a volunteer should look for, or a likely driver (season, watershed, runoff, cadence)>`,
      `Emit the HEADLINE line and all three ### headings verbatim. No extra headings, no preamble before HEADLINE.`,
    ].join('\n')

    const statsLine = stats
      ? `n=${stats.n}, mean=${stats.mean.toFixed(2)}${unitLabel}, median=${stats.median.toFixed(2)}${unitLabel}, min=${stats.min}${unitLabel}, max=${stats.max}${unitLabel}, σ=${stats.sigma.toFixed(2)}, cadence=${stats.cadence ? stats.cadence.toFixed(1) + ' days between samples' : 'unknown'}`
      : ''

    // Pre-computed, real site signals (no invented numbers) so the AI can lead
    // with what's actually notable instead of a generic definition. Only the
    // signals that cleared their confidence bar are included.
    const fmt = (v) => Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(0) : +v.toFixed(2)) : '?'
    const sigParts = []
    if (signals) {
      if (signals.constant) sigParts.push(`every one of the ${signals.n} readings here is identical (${fmt(latest?.value)}${unitLabel}) — the water chemistry is extremely steady`)
      else if (signals.latestIsMax) sigParts.push(`the latest reading is the HIGHEST of all ${signals.n} recorded here`)
      else if (signals.latestIsMin) sigParts.push(`the latest reading is the LOWEST of all ${signals.n} recorded here`)
      else if (signals.latestPct != null) sigParts.push(`the latest reading sits above ${signals.latestPct}% of this site's past readings`)
      if (signals.trend && signals.trend.strong) sigParts.push(`clear ${signals.trend.dir} trend over time (~${fmt(signals.trend.perYear)}${unitLabel}/yr, Pearson r=${signals.trend.r.toFixed(2)} over ${signals.n} samples)`)
      else if (signals.trend && !signals.constant) sigParts.push(`no strong linear trend (r=${signals.trend.r.toFixed(2)})`)
      if (signals.shift && signals.shift.deltaPct != null && Math.abs(signals.shift.deltaPct) >= 15)
        sigParts.push(`recent samples average ${fmt(signals.shift.recent)}${unitLabel} vs ${fmt(signals.shift.early)}${unitLabel} early on (${signals.shift.deltaPct > 0 ? '+' : ''}${signals.shift.deltaPct.toFixed(0)}%)`)
      if (signals.season && signals.season.relDiff >= 0.1)
        sigParts.push(`seasonal split — warm-month avg ${fmt(signals.season.warm)}${unitLabel} (n=${signals.season.warmN}) vs cold-month avg ${fmt(signals.season.cold)}${unitLabel} (n=${signals.season.coldN})`)
      if (!signals.constant && signals.cv != null) {
        if (signals.cv < 0.1) sigParts.push(`very stable readings (coefficient of variation ${(signals.cv * 100).toFixed(0)}%)`)
        else if (signals.cv > 0.5) sigParts.push(`highly variable readings (coefficient of variation ${(signals.cv * 100).toFixed(0)}%)`)
      }
      if (signals.bands) {
        const parts = Object.entries(signals.bands).map(([t, c]) => `${c} ${t}`).join(', ')
        if (parts) sigParts.push(`CCME-band history: ${parts}`)
      }
    }
    const signalsLine = sigParts.length ? sigParts.join('; ') : 'no strong patterns detected yet (too few readings)'

    // Tier the DEPTH (length + certainty) within the fixed 3-section format, so a
    // 2-reading site gets an honest one-line-per-section note and a rich site
    // gets a real read — but both stay structured and scannable.
    const depth = stats.n <= 2
      ? `DATA IS SPARSE (only ${stats.n} reading${stats.n === 1 ? '' : 's'}). Keep every section to ONE cautious sentence. The HEADLINE should describe the single latest value in context, NOT a trend. In "What's happening here", say plainly it is too early to read a trend.`
      : stats.n <= 5
        ? `DATA IS LIMITED (${stats.n} readings). Keep it tight — about 90 words total. Lead the HEADLINE with the strongest signal but note the pattern is still preliminary.`
        : `DATA IS RICH (${stats.n} readings). Give a genuine read — about 150 words total. The HEADLINE must name the single most striking site-specific finding drawn from SITE SIGNALS.`

    const userMsg = `Parameter: ${paramLabel} (${unitLabel || 'no unit'})
Site: ${siteName || 'this monitoring site'}${siteId ? ` (id ${siteId})` : ''}
Site stats: ${statsLine}
SITE SIGNALS (pre-computed from the real readings — use these to lead; do not recompute): ${signalsLine}

WATER RANGERS REFERENCE (the only external source you are allowed to cite):
${wrBlock}

Recent readings (oldest→newest, last 12): ${JSON.stringify(recent)}
Anomalies flagged: ${anomalies.length} reading(s)${anomalies.length ? ' — ' + anomalies.slice(0, 5).map(a => `${a.value}${unitLabel} on ${a.at ? new Date(a.at).toISOString().slice(0,10) : '?'}`).join(', ') : ''}

${depth}
Ground every number in the stats/signals/readings above. Do not invent readings, thresholds, or bodies other than Water Rangers.`

    api.post('/ai/public-chat', {
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userMsg },
      ],
      max_tokens: 700,
    }, { signal: ctl.signal })
      .then((r) => {
        if (cancelled) return
        const reply = String(r?.data?.reply || '').trim()
        if (!reply) { setAiError('AI returned an empty response.'); return }
        setAiText(reply)
        writeAiCache(cacheKey, reply) // cache so re-opening this panel costs nothing
      })
      .catch((e) => {
        if (cancelled || e?.name === 'CanceledError' || e?.name === 'AbortError') return
        setAiError(e?.response?.data?.error || e?.message || 'AI request failed.')
      })
      .finally(() => { if (!cancelled) setAiLoading(false) })

    return () => { cancelled = true; ctl.abort() }
  }, [paramKey, series, meta, stats, signals, anomalies, siteName, siteId, aiReload])

  // Force a fresh AI explainer (clears the cached one for this site+parameter).
  const regenerateAI = () => {
    clearAiCache(aiCacheKey(siteId, paramKey, series))
    setAiReload(v => v + 1)
  }

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
      {/* Scoped styling for a visible, coloured scrollbar on the panel body. */}
      <style>{`
        .dd-scroll { scrollbar-width: thin; scrollbar-color: #a78bfa #ece9f7; }
        .dd-scroll::-webkit-scrollbar { width: 12px; }
        .dd-scroll::-webkit-scrollbar-track { background: #ece9f7; border-radius: 8px; }
        .dd-scroll::-webkit-scrollbar-thumb { background: linear-gradient(#a78bfa,#6366f1); border-radius: 8px; border: 2px solid #ece9f7; }
        .dd-scroll::-webkit-scrollbar-thumb:hover { background: #6366f1; }
      `}</style>
      <div
        style={{
          width: maximized ? 'min(1600px, 98vw)' : 'min(960px, 100%)', background: '#fff',
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
          borderRadius: 16,
          border: '1px solid rgba(15,23,42,0.12)',
          maxHeight: maximized ? 'calc(100vh - 16px)' : 'calc(100vh - 48px)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transition: 'width .18s ease, max-height .18s ease',
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
              onClick={() => setMaximized(m => !m)}
              aria-label={maximized ? 'Restore size' : 'Maximize'}
              title={maximized ? 'Restore size' : 'Maximize'}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}
            >
              {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 6 }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="dd-scroll" style={{ padding: '22px 28px 28px', color: '#0f172a', overflowY: 'auto', flex: 1, minHeight: 0 }}>
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

          {/* What this test actually is, and what its unit means. This is the
              explainer that used to be crammed into the site-map list — it
              belongs here, on the page you open for that parameter. Our own
              plain-language layer; the WR facts stay attributed below. */}
          {(() => {
            const pe = getPlainEnglish(paramKey || paramLabel)
            const wrp = getWRParameter(paramKey || paramLabel)
            const theUnit = wrp?.unit || meta?.unit || latest?.unit || ''
            const up = unitPlain(theUnit, paramKey || paramLabel)
            if (!pe?.plain && !up) return null
            return (
              <div style={{ marginTop: 14, padding: '13px 15px', borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <strong style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, color: '#0369a1' }}>
                  📖 What this test is
                </strong>
                {pe?.plain && <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.65, color: '#0c4a6e' }}>{pe.plain}</p>}
                {up && (
                  <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 11px', borderRadius: 8, background: '#ffffff', border: '1px solid #e0f2fe' }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#0369a1', flexShrink: 0, fontFamily: 'monospace' }}>{theUnit}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.6, color: '#334155' }}>{up}</span>
                  </div>
                )}
                {pe?.whyCare && (
                  <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6, color: '#0c4a6e' }}>
                    <strong>Why it matters — </strong>{pe.whyCare}
                  </p>
                )}
                {(pe?.highMeans || pe?.lowMeans) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8, marginTop: 9 }}>
                    {pe?.highMeans && (
                      <div style={{ padding: '9px 11px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#c2410c', marginBottom: 3 }}>▲ WHEN IT READS HIGH</div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#7c2d12' }}>{pe.highMeans}</div>
                      </div>
                    )}
                    {pe?.lowMeans && (
                      <div style={{ padding: '9px 11px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#1d4ed8', marginBottom: 3 }}>▼ WHEN IT READS LOW</div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#1e3a8a' }}>{pe.lowMeans}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

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
            <Collapsible icon={<TrendingUp size={16} color="#0ea5e9" />} title="What this site's history shows"
              hint="Quick numbers from every sample ever taken at this exact spot.">
              <StatsGrid stats={stats} unit={displayUnit} />
            </Collapsible>
          )}

          {/* Range diagram — only for mapped parameters */}
          {meta && (
            <Collapsible icon="🎯" title="Where this reading falls"
              hint="The coloured bar shows the science-based safety zones. Green = healthy. Amber = stressful for sensitive species. Red = dangerous. The black arrow is this site's most recent reading.">
              <RangeBar meta={meta} pointerPct={pointerPct} pointerValue={latest?.value} />
              <ScaleLegend meta={meta} currentBandIndex={cls?.index ?? null} unit={displayUnit} />
            </Collapsible>
          )}

          {/* Parameters with NO CCME band used to get no visual at all, which
              made those pages look empty. Show the reading against the best
              REAL range we have, clearly labelled so nothing is implied. */}
          {!meta && (() => {
            // NB: elsewhere in this file the pattern is `paramKey || paramLabel`,
            // which only avoids a ReferenceError because paramKey is always
            // truthy and short-circuits — paramLabel is scoped to the AI effect.
            // Using an in-scope fallback here instead.
            const wrp = getWRParameter(paramKey || meta?.label || '')
            const u = displayUnit
            const val = latest?.value

            // Best available source first: WR's own labelled interpretation
            // bands. Far more meaningful than a kit's span — for alkalinity the
            // kit union is 0–100,000 ppm, which pins every real reading at the
            // far left and says nothing.
            if (wrp?.bands?.length) {
              return (
                <Collapsible icon="🎯" title="Where this reading falls"
                  hint="Water Rangers publishes named interpretation bands for this parameter. The highlighted band is where this site's latest reading sits.">
                  <WRBandScale bands={wrp.bands} value={val} unit={u} />
                </Collapsible>
              )
            }

            let lo = null, hi = null, title = null, caption = null
            if (wrp?.qaSafe?.min != null && wrp?.qaSafe?.max != null) {
              lo = wrp.qaSafe.min; hi = wrp.qaSafe.max
              title = 'Water Rangers reference range'
              caption = `Water Rangers flags readings outside ${lo}–${hi}${u} for review. That is their data-quality range, not a health threshold — no aquatic-life guideline is published for this parameter.`
            } else {
              const ranges = (wrp?.equipment || []).map(e => {
                const m = String(e.range || '').match(/(-?\d+(?:\.\d+)?)\s*[–—-]\s*(-?\d+(?:\.\d+)?)/)
                return m ? [parseFloat(m[1]), parseFloat(m[2])] : null
              }).filter(Boolean)
              if (ranges.length) {
                // Use the NARROWEST kit range that actually contains the reading,
                // not the union of every kit. Taking min/max across all kits
                // produced spans like 0–100,000 ppm, which pinned the value at
                // the far left and conveyed nothing.
                const containing = ranges.filter(r => !Number.isFinite(val) || (val >= r[0] && val <= r[1]))
                const pool = containing.length ? containing : ranges
                const best = pool.reduce((a, b) => ((b[1] - b[0]) < (a[1] - a[0]) ? b : a))
                lo = best[0]; hi = best[1]
                title = 'What the test kits can measure'
                // Deliberately says "reading range", not "detection limit". WR
                // publishes what each kit can display; a limit of detection is a
                // lab-determined figure we do not have. Claiming one from the
                // other would be an over-reach a reviewer could rightly dispute.
                caption = `No guideline band is published for this parameter, so this bar shows the reading range Water Rangers publishes for the kits used (${lo}–${hi}${u}). It shows where this value sits within what those kits can report — useful context when a reading lands at the very top or bottom of that range. It is not a safety threshold, and the range is not a limit of detection.`
              } else if (stats && stats.max > stats.min) {
                lo = stats.min; hi = stats.max
                title = "This site's recorded range"
                caption = `No guideline band and no kit range are published for this parameter, so this shows the spread of the ${stats.n} reading${stats.n === 1 ? '' : 's'} taken at this site.`
              }
            }
            if (lo == null || hi == null || !(hi > lo)) return null
            return (
              <Collapsible icon="🎯" title="Where this reading falls"
                hint="There are no colour-coded safety zones for this parameter, so we place the reading against the most meaningful published range we have — and name exactly which one it is.">
                <ReferenceRangeBar lo={lo} hi={hi} value={val} unit={u} title={title} caption={caption}
                  siteMin={stats?.min} siteMax={stats?.max} />
              </Collapsible>
            )
          })()}

          {/* Full time-series chart — every reading dot-coloured by CCME tone */}
          {series.length >= 2 && (
            <Collapsible icon="📈" title={`Every reading over time (${series.length} samples)`}
              hint={meta
                ? 'Each dot is one water sample. Green dots are healthy readings, amber are stressful, red are critical. Hover any dot to see the value and date.'
                : 'Each dot is one water sample. Hover any dot to see the value and date.'}>
              <TimeSeriesChart series={series} meta={meta} paramKey={paramKey} />
            </Collapsible>
          )}

          {/* Anomaly badges — only if we found any */}
          {anomalies.length > 0 && (
            <Collapsible
              icon={<AlertTriangle size={16} color="#f59e0b" />}
              title={`Unusual readings (${anomalies.length})`}
              hint="These readings either landed in the danger zone or were way different from the site's normal range. Worth a closer look.">
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
            </Collapsible>
          )}

          {/* Instant, zero-cost "what stands out" strip — computed in the browser
              from the real readings (no AI call). Gives the user the headline
              insight immediately, and still works if the AI is slow or down. */}
          <SignalsStrip signals={signals} unit={displayUnit} />

          {/* AI summary — REAL call to /api/ai/public-chat with the actual readings.
              Cached per site+parameter (see top of file) so it doesn't re-charge
              on every open. Loading + error states; never canned/fake text. */}
          <Collapsible
            icon={<Sparkles size={16} color="#a78bfa" />}
            title="AI explainer (using this site's actual data)"
            hint="A water scientist's read of THIS site — the headline finding, what it is, what's happening, and what to watch. Generated once and cached to keep it fast and free — hit Regenerate for a fresh take.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {aiCached && !aiLoading && (
                <span title="Reusing the saved summary — no new AI call" style={{ fontSize: 10, color: '#16a34a', background: 'rgba(22,163,74,.1)', border: '1px solid rgba(22,163,74,.25)', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                  ✓ cached
                </span>
              )}
              <button onClick={regenerateAI} disabled={aiLoading || !series.length}
                title="Discard the cached summary and generate a fresh one (uses one AI call)"
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#6366f1', background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 7, padding: '4px 9px', cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading ? 0.5 : 1 }}>
                <RefreshCw size={11} /> Regenerate
              </button>
            </div>
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
                <ExplainerView text={aiText} />
              )}
              {!aiLoading && !aiError && !aiText && !series.length && (
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  AI summary appears once this site has at least one reading for this parameter.
                </div>
              )}
            </div>
          </Collapsible>

          {/* Mechanism / story — mapped params only */}
          {meta?.mechanism && (
            <Collapsible icon="🧪" title="Why this number goes up and down"
              hint="The real-world drivers behind changes in this parameter.">
              <p style={{ fontSize: 14, lineHeight: 1.65, color: '#334155', margin: 0 }}>{meta.mechanism}</p>
            </Collapsible>
          )}

          {/* Impacts diagram — three columns with mini icons */}
          {meta?.impacts && (
            <Collapsible icon="🐟" title="Who in the water this affects"
              hint="Plain-English impact on fish, insects, and water plants.">
              <ImpactsRow impacts={meta.impacts} />
            </Collapsible>
          )}

          {/* How measured — our field note PLUS the real Water Rangers
              equipment list for this parameter (name + the range that kit can
              actually read). Every item comes from wrParameters.js, which
              mirrors Water Rangers' published supported-parameters page — no
              invented kit, no invented ranges, and no images we can't source. */}
          {(() => {
            const wrp = getWRParameter(paramKey || paramLabel)
            const kit = wrp?.equipment || []
            if (!meta?.measured && !kit.length) return null
            return (
              <Collapsible icon="📏" title="How a volunteer measures this"
                hint="The gear used in the field, and the range each kit can read.">
                {meta?.measured && (
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: '#334155', margin: '0 0 12px' }}>{meta.measured}</p>
                )}
                {kit.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase', color: '#64748b', marginBottom: 7 }}>
                      Water Rangers–listed equipment ({kit.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 8 }}>
                      {kit.map((e, i) => (
                        <div key={i} style={{ padding: '10px 12px', borderRadius: 9, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                            <span style={{ fontSize: 15 }}>🔬</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>{e.name}</span>
                          </div>
                          {e.range && (
                            <div style={{ fontSize: 11.5, color: '#475569' }}>
                              Reads <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{e.range}{e.unit ? ` ${e.unit}` : ''}</strong>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 9, fontSize: 11.5, color: '#64748b', lineHeight: 1.55 }}>
                      Kit names and reading ranges come directly from Water Rangers'{' '}
                      <a href="https://data.waterrangers.com/supported-parameters" target="_blank" rel="noreferrer" style={{ color: '#0ea5e9', textDecoration: 'underline' }}>
                        supported-parameters reference
                      </a>. To browse or buy the kits themselves, see the{' '}
                      <a href="https://waterrangers.com/" target="_blank" rel="noreferrer" style={{ color: '#0ea5e9', textDecoration: 'underline' }}>
                        Water Rangers website
                      </a>.
                    </div>
                  </>
                )}
              </Collapsible>
            )
          })()}

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

// Water Rangers publishes its own interpretation bands for some parameters
// (alkalinity: Very Low / Low / Moderate / High / Very High, with ranges).
// Rendering them gives those parameters the same visual weight as CCME-banded
// ones, in WR's own wording. Deliberately a neutral sequential palette rather
// than green/amber/red: these are descriptive categories, NOT safety verdicts,
// and colouring them like a hazard scale would imply a judgement WR never makes.
function WRBandScale({ bands, value, unit }) {
  const parsed = bands.map(b => {
    const s = String(b.range || '')
    const nums = (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
    let lo = null, hi = null
    if (/[≤<]/.test(s) && nums.length) { hi = nums[0] }
    else if (/[≥>]/.test(s) && nums.length) { lo = nums[0] }
    else if (nums.length >= 2) { lo = nums[0]; hi = nums[1] }
    else if (nums.length === 1) { lo = nums[0]; hi = nums[0] }
    return { ...b, lo, hi }
  })
  const activeIdx = !Number.isFinite(value) ? -1 : parsed.findIndex(p =>
    (p.lo == null || value >= p.lo) && (p.hi == null || value <= p.hi))
  const shades = ['#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7']
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
        Water Rangers interpretation bands
      </div>
      {Number.isFinite(value) && (
        <div style={{ fontSize: 12, marginBottom: 8, color: '#0f172a' }}>
          This reading — <strong>{value}{unit}</strong>
          {activeIdx >= 0 && <> falls in Water Rangers&rsquo; <strong>&ldquo;{parsed[activeIdx].label}&rdquo;</strong> band</>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
        {parsed.map((p, i) => {
          const on = i === activeIdx
          return (
            <div key={i} style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                height: on ? 16 : 10, borderRadius: 4,
                background: shades[Math.min(i, shades.length - 1)],
                border: on ? '2px solid #0f172a' : '1px solid rgba(15,23,42,0.08)',
                transition: 'height 0.15s',
              }} />
              <div style={{ marginTop: 5, fontSize: 9.5, fontWeight: on ? 800 : 600, color: on ? '#0f172a' : '#64748b', textAlign: 'center', lineHeight: 1.25 }}>
                {p.label}
              </div>
              <div style={{ fontSize: 8.5, color: '#94a3b8', textAlign: 'center', fontFamily: 'ui-monospace, monospace', lineHeight: 1.2 }}>
                {p.range}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 11.5, color: '#475569', lineHeight: 1.55 }}>
        These are Water Rangers&rsquo; own interpretation categories for this parameter, shown in their wording and ranges.
        They describe the level measured — they are not aquatic-life safety thresholds, and no CCME guideline band is published for this parameter.
      </div>
    </div>
  )
}

// Visual "where does this reading sit" for parameters that have NO CCME band.
// Those pages were previously all text and looked empty next to pH or oxygen.
// It never invents a threshold: it falls back through the real ranges we
// actually have — the Water Rangers published reference range, then the
// detection range of the kits used, then the site's own recorded spread — and
// the caption always states which one is being shown.
function ReferenceRangeBar({ lo, hi, value, unit, title, caption, siteMin, siteMax }) {
  const f = v => !Number.isFinite(v) ? '—' : Math.abs(v) >= 100 ? v.toFixed(0) : String(+v.toFixed(2))
  const span = Math.max(1e-9, hi - lo)
  const pct = v => Math.max(0, Math.min(100, ((v - lo) / span) * 100))
  const hasSpread = Number.isFinite(siteMin) && Number.isFinite(siteMax) && siteMax > siteMin
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>{title}</div>
      <div style={{ position: 'relative', height: 38, marginBottom: 4 }}>
        <div style={{ position: 'absolute', top: 16, left: 0, right: 0, height: 10, borderRadius: 999, background: 'linear-gradient(90deg,#e0f2fe,#bae6fd,#7dd3fc)' }} />
        {hasSpread && (
          <div title="Range covered by every reading recorded at this site"
            style={{ position: 'absolute', top: 16, height: 10, borderRadius: 999, background: 'rgba(14,165,233,0.55)',
              left: `${pct(siteMin)}%`, width: `${Math.max(1.5, pct(siteMax) - pct(siteMin))}%` }} />
        )}
        {Number.isFinite(value) && (
          <div style={{ position: 'absolute', top: 0, left: `${pct(value)}%`, transform: 'translateX(-50%)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>{f(value)}{unit}</div>
            <div style={{ fontSize: 13, lineHeight: 1, color: '#0f172a' }}>▼</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>
        <span>{f(lo)}{unit}</span><span>{f(hi)}{unit}</span>
      </div>
      {hasSpread && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 8, borderRadius: 999, background: 'rgba(14,165,233,0.55)', flexShrink: 0 }} />
          Darker band = every reading ever taken here ({f(siteMin)}–{f(siteMax)}{unit})
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11.5, color: '#475569', lineHeight: 1.55 }}>{caption}</div>
    </div>
  )
}

// Parse the AI explainer into a headline + titled sections so we can lay it out
// as designed cards instead of a wall of text. Tolerant of the model drifting:
// accepts "### Heading" or "**Heading** —" lead-ins, and if it finds no
// structure at all it falls back to one untitled block (still renders fine).
function parseExplainer(raw) {
  const text = String(raw || '').replace(/【[^】]*】/g, '').trim()
  if (!text) return null
  let headline = null
  let body = text
  const hm = text.match(/^\s*(?:\*\*)?HEADLINE(?:\*\*)?\s*:\s*(.+?)(?:\n|$)/i)
  if (hm) {
    headline = hm[1].trim().replace(/[*"']/g, '')
    body = text.slice(hm.index + hm[0].length)
  }
  const sections = []
  const parts = body.split(/\n(?=\s*(?:#{2,4}\s|\*\*[^*\n]+\*\*\s*[—:-]))/)
  for (const p of parts) {
    const chunk = p.trim()
    if (!chunk) continue
    let m = chunk.match(/^#{2,4}\s*(.+?)\s*\n([\s\S]*)$/)
    if (!m) m = chunk.match(/^\*\*([^*\n]+?)\*\*\s*[—:-]?\s*([\s\S]*)$/)
    if (m) sections.push({ title: m[1].trim().replace(/[:*]+$/, ''), body: m[2].trim() })
    else sections.push({ title: null, body: chunk })
  }
  if (!sections.length) sections.push({ title: null, body })
  return { headline, sections }
}

// Pick an icon + accent colour for a section from its title (falls back to a
// stable rotation so untitled/renamed sections still look intentional).
function sectionStyle(title, idx) {
  const t = (title || '').toLowerCase()
  const ROT = [
    { emoji: '📖', accent: '#0ea5e9' },
    { emoji: '📊', accent: '#8b5cf6' },
    { emoji: '🔭', accent: '#10b981' },
  ]
  if (/(what.*(is|means)|about|definition)/.test(t)) return ROT[0]
  if (/(happen|data|site|show|reading|number|trend|now)/.test(t)) return ROT[1]
  if (/(watch|next|driv|why|look|future)/.test(t)) return ROT[2]
  return ROT[idx % 3]
}

// Styled renderer for the AI explainer: a bold headline banner + one card per
// section (icon badge, coloured accent, plain-English body). This is what makes
// the answer scannable and visually striking instead of a paragraph wall.
function ExplainerView({ text }) {
  const parsed = parseExplainer(text)
  if (!parsed) return null
  const { headline, sections } = parsed
  return (
    <div>
      {headline && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 14px', borderRadius: 12, marginBottom: 12,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#fff', boxShadow: '0 6px 18px rgba(99,102,241,0.28)',
        }}>
          <Sparkles size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.4 }}>
            {String(headline).replace(/\*\*/g, '')}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sections.map((s, i) => {
          const st = sectionStyle(s.title, i)
          return (
            <div key={i} style={{
              padding: '11px 13px 11px 14px', borderRadius: 10,
              background: '#fff', border: '1px solid #ece9f7',
              borderLeft: `4px solid ${st.accent}`,
            }}>
              {s.title && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <span aria-hidden style={{ fontSize: 15 }}>{st.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: st.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.title}</span>
                </div>
              )}
              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#1e293b' }}>
                <MarkdownLite text={s.body} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Instant "what stands out" strip. Renders the local `signals` (trend, record,
// seasonality, volatility, recent shift) as plain chips — computed in the
// browser from the real readings, so it costs zero tokens and shows even when
// the AI is slow or down. Confidence bars here MATCH the ones used to build the
// AI prompt, so the chips and the AI narrative never contradict each other.
function SignalsStrip({ signals, unit }) {
  if (!signals) return null
  const f = (v) => Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(0) : String(+v.toFixed(2))) : '—'
  const chips = []

  if (signals.constant) chips.push({ tone: 'cool', icon: '＝', title: 'Perfectly constant', sub: `All ${signals.n} readings here are identical` })
  else if (signals.latestIsMax) chips.push({ tone: 'hot', icon: '▲', title: 'Record high', sub: `Latest is the highest of all ${signals.n} readings here` })
  else if (signals.latestIsMin) chips.push({ tone: 'cool', icon: '▼', title: 'Record low', sub: `Latest is the lowest of all ${signals.n} readings here` })
  else if (signals.latestPct != null && (signals.latestPct >= 80 || signals.latestPct <= 20))
    chips.push({ tone: 'neutral', icon: '◧', title: `${signals.latestPct}th percentile`, sub: `Latest sits above ${signals.latestPct}% of past readings here` })

  if (signals.trend && signals.trend.strong)
    chips.push({
      tone: signals.trend.dir === 'rising' ? 'hot' : 'cool',
      icon: signals.trend.dir === 'rising' ? '↗' : '↘',
      title: signals.trend.dir === 'rising' ? 'Rising over time' : 'Falling over time',
      sub: `≈ ${f(signals.trend.perYear)}${unit}/yr · r=${signals.trend.r.toFixed(2)} · ${signals.n} samples`,
    })

  if (signals.shift && signals.shift.deltaPct != null && Math.abs(signals.shift.deltaPct) >= 15)
    chips.push({
      tone: signals.shift.deltaPct > 0 ? 'hot' : 'cool',
      icon: '⇄',
      title: `Recent readings ${signals.shift.deltaPct > 0 ? 'up' : 'down'} ${Math.abs(signals.shift.deltaPct).toFixed(0)}%`,
      sub: `Latest samples avg ${f(signals.shift.recent)}${unit} vs ${f(signals.shift.early)}${unit} early on`,
    })

  if (signals.season && signals.season.relDiff >= 0.1) {
    const warmer = signals.season.warm >= signals.season.cold
    chips.push({
      tone: 'neutral', icon: warmer ? '☀' : '❄',
      title: warmer ? 'Higher in warm months' : 'Higher in cold months',
      sub: `Warm avg ${f(signals.season.warm)}${unit} (n=${signals.season.warmN}) · cold avg ${f(signals.season.cold)}${unit} (n=${signals.season.coldN})`,
    })
  }

  if (!signals.constant && signals.cv != null && signals.cv < 0.1)
    chips.push({ tone: 'cool', icon: '≈', title: 'Very stable', sub: `Readings barely move (variation ${(signals.cv * 100).toFixed(0)}%)` })
  else if (signals.cv != null && signals.cv > 0.5)
    chips.push({ tone: 'hot', icon: '↕', title: 'Highly variable', sub: `Readings swing a lot (variation ${(signals.cv * 100).toFixed(0)}%)` })

  if (!chips.length) return null
  const TONE = {
    hot: { bg: '#fef2f2', bd: '#fecaca', fg: '#b91c1c' },
    cool: { bg: '#eff6ff', bd: '#bfdbfe', fg: '#1d4ed8' },
    neutral: { bg: '#f5f3ff', bd: '#ddd6fe', fg: '#6d28d9' },
  }
  return (
    <Collapsible icon="📊" title="What stands out at this site"
      hint="Patterns detected automatically from this site's own readings — computed on the spot, no AI needed. Each one is measured straight from the real numbers above.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
        {chips.map((c, i) => {
          const t = TONE[c.tone] || TONE.neutral
          return (
            <div key={i} style={{ padding: '11px 13px', borderRadius: 11, background: t.bg, border: `1px solid ${t.bd}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                <span aria-hidden style={{ fontSize: 14, color: t.fg, fontWeight: 900 }}>{c.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: t.fg }}>{c.title}</span>
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.5, color: '#475569' }}>{c.sub}</div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 9, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
        These are descriptive patterns in this site's data, not safety verdicts. A trend is only shown when the readings genuinely line up (Pearson r ≥ 0.4).
      </div>
    </Collapsible>
  )
}

// Collapsible section — same heading as SectionHeader but the whole block
// expands/contracts on click, so a long deep-dive can be tidied down to just
// the parts a reader cares about. Defaults to open.
function Collapsible({ icon, title, hint, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginTop: 26 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}
      >
        <ChevronDown size={16} color="#64748b" style={{ marginTop: 3, flexShrink: 0, transition: 'transform .15s', transform: open ? 'none' : 'rotate(-90deg)' }} />
        <span style={{ flex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
            {typeof icon === 'string' ? <span aria-hidden style={{ fontSize: 18 }}>{icon}</span> : icon}
            {title}
          </span>
          {hint && <span style={{ display: 'block', fontSize: 12.5, color: '#64748b', margin: '4px 0 0', lineHeight: 1.45 }}>{hint}</span>}
        </span>
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
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
function RangeBar({ meta, pointerValue }) {
  const W = 580
  const H = 56
  const top = 18
  const barH = 14
  const SENTINEL = 9999
  const ranges = meta.ranges
  const minEdge = ranges[0].min

  // The last band is usually open-ended with a sentinel max (9999 / 99999).
  // Scaling the whole bar to that sentinel squashes every real band into a
  // sliver at the left and overlaps all the labels (Elaine: "Stestwatch /
  // Safe / Soft" piled on top of each other). Scale to the last REAL
  // boundary instead, with headroom, and let the open band run to the
  // right edge. Extend the scale if the reading itself sits beyond it.
  const realMaxes = ranges.map(r => r.max).filter(m => m < SENTINEL)
  let visualMax = (realMaxes.length ? Math.max(...realMaxes) : ranges[ranges.length - 1].min || 1) * 1.15
  if (Number.isFinite(pointerValue) && pointerValue > visualMax) visualMax = pointerValue * 1.12
  const span = Math.max(1e-6, visualMax - minEdge)
  const xOf = (v) => {
    const m = v >= SENTINEL ? visualMax : v
    return Math.max(0, Math.min(W, ((m - minEdge) / span) * W))
  }
  const px = Number.isFinite(pointerValue) ? xOf(pointerValue) : null

  // Boundary numbers along the bottom — only drawn when they won't collide
  // with the previous one (narrow bands would otherwise overprint).
  let lastNumX = -999
  const boundaryLabels = []
  const pushNum = (x, val) => {
    if (x - lastNumX < 30) return
    lastNumX = x
    boundaryLabels.push(
      <text key={`n-${x}`} x={x} y={top + barH + 13} fontSize="10" fill="#475569"
        textAnchor={x < 12 ? 'start' : x > W - 12 ? 'end' : 'middle'}>{val}</text>
    )
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 40}`} width="100%" height="auto" role="img" aria-label="Parameter range diagram">
        {ranges.map((r, i) => {
          const x1 = xOf(r.min)
          const x2 = xOf(r.max)
          const w = Math.max(0, x2 - x1)
          if (i === 0) pushNum(x1, r.min)
          if (r.max < SENTINEL) pushNum(x2, r.max)
          return (
            <g key={i}>
              <rect x={x1} y={top} width={w} height={barH} fill={TONE_COLOR[r.tone]} opacity={0.9} />
              {/* Band label above the bar — only if the band is wide enough
                  to hold the text; narrow bands are covered by the legend. */}
              {w >= 56 && (
                <text x={x1 + w / 2} y={top - 5} fontSize="9" fill="#0f172a" textAnchor="middle" fontWeight="600">
                  {r.label}
                </text>
              )}
            </g>
          )
        })}
        {boundaryLabels}

        {px != null && (
          <g>
            <line x1={px} x2={px} y1={top - 9} y2={top + barH + 6} stroke="#0f172a" strokeWidth="2" />
            <polygon points={`${px - 5},${top - 11} ${px + 5},${top - 11} ${px},${top - 3}`} fill="#0f172a" />
            <text x={Math.max(24, Math.min(W - 24, px))} y={top + barH + 30}
              fontSize="11" fontWeight="700" fill="#0f172a" textAnchor="middle">
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
      {/* Source attribution. These zones come from CCME (the Canadian national
          aquatic-life guidelines) — waterParams.js is CCME-only by design. WR's
          own test-kit pages show a simpler "common values" guide with slightly
          different cut-offs, so stating the source here stops the difference
          from reading as a contradiction to a reviewer who has both open. */}
      <div style={{ marginTop: 4, fontSize: 11, color: '#64748b', lineHeight: 1.55, padding: '8px 10px', background: '#f1f5f9', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        These zones follow <strong style={{ color: '#334155' }}>CCME aquatic-life guidelines</strong> — the Canadian national reference for healthy surface water. Water Rangers&rsquo; test-kit pages use their own simpler &ldquo;common values&rdquo; guide, so the exact cut-offs differ slightly. Both describe the same water from different published sources; neither is a drinking-water standard.
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
