import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { PARAM_META, classifyValue, latestValueFor, TONE_COLOR } from '../utils/waterParams'

// Slide-in deep-dive panel for a single water parameter.
// Renders an inline SVG range bar with CCME aquatic-life bands, a pointer at the
// current value, an impact list (Fish/Insects/Plants), the mechanism story, and
// how it's measured in the field. Surface-water / aquatic-life ONLY — no drinking
// water content (compliance: SOURCE Water never references potability).
export default function ParameterDeepDive({ paramKey, observations, onClose }) {
  const meta = PARAM_META[paramKey]

  // ESC closes the panel
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const latest = useMemo(() => latestValueFor(paramKey, observations || []), [paramKey, observations])
  const cls = useMemo(() => latest ? classifyValue(paramKey, latest.value) : null, [paramKey, latest])

  // Build a small history series (last 8 numeric values) for the sparkline
  const series = useMemo(() => {
    const vals = []
    for (const obs of (observations || [])) {
      let n = null
      if (obs && obs[paramKey] != null && obs[paramKey] !== '') n = Number(obs[paramKey])
      else if (Array.isArray(obs?.readings)) {
        for (const r of obs.readings) {
          const name = String(r?.parameter || '').toLowerCase()
          if (meta?.aliases?.some(a => name.includes(a))) { n = Number(r?.value); break }
        }
      }
      if (Number.isFinite(n)) vals.push({ value: n, at: obs?.observed_at || obs?.collected_at })
      if (vals.length >= 12) break
    }
    return vals.reverse()
  }, [paramKey, observations, meta])

  if (!meta) return null

  // Range bar — clamp display to the union of all band edges
  const minEdge = meta.ranges[0].min
  const maxEdge = meta.ranges[meta.ranges.length - 1].max
  const span = Math.max(1e-6, maxEdge - minEdge)
  const pointerPct = latest ? Math.max(0, Math.min(100, ((latest.value - minEdge) / span) * 100)) : null

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
          width: 'min(560px, 100%)', height: '100%', background: '#fff',
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
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{meta.label}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 6 }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 18, color: '#0f172a' }}>
          {/* Plain-language intro */}
          <p style={{ fontSize: 14, lineHeight: 1.55, color: '#334155', marginTop: 0 }}>{meta.short}</p>

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
                  {latest ? `${latest.value}${meta.unit}` : '—'}
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
                No recent reading from this site for this parameter — guidance below shows the bands.
              </div>
            )}
          </div>

          {/* Range diagram — inline SVG, CCME aquatic-life bands */}
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8 }}>
            CCME aquatic-life bands
          </h3>
          <RangeBar meta={meta} pointerPct={pointerPct} pointerValue={latest?.value} />

          {/* Sparkline of recent values */}
          {series.length >= 2 && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8 }}>
                Recent measurements at this site
              </h3>
              <Sparkline series={series} meta={meta} />
            </>
          )}

          {/* Mechanism / story */}
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8 }}>
            Why it changes
          </h3>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#334155', margin: 0 }}>{meta.mechanism}</p>

          {/* Impacts diagram — three columns with mini icons */}
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8 }}>
            Who it affects
          </h3>
          <ImpactsRow impacts={meta.impacts} />

          {/* How measured */}
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 8 }}>
            How it's measured
          </h3>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#334155', margin: 0 }}>{meta.measured}</p>

          <div style={{ marginTop: 22, padding: '10px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 11, color: '#64748b' }}>
            Bands shown are CCME freshwater <strong>aquatic-life</strong> references. SOURCE Water is a surface-water platform — these thresholds describe stress on fish, insects, and plants and are <strong>not drinking-water guidelines</strong>.
          </div>
        </div>
      </div>
    </div>
  )
}

// SVG range bar with tone-coloured bands and a pointer marker for the current value.
function RangeBar({ meta, pointerPct, pointerValue }) {
  const W = 520
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
              {/* Edge tick + label */}
              {i === 0 && (
                <text x={x1} y={top + barH + 12} fontSize="10" fill="#475569">{r.min}</text>
              )}
              <text x={x2} y={top + barH + 12} fontSize="10" fill="#475569" textAnchor="end">
                {r.max >= 9999 ? '' : r.max}
              </text>
              {/* Band label */}
              <text x={(x1 + x2) / 2} y={top - 4} fontSize="9" fill="#0f172a" textAnchor="middle" fontWeight="600">
                {r.label}
              </text>
            </g>
          )
        })}

        {/* Pointer */}
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

// Compact sparkline of recent values.
function Sparkline({ series, meta }) {
  const W = 520
  const H = 80
  const pad = 8
  const values = series.map((s) => s.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1e-6, max - min)

  const points = series.map((s, i) => {
    const x = pad + (i / Math.max(1, series.length - 1)) * (W - 2 * pad)
    const y = H - pad - ((s.value - min) / span) * (H - 2 * pad)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const last = series[series.length - 1]
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img" aria-label="Recent value sparkline">
        <polyline points={points} fill="none" stroke="#0ea5e9" strokeWidth="2" />
        {series.map((s, i) => {
          const x = pad + (i / Math.max(1, series.length - 1)) * (W - 2 * pad)
          const y = H - pad - ((s.value - min) / span) * (H - 2 * pad)
          const cls = classifyValue(meta.key, s.value)
          return <circle key={i} cx={x} cy={y} r={3} fill={cls?.color || '#0ea5e9'} />
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
        <span>min {min}{meta.unit}</span>
        <span>latest {last.value}{meta.unit}</span>
        <span>max {max}{meta.unit}</span>
      </div>
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
