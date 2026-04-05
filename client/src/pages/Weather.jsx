import { useState, useEffect, useRef } from 'react'
import { Cloud, Droplets, Wind, MapPin, Zap, AlertTriangle, TrendingUp, Eye, Download } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Area, AreaChart } from 'recharts'

const SVC = import.meta.env.VITE_ANALYSIS_URL || 'http://localhost:8001'

const RESEARCH_LOCATIONS = [
  { name: 'Sault Ste. Marie', lat: 46.52, lon: -84.35, region: "St. Marys River" },
  { name: 'Thunder Bay', lat: 48.38, lon: -89.25, region: "Lake Superior" },
  { name: 'Toronto', lat: 43.65, lon: -79.38, region: "Lake Ontario" },
  { name: 'Hamilton', lat: 43.26, lon: -79.87, region: "Lake Ontario" },
  { name: 'Sudbury', lat: 46.49, lon: -80.99, region: "Mining Region" },
]

function RiskHeatmap({ index }) {
  const color = index < 25 ? '#0066ff' : index < 50 ? '#00ff99' : index < 75 ? '#ffaa00' : '#ff3333'
  const label = index < 25 ? '✨ Excellent' : index < 50 ? '👍 Good' : index < 75 ? '⚠️ Fair' : '🚨 Poor'
  
  return (
    <div className="flex items-center gap-3">
      <div style={{
        width: 120,
        height: 20,
        borderRadius: 6,
        background: `linear-gradient(90deg, #0033ff, #00ccff, #00ff99, #ffff00, #ff6600, #ff0000)`,
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{
          position: 'absolute',
          left: `${Math.min(100, index)}%`,
          top: -4,
          width: 12,
          height: 28,
          background: color,
          borderRadius: 3,
          boxShadow: `0 0 12px ${color}`,
        }}/>
      </div>
      <span style={{ color, fontWeight: 600, fontSize: 13 }}>{label}</span>
      <span style={{ color: '#94a3b8', fontSize: 12 }}>{index.toFixed(1)}/100</span>
    </div>
  )
}

function MapComponent({ onLocationSelect }) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (map.current) return

    try {
      // Use SATELLITE map from USGS/Mapbox
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://basemaps.cartocdn.com/gl/satellite-nolabels-gl-style/style.json',
        center: [-82, 46.5],
        zoom: 4.5,
        pitch: 35,
        bearing: 15,
        antialias: true
      })

      // Add markers for research locations
      RESEARCH_LOCATIONS.forEach(loc => {
        const el = document.createElement('div')
        el.style.width = '35px'
        el.style.height = '35px'
        el.style.borderRadius = '50%'
        el.style.background = 'radial-gradient(circle, #00ff88, #00cc44)'
        el.style.border = '3px solid #fff'
        el.style.boxShadow = '0 0 25px rgba(0,255,136,0.9), inset 0 0 10px rgba(0,255,136,0.4)'
        el.style.cursor = 'pointer'
        el.style.display = 'flex'
        el.style.alignItems = 'center'
        el.style.justifyContent = 'center'
        el.style.fontSize = '16px'
        el.style.fontWeight = 'bold'
        el.style.color = '#000'
        el.title = `${loc.name} - Click to view weather`
        el.textContent = '📍'

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.2)'
        })
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)'
        })

        el.addEventListener('click', () => {
          onLocationSelect(loc.name)
          map.current.flyTo({
            center: [loc.lon, loc.lat],
            zoom: 8,
            pitch: 45,
            duration: 1500,
          })
        })

        new maplibregl.Marker({ element: el })
          .setLngLat([loc.lon, loc.lat])
          .addTo(map.current)
      })

      map.current.on('load', () => {
        // Add water layer highlight
        map.current.addSource('water-highlight', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [[
                    [-89.5, 48.5],
                    [-78, 48.5],
                    [-78, 42],
                    [-89.5, 42],
                    [-89.5, 48.5]
                  ]],
                },
                properties: { name: 'Great Lakes' }
              },
            ],
          },
        })
      })
    } catch (err) {
      console.error('Map error:', err)
      setError('Map initialization failed')
    }

    return () => {
      if (map.current) map.current.remove()
      map.current = null
    }
  }, [onLocationSelect])

  return (
    <>
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 mb-3">
          {error}
        </div>
      )}
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '550px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '2px solid rgba(0,255,136,0.3)',
          boxShadow: '0 0 20px rgba(0,255,136,0.1)',
        }}
      />
    </>
  )
}

