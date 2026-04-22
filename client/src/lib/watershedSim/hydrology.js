// Per-tick hydrology: pollutant generation, transport, weather, season.
// Tick = ~1 sim-day. 90 ticks per season, 360 per year.
//
// All numbers are simulation-scaled, NOT real measurements. They are tuned so
// that under default conditions a watershed degrades at a realistic-feeling
// rate (years to flip a lake to eutrophic state without intervention).

import { LAND_USE, neighborOffsets } from './terrain.js'

export const SEASONS = ['spring', 'summer', 'fall', 'winter']
export const TICKS_PER_SEASON = 90
export const TICKS_PER_YEAR = TICKS_PER_SEASON * 4

export function seasonOf(tick) {
  return SEASONS[Math.floor((tick % TICKS_PER_YEAR) / TICKS_PER_SEASON)]
}
export function yearOf(tick) {
  return Math.floor(tick / TICKS_PER_YEAR)
}

// Per-land-use baseline pollutant generation per cell per tick.
// Units arbitrary but internally consistent.
const GEN = {
  [LAND_USE.FOREST]:      { N: 0.02, P: 0.005, sed: 0.05, salt: 0,    tox: 0    },
  [LAND_USE.RIPARIAN]:    { N: 0.03, P: 0.008, sed: 0.04, salt: 0,    tox: 0    },
  [LAND_USE.AGRICULTURE]: { N: 0.85, P: 0.18,  sed: 0.65, salt: 0.02, tox: 0    },
  [LAND_USE.URBAN]:       { N: 0.18, P: 0.05,  sed: 0.25, salt: 0.55, tox: 0.04 },
  [LAND_USE.INDUSTRIAL]:  { N: 0.30, P: 0.08,  sed: 0.45, salt: 0.20, tox: 0.55 },
  [LAND_USE.WETLAND]:     { N: 0.01, P: 0.002, sed: 0.02, salt: 0,    tox: 0    },
  [LAND_USE.STREAM]:      { N: 0,    P: 0,     sed: 0,    salt: 0,    tox: 0    },
  [LAND_USE.LAKE]:        { N: 0,    P: 0,     sed: 0,    salt: 0,    tox: 0    },
}

// Seasonal multipliers for pollutant generation (broad strokes).
const SEASON_GEN_MULT = {
  spring: { N: 2.2, P: 1.8, sed: 3.0, salt: 0.3, tox: 1.0 }, // snowmelt + first-flush
  summer: { N: 0.8, P: 0.9, sed: 0.5, salt: 0.0, tox: 1.1 }, // low flow
  fall:   { N: 1.4, P: 1.2, sed: 1.1, salt: 0.0, tox: 1.0 }, // leaf litter, manure spreading
  winter: { N: 0.4, P: 0.3, sed: 0.2, salt: 4.0, tox: 0.7 }, // road salt season
}

// Lake water temperature driver (°C) — drives algal growth and DO sag.
const SEASON_LAKE_TEMP = { spring: 8, summer: 22, fall: 11, winter: 2 }

// Stochastic weather events. Returned per tick.
export function rollWeather(tick, rng) {
  const season = seasonOf(tick)
  let runoffMult = 1
  let event = null
  // Heavy storm
  const stormP = season === 'spring' ? 0.04 : season === 'summer' ? 0.03 : season === 'fall' ? 0.025 : 0.005
  if (rng() < stormP) {
    runoffMult = 3.2 + rng() * 1.6
    event = { kind: 'storm', mag: runoffMult }
  } else if (season === 'summer' && rng() < 0.012) {
    runoffMult = 0.3
    event = { kind: 'drought', mag: 0 }
  } else if (season === 'spring' && rng() < 0.008) {
    event = { kind: 'manure_spill', mag: 12 }   // localized — handled in apply
  } else if (rng() < 0.003) {
    event = { kind: 'sewage_bypass', mag: 8 }
  }
  return { runoffMult, event }
}

// Apply intervention attenuation to a generation vector for a cell.
// Returns a NEW pollutant object {N, P, sed, salt, tox}.
function applyInterventionToGeneration(cell, gen, interventionDef) {
  if (!interventionDef || !interventionDef.attenuate) return gen
  // Maturity ramp: most interventions need 1-2 years to reach full effect
  const maturity = Math.min(1, cell.interventionAge / Math.max(1, interventionDef.maturityYears || 1))
  const out = { ...gen }
  for (const k of Object.keys(out)) {
    const reduction = (interventionDef.attenuate[k] || 0) * maturity
    out[k] = out[k] * (1 - reduction)
  }
  return out
}

