const jwt = require('jsonwebtoken')
const db = require('../db/connection')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
)

const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token provided' })

  // Try Supabase JWT first
  if (process.env.SUPABASE_URL) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (user && !error) {
        // Look up or create local user record by email
        let localUser = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(user.email)
        if (!localUser) {
          // Auto-create local profile for Supabase auth users
          const username = user.email.split('@')[0].replace(/[^a-z0-9_]/gi, '') + '_' + Math.random().toString(36).slice(2, 6)
          const result = db.prepare(`
            INSERT OR IGNORE INTO users (username, email, password_hash, display_name, role, avatar_emoji, avatar_bg_color)
            VALUES (?, ?, 'supabase_auth', ?, 'Community member', '💧', '#3B82F6')
          `).run(username, user.email, user.user_metadata?.display_name || username)
          localUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)
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
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(decoded.id)
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
      db.prepare('INSERT INTO activity_log (user_id,action,target_type,target_id,details) VALUES (?,?,?,?,?)')
        .run(req.user.id, action, targetType, targetId, JSON.stringify({ method: req.method, path: req.path }))
    }
    return orig(body)
  }
  next()
}

module.exports = { requireAuth, requireAdmin, requireResearcher, logActivity }
