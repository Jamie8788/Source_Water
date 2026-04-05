const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')

// GET all content for a page (public read)
router.get('/content/:page', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT block_key, field, value FROM cms_content WHERE page_key = ?').all(req.params.page)
  const content = {}
  rows.forEach(r => {
    if (!content[r.block_key]) content[r.block_key] = {}
    content[r.block_key][r.field] = r.value
  })
  res.json({ content })
})

// PUT upsert content (admin only)
router.put('/content', requireAdmin, (req, res) => {
  const { page_key, block_key, field, value } = req.body
  if (!page_key || !block_key || !field) return res.status(400).json({ error: 'page_key, block_key, field required' })
  db.prepare(`
    INSERT INTO cms_content (page_key, block_key, field, value, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(page_key, block_key, field) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).run(page_key, block_key, field, value)
  res.json({ ok: true })
})

// GET quick actions
router.get('/quick-actions', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM cms_quick_actions ORDER BY sort_order').all()
  res.json({ actions: rows })
})

// PUT update quick action
router.put('/quick-actions/:id', requireAdmin, (req, res) => {
  const { label, description, icon, path, gradient, visible } = req.body
  db.prepare(`
    UPDATE cms_quick_actions SET label=?, description=?, icon=?, path=?, gradient=?, visible=?
    WHERE action_id=?
  `).run(label, description, icon, path, gradient, visible ?? 1, req.params.id)
  res.json({ ok: true })
})

// POST seed quick actions (called once)
router.post('/quick-actions/seed', requireAdmin, (req, res) => {
  const { actions } = req.body
  const ins = db.prepare(`INSERT OR IGNORE INTO cms_quick_actions (action_id, label, description, icon, path, gradient, visible, sort_order) VALUES (?,?,?,?,?,?,1,?)`)
  actions.forEach((a, i) => ins.run(a.id, a.label, a.desc || a.description, a.icon, a.path, a.gradient, i))
  res.json({ ok: true })
})

// GET all content (admin bulk export)
router.get('/all', requireAdmin, (req, res) => {
  const content = db.prepare('SELECT * FROM cms_content ORDER BY page_key, block_key').all()
  const actions = db.prepare('SELECT * FROM cms_quick_actions ORDER BY sort_order').all()
  res.json({ content, actions })
})

module.exports = router
