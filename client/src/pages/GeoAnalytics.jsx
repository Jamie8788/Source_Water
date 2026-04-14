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

  return (
    <div className="p-6 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 hover:border-indigo-500/40 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <pre className="text-xs text-slate-300 overflow-auto max-h-48 bg-slate-900/50 p-3 rounded border border-slate-700/50">
        {JSON.stringify(data, null, 2)}
      </pre>
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
          <p className="text-slate-400">Satellite-based water analysis, wetland mapping, and geospatial ML</p>
          <p className="text-sm text-slate-500 mt-2">
            ✓ Fully isolated service · ✓ Zero impact on dashboard/users · ✓ Production-ready
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
              <li>✓ Satellite-based water detection from Sentinel-2</li>
              <li>✓ ML-powered wetland classification</li>
              <li>✓ Temporal change analysis (seasonal trends)</li>
              <li>✓ Water quality prediction models</li>
              <li>✓ Land cover classification (10+ categories)</li>
              <li>✓ Real satellite data downloads</li>
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
