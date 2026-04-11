const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireResearcher } = require('../middleware/auth')
const upload = require('../middleware/upload')

router.get('/', requireAuth, requireResearcher, async (req, res) => {
  const projects = await db.all('SELECT rp.*, u.display_name as creator_name FROM research_projects rp LEFT JOIN users u ON rp.created_by=u.id ORDER BY rp.created_at DESC', [])
  const enriched = await Promise.all(projects.map(async p => {
    const row = await db.get('SELECT COUNT(*) as c FROM project_datasets WHERE project_id=?', [p.id])
    return { ...p, team_members: p.team_members ? JSON.parse(p.team_members) : [], dataset_count: parseInt(row?.c ?? 0) }
  }))
  res.json(enriched)
})

router.post('/', requireAuth, requireResearcher, async (req, res) => {
  const { title, description, start_date, end_date, team_members, objectives, methodology } = req.body
  const { lastInsertRowid } = await db.run(
    'INSERT INTO research_projects (title,description,start_date,end_date,team_members,objectives,methodology,created_by) VALUES (?,?,?,?,?,?,?,?)',
    [title, description, start_date, end_date, JSON.stringify(team_members || []), objectives, methodology, req.user.id])
  res.json(await db.get('SELECT * FROM research_projects WHERE id=?', [lastInsertRowid]))
})

router.put('/:id', requireAuth, requireResearcher, async (req, res) => {
  const { title, description, start_date, end_date, team_members, objectives, methodology, status } = req.body
  await db.run(
    'UPDATE research_projects SET title=?,description=?,start_date=?,end_date=?,team_members=?,objectives=?,methodology=?,status=? WHERE id=?',
    [title, description, start_date, end_date, JSON.stringify(team_members || []), objectives, methodology, status, req.params.id])
  res.json(await db.get('SELECT * FROM research_projects WHERE id=?', [req.params.id]))
})

router.delete('/:id', requireAuth, requireResearcher, async (req, res) => {
  const p = await db.get('SELECT * FROM research_projects WHERE id=?', [req.params.id])
  if (p.created_by !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden' })
  await db.run('DELETE FROM research_projects WHERE id=?', [req.params.id])
  res.json({ success: true })
})

router.post('/:id/datasets', requireAuth, requireResearcher, upload.single('dataset'), async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error: 'No file uploaded' })
    const { file_name, column_names, row_count, data_preview, basic_stats } = req.body
    const { lastInsertRowid } = await db.run(
      `INSERT INTO project_datasets (project_id,file_name,file_path,file_size,row_count,column_names,data_preview,basic_stats,uploaded_by) VALUES (?,?,?,?,?,?,?,?,?)`,
      [req.params.id, file.originalname, `/uploads/datasets/${file.filename}`, file.size, parseInt(row_count) || 0, column_names, data_preview, basic_stats, req.user.id])
    await db.run('INSERT INTO activity_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)',
      [req.user.id, 'uploaded_dataset', 'project', req.params.id])
    res.json(await db.get('SELECT * FROM project_datasets WHERE id=?', [lastInsertRowid]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id/datasets', requireAuth, requireResearcher, async (req, res) => {
  const datasets = await db.all(
    'SELECT pd.*, u.display_name FROM project_datasets pd LEFT JOIN users u ON pd.uploaded_by=u.id WHERE pd.project_id=? ORDER BY pd.uploaded_at DESC',
    [req.params.id])
  res.json(datasets.map(d => ({
    ...d,
    column_names: d.column_names ? JSON.parse(d.column_names) : [],
    data_preview: d.data_preview ? JSON.parse(d.data_preview) : [],
    basic_stats: d.basic_stats ? JSON.parse(d.basic_stats) : {},
  })))
})

router.put('/datasets/:did/analysis', requireAuth, requireResearcher, async (req, res) => {
  await db.run('UPDATE project_datasets SET ai_analysis=? WHERE id=?', [req.body.analysis, req.params.did])
  res.json({ success: true })
})

module.exports = router
