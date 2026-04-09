const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')
const upload = require('../middleware/upload')

const enrichPost = (post) => {
  if (!post) return null
  const user = db.prepare('SELECT id,username,display_name,avatar_emoji,avatar_bg_color,avatar_url,role FROM users WHERE id=?').get(post.user_id)
  const reactions = db.prepare('SELECT reaction_type, COUNT(*) as count FROM post_reactions WHERE post_id=? GROUP BY reaction_type').all(post.id)
  const commentCount = db.prepare('SELECT COUNT(*) as c FROM comments WHERE post_id=?').get(post.id).c
  const reactionMap = {}
  reactions.forEach(r => reactionMap[r.reaction_type] = r.count)
  return {
    ...post,
    media: post.media ? JSON.parse(post.media) : [],
    hashtags: post.hashtags ? JSON.parse(post.hashtags) : [],
    poll_options: post.poll_options ? JSON.parse(post.poll_options) : null,
    user,
    reactions: reactionMap,
    comment_count: commentCount,
  }
}

// GET /api/posts
router.get('/', requireAuth, (req, res) => {
  const { limit = 20, offset = 0, user_id } = req.query
  let query = 'SELECT * FROM posts'
  const params = []
  if (user_id) { query += ' WHERE user_id=?'; params.push(user_id) }
  query += ' ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  const posts = db.prepare(query).all(...params).map(enrichPost)
  const total = user_id
    ? db.prepare('SELECT COUNT(*) as c FROM posts WHERE user_id=?').get(user_id)
    : db.prepare('SELECT COUNT(*) as c FROM posts').get()
  res.json({ posts, total: total.c })
})

