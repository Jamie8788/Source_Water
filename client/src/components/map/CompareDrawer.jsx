/**
 * CompareDrawer — bottom drawer that compares two WR sites side-by-side.
 *
 * Shows EVERY parameter that has a reading at either site (alkalinity,
 * hardness, salinity, secchi depth, pH, turbidity, …) — not just the five
 * we have local CCME bands for. Where we DO have bands (matchParam ↔
 * PARAM_META), we colour-code who sits in the safer zone. Where we don't,
 * we still show the raw value + unit + sample date side-by-side, so the
 * user can compare any parameter WR returns.
 *
 * Pure UI — no extra WR API calls; consumes pre-fetched observations.
 * Layout uses fixed column widths inside a horizontally-scrollable wrapper
 * so it never collapses on narrow screens (which was the previous bug
 * where labels truncated to "y" / "ivity" / "mperature").
 */
import { useMemo } from 'react'
import { X, ArrowRight, ExternalLink, Calendar, Droplets, MapPin, Sparkles, Maximize2 } from 'lucide-react'
import { PARAM_META, classifyValue, latestValueFor, matchParam, TONE_COLOR } from '../../utils/waterParams'

// ── helpers ────────────────────────────────────────────────────────────────
function fmtNum(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  const n = +v
  if (Math.abs(n) >= 100) return n.toFixed(1).replace(/\.0$/, '')
  return n.toFixed(2).replace(/\.00$/, '')
}

function fmtUnit(unit) {
  if (!unit) return ''
  return unit.startsWith(' ') ? unit : ` ${unit}`
}

