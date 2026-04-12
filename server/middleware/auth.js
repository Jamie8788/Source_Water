const jwt = require('jsonwebtoken')
const db = require('../db/connection')
const { createClient } = require('@supabase/supabase-js')

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  : null

const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token provided' })

  // Try Supabase JWT first
  if (supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (user && !error) {
        let localUser = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [user.email])
        if (!localUser) {
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
          localUser = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [user.email])
        }
        if (localUser) {
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
    const user = await db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', [decoded.id])
    if (!user) return res.status(401).json({ error: 'User not found' })
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

module.exports = { requireAuth, requireAdmin, requireResearcher, logActivity }
