import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import api from '../utils/api'

const AuthContext = createContext(null)

function toLocalUser(sbUser, meta = {}) {
  return {
    id: meta.id || sbUser.id,
    supabase_id: sbUser.id,
    email: sbUser.email,
    username: meta.username || sbUser.email?.split('@')[0],
    display_name: meta.display_name || sbUser.user_metadata?.display_name || sbUser.email?.split('@')[0],
    role: meta.role || sbUser.user_metadata?.role || 'Community member',
    avatar_emoji: meta.avatar_emoji || sbUser.user_metadata?.avatar_emoji || '💧',
    avatar_bg_color: meta.avatar_bg_color || sbUser.user_metadata?.avatar_bg_color || '#3B82F6',
    avatar_url: meta.avatar_url || sbUser.user_metadata?.avatar_url || null,
    is_admin: meta.is_admin || sbUser.user_metadata?.is_admin || false,
    xp: meta.xp || 0,
    level: meta.level || 1,
    ...meta,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const isRegisteringRef = useRef(false)

  // ── Feature access map (which tabs this user may use) ──
  // Loaded from the server after sign-in and refreshed when the user changes.
  // null = not loaded yet; we treat "unknown" as allowed so tabs never flicker
  // hidden and a glitch can't lock anyone out. The server is the real gate.
  const [access, setAccess] = useState(null)
  const location = useLocation()
  const lastAccessRef = useRef(0)
  // refreshAccess(force): fetches the feature map. Throttled to once per 15s for
  // the "cheap" triggers (navigation, tab-focus) so tab-hopping doesn't spray
  // /access/me at the server; `force` bypasses it for the moments that matter —
  // login, a role change, and the guaranteed 60s heartbeat.
  const refreshAccess = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && now - lastAccessRef.current < 15000) return
    lastAccessRef.current = now
    try {
      const r = await api.get('/access/me')
      const next = r.data?.features || {}
      // Only replace state when the map actually changed, so the periodic
      // re-check below doesn't re-render the whole app every tick.
      setAccess(prev => (prev && JSON.stringify(prev) === JSON.stringify(next)) ? prev : next)
    } catch { setAccess(prev => prev || {}) }
  }, [])
  useEffect(() => {
    if (!user) { setAccess(null); return }
    refreshAccess(true)
    // Live updates without a page refresh: an admin toggling a tab (e.g. hiding
    // Ask Water for Community members) should reach signed-in users on its own.
    // A guaranteed 60s heartbeat, plus a throttled re-check when the user
    // returns to the tab — so a change shows up within ~60s in the background,
    // or on focus. Client-only (no websockets/Redis), carries over to Hostinger.
    const iv = setInterval(() => refreshAccess(true), 60000)
    const onVisible = () => { if (document.visibilityState === 'visible') refreshAccess() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [user?.id, user?.role, refreshAccess])

  // Re-check access on navigation (throttled) so a tab an admin just revoked
  // disappears soon after — without a request on every single click.
  useEffect(() => { if (user) refreshAccess() }, [location.pathname])

  const fetchProfile = useCallback(async (sbUser, token) => {
    const cached = JSON.parse(localStorage.getItem('sw_user') || '{}')
    // Supabase user_metadata is the ultimate fallback — persists across DB wipes and logouts
    const sbOnboarded = sbUser.user_metadata?.onboarding_completed
    try {
      localStorage.setItem('sb_access_token', token)
      const r = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const profile = r.data?.user || r.data
      const merged = toLocalUser(sbUser, {
        ...profile,
        // Treat onboarding as done if ANY source says so. Using `??` here was a
        // bug: the server returns 0 (a number, not null) for a fresh row, so it
        // short-circuited and never consulted the Supabase metadata that
        // onboarding reliably sets — bouncing just-onboarded users back into the
        // flow in an endless loop. `||` lets a truthy metadata/cache win.
        onboarding_completed: (profile.onboarding_completed || cached.onboarding_completed || sbOnboarded) ? 1 : 0,
      })
      setUser(merged)
      localStorage.setItem('sw_user', JSON.stringify(merged))
      return merged
    } catch (err) {
      if (err?.response?.status === 403) {
        // Before nuking session, try falling back to legacy JWT (admin uses this path)
        const legacyToken = localStorage.getItem('sw_token')
        if (legacyToken) {
          try {
            const r2 = await api.get('/auth/me', { headers: { Authorization: `Bearer ${legacyToken}` } })
            const profile = r2.data?.user || r2.data
            setUser(profile)
            localStorage.setItem('sw_user', JSON.stringify(profile))
            return profile
          } catch (_) {}
        }
        // No fallback — actually suspended
        setUser(null)
        localStorage.removeItem('sw_user')
        localStorage.removeItem('sw_token')
        localStorage.removeItem('sb_access_token')
        await supabase.auth.signOut().catch(() => {})
        return null
      }
      const fallback = toLocalUser(sbUser, {
        onboarding_completed: (cached.onboarding_completed || sbOnboarded) ? 1 : 0,
      })
      setUser(fallback)
      localStorage.setItem('sw_user', JSON.stringify(fallback))
      return fallback
    }
  }, [])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await fetchProfile(session.user, session.access_token)
      } else {
        // Check legacy JWT users (password login)
        const legacyToken = localStorage.getItem('sw_token')
        if (legacyToken) {
          try {
            const r = await api.get('/auth/me', { headers: { Authorization: `Bearer ${legacyToken}` } })
            const profile = r.data?.user || r.data
            setUser(profile)
            localStorage.setItem('sw_user', JSON.stringify(profile))
          } catch (err) {
            // 403 = suspended, any error = bad token → clear everything
            setUser(null)
            localStorage.removeItem('sw_token')
            localStorage.removeItem('sw_user')
          }
        }
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // If we have a legacy token for a DIFFERENT user, don't let a new Supabase
        // session (e.g. from another tab) override this session
        const storedUser = JSON.parse(localStorage.getItem('sw_user') || '{}')
        const hasLegacyToken = !!localStorage.getItem('sw_token')
        const differentUser = storedUser.email && storedUser.email !== session.user.email
        if (hasLegacyToken && differentUser) return
        await fetchProfile(session.user, session.access_token)
      } else if (!isRegisteringRef.current) {
        // Don't clear if a legacy session is active (admin / SQLite-only users)
        const hasLegacySession = !!localStorage.getItem('sw_token')
        if (!hasLegacySession) {
          setUser(null)
          localStorage.removeItem('sw_user')
          localStorage.removeItem('sb_access_token')
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const login = useCallback(async (identifier, password) => {
    const email = identifier.includes('@') ? identifier : `${identifier}@sourcewater.app`
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Fallback to legacy login if Supabase fails (user might be in SQLite only)
      try {
        const r = await api.post('/auth/login', { identifier, password })
        localStorage.setItem('sw_token', r.data.token)
        localStorage.removeItem('sb_access_token') // clear any stale Supabase token
        localStorage.setItem('sw_user', JSON.stringify(r.data.user))
        setUser(r.data.user)
        return r.data.user
      } catch (legacyErr) {
        throw new Error(error.message)
      }
    }
    return toLocalUser(data.user)
  }, [])

  const register = useCallback(async (data) => {
    const { username, password, display_name, role, avatar_emoji, avatar_bg_color, email } = data
    const userEmail = email || `${username}@sourcewater.app`

    isRegisteringRef.current = true
    try {
      const { data: sbData, error: sbError } = await supabase.auth.signUp({
        email: userEmail,
        password,
        options: {
          data: { username, display_name: display_name || username, role, avatar_emoji, avatar_bg_color },
          emailRedirectTo: undefined,
        },
      })
      if (sbError) throw new Error(sbError.message)

      // Get the session — either from signUp directly or via manual sign-in
      let session = sbData?.session
      if (sbData?.user && !session) {
        const { data: signInData } = await supabase.auth.signInWithPassword({ email: userEmail, password })
        session = signInData?.session
      }

      // Also register in legacy system for backwards compat
      try {
        const r = await api.post('/auth/register', data)
        localStorage.setItem('sw_token', r.data.token)
      } catch (_) {}

      // Explicitly set user now so caller can navigate immediately without flicker
      if (session?.user) {
        return await fetchProfile(session.user, session.access_token)
      }

      const fallback = toLocalUser(sbData.user, { username, display_name, role, avatar_emoji, avatar_bg_color })
      setUser(fallback)
      localStorage.setItem('sw_user', JSON.stringify(fallback))
      return fallback
    } finally {
      // Allow a short window for auth state to settle before re-enabling null-clear
      setTimeout(() => { isRegisteringRef.current = false }, 2000)
    }
  }, [fetchProfile])

  const logout = useCallback(async () => {
    // Clear localStorage BEFORE signOut so onAuthStateChange doesn't see a stale sw_token
    localStorage.removeItem('sw_token')
    localStorage.removeItem('sw_user')
    localStorage.removeItem('sb_access_token')
    setUser(null)
    await supabase.auth.signOut()
  }, [])

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates }
      localStorage.setItem('sw_user', JSON.stringify(updated))
      return updated
    })
    // Update Supabase metadata
    supabase.auth.updateUser({ data: updates }).catch(() => {})
  }, [])

  // Memoized context value. Without this, every AuthProvider render (including
  // the 60s access heartbeat, message polls, and every route change) produced a
  // brand-new value object, forcing EVERY consumer — the 9,500-marker map
  // included — to re-render. That background re-render churn is what made the
  // map progressively janky when left open. Now the value reference only changes
  // when something in it actually changes.
  const ctxValue = useMemo(() => ({
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAdmin: !!user?.is_admin,
    isResearcher: !!user?.is_admin || user?.role === 'Researcher',
    isQuizCreator: !!user?.is_admin || ['Teacher','Professor','Researcher','SOURCE Water team member'].includes(user?.role),
    access,
    refreshAccess,
    // canFeature(key): is this tab allowed for the current user? Admins always
    // yes; unknown/not-yet-loaded defaults to yes (opt-out, matches server).
    canFeature: (key) => !!user?.is_admin || !access || access[key] !== false,
  }), [user, loading, access, login, register, logout, updateUser, refreshAccess])

  return (
    <AuthContext.Provider value={ctxValue}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
