const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')
const upload = require('../middleware/upload')

async function enrichPost(post) {
  if (!post) return null
  const user = await db.get('SELECT id,username,display_name,avatar_emoji,avatar_bg_color,avatar_url,role FROM users WHERE id=? AND is_active=1', [post.user_id])
  const reactions = await db.all('SELECT reaction_type, COUNT(*) as count FROM post_reactions WHERE post_id=? GROUP BY reaction_type', [post.id])
  const commentRow = await db.get('SELECT COUNT(*) as c FROM comments WHERE post_id=?', [post.id])
  const reactionMap = {}
  reactions.forEach(r => { reactionMap[r.reaction_type] = parseInt(r.count) })
  return {
    ...post,
    media: post.media ? JSON.parse(post.media) : [],
    hashtags: post.hashtags ? JSON.parse(post.hashtags) : [],
    poll_options: post.poll_options ? JSON.parse(post.poll_options) : null,
    user,
    reactions: reactionMap,
    comment_count: parseInt(commentRow?.c ?? 0),
  }
}

// GET /api/posts
router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit = 20, offset = 0, user_id } = req.query
    // Only show posts from active users who completed onboarding
    let query = 'SELECT p.* FROM posts p JOIN users u ON p.user_id=u.id WHERE u.is_active=1 AND u.onboarding_completed=1'
    const params = []
    if (user_id) { query += ' AND p.user_id=?'; params.push(user_id) }
    query += ' ORDER BY p.pinned DESC, p.created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))
    const rows = await db.all(query, params)
    const posts = (await Promise.all(rows.map(enrichPost))).filter(Boolean)
    const totalRow = user_id
      ? await db.get('SELECT COUNT(*) as c FROM posts p JOIN users u ON p.user_id=u.id WHERE u.is_active=1 AND u.onboarding_completed=1 AND p.user_id=?', [user_id])
      : await db.get('SELECT COUNT(*) as c FROM posts p JOIN users u ON p.user_id=u.id WHERE u.is_active=1 AND u.onboarding_completed=1', [])
    res.json({ posts, total: parseInt(totalRow?.c ?? 0) })
  } catch (err) {
    console.error('GET /posts error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/posts
router.post('/', requireAuth, upload.array('media', 10), async (req, res) => {
  try {
    const { content, post_type = 'text', hashtags, location_tag, poll_options, poll_question, media: mediaJson } = req.body

    if (!content && !req.files?.length && !mediaJson) {
      return res.status(400).json({ error: 'Content or media required' })
    }

    let mediaFiles = []
    if (mediaJson) {
      try { mediaFiles = JSON.parse(mediaJson) } catch (_) {}
    } else if (req.files?.length > 0) {
      req.files.forEach(f => {
        let relPath = f.path.replace(/\\/g, '/')
        const uploadsIndex = relPath.indexOf('/uploads/')
        if (uploadsIndex !== -1) relPath = relPath.substring(uploadsIndex + 1)
        else relPath = `uploads/images/${f.filename || f.originalname}`
        if (!relPath.startsWith('uploads/')) relPath = `uploads/${relPath}`
        mediaFiles.push('/' + relPath)
      })
    }

    const tags = hashtags ? (Array.isArray(hashtags) ? hashtags : [hashtags]) : []

    const { lastInsertRowid } = await db.run(`
      INSERT INTO posts (user_id,content,post_type,media,hashtags,location_tag,poll_options,poll_question)
      VALUES (?,?,?,?,?,?,?,?)
    `, [req.user.id, content, post_type, JSON.stringify(mediaFiles), JSON.stringify(tags),
      location_tag || null, poll_options ? JSON.stringify(poll_options) : null, poll_question || null])

    await db.run('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)',
      [req.user.id, 5, 'post', new Date().toISOString().slice(0, 7)])
    await db.run('UPDATE users SET xp=xp+5 WHERE id=?', [req.user.id])

    const post = await db.get('SELECT * FROM posts WHERE id=?', [lastInsertRowid])
    res.json(await enrichPost(post))
  } catch (err) {
    console.error('Post creation error:', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/posts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const post = await db.get('SELECT * FROM posts WHERE id=?', [req.params.id])
  if (!post) return res.status(404).json({ error: 'Not found' })
  if (post.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden' })
  await db.run('DELETE FROM posts WHERE id=?', [req.params.id])
  res.json({ success: true })
})

// PUT /api/posts/:id/pin (admin)
router.put('/:id/pin', requireAuth, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' })
  const post = await db.get('SELECT pinned FROM posts WHERE id=?', [req.params.id])
  await db.run('UPDATE posts SET pinned=? WHERE id=?', [post.pinned ? 0 : 1, req.params.id])
  res.json({ success: true })
})

// POST /api/posts/:id/react
router.post('/:id/react', requireAuth, async (req, res) => {
  const { reaction_type } = req.body
  const valid = ['drop', 'bubble', 'wave', 'curious', 'great_work', 'fire', 'love', 'clap']
  if (!valid.includes(reaction_type)) return res.status(400).json({ error: 'Invalid reaction' })
  try {
    await db.run('INSERT OR IGNORE INTO post_reactions (post_id,user_id,reaction_type) VALUES (?,?,?)',
      [req.params.id, req.user.id, reaction_type])
    await db.run('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)',
      [req.user.id, 1, 'reaction', new Date().toISOString().slice(0, 7)])
    await db.run('UPDATE users SET xp=xp+1 WHERE id=?', [req.user.id])
    const reactions = await db.all('SELECT reaction_type, COUNT(*) as count FROM post_reactions WHERE post_id=? GROUP BY reaction_type', [req.params.id])
    const reactionMap = {}
    reactions.forEach(r => { reactionMap[r.reaction_type] = parseInt(r.count) })
    res.json(reactionMap)
  } catch { res.json({}) }
})

// DELETE /api/posts/:id/react
router.delete('/:id/react', requireAuth, async (req, res) => {
  const { reaction_type } = req.body
  await db.run('DELETE FROM post_reactions WHERE post_id=? AND user_id=? AND reaction_type=?',
    [req.params.id, req.user.id, reaction_type])
  const reactions = await db.all('SELECT reaction_type, COUNT(*) as count FROM post_reactions WHERE post_id=? GROUP BY reaction_type', [req.params.id])
  const reactionMap = {}
  reactions.forEach(r => { reactionMap[r.reaction_type] = parseInt(r.count) })
  res.json(reactionMap)
})

// GET /api/posts/:id/comments
router.get('/:id/comments', requireAuth, async (req, res) => {
  const comments = await db.all(`
    SELECT c.*, u.username, u.display_name, u.avatar_emoji, u.avatar_bg_color
    FROM comments c JOIN users u ON c.user_id=u.id
    WHERE c.post_id=? ORDER BY c.created_at ASC
  `, [req.params.id])
  res.json(comments)
})

// POST /api/posts/:id/comments
router.post('/:id/comments', requireAuth, async (req, res) => {
  const { content, parent_comment_id } = req.body
  if (!content) return res.status(400).json({ error: 'Content required' })
  const { lastInsertRowid } = await db.run(
    'INSERT INTO comments (post_id,user_id,parent_comment_id,content) VALUES (?,?,?,?)',
    [req.params.id, req.user.id, parent_comment_id || null, content])
  await db.run('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)',
    [req.user.id, 2, 'comment', new Date().toISOString().slice(0, 7)])
  await db.run('UPDATE users SET xp=xp+2 WHERE id=?', [req.user.id])
  const comment = await db.get(
    `SELECT c.*, u.username, u.display_name, u.avatar_emoji, u.avatar_bg_color FROM comments c JOIN users u ON c.user_id=u.id WHERE c.id=?`,
    [lastInsertRowid])
  res.json(comment)
})

// DELETE /api/posts/:id/comments/:cid
router.delete('/:id/comments/:cid', requireAuth, async (req, res) => {
  const c = await db.get('SELECT * FROM comments WHERE id=?', [req.params.cid])
  if (!c) return res.status(404).json({ error: 'Not found' })
  if (c.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden' })
  await db.run('DELETE FROM comments WHERE id=?', [req.params.cid])
  res.json({ success: true })
})

// POST /api/posts/:id/poll/vote
router.post('/:id/poll/vote', requireAuth, async (req, res) => {
  const { option_index } = req.body
  const post = await db.get('SELECT * FROM posts WHERE id=?', [req.params.id])
  if (!post?.poll_options) return res.status(400).json({ error: 'Not a poll' })
  let poll = JSON.parse(post.poll_options)
  if (!poll.votes) poll.votes = {}
  const prevVote = Object.entries(poll.votes).find(([, voters]) => (voters || []).includes(req.user.id))
  if (prevVote) {
    poll.votes[prevVote[0]] = (poll.votes[prevVote[0]] || []).filter(id => id !== req.user.id)
  }
  if (!poll.votes[option_index]) poll.votes[option_index] = []
  poll.votes[option_index].push(req.user.id)
  await db.run('UPDATE posts SET poll_options=? WHERE id=?', [JSON.stringify(poll), req.params.id])
  res.json(poll)
})

module.exports = router
