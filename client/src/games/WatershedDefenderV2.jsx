// Watershed Defender V2 — research-grade simulation/strategy variant.
// Renders a hex-grid watershed and runs the watershedSim engine in real time.
//
// World is INSPIRED BY Sault Ste. Marie / Northern Ontario / Great Lakes
// land-use patterns. The simulation does NOT use real measurements — every
// number is procedurally generated. The intervention catalogue, the CCME
// thresholds used for scoring, and the ecology indicators are real.
//
// Component shape: a single self-contained React game wired via Games.jsx.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  createGameState,
  tickGame,
  placeIntervention,
  removeIntervention,
  togglePolicy,
  INTERVENTIONS,
  POLICIES,
  LAND_USE,
  TICKS_PER_YEAR,
  verdictForScore,
} from '../lib/watershedSim/index.js'
import { hexToPixel, hexCorners } from '../lib/watershedSim/terrain.js'
import { seasonOf } from '../lib/watershedSim/hydrology.js'
import { TONE_COLOR } from '../utils/waterParams.js'

// ── Visual constants ───────────────────────────────────────────────────────
const HEX_SIZE = 18                      // radius from centre to vertex (px)
const CANVAS_PAD = 12

const LAND_COLORS = {
  forest:      '#1f3a23',
  riparian:    '#2f6a3e',
  agriculture: '#a4843f',
  urban:       '#4f5b6e',
  industrial:  '#3b3b46',
  wetland:     '#2d6b66',
  lake:        '#0f3b6b',
  stream:      '#1d6fb8',
}
const INTERVENTION_GLYPH = {
  riparian_buffer:     { fill: '#86efac', stroke: '#14532d', label: 'B'  },
  constructed_wetland: { fill: '#5eead4', stroke: '#0f766e', label: 'W'  },
  detention_pond:      { fill: '#7dd3fc', stroke: '#0c4a6e', label: 'P'  },
  cover_crops:         { fill: '#fde68a', stroke: '#92400e', label: 'C'  },
  bioswale:            { fill: '#a7f3d0', stroke: '#065f46', label: 'S'  },
  septic_upgrade:      { fill: '#c4b5fd', stroke: '#4c1d95', label: 'U'  },
}

// CCME band colour for an outlet reading (used in the right rail).
function ccmeColor(kind, value) {
  if (value == null || !Number.isFinite(value)) return TONE_COLOR.unknown
  if (kind === 'pH') {
    if (value < 6.5 || value > 9.0) return TONE_COLOR.critical
    if (value < 6.8 || value > 8.6) return TONE_COLOR.warning
    return TONE_COLOR.safe
  }
  if (kind === 'do') {
    if (value < 4) return TONE_COLOR.critical
    if (value < 6) return TONE_COLOR.warning
    return TONE_COLOR.safe
  }
  if (kind === 'turbidity') {
    if (value > 50) return TONE_COLOR.critical
    if (value > 25) return TONE_COLOR.warning
    return TONE_COLOR.safe
  }
  if (kind === 'conductivity') {
    if (value > 1500) return TONE_COLOR.critical
    if (value > 800) return TONE_COLOR.warning
    return TONE_COLOR.safe
  }
  if (kind === 'toxics') {
    if (value > 1) return TONE_COLOR.critical
    if (value > 0.5) return TONE_COLOR.warning
    return TONE_COLOR.safe
  }
  return TONE_COLOR.unknown
}

function fmt(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—'
  if (Math.abs(v) >= 100) return v.toFixed(0)
  return v.toFixed(digits)
}

function severityColor(s) {
  if (s === 'high')   return '#ef4444'
  if (s === 'medium') return '#f59e0b'
  if (s === 'good')   return '#22c55e'
  if (s === 'critical') return '#dc2626'
  return '#94a3b8'
}

