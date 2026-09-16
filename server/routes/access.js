const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const { FEATURES, FEATURE_KEYS, ROLES } = require('../access/features')
const { accessMap, invalidate } = require('../access/store')

// GET /api/access/me — the current user's feature→allowed map. The client
// calls this once on load (and after login) to know which tabs to show.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const features = await accessMap(req.user)
    res.json({ features, isAdmin: !!req.user.is_admin, role: req.user.role || null })
  } catch (e) {
    console.error('[access/me]', e.message)
    // Fail OPEN (everything visible) so a glitch never locks users out.
    const all = {}; FEATURES.forEach(f => { all[f.key] = true })
    res.json({ features: all, isAdmin: !!req.user?.is_admin, role: req.user?.role || null })
  }
})

// ── Admin management ────────────────────────────────────────────────────────
// GET /api/access/admin — the feature list, all role defaults, and all
// per-user overrides (joined to usernames) for the admin matrix UI.
router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rules, overrides] = await Promise.all([
      db.all('SELECT role, feature, allowed FROM access_rules', []),
      db.all(`SELECT o.user_id, o.feature, o.allowed, u.username, u.display_name, u.role
              FROM access_overrides o LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id`, []),
    ])
    res.json({ features: FEATURES, roles: ROLES, rules, overrides })
  } catch (e) {
    console.error('[access/admin]', e.message)
    res.status(500).json({ error: 'Could not load access rules.' })
  }
})

// PUT /api/access/admin/role  { role, feature, allowed }
router.put('/admin/role', requireAuth, requireAdmin, async (req, res) => {
  const { role, feature, allowed } = req.body || {}
  if (!ROLES.includes(role) || !FEATURE_KEYS.has(feature)) return res.status(400).json({ error: 'bad role/feature' })
  try {
    await db.get(
      `INSERT INTO access_rules (role, feature, allowed) VALUES (?, ?, ?)
       ON CONFLICT (role, feature) DO UPDATE SET allowed = ?
       RETURNING role`,
      [role, feature, allowed ? 1 : 0, allowed ? 1 : 0]
    )
    invalidate()
    res.json({ ok: true })
  } catch (e) { console.error('[access/role]', e.message); res.status(500).json({ error: 'save failed' }) }
})

// PUT /api/access/admin/user  { user_id, feature, allowed|null }
// allowed === null clears the override (falls back to the role default).
router.put('/admin/user', requireAuth, requireAdmin, async (req, res) => {
  const { user_id, feature, allowed } = req.body || {}
  if (!user_id || !FEATURE_KEYS.has(feature)) return res.status(400).json({ error: 'bad user/feature' })
  try {
    if (allowed === null || allowed === undefined) {
      await db.run('DELETE FROM access_overrides WHERE user_id = ? AND feature = ?', [String(user_id), feature])
    } else {
      await db.get(
        `INSERT INTO access_overrides (user_id, feature, allowed) VALUES (?, ?, ?)
         ON CONFLICT (user_id, feature) DO UPDATE SET allowed = ?
         RETURNING user_id`,
        [String(user_id), feature, allowed ? 1 : 0, allowed ? 1 : 0]
      )
    }
    invalidate()
    res.json({ ok: true })
  } catch (e) { console.error('[access/user]', e.message); res.status(500).json({ error: 'save failed' }) }
})

module.exports = router
