/**
 * Weather3D.jsx — Earth Globe + Enhanced Weather Panel + AI Assistant
 * Globe auto-navigates on search · city pin overlay · air quality · AI chat
 * All free APIs: Open-Meteo, Open-Meteo AQ, OpenRouter
 */

import { useState, useRef, useEffect } from 'react'
import { Search, X, Wind, Droplets, Gauge, Sun, Bot, User, Send, Loader, ChevronDown, ChevronUp, Download, TrendingUp, TrendingDown, AlertTriangle, Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { askAI } from '../utils/openrouter'

const QUICK_LOCATIONS = [
  { name: 'Sault Ste. Marie', lat: 46.52, lon: -84.35 },
  { name: 'Thunder Bay',      lat: 48.38, lon: -89.25 },
  { name: 'Toronto',          lat: 43.65, lon: -79.38 },
  { name: 'Hamilton',         lat: 43.26, lon: -79.87 },
  { name: 'Sudbury',          lat: 46.49, lon: -80.99 },
]

const DEFAULT_CENTER = { lon: -82, lat: 46 }
const DEFAULT_ZOOM   = 400
const BACKEND        = import.meta.env.VITE_ANALYSIS_URL || 'http://localhost:8001'

// Build globe URL for any layer
function buildGlobeUrl(center, zoom, layer = 'wind') {
  const c = `${center.lon.toFixed(2)},${center.lat.toFixed(2)},${zoom}`
  switch (layer) {
    case 'temp':   return `https://earth.nullschool.net/#current/wind/surface/level/overlay=temp/orthographic=${c}`
    case 'precip': return `https://earth.nullschool.net/#current/wind/surface/level/overlay=precip_3h/orthographic=${c}`
    case 'humid':  return `https://earth.nullschool.net/#current/wind/surface/level/overlay=rh/orthographic=${c}`
    case 'ocean':  return `https://earth.nullschool.net/#current/ocean/surface/currents/orthographic=${c}`
    case 'pm25':   return `https://earth.nullschool.net/#current/part/surface/level/overlay=pm2p5/orthographic=${c}`
    default:       return `https://earth.nullschool.net/#current/wind/surface/level/orthographic=${c}`
  }
}

// Orthographic projection: lat/lon → screen px (returns null if behind globe)
function projectPoint(lat, lon, center, zoom, cW, cH, tabBarH = 44) {
  const R = Math.PI / 180
  const φ1 = center.lat * R, λ0 = center.lon * R
  const φ  = lat * R,        λ  = lon * R
  const cosφ1 = Math.cos(φ1), sinφ1 = Math.sin(φ1)
  const cosφ  = Math.cos(φ),  sinφ  = Math.sin(φ)
  const Δλ    = λ - λ0
  const c     = sinφ1 * sinφ + cosφ1 * cosφ * Math.cos(Δλ)
  if (c < 0) return null  // behind globe
  const x =  cosφ * Math.sin(Δλ)
  const y =  cosφ1 * sinφ - sinφ1 * cosφ * Math.cos(Δλ)
  const availH = cH - tabBarH
  return {
    sx: cW / 2 + zoom * x,
    sy: tabBarH + availH / 2 - zoom * y - 20, // -20 accounts for nullschool bottom bar
  }
}

// WQI → color
function wqiColor(wqi) {
  if (wqi > 75) return '#10b981'
  if (wqi > 50) return '#0ea5e9'
  if (wqi > 25) return '#f59e0b'
  return '#ef4444'
}
function wqiLabel(wqi) {
  if (wqi > 75) return 'Excellent'
  if (wqi > 50) return 'Good'
  if (wqi > 25) return 'Fair'
  return 'Poor'
}

// Globe data layers definition
const DATA_LAYERS = [
  { id: 'wind',   icon: '💨', label: 'Wind'       },
  { id: 'temp',   icon: '🌡️', label: 'Temperature' },
  { id: 'precip', icon: '🌧️', label: 'Precipitation'},
  { id: 'humid',  icon: '💧', label: 'Humidity'    },
  { id: 'ocean',  icon: '🌊', label: 'Ocean'       },
  { id: 'pm25',   icon: '🏭', label: 'Air Quality' },
]

// ── Data fetching ──────────────────────────────────────────────────────────────
async function fetchAll(query) {
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
  )
  const geoData = await geoRes.json()
  if (!geoData.results?.length) throw new Error('Location not found')
  const { latitude: lat, longitude: lon, name, country, admin1 } = geoData.results[0]
  const location = admin1 ? `${name}, ${admin1}, ${country}` : `${name}, ${country}`

  const [wxRes, aqRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,weather_code,surface_pressure,visibility,uv_index` +
      `&hourly=temperature_2m,precipitation_probability,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunrise,sunset,uv_index_max,precipitation_probability_max` +
      `&timezone=auto&forecast_days=5&forecast_hours=24`
    ),
    fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=pm2_5,pm10,us_aqi,ozone,nitrogen_dioxide&timezone=auto`
    ),
  ])

  const wx = await wxRes.json()
  const aq = aqRes.ok ? await aqRes.json() : null

  return { location, name, lat, lon, current: wx.current, hourly: wx.hourly, daily: wx.daily, aq: aq?.current }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function wmoDescription(code) {
  if (code === 0) return 'Clear sky'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 9) return 'Fog'
  if (code <= 19) return 'Drizzle'
  if (code <= 29) return 'Rain'
  if (code <= 39) return 'Snow'
  if (code <= 49) return 'Freezing rain'
  if (code <= 59) return 'Heavy rain'
  if (code <= 69) return 'Heavy snow'
  if (code <= 79) return 'Showers'
  if (code <= 84) return 'Rain showers'
  if (code <= 94) return 'Thunderstorm'
  return 'Violent thunderstorm'
}
function wmoEmoji(code) {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 9) return '🌫️'
  if (code <= 29) return '🌧️'
  if (code <= 49) return '🌨️'
  if (code <= 69) return '❄️'
  if (code <= 84) return '🌦️'
  return '⛈️'
}
function windDir(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(deg / 45) % 8]
}
function aqiLabel(aqi) {
  if (!aqi) return { label: 'N/A', color: '#64748b' }
  if (aqi <= 50)  return { label: 'Good', color: '#22c55e' }
  if (aqi <= 100) return { label: 'Moderate', color: '#eab308' }
  if (aqi <= 150) return { label: 'Unhealthy (sensitive)', color: '#f97316' }
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' }
  return { label: 'Very Unhealthy', color: '#a855f7' }
}
function fmtTime(iso) {
  if (!iso) return '--'
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
}