// Title-case a free-form WR parameter name like "specific_conductance"
// → "Specific Conductance" or "dissolved oxygen" → "Dissolved Oxygen".
function prettyParamName(s) {
  return String(s || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ')
    .map(w => w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

// Pull the latest reading for a free-form WR parameter name out of an
// observations array. Observations come back newest-first, so the first
// numeric match wins. Returns { value, unit, at } or null.
function latestRawByName(name, obs) {
  if (!Array.isArray(obs) || !name) return null
  const target = String(name).toLowerCase()
  for (const o of obs) {
    if (Array.isArray(o?.readings)) {
      for (const r of o.readings) {
        if (String(r?.parameter || '').toLowerCase() === target) {
          const n = Number(r?.value)
          if (Number.isFinite(n)) {
            return {
              value: n,
              unit: r?.unit || '',
              at: o?.observed_at || o?.collected_at || o?.created_at || null,
            }
          }
        }
      }
    }
  }
  return null
}

// Returns 'a' | 'b' | 'tie' | null based on band tone preference.
// 'safe' beats 'warning' beats 'critical'. Within the same tone, no winner.
function compareToneSafer(a, b) {
  if (!a && !b) return null
  if (!a) return 'b'
  if (!b) return 'a'
  const order = { safe: 3, warning: 2, critical: 1, unknown: 0 }
  const ta = order[a.tone] ?? 0
  const tb = order[b.tone] ?? 0
  if (ta === tb) return 'tie'
  return ta > tb ? 'a' : 'b'
}

// ── main component ─────────────────────────────────────────────────────────
export default function CompareDrawer({
  siteA, siteB,
  obsA, obsB,
  onClose, onClear, onPickB,
  onOpenDeepDive,
  loading,
}) {
  // Compute the union of WR parameter names across both sites' observations.
  // Each entry knows whether we have a CCME band for it (paramKey via
  // matchParam) — if yes, we render with band classification; if no, raw.
  const paramRows = useMemo(() => {
    if (!siteA || !siteB) return []
    const seen = new Map() // displayName -> { rawName, paramKey | null, displayName }
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
    // Sort: parameters we have CCME bands for first (with stable PARAM_META
    // order), then everything else alphabetically.
    const META_RANK = { ph: 0, turbidity: 1, temperature: 2, dissolved_oxygen: 3, conductivity: 4 }
    const arr = Array.from(seen.values())
    arr.sort((x, y) => {
      const xR = x.paramKey != null ? (META_RANK[x.paramKey] ?? 99) : 100
      const yR = y.paramKey != null ? (META_RANK[y.paramKey] ?? 99) : 100
      if (xR !== yR) return xR - yR
      return x.displayName.localeCompare(y.displayName)
    })
    return arr
  }, [siteA, siteB, obsA, obsB])

  if (!siteA && !siteB) return null

  return (
    <div
      data-cms-ui="true"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1200,
        background: 'rgba(15, 23, 42, 0.97)', color: '#e2e8f0',
        borderTop: '1px solid rgba(99,102,241,0.35)',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
        maxHeight: '60vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c4b5fd', fontWeight: 700 }}>
            Compare sites
          </span>
          {siteA && <span style={{ fontWeight: 700, color: '#a5b4fc', fontSize: 12.5 }}>{siteA.name}</span>}
          {siteA && siteB && <ArrowRight size={12} style={{ color: '#a5b4fc' }} />}
          {siteB && <span style={{ fontWeight: 700, color: '#a5b4fc', fontSize: 12.5 }}>{siteB.name}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onClear} style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>Clear</button>
          <button onClick={onClose} aria-label="Close" style={{
            padding: 4, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: '#94a3b8', cursor: 'pointer', display: 'flex',
          }}><X size={14}/></button>
        </div>
      </div>

      {/* Half-state: only Site A picked */}
      {!siteB && (
        <div style={{ padding: 14, fontSize: 12.5, color: '#cbd5e1' }}>
          ✓ Picked <strong style={{ color: '#fff' }}>{siteA?.name}</strong>.
          Click any other site (popup or detail panel) and tap <strong>Compare</strong> to see them side-by-side.
          <button onClick={onPickB} style={{
            marginLeft: 8, padding: '4px 8px', borderRadius: 6,
            background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
            border: '1px solid rgba(99,102,241,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>or pick another</button>
        </div>
      )}

      {/* Full state: A + B both picked */}
      {siteA && siteB && (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <div style={{ padding: '10px 14px 18px', minWidth: 720 }}>
            {loading && (
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Loading observations from Water Rangers…</div>
            )}

            {/* Big launch button — opens the full-screen deep-dive
                comparison with overlay charts + stats per side. The
                drawer below stays available as a quick scan. */}
            {onOpenDeepDive && (
              <button
                onClick={onOpenDeepDive}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '12px 16px', marginBottom: 12,
                  borderRadius: 12, fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 50%, #ec4899 100%)',
                  color: '#fff', border: 'none', letterSpacing: '0.02em',
                  boxShadow: '0 6px 18px rgba(124, 58, 237, 0.45)',
                }}
              >
                <Sparkles size={14}/>
                Open Full Deep-Dive Comparison — charts, bands, stats per parameter
                <Maximize2 size={14}/>
              </button>
            )}

            {/* Scoreboard + headers */}
            <Scoreboard siteA={siteA} siteB={siteB} paramRows={paramRows} obsA={obsA} obsB={obsB} />

            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 10, alignItems: 'stretch' }}>
              <div />
              <ColumnHeader site={siteA} accent="#60a5fa" obs={obsA} />
              <ColumnHeader site={siteB} accent="#34d399" obs={obsB} />
            </div>

            {/* Param list — every parameter from either site, NOT just our 5.
                Banded ones come first; everything else stays comparable too. */}
            {paramRows.length === 0 ? (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12.5, color: '#cbd5e1' }}>
                No numeric parameters returned by Water Rangers for either site yet.
                Once observations come in for {siteA.name} or {siteB.name}, every shared parameter will appear here.
              </div>
            ) : (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {paramRows.map(p => {
                  // Banded path: classify with PARAM_META
                  if (p.paramKey) {
                    const meta = PARAM_META[p.paramKey]
                    const a = latestValueFor(p.paramKey, obsA || [])
                    const b = latestValueFor(p.paramKey, obsB || [])
                    const ca = a ? classifyValue(p.paramKey, a.value) : null
                    const cb = b ? classifyValue(p.paramKey, b.value) : null
                    const winner = compareToneSafer(ca, cb)
                    return (
                      <ParamRow
                        key={`m-${p.paramKey}`}
                        label={meta.label} unit={meta.unit}
                        a={a} ca={ca} b={b} cb={cb}
                        winner={winner}
                        banded
                      />
                    )
                  }
                  // Raw path: just compare values + units + dates
                  const a = latestRawByName(p.rawName, obsA || [])
                  const b = latestRawByName(p.rawName, obsB || [])
                  const aUnit = a?.unit || b?.unit || ''
                  return (
                    <ParamRow
                      key={`r-${p.rawName}`}
                      label={p.displayName}
                      unit={fmtUnit(aUnit)}
                      a={a} ca={null} b={b} cb={null}
                      winner={null}
                      banded={false}
                    />
                  )
                })}
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
              Showing <strong style={{ color: '#cbd5e1' }}>{paramRows.length}</strong> parameter{paramRows.length !== 1 ? 's' : ''} returned by Water Rangers for these sites.
              Green-highlighted column = the safer SOURCE Water band for that parameter (only computed for parameters with published bands).
              "—" means no reading at that site for that parameter.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── header card per side ──────────────────────────────────────────────────
function ColumnHeader({ site, accent, obs }) {
  const obsCount = Array.isArray(obs) ? obs.length : 0
  const dates = (obs || []).map(o => o?.observed_at || o?.collected_at || o?.created_at).filter(Boolean)
  const lastObs = dates.length ? new Date(dates.reduce((a, b) => new Date(a) > new Date(b) ? a : b)) : null
  const firstObs = site.first_observation_at ? new Date(site.first_observation_at) : null
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: `${accent}14`, border: `1px solid ${accent}55`, color: '#fff',
    }}>
      <div style={{ fontWeight: 800, fontSize: 13.5, lineHeight: 1.25, color: '#fff' }}>{site.name}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, fontSize: 10.5, color: '#cbd5e1' }}>
        {site.country && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={10}/> {site.country}
          </span>
        )}
        {site.body_of_water && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Droplets size={10}/> {site.body_of_water}
          </span>
        )}
        {firstObs && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="First observation on file">
            <Calendar size={10}/> Since {firstObs.getFullYear()}
          </span>
        )}
      </div>
      <div style={{ marginTop: 6, display: 'flex', gap: 4, alignItems: 'center', fontSize: 10.5 }}>
        <span style={{ padding: '1px 7px', borderRadius: 999, background: `${accent}33`, color: '#fff', fontWeight: 700 }}>
          {obsCount} obs
        </span>
        {lastObs && (
          <span style={{ color: '#cbd5e1' }}>· last {lastObs.toLocaleDateString()}</span>
        )}
        {site.permalink && (
          <a href={site.permalink} target="_blank" rel="noreferrer"
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3, color: '#a5b4fc', fontWeight: 700, textDecoration: 'none' }}>
            WR <ExternalLink size={10}/>
          </a>
        )}
      </div>
    </div>
  )
}

