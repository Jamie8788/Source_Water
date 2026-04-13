const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const upload = require('../middleware/upload')

// GET /api/sites
router.get('/', requireAuth, async (req, res) => {
  const { community } = req.query
  const sites = community && community !== 'All'
    ? await db.all('SELECT * FROM sites WHERE community=? ORDER BY name', [community])
    : await db.all('SELECT * FROM sites ORDER BY name', [])

  const enriched = await Promise.all(sites.map(async s => {
    const [lastObs, obsRow] = await Promise.all([
      db.get('SELECT * FROM observations WHERE site_id=? ORDER BY observed_at DESC LIMIT 1', [s.id]),
      db.get('SELECT COUNT(*) as c FROM observations WHERE site_id=?', [s.id]),
    ])
    return { ...s, parameters_tested: s.parameters_tested ? JSON.parse(s.parameters_tested) : [], last_observation: lastObs, observation_count: parseInt(obsRow?.c ?? 0) }
  }))
  res.json(enriched)
})

// GET /api/sites/:id
router.get('/:id', requireAuth, async (req, res) => {
  const site = await db.get('SELECT * FROM sites WHERE id=?', [req.params.id])
  if (!site) return res.status(404).json({ error: 'Site not found' })
  res.json({ ...site, parameters_tested: site.parameters_tested ? JSON.parse(site.parameters_tested) : [] })
})

