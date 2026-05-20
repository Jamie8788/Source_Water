const router = require('express').Router()
const bcrypt = require('bcryptjs')
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const upload = require('../middleware/upload')

const safe = (u) => { const { password_hash, ...s } = u; return s }

// GET /api/users (admin)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const users = await db.all('SELECT * FROM users ORDER BY created_at DESC', [])
  res.json({ users: users.map(safe) })
})

// GET /api/users/search?q=
router.get('/search', requireAuth, async (req, res) => {
  const q = `%${req.query.q || ''}%`
  const users = await db.all(
    `SELECT id, username, display_name, avatar_emoji, role FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND is_active=1 LIMIT 20`,
    [q, q])
  res.json({ users: users.map(safe) })
})

// GET /api/users/online
router.get('/online', requireAuth, async (req, res) => {
  const users = await db.all(
    `SELECT id,username,display_name,avatar_emoji,avatar_bg_color,role FROM users WHERE last_login > NOW() - INTERVAL '5 minutes'`,
    [])
  res.json(users)
})

// GET /api/users/:id
router.get('/:id', requireAuth, async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id])
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json(safe(user))
})

// PUT /api/users/me (update own profile)
router.put('/me', requireAuth, upload.single('avatar_file'), async (req, res) => {
  try {
    const { display_name, bio, location, organization, phone, title, research_role, institution, research_area, website, sound_enabled, theme, onboarding_completed } = req.body
    const updates = []
    const vals = []
    const fields = { display_name, bio, location, organization, phone, title, research_role, institution, research_area, website }
    Object.entries(fields).forEach(([k, v]) => { if (v !== undefined) { updates.push(`${k}=?`); vals.push(v) } })
    if (sound_enabled !== undefined) { updates.push('sound_enabled=?'); vals.push(sound_enabled === 'true' || sound_enabled === true ? 1 : 0) }
    if (theme !== undefined) { updates.push('theme=?'); vals.push(theme) }
    if (onboarding_completed !== undefined) { updates.push('onboarding_completed=?'); vals.push(1) }
    if (req.file) {
      const avatarPath = `/uploads/${req.file.filename}`
      updates.push('avatar_url=?'); vals.push(avatarPath)
    }
    if (!updates.length) return res.json(safe(await db.get('SELECT * FROM users WHERE id=?', [req.user.id])))
    vals.push(req.user.id)
    await db.run(`UPDATE users SET ${updates.join(',')} WHERE id=?`, vals)
    const updated = await db.get('SELECT * FROM users WHERE id=?', [req.user.id])
    res.json(safe(updated))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/users/me/password
router.put('/me/password', requireAuth, async (req, res) => {
  const { current, newPassword } = req.body
  const user = await db.get('SELECT * FROM users WHERE id=?', [req.user.id])
  const valid = await bcrypt.compare(current, user.password_hash)
  if (!valid) return res.status(400).json({ error: 'Current password incorrect' })
  const hash = await bcrypt.hash(newPassword, 10)
  await db.run('UPDATE users SET password_hash=? WHERE id=?', [hash, req.user.id])
  res.json({ success: true })
})

// GET /api/users/:id/stats
router.get('/:id/stats', requireAuth, async (req, res) => {
  const uid = req.params.id
  const [postsRow, commentsRow, observationsRow, attemptsRow, passedRow, pointsRow, xpRow] = await Promise.all([
    db.get('SELECT COUNT(*) as c FROM posts WHERE user_id=?', [uid]),
    db.get('SELECT COUNT(*) as c FROM comments WHERE user_id=?', [uid]),
    db.get('SELECT COUNT(*) as c FROM observations WHERE observer_id=?', [uid]),
    db.get('SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=?', [uid]),
    db.get('SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=? AND passed=1', [uid]),
    db.get('SELECT COALESCE(SUM(points),0) as p FROM leaderboard_points WHERE user_id=?', [uid]),
    db.get('SELECT xp FROM users WHERE id=?', [uid]),
  ])
  res.json({
    posts: parseInt(postsRow?.c ?? 0),
    comments: parseInt(commentsRow?.c ?? 0),
    observations: parseInt(observationsRow?.c ?? 0),
    quizAttempts: parseInt(attemptsRow?.c ?? 0),
    quizPassed: parseInt(passedRow?.c ?? 0),
    points: parseInt(pointsRow?.p ?? 0),
    xp: xpRow?.xp || 0,
  })
})

// GET /api/users/me/activity-summary
// Dashboard "Your Activity This Month" card. Returns the current user's
// monthly points broken down by action category, their rank for the
// month, day-streak (consecutive days with any points awarded), and
// raw counts for posts / quiz passes / resource views this month.
// Everything comes from real tables — leaderboard_points, posts,
// quiz_attempts. Nothing fabricated.
router.get('/me/activity-summary', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id
    const month = new Date().toISOString().slice(0, 7)
    const monthStart = `${month}-01`
    const [pointsRow, breakdownRows, postsRow, quizRow, resourceRow, streakRows, rankRows] = await Promise.all([
      db.get('SELECT COALESCE(SUM(points),0) AS pts FROM leaderboard_points WHERE user_id=? AND month=?', [uid, month]),
      db.all(`
        SELECT
          CASE
            WHEN action LIKE 'game_%'     THEN 'games'
            WHEN action = 'quiz_pass'     THEN 'quizzes'
            WHEN action LIKE 'resource_%' THEN 'resources'
            WHEN action IN ('post','comment','reaction','first_post','daily_login') THEN 'social'
            ELSE 'other'
          END AS source,
          COALESCE(SUM(points),0) AS pts
        FROM leaderboard_points WHERE user_id=? AND month=?
        GROUP BY source
      `, [uid, month]),
      db.get(`SELECT COUNT(*) AS c FROM posts WHERE user_id=? AND created_at >= ?`, [uid, monthStart]),
      db.get(`SELECT COUNT(*) AS c FROM quiz_attempts WHERE user_id=? AND passed=1 AND completed_at >= ?`, [uid, monthStart]).catch(() => ({ c: 0 })),
      db.get(`SELECT COUNT(*) AS c FROM leaderboard_points WHERE user_id=? AND action LIKE 'resource_view_%' AND month=?`, [uid, month]),
      db.all(`SELECT DISTINCT DATE(created_at) AS d FROM leaderboard_points WHERE user_id=? ORDER BY d DESC LIMIT 60`, [uid]),
      db.all(`
        SELECT user_id, COALESCE(SUM(points),0) AS pts
        FROM leaderboard_points WHERE month=? GROUP BY user_id ORDER BY pts DESC
      `, [month]),
    ])

    // Streak: count back from today, breaking on the first missed day.
    const todayKey = new Date().toISOString().slice(0, 10)
    const days = new Set((streakRows || []).map(r => String(r.d || '').slice(0, 10)))
    let streak = 0
    const cur = new Date(`${todayKey}T00:00:00Z`)
    while (days.has(cur.toISOString().slice(0, 10))) {
      streak++
      cur.setUTCDate(cur.getUTCDate() - 1)
    }
    // If today has no points yet, allow streak from yesterday so the user
    // doesn't see "0" until they happen to do something today.
    if (streak === 0 && days.size > 0) {
      const y = new Date(`${todayKey}T00:00:00Z`)
      y.setUTCDate(y.getUTCDate() - 1)
      const c = new Date(y)
      while (days.has(c.toISOString().slice(0, 10))) {
        streak++
        c.setUTCDate(c.getUTCDate() - 1)
      }
    }

    const rankIdx = (rankRows || []).findIndex(r => Number(r.user_id) === Number(uid))
    const rank = rankIdx >= 0 ? rankIdx + 1 : null
    const breakdown = { games: 0, quizzes: 0, resources: 0, social: 0, other: 0 }
    ;(breakdownRows || []).forEach(r => { breakdown[r.source] = parseInt(r.pts ?? 0) })

    res.json({
      month,
      points_this_month: parseInt(pointsRow?.pts ?? 0),
      points_by_source: breakdown,
      rank_this_month: rank,
      total_ranked_users: (rankRows || []).length,
      streak_days: streak,
      this_month: {
        posts:           parseInt(postsRow?.c ?? 0),
        quizzes_passed:  parseInt(quizRow?.c ?? 0),
        resources_viewed: parseInt(resourceRow?.c ?? 0),
      },
    })
  } catch (err) {
    console.error('[users/me/activity-summary]', err.message)
    res.status(500).json({ error: 'activity summary unavailable' })
  }
})

// Admin: update user role/status
router.put('/:id/admin', requireAuth, requireAdmin, async (req, res) => {
  const { role, is_active, is_admin } = req.body
  const updates = []; const vals = []
  if (role !== undefined) { updates.push('role=?'); vals.push(role) }
  if (is_active !== undefined) { updates.push('is_active=?'); vals.push(is_active ? 1 : 0) }
  if (is_admin !== undefined) { updates.push('is_admin=?'); vals.push(is_admin ? 1 : 0) }
  if (!updates.length) return res.json({ success: true })
  vals.push(req.params.id)
  await db.run(`UPDATE users SET ${updates.join(',')} WHERE id=?`, vals)
  await db.run('INSERT INTO activity_log (user_id,action,target_type,target_id,details) VALUES (?,?,?,?,?)',
    [req.user.id, 'admin_update_user', 'user', req.params.id, JSON.stringify({ role, is_active, is_admin })])
  res.json({ success: true })
})

// Admin: generic PUT /:id
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { role, is_active, is_admin } = req.body
  const updates = []; const vals = []
  if (role !== undefined) { updates.push('role=?'); vals.push(role) }
  if (is_active !== undefined) { updates.push('is_active=?'); vals.push(is_active ? 1 : 0) }
  if (is_admin !== undefined) { updates.push('is_admin=?'); vals.push(is_admin ? 1 : 0) }
  if (!updates.length) return res.json({ success: true })
  vals.push(req.params.id)
  await db.run(`UPDATE users SET ${updates.join(',')} WHERE id=?`, vals)
  res.json({ success: true })
})

