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

    const hash = await bcrypt.hash(password, 10)
    const isAdmin = role === 'SOURCE Water team member'

    // If a row already exists for this email (auto-created by Supabase JWT on /auth/me
    // or onAuthStateChange), update it with the real username/password — no duplicate.
    const existingByEmail = email ? await db.get('SELECT id FROM users WHERE email = ?', [email]) : null
    if (existingByEmail) {
      const usernameTaken = await db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, existingByEmail.id])
      if (usernameTaken) return res.status(409).json({ error: 'Username already taken' })
      await db.run(
        `UPDATE users SET username=?, password_hash=?, display_name=?, role=?, avatar_emoji=?, avatar_bg_color=?, is_admin=? WHERE id=?`,
        [username, hash, display_name || username, role || 'Community member',
          avatar_emoji || '💧', avatar_bg_color || '#3B82F6', isAdmin ? 1 : 0, existingByEmail.id]
      )
      const user = await db.get('SELECT * FROM users WHERE id = ?', [existingByEmail.id])
      return res.json({ token: makeToken(user), user: safeUser(user) })
    }

    // Fresh registration — no existing row
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username])
    if (existing) return res.status(409).json({ error: 'Username already taken' })

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

  // Try Supabase JWT first (used by frontend after Supabase login)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      const { createClient } = require('@supabase/supabase-js')
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
      const { data: { user: sbUser }, error } = await sb.auth.getUser(token)
      if (sbUser && !error) {
        let localUser = await db.get('SELECT * FROM users WHERE email = ?', [sbUser.email])
        if (!localUser) {
          const metaUsername = sbUser.user_metadata?.username
          const base = sbUser.email.split('@')[0].replace(/[^a-z0-9_]/gi, '')
          const suffix = Math.random().toString(36).slice(2, 6)
          const username = (metaUsername && metaUsername.length >= 3) ? metaUsername : `${base}_${suffix}`
          const displayName = sbUser.user_metadata?.display_name || username
          await db.run(
            `INSERT INTO users (username, email, password_hash, display_name, role, avatar_emoji, avatar_bg_color) VALUES (?, ?, 'supabase_auth', ?, 'Community member', '💧', '#3B82F6') ON CONFLICT DO NOTHING`,
            [username, sbUser.email, displayName]
          )
          localUser = await db.get('SELECT * FROM users WHERE email = ?', [sbUser.email])
        }
        if (localUser) {
          if (!localUser.is_active) return res.status(403).json({ error: 'Account suspended' })
          return res.json(safeUser(localUser))
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

// GET /api/auth/admin-exists
// Public, cheap — used by the sidebar to decide whether to show "Claim Admin"
router.get('/admin-exists', async (_req, res) => {
  try {
    const row = await db.get(
      `SELECT 1 AS x FROM users WHERE (role='admin' OR is_admin=1) AND is_active=1 LIMIT 1`, [])
    res.json({ exists: !!row })
  } catch (err) {
    res.json({ exists: true }) // fail closed — hide the button on error
  }
})

// POST /api/auth/bootstrap-admin
// Promotes the calling user to admin IF no admin exists yet (first-run safety net)
router.post('/bootstrap-admin', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  // Verify token and get local user
  let localUser = null
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      const { createClient } = require('@supabase/supabase-js')
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
      const { data: { user: sbUser }, error } = await sb.auth.getUser(token)
      if (sbUser && !error) localUser = await db.get('SELECT * FROM users WHERE email = ?', [sbUser.email])
    } catch (_) {}
  }
  if (!localUser) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      localUser = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id])
    } catch (_) {}
  }
  if (!localUser) return res.status(401).json({ error: 'Could not verify identity' })

  // Allow if: no other real admin exists, OR this user is the earliest user (id = MIN), OR username contains 'admin'
  const otherAdmin = await db.get(`SELECT id FROM users WHERE is_admin=1 AND id != ?`, [localUser.id])
  const firstUser  = await db.get(`SELECT id FROM users ORDER BY id ASC LIMIT 1`)
  const isFirstUser = firstUser?.id === localUser.id
  const isAdminUsername = (localUser.username || '').toLowerCase().includes('admin')

  if (otherAdmin && !isFirstUser && !isAdminUsername) {
    return res.status(403).json({ error: 'An admin already exists. Ask them to promote you via Admin Panel → Users, or run: UPDATE users SET is_admin=1 WHERE username=\'' + localUser.username + '\' in Supabase SQL editor.' })
  }

  await db.run('UPDATE users SET is_admin=1, is_active=1, role=? WHERE id=?', ['SOURCE Water team member', localUser.id])
  const updated = await db.get('SELECT * FROM users WHERE id=?', [localUser.id])
  res.json({ success: true, message: 'You are now admin. Page will reload.', user: safeUser(updated) })
})

module.exports = router
