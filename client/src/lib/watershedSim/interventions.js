// Catalog of player-placed interventions and watershed-wide policies.
// Each entry encodes cost, placement rule, and how it modifies the
// hydrology engine (source attenuation OR in-transit sink). Watershed-wide
// policies live in state.policyMods and apply as a blanket multiplier.

import { LAND_USE, neighborOffsets } from './terrain.js'

// Helper: cell adjacent to any stream/lake?
function adjacentToWater(cell, terrain) {
  const { cells, idx, inBounds } = terrain
  for (const [dc, dr] of neighborOffsets(cell.r)) {
    const nc = cell.c + dc, nr = cell.r + dr
    if (!inBounds(nc, nr)) continue
    const ne = cells[idx(nc, nr)]
    if (ne.landUse === LAND_USE.STREAM || ne.landUse === LAND_USE.LAKE) return true
  }
  return false
}

// Each placement returns { ok, reason } so the UI can surface why it's invalid.
export const INTERVENTIONS = {
  riparian_buffer: {
    id: 'riparian_buffer',
    name: 'Riparian forest buffer',
    short: 'Vegetated streambank strip',
    description: 'A 10–30 m strip of native vegetation along a stream. Filters nutrients and sediment from runoff crossing it before it reaches the channel. Cheap and low-maintenance, but limited to streamside cells.',
    cost: 200,
    upkeep: 0,
    maturityYears: 1,
    attenuate: { N: 0.55, P: 0.50, sed: 0.65, salt: 0.10, tox: 0.10 },
    sink: null,
    converts: LAND_USE.RIPARIAN,
    canPlace(cell, terrain) {
      if (cell.landUse === LAND_USE.LAKE || cell.landUse === LAND_USE.STREAM)
        return { ok: false, reason: 'Cannot place on water' }
      if (cell.intervention)
        return { ok: false, reason: 'Cell already has an intervention' }
      if (!adjacentToWater(cell, terrain))
        return { ok: false, reason: 'Must be adjacent to a stream or lake' }
      return { ok: true }
    },
  },

  constructed_wetland: {
    id: 'constructed_wetland',
    name: 'Constructed wetland',
    short: 'Engineered nutrient sink',
    description: 'An engineered wetland that intercepts stream or runoff flow. Removes a high fraction of nitrogen, phosphorus and sediment via plant uptake and microbial denitrification. Requires 2 years to mature; expensive but the highest-impact removal tool.',
    cost: 600,
    upkeep: 20,
    maturityYears: 2,
    attenuate: { N: 0.30, P: 0.25, sed: 0.40, salt: 0, tox: 0.15 },
    sink:      { N: 0.55, P: 0.65, sed: 0.70, salt: 0,    tox: 0.40 },
    converts: LAND_USE.WETLAND,
    canPlace(cell, terrain) {
      if (cell.landUse === LAND_USE.LAKE || cell.landUse === LAND_USE.STREAM)
        return { ok: false, reason: 'Cannot place on water' }
      if (cell.intervention)
        return { ok: false, reason: 'Cell already has an intervention' }
      if (cell.elev > 0.55)
        return { ok: false, reason: 'Slope too steep — wetlands need low-lying ground' }
      return { ok: true }
    },
  },

  detention_pond: {
    id: 'detention_pond',
    name: 'Stormwater detention pond',
    short: 'First-flush capture',
    description: 'Temporarily impounds runoff during storms, allowing sediment to settle and the first flush of contaminants to be captured. Very effective on urban and industrial parcels.',
    cost: 350,
    upkeep: 10,
    maturityYears: 1,
    attenuate: { N: 0.20, P: 0.20, sed: 0.55, salt: 0,    tox: 0.30 },
    sink:      { N: 0.25, P: 0.30, sed: 0.55, salt: 0,    tox: 0.35 },
    converts: null,   // visual: pond icon overlay, land use unchanged
    canPlace(cell) {
      if (cell.landUse !== LAND_USE.URBAN && cell.landUse !== LAND_USE.INDUSTRIAL)
        return { ok: false, reason: 'Place on an urban or industrial parcel' }
      if (cell.intervention)
        return { ok: false, reason: 'Cell already has an intervention' }
      return { ok: true }
    },
  },

  cover_crops: {
    id: 'cover_crops',
    name: 'Cover crop program',
    short: 'Off-season ground cover',
    description: 'Cover crops (rye, clover) planted between cash-crop seasons hold soil in place and capture residual nitrogen. Modest per-cell cost, applied per agricultural parcel.',
    cost: 120,
    upkeep: 30,
    maturityYears: 1,
    attenuate: { N: 0.40, P: 0.30, sed: 0.55, salt: 0, tox: 0 },
    sink: null,
    converts: null,
    canPlace(cell) {
      if (cell.landUse !== LAND_USE.AGRICULTURE)
        return { ok: false, reason: 'Place on an agricultural parcel' }
      if (cell.intervention)
        return { ok: false, reason: 'Cell already has an intervention' }
      return { ok: true }
    },
  },

  bioswale: {
    id: 'bioswale',
    name: 'Bioswale',
    short: 'Urban infiltration channel',
    description: 'A vegetated channel that conveys urban stormwater while infiltrating it into the ground. Reduces both flood peaks and the dissolved nutrient load reaching the stream.',
    cost: 280,
    upkeep: 8,
    maturityYears: 1,
    attenuate: { N: 0.35, P: 0.40, sed: 0.45, salt: 0.10, tox: 0.20 },
    sink: null,
    converts: null,
    canPlace(cell) {
      if (cell.landUse !== LAND_USE.URBAN)
        return { ok: false, reason: 'Place on an urban parcel' }
      if (cell.intervention)
        return { ok: false, reason: 'Cell already has an intervention' }
      return { ok: true }
    },
  },

  septic_upgrade: {
    id: 'septic_upgrade',
    name: 'Septic system upgrade',
    short: 'Eliminates leakage source',
    description: 'Replaces failing on-site wastewater systems on a residential parcel. Effectively eliminates that cell’s nitrogen contribution from human waste.',
    cost: 450,
    upkeep: 0,
    maturityYears: 1,
    attenuate: { N: 0.85, P: 0.80, sed: 0, salt: 0, tox: 0.20 },
    sink: null,
    converts: null,
    canPlace(cell) {
      if (cell.landUse !== LAND_USE.URBAN)
        return { ok: false, reason: 'Place on an urban parcel' }
      if (cell.intervention)
        return { ok: false, reason: 'Cell already has an intervention' }
      return { ok: true }
    },
  },
}