// ── Component ──────────────────────────────────────────────────────────────
export default function WatershedDefenderV2({ onComplete }) {
  // Engine state lives in a ref so requestAnimationFrame can mutate it without
  // stale closures. We bump renderTick to force React re-renders for the HUD.
  const stateRef = useRef(null)
  if (stateRef.current === null) {
    stateRef.current = createGameState({ cols: 22, rows: 16, seed: 42 })
  }
  const [, setRenderTick] = useState(0)
  const forceRender = useCallback(() => setRenderTick(t => (t + 1) | 0), [])

  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  // UI state
  const [paused, setPaused] = useState(true)
  const [speed, setSpeed]   = useState(2)              // ticks per frame
  const [hoverCell, setHoverCell] = useState(null)
  const [selectedIntervention, setSelectedIntervention] = useState(null)
  const [showYearReport, setShowYearReport] = useState(null)
  const [endRun, setEndRun] = useState(null)           // { score, verdict }

  const state = stateRef.current

  // Keep the engine speed reference in sync with React state
  useEffect(() => { state.speed = speed; state.paused = paused }, [speed, paused, state])

  // ── Canvas pixel size based on grid ──────────────────────────────────────
  const { canvasWidth, canvasHeight, cellSize, hexLayout } = useMemo(() => {
    const cols = state.terrain.cols
    const rows = state.terrain.rows
    const size = HEX_SIZE
    const w = size * Math.sqrt(3) * (cols + 0.5) + CANVAS_PAD * 2
    const h = size * 1.5 * (rows + 0.5) + CANVAS_PAD * 2
    // Pre-compute pixel positions of every cell for hit testing + drawing
    const layout = state.terrain.cells.map(cell => {
      const { x, y } = hexToPixel(cell.c, cell.r, size)
      return { c: cell.c, r: cell.r, cx: x + size + CANVAS_PAD, cy: y + size + CANVAS_PAD, cell }
    })
    return { canvasWidth: Math.ceil(w), canvasHeight: Math.ceil(h), cellSize: size, hexLayout: layout }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.terrain.cols, state.terrain.rows])

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    let lastReportCount = state.yearReports.length
    function frame() {
      if (!state.paused && !endRun) {
        const ticksThisFrame = Math.max(1, state.speed)
        for (let i = 0; i < ticksThisFrame; i++) tickGame(state)
        // Year-end card trigger
        if (state.yearReports.length > lastReportCount) {
          lastReportCount = state.yearReports.length
          const latest = state.yearReports[state.yearReports.length - 1]
          setShowYearReport(latest)
          setPaused(true)
        }
        // End-of-run trigger after 5 simulated years
        if (state.year >= 5 && !endRun) {
          const cumulative = state.yearReports.length
            ? Math.round(state.yearReports.reduce((s, r) => s + r.score, 0) / state.yearReports.length)
            : 0
          setEndRun({ score: cumulative, verdict: verdictForScore(cumulative) })
          setPaused(true)
        }
      }
      drawScene()
      forceRender()
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endRun])

  // ── Drawing ───────────────────────────────────────────────────────────────
  function drawScene() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    // Background
    ctx.fillStyle = '#0b1224'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Lake algae tint pulled from current bloom level
    const algaeT = Math.min(1, Math.max(0, (state.lake.algae - 1) / 9))   // 0..1
    const lakeFill = blend('#0f3b6b', '#3a7e3a', algaeT * 0.85)

    // Hexes
    for (const h of hexLayout) {
      const { cx, cy, cell } = h
      const corners = hexCorners(cx, cy, cellSize)
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const p = corners[i]
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.closePath()

      let fill = LAND_COLORS[cell.landUse] || '#222'
      if (cell.landUse === LAND_USE.LAKE) fill = lakeFill
      ctx.fillStyle = fill
      ctx.fill()

      // Stream highlight: thicker blue stroke
      if (cell.isStream) {
        ctx.lineWidth = 1.4
        ctx.strokeStyle = '#60a5fa'
      } else {
        ctx.lineWidth = 0.6
        ctx.strokeStyle = '#0b1224'
      }
      ctx.stroke()

      // Intervention overlay
      if (cell.intervention) {
        const g = INTERVENTION_GLYPH[cell.intervention]
        if (g) {
          ctx.beginPath()
          ctx.arc(cx, cy, cellSize * 0.42, 0, Math.PI * 2)
          ctx.fillStyle = g.fill
          ctx.fill()
          ctx.lineWidth = 1.4
          ctx.strokeStyle = g.stroke
          ctx.stroke()
          ctx.fillStyle = g.stroke
          ctx.font = 'bold 11px ui-monospace, monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(g.label, cx, cy + 0.5)
        }
      }
    }

    // Hover + placement preview
    if (hoverCell) {
      const h = hexLayout[hoverCell.r * state.terrain.cols + hoverCell.c]
      if (h) {
        const corners = hexCorners(h.cx, h.cy, cellSize)
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const p = corners[i]
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
        }
        ctx.closePath()
        ctx.lineWidth = 2.2
        if (selectedIntervention) {
          const def = INTERVENTIONS[selectedIntervention]
          const check = def.canPlace(h.cell, state.terrain)
          ctx.strokeStyle = check.ok ? '#34d399' : '#f87171'
        } else {
          ctx.strokeStyle = '#fbbf24'
        }
        ctx.stroke()
      }
    }

    // Outlet marker
    if (state.terrain.outletCell) {
      const oc = state.terrain.outletCell
      const layout = hexLayout[oc.r * state.terrain.cols + oc.c]
      if (layout) {
        ctx.beginPath()
        ctx.arc(layout.cx, layout.cy, cellSize * 0.55, 0, Math.PI * 2)
        ctx.lineWidth = 2
        ctx.strokeStyle = '#fde047'
        ctx.stroke()
        ctx.fillStyle = '#fde047'
        ctx.font = 'bold 9px ui-sans-serif, system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('OUTLET', layout.cx, layout.cy - cellSize * 0.7)
      }
    }

    // Storm pulse ring overlay if a storm is currently rolling
    if (state.weather?.event?.kind === 'storm') {
      ctx.lineWidth = 2
      ctx.strokeStyle = `rgba(125,211,252,${0.25 + 0.45 * Math.abs(Math.sin(performance.now() / 220))})`
      ctx.strokeRect(2, 2, canvasWidth - 4, canvasHeight - 4)
    }
  }

  function blend(hex1, hex2, t) {
    const a = parseHex(hex1), b = parseHex(hex2)
    const r = Math.round(a.r + (b.r - a.r) * t)
    const g = Math.round(a.g + (b.g - a.g) * t)
    const bl = Math.round(a.b + (b.b - a.b) * t)
    return `rgb(${r},${g},${bl})`
  }
  function parseHex(h) {
    const s = h.replace('#', '')
    return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) }
  }

  // ── Mouse handling ────────────────────────────────────────────────────────
  function pointToCell(px, py) {
    // Brute-force nearest-hex test — grid is small (~350 cells) so it's fine.
    let best = null, bestDist = Infinity
    for (const h of hexLayout) {
      const dx = px - h.cx, dy = py - h.cy
      const d2 = dx * dx + dy * dy
      if (d2 < bestDist) { bestDist = d2; best = h }
    }
    if (!best) return null
    if (bestDist > (cellSize * 1.05) * (cellSize * 1.05)) return null
    return { c: best.cell.c, r: best.cell.r }
  }

  function onCanvasMove(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) * (canvasWidth / rect.width)
    const py = (e.clientY - rect.top) * (canvasHeight / rect.height)
    setHoverCell(pointToCell(px, py))
  }
  function onCanvasLeave() { setHoverCell(null) }

  function onCanvasClick(e) {
    if (endRun) return
    const rect = canvasRef.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) * (canvasWidth / rect.width)
    const py = (e.clientY - rect.top) * (canvasHeight / rect.height)
    const hit = pointToCell(px, py)
    if (!hit) return
    const cell = state.terrain.cells[hit.r * state.terrain.cols + hit.c]
    if (e.shiftKey && cell.intervention) {
      removeIntervention(state, cell)
      forceRender()
      return
    }
    if (!selectedIntervention) return
    const result = placeIntervention(state, cell, selectedIntervention)
    if (!result.ok) {
      // surface inline message — quick toast via events log
      state.events.push({ tick: state.tick, kind: 'placement_blocked',
        msg: `Cannot place ${INTERVENTIONS[selectedIntervention].name}: ${result.reason}`,
        severity: 'medium' })
    }
    forceRender()
  }

  // ── HUD derived values ────────────────────────────────────────────────────
  const season = seasonOf(state.tick)
  const dayInYear = state.tick % TICKS_PER_YEAR
  const events = state.events.slice(-30).slice().reverse()    // newest first

  // Hovered cell description
  const hoveredCell = hoverCell ? state.terrain.cells[hoverCell.r * state.terrain.cols + hoverCell.c] : null

  function handleResetRun() {
    stateRef.current = createGameState({ cols: 22, rows: 16, seed: (Math.random() * 1e9) | 0 })
    setEndRun(null)
    setShowYearReport(null)
    setSelectedIntervention(null)
    setPaused(true)
    setSpeed(2)
    forceRender()
  }

  function handleEndAndReport() {
    if (onComplete) onComplete(endRun?.score ?? 0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Top HUD */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '10px 12px',
      }}>
        <Pill label="Year" value={`${state.year + 1}`} sub={`${season} · day ${dayInYear + 1}/${TICKS_PER_YEAR}`} />
        <Pill label="Budget" value={`$${state.budget.toFixed(0)}`} sub="annual + carry-over" tone={state.budget < 100 ? 'critical' : state.budget < 300 ? 'warning' : 'safe'} />
        <Pill label="Public trust" value={`${Math.round(state.publicTrust)}%`} tone={state.publicTrust < 30 ? 'critical' : state.publicTrust < 55 ? 'warning' : 'safe'} />
        <Pill label="Trout" value={Math.round(state.eco.trout)} tone={state.eco.trout < 20 ? 'critical' : state.eco.trout < 50 ? 'warning' : 'safe'} />
        <Pill label="Mayfly" value={Math.round(state.eco.mayfly)} tone={state.eco.mayfly < 20 ? 'critical' : state.eco.mayfly < 50 ? 'warning' : 'safe'} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setPaused(p => !p)}
            style={btnStyle(paused ? '#22c55e' : '#0ea5e9')}>{paused ? '▶ Run' : '⏸ Pause'}</button>
          {[1, 2, 4, 8].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              style={{ ...btnStyle(speed === s ? '#6366f1' : '#1f2a44'), padding: '6px 10px' }}>{s}×</button>
          ))}
          <button onClick={handleResetRun} style={btnStyle('#475569')}>↻ New map</button>
        </div>
      </div>

      {/* Main grid: canvas + right rail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 12 }}>
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 10, overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            onMouseMove={onCanvasMove}
            onMouseLeave={onCanvasLeave}
            onClick={onCanvasClick}
            style={{ display: 'block', width: '100%', height: 'auto', cursor: selectedIntervention ? 'crosshair' : 'pointer', borderRadius: 8 }}
          />
          <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <span>Hover for details · Click to place selected intervention · <kbd style={kbdStyle}>Shift</kbd>+Click to remove</span>
          </div>
        </div>

        {/* Right rail: outlet WQ + hovered cell info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={panelStyle}>
            <h4 style={panelTitleStyle}>Outlet readings (CCME aquatic life)</h4>
            <ReadingRow label="pH"         value={state.outlet?.pH}         unit=""       kind="pH" />
            <ReadingRow label="DO"         value={state.outlet?.do}         unit="mg/L"   kind="do" />
            <ReadingRow label="Turbidity"  value={state.outlet?.turbidity}  unit="NTU"    kind="turbidity" />
            <ReadingRow label="Conductivity" value={state.outlet?.conductivity} unit="µS/cm" kind="conductivity" />
            <ReadingRow label="Toxics idx" value={state.outlet?.toxics}     unit=""       kind="toxics" />
            <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
              Lake temp {fmt(state.lake.temp)}°C · algae {fmt(state.lake.algae)}
            </div>
          </div>
          <div style={panelStyle}>
            <h4 style={panelTitleStyle}>Selected parcel</h4>
            {hoveredCell ? (
              <CellInfo cell={hoveredCell} />
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Hover any hex for land use, accumulated load, intervention status.</div>
            )}
          </div>
        </div>
      </div>

      {/* Intervention tray */}
      <div style={panelStyle}>
        <h4 style={panelTitleStyle}>Place an intervention</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
          {Object.values(INTERVENTIONS).map(iv => {
            const selected = selectedIntervention === iv.id
            const affordable = state.budget >= iv.cost
            const glyph = INTERVENTION_GLYPH[iv.id]
            return (
              <button key={iv.id}
                onClick={() => setSelectedIntervention(selected ? null : iv.id)}
                disabled={!affordable && !selected}
                title={iv.description}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: selected ? 'rgba(99,102,241,0.18)' : 'rgba(15,23,42,0.6)',
                  border: `1px solid ${selected ? '#6366f1' : (!affordable ? '#7f1d1d' : '#1e293b')}`,
                  color: '#e2e8f0',
                  cursor: affordable ? 'pointer' : 'not-allowed',
                  opacity: affordable || selected ? 1 : 0.55,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    display: 'inline-flex', width: 22, height: 22, borderRadius: 11,
                    background: glyph?.fill, color: glyph?.stroke,
                    alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 11, fontFamily: 'ui-monospace, monospace',
                    border: `1px solid ${glyph?.stroke}`,
                  }}>{glyph?.label}</span>
                  <strong style={{ fontSize: 13 }}>{iv.name}</strong>
                </div>
                <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 6 }}>{iv.short}</div>
                <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                  <span style={costBadge(affordable)}>${iv.cost}</span>
                  {iv.upkeep > 0 && <span style={costBadge(true, '#1e293b', '#94a3b8')}>upkeep ${iv.upkeep}/yr</span>}
                  {iv.maturityYears > 1 && <span style={costBadge(true, '#1e293b', '#94a3b8')}>{iv.maturityYears}-yr ramp</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Policies row */}
      <div style={panelStyle}>
        <h4 style={panelTitleStyle}>Watershed-wide policies</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.values(POLICIES).map(p => {
            const active = state.activePolicies.has(p.id)
            return (
              <button key={p.id} onClick={() => { togglePolicy(state, p.id); forceRender() }}
                title={p.description}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: active ? 'rgba(34,197,94,0.16)' : 'rgba(15,23,42,0.6)',
                  border: `1px solid ${active ? '#22c55e' : '#1e293b'}`,
                  color: active ? '#bbf7d0' : '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: 12,
                }}>
                {active ? '✓ ' : ''}{p.name} · ${p.annualCost}/yr
              </button>
            )
          })}
        </div>
      </div>

      {/* Causal timeline */}
      <div style={panelStyle}>
        <h4 style={panelTitleStyle}>Causal timeline</h4>
        <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {events.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>No events yet — start the simulation to see weather, ecology, and policy effects.</div>}
          {events.map((e, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, alignItems: 'baseline',
              fontSize: 12, padding: '4px 8px', borderRadius: 6,
              background: 'rgba(15,23,42,0.6)',
              borderLeft: `3px solid ${severityColor(e.severity)}`,
            }}>
              <span style={{ color: '#94a3b8', fontFamily: 'ui-monospace, monospace', fontSize: 10 }}>
                Y{Math.floor(e.tick / TICKS_PER_YEAR) + 1}·d{(e.tick % TICKS_PER_YEAR) + 1}
              </span>
              <span style={{ color: '#e2e8f0' }}>{e.msg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Year-end report */}
      {showYearReport && (
        <YearReportCard
          report={showYearReport}
          onClose={() => { setShowYearReport(null); setPaused(false) }}
        />
      )}

      {/* Run-end */}
      {endRun && (
        <RunEndCard
          score={endRun.score}
          verdict={endRun.verdict}
          reports={state.yearReports}
          onPlayAgain={handleResetRun}
          onExit={handleEndAndReport}
        />
      )}

      {/* Disclaimer */}
      <p style={{ fontSize: 11, color: '#64748b', textAlign: 'center', margin: 0 }}>
        Simulation is procedurally generated and does not represent real measurements at any specific watershed.
        Intervention catalogue and CCME aquatic-life thresholds are real.
      </p>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────
function Pill({ label, value, sub, tone }) {
  const toneColor = tone ? TONE_COLOR[tone] : '#cbd5e1'
  return (
    <div style={{
      padding: '6px 10px',
      borderRadius: 10,
      background: 'rgba(15,23,42,0.6)',
      border: '1px solid #1e293b',
      minWidth: 92,
    }}>
      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: toneColor }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#64748b' }}>{sub}</div>}
    </div>
  )
}

