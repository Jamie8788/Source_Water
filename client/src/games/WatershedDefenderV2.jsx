// Watershed Defender V2 — research-grade simulation/strategy variant.
// State-of-the-art polish pass: living water, visible pollutant transport,
// dynamic weather/seasonal effects, premium glass UI, animated HUD.
//
// World is INSPIRED BY Sault Ste. Marie / Northern Ontario / Great Lakes
// land-use patterns. The simulation does NOT use real measurements — every
// number is procedurally generated. The intervention catalogue, the CCME
// thresholds used for scoring, and the ecology indicators are real.
//
// Engine architecture is unchanged. Everything in this file is rendering,
// animation, and feedback that reads from the engine state.

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
const HEX_SIZE = 20                      // radius from centre to vertex (CSS px)
const CANVAS_PAD = 14

// Land base colours — slightly richer than v1 for more visual depth.
const LAND_COLORS = {
  forest:      '#173023',
  riparian:    '#2c6840',
  agriculture: '#9c7c34',
  urban:       '#475063',
  industrial:  '#34343f',
  wetland:     '#1f6259',
  lake:        '#0a3360',
  stream:      '#1668ad',
}
// Subtle highlight (top-edge sun/sky) per land use — gives each hex depth.
const LAND_HIGHLIGHT = {
  forest:      'rgba(134,239,172,0.10)',
  riparian:    'rgba(187,247,208,0.15)',
  agriculture: 'rgba(253,224,71,0.10)',
  urban:       'rgba(148,163,184,0.10)',
  industrial:  'rgba(148,163,184,0.06)',
  wetland:     'rgba(94,234,212,0.12)',
  lake:        'rgba(125,211,252,0.10)',
  stream:      'rgba(125,211,252,0.20)',
}
const INTERVENTION_GLYPH = {
  riparian_buffer:     { fill: '#86efac', stroke: '#14532d', label: 'B', aura: 'rgba(134,239,172,0.45)' },
  constructed_wetland: { fill: '#5eead4', stroke: '#0f766e', label: 'W', aura: 'rgba(94,234,212,0.5)'  },
  detention_pond:      { fill: '#7dd3fc', stroke: '#0c4a6e', label: 'P', aura: 'rgba(125,211,252,0.45)' },
  cover_crops:         { fill: '#fde68a', stroke: '#92400e', label: 'C', aura: 'rgba(253,224,71,0.40)' },
  bioswale:            { fill: '#a7f3d0', stroke: '#065f46', label: 'S', aura: 'rgba(167,243,208,0.40)' },
  septic_upgrade:      { fill: '#c4b5fd', stroke: '#4c1d95', label: 'U', aura: 'rgba(196,181,253,0.40)' },
}
// Pollutant overlay channels and their visual identity.
const OVERLAY_CHANNELS = {
  off:      { label: 'Off',         field: null,        max: 1,    color: null },
  nutrient: { label: 'Nutrient',    field: 'nutrient',  max: 6,    color: [239,68,68]   },
  sediment: { label: 'Sediment',    field: 'sediment',  max: 12,   color: [245,158,11]  },
  chloride: { label: 'Chloride',    field: 'chloride',  max: 40,   color: [167,139,250] },
  toxics:   { label: 'Toxics',      field: 'toxics',    max: 1.2,  color: [236,72,153]  },
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

// Per-parameter axis range for the mini gauges (low / high CSS values).
const GAUGE_RANGE = {
  pH:           { min: 5.5, max: 9.5,  bands: [{lo:5.5,hi:6.5,t:'critical'},{lo:6.5,hi:9.0,t:'safe'},{lo:9.0,hi:9.5,t:'critical'}] },
  do:           { min: 0,   max: 14,   bands: [{lo:0,hi:4,t:'critical'},{lo:4,hi:6,t:'warning'},{lo:6,hi:14,t:'safe'}] },
  turbidity:    { min: 0,   max: 60,   bands: [{lo:0,hi:25,t:'safe'},{lo:25,hi:50,t:'warning'},{lo:50,hi:60,t:'critical'}] },
  conductivity: { min: 0,   max: 2000, bands: [{lo:0,hi:800,t:'safe'},{lo:800,hi:1500,t:'warning'},{lo:1500,hi:2000,t:'critical'}] },
  toxics:       { min: 0,   max: 1.5,  bands: [{lo:0,hi:0.5,t:'safe'},{lo:0.5,hi:1,t:'warning'},{lo:1,hi:1.5,t:'critical'}] },
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

function lerp(a, b, t) { return a + (b - a) * t }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }

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

  // FX state (mutable refs so RAF doesn't see stale closures)
  const fxRef = useRef({
    flow: [],            // {cellIdx, t, speed, hue}
    weather: [],         // {x, y, vx, vy, life, maxLife, kind, size, rot}
    bursts: [],          // {x, y, t, life, color}
    ripples: [],         // {x, y, t, life, color}
    splashes: [],        // event icon flashes {x, y, t, life, label, color}
    bloomRings: [],      // {t, life, color, intensity}
    rain: [],            // {x, y, len, speed}
    leaves: [],          // {x, y, vx, vy, rot, life, color}
    snow: [],            // {x, y, vx, vy, life}
    lakeCenter: { x: 0, y: 0 },
    invalidShake: { until: 0, x: 0, y: 0 },
  })

  // Smoothed HUD values (lerp toward true engine state for premium feel)
  const displayRef = useRef({
    budget: 0, trust: 60, trout: 78, mayfly: 70, algae: 1.5, doMg: 11,
    troutHistory: [], mayflyHistory: [], doHistory: [],
    pH: 7.6, turbidity: 0, conductivity: 50, toxics: 0,
    nutrient: 0, sediment: 0, chloride: 0,
  })
  // History-based sparkline buffers
  const histRef = useRef({ trout: [], mayfly: [], do: [], algae: [] })

  // UI state
  const [paused, setPaused] = useState(true)
  const [speed, setSpeed]   = useState(2)              // ticks per frame
  const [hoverCell, setHoverCell] = useState(null)
  const [selectedIntervention, setSelectedIntervention] = useState(null)
  const [showYearReport, setShowYearReport] = useState(null)
  const [endRun, setEndRun] = useState(null)           // { score, verdict }
  const [overlay, setOverlay] = useState('nutrient')   // pollution heatmap channel
  const [toast, setToast] = useState(null)             // { msg, kind, until }

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
    // Compute lake centroid for bloom-ring origin
    const lakeCells = layout.filter(h => h.cell.landUse === LAND_USE.LAKE)
    if (lakeCells.length) {
      const cx = lakeCells.reduce((s, h) => s + h.cx, 0) / lakeCells.length
      const cy = lakeCells.reduce((s, h) => s + h.cy, 0) / lakeCells.length
      fxRef.current.lakeCenter = { x: cx, y: cy }
    }
    return { canvasWidth: Math.ceil(w), canvasHeight: Math.ceil(h), cellSize: size, hexLayout: layout }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.terrain.cols, state.terrain.rows])

  // Hi-DPI canvas setup — sharp text/lines on retina displays.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [canvasWidth, canvasHeight])

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    let lastReportCount = state.yearReports.length
    let lastEventIdx = state.events.length
    let lastFrameMs = performance.now()
    function frame(nowMs) {
      const dt = Math.min(64, nowMs - lastFrameMs) // cap dt to avoid jumps
      lastFrameMs = nowMs

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

      // Walk new engine events to spawn FX (visible cause-effect)
      while (lastEventIdx < state.events.length) {
        spawnFxForEvent(state.events[lastEventIdx])
        lastEventIdx++
      }

      // Smooth HUD values toward engine truth
      const d = displayRef.current
      d.budget   = lerp(d.budget,   state.budget,        0.15)
      d.trust    = lerp(d.trust,    state.publicTrust,   0.10)
      d.trout    = lerp(d.trout,    state.eco.trout,     0.10)
      d.mayfly   = lerp(d.mayfly,   state.eco.mayfly,    0.10)
      d.algae    = lerp(d.algae,    state.lake.algae,    0.15)
      d.doMg     = lerp(d.doMg,     state.lake.do,       0.15)
      d.pH           = lerp(d.pH,           state.outlet?.pH           ?? d.pH,           0.15)
      d.turbidity    = lerp(d.turbidity,    state.outlet?.turbidity    ?? d.turbidity,    0.15)
      d.conductivity = lerp(d.conductivity, state.outlet?.conductivity ?? d.conductivity, 0.12)
      d.toxics       = lerp(d.toxics,       state.outlet?.toxics       ?? d.toxics,       0.15)

      // Push to history every ~12 frames for sparklines
      if ((nowMs | 0) % 12 === 0 && !state.paused) {
        const h = histRef.current
        h.trout.push(state.eco.trout);   if (h.trout.length > 80)   h.trout.shift()
        h.mayfly.push(state.eco.mayfly); if (h.mayfly.length > 80)  h.mayfly.shift()
        h.do.push(state.lake.do);        if (h.do.length > 80)      h.do.shift()
        h.algae.push(state.lake.algae);  if (h.algae.length > 80)   h.algae.shift()
      }

      // Spawn ambient FX (only while running)
      if (!state.paused && !endRun) {
        spawnFlowParticles(dt)
        spawnSeasonalParticles(dt)
        spawnStormParticles(dt)
        if (state.lake.algae > 4 && Math.random() < 0.04) {
          fxRef.current.bloomRings.push({ t: 0, life: 1800, color: 'rgba(132,204,22,0.35)', intensity: state.lake.algae })
        }
      }

      // Update FX particles
      updateFx(dt)

      // Draw
      drawScene(nowMs)
      forceRender()
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endRun])

  // ── FX spawning ───────────────────────────────────────────────────────────
  function spawnFxForEvent(ev) {
    const fx = fxRef.current
    if (ev.kind === 'storm') {
      // 4 seconds of rain + brief darken handled by storm spawner
      fx.weather.push({ kind: 'storm_marker', life: 3500, maxLife: 3500 })
      toastNow(`Storm — runoff ×${(ev.mag || 3).toFixed(1)}`, 'high')
    } else if (ev.kind === 'manure_spill' && ev.cell) {
      const h = hexLayout[ev.cell[1] * state.terrain.cols + ev.cell[0]]
      if (h) {
        for (let i = 0; i < 18; i++) {
          fx.bursts.push({ x: h.cx, y: h.cy, t: 0, life: 900, color: '139,92,46', spread: 22 + Math.random() * 18 })
        }
        fx.splashes.push({ x: h.cx, y: h.cy - 30, t: 0, life: 1600, label: '⚠ Manure spill', color: '#f97316' })
      }
      toastNow('Manure spill on agricultural parcel', 'high')
    } else if (ev.kind === 'sewage_bypass' && ev.cell) {
      const h = hexLayout[ev.cell[1] * state.terrain.cols + ev.cell[0]]
      if (h) {
        for (let i = 0; i < 18; i++) {
          fx.bursts.push({ x: h.cx, y: h.cy, t: 0, life: 900, color: '88,28,135', spread: 24 })
        }
        fx.splashes.push({ x: h.cx, y: h.cy - 30, t: 0, life: 1600, label: '⚠ Sewage bypass', color: '#a855f7' })
      }
      toastNow('Sewage bypass at outfall', 'high')
    } else if (ev.kind === 'bloom_start') {
      // Big concentric pulse from lake centre
      for (let i = 0; i < 3; i++) {
        fx.bloomRings.push({ t: -i * 250, life: 2400, color: 'rgba(132,204,22,0.65)', intensity: 8, big: true })
      }
      toastNow('Algal bloom — beach advisory', 'high')
    } else if (ev.kind === 'bloom_end') {
      toastNow('Bloom subsided', 'good')
    } else if (ev.kind === 'trout_collapse') {
      pulseLakeRing('rgba(239,68,68,0.55)')
      toastNow('Brook trout collapsed', 'high')
    } else if (ev.kind === 'mayfly_loss') {
      pulseLakeRing('rgba(245,158,11,0.55)')
      toastNow('Mayfly loss — chronic stress', 'medium')
    } else if (ev.kind === 'trout_recovery' || ev.kind === 'mayfly_return') {
      pulseLakeRing('rgba(34,197,94,0.55)')
      toastNow(ev.msg, 'good')
    } else if (ev.kind === 'intervention_placed') {
      // No toast (placement burst is separate, handled at click time)
    } else if (ev.kind === 'year_end') {
      // Year card handled separately
    } else if (ev.kind === 'placement_blocked') {
      toastNow(ev.msg, 'medium')
    }
  }

  function pulseLakeRing(color) {
    fxRef.current.bloomRings.push({ t: 0, life: 1400, color, intensity: 6, big: true })
  }

  function toastNow(msg, kind = 'info') {
    setToast({ msg, kind, until: performance.now() + 2600 })
  }

  function spawnFlowParticles(dt) {
    // Spawn from headwater stream cells (the highest stream tiles).
    // Probability scales with weather runoff to make storms visibly intense.
    const rain = state.weather?.runoffMult ?? 1
    const spawnP = clamp(0.08 + (rain - 1) * 0.05, 0.04, 0.30)
    if (Math.random() < spawnP * (dt / 16)) {
      // Pick a random stream cell with no upstream stream (headwater)
      const streams = hexLayout.filter(h => h.cell.isStream)
      if (streams.length) {
        // Headwaters: stream cells whose flowAcc is in the lower 25% of streams
        const sorted = streams.slice().sort((a, b) => a.cell.flowAcc - b.cell.flowAcc)
        const head = sorted[Math.floor(Math.random() * Math.max(1, Math.floor(sorted.length * 0.35)))]
        if (head?.cell.flowToward) {
          fxRef.current.flow.push({
            cellIdx: head.cell.r * state.terrain.cols + head.cell.c,
            t: 0,
            speed: 0.012 + Math.random() * 0.016,
            life: 0,
            maxLife: 12000,
          })
        }
      }
    }
  }

  function spawnSeasonalParticles(dt) {
    const fx = fxRef.current
    const season = seasonOf(state.tick)
    if (season === 'winter') {
      if (Math.random() < 0.30 * (dt / 16) && fx.snow.length < 90) {
        fx.snow.push({
          x: Math.random() * canvasWidth,
          y: -4,
          vx: (Math.random() - 0.5) * 0.06,
          vy: 0.04 + Math.random() * 0.05,
          life: 0, maxLife: 18000,
          size: 0.8 + Math.random() * 1.6,
          drift: Math.random() * Math.PI * 2,
        })
      }
    } else if (season === 'fall') {
      if (Math.random() < 0.05 * (dt / 16) && fx.leaves.length < 30) {
        fx.leaves.push({
          x: Math.random() * canvasWidth,
          y: -6,
          vx: 0.03 + Math.random() * 0.04,
          vy: 0.05 + Math.random() * 0.04,
          rot: Math.random() * Math.PI * 2,
          rotV: (Math.random() - 0.5) * 0.005,
          life: 0, maxLife: 16000,
          color: ['#f59e0b', '#d97706', '#b45309', '#dc2626'][Math.floor(Math.random() * 4)],
          size: 3 + Math.random() * 2,
        })
      }
    } else if (season === 'spring') {
      // Subtle dandelion/pollen drift
      if (Math.random() < 0.04 * (dt / 16) && fx.leaves.length < 20) {
        fx.leaves.push({
          x: Math.random() * canvasWidth,
          y: -6,
          vx: 0.02 + Math.random() * 0.03,
          vy: 0.02 + Math.random() * 0.02,
          rot: 0, rotV: 0,
          life: 0, maxLife: 14000,
          color: '#fef9c3',
          size: 1.5 + Math.random() * 1.2,
        })
      }
    }
  }

  function spawnStormParticles(dt) {
    const fx = fxRef.current
    const stormActive = fx.weather.some(w => w.kind === 'storm_marker')
    if (stormActive) {
      const target = Math.min(120, 80)
      while (fx.rain.length < target && Math.random() < 0.6 * (dt / 16) * 4) {
        fx.rain.push({
          x: Math.random() * (canvasWidth + 80) - 40,
          y: Math.random() * canvasHeight - canvasHeight,
          len: 12 + Math.random() * 14,
          speed: 0.7 + Math.random() * 0.5,
        })
      }
    }
  }

  function updateFx(dt) {
    const fx = fxRef.current

    // Flow particles: advance along stream chain
    const cells = state.terrain.cells
    for (let i = fx.flow.length - 1; i >= 0; i--) {
      const p = fx.flow[i]
      p.t += p.speed * (dt / 16)
      p.life += dt
      if (p.life > p.maxLife) { fx.flow.splice(i, 1); continue }
      while (p.t >= 1) {
        p.t -= 1
        const cell = cells[p.cellIdx]
        if (!cell?.flowToward) { fx.flow.splice(i, 1); break }
        const [tc, tr] = cell.flowToward
        const ds = cells[tr * state.terrain.cols + tc]
        if (!ds) { fx.flow.splice(i, 1); break }
        // Reached lake — keep them visible briefly then despawn
        if (ds.landUse === LAND_USE.LAKE) {
          // Replace with a tiny ripple at lake entry
          const lh = hexLayout[tr * state.terrain.cols + tc]
          if (lh) fx.ripples.push({ x: lh.cx, y: lh.cy, t: 0, life: 700, color: 'rgba(125,211,252,0.6)' })
          fx.flow.splice(i, 1)
          break
        }
        p.cellIdx = tr * state.terrain.cols + tc
      }
    }

    // Bursts (placement, spill puffs)
    for (let i = fx.bursts.length - 1; i >= 0; i--) {
      const b = fx.bursts[i]
      b.t += dt
      if (b.t >= b.life) fx.bursts.splice(i, 1)
    }

    // Ripples
    for (let i = fx.ripples.length - 1; i >= 0; i--) {
      const r = fx.ripples[i]
      r.t += dt
      if (r.t >= r.life) fx.ripples.splice(i, 1)
    }

    // Splashes (event labels)
    for (let i = fx.splashes.length - 1; i >= 0; i--) {
      const s = fx.splashes[i]
      s.t += dt
      if (s.t >= s.life) fx.splashes.splice(i, 1)
    }

    // Bloom rings
    for (let i = fx.bloomRings.length - 1; i >= 0; i--) {
      const b = fx.bloomRings[i]
      b.t += dt
      if (b.t >= b.life) fx.bloomRings.splice(i, 1)
    }

    // Weather markers (storm cooldown)
    for (let i = fx.weather.length - 1; i >= 0; i--) {
      const w = fx.weather[i]
      w.life -= dt
      if (w.life <= 0) fx.weather.splice(i, 1)
    }

    // Rain
    for (let i = fx.rain.length - 1; i >= 0; i--) {
      const r = fx.rain[i]
      r.x += r.speed * 0.4 * dt
      r.y += r.speed * 1.4 * dt
      if (r.y > canvasHeight + 20 || r.x > canvasWidth + 80) fx.rain.splice(i, 1)
    }
    // If storm ended, let rain drain naturally; just stop topping up.

    // Snow
    for (let i = fx.snow.length - 1; i >= 0; i--) {
      const s = fx.snow[i]
      s.life += dt
      s.drift += 0.0015 * dt
      s.x += (s.vx + Math.sin(s.drift) * 0.04) * dt
      s.y += s.vy * dt
      if (s.y > canvasHeight + 6 || s.life > s.maxLife) fx.snow.splice(i, 1)
    }

    // Leaves / pollen
    for (let i = fx.leaves.length - 1; i >= 0; i--) {
      const l = fx.leaves[i]
      l.life += dt
      l.rot += l.rotV * dt
      l.x += l.vx * dt + Math.sin(l.life * 0.001) * 0.02 * dt
      l.y += l.vy * dt
      if (l.y > canvasHeight + 6 || l.life > l.maxLife) fx.leaves.splice(i, 1)
    }
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  function drawScene(nowMs) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    const season = seasonOf(state.tick)

    // Background — radial sky tone biased by season for ambient mood.
    const skyTop = season === 'summer'  ? '#152848'
                 : season === 'winter'  ? '#0f1729'
                 : season === 'fall'    ? '#1a1530'
                 : /* spring */          '#0f213a'
    const skyBot = season === 'summer'  ? '#0a1428'
                 : season === 'winter'  ? '#08101e'
                 : season === 'fall'    ? '#0d0a1d'
                 : /* spring */          '#070f1d'
    const bg = ctx.createLinearGradient(0, 0, 0, canvasHeight)
    bg.addColorStop(0, skyTop)
    bg.addColorStop(1, skyBot)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Sun glint streaks (summer)
    if (season === 'summer') {
      ctx.save()
      ctx.globalAlpha = 0.05
      ctx.fillStyle = '#fde68a'
      ctx.beginPath()
      ctx.ellipse(canvasWidth * 0.15, -40, 200, 220, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Animated lake fill (computed first so hexes overlay it correctly)
    const algaeT = clamp((displayRef.current.algae - 1) / 9, 0, 1)
    const lakeBase = blendRGB([15, 59, 107], [58, 126, 58], algaeT * 0.85)
    const surfacePhase = (nowMs * 0.0006)

    // Pollution overlay precompute (per-cell intensity 0..1)
    const overlayChan = OVERLAY_CHANNELS[overlay]
    const overlayMax = overlayChan?.max ?? 1
    const overlayField = overlayChan?.field

    // Hexes
    for (let i = 0; i < hexLayout.length; i++) {
      const h = hexLayout[i]
      const { cx, cy, cell } = h
      const corners = hexCorners(cx, cy, cellSize)
      ctx.beginPath()
      for (let k = 0; k < 6; k++) {
        const p = corners[k]
        if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
      }
      ctx.closePath()

      // Fill base
      let fill = LAND_COLORS[cell.landUse] || '#222'
      if (cell.landUse === LAND_USE.LAKE) {
        // Animated lake — slight surface shimmer
        const wob = Math.sin((cx + cy) * 0.04 + surfacePhase) * 0.04
        fill = blendRGBHex(lakeBase, '#7dd3fc', Math.max(0, wob))
      } else if (cell.landUse === LAND_USE.STREAM) {
        // Stream cells subtly brighten and dim along their flow direction
        const phase = (cx * 0.02 + cy * 0.03 - nowMs * 0.0012)
        const shim = (Math.sin(phase) + 1) * 0.5
        fill = blendRGBHex([22, 104, 173], '#7dd3fc', shim * 0.35)
      } else if (season === 'winter' && cell.landUse !== LAND_USE.LAKE && cell.landUse !== LAND_USE.STREAM) {
        // Frost: blend toward white
        fill = blendHexHex(fill, '#dbeafe', 0.18)
      } else if (season === 'fall' && cell.landUse === LAND_USE.FOREST) {
        fill = blendHexHex(fill, '#b45309', 0.25)
      } else if (season === 'spring' && (cell.landUse === LAND_USE.AGRICULTURE || cell.landUse === LAND_USE.RIPARIAN)) {
        fill = blendHexHex(fill, '#22c55e', 0.10)
      }
      ctx.fillStyle = fill
      ctx.fill()

      // Top highlight — sun catching upper edge
      const hl = LAND_HIGHLIGHT[cell.landUse]
      if (hl) {
        ctx.save()
        ctx.clip()
        const grad = ctx.createLinearGradient(cx, cy - cellSize, cx, cy + cellSize)
        grad.addColorStop(0, hl)
        grad.addColorStop(0.55, 'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.fillRect(cx - cellSize, cy - cellSize, cellSize * 2, cellSize * 2)
        // Inner shadow at the bottom for depth
        const sh = ctx.createLinearGradient(cx, cy - cellSize, cx, cy + cellSize)
        sh.addColorStop(0.55, 'rgba(0,0,0,0)')
        sh.addColorStop(1, 'rgba(0,0,0,0.22)')
        ctx.fillStyle = sh
        ctx.fillRect(cx - cellSize, cy - cellSize, cellSize * 2, cellSize * 2)
        ctx.restore()
      }

      // Pollution overlay (heatmap glow)
      if (overlayField && cell.landUse !== LAND_USE.STREAM && cell.landUse !== LAND_USE.LAKE) {
        const v = cell[overlayField] || 0
        const t = clamp(v / overlayMax, 0, 1)
        if (t > 0.04) {
          const [r, g, b] = overlayChan.color
          ctx.save()
          ctx.clip()
          const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cellSize * 1.05)
          rg.addColorStop(0, `rgba(${r},${g},${b},${0.12 + 0.55 * t})`)
          rg.addColorStop(1, `rgba(${r},${g},${b},0)`)
          ctx.fillStyle = rg
          ctx.fillRect(cx - cellSize, cy - cellSize, cellSize * 2, cellSize * 2)
          ctx.restore()
        }
      }

      // Stream highlight — thicker blue stroke
      if (cell.isStream) {
        ctx.lineWidth = 1.6
        ctx.strokeStyle = 'rgba(125,211,252,0.55)'
      } else {
        ctx.lineWidth = 0.5
        ctx.strokeStyle = 'rgba(11,18,36,0.85)'
      }
      ctx.stroke()

      // Valid placement indicator (when an intervention is selected)
      if (selectedIntervention && !cell.intervention) {
        const def = INTERVENTIONS[selectedIntervention]
        const ok = def.canPlace(cell, state.terrain).ok
        if (ok) {
          const pulse = 0.30 + 0.30 * Math.sin(nowMs * 0.005 + (cx + cy) * 0.05)
          ctx.fillStyle = `rgba(52,211,153,${pulse})`
          ctx.beginPath()
          ctx.arc(cx, cy, cellSize * 0.18, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Intervention overlay
      if (cell.intervention) {
        const g = INTERVENTION_GLYPH[cell.intervention]
        const def = INTERVENTIONS[cell.intervention]
        if (g) {
          // Mature aura
          const maturity = clamp(cell.interventionAge / Math.max(1, def?.maturityYears || 1), 0, 1)
          if (maturity >= 0.99) {
            const glow = 0.35 + 0.20 * Math.sin(nowMs * 0.003 + (cx + cy) * 0.02)
            ctx.save()
            const rg = ctx.createRadialGradient(cx, cy, cellSize * 0.3, cx, cy, cellSize * 1.05)
            rg.addColorStop(0, g.aura.replace(/[\d.]+\)/, `${glow.toFixed(2)})`))
            rg.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.fillStyle = rg
            ctx.beginPath()
            ctx.arc(cx, cy, cellSize * 1.05, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
          // Disc
          ctx.beginPath()
          ctx.arc(cx, cy, cellSize * 0.46, 0, Math.PI * 2)
          ctx.fillStyle = g.fill
          ctx.fill()
          ctx.lineWidth = 1.6
          ctx.strokeStyle = g.stroke
          ctx.stroke()
          // Maturity arc (ramp progress)
          if (maturity < 0.99) {
            ctx.beginPath()
            ctx.arc(cx, cy, cellSize * 0.58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * maturity)
            ctx.lineWidth = 2
            ctx.strokeStyle = '#fde68a'
            ctx.stroke()
          }
          // Glyph label
          ctx.fillStyle = g.stroke
          ctx.font = 'bold 11px ui-monospace, monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(g.label, cx, cy + 0.5)
        }
      }
    }

    // ── Bloom rings (lake centre) ────────────────────────────────────────
    const lc = fxRef.current.lakeCenter
    for (const ring of fxRef.current.bloomRings) {
      if (ring.t < 0) continue
      const t = ring.t / ring.life
      const rad = (ring.big ? 240 : 120) * easeOutCubic(t)
      ctx.save()
      ctx.globalAlpha = (1 - t) * 0.85
      ctx.lineWidth = ring.big ? 4 : 2
      ctx.strokeStyle = ring.color
      ctx.beginPath()
      ctx.arc(lc.x, lc.y, rad, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // ── Stream-flow particles ────────────────────────────────────────────
    for (const p of fxRef.current.flow) {
      const cell = state.terrain.cells[p.cellIdx]
      if (!cell || !cell.flowToward) continue
      const from = hexLayout[p.cellIdx]
      const [tc, tr] = cell.flowToward
      const to = hexLayout[tr * state.terrain.cols + tc]
      if (!from || !to) continue
      const x = lerp(from.cx, to.cx, p.t)
      const y = lerp(from.cy, to.cy, p.t)
      // Tint by current cell pollutant load (strongest channel)
      const load = Math.min(1, (cell.nutrient + cell.sediment * 0.3 + cell.toxics * 4) / 6)
      const r = 200 + load * 55
      const g = 220 - load * 140
      const b = 255 - load * 140
      ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},0.95)`
      ctx.beginPath()
      ctx.arc(x, y, 2.4, 0, Math.PI * 2)
      ctx.fill()
      // Trailing glow
      ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},0.25)`
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    // ── Burst particles (placement / spill puffs) ────────────────────────
    for (const b of fxRef.current.bursts) {
      const t = b.t / b.life
      const r = 4 + b.spread * easeOutCubic(t)
      ctx.save()
      ctx.globalAlpha = (1 - t)
      ctx.strokeStyle = `rgba(${b.color},${1 - t})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // ── Ripples ──────────────────────────────────────────────────────────
    for (const rp of fxRef.current.ripples) {
      const t = rp.t / rp.life
      const r = 3 + 14 * easeOutCubic(t)
      ctx.save()
      ctx.globalAlpha = (1 - t) * 0.85
      ctx.strokeStyle = rp.color
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(rp.x, rp.y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // ── Splashes (event labels rising and fading) ────────────────────────
    for (const s of fxRef.current.splashes) {
      const t = s.t / s.life
      const dy = -22 * easeOutCubic(t)
      ctx.save()
      ctx.globalAlpha = 1 - t
      ctx.fillStyle = s.color
      ctx.font = 'bold 11px ui-sans-serif, system-ui'
      ctx.textAlign = 'center'
      ctx.fillText(s.label, s.x, s.y + dy)
      ctx.restore()
    }

    // ── Hover & placement preview ────────────────────────────────────────
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
        const breath = 0.65 + 0.35 * Math.sin(nowMs * 0.008)
        if (selectedIntervention) {
          const def = INTERVENTIONS[selectedIntervention]
          const check = def.canPlace(h.cell, state.terrain)
          ctx.lineWidth = 2.6
          ctx.strokeStyle = check.ok ? `rgba(52,211,153,${0.5 + breath * 0.5})` : `rgba(248,113,113,${0.5 + breath * 0.5})`
        } else {
          ctx.lineWidth = 2.2
          ctx.strokeStyle = `rgba(253,224,71,${0.5 + breath * 0.5})`
        }
        ctx.stroke()
      }
    }

    // ── Outlet marker ─────────────────────────────────────────────────────
    if (state.terrain.outletCell) {
      const oc = state.terrain.outletCell
      const layout = hexLayout[oc.r * state.terrain.cols + oc.c]
      if (layout) {
        const r = cellSize * (0.55 + 0.08 * Math.sin(nowMs * 0.004))
        ctx.beginPath()
        ctx.arc(layout.cx, layout.cy, r, 0, Math.PI * 2)
        ctx.lineWidth = 2
        ctx.strokeStyle = '#fde047'
        ctx.stroke()
        ctx.fillStyle = 'rgba(253,224,71,0.85)'
        ctx.font = 'bold 9px ui-sans-serif, system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('OUTLET', layout.cx, layout.cy - cellSize * 0.85)
      }
    }

    // ── Rain ──────────────────────────────────────────────────────────────
    if (fxRef.current.rain.length) {
      ctx.save()
      ctx.strokeStyle = 'rgba(186,230,253,0.55)'
      ctx.lineWidth = 1
      for (const r of fxRef.current.rain) {
        ctx.beginPath()
        ctx.moveTo(r.x, r.y)
        ctx.lineTo(r.x + r.speed * 4, r.y + r.len)
        ctx.stroke()
      }
      ctx.restore()
    }

    // ── Snow ─────────────────────────────────────────────────────────────
    if (fxRef.current.snow.length) {
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      for (const s of fxRef.current.snow) {
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // ── Leaves / pollen ──────────────────────────────────────────────────
    if (fxRef.current.leaves.length) {
      for (const l of fxRef.current.leaves) {
        ctx.save()
        ctx.translate(l.x, l.y)
        ctx.rotate(l.rot)
        ctx.fillStyle = l.color
        ctx.beginPath()
        ctx.ellipse(0, 0, l.size, l.size * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // ── Storm darken overlay ──────────────────────────────────────────────
    const stormFx = fxRef.current.weather.find(w => w.kind === 'storm_marker')
    if (stormFx) {
      const t = 1 - stormFx.life / stormFx.maxLife
      const alpha = (1 - t) * 0.32
      ctx.fillStyle = `rgba(15,23,42,${alpha})`
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      // lightning flash early in the storm
      if (stormFx.life > stormFx.maxLife - 220 && Math.random() < 0.4) {
        ctx.fillStyle = 'rgba(186,230,253,0.20)'
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      }
    }

    // ── Vignette ──────────────────────────────────────────────────────────
    const vg = ctx.createRadialGradient(
      canvasWidth / 2, canvasHeight / 2, Math.min(canvasWidth, canvasHeight) * 0.35,
      canvasWidth / 2, canvasHeight / 2, Math.max(canvasWidth, canvasHeight) * 0.7
    )
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.45)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // ── Top corner labels: season + day ───────────────────────────────────
    const dayInYear = state.tick % TICKS_PER_YEAR
    ctx.save()
    ctx.fillStyle = 'rgba(15,23,42,0.55)'
    ctx.beginPath()
    ctx.roundRect ? ctx.roundRect(10, 10, 156, 26, 8) : ctx.rect(10, 10, 156, 26)
    ctx.fill()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '600 11px ui-sans-serif, system-ui'
    ctx.textAlign = 'left'
    const seasonGlyph = season === 'winter' ? '❄' : season === 'spring' ? '🌱' : season === 'summer' ? '☀' : '🍂'
    ctx.fillText(`${seasonGlyph}  Year ${state.year + 1} · ${season} · day ${dayInYear + 1}/${TICKS_PER_YEAR}`, 18, 27)
    ctx.restore()
  }

  // Color helpers
  function blendRGB(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ]
  }
  function blendRGBHex(rgb, hex, t) {
    const b = parseHex(hex)
    const r = blendRGB(rgb, [b.r, b.g, b.b], t)
    return `rgb(${r[0]},${r[1]},${r[2]})`
  }
  function blendHexHex(hex1, hex2, t) {
    const a = parseHex(hex1), b = parseHex(hex2)
    return `rgb(${Math.round(a.r+(b.r-a.r)*t)},${Math.round(a.g+(b.g-a.g)*t)},${Math.round(a.b+(b.b-a.b)*t)})`
  }
  function parseHex(h) {
    const s = h.replace('#', '')
    return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) }
  }

  // ── Mouse handling ────────────────────────────────────────────────────────
  function pointToCell(px, py) {
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

  function canvasCoords(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) * (canvasWidth / rect.width)
    const py = (e.clientY - rect.top) * (canvasHeight / rect.height)
    return { px, py }
  }

  function onCanvasMove(e) {
    const { px, py } = canvasCoords(e)
    setHoverCell(pointToCell(px, py))
  }
  function onCanvasLeave() { setHoverCell(null) }

  function onCanvasClick(e) {
    if (endRun) return
    const { px, py } = canvasCoords(e)
    const hit = pointToCell(px, py)
    if (!hit) return
    const cell = state.terrain.cells[hit.r * state.terrain.cols + hit.c]
    const layout = hexLayout[hit.r * state.terrain.cols + hit.c]

    // Click ripple at click point
    fxRef.current.ripples.push({ x: px, y: py, t: 0, life: 500, color: 'rgba(226,232,240,0.7)' })

    if (e.shiftKey && cell.intervention) {
      removeIntervention(state, cell)
      // Removal puff
      for (let i = 0; i < 12; i++) {
        fxRef.current.bursts.push({ x: layout.cx, y: layout.cy, t: 0, life: 700, color: '148,163,184', spread: 18 })
      }
      toastNow('Intervention removed', 'medium')
      forceRender()
      return
    }
    if (!selectedIntervention) {
      if (cell.intervention) {
        const def = INTERVENTIONS[cell.intervention]
        toastNow(`${def.name} — shift+click to remove`, 'info')
      } else {
        toastNow('Select an intervention from the tray below, then click a hex.', 'info')
      }
      return
    }
    const result = placeIntervention(state, cell, selectedIntervention)
    if (!result.ok) {
      // Red shake + toast
      fxRef.current.invalidShake = { until: performance.now() + 350, x: px, y: py }
      for (let i = 0; i < 8; i++) {
        fxRef.current.bursts.push({ x: px, y: py, t: 0, life: 500, color: '248,113,113', spread: 12 })
      }
      state.events.push({ tick: state.tick, kind: 'placement_blocked',
        msg: `Cannot place ${INTERVENTIONS[selectedIntervention].name}: ${result.reason}`,
        severity: 'medium' })
    } else {
      // Placement burst in intervention colour
      const g = INTERVENTION_GLYPH[selectedIntervention]
      const colorCsv = (() => {
        const p = parseHex(g.fill); return `${p.r},${p.g},${p.b}`
      })()
      for (let i = 0; i < 22; i++) {
        fxRef.current.bursts.push({ x: layout.cx, y: layout.cy, t: 0, life: 800, color: colorCsv, spread: 22 + Math.random() * 18 })
      }
      fxRef.current.ripples.push({ x: layout.cx, y: layout.cy, t: 0, life: 800, color: `rgba(${colorCsv},0.85)` })
      toastNow(`${INTERVENTIONS[selectedIntervention].name} placed`, 'good')
    }
    forceRender()
  }

  // ── HUD derived values ────────────────────────────────────────────────────
  const season = seasonOf(state.tick)
  const dayInYear = state.tick % TICKS_PER_YEAR
  const events = state.events.slice(-30).slice().reverse()    // newest first
  const hoveredCell = hoverCell ? state.terrain.cells[hoverCell.r * state.terrain.cols + hoverCell.c] : null
  const d = displayRef.current

  function handleResetRun() {
    stateRef.current = createGameState({ cols: 22, rows: 16, seed: (Math.random() * 1e9) | 0 })
    fxRef.current.flow = []
    fxRef.current.bursts = []
    fxRef.current.ripples = []
    fxRef.current.bloomRings = []
    fxRef.current.splashes = []
    fxRef.current.weather = []
    fxRef.current.rain = []
    histRef.current = { trout: [], mayfly: [], do: [], algae: [] }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top HUD — premium glass strip with smooth pills */}
      <div style={glassStrip}>
        <SeasonRing tick={state.tick} year={state.year} season={season} />
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Pill label="Budget" value={`$${Math.round(d.budget)}`} sub={`Year ${state.year + 1} · day ${dayInYear + 1}`} tone={d.budget < 100 ? 'critical' : d.budget < 300 ? 'warning' : 'safe'} />
          <Pill label="Public trust" value={`${Math.round(d.trust)}%`} bar={d.trust} tone={d.trust < 30 ? 'critical' : d.trust < 55 ? 'warning' : 'safe'} />
          <SparkPill label="Brook trout" value={Math.round(d.trout)} tone={d.trout < 20 ? 'critical' : d.trout < 50 ? 'warning' : 'safe'} hist={histRef.current.trout} />
          <SparkPill label="Mayfly idx" value={Math.round(d.mayfly)} tone={d.mayfly < 20 ? 'critical' : d.mayfly < 50 ? 'warning' : 'safe'} hist={histRef.current.mayfly} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setPaused(p => !p)}
            style={btnStyle(paused ? '#22c55e' : '#0ea5e9')}>{paused ? '▶ Run' : '⏸ Pause'}</button>
          {[1, 2, 4, 8].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              style={{ ...btnStyle(speed === s ? '#6366f1' : 'rgba(30,41,59,0.7)'), padding: '6px 10px' }}>{s}×</button>
          ))}
          <button onClick={handleResetRun} style={btnStyle('rgba(71,85,105,0.7)')}>↻ New map</button>
        </div>
      </div>

      {/* Pollution overlay channel switcher */}
      <div style={{ ...glassPanel, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Pollutant overlay</span>
        {Object.keys(OVERLAY_CHANNELS).map(k => {
          const c = OVERLAY_CHANNELS[k]
          const active = overlay === k
          const bg = c.color ? `rgba(${c.color[0]},${c.color[1]},${c.color[2]},${active ? 0.30 : 0.10})` : (active ? 'rgba(99,102,241,0.25)' : 'rgba(15,23,42,0.5)')
          const border = c.color ? `rgba(${c.color[0]},${c.color[1]},${c.color[2]},${active ? 0.9 : 0.35})` : (active ? '#6366f1' : '#1e293b')
          return (
            <button key={k} onClick={() => setOverlay(k)} style={{
              padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: bg, border: `1px solid ${border}`, color: '#e2e8f0', cursor: 'pointer',
            }}>{c.label}</button>
          )
        })}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
          Heat-map shows where the selected pollutant is accumulating.
        </span>
      </div>

      {/* Main grid: canvas + right rail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 296px', gap: 14 }}>
        <div style={{ ...glassPanel, padding: 10, position: 'relative' }}>
          <canvas
            ref={canvasRef}
            onMouseMove={onCanvasMove}
            onMouseLeave={onCanvasLeave}
            onClick={onCanvasClick}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              cursor: selectedIntervention ? 'crosshair' : 'pointer',
              borderRadius: 10,
              transform: fxRef.current.invalidShake.until > performance.now() ? `translate(${(Math.random() - 0.5) * 4}px, ${(Math.random() - 0.5) * 4}px)` : '',
              transition: 'transform 0.05s',
            }}
          />
          {/* Floating toast over canvas */}
          {toast && toast.until > performance.now() && (
            <div style={{
              position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(15,23,42,0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid ${severityColor(toast.kind)}`,
              color: '#e2e8f0', padding: '8px 14px', borderRadius: 999,
              fontSize: 12, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              animation: 'wd2-toast-in 220ms ease-out',
              maxWidth: '85%',
            }}>
              <span style={{ color: severityColor(toast.kind), marginRight: 6 }}>●</span>
              {toast.msg}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <span>Hover for details · Click to place selected intervention · <kbd style={kbdStyle}>Shift</kbd>+Click to remove</span>
          </div>
        </div>

        {/* Right rail: outlet WQ + hovered cell info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={glassPanel}>
            <h4 style={panelTitleStyle}>Outlet readings · CCME aquatic life</h4>
            <CCMEGauge label="pH"           value={d.pH}           kind="pH"           digits={2} />
            <CCMEGauge label="DO"           value={d.doMg}         kind="do"           unit="mg/L" />
            <CCMEGauge label="Turbidity"    value={d.turbidity}    kind="turbidity"    unit="NTU" />
            <CCMEGauge label="Conductivity" value={d.conductivity} kind="conductivity" unit="µS/cm" digits={0} />
            <CCMEGauge label="Toxics idx"   value={d.toxics}       kind="toxics"       digits={2} />
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed rgba(148,163,184,0.2)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
              <span>Lake temp</span><span style={{ color: '#e2e8f0', fontFamily: 'ui-monospace, monospace' }}>{fmt(state.lake.temp)}°C</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
              <span>Algae index</span><span style={{ color: d.algae > 6 ? '#84cc16' : '#e2e8f0', fontFamily: 'ui-monospace, monospace', fontWeight: d.algae > 6 ? 700 : 400 }}>{fmt(d.algae)}</span>
            </div>
          </div>
          <div style={glassPanel}>
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
      <div style={glassPanel}>
        <h4 style={panelTitleStyle}>Place an intervention</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
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
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: selected ? `linear-gradient(135deg, ${glyph.aura}, rgba(15,23,42,0.4))` : 'rgba(15,23,42,0.55)',
                  border: `1px solid ${selected ? glyph.stroke : (!affordable ? 'rgba(127,29,29,0.6)' : 'rgba(148,163,184,0.18)')}`,
                  color: '#e2e8f0',
                  cursor: affordable ? 'pointer' : 'not-allowed',
                  opacity: affordable || selected ? 1 : 0.55,
                  position: 'relative',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                  boxShadow: selected ? `0 6px 24px ${glyph.aura}` : '0 1px 0 rgba(255,255,255,0.03) inset',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    display: 'inline-flex', width: 26, height: 26, borderRadius: 13,
                    background: glyph?.fill, color: glyph?.stroke,
                    alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 12, fontFamily: 'ui-monospace, monospace',
                    border: `1.5px solid ${glyph?.stroke}`,
                    boxShadow: selected ? `0 0 14px ${glyph.aura}` : 'none',
                  }}>{glyph?.label}</span>
                  <strong style={{ fontSize: 13 }}>{iv.name}</strong>
                </div>
                <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 8, lineHeight: 1.4 }}>{iv.short}</div>
                <div style={{ display: 'flex', gap: 6, fontSize: 11, flexWrap: 'wrap' }}>
                  <span style={costBadge(affordable)}>${iv.cost}</span>
                  {iv.upkeep > 0 && <span style={costBadge(true, 'rgba(30,41,59,0.7)', '#94a3b8')}>upkeep ${iv.upkeep}/yr</span>}
                  {iv.maturityYears > 1 && <span style={costBadge(true, 'rgba(30,41,59,0.7)', '#94a3b8')}>{iv.maturityYears}-yr ramp</span>}
                </div>
                {selected && (
                  <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 10, color: glyph.stroke, fontWeight: 700 }}>
                    READY · click map
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Policies row */}
      <div style={glassPanel}>
        <h4 style={panelTitleStyle}>Watershed-wide policies</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.values(POLICIES).map(p => {
            const active = state.activePolicies.has(p.id)
            return (
              <button key={p.id} onClick={() => { togglePolicy(state, p.id); forceRender() }}
                title={p.description}
                style={{
                  padding: '9px 14px',
                  borderRadius: 999,
                  background: active ? 'rgba(34,197,94,0.18)' : 'rgba(15,23,42,0.55)',
                  border: `1px solid ${active ? '#22c55e' : 'rgba(148,163,184,0.18)'}`,
                  color: active ? '#bbf7d0' : '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  boxShadow: active ? '0 0 18px rgba(34,197,94,0.25)' : 'none',
                  transition: 'box-shadow 0.18s, background 0.18s',
                }}>
                {active ? '✓ ' : ''}{p.name} · ${p.annualCost}/yr
              </button>
            )
          })}
        </div>
      </div>

      {/* Causal timeline */}
      <div style={glassPanel}>
        <h4 style={panelTitleStyle}>Causal timeline</h4>
        <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {events.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>No events yet — start the simulation to see weather, ecology, and policy effects.</div>}
          {events.map((e, i) => (
            <div key={state.events.length - i} style={{
              display: 'flex', gap: 8, alignItems: 'baseline',
              fontSize: 12, padding: '5px 10px', borderRadius: 8,
              background: 'rgba(15,23,42,0.55)',
              borderLeft: `3px solid ${severityColor(e.severity)}`,
              animation: i === 0 ? 'wd2-event-in 240ms ease-out' : undefined,
            }}>
              <span style={{ color: '#94a3b8', fontFamily: 'ui-monospace, monospace', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
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

      {/* One-shot CSS keyframes */}
      <style>{`
        @keyframes wd2-toast-in {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes wd2-event-in {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes wd2-count {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────
function Pill({ label, value, sub, tone, bar }) {
  const toneColor = tone ? TONE_COLOR[tone] : '#cbd5e1'
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 12,
      background: 'rgba(15,23,42,0.55)',
      border: '1px solid rgba(148,163,184,0.18)',
      minWidth: 110,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: toneColor, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#64748b' }}>{sub}</div>}
      {bar != null && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, width: `${clamp(bar, 0, 100)}%`, background: toneColor, transition: 'width 220ms ease-out' }} />
      )}
    </div>
  )
}

function SparkPill({ label, value, tone, hist }) {
  const toneColor = tone ? TONE_COLOR[tone] : '#cbd5e1'
  const w = 78, h = 22
  let path = ''
  if (hist?.length > 1) {
    const lo = 0, hi = 100
    path = hist.map((v, i) => {
      const x = (i / (hist.length - 1)) * w
      const y = h - ((v - lo) / (hi - lo)) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 12,
      background: 'rgba(15,23,42,0.55)',
      border: '1px solid rgba(148,163,184,0.18)',
      minWidth: 130,
    }}>
      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: toneColor, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        <svg width={w} height={h} style={{ display: 'block' }}>
          {path && <path d={path} fill="none" stroke={toneColor} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />}
        </svg>
      </div>
    </div>
  )
}

function SeasonRing({ tick, year, season }) {
  const day = tick % TICKS_PER_YEAR
  const angle = (day / TICKS_PER_YEAR) * Math.PI * 2 - Math.PI / 2
  const r = 18
  const cx = 22, cy = 22
  const handX = cx + Math.cos(angle) * r
  const handY = cy + Math.sin(angle) * r
  const seasonColor = season === 'winter' ? '#7dd3fc' : season === 'spring' ? '#86efac' : season === 'summer' ? '#fde68a' : '#fdba74'
  return (
    <div style={{
      width: 64, height: 44,
      display: 'flex', alignItems: 'center', gap: 8,
      paddingRight: 4,
    }}>
      <svg width={44} height={44}>
        <circle cx={cx} cy={cy} r={r + 2} fill="rgba(15,23,42,0.6)" stroke="rgba(148,163,184,0.25)" strokeWidth="1" />
        {/* Season quadrants */}
        {['#7dd3fc','#86efac','#fde68a','#fdba74'].map((c, i) => {
          const start = -Math.PI / 2 + (i / 4) * Math.PI * 2
          const end   = -Math.PI / 2 + ((i + 1) / 4) * Math.PI * 2
          const x1 = cx + Math.cos(start) * r
          const y1 = cy + Math.sin(start) * r
          const x2 = cx + Math.cos(end) * r
          const y2 = cy + Math.sin(end) * r
          return <path key={i} d={`M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`} fill={c} opacity="0.18" />
        })}
        <line x1={cx} y1={cy} x2={handX.toFixed(1)} y2={handY.toFixed(1)} stroke={seasonColor} strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={2} fill={seasonColor} />
      </svg>
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        <div style={{ color: seasonColor, fontWeight: 700, textTransform: 'uppercase' }}>{season}</div>
        <div style={{ fontFamily: 'ui-monospace, monospace' }}>Y{year + 1}·d{day + 1}</div>
      </div>
    </div>
  )
}

function CCMEGauge({ label, value, kind, unit = '', digits = 1 }) {
  const range = GAUGE_RANGE[kind]
  const color = ccmeColor(kind, value)
  const pct = range ? clamp(((value - range.min) / (range.max - range.min)) * 100, 0, 100) : 0
  return (
    <div style={{ padding: '5px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
        <span style={{ color: '#cbd5e1' }}>{label}</span>
        <span style={{ color, fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {fmt(value, digits)}{unit ? <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 3 }}>{unit}</span> : null}
        </span>
      </div>
      {range && (
        <div style={{ position: 'relative', height: 6, marginTop: 4, borderRadius: 3, overflow: 'hidden', background: '#0b1224', border: '1px solid rgba(148,163,184,0.15)' }}>
          {range.bands.map((b, i) => {
            const left  = ((b.lo - range.min) / (range.max - range.min)) * 100
            const right = ((b.hi - range.min) / (range.max - range.min)) * 100
            return (
              <div key={i} style={{
                position: 'absolute', left: `${left}%`, width: `${right - left}%`, top: 0, bottom: 0,
                background: b.t === 'safe' ? 'rgba(34,197,94,0.55)' : b.t === 'warning' ? 'rgba(245,158,11,0.55)' : 'rgba(239,68,68,0.55)',
              }} />
            )
          })}
          <div style={{
            position: 'absolute', top: -2, bottom: -2, left: `${pct}%`, width: 2, marginLeft: -1,
            background: '#fff', boxShadow: '0 0 4px rgba(255,255,255,0.6)', transition: 'left 220ms ease-out',
          }} />
        </div>
      )}
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
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed rgba(148,163,184,0.2)' }}>
        <LoadBar label="Nutrient" value={cell.nutrient} max={6}  color="#ef4444" />
        <LoadBar label="Sediment" value={cell.sediment} max={12} color="#f59e0b" />
        <LoadBar label="Chloride" value={cell.chloride} max={40} color="#a78bfa" />
        <LoadBar label="Toxics"   value={cell.toxics}   max={1.2} color="#ec4899" />
      </div>
      {intervention && (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#bbf7d0' }}>{intervention.name}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Age: {cell.interventionAge} yr · maturity {intervention.maturityYears} yr</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{intervention.short}</div>
        </div>
      )}
    </div>
  )
}

function LoadBar({ label, value, max, color }) {
  const t = clamp(value / max, 0, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 3 }}>
      <span style={{ color: '#94a3b8', minWidth: 64 }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: '#0b1224', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.12)' }}>
        <div style={{ width: `${t * 100}%`, height: '100%', background: color, transition: 'width 200ms ease-out' }} />
      </div>
      <span style={{ color: '#cbd5e1', fontFamily: 'ui-monospace, monospace', minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(value, 2)}</span>
    </div>
  )
}

function useCountUp(target, duration = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let raf
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      setV(Math.round(easeOutCubic(t) * target))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

function YearReportCard({ report, onClose }) {
  const verdict = verdictForScore(report.score)
  const score = useCountUp(report.score, 800)
  const ccme  = useCountUp(report.overallCompliance, 800)
  const eco   = useCountUp(report.ecoIndex, 800)
  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 560, animation: 'wd2-count 280ms ease-out' }}>
        <div style={{ background: verdict.tone === 'good' ? 'linear-gradient(135deg,#10b981,#0ea5e9)' : verdict.tone === 'warning' ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#7f1d1d,#dc2626)', padding: '18px 22px', color: '#fff' }}>
          <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.85, textTransform: 'uppercase' }}>Year {report.year + 1} report</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>Score {score} · {verdict.band}</div>
        </div>
        <div style={{ padding: 20, color: '#e2e8f0' }}>
          <p style={{ fontSize: 13, color: '#cbd5e1', marginTop: 0 }}>{verdict.text}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <Stat label="CCME compliance" value={`${ccme}%`} />
            <Stat label="Ecosystem index" value={eco} />
            <Stat label="Algae blooms"    value={report.blooms}      tone={report.blooms > 0 ? 'critical' : 'safe'} />
            <Stat label="Species collapses" value={report.collapses} tone={report.collapses > 0 ? 'critical' : 'safe'} />
            <Stat label="Trust delta"     value={(report.trustDelta >= 0 ? '+' : '') + report.trustDelta} tone={report.trustDelta >= 0 ? 'safe' : 'critical'} />
            <Stat label="Samples"         value={report.samples} />
          </div>
          <h4 style={{ ...panelTitleStyle, marginTop: 18 }}>Per-parameter compliance</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <ComplianceRow label="pH"           pct={report.compliance.pH} />
            <ComplianceRow label="DO"           pct={report.compliance.do} />
            <ComplianceRow label="Turbidity"    pct={report.compliance.turbidity} />
            <ComplianceRow label="Conductivity" pct={report.compliance.conductivity} />
            <ComplianceRow label="Toxics"       pct={report.compliance.toxics} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button onClick={onClose} style={{ ...btnStyle('#22c55e'), padding: '10px 20px' }}>Continue →</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RunEndCard({ score, verdict, reports, onPlayAgain, onExit }) {
  const animScore = useCountUp(score, 1100)
  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 600, animation: 'wd2-count 320ms ease-out' }}>
        <div style={{
          background: verdict.tone === 'good' ? 'linear-gradient(135deg,#10b981,#06b6d4)'
                     : verdict.tone === 'warning' ? 'linear-gradient(135deg,#f59e0b,#ef4444)'
                     : 'linear-gradient(135deg,#7f1d1d,#dc2626)',
          padding: '20px 22px', color: '#fff',
        }}>
          <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.85, textTransform: 'uppercase' }}>5-year run complete</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>Watershed: {verdict.band}</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>Avg composite score {animScore}/100</div>
        </div>
        <div style={{ padding: 20, color: '#e2e8f0' }}>
          <p style={{ fontSize: 13, color: '#cbd5e1', marginTop: 0 }}>{verdict.text}</p>
          <h4 style={{ ...panelTitleStyle, marginTop: 14 }}>Year-by-year</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {reports.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 10px', background: 'rgba(15,23,42,0.55)', borderRadius: 8 }}>
                <span>Year {r.year + 1}</span>
                <span style={{ color: r.score >= 65 ? '#86efac' : r.score >= 45 ? '#fbbf24' : '#f87171', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {r.score} · CCME {r.overallCompliance}% · eco {r.ecoIndex}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <button onClick={onPlayAgain} style={btnStyle('rgba(30,41,59,0.9)')}>↻ New run</button>
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
    <div style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function ComplianceRow({ label, pct }) {
  const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#a3e635' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ color: '#cbd5e1', minWidth: 92 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: '#0b1224', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.15)' }}>
        <div style={{ width: `${Math.max(2, pct)}%`, height: '100%', background: color, transition: 'width 700ms ease-out' }} />
      </div>
      <span style={{ color, fontWeight: 700, minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
    </div>
  )
}

// ── Inline style helpers ───────────────────────────────────────────────────
const glassPanel = {
  background: 'rgba(15,23,42,0.55)',
  border: '1px solid rgba(148,163,184,0.18)',
  borderRadius: 14,
  padding: 14,
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 28px rgba(2,6,23,0.35)',
}
const glassStrip = {
  ...glassPanel,
  padding: '10px 14px',
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
}
const panelTitleStyle = { margin: '0 0 10px 0', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.78)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }
const modalStyle = { width: '100%', background: '#0f172a', borderRadius: 18, border: '1px solid rgba(148,163,184,0.2)', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }
const kbdStyle = { fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#0b1224', border: '1px solid #475569', color: '#7dd3fc', fontFamily: 'monospace' }
function btnStyle(bg) {
  return { padding: '8px 14px', borderRadius: 10, background: bg, color: '#fff', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'transform 0.08s, box-shadow 0.12s' }
}
function costBadge(affordable, bg, fg) {
  return {
    padding: '2px 7px', borderRadius: 6,
    background: bg ?? (affordable ? 'rgba(34,197,94,0.15)' : 'rgba(127,29,29,0.4)'),
    color: fg ?? (affordable ? '#86efac' : '#fca5a5'),
    fontWeight: 700,
  }
}
