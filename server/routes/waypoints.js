/**
 * /api/waypoints — per-user field pins dropped on the Monitoring Map.
 *
 * Every endpoint scopes to req.user.id, so one volunteer's waypoints never
 * leak into another user's view. No admin override here on purpose — these
 * are personal field notes, not shared infrastructure.
 *
 * Schema (see server/db/schema.js):
 *   waypoints(id, user_id, latitude, longitude, name, note, category, color, created_at, updated_at)
 */
const express = require('express')
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

const ALLOWED_CATEGORIES = new Set([
  'general',          // anything else
  'access_point',     // boat launch, parking, trailhead
  'hazard',           // pollution, fish kill, blocked culvert
  'wildlife',         // sighting worth noting
  'monitoring_idea',  // potential new monitoring location
  'photo_spot',       // good vantage point
  'note',             // generic
])

const isFinitNum = v => typeof v === 'number' && isFinite(v)

function sanitizeColor(c) {
  if (typeof c !== 'string') return '#f59e0b'
  const m = c.match(/^#[0-9a-fA-F]{6}$/)
  return m ? c : '#f59e0b'
}

function sanitizeCategory(c) {
  return ALLOWED_CATEGORIES.has(c) ? c : 'general'
}

// GET /api/waypoints — current user's waypoints, newest first
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT id, latitude, longitude, name, note, category, color, created_at, updated_at FROM waypoints WHERE user_id=? ORDER BY created_at DESC',
      [req.user.id]
    )
    res.json({ waypoints: rows })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/waypoints — drop a new pin
router.post('/', requireAuth, async (req, res) => {
  try {
    const lat = parseFloat(req.body.latitude)
    const lng = parseFloat(req.body.longitude)
    const name = String(req.body.name || '').trim().slice(0, 120)
    const note = req.body.note ? String(req.body.note).slice(0, 2000) : null
    const category = sanitizeCategory(req.body.category)
    const color = sanitizeColor(req.body.color)

    if (!isFinitNum(lat) || !isFinitNum(lng)) return res.status(400).json({ error: 'latitude/longitude required' })
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return res.status(400).json({ error: 'coordinates out of range' })
    if (!name) return res.status(400).json({ error: 'name required' })

    // Soft cap so a single user can't fill the table
    const countRow = await db.get('SELECT COUNT(*) AS n FROM waypoints WHERE user_id=?', [req.user.id])
    if (countRow && Number(countRow.n) >= 500) return res.status(400).json({ error: 'Waypoint limit reached (500). Delete some old pins first.' })

    const { lastInsertRowid } = await db.run(
      'INSERT INTO waypoints (user_id, latitude, longitude, name, note, category, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, lat, lng, name, note, category, color]
    )
    const created = await db.get('SELECT id, latitude, longitude, name, note, category, color, created_at, updated_at FROM waypoints WHERE id=?', [lastInsertRowid])
    res.status(201).json({ waypoint: created })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/waypoints/:id — edit name/note/category/color (coordinates are immutable)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const own = await db.get('SELECT id FROM waypoints WHERE id=? AND user_id=?', [req.params.id, req.user.id])
    if (!own) return res.status(404).json({ error: 'Not found' })

    const updates = []
    const vals = []
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim().slice(0, 120)
      if (!name) return res.status(400).json({ error: 'name required' })
      updates.push('name=?'); vals.push(name)
    }
    if (req.body.note !== undefined) {
      updates.push('note=?'); vals.push(req.body.note ? String(req.body.note).slice(0, 2000) : null)
    }
    if (req.body.category !== undefined) {
      updates.push('category=?'); vals.push(sanitizeCategory(req.body.category))
    }
    if (req.body.color !== undefined) {
      updates.push('color=?'); vals.push(sanitizeColor(req.body.color))
    }
    if (!updates.length) return res.status(400).json({ error: 'nothing to update' })

    // updated_at: handle PG (NOW()) vs SQLite (datetime('now')) at SQL layer
    updates.push(db.USE_PG ? "updated_at=NOW()" : "updated_at=datetime('now')")
    vals.push(req.params.id)
    await db.run(`UPDATE waypoints SET ${updates.join(',')} WHERE id=?`, vals)
    const updated = await db.get('SELECT id, latitude, longitude, name, note, category, color, created_at, updated_at FROM waypoints WHERE id=?', [req.params.id])
    res.json({ waypoint: updated })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/waypoints/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await db.run('DELETE FROM waypoints WHERE id=? AND user_id=?', [req.params.id, req.user.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
