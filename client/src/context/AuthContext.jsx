import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
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

  const fetchProfile = useCallback(async (sbUser, token) => {
    try {
      // Store access token for api.js interceptor
      localStorage.setItem('sb_access_token', token)
      const r = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const profile = r.data?.user || r.data
      const merged = toLocalUser(sbUser, profile)
      setUser(merged)
      localStorage.setItem('sw_user', JSON.stringify(merged))
      return merged
    } catch {
      const fallback = toLocalUser(sbUser)
      setUser(fallback)
      localStorage.setItem('sw_user', JSON.stringify(fallback))
      return fallback
    }
  }, [])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user, session.access_token).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchProfile(session.user, session.access_token)
      } else {
        setUser(null)
        localStorage.removeItem('sw_user')
        localStorage.removeItem('sb_access_token')
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

    const { data: sbData, error: sbError } = await supabase.auth.signUp({
      email: userEmail,
      password,
      options: {
        data: { username, display_name: display_name || username, role, avatar_emoji, avatar_bg_color },
        emailRedirectTo: window.location.origin,
      },
    })
    if (sbError) throw new Error(sbError.message)

    // Also register in legacy system for backwards compat
    try {
      const r = await api.post('/auth/register', data)
      localStorage.setItem('sw_token', r.data.token)
    } catch (_) {}

    return toLocalUser(sbData.user, { username, display_name, role, avatar_emoji, avatar_bg_color })
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('sw_token')
    localStorage.removeItem('sw_user')
    localStorage.removeItem('sb_access_token')
    setUser(null)
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

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      updateUser,
      isAdmin: !!user?.is_admin,
      isResearcher: !!user?.is_admin || user?.role === 'Researcher',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
