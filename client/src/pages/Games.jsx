import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useSound } from '../context/SoundContext'
import api from '../utils/api'
import { ArrowLeft, Trophy } from 'lucide-react'
import NibiMascotImage from '../components/NibiMascotImage'
import { PARAM_META, classifyValue, TONE_COLOR } from '../utils/waterParams'

// SOURCE Water — Learning Games
// 3 addictive arcade games. Each one is built around a real water-science
// mechanic. When the player dies, a real info card pops up explaining what
// they just experienced in the game (so they actually LEARN, not just play).
// All thresholds use CCME aquatic-life — no drinking-water references (compliance).

// ───────────────────────────────────────────────────────────────────────────────
// pH Panic — sort falling pH samples into Acid / Aquatic-Life-OK / Base bands
// (matches the CCME freshwater aquatic-life range 6.5–9.0 from waterParams.js)
// ───────────────────────────────────────────────────────────────────────────────

const PH_Q = [
  { ph: 2.1, cat: 'acid', lbl: 'Acid mine drainage', why: 'Sulphide minerals oxidising in tailings produce sulphuric acid — lethal to almost all aquatic life.' },
  { ph: 3.7, cat: 'acid', lbl: 'Acid rain pulse',     why: 'SO₂ + NOₓ from smelters and vehicles return as acid precipitation. Snowmelt delivers a spring acid pulse.' },
  { ph: 4.5, cat: 'acid', lbl: 'Peat bog water',      why: 'Tannic acids from sphagnum moss naturally drop pH — fine for bog species, hostile to brook trout.' },
  { ph: 5.8, cat: 'acid', lbl: 'Soft Ontario wetland', why: 'Granite-shield runoff has little buffering capacity — small acid inputs swing pH fast.' },
  { ph: 6.0, cat: 'acid', lbl: 'CO₂-rich stream',     why: 'Decomposing organic matter releases CO₂ which forms carbonic acid, dropping pH.' },
  { ph: 6.3, cat: 'acid', lbl: 'Below CCME aquatic',  why: 'Fish eggs start failing; aluminium leaches off sediments and clogs gills.' },
  { ph: 6.5, cat: 'safe', lbl: 'CCME lower bound',    why: 'Bottom of the CCME freshwater aquatic-life band — mayfly larvae return.' },
  { ph: 6.8, cat: 'safe', lbl: 'Northern stream',     why: 'Typical Canadian Shield stream — soft water, lightly buffered.' },
  { ph: 7.0, cat: 'safe', lbl: 'Pure water',          why: 'Distilled water sits at neutral 7.0 — most fish thrive here.' },
  { ph: 7.2, cat: 'safe', lbl: 'Healthy lake mid',    why: 'Trout, walleye, mussels — all happy in this band.' },
  { ph: 7.5, cat: 'safe', lbl: 'Aquatic-life sweet spot', why: 'Best DO solubility + lowest ammonia toxicity.' },
  { ph: 7.8, cat: 'safe', lbl: 'Lake Superior surface', why: 'Carbonate buffering keeps the big lake stable around pH 7.7–8.0.' },
  { ph: 8.1, cat: 'safe', lbl: 'Great Lakes average', why: 'Limestone bedrock + plankton respiration push pH slightly basic.' },
  { ph: 8.4, cat: 'safe', lbl: 'Healthy lake at noon', why: 'Photosynthesis pulls CO₂ out — pH rises during the day, falls overnight.' },
  { ph: 8.9, cat: 'safe', lbl: 'CCME upper bound',    why: 'Just inside the CCME 6.5–9.0 freshwater aquatic-life band.' },
  { ph: 9.2, cat: 'base', lbl: 'Algae bloom peak',    why: 'Cyanobacteria bloom strips so much CO₂ that pH spikes — ammonia becomes toxic to fish.' },
  { ph: 9.8, cat: 'base', lbl: 'Industrial effluent', why: 'Lye/cement runoff. Mussel shells start dissolving in reverse — calcium balance breaks.' },
  { ph: 11.0, cat: 'base', lbl: 'Bleach dilution',    why: 'Lethal to gill tissue. No native species tolerates this band.' },
  { ph: 12.5, cat: 'base', lbl: 'Industrial waste',   why: 'Outside any natural surface-water range — illegal discharge.' },
  { ph: 13.2, cat: 'base', lbl: 'Chemical plant discharge', why: 'Caustic — instant tissue damage to any aquatic organism.' },
]
const PH_COL = { acid: '#ef4444', safe: '#22c55e', base: '#3b82f6' }
const PH_LBL = { acid: '🔴 ACID  (< 6.5)', safe: '🟢 AQUATIC-LIFE OK  (6.5–9.0)', base: '🔵 BASE  (> 9.0)' }
const TIME_LVL = [12000, 9000, 6500, 5000, 3500]