// Watershed-wide policies. Each toggles a multiplier in state.policyMods.
// They cost annual political/operating capital instead of one-time placement.
export const POLICIES = {
  fertilizer_ordinance: {
    id: 'fertilizer_ordinance',
    name: 'Fertilizer ordinance',
    description: 'Limits fertilizer application rates and timing on agricultural parcels watershed-wide.',
    annualCost: 80,
    apply(mods) { mods.N *= 0.70; mods.P *= 0.65 },
  },
  salt_management: {
    id: 'salt_management',
    name: 'Winter salt management plan',
    description: 'Calibrated road-salt application and brine pre-treatment. Cuts winter chloride loading.',
    annualCost: 60,
    apply(mods) { mods.salt *= 0.45 },
  },
  industrial_permit: {
    id: 'industrial_permit',
    name: 'Industrial discharge permit reform',
    description: 'Tightens permit limits on industrial outfalls; phases in over a year.',
    annualCost: 120,
    apply(mods) { mods.tox *= 0.40; mods.N *= 0.90 },
  },
}

// Annual budget allocated to the player (currency units).
export const ANNUAL_BUDGET_BASE = 800
// Bonus / penalty applied to next year's budget based on prior year score.
export function budgetForYear(yearScore) {
  // yearScore is the previous year's compliance % (0-100). Map to ±50% adjustment.
  const factor = 0.7 + (yearScore / 100) * 0.6     // 0.7..1.3
  return Math.round(ANNUAL_BUDGET_BASE * factor)
}
