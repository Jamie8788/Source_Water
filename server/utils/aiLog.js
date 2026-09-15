// ── aiLog: record what users ask our AI, without ever slowing a response ────
//
// logAiPrompt() is FIRE-AND-FORGET: it kicks off the DB insert and returns
// immediately, so the request handler never awaits it and the user's answer is
// never delayed by logging. Any failure is swallowed (logging must never break
// the AI feature). One small indexed INSERT per question — negligible load.
//
// Stored per prompt: which user, which tab/endpoint (source), the question
// text (truncated), which provider answered, whether it succeeded, and any
// site context. Used for product analytics — the common questions, which tabs
// drive AI use, and which provider is carrying the load.
const db = require('../db/connection')

function logAiPrompt({ userId = null, source, prompt, provider = null, ok = true, site = null }) {
  const text = String(prompt == null ? '' : prompt).slice(0, 4000) // cap row size
  // Detach from the request: schedule the write, don't await it.
  Promise.resolve()
    .then(() => db.run(
      `INSERT INTO ai_prompts (user_id, source, prompt, provider, ok, site)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId == null ? null : String(userId), source || null, text, provider, ok ? 1 : 0, site]
    ))
    .catch(e => console.error('[aiLog] insert failed (non-fatal):', e.message))
}

module.exports = { logAiPrompt }
