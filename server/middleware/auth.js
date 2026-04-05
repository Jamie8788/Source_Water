const jwt = require('jsonwebtoken')
const db = require('../db/connection')

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token provided' })
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
