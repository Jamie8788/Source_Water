// Water parameter metadata — CCME aquatic-life and surface-water references ONLY.
// IMPORTANT: This file must NEVER reference drinking water guidelines, potability,
// or any "safe for consumption" threshold. SOURCE Water is a surface-water /
// aquatic-life platform and is explicitly out of scope for drinking-water compliance.

export const PARAM_META = {
  ph: {
    key: 'ph',
    label: 'pH',
    unit: '',
    short: 'Acidity / alkalinity of the water (log scale).',
    aliases: ['ph', 'p_h', 'pH'],
    // CCME aquatic life: 6.5–9.0 for freshwater aquatic life
    ranges: [
      { min: 0,   max: 4.5, label: 'Extreme acid',    tone: 'critical', note: 'Most fish eggs + mayfly larvae die; shells dissolve' },
      { min: 4.5, max: 6.5, label: 'Acidic — stress', tone: 'warning',  note: 'Brook trout, mussels and amphibian eggs stressed' },
      { min: 6.5, max: 9.0, label: 'Aquatic-life OK', tone: 'safe',     note: 'CCME freshwater aquatic-life range' },
      { min: 9.0, max: 11,  label: 'Alkaline — stress', tone: 'warning', note: 'Ammonia becomes toxic to fish at high pH' },
      { min: 11,  max: 14,  label: 'Extreme base',    tone: 'critical', note: 'Lethal to most aquatic organisms' },
    ],
    mechanism: 'pH is a log scale — pH 5 is 10× more acidic than pH 6. Acid rain from SO₂/NOₓ emissions and acid mine drainage are the main drivers in Northern Ontario. Low pH mobilises aluminum from lake sediments, which clogs fish gills.',
    impacts: [
      { group: 'Fish',    text: 'Brook trout eggs fail below pH 5.5. Aluminium released at low pH coats gills.' },
      { group: 'Insects', text: 'Mayfly and caddisfly larvae — bioindicators of clean water — disappear below pH 6.' },
      { group: 'Plants',  text: 'Emergent wetland plants tolerate 5.5–8.5; outside that, species shift.' },
    ],
    measured: 'Field: calibrated pH probe or colour-strip kit (Water Rangers standard kit).',
  },
  turbidity: {
    key: 'turbidity',
    label: 'Turbidity',
    unit: ' NTU',
    short: 'Cloudiness from suspended particles (sediment, algae, organic matter).',
    aliases: ['turbidity', 'ntu'],
    // CCME aquatic life: long-term change ≤ 8 NTU above background (clear flow)
    ranges: [
      { min: 0,   max: 5,   label: 'Clear',              tone: 'safe',     note: 'Background for most Great Lakes tributaries' },
      { min: 5,   max: 25,  label: 'Slightly turbid',    tone: 'safe',     note: 'Typical after light rain' },
      { min: 25,  max: 100, label: 'Turbid',             tone: 'warning',  note: 'Light penetration drops — photosynthesis suppressed' },
      { min: 100, max: 500, label: 'Heavy sediment',     tone: 'warning',  note: 'Fish gills clog, benthic habitat smothered' },
      { min: 500, max: 9999,label: 'Severe sediment',    tone: 'critical', note: 'Acute damage to aquatic life' },
    ],
    mechanism: 'Turbidity spikes come from stormwater runoff, shoreline erosion, construction, and spring snowmelt. High turbidity absorbs sunlight, warming surface water and depriving rooted plants of light.',
    impacts: [
      { group: 'Fish',    text: 'Suspended particles abrade gill tissue; sight-feeders (bass, pike) stop hunting.' },
      { group: 'Insects', text: 'Filter-feeders like caddisflies clog and starve.' },
      { group: 'Plants',  text: 'Submerged macrophytes die back when light drops below ~1% of surface.' },
    ],
    measured: 'Field: Secchi disk (depth at which it disappears) or portable nephelometer in NTU.',
  },
  temperature: {
    key: 'temperature',
    label: 'Water temperature',
    unit: ' °C',
    short: 'Temperature drives oxygen solubility and metabolic rates.',
    aliases: ['temperature', 'temp', 'water_temperature'],
    // Aquatic life: cold-water fish stressed > 20°C, lethal > 25°C for brook trout
    ranges: [
      { min: -2,  max: 4,  label: 'Cold',               tone: 'safe',     note: 'Winter / under-ice; trout active' },
      { min: 4,   max: 18, label: 'Cool',               tone: 'safe',     note: 'Ideal for salmonids (trout, whitefish)' },
      { min: 18,  max: 23, label: 'Warm',               tone: 'warning',  note: 'Trout stress begins; warm-water species thrive' },
      { min: 23,  max: 27, label: 'Hot',                tone: 'warning',  note: 'Trout lethal range; DO drops sharply' },
      { min: 27,  max: 50, label: 'Thermal stress',     tone: 'critical', note: 'Most cold-water species die; bloom-favouring' },
    ],
    mechanism: 'Warmer water holds less dissolved oxygen (Henry\'s Law — ~14.6 mg/L at 0°C vs ~8.2 mg/L at 25°C). Climate change, riparian clearing, and thermal plumes from industrial cooling water push surface temps up.',
    impacts: [
      { group: 'Fish',    text: 'Brook trout and lake trout need < 20°C. Warm-water bass expand their range as lakes heat.' },
      { group: 'Insects', text: 'Stonefly larvae need cold, well-oxygenated water — they vanish when lakes warm.' },
      { group: 'Plants',  text: 'Warm water favours cyanobacteria (blue-green algae) over green algae.' },
    ],
    measured: 'Field: digital thermometer at fixed depth (usually 0.5 m below surface).',
  },
  dissolved_oxygen: {
    key: 'dissolved_oxygen',
    label: 'Dissolved oxygen',
    unit: ' mg/L',
    short: 'Oxygen gas dissolved in the water — what fish breathe.',
    aliases: ['dissolved_oxygen', 'do', 'oxygen', 'dissolved oxygen'],
    // CCME aquatic life: ≥ 6 mg/L cold-water early life; ≥ 5.5 mg/L other life stages
    ranges: [
      { min: 0,   max: 2, label: 'Hypoxic',            tone: 'critical', note: 'Fish kill zone — most species suffocate' },
      { min: 2,   max: 4, label: 'Stress',             tone: 'critical', note: 'Only carp + catfish tolerate for short periods' },
      { min: 4,   max: 6, label: 'Low — warning',      tone: 'warning',  note: 'Cold-water species (trout) stressed' },
      { min: 6,   max: 9, label: 'Aquatic-life OK',    tone: 'safe',     note: 'CCME surface-water reference (aquatic life)' },
      { min: 9,   max: 20,label: 'Saturated / super',  tone: 'safe',     note: 'Cold, turbulent, or supersaturated water' },
    ],
    mechanism: 'DO drops when water warms, when algae blooms die and decompose, and when organic pollution (sewage, manure runoff) feeds bacteria that consume oxygen. Stratified lakes develop a hypoxic bottom layer in late summer.',
    impacts: [
      { group: 'Fish',    text: 'Fish suffocate below 3 mg/L — the classic "summer fish kill" trigger.' },
      { group: 'Insects', text: 'Mayfly and stonefly larvae require ≥ 5 mg/L; their absence flags chronic low DO.' },
      { group: 'Plants',  text: 'Rooted plants supply daytime DO via photosynthesis; at night they consume it.' },
    ],
    measured: 'Field: DO probe (optical or electrochemical). Report in mg/L and % saturation.',
  },
  conductivity: {
    key: 'conductivity',
    label: 'Conductivity',
    unit: ' µS/cm',
    short: 'Ability of water to carry electric current — proxy for dissolved ions (salts, minerals).',
    aliases: ['conductivity', 'specific conductance', 'ec'],
    // CCME chloride guideline 120 mg/L chronic; conductivity ~800–1500 µS/cm often flags salt input
    ranges: [
      { min: 0,    max: 50,   label: 'Very soft',          tone: 'safe',    note: 'Pristine lakes on Canadian Shield' },
      { min: 50,   max: 300,  label: 'Soft',               tone: 'safe',    note: 'Typical Great Lakes tributary range' },
      { min: 300,  max: 800,  label: 'Moderate',           tone: 'safe',    note: 'Agricultural + urban streams' },
      { min: 800,  max: 1500, label: 'Elevated — watch',   tone: 'warning', note: 'Salt input likely (road salt, sewage)' },
      { min: 1500, max: 99999,label: 'High — chloride stress', tone: 'critical', note: 'Mayfly larvae and mussels harmed at chronic high chloride' },
    ],
    mechanism: 'Road salt (NaCl) used on winter roads is the #1 driver of rising conductivity in Ontario. Agricultural fertiliser runoff, failing septic systems and industrial discharge also raise it. Unlike phosphate, chloride is conservative — it doesn\'t break down.',
    impacts: [
      { group: 'Fish',    text: 'High chloride depresses fish immune systems; eggs fail to hatch.' },
      { group: 'Insects', text: 'Mayfly larvae die above 860 µS/cm chronic exposure.' },
      { group: 'Plants',  text: 'Freshwater mussels — already endangered — are very salt-sensitive.' },
    ],
    measured: 'Field: conductivity meter. Often reported at 25°C reference temperature.',
  },
}

