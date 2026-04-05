const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'source-water.db')
const db = new Database(dbPath)

// Performance pragmas for 10k users
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('cache_size = 10000')
db.pragma('foreign_keys = ON')
db.pragma('temp_store = MEMORY')

module.exports = db
