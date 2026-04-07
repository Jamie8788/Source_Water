import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 90000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('sw_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sw_token')
      localStorage.removeItem('sw_user')
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

export default api