export const PARAM_ORDER = ['ph', 'turbidity', 'temperature', 'dissolved_oxygen', 'conductivity']

// Match a Water Rangers / WR parameter name string to our canonical key.
// WR parameter strings are free-form (e.g. "Water Temperature", "specific_conductance")
// so we normalize underscores to spaces and match aliases as whole tokens.
//
// HARD EXCLUSION: anything that is clearly an air/atmospheric/ambient reading is
// rejected before alias matching. This stops "Air temperature" / "air_temperature"
// from being matched as water temperature.
//
// Custom boundary instead of \b because the WR API uses snake_case
// (e.g. "air_temperature"), and \b treats _ as a word char — so \bair\b fails.
// We use (start | non-letter) before and (non-letter | end) after.
const NON_WATER_NAME = /(^|[^a-z])(air|atmospheric|ambient|sky|cloud)([^a-z]|$)/i

// Strict whole-token match: alias must be flanked by string boundary or non-letter.
// Necessary because short aliases like "ec" (electrical conductivity) would
// otherwise match inside unrelated names like "secchi" → false-positive.
function aliasMatchesAsToken(haystack, alias) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack)
}

export function matchParam(rawName) {
  if (!rawName) return null
  // Normalize underscores → spaces so snake_case input matches space-separated aliases
  const s = String(rawName).toLowerCase().trim().replace(/_/g, ' ')
  if (NON_WATER_NAME.test(s)) return null
  for (const key of PARAM_ORDER) {
    const meta = PARAM_META[key]
    if (meta.aliases.some(a => aliasMatchesAsToken(s, a))) return key
  }
  return null
}

