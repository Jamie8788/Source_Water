// Watershed Defender V2 — engine entry point.
// Exposes createGameState(), tickGame(), placeIntervention(), advanceYear().

import { createTerrain, LAND_USE } from './terrain.js'
import { tickHydrology, TICKS_PER_YEAR, yearOf } from './hydrology.js'
import { tickEcology } from './ecology.js'
import { INTERVENTIONS, POLICIES, ANNUAL_BUDGET_BASE, budgetForYear } from './interventions.js'
import { sampleOutletForScoring, computeYearScore, verdictForScore } from './scoring.js'

export { LAND_USE, INTERVENTIONS, POLICIES }
export { TICKS_PER_YEAR }
export { verdictForScore }

// Mulberry32 PRNG — deterministic given a seed.
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createGameState({ cols = 24, rows = 18, seed = 1 } = {}) {
  const terrain = createTerrain({ cols, rows, seed })
  const elevationOrder = terrain.cells
    .filter(c => c.elev >= 0)
    .slice()
    .sort((a, b) => b.elev - a.elev)

  return {
    // Identity
    seed,
    terrain,
    interventionDefs: INTERVENTIONS,
    policyDefs: POLICIES,

    // Time
    tick: 0,
    year: 0,
    paused: true,
    speed: 1,            // ticks per render frame (1, 2, 4, 8)

    // PRNG
    rng: mulberry32(seed * 7919 + 13),

    // Lake state (single mixed pool — see hydrology.updateLakeAndOutlet)
    lake: { temp: 4, algae: 1.5, do: 11, pH: 7.6 },

    // Outlet snapshot — populated each tick
    outlet: null,

    // Weather snapshot — populated each tick
    weather: null,

    // Ecology indices
    eco: {
      trout: 78,
      mayfly: 70,
      _troutCollapseLogged: false,
      _mayflyCollapseLogged: false,
      _bloomActive: false,
    },

    // Player resources
    budget: ANNUAL_BUDGET_BASE,
    publicTrust: 60,
    activePolicies: new Set(),
    policyMods: { N: 1, P: 1, sed: 1, salt: 1, tox: 1 },

    // Causal timeline (most recent at end). Capped via shifting in renderer.
    events: [
      { tick: 0, kind: 'start',
        msg: 'Simulation begins. Baseline survey of watershed complete.',
        severity: 'info' },
    ],

    // Per-year accumulators (reset on advanceYear)
    _yearStartTick: 0,
    _yearSamples: [],
    yearReports: [],   // history of computeYearScore outputs

    // Cached for hydrology transport
    _elevationOrder: elevationOrder,
  }
}

// Drive one engine tick.
export function tickGame(state) {
  tickHydrology(state)
  tickEcology(state)
  // Sample outlet every 6 ticks for scoring (~ weekly)
  if (state.tick % 6 === 0) sampleOutletForScoring(state)

  // Year boundary check
  if (yearOf(state.tick) > state.year) {
    finishYear(state)
  }
}

function finishYear(state) {
  const report = computeYearScore(state)
  if (report) {
    state.yearReports.push(report)
    state.publicTrust = Math.max(0, Math.min(100, state.publicTrust + report.trustDelta))
    state.events.push({ tick: state.tick, kind: 'year_end',
      msg: `Year ${state.year + 1} complete — score ${report.score} (${verdictForScore(report.score).band})`,
      severity: report.score >= 65 ? 'good' : report.score >= 45 ? 'medium' : 'high',
      report,
    })
    // Roll budget for next year, +annual upkeep deductions, +policy costs
    let nextBudget = budgetForYear(report.overallCompliance) + state.budget    // unspent rolls over partly
    // Deduct upkeep for placed interventions
    for (const cell of state.terrain.cells) {
      if (cell.intervention) {
        cell.interventionAge += 1
        const def = INTERVENTIONS[cell.intervention]
        if (def?.upkeep) nextBudget -= def.upkeep
      }
    }
    // Deduct policies
    for (const pid of state.activePolicies) {
      const p = POLICIES[pid]
      if (p) nextBudget -= p.annualCost
    }
    state.budget = Math.max(0, nextBudget)
  }
  state.year += 1
  state._yearStartTick = state.tick
  state._yearSamples = []
}

// Attempt to place an intervention on a cell. Returns { ok, reason }.
export function placeIntervention(state, cell, interventionId) {
  const def = INTERVENTIONS[interventionId]
  if (!def) return { ok: false, reason: 'Unknown intervention' }
  if (state.budget < def.cost) return { ok: false, reason: 'Insufficient budget' }
  const check = def.canPlace(cell, state.terrain)
  if (!check.ok) return check
  cell.intervention = def.id
  cell.interventionAge = 0
  if (def.converts) cell.landUse = def.converts
  state.budget -= def.cost
  state.events.push({ tick: state.tick, kind: 'intervention_placed',
    msg: `${def.name} placed at parcel (${cell.c}, ${cell.r})`,
    severity: 'info' })
  return { ok: true }
}

export function removeIntervention(state, cell) {
  if (!cell.intervention) return { ok: false, reason: 'Nothing to remove' }
  cell.intervention = null
  cell.interventionAge = 0
  // Note: landUse is NOT reverted (a wetland built on former cropland stays a wetland visually)
  return { ok: true }
}

export function togglePolicy(state, policyId) {
  const def = POLICIES[policyId]
  if (!def) return { ok: false, reason: 'Unknown policy' }
  if (state.activePolicies.has(policyId)) {
    state.activePolicies.delete(policyId)
  } else {
    if (state.budget < def.annualCost) return { ok: false, reason: 'Insufficient budget for first year' }
    state.activePolicies.add(policyId)
    state.budget -= def.annualCost
    state.events.push({ tick: state.tick, kind: 'policy_enacted',
      msg: `${def.name} enacted`, severity: 'info' })
  }
  // Recompute policyMods from scratch
  state.policyMods = { N: 1, P: 1, sed: 1, salt: 1, tox: 1 }
  for (const pid of state.activePolicies) POLICIES[pid].apply(state.policyMods)
  return { ok: true }
}
