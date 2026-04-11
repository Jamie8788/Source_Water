/**
 * Backward-compat shim — re-exports the async db helpers.
 * All routes `require('../db/connection')` and use `await db.get/all/run(...)`.
 * In PostgreSQL mode (DATABASE_URL set): talks to Supabase.
 * In SQLite mode (local dev): talks to local .db file.
 */
module.exports = require('./db')
