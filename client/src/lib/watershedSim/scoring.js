// Year-end scoring. Aggregates per-tick outlet samples taken throughout the
// year into a single CCME-style aquatic-life compliance percentage and an
// ecosystem health index, then issues a year-end report.

// CCME aquatic-life thresholds (consistent with our existing waterParams.js).
const THRESHOLDS = {
  pH:           { lo: 6.5, hi: 9.0 },     // outside = non-compliant
  do:           { lo: 6.0 },              // mg/L; below = non-compliant
  turbidity:    { hi: 25 },               // NTU
  conductivity: { hi: 800 },              // µS/cm — chloride proxy chronic
  toxics:       { hi: 0.5 },              // arbitrary index
}

export function sampleOutletForScoring(state) {
  if (!state.outlet) return
  state._yearSamples.push({ ...state.outlet })
}

export function computeYearScore(state) {
  const samples = state._yearSamples
  if (!samples.length) return null
  const total = samples.length
  const passing = {
    pH: 0, do: 0, turbidity: 0, conductivity: 0, toxics: 0,
  }
  for (const s of samples) {
    if (s.pH >= THRESHOLDS.pH.lo && s.pH <= THRESHOLDS.pH.hi) passing.pH++
    if (s.do >= THRESHOLDS.do.lo) passing.do++
    if (s.turbidity <= THRESHOLDS.turbidity.hi) passing.turbidity++
    if (s.conductivity <= THRESHOLDS.conductivity.hi) passing.conductivity++
    if (s.toxics <= THRESHOLDS.toxics.hi) passing.toxics++
  }
  const pct = (n) => Math.round((n / total) * 100)
  const compliance = {
    pH:           pct(passing.pH),
    do:           pct(passing.do),
    turbidity:    pct(passing.turbidity),
    conductivity: pct(passing.conductivity),
    toxics:       pct(passing.toxics),
  }
  const overallCompliance = Math.round(
    (compliance.pH + compliance.do + compliance.turbidity + compliance.conductivity + compliance.toxics) / 5
  )
  // Ecosystem index: arithmetic mean of trout + mayfly indices, current state
  const ecoIndex = Math.round((state.eco.trout + state.eco.mayfly) / 2)
  // Composite "watershed health" score 0–100
  const score = Math.round(0.6 * overallCompliance + 0.4 * ecoIndex)
  // Public trust delta: rewards visible improvement, penalizes blooms/collapses
  const blooms = state.events.filter(e =>
    e.tick >= state._yearStartTick && e.tick < state.tick && e.kind === 'bloom_start'
  ).length
  const collapses = state.events.filter(e =>
    e.tick >= state._yearStartTick && e.tick < state.tick &&
    (e.kind === 'trout_collapse' || e.kind === 'mayfly_loss')
  ).length
  const trustDelta = Math.round((overallCompliance - 50) / 5) - blooms * 4 - collapses * 3
  return {
    year: state.year,
    samples: total,
    compliance,
    overallCompliance,
    ecoIndex,
    score,
    blooms,
    collapses,
    trustDelta,
  }
}

// Verdict text — tied to score band, no pretense of citing real data.
export function verdictForScore(score) {
  if (score >= 85) return {
    band: 'Restored', tone: 'good',
    text: 'Watershed is in restored, sustainable condition. Aquatic-life thresholds met across most of the year and indicator species are recovering.'
  }
  if (score >= 65) return {
    band: 'Recovering', tone: 'good',
    text: 'Clear improvement trajectory. Targeted further action on the dominant remaining stressor would push the system into restored state.'
  }
  if (score >= 45) return {
    band: 'Mixed', tone: 'warning',
    text: 'Conditions are mixed. Some compliance gains offset by ongoing stressors. Persistent intervention needed.'
  }
  if (score >= 25) return {
    band: 'Degraded', tone: 'warning',
    text: 'Watershed is degraded. Indicator species under chronic stress. Without sustained intervention, regime shift to a eutrophic state is plausible.'
  }
  return {
    band: 'Collapsed', tone: 'critical',
    text: 'Aquatic-life thresholds rarely met. Indicator species absent or near zero. Recovery from this state in real watersheds is measured in decades.'
  }
}