// Given a parameter key and numeric value, return the band it falls in.
// Returns { tone: 'safe'|'warning'|'critical', label, note, color, index }.
export function classifyValue(paramKey, value) {
  const meta = PARAM_META[paramKey]
  if (!meta) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  for (let i = 0; i < meta.ranges.length; i++) {
    const r = meta.ranges[i]
    if (n >= r.min && n < r.max) {
      return {
        tone: r.tone,
        label: r.label,
        note: r.note,
        color: TONE_COLOR[r.tone],
        index: i,
      }
    }
  }
  // Value out of all defined ranges — clamp to last band
  const last = meta.ranges[meta.ranges.length - 1]
  return { tone: last.tone, label: last.label, note: last.note, color: TONE_COLOR[last.tone], index: meta.ranges.length - 1 }
}

export const TONE_COLOR = {
  safe:     '#22c55e',
  warning:  '#f59e0b',
  critical: '#ef4444',
  unknown:  '#94a3b8',
}

// Extract the most recent value for a parameter from a list of observations.
// Handles both our internal shape ({ ph: 7.2, turbidity: 3 }) and Water Rangers
// shape ({ readings: [{ parameter, value, unit }], observed_at }).
export function latestValueFor(paramKey, observations) {
  if (!Array.isArray(observations) || !observations.length) return null
  const meta = PARAM_META[paramKey]
  if (!meta) return null

  for (const obs of observations) {
    // Flat shape
    if (obs && obs[paramKey] != null && obs[paramKey] !== '') {
      const n = Number(obs[paramKey])
      if (Number.isFinite(n)) return { value: n, at: obs.observed_at || obs.collected_at || obs.created_at }
    }
    // WR readings shape
    if (Array.isArray(obs?.readings)) {
      for (const r of obs.readings) {
        const matched = matchParam(r?.parameter)
        if (matched === paramKey) {
          const n = Number(r?.value)
          if (Number.isFinite(n)) return { value: n, at: obs.observed_at || obs.collected_at || obs.created_at }
        }
      }
    }
  }
  return null
}
