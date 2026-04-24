/**
 * Alert Watches — user-defined threshold rules
 *
 * Each watch is owned by a user and links a (site, parameter, comparator,
 * threshold). The /check endpoint reads the LATEST observation for each
 * watched site, evaluates the rule, and writes a row into the existing
 * `alerts` table when the condition is met. No fake data — every alert is
 * derived from an observation that actually exists in the database.
 *
 * Parameter names are whitelisted against the real columns on `observations`
 * to keep SQL injection impossible (we interpolate the column name).
 */
const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')

// Columns on `observations` that map 1:1 to a numeric parameter. ANYTHING
// outside this set is rejected by the API before it ever touches a query.
const ALLOWED_PARAMS = [
  'ph', 'dissolved_oxygen', 'chlorine', 'hardness', 'alkalinity',
  'conductivity', 'air_temp', 'water_temp', 'nitrate_nitrogen',
  'chlorophyll_a', 'chloride', 'nitrites', 'turbidity', 'tds',
  'phosphorus', 'total_coliforms', 'secchi_depth', 'water_depth',
]
const ALLOWED_COMPARATORS = ['>', '<', '>=', '<=']
const ALLOWED_SEVERITIES = ['low', 'medium', 'high']

function evalRule(value, comparator, threshold) {
  if (value == null || isNaN(value)) return false
  switch (comparator) {
    case '>':  return value >  threshold
    case '<':  return value <  threshold
    case '>=': return value >= threshold
    case '<=': return value <= threshold
    default:   return false
  }
}

function humanLabel(p) {
  const map = {
    ph: 'pH', dissolved_oxygen: 'Dissolved O₂', conductivity: 'Conductivity',
    turbidity: 'Turbidity', water_temp: 'Water temperature',
    air_temp: 'Air temperature', nitrate_nitrogen: 'Nitrate (N)',
    phosphorus: 'Phosphorus', chlorine: 'Chlorine', hardness: 'Hardness',
    alkalinity: 'Alkalinity', tds: 'TDS', chloride: 'Chloride',
    nitrites: 'Nitrites', total_coliforms: 'Total coliforms',
    secchi_depth: 'Secchi depth', water_depth: 'Water depth',
    chlorophyll_a: 'Chlorophyll-a',
  }
  return map[p] || p
}

// Read the latest observation for a site and pull the requested parameter.
// Returns { value, observed_at } or null if no observation exists yet.
async function latestReading(siteId, param) {
  if (!ALLOWED_PARAMS.includes(param)) return null
  const row = await db.get(
    `SELECT ${param} AS value, observed_at FROM observations
     WHERE site_id=? AND ${param} IS NOT NULL
     ORDER BY observed_at DESC LIMIT 1`,
    [siteId])
  if (!row || row.value == null) return null
  return { value: parseFloat(row.value), observed_at: row.observed_at }
}

