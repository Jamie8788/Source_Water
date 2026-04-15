const router = require('express').Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'logos')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png'
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext) ? ext : '.png'
    cb(null, `sponsor-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      return cb(new Error('Sponsor logos must be image files'))
    }
    cb(null, true)
  },
})

const tsSql = db.USE_PG ? 'NOW()' : "datetime('now')"

function parseBool(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const normalized = String(value).trim().toLowerCase()
  return ['1', 'true', 'yes', 'on', 'active'].includes(normalized)
}

function parseOrder(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeSponsor(row) {
  if (!row) return null
  const isActive = row.is_active === 1 || row.is_active === true || row.status === 'active'
  return {
    ...row,
    is_active: isActive,
    display_order: Number(row.display_order ?? 0),
    logo_url: row.logo_path || null,
  }
}

async function loadSponsor(id) {
  return db.get('SELECT * FROM sponsors WHERE id = ?', [id])
}

async function cleanupLogo(logoPath) {
  if (!logoPath || /^https?:\/\//i.test(logoPath)) return
  if (!logoPath.startsWith('/uploads/')) return
  const diskPath = path.join(__dirname, '..', '..', logoPath.replace(/^\//, ''))
  await fs.promises.unlink(diskPath).catch(() => {})
}

function buildPayload(req, existing = {}) {
  const body = req.body || {}
  return {
    name: body.name?.trim() || existing.name || '',
    website_url: body.website_url?.trim() || existing.website_url || null,
    alt_text: body.alt_text?.trim() || existing.alt_text || null,
    tagline: body.tagline?.trim() || existing.tagline || null,
    is_active: parseBool(body.is_active, existing.is_active ?? true),
    display_order: parseOrder(body.display_order, existing.display_order ?? 0),
  }
}

function validateSponsor(payload) {
  if (!payload.name) return 'Sponsor name is required'
  return null
}

router.get('/active', async (_req, res) => {
  const rows = await db.all(
    `SELECT *
     FROM sponsors
     WHERE COALESCE(is_active, CASE WHEN status = 'active' THEN 1 ELSE 0 END) = 1
     ORDER BY display_order ASC, created_at ASC, id ASC`,
    []
  )
  res.json(rows.map(normalizeSponsor))
})

router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db.all(
    `SELECT *
     FROM sponsors
     ORDER BY display_order ASC, created_at DESC, id DESC`,
    []
  )
  res.json(rows.map(normalizeSponsor))
})

router.post('/', requireAuth, requireAdmin, upload.single('logo'), async (req, res) => {
  try {
    const payload = buildPayload(req)
    const validationError = validateSponsor(payload)
    if (validationError) return res.status(400).json({ error: validationError })

    const logoPath = req.file ? `/uploads/logos/${req.file.filename}` : null
    const status = payload.is_active ? 'active' : 'inactive'
    const { lastInsertRowid } = await db.run(
      `INSERT INTO sponsors (name, website_url, logo_path, alt_text, tagline, is_active, status, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.name, payload.website_url, logoPath, payload.alt_text, payload.tagline, payload.is_active ? 1 : 0, status, payload.display_order]
    )
    const sponsor = await loadSponsor(lastInsertRowid)
    res.status(201).json(normalizeSponsor(sponsor))
  } catch (err) {
    console.error('[sponsors:create]', err)
    res.status(500).json({ error: err.message || 'Failed to create sponsor' })
  }
})

router.put('/:id', requireAuth, requireAdmin, upload.single('logo'), async (req, res) => {
  try {
    const existing = await loadSponsor(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Sponsor not found' })

    const payload = buildPayload(req, existing)
    const validationError = validateSponsor(payload)
    if (validationError) return res.status(400).json({ error: validationError })

    const nextLogoPath = req.file ? `/uploads/logos/${req.file.filename}` : existing.logo_path || null
    const status = payload.is_active ? 'active' : 'inactive'

    await db.run(
      `UPDATE sponsors
       SET name = ?, website_url = ?, logo_path = ?, alt_text = ?, tagline = ?, is_active = ?, status = ?, display_order = ?, updated_at = ${tsSql}
       WHERE id = ?`,
      [payload.name, payload.website_url, nextLogoPath, payload.alt_text, payload.tagline, payload.is_active ? 1 : 0, status, payload.display_order, req.params.id]
    )

    if (req.file && existing.logo_path && existing.logo_path !== nextLogoPath) {
      await cleanupLogo(existing.logo_path)
    }

    const sponsor = await loadSponsor(req.params.id)
    res.json(normalizeSponsor(sponsor))
  } catch (err) {
    console.error('[sponsors:update]', err)
    res.status(500).json({ error: err.message || 'Failed to update sponsor' })
  }
})

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const sponsor = await loadSponsor(req.params.id)
    if (!sponsor) return res.status(404).json({ error: 'Sponsor not found' })
    await db.run('DELETE FROM sponsors WHERE id = ?', [req.params.id])
    await cleanupLogo(sponsor.logo_path)
    res.json({ success: true })
  } catch (err) {
    console.error('[sponsors:delete]', err)
    res.status(500).json({ error: err.message || 'Failed to delete sponsor' })
  }
})

module.exports = router