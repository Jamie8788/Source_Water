import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sw_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('sw_token')
    if (token) {
      api.get('/auth/me')
        .then(r => { setUser(r.data.user); localStorage.setItem('sw_user', JSON.stringify(r.data.user)) })
        .catch(() => { localStorage.removeItem('sw_token'); localStorage.removeItem('sw_user'); setUser(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (identifier, password) => {
    const r = await api.post('/auth/login', { identifier, password })
    localStorage.setItem('sw_token', r.data.token)
    localStorage.setItem('sw_user', JSON.stringify(r.data.user))
    setUser(r.data.user)
    return r.data.user
  }, [])

  const register = useCallback(async (data) => {
    const r = await api.post('/auth/register', data)
    localStorage.setItem('sw_token', r.data.token)
    localStorage.setItem('sw_user', JSON.stringify(r.data.user))
    setUser(r.data.user)
    return r.data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('sw_token')
    localStorage.removeItem('sw_user')
    setUser(null)
  }, [])

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates }
      localStorage.setItem('sw_user', JSON.stringify(updated))
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, isAdmin: !!user?.is_admin, isResearcher: !!user?.is_admin || user?.role === 'Researcher' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