// ── Mini stat card ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = '#94a3b8', sub }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Icon size={15} color={color} style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginTop: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── AI Assistant mini-chat ─────────────────────────────────────────────────────
function AIAssistant({ weatherData }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  // Reset chat when location changes
  useEffect(() => { setMsgs([]); setInput('') }, [weatherData?.location])

  const quickQ = [
    'Is it safe to go swimming today?',
    'What should I wear?',
    'Will it rain this week?',
    'How is the air quality?',
  ]

  const send = async (text) => {
    const q = text || input.trim()
    if (!q || loading) return
    setInput('')
    const newMsgs = [...msgs, { role: 'user', content: q }]
    setMsgs(newMsgs)
    setLoading(true)

    const c = weatherData.current
    const ctx = `Location: ${weatherData.location}
Temperature: ${c.temperature_2m}°C (feels like ${c.apparent_temperature}°C)
Condition: ${wmoDescription(c.weather_code ?? 0)}
Humidity: ${c.relative_humidity_2m}%
Wind: ${c.wind_speed_10m} km/h ${windDir(c.wind_direction_10m ?? 0)}
Pressure: ${c.surface_pressure} hPa
UV Index: ${c.uv_index ?? 'N/A'}
Precipitation today: ${c.precipitation} mm
Air Quality Index: ${weatherData.aq?.us_aqi ?? 'N/A'}
3-day max temps: ${weatherData.daily?.temperature_2m_max?.slice(0,3).map(t => t?.toFixed(0)+'°C').join(', ')}
3-day rain prob: ${weatherData.daily?.precipitation_probability_max?.slice(0,3).map(p => p+'%').join(', ')}`

    const systemPrompt = `You are a helpful weather and environmental assistant. The user is asking about the weather at a specific location. Here is the current data:\n\n${ctx}\n\nAnswer concisely (2-4 sentences max). Focus on practical advice. If asked about water safety, factor in AQI, rain, and temperature.`

    const response = await askAI(newMsgs, systemPrompt, 512)
    setMsgs(prev => [...prev, { role: 'assistant', content: response }])
    setLoading(false)
  }

  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(0,0,0,0.2)',
    }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '10px 16px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: '#a5b4fc', fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
          <Bot size={14} /> AI Weather Assistant
          <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.2)', padding: '2px 6px', borderRadius: 20, color: '#818cf8' }}>FREE</span>
        </div>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 280 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, maxHeight: 180 }}>
            {msgs.length === 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {quickQ.map(q => (
                  <button key={q} onClick={() => send(q)} style={{
                    padding: '4px 10px', background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20,
                    color: '#a5b4fc', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{q}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: m.role === 'user' ? 'rgba(99,102,241,0.3)' : 'rgba(14,165,233,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {m.role === 'user' ? <User size={11} color="#818cf8" /> : <Bot size={11} color="#38bdf8" />}
                </div>
                <div style={{
                  maxWidth: '82%', padding: '7px 10px', fontSize: 12, lineHeight: 1.5, color: '#e2e8f0',
                  borderRadius: m.role === 'user' ? '12px 3px 12px 12px' : '3px 12px 12px 12px',
                  background: m.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(14,165,233,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={11} color="#38bdf8" />
                </div>
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px 12px 12px 12px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 4 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#38bdf8', animation: `bounce 1.2s ${i*0.2}s infinite ease-in-out` }} />)}
                  <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}`}</style>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about this location…"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#e2e8f0', fontSize: 12, padding: '7px 10px',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()} style={{
              width: 30, height: 30, borderRadius: 8, background: loading || !input.trim() ? 'rgba(99,102,241,0.2)' : '#6366f1',
              border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {loading ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={12} />}
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Weather detail panel ───────────────────────────────────────────────────────
function WeatherPanel({ data }) {
  const { current: c, hourly, daily, location, aq } = data
  const code = c.weather_code ?? 0
  const aqi = aqiLabel(aq?.us_aqi)

  // Next 6 hours from now
  const nowHour = new Date().getHours()
  const hourlySlice = hourly ? Array.from({ length: 6 }, (_, i) => ({
    time: hourly.time?.[nowHour + i],
    temp: hourly.temperature_2m?.[nowHour + i],
    pop:  hourly.precipitation_probability?.[nowHour + i],
    code: hourly.weather_code?.[nowHour + i] ?? 0,
  })).filter(h => h.time) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Location + main temp */}
      <div style={{ padding: '4px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>📍 {location}</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>
          {wmoEmoji(code)} {c.temperature_2m?.toFixed(1)}°C
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          Feels like {c.apparent_temperature?.toFixed(1)}°C · {wmoDescription(code)}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <StatCard icon={Droplets} label="Humidity"  value={`${c.relative_humidity_2m}%`} color="#38bdf8" />
        <StatCard icon={Wind}     label="Wind"      value={`${c.wind_speed_10m?.toFixed(0)} km/h`} sub={windDir(c.wind_direction_10m ?? 0)} color="#a78bfa" />
        <StatCard icon={Gauge}    label="Pressure"  value={`${c.surface_pressure?.toFixed(0)} hPa`} color="#fb923c" />
        <StatCard icon={Sun}      label="UV Index"  value={c.uv_index?.toFixed(1) ?? '--'} color="#fbbf24"
          sub={c.uv_index >= 8 ? 'Very High' : c.uv_index >= 6 ? 'High' : c.uv_index >= 3 ? 'Moderate' : 'Low'} />
      </div>

      {/* Sunrise / Sunset */}
      {daily?.sunrise?.[0] && (
        <div style={{
          display: 'flex', justifyContent: 'space-around',
          background: 'rgba(255,255,255,0.03)', borderRadius: 10,
          padding: '10px 0', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18 }}>🌅</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Sunrise</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{fmtTime(daily.sunrise[0])}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18 }}>🌇</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Sunset</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f97316' }}>{fmtTime(daily.sunset[0])}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18 }}>💧</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Precip.</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>{(c.precipitation ?? 0).toFixed(1)} mm</div>
          </div>
        </div>
      )}

      {/* Air Quality */}
      {aq && (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: `${aqi.color}15`, border: `1px solid ${aqi.color}40`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Air Quality Index</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: aqi.color, marginTop: 2 }}>{aq.us_aqi ?? '--'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: aqi.color }}>{aqi.label}</div>
            {aq.pm2_5 != null && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>PM2.5: {aq.pm2_5?.toFixed(1)} µg/m³</div>}
          </div>
        </div>
      )}

      {/* Hourly next 6h */}
      {hourlySlice.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Next 6 Hours</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {hourlySlice.map((h, i) => (
              <div key={i} style={{
                flexShrink: 0, textAlign: 'center',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '8px 10px', minWidth: 48,
              }}>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  {i === 0 ? 'Now' : `+${i}h`}
                </div>
                <div style={{ fontSize: 16, margin: '4px 0' }}>{wmoEmoji(h.code)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{h.temp?.toFixed(0)}°</div>
                {h.pop > 0 && <div style={{ fontSize: 10, color: '#38bdf8', marginTop: 2 }}>{h.pop}%</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5-day forecast */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>5-Day Forecast</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[0,1,2,3,4].map(i => {
            const date = new Date(); date.setDate(date.getDate() + i)
            const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
            const pop = daily?.precipitation_probability_max?.[i]
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '7px 10px', fontSize: 12,
              }}>
                <span style={{ color: '#94a3b8', width: 80, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 16 }}>{wmoEmoji(0)}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {daily?.temperature_2m_min?.[i]?.toFixed(0)}° – {daily?.temperature_2m_max?.[i]?.toFixed(0)}°C
                </span>
                {pop != null && <span style={{ color: '#38bdf8', fontSize: 11, width: 30, textAlign: 'right' }}>{pop}%</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#334155', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
        Open-Meteo · Open-Meteo AQ · Free, no key required
      </div>
    </div>
  )
}

// ── View tabs ──────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: 'globe',     icon: '🌍', label: 'Globe'       },
  { id: 'satellite', icon: '🛰️', label: 'Satellite'   },
  { id: 'street',    icon: '🚶', label: 'Street View' },
  { id: 'windy',     icon: '🌪️', label: 'Windy'       },
]

function getViewSrc(view, data, center, zoom, dataLayer) {
  const lat = data?.lat ?? center.lat
  const lon = data?.lon ?? center.lon
  switch (view) {
    case 'globe':     return buildGlobeUrl(center, zoom, dataLayer)
    case 'satellite': return data ? `https://maps.google.com/maps?q=${lat},${lon}&z=17&t=k&output=embed` : null
    case 'street':    return data ? `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lon}&cbp=11,0,0,0,0&output=embed` : null
    case 'windy':     return data ? `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&zoom=8&level=surface&overlay=wind&product=ecmwf&menu=&message=&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1` : null
    default:          return buildGlobeUrl(center, zoom, dataLayer)
  }
}

// ── Research marker overlay ────────────────────────────────────────────────────
function ResearchMarkers({ center, zoom, containerSize, researchData, onSelect, selected }) {
  const TAB_H = 44
  return (
    <>
      {QUICK_LOCATIONS.map(loc => {
        const pos = projectPoint(loc.lat, loc.lon, center, zoom, containerSize.w, containerSize.h, TAB_H)
        if (!pos) return null
        const rd    = researchData[loc.name]
        const wqi   = rd?.water_quality_index?.index ?? rd?.wqi ?? 50
        const color = wqiColor(wqi)
        const risk  = rd ? wqiLabel(wqi) : '…'
        const isSelected = selected?.name === loc.name
        const isHigh = wqi < 25
        return (
          <div
            key={loc.name}
            onClick={() => onSelect(loc, rd)}
            style={{
              position: 'absolute',
              left: pos.sx, top: pos.sy,
              transform: 'translate(-50%, -50%)',
              zIndex: 15, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              filter: `drop-shadow(0 2px 6px ${color}99)`,
            }}
          >
            {/* Label — show on select */}
            {isSelected && (
              <div style={{
                background: 'rgba(6,10,24,0.95)', border: `1px solid ${color}`,
                borderRadius: 7, padding: '3px 9px', marginBottom: 4,
                color: '#f1f5f9', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                backdropFilter: 'blur(6px)',
              }}>
                {loc.name} · WQI {wqi.toFixed ? wqi.toFixed(0) : wqi} · {risk}
              </div>
            )}
            {/* Dot */}
            <div style={{
              width: isSelected ? 16 : 12, height: isSelected ? 16 : 12,
              borderRadius: '50%', background: color,
              border: `2px solid rgba(255,255,255,${isSelected ? 0.9 : 0.5})`,
              boxShadow: `0 0 0 ${isSelected ? 4 : 2}px ${color}44, 0 0 12px ${color}88`,
              transition: 'all 0.2s',
            }} />
            {/* Pulse for high risk */}
            {isHigh && (
              <div style={{
                position: 'absolute',
                width: 24, height: 24, borderRadius: '50%',
                border: `2px solid ${color}`,
                animation: 'pingRing 1.5s ease-out infinite',
              }} />
            )}
          </div>
        )
      })}
      <style>{`@keyframes pingRing{0%{transform:scale(.5);opacity:1}100%{transform:scale(2.2);opacity:0}}`}</style>
    </>
  )
}

// ── Marker detail popup ────────────────────────────────────────────────────────
function MarkerDetail({ loc, data, onClose }) {
  if (!loc) return null
  const wqi     = data?.water_quality_index?.index ?? data?.wqi ?? null
  const color   = wqi != null ? wqiColor(wqi) : '#64748b'
  const wx      = data?.weather?.current ?? {}
  const anomaly = data?.anomalies?.anomaly_rate ?? null
  const risk    = data?.risk ?? data?.water_quality_index ?? null

  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16, zIndex: 50,
      width: 280,
      background: 'rgba(6,10,24,0.97)', backdropFilter: 'blur(16px)',
      border: `1px solid ${color}44`, borderRadius: 14,
      boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${color}22`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', background: `${color}18`, borderBottom: `1px solid ${color}22` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>📍 {loc.name}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: 2 }}>×</button>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{loc.region ?? 'Research Site'}</div>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* WQI */}
        {wqi != null ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Water Quality Index</div>
              <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.1 }}>{wqi.toFixed ? wqi.toFixed(0) : wqi}</div>
              <div style={{ fontSize: 11, color, fontWeight: 700 }}>{wqiLabel(wqi)}</div>
            </div>
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}15` }}>
              <span style={{ fontSize: 22 }}>{wqi > 75 ? '✅' : wqi > 50 ? '🔵' : wqi > 25 ? '⚠️' : '🚨'}</span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#475569' }}>WQI data loading… (backend offline?)</div>
        )}

        {/* Weather quick stats */}
        {wx.temperature_2m != null && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {[
              { label: 'Temp', val: `${wx.temperature_2m?.toFixed(1)}°C` },
              { label: 'Humidity', val: `${wx.relative_humidity_2m}%` },
              { label: 'Wind', val: `${wx.wind_speed_10m?.toFixed(0)} km/h` },
            ].map(({ label, val }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Anomaly flag */}
        {anomaly != null && (
          <div style={{
            padding: '7px 10px', borderRadius: 8,
            background: anomaly > 10 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
            border: `1px solid ${anomaly > 10 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>{anomaly > 10 ? '⚠️' : '✅'}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: anomaly > 10 ? '#fca5a5' : '#86efac' }}>
                {anomaly > 10 ? 'Anomalies Detected' : 'No Anomalies'}
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{anomaly.toFixed(1)}% anomaly rate</div>
            </div>
          </div>
        )}

        {/* Risk breakdown */}
        {risk?.violations?.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Violations</div>
            {risk.violations.slice(0, 2).map((v, i) => (
              <div key={i} style={{ fontSize: 11, color: '#fca5a5', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                ⚡ {v.column ?? v.parameter}: {v.issue ?? v.value}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 10, color: '#334155' }}>
          📡 NASA POWER · Open-Meteo · Backend ML · Live
        </div>
      </div>
    </div>
  )
}

// ── ML helpers ─────────────────────────────────────────────────────────────────
function computeWQI(temp, humidity, precip, wind) {
  const precipScore = Math.min(precip * 15, 40)
  const tempScore   = temp < 8 || temp > 18 ? Math.abs(temp - 13) * 2 : 0
  const algaeRisk   = (humidity / 100) * Math.max(0, temp - 18) * 2
  const stagnation  = Math.max(0, 20 - wind * 2)
  const total = Math.min(100, precipScore + tempScore + algaeRisk + stagnation)
  return Math.round(total)
}
function wqiTrend(wqiArr) {
  if (wqiArr.length < 2) return 'stable'
  const delta = wqiArr[wqiArr.length - 1] - wqiArr[0]
  if (delta > 8) return 'worsening'
  if (delta < -8) return 'improving'
  return 'stable'
}
function algaeRisk(temp, humidity, precip) {
  // High temp + high humidity + low precip = bloom risk
  const score = Math.min(100, Math.max(0, (temp - 15) * 3 + (humidity - 60) * 0.5 - precip * 10))
  if (score >= 60) return { level: 'HIGH', color: '#ef4444', score }
  if (score >= 35) return { level: 'MODERATE', color: '#f59e0b', score }
  return { level: 'LOW', color: '#10b981', score }
}
function runoffRisk(precip7day) {
  if (precip7day > 50) return { level: 'HIGH', color: '#ef4444', note: 'Heavy runoff expected — elevated contamination risk' }
  if (precip7day > 20) return { level: 'MODERATE', color: '#f59e0b', note: 'Moderate runoff — monitor turbidity and E. coli' }
  return { level: 'LOW', color: '#10b981', note: 'Minimal runoff — good conditions for sampling' }
}

// ── All Sites Panel ────────────────────────────────────────────────────────────
function AllSitesPanel({ researchData }) {
  const sites = QUICK_LOCATIONS.map(loc => {
    const d   = researchData[loc.name]
    const wqi = d?.water_quality_index?.index ?? null
    const wx  = d?.weather?.current ?? {}
    const ar  = d?.anomalies?.anomaly_rate ?? null
    const risk = d?.risk?.level ?? null
    return { ...loc, wqi, wx, ar, risk, raw: d }
  })

  const exportCSV = () => {
    const rows = sites.map(s => ({
      site: s.name, region: s.region ?? '',
      wqi: s.wqi?.toFixed(1) ?? '',
      wqi_status: s.wqi != null ? wqiLabel(s.wqi) : '',
      temp_c: s.wx.temperature_2m ?? '',
      humidity_pct: s.wx.relative_humidity_2m ?? '',
      wind_kmh: s.wx.wind_speed_10m ?? '',
      precip_mm: s.wx.precipitation ?? '',
      anomaly_rate_pct: s.ar?.toFixed(1) ?? '',
      risk_level: s.risk ?? '',
      timestamp: new Date().toISOString(),
    }))
    const hdrs = Object.keys(rows[0]).join(',')
    const lines = rows.map(r => Object.values(r).join(','))
    const csv = [hdrs, ...lines].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `research-sites-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  const exportJSON = () => {
    const payload = sites.map(s => ({ site: s.name, wqi: s.wqi, weather: s.wx, anomaly_rate: s.ar, risk: s.risk, raw: s.raw }))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    a.download = `research-sites-${new Date().toISOString().slice(0,10)}.json`
    a.click()
  }

  const loaded = sites.filter(s => s.wqi != null).length
  const worstSite = sites.filter(s => s.wqi != null).sort((a, b) => a.wqi - b.wqi)[0]
  const bestSite  = sites.filter(s => s.wqi != null).sort((a, b) => b.wqi - a.wqi)[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Best Site</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981', marginTop: 3 }}>{bestSite?.name ?? '—'}</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>WQI {bestSite?.wqi?.toFixed(0) ?? '—'}</div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Needs Attention</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', marginTop: 3 }}>{worstSite?.name ?? '—'}</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>WQI {worstSite?.wqi?.toFixed(0) ?? '—'}</div>
        </div>
      </div>

      {/* Sites table */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          All Research Sites · {loaded}/{sites.length} loaded
        </div>
        {sites.map(s => {
          const col = s.wqi != null ? wqiColor(s.wqi) : '#475569'
          return (
            <div key={s.name} style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto auto',
              alignItems: 'center', gap: 6,
              padding: '7px 8px', borderRadius: 8, marginBottom: 4,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{s.name}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>{s.wx.temperature_2m != null ? `${s.wx.temperature_2m}°C · ${s.wx.relative_humidity_2m}% RH` : 'loading…'}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: col }}>{s.wqi != null ? s.wqi.toFixed(0) : '—'}</div>
                <div style={{ fontSize: 9, color: col }}>{s.wqi != null ? wqiLabel(s.wqi) : ''}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                {s.ar != null ? (
                  <div style={{ fontSize: 10, color: s.ar > 10 ? '#fca5a5' : '#86efac' }}>{s.ar.toFixed(1)}%</div>
                ) : <div style={{ fontSize: 10, color: '#334155' }}>—</div>}
                <div style={{ fontSize: 9, color: '#334155' }}>anomaly</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, boxShadow: `0 0 6px ${col}` }} />
            </div>
          )
        })}
      </div>

      {/* Export */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={exportCSV} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Download size={11} /> CSV
        </button>
        <button onClick={exportJSON} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Download size={11} /> JSON
        </button>
      </div>
    </div>
  )
}

// ── ML Research Panel ──────────────────────────────────────────────────────────
function MLResearchPanel({ weatherData, researchData }) {
  if (!weatherData) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155', fontSize: 13 }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>🧪</div>
      Search a location to see ML analysis
    </div>
  )

  const { daily, current: c } = weatherData

  // 5-day WQI forecast
  const wqiForecast = daily ? Array.from({ length: 5 }, (_, i) => {
    const maxT = daily.temperature_2m_max?.[i] ?? c.temperature_2m ?? 15
    const minT = daily.temperature_2m_min?.[i] ?? maxT - 5
    const avgT = (maxT + minT) / 2
    const precip = daily.precipitation_sum?.[i] ?? 0
    const maxWind = daily.wind_speed_10m_max?.[i] ?? c.wind_speed_10m ?? 5
    const wqi = computeWQI(avgT, c.relative_humidity_2m ?? 60, precip, maxWind)
    const date = new Date(); date.setDate(date.getDate() + i)
    return {
      day: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en', { weekday: 'short' }),
      wqi,
      precip: precip.toFixed(1),
      temp: avgT.toFixed(1),
    }
  }) : []

  const trend = wqiTrend(wqiForecast.map(d => d.wqi))
  const precip7 = daily?.precipitation_sum?.slice(0, 5).reduce((a, b) => a + (b ?? 0), 0) ?? 0
  const avgTemp = daily?.temperature_2m_max?.slice(0, 3).reduce((a, b) => a + b, 0) / 3 ?? c.temperature_2m ?? 15
  const algae   = algaeRisk(avgTemp, c.relative_humidity_2m ?? 60, c.precipitation ?? 0)
  const runoff  = runoffRisk(precip7)

  // Cross-site WQI comparison
  const siteWQIs = QUICK_LOCATIONS
    .map(loc => ({ name: loc.name.split(' ')[0], wqi: researchData[loc.name]?.water_quality_index?.index ?? null }))
    .filter(s => s.wqi != null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* WQI 5-day forecast */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>WQI 5-Day Forecast</div>
          <div style={{ fontSize: 10, color: trend === 'worsening' ? '#ef4444' : trend === 'improving' ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}>
            {trend === 'worsening' ? <TrendingUp size={10} /> : trend === 'improving' ? <TrendingDown size={10} /> : <Activity size={10} />}
            {trend}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={90}>
          <AreaChart data={wqiForecast} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="wqiGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
            <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false}/>
            <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }} labelStyle={{ color: '#94a3b8' }} formatter={(v, n) => [v, 'WQI']}/>
            <Area type="monotone" dataKey="wqi" stroke="#38bdf8" fill="url(#wqiGrad)" strokeWidth={2} dot={{ fill: '#38bdf8', r: 3 }}/>
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {wqiForecast.map(d => (
            <div key={d.day} style={{ flex: 1, textAlign: 'center', background: `${wqiColor(d.wqi)}12`, borderRadius: 6, padding: '3px 0', border: `1px solid ${wqiColor(d.wqi)}30` }}>
              <div style={{ fontSize: 9, color: '#475569' }}>{d.day}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: wqiColor(d.wqi) }}>{d.wqi}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Algae Bloom Risk */}
      <div style={{ padding: '10px 12px', borderRadius: 10, background: `${algae.color}0e`, border: `1px solid ${algae.color}30` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🌿 Algae Bloom Risk</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: algae.color, marginTop: 2 }}>{algae.level}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
              {algae.level === 'HIGH' ? 'High temp + humidity — bloom conditions present' :
               algae.level === 'MODERATE' ? 'Monitor cyanobacteria and chlorophyll levels' :
               'Conditions unfavourable for algae growth'}
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: algae.color }}>{algae.score.toFixed(0)}</div>
        </div>
      </div>

      {/* Runoff / Contamination Risk */}
      <div style={{ padding: '10px 12px', borderRadius: 10, background: `${runoff.color}0e`, border: `1px solid ${runoff.color}30` }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>💧 Runoff / Contamination Risk</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: runoff.color }}>{runoff.level}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{runoff.note}</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: runoff.color }}>{precip7.toFixed(0)} mm<div style={{ fontSize: 9, color: '#475569' }}>5-day total</div></div>
        </div>
      </div>

      {/* UV & Thermal Stratification */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>☀️ UV Index</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>{c.uv_index?.toFixed(1) ?? '—'}</div>
          <div style={{ fontSize: 9, color: '#64748b' }}>{c.uv_index >= 8 ? 'Very High — affects algae' : c.uv_index >= 3 ? 'Moderate' : 'Low'}</div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
          <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>🌡️ Stratification</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>{(c.temperature_2m ?? 0) > 20 ? 'HIGH' : (c.temperature_2m ?? 0) > 12 ? 'MOD' : 'LOW'}</div>
          <div style={{ fontSize: 9, color: '#64748b' }}>Thermal mixing risk</div>
        </div>
      </div>

      {/* Cross-site WQI bars */}
      {siteWQIs.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Research Site WQI Comparison</div>
          {siteWQIs.sort((a, b) => a.wqi - b.wqi).map(s => (
            <div key={s.name} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
                <span>{s.name}</span><span style={{ color: wqiColor(s.wqi) }}>{s.wqi.toFixed(0)}</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${s.wqi}%`, background: wqiColor(s.wqi), borderRadius: 3, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sampling recommendation */}
      <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>🔬 Sampling Recommendation</div>
        <div style={{ fontSize: 11, color: '#c7d2fe', lineHeight: 1.5 }}>
          {runoff.level === 'HIGH' ? '⚠️ Delay grab samples 48h post-rain. Use composite sampling. Flag for E. coli and turbidity.' :
           algae.level === 'HIGH' ? '🌿 Collect surface samples for cyanobacteria. Check chlorophyll-a. Sample early morning.' :
           '✅ Good conditions for field sampling. Collect baseline grab samples and deploy sensors.'}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Weather3D() {
  const [query, setQuery]             = useState('')
  const [weatherData, setWeatherData] = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [activeView, setActiveView]   = useState('globe')
  const [dataLayer, setDataLayer]     = useState('wind')
  const [rightTab, setRightTab]       = useState('weather')
  const [globeCenter, setGlobeCenter] = useState(DEFAULT_CENTER)
  const [globeZoom, setGlobeZoom]     = useState(DEFAULT_ZOOM)
  const [pinLabel, setPinLabel]       = useState(null)
  const [researchData, setResearchData] = useState({})
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [containerSize, setContainerSize]   = useState({ w: 1000, h: 700 })
  const globeContainerRef = useRef(null)

  // Track container size for projection
  useEffect(() => {
    if (!globeContainerRef.current) return
    const obs = new ResizeObserver(e => {
      const r = e[0].contentRect
      setContainerSize({ w: r.width, h: r.height })
    })
    obs.observe(globeContainerRef.current)
    return () => obs.disconnect()
  }, [])

  // Fetch live research data from backend (NASA POWER + WQI)
  useEffect(() => {
    const load = async () => {
      for (const loc of QUICK_LOCATIONS) {
        try {
          const res = await fetch(`${BACKEND}/weather/research/${encodeURIComponent(loc.name)}`)
          if (res.ok) {
            const d = await res.json()
            setResearchData(prev => ({ ...prev, [loc.name]: d }))
          }
        } catch { /* backend offline — markers still show, WQI shows N/A */ }
      }
    }
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const search = async (locationName) => {
    const q = locationName ?? query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setWeatherData(null)
    setPinLabel(null)
    setSelectedMarker(null)
    setActiveView('globe')
    try {
      const data = await fetchAll(q)
      setWeatherData(data)
      setGlobeCenter({ lon: data.lon, lat: data.lat })
      setGlobeZoom(450)
      setPinLabel(data.name)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const currentSrc  = getViewSrc(activeView, weatherData, globeCenter, globeZoom, dataLayer)
  const iframeKey   = `${activeView}-${dataLayer}-${globeCenter.lon}-${globeCenter.lat}`
  const showMarkers = activeView === 'globe'

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: '#000', overflow: 'hidden', borderRadius: 12 }}>

      {/* ── Left: view panel ──────────────────────────────────────────────── */}
      <div
        ref={globeContainerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── Top bar: view tabs + data layers ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
          background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          zIndex: 30, flexShrink: 0, flexWrap: 'wrap',
        }}>
          {/* View tabs */}
          {VIEWS.map(v => {
            const disabled = v.id !== 'globe' && !weatherData
            const active   = activeView === v.id
            return (
              <button key={v.id} onClick={() => !disabled && setActiveView(v.id)}
                title={disabled ? 'Search a location first' : v.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 7,
                  border: active ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.07)',
                  background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#a5b4fc' : disabled ? '#2d3748' : '#94a3b8',
                  fontSize: 12, fontWeight: active ? 700 : 400,
                  cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                <span>{v.icon}</span><span>{v.label}</span>
              </button>
            )
          })}

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          {/* Data layer toggles — globe only */}
          {activeView === 'globe' && DATA_LAYERS.map(l => (
            <button key={l.id} onClick={() => setDataLayer(l.id)}
              title={`Globe: ${l.label}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 9px', borderRadius: 7, fontSize: 11,
                border: dataLayer === l.id ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(255,255,255,0.06)',
                background: dataLayer === l.id ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.03)',
                color: dataLayer === l.id ? '#38bdf8' : '#475569',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: dataLayer === l.id ? 700 : 400,
              }}
            >
              <span>{l.icon}</span><span>{l.label}</span>
            </button>
          ))}

          {/* Live indicator */}
          {weatherData && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'lpulse 2s infinite' }} />
              <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{weatherData.name}</span>
              <style>{`@keyframes lpulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
            </div>
          )}
        </div>

        {/* ── iframe area ── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {currentSrc ? (
            <iframe
              key={iframeKey}
              src={currentSrc}
              title={activeView}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              allowFullScreen
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#334155', fontSize: 14, flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 32 }}>🔍</span>
              Search a location to enable this view
            </div>
          )}

          {/* Research site markers — globe view only */}
          {showMarkers && (
            <ResearchMarkers
              center={globeCenter}
              zoom={globeZoom}
              containerSize={containerSize}
              researchData={researchData}
              onSelect={(loc, rd) => setSelectedMarker(s => s?.name === loc.name ? null : { ...loc, _rd: rd })}
              selected={selectedMarker}
            />
          )}

          {/* Searched city pin — globe view, when not a research site */}
          {activeView === 'globe' && pinLabel && !QUICK_LOCATIONS.find(l => l.name === pinLabel) && (
            <div style={{
              position: 'absolute', top: '47%', left: '50%',
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.9))', zIndex: 10,
            }}>
              <div style={{
                background: 'rgba(6,10,24,0.95)', border: '1.5px solid rgba(99,102,241,0.7)',
                borderRadius: 8, padding: '5px 12px', color: '#e2e8f0',
                fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                backdropFilter: 'blur(8px)', marginBottom: 5,
              }}>📍 {pinLabel}</div>
              <div style={{ width: 2, height: 14, background: '#6366f1' }} />
              <div style={{
                width: 12, height: 12, borderRadius: '50%', background: '#6366f1',
                boxShadow: '0 0 0 4px rgba(99,102,241,0.35), 0 0 16px rgba(99,102,241,0.7)',
              }} />
            </div>
          )}

          {/* Marker detail popup */}
          {showMarkers && selectedMarker && (
            <MarkerDetail
              loc={selectedMarker}
              data={selectedMarker._rd}
              onClose={() => setSelectedMarker(null)}
            />
          )}

          {/* Street view hint */}
          {activeView === 'street' && (
            <div style={{
              position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.7)', color: '#94a3b8',
              fontSize: 11, padding: '4px 12px', borderRadius: 20, pointerEvents: 'none', zIndex: 10,
            }}>
              🚶 Drag to look around · Scroll to zoom · Click arrows to walk
            </div>
          )}

          {/* WQI legend — globe view */}
          {showMarkers && Object.keys(researchData).length > 0 && (
            <div style={{
              position: 'absolute', bottom: 10, right: 10,
              background: 'rgba(6,10,24,0.88)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
              padding: '8px 12px', zIndex: 20, pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Water Quality</div>
              {[['#10b981','Excellent >75'],['#0ea5e9','Good 50-75'],['#f59e0b','Fair 25-50'],['#ef4444','Poor <25']].map(([c,l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 4px ${c}` }} />
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{l}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel (unchanged) ──────────────────────────────────────── */}
      <div style={{
        width: 340, flexShrink: 0,
        background: 'rgba(8,12,26,0.98)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            Weather Search
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 9, padding: '0 10px', height: 38,
            }}>
              <Search size={14} color="#64748b" style={{ flexShrink: 0 }} />
              <input
                type="text" placeholder="Any city, country…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                style={{ flex: 1, background: 'none', border: 'none', color: '#f1f5f9', fontSize: 13, outline: 'none', fontFamily: 'inherit', minWidth: 0 }}
              />
              {query && (
                <button onClick={() => { setQuery(''); setWeatherData(null); setError(null); setPinLabel(null) }}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2, display: 'flex' }}>
                  <X size={13} />
                </button>
              )}
            </div>
            <button onClick={() => search()} disabled={loading || !query.trim()} style={{
              padding: '0 14px', height: 38,
              background: loading || !query.trim() ? 'rgba(99,102,241,0.3)' : '#6366f1',
              border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: loading || !query.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>
              {loading ? '…' : 'Go'}
            </button>
          </div>
        </div>

        {/* Research site quick buttons */}
        <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Research Sites</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {QUICK_LOCATIONS.map(loc => {
              const rd  = researchData[loc.name]
              const wqi = rd?.water_quality_index?.index ?? rd?.wqi
              const col = wqi != null ? wqiColor(wqi) : '#475569'
              return (
                <button key={loc.name} onClick={() => { setQuery(loc.name); search(loc.name) }}
                  style={{ padding: '3px 9px', background: weatherData?.name === loc.name ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', border: weatherData?.name === loc.name ? '1px solid rgba(99,102,241,0.4)' : `1px solid ${col}44`, borderRadius: 20, color: weatherData?.name === loc.name ? '#a5b4fc' : col, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ● {loc.name.split(' ')[0]}{wqi != null ? ` ${wqi.toFixed ? wqi.toFixed(0) : wqi}` : ''}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right panel tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {[
            { id: 'weather', label: '🌤 Weather' },
            { id: 'ml',      label: '🧪 ML Insights' },
            { id: 'sites',   label: '📍 All Sites' },
          ].map(t => (
            <button key={t.id} onClick={() => setRightTab(t.id)}
              style={{ flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: rightTab === t.id ? 700 : 400, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: rightTab === t.id ? '#a5b4fc' : '#475569', borderBottom: rightTab === t.id ? '2px solid #6366f1' : '2px solid transparent', transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14, minHeight: 0 }}>
          {rightTab === 'weather' && (
            <>
              {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, color: '#fca5a5', fontSize: 13 }}>{error}</div>}
              {loading && <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: 13 }}><div style={{ fontSize: 28, marginBottom: 10 }}>🌐</div>Fetching weather data…</div>}
              {!loading && !error && !weatherData && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155', fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
                  Search any city for live weather, AQ, AI insights
                  <span style={{ fontSize: 11, color: '#1e293b', marginTop: 8, display: 'block' }}>Research site markers load automatically on the globe</span>
                </div>
              )}
              {!loading && !error && weatherData && <WeatherPanel data={weatherData} />}
            </>
          )}
          {rightTab === 'ml' && <MLResearchPanel weatherData={weatherData} researchData={researchData} />}
          {rightTab === 'sites' && <AllSitesPanel researchData={researchData} />}
        </div>

        {weatherData && rightTab === 'weather' && <AIAssistant weatherData={weatherData} />}
      </div>
    </div>
  )
}
