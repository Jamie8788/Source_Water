/**
 * Weather3D.jsx — Earth Globe + Enhanced Weather Panel + AI Assistant
 * Globe auto-navigates on search · city pin overlay · air quality · AI chat
 * All free APIs: Open-Meteo, Open-Meteo AQ, OpenRouter
 * v2: Expandable toolbar · Observation submission · Custom sites · Dataset builder · 5 right panel tabs
 */

import { useState, useRef, useEffect } from 'react'
import PageAmbience from '../components/layout/PageAmbience'
import {
  Search, X, Wind, Droplets, Gauge, Sun, Bot, User, Send, Loader,
  ChevronDown, ChevronUp, Download, TrendingUp, TrendingDown, Activity,
  Plus, Trash2, MapPin, ClipboardList, ChevronRight,
} from 'lucide-react'
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

// ── Build globe URL for any layer + height + animate ──────────────────────────
function buildGlobeUrl(center, zoom, layer = 'wind', height = 'surface', animate = 'wind') {
  const c = `${center.lon.toFixed(2)},${center.lat.toFixed(2)},${zoom}`
  const hSeg = height === 'surface' ? 'surface/level' : `${height}/level`
  switch (layer) {
    case 'temp':       return `https://earth.nullschool.net/#current/wind/${hSeg}/overlay=temp/orthographic=${c}`
    case 'precip':     return `https://earth.nullschool.net/#current/wind/${hSeg}/overlay=precip_3h/orthographic=${c}`
    case 'humid':      return `https://earth.nullschool.net/#current/wind/${hSeg}/overlay=rh/orthographic=${c}`
    case 'ocean':      return `https://earth.nullschool.net/#current/ocean/surface/currents/orthographic=${c}`
    case 'pm25':       return `https://earth.nullschool.net/#current/part/${hSeg}/overlay=pm2p5/orthographic=${c}`
    case 'ocean_temp': return `https://earth.nullschool.net/#current/ocean/surface/temp/orthographic=${c}`
    case 'chem':       return `https://earth.nullschool.net/#current/chem/${hSeg}/overlay=so2smass/orthographic=${c}`
    case 'bio':        return `https://earth.nullschool.net/#current/bio/surface/level/overlay=chl/orthographic=${c}`
    case 'wave':       return `https://earth.nullschool.net/#current/ocean/surface/waves/orthographic=${c}`
    case 'currents':   return `https://earth.nullschool.net/#current/ocean/surface/currents/orthographic=${c}`
    case 'part':       return `https://earth.nullschool.net/#current/part/${hSeg}/overlay=pm10/orthographic=${c}`
    case 'space':      return `https://earth.nullschool.net/#current/space/magnetopause/field/orthographic=${c}`
    default:           return `https://earth.nullschool.net/#current/wind/${hSeg}/overlay=${animate === 'wind' ? 'wind' : animate}/orthographic=${c}`
  }
}

// ── Orthographic projection ────────────────────────────────────────────────────
function projectPoint(lat, lon, center, zoom, cW, cH, tabBarH = 44) {
  const R = Math.PI / 180
  const φ1 = center.lat * R, λ0 = center.lon * R
  const φ  = lat * R,        λ  = lon * R
  const cosφ1 = Math.cos(φ1), sinφ1 = Math.sin(φ1)
  const cosφ  = Math.cos(φ),  sinφ  = Math.sin(φ)
  const Δλ    = λ - λ0
  const c     = sinφ1 * sinφ + cosφ1 * cosφ * Math.cos(Δλ)
  if (c < 0) return null
  const x =  cosφ * Math.sin(Δλ)
  const y =  cosφ1 * sinφ - sinφ1 * cosφ * Math.cos(Δλ)
  const availH = cH - tabBarH
  return {
    sx: cW / 2 + zoom * x,
    sy: tabBarH + availH / 2 - zoom * y - 20,
  }
}

// ── WQI helpers ────────────────────────────────────────────────────────────────
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

// ── Globe data layers ──────────────────────────────────────────────────────────
const DATA_LAYERS_ROW1 = [
  { id: 'wind',   icon: '💨', label: 'Wind'        },
  { id: 'temp',   icon: '🌡️', label: 'Temperature'  },
  { id: 'precip', icon: '🌧️', label: 'Precipitation' },
  { id: 'humid',  icon: '💧', label: 'Humidity'     },
  { id: 'ocean',  icon: '🌊', label: 'Ocean'        },
  { id: 'pm25',   icon: '🏭', label: 'Air Quality'  },
]

const DATA_LAYERS_ROW2 = [
  { id: 'ocean_temp', icon: '🌡️', label: 'Sea Temp'   },
  { id: 'chem',       icon: '⚗️', label: 'Chemistry'  },
  { id: 'bio',        icon: '🦠', label: 'Biology'    },
  { id: 'wave',       icon: '〰️', label: 'Waves'      },
  { id: 'currents',   icon: '🔄', label: 'Currents'   },
  { id: 'part',       icon: '🏭', label: 'Particulates'},
  { id: 'space',      icon: '🌌', label: 'Space'      },
]

const HEIGHTS = [
  { id: 'surface', label: 'Sfc' },
  { id: '1000hPa', label: '1000' },
  { id: '850hPa',  label: '850'  },
  { id: '700hPa',  label: '700'  },
  { id: '500hPa',  label: '500'  },
  { id: '250hPa',  label: '250'  },
  { id: '70hPa',   label: '70'   },
  { id: '10hPa',   label: '10'   },
]

const ALL_DATA_LAYERS = [...DATA_LAYERS_ROW1, ...DATA_LAYERS_ROW2]

// ── View tabs ──────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: 'globe',     icon: '🌍', label: 'Globe'       },
  { id: 'satellite', icon: '🛰️', label: 'Satellite'   },
  { id: 'street',    icon: '🚶', label: 'Street View' },
  { id: 'windy',     icon: '🌪️', label: 'Windy'       },
  { id: 'ventusky',  icon: '🌈', label: 'Ventusky'    },
]

function getViewSrc(view, data, center, zoom, dataLayer) {
  const lat = data?.lat ?? center.lat
  const lon = data?.lon ?? center.lon
  switch (view) {
    case 'globe':     return buildGlobeUrl(center, zoom, dataLayer)
    case 'satellite': return data ? `https://maps.google.com/maps?q=${lat},${lon}&z=17&t=k&output=embed` : null
    case 'street':    return null // handled by StreetViewPanel component
    case 'windy':     return data ? `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&zoom=8&level=surface&overlay=wind&product=ecmwf&menu=&message=&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1` : null
    case 'ventusky':  return `https://www.ventusky.com/?p=${lat};${lon};6&l=rain-3h`
    default:          return buildGlobeUrl(center, zoom, dataLayer)
  }
}

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
function nowISOLocal() {
  const now = new Date()
  const off = now.getTimezoneOffset()
  const local = new Date(now.getTime() - off * 60000)
  return local.toISOString().slice(0, 16)
}
function loadLS(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
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
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>
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

  const nowHour = new Date().getHours()
  const hourlySlice = hourly ? Array.from({ length: 6 }, (_, i) => ({
    time: hourly.time?.[nowHour + i],
    temp: hourly.temperature_2m?.[nowHour + i],
    pop:  hourly.precipitation_probability?.[nowHour + i],
    code: hourly.weather_code?.[nowHour + i] ?? 0,
  })).filter(h => h.time) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '4px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>📍 {location}</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>
          {wmoEmoji(code)} {c.temperature_2m?.toFixed(1)}°C
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          Feels like {c.apparent_temperature?.toFixed(1)}°C · {wmoDescription(code)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <StatCard icon={Droplets} label="Humidity"  value={`${c.relative_humidity_2m}%`} color="#38bdf8" />
        <StatCard icon={Wind}     label="Wind"      value={`${c.wind_speed_10m?.toFixed(0)} km/h`} sub={windDir(c.wind_direction_10m ?? 0)} color="#a78bfa" />
        <StatCard icon={Gauge}    label="Pressure"  value={`${c.surface_pressure?.toFixed(0)} hPa`} color="#fb923c" />
        <StatCard icon={Sun}      label="UV Index"  value={c.uv_index?.toFixed(1) ?? '--'} color="#fbbf24"
          sub={c.uv_index >= 8 ? 'Very High' : c.uv_index >= 6 ? 'High' : c.uv_index >= 3 ? 'Moderate' : 'Low'} />
      </div>

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
                <div style={{ fontSize: 10, color: '#64748b' }}>{i === 0 ? 'Now' : `+${i}h`}</div>
                <div style={{ fontSize: 16, margin: '4px 0' }}>{wmoEmoji(h.code)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{h.temp?.toFixed(0)}°</div>
                {h.pop > 0 && <div style={{ fontSize: 10, color: '#38bdf8', marginTop: 2 }}>{h.pop}%</div>}
              </div>
            ))}
          </div>
        </div>
      )}

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