// Per-tick generation pass — adds load to each cell based on land use + season + weather.
// Mutates cells in place.
export function generatePollutants(state, weather) {
  const { cells } = state.terrain
  const season = seasonOf(state.tick)
  const sm = SEASON_GEN_MULT[season]
  const interventions = state.interventionDefs

  for (const cell of cells) {
    const base = GEN[cell.landUse]
    if (!base) continue
    const intervDef = cell.intervention ? interventions[cell.intervention] : null
    // Base × season × weather (runoff multiplier scales sediment/N/P most)
    let g = {
      N:    base.N    * sm.N    * weather.runoffMult,
      P:    base.P    * sm.P    * weather.runoffMult,
      sed:  base.sed  * sm.sed  * weather.runoffMult,
      salt: base.salt * sm.salt,
      tox:  base.tox  * sm.tox,
    }
    // Local intervention reduces generation at source (cover crops, bioswale)
    g = applyInterventionToGeneration(cell, g, intervDef)
    // Watershed-wide policies are applied as a blanket scalar in state.policyMods
    if (state.policyMods) {
      g.N    *= state.policyMods.N    ?? 1
      g.P    *= state.policyMods.P    ?? 1
      g.sed  *= state.policyMods.sed  ?? 1
      g.salt *= state.policyMods.salt ?? 1
      g.tox  *= state.policyMods.tox  ?? 1
    }
    cell.nutrient += g.N + g.P
    cell.sediment += g.sed
    cell.chloride += g.salt
    cell.toxics   += g.tox
  }

  // Stochastic local events (manure spill on a random ag cell, sewage bypass on urban)
  if (weather.event?.kind === 'manure_spill') {
    const targets = cells.filter(c => c.landUse === LAND_USE.AGRICULTURE)
    if (targets.length) {
      const t = targets[(state.rng() * targets.length) | 0]
      t.nutrient += weather.event.mag * 8
      t.sediment += weather.event.mag * 2
      state.events.push({ tick: state.tick, kind: 'manure_spill', cell: [t.c, t.r],
        msg: `Manure spill on agricultural parcel (${t.c}, ${t.r})`, severity: 'high' })
    }
  }
  if (weather.event?.kind === 'sewage_bypass') {
    const targets = cells.filter(c => c.landUse === LAND_USE.URBAN || c.landUse === LAND_USE.INDUSTRIAL)
    if (targets.length) {
      const t = targets[(state.rng() * targets.length) | 0]
      t.nutrient += weather.event.mag * 10
      t.toxics   += weather.event.mag * 0.5
      state.events.push({ tick: state.tick, kind: 'sewage_bypass', cell: [t.c, t.r],
        msg: `Sewage bypass at urban outfall (${t.c}, ${t.r})`, severity: 'high' })
    }
  }
}

// Per-tick downstream transport: process cells from highest elevation down.
// Each cell sheds a fraction of its load to its downstream neighbour; the
// remainder partially decays (uptake, settling) according to its land use
// and any wetland/pond intervention sitting on it.
export function transportPollutants(state) {
  const { cells, idx } = state.terrain
  const interventions = state.interventionDefs

  // Process cells high → low so transfers cascade in one pass per tick.
  // Elevation order is precomputed and cached in state.
  const order = state._elevationOrder
  for (const cell of order) {
    if (!cell.flowToward) continue
    const intervDef = cell.intervention ? interventions[cell.intervention] : null
    // Default routing: streams move 92% downstream per tick; land moves 35%
    let routeFrac = cell.isStream ? 0.92 : 0.35
    let sinkFrac  = 0
    // Wetland / detention pond intervention: more captured, less routed
    if (intervDef?.sink) {
      const maturity = Math.min(1, cell.interventionAge / Math.max(1, intervDef.maturityYears || 1))
      sinkFrac  = (intervDef.sink || 0) * maturity
      routeFrac = Math.max(0.1, routeFrac - sinkFrac)
    }
    // Compute outflows
    const moved = {
      nutrient: cell.nutrient * routeFrac,
      sediment: cell.sediment * routeFrac,
      chloride: cell.chloride * routeFrac,
      toxics:   cell.toxics   * routeFrac,
    }
    const sunk = {
      nutrient: cell.nutrient * sinkFrac,
      sediment: cell.sediment * sinkFrac,
      // Chloride is conservative — wetlands do NOT remove it. Only dilute.
      chloride: 0,
      toxics:   cell.toxics * sinkFrac * 0.5,
    }
    // Subtract outflow + sink from this cell
    cell.nutrient -= moved.nutrient + sunk.nutrient
    cell.sediment -= moved.sediment + sunk.sediment
    cell.chloride -= moved.chloride
    cell.toxics   -= moved.toxics + sunk.toxics
    // Add to downstream
    const [tc, tr] = cell.flowToward
    const ds = cells[idx(tc, tr)]
    ds.nutrient += moved.nutrient
    ds.sediment += moved.sediment
    ds.chloride += moved.chloride
    ds.toxics   += moved.toxics
  }

  // Background biological decay on land cells (not chloride — conservative)
  for (const cell of cells) {
    if (cell.landUse === LAND_USE.LAKE) continue   // lake handled separately
    cell.nutrient *= 0.985
    cell.sediment *= 0.97
    cell.toxics   *= 0.998
    if (cell.nutrient < 1e-4) cell.nutrient = 0
    if (cell.sediment < 1e-4) cell.sediment = 0
    if (cell.toxics   < 1e-6) cell.toxics   = 0
  }
}

