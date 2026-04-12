const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const upload = require('../middleware/upload')

// GET /api/resources
router.get('/', requireAuth, async (req, res) => {
  const { category, type, search } = req.query
  let query = `SELECT r.*, u.username, u.display_name,
    (SELECT COUNT(*) FROM resource_bookmarks rb WHERE rb.resource_id=r.id) AS bookmark_count
    FROM resources r LEFT JOIN users u ON r.created_by=u.id WHERE r.visibility='public'`
  const params = []
  if (category) { query += ' AND r.category=?'; params.push(category) }
  if (type)     { query += ' AND r.resource_type=?'; params.push(type) }
  if (search)   { query += ' AND (r.title LIKE ? OR r.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  query += ' ORDER BY r.featured DESC, r.view_count DESC, r.created_at DESC'
  const resources = (await db.all(query, params)).map(r => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] }))
  res.json(resources)
})

// POST /api/resources
router.post('/', requireAuth, requireAdmin, upload.fields([{name:'file',maxCount:1},{name:'thumbnail',maxCount:1}]), async (req, res) => {
  const { title, description, resource_type, external_url, category, tags, visibility } = req.body
  const file  = req.files?.file?.[0]
  const thumb = req.files?.thumbnail?.[0]
  const filePath  = file  ? `/uploads/documents/${file.filename}`  : null
  const thumbPath = thumb ? `/uploads/images/${thumb.filename}` : null
  const { lastInsertRowid } = await db.run(
    'INSERT INTO resources (title,description,resource_type,file_path,external_url,category,tags,thumbnail,visibility,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [title, description, resource_type, filePath, external_url, category, JSON.stringify(tags || []), thumbPath, visibility || 'public', req.user.id])
  await db.run('INSERT INTO activity_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)',
    [req.user.id, 'added_resource', 'resource', lastInsertRowid])
  res.json(await db.get('SELECT * FROM resources WHERE id=?', [lastInsertRowid]))
})

// PUT /api/resources/:id
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { title, description, category, tags, visibility, featured } = req.body
  await db.run('UPDATE resources SET title=?,description=?,category=?,tags=?,visibility=?,featured=? WHERE id=?',
    [title, description, category, JSON.stringify(tags || []), visibility, featured ? 1 : 0, req.params.id])
  res.json(await db.get('SELECT * FROM resources WHERE id=?', [req.params.id]))
})

// DELETE /api/resources/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await db.run('DELETE FROM resources WHERE id=?', [req.params.id])
  res.json({ success: true })
})

// POST /api/resources/:id/view  — increment view count
router.post('/:id/view', requireAuth, async (req, res) => {
  await db.run('UPDATE resources SET view_count = COALESCE(view_count,0) + 1 WHERE id=?', [req.params.id]).catch(() => {})
  res.json({ ok: true })
})

// POST /api/resources/:id/bookmark
router.post('/:id/bookmark', requireAuth, async (req, res) => {
  try {
    await db.run('INSERT OR IGNORE INTO resource_bookmarks (user_id,resource_id) VALUES (?,?)', [req.user.id, req.params.id])
    await db.run('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)',
      [req.user.id, 1, 'resource_bookmark', new Date().toISOString().slice(0, 7)])
    res.json({ bookmarked: true })
  } catch { res.json({ bookmarked: true }) }
})

// DELETE /api/resources/:id/bookmark
router.delete('/:id/bookmark', requireAuth, async (req, res) => {
  await db.run('DELETE FROM resource_bookmarks WHERE user_id=? AND resource_id=?', [req.user.id, req.params.id])
  res.json({ bookmarked: false })
})

// GET /api/resources/bookmarks
router.get('/bookmarks', requireAuth, async (req, res) => {
  const bookmarks = await db.all('SELECT resource_id FROM resource_bookmarks WHERE user_id=?', [req.user.id])
  res.json(bookmarks.map(b => b.resource_id))
})

module.exports = router