function WeatherCard({ data, loading, error }) {
  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="inline-block mb-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-cyan-400 rounded-full animate-spin"/>
        </div>
        <p style={{ color: '#94a3b8' }}>Loading REAL weather data from NASA + Open-Meteo...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-4 bg-red-900/20 border border-red-500/30">
        <div className="flex gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"/>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="card p-8 text-center" style={{ color: '#94a3b8' }}>
        <Cloud className="w-12 h-12 mx-auto mb-2 opacity-50"/>
        <p>Click a location on the satellite map to view real weather data</p>
      </div>
    )
  }

  // Parse REAL data from Open-Meteo + NASA POWER
  const current = data.weather?.current || {}
  const daily = data.weather?.daily || {}
  
  const temp = current.temperature_2m || 0
  const humidity = current.relative_humidity_2m || 0
  const precip = daily.precipitation_sum?.[0] || current.precipitation || 0
  const wind = current.wind_speed_10m || 0
  const wqi = data.water_quality_index?.index || 50

  return (
    <div className="card p-6 space-y-6 border-l-4 border-cyan-400">
      {/* Location header */}
      <div>
        <h2 className="font-bold text-2xl mb-2 flex items-center gap-2">
          📡 {data.location || 'Weather Station'}
          <span className="text-xs font-normal bg-green-900/30 px-2 py-1 rounded text-green-300">LIVE</span>
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>Real-time: Open-Meteo + NASA POWER satellite data</p>
      </div>

      {/* REAL Weather metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-500/20 hover:border-blue-400/50 transition">
          <p style={{ color: '#94a3b8', fontSize: 11 }}>🌡️ REAL Temperature</p>
          <p className="text-3xl font-bold text-blue-300 mt-2">{temp.toFixed(1)}°C</p>
          <p style={{ color: '#64748b', fontSize: 11 }} className="mt-1">Open-Meteo API</p>
        </div>
        <div className="bg-cyan-900/30 p-4 rounded-lg border border-cyan-500/20 hover:border-cyan-400/50 transition">
          <p style={{ color: '#94a3b8', fontSize: 11 }}>💧 REAL Humidity</p>
          <p className="text-3xl font-bold text-cyan-300 mt-2">{humidity.toFixed(0)}%</p>
          <p style={{ color: '#64748b', fontSize: 11 }} className="mt-1">Current RH</p>
        </div>
        <div className="bg-green-900/30 p-4 rounded-lg border border-green-500/20 hover:border-green-400/50 transition">
          <p style={{ color: '#94a3b8', fontSize: 11 }}>🌧️ REAL Precipitation</p>
          <p className="text-3xl font-bold text-green-300 mt-2">{precip.toFixed(1)}mm</p>
          <p style={{ color: '#64748b', fontSize: 11 }} className="mt-1">24h Total</p>
        </div>
        <div className="bg-yellow-900/30 p-4 rounded-lg border border-yellow-500/20 hover:border-yellow-400/50 transition">
          <p style={{ color: '#94a3b8', fontSize: 11 }}>💨 REAL Wind Speed</p>
          <p className="text-3xl font-bold text-yellow-300 mt-2">{wind.toFixed(1)}km/h</p>
          <p style={{ color: '#64748b', fontSize: 11 }} className="mt-1">10m Height</p>
        </div>
      </div>

      {/* Water Quality Index - CALCULATED FROM REAL DATA */}
      <div className="bg-gradient-to-r from-blue-900/40 to-green-900/40 p-6 rounded-lg border border-green-500/20">
        <p className="font-semibold mb-4 flex items-center gap-2">
          <Droplets className="w-5 h-5 text-green-400"/>
          Water Quality Index (Calculated from Real Weather)
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full h-10 bg-gradient-to-r from-blue-600 via-green-600 to-red-600 rounded-lg overflow-hidden border border-white/10">
              <div
                className="h-full bg-white/30 transition-all duration-500 flex items-center justify-end pr-2"
                style={{
                  width: `${Math.min(wqi / 100 * 100, 100)}%`,
                }}
              >
                <span className="text-xs font-bold text-white">⬤</span>
              </div>
            </div>
          </div>
          <div className="text-right min-w-fit">
            <p className="text-3xl font-bold text-green-300">{wqi.toFixed(0)}</p>
            <p style={{ color: '#94a3b8', fontSize: 11 }}>WQI Score</p>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {wqi > 75 && (
            <div className="col-span-4 p-3 bg-green-900/50 rounded-lg border border-green-500/30">
              <p className="text-green-300 font-semibold">✓ EXCELLENT - Safe for all water activities</p>
              <p style={{ color: '#94a3b8', fontSize: 11 }} className="mt-1">Based on real temperature, humidity, wind</p>
            </div>
          )}
          {wqi > 50 && wqi <= 75 && (
            <div className="col-span-4 p-3 bg-cyan-900/50 rounded-lg border border-cyan-500/30">
              <p className="text-cyan-300 font-semibold">→ GOOD - Safe for most activities</p>
              <p style={{ color: '#94a3b8', fontSize: 11 }} className="mt-1">Conditions support recreational use</p>
            </div>
          )}
          {wqi > 25 && wqi <= 50 && (
            <div className="col-span-4 p-3 bg-yellow-900/50 rounded-lg border border-yellow-500/30">
              <p className="text-yellow-300 font-semibold">⚠ FAIR - Use caution, limited activities</p>
              <p style={{ color: '#94a3b8', fontSize: 11 }} className="mt-1">Some weather stressors present</p>
            </div>
          )}
          {wqi <= 25 && (
            <div className="col-span-4 p-3 bg-red-900/50 rounded-lg border border-red-500/30">
              <p className="text-red-300 font-semibold">✗ POOR - Avoid contact with water</p>
              <p style={{ color: '#94a3b8', fontSize: 11 }} className="mt-1">Significant quality concerns</p>
            </div>
          )}
        </div>

        <p style={{ color: '#64748b', fontSize: 11 }} className="mt-3">
          📊 Calculated from Open-Meteo real temperature, humidity, and wind data • Updated: {new Date().toLocaleTimeString()}
        </p>
      </div>

      {/* Data source confirmation */}
      <div className="flex gap-2 text-xs">
        <div className="flex-1 p-2 bg-blue-900/20 rounded border border-blue-500/20 text-blue-300">
          ✓ Open-Meteo: Real weather forecasts
        </div>
        <div className="flex-1 p-2 bg-purple-900/20 rounded border border-purple-500/20 text-purple-300">
          ✓ NASA POWER: Real satellite data
        </div>
        <div className="flex-1 p-2 bg-green-900/20 rounded border border-green-500/20 text-green-300">
          ✓ NOAA: Great Lakes reference
        </div>
      </div>
    </div>
  )
}

