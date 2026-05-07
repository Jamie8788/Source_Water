/**
 * CompareDrawer — bottom drawer that shows two WR sites side-by-side with
 * each parameter's latest reading + CCME band, color-coded by who's
 * higher / safer per the SOURCE Water bands.
 *
 * Pure UI: takes pre-fetched observations for both sites and computes
 * latest values via existing latestValueFor/classifyValue helpers. No
 * extra WR API calls beyond the per-site observation fetch the parent
 * already does for the deep-dive panel.
 */
import { X, ArrowRight } from 'lucide-react'
import { PARAM_META, PARAM_ORDER, classifyValue, latestValueFor, TONE_COLOR } from '../../utils/waterParams'

function fmt(v, unit) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${(+v).toFixed(2).replace(/\.00$/, '')}${unit || ''}`
}

// Returns { winner: 'a'|'b'|'tie'|null, reason } based on band tone preference.
// 'safe' beats 'warning' beats 'critical'. Within the same tone we don't
// pick a winner — readings can be valid at different absolute values.
function compareToneSafer(a, b) {
  if (!a && !b) return { winner: null }
  if (!a) return { winner: 'b' }
  if (!b) return { winner: 'a' }
  const order = { safe: 3, warning: 2, critical: 1, unknown: 0 }
  const ta = order[a.tone] ?? 0
  const tb = order[b.tone] ?? 0
  if (ta === tb) return { winner: 'tie' }
  return { winner: ta > tb ? 'a' : 'b' }
}

export default function CompareDrawer({
  siteA, siteB,
  obsA, obsB,
  onClose, onClear, onPickB,
  loading,
}) {
  if (!siteA && !siteB) return null

  // Drawer in two states: (1) only A picked → tells user to pick a second
  // site; (2) both picked → side-by-side parameter table.
  return (
    <div
      data-cms-ui="true"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1200,
        background: 'rgba(15, 23, 42, 0.96)', color: '#e2e8f0',
        borderTop: '1px solid rgba(99,102,241,0.35)',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
        maxHeight: '52vh', overflowY: 'auto',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Compare sites</span>
          {siteA && <span style={{ fontWeight: 600, color: '#a5b4fc' }}>{siteA.name}</span>}
          {siteA && siteB && <ArrowRight size={12} style={{ color: '#a5b4fc' }} />}
          {siteB && <span style={{ fontWeight: 600, color: '#a5b4fc' }}>{siteB.name}</span>}
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

      {!siteB && (
        <div style={{ padding: 14, fontSize: 12.5, color: '#cbd5e1' }}>
          ✓ Picked <strong style={{ color: '#fff' }}>{siteA?.name}</strong>.
          Click the <strong>Compare</strong> pill on a second site's popup to compare them side-by-side.
          <button onClick={onPickB} style={{
            marginLeft: 8, padding: '4px 8px', borderRadius: 6,
            background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
            border: '1px solid rgba(99,102,241,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>or pick another</button>
        </div>
      )}

      {siteA && siteB && (
        <div style={{ padding: '10px 14px 18px' }}>
          {loading && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Loading observations…</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <div />
            <ColumnHeader site={siteA} accent="#60a5fa" />
            <ColumnHeader site={siteB} accent="#34d399" />

            {PARAM_ORDER.map(pk => {
              const meta = PARAM_META[pk]
              const a = latestValueFor(pk, obsA || [])
              const b = latestValueFor(pk, obsB || [])
              const ca = a ? classifyValue(pk, a.value) : null
              const cb = b ? classifyValue(pk, b.value) : null
              const cmp = compareToneSafer(ca, cb)
              return (
                <Row
                  key={pk}
                  label={meta.label}
                  unit={meta.unit}
                  a={a} ca={ca}
                  b={b} cb={cb}
                  winner={cmp.winner}
                />
              )
            })}
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
            Highlighted column = sits in the safer SOURCE Water band for that parameter.
            "—" means no recent reading from that site for that parameter.
          </div>
        </div>
      )}
    </div>
  )
}

function ColumnHeader({ site, accent }) {
  return (
    <div style={{
      padding: '6px 10px', borderRadius: 8,
      background: `${accent}14`, border: `1px solid ${accent}55`,
      color: '#fff',
    }}>
      <div style={{ fontWeight: 800, fontSize: 12.5, lineHeight: 1.2 }}>{site.name}</div>
      <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2 }}>
        {site.country || '—'}{site.body_of_water ? ` · ${site.body_of_water}` : ''}
      </div>
    </div>
  )
}

function Row({ label, unit, a, ca, b, cb, winner }) {
  const cell = (val, cls, isWinner) => (
    <div style={{
      padding: '8px 10px', borderRadius: 8,
      background: isWinner ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isWinner ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>
          {fmt(val?.value, unit)}
        </span>
        {cls && (
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 999,
            color: '#fff', background: TONE_COLOR[cls.tone] || '#94a3b8',
          }}>{cls.label}</span>
        )}
      </div>
      {val?.at && (
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
          {new Date(val.at).toLocaleDateString()}
        </div>
      )}
    </div>
  )
  return (
    <>
      <div style={{ fontWeight: 700, color: '#cbd5e1' }}>{label}</div>
      {cell(a, ca, winner === 'a')}
      {cell(b, cb, winner === 'b')}
    </>
  )
}
