require('dotenv').config({ path: require('path').join(__dirname, '.env') })
console.log('[startup] Cloudinary cloud_name:', process.env.CLOUDINARY_CLOUD_NAME || '❌ NOT SET')
console.log('[startup] Cloudinary api_key:', process.env.CLOUDINARY_API_KEY ? '✓' : '❌ NOT SET')
console.log('[startup] Cloudinary api_secret:', process.env.CLOUDINARY_API_SECRET ? '✓' : '❌ NOT SET')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const morgan = require('morgan')
const path = require('path')
const fs = require('fs')
const { createProxyMiddleware } = require('http-proxy-middleware')
const http = require('http')

const { initSchema } = require('./db/schema')
const { seed } = require('./db/seed')
const ChatService = require('./services/chat')

// Keep the process alive when a single request fails (e.g. transient pool errors)
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason?.message || reason)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err?.message || err)
})

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 3001
const ANALYSIS_URL = process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8001'

// Init DB (async — schema runs before requests are served)
initSchema().then(() => seed().catch(console.error)).catch(err => {
  console.error('[schema] FATAL: could not initialize database:', err.message)
  process.exit(1)
})

// Initialize WebSocket Chat Service
const chatService = new ChatService(server)

// Trust Render's reverse proxy so rate-limiting uses real client IPs
app.set('trust proxy', 1)

// Gzip every response. The map's /api/wr/locations-all payload is ~10 MB of
// JSON; gzip shrinks it ~6-8x on the wire (to ~1.5 MB), which is the single
// biggest win for how fast the map appears. Cheap CPU, big transfer saving.
app.use(compression())

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,   // allow iframes without CORP headers (nullschool, windy, maps)
  contentSecurityPolicy: false,        // disable CSP — app relies on frame-src from embedded sites
}))
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

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Serve uploads — respect UPLOAD_DIR env var (set in production/Docker)
const uploadsDir = (process.env.UPLOAD_DIR && path.isAbsolute(process.env.UPLOAD_DIR))
  ? process.env.UPLOAD_DIR
  : path.join(__dirname, '..', 'uploads')
const uploadsDir2 = path.join(__dirname, 'uploads') // legacy fallback
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))
if (uploadsDir2 !== uploadsDir && fs.existsSync(uploadsDir2)) {
  app.use('/uploads', express.static(uploadsDir2))
}

// API Routes
app.use('/api/auth',        require('./routes/auth'))
app.use('/api/users',       require('./routes/users'))
app.use('/api/posts',       require('./routes/posts'))
app.use('/api/messages',    require('./routes/messages'))
app.use('/api/quizzes',     require('./routes/quizzes'))
app.use('/api/sites',       require('./routes/sites'))
app.use('/api/ai',          require('./routes/ai'))
app.use('/api/import',      require('./routes/import'))
app.use('/api/resources',   require('./routes/resources'))
app.use('/api/projects',    require('./routes/projects'))
app.use('/api/leaderboard', require('./routes/leaderboard'))
app.use('/api/admin',       require('./routes/admin'))
app.use('/api/sponsors',    require('./routes/sponsors'))
app.use('/api/cms',         require('./routes/cms'))
app.use('/api/research',    require('./routes/research'))
app.use('/api/upload',         require('./routes/upload'))
app.use('/api/notifications', require('./routes/notifications'))
app.use('/api/geoai',          require('./routes/geoai'))  // 🌍 GeoAI — isolated microservice
app.use('/api/wr',             require('./routes/waterrangers'))  // Water Rangers API proxy
app.use('/api/alert-watches',  require('./routes/alert-watches')) // user-defined threshold rules
app.use('/api/waypoints',      require('./routes/waypoints'))     // per-user field pins on the map
app.use('/api/map-stories',    require('./routes/mapStories'))    // shared community-context layer on the map

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }))

// Street view proxy — bypasses CORS for KartaView
app.get('/api/streetview', async (req, res) => {
  try {
    const { lat, lon } = req.query
    const r = await fetch(`https://api.kartaview.org/2.0/photo/nearby-photos/?lat=${lat}&lng=${lon}&count=40&page=1`)
    const data = await r.json()
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: 'Street view proxy failed' })
  }
})

// Communities
const db = require('./db/connection')
app.get('/api/communities', async (_req, res) => res.json(await db.all('SELECT * FROM communities ORDER BY name', [])))

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

server.listen(PORT, () => {
  console.log(`\n🌊 SOURCE Water API running on http://localhost:${PORT}\n`)
  console.log(`📡 WebSocket Chat Service running on http://localhost:${PORT}\n`)

  // Keep analysis service awake on Render free tier (pings every 9 min)
  if (ANALYSIS_URL && !ANALYSIS_URL.includes('localhost')) {
    const pingAnalysis = () => {
      fetch(`${ANALYSIS_URL}/health`, { signal: AbortSignal.timeout(10000) })
        .then(() => console.log('[keep-alive] analysis service pinged'))
        .catch(e => console.log(`[keep-alive] analysis ping failed: ${e.message}`))
    }
    setTimeout(pingAnalysis, 60000)           // first ping after 1 min
    setInterval(pingAnalysis, 9 * 60 * 1000)  // then every 9 min
    console.log(`[keep-alive] will ping analysis service at ${ANALYSIS_URL}`)
  }
})
