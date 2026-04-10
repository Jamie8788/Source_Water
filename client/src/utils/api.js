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
  err => {
    if (err.response?.status === 401) {
      // Only clear legacy token — Supabase handles its own session via onAuthStateChange
      localStorage.removeItem('sw_token')
    }
    return Promise.reject(err)
  }
)

export default api
