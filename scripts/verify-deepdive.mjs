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
  let totalChecks = 0, totalPassed = 0
  const tested = new Set()
  const targetCount = 15
  for (let page = 1; page <= 15 && tested.size < targetCount; page++) {
    const recent = await wr('/observations.json', { per_page: 30, page })
    const obsList = Array.isArray(recent) ? recent : (recent.observations || recent.data || [])
    if (!obsList.length) break
    for (const o of obsList) {
      const sid = o.location_id || o.id
      if (tested.has(sid)) continue
      const numReadings = (o.readings || []).filter(r => Number.isFinite(Number(r.value))).length
      if (numReadings < 3) continue
      tested.add(sid)
      liveTotal++
      const result = verifyAllParams(o)
      totalChecks += result.total
      totalPassed += result.passed
      if (result.allOk) livePass++
      if (tested.size >= targetCount) break
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log(`  FINAL RESULT`)
  console.log(`  Sites verified:     ${livePass}/${liveTotal}`)
  console.log(`  Per-value checks:   ${totalPassed}/${totalChecks}`)
  console.log(`  Unit tests passed:  ${unitPass}/${cases.length}`)
  console.log('═══════════════════════════════════════════════════════════')
  const allClean = livePass === liveTotal && unitPass === cases.length && totalPassed === totalChecks
  console.log(allClean ? '  ✓ ALL CLEAN — no fabricated or mismatched values' : '  ✗ FAILURES DETECTED')
  console.log('═══════════════════════════════════════════════════════════')
  process.exit(allClean ? 0 : 1)
}

// For each site, run a battery of checks across ALL 5 parameters:
//   1. If the WR raw readings contain the parameter, our extraction must return
//      the EXACT same number.
//   2. If the WR raw readings do NOT contain the parameter, our extraction must
//      return null (no fabrication, no fallback to wrong field).
//   3. For temperature specifically, we never pull the air_temperature value.
//   4. For conductivity specifically, we never pull a secchi/hardness/alkalinity value.
function verifyAllParams(obs) {
  console.log(`\n── Site ${obs.location_id || '?'} ──`)
  const raw = {}
  for (const r of (obs.readings || [])) {
    const name = String(r.parameter || '').toLowerCase()
    const val = Number(r.value)
    if (Number.isFinite(val)) raw[name] = { value: val, unit: r.unit || '' }
  }
  console.log('  Raw:', Object.entries(raw).map(([k, v]) => `${k}=${v.value}`).join(', ') || '(none)')

  const truth = {
    temperature:      raw.water_temperature?.value ?? raw.temperature?.value ?? null,
    ph:               raw.ph?.value ?? raw.p_h?.value ?? null,
    dissolved_oxygen: raw.dissolved_oxygen?.value ?? raw.oxygen?.value ?? raw.do?.value ?? null,
    conductivity:     raw.conductivity?.value ?? raw.specific_conductance?.value ?? null,
    turbidity:        raw.turbidity?.value ?? null,
  }

  const checks = []
  for (const key of ['temperature', 'ph', 'dissolved_oxygen', 'conductivity', 'turbidity']) {
    const got = extractSeries(key, [obs])[0]?.value ?? null
    if (truth[key] != null) {
      // Should match exactly
      checks.push({ key, ok: got === truth[key], expected: truth[key], got })
    } else {
      // Not in raw → must return null (no fabrication)
      checks.push({ key: `${key} (absent)`, ok: got === null, expected: 'null', got })
    }
  }
  // Cross-field anti-fabrication checks
  if (raw.air_temperature) {
    const got = extractSeries('temperature', [obs])[0]?.value ?? null
    checks.push({ key: 'temp ≠ air',     ok: got !== raw.air_temperature.value, expected: `≠${raw.air_temperature.value}`, got })
  }
  if (raw.secchi_depth) {
    const got = extractSeries('conductivity', [obs])[0]?.value ?? null
    checks.push({ key: 'cond ≠ secchi',  ok: got !== raw.secchi_depth.value,    expected: `≠${raw.secchi_depth.value}`,    got })
  }
  if (raw.hardness) {
    const got = extractSeries('conductivity', [obs])[0]?.value ?? null
    checks.push({ key: 'cond ≠ hardness',ok: got !== raw.hardness.value,         expected: `≠${raw.hardness.value}`,         got })
  }
  if (raw.alkalinity) {
    const got = extractSeries('ph', [obs])[0]?.value ?? null
    checks.push({ key: 'ph ≠ alkalinity',ok: got !== raw.alkalinity.value,       expected: `≠${raw.alkalinity.value}`,       got })
  }

  let allOk = true, passed = 0
  for (const c of checks) {
    const tag = c.ok ? 'PASS' : 'FAIL'
    console.log(`  ${tag}  ${c.key.padEnd(20)} expected=${c.expected}  got=${c.got}`)
    if (c.ok) passed++; else allOk = false
  }
  return { allOk, passed, total: checks.length }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