// Admin: DELETE /:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const uid = parseInt(req.params.id)
  if (uid === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' })
  const target = await db.get('SELECT email FROM users WHERE id=?', [uid])
  if (!target) return res.status(404).json({ error: 'User not found' })

  // Ban email so Supabase-auth users can't auto-recreate
  if (target.email) {
    await db.run(
      `INSERT INTO banned_emails (email, reason) VALUES (?, 'deleted by admin') ON CONFLICT DO NOTHING`,
      [target.email]
    ).catch(() => {})
  }

  // Delete quiz questions before quizzes (FK chain)
  const userQuizIds = (await db.all('SELECT id FROM quizzes WHERE created_by=?', [uid])).map(q => q.id)
  if (userQuizIds.length) {
    const ph = userQuizIds.map(() => '?').join(',')
    await db.run(`DELETE FROM quiz_questions WHERE quiz_id IN (${ph})`, userQuizIds).catch(() => {})
    await db.run(`DELETE FROM quiz_attempts WHERE quiz_id IN (${ph})`, userQuizIds).catch(() => {})
  }

  // Delete observations for user's sites before deleting sites
  const userSiteIds = (await db.all('SELECT id FROM sites WHERE created_by=?', [uid])).map(s => s.id)
  if (userSiteIds.length) {
    const ph = userSiteIds.map(() => '?').join(',')
    await db.run(`DELETE FROM observations WHERE site_id IN (${ph})`, userSiteIds).catch(() => {})
  }

  // Delete reactions/comments/bookmarks on the user's own posts before deleting posts
  const userPostIds = (await db.all('SELECT id FROM posts WHERE user_id=?', [uid])).map(p => p.id)
  if (userPostIds.length) {
    const ph = userPostIds.map(() => '?').join(',')
    await db.run(`DELETE FROM post_reactions WHERE post_id IN (${ph})`, userPostIds).catch(() => {})
    await db.run(`DELETE FROM post_bookmarks WHERE post_id IN (${ph})`, userPostIds).catch(() => {})
    await db.run(`DELETE FROM comments WHERE post_id IN (${ph})`, userPostIds).catch(() => {})
  }

  // Delete everything owned by the user
  const deletes = [
    'DELETE FROM observations WHERE observer_id=?',
    'DELETE FROM quizzes WHERE created_by=?',
    'DELETE FROM sites WHERE created_by=?',
    'DELETE FROM resources WHERE created_by=?',
    'DELETE FROM alerts WHERE created_by=?',
    'DELETE FROM project_datasets WHERE uploaded_by=?',
    'DELETE FROM research_projects WHERE created_by=?',
    'DELETE FROM post_reactions WHERE user_id=?',
    'DELETE FROM post_bookmarks WHERE user_id=?',
    'DELETE FROM comments WHERE user_id=?',
    'DELETE FROM posts WHERE user_id=?',
    'DELETE FROM leaderboard_points WHERE user_id=?',
    'DELETE FROM activity_log WHERE user_id=?',
    'DELETE FROM notifications WHERE user_id=?',
    'DELETE FROM quiz_attempts WHERE user_id=?',
    'DELETE FROM game_scores WHERE user_id=?',
    'DELETE FROM resource_bookmarks WHERE user_id=?',
    'DELETE FROM direct_messages WHERE sender_id=? OR receiver_id=?',
    'DELETE FROM follows WHERE follower_id=? OR following_id=?',
  ]
  for (const sql of deletes) {
    const params = sql.includes('OR') ? [uid, uid] : [uid]
    await db.run(sql, params).catch(() => {})
  }

  await db.run('DELETE FROM users WHERE id=?', [uid])
  res.json({ success: true })
})

module.exports = router
