const router = require('express').Router()
const bcrypt = require('bcryptjs')
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const upload = require('../middleware/upload')

const safe = (u) => { const { password_hash, ...s } = u; return s }

// GET /api/users (admin)
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(safe)
  res.json({ users })
})

// GET /api/users/search?q=
router.get('/search', requireAuth, (req, res) => {
  const q = `%${req.query.q || ''}%`
  const users = db.prepare(
    `SELECT id, username, display_name, avatar_emoji, role FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND is_active=1 LIMIT 20`
  ).all(q, q).map(safe)
  res.json({ users })
})

// GET /api/users/online
router.get('/online', requireAuth, (req, res) => {
  // Simple: users active in last 5 min (based on last_login)
  const users = db.prepare(`SELECT id,username,display_name,avatar_emoji,avatar_bg_color,role FROM users WHERE last_login > datetime('now','-5 minutes')`).all()
  res.json(users)
})

// GET /api/users/:id
router.get('/:id', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json(safe(user))
})

// PUT /api/users/me (update own profile)
router.put('/me', requireAuth, upload.single('avatar_file'), async (req, res) => {
  try {
    const { display_name, bio, location, organization, phone, title, research_role, institution, research_area, sound_enabled, theme, onboarding_completed } = req.body
    const updates = []
    const vals = []
    const fields = { display_name, bio, location, organization, phone, title, research_role, institution, research_area }
    Object.entries(fields).forEach(([k,v]) => { if (v !== undefined) { updates.push(`${k}=?`); vals.push(v) } })
    if (sound_enabled !== undefined) { updates.push('sound_enabled=?'); vals.push(sound_enabled === 'true' || sound_enabled === true ? 1 : 0) }
    if (theme !== undefined) { updates.push('theme=?'); vals.push(theme) }
    if (onboarding_completed !== undefined) { updates.push('onboarding_completed=?'); vals.push(1) }
    if (req.file) {
      const avatarPath = `/uploads/${req.file.filename}`
      updates.push('avatar_url=?'); vals.push(avatarPath)
    }
    if (!updates.length) return res.json(safe(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)))
    vals.push(req.user.id)
    db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...vals)
    const updated = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)
    res.json(safe(updated))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/users/me/password
router.put('/me/password', requireAuth, async (req, res) => {
  const { current, newPassword } = req.body
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)
  const valid = await bcrypt.compare(current, user.password_hash)
  if (!valid) return res.status(400).json({ error: 'Current password incorrect' })
  const hash = await bcrypt.hash(newPassword, 10)
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.user.id)
  res.json({ success: true })
})

// GET /api/users/:id/stats
router.get('/:id/stats', requireAuth, (req, res) => {
  const uid = req.params.id
  const posts = db.prepare('SELECT COUNT(*) as c FROM posts WHERE user_id=?').get(uid).c
  const comments = db.prepare('SELECT COUNT(*) as c FROM comments WHERE user_id=?').get(uid).c
  const observations = db.prepare('SELECT COUNT(*) as c FROM observations WHERE observer_id=?').get(uid).c
  const quizAttempts = db.prepare('SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=?').get(uid).c
  const quizPassed = db.prepare('SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=? AND passed=1').get(uid).c
  const points = db.prepare('SELECT COALESCE(SUM(points),0) as p FROM leaderboard_points WHERE user_id=?').get(uid).p
  const xp = db.prepare('SELECT xp FROM users WHERE id=?').get(uid)?.xp || 0
  res.json({ posts, comments, observations, quizAttempts, quizPassed, points, xp })
})

// Admin: update user role/status
router.put('/:id/admin', requireAuth, requireAdmin, (req, res) => {
  const { role, is_active, is_admin } = req.body
  const updates = []
  const vals = []
  if (role !== undefined) { updates.push('role=?'); vals.push(role) }
  if (is_active !== undefined) { updates.push('is_active=?'); vals.push(is_active ? 1 : 0) }
  if (is_admin !== undefined) { updates.push('is_admin=?'); vals.push(is_admin ? 1 : 0) }
  if (!updates.length) return res.json({ success: true })
  vals.push(req.params.id)
  db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...vals)
  db.prepare('INSERT INTO activity_log (user_id,action,target_type,target_id,details) VALUES (?,?,?,?,?)').run(req.user.id,'admin_update_user','user',req.params.id,JSON.stringify({role,is_active,is_admin}))
  res.json({ success: true })
})

// Admin: generic PUT /:id — shorthand used by admin panel
router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const { role, is_active, is_admin } = req.body
  const updates = []; const vals = []
  if (role !== undefined) { updates.push('role=?'); vals.push(role) }
  if (is_active !== undefined) { updates.push('is_active=?'); vals.push(is_active ? 1 : 0) }
  if (is_admin !== undefined) { updates.push('is_admin=?'); vals.push(is_admin ? 1 : 0) }
  if (!updates.length) return res.json({ success: true })
  vals.push(req.params.id)
  db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...vals)
  res.json({ success: true })
})

// Admin: DELETE /:id
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const uid = parseInt(req.params.id)
  if (uid === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' })
  db.prepare('DELETE FROM users WHERE id=?').run(uid)
  res.json({ success: true })
})

module.exports = router
