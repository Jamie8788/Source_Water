// Verification script: fetch real Water Rangers observations and confirm
// our matchParam + series extraction returns the same numbers the WR site
// shows — especially that "Air temperature" is NEVER pulled in as water.
//
// Run from repo root:  node scripts/verify-deepdive.mjs
//
// Reads WATERRANGERS_API_KEY from server/.env

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', 'server', '.env')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const KEY = env.WATERRANGERS_API_KEY
if (!KEY) { console.error('No WATERRANGERS_API_KEY in server/.env'); process.exit(1) }

// ── Inline copies of the fixed logic (kept in sync with client/src/utils/waterParams.js) ──
const PARAM_META = {
  ph: { aliases: ['ph', 'p_h'], label: 'pH' },
  turbidity: { aliases: ['turbidity', 'ntu'], label: 'Turbidity' },
  temperature: { aliases: ['temperature', 'temp', 'water_temperature'], label: 'Water temperature' },
  dissolved_oxygen: { aliases: ['dissolved_oxygen', 'do', 'oxygen', 'dissolved oxygen'], label: 'Dissolved oxygen' },
  conductivity: { aliases: ['conductivity', 'specific conductance', 'ec'], label: 'Conductivity' },
}
const PARAM_ORDER = ['ph', 'turbidity', 'temperature', 'dissolved_oxygen', 'conductivity']
const NON_WATER_NAME = /(^|[^a-z])(air|atmospheric|ambient|sky|cloud)([^a-z]|$)/i

function aliasMatchesAsToken(haystack, alias) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack)
}

function matchParam(rawName) {
  if (!rawName) return null
  const s = String(rawName).toLowerCase().trim().replace(/_/g, ' ')
  if (NON_WATER_NAME.test(s)) return null
  for (const key of PARAM_ORDER) {
    const meta = PARAM_META[key]
    if (meta.aliases.some(a => aliasMatchesAsToken(s, a))) return key
  }
  return null
}

function extractSeries(paramKey, observations) {
  const meta = PARAM_META[paramKey]
  const out = []
  for (const obs of observations) {
    let n = null, unit = ''
    if (obs && obs[paramKey] != null && obs[paramKey] !== '') n = Number(obs[paramKey])
    else if (meta?.aliases) {
      for (const a of meta.aliases) {
        if (obs && obs[a] != null && obs[a] !== '') { n = Number(obs[a]); break }
      }
    }
    if (n == null && Array.isArray(obs?.readings)) {
      for (const r of obs.readings) {
        let isMatch = false
        if (meta) isMatch = matchParam(r?.parameter) === paramKey
        else {
          const target = String(paramKey).toLowerCase().replace(/_/g, ' ')
          isMatch = String(r?.parameter || '').toLowerCase().replace(/_/g, ' ').includes(target)
        }
        if (isMatch) {
          const candidate = Number(r?.value)
          if (Number.isFinite(candidate)) { n = candidate; if (r?.unit) unit = r.unit; break }
        }
      }
    }
    if (Number.isFinite(n)) out.push({ value: n, unit, at: obs?.observed_at })
  }
  return out
}

const WR = 'https://data.waterrangers.com'
async function wr(path, query = {}) {
  const url = new URL(`${WR}${path}`)
  url.searchParams.set('api_key', KEY)
  Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v))
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`WR ${r.status}: ${path}`)
  return r.json()
}

