/**
 * Async database abstraction — SQLite locally, PostgreSQL (Supabase) in production.
 * All methods return Promises so routes work the same in both modes.
 *
 * Usage:
 *   const db = require('./db')
 *   const user = await db.get('SELECT * FROM users WHERE id=?', [id])
 *   const posts = await db.all('SELECT * FROM posts WHERE user_id=?', [userId])
 *   const { lastInsertRowid } = await db.run('INSERT INTO posts (content) VALUES (?)', [content])
 */

const USE_PG = !!process.env.DATABASE_URL

// ── PostgreSQL mode ──────────────────────────────────────────────────────────
let pool
if (USE_PG) {
  const { Pool } = require('pg')
  // If DB_PASSWORD is set separately, inject it into the URL so special chars don't break parsing
  let connString = process.env.DATABASE_URL
  if (process.env.DB_PASSWORD) {
    try {
      const u = new URL(connString)
      u.password = process.env.DB_PASSWORD
      connString = u.toString()
    } catch {}
  }
  pool = new Pool({
    connectionString: connString,
    ssl: connString.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })
  pool.on('error', (err) => console.error('[pg] pool error:', err.message))
  console.log('[db] PostgreSQL mode (Supabase)')
}

// ── SQLite mode ───────────────────────────────────────────────────────────────
let sqliteDb
if (!USE_PG) {
  const Database = require('better-sqlite3')
  const path = require('path')
  const fs = require('fs')
  const dataDir = path.join(__dirname, '..', 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'source-water.db')
  sqliteDb = new Database(dbPath)
  sqliteDb.pragma('journal_mode = WAL')
  sqliteDb.pragma('synchronous = NORMAL')
  sqliteDb.pragma('cache_size = 10000')
  sqliteDb.pragma('foreign_keys = ON')
  sqliteDb.pragma('temp_store = MEMORY')
  console.log('[db] SQLite mode (local dev)')
}

// ── SQL conversion: SQLite dialect → PostgreSQL ──────────────────────────────
function pgify(sql) {
  // INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
  const hasOrIgnore = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql)
  sql = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')

  // datetime('now', '-N unit') → NOW() - INTERVAL 'N units'
  sql = sql.replace(
    /datetime\s*\(\s*'now'\s*,\s*'([+-]?\d+)\s+(minute|day|hour|week|month)s?'\s*\)/gi,
    (_, n, unit) => {
      const num = parseInt(n)
      const op = num >= 0 ? '+' : '-'
      return `NOW() ${op} INTERVAL '${Math.abs(num)} ${unit}s'`
    }
  )
  sql = sql.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()')
  sql = sql.replace(/date\s*\(\s*'now'\s*\)/gi, 'CURRENT_DATE')
  // date(col) = date('now') → col::date = CURRENT_DATE
  sql = sql.replace(/date\s*\(([^)]+)\)\s*=\s*date\s*\(\s*'now'\s*\)/gi, '$1::date = CURRENT_DATE')

  // Boolean columns: SQLite uses 0/1, PostgreSQL may use BOOLEAN type
  // Convert = 0 / = 1 to = false / = true for known boolean-like column names
  // so queries work regardless of whether the column is BOOLEAN or INTEGER
  const boolCols = 'is_read|read|deleted|edited|pinned|passed|visible|active|is_admin|is_active|onboarding_completed|shuffle_questions|shuffle_answers|show_answers_after|certificate_enabled|secchi_bottom_visible|is_archived'
  sql = sql.replace(new RegExp(`\\b(${boolCols})\\s*=\\s*0\\b`, 'gi'), '$1 = false')
  sql = sql.replace(new RegExp(`\\b(${boolCols})\\s*=\\s*1\\b`, 'gi'), '$1 = true')

  // ? → $1, $2, ...
  let i = 0
  sql = sql.replace(/\?/g, () => `$${++i}`)

  // Append ON CONFLICT DO NOTHING for INSERT OR IGNORE
  if (hasOrIgnore) sql = sql.trimEnd().replace(/;?\s*$/, '') + ' ON CONFLICT DO NOTHING'

  return sql
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return a single row or null.
 * @param {string} sql
 * @param {Array}  params
 */
async function get(sql, params = []) {
  if (!USE_PG) {
    return Promise.resolve(sqliteDb.prepare(sql).get(...params) ?? null)
  }
  const { rows } = await pool.query(pgify(sql), params)
  return rows[0] ?? null
}

/**
 * Return all matching rows as an array.
 * @param {string} sql
 * @param {Array}  params
 */
async function all(sql, params = []) {
  if (!USE_PG) {
    return Promise.resolve(sqliteDb.prepare(sql).all(...params))
  }
  const { rows } = await pool.query(pgify(sql), params)
  return rows
}

/**
 * Execute a write (INSERT / UPDATE / DELETE).
 * Returns { lastInsertRowid, changes }.
 * For INSERT statements, automatically appends RETURNING id unless already present.
 * @param {string} sql
 * @param {Array}  params
 */
async function run(sql, params = []) {
  if (!USE_PG) {
    const r = sqliteDb.prepare(sql).run(...params)
    return Promise.resolve({ lastInsertRowid: r.lastInsertRowid, changes: r.changes })
  }
  const pgSql = pgify(sql)
  const isInsert = /^\s*INSERT/i.test(sql)
  const alreadyReturning = /RETURNING/i.test(pgSql)
  const hasConflictIgnore = /ON CONFLICT DO NOTHING/i.test(pgSql)
  // Don't append RETURNING id for ON CONFLICT DO NOTHING — no row may be inserted
  const finalSql = isInsert && !alreadyReturning && !hasConflictIgnore ? pgSql + ' RETURNING id' : pgSql
  const { rows, rowCount } = await pool.query(finalSql, params)
  return { lastInsertRowid: rows[0]?.id ?? null, changes: rowCount }
}

/**
 * Execute arbitrary SQL (for schema setup, multi-statement).
 * @param {string} sql
 */
async function exec(sql) {
  if (!USE_PG) {
    sqliteDb.exec(sql)
    return Promise.resolve()
  }
  // pg doesn't support multi-statement in one call — split on semicolons
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    await pool.query(stmt)
  }
}

module.exports = { get, all, run, exec, pool, sqlite: sqliteDb ?? null, USE_PG }
