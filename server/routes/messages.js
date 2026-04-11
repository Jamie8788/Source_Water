const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')
const upload = require('../middleware/upload')

// GET /api/messages/conversations
router.get('/conversations', requireAuth, async (req, res) => {
  const uid = req.user.id
  const partners = await db.all(`
    SELECT CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END as other_id,
           MAX(created_at) as last_time
    FROM direct_messages
    WHERE (sender_id=$1 OR receiver_id=$1) AND deleted=0
    GROUP BY other_id ORDER BY last_time DESC
  `, [uid])

  const enriched = await Promise.all(partners.map(async p => {
    const other = p.other_id
    const [lastMsg, unreadRow, user] = await Promise.all([
      db.get(`SELECT content, message_type, media FROM direct_messages
        WHERE ((sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)) AND deleted=0
        ORDER BY created_at DESC LIMIT 1`, [uid, other, other, uid]),
      db.get(`SELECT COUNT(*) as c FROM direct_messages WHERE sender_id=? AND receiver_id=? AND read=0 AND deleted=0`, [other, uid]),
      db.get('SELECT id,username,display_name,avatar_emoji,avatar_bg_color,role FROM users WHERE id=?', [other]),
    ])
    const preview = lastMsg?.content || (lastMsg?.media ? '📷 Image' : lastMsg?.message_type === 'voice_note' ? '🎤 Voice' : '')
    return { other_id: other, last_message: preview, last_type: lastMsg?.message_type, unread_count: parseInt(unreadRow?.c ?? 0), user }
  }))
  res.json(enriched)
})

// GET /api/messages/:userId
router.get('/:userId', requireAuth, async (req, res) => {
  if (req.params.userId === 'unread') return
  const { limit = 50, before } = req.query
  const uid = req.user.id
  const otherId = parseInt(req.params.userId)
  let query = `SELECT dm.*, u.username, u.display_name, u.avatar_emoji FROM direct_messages dm JOIN users u ON dm.sender_id=u.id WHERE ((dm.sender_id=? AND dm.receiver_id=?) OR (dm.sender_id=? AND dm.receiver_id=?)) AND dm.deleted=0`
  const params = [uid, otherId, otherId, uid]
  if (before) { query += ' AND dm.created_at < ?'; params.push(before) }
  query += ' ORDER BY dm.created_at DESC LIMIT ?'
  params.push(parseInt(limit))
  const msgs = (await db.all(query, params)).reverse()
  await db.run('UPDATE direct_messages SET read=1 WHERE receiver_id=? AND sender_id=? AND read=0', [uid, otherId])
  res.json(msgs)
})

// POST /api/messages/:userId
router.post('/:userId', requireAuth, upload.fields([{name:'media',maxCount:5},{name:'voice_note',maxCount:1}]), async (req, res) => {
  const { content, message_type = 'text', media_url, voice_url } = req.body
  const receiverId = parseInt(req.params.userId)
  const mediaFile = req.files?.media?.[0]
  const voiceFile = req.files?.voice_note?.[0]

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

  const { lastInsertRowid } = await db.run(
    'INSERT INTO direct_messages (sender_id,receiver_id,content,media,voice_note,message_type,deleted) VALUES (?,?,?,?,?,?,0)',
    [req.user.id, receiverId, content || null, mediaPath, voicePath, finalType])

  const msg = await db.get(
    'SELECT dm.*, u.username, u.display_name, u.avatar_emoji FROM direct_messages dm JOIN users u ON dm.sender_id=u.id WHERE dm.id=?',
    [lastInsertRowid])

  await db.run('INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)',
    [receiverId, 'dm', 'New Message', `${req.user.display_name || req.user.username} sent you a message`, `/messages/${req.user.id}`])
  res.json(msg)
})

// DELETE /api/messages/:messageId
router.delete('/:messageId', requireAuth, async (req, res) => {
  const msg = await db.get('SELECT * FROM direct_messages WHERE id=?', [req.params.messageId])
  if (!msg) return res.status(404).json({ error: 'Not found' })
  if (msg.sender_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
  await db.run('UPDATE direct_messages SET deleted=1, content=NULL, media=NULL, voice_note=NULL WHERE id=?', [req.params.messageId])
  res.json({ success: true })
})

// PUT /api/messages/:messageId
router.put('/:messageId', requireAuth, async (req, res) => {
  const { content } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' })
  const msg = await db.get('SELECT * FROM direct_messages WHERE id=?', [req.params.messageId])
  if (!msg) return res.status(404).json({ error: 'Not found' })
  if (msg.sender_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
  await db.run('UPDATE direct_messages SET content=?, edited=1 WHERE id=?', [content.trim(), req.params.messageId])
  res.json({ ...msg, content: content.trim(), edited: 1 })
})

// GET /api/messages/unread/count
router.get('/unread/count', requireAuth, async (req, res) => {
  const row = await db.get('SELECT COUNT(*) as c FROM direct_messages WHERE receiver_id=? AND read=0 AND deleted=0', [req.user.id])
  res.json({ count: parseInt(row?.c ?? 0) })
})

module.exports = router
