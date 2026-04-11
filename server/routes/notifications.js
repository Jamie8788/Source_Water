const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const notifs = await db.all('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30', [req.user.id])
  res.json({ notifications: notifs, unread: notifs.filter(n => !n.read).length })
})

router.post('/read-all', requireAuth, async (req, res) => {
  await db.run('UPDATE notifications SET read=1 WHERE user_id=?', [req.user.id])
  res.json({ success: true })
})

router.delete('/:id', requireAuth, async (req, res) => {
  await db.run('DELETE FROM notifications WHERE id=? AND user_id=?', [req.params.id, req.user.id])
  res.json({ success: true })
})

module.exports = router