// ── scoreboard ────────────────────────────────────────────────────────────
function Scoreboard({ siteA, siteB, paramRows, obsA, obsB }) {
  let scoreA = 0, scoreB = 0, comparable = 0, banded = 0
  for (const p of paramRows || []) {
    if (!p.paramKey) continue
    banded++
    const a = latestValueFor(p.paramKey, obsA || [])
    const b = latestValueFor(p.paramKey, obsB || [])
    if (!a || !b) continue
    comparable++
    const ca = classifyValue(p.paramKey, a.value)
    const cb = classifyValue(p.paramKey, b.value)
    const order = { safe: 3, warning: 2, critical: 1, unknown: 0 }
    const ta = order[ca?.tone] ?? 0, tb = order[cb?.tone] ?? 0
    if (ta > tb) scoreA++
    else if (tb > ta) scoreB++
  }
  if (comparable === 0) {
    return (
      <div style={{
        padding: '8px 12px', marginBottom: 10, borderRadius: 8,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        fontSize: 11.5, color: '#94a3b8',
      }}>
        Comparing all {paramRows.length} parameter{paramRows.length !== 1 ? 's' : ''}.
        {banded > 0 ? ' Safety scoreboard appears once both sites have readings for the same banded parameter (pH, turbidity, water temperature, dissolved oxygen, conductivity).' : ''}
      </div>
    )
  }
  const leadName = scoreA === scoreB ? null : (scoreA > scoreB ? siteA.name : siteB.name)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      padding: '8px 12px', marginBottom: 10, borderRadius: 8,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, flexWrap: 'wrap' }}>
        <span style={{ color: '#60a5fa' }}>{siteA.name}</span>
        <span style={{ color: '#fff', background: '#60a5fa', padding: '2px 10px', borderRadius: 999 }}>{scoreA}</span>
        <span style={{ color: '#94a3b8', fontSize: 11 }}>vs</span>
        <span style={{ color: '#fff', background: '#34d399', padding: '2px 10px', borderRadius: 999 }}>{scoreB}</span>
        <span style={{ color: '#34d399' }}>{siteB.name}</span>
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>
        {leadName == null
          ? `Even — ${comparable} banded parameter${comparable !== 1 ? 's' : ''} comparable`
          : `${leadName} sits in the safer band on ${Math.max(scoreA, scoreB)} of ${comparable} banded parameter${comparable !== 1 ? 's' : ''}`}
      </div>
    </div>
  )
}

// ── one parameter row (label, A cell, B cell) ─────────────────────────────
function ParamRow({ label, unit, a, ca, b, cb, winner, banded }) {
  const cell = (val, cls, isWinner, accent) => (
    <div style={{
      padding: '9px 11px', borderRadius: 10,
      background: isWinner ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isWinner ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.08)'}`,
      minHeight: 52,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
          {val ? `${fmtNum(val.value)}${unit || ''}` : '—'}
        </span>
        {cls ? (
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
            color: '#fff', background: TONE_COLOR[cls.tone] || '#94a3b8', whiteSpace: 'nowrap',
          }}>{cls.label}</span>
        ) : (
          val && !banded && (
            <span style={{ fontSize: 10, color: '#94a3b8' }}>raw</span>
          )
        )}
      </div>
      {val?.at && (
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
          {new Date(val.at).toLocaleDateString()}
        </div>
      )}
    </div>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 10, alignItems: 'stretch' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 4px',
        fontWeight: 700, color: '#cbd5e1', fontSize: 13,
      }}>
        <span style={{ wordBreak: 'break-word' }}>{label}</span>
        {!banded && (
          <span style={{ fontSize: 10, fontWeight: 500, color: '#64748b', marginTop: 2 }}>
            raw value · no SOURCE band
          </span>
        )}
      </div>
      {cell(a, ca, winner === 'a', '#60a5fa')}
      {cell(b, cb, winner === 'b', '#34d399')}
    </div>
  )
}
