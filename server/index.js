require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const path = require('path')
const fs = require('fs')
const { createProxyMiddleware } = require('http-proxy-middleware')

const { initSchema } = require('./db/schema')
const { seed } = require('./db/seed')

const app = express()
const PORT = process.env.PORT || 3001
const ANALYSIS_URL = process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8001'

// Init DB
initSchema()
seed().catch(console.error)

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: true, credentials: true }))
app.use(morgan('dev'))

// ── ML/Analysis proxy — BEFORE body parsers so file uploads stream correctly ──
app.use('/ml', createProxyMiddleware({
  target: ANALYSIS_URL,
  changeOrigin: true,
  pathRewrite: { '^/ml': '' },
  on: {
    error: (err, req, res) => {
      console.error('ML proxy error:', err.message)
      res.status(502).json({ error: 'Analysis service unavailable. Please try again shortly.' })
    },
  },
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve uploads
const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

// API Routes
app.use('/api/auth',        require('./routes/auth'))
app.use('/api/users',       require('./routes/users'))
app.use('/api/posts',       require('./routes/posts'))
app.use('/api/messages',    require('./routes/messages'))
app.use('/api/quizzes',     require('./routes/quizzes'))
app.use('/api/sites',       require('./routes/sites'))
app.use('/api/ai',          require('./routes/ai'))
app.use('/api/resources',   require('./routes/resources'))
app.use('/api/projects',    require('./routes/projects'))
app.use('/api/leaderboard', require('./routes/leaderboard'))
app.use('/api/admin',       require('./routes/admin'))
app.use('/api/cms',         require('./routes/cms'))

// Communities
const db = require('./db/connection')
app.get('/api/communities', (req, res) => res.json(db.prepare('SELECT * FROM communities ORDER BY name').all()))

// Serve React build in production
const clientBuild = path.join(__dirname, '..', 'client', 'dist')
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild))
  app.get('*', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')))
}

app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => console.log(`\n🌊 SOURCE Water API running on http://localhost:${PORT}\n`))
