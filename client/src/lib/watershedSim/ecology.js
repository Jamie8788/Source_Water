// Ecological response model: brook trout (cold-water sentinel), mayfly index
// (clean-water bioindicator), beach-closure events from algae blooms.
//
// All populations are abstract indices [0..100] that respond to lake/outlet
// chemistry. The behaviour is qualitatively grounded in known stressor
// thresholds (CCME aquatic life, Henry's Law for DO, chloride toxicity for
// mayfly nymphs) but the values are simulation, not measurement.

import { seasonOf } from './hydrology.js'

// Per-tick ecological update. Mutates state.eco in place.
export function tickEcology(state) {
  const o = state.outlet
  if (!o) return
  const eco = state.eco
  const season = seasonOf(state.tick)

  // ── Brook trout ──────────────────────────────────────────────────────────
  // Stressors: water temp > 20°C, DO < 5, turbidity smothers spawning beds in fall
  let troutStress = 0
  if (o.temp > 22) troutStress += (o.temp - 22) * 1.6
  else if (o.temp > 19) troutStress += (o.temp - 19) * 0.7
  if (o.do < 5)   troutStress += (5 - o.do) * 1.8
  if (season === 'fall' && o.turbidity > 25) troutStress += (o.turbidity - 25) * 0.04
  // Recovery in cool, well-oxygenated, clean conditions
  let troutRecover = 0
  if (o.temp < 16 && o.do > 7 && o.turbidity < 15) troutRecover = 0.18
  else if (o.temp < 19 && o.do > 6) troutRecover = 0.06
  eco.trout += troutRecover - troutStress * 0.05
  if (eco.trout < 0) eco.trout = 0
  if (eco.trout > 100) eco.trout = 100
  if (eco.trout < 5 && !eco._troutCollapseLogged) {
    state.events.push({ tick: state.tick, kind: 'trout_collapse',
      msg: 'Brook trout population collapsed in mid-river reach',
      severity: 'high' })
    eco._troutCollapseLogged = true
  } else if (eco.trout > 25 && eco._troutCollapseLogged) {
    state.events.push({ tick: state.tick, kind: 'trout_recovery',
      msg: 'Brook trout returning — population rebuilding',
      severity: 'good' })
    eco._troutCollapseLogged = false
  }

  // ── Mayfly nymph index ───────────────────────────────────────────────────
  // Highly sensitive to chloride and chronic DO depression. Recovers very slowly.
  let mayflyStress = 0
  if (o.conductivity > 800)  mayflyStress += (o.conductivity - 800) * 0.004
  if (o.conductivity > 1500) mayflyStress += (o.conductivity - 1500) * 0.012
  if (o.do < 6)              mayflyStress += (6 - o.do) * 0.9
  if (o.toxics > 1)          mayflyStress += o.toxics * 0.6
  let mayflyRecover = 0
  if (o.conductivity < 400 && o.do > 7 && o.toxics < 0.3) mayflyRecover = 0.10
  eco.mayfly += mayflyRecover - mayflyStress * 0.04
  if (eco.mayfly < 0) eco.mayfly = 0
  if (eco.mayfly > 100) eco.mayfly = 100
  if (eco.mayfly < 8 && !eco._mayflyCollapseLogged) {
    state.events.push({ tick: state.tick, kind: 'mayfly_loss',
      msg: 'Mayfly nymphs absent — chronic stress signal',
      severity: 'medium' })
    eco._mayflyCollapseLogged = true
  } else if (eco.mayfly > 30 && eco._mayflyCollapseLogged) {
    state.events.push({ tick: state.tick, kind: 'mayfly_return',
      msg: 'Mayfly nymphs returning — water-quality milestone',
      severity: 'good' })
    eco._mayflyCollapseLogged = false
  }

  // ── Bloom events / beach closure ─────────────────────────────────────────
  // When lake algae crosses bloom thresholds during summer, log discrete events
  // (one per crossing, not every tick).
  const a = state.lake.algae
  if (a > 6 && !eco._bloomActive) {
    state.events.push({ tick: state.tick, kind: 'bloom_start',
      msg: 'Algal bloom detected in lake — beach advisory issued',
      severity: 'high' })
    eco._bloomActive = true
  } else if (a < 3 && eco._bloomActive) {
    state.events.push({ tick: state.tick, kind: 'bloom_end',
      msg: 'Bloom subsided — water clears',
      severity: 'good' })
    eco._bloomActive = false
  }
}
