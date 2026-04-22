// Headless smoke test: run the watershedSim engine for 5 simulated years and
// assert no NaN / no thrown errors. Run with: node scripts/smoke-watershed-v2.mjs
import {
  createGameState,
  tickGame,
  placeIntervention,
  togglePolicy,
  INTERVENTIONS,
  TICKS_PER_YEAR,
} from '../client/src/lib/watershedSim/index.js'

const state = createGameState({ cols: 22, rows: 16, seed: 42 })

// Place a couple of interventions to exercise that code path.
const cropCells = state.terrain.cells.filter(c => c.landUse === 'agriculture').slice(0, 6)
for (const c of cropCells) placeIntervention(state, c, 'cover_crops')
togglePolicy(state, 'fertilizer_ordinance')

const totalTicks = TICKS_PER_YEAR * 5
let bad = 0
for (let i = 0; i < totalTicks; i++) {
  tickGame(state)
  const o = state.outlet
  if (o) {
    for (const k of Object.keys(o)) {
      if (typeof o[k] === 'number' && !Number.isFinite(o[k])) {
        console.error(`Tick ${i}: outlet.${k} is non-finite:`, o[k])
        bad++
      }
    }
  }
  if (!Number.isFinite(state.lake.algae) || !Number.isFinite(state.lake.do)) {
    console.error(`Tick ${i}: lake state non-finite`, state.lake)
    bad++
  }
  if (bad > 5) { console.error('Too many failures, aborting.'); break }
}

console.log('Year reports:')
for (const r of state.yearReports) {
  console.log(`  Y${r.year + 1}: score=${r.score} ccme=${r.overallCompliance}% eco=${r.ecoIndex} blooms=${r.blooms} collapses=${r.collapses}`)
}
console.log(`Final budget: $${Math.round(state.budget)}, trust ${Math.round(state.publicTrust)}%`)
console.log(`Events logged: ${state.events.length}`)
console.log(bad === 0 ? '\nSMOKE OK' : `\nSMOKE FAILED (${bad} non-finite values)`)
process.exit(bad === 0 ? 0 : 1)
