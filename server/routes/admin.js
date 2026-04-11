const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const upload = require('../middleware/upload')

// GET /api/admin/stats
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  const [total_users, active_users, total_posts, total_observations, total_sites,
         total_quiz_attempts, active_alerts, total_resources, total_messages, new_users_today] =
    await Promise.all([
      db.get('SELECT COUNT(*) as c FROM users', []),
      db.get(`SELECT COUNT(*) as c FROM users WHERE last_login > NOW() - INTERVAL '7 days'`, []),
      db.get('SELECT COUNT(*) as c FROM posts', []),
      db.get('SELECT COUNT(*) as c FROM observations', []),
      db.get('SELECT COUNT(*) as c FROM sites', []),
      db.get('SELECT COUNT(*) as c FROM quiz_attempts', []),
      db.get('SELECT COUNT(*) as c FROM alerts WHERE active=1', []),
      db.get('SELECT COUNT(*) as c FROM resources', []),
      db.get('SELECT COUNT(*) as c FROM direct_messages', []),
      db.get(`SELECT COUNT(*) as c FROM users WHERE created_at::date = CURRENT_DATE`, []),
    ])
  res.json({
    total_users: parseInt(total_users?.c ?? 0),
    active_users: parseInt(active_users?.c ?? 0),
    total_posts: parseInt(total_posts?.c ?? 0),
    total_observations: parseInt(total_observations?.c ?? 0),
    total_sites: parseInt(total_sites?.c ?? 0),
    total_quiz_attempts: parseInt(total_quiz_attempts?.c ?? 0),
    active_alerts: parseInt(active_alerts?.c ?? 0),
    total_resources: parseInt(total_resources?.c ?? 0),
    total_messages: parseInt(total_messages?.c ?? 0),
    new_users_today: parseInt(new_users_today?.c ?? 0),
  })
})

// GET /api/admin/activity-log
router.get('/activity-log', requireAuth, requireAdmin, async (req, res) => {
  const { limit = 50, offset = 0, user_id } = req.query
  let query = 'SELECT al.*, u.username, u.display_name FROM activity_log al LEFT JOIN users u ON al.user_id=u.id'
  const params = []
  if (user_id) { query += ' WHERE al.user_id=?'; params.push(user_id) }
  query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  const [logs, totalRow] = await Promise.all([
    db.all(query, params),
    user_id
      ? db.get('SELECT COUNT(*) as c FROM activity_log WHERE user_id=?', [user_id])
      : db.get('SELECT COUNT(*) as c FROM activity_log', []),
  ])
  res.json({ logs, total: parseInt(totalRow?.c ?? 0) })
})

// GET /PUT /api/admin/settings
router.get('/settings', requireAuth, requireAdmin, async (req, res) => {
  const settings = await db.all('SELECT * FROM site_settings', [])
  const obj = {}
  settings.forEach(s => { try { obj[s.key] = JSON.parse(s.value) } catch { obj[s.key] = s.value } })
  res.json(obj)
})

router.put('/settings', requireAuth, requireAdmin, async (req, res) => {
  const updates = req.body
  for (const [k, v] of Object.entries(updates)) {
    await db.run(
      `INSERT INTO site_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,
      [k, JSON.stringify(v)]
    )
  }
  await db.run('INSERT INTO activity_log (user_id,action,target_type) VALUES (?,?,?)',
    [req.user.id, 'updated_settings', 'settings'])
  res.json({ success: true })
})

// Sponsors CRUD
router.get('/sponsors', requireAuth, async (req, res) => {
  const active = req.query.active === 'true'
  const sponsors = active
    ? await db.all(`SELECT * FROM sponsors WHERE status='active' ORDER BY tier DESC`, [])
    : await db.all('SELECT * FROM sponsors ORDER BY created_at DESC', [])
  res.json(sponsors.map(s => ({ ...s, placement: s.placement ? JSON.parse(s.placement) : [] })))
})

router.post('/sponsors', requireAuth, requireAdmin, upload.single('logo'), async (req, res) => {
  const { name, website_url, tagline, tier, placement, status, start_date, end_date, custom_html } = req.body
  const logo = req.file ? `/uploads/images/${req.file.filename}` : null
  const { lastInsertRowid } = await db.run(
    'INSERT INTO sponsors (name,website_url,logo_path,tagline,tier,placement,status,start_date,end_date,custom_html) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [name, website_url, logo, tagline, tier, JSON.stringify(placement || []), status || 'active', start_date, end_date, custom_html])
  res.json(await db.get('SELECT * FROM sponsors WHERE id=?', [lastInsertRowid]))
})

router.put('/sponsors/:id', requireAuth, requireAdmin, upload.single('logo'), async (req, res) => {
  const { name, website_url, tagline, tier, placement, status, start_date, end_date } = req.body
  const logo = req.file ? `/uploads/images/${req.file.filename}` : undefined
  const updates = ['name=?', 'website_url=?', 'tagline=?', 'tier=?', 'placement=?', 'status=?', 'start_date=?', 'end_date=?']
  const vals = [name, website_url, tagline, tier, JSON.stringify(placement || []), status, start_date, end_date]
  if (logo) { updates.push('logo_path=?'); vals.push(logo) }
  vals.push(req.params.id)
  await db.run(`UPDATE sponsors SET ${updates.join(',')} WHERE id=?`, vals)
  res.json(await db.get('SELECT * FROM sponsors WHERE id=?', [req.params.id]))
})

router.delete('/sponsors/:id', requireAuth, requireAdmin, async (req, res) => {
  await db.run('DELETE FROM sponsors WHERE id=?', [req.params.id])
  res.json({ success: true })
})

// Alerts CRUD
router.get('/alerts', requireAuth, async (req, res) => {
  const alerts = await db.all(`SELECT a.*, s.name as site_name FROM alerts a LEFT JOIN sites s ON a.site_id=s.id ORDER BY a.created_at DESC`, [])
  res.json({ alerts })
})

router.post('/alerts', requireAuth, requireAdmin, async (req, res) => {
  const { title, site_id, parameter, current_value, threshold_value, severity, message, type } = req.body
  const { lastInsertRowid } = await db.run(
    'INSERT INTO alerts (site_id,parameter,current_value,threshold_value,severity,message,created_by) VALUES (?,?,?,?,?,?,?)',
    [site_id || null, parameter || title || 'General Alert', current_value || null,
      threshold_value || null, severity || 'medium', message || title || '', req.user.id])
  res.json({ alert: await db.get('SELECT * FROM alerts WHERE id=?', [lastInsertRowid]) })
})

router.put('/alerts/:id', requireAuth, requireAdmin, async (req, res) => {
  const { active, severity, message } = req.body
  await db.run('UPDATE alerts SET active=?,severity=?,message=? WHERE id=?', [active ? 1 : 0, severity, message, req.params.id])
  res.json(await db.get('SELECT * FROM alerts WHERE id=?', [req.params.id]))
})

router.delete('/alerts/:id', requireAuth, requireAdmin, async (req, res) => {
  await db.run('DELETE FROM alerts WHERE id=?', [req.params.id])
  res.json({ success: true })
})

// Notifications
router.get('/notifications', requireAuth, async (req, res) => {
  const notifs = await db.all('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30', [req.user.id])
  res.json(notifs)
})

router.put('/notifications/read', requireAuth, async (req, res) => {
  await db.run('UPDATE notifications SET read=1 WHERE user_id=?', [req.user.id])
  res.json({ success: true })
})

module.exports = router
