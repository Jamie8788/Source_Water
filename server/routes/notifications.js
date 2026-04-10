const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')

// GET /api/notifications
router.get('/', requireAuth, (req, res) => {
  const notifs = db.prepare(
    'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30'
  ).all(req.user.id)
  res.json({ notifications: notifs, unread: notifs.filter(n => !n.read).length })
})

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(req.user.id)
  res.json({ success: true })
})

// DELETE /api/notifications/:id
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id=? AND user_id=?').run(req.params.id, req.user.id)
  res.json({ success: true })
})

module.exports = router
