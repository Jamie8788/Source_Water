const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const { FEATURES, FEATURE_KEYS, ROLES } = require('../access/features')
const { accessMap, signalChange } = require('../access/store')

// Fire-and-forget audit write: who changed what, when. Never blocks the
// response (matches the app's logging pattern) and swallows its own errors so
// a logging glitch can never fail a save. For user targets we resolve the
// username cheaply so the audit view reads cleanly without a join.
function logAudit(req, { target_type, target, feature, allowed }) {
  ;(async () => {
    try {
      let target_name = null
      if (target_type === 'user') {
        const u = await db.get(
          'SELECT username, display_name FROM users WHERE CAST(id AS TEXT) = ?',
          [String(target)]
        ).catch(() => null)
        target_name = u ? (u.display_name || u.username) : null
      }
      await db.run(
        `INSERT INTO access_audit (admin_id, admin_name, target_type, target, target_name, feature, allowed)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          String(req.user?.id ?? ''),
          req.user?.display_name || req.user?.username || null,
          target_type, String(target), target_name, feature,
          allowed === null || allowed === undefined ? null : (allowed ? 1 : 0),
        ]
      )
    } catch (_) { /* non-fatal */ }
  })()
}

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

// GET /api/access/admin/users?search=&limit=&offset= — paginated, searchable
// user list for the per-user override tool. Scales to 1,000s of users because
// it filters and pages IN THE DATABASE (never ships the whole users table to
// the browser). Returns the total match count so the UI can paginate.
router.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.search || '').trim().toLowerCase()
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50)
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)

    let where = ''
    const args = []
    if (q) {
      // Match username / display name / email, case-insensitive.
      where = `WHERE LOWER(username) LIKE ? OR LOWER(COALESCE(display_name,'')) LIKE ? OR LOWER(COALESCE(email,'')) LIKE ?`
      const like = `%${q}%`
      args.push(like, like, like)
    }

    const countRow = await db.get(`SELECT COUNT(*) AS n FROM users ${where}`, args)
    const total = Number(countRow?.n || 0)

    const rows = await db.all(
      `SELECT id, username, display_name, email, role, is_admin
       FROM users ${where}
       ORDER BY LOWER(COALESCE(display_name, username)) ASC
       LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    )
    res.json({ users: rows, total, limit, offset })
  } catch (e) {
    console.error('[access/admin/users]', e.message)
    res.status(500).json({ error: 'Could not search users.' })
  }
})

// GET /api/access/admin/audit?limit= — recent access changes (who/what/when).
router.get('/admin/audit', requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200)
    const rows = await db.all(
      `SELECT id, admin_id, admin_name, target_type, target, target_name, feature, allowed, created_at
       FROM access_audit ORDER BY id DESC LIMIT ?`,
      [limit]
    )
    res.json({ audit: rows })
  } catch (e) {
    console.error('[access/admin/audit]', e.message)
    res.status(500).json({ error: 'Could not load audit log.' })
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
    await signalChange()
    logAudit(req, { target_type: 'role', target: role, feature, allowed })
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
    await signalChange()
    logAudit(req, { target_type: 'user', target: user_id, feature, allowed })
    res.json({ ok: true })
  } catch (e) { console.error('[access/user]', e.message); res.status(500).json({ error: 'save failed' }) }
})

module.exports = router
