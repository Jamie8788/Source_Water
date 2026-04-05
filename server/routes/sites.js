const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const upload = require('../middleware/upload')

// GET /api/sites
router.get('/', requireAuth, (req, res) => {
  const { community } = req.query
  let sites = community && community !== 'All'
    ? db.prepare('SELECT * FROM sites WHERE community=? ORDER BY name').all(community)
    : db.prepare('SELECT * FROM sites ORDER BY name').all()

  const enriched = sites.map(s => {
    const lastObs = db.prepare('SELECT * FROM observations WHERE site_id=? ORDER BY observed_at DESC LIMIT 1').get(s.id)
    const obsCount = db.prepare('SELECT COUNT(*) as c FROM observations WHERE site_id=?').get(s.id).c
    return { ...s, parameters_tested: s.parameters_tested ? JSON.parse(s.parameters_tested) : [], last_observation: lastObs, observation_count: obsCount }
  })
  res.json(enriched)
})

// GET /api/sites/:id
router.get('/:id', requireAuth, (req, res) => {
  const site = db.prepare('SELECT * FROM sites WHERE id=?').get(req.params.id)
  if (!site) return res.status(404).json({ error: 'Site not found' })
  res.json({ ...site, parameters_tested: site.parameters_tested ? JSON.parse(site.parameters_tested) : [] })
})

// POST /api/sites (admin)
router.post('/', requireAuth, requireAdmin, upload.single('reference_photo'), (req, res) => {
  const { name,description,latitude,longitude,body_of_water,water_body_type,organization,dataset_name,access_risk,safety_spring,safety_summer,safety_fall,safety_winter,parameters_tested,community } = req.body
  const photo = req.file ? `/uploads/images/${req.file.filename}` : null
  const result = db.prepare(`INSERT INTO sites (name,description,latitude,longitude,body_of_water,water_body_type,organization,dataset_name,access_risk,safety_spring,safety_summer,safety_fall,safety_winter,parameters_tested,reference_photo,community,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(name,description,parseFloat(latitude),parseFloat(longitude),body_of_water,water_body_type,organization,dataset_name,access_risk||'Low',safety_spring,safety_summer,safety_fall,safety_winter,JSON.stringify(parameters_tested||[]),photo,community,req.user.id)
  db.prepare('INSERT INTO activity_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)').run(req.user.id,'added_site','site',result.lastInsertRowid)
  res.json(db.prepare('SELECT * FROM sites WHERE id=?').get(result.lastInsertRowid))
})

// PUT /api/sites/:id (admin)
router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const { name,description,latitude,longitude,body_of_water,water_body_type,organization,access_risk,safety_spring,safety_summer,safety_fall,safety_winter,parameters_tested,community } = req.body
  db.prepare(`UPDATE sites SET name=?,description=?,latitude=?,longitude=?,body_of_water=?,water_body_type=?,organization=?,access_risk=?,safety_spring=?,safety_summer=?,safety_fall=?,safety_winter=?,parameters_tested=?,community=? WHERE id=?`).run(name,description,parseFloat(latitude),parseFloat(longitude),body_of_water,water_body_type,organization,access_risk,safety_spring,safety_summer,safety_fall,safety_winter,JSON.stringify(parameters_tested||[]),community,req.params.id)
  res.json(db.prepare('SELECT * FROM sites WHERE id=?').get(req.params.id))
})

// DELETE /api/sites/:id (admin)
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM sites WHERE id=?').run(req.params.id)
  res.json({ success: true })
})

// GET /api/sites/:id/observations
router.get('/:id/observations', requireAuth, (req, res) => {
  const obs = db.prepare(`SELECT o.*, u.username, u.display_name, u.avatar_emoji FROM observations o JOIN users u ON o.observer_id=u.id WHERE o.site_id=? ORDER BY o.observed_at DESC`).all(req.params.id)
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
router.post('/:id/observations', requireAuth, upload.array('photos', 10), (req, res) => {
  try {
    const body = req.body
    const photos = req.files?.map(f => `/uploads/images/${f.filename}`) || []

    // Check for out-of-range flags
    const flags = []
    const checks = { ph: [6.5,8.5], dissolved_oxygen: [4,null], turbidity: [null,4], conductivity: [null,2500] }
    Object.entries(checks).forEach(([param,[min,max]]) => {
      const val = parseFloat(body[param])
      if (!isNaN(val)) {
        if (min !== null && val < min) flags.push(`${param} below minimum (${val} < ${min})`)
        if (max !== null && val > max) flags.push(`${param} above maximum (${val} > ${max})`)
      }
    })

    const result = db.prepare(`
      INSERT INTO observations (site_id,observer_id,observed_at,sample_id,current_weather,current_weather_desc,past24_weather,past24_weather_desc,ph,ph_equipment,dissolved_oxygen,do_equipment,chlorine,chlorine_equipment,hardness,hardness_equipment,alkalinity,alkalinity_equipment,conductivity,conductivity_equipment,air_temp,air_temp_equipment,water_temp,water_temp_equipment,nitrate_nitrogen,nitrate_n_equipment,turbidity,turbidity_equipment,tds,tds_equipment,phosphorus,phosphorus_equipment,ecoli_samples,ecoli_equipment,total_coliforms,coliforms_equipment,secchi_depth,secchi_bottom_visible,water_depth,water_color,water_odor,surface_condition,photos,notes,out_of_range_flags)
      VALUES (?,?,datetime('now'),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      req.params.id, req.user.id, body.sample_id,
      JSON.stringify(body.current_weather || []), body.current_weather_desc,
      JSON.stringify(body.past24_weather || []), body.past24_weather_desc,
      parseFloat(body.ph)||null, body.ph_equipment,
      parseFloat(body.dissolved_oxygen)||null, body.do_equipment,
      parseFloat(body.chlorine)||null, body.chlorine_equipment,
      parseFloat(body.hardness)||null, body.hardness_equipment,
      parseFloat(body.alkalinity)||null, body.alkalinity_equipment,
      parseFloat(body.conductivity)||null, body.conductivity_equipment,
      parseFloat(body.air_temp)||null, body.air_temp_equipment,
      parseFloat(body.water_temp)||null, body.water_temp_equipment,
      parseFloat(body.nitrate_nitrogen)||null, body.nitrate_n_equipment,
      parseFloat(body.turbidity)||null, body.turbidity_equipment,
      parseFloat(body.tds)||null, body.tds_equipment,
      parseFloat(body.phosphorus)||null, body.phosphorus_equipment,
      JSON.stringify(body.ecoli_samples || []), body.ecoli_equipment,
      parseFloat(body.total_coliforms)||null, body.coliforms_equipment,
      parseFloat(body.secchi_depth)||null, body.secchi_bottom_visible ? 1 : 0,
      parseFloat(body.water_depth)||null, body.water_color, body.water_odor, body.surface_condition,
      JSON.stringify(photos), body.notes, JSON.stringify(flags)
    )

    // Create alert if out of range
    if (flags.length > 0) {
      flags.forEach(flag => {
        db.prepare('INSERT INTO alerts (site_id,parameter,message,severity,created_by) VALUES (?,?,?,?,?)').run(req.params.id,'multi',flag,'warning',req.user.id)
      })
    }

    // Award points
    db.prepare('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)').run(req.user.id,15,'observation',new Date().toISOString().slice(0,7))
    db.prepare('INSERT INTO activity_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)').run(req.user.id,'added_observation','site',req.params.id)

    res.json({ id: result.lastInsertRowid, flags })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