// GET /api/alert-watches — my watches with current reading + status
router.get('/', requireAuth, async (req, res) => {
  try {
    const watches = await db.all(
      `SELECT w.*, s.name AS site_name, s.body_of_water, s.community
       FROM alert_watches w
       LEFT JOIN sites s ON w.site_id = s.id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC`,
      [req.user.id])

    const enriched = await Promise.all(watches.map(async w => {
      const reading = await latestReading(w.site_id, w.parameter).catch(() => null)
      const triggered = reading
        ? evalRule(reading.value, w.comparator, parseFloat(w.threshold))
        : false
      return {
        ...w,
        parameter_label: humanLabel(w.parameter),
        current_value: reading?.value ?? null,
        observed_at: reading?.observed_at ?? null,
        triggered,
        has_data: !!reading,
      }
    }))
    res.json({ watches: enriched })
  } catch (err) {
    console.error('GET /alert-watches error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/alert-watches — create a watch
router.post('/', requireAuth, async (req, res) => {
  try {
    const { site_id, parameter, comparator, threshold, severity, label } = req.body
    if (!site_id) return res.status(400).json({ error: 'site_id required' })
    if (!ALLOWED_PARAMS.includes(parameter)) return res.status(400).json({ error: 'unknown parameter' })
    if (!ALLOWED_COMPARATORS.includes(comparator)) return res.status(400).json({ error: 'invalid comparator' })
    const t = parseFloat(threshold)
    if (isNaN(t)) return res.status(400).json({ error: 'threshold must be a number' })
    const sev = ALLOWED_SEVERITIES.includes(severity) ? severity : 'medium'

    // Confirm the site exists so we don't store a dangling watch
    const site = await db.get('SELECT id FROM sites WHERE id=?', [site_id])
    if (!site) return res.status(404).json({ error: 'site not found' })

    const { lastInsertRowid } = await db.run(
      `INSERT INTO alert_watches (user_id, site_id, parameter, comparator, threshold, severity, label, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [req.user.id, site_id, parameter, comparator, t, sev, label || null])
    const created = await db.get('SELECT * FROM alert_watches WHERE id=?', [lastInsertRowid])
    res.json({ watch: created })
  } catch (err) {
    console.error('POST /alert-watches error:', err)
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/alert-watches/:id — update threshold/comparator/severity/active
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const own = await db.get('SELECT * FROM alert_watches WHERE id=? AND user_id=?',
      [req.params.id, req.user.id])
    if (!own) return res.status(404).json({ error: 'watch not found' })

    const { comparator, threshold, severity, active, label } = req.body
    const updates = []; const vals = []
    if (comparator !== undefined) {
      if (!ALLOWED_COMPARATORS.includes(comparator)) return res.status(400).json({ error: 'invalid comparator' })
      updates.push('comparator=?'); vals.push(comparator)
    }
    if (threshold !== undefined) {
      const t = parseFloat(threshold)
      if (isNaN(t)) return res.status(400).json({ error: 'threshold must be a number' })
      updates.push('threshold=?'); vals.push(t)
    }
    if (severity !== undefined) {
      if (!ALLOWED_SEVERITIES.includes(severity)) return res.status(400).json({ error: 'invalid severity' })
      updates.push('severity=?'); vals.push(severity)
    }
    if (active !== undefined) { updates.push('active=?'); vals.push(active ? 1 : 0) }
    if (label !== undefined) { updates.push('label=?'); vals.push(label) }
    if (!updates.length) return res.json({ watch: own })

    vals.push(req.params.id)
    await db.run(`UPDATE alert_watches SET ${updates.join(',')} WHERE id=?`, vals)
    const updated = await db.get('SELECT * FROM alert_watches WHERE id=?', [req.params.id])
    res.json({ watch: updated })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/alert-watches/:id
router.delete('/:id', requireAuth, async (req, res) => {
  await db.run('DELETE FROM alert_watches WHERE id=? AND user_id=?',
    [req.params.id, req.user.id])
  res.json({ success: true })
})

// POST /api/alert-watches/check — evaluate all my active watches NOW.
// For each one that fires AND doesn't already have an active alert row,
// insert a row into the existing alerts table. Returns what happened so
// the UI can show toast notifications.
router.post('/check', requireAuth, async (req, res) => {
  try {
    const watches = await db.all(
      `SELECT w.*, s.name AS site_name FROM alert_watches w
       LEFT JOIN sites s ON w.site_id=s.id
       WHERE w.user_id=? AND w.active=1`,
      [req.user.id])

    const results = []
    for (const w of watches) {
      const reading = await latestReading(w.site_id, w.parameter).catch(() => null)
      const value = reading?.value ?? null
      const triggered = reading
        ? evalRule(value, w.comparator, parseFloat(w.threshold))
        : false

      // Update last_checked_at + last_value on every check (pgify rewrites
      // datetime('now') → NOW() for PostgreSQL).
      await db.run(
        `UPDATE alert_watches SET last_checked_at = datetime('now'),
         last_value = ? WHERE id=?`, [value, w.id]).catch(() => {})

      let alertCreated = false
      if (triggered) {
        // Don't spam: only create an alert if there isn't already an active
        // one for this user + site + parameter.
        const existing = await db.get(
          `SELECT id FROM alerts WHERE site_id=? AND parameter=? AND created_by=? AND active=1`,
          [w.site_id, w.parameter, req.user.id])
        if (!existing) {
          const msg = `${humanLabel(w.parameter)} ${w.comparator} ${w.threshold} at ${w.site_name || 'site'} (latest reading: ${value})`
          await db.run(
            `INSERT INTO alerts (site_id, parameter, current_value, threshold_value, severity, message, active, created_by)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
            [w.site_id, w.parameter, value, parseFloat(w.threshold), w.severity || 'medium', msg, req.user.id])
          alertCreated = true
        }
        await db.run(
          `UPDATE alert_watches SET last_triggered_at = datetime('now') WHERE id=?`,
          [w.id]).catch(() => {})
      }

      results.push({
        watch_id: w.id,
        site_name: w.site_name,
        parameter: w.parameter,
        value,
        triggered,
        alert_created: alertCreated,
        has_data: !!reading,
      })
    }
    res.json({ checked: results.length, results })
  } catch (err) {
    console.error('POST /alert-watches/check error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/alert-watches/options — parameter list for the UI dropdown
router.get('/options', requireAuth, (_req, res) => {
  res.json({
    parameters: ALLOWED_PARAMS.map(p => ({ value: p, label: humanLabel(p) })),
    comparators: ALLOWED_COMPARATORS,
    severities: ALLOWED_SEVERITIES,
  })
})

// GET /api/alert-watches/:id/history — last N observations for this watch's
// site+parameter, so the UI can render a sparkline showing the reading vs.
// the threshold over time. Real data only.
router.get('/:id/history', requireAuth, async (req, res) => {
  try {
    const w = await db.get('SELECT * FROM alert_watches WHERE id=? AND user_id=?',
      [req.params.id, req.user.id])
    if (!w) return res.status(404).json({ error: 'watch not found' })
    if (!ALLOWED_PARAMS.includes(w.parameter)) return res.json({ points: [] })

    const rows = await db.all(
      `SELECT ${w.parameter} AS value, observed_at FROM observations
       WHERE site_id=? AND ${w.parameter} IS NOT NULL
       ORDER BY observed_at DESC LIMIT 30`,
      [w.site_id])
    const points = rows.reverse().map(r => ({
      value: parseFloat(r.value),
      observed_at: r.observed_at,
    }))
    res.json({ points, threshold: parseFloat(w.threshold), comparator: w.comparator })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
