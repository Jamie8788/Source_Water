const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')
const upload = require('../middleware/upload')

// GET /api/messages/conversations
router.get('/conversations', requireAuth, (req, res) => {
  const uid = req.user.id
  const partners = db.prepare(`
    SELECT CASE WHEN sender_id=? THEN receiver_id ELSE sender_id END as other_id,
           MAX(created_at) as last_time
    FROM direct_messages
    WHERE (sender_id=? OR receiver_id=?) AND deleted=0
    GROUP BY other_id ORDER BY last_time DESC
  `).all(uid, uid, uid)

  const enriched = partners.map(p => {
    const other = p.other_id
    const lastMsg = db.prepare(`
      SELECT content, message_type, media FROM direct_messages
      WHERE ((sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)) AND deleted=0
      ORDER BY created_at DESC LIMIT 1
    `).get(uid, other, other, uid)
    const unread = db.prepare(`
      SELECT COUNT(*) as c FROM direct_messages
      WHERE sender_id=? AND receiver_id=? AND read=0 AND deleted=0
    `).get(other, uid).c
    const user = db.prepare('SELECT id,username,display_name,avatar_emoji,avatar_bg_color,role FROM users WHERE id=?').get(other)
    const preview = lastMsg?.content || (lastMsg?.media ? '📷 Image' : lastMsg?.message_type === 'voice_note' ? '🎤 Voice' : '')
    return { other_id: other, last_message: preview, last_type: lastMsg?.message_type, unread_count: unread, user }
  })
  res.json(enriched)
})

// GET /api/messages/:userId
router.get('/:userId', requireAuth, (req, res) => {
  if (req.params.userId === 'unread') return // handled below
  const { limit = 50, before } = req.query
  const uid = req.user.id
  const otherId = parseInt(req.params.userId)
  let query = `SELECT dm.*, u.username, u.display_name, u.avatar_emoji FROM direct_messages dm JOIN users u ON dm.sender_id=u.id WHERE ((dm.sender_id=? AND dm.receiver_id=?) OR (dm.sender_id=? AND dm.receiver_id=?)) AND dm.deleted=0`
  const params = [uid, otherId, otherId, uid]
  if (before) { query += ' AND dm.created_at < ?'; params.push(before) }
  query += ' ORDER BY dm.created_at DESC LIMIT ?'
  params.push(parseInt(limit))
  const msgs = db.prepare(query).all(...params).reverse()
  db.prepare('UPDATE direct_messages SET read=1 WHERE receiver_id=? AND sender_id=? AND read=0').run(uid, otherId)
  res.json(msgs)
})

// POST /api/messages/:userId  — accepts media_url (Cloudinary URL) OR file upload
router.post('/:userId', requireAuth, upload.fields([{name:'media',maxCount:5},{name:'voice_note',maxCount:1}]), (req, res) => {
  const { content, message_type = 'text', media_url, voice_url } = req.body
  const receiverId = parseInt(req.params.userId)
  const mediaFile = req.files?.media?.[0]
  const voiceFile = req.files?.voice_note?.[0]

  // Prefer Cloudinary URL over local file
  let mediaPath = media_url || null
  if (!mediaPath && mediaFile) {
    let relPath = mediaFile.path.replace(/\\/g, '/')
    const idx = relPath.indexOf('/uploads/')
    relPath = idx !== -1 ? relPath.substring(idx + 1) : `uploads/images/${mediaFile.filename}`
    if (!relPath.startsWith('uploads/')) relPath = `uploads/${relPath}`
    mediaPath = '/' + relPath
  }

  let voicePath = voice_url || null
  if (!voicePath && voiceFile) {
    let relPath = voiceFile.path.replace(/\\/g, '/')
    const idx = relPath.indexOf('/uploads/')
    relPath = idx !== -1 ? relPath.substring(idx + 1) : `uploads/audio/${voiceFile.filename}`
    if (!relPath.startsWith('uploads/')) relPath = `uploads/${relPath}`
    voicePath = '/' + relPath
  }

  const finalType = voicePath ? 'voice_note' : mediaPath ? 'image' : message_type

  const result = db.prepare(
    'INSERT INTO direct_messages (sender_id,receiver_id,content,media,voice_note,message_type,deleted) VALUES (?,?,?,?,?,?,0)'
  ).run(req.user.id, receiverId, content || null, mediaPath, voicePath, finalType)

  const msg = db.prepare('SELECT dm.*, u.username, u.display_name, u.avatar_emoji FROM direct_messages dm JOIN users u ON dm.sender_id=u.id WHERE dm.id=?').get(result.lastInsertRowid)

  db.prepare('INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)').run(
    receiverId, 'dm', 'New Message', `${req.user.display_name || req.user.username} sent you a message`, `/messages/${req.user.id}`
  )
  res.json(msg)
})

// DELETE /api/messages/:messageId  — soft delete (only sender can delete)
router.delete('/:messageId', requireAuth, (req, res) => {
  const msg = db.prepare('SELECT * FROM direct_messages WHERE id=?').get(req.params.messageId)
  if (!msg) return res.status(404).json({ error: 'Not found' })
  if (msg.sender_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
  db.prepare('UPDATE direct_messages SET deleted=1, content=NULL, media=NULL, voice_note=NULL WHERE id=?').run(req.params.messageId)
  res.json({ success: true })
})

// PUT /api/messages/:messageId  — edit text content (only sender, only text messages)
router.put('/:messageId', requireAuth, (req, res) => {
  const { content } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' })
  const msg = db.prepare('SELECT * FROM direct_messages WHERE id=?').get(req.params.messageId)
  if (!msg) return res.status(404).json({ error: 'Not found' })
  if (msg.sender_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
  db.prepare('UPDATE direct_messages SET content=?, edited=1 WHERE id=?').run(content.trim(), req.params.messageId)
  res.json({ ...msg, content: content.trim(), edited: 1 })
})

// GET /api/messages/unread/count
router.get('/unread/count', requireAuth, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM direct_messages WHERE receiver_id=? AND read=0 AND deleted=0').get(req.user.id).c
  res.json({ count })
})

module.exports = router
