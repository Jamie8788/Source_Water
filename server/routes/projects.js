const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireResearcher } = require('../middleware/auth')
const upload = require('../middleware/upload')

router.get('/', requireAuth, requireResearcher, (req, res) => {
  const projects = db.prepare('SELECT rp.*, u.display_name as creator_name FROM research_projects rp LEFT JOIN users u ON rp.created_by=u.id ORDER BY rp.created_at DESC').all()
  const enriched = projects.map(p => ({
    ...p,
    team_members: p.team_members ? JSON.parse(p.team_members) : [],
    dataset_count: db.prepare('SELECT COUNT(*) as c FROM project_datasets WHERE project_id=?').get(p.id).c,
  }))
  res.json(enriched)
})

router.post('/', requireAuth, requireResearcher, (req, res) => {
  const { title, description, start_date, end_date, team_members, objectives, methodology } = req.body
  const result = db.prepare('INSERT INTO research_projects (title,description,start_date,end_date,team_members,objectives,methodology,created_by) VALUES (?,?,?,?,?,?,?,?)').run(title,description,start_date,end_date,JSON.stringify(team_members||[]),objectives,methodology,req.user.id)
  res.json(db.prepare('SELECT * FROM research_projects WHERE id=?').get(result.lastInsertRowid))
})

router.put('/:id', requireAuth, requireResearcher, (req, res) => {
  const { title, description, start_date, end_date, team_members, objectives, methodology, status } = req.body
  db.prepare('UPDATE research_projects SET title=?,description=?,start_date=?,end_date=?,team_members=?,objectives=?,methodology=?,status=? WHERE id=?').run(title,description,start_date,end_date,JSON.stringify(team_members||[]),objectives,methodology,status,req.params.id)
  res.json(db.prepare('SELECT * FROM research_projects WHERE id=?').get(req.params.id))
})

router.delete('/:id', requireAuth, requireResearcher, (req, res) => {
  const p = db.prepare('SELECT * FROM research_projects WHERE id=?').get(req.params.id)
  if (p.created_by !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden' })
  db.prepare('DELETE FROM research_projects WHERE id=?').run(req.params.id)
  res.json({ success: true })
})

// Dataset upload
router.post('/:id/datasets', requireAuth, requireResearcher, upload.single('dataset'), async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error: 'No file uploaded' })

    const { file_name, column_names, row_count, data_preview, basic_stats } = req.body

    const result = db.prepare(`INSERT INTO project_datasets (project_id,file_name,file_path,file_size,row_count,column_names,data_preview,basic_stats,uploaded_by) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      req.params.id, file.originalname,
      `/uploads/datasets/${file.filename}`,
      file.size, parseInt(row_count)||0,
      column_names, data_preview, basic_stats, req.user.id
    )

    db.prepare('INSERT INTO activity_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)').run(req.user.id,'uploaded_dataset','project',req.params.id)
    res.json(db.prepare('SELECT * FROM project_datasets WHERE id=?').get(result.lastInsertRowid))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id/datasets', requireAuth, requireResearcher, (req, res) => {
  const datasets = db.prepare('SELECT pd.*, u.display_name FROM project_datasets pd LEFT JOIN users u ON pd.uploaded_by=u.id WHERE pd.project_id=? ORDER BY pd.uploaded_at DESC').all(req.params.id)
  res.json(datasets.map(d => ({
    ...d,
    column_names: d.column_names ? JSON.parse(d.column_names) : [],
    data_preview: d.data_preview ? JSON.parse(d.data_preview) : [],
    basic_stats: d.basic_stats ? JSON.parse(d.basic_stats) : {},
  })))
})

// Save AI analysis to dataset
router.put('/datasets/:did/analysis', requireAuth, requireResearcher, (req, res) => {
  db.prepare('UPDATE project_datasets SET ai_analysis=? WHERE id=?').run(req.body.analysis, req.params.did)
  res.json({ success: true })
})

module.exports = router
