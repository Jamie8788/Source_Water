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
import { X, ArrowRight, ExternalLink, Calendar, Droplets, MapPin } from 'lucide-react'
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
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Loading observations from Water Rangers…</div>
          )}

          {/* Overall scoreboard — count of "safer" parameters per side */}
          <Scoreboard siteA={siteA} siteB={siteB} obsA={obsA} obsB={obsB} />

          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 8, alignItems: 'stretch', fontSize: 12 }}>
            <div />
            <ColumnHeader site={siteA} accent="#60a5fa" obs={obsA} />
            <ColumnHeader site={siteB} accent="#34d399" obs={obsB} />

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
            Pulled live from the Water Rangers public API · readings are from each site's most recent observation.
            "—" means no reading for that parameter at that site yet.
          </div>
        </div>
      )}
    </div>
  )
}

function ColumnHeader({ site, accent, obs }) {
  // Pull useful metadata from the WR site object + the observations array
  // so the header tells the user who/where/how-active without needing
  // another tab.
  const obsCount = Array.isArray(obs) ? obs.length : 0
  const dates = (obs || []).map(o => o?.observed_at || o?.collected_at || o?.created_at).filter(Boolean)
  const lastObs = dates.length ? new Date(dates.reduce((a, b) => new Date(a) > new Date(b) ? a : b)) : null
  const firstObs = site.first_observation_at ? new Date(site.first_observation_at) : null
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 8,
      background: `${accent}14`, border: `1px solid ${accent}55`,
      color: '#fff',
    }}>
      <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.25, color: '#fff' }}>{site.name}</div>

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

// Scoreboard — at-a-glance summary of "who's safer on more parameters"
function Scoreboard({ siteA, siteB, obsA, obsB }) {
  let scoreA = 0, scoreB = 0, comparable = 0
  PARAM_ORDER.forEach(pk => {
    const a = latestValueFor(pk, obsA || [])
    const b = latestValueFor(pk, obsB || [])
    if (!a || !b) return
    comparable++
    const ca = classifyValue(pk, a.value)
    const cb = classifyValue(pk, b.value)
    const order = { safe: 3, warning: 2, critical: 1, unknown: 0 }
    const ta = order[ca?.tone] ?? 0, tb = order[cb?.tone] ?? 0
    if (ta > tb) scoreA++
    else if (tb > ta) scoreB++
  })
  if (comparable === 0) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      padding: '8px 12px', marginBottom: 10, borderRadius: 8,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800 }}>
        <span style={{ color: '#60a5fa' }}>{siteA.name}</span>
        <span style={{ color: '#fff', background: '#60a5fa', padding: '2px 10px', borderRadius: 999, fontSize: 12 }}>{scoreA}</span>
        <span style={{ color: '#94a3b8', fontSize: 11 }}>vs</span>
        <span style={{ color: '#fff', background: '#34d399', padding: '2px 10px', borderRadius: 999, fontSize: 12 }}>{scoreB}</span>
        <span style={{ color: '#34d399' }}>{siteB.name}</span>
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>
        {scoreA === scoreB
          ? `Even — ${comparable} parameters comparable`
          : `${scoreA > scoreB ? siteA.name : siteB.name} is in the safer band on ${Math.max(scoreA, scoreB)} of ${comparable}`}
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
