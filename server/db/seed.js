const db = require('./connection')

/**
 * Seed: minimal idempotent setup. Does NOT auto-create or auto-promote
 * any admin account. Bootstrap an admin via:
 *   - Supabase Dashboard → Authentication (create user, sign in via app)
 *   - Then either: existing admin promotes via Admin Panel → Users,
 *     OR hit POST /api/auth/bootstrap-admin while no admin exists yet.
 *
 * Previous versions seeded a default 'admin' / 'nordik2026' account and
 * re-granted is_admin/is_active to specific emails on every boot. Both
 * were removed for security: the seeded password leaked, and the auto-
 * re-grant meant suspending or demoting an admin via the dashboard
 * silently reverted on the next deploy.
 */
async function seed() {
  // No-op by default. Keep the function so callers don't break.
  // If you ever need to bootstrap a brand-new install, do it manually
  // via the Admin Panel or the bootstrap-admin endpoint.
  console.log('[seed] no-op (admin bootstrap is now manual via Admin Panel)')
}

module.exports = { seed }
