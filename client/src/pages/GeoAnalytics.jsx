import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import PageAmbience from '../components/layout/PageAmbience'

const GEOAI_TABS = {
  water_detection: { label: '🛰️ Water Detection', icon: '💧' },
  wetlands: { label: '🌿 Wetland Mapping', icon: '🌱' },
  changes: { label: '📊 Change Detection', icon: '📈' },
  quality: { label: '🔮 Quality Prediction', icon: '✨' },
  landcover: { label: '🗺️ Land Cover', icon: '🌍' },
  satellite: { label: '⬇️ Satellite Data', icon: '📡' }
}

const MODE_LABELS = {
  real_computed: { label: 'REAL COMPUTED', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' },
  rule_based: { label: 'RULE-BASED', cls: 'bg-amber-500/20 text-amber-200 border-amber-400/40' },
  ml_inference: { label: 'ML INFERENCE', cls: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40' },
  demo_placeholder: { label: 'DEMO PLACEHOLDER', cls: 'bg-rose-500/20 text-rose-200 border-rose-400/40' }
}

const STATUS_LABELS = {
  real_computed: { label: 'REAL COMPUTED', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' },
  experimental: { label: 'EXPERIMENTAL', cls: 'bg-orange-500/20 text-orange-200 border-orange-400/40' },
  not_implemented: { label: 'NOT IMPLEMENTED', cls: 'bg-rose-500/20 text-rose-200 border-rose-400/40' }
}

function Badge({ text, className }) {
  return (
    <span className={`px-2 py-1 text-[10px] font-semibold rounded border ${className}`}>
      {text}
    </span>
  )
}

function ResultCard({ title, icon, data, loading }) {
  if (loading) {
    return (
      <div className="p-6 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{icon}</span>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-indigo-500/20 rounded w-3/4"/>
          <div className="h-4 bg-indigo-500/20 rounded w-1/2"/>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 rounded-lg bg-gradient-to-br from-slate-500/10 to-slate-600/10 border border-slate-500/20">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{icon}</span>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <p className="text-slate-400">No data available</p>
      </div>
    )
  }

  const modeMeta = MODE_LABELS[data.mode]
  const statusMeta = STATUS_LABELS[data.implementation_status]
  const warnings = Array.isArray(data.warnings) ? data.warnings : []
  const visuals = data.visual_validation || null
  const summary = data.processing_summary || null
  const sceneCount = data.scene_count ?? data.imagery_source?.scene_count ?? null
  const rgbImage = data.rgb_image || visuals?.rgb_preview_url || null
  const waterMaskImage = data.water_mask_image || visuals?.water_mask_url || null
  const overlayImage = data.overlay_image || data.wetland_overlay_image || visuals?.wetland_mask_url || null
  const primaryOverlay = waterMaskImage || overlayImage
  const ndwiVisual = data.ndwi_visual || visuals?.ndwi_preview_url || null
  const selectedScene = data.imagery_source?.selected_scene || null
  const sceneDate = selectedScene?.datetime
    ? new Date(selectedScene.datetime).toLocaleDateString()
    : '--'
  const cloudCover = selectedScene?.cloud_cover ?? '--'
  const ndwiMean = data.spectral_indices?.ndwi?.mean
  const isWetland = typeof data.wetland_presence === 'boolean' || data.method?.toLowerCase?.().includes('wetland')
  const isQuality = typeof data.quality_label === 'string' || data.method?.toLowerCase?.().includes('quality')
  const areaDisplay = data.area_km2 ?? data.wetland_area_km2 ?? data.wetland_area ?? data.before_after?.change_km2 ?? '--'
  const heroTitle = isWetland
    ? 'Spectral wetland detection'
    : isQuality
      ? 'AI-assisted spectral water quality estimation'
      : 'AI-assisted satellite water detection'
  const overlayCaption = isWetland
    ? 'RGB base image with semi-transparent wetland mask overlay'
    : 'RGB base image with semi-transparent blue water mask overlay'

  const visualBlocks = []
  if (ndwiVisual) {
    visualBlocks.push({ label: 'NDWI Visual', url: ndwiVisual })
  }

  if (visuals?.period_a?.water_mask_url) {
    visualBlocks.push({ label: 'Period A Mask', url: visuals.period_a.water_mask_url })
  }
  if (visuals?.period_b?.water_mask_url) {
    visualBlocks.push({ label: 'Period B Mask', url: visuals.period_b.water_mask_url })
  }

  return (
    <div className="p-6 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 hover:border-indigo-500/40 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {modeMeta && <Badge text={modeMeta.label} className={modeMeta.cls} />}
        {statusMeta && <Badge text={statusMeta.label} className={statusMeta.cls} />}
      </div>

      {(data.message || data.method) && (
        <p className="text-sm text-slate-200 mb-3">
          {data.method || data.message}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-900/50 rounded border border-slate-700/50 p-2">
          <p className="text-[11px] text-slate-400">Status</p>
          <p className="text-sm text-white font-semibold">{data.status || 'reported'}</p>
        </div>
        <div className="bg-slate-900/50 rounded border border-slate-700/50 p-2">
          <p className="text-[11px] text-slate-400">Water Area</p>
          <p className="text-sm text-white font-semibold">{areaDisplay}</p>
        </div>
        <div className="bg-slate-900/50 rounded border border-slate-700/50 p-2">
          <p className="text-[11px] text-slate-400">Scenes</p>
          <p className="text-sm text-white font-semibold">{sceneCount ?? '--'}</p>
        </div>
        <div className="bg-slate-900/50 rounded border border-slate-700/50 p-2">
          <p className="text-[11px] text-slate-400">API Version</p>
          <p className="text-sm text-white font-semibold">{data.api_version || '--'}</p>
        </div>
      </div>

      {isQuality && (
        <div className="mb-4 p-3 rounded border border-emerald-400/30 bg-emerald-500/10">
          <h4 className="text-xs text-emerald-200 uppercase tracking-wide mb-2">Water Quality Result</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-2">
              <p className="text-[11px] text-slate-400">Quality</p>
              <p className="text-sm text-white font-semibold">{data.quality_label || '--'}</p>
            </div>
            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-2">
              <p className="text-[11px] text-slate-400">NDWI</p>
              <p className="text-sm text-white font-semibold">{typeof data.ndwi === 'number' ? data.ndwi.toFixed(4) : '--'}</p>
            </div>
            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-2">
              <p className="text-[11px] text-slate-400">NDVI</p>
              <p className="text-sm text-white font-semibold">{typeof data.ndvi === 'number' ? data.ndvi.toFixed(4) : '--'}</p>
            </div>
            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-2">
              <p className="text-[11px] text-slate-400">Turbidity Proxy</p>
              <p className="text-sm text-white font-semibold">{typeof data.turbidity_proxy === 'number' ? data.turbidity_proxy.toFixed(4) : '--'}</p>
            </div>
          </div>
        </div>
      )}

      {isWetland && (
        <div className="mb-4 p-3 rounded border border-teal-400/30 bg-teal-500/10">
          <h4 className="text-xs text-teal-200 uppercase tracking-wide mb-2">Wetland Presence</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-2">
              <p className="text-[11px] text-slate-400">Classification</p>
              <p className="text-sm text-white font-semibold">{data.classification || '--'}</p>
            </div>
            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-2">
              <p className="text-[11px] text-slate-400">Wetland Area (km²)</p>
              <p className="text-sm text-white font-semibold">{data.wetland_area_km2 ?? data.wetland_area ?? '--'}</p>
            </div>
            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-2">
              <p className="text-[11px] text-slate-400">Presence</p>
              <p className="text-sm text-white font-semibold">{typeof data.wetland_presence === 'boolean' ? (data.wetland_presence ? 'Wetland' : 'Non-wetland') : '--'}</p>
            </div>
          </div>
        </div>
      )}

      {rgbImage && primaryOverlay && (
        <div className="mb-4 p-3 rounded border border-cyan-400/30 bg-cyan-500/5">
          <h4 className="text-xs text-cyan-200 uppercase tracking-wide mb-1">{heroTitle}</h4>
          <p className="text-xs text-slate-300 mb-3">based on Sentinel-2 imagery</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-2">
              <p className="text-[11px] text-slate-400">Detected Water Area</p>
              <p className="text-sm text-white font-semibold">{areaDisplay}</p>
            </div>
            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-2">
              <p className="text-[11px] text-slate-400">NDWI Mean</p>
              <p className="text-sm text-white font-semibold">{typeof ndwiMean === 'number' ? ndwiMean.toFixed(4) : (typeof data.ndwi === 'number' ? data.ndwi.toFixed(4) : '--')}</p>
            </div>
            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-2">
              <p className="text-[11px] text-slate-400">Scene Date</p>
              <p className="text-sm text-white font-semibold">{sceneDate}</p>
            </div>
            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-2">
              <p className="text-[11px] text-slate-400">Cloud Cover</p>
              <p className="text-sm text-white font-semibold">{typeof cloudCover === 'number' ? `${cloudCover.toFixed(2)}%` : '--'}</p>
            </div>
          </div>

          <div className="rounded border border-slate-700/60 bg-slate-900/40 overflow-hidden">
            <div className="px-3 py-2 text-xs text-slate-200 border-b border-slate-700/50 flex items-center justify-between gap-2">
              <span>Satellite Image</span>
              <span>Detected Water Area: {areaDisplay} km²</span>
            </div>
            <div className="relative w-full h-56 md:h-72">
              <img src={rgbImage} alt="Sentinel-2 RGB" className="absolute inset-0 w-full h-full object-cover" />
              <img src={primaryOverlay} alt="Computed spectral overlay" className="absolute inset-0 w-full h-full object-cover" />
            </div>
            <div className="px-3 py-2 text-xs text-slate-300 border-t border-slate-700/50">
              {overlayCaption}
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="mb-4 p-3 rounded border border-slate-700/50 bg-slate-900/40">
          <h4 className="text-xs text-slate-300 uppercase tracking-wide mb-1">Processing Summary</h4>
          <pre className="text-xs text-slate-300 overflow-auto max-h-28">{JSON.stringify(summary, null, 2)}</pre>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mb-4 p-3 rounded border border-amber-400/30 bg-amber-500/10">
          <h4 className="text-xs text-amber-200 uppercase tracking-wide mb-1">Warnings & Limitations</h4>
          <ul className="text-xs text-amber-100 space-y-1">
            {warnings.map((w, idx) => <li key={idx}>• {w}</li>)}
          </ul>
        </div>
      )}

      {visualBlocks.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs text-slate-300 uppercase tracking-wide mb-2">Visual Validation</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {visualBlocks.map((block, idx) => (
              <a key={idx} href={block.url} target="_blank" rel="noreferrer" className="block border border-slate-700/60 rounded overflow-hidden bg-slate-900/40 hover:border-cyan-400/50 transition-colors">
                <img src={block.url} alt={block.label} className="w-full h-36 object-cover" />
                <p className="text-xs text-slate-200 px-2 py-1">{block.label}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      <details className="text-xs text-slate-300 bg-slate-900/50 p-3 rounded border border-slate-700/50">
        <summary className="cursor-pointer text-slate-200">Raw Payload</summary>
        <pre className="overflow-auto max-h-56 mt-2">{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  )
}

function WaterDetectionPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [params, setParams] = useState({
    latitude: 46.5,
    longitude: -84.3,
    date_start: '2024-01-01',
    date_end: '2024-03-31'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/geoai/detect-water', params)
      setResult(res.data)
    } catch (err) {
      console.error(err)
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-lg border border-slate-700/50 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Latitude</label>
            <input
              type="number"
              step="0.01"
              value={params.latitude}
              onChange={(e) => setParams({...params, latitude: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Longitude</label>
            <input
              type="number"
              step="0.01"
              value={params.longitude}
              onChange={(e) => setParams({...params, longitude: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
            <input
              type="date"
              value={params.date_start}
              onChange={(e) => setParams({...params, date_start: e.target.value})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
            <input
              type="date"
              value={params.date_end}
              onChange={(e) => setParams({...params, date_end: e.target.value})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
        >
          {loading ? '🔄 Detecting...' : '🛰️ Detect Water'}
        </button>
      </form>

      <ResultCard title="Detection Results" icon="💧" data={result} loading={loading} />
    </div>
  )
}

function WetlandPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [params, setParams] = useState({
    latitude: 46.5,
    longitude: -84.3,
    area_km_radius: 5
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/geoai/map-wetlands', params)
      setResult(res.data)
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-lg border border-slate-700/50 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Latitude</label>
            <input
              type="number"
              step="0.01"
              value={params.latitude}
              onChange={(e) => setParams({...params, latitude: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Longitude</label>
            <input
              type="number"
              step="0.01"
              value={params.longitude}
              onChange={(e) => setParams({...params, longitude: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Radius (km)</label>
            <input
              type="number"
              step="0.5"
              value={params.area_km_radius}
              onChange={(e) => setParams({...params, area_km_radius: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
        >
          {loading ? '🔄 Mapping...' : '🌿 Map Wetlands'}
        </button>
      </form>

      <ResultCard title="Wetland Results" icon="🌱" data={result} loading={loading} />
    </div>
  )
}

function ChangeDetectionPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [params, setParams] = useState({
    latitude: 46.5,
    longitude: -84.3,
    date_start: '2023-01-01',
    date_end: '2024-01-01',
    comparison_interval: 'monthly'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/geoai/detect-changes', params)
      setResult(res.data)
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-lg border border-slate-700/50 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Latitude</label>
            <input
              type="number"
              step="0.01"
              value={params.latitude}
              onChange={(e) => setParams({...params, latitude: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Longitude</label>
            <input
              type="number"
              step="0.01"
              value={params.longitude}
              onChange={(e) => setParams({...params, longitude: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
            <input
              type="date"
              value={params.date_start}
              onChange={(e) => setParams({...params, date_start: e.target.value})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
            <input
              type="date"
              value={params.date_end}
              onChange={(e) => setParams({...params, date_end: e.target.value})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
        >
          {loading ? '🔄 Analyzing...' : '📊 Detect Changes'}
        </button>
      </form>

      <ResultCard title="Change Detection Results" icon="📈" data={result} loading={loading} />
    </div>
  )
}

function QualityPredictionPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [params, setParams] = useState({
    latitude: 46.5,
    longitude: -84.3,
    historical_observations: []
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/geoai/predict-quality', params)
      setResult(res.data)
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-lg border border-slate-700/50 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Latitude</label>
            <input
              type="number"
              step="0.01"
              value={params.latitude}
              onChange={(e) => setParams({...params, latitude: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Longitude</label>
            <input
              type="number"
              step="0.01"
              value={params.longitude}
              onChange={(e) => setParams({...params, longitude: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
        </div>
        <p className="text-sm text-slate-400">Uses historical observations from selected site</p>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
        >
          {loading ? '🔄 Predicting...' : '🔮 Predict Quality'}
        </button>
      </form>

      <ResultCard title="Quality Predictions" icon="✨" data={result} loading={loading} />
    </div>
  )
}

function LandCoverPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [params, setParams] = useState({
    latitude: 46.5,
    longitude: -84.3,
    zoom_level: 13
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/geoai/classify-landcover', params)
      setResult(res.data)
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-lg border border-slate-700/50 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Latitude</label>
            <input
              type="number"
              step="0.01"
              value={params.latitude}
              onChange={(e) => setParams({...params, latitude: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Longitude</label>
            <input
              type="number"
              step="0.01"
              value={params.longitude}
              onChange={(e) => setParams({...params, longitude: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Zoom Level</label>
            <input
              type="number"
              min="5"
              max="18"
              value={params.zoom_level}
              onChange={(e) => setParams({...params, zoom_level: parseInt(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
        >
          {loading ? '🔄 Classifying...' : '🗺️ Classify Land Cover'}
        </button>
      </form>

      <ResultCard title="Classification Results" icon="🌍" data={result} loading={loading} />
    </div>
  )
}

function SatellitePanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [params, setParams] = useState({
    latitude: 46.5,
    longitude: -84.3,
    date_start: '2024-01-01',
    date_end: '2024-03-31',
    max_cloud_cover: 20
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/geoai/download-sentinel', params)
      setResult(res.data)
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-lg border border-slate-700/50 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Latitude</label>
            <input
              type="number"
              step="0.01"
              value={params.latitude}
              onChange={(e) => setParams({...params, latitude: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Longitude</label>
            <input
              type="number"
              step="0.01"
              value={params.longitude}
              onChange={(e) => setParams({...params, longitude: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
            <input
              type="date"
              value={params.date_start}
              onChange={(e) => setParams({...params, date_start: e.target.value})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
            <input
              type="date"
              value={params.date_end}
              onChange={(e) => setParams({...params, date_end: e.target.value})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">Max Cloud Cover (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={params.max_cloud_cover}
              onChange={(e) => setParams({...params, max_cloud_cover: parseInt(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
        >
          {loading ? '🔄 Querying...' : '⬇️ Find Satellite Data'}
        </button>
      </form>

      <ResultCard title="Available Imagery" icon="📡" data={result} loading={loading} />
    </div>
  )
}

export default function GeoAnalytics() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('water_detection')

  const panels = {
    water_detection: <WaterDetectionPanel />,
    wetlands: <WetlandPanel />,
    changes: <ChangeDetectionPanel />,
    quality: <QualityPredictionPanel />,
    landcover: <LandCoverPanel />,
    satellite: <SatellitePanel />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <PageAmbience />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🌍 GeoAnalytics</h1>
          <p className="text-slate-400">Transparent geospatial analysis with explicit processing modes and uncertainty</p>
          <p className="text-sm text-slate-500 mt-2">
            ✓ Isolated service · ✓ Honest outputs · ✓ Visual validation artifacts
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 pb-4 border-b border-slate-700/50 overflow-x-auto">
          {Object.entries(GEOAI_TABS).map(([key, tab]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Panel */}
        <div className="mb-12">
          {panels[activeTab]}
        </div>

        {/* Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-3">📚 About GeoAnalytics</h3>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li>✓ Rule-based spectral water detection (NDWI/MNDWI)</li>
              <li>✓ Experimental wetland heuristic (not ML)</li>
              <li>✓ Multi-temporal spectral change analysis</li>
              <li>✓ STAC scene discovery with cloud/date filters</li>
              <li>✓ Visual previews for RGB, index, and mask outputs</li>
              <li>✓ Warnings and uncertainty are always shown</li>
            </ul>
          </div>

          <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-3">🏗️ Architecture</h3>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li>✓ Isolated Python microservice (port 8002)</li>
              <li>✓ Separate from main Node.js server</li>
              <li>✓ No database access (stateless)</li>
              <li>✓ Horizontal scale independent</li>
              <li>✓ Docker containerized</li>
              <li>✓ Low latency API endpoints</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
