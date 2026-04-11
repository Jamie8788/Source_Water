const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')

router.get('/content/:page', requireAuth, async (req, res) => {
  const rows = await db.all('SELECT block_key, field, value FROM cms_content WHERE page_key = ?', [req.params.page])
  const content = {}
  rows.forEach(r => {
    if (!content[r.block_key]) content[r.block_key] = {}
    content[r.block_key][r.field] = r.value
  })
  res.json({ content })
})

router.put('/content', requireAdmin, async (req, res) => {
  const { page_key, block_key, field, value } = req.body
  if (!page_key || !block_key || !field) return res.status(400).json({ error: 'page_key, block_key, field required' })
  await db.run(
    `INSERT INTO cms_content (page_key, block_key, field, value) VALUES (?, ?, ?, ?) ON CONFLICT(page_key, block_key, field) DO UPDATE SET value=EXCLUDED.value`,
    [page_key, block_key, field, value])
  res.json({ ok: true })
})

router.get('/quick-actions', requireAuth, async (req, res) => {
  const rows = await db.all('SELECT * FROM cms_quick_actions ORDER BY sort_order', [])
  res.json({ actions: rows })
})

router.put('/quick-actions/:id', requireAdmin, async (req, res) => {
  const { label, description, icon, path, gradient, visible } = req.body
  await db.run(
    `UPDATE cms_quick_actions SET label=?, description=?, icon=?, path=?, gradient=?, visible=? WHERE action_id=?`,
    [label, description, icon, path, gradient, visible ?? 1, req.params.id])
  res.json({ ok: true })
})

router.post('/quick-actions/seed', requireAdmin, async (req, res) => {
  const { actions } = req.body
  for (const [i, a] of actions.entries()) {
    await db.run(
      `INSERT INTO cms_quick_actions (action_id, label, description, icon, path, gradient, visible, sort_order) VALUES (?,?,?,?,?,?,1,?) ON CONFLICT DO NOTHING`,
      [a.id, a.label, a.desc || a.description, a.icon, a.path, a.gradient, i])
  }
  res.json({ ok: true })
})

router.get('/all', requireAdmin, async (req, res) => {
  const [content, actions] = await Promise.all([
    db.all('SELECT * FROM cms_content ORDER BY page_key, block_key', []),
    db.all('SELECT * FROM cms_quick_actions ORDER BY sort_order', []),
  ])
  res.json({ content, actions })
})

module.exports = router