function ReadingRow({ label, value, unit, kind }) {
  const color = ccmeColor(kind, value)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
      <span style={{ fontSize: 12, color: '#cbd5e1' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'ui-monospace, monospace' }}>
        {fmt(value, kind === 'toxics' ? 2 : 1)}
        {unit ? <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 4 }}>{unit}</span> : null}
      </span>
    </div>
  )
}

function CellInfo({ cell }) {
  const intervention = cell.intervention ? INTERVENTIONS[cell.intervention] : null
  return (
    <div style={{ fontSize: 12, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8' }}>Land use</span>
        <span style={{ fontWeight: 600 }}>{cell.landUse}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8' }}>Position</span>
        <span style={{ fontFamily: 'ui-monospace, monospace' }}>({cell.c}, {cell.r})</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8' }}>Elevation</span>
        <span>{fmt(cell.elev, 2)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8' }}>Stream?</span>
        <span>{cell.isStream ? 'yes' : 'no'}</span>
      </div>
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Nutrient load</span>
          <span style={{ color: cell.nutrient > 4 ? '#f87171' : cell.nutrient > 1.5 ? '#fbbf24' : '#86efac' }}>{fmt(cell.nutrient, 2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Sediment</span>
          <span style={{ color: cell.sediment > 8 ? '#f87171' : cell.sediment > 3 ? '#fbbf24' : '#86efac' }}>{fmt(cell.sediment, 2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Chloride</span>
          <span style={{ color: cell.chloride > 30 ? '#f87171' : cell.chloride > 12 ? '#fbbf24' : '#86efac' }}>{fmt(cell.chloride, 2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Toxics</span>
          <span style={{ color: cell.toxics > 1 ? '#f87171' : cell.toxics > 0.4 ? '#fbbf24' : '#86efac' }}>{fmt(cell.toxics, 3)}</span>
        </div>
      </div>
      {intervention && (
        <div style={{ marginTop: 6, padding: 6, borderRadius: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#bbf7d0' }}>{intervention.name}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Age: {cell.interventionAge} yr · maturity {intervention.maturityYears} yr</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{intervention.short}</div>
        </div>
      )}
    </div>
  )
}

function YearReportCard({ report, onClose }) {
  const verdict = verdictForScore(report.score)
  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 540 }}>
        <div style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', padding: '16px 20px', color: '#fff' }}>
          <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.85, textTransform: 'uppercase' }}>Year {report.year + 1} report</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>Score {report.score} · {verdict.band}</div>
        </div>
        <div style={{ padding: 18, color: '#e2e8f0' }}>
          <p style={{ fontSize: 13, color: '#cbd5e1', marginTop: 0 }}>{verdict.text}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <Stat label="CCME compliance" value={`${report.overallCompliance}%`} />
            <Stat label="Ecosystem index" value={report.ecoIndex} />
            <Stat label="Algae blooms"    value={report.blooms}      tone={report.blooms > 0 ? 'critical' : 'safe'} />
            <Stat label="Species collapses" value={report.collapses} tone={report.collapses > 0 ? 'critical' : 'safe'} />
            <Stat label="Trust delta"     value={(report.trustDelta >= 0 ? '+' : '') + report.trustDelta} tone={report.trustDelta >= 0 ? 'safe' : 'critical'} />
            <Stat label="Samples"         value={report.samples} />
          </div>
          <h4 style={{ ...panelTitleStyle, marginTop: 16 }}>Per-parameter compliance</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <ComplianceRow label="pH"         pct={report.compliance.pH} />
            <ComplianceRow label="DO"         pct={report.compliance.do} />
            <ComplianceRow label="Turbidity"  pct={report.compliance.turbidity} />
            <ComplianceRow label="Conductivity" pct={report.compliance.conductivity} />
            <ComplianceRow label="Toxics"     pct={report.compliance.toxics} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={onClose} style={{ ...btnStyle('#22c55e'), padding: '8px 16px' }}>Continue →</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RunEndCard({ score, verdict, reports, onPlayAgain, onExit }) {
  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 580 }}>
        <div style={{ background: verdict.tone === 'good' ? 'linear-gradient(135deg,#10b981,#06b6d4)' : verdict.tone === 'warning' ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#7f1d1d,#dc2626)', padding: '16px 20px', color: '#fff' }}>
          <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.85, textTransform: 'uppercase' }}>5-year run complete</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>Watershed: {verdict.band}</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Avg composite score {score}/100</div>
        </div>
        <div style={{ padding: 18, color: '#e2e8f0' }}>
          <p style={{ fontSize: 13, color: '#cbd5e1', marginTop: 0 }}>{verdict.text}</p>
          <h4 style={{ ...panelTitleStyle, marginTop: 12 }}>Year-by-year</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {reports.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 8px', background: 'rgba(15,23,42,0.6)', borderRadius: 6 }}>
                <span>Year {r.year + 1}</span>
                <span style={{ color: r.score >= 65 ? '#86efac' : r.score >= 45 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>
                  {r.score} · CCME {r.overallCompliance}% · eco {r.ecoIndex}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={onPlayAgain} style={btnStyle('#1e293b')}>↻ New run</button>
            <button onClick={onExit}      style={btnStyle('#22c55e')}>Save score & exit</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }) {
  const color = tone ? TONE_COLOR[tone] : '#e2e8f0'
  return (
    <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b', borderRadius: 8, padding: 8 }}>
      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function ComplianceRow({ label, pct }) {
  const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#a3e635' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ color: '#cbd5e1', minWidth: 80 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(2, pct)}%`, height: '100%', background: color }} />
      </div>
      <span style={{ color, fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

// ── Inline style helpers ───────────────────────────────────────────────────
const panelStyle = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 12 }
const panelTitleStyle = { margin: '0 0 8px 0', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.78)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
const modalStyle = { width: '100%', background: '#0f172a', borderRadius: 18, border: '1px solid #334155', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }
const kbdStyle = { fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#0b1224', border: '1px solid #475569', color: '#7dd3fc', fontFamily: 'monospace' }
function btnStyle(bg) {
  return { padding: '7px 14px', borderRadius: 8, background: bg, color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
}
function costBadge(affordable, bg, fg) {
  return {
    padding: '2px 7px', borderRadius: 6,
    background: bg ?? (affordable ? 'rgba(34,197,94,0.15)' : 'rgba(127,29,29,0.4)'),
    color: fg ?? (affordable ? '#86efac' : '#fca5a5'),
    fontWeight: 700,
  }
}
