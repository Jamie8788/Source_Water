const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0,7)
  const board = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_emoji, u.avatar_bg_color, u.role, u.xp,
           COALESCE(SUM(lp.points),0) as points
    FROM users u
    LEFT JOIN leaderboard_points lp ON u.id=lp.user_id AND lp.month=?
    WHERE u.is_active=1
    GROUP BY u.id ORDER BY points DESC LIMIT 50
  `).all(month)

  const enriched = board.map((u,i) => {
    const obs = db.prepare('SELECT COUNT(*) as c FROM observations WHERE observer_id=?').get(u.id).c
    const quizzes = db.prepare('SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=? AND passed=1').get(u.id).c
    const posts = db.prepare('SELECT COUNT(*) as c FROM posts WHERE user_id=?').get(u.id).c

    const badges = []
    if (quizzes >= 5) badges.push('🎓 Quiz Master')
    if (obs >= 10) badges.push('🔬 Field Champion')
    if (posts >= 20) badges.push('⭐ Top Contributor')
    if (u.xp >= 500) badges.push('💎 Expert')

    return { ...u, rank: i+1, observations: obs, quizzes_passed: quizzes, posts, badges }
  })
  res.json({ month, leaderboard: enriched })
})

router.get('/games', requireAuth, (req, res) => {
  const { game } = req.query
  let query = `SELECT gs.*, u.username, u.display_name, u.avatar_emoji FROM game_scores gs JOIN users u ON gs.user_id=u.id`
  const params = []
  if (game) { query += ' WHERE gs.game_name=?'; params.push(game) }
  query += ' ORDER BY gs.score DESC LIMIT 10'
  res.json(db.prepare(query).all(...params))
})

router.post('/games', requireAuth, (req, res) => {
  const { game_name, score, level } = req.body
  // Check if new high score
  const existing = db.prepare('SELECT score FROM game_scores WHERE user_id=? AND game_name=? ORDER BY score DESC LIMIT 1').get(req.user.id, game_name)
  const isHighScore = !existing || score > existing.score

  db.prepare('INSERT INTO game_scores (user_id,game_name,score,level) VALUES (?,?,?,?)').run(req.user.id,game_name,score,level||1)

  // Award leaderboard points
  const pts = isHighScore ? 10 : 3
  db.prepare('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)').run(req.user.id,pts,`game_${game_name}`,new Date().toISOString().slice(0,7))

  res.json({ success: true, is_high_score: isHighScore, points_awarded: pts })
})

module.exports = router
