const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const upload = require('../middleware/upload')

// GET /api/admin/stats
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const stats = {
    total_users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    active_users: db.prepare("SELECT COUNT(*) as c FROM users WHERE last_login > datetime('now','-7 days')").get().c,
    total_posts: db.prepare('SELECT COUNT(*) as c FROM posts').get().c,
    total_observations: db.prepare('SELECT COUNT(*) as c FROM observations').get().c,
    total_sites: db.prepare('SELECT COUNT(*) as c FROM sites').get().c,
    total_quiz_attempts: db.prepare('SELECT COUNT(*) as c FROM quiz_attempts').get().c,
    active_alerts: db.prepare('SELECT COUNT(*) as c FROM alerts WHERE active=1').get().c,
    total_resources: db.prepare('SELECT COUNT(*) as c FROM resources').get().c,
    total_messages: db.prepare('SELECT COUNT(*) as c FROM direct_messages').get().c,
    new_users_today: db.prepare("SELECT COUNT(*) as c FROM users WHERE date(created_at)=date('now')").get().c,
  }
  res.json(stats)
})

// GET /api/admin/activity-log
router.get('/activity-log', requireAuth, requireAdmin, (req, res) => {
  const { limit=50, offset=0, user_id } = req.query
  let query = 'SELECT al.*, u.username, u.display_name FROM activity_log al LEFT JOIN users u ON al.user_id=u.id'
  const params = []
  if (user_id) { query += ' WHERE al.user_id=?'; params.push(user_id) }
  query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  const logs = db.prepare(query).all(...params)
  const total = db.prepare(user_id ? 'SELECT COUNT(*) as c FROM activity_log WHERE user_id=?' : 'SELECT COUNT(*) as c FROM activity_log').get(user_id||undefined)
  res.json({ logs, total: total.c })
})

// GET/PUT /api/admin/settings
router.get('/settings', requireAuth, requireAdmin, (req, res) => {
  const settings = db.prepare('SELECT * FROM site_settings').all()
  const obj = {}
  settings.forEach(s => { try { obj[s.key] = JSON.parse(s.value) } catch { obj[s.key] = s.value } })
  res.json(obj)
})

router.put('/settings', requireAuth, requireAdmin, (req, res) => {
  const updates = req.body
  const ins = db.prepare('INSERT OR REPLACE INTO site_settings (key,value) VALUES (?,?)')
  const tx = db.transaction(() => {
    Object.entries(updates).forEach(([k,v]) => ins.run(k, JSON.stringify(v)))
  })
  tx()
  db.prepare('INSERT INTO activity_log (user_id,action,target_type) VALUES (?,?,?)').run(req.user.id,'updated_settings','settings')
  res.json({ success: true })
})

// Sponsors CRUD
router.get('/sponsors', requireAuth, (req, res) => {
  const active = req.query.active === 'true'
  const sponsors = active
    ? db.prepare("SELECT * FROM sponsors WHERE status='active' ORDER BY tier DESC").all()
    : db.prepare('SELECT * FROM sponsors ORDER BY created_at DESC').all()
  res.json(sponsors.map(s => ({ ...s, placement: s.placement ? JSON.parse(s.placement) : [] })))
})

router.post('/sponsors', requireAuth, requireAdmin, upload.single('logo'), (req, res) => {
  const { name, website_url, tagline, tier, placement, status, start_date, end_date, custom_html } = req.body
  const logo = req.file ? `/uploads/images/${req.file.filename}` : null
  const result = db.prepare('INSERT INTO sponsors (name,website_url,logo_path,tagline,tier,placement,status,start_date,end_date,custom_html) VALUES (?,?,?,?,?,?,?,?,?,?)').run(name,website_url,logo,tagline,tier,JSON.stringify(placement||[]),status||'active',start_date,end_date,custom_html)
  res.json(db.prepare('SELECT * FROM sponsors WHERE id=?').get(result.lastInsertRowid))
})

router.put('/sponsors/:id', requireAuth, requireAdmin, upload.single('logo'), (req, res) => {
  const { name, website_url, tagline, tier, placement, status, start_date, end_date } = req.body
  const logo = req.file ? `/uploads/images/${req.file.filename}` : undefined
  const updates = ['name=?','website_url=?','tagline=?','tier=?','placement=?','status=?','start_date=?','end_date=?']
  const vals = [name,website_url,tagline,tier,JSON.stringify(placement||[]),status,start_date,end_date]
  if (logo) { updates.push('logo_path=?'); vals.push(logo) }
  vals.push(req.params.id)
  db.prepare(`UPDATE sponsors SET ${updates.join(',')} WHERE id=?`).run(...vals)
  res.json(db.prepare('SELECT * FROM sponsors WHERE id=?').get(req.params.id))
})

router.delete('/sponsors/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM sponsors WHERE id=?').run(req.params.id)
  res.json({ success: true })
})

// Alerts CRUD
router.get('/alerts', requireAuth, (req, res) => {
  const alerts = db.prepare(`SELECT a.*, s.name as site_name FROM alerts a LEFT JOIN sites s ON a.site_id=s.id ORDER BY a.created_at DESC`).all()
  res.json({ alerts })
})

router.post('/alerts', requireAuth, requireAdmin, (req, res) => {
  const { title, site_id, parameter, current_value, threshold_value, severity, message, type } = req.body
  const result = db.prepare('INSERT INTO alerts (site_id,parameter,current_value,threshold_value,severity,message,created_by) VALUES (?,?,?,?,?,?,?)').run(
    site_id || null, parameter || title || 'General Alert', current_value || null,
    threshold_value || null, severity || 'medium', message || title || '', req.user.id
  )
  const alert = db.prepare('SELECT * FROM alerts WHERE id=?').get(result.lastInsertRowid)
  res.json({ alert })
})

router.put('/alerts/:id', requireAuth, requireAdmin, (req, res) => {
  const { active, severity, message } = req.body
  db.prepare('UPDATE alerts SET active=?,severity=?,message=? WHERE id=?').run(active?1:0,severity,message,req.params.id)
  res.json(db.prepare('SELECT * FROM alerts WHERE id=?').get(req.params.id))
})

router.delete('/alerts/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM alerts WHERE id=?').run(req.params.id)
  res.json({ success: true })
})

// Notifications
router.get('/notifications', requireAuth, (req, res) => {
  const notifs = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30').all(req.user.id)
  res.json(notifs)
})

router.put('/notifications/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(req.user.id)
  res.json({ success: true })
})

module.exports = router