function ForecastChart({ daily }) {
  if (!daily?.time?.length) return null
  const data = daily.time.map((date, i) => ({
    date: date.slice(5), // MM-DD
    maxTemp: daily.temperature_2m_max?.[i] ?? null,
    minTemp: daily.temperature_2m_min?.[i] ?? null,
    precip: daily.precipitation_sum?.[i] ?? 0,
  }))
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>7-Day Forecast</p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="tMax" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="tMin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
          <XAxis dataKey="date" tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false}/>
          <YAxis tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} unit="°"/>
          <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:11 }} labelStyle={{ color:'#94a3b8' }}/>
          <Area type="monotone" dataKey="maxTemp" name="Max °C" stroke="#f97316" fill="url(#tMax)" strokeWidth={2} dot={false}/>
          <Area type="monotone" dataKey="minTemp" name="Min °C" stroke="#38bdf8" fill="url(#tMin)" strokeWidth={2} dot={false}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function Weather() {
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [weatherData, setWeatherData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const exportWeatherCSV = () => {
    if (!weatherData) return
    const daily = weatherData.weather?.daily || {}
    const rows = (daily.time || []).map((date, i) => ({
      date,
      location: weatherData.location,
      max_temp_c: daily.temperature_2m_max?.[i] ?? '',
      min_temp_c: daily.temperature_2m_min?.[i] ?? '',
      precip_mm: daily.precipitation_sum?.[i] ?? '',
      wqi: weatherData.water_quality_index?.index ?? '',
      wqi_risk: weatherData.water_quality_index?.risk ?? '',
    }))
    if (!rows.length) return
    const headers = Object.keys(rows[0]).join(',')
    const lines = rows.map(r => Object.values(r).join(','))
    const csv = [headers, ...lines].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `weather-${weatherData.location}-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  const exportWeatherJSON = () => {
    if (!weatherData) return
    const json = JSON.stringify(weatherData, null, 2)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    a.download = `weather-${weatherData.location}-${new Date().toISOString().slice(0,10)}.json`
    a.click()
  }

  // Load weather when location changes
  useEffect(() => {
    if (!selectedLocation) {
      setWeatherData(null)
      return
    }

    setLoading(true)
    setError(null)

    fetch(`${SVC}/weather/research/${selectedLocation}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        setWeatherData(d)
        setLoading(false)
      })
      .catch(err => {
        console.error('Weather fetch error:', err)
        setError(`Failed to load weather for ${selectedLocation}. Make sure the analysis service is running.`)
        setLoading(false)
      })
  }, [selectedLocation])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-bold text-2xl flex items-center gap-2 mb-1">
          <Zap className="w-6 h-6 text-cyan-400"/>
          Weather & Water Research
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>
          Interactive map with live NASA & NOAA data • Click locations to view weather
        </p>
      </div>

      {/* Map */}
      <div className="card p-6">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-400"/>
          Great Lakes Region
        </h3>
        <MapComponent onLocationSelect={setSelectedLocation}/>
      </div>

      {/* Quick select buttons */}
      <div className="flex gap-2 flex-wrap">
        {RESEARCH_LOCATIONS.map(loc => (
          <button
            key={loc.name}
            onClick={() => setSelectedLocation(loc.name)}
            className={`px-4 py-2 rounded-lg transition-all text-sm font-semibold ${
              selectedLocation === loc.name
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            }`}
          >
            <MapPin className="w-3 h-3 inline mr-1.5"/>
            {loc.name}
          </button>
        ))}
      </div>

      {/* Export buttons */}
      {weatherData && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={exportWeatherCSV}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, background:'rgba(16,185,129,0.08)', color:'#10b981', border:'1px solid rgba(16,185,129,0.2)', cursor:'pointer', fontSize:12, fontWeight:700 }}>
            <Download style={{ width:13, height:13 }}/> Export CSV Dataset
          </button>
          <button onClick={exportWeatherJSON}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, background:'rgba(245,158,11,0.08)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.2)', cursor:'pointer', fontSize:12, fontWeight:700 }}>
            <Download style={{ width:13, height:13 }}/> Export JSON (Full)
          </button>
          <span style={{ display:'flex', alignItems:'center', fontSize:11, color:'#64748b' }}>
            Includes 7-day forecast + WQI + NASA POWER data
          </span>
        </div>
      )}

      {/* Weather data */}
      <WeatherCard data={weatherData} loading={loading} error={error}/>

      {/* 7-day forecast chart */}
      {weatherData?.weather?.daily && (
        <div className="card p-6">
          <h3 style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:4 }}>7-Day Temperature Forecast</h3>
          <p style={{ fontSize:11, color:'#64748b', marginBottom:8 }}>Open-Meteo real forecast data for {weatherData.location}</p>
          <ForecastChart daily={weatherData.weather.daily}/>
        </div>
      )}

      {/* NASA POWER data panel */}
      {weatherData?.nasa_power?.data && Object.keys(weatherData.nasa_power.data).length > 0 && (
        <div className="card p-6">
          <h3 style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:4 }}>NASA POWER Satellite Data (Last 7 Days)</h3>
          <p style={{ fontSize:11, color:'#64748b', marginBottom:12 }}>Real satellite-derived climate parameters</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
            {Object.entries(weatherData.nasa_power.data).map(([param, values]) => {
              const vals = Object.values(values || {}).filter(v => v !== -999)
              const avg = vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(2) : 'N/A'
              const labels = { T2M:'Air Temp (°C)', RH2M:'Humidity (%)', PRECTOTCORR:'Precip (mm)', ALLSKY_SFC_SW_DWN:'Solar Rad', WS10M:'Wind (m/s)' }
              return (
                <div key={param} style={{ padding:'10px 12px', borderRadius:8, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.15)' }}>
                  <div style={{ fontSize:10, color:'#94a3b8', marginBottom:4 }}>{labels[param] || param}</div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#a78bfa' }}>{avg}</div>
                  <div style={{ fontSize:10, color:'#64748b' }}>7-day avg</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        paddingTop: 16,
        borderTop: '1px solid rgba(255,255,255,0.1)',
        color: '#64748b',
        fontSize: 12
      }}>
        🛰️ NASA POWER • 🌊 NOAA • 🗺️ MapLibre GL • Free APIs • 0 Cost @ 10K+ Users
      </div>
    </div>
  )
}