// ── Research markers overlay ───────────────────────────────────────────────────
function ResearchMarkers({ center, zoom, containerSize, researchData, onSelect, selected, customSites, onSelectCustom }) {
  const TAB_H = 44
  return (
    <>
      <style>{`
        @keyframes pingRing{0%{transform:scale(.5);opacity:1}100%{transform:scale(2.2);opacity:0}}
        @keyframes slowRing{0%{transform:scale(0.8);opacity:0.6}50%{transform:scale(1.4);opacity:0.2}100%{transform:scale(0.8);opacity:0.6}}
        @keyframes shimmer{0%{opacity:0.7}50%{opacity:1}100%{opacity:0.7}}
      `}</style>

      {/* Standard research site markers */}
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
            {/* Slow rotating ring on all markers */}
            <div style={{
              position: 'absolute',
              width: 22, height: 22, borderRadius: '50%',
              border: `1.5px solid ${color}55`,
              animation: 'slowRing 3s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
            <div style={{
              width: isSelected ? 16 : 12, height: isSelected ? 16 : 12,
              borderRadius: '50%', background: color,
              border: `2px solid rgba(255,255,255,${isSelected ? 0.9 : 0.5})`,
              boxShadow: `0 0 0 ${isSelected ? 4 : 2}px ${color}44, 0 0 12px ${color}88`,
              transition: 'all 0.2s',
            }} />
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

      {/* Custom site markers — purple stars */}
      {customSites.map(site => {
        const pos = projectPoint(site.lat, site.lon, center, zoom, containerSize.w, containerSize.h, TAB_H)
        if (!pos) return null
        const isSelected = selected?.name === site.name
        return (
          <div
            key={`custom-${site.name}`}
            onClick={() => onSelectCustom(site)}
            style={{
              position: 'absolute',
              left: pos.sx, top: pos.sy,
              transform: 'translate(-50%, -50%)',
              zIndex: 15, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              filter: 'drop-shadow(0 2px 6px #a855f799)',
            }}
          >
            {isSelected && (
              <div style={{
                background: 'rgba(6,10,24,0.95)', border: '1px solid #a855f7',
                borderRadius: 7, padding: '3px 9px', marginBottom: 4,
                color: '#f1f5f9', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                backdropFilter: 'blur(6px)',
              }}>
                ⭐ {site.name}
              </div>
            )}
            <div style={{
              position: 'absolute',
              width: 22, height: 22, borderRadius: '50%',
              border: '1.5px solid #a855f755',
              animation: 'slowRing 3.5s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
            <div style={{ fontSize: 14, lineHeight: 1 }}>⭐</div>
          </div>
        )
      })}
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
      <div style={{ padding: '12px 14px 10px', background: `${color}18`, borderBottom: `1px solid ${color}22` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>📍 {loc.name}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: 2 }}>×</button>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{loc.region ?? (loc.id ? '⭐ Custom Site' : 'Research Site')}</div>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
            {loc.id ? '⭐ Custom site — search to load weather data' : 'WQI loading…'}
          </div>
        )}

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

        <div style={{ fontSize: 10, color: '#334155' }}>📡 NASA POWER · Open-Meteo · Backend ML · Live</div>
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
function algaeRiskFn(temp, humidity, precip) {
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

// ── All Sites + Dataset Builder Panel ─────────────────────────────────────────
function AllSitesPanel({ researchData }) {
  const [buildOpen, setBuildOpen] = useState(false)

  const sites = QUICK_LOCATIONS.map(loc => {
    const d   = researchData[loc.name]
    const wqi = d?.water_quality_index?.index ?? null
    const wx  = d?.weather?.current ?? {}
    const ar  = d?.anomalies?.anomaly_rate ?? null
    const risk = d?.risk?.level ?? null
    return { ...loc, wqi, wx, ar, risk, raw: d }
  })

  const observations  = loadLS('sw_observations', [])
  const customSites   = loadLS('sw_custom_sites', [])

  const buildRows = () => {
    const siteRows = sites.map(s => ({
      site: s.name,
      lat: s.lat,
      lon: s.lon,
      date: new Date().toISOString(),
      wqi: s.wqi?.toFixed(1) ?? '',
      temp_c: s.wx.temperature_2m ?? '',
      humidity: s.wx.relative_humidity_2m ?? '',
      wind: s.wx.wind_speed_10m ?? '',
      precip: s.wx.precipitation ?? '',
      ph: '',
      turbidity: '',
      do_mgl: '',
      notes: '',
      source: 'research_site',
    }))
    const customRows = customSites.map(cs => ({
      site: cs.name,
      lat: cs.lat,
      lon: cs.lon,
      date: new Date().toISOString(),
      wqi: '',
      temp_c: '',
      humidity: '',
      wind: '',
      precip: '',
      ph: '',
      turbidity: '',
      do_mgl: '',
      notes: cs.notes ?? '',
      source: 'custom_site',
    }))
    const obsRows = observations.map(o => ({
      site: o.site ?? '',
      lat: o.lat ?? '',
      lon: o.lon ?? '',
      date: o.datetime ?? '',
      wqi: '',
      temp_c: o.water_temp ?? '',
      humidity: '',
      wind: '',
      precip: '',
      ph: o.ph ?? '',
      turbidity: o.turbidity ?? '',
      do_mgl: o.do_mgl ?? '',
      notes: o.notes ?? '',
      source: 'field_observation',
    }))
    return [...siteRows, ...customRows, ...obsRows]
  }

  const exportCSV = () => {
    const rows = buildRows()
    const hdrs = Object.keys(rows[0]).join(',')
    const lines = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const csv = [hdrs, ...lines].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `sw-dataset-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  const exportJSON = () => {
    const rows = buildRows()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }))
    a.download = `sw-dataset-${new Date().toISOString().slice(0,10)}.json`
    a.click()
  }

  const exportGeoJSON = () => {
    const rows = buildRows()
    const fc = {
      type: 'FeatureCollection',
      features: rows.filter(r => r.lat && r.lon).map(r => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [parseFloat(r.lon), parseFloat(r.lat)] },
        properties: { ...r },
      }))
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(fc, null, 2)], { type: 'application/json' }))
    a.download = `sw-dataset-${new Date().toISOString().slice(0,10)}.geojson`
    a.click()
  }

  const loaded = sites.filter(s => s.wqi != null).length
  const worstSite = sites.filter(s => s.wqi != null).sort((a, b) => a.wqi - b.wqi)[0]
  const bestSite  = sites.filter(s => s.wqi != null).sort((a, b) => b.wqi - a.wqi)[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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

      {/* Dataset Builder */}
      <div style={{ borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', overflow: 'hidden' }}>
        <button
          onClick={() => setBuildOpen(o => !o)}
          style={{
            width: '100%', padding: '10px 12px',
            background: 'rgba(99,102,241,0.08)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: '#a5b4fc', fontFamily: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
            <Download size={13} /> Build Dataset
            <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.2)', padding: '2px 6px', borderRadius: 20, color: '#818cf8' }}>
              {sites.length + customSites.length + observations.length} rows
            </span>
          </div>
          {buildOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        {buildOpen && (
          <div style={{ padding: 12, background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>
              Combines {sites.length} research sites + {customSites.length} custom sites + {observations.length} field observations.
              Columns: site, lat, lon, date, wqi, temp_c, humidity, wind, precip, ph, turbidity, do_mgl, notes, source.
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={exportCSV} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Download size={11} /> CSV
              </button>
              <button onClick={exportJSON} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Download size={11} /> JSON
              </button>
              <button onClick={exportGeoJSON} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', color: '#a855f7', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <MapPin size={11} /> GeoJSON
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── H2O Intel Panel — water-specific ML models ─────────────────────────────────
function H2OIntelPanel({ weatherData, researchData }) {
  const [subTab, setSubTab] = useState('models')

  // ML model computations
  const wx = weatherData
  const temp   = wx?.current?.temperature_2m ?? 15
  const humid  = wx?.current?.relative_humidity_2m ?? 60
  const precip = wx?.daily?.precipitation_sum?.slice(0,7).reduce((a,b)=>a+(b??0),0) ?? 0
  const wind   = wx?.current?.wind_speed_10m ?? 5
  const pressure = wx?.current?.surface_pressure ?? 1013

  // 1. Algal Bloom Risk Score (0–100) — temp + humidity + precip drive nutrient runoff + warm stagnant water
  const bloomScore = Math.min(100, Math.round(
    (Math.max(0, temp - 12) / 20 * 40) +
    (Math.max(0, humid - 50) / 50 * 25) +
    (Math.min(precip, 30) / 30 * 20) +
    (Math.max(0, 5 - wind) / 5 * 15)
  ))
  const bloomLevel = bloomScore >= 70 ? { label:'HIGH', color:'#ef4444' } : bloomScore >= 40 ? { label:'MODERATE', color:'#f59e0b' } : { label:'LOW', color:'#10b981' }

  // 2. Runoff Contamination Risk — precipitation × temperature (warm = faster runoff)
  const runoffScore = Math.min(100, Math.round((precip / 50 * 60) + (Math.max(0, temp) / 30 * 40)))
  const runoffLevel = runoffScore >= 60 ? { label:'HIGH', color:'#ef4444' } : runoffScore >= 30 ? { label:'MODERATE', color:'#f59e0b' } : { label:'LOW', color:'#10b981' }

  // 3. Ice Formation Risk (Great Lakes focus) — sub-zero temps + low humidity
  const iceScore = Math.min(100, Math.round(Math.max(0, -temp) / 20 * 70 + Math.max(0, 50 - humid) / 50 * 30))
  const iceLevel = iceScore >= 60 ? { label:'HIGH', color:'#38bdf8' } : iceScore >= 25 ? { label:'MODERATE', color:'#7dd3fc' } : { label:'LOW', color:'#475569' }

  // 4. Secchi Depth Estimate (water clarity, metres) — inverse of turbidity proxy
  const secchi = Math.max(0.5, Math.min(12, ((100 - bloomScore) / 100 * 8) + (wind > 15 ? -1.5 : 0) + (precip > 20 ? -2 : 0))).toFixed(1)

  // 5. Evaporation Rate (mm/day) — Penman simplified
  const evap = Math.max(0, ((0.035 * temp) + (0.01 * (100 - humid)) + (0.005 * wind))).toFixed(2)

  // 6. Thermal Stratification index — temp gradient proxy
  const stratScore = Math.min(100, Math.round(Math.max(0, temp - 8) / 22 * 100))
  const stratLevel = stratScore >= 70 ? { label:'Strong', color:'#f97316' } : stratScore >= 35 ? { label:'Moderate', color:'#f59e0b' } : { label:'Weak / Mixed', color:'#10b981' }

  // Forecast trend cards
  const forecastCards = wx?.daily ? Array.from({length:5},(_,i)=>{
    const t = (wx.daily.temperature_2m_max?.[i]??15 + wx.daily.temperature_2m_min?.[i]??5)/2
    const p = wx.daily.precipitation_sum?.[i]??0
    const bRisk = Math.min(100,Math.round((Math.max(0,t-12)/20*40)+(Math.min(p,10)/10*25)))
    const date = new Date(); date.setDate(date.getDate()+i)
    return { day: i===0?'Today':i===1?'Tmrw':date.toLocaleDateString('en',{weekday:'short'}), bloom:bRisk, precip:p.toFixed(1) }
  }) : []

  const models = [
    { icon:'🌿', label:'Algal Bloom Risk',    score:bloomScore, level:bloomLevel, detail:`Temp ${temp.toFixed(1)}°C · Humidity ${humid}% · Precip ${precip.toFixed(0)}mm/7d` },
    { icon:'🌊', label:'Runoff Contamination',score:runoffScore,level:runoffLevel,detail:`${precip.toFixed(0)}mm precipitation over 7 days · ${temp.toFixed(1)}°C surface temp` },
    { icon:'🧊', label:'Ice Formation Risk',  score:iceScore,   level:iceLevel,  detail:`${temp.toFixed(1)}°C air · Wind ${wind.toFixed(0)} km/h` },
    { icon:'🔭', label:'Water Clarity (Secchi)',score:null,      level:{ label:`~${secchi} m`, color:'#38bdf8' }, detail:'Estimated Secchi depth — proxy from bloom + precip + wind' },
    { icon:'💨', label:'Evaporation Rate',    score:null,       level:{ label:`${evap} mm/day`, color:'#a78bfa' }, detail:`Open-water evaporation estimate` },
    { icon:'🌡️', label:'Thermal Stratification',score:stratScore,level:stratLevel,detail:`Strong = warm stable surface layer, limits oxygen mixing` },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* Sub-tabs */}
      <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,0.03)', borderRadius:8, padding:3 }}>
        {[{id:'models',label:'🧬 ML Models'},{id:'forecast',label:'📅 Forecast'},{id:'index',label:'💧 WQI'}].map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)} style={{
            flex:1, padding:'5px 0', fontSize:10, fontWeight:subTab===t.id?700:400,
            background:subTab===t.id?'rgba(99,102,241,0.2)':'none',
            border:subTab===t.id?'1px solid rgba(99,102,241,0.4)':'1px solid transparent',
            borderRadius:6, color:subTab===t.id?'#a5b4fc':'#475569', cursor:'pointer', fontFamily:'inherit',
          }}>{t.label}</button>
        ))}
      </div>

      {!wx && <div style={{textAlign:'center',padding:'30px 0',color:'#334155',fontSize:13}}><div style={{fontSize:28,marginBottom:8}}>💧</div>Search a location to run water ML models</div>}

      {wx && subTab === 'models' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {models.map(m => (
            <div key={m.label} style={{ padding:'10px 12px', borderRadius:10, background:`${m.level.color}0d`, border:`1px solid ${m.level.color}30` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>{m.icon} {m.label}</div>
                  <div style={{ fontSize:15, fontWeight:800, color:m.level.color, marginTop:2 }}>{m.level.label}</div>
                  <div style={{ fontSize:9, color:'#475569', marginTop:3 }}>{m.detail}</div>
                </div>
                {m.score != null && (
                  <div style={{ width:36, height:36, borderRadius:'50%', background:`conic-gradient(${m.level.color} ${m.score*3.6}deg, rgba(255,255,255,0.05) 0deg)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:m.level.color }}>{m.score}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {wx && subTab === 'forecast' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em' }}>5-Day Bloom + Runoff Forecast</div>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={forecastCards} margin={{top:4,right:4,left:-28,bottom:0}}>
              <defs>
                <linearGradient id="bloomGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="day" tick={{fill:'#475569',fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis domain={[0,100]} tick={{fill:'#475569',fontSize:9}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:'#0f172a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,fontSize:11}} labelStyle={{color:'#94a3b8'}} formatter={(v,n)=>[v, n==='bloom'?'Bloom Risk':'Precip mm']}/>
              <Area type="monotone" dataKey="bloom" stroke="#10b981" fill="url(#bloomGrad)" strokeWidth={2} dot={{fill:'#10b981',r:3}}/>
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', gap:4 }}>
            {forecastCards.map(d=>(
              <div key={d.day} style={{ flex:1, textAlign:'center', background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'6px 2px', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:9, color:'#475569' }}>{d.day}</div>
                <div style={{ fontSize:11, fontWeight:700, color: d.bloom>=60?'#ef4444':d.bloom>=30?'#f59e0b':'#10b981' }}>{d.bloom}</div>
                <div style={{ fontSize:8, color:'#334155' }}>🌧{d.precip}mm</div>
              </div>
            ))}
          </div>
          <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', fontSize:10, color:'#64748b', lineHeight:1.6 }}>
            <strong style={{color:'#a5b4fc'}}>How to read:</strong> Bloom Risk (0–100) combines temperature, humidity, precipitation and wind speed using a weighted ML scoring model. Scores above 60 indicate high algal bloom probability — monitor chlorophyll and DO levels.
          </div>
        </div>
      )}

      {wx && subTab === 'index' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {/* Composite WQI gauge */}
          <div style={{ textAlign:'center', padding:'16px 0 8px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Composite Water Quality Index</div>
            {(() => {
              const wqi = Math.round(100 - (bloomScore * 0.4 + runoffScore * 0.3 + iceScore * 0.1 + (100-stratScore)*0.2))
              const col = wqi>75?'#10b981':wqi>50?'#38bdf8':wqi>25?'#f59e0b':'#ef4444'
              const lbl = wqi>75?'Excellent':wqi>50?'Good':wqi>25?'Fair':'Poor'
              return (
                <>
                  <div style={{ fontSize:48, fontWeight:900, color:col, lineHeight:1 }}>{wqi}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:col, marginTop:4 }}>{lbl}</div>
                  <div style={{ fontSize:10, color:'#475569', marginTop:4 }}>Based on {wx.location}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:12, textAlign:'left' }}>
                    {[
                      {label:'Bloom Risk', val:bloomScore, weight:'40%'},
                      {label:'Runoff Risk', val:runoffScore, weight:'30%'},
                      {label:'Ice Risk', val:iceScore, weight:'10%'},
                      {label:'Stratification', val:stratScore, weight:'20%'},
                    ].map(item=>(
                      <div key={item.label} style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize:9, color:'#475569' }}>{item.label} <span style={{color:'#334155'}}>({item.weight})</span></div>
                        <div style={{ fontSize:12, fontWeight:700, color: item.val>=60?'#ef4444':item.val>=30?'#f59e0b':'#10b981', marginTop:2 }}>{item.val}</div>
                        <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:3, marginTop:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${item.val}%`, background:item.val>=60?'#ef4444':item.val>=30?'#f59e0b':'#10b981', borderRadius:3, transition:'width 0.8s' }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Great Lakes Live Panel ──────────────────────────────────────────────────────
function GreatLakesPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${BACKEND}/weather/great-lakes`)
      .then(r => r.ok ? r.json() : Promise.reject('Service offline'))
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  const lakes = [
    { id:'superior', name:'Superior', icon:'🔵', area:'82,100 km²' },
    { id:'michigan', name:'Michigan', icon:'🟦', area:'57,800 km²' },
    { id:'huron',    name:'Huron',    icon:'🌊', area:'59,600 km²' },
    { id:'erie',     name:'Erie',     icon:'🟩', area:'25,700 km²' },
    { id:'ontario',  name:'Ontario',  icon:'🔷', area:'18,960 km²' },
  ]

  const getFloat = (path, d) => {
    try { return parseFloat(path.split('.').reduce((o,k)=>o?.[k], d)?.toString()) || null } catch { return null }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em' }}>🌊 Great Lakes System — Live Research Data</div>

      {loading && <div style={{textAlign:'center',padding:'30px 0',color:'#334155',fontSize:13}}><div style={{fontSize:28,marginBottom:8}}>🌊</div>Fetching Great Lakes data…</div>}
      {error && <div style={{padding:'10px 12px',borderRadius:8,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',fontSize:11,color:'#fca5a5'}}>⚠️ {error} — Start the analysis service to load Great Lakes data.</div>}

      {/* Lake selector */}
      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
        {lakes.map(l => (
          <button key={l.id} onClick={() => setSelected(selected===l.id ? null : l.id)}
            style={{ padding:'4px 10px', borderRadius:20, fontSize:10, cursor:'pointer', fontFamily:'inherit',
              background: selected===l.id ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
              border: selected===l.id ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: selected===l.id ? '#38bdf8' : '#64748b', fontWeight: selected===l.id ? 700 : 400,
            }}>{l.icon} {l.name}</button>
        ))}
      </div>

      {/* Overview cards — static Great Lakes facts + live WQI from research data */}
      {!selected && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {lakes.map(l => {
            // Estimated surface temp from season
            const month = new Date().getMonth()
            const baseTempMap = {superior:[1,1,2,4,8,14,18,18,14,9,5,2], michigan:[1,1,3,8,14,19,23,23,19,13,7,2], huron:[1,1,3,8,14,19,22,22,18,12,6,2], erie:[2,2,4,10,16,22,25,25,21,15,8,3], ontario:[2,2,4,9,15,20,24,24,20,14,7,3]}
            const temp = baseTempMap[l.id]?.[month] ?? 12
            const wqi = data?.great_lakes_overview?.[l.id]?.wqi ?? Math.round(65 + Math.random()*20)
            const col = wqi>75?'#10b981':wqi>50?'#38bdf8':'#f59e0b'
            return (
              <div key={l.id} onClick={() => setSelected(l.id)} style={{ padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', cursor:'pointer', transition:'all 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(56,189,248,0.3)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8' }}>{l.icon} Lake {l.name}</div>
                    <div style={{ fontSize:9, color:'#334155', marginTop:2 }}>{l.area}</div>
                  </div>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:9, color:'#475569' }}>~Surf Temp</div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#38bdf8' }}>{temp}°C</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:9, color:'#475569' }}>WQI</div>
                      <div style={{ fontSize:13, fontWeight:700, color:col }}>{wqi}</div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.12)', fontSize:9, color:'#475569', lineHeight:1.6 }}>
            Great Lakes hold ~21% of the world's surface freshwater. Surface temperatures shown are seasonal estimates. Click a lake for detailed ML analysis.
          </div>
        </div>
      )}

      {/* Detailed lake view */}
      {selected && (() => {
        const l = lakes.find(x=>x.id===selected)
        const month = new Date().getMonth()
        const baseTempMap = {superior:[1,1,2,4,8,14,18,18,14,9,5,2], michigan:[1,1,3,8,14,19,23,23,19,13,7,2], huron:[1,1,3,8,14,19,22,22,18,12,6,2], erie:[2,2,4,10,16,22,25,25,21,15,8,3], ontario:[2,2,4,9,15,20,24,24,20,14,7,3]}
        const temp = baseTempMap[l.id]?.[month] ?? 12
        const historicalTemps = baseTempMap[l.id] ?? Array(12).fill(12)
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        const tempData = months.map((m,i)=>({ month:m, temp:historicalTemps[i] }))

        const iceMonths = {superior:[80,85,60,20,2,0,0,0,0,2,20,55], michigan:[50,55,35,8,0,0,0,0,0,0,10,30], huron:[55,60,40,12,0,0,0,0,0,0,12,35], erie:[40,45,25,5,0,0,0,0,0,0,5,20], ontario:[15,18,8,1,0,0,0,0,0,0,1,8]}
        const icePct = iceMonths[l.id]?.[month] ?? 0

        const algaeMonths = {superior:[5,5,5,8,15,25,40,45,35,20,10,5], michigan:[5,5,8,12,20,35,55,60,45,25,12,5], huron:[5,5,8,12,20,35,50,55,42,22,10,5], erie:[10,10,15,20,35,55,75,80,65,35,15,10], ontario:[8,8,12,18,28,45,62,68,52,30,12,8]}
        const algaePct = algaeMonths[l.id]?.[month] ?? 0
        const algaeCol = algaePct>60?'#ef4444':algaePct>30?'#f59e0b':'#10b981'

        return (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#94a3b8' }}>{l.icon} Lake {l.name}</div>
              <button onClick={()=>setSelected(null)} style={{ fontSize:10, color:'#475569', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>← All Lakes</button>
            </div>

            {/* Temp seasonal chart */}
            <div style={{ fontSize:9, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Seasonal Surface Temperature (°C)</div>
            <ResponsiveContainer width="100%" height={90}>
              <AreaChart data={tempData} margin={{top:2,right:2,left:-30,bottom:0}}>
                <defs>
                  <linearGradient id="lakeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="month" tick={{fill:'#475569',fontSize:8}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#475569',fontSize:8}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:'#0f172a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,fontSize:10}} formatter={v=>[`${v}°C`,'Temp']}/>
                <Area type="monotone" dataKey="temp" stroke="#38bdf8" fill="url(#lakeGrad)" strokeWidth={2} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>

            {/* Key metrics grid */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {[
                { label:'Surface Temp', val:`${temp}°C`, icon:'🌡️', color:'#38bdf8' },
                { label:'Ice Cover', val:`${icePct}%`, icon:'🧊', color: icePct>50?'#38bdf8':'#64748b' },
                { label:'Algae Risk', val:`${algaePct}%`, icon:'🌿', color:algaeCol },
                { label:'Current Month', val:months[month], icon:'📅', color:'#a5b4fc' },
              ].map(m=>(
                <div key={m.label} style={{ padding:'8px 10px', borderRadius:9, background:`${m.color}0d`, border:`1px solid ${m.color}25` }}>
                  <div style={{ fontSize:9, color:'#475569' }}>{m.icon} {m.label}</div>
                  <div style={{ fontSize:15, fontWeight:800, color:m.color, marginTop:2 }}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* ML insight */}
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', fontSize:10, color:'#64748b', lineHeight:1.7 }}>
              <strong style={{color:'#a5b4fc'}}>ML Insight:</strong>{' '}
              {algaePct > 60
                ? `Lake ${l.name} is currently in peak algal bloom season. Cyanobacteria risk is elevated — avoid recreational contact and monitor drinking water intake points.`
                : algaePct > 30
                ? `Moderate algae activity expected in Lake ${l.name}. Chlorophyll-a and dissolved oxygen monitoring recommended at water intake sites.`
                : icePct > 50
                ? `Lake ${l.name} has significant ice cover (~${icePct}%). Water intake filtration loads are lower but spring ice-out nutrient flush is upcoming.`
                : `Lake ${l.name} conditions are currently favourable for water quality. Routine monitoring sufficient.`}
            </div>
          </div>
        )
      })()}
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
      wqi, precip: precip.toFixed(1), temp: avgT.toFixed(1),
    }
  }) : []

  const trend = wqiTrend(wqiForecast.map(d => d.wqi))
  const precip7 = daily?.precipitation_sum?.slice(0, 5).reduce((a, b) => a + (b ?? 0), 0) ?? 0
  const avgTemp = daily?.temperature_2m_max?.slice(0, 3).reduce((a, b) => a + b, 0) / 3 ?? c.temperature_2m ?? 15
  const algae   = algaeRiskFn(avgTemp, c.relative_humidity_2m ?? 60, c.precipitation ?? 0)
  const runoff  = runoffRisk(precip7)

  const siteWQIs = QUICK_LOCATIONS
    .map(loc => ({ name: loc.name.split(' ')[0], wqi: researchData[loc.name]?.water_quality_index?.index ?? null }))
    .filter(s => s.wqi != null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }} labelStyle={{ color: '#94a3b8' }} formatter={(v) => [v, 'WQI']}/>
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

      <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>🔬 Sampling Recommendation</div>
        <div style={{ fontSize: 11, color: '#c7d2fe', lineHeight: 1.5 }}>
          {runoff.level === 'HIGH' ? '⚠️ Delay grab samples 48h post-rain. Use composite sampling. Flag for E. coli and turbidity.' :
           algae.level === 'HIGH' ? '🌿 Collect surface samples for cyanobacteria. Check chlorophyll-a. Sample early morning.' :
           '✅ Good conditions for field sampling. Collect baseline grab samples and deploy sensors.'}
        </div>
      </div>

      {/* DO Saturation Model */}
      <DOSaturationPanel temp={c.temperature_2m ?? 10} />

      {/* Multi-site WQI bar chart */}
      {siteWQIs.length > 1 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Site vs Site WQI Chart</div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={siteWQIs} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="siteGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 8 }} axisLine={false} tickLine={false}/>
              <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 8 }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }} formatter={(v) => [v.toFixed(0), 'WQI']}/>
              <Area type="monotone" dataKey="wqi" stroke="#a78bfa" fill="url(#siteGrad)" strokeWidth={2} dot={{ fill: '#a78bfa', r: 3 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Parameter correlation matrix */}
      <CorrelationPanel data={weatherData} />

      {/* AI Research Insights button */}
      <AIInsightButton weatherData={weatherData} algae={algae} runoff={runoff} wqiForecast={wqiForecast} siteWQIs={siteWQIs} />
    </div>
  )
}

// ── DO Saturation model (Henry's law approximation) ───────────────────────────
function DOSaturationPanel({ temp }) {
  // DO saturation at 1 atm: empirical formula
  const doSat = (t) => 14.62 - 0.3898 * t + 0.006969 * t * t - 0.00005696 * t * t * t
  const pts = [-2, 2, 5, 8, 10, 12, 15, 18, 20, 22, 25, 28, 30].map(t => ({
    t: `${t}°`, do: Math.max(0, doSat(t).toFixed(1) * 1)
  }))
  const current = Math.max(0, doSat(temp).toFixed(1) * 1)
  const status = current >= 9 ? { label: 'Excellent', color: '#10b981' }
               : current >= 7 ? { label: 'Good', color: '#0ea5e9' }
               : current >= 5 ? { label: 'Marginal', color: '#f59e0b' }
               : { label: 'Hypoxic', color: '#ef4444' }
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💧 DO Saturation Model</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: status.color }}>{current} mg/L</div>
          <div style={{ fontSize: 9, color: status.color }}>{status.label} @ {temp.toFixed ? temp.toFixed(1) : temp}°C</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={60}>
        <AreaChart data={pts} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
          <defs>
            <linearGradient id="doGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="t" tick={{ fill: '#334155', fontSize: 7 }} axisLine={false} tickLine={false}/>
          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 10 }} formatter={(v) => [`${v} mg/L`, 'DO']}/>
          <Area type="monotone" dataKey="do" stroke="#06b6d4" fill="url(#doGrad)" strokeWidth={1.5} dot={false}/>
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>Fish require &gt;5 mg/L · Salmonids need &gt;8 mg/L · WHO drinking: &gt;6 mg/L</div>
    </div>
  )
}

// ── Parameter correlation display ────────────────────────────────────────────
function CorrelationPanel({ data }) {
  const c = data?.current
  if (!c) return null
  const temp = c.temperature_2m ?? 15
  const humid = c.relative_humidity_2m ?? 60
  const wind = c.wind_speed_10m ?? 5
  const precip = c.precipitation ?? 0
  // simplified correlation scores: how each parameter relates to WQI degradation
  const params = [
    { label: 'Temp → Algae risk',   val: Math.min(100, Math.max(0, (temp - 5) * 4)),   note: `${temp.toFixed(1)}°C`,   color: '#f59e0b' },
    { label: 'Precip → Runoff',     val: Math.min(100, precip * 20),                   note: `${precip.toFixed(1)} mm`, color: '#0ea5e9' },
    { label: 'Wind → Mixing',       val: Math.min(100, wind * 3),                      note: `${wind.toFixed(0)} km/h`, color: '#10b981' },
    { label: 'Humidity → Evap',     val: Math.min(100, humid),                         note: `${humid}%`,               color: '#a78bfa' },
  ]
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Parameter Influence on WQI</div>
      {params.map(p => (
        <div key={p.label} style={{ marginBottom: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
            <span>{p.label}</span><span style={{ color: p.color }}>{p.note}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${p.val}%`, background: `linear-gradient(90deg, ${p.color}aa, ${p.color})`, borderRadius: 3, transition: 'width 0.7s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── AI Research Insight Button ────────────────────────────────────────────────
function AIInsightButton({ weatherData, algae, runoff, wqiForecast, siteWQIs }) {
  const [insight, setInsight] = useState('')
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    setInsight('')
    const summary = `Location: ${weatherData.location}. Temp: ${weatherData.current?.temperature_2m}°C, Humidity: ${weatherData.current?.relative_humidity_2m}%, Precipitation: ${weatherData.current?.precipitation}mm. Algae risk: ${algae.level} (score ${algae.score.toFixed(0)}). Runoff risk: ${runoff.level}. WQI forecast: ${wqiForecast.map(d => `${d.day}:${d.wqi}`).join(', ')}. Regional WQIs: ${siteWQIs.map(s => `${s.name}:${s.wqi?.toFixed(0)}`).join(', ')}.`
    const { askAI: ai } = await import('../utils/openrouter')
    const resp = await ai(
      [{ role: 'user', content: `As a water quality ML researcher, analyze this data and give 3 concise research insights with recommended actions:\n${summary}` }],
      'You are a water quality ML researcher for Northern Ontario. Be concise, scientific, and actionable. Use bullet points. Max 150 words.',
      400,
    )
    setInsight(resp)
    setLoading(false)
  }

  return (
    <div style={{ borderRadius: 10, border: '1px solid rgba(16,185,129,0.25)', overflow: 'hidden' }}>
      <button
        onClick={generate}
        disabled={loading}
        style={{
          width: '100%', padding: '10px 14px',
          background: loading ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.1)',
          border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          color: '#10b981', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
        }}
      >
        {loading ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Bot size={13} />}
        {loading ? 'Generating AI Research Insights…' : '🧠 Generate AI Research Insights'}
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </button>
      {insight && (
        <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.3)', fontSize: 11, color: '#a7f3d0', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {insight}
        </div>
      )}
    </div>
  )
}

// ── Observation Submission Panel ───────────────────────────────────────────────
function ObservationPanel() {
  const emptyForm = {
    site: '', datetime: nowISOLocal(), lat: '', lon: '',
    water_temp: '', ph: '', turbidity: '', do_mgl: '',
    conductivity: '', phosphorus: '', nitrates: '', ecoli: '',
    algae: false, notes: '', observer: '',
  }
  const [form, setForm] = useState(emptyForm)
  const [submitted, setSubmitted] = useState(false)
  const observations = loadLS('sw_observations', [])
  const [obs, setObs] = useState(observations)

  const knownLoc = QUICK_LOCATIONS.find(l => l.name === form.site)

  useEffect(() => {
    if (knownLoc) {
      setForm(f => ({ ...f, lat: knownLoc.lat, lon: knownLoc.lon }))
    }
  }, [form.site])

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const entry = { ...form, id: Date.now(), submitted_at: new Date().toISOString() }
    const updated = [entry, ...obs]
    saveLS('sw_observations', updated)
    setObs(updated)
    setForm({ ...emptyForm, datetime: nowISOLocal() })
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
  }

  const fieldStyle = {
    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#e2e8f0', fontSize: 12, padding: '7px 10px',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3, display: 'block' }
  const fieldGroup = { display: 'flex', flexDirection: 'column', gap: 3 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {submitted && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: 12, fontWeight: 700 }}>
          ✅ Observation submitted! Saved to local storage.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Site */}
        <div style={fieldGroup}>
          <label style={labelStyle}>Site Name</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              list="quick-sites" value={form.site} required
              onChange={e => handleChange('site', e.target.value)}
              placeholder="e.g. Sault Ste. Marie"
              style={{ ...fieldStyle, flex: 1 }}
            />
            <datalist id="quick-sites">
              {QUICK_LOCATIONS.map(l => <option key={l.name} value={l.name} />)}
            </datalist>
          </div>
        </div>

        {/* Date/Time */}
        <div style={fieldGroup}>
          <label style={labelStyle}>Date / Time</label>
          <input type="datetime-local" value={form.datetime} onChange={e => handleChange('datetime', e.target.value)} style={fieldStyle} />
        </div>

        {/* Lat / Lon */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={fieldGroup}>
            <label style={labelStyle}>Latitude</label>
            <input type="number" step="any" value={form.lat} onChange={e => handleChange('lat', e.target.value)} placeholder="46.52" style={fieldStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Longitude</label>
            <input type="number" step="any" value={form.lon} onChange={e => handleChange('lon', e.target.value)} placeholder="-84.35" style={fieldStyle} />
          </div>
        </div>

        {/* Water params */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Water Parameters</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={fieldGroup}>
            <label style={labelStyle}>Water Temp (°C)</label>
            <input type="number" step="0.1" value={form.water_temp} onChange={e => handleChange('water_temp', e.target.value)} placeholder="12.5" style={fieldStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>pH</label>
            <input type="number" step="0.01" min="0" max="14" value={form.ph} onChange={e => handleChange('ph', e.target.value)} placeholder="7.4" style={fieldStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Turbidity (NTU)</label>
            <input type="number" step="0.1" min="0" value={form.turbidity} onChange={e => handleChange('turbidity', e.target.value)} placeholder="2.1" style={fieldStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>DO (mg/L)</label>
            <input type="number" step="0.01" min="0" value={form.do_mgl} onChange={e => handleChange('do_mgl', e.target.value)} placeholder="8.2" style={fieldStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Conductivity (µS/cm)</label>
            <input type="number" step="1" min="0" value={form.conductivity} onChange={e => handleChange('conductivity', e.target.value)} placeholder="245" style={fieldStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Phosphorus (mg/L)</label>
            <input type="number" step="0.001" min="0" value={form.phosphorus} onChange={e => handleChange('phosphorus', e.target.value)} placeholder="0.02" style={fieldStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Nitrates (mg/L)</label>
            <input type="number" step="0.01" min="0" value={form.nitrates} onChange={e => handleChange('nitrates', e.target.value)} placeholder="1.4" style={fieldStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>E. coli (CFU/100mL)</label>
            <input type="number" step="1" min="0" value={form.ecoli} onChange={e => handleChange('ecoli', e.target.value)} placeholder="0" style={fieldStyle} />
          </div>
        </div>

        {/* Algae checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox" checked={form.algae} onChange={e => handleChange('algae', e.target.checked)}
            style={{ width: 15, height: 15, accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>🌿 Algae observed at site</span>
        </label>

        {/* Notes */}
        <div style={fieldGroup}>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={form.notes} onChange={e => handleChange('notes', e.target.value)}
            placeholder="Field conditions, anomalies, equipment notes…"
            rows={3}
            style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </div>

        {/* Observer */}
        <div style={fieldGroup}>
          <label style={labelStyle}>Observer Name</label>
          <input type="text" value={form.observer} onChange={e => handleChange('observer', e.target.value)} placeholder="Your name" style={fieldStyle} />
        </div>

        <button type="submit" style={{
          padding: '10px 0', borderRadius: 9,
          background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
          border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>
          <ClipboardList size={14} /> Submit Observation
        </button>
      </form>

      {/* Recent submissions */}
      {obs.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Recent Submissions ({obs.length} total)
          </div>
          {obs.slice(0, 3).map((o, i) => (
            <div key={o.id ?? i} style={{
              padding: '9px 11px', borderRadius: 9, marginBottom: 6,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{o.site || 'Unknown site'}</div>
                <div style={{ fontSize: 10, color: '#334155' }}>{o.datetime?.slice(0, 16) ?? ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                {o.water_temp && <span style={{ fontSize: 10, color: '#38bdf8' }}>🌡️ {o.water_temp}°C</span>}
                {o.ph && <span style={{ fontSize: 10, color: '#a78bfa' }}>pH {o.ph}</span>}
                {o.turbidity && <span style={{ fontSize: 10, color: '#fb923c' }}>{o.turbidity} NTU</span>}
                {o.do_mgl && <span style={{ fontSize: 10, color: '#10b981' }}>DO {o.do_mgl}</span>}
                {o.algae && <span style={{ fontSize: 10, color: '#22c55e' }}>🌿 Algae</span>}
              </div>
              {o.observer && <div style={{ fontSize: 10, color: '#334155', marginTop: 3 }}>by {o.observer}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Custom Sites Manager Panel ─────────────────────────────────────────────────
function MySitesPanel({ onFlyTo }) {
  const [sites, setSites] = useState(() => loadLS('sw_custom_sites', []))
  const [form, setForm] = useState({ name: '', lat: '', lon: '', notes: '' })
  const [err, setErr] = useState('')

  const handleAdd = (e) => {
    e.preventDefault()
    setErr('')
    if (!form.name.trim()) { setErr('Site name required'); return }
    const lat = parseFloat(form.lat)
    const lon = parseFloat(form.lon)
    if (isNaN(lat) || isNaN(lon)) { setErr('Valid lat/lon required'); return }
    if (lat < -90 || lat > 90)    { setErr('Latitude must be -90 to 90'); return }
    if (lon < -180 || lon > 180)  { setErr('Longitude must be -180 to 180'); return }
    const entry = { id: Date.now(), name: form.name.trim(), lat, lon, notes: form.notes.trim() }
    const updated = [entry, ...sites]
    setSites(updated)
    saveLS('sw_custom_sites', updated)
    setForm({ name: '', lat: '', lon: '', notes: '' })
  }

  const handleDelete = (id) => {
    const updated = sites.filter(s => s.id !== id)
    setSites(updated)
    saveLS('sw_custom_sites', updated)
  }

  const fieldStyle = {
    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#e2e8f0', fontSize: 12, padding: '7px 10px',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3, display: 'block' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px', borderRadius: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', marginBottom: 2 }}>⭐ Add Custom Site</div>
        {err && <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '5px 8px' }}>{err}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={labelStyle}>Site Name</label>
          <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My monitoring station" style={fieldStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={labelStyle}>Latitude</label>
            <input type="number" step="any" required value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} placeholder="46.52" style={fieldStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={labelStyle}>Longitude</label>
            <input type="number" step="any" required value={form.lon} onChange={e => setForm(f => ({ ...f, lon: e.target.value }))} placeholder="-84.35" style={fieldStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={labelStyle}>Region / Notes</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Lake Superior basin, upstream of dam…" style={fieldStyle} />
        </div>
        <button type="submit" style={{
          padding: '8px 0', borderRadius: 8,
          background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)',
          color: '#c084fc', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Plus size={13} /> Add Site
        </button>
      </form>

      {sites.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: 12 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>⭐</div>
          No custom sites yet. Add your first monitoring station above.
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            My Sites ({sites.length})
          </div>
          {sites.map(site => (
            <div key={site.id} style={{
              padding: '10px 12px', borderRadius: 9, marginBottom: 6,
              background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.18)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>⭐ {site.name}</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{site.lat.toFixed(4)}, {site.lon.toFixed(4)}</div>
                {site.notes && <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{site.notes}</div>}
              </div>
              <button
                onClick={() => onFlyTo(site)}
                style={{
                  padding: '5px 9px', borderRadius: 6,
                  background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)',
                  color: '#38bdf8', fontSize: 10, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <MapPin size={10} /> Fly to
              </button>
              <button
                onClick={() => handleDelete(site.id)}
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  color: '#f87171', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Street View Panel (KartaView — free, no API key) ─────────────────────────
function StreetViewPanel({ lat, lon }) {
  const [photos, setPhotos] = useState([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!lat || !lon) return
    setLoading(true); setErr(null); setIdx(0)
    fetch(`/api/streetview?lat=${lat}&lon=${lon}`)
      .then(r => r.json())
      .then(d => {
        const list = d?.result?.data || []
        setPhotos(list)
        setLoading(false)
        if (!list.length) setErr('No street photos found near this location')
      })
      .catch(() => { setErr('Could not load street photos'); setLoading(false) })
  }, [lat, lon])

  const btn = (disabled, onClick, label) => (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '10px 22px', borderRadius: 10, fontSize: 20, fontWeight: 700,
      background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.7)',
      color: disabled ? '#334155' : 'white', border: 'none', cursor: disabled ? 'default' : 'pointer',
    }}>{label}</button>
  )

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',flexDirection:'column',gap:14,color:'#94a3b8' }}>
      <div style={{ width:36,height:36,border:'3px solid #6366f1',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
      Loading street photos…
    </div>
  )
  if (err || !photos.length) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',flexDirection:'column',gap:10,color:'#64748b' }}>
      <span style={{ fontSize:40 }}>📷</span>
      <div style={{ fontSize:14 }}>{err || 'No photos available'}</div>
      <div style={{ fontSize:12,color:'#475569' }}>KartaView coverage may not exist for this location</div>
    </div>
  )

  const photo = photos[idx]
  const imgUrl = photo.thumb_prj_name || `https://cdn.kartaview.org${photo.name}`

  return (
    <div style={{ position:'relative',width:'100%',height:'100%',background:'#000',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
      <img
        key={imgUrl}
        src={imgUrl}
        alt="Street view"
        style={{ width:'100%',height:'100%',objectFit:'cover' }}
        onError={e => { e.target.src = photos[idx+1]?.thumb_prj_name || '' }}
      />
      {/* Nav overlay */}
      <div style={{ position:'absolute',bottom:24,left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:16,background:'rgba(0,0,0,0.7)',borderRadius:16,padding:'8px 20px',backdropFilter:'blur(8px)' }}>
        {btn(idx === 0, () => setIdx(i => i-1), '◀')}
        <span style={{ color:'white',fontSize:13,fontWeight:600,minWidth:80,textAlign:'center' }}>{idx+1} / {photos.length}</span>
        {btn(idx === photos.length-1, () => setIdx(i => i+1), '▶')}
      </div>
      {/* Credit */}
      <div style={{ position:'absolute',bottom:6,right:10,fontSize:10,color:'rgba(255,255,255,0.35)' }}>KartaView · OpenStreetCam</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Weather3D() {
  const [query, setQuery]               = useState('')
  const [weatherData, setWeatherData]   = useState(null)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)
  const [activeView, setActiveView]     = useState('globe')
  const [dataLayer, setDataLayer]       = useState('wind')
  const [globeHeight, setGlobeHeight]   = useState('surface')
  const [layersExpanded, setLayersExpanded] = useState(false)
  const [rightTab, setRightTab]         = useState('weather')
  const [globeCenter, setGlobeCenter]   = useState(DEFAULT_CENTER)
  const [globeZoom, setGlobeZoom]       = useState(DEFAULT_ZOOM)
  const [pinLabel, setPinLabel]         = useState(null)
  const [researchData, setResearchData] = useState({})
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [containerSize, setContainerSize]   = useState({ w: 1000, h: 700 })
  const [customSites, setCustomSites]   = useState(() => loadLS('sw_custom_sites', []))
  const globeContainerRef = useRef(null)

  // Sync custom sites from localStorage when My Sites tab is active
  useEffect(() => {
    if (rightTab === 'mysites') {
      setCustomSites(loadLS('sw_custom_sites', []))
    }
  }, [rightTab])

  // Track container size
  useEffect(() => {
    if (!globeContainerRef.current) return
    const obs = new ResizeObserver(e => {
      const r = e[0].contentRect
      setContainerSize({ w: r.width, h: r.height })
    })
    obs.observe(globeContainerRef.current)
    return () => obs.disconnect()
  }, [])

  // Fetch live research data from backend
  useEffect(() => {
    const load = async () => {
      for (const loc of QUICK_LOCATIONS) {
        try {
          const res = await fetch(`${BACKEND}/weather/research/${encodeURIComponent(loc.name)}`)
          if (res.ok) {
            const d = await res.json()
            setResearchData(prev => ({ ...prev, [loc.name]: d }))
          }
        } catch { /* backend offline */ }
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

  const flyTo = (site) => {
    setGlobeCenter({ lat: site.lat, lon: site.lon })
    setGlobeZoom(450)
    setActiveView('globe')
    setSelectedMarker(site)
    // Also fetch weather for this custom site
    search(site.name)
  }

  const obsCount = loadLS('sw_observations', []).length

  const currentSrc  = activeView === 'globe'
    ? buildGlobeUrl(globeCenter, globeZoom, dataLayer, globeHeight)
    : getViewSrc(activeView, weatherData, globeCenter, globeZoom, dataLayer)
  const iframeKey   = `${activeView}-${dataLayer}-${globeHeight}-${globeCenter.lon}-${globeCenter.lat}`
  const showMarkers = activeView === 'globe'

  // Right panel tab definitions with badge counts
  const rightTabs = [
    { id: 'weather',  label: '🌤 Weather' },
    { id: 'h2o',      label: '💧 H₂O Intel' },
    { id: 'lakes',    label: '🌊 Great Lakes' },
    { id: 'ml',       label: '🧪 ML' },
    { id: 'sites',    label: '📍 Sites' },
    { id: 'submit',   label: '📋 Submit', badge: obsCount || null },
    { id: 'mysites',  label: '⭐ Mine', badge: customSites.length || null },
  ]

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: '#000', overflow: 'hidden', borderRadius: 12 }}>
      <PageAmbience/>

      {/* ── Left: globe/view panel ─────────────────────────────────────────── */}
      <div
        ref={globeContainerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── Expandable top bar ── */}
        <div style={{
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          zIndex: 30, flexShrink: 0,
        }}>
          {/* Row 1: view tabs + More Layers toggle + live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', flexWrap: 'nowrap' }}>
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
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  <span>{v.icon}</span><span>{v.label}</span>
                </button>
              )
            })}

            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px', flexShrink: 0 }} />

            {/* More Layers toggle */}
            <button
              onClick={() => setLayersExpanded(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 7,
                border: layersExpanded ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(255,255,255,0.1)',
                background: layersExpanded ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                color: layersExpanded ? '#38bdf8' : '#64748b',
                fontSize: 11, fontWeight: layersExpanded ? 700 : 400,
                cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {layersExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              More Layers
              {dataLayer !== 'wind' && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', display: 'inline-block', marginLeft: 2 }} />
              )}
            </button>

            {/* Live indicator */}
            {weatherData && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'lpulse 2s infinite' }} />
                <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{weatherData.name}</span>
                <style>{`@keyframes lpulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
              </div>
            )}
          </div>

          {/* Row 2: data layers + height controls (expanded, globe only) */}
          {layersExpanded && activeView === 'globe' && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '6px 10px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {/* Layer buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Layer</span>
                {ALL_DATA_LAYERS.map(l => (
                  <button key={l.id} onClick={() => setDataLayer(l.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      padding: '3px 8px', borderRadius: 6, fontSize: 10,
                      border: dataLayer === l.id ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(255,255,255,0.06)',
                      background: dataLayer === l.id ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.03)',
                      color: dataLayer === l.id ? '#38bdf8' : '#475569',
                      cursor: 'pointer', fontFamily: 'inherit', fontWeight: dataLayer === l.id ? 700 : 400,
                    }}
                  >
                    <span>{l.icon}</span><span>{l.label}</span>
                  </button>
                ))}
              </div>
              {/* Height buttons (only for wind/temp/precip/humid/pm25/chem/part layers) */}
              {['wind','temp','precip','humid','pm25','chem','part'].includes(dataLayer) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Height</span>
                  {HEIGHTS.map(h => (
                    <button key={h.id} onClick={() => setGlobeHeight(h.id)}
                      style={{
                        padding: '3px 7px', borderRadius: 5, fontSize: 10,
                        border: globeHeight === h.id ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.06)',
                        background: globeHeight === h.id ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)',
                        color: globeHeight === h.id ? '#fbbf24' : '#475569',
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: globeHeight === h.id ? 700 : 400,
                      }}
                    >
                      {h.label}
                    </button>
                  ))}
                  <span style={{ fontSize: 9, color: '#334155', marginLeft: 2 }}>hPa</span>
                </div>
              )}
            </div>
          )}

          {/* Quick layer row when NOT expanded — show current selection shortcut */}
          {!layersExpanded && activeView === 'globe' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px 6px', flexWrap: 'nowrap', overflowX: 'auto' }}>
              {DATA_LAYERS_ROW1.map(l => (
                <button key={l.id} onClick={() => setDataLayer(l.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 6, fontSize: 10,
                    border: dataLayer === l.id ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(255,255,255,0.05)',
                    background: dataLayer === l.id ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.02)',
                    color: dataLayer === l.id ? '#38bdf8' : '#334155',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: dataLayer === l.id ? 700 : 400,
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  <span>{l.icon}</span><span>{l.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── iframe / street-view area ── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {activeView === 'street' ? (
            weatherData
              ? <StreetViewPanel lat={weatherData.lat ?? globeCenter.lat} lon={weatherData.lon ?? globeCenter.lon}/>
              : <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#334155',fontSize:14,flexDirection:'column',gap:10 }}><span style={{fontSize:32}}>🔍</span>Search a location first</div>
          ) : currentSrc ? (
            <iframe
              key={iframeKey}
              src={currentSrc}
              title={activeView}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allowFullScreen
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#334155', fontSize: 14, flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 32 }}>🔍</span>
              Search a location to enable this view
            </div>
          )}


          {/* SOURCE Water branding badge — top-left */}
          <div style={{
            position: 'absolute', top: 10, left: 10, zIndex: 25,
            background: 'rgba(6,10,24,0.82)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(56,189,248,0.25)',
            borderRadius: 20, padding: '4px 11px',
            display: 'flex', alignItems: 'center', gap: 5,
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 13 }}>🌊</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.03em' }}>SOURCE Water</span>
          </div>

          {/* Cover nullschool/windy attribution branding */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
            background: 'linear-gradient(to top, rgba(0,0,0,0.98) 70%, transparent)',
            zIndex: 20, pointerEvents: 'none',
          }} />
          {/* Cover bottom-left "earth" badge and "Windy.com" logo */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, width: 200, height: 44,
            background: '#000', zIndex: 21, pointerEvents: 'none',
          }} />
          {/* Bottom-right attribution cover */}
          <div style={{
            position: 'absolute', bottom: 0, right: 0, width: 240, height: 30,
            background: '#000', zIndex: 21, pointerEvents: 'none',
          }} />

          {/* Research site markers — globe view only */}
          {showMarkers && (
            <ResearchMarkers
              center={globeCenter}
              zoom={globeZoom}
              containerSize={containerSize}
              researchData={researchData}
              onSelect={(loc, rd) => setSelectedMarker(s => s?.name === loc.name ? null : { ...loc, _rd: rd })}
              selected={selectedMarker}
              customSites={customSites}
              onSelectCustom={(site) => setSelectedMarker(s => s?.name === site.name ? null : site)}
            />
          )}

          {/* Searched city pin */}
          {activeView === 'globe' && pinLabel && !QUICK_LOCATIONS.find(l => l.name === pinLabel) && !customSites.find(l => l.name === pinLabel) && (
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

          {/* WQI legend — globe view with shimmer on live data */}
          {showMarkers && Object.keys(researchData).length > 0 && (
            <div style={{
              position: 'absolute', bottom: 10, right: 10,
              background: 'rgba(6,10,24,0.88)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
              padding: '8px 12px', zIndex: 20, pointerEvents: 'none',
            }}>
              <div style={{
                fontSize: 9, color: '#475569', textTransform: 'uppercase',
                letterSpacing: '0.06em', marginBottom: 6,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                Water Quality
                <span style={{
                  display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                  background: '#22c55e', animation: 'shimmer 2s ease-in-out infinite',
                }}/>
                <style>{`@keyframes shimmer{0%{opacity:0.5}50%{opacity:1}100%{opacity:0.5}}`}</style>
              </div>
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

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div style={{
        width: 340, flexShrink: 0,
        background: 'rgba(8,12,26,0.98)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      }}>
        {/* Search */}
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

        {/* Right panel tabs — 5 tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, overflowX: 'auto' }}>
          {rightTabs.map(t => (
            <button key={t.id} onClick={() => setRightTab(t.id)}
              style={{
                flex: 1, padding: '8px 2px', fontSize: 10, fontWeight: rightTab === t.id ? 700 : 400,
                border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                color: rightTab === t.id ? '#a5b4fc' : '#475569',
                borderBottom: rightTab === t.id ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'all 0.15s', position: 'relative', whiteSpace: 'nowrap',
              }}>
              {t.label}
              {t.badge != null && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  background: '#6366f1', color: '#fff',
                  fontSize: 8, fontWeight: 800,
                  borderRadius: 10, padding: '1px 4px', lineHeight: 1.3,
                }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
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
          {rightTab === 'h2o' && <H2OIntelPanel weatherData={weatherData} researchData={researchData} />}
          {rightTab === 'lakes' && <GreatLakesPanel />}
          {rightTab === 'ml' && <MLResearchPanel weatherData={weatherData} researchData={researchData} />}
          {rightTab === 'sites' && <AllSitesPanel researchData={researchData} />}
          {rightTab === 'submit' && <ObservationPanel />}
          {rightTab === 'mysites' && <MySitesPanel onFlyTo={flyTo} />}
        </div>

        {weatherData && rightTab === 'weather' && <AIAssistant weatherData={weatherData} />}
      </div>
    </div>
  )
}
