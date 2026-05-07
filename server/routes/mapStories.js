/**
 * /api/map-stories — community context layer on the Monitoring Map.
 *
 * Globally visible: all authenticated users see all stories. The owner can
 * edit/delete their own; admins can delete any. Text-only by design — no
 * photos, no attachments — to keep moderation simple and payloads small.
 *
 * Schema (see server/db/schema.js):
 *   map_stories(id, user_id, latitude, longitude, vibe, text, created_at, updated_at)
 *
 * Vibes are constrained to a small whitelist so the UI can color-code them
 * consistently. Anything else falls back to 'curious'.
 */
const express = require('express')
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

const ALLOWED_VIBES = new Set(['clean', 'concerning', 'beautiful', 'curious'])
const sanitizeVibe = v => ALLOWED_VIBES.has(v) ? v : 'curious'
const isFinitNum = v => typeof v === 'number' && isFinite(v)

// GET /api/map-stories — every story, newest first, joined to author display info
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT s.id, s.user_id, s.latitude, s.longitude, s.vibe, s.text,
              s.created_at, s.updated_at,
              u.display_name, u.username, u.avatar_emoji, u.avatar_bg_color
       FROM map_stories s
       JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC
       LIMIT 1000`,
      []
    )
    res.json({ stories: rows })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/map-stories — drop a new story pin
router.post('/', requireAuth, async (req, res) => {
  try {
    const lat  = parseFloat(req.body.latitude)
    const lng  = parseFloat(req.body.longitude)
    const vibe = sanitizeVibe(req.body.vibe)
    const text = String(req.body.text || '').trim().slice(0, 280)

    if (!isFinitNum(lat) || !isFinitNum(lng)) return res.status(400).json({ error: 'latitude/longitude required' })
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return res.status(400).json({ error: 'coordinates out of range' })
    if (!text) return res.status(400).json({ error: 'text required' })

    // Soft cap so a single user can't spam the layer
    const countRow = await db.get('SELECT COUNT(*) AS n FROM map_stories WHERE user_id=?', [req.user.id])
    if (countRow && Number(countRow.n) >= 200) {
      return res.status(400).json({ error: 'Story limit reached (200). Delete some old ones first.' })
    }

    const { lastInsertRowid } = await db.run(
      'INSERT INTO map_stories (user_id, latitude, longitude, vibe, text) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, lat, lng, vibe, text]
    )
    const created = await db.get(
      `SELECT s.id, s.user_id, s.latitude, s.longitude, s.vibe, s.text,
              s.created_at, s.updated_at,
              u.display_name, u.username, u.avatar_emoji, u.avatar_bg_color
       FROM map_stories s JOIN users u ON u.id=s.user_id
       WHERE s.id=?`,
      [lastInsertRowid]
    )
    res.status(201).json({ story: created })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/map-stories/:id — edit own vibe / text (coords are immutable)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const own = await db.get('SELECT id, user_id FROM map_stories WHERE id=?', [req.params.id])
    if (!own) return res.status(404).json({ error: 'Not found' })
    if (own.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Not your story' })

    const updates = []
    const vals = []
    if (req.body.vibe !== undefined) { updates.push('vibe=?'); vals.push(sanitizeVibe(req.body.vibe)) }
    if (req.body.text !== undefined) {
      const text = String(req.body.text).trim().slice(0, 280)
      if (!text) return res.status(400).json({ error: 'text required' })
      updates.push('text=?'); vals.push(text)
    }
    if (!updates.length) return res.status(400).json({ error: 'nothing to update' })

    updates.push(db.USE_PG ? "updated_at=NOW()" : "updated_at=datetime('now')")
    vals.push(req.params.id)
    await db.run(`UPDATE map_stories SET ${updates.join(',')} WHERE id=?`, vals)
    const updated = await db.get(
      `SELECT s.id, s.user_id, s.latitude, s.longitude, s.vibe, s.text,
              s.created_at, s.updated_at,
              u.display_name, u.username, u.avatar_emoji, u.avatar_bg_color
       FROM map_stories s JOIN users u ON u.id=s.user_id
       WHERE s.id=?`,
      [req.params.id]
    )
    res.json({ story: updated })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/map-stories/:id — owner OR admin
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const own = await db.get('SELECT user_id FROM map_stories WHERE id=?', [req.params.id])
    if (!own) return res.status(404).json({ error: 'Not found' })
    if (own.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Not your story' })
    await db.run('DELETE FROM map_stories WHERE id=?', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
