/**
 * Water Rangers parameter name mapper.
 *
 * WR observations come back as { readings: [{ parameter, value, unit }, ...] }
 * with free-form parameter names like "oxygen", "water_temperature", "phosphates".
 * Our internal columns on the `observations` table are different names like
 * `dissolved_oxygen`, `water_temp`, `phosphorus`.
 *
 * mapWRParam(rawName) → one of our ALLOWED_PARAMS keys, or null if unmapped.
 *
 * Hard exclusion: anything that's clearly air/atmospheric is rejected first
 * so "air_temperature" never gets matched as water_temp.
 *
 * Whole-token matching (custom boundary, not \b) because WR uses snake_case
 * and \b treats _ as a word char.
 */

// Mirrors ALLOWED_PARAMS in routes/alert-watches.js. If you add a parameter
// there, add aliases here.
const PARAM_ALIASES = {
  ph:               ['ph'],
  dissolved_oxygen: ['dissolved oxygen', 'dissolved_oxygen', 'oxygen', 'do'],
  chlorine:         ['chlorine', 'free chlorine', 'total chlorine'],
  hardness:         ['hardness', 'total hardness'],
  alkalinity:       ['alkalinity', 'total alkalinity'],
  conductivity:     ['conductivity', 'specific conductance', 'ec'],
  air_temp:         ['air temperature', 'air_temperature', 'air temp'],
  water_temp:       ['water temperature', 'water_temperature', 'water temp', 'temperature', 'temp'],
  nitrate_nitrogen: ['nitrate nitrogen', 'nitrate_nitrogen', 'nitrate-n', 'nitrates', 'nitrate'],
  chlorophyll_a:    ['chlorophyll a', 'chlorophyll_a', 'chlorophyll-a', 'chlorophyll'],
  chloride:         ['chloride', 'chlorides'],
  nitrites:         ['nitrites', 'nitrite'],
  turbidity:        ['turbidity', 'ntu'],
  tds:              ['tds', 'total dissolved solids'],
  phosphorus:       ['phosphorus', 'phosphate', 'phosphates', 'total phosphorus'],
  total_coliforms:  ['total coliforms', 'coliforms', 'coliform'],
  secchi_depth:     ['secchi depth', 'secchi_depth', 'secchi'],
  water_depth:      ['water depth', 'water_depth', 'depth'],
}

// Anything containing one of these tokens is rejected before alias matching.
// Necessary so "air_temperature" never matches a water-side alias.
const NON_WATER_NAME = /(^|[^a-z])(air|atmospheric|ambient|sky|cloud)([^a-z]|$)/i

function aliasMatchesAsToken(haystack, alias) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack)
}

function mapWRParam(rawName) {
  if (!rawName) return null
  const s = String(rawName).toLowerCase().trim().replace(/_/g, ' ')
  if (NON_WATER_NAME.test(s)) {
    // Special-case: explicitly map air_temperature so it can be tracked too,
    // but only via the air alias (we already proved water aliases would lose).
    if (PARAM_ALIASES.air_temp.some(a => aliasMatchesAsToken(s, a))) return 'air_temp'
    return null
  }
  for (const [key, aliases] of Object.entries(PARAM_ALIASES)) {
    if (key === 'air_temp') continue // already handled above
    if (aliases.some(a => aliasMatchesAsToken(s, a))) return key
  }
  return null
}

// Walk a list of WR observations (newest first) and return the most recent
// reading whose parameter maps to `paramKey`. Returns { value, observed_at }
// or null.
function latestWRReading(observations, paramKey) {
  if (!Array.isArray(observations)) return null
  for (const obs of observations) {
    if (!Array.isArray(obs?.readings)) continue
    for (const r of obs.readings) {
      if (mapWRParam(r?.parameter) !== paramKey) continue
      const n = parseFloat(r?.value)
      if (!Number.isFinite(n)) continue
      return { value: n, observed_at: obs.observed_at || obs.collected_at || null }
    }
  }
  return null
}

// Walk WR observations and return up to N {value, observed_at} points for the
// requested parameter, oldest → newest (chart-friendly order).
function historyWRReadings(observations, paramKey, limit = 30) {
  if (!Array.isArray(observations)) return []
  const points = []
  for (const obs of observations) {
    if (!Array.isArray(obs?.readings)) continue
    for (const r of obs.readings) {
      if (mapWRParam(r?.parameter) !== paramKey) continue
      const n = parseFloat(r?.value)
      if (!Number.isFinite(n)) continue
      points.push({ value: n, observed_at: obs.observed_at || obs.collected_at || null })
      break // one reading per observation
    }
  }
  // WR returns newest-first; we want oldest-first for charting.
  return points.reverse().slice(-limit)
}

module.exports = { mapWRParam, latestWRReading, historyWRReadings, PARAM_ALIASES }