// POST /api/sites
router.post('/', requireAuth, upload.single('reference_photo'), async (req, res) => {
  const { name, description, latitude, longitude, body_of_water, water_body_type, organization, dataset_name, access_risk, safety_spring, safety_summer, safety_fall, safety_winter, parameters_tested, community } = req.body
  const photo = req.file ? `/uploads/images/${req.file.filename}` : null
  const { lastInsertRowid } = await db.run(
    `INSERT INTO sites (name,description,latitude,longitude,body_of_water,water_body_type,organization,dataset_name,access_risk,safety_spring,safety_summer,safety_fall,safety_winter,parameters_tested,reference_photo,community,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [name, description, parseFloat(latitude), parseFloat(longitude), body_of_water, water_body_type, organization, dataset_name, access_risk || 'Low', safety_spring, safety_summer, safety_fall, safety_winter, JSON.stringify(parameters_tested || []), photo, community, req.user.id])
  await db.run('INSERT INTO activity_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)',
    [req.user.id, 'added_site', 'site', lastInsertRowid])
  res.json(await db.get('SELECT * FROM sites WHERE id=?', [lastInsertRowid]))
})

// PUT /api/sites/:id (admin)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, description, latitude, longitude, body_of_water, water_body_type, organization, access_risk, safety_spring, safety_summer, safety_fall, safety_winter, parameters_tested, community } = req.body
  await db.run(
    `UPDATE sites SET name=?,description=?,latitude=?,longitude=?,body_of_water=?,water_body_type=?,organization=?,access_risk=?,safety_spring=?,safety_summer=?,safety_fall=?,safety_winter=?,parameters_tested=?,community=? WHERE id=?`,
    [name, description, parseFloat(latitude), parseFloat(longitude), body_of_water, water_body_type, organization, access_risk, safety_spring, safety_summer, safety_fall, safety_winter, JSON.stringify(parameters_tested || []), community, req.params.id])
  res.json(await db.get('SELECT * FROM sites WHERE id=?', [req.params.id]))
})

// DELETE /api/sites/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const site = await db.get('SELECT * FROM sites WHERE id=?', [req.params.id])
  if (!site) return res.status(404).json({ error: 'Site not found' })
  if (!req.user.is_admin && site.created_by !== req.user.id) return res.status(403).json({ error: 'Not authorized' })
  await db.run('DELETE FROM observations WHERE site_id=?', [req.params.id])
  await db.run('DELETE FROM sites WHERE id=?', [req.params.id])
  res.json({ success: true })
})

// GET /api/sites/:id/observations
router.get('/:id/observations', requireAuth, async (req, res) => {
  const obs = await db.all(
    `SELECT o.*, u.username, u.display_name, u.avatar_emoji FROM observations o JOIN users u ON o.observer_id=u.id WHERE o.site_id=? ORDER BY o.observed_at DESC`,
    [req.params.id])
  const parsed = obs.map(o => ({
    ...o,
    photos: o.photos ? JSON.parse(o.photos) : [],
    current_weather: o.current_weather ? JSON.parse(o.current_weather) : [],
    ecoli_samples: o.ecoli_samples ? JSON.parse(o.ecoli_samples) : [],
    out_of_range_flags: o.out_of_range_flags ? JSON.parse(o.out_of_range_flags) : [],
  }))
  res.json(parsed)
})

// POST /api/sites/:id/observations
router.post('/:id/observations', requireAuth, upload.array('photos', 10), async (req, res) => {
  try {
    const body = req.body
    const photos = req.files?.map(f => `/uploads/images/${f.filename}`) || []

    const flags = []
    const checks = { ph: [6.5, 8.5], dissolved_oxygen: [4, null], turbidity: [null, 4], conductivity: [null, 2500] }
    Object.entries(checks).forEach(([param, [min, max]]) => {
      const val = parseFloat(body[param])
      if (!isNaN(val)) {
        if (min !== null && val < min) flags.push(`${param} below minimum (${val} < ${min})`)
        if (max !== null && val > max) flags.push(`${param} above maximum (${val} > ${max})`)
      }
    })

    const { lastInsertRowid } = await db.run(`
      INSERT INTO observations (site_id,observer_id,observed_at,sample_id,current_weather,current_weather_desc,past24_weather,past24_weather_desc,ph,ph_equipment,dissolved_oxygen,do_equipment,chlorine,chlorine_equipment,hardness,hardness_equipment,alkalinity,alkalinity_equipment,conductivity,conductivity_equipment,air_temp,air_temp_equipment,water_temp,water_temp_equipment,nitrate_nitrogen,nitrate_n_equipment,turbidity,turbidity_equipment,tds,tds_equipment,phosphorus,phosphorus_equipment,ecoli_samples,ecoli_equipment,total_coliforms,coliforms_equipment,secchi_depth,secchi_bottom_visible,water_depth,water_color,water_odor,surface_condition,photos,notes,out_of_range_flags)
      VALUES (?,?,NOW(),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      req.params.id, req.user.id, body.sample_id,
      JSON.stringify(body.current_weather || []), body.current_weather_desc,
      JSON.stringify(body.past24_weather || []), body.past24_weather_desc,
      parseFloat(body.ph) || null, body.ph_equipment,
      parseFloat(body.dissolved_oxygen) || null, body.do_equipment,
      parseFloat(body.chlorine) || null, body.chlorine_equipment,
      parseFloat(body.hardness) || null, body.hardness_equipment,
      parseFloat(body.alkalinity) || null, body.alkalinity_equipment,
      parseFloat(body.conductivity) || null, body.conductivity_equipment,
      parseFloat(body.air_temp) || null, body.air_temp_equipment,
      parseFloat(body.water_temp) || null, body.water_temp_equipment,
      parseFloat(body.nitrate_nitrogen) || null, body.nitrate_n_equipment,
      parseFloat(body.turbidity) || null, body.turbidity_equipment,
      parseFloat(body.tds) || null, body.tds_equipment,
      parseFloat(body.phosphorus) || null, body.phosphorus_equipment,
      JSON.stringify(body.ecoli_samples || []), body.ecoli_equipment,
      parseFloat(body.total_coliforms) || null, body.coliforms_equipment,
      parseFloat(body.secchi_depth) || null, body.secchi_bottom_visible ? 1 : 0,
      parseFloat(body.water_depth) || null, body.water_color, body.water_odor, body.surface_condition,
      JSON.stringify(photos), body.notes, JSON.stringify(flags)
    ])

    if (flags.length > 0) {
      await Promise.all(flags.map(flag =>
        db.run('INSERT INTO alerts (site_id,parameter,message,severity,created_by) VALUES (?,?,?,?,?)',
          [req.params.id, 'multi', flag, 'warning', req.user.id])
      ))
      // Mark observation as flagged
      await db.run('UPDATE observations SET flagged=1 WHERE id=?', [lastInsertRowid])
    }

    await Promise.all([
      db.run('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)',
        [req.user.id, 15, 'observation', new Date().toISOString().slice(0, 7)]),
      db.run('INSERT INTO activity_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)',
        [req.user.id, 'added_observation', 'site', req.params.id]),
    ])

    res.json({ id: lastInsertRowid, flags })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/sites/observations/:id (admin)
router.delete('/observations/:id', requireAuth, requireAdmin, async (req, res) => {
  await db.run('DELETE FROM observations WHERE id=?', [req.params.id])
  res.json({ success: true })
})

// GET /api/sites/all-observations (admin)
router.get('/all-observations', requireAuth, requireAdmin, async (req, res) => {
  const { limit = 50, offset = 0, site_id } = req.query
  let q = `SELECT o.*, s.name as site_name, u.display_name as observer_name, u.username FROM observations o LEFT JOIN sites s ON o.site_id=s.id LEFT JOIN users u ON o.observer_id=u.id`
  const params = []
  if (site_id) { q += ' WHERE o.site_id=?'; params.push(site_id) }
  q += ' ORDER BY o.observed_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  const [observations, totalRow] = await Promise.all([
    db.all(q, params),
    site_id
      ? db.get('SELECT COUNT(*) as c FROM observations WHERE site_id=?', [site_id])
      : db.get('SELECT COUNT(*) as c FROM observations', []),
  ])
  res.json({ observations, total: parseInt(totalRow?.c ?? 0) })
})

