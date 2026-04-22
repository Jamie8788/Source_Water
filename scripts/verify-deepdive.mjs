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

function matchParam(rawName) {
  if (!rawName) return null
  const s = String(rawName).toLowerCase().trim()
  if (NON_WATER_NAME.test(s)) return null
  for (const key of PARAM_ORDER) {
    const meta = PARAM_META[key]
    if (meta.aliases.some(a => s.includes(a))) return key
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
          isMatch = String(r?.parameter || '').toLowerCase().includes(target)
        }
        if (isMatch) { n = Number(r?.value); if (r?.unit) unit = r.unit; break }
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
    ['air_temperature', null],            // snake_case form from WR API — was missed by \bair\b
    ['atmospheric_pressure', null],
    ['ambient_temp', null],
    ['Water temperature', 'temperature'],
    ['water_temperature', 'temperature'],
    ['Temperature', 'temperature'],
    ['Air temp (°C)', null],
    ['pH', 'ph'],
    ['Dissolved oxygen', 'dissolved_oxygen'],
    ['oxygen', 'dissolved_oxygen'],       // WR returns just "oxygen"
    ['Atmospheric pressure', null],
    ['Turbidity (NTU)', 'turbidity'],
    // Words that contain air/sky as substrings — must NOT be excluded
    ['Repair', null],                      // no real param, but should not blow up
    ['stairwell', null],
  ]
  let unitPass = 0
  for (const [input, expect] of cases) {
    const got = matchParam(input)
    const ok = got === expect
    console.log(`  ${ok ? 'OK ' : 'XX '} matchParam(${JSON.stringify(input)}) = ${JSON.stringify(got)} (expected ${JSON.stringify(expect)})`)
    if (ok) unitPass++
  }
  console.log(`Unit: ${unitPass}/${cases.length} passed\n`)

  // Live: pull a batch and prioritize ones with BOTH air + water temp readings
  // (those are the ones the old bug would have miscategorised).
  console.log('\n── Pulling observations to find air+water temp combos ──')
  let livePass = 0, liveTotal = 0
  let foundCombo = 0
  for (let page = 1; page <= 5 && foundCombo < 3; page++) {
    const recent = await wr('/observations.json', { per_page: 50, page })
    const obsList = Array.isArray(recent) ? recent : (recent.observations || recent.data || [])
    if (!obsList.length) break
    for (const o of obsList) {
      const readings = o.readings || []
      const names = readings.map(r => String(r.parameter || '').toLowerCase())
      const hasAir = names.some(n => n.includes('air') && n.includes('temp'))
      const hasWater = names.some(n => !n.includes('air') && n.includes('temp'))
      if (hasAir && hasWater) {
        liveTotal++
        if (testObservation(o, `Site ${o.location_name || o.location_id}`)) livePass++
        foundCombo++
        if (foundCombo >= 3) break
      }
    }
  }
  if (foundCombo === 0) {
    console.log('  (no observations with both air+water temp found in first 5 pages — sampling 3 plain ones)')
    const recent = await wr('/observations.json', { per_page: 3, page: 1 })
    const obsList = Array.isArray(recent) ? recent : (recent.observations || recent.data || [])
    for (const o of obsList.slice(0, 3)) {
      liveTotal++
      if (testObservation(o, `Site ${o.location_name || o.location_id}`)) livePass++
    }
  }

  console.log(`\n═══ RESULT: ${livePass}/${liveTotal} live observations verified, ${unitPass}/${cases.length} unit tests passed ═══`)
  process.exit(livePass === liveTotal && unitPass === cases.length ? 0 : 1)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
