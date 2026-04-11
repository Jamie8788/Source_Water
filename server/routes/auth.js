const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const db = require('../db/connection')

const limiter = rateLimit({ windowMs: 60000, max: 10, message: { error: 'Too many attempts, try again later.' } })

const makeToken = (user) => jwt.sign(
  { id: user.id, username: user.username, is_admin: user.is_admin },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
)

const safeUser = (u) => {
  const { password_hash, ...safe } = u
  return safe
}

// POST /api/auth/register
router.post('/register', limiter, async (req, res) => {
  try {
    const { username, password, display_name, role, avatar_emoji, avatar_bg_color, email } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
    if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username])
    if (existing) return res.status(409).json({ error: 'Username already taken' })

    const hash = await bcrypt.hash(password, 10)
    const isAdmin = role === 'SOURCE Water team member'

    const { lastInsertRowid } = await db.run(`
      INSERT INTO users (username, email, password_hash, display_name, role, avatar_emoji, avatar_bg_color, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [username, email || null, hash, display_name || username, role || 'Community member',
      avatar_emoji || '💧', avatar_bg_color || '#3B82F6', isAdmin ? 1 : 0])

    const user = await db.get('SELECT * FROM users WHERE id = ?', [lastInsertRowid])
    await db.run('INSERT INTO activity_log (user_id,action,target_type,details) VALUES (?,?,?,?)',
      [user.id, 'registered', 'user', `New user: ${username}`])
    await db.run('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)',
      [user.id, 5, 'joined', new Date().toISOString().slice(0, 7)])

    res.json({ token: makeToken(user), user: safeUser(user) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/auth/login
router.post('/login', limiter, async (req, res) => {
  try {
    const { username, password, identifier } = req.body
    const login = identifier || username
    if (!login || !password) return res.status(400).json({ error: 'Credentials required' })

    const user = await db.get('SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1', [login, login])
    if (!user) return res.status(401).json({ error: 'Invalid username or password' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' })

    await db.run("UPDATE users SET last_login = NOW() WHERE id = ?", [user.id])
    await db.run('INSERT INTO activity_log (user_id,action,target_type,details) VALUES (?,?,?,?)',
      [user.id, 'login', 'user', 'User logged in'])

    res.json({ token: makeToken(user), user: safeUser(user) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id])
    if (!user) return res.status(401).json({ error: 'User not found' })
    res.json(safeUser(user))
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

// GET /api/auth/check-username
router.get('/check-username', async (req, res) => {
  const { username } = req.query
  if (!username) return res.json({ available: false })
  const existing = await db.get('SELECT id FROM users WHERE username = ?', [username])
  res.json({ available: !existing })
})

module.exports = router