// GET /api/sites/:id/dataset-summary — Shows data capacity and stats
router.get('/:id/dataset-summary', requireAuth, async (req, res) => {
  const site = await db.get('SELECT * FROM sites WHERE id=?', [req.params.id])
  if (!site) return res.status(404).json({ error: 'Site not found' })

  const stats = await db.get(`
    SELECT
      COUNT(*) as total_measurements,
      COUNT(DISTINCT DATE(observed_at)) as days_sampled,
      MAX(observed_at) as latest_reading,
      MIN(observed_at) as first_reading,
      COUNT(photos) as photos_count,
      COUNT(CASE WHEN flagged=1 THEN 1 END) as flagged_count,
      COUNT(CASE WHEN out_of_range_flags IS NOT NULL AND out_of_range_flags != '[]' THEN 1 END) as anomalies
    FROM observations WHERE site_id=?
  `, [req.params.id])

  const parameters = await db.all(`
    SELECT 
      CASE 
        WHEN ph IS NOT NULL THEN 'pH'
        WHEN dissolved_oxygen IS NOT NULL THEN 'Dissolved Oxygen' 
        WHEN conductivity IS NOT NULL THEN 'Conductivity'
        WHEN water_temp IS NOT NULL THEN 'Water Temperature'
        WHEN air_temp IS NOT NULL THEN 'Air Temperature'
        WHEN turbidity IS NOT NULL THEN 'Turbidity'
        WHEN hardness IS NOT NULL THEN 'Hardness'
        WHEN alkalinity IS NOT NULL THEN 'Alkalinity'
        WHEN chlorine IS NOT NULL THEN 'Chlorine'
        WHEN nitrate_nitrogen IS NOT NULL THEN 'Nitrate N'
        WHEN phosphorus IS NOT NULL THEN 'Phosphorus'
        WHEN chloride IS NOT NULL THEN 'Chloride'
        WHEN nitrites IS NOT NULL THEN 'Nitrites'
        WHEN tds IS NOT NULL THEN 'TDS'
        WHEN secchi_depth IS NOT NULL THEN 'Secchi Depth'
        WHEN total_coliforms IS NOT NULL THEN 'Total Coliforms'
      END as param_name,
      COUNT(*) as measurements,
      ROUND(AVG(CASE WHEN ph IS NOT NULL THEN ph WHEN dissolved_oxygen IS NOT NULL THEN dissolved_oxygen WHEN conductivity IS NOT NULL THEN conductivity WHEN water_temp IS NOT NULL THEN water_temp WHEN air_temp IS NOT NULL THEN air_temp WHEN turbidity IS NOT NULL THEN turbidity WHEN hardness IS NOT NULL THEN hardness WHEN alkalinity IS NOT NULL THEN alkalinity WHEN chlorine IS NOT NULL THEN chlorine WHEN nitrate_nitrogen IS NOT NULL THEN nitrate_nitrogen WHEN phosphorus IS NOT NULL THEN phosphorus WHEN chloride IS NOT NULL THEN chloride WHEN nitrites IS NOT NULL THEN nitrites WHEN tds IS NOT NULL THEN tds WHEN secchi_depth IS NOT NULL THEN secchi_depth WHEN total_coliforms IS NOT NULL THEN total_coliforms END), 2) as average
    FROM observations WHERE site_id=? AND (ph IS NOT NULL OR dissolved_oxygen IS NOT NULL OR conductivity IS NOT NULL OR water_temp IS NOT NULL OR air_temp IS NOT NULL OR turbidity IS NOT NULL OR hardness IS NOT NULL OR alkalinity IS NOT NULL OR chlorine IS NOT NULL OR nitrate_nitrogen IS NOT NULL OR phosphorus IS NOT NULL OR chloride IS NOT NULL OR nitrites IS NOT NULL OR tds IS NOT NULL OR secchi_depth IS NOT NULL OR total_coliforms IS NOT NULL)
    GROUP BY param_name
    ORDER BY measurements DESC
  `, [req.params.id])

  res.json({
    site: site,
    capacity: 10000,
    capacity_used: parseInt(stats?.total_measurements ?? 0),
    capacity_percent: Math.round((parseInt(stats?.total_measurements ?? 0) / 10000) * 100),
    ...stats,
    parameters_measured: parameters.filter(p => p.param_name),
  })
})

// GET /api/sites/:id/alerts — Shows flagged observations
router.get('/:id/alerts', requireAuth, async (req, res) => {
  const alerts = await db.all(`
    SELECT o.*, u.display_name, u.username
    FROM observations o
    LEFT JOIN users u ON o.observer_id=u.id
    WHERE o.site_id=? AND (o.flagged=1 OR (o.out_of_range_flags IS NOT NULL AND o.out_of_range_flags != '[]'))
    ORDER BY o.observed_at DESC
  `, [req.params.id])
  
  const parsed = alerts.map(a => ({
    ...a,
    out_of_range_flags: a.out_of_range_flags ? JSON.parse(a.out_of_range_flags) : [],
  }))
  res.json(parsed)
})

module.exports = router
