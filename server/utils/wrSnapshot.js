/**
 * Durable copy of the Water Rangers bulk lists (locations, datasets,
 * organizations), kept in our own database.
 *
 * Why this exists: in Oct 2026 Water Rangers asked us to stop re-walking their
 * full locations list ~20 times a day (~67k calls/month). Our cache lived only
 * in server memory, expired every hour, and was wiped on every deploy/restart,
 * so each of those triggered a fresh ~95-page walk. Now we keep ONE copy here,
 * refresh it at most once a day, and on boot reload it from this table instead
 * of from Water Rangers.
 *
 * Stored gzip + base64 in a tiny key/value table, so the ~10 MB locations list
 * is ~1 MB at rest (small DB footprint and egress). On Postgres, row-level
 * security is enabled with NO policies, so the table is invisible to the public
 * Supabase API — only the backend (the table owner) can read or write it.
 * Works the same in local SQLite mode and on any future host (no Redis).
 */
const zlib = require('zlib')
const { promisify } = require('util')
const db = require('../db/connection')

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

let ready = null
function ensureTable() {
  if (ready) return ready
  ready = (async () => {
    const ddl = `CREATE TABLE IF NOT EXISTS wr_snapshots (
      key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      fetched_at BIGINT NOT NULL
    )`
    if (db.USE_PG) {
      await db.pool.query(ddl)
      await db.pool.query('ALTER TABLE wr_snapshots ENABLE ROW LEVEL SECURITY')
    } else {
      db.sqlite.exec(ddl)
    }
  })().catch(e => { ready = null; throw e })
  return ready
}

// Returns { data, ts } or null. Never throws — a missing/broken snapshot just
// means we fall back to fetching from Water Rangers as before.
async function loadSnapshot(key) {
  try {
    await ensureTable()
    const row = db.USE_PG
      ? (await db.pool.query('SELECT payload, fetched_at FROM wr_snapshots WHERE key = $1', [key])).rows[0]
      : db.sqlite.prepare('SELECT payload, fetched_at FROM wr_snapshots WHERE key = ?').get(key)
    if (!row) return null
    const data = JSON.parse((await gunzip(Buffer.from(row.payload, 'base64'))).toString('utf8'))
    if (!Array.isArray(data) || !data.length) return null
    return { data, ts: Number(row.fetched_at) }
  } catch (e) {
    console.error(`[WR] snapshot load "${key}" failed:`, e.message)
    return null
  }
}

// Fire-and-forget from callers. Never stores an empty list.
async function saveSnapshot(key, data, ts = Date.now()) {
  if (!Array.isArray(data) || !data.length) return
  try {
    await ensureTable()
    const payload = (await gzip(Buffer.from(JSON.stringify(data)))).toString('base64')
    if (db.USE_PG) {
      await db.pool.query(
        `INSERT INTO wr_snapshots (key, payload, fetched_at) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`,
        [key, payload, ts])
    } else {
      db.sqlite.prepare(
        `INSERT INTO wr_snapshots (key, payload, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`
      ).run(key, payload, ts)
    }
    console.log(`[WR] snapshot "${key}" saved: ${data.length} items, ${(payload.length / 1024).toFixed(0)} KB`)
  } catch (e) {
    console.error(`[WR] snapshot save "${key}" failed:`, e.message)
  }
}

module.exports = { loadSnapshot, saveSnapshot }
