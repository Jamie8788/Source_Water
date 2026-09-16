const jwt = require('jsonwebtoken')
const db = require('../db/connection')
const { createClient } = require('@supabase/supabase-js')

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  : null

const requireAuth = async (req, res, next) => {
  // Idempotent: if an earlier middleware (e.g. requireFeature) already
  // authenticated this request, don't re-verify the token. This keeps a
  // mount-level feature gate + a route-level requireAuth to ONE auth pass,
  // so gating never doubles the Supabase/JWT cost per request.
  if (req.user) return next()
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token provided' })

  // Try Supabase JWT first
  if (supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (user && !error) {
        let localUser = await db.get('SELECT * FROM users WHERE email = ?', [user.email])
        if (!localUser) {
          // Check banned email list before auto-creating
          const banned = await db.get('SELECT 1 FROM banned_emails WHERE email = ?', [user.email]).catch(() => null)
          if (banned) return res.status(403).json({ error: 'Account suspended' })
          // Use the real username from Supabase metadata if available (set during signUp)
          const metaUsername = user.user_metadata?.username
          const base = user.email.split('@')[0].replace(/[^a-z0-9_]/gi, '')
          const suffix = Math.random().toString(36).slice(2, 6)
          const username = (metaUsername && metaUsername.length >= 3) ? metaUsername : `${base}_${suffix}`
          const displayName = user.user_metadata?.display_name || username
          await db.run(
            `INSERT INTO users (username, email, password_hash, display_name, role, avatar_emoji, avatar_bg_color) VALUES (?, ?, 'supabase_auth', ?, 'Community member', '💧', '#3B82F6') ON CONFLICT DO NOTHING`,
            [username, user.email, displayName]
          )
          localUser = await db.get('SELECT * FROM users WHERE email = ?', [user.email])
        }
        if (localUser) {
          if (!localUser.is_active) return res.status(403).json({ error: 'Account suspended' })
          req.user = localUser
          req.supabaseUser = user
          return next()
        }
      }
    } catch (_) {}
  }

  // Fallback: legacy JWT
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id])
    if (!user) return res.status(401).json({ error: 'User not found' })
    if (!user.is_active) return res.status(403).json({ error: 'Account suspended' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

const requireAdmin = (req, res, next) => {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' })
  next()
}

const requireResearcher = (req, res, next) => {
  const allowed = ['Researcher', 'SOURCE Water team member']
  if (!allowed.includes(req.user?.role) && !req.user?.is_admin) {
    return res.status(403).json({ error: 'Researcher access required' })
  }
  next()
}

// requireFeature(key): hard server-side enforcement for a feature tab. The
// client already hides disabled tabs, but this stops a denied user from
// reaching the tab's API directly. It authenticates first (populating
// req.user, which a later requireAuth then reuses for free), then blocks with
// 403 only when the access resolver says this non-admin user is denied. Opt-out
// model means the common case (no rule set) passes through untouched, and any
// resolver error fails OPEN so a glitch never locks the app.
const { canAccess } = require('../access/store')
const requireFeature = (key) => (req, res, next) => {
  requireAuth(req, res, async () => {
    try {
      if (await canAccess(req.user, key)) return next()
      return res.status(403).json({ error: 'This feature is not available for your account.', feature: key })
    } catch (_) {
      return next() // fail open
    }
  })
}

const logActivity = (action, targetType) => (req, res, next) => {
  const orig = res.json.bind(res)
  res.json = (body) => {
    if (res.statusCode < 400 && req.user) {
      const targetId = body?.id || req.params?.id || null
      db.run('INSERT INTO activity_log (user_id,action,target_type,target_id,details) VALUES (?,?,?,?,?)',
        [req.user.id, action, targetType, targetId, JSON.stringify({ method: req.method, path: req.path })]
      ).catch(() => {})
    }
    return orig(body)
  }
  next()
}

module.exports = { requireAuth, requireAdmin, requireResearcher, requireFeature, logActivity }