// ── Test cases ────────────────────────────────────────────────────────────────
function testObservation(obs, label) {
  const readings = obs.readings || []
  console.log(`\n── ${label} (obs id=${obs.id}, location_id=${obs.location_id}) ──`)
  console.log('Raw readings from WR API:')
  let airTempVal = null, waterTempVal = null
  for (const r of readings) {
    const name = String(r.parameter || '').toLowerCase()
    if (name.includes('air') && name.includes('temp')) airTempVal = Number(r.value)
    if (!name.includes('air') && name.includes('temp') && !name.includes('chemistry')) waterTempVal = Number(r.value)
    console.log(`  - ${r.parameter}: ${r.value} ${r.unit || ''}`)
  }
  const tempSeries = extractSeries('temperature', [obs])
  const phSeries = extractSeries('ph', [obs])
  const doSeries = extractSeries('dissolved_oxygen', [obs])
  const got = tempSeries[0]?.value ?? null
  console.log(`Our extraction → water temp: ${got ?? '(none)'} | pH: ${phSeries[0]?.value ?? '(none)'} | DO: ${doSeries[0]?.value ?? '(none)'}`)

  const checks = []
  if (airTempVal != null) {
    const ok = got !== airTempVal
    checks.push({ test: 'water temp must NOT equal air temp', ok, detail: `air=${airTempVal} our=${got}` })
  }
  if (waterTempVal != null) {
    const ok = got === waterTempVal
    checks.push({ test: 'water temp matches WR water reading', ok, detail: `wr=${waterTempVal} our=${got}` })
  }
  for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.test}  (${c.detail})`)
  return checks.every(c => c.ok)
}

async function main() {
  console.log('═══ DEEP-DIVE DATA VERIFICATION ═══')
  console.log('Testing that our extraction matches the actual WR API values.')
  console.log('Pre-flight unit tests on matchParam:')
  const cases = [
    ['Air temperature', null],
    ['air_temperature', null],
    ['atmospheric_pressure', null],
    ['ambient_temp', null],
    ['Water temperature', 'temperature'],
    ['water_temperature', 'temperature'],
    ['Temperature', 'temperature'],
    ['Air temp (°C)', null],
    ['pH', 'ph'],
    ['Dissolved oxygen', 'dissolved_oxygen'],
    ['oxygen', 'dissolved_oxygen'],
    ['Atmospheric pressure', null],
    ['Turbidity (NTU)', 'turbidity'],
    ['Repair', null],
    ['stairwell', null],
    // Critical false-positive guards from the wider verification
    ['secchi_depth', null],               // contains 'ec' — must NOT match conductivity
    ['hardness', null],
    ['alkalinity', null],
    ['chlorine', null],
    ['current_weather', null],
    ['previous_weather', null],
    ['conductivity', 'conductivity'],
    ['specific_conductance', 'conductivity'],
  ]
  let unitPass = 0
  for (const [input, expect] of cases) {
    const got = matchParam(input)
    const ok = got === expect
    console.log(`  ${ok ? 'OK ' : 'XX '} matchParam(${JSON.stringify(input)}) = ${JSON.stringify(got)} (expected ${JSON.stringify(expect)})`)
    if (ok) unitPass++
  }
  console.log(`Unit: ${unitPass}/${cases.length} passed\n`)

  // Live: pull a wide batch from different pages and verify EVERY parameter
  // we surface (not just temperature) against the raw WR API value.
  console.log('\n── Verifying full parameter extraction across many sites ──')
  let livePass = 0, liveTotal = 0
  const tested = new Set()
  const targetCount = 8
  for (let page = 1; page <= 10 && tested.size < targetCount; page++) {
    const recent = await wr('/observations.json', { per_page: 30, page })
    const obsList = Array.isArray(recent) ? recent : (recent.observations || recent.data || [])
    if (!obsList.length) break
    for (const o of obsList) {
      // Skip duplicate sites — we want diversity
      const sid = o.location_id || o.id
      if (tested.has(sid)) continue
      // Only test observations that have at least 3 numeric readings (skip weather-only)
      const numReadings = (o.readings || []).filter(r => Number.isFinite(Number(r.value))).length
      if (numReadings < 3) continue
      tested.add(sid)
      liveTotal++
      if (verifyAllParams(o)) livePass++
      if (tested.size >= targetCount) break
    }
  }

  console.log(`\n═══ RESULT: ${livePass}/${liveTotal} live observations verified, ${unitPass}/${cases.length} unit tests passed ═══`)
  process.exit(livePass === liveTotal && unitPass === cases.length ? 0 : 1)
}

// Pull EVERY value from raw readings and check that our extraction returns
// the exact same number for every parameter we map. Critical: verify that
// pH, DO, conductivity, turbidity, water-temp don't accidentally pull from
// the wrong field (e.g. air_temp, weather, hardness, alkalinity, chlorine).
function verifyAllParams(obs) {
  console.log(`\n── Site ${obs.location_id || '?'} (obs ${obs.id || '?'}) ──`)
  const raw = {}
  for (const r of (obs.readings || [])) {
    const name = String(r.parameter || '').toLowerCase()
    const val = Number(r.value)
    if (Number.isFinite(val)) raw[name] = { value: val, unit: r.unit || '' }
  }
  console.log('  Raw:', Object.entries(raw).map(([k, v]) => `${k}=${v.value}`).join(', '))

  // Truth: walk the raw readings and pick the right one for each param key.
  const truth = {
    temperature:      raw.water_temperature?.value ?? raw.temperature?.value ?? null,
    ph:               raw.ph?.value ?? raw.p_h?.value ?? null,
    dissolved_oxygen: raw.dissolved_oxygen?.value ?? raw.oxygen?.value ?? raw.do?.value ?? null,
    conductivity:     raw.conductivity?.value ?? raw.specific_conductance?.value ?? null,
    turbidity:        raw.turbidity?.value ?? null,
  }

  const checks = []
  for (const key of ['temperature', 'ph', 'dissolved_oxygen', 'conductivity', 'turbidity']) {
    if (truth[key] == null) continue  // not present in this observation — skip
    const got = extractSeries(key, [obs])[0]?.value ?? null
    const ok = got === truth[key]
    checks.push({ key, ok, expected: truth[key], got })
    // Extra sanity: confirm we didn't accidentally pull the air value
    if (key === 'temperature' && raw.air_temperature) {
      const notAir = got !== raw.air_temperature.value
      checks.push({ key: 'temp ≠ air', ok: notAir, expected: `≠${raw.air_temperature.value}`, got })
    }
  }
  let allOk = true
  for (const c of checks) {
    console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.key.padEnd(18)} expected=${c.expected}  got=${c.got}`)
    if (!c.ok) allOk = false
  }
  return allOk
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
