const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7)
  const board = await db.all(`
    SELECT u.id, u.username, u.display_name, u.avatar_emoji, u.avatar_bg_color, u.role, u.xp,
           COALESCE(SUM(lp.points),0) as points
    FROM users u
    LEFT JOIN leaderboard_points lp ON u.id=lp.user_id AND lp.month=?
    WHERE u.is_active=1
    GROUP BY u.id, u.username, u.display_name, u.avatar_emoji, u.avatar_bg_color, u.role, u.xp
    ORDER BY points DESC LIMIT 50
  `, [month])

  const enriched = await Promise.all(board.map(async (u, i) => {
    const [obsRow, quizzesRow, postsRow] = await Promise.all([
      db.get('SELECT COUNT(*) as c FROM observations WHERE observer_id=?', [u.id]),
      db.get('SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id=? AND passed=1', [u.id]),
      db.get('SELECT COUNT(*) as c FROM posts WHERE user_id=?', [u.id]),
    ])
    const obs = parseInt(obsRow?.c ?? 0)
    const quizzes = parseInt(quizzesRow?.c ?? 0)
    const posts = parseInt(postsRow?.c ?? 0)
    const badges = []
    if (quizzes >= 5) badges.push('🎓 Quiz Master')
    if (obs >= 10) badges.push('🔬 Field Champion')
    if (posts >= 20) badges.push('⭐ Top Contributor')
    if (u.xp >= 500) badges.push('💎 Expert')
    return { ...u, rank: i + 1, observations: obs, quizzes_passed: quizzes, posts, badges }
  }))
  res.json({ month, leaderboard: enriched })
})

router.get('/games', requireAuth, async (req, res) => {
  const { game } = req.query
  let query = `SELECT gs.*, u.username, u.display_name, u.avatar_emoji FROM game_scores gs JOIN users u ON gs.user_id=u.id`
  const params = []
  if (game) { query += ' WHERE gs.game_name=?'; params.push(game) }
  query += ' ORDER BY gs.score DESC LIMIT 10'
  res.json(await db.all(query, params))
})

router.post('/games', requireAuth, async (req, res) => {
  const { game_name, score, level } = req.body
  const existing = await db.get('SELECT score FROM game_scores WHERE user_id=? AND game_name=? ORDER BY score DESC LIMIT 1', [req.user.id, game_name])
  const isHighScore = !existing || score > existing.score
  await db.run('INSERT INTO game_scores (user_id,game_name,score,level) VALUES (?,?,?,?)', [req.user.id, game_name, score, level || 1])
  const pts = isHighScore ? 10 : 3
  await db.run('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)',
    [req.user.id, pts, `game_${game_name}`, new Date().toISOString().slice(0, 7)])
  res.json({ success: true, is_high_score: isHighScore, points_awarded: pts })
})

module.exports = router
