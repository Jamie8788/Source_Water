import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 90000,
})

api.interceptors.request.use(config => {
  // Prefer Supabase token, fallback to legacy JWT
  const token = localStorage.getItem('sb_access_token') || localStorage.getItem('sw_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sw_token')
      // Try to refresh the Supabase session before giving up
      try {
        const { supabase } = await import('../lib/supabase')
        const { data } = await supabase.auth.refreshSession()
        if (data?.session?.access_token) {
          // Got a fresh token — update storage and retry the original request
          localStorage.setItem('sb_access_token', data.session.access_token)
          err.config.headers.Authorization = `Bearer ${data.session.access_token}`
          return api.request(err.config)
        }
      } catch (_) {}
      // Refresh failed — clear everything and redirect to login
      localStorage.removeItem('sb_access_token')
      localStorage.removeItem('sw_user')
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

export default api