// On-death info card — shown when player runs out of lives.
// Uses real PARAM_META content from waterParams.js — same source as the Map deep-dive.
function DeathInfo({ paramKey, headline, body, onPlayAgain, onExit }) {
  const meta = PARAM_META[paramKey]
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.78)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 520, width: '100%', background: '#0f172a', borderRadius: 18, border: '1px solid #334155', boxShadow: '0 30px 60px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', padding: '18px 22px', color: '#fff' }}>
          <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.85, textTransform: 'uppercase' }}>Game Over · Real Water Science</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{headline}</div>
        </div>
        <div style={{ padding: '18px 22px', color: '#e2e8f0' }}>
          <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>{body}</p>
          {meta && (
            <div style={{ marginTop: 14, padding: 12, background: '#1e293b', borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Why it matters · {meta.label}</div>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: '#cbd5e1', margin: '6px 0 0' }}>{meta.mechanism}</p>
              <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none' }}>
                {meta.impacts.map((it) => (
                  <li key={it.group} style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 4 }}>
                    <strong style={{ color: '#7dd3fc' }}>{it.group}:</strong> {it.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ marginTop: 14, fontSize: 11, color: '#64748b' }}>
            All thresholds shown are CCME freshwater aquatic-life references — surface water only, never drinking water.
          </div>
        </div>
        <div style={{ padding: 14, display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#0b1224', borderTop: '1px solid #1e293b' }}>
          <button onClick={onExit} style={{ padding: '8px 14px', borderRadius: 10, background: 'transparent', color: '#cbd5e1', border: '1px solid #334155', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Back to Games</button>
          <button onClick={onPlayAgain} style={{ padding: '8px 14px', borderRadius: 10, background: '#22c55e', color: '#0b1224', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>Play Again</button>
        </div>
      </div>
    </div>
  )
}

function PHPanic({ onComplete }) {
  const { play } = useSound()
  const [qIdx, setQIdx] = useState(() => Math.floor(Math.random() * PH_Q.length))
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [lives, setLives] = useState(5)
  const [level, setLevel] = useState(1)
  const [timeLeft, setTimeLeft] = useState(8000)
  const [fb, setFb] = useState(null)
  const [done, setDone] = useState(false)
  const [nCorrect, setNCorrect] = useState(0)
  const [deathReason, setDeathReason] = useState(null) // {headline, body}
  const scoreR = useRef(0), comboR = useRef(0), livesR = useRef(5), levelR = useRef(1), startR = useRef(Date.now()), phaseR = useRef('q')

  const next = useCallback(() => {
    setQIdx(Math.floor(Math.random() * PH_Q.length))
    const lim = TIME_LVL[Math.min(levelR.current - 1, TIME_LVL.length - 1)]
    setTimeLeft(lim); startR.current = Date.now(); phaseR.current = 'q'
  }, [])

  const finish = useCallback((reason) => {
    setDone(true)
    setDeathReason(reason)
  }, [])

  useEffect(() => {
    if (done || phaseR.current !== 'q') return
    const iv = setInterval(() => {
      if (phaseR.current !== 'q') { clearInterval(iv); return }
      const lim = TIME_LVL[Math.min(levelR.current - 1, TIME_LVL.length - 1)]
      const rem = Math.max(0, lim - (Date.now() - startR.current))
      setTimeLeft(rem)
      if (rem <= 0) {
        clearInterval(iv); phaseR.current = 'fb'
        comboR.current = 0; setCombo(0); livesR.current--; setLives(livesR.current); play('wrong')
        setFb({ ok: false, msg: '⏱️ Too slow!' })
        if (livesR.current <= 0) {
          setTimeout(() => finish({
            headline: 'Time ran out — pH shifts move fast in real lakes too',
            body: 'A bloom-driven pH spike can rise 2 full units in an afternoon. Field crews need to react quickly because aquatic life can\'t wait for the next sampling visit.',
          }), 900)
        } else setTimeout(() => { setFb(null); next() }, 950)
      }
    }, 50)
    return () => clearInterval(iv)
  }, [qIdx, done, next, finish, play])

  const answer = (cat) => {
    if (phaseR.current !== 'q' || done) return
    phaseR.current = 'fb'
    const q = PH_Q[qIdx], ok = cat === q.cat
    if (ok) {
      comboR.current++; setCombo(comboR.current)
      const mult = Math.min(comboR.current, 5)
      const pts = 10 * mult; scoreR.current += pts; setScore(scoreR.current)
      setNCorrect(c => c + 1)
      const newLvl = Math.min(Math.floor(scoreR.current / 80) + 1, 5)
      if (newLvl > levelR.current) { levelR.current = newLvl; setLevel(newLvl) }
      play('correct')
      const elapsed = Date.now() - startR.current
      const lim = TIME_LVL[Math.min(levelR.current - 1, TIME_LVL.length - 1)]
      setFb({ ok: true, msg: `+${pts}${mult > 1 ? ` (×${mult} combo!)` : ''}` + (elapsed < lim * 0.38 ? ' ⚡ FAST!' : ''), why: q.why })
    } else {
      comboR.current = 0; setCombo(0); livesR.current--; setLives(livesR.current); play('wrong')
      setFb({ ok: false, msg: `pH ${q.ph} is → ${PH_LBL[q.cat]}`, why: q.why })
    }
    if (livesR.current <= 0) {
      const reason = ok
        ? { headline: 'You ran out of buffer', body: `${q.lbl} (pH ${q.ph}) was the last sample. The CCME freshwater aquatic-life band is 6.5–9.0 — outside that, fish eggs fail, mayfly larvae die, and aluminium leaches off sediment.` }
        : { headline: `Misclassified pH ${q.ph} — ${q.lbl}`, body: q.why }
      setTimeout(() => finish(reason), 1100)
      return
    }
    setTimeout(() => { setFb(null); next() }, ok ? 800 : 1300)
  }

  const restart = () => {
    scoreR.current = 0; comboR.current = 0; livesR.current = 5; levelR.current = 1
    setScore(0); setCombo(0); setLives(5); setLevel(1); setNCorrect(0)
    setDone(false); setDeathReason(null); setFb(null); next()
  }

  const q = PH_Q[qIdx]
  const pct = (q.ph / 14) * 100
  const hue = pct < 46 ? 0 : pct > 64 ? 240 : 120
  const lim = TIME_LVL[Math.min(level - 1, TIME_LVL.length - 1)]
  const tFrac = timeLeft / lim

  if (done) return (
    <>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: 64, marginBottom: 10 }}>⚗️</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>pH Panic — Complete!</div>
        <div style={{ fontSize: 22, color: '#f59e0b', fontWeight: 800, marginBottom: 6 }}>Score: {scoreR.current}</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Correct: {nCorrect} · Level reached: {level}</div>
      </div>
      {deathReason && (
        <DeathInfo
          paramKey="ph"
          headline={deathReason.headline}
          body={deathReason.body}
          onPlayAgain={restart}
          onExit={() => onComplete(scoreR.current)}
        />
      )}
    </>
  )

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 19, color: 'var(--text)' }}>{score}<span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3 }}>pts</span></span>
          {combo > 1 && <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b40', padding: '2px 8px', borderRadius: 20 }}>🔥 ×{Math.min(combo, 5)}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>LV.{level}</span>
          <span style={{ fontSize: 16 }}>{'❤️'.repeat(Math.max(0, lives))}</span>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${tFrac * 100}%`, background: tFrac > 0.4 ? '#22c55e' : tFrac > 0.2 ? '#f59e0b' : '#ef4444', transition: 'background 0.3s,width 0.05s linear' }} />
      </div>
      <div style={{ borderRadius: 16, padding: '20px 24px', textAlign: 'center', marginBottom: 14, background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 6 }}>{q.lbl}</div>
        <div style={{ fontSize: 68, fontWeight: 900, lineHeight: 1, color: `hsl(${hue},65%,${hue === 120 ? '36%' : '46%'})`, marginBottom: 10 }}>pH {q.ph}</div>
        <div style={{ position: 'relative', height: 12, borderRadius: 6, marginBottom: 4, overflow: 'hidden', background: 'linear-gradient(to right,#ef4444,#f97316,#eab308,#22c55e,#22c55e,#3b82f6,#6366f1)' }}>
          <div style={{ position: 'absolute', top: 1, bottom: 1, width: 3, borderRadius: 2, background: 'white', boxShadow: '0 0 4px rgba(0,0,0,0.5)', left: `calc(${pct}% - 1.5px)`, transition: 'left 0.2s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)' }}>
          <span>0 — Acid</span><span>7 — Neutral</span><span>14 — Base</span>
        </div>
      </div>
      {fb && (
        <div style={{ textAlign: 'center', padding: '10px 12px', borderRadius: 12, marginBottom: 12, fontSize: 13, fontWeight: 700, background: fb.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)', color: fb.ok ? '#22c55e' : '#ef4444', border: `1px solid ${fb.ok ? '#22c55e30' : '#ef444430'}` }}>
          {fb.ok ? '✅' : '❌'} {fb.msg}
          {fb.why && <div style={{ marginTop: 6, fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1.4 }}>{fb.why}</div>}
        </div>
      )}
      {!fb && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {['acid', 'safe', 'base'].map(cat => (
          <button key={cat} onClick={() => answer(cat)} style={{ padding: '14px 4px', borderRadius: 14, fontWeight: 800, fontSize: 11, cursor: 'pointer', border: `2px solid ${PH_COL[cat]}`, background: `${PH_COL[cat]}18`, color: PH_COL[cat], transition: 'all 0.1s', letterSpacing: '0.03em', textAlign: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = `${PH_COL[cat]}30`; e.currentTarget.style.transform = 'scale(1.05)' }}
            onMouseLeave={e => { e.currentTarget.style.background = `${PH_COL[cat]}18`; e.currentTarget.style.transform = 'scale(1)' }}>
            {PH_LBL[cat]}
          </button>
        ))}
      </div>}
      <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: 'var(--text-muted)' }}>Level {level} · {lim / 1000}s per answer · combo multiplies points!</div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// Watershed Defender — 2D Canvas arcade.
// You guard a lake at the bottom of the screen. Pollution payloads fall from
// upstream sources (manure, road salt, sewage, fertiliser, sediment). Drag
// vegetated buffer strips into their path to absorb them. If three payloads
// reach the lake your watershed dies — and you learn what the real fix is.
// ───────────────────────────────────────────────────────────────────────────────

const SOURCES = [
  { id: 'salt', emoji: '🧂', label: 'Road salt',         param: 'conductivity',     why: 'Winter NaCl runs off paved roads into ditches every spring melt. Chloride is conservative — it doesn\'t break down.' },
  { id: 'fert', emoji: '🌾', label: 'Phosphorus runoff', param: 'dissolved_oxygen', why: 'Fertiliser runoff feeds algae blooms. Bacteria decomposing the bloom strip oxygen — fish kill follows.' },
  { id: 'manure', emoji: '💩', label: 'Manure runoff',   param: 'dissolved_oxygen', why: 'Livestock waste = high BOD. Bacteria consume DO digesting it; downstream fish suffocate.' },
  { id: 'sed', emoji: '🟫', label: 'Sediment plume',     param: 'turbidity',        why: 'Construction + bare slope erosion. High NTU smothers spawning gravel and clogs gill filaments.' },
  { id: 'mine', emoji: '⛏️', label: 'Mine drainage',     param: 'ph',               why: 'Sulphide tailings + water = sulphuric acid. Drops pH below 4 — kills almost everything.' },
  { id: 'sew', emoji: '🚽', label: 'Sewage overflow',    param: 'dissolved_oxygen', why: 'Combined-sewer overflows after rain dump organic + nutrient load. Dead zones form within hours.' },
]

const BUFFER_TYPES = [
  { id: 'forest', label: 'Forest buffer', cost: 1, color: '#16a34a', stops: ['fert', 'manure', 'sed', 'sew'] },
  { id: 'wetland', label: 'Wetland',      cost: 2, color: '#0891b2', stops: ['fert', 'manure', 'sed', 'sew', 'mine'] },
  { id: 'grass',  label: 'Grass strip',   cost: 1, color: '#84cc16', stops: ['sed', 'salt'] },
]

function WatershedDefender({ onComplete }) {
  const { play } = useSound()
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const [hud, setHud] = useState({ score: 0, lives: 3, level: 1, budget: 8, blocked: 0 })
  const [selectedBuffer, setSelectedBuffer] = useState('forest')
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState(false)
  const [deathReason, setDeathReason] = useState(null)
  const selectedBufferRef = useRef('forest')
  useEffect(() => { selectedBufferRef.current = selectedBuffer }, [selectedBuffer])

  const W = 560, H = 600
  const LAKE_Y = H - 70

  const reset = useCallback(() => {
    stateRef.current = {
      payloads: [],     // {x,y,vy,src}
      buffers: [],      // {x,y,r,type}
      spawnCd: 60,
      level: 1,
      score: 0,
      lives: 3,
      blocked: 0,
      budget: 8,        // buffer placement budget — refilled each level
    }
    setHud({ score: 0, lives: 3, level: 1, budget: 8, blocked: 0 })
    setDone(false); setDeathReason(null); setPaused(false)
  }, [])

  useEffect(() => { reset() }, [reset])

  // Main game loop
  useEffect(() => {
    if (done || paused) return
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    let raf = 0
    let lastSync = 0

    const step = (now) => {
      const s = stateRef.current
      if (!s) return

      // Spawn payloads
      s.spawnCd--
      if (s.spawnCd <= 0) {
        const src = SOURCES[Math.floor(Math.random() * SOURCES.length)]
        s.payloads.push({
          x: 30 + Math.random() * (W - 60),
          y: -20,
          vy: 1.2 + Math.random() * 0.8 + s.level * 0.18,
          src,
        })
        s.spawnCd = Math.max(20, 80 - s.level * 8)
      }

      // Move payloads + collide with buffers + lake
      const remaining = []
      for (const p of s.payloads) {
        p.y += p.vy

        // Buffer absorption
        let absorbed = false
        for (const b of s.buffers) {
          const dx = p.x - b.x, dy = p.y - b.y
          if (dx * dx + dy * dy < b.r * b.r) {
            const stops = BUFFER_TYPES.find((t) => t.id === b.type)?.stops || []
            if (stops.includes(p.src.id)) {
              s.score += 10
              s.blocked++
              absorbed = true
              play('correct')
              break
            }
          }
        }
        if (absorbed) continue

        // Hit the lake
        if (p.y >= LAKE_Y) {
          s.lives--
          play('wrong')
          if (s.lives <= 0) {
            setDeathReason({
              src: p.src,
              headline: `${p.src.label} reached the lake — watershed collapsed`,
              body: `${p.src.why}\n\nReal-world fix: vegetated buffer strips, wetland reconstruction, road-salt source-control plans, or stormwater retention ponds — depending on the source.`,
            })
            setDone(true)
            setHud((h) => ({ ...h, lives: 0 }))
            cancelAnimationFrame(raf)
            return
          }
          continue
        }

        remaining.push(p)
      }
      s.payloads = remaining

      // ── Render ─────────────────────────────────────────────
      ctx.fillStyle = '#082f49'
      ctx.fillRect(0, 0, W, H)

      // Sky band
      ctx.fillStyle = '#0c4a6e'
      ctx.fillRect(0, 0, W, 80)

      // Lake (the thing you're protecting)
      const lakeGrad = ctx.createLinearGradient(0, LAKE_Y, 0, H)
      lakeGrad.addColorStop(0, '#0ea5e9')
      lakeGrad.addColorStop(1, '#0369a1')
      ctx.fillStyle = lakeGrad
      ctx.fillRect(0, LAKE_Y, W, H - LAKE_Y)
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = 'bold 12px system-ui'
      ctx.fillText('🏞️ Your watershed', 12, LAKE_Y + 18)

      // Buffers
      for (const b of s.buffers) {
        const t = BUFFER_TYPES.find((x) => x.id === b.type)
        ctx.fillStyle = t.color + '55'
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = t.color; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'
        ctx.fillText(t.label, b.x, b.y + 4)
        ctx.textAlign = 'left'
      }

      // Payloads
      for (const p of s.payloads) {
        ctx.font = '24px system-ui'
        ctx.fillText(p.src.emoji, p.x - 12, p.y + 8)
      }

      // Level promotion
      if (s.score > s.level * 120) {
        s.level++
        s.budget += 4
        play('levelUp')
      }

      // HUD sync (throttle)
      if (now - lastSync > 120) {
        lastSync = now
        setHud({ score: s.score, lives: s.lives, level: s.level, budget: s.budget, blocked: s.blocked })
      }

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [done, paused, play])

  const onCanvasClick = (e) => {
    if (done || paused) return
    const s = stateRef.current
    if (!s) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (W / rect.width)
    const y = (e.clientY - rect.top) * (H / rect.height)
    if (y > LAKE_Y - 12) return // can't place inside lake
    const t = BUFFER_TYPES.find((x) => x.id === selectedBufferRef.current)
    if (s.budget < t.cost) { play('wrong'); return }
    s.buffers.push({ x, y, r: t.id === 'wetland' ? 48 : 36, type: t.id })
    s.budget -= t.cost
    play('drop')
    setHud((h) => ({ ...h, budget: s.budget }))
  }

  const finish = () => onComplete(hud.score)

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 12, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          <span>Score: <span style={{ color: '#22c55e' }}>{hud.score}</span></span>
          <span>Level: <span style={{ color: '#fbbf24' }}>{hud.level}</span></span>
          <span>Blocked: {hud.blocked}</span>
          <span>Budget: <span style={{ color: '#0ea5e9' }}>{hud.budget}</span></span>
          <span>{'❤️'.repeat(Math.max(0, hud.lives))}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {BUFFER_TYPES.map((t) => (
          <button key={t.id} onClick={() => setSelectedBuffer(t.id)}
            style={{
              padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              border: `2px solid ${t.color}`, cursor: 'pointer',
              background: selectedBuffer === t.id ? t.color : `${t.color}22`,
              color: selectedBuffer === t.id ? '#fff' : t.color,
            }}>
            {t.label} (cost {t.cost})
          </button>
        ))}
        <button onClick={() => setPaused((p) => !p)} style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={onCanvasClick}
        style={{ width: '100%', maxWidth: W, height: 'auto', border: '1px solid #1e293b', borderRadius: 12, background: '#082f49', cursor: 'crosshair', display: 'block' }}
      />
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        Click upstream of incoming pollution to drop a buffer · forest blocks runoff · wetland blocks almost everything · grass strips trap salt + sediment
      </div>

      {done && deathReason && (
        <DeathInfo
          paramKey={deathReason.src.param}
          headline={deathReason.headline}
          body={deathReason.body}
          onPlayAgain={reset}
          onExit={finish}
        />
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// Oxygen Dive — 2D Canvas arcade.
// You're a brook trout. Surface water is warm and oxygen-poor in summer. Cold,
// well-oxygenated refugia exist near deep cold-water inflows. Stay alive by
// finding cold seeps before your DO meter hits zero. Predators and warm plumes
// hunt you. When you suffocate the info card explains the real DO/temperature
// physics.
// ───────────────────────────────────────────────────────────────────────────────

function OxygenDive({ onComplete }) {
  const { play } = useSound()
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef({ left: false, right: false, up: false, down: false })
  const [hud, setHud] = useState({ score: 0, doMg: 8, depth: 0, level: 1, lives: 3 })
  const [done, setDone] = useState(false)
  const [deathReason, setDeathReason] = useState(null)

  const W = 560, H = 600

  const reset = useCallback(() => {
    stateRef.current = {
      fish: { x: W / 2, y: 90, vx: 0, vy: 0 },
      seeps: [],
      warmPlumes: [],
      predators: [],
      doMg: 8,
      level: 1,
      score: 0,
      lives: 3,
      seepCd: 80,
      plumeCd: 220,
      predCd: 600,
      tick: 0,
    }
    setHud({ score: 0, doMg: 8, depth: 0, level: 1, lives: 3 })
    setDone(false); setDeathReason(null)
  }, [])

  useEffect(() => { reset() }, [reset])

  useEffect(() => {
    const onKey = (e) => {
      const down = e.type === 'keydown'
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keysRef.current.left = down
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keysRef.current.right = down
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keysRef.current.up = down
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keysRef.current.down = down
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey) }
  }, [])

  useEffect(() => {
    if (done) return
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')
    let raf = 0
    let lastSync = 0

    const step = (now) => {
      const s = stateRef.current
      if (!s) return
      s.tick++

      // Move fish
      const k = keysRef.current
      if (k.left) s.fish.vx -= 0.4
      if (k.right) s.fish.vx += 0.4
      if (k.up) s.fish.vy -= 0.4
      if (k.down) s.fish.vy += 0.4
      s.fish.vx *= 0.92; s.fish.vy *= 0.92
      s.fish.x = Math.max(14, Math.min(W - 14, s.fish.x + s.fish.vx))
      s.fish.y = Math.max(40, Math.min(H - 14, s.fish.y + s.fish.vy))

      // Depth-based DO floor — surface water is warmer and holds less DO
      const depth = (s.fish.y - 40) / (H - 60)  // 0..1
      const baseDO = 4 + depth * 4   // 4 mg/L surface → ~8 mg/L at depth (Henry's Law)

      // Drift DO toward base
      s.doMg += (baseDO - s.doMg) * 0.012
      // Burn DO from swimming
      const speed = Math.hypot(s.fish.vx, s.fish.vy)
      s.doMg -= speed * 0.0025

      // Spawn cold seeps
      s.seepCd--
      if (s.seepCd <= 0) {
        s.seeps.push({ x: 30 + Math.random() * (W - 60), y: 100 + Math.random() * (H - 160), r: 28, ttl: 360 })
        s.seepCd = Math.max(60, 140 - s.level * 10)
      }

      // Spawn warm plumes
      s.plumeCd--
      if (s.plumeCd <= 0) {
        s.warmPlumes.push({ x: -40, y: 80 + Math.random() * 160, vx: 1 + s.level * 0.2, r: 32 })
        s.plumeCd = Math.max(120, 240 - s.level * 12)
      }
      s.warmPlumes = s.warmPlumes.map((p) => ({ ...p, x: p.x + p.vx })).filter((p) => p.x < W + 60)

      // Spawn predators (pike) at depth
      s.predCd--
      if (s.predCd <= 0 && s.level >= 2) {
        s.predators.push({ x: -30, y: H - 60 - Math.random() * 200, vx: 1.6 + s.level * 0.3 })
        s.predCd = Math.max(200, 500 - s.level * 25)
      }
      s.predators = s.predators.map((p) => ({ ...p, x: p.x + p.vx })).filter((p) => p.x < W + 60)

      // Seep absorption — restores DO
      s.seeps = s.seeps.map((sp) => {
        sp.ttl--
        const dx = s.fish.x - sp.x, dy = s.fish.y - sp.y
        if (dx * dx + dy * dy < sp.r * sp.r) {
          s.doMg = Math.min(12, s.doMg + 0.18)
          s.score += 1
        }
        return sp
      }).filter((sp) => sp.ttl > 0)

      // Warm plume — drains DO fast
      for (const p of s.warmPlumes) {
        const dx = s.fish.x - p.x, dy = s.fish.y - p.y
        if (dx * dx + dy * dy < p.r * p.r) s.doMg -= 0.04
      }

      // Predator collision
      for (const p of s.predators) {
        const dx = s.fish.x - p.x, dy = s.fish.y - p.y
        if (dx * dx + dy * dy < 28 * 28) {
          s.lives--
          play('wrong')
          s.fish.x = W / 2; s.fish.y = 90
          if (s.lives <= 0) {
            setDeathReason({
              headline: 'Eaten by a pike — warm-water predator expansion',
              body: 'As lakes warm, cold-water species (brook trout, lake trout) lose habitat. Warm-water predators like pike and bass expand their range and out-compete the natives. This is happening in real time across Northern Ontario.',
              paramKey: 'temperature',
            })
            setDone(true)
            cancelAnimationFrame(raf)
            return
          }
        }
      }

      if (s.doMg <= 0) {
        s.doMg = 0
        s.lives--
        play('wrong')
        s.fish.x = W / 2; s.fish.y = H / 2; s.doMg = 4
        if (s.lives <= 0) {
          setDeathReason({
            headline: 'You suffocated — DO crashed to zero',
            body: 'Below 3 mg/L dissolved oxygen, fish suffocate. Warm summer surface water naturally holds less DO (Henry\'s Law: ~8 mg/L at 25 °C vs ~14 mg/L at 0 °C). Algal-bloom decomposition crashes it further. Cold seeps from deep groundwater are the only refuge.',
            paramKey: 'dissolved_oxygen',
          })
          setDone(true)
          cancelAnimationFrame(raf)
          return
        }
      }

      // Level up
      if (s.score > s.level * 60) { s.level++; play('levelUp') }

      // ── Render ─────────────────────────────────────────────
      // Water column gradient — warm surface (red), cold deep (blue)
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#0c4a6e')
      grad.addColorStop(0.4, '#075985')
      grad.addColorStop(1, '#082f49')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      // Surface heat band (warning)
      ctx.fillStyle = 'rgba(239,68,68,0.10)'
      ctx.fillRect(0, 40, W, 90)
      ctx.fillStyle = 'rgba(239,68,68,0.25)'
      ctx.font = 'bold 11px system-ui'
      ctx.fillText('Warm surface — low DO', 10, 56)

      // Cold deep band (refuge)
      ctx.fillStyle = 'rgba(34,197,94,0.10)'
      ctx.fillRect(0, H - 140, W, 140)
      ctx.fillStyle = 'rgba(34,197,94,0.4)'
      ctx.fillText('Cold deep water — high DO', 10, H - 120)

      // Cold seeps
      for (const sp of s.seeps) {
        ctx.fillStyle = `rgba(56,189,248,${0.18 + 0.4 * Math.sin(s.tick * 0.05)})`
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'
        ctx.fillText('❄ cold seep', sp.x, sp.y + 4)
        ctx.textAlign = 'left'
      }

      // Warm plumes
      for (const p of s.warmPlumes) {
        ctx.fillStyle = 'rgba(239,68,68,0.35)'
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'
        ctx.fillText('🔥 warm plume', p.x, p.y + 4)
        ctx.textAlign = 'left'
      }

      // Predators
      for (const p of s.predators) {
        ctx.font = '24px system-ui'
        ctx.fillText('🦈', p.x - 12, p.y + 8)
      }

      // Fish (player)
      ctx.font = '24px system-ui'
      ctx.fillText('🐟', s.fish.x - 12, s.fish.y + 8)

      // DO meter
      const cls = classifyValue('dissolved_oxygen', s.doMg)
      const meterX = W - 26, meterY = 50, meterH = 200
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(meterX, meterY, 16, meterH)
      ctx.fillStyle = cls?.color || '#94a3b8'
      const fillH = (s.doMg / 12) * meterH
      ctx.fillRect(meterX, meterY + meterH - fillH, 16, fillH)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'right'
      ctx.fillText(`${s.doMg.toFixed(1)}`, meterX - 4, meterY + 12)
      ctx.fillText('mg/L', meterX - 4, meterY + 26)
      ctx.textAlign = 'left'

      // HUD sync
      if (now - lastSync > 120) {
        lastSync = now
        setHud({ score: s.score, doMg: Number(s.doMg.toFixed(1)), depth: Math.round(depth * 100), level: s.level, lives: s.lives })
      }

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [done, play])

  const finish = () => onComplete(hud.score)

  return (
    <div style={{ maxWidth: W, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
        <span>Score: <span style={{ color: '#22c55e' }}>{hud.score}</span></span>
        <span>Level: <span style={{ color: '#fbbf24' }}>{hud.level}</span></span>
        <span>DO: <span style={{ color: hud.doMg < 3 ? '#ef4444' : hud.doMg < 5 ? '#f59e0b' : '#22c55e' }}>{hud.doMg} mg/L</span></span>
        <span>Depth: {hud.depth}%</span>
        <span>{'❤️'.repeat(Math.max(0, hud.lives))}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: '100%', maxWidth: W, height: 'auto', border: '1px solid #1e293b', borderRadius: 12, background: '#082f49', display: 'block' }}
      />
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        Arrow keys / WASD to swim · stay deep for cold-seep refuge · avoid warm plumes and pike · DO drops while you sprint
      </div>

      {done && deathReason && (
        <DeathInfo
          paramKey={deathReason.paramKey}
          headline={deathReason.headline}
          body={deathReason.body}
          onPlayAgain={reset}
          onExit={finish}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SONAR SWEEP — Flappy-style boat + sonar pulse trash hunt
═══════════════════════════════════════════════════════════ */

// Each pollution type is a real surface-water contaminant. The on-death info
// card pulls from PARAM_META so the player learns the CCME-tracked parameter
// the trash actually drives. NO drinking-water references (compliance).
const TRASH = [
  { kind: 'microplastic', emoji: '🧴', label: 'Microplastic',  pts: 8,  paramKey: 'turbidity',
    why: 'Plastic fragments under 5mm. Filter-feeders mistake them for food; the particles biomagnify up the food chain and carry adsorbed pollutants with them.' },
  { kind: 'tire',         emoji: '🛞', label: 'Tire fragment', pts: 14, paramKey: 'turbidity',
    why: '6PPD-quinone — a tire-rubber additive — washes into urban streams and kills coho salmon at parts-per-trillion concentrations. One of the largest aquatic toxicity discoveries of the decade.' },
  { kind: 'net',          emoji: '🕸️', label: 'Ghost net',     pts: 18, paramKey: 'turbidity',
    why: 'Lost or abandoned fishing nets keep trapping fish, turtles, and birds for years. The Great Lakes have an estimated 100+ tonnes of ghost gear at any time.' },
  { kind: 'phosphorus',   emoji: '🟢', label: 'Phosphorus blob', pts: 10, paramKey: 'dissolved_oxygen',
    why: 'Phosphorus from fertilizer and detergent runoff fuels algae blooms. When the bloom dies and decomposes, oxygen crashes — the dead-zone mechanism behind Lake Erie summer hypoxia.' },
  { kind: 'salt',         emoji: '🧂', label: 'Road salt plume', pts: 12, paramKey: 'conductivity',
    why: 'Winter de-icing salt runs straight into streams. Chloride above ~120 mg/L harms freshwater invertebrates; many Northern Ontario urban creeks now exceed this year-round.' },
  { kind: 'oil',          emoji: '🛢️', label: 'Oil sheen',      pts: 16, paramKey: 'dissolved_oxygen',
    why: 'A thin oil film blocks atmospheric oxygen exchange — DO drops underneath, and PAH compounds in the oil are toxic to fish embryos.' },
]

const INVASIVES = [
  { kind: 'lamprey',   emoji: '🪱', label: 'Sea lamprey',
    why: 'Sea lamprey invaded the upper Great Lakes through the Welland Canal. They latch onto lake trout and bleed them out — a single lamprey can kill ~18 kg of fish in its lifetime.' },
  { kind: 'carp',      emoji: '🐠', label: 'Asian carp',
    why: 'Silver and bighead carp out-eat native species and have been moving toward the Great Lakes for decades. They can leap 3 m out of the water when startled.' },
  { kind: 'zebra',     emoji: '🐚', label: 'Zebra mussel cluster',
    why: 'A single female releases up to a million eggs a year. They strip plankton out of the water column, clearing it deceptively — and starving the food web below.' },
]

function SonarSweep({ onComplete }) {
  const { play } = useSound()
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const inputRef = useRef({ thrust: false, ping: false, pingHandled: false })
  const [hud, setHud] = useState({ score: 0, lives: 3, sonarCd: 0, depth: 0, recent: null })
  const [done, setDone] = useState(false)
  const [deathReason, setDeathReason] = useState(null)

  const W = 560, H = 600
  const SURFACE_Y = 220       // waterline
  const FLOOR_Y   = H - 40    // lake bed
  const SONAR_COOL = 90       // frames between pings
  const SONAR_R    = 150      // ping reveal radius

  const reset = useCallback(() => {
    stateRef.current = {
      boat:  { x: 130, y: 180, vy: 0 },
      pulse: { x: 130, y: SURFACE_Y, r: 0, alive: false },
      trash: [],
      inv:   [],
      sonarCd: 0,
      tick: 0,
      score: 0,
      lives: 3,
      level: 1,
      scrollSpeed: 1.6,
      spawnCd: 60,
      invCd: 240,
      recent: null,
      recentTtl: 0,
    }
    setHud({ score: 0, lives: 3, sonarCd: 0, depth: 0, recent: null })
    setDone(false); setDeathReason(null)
  }, [])

  useEffect(() => { reset() }, [reset])

  // Input — keyboard (Space/Up = thrust, S/Down = sonar) + pointer (click thrust)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { inputRef.current.thrust = true; e.preventDefault() }
      if (['ArrowDown', 'KeyS'].includes(e.code))         { inputRef.current.ping = true; inputRef.current.pingHandled = false; e.preventDefault() }
    }
    const onKeyUp = (e) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) inputRef.current.thrust = false
      if (['ArrowDown', 'KeyS'].includes(e.code))         inputRef.current.ping = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [])

  useEffect(() => {
    if (done) return
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')
    let raf = 0, lastSync = 0

    const onPointerDown = (e) => {
      const rect = cv.getBoundingClientRect()
      const y = (e.clientY - rect.top) * (H / rect.height)
      // Tap upper half = thrust, tap lower half = sonar ping
      if (y < SURFACE_Y) inputRef.current.thrust = true
      else { inputRef.current.ping = true; inputRef.current.pingHandled = false }
    }
    const onPointerUp = () => { inputRef.current.thrust = false; inputRef.current.ping = false }
    cv.addEventListener('pointerdown', onPointerDown)
    cv.addEventListener('pointerup', onPointerUp)
    cv.addEventListener('pointerleave', onPointerUp)

    const die = (reason) => {
      setDeathReason(reason); setDone(true); cancelAnimationFrame(raf)
    }

    const step = (now) => {
      const s = stateRef.current
      if (!s) return
      s.tick++

      // Boat physics — Flappy-style: gravity pulls down, thrust pushes up
      const inp = inputRef.current
      s.boat.vy += 0.32                          // gravity
      if (inp.thrust) s.boat.vy -= 0.85          // thrust
      s.boat.vy = Math.max(-6, Math.min(7, s.boat.vy))
      s.boat.y += s.boat.vy
      // Boat lives in the AIR/SURFACE zone — clamp above the waterline minus a hull
      if (s.boat.y < 30) { s.boat.y = 30; s.boat.vy = 0 }
      if (s.boat.y > SURFACE_Y - 6) {
        // Hit the water hard
        s.boat.y = SURFACE_Y - 6; s.boat.vy = 0
        // Soft penalty — every ~2s touching water drains a life via wave damage
        if (s.tick % 90 === 0) {
          s.lives--; play('wrong')
          if (s.lives <= 0) return die({
            headline: 'Capsized — too much surface damage from wave wakes',
            body: 'Even a research boat needs to ride the wakes carefully. Water-quality monitoring relies on stable platforms — sediment kicked up by hull-slamming makes the very turbidity readings you came to take useless.',
            paramKey: 'turbidity',
          })
        }
      }

      // Sonar pulse trigger
      if (inp.ping && !inp.pingHandled && s.sonarCd <= 0) {
        inp.pingHandled = true
        s.pulse = { x: s.boat.x, y: SURFACE_Y, r: 0, alive: true }
        s.sonarCd = SONAR_COOL
        play('bubble')
        // Reveal nearby trash inside SONAR_R
        for (const t of s.trash) {
          const dx = t.x - s.boat.x, dy = t.y - SURFACE_Y
          if (dx * dx + dy * dy < SONAR_R * SONAR_R) t.revealed = true
        }
      }
      if (s.sonarCd > 0) s.sonarCd--

      // Animate pulse
      if (s.pulse.alive) {
        s.pulse.r += 6
        if (s.pulse.r > SONAR_R) s.pulse.alive = false
      }

      // Spawn trash
      s.spawnCd--
      if (s.spawnCd <= 0) {
        const def = TRASH[(Math.random() * TRASH.length) | 0]
        const y = SURFACE_Y + 30 + Math.random() * (FLOOR_Y - SURFACE_Y - 50)
        s.trash.push({ ...def, x: W + 30, y, revealed: false, vx: -s.scrollSpeed, drift: (Math.random() - 0.5) * 0.4 })
        s.spawnCd = Math.max(35, 90 - s.level * 6)
      }

      // Spawn invasive species (jumping out of water — must dodge)
      s.invCd--
      if (s.invCd <= 0) {
        const def = INVASIVES[(Math.random() * INVASIVES.length) | 0]
        // Lampreys/carp jump from surface; zebra mussels stick on the floor
        const fromFloor = def.kind === 'zebra'
        s.inv.push({
          ...def,
          x: W + 20,
          y: fromFloor ? FLOOR_Y - 20 : SURFACE_Y,
          vx: -s.scrollSpeed - 0.4,
          jumping: !fromFloor,
          phase: 0,
          fromFloor,
        })
        s.invCd = Math.max(140, 280 - s.level * 14)
      }

      // Move trash + auto-scoop on hull contact (only revealed trash counts — sonar gates points)
      s.trash = s.trash.map(t => {
        t.x += t.vx
        t.y += t.drift
        if (t.y < SURFACE_Y + 10) t.drift = Math.abs(t.drift)
        if (t.y > FLOOR_Y - 10)   t.drift = -Math.abs(t.drift)
        // Hull-bottom collision (boat sits at boat.y; hull spans ~boat.x±26, y SURFACE_Y±6)
        const hullX0 = s.boat.x - 26, hullX1 = s.boat.x + 26
        const inX = t.x > hullX0 && t.x < hullX1
        const nearSurface = t.y < SURFACE_Y + 28
        if (inX && nearSurface) {
          if (t.revealed) {
            s.score += t.pts
            s.recent = `+${t.pts}  ${t.emoji}  ${t.label}`
            s.recentTtl = 90
            play('coin')
            return null
          }
          // Unrevealed trash gives no points but doesn't penalise — encourages sonar use
        }
        return t
      }).filter(Boolean).filter(t => t.x > -40)

      // Move invasives + collision = lose life with educational popup
      s.inv = s.inv.map(iv => {
        iv.x += iv.vx
        if (iv.jumping) {
          iv.phase += 0.05
          // Arc up out of surface and back down
          iv.y = SURFACE_Y - Math.sin(iv.phase) * 80
          if (iv.phase > Math.PI) iv.jumping = false
        }
        return iv
      }).filter(iv => iv.x > -40)

      // Boat × invasive collision
      for (const iv of s.inv) {
        const dx = iv.x - s.boat.x, dy = iv.y - s.boat.y
        if (dx * dx + dy * dy < 26 * 26) {
          s.lives--
          play('wrong')
          iv.x = -200 // remove
          if (s.lives <= 0) {
            return die({
              headline: `Capsized by ${iv.label}`,
              body: iv.why,
              // Invasives tie to ecosystem disruption — most directly affect DO via food-web shifts
              paramKey: 'dissolved_oxygen',
            })
          }
        }
      }

      // Level up — every 250 pts, scroll faster
      if (s.score > s.level * 250) { s.level++; s.scrollSpeed += 0.3; play('levelUp') }

      // Recent floating notice ttl
      if (s.recentTtl > 0) s.recentTtl--

      // ── Render ─────────────────────────────────────────────
      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, SURFACE_Y)
      sky.addColorStop(0, '#0c4a6e'); sky.addColorStop(1, '#075985')
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, SURFACE_Y)
      // Water
      const water = ctx.createLinearGradient(0, SURFACE_Y, 0, H)
      water.addColorStop(0, '#0e7490'); water.addColorStop(1, '#082f49')
      ctx.fillStyle = water; ctx.fillRect(0, SURFACE_Y, W, H - SURFACE_Y)
      // Wave line
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let x = 0; x <= W; x += 8) {
        const y = SURFACE_Y + Math.sin((x + s.tick * 2) * 0.04) * 2
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
      // Lake floor
      ctx.fillStyle = '#1c1917'
      ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y)

      // Trash — silhouette unless revealed
      for (const t of s.trash) {
        if (t.revealed) {
          ctx.font = '22px system-ui'
          ctx.textAlign = 'center'
          ctx.fillStyle = '#fff'
          ctx.fillText(t.emoji, t.x, t.y + 6)
          ctx.font = 'bold 9px system-ui'
          ctx.fillStyle = '#fde68a'
          ctx.fillText(t.label, t.x, t.y + 22)
        } else {
          // Hidden silhouette — dimmer and questionmarked
          ctx.fillStyle = 'rgba(15,23,42,0.55)'
          ctx.beginPath(); ctx.arc(t.x, t.y, 9, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = 'rgba(148,163,184,0.4)'
          ctx.font = '10px system-ui'; ctx.textAlign = 'center'
          ctx.fillText('?', t.x, t.y + 3)
        }
      }
      ctx.textAlign = 'left'

      // Invasives
      for (const iv of s.inv) {
        ctx.font = '22px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText(iv.emoji, iv.x, iv.y + 6)
        // Warning halo
        ctx.strokeStyle = 'rgba(239,68,68,0.6)'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(iv.x, iv.y, 16, 0, Math.PI * 2); ctx.stroke()
      }
      ctx.textAlign = 'left'

      // Sonar pulse ring
      if (s.pulse.alive) {
        const a = 1 - s.pulse.r / SONAR_R
        ctx.strokeStyle = `rgba(56,189,248,${a * 0.85})`; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(s.pulse.x, s.pulse.y, s.pulse.r, 0, Math.PI * 2); ctx.stroke()
      }

      // Boat hull — simple stylised research vessel
      const bx = s.boat.x, by = s.boat.y
      ctx.fillStyle = '#facc15'
      ctx.beginPath()
      ctx.moveTo(bx - 28, by); ctx.lineTo(bx + 28, by)
      ctx.lineTo(bx + 22, by + 10); ctx.lineTo(bx - 22, by + 10); ctx.closePath()
      ctx.fill()
      // Cabin
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(bx - 10, by - 12, 20, 12)
      // Sonar antenna
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(bx, by - 12); ctx.lineTo(bx, by - 24); ctx.stroke()

      // Sonar cooldown bar (top-left)
      ctx.fillStyle = '#1e293b'; ctx.fillRect(10, 10, 120, 8)
      const ready = 1 - s.sonarCd / SONAR_COOL
      ctx.fillStyle = s.sonarCd === 0 ? '#22c55e' : '#38bdf8'
      ctx.fillRect(10, 10, 120 * ready, 8)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'
      ctx.fillText(s.sonarCd === 0 ? 'SONAR READY (S)' : 'sonar charging…', 10, 30)

      // Recent scoop floating notice
      if (s.recentTtl > 0 && s.recent) {
        ctx.fillStyle = `rgba(34,197,94,${Math.min(1, s.recentTtl / 60)})`
        ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'
        ctx.fillText(s.recent, W / 2, 50)
        ctx.textAlign = 'left'
      }

      // HUD sync
      if (now - lastSync > 120) {
        lastSync = now
        setHud({ score: s.score, lives: s.lives, sonarCd: s.sonarCd, depth: Math.round(((s.boat.y) / SURFACE_Y) * 100), recent: s.recent })
      }

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      cv.removeEventListener('pointerdown', onPointerDown)
      cv.removeEventListener('pointerup', onPointerUp)
      cv.removeEventListener('pointerleave', onPointerUp)
    }
  }, [done, play])

  const finish = () => onComplete(hud.score)

  return (
    <div style={{ maxWidth: W, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
        <span>Score: <span style={{ color: '#22c55e' }}>{hud.score}</span></span>
        <span>Sonar: <span style={{ color: hud.sonarCd === 0 ? '#22c55e' : '#38bdf8' }}>{hud.sonarCd === 0 ? 'READY' : '…'}</span></span>
        <span>{'❤️'.repeat(Math.max(0, hud.lives))}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: '100%', maxWidth: W, height: 'auto', border: '1px solid #1e293b', borderRadius: 12, background: '#082f49', display: 'block', touchAction: 'none' }}
      />
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        SPACE / ↑ = thrust up (don't capsize) · S / ↓ = sonar ping (reveals upcoming trash) · sail over revealed trash to scoop · dodge invasive species · trash you didn't ping is invisible — ping early, ping often.
      </div>

      {done && deathReason && (
        <DeathInfo
          paramKey={deathReason.paramKey}
          headline={deathReason.headline}
          body={deathReason.body}
          onPlayAgain={reset}
          onExit={finish}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   HUB
═══════════════════════════════════════════════════════════ */
const GAMES = [
  { id: 'sonar',  title: 'Sonar Sweep',         emoji: '📡', desc: 'Flappy-style research boat. Ping sonar to reveal pollution under the lake, scoop it on the hull, dodge invasive species. Each scoop teaches a real surface-water contaminant.', points: 'Combo pts', badge: '🌊 ADDICTIVE', component: SonarSweep },
  { id: 'panic',  title: 'pH Panic',           emoji: '⚗️', desc: 'Sort falling pH samples into Acid / Aquatic-Life-OK / Base bands fast. Real CCME thresholds — info card on death.', points: 'Combo pts', badge: '🧪 LEARN', component: PHPanic },
  { id: 'shed',   title: 'Watershed Defender', emoji: '🛡️', desc: 'Pollution drops from upstream — drag forest, wetland, and grass buffers into the path. Lose three and you learn what really fixes it.', points: 'Unlimited', badge: '🌊 ARCADE', component: WatershedDefender },
  { id: 'ox',     title: 'Oxygen Dive',         emoji: '🐟', desc: 'You are a brook trout. Warm surface water is suffocating you — find cold seeps, dodge pike, survive Henry\'s Law.', points: 'Unlimited', badge: '🌌 SURVIVE', component: OxygenDive },
]

export default function Games() {
  const { play } = useSound()
  const [active, setActive] = useState(null)
  const [bests, setBests] = useState(() => { try { return JSON.parse(localStorage.getItem('sw_game_bests') || '{}') } catch { return {} } })
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('sw_game_history') || '[]') } catch { return [] } })
  const [stats, setStats] = useState(false)

  const finish = async (id, score) => {
    play('levelUp')
    const nb = { ...bests, [id]: Math.max(bests[id] || 0, score) }; setBests(nb)
    localStorage.setItem('sw_game_bests', JSON.stringify(nb))
    const nh = [{ gameId: id, score, date: new Date().toISOString() }, ...history].slice(0, 50); setHistory(nh)
    localStorage.setItem('sw_game_history', JSON.stringify(nh))
    await api.post('/leaderboard/game-score', { game_type: id, score }).catch(() => {})
    setActive(null)
  }

  const totalPts = history.reduce((s, h) => s + h.score, 0)
  const topGame = Object.entries(bests).sort((a, b) => b[1] - a[1])[0]

  if (active) {
    const game = GAMES.find(g => g.id === active), GC = game.component
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setActive(null)} className="p-2 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}><ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
          <span className="text-2xl">{game.emoji}</span>
          <h2 className="font-bold text-xl" style={{ color: 'var(--text)' }}>{game.title}</h2>
          {bests[active] !== undefined && <span className="ml-auto text-sm font-bold" style={{ color: '#10b981' }}>🏅 Best: {bests[active]}</span>}
        </div>
        <GC onComplete={s => finish(active, s)} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div style={{ width: 84, height: 112, flexShrink: 0 }}>
            <NibiMascotImage mood="spinning" size={84} />
          </div>
          <div>
            <h1 className="font-bold text-xl" style={{ color: 'var(--text)' }}>Water Learning Games</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>4 addictive arcade games · real CCME aquatic-life science · learn-by-dying info cards</p>
            <p className="text-xs mt-2 max-w-xl" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Each game is built around a real water-science mechanic — when your run ends, an info card explains what just killed you so you actually take something away.
            </p>
          </div>
        </div>
        <button onClick={() => setStats(s => !s)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: stats ? '#6366f1' : 'var(--card-bg)', color: stats ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
          <Trophy className="w-4 h-4" /> My Stats
        </button>
      </div>

      {stats && (
        <div className="card p-5">
          <h3 className="font-bold mb-4" style={{ color: 'var(--text)' }}>My Stats</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[['Games Played', history.length, '🎮'], ['Total Points', totalPts, '⭐'], ['Best Game', topGame ? `${GAMES.find(g => g.id === topGame[0])?.emoji} ${topGame[1]}` : '—', '🏆']].map(([l, v, i]) => (
              <div key={l} className="rounded-xl p-3 text-center" style={{ background: 'var(--page-bg)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{i}</div>
                <div className="font-black text-lg" style={{ color: 'var(--text)' }}>{v}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{l}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {GAMES.map(g => (
              <div key={g.id} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: 'var(--page-bg)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{g.emoji} {g.title}</span>
                <span className="text-sm font-bold" style={{ color: bests[g.id] ? '#10b981' : 'var(--text-muted)' }}>{bests[g.id] !== undefined ? `Best: ${bests[g.id]}` : 'Not played'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAMES.map(game => (
          <div key={game.id} className="card p-5 cursor-pointer group" onClick={() => { play('click'); setActive(game.id) }}
            style={{ transition: 'all 0.18s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
            <div className="flex items-start justify-between mb-3">
              <div className="text-4xl group-hover:scale-110 transition-transform duration-200">{game.emoji}</div>
              {game.badge && <span className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{game.badge}</span>}
            </div>
            <h3 className="font-bold text-base mb-1.5" style={{ color: 'var(--text)' }}>{game.title}</h3>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{game.desc}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(20,184,166,0.1)', color: '#14b8a6' }}>{game.points}</span>
              {bests[game.id] !== undefined ? (
                <span className="text-xs font-bold" style={{ color: '#10b981' }}>🏅 {bests[game.id]}</span>
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Not played</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
