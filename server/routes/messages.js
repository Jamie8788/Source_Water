const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')
const upload = require('../middleware/upload')

// GET /api/messages/conversations
router.get('/conversations', requireAuth, (req, res) => {
  const uid = req.user.id
  const convos = db.prepare(`
    SELECT DISTINCT
      CASE WHEN dm.sender_id = ? THEN dm.receiver_id ELSE dm.sender_id END as other_id,
      MAX(dm.created_at) as last_time,
      (SELECT content FROM direct_messages WHERE (sender_id=? AND receiver_id=other_id) OR (sender_id=other_id AND receiver_id=?) ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT message_type FROM direct_messages WHERE (sender_id=? AND receiver_id=other_id) OR (sender_id=other_id AND receiver_id=?) ORDER BY created_at DESC LIMIT 1) as last_type,
      (SELECT COUNT(*) FROM direct_messages WHERE receiver_id=? AND sender_id=other_id AND read=0) as unread_count
    FROM direct_messages dm
    WHERE dm.sender_id=? OR dm.receiver_id=?
    GROUP BY other_id ORDER BY last_time DESC
  `).all(uid,uid,uid,uid,uid,uid,uid,uid)

  const enriched = convos.map(c => {
    const user = db.prepare('SELECT id,username,display_name,avatar_emoji,avatar_bg_color,role,last_login FROM users WHERE id=?').get(c.other_id)
    return { ...c, user }
  })
  res.json(enriched)
})

// GET /api/messages/:userId
router.get('/:userId', requireAuth, (req, res) => {
  const { limit = 50, before } = req.query
  const uid = req.user.id
  const otherId = parseInt(req.params.userId)
  let query = `SELECT dm.*, u.username, u.display_name, u.avatar_emoji FROM direct_messages dm JOIN users u ON dm.sender_id=u.id WHERE (dm.sender_id=? AND dm.receiver_id=?) OR (dm.sender_id=? AND dm.receiver_id=?)`
  const params = [uid, otherId, otherId, uid]
  if (before) { query += ' AND dm.created_at < ?'; params.push(before) }
  query += ' ORDER BY dm.created_at DESC LIMIT ?'
  params.push(parseInt(limit))
  const msgs = db.prepare(query).all(...params).reverse()
  // Mark as read
  db.prepare('UPDATE direct_messages SET read=1 WHERE receiver_id=? AND sender_id=? AND read=0').run(uid, otherId)
  res.json(msgs)
})

// POST /api/messages/:userId
router.post('/:userId', requireAuth, upload.fields([{name:'media',maxCount:5},{name:'voice_note',maxCount:1}]), (req, res) => {
  const { content, message_type = 'text' } = req.body
  const receiverId = parseInt(req.params.userId)
  const mediaFile = req.files?.media?.[0]
  const voiceFile = req.files?.voice_note?.[0]
  const mediaPath = mediaFile ? `/uploads/images/${mediaFile.filename}` : null
  const voicePath = voiceFile ? `/uploads/audio/${voiceFile.filename}` : null
  const finalType = voiceFile ? 'voice_note' : mediaFile ? 'image' : message_type

  const result = db.prepare('INSERT INTO direct_messages (sender_id,receiver_id,content,media,voice_note,message_type) VALUES (?,?,?,?,?,?)').run(req.user.id, receiverId, content || null, mediaPath, voicePath, finalType)
  const msg = db.prepare('SELECT dm.*, u.username, u.display_name, u.avatar_emoji FROM direct_messages dm JOIN users u ON dm.sender_id=u.id WHERE dm.id=?').get(result.lastInsertRowid)

  // Notification
  db.prepare('INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)').run(
    receiverId, 'dm', 'New Message', `${req.user.display_name || req.user.username} sent you a message`, `/messages/${req.user.id}`
  )
  res.json(msg)
})

// GET /api/messages/unread/count
router.get('/unread/count', requireAuth, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM direct_messages WHERE receiver_id=? AND read=0').get(req.user.id).c
  res.json({ count })
})

module.exports = router
