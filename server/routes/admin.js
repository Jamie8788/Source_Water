const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const upload = require('../middleware/upload')

// GET /api/admin/stats
// Single query: collapses 10 COUNT(*)s into ONE round-trip so the pg pool
// only consumes one client per request (was 10 — exhausted Supabase pooler).
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const row = await db.get(`
      SELECT
        (SELECT COUNT(*) FROM users)                                                    AS total_users,
        (SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '7 days')       AS active_users,
        (SELECT COUNT(*) FROM posts)                                                    AS total_posts,
        (SELECT COUNT(*) FROM observations)                                             AS total_observations,
        (SELECT COUNT(*) FROM sites)                                                    AS total_sites,
        (SELECT COUNT(*) FROM quiz_attempts)                                            AS total_quiz_attempts,
        (SELECT COUNT(*) FROM alerts WHERE active=1)                                    AS active_alerts,
        (SELECT COUNT(*) FROM resources)                                                AS total_resources,
        (SELECT COUNT(*) FROM direct_messages)                                          AS total_messages,
        (SELECT COUNT(*) FROM users WHERE created_at::date = CURRENT_DATE)              AS new_users_today
    `, [])
    res.json({
      total_users: parseInt(row?.total_users ?? 0),
      active_users: parseInt(row?.active_users ?? 0),
      total_posts: parseInt(row?.total_posts ?? 0),
      total_observations: parseInt(row?.total_observations ?? 0),
      total_sites: parseInt(row?.total_sites ?? 0),
      total_quiz_attempts: parseInt(row?.total_quiz_attempts ?? 0),
      active_alerts: parseInt(row?.active_alerts ?? 0),
      total_resources: parseInt(row?.total_resources ?? 0),
      total_messages: parseInt(row?.total_messages ?? 0),
      new_users_today: parseInt(row?.new_users_today ?? 0),
    })
  } catch (err) {
    console.error('[admin/stats]', err.message)
    res.status(503).json({ error: 'stats unavailable' })
  }
})

// GET /api/admin/public-stats
// Unauthenticated — powers the landing page counters AND the logged-in
// dashboard KPIs for non-admin users. Only COUNT(*) reads, no PII leak.
// Returns both the short-name keys (sites/samples/members) the landing
// page uses AND the total_* keys the dashboard uses, so callers don't
// have to translate.
router.get('/public-stats', async (req, res) => {
  try {
    const row = await db.get(`
      SELECT
        (SELECT COUNT(*) FROM sites)                   AS sites,
        (SELECT COUNT(*) FROM observations)            AS samples,
        (SELECT COUNT(*) FROM users)                   AS members,
        (SELECT COUNT(*) FROM quiz_attempts)           AS quiz_attempts,
        (SELECT COUNT(*) FROM alerts WHERE active=1)   AS active_alerts
    `, [])
    const sites = parseInt(row?.sites ?? 0)
    const samples = parseInt(row?.samples ?? 0)
    const members = parseInt(row?.members ?? 0)
    res.json({
      // short-name keys (landing page)
      sites, samples, members,
      // total_* keys (dashboard) — same numbers, alternate field names
      total_sites: sites,
      total_observations: samples,
      total_users: members,
      total_quiz_attempts: parseInt(row?.quiz_attempts ?? 0),
      active_alerts: parseInt(row?.active_alerts ?? 0),
    })
  } catch (err) {
    console.error('[admin/public-stats]', err.message)
    res.status(503).json({ error: 'stats unavailable' })
  }
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
router.get('/sponsors', requireAuth, requireAdmin, async (req, res) => {
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
