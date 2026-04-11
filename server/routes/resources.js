const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const upload = require('../middleware/upload')

router.get('/', requireAuth, async (req, res) => {
  const { category, type, search } = req.query
  let query = `SELECT r.*, u.username, u.display_name FROM resources r LEFT JOIN users u ON r.created_by=u.id WHERE r.visibility='public'`
  const params = []
  if (category) { query += ' AND r.category=?'; params.push(category) }
  if (type) { query += ' AND r.resource_type=?'; params.push(type) }
  if (search) { query += ' AND (r.title LIKE ? OR r.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  query += ' ORDER BY r.created_at DESC'
  const resources = (await db.all(query, params)).map(r => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] }))
  res.json(resources)
})

router.post('/', requireAuth, requireAdmin, upload.fields([{name:'file',maxCount:1},{name:'thumbnail',maxCount:1}]), async (req, res) => {
  const { title, description, resource_type, external_url, category, tags, visibility } = req.body
  const file = req.files?.file?.[0]
  const thumb = req.files?.thumbnail?.[0]
  const filePath = file ? `/uploads/documents/${file.filename}` : null
  const thumbPath = thumb ? `/uploads/images/${thumb.filename}` : null
  const { lastInsertRowid } = await db.run(
    'INSERT INTO resources (title,description,resource_type,file_path,external_url,category,tags,thumbnail,visibility,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [title, description, resource_type, filePath, external_url, category, JSON.stringify(tags || []), thumbPath, visibility || 'public', req.user.id])
  await db.run('INSERT INTO activity_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)',
    [req.user.id, 'added_resource', 'resource', lastInsertRowid])
  res.json(await db.get('SELECT * FROM resources WHERE id=?', [lastInsertRowid]))
})

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { title, description, category, tags, visibility } = req.body
  await db.run('UPDATE resources SET title=?,description=?,category=?,tags=?,visibility=? WHERE id=?',
    [title, description, category, JSON.stringify(tags || []), visibility, req.params.id])
  res.json(await db.get('SELECT * FROM resources WHERE id=?', [req.params.id]))
})

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await db.run('DELETE FROM resources WHERE id=?', [req.params.id])
  res.json({ success: true })
})

router.post('/:id/bookmark', requireAuth, async (req, res) => {
  try {
    await db.run('INSERT OR IGNORE INTO resource_bookmarks (user_id,resource_id) VALUES (?,?)', [req.user.id, req.params.id])
    await db.run('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)',
      [req.user.id, 1, 'resource_view', new Date().toISOString().slice(0, 7)])
    res.json({ bookmarked: true })
  } catch { res.json({ bookmarked: true }) }
})

router.delete('/:id/bookmark', requireAuth, async (req, res) => {
  await db.run('DELETE FROM resource_bookmarks WHERE user_id=? AND resource_id=?', [req.user.id, req.params.id])
  res.json({ bookmarked: false })
})

router.get('/bookmarks', requireAuth, async (req, res) => {
  const bookmarks = await db.all('SELECT resource_id FROM resource_bookmarks WHERE user_id=?', [req.user.id])
  res.json(bookmarks.map(b => b.resource_id))
})

module.exports = router
