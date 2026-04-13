const bcrypt = require('bcryptjs')
const db = require('./connection')

async function seed() {
  // Always ensure admin exists and is active
  const adminExists = await db.get('SELECT id FROM users WHERE username = ?', ['admin'])
  if (!adminExists) {
    const hash = bcrypt.hashSync('nordik2026', 10)
    await db.run(
      `INSERT INTO users (username,email,password_hash,display_name,role,avatar_emoji,avatar_bg_color,is_admin,is_active,onboarding_completed)
       VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
      ['admin','info@nordikinstitute.com',hash,'SOURCE Water Admin','SOURCE Water team member','🌊','#0ea5e9',1,1,1])
    console.log('✅ Admin user created: admin / nordik2026')
  } else {
    // Always ensure admin stays active and has admin privileges
    await db.run(
      `UPDATE users SET is_active=1, is_admin=1, onboarding_completed=1 WHERE username='admin'`)
    console.log('✅ Admin user verified/restored')
  }

  // Also reactivate the Supabase-linked admin account (admin@sourcewater.app)
  await db.run(
    `UPDATE users SET is_active=1, is_admin=1, onboarding_completed=1 WHERE email='admin@sourcewater.app'`)

  // Remove admin emails from banned list in case of accidental self-deletion
  await db.run(
    `DELETE FROM banned_emails WHERE email IN ('info@nordikinstitute.com','admin@sourcewater.app','admin')`
  ).catch(() => {})

  // Reactivate ALL users
  await db.run(`UPDATE users SET is_active=1 WHERE is_active=0`).catch(() => {})

  const existing = await db.get('SELECT COUNT(*) as c FROM users', [])
  if (parseInt(existing?.c ?? 0) > 1) return console.log('✅ Database already initialized')

  console.log('[seed] ✅ Production database ready - admin only, awaiting real data import')
}

module.exports = { seed }