// Lake mixing + algae growth + DO calculation.
// All lake cells share a single mixed pool for simplicity (representative of a
// well-mixed near-surface layer in a small lake / harbour).
export function updateLakeAndOutlet(state) {
  const { cells } = state.terrain
  const lakeCells = cells.filter(c => c.landUse === LAND_USE.LAKE)
  if (!lakeCells.length) return
  // Pool: total N+P, sediment, chloride concentrations averaged
  let totalN = 0, totalSed = 0, totalCl = 0, totalTox = 0
  for (const c of lakeCells) {
    totalN   += c.nutrient
    totalSed += c.sediment
    totalCl  += c.chloride
    totalTox += c.toxics
  }
  const n = lakeCells.length
  const avgN = totalN / n
  const avgSed = totalSed / n
  const avgCl = totalCl / n
  const avgTox = totalTox / n

  // Lake water temp: smooth toward seasonal driver
  const targetTemp = (function() {
    const base = { spring: 8, summer: 22, fall: 11, winter: 2 }[seasonOf(state.tick)]
    return base
  })()
  state.lake.temp += (targetTemp - state.lake.temp) * 0.04

  // Algae growth (cyanobacteria-like): logistic with limit driven by N+P + warmth
  const tempFactor   = Math.max(0, (state.lake.temp - 10) / 18)  // ramps in 10–28°C
  const nutrientFactor = Math.min(1, avgN / 6)                    // saturates
  const carryingCap = 1 + nutrientFactor * tempFactor * 9         // 1..10
  const growthRate  = 0.06 + 0.10 * tempFactor * nutrientFactor
  const a = state.lake.algae
  state.lake.algae = a + growthRate * a * (1 - a / carryingCap) * (1 + 0.05 * (state.rng() - 0.5))
  // Decay in cold seasons
  if (state.lake.temp < 6) state.lake.algae *= 0.94
  if (state.lake.algae < 0.5) state.lake.algae = 0.5

  // DO saturation falls with temperature (Henry's Law surrogate), and crashes
  // when bloom decomposes. Express as % saturation, clamp [0, 130].
  const doSatTemp = 14.6 - state.lake.temp * 0.32     // ~14.6 mg/L at 0°C, ~6.5 at 25°C
  const bloomDrag = Math.max(0, (state.lake.algae - 4) * 0.6)
  state.lake.do = Math.max(0.5, doSatTemp - bloomDrag)

  // Persist averages on lake cells for renderer
  for (const c of lakeCells) {
    c.nutrient = avgN * 0.985    // slight in-lake loss to sediment burial
    c.sediment = avgSed * 0.95
    c.chloride = avgCl            // conservative
    c.toxics   = avgTox * 0.999
  }

  // Outlet snapshot (used for scoring + HUD readout)
  const outlet = state.terrain.outletCell || lakeCells[0]
  state.outlet = {
    nutrient: avgN,
    sediment: avgSed,
    chloride: avgCl,
    toxics:   avgTox,
    temp:     state.lake.temp,
    do:       state.lake.do,
    pH:       state.lake.pH,           // updated below
    turbidity: avgSed * 4,             // sediment → NTU proxy
    conductivity: 50 + avgCl * 12,     // baseline + chloride driver
  }

  // pH drift: high algae growth → diel pH swings, here represented as a moving avg
  const pHTarget = state.lake.algae > 6 ? 9.0 : state.lake.algae > 3 ? 8.4 : 7.8
  state.lake.pH += (pHTarget - state.lake.pH) * 0.02
  state.outlet.pH = state.lake.pH
}

// Public per-tick driver. Mutates state.
export function tickHydrology(state) {
  const weather = rollWeather(state.tick, state.rng)
  state.weather = weather
  generatePollutants(state, weather)
  transportPollutants(state)
  updateLakeAndOutlet(state)
  state.tick += 1
}
