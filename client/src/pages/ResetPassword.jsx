/**
 * ResetPassword — the page the Supabase password-reset email link lands on.
 *
 * Flow: user clicks "Forgot password?" on the Landing page → Supabase Auth
 * emails a secure, single-use, expiring link that points here with a recovery
 * token in the URL. The Supabase client (detectSessionInUrl: true, set in
 * lib/supabase.js) consumes that token on load and establishes a short-lived
 * recovery session. This page then lets the user set a new password via
 * supabase.auth.updateUser({ password }) — we never see or store the password,
 * and no service-role key is involved.
 *
 * Standalone (not inside the app Layout) so it works before the user is
 * "really" logged in and never depends on protected app state.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Droplets, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)     // recovery session detected?
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // Detect the recovery session that Supabase creates from the link's token.
  useEffect(() => {
    let cancelled = false
    // onAuthStateChange fires PASSWORD_RECOVERY (or INITIAL_SESSION with a
    // session) once the token in the URL is consumed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || session) { setReady(true); setChecking(false) }
    })
    // Also check immediately in case the session was already established.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) { setReady(true); setChecking(false) }
    }).catch(() => {})
    // The URL-hash / PKCE-code exchange can take a moment. Give it up to ~2.5s
    // before concluding the link is invalid, so a valid link never flashes an
    // error first.
    const t = setTimeout(() => { if (!cancelled) setChecking(false) }, 2500)
    return () => { cancelled = true; clearTimeout(t); subscription?.unsubscribe?.() }
  }, [])

  const submit = async e => {
    e.preventDefault(); setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    setLoading(true)
    try {
      const { error: uErr } = await supabase.auth.updateUser({ password })
      if (uErr) throw uErr
      setDone(true)
      // Sign out of the temporary recovery session so they log in fresh.
      setTimeout(() => { supabase.auth.signOut().catch(() => {}) }, 400)
    } catch (err) {
      const msg = err?.message || ''
      if (/session|token|expired|missing/i.test(msg)) {
        setError('This reset link has expired or was already used. Please request a new one from the Sign In page.')
      } else {
        setError(msg || 'Could not update your password. Please try again.')
      }
    } finally { setLoading(false) }
  }

  const card = {
    width: '100%', maxWidth: 400, padding: 28, borderRadius: 18,
    background: 'rgba(15,12,41,0.96)', border: '1px solid rgba(99,102,241,0.25)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  }
  const input = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)',
    color: '#fff', borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none',
  }
  const label = { color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#0f0c29' }}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#6366f1,#14b8a6)', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}>
            <Droplets style={{ width: 28, height: 28, color: '#fff' }} />
          </div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0 }}>Set a new password</h1>
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle2 style={{ width: 44, height: 44, color: '#34d399', margin: '0 auto 12px' }} />
            <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
              Your password has been updated. You can now sign in with your new password.
            </p>
            <button onClick={() => navigate('/login')}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 800, fontSize: 14 }}>
              Go to Sign In
            </button>
          </div>
        ) : checking ? (
          <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '10px 0' }}>Verifying your reset link…</p>
        ) : !ready ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#fca5a5', fontSize: 13.5, lineHeight: 1.55, marginBottom: 18 }}>
              This password-reset link is invalid, expired, or already used.
              Please request a fresh link from the Sign In page.
            </p>
            <button onClick={() => navigate('/login')}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 800, fontSize: 14 }}>
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <label style={label}>New password</label>
              <input style={input} type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} autoComplete="new-password" />
              <button type="button" onClick={() => setShowPass(s => !s)}
                style={{ position: 'absolute', right: 10, top: 32, background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                {showPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </div>
            <div>
              <label style={label}>Confirm new password</label>
              <input style={input} type={showPass ? 'text' : 'password'} value={confirm}
                onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password" required autoComplete="new-password" />
            </div>
            {error && (
              <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                ⚠️ {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1,
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 800, fontSize: 14 }}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