// POST /api/posts
router.post('/', requireAuth, upload.array('media', 10), (req, res) => {
  try {
    const { content, post_type = 'text', hashtags, location_tag, poll_options, poll_question } = req.body
    
    // Debug logging for upload issues
    console.log('Post upload - files:', req.files?.length || 0)
    console.log('Post upload - content:', content?.substring(0, 100))
    console.log('Post upload - post_type:', post_type)
    
    if (!content && !req.files?.length) {
      return res.status(400).json({ error: 'Content or media required' })
    }

    // Process uploaded files with better path handling
    const mediaFiles = []
    if (req.files && req.files.length > 0) {
      req.files.forEach(f => {
        // Handle different path formats (Windows/Unix)
        let relPath = f.path.replace(/\\/g, '/')
        
        // Extract the relative path from uploads directory
        const uploadsIndex = relPath.indexOf('/uploads/')
        if (uploadsIndex !== -1) {
          relPath = relPath.substring(uploadsIndex + 1) // Remove leading slash
        } else {
          // Fallback: just use filename if we can't find uploads in path
          const filename = f.filename || f.originalname
          relPath = `uploads/images/${filename}`
        }
        
        // Ensure path starts with /uploads/ for consistency
        if (!relPath.startsWith('uploads/')) {
          relPath = `uploads/${relPath}`
        }
        
        mediaFiles.push('/' + relPath)
        
        console.log('File saved:', f.path, '->', '/' + relPath)
      })
    }
    
    const tags = hashtags ? (Array.isArray(hashtags) ? hashtags : [hashtags]) : []

    const result = db.prepare(`
      INSERT INTO posts (user_id,content,post_type,media,hashtags,location_tag,poll_options,poll_question)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(req.user.id, content, post_type, JSON.stringify(mediaFiles), JSON.stringify(tags),
      location_tag || null, poll_options ? JSON.stringify(poll_options) : null, poll_question || null)

    // Award points
    db.prepare('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)').run(req.user.id,5,'post',new Date().toISOString().slice(0,7))
    
    // Notification to followers (simplified)
    const post = db.prepare('SELECT * FROM posts WHERE id=?').get(result.lastInsertRowid)
    
    // Log success
    console.log('Post created successfully:', result.lastInsertRowid, 'media count:', mediaFiles.length)
    
    res.json(enrichPost(post))
  } catch (err) {
    console.error('Post creation error:', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/posts/:id
router.delete('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id)
  if (!post) return res.status(404).json({ error: 'Not found' })
  if (post.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden' })
  db.prepare('DELETE FROM posts WHERE id=?').run(req.params.id)
  res.json({ success: true })
})

// PUT /api/posts/:id/pin (admin)
router.put('/:id/pin', requireAuth, (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' })
  const post = db.prepare('SELECT pinned FROM posts WHERE id=?').get(req.params.id)
  db.prepare('UPDATE posts SET pinned=? WHERE id=?').run(post.pinned ? 0 : 1, req.params.id)
  res.json({ success: true })
})

// POST /api/posts/:id/react
router.post('/:id/react', requireAuth, (req, res) => {
  const { reaction_type } = req.body
  const valid = ['drop','bubble','wave','curious','great_work']
  if (!valid.includes(reaction_type)) return res.status(400).json({ error: 'Invalid reaction' })
  try {
    db.prepare('INSERT OR IGNORE INTO post_reactions (post_id,user_id,reaction_type) VALUES (?,?,?)').run(req.params.id, req.user.id, reaction_type)
    db.prepare('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)').run(req.user.id,1,'reaction',new Date().toISOString().slice(0,7))
    const reactions = db.prepare('SELECT reaction_type, COUNT(*) as count FROM post_reactions WHERE post_id=? GROUP BY reaction_type').all(req.params.id)
    const reactionMap = {}
    reactions.forEach(r => reactionMap[r.reaction_type] = r.count)
    res.json(reactionMap)
  } catch { res.json({}) }
})

// DELETE /api/posts/:id/react
router.delete('/:id/react', requireAuth, (req, res) => {
  const { reaction_type } = req.body
  db.prepare('DELETE FROM post_reactions WHERE post_id=? AND user_id=? AND reaction_type=?').run(req.params.id, req.user.id, reaction_type)
  const reactions = db.prepare('SELECT reaction_type, COUNT(*) as count FROM post_reactions WHERE post_id=? GROUP BY reaction_type').all(req.params.id)
  const reactionMap = {}
  reactions.forEach(r => reactionMap[r.reaction_type] = r.count)
  res.json(reactionMap)
})

// GET /api/posts/:id/comments
router.get('/:id/comments', requireAuth, (req, res) => {
  const comments = db.prepare(`
    SELECT c.*, u.username, u.display_name, u.avatar_emoji, u.avatar_bg_color
    FROM comments c JOIN users u ON c.user_id=u.id
    WHERE c.post_id=? ORDER BY c.created_at ASC
  `).all(req.params.id)
  res.json(comments)
})

// POST /api/posts/:id/comments
router.post('/:id/comments', requireAuth, (req, res) => {
  const { content, parent_comment_id } = req.body
  if (!content) return res.status(400).json({ error: 'Content required' })
  const result = db.prepare('INSERT INTO comments (post_id,user_id,parent_comment_id,content) VALUES (?,?,?,?)').run(req.params.id, req.user.id, parent_comment_id || null, content)
  db.prepare('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)').run(req.user.id,2,'comment',new Date().toISOString().slice(0,7))
  const comment = db.prepare(`SELECT c.*, u.username, u.display_name, u.avatar_emoji, u.avatar_bg_color FROM comments c JOIN users u ON c.user_id=u.id WHERE c.id=?`).get(result.lastInsertRowid)
  res.json(comment)
})

// DELETE /api/posts/:id/comments/:cid
router.delete('/:id/comments/:cid', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.cid)
  if (!c) return res.status(404).json({ error: 'Not found' })
  if (c.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden' })
  db.prepare('DELETE FROM comments WHERE id=?').run(req.params.cid)
  res.json({ success: true })
})

// Vote on poll
router.post('/:id/poll/vote', requireAuth, (req, res) => {
  const { option_index } = req.body
  const post = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id)
  if (!post?.poll_options) return res.status(400).json({ error: 'Not a poll' })
  let poll = JSON.parse(post.poll_options)
  if (!poll.votes) poll.votes = {}
  // One vote per user
  const prevVote = Object.entries(poll.votes).find(([,voters]) => (voters||[]).includes(req.user.id))
  if (prevVote) {
    poll.votes[prevVote[0]] = (poll.votes[prevVote[0]] || []).filter(id => id !== req.user.id)
  }
  if (!poll.votes[option_index]) poll.votes[option_index] = []
  poll.votes[option_index].push(req.user.id)
  db.prepare('UPDATE posts SET poll_options=? WHERE id=?').run(JSON.stringify(poll), req.params.id)
  res.json(poll)
})

module.exports = router
