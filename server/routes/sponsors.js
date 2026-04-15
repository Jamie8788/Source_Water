const router = require('express').Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const cloudinary = require('cloudinary').v2
const { Readable } = require('stream')
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      return cb(new Error('Sponsor logos must be image files'))
    }
    cb(null, true)
  },
})

function bufferToStream(buffer) {
  const readable = new Readable({ read() {} })
  readable.push(buffer)
  readable.push(null)
  return readable
}

function hasCloudinaryConfig() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
}

function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

async function uploadSponsorLogoToCloudinary(file) {
  configureCloudinary()
  const folder = process.env.CLOUDINARY_SPONSOR_FOLDER || 'source-water/sponsors'
  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto',
      },
      (err, uploaded) => (err ? reject(err) : resolve(uploaded))
    )
    bufferToStream(file.buffer).pipe(uploadStream)
  })
  return {
    logoPath: result.secure_url,
    logoPublicId: result.public_id,
  }
}

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

async function cleanupCloudinaryLogo(publicId) {
  if (!publicId || !hasCloudinaryConfig()) return
  configureCloudinary()
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => {})
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

    let logoPath = null
    let logoPublicId = null
    if (req.file) {
      if (!hasCloudinaryConfig()) {
        return res.status(500).json({ error: 'Cloudinary is not configured for sponsor uploads' })
      }
      const uploaded = await uploadSponsorLogoToCloudinary(req.file)
      logoPath = uploaded.logoPath
      logoPublicId = uploaded.logoPublicId
    }

    const status = payload.is_active ? 'active' : 'inactive'
    const { lastInsertRowid } = await db.run(
      `INSERT INTO sponsors (name, website_url, logo_path, logo_public_id, alt_text, tagline, is_active, status, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.name, payload.website_url, logoPath, logoPublicId, payload.alt_text, payload.tagline, payload.is_active ? 1 : 0, status, payload.display_order]
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

    let nextLogoPath = existing.logo_path || null
    let nextLogoPublicId = existing.logo_public_id || null
    if (req.file) {
      if (!hasCloudinaryConfig()) {
        return res.status(500).json({ error: 'Cloudinary is not configured for sponsor uploads' })
      }
      const uploaded = await uploadSponsorLogoToCloudinary(req.file)
      nextLogoPath = uploaded.logoPath
      nextLogoPublicId = uploaded.logoPublicId
    }

    const status = payload.is_active ? 'active' : 'inactive'

    await db.run(
      `UPDATE sponsors
       SET name = ?, website_url = ?, logo_path = ?, logo_public_id = ?, alt_text = ?, tagline = ?, is_active = ?, status = ?, display_order = ?, updated_at = ${tsSql}
       WHERE id = ?`,
      [payload.name, payload.website_url, nextLogoPath, nextLogoPublicId, payload.alt_text, payload.tagline, payload.is_active ? 1 : 0, status, payload.display_order, req.params.id]
    )

    if (req.file && existing.logo_path && existing.logo_path !== nextLogoPath) {
      await cleanupLogo(existing.logo_path)
      await cleanupCloudinaryLogo(existing.logo_public_id)
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
    await cleanupCloudinaryLogo(sponsor.logo_public_id)
    res.json({ success: true })
  } catch (err) {
    console.error('[sponsors:delete]', err)
    res.status(500).json({ error: err.message || 'Failed to delete sponsor' })
  }
})

module.exports = router