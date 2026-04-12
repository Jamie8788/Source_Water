const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const parseJSON = (v, fallback = {}) => {
  try { return v ? JSON.parse(v) : fallback } catch { return fallback }
}

// ── Element overrides (click-to-edit text/style changes) ─────────────────────

// GET /api/cms/overrides  — all overrides (public, no auth needed)
router.get('/overrides', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM cms_overrides', [])
    const map = {}
    rows.forEach(r => {
      map[r.element_key] = {
        text: r.text_content,
        html: r.html_content,
        styles: parseJSON(r.styles, {}),
      }
    })
    res.json(map)
  } catch (e) { res.json({}) }
})

// PUT /api/cms/overrides/:key  — save/update one override (admin only)
router.put('/overrides/:key', requireAuth, requireAdmin, async (req, res) => {
  const { text_content, html_content, styles } = req.body
  const key = req.params.key
  await db.run(
    `INSERT INTO cms_overrides (element_key, text_content, html_content, styles, updated_at)
     VALUES (?, ?, ?, ?, NOW())
     ON CONFLICT (element_key) DO UPDATE SET
       text_content=EXCLUDED.text_content,
       html_content=EXCLUDED.html_content,
       styles=EXCLUDED.styles,
       updated_at=EXCLUDED.updated_at`,
    [key, text_content ?? null, html_content ?? null, JSON.stringify(styles || {})]
  )
  res.json({ ok: true })
})

// DELETE /api/cms/overrides/:key  — remove one override (admin only)
router.delete('/overrides/:key', requireAuth, requireAdmin, async (req, res) => {
  await db.run('DELETE FROM cms_overrides WHERE element_key=?', [req.params.key])
  res.json({ ok: true })
})

// ── Content fields (CMSField components) ─────────────────────────────────────

// GET /api/cms/content  — all content fields (public)
router.get('/content', async (req, res) => {
  try {
    const rows = await db.all('SELECT page_key, block_key, field, value FROM cms_content', [])
    const map = {}
    rows.forEach(r => { map[`${r.page_key}__${r.block_key}__${r.field}`] = r.value })
    res.json(map)
  } catch (e) { res.json({}) }
})

// Legacy per-page endpoint (kept for backwards compat)
router.get('/content/:page', requireAuth, async (req, res) => {
  const rows = await db.all('SELECT block_key, field, value FROM cms_content WHERE page_key=?', [req.params.page])
  const content = {}
  rows.forEach(r => {
    if (!content[r.block_key]) content[r.block_key] = {}
    content[r.block_key][r.field] = r.value
  })
  res.json({ content })
})

// PUT /api/cms/content  — save one content field (admin)
router.put('/content', requireAuth, requireAdmin, async (req, res) => {
  const { page_key, block_key, field, value } = req.body
  if (!page_key || !block_key || !field) return res.status(400).json({ error: 'page_key, block_key, field required' })
  await db.run(
    `INSERT INTO cms_content (page_key, block_key, field, value, updated_at)
     VALUES (?, ?, ?, ?, NOW())
     ON CONFLICT (page_key, block_key, field) DO UPDATE SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at`,
    [page_key, block_key, field, value]
  )
  res.json({ ok: true })
})

// ── Site settings (notification bar, hidden components) ──────────────────────

// GET /api/cms/settings/:key  (public)
router.get('/settings/:key', async (req, res) => {
  try {
    const row = await db.get('SELECT value FROM cms_site_settings WHERE key=?', [req.params.key])
    res.json(row ? parseJSON(row.value, null) : null)
  } catch (e) { res.json(null) }
})

// PUT /api/cms/settings/:key  (admin)
router.put('/settings/:key', requireAuth, requireAdmin, async (req, res) => {
  const { value } = req.body
  await db.run(
    `INSERT INTO cms_site_settings (key, value, updated_at) VALUES (?, ?, NOW())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at`,
    [req.params.key, JSON.stringify(value)]
  )
  res.json({ ok: true })
})

// ── Page blocks (admin-inserted buttons, headings, etc.) ─────────────────────

// GET /api/cms/blocks/:page  (public)
router.get('/blocks/:page', async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT * FROM cms_page_blocks WHERE page_key=? ORDER BY order_index ASC',
      [req.params.page]
    )
    res.json(rows.map(r => ({ ...r, content: parseJSON(r.content, {}) })))
  } catch (e) { res.json([]) }
})

// POST /api/cms/blocks  (admin)
router.post('/blocks', requireAuth, requireAdmin, async (req, res) => {
  const { page_key, block_type, content, order_index } = req.body
  const { lastInsertRowid } = await db.run(
    'INSERT INTO cms_page_blocks (page_key, block_type, content, order_index, updated_at) VALUES (?, ?, ?, ?, NOW())',
    [page_key, block_type, JSON.stringify(content || {}), order_index ?? 0]
  )
  const block = await db.get('SELECT * FROM cms_page_blocks WHERE id=?', [lastInsertRowid])
  res.json({ ...block, content: parseJSON(block.content, {}) })
})

// PUT /api/cms/blocks/:id  (admin)
router.put('/blocks/:id', requireAuth, requireAdmin, async (req, res) => {
  const { content } = req.body
  await db.run(
    'UPDATE cms_page_blocks SET content=?, updated_at=NOW() WHERE id=?',
    [JSON.stringify(content || {}), req.params.id]
  )
  const block = await db.get('SELECT * FROM cms_page_blocks WHERE id=?', [req.params.id])
  res.json({ ...block, content: parseJSON(block.content, {}) })
})

// DELETE /api/cms/blocks/:id  (admin)
router.delete('/blocks/:id', requireAuth, requireAdmin, async (req, res) => {
  await db.run('DELETE FROM cms_page_blocks WHERE id=?', [req.params.id])
  res.json({ ok: true })
})

// ── Quick actions (existing) ──────────────────────────────────────────────────
router.get('/quick-actions', requireAuth, async (req, res) => {
  const rows = await db.all('SELECT * FROM cms_quick_actions ORDER BY sort_order', [])
  res.json({ actions: rows })
})

router.put('/quick-actions/:id', requireAuth, requireAdmin, async (req, res) => {
  const { label, description, icon, path, gradient, visible } = req.body
  await db.run(
    'UPDATE cms_quick_actions SET label=?, description=?, icon=?, path=?, gradient=?, visible=? WHERE action_id=?',
    [label, description, icon, path, gradient, visible ?? 1, req.params.id]
  )
  res.json({ ok: true })
})

router.post('/quick-actions/seed', requireAuth, requireAdmin, async (req, res) => {
  const { actions } = req.body
  for (const [i, a] of actions.entries()) {
    await db.run(
      `INSERT INTO cms_quick_actions (action_id, label, description, icon, path, gradient, visible, sort_order)
       VALUES (?,?,?,?,?,?,1,?) ON CONFLICT DO NOTHING`,
      [a.id, a.label, a.desc || a.description, a.icon, a.path, a.gradient, i]
    )
  }
  res.json({ ok: true })
})

router.get('/all', requireAuth, requireAdmin, async (req, res) => {
  const [content, actions] = await Promise.all([
    db.all('SELECT * FROM cms_content ORDER BY page_key, block_key', []),
    db.all('SELECT * FROM cms_quick_actions ORDER BY sort_order', []),
  ])
  res.json({ content, actions })
})

module.exports = router
