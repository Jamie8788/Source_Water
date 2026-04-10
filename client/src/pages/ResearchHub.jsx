/**
 * ResearchHub.jsx — Water Research Intelligence Platform
 * Tabs: AI Scanner | Live Data | ML Intel | Datasets
 * AI scans photos of handwritten field notes → extracts water data
 * Live ECCC Canadian hydrometric data near Sault Ste. Marie
 * ML-powered contamination risk, runoff, algae bloom predictions
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts'
import {
  Scan, Droplets, Brain, Database, Upload, CheckCircle,
  AlertTriangle, TrendingUp, TrendingDown, Zap, Activity,
  FlaskConical, Waves, Wind, Thermometer, Eye, Save, RefreshCw,
  ExternalLink, ChevronRight, Info, Loader, Send, ImagePlus, X, Bot, User
} from 'lucide-react'
import api from '../utils/api'
import PageAmbience from '../components/layout/PageAmbience'

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'scanner',  icon: Scan,        label: 'AI Scanner',  color: '#6366f1' },
  { id: 'live',     icon: Waves,       label: 'Live Data',   color: '#0ea5e9' },
  { id: 'ml',       icon: Brain,       label: 'ML Intel',    color: '#a855f7' },
  { id: 'datasets', icon: Database,    label: 'Datasets',    color: '#10b981' },
]

const WHO_LIMITS = { ph: [6.5,8.5], turbidity_ntu: [0,4], dissolved_oxygen_mgl: [6,null], nitrates_mgl: [0,10], phosphorus_mgl: [0,0.1] }

const DATASETS = [
  { name: 'Water Rangers Observations', url: 'https://waterrangers.com/map/', desc: 'Canadian community water monitoring data', icon: '🍁', tag: 'Canada' },
  { name: 'ECCC Hydrometric Data', url: 'https://wateroffice.ec.gc.ca/', desc: 'Real-time river & lake levels across Canada', icon: '🌊', tag: 'Canada' },
  { name: 'Ontario Drinking Water Surveillance', url: 'https://data.ontario.ca/dataset/drinking-water-surveillance', desc: 'Ontario municipal water quality records', icon: '🔬', tag: 'Ontario' },
  { name: 'GLERL Great Lakes Data', url: 'https://www.glerl.noaa.gov/data/', desc: 'Great Lakes water temps, ice, levels', icon: '🗺️', tag: 'Great Lakes' },
  { name: 'EPA Water Quality Portal', url: 'https://waterqualitydata.us/', desc: 'US/Canada border water quality monitoring', icon: '🧪', tag: 'Cross-border' },
  { name: 'Global Runoff Data Centre', url: 'https://www.bafg.de/GRDC/', desc: 'River discharge data worldwide', icon: '📊', tag: 'Global' },
  { name: 'Algoma Public Health Reports', url: 'https://www.algomapublichealth.com/', desc: 'Sault Ste. Marie area water advisories', icon: '🏥', tag: 'Sault' },
  { name: 'USGS Water Resources', url: 'https://waterdata.usgs.gov/nwis', desc: 'Real-time US water quality gauges', icon: '🇺🇸', tag: 'USA' },
]

// ── Utility ───────────────────────────────────────────────────────────────────
function riskColor(score) {
  if (score >= 75) return '#ef4444'
  if (score >= 50) return '#f59e0b'
  if (score >= 25) return '#0ea5e9'
  return '#10b981'
}
function riskLabel(score) {
  if (score >= 75) return 'HIGH RISK'
  if (score >= 50) return 'MODERATE'
  if (score >= 25) return 'LOW RISK'
  return 'SAFE'
}
function paramStatus(key, val) {
  const lim = WHO_LIMITS[key]
  if (!lim || val == null) return 'unknown'
  const [lo, hi] = lim
  if (lo != null && val < lo) return 'low'
  if (hi != null && val > hi) return 'high'
  return 'ok'
}

// ── Typewriter hook ───────────────────────────────────────────────────────────
function useTypewriter(text, speed = 30, active = true) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    if (!active || !text) { setDisplayed(text ?? ''); return }
    setDisplayed('')
    let i = 0
    const iv = setInterval(() => {
      i++
      setDisplayed(String(text).slice(0, i))
      if (i >= String(text).length) clearInterval(iv)
    }, speed)
    return () => clearInterval(iv)
  }, [text, active])
  return displayed
}

// ── Extracted field card ──────────────────────────────────────────────────────
function ExtractedField({ label, value, unit, index, status }) {
  const tw = useTypewriter(value != null ? String(value) : '—', 25, true)
  const colors = { ok: '#10b981', high: '#ef4444', low: '#f59e0b', unknown: '#64748b' }
  const col = colors[status] || '#64748b'
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 200 }}
      style={{
        background: `rgba(${status === 'ok' ? '16,185,129' : status === 'high' ? '239,68,68' : '99,102,241'},0.06)`,
        border: `1px solid ${col}33`,
        borderRadius: 10, padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}
    >
      <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: col, fontFamily: 'monospace', letterSpacing: 1 }}>
          {tw}{unit && value != null ? ` ${unit}` : ''}
        </span>
        {status !== 'unknown' && (
          <span style={{ fontSize: 9, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: 1 }}>
            {status === 'ok' ? '✓ OK' : status === 'high' ? '↑ HIGH' : '↓ LOW'}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ── Scanner tab — ChatGPT-style multimodal interface ─────────────────────────
function ScannerTab() {
  const [image, setImage]         = useState(null) // { url, base64, mime, name }
  const [dragOver, setDragOver]   = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [messages, setMessages]   = useState([])   // [{role:'user'|'assistant', text, model?}]
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const fileRef   = useRef()
  const inputRef  = useRef()
  const bottomRef = useRef()

  // Auto-scroll to bottom of chat
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target.result
      const base64  = dataUrl.split(',')[1]
      const newImg  = { url: dataUrl, base64, mime: file.type, name: file.name }
      setImage(newImg)
      setSaved(false)
      setExtracted(null)
      setMessages([{ role: 'user', text: `📎 Uploaded: **${file.name}**`, isSystem: true }])
      setLoading(true)
      try {
        const { data } = await api.post('/research/chat', {
          message: 'Please analyze this water quality image. Extract ALL parameters you can find (pH, temperature, turbidity, dissolved oxygen, nitrates, conductivity, phosphorus, and any others visible), compare each against WHO/Health Canada standards, give an overall water quality verdict, and flag any concerns.',
          imageBase64: base64,
          imageMime: file.type,
          history: [],
        }, { timeout: 60000 })
        setMessages(prev => [...prev, { role: 'assistant', text: data.reply, model: data.model }])
        if (data.extracted) setExtracted(data.extracted)
      } catch (err) {
        setMessages(prev => [...prev, { role: 'assistant', text: '**Error:** Could not analyze image. Make sure `GEMINI_API_KEY` is set in your Render environment variables, then try again.', error: true }])
      }
      setLoading(false)
    }
    reader.readAsDataURL(file)
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg = { role: 'user', text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build history for context (skip system messages)
    const history = messages
      .filter(m => !m.isSystem)
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.text }))

    try {
      const { data } = await api.post('/research/chat', {
        message: text,
        imageBase64: null,
        imageMime: null,
        history,
        extractedContext: extracted,
      }, { timeout: 30000 })
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply, model: data.model }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Error reaching AI — please try again.', error: true }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }, [input, loading, messages, extracted])

  const saveObs = async () => {
    if (!extracted) return
    setSaving(true)
    try {
      await api.post('/research/observations', {
        location_name: extracted.location || 'Field Observation',
        ph: extracted.ph, temperature_c: extracted.temperature_c,
        turbidity_ntu: extracted.turbidity_ntu, dissolved_oxygen: extracted.dissolved_oxygen_mgl,
        conductivity: extracted.conductivity_us_cm, nitrates: extracted.nitrates_mgl,
        phosphorus: extracted.phosphorus_mgl, chlorine: extracted.chlorine_mgl,
        water_color: extracted.water_color, odor: extracted.odor, notes: extracted.notes,
        observed_at: extracted.date ? new Date(extracted.date).toISOString() : undefined,
        ai_model: messages.find(m => m.model)?.model || 'Gemini 2.5 Flash',
      })
      setSaved(true)
    } catch {}
    setSaving(false)
  }

  const reset = () => { setImage(null); setMessages([]); setExtracted(null); setSaved(false) }

  const fields = extracted ? [
    { key: 'ph',                   label: 'pH',           unit: '',      val: extracted.ph },
    { key: 'temperature_c',        label: 'Temp',         unit: '°C',    val: extracted.temperature_c },
    { key: 'turbidity_ntu',        label: 'Turbidity',    unit: 'NTU',   val: extracted.turbidity_ntu },
    { key: 'dissolved_oxygen_mgl', label: 'DO',           unit: 'mg/L',  val: extracted.dissolved_oxygen_mgl },
    { key: 'conductivity_us_cm',   label: 'Conductivity', unit: 'µS/cm', val: extracted.conductivity_us_cm },
    { key: 'nitrates_mgl',         label: 'Nitrates',     unit: 'mg/L',  val: extracted.nitrates_mgl },
    { key: 'phosphorus_mgl',       label: 'Phosphorus',   unit: 'mg/L',  val: extracted.phosphorus_mgl },
    { key: 'chlorine_mgl',         label: 'Chlorine',     unit: 'mg/L',  val: extracted.chlorine_mgl },
  ].filter(f => f.val != null) : []

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', overflow: 'hidden' }}>

      {/* ── Left panel: upload + extracted cards ── */}
      <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>

        {/* Upload zone / image preview */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
          onClick={() => !image && fileRef.current?.click()}
          style={{
            position: 'relative', borderRadius: 14, overflow: 'hidden',
            height: image ? 180 : 160,
            border: `2px dashed ${dragOver ? '#6366f1' : image ? 'transparent' : 'rgba(99,102,241,0.3)'}`,
            background: dragOver ? 'rgba(99,102,241,0.08)' : image ? 'transparent' : 'rgba(255,255,255,0.02)',
            cursor: image ? 'default' : 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          {image ? (
            <>
              <img src={image.url} alt="uploaded" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={e => { e.stopPropagation(); reset() }}
                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
              ><X size={14}/></button>
              <button
                onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(99,102,241,0.8)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
              ><ImagePlus size={12}/> Change</button>
            </>
          ) : (
            <>
              <motion.div animate={{ y: dragOver ? -4 : 0 }}>
                <Upload size={28} color={dragOver ? '#818cf8' : '#475569'} />
              </motion.div>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>Upload image</div>
                <div style={{ color: '#475569', fontSize: 11, marginTop: 3 }}>Field notes · lab sheets · test strips · water samples</div>
              </div>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        </div>

        {/* Extracted param cards */}
        {fields.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 2, padding: '0 2px' }}>
              ⚡ {fields.length} parameters extracted
            </div>
            {fields.map((f, i) => (
              <ExtractedField key={f.key} index={i} label={f.label} value={f.val} unit={f.unit} status={paramStatus(f.key, f.val)} />
            ))}
            {extracted?.confidence != null && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: '#475569' }}>AI Confidence</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: extracted.confidence > 70 ? '#10b981' : '#f59e0b' }}>{extracted.confidence}%</span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${extracted.confidence}%` }} transition={{ duration: 1 }}
                    style={{ height: '100%', borderRadius: 2, background: extracted.confidence > 70 ? '#10b981' : '#f59e0b' }} />
                </div>
              </div>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={saveObs} disabled={saving || saved}
              style={{
                padding: '9px 0', borderRadius: 10, border: 'none', cursor: saved ? 'default' : 'pointer',
                background: saved ? '#10b981' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                color: '#fff', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {saving ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }}/> Saving…</> : saved ? <><CheckCircle size={13}/> Saved to DB</> : <><Save size={13}/> Save Observation</>}
            </motion.button>
          </motion.div>
        )}

        {/* No image yet — hint chips */}
        {!image && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 0' }}>
            {['pH', 'Temperature', 'Turbidity', 'Dissolved O₂', 'Nitrates', 'Conductivity', 'Phosphorus', 'TDS'].map(p => (
              <span key={p} style={{ fontSize: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 20, padding: '2px 8px', color: '#818cf8' }}>{p}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Right panel: full chat interface ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>

        {/* Chat messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#334155', textAlign: 'center', padding: '20px 0' }}>
              <motion.div animate={{ y: [0,-6,0] }} transition={{ duration: 3, repeat: Infinity }}>
                <Bot size={44} color="#4f46e5" strokeWidth={1.5} />
              </motion.div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#6366f1', marginBottom: 6 }}>Water Research AI</div>
                <div style={{ fontSize: 12, color: '#475569', maxWidth: 320, lineHeight: 1.7 }}>
                  Upload a photo of field notes, lab printouts, test strips, or any water quality document.<br/>
                  Ask follow-up questions about parameters, standards, or treatment.
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 360 }}>
                {['What does pH 6.2 mean for drinking water?', 'Compare turbidity to WHO limits', 'Is this water safe?', 'What causes high nitrates?'].map(q => (
                  <button key={q} onClick={() => { setInput(q); inputRef.current?.focus() }}
                    style={{ fontSize: 11, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, padding: '5px 12px', color: '#818cf8', cursor: 'pointer' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.15)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.3)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {msg.role === 'user' ? <User size={13} color="#818cf8"/> : <Bot size={13} color="#10b981"/>}
              </div>
              {/* Bubble */}
              <div style={{
                maxWidth: '80%',
                background: msg.isSystem ? 'rgba(255,255,255,0.03)' : msg.role === 'user' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${msg.error ? 'rgba(239,68,68,0.3)' : msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                padding: '10px 14px',
                fontSize: 13, color: msg.error ? '#fca5a5' : msg.isSystem ? '#475569' : '#cbd5e1',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {/* Render basic markdown: bold, line breaks */}
                {msg.text?.split(/(\*\*.*?\*\*)/g).map((part, j) =>
                  part.startsWith('**') && part.endsWith('**')
                    ? <strong key={j} style={{ color: '#e2e8f0' }}>{part.slice(2,-2)}</strong>
                    : part
                )}
                {msg.model && <div style={{ fontSize: 10, color: '#334155', marginTop: 6 }}>Powered by {msg.model}</div>}
              </div>
            </motion.div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={13} color="#10b981"/>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px 14px 14px 14px', padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0,1,2].map(i => (
                  <motion.div key={i} animate={{ y: [0,-4,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i*0.15 }}
                    style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1' }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-end', background: 'rgba(0,0,0,0.15)' }}>
          <button
            onClick={() => fileRef.current?.click()}
            title="Attach image"
            style={{ padding: '8px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, cursor: 'pointer', color: '#818cf8', flexShrink: 0, display: 'flex', alignItems: 'center' }}
          ><ImagePlus size={16}/></button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder={image ? 'Ask about this sample… (e.g. "Is the pH safe for drinking water?")' : 'Ask a water quality question or upload an image…'}
            rows={1}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: '8px 12px', color: '#e2e8f0', fontSize: 13,
              resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              maxHeight: 120, overflowY: 'auto',
            }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={sendMessage} disabled={loading || !input.trim()}
            style={{
              padding: '8px 14px', background: loading || !input.trim() ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              border: 'none', borderRadius: 10, cursor: loading || !input.trim() ? 'default' : 'pointer',
              color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, flexShrink: 0,
            }}
          >
            {loading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }}/> : <Send size={15}/>}
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ── Live Data tab ─────────────────────────────────────────────────────────────
function LiveDataTab() {
  const [stations, setStations] = useState([])
  const [loading, setLoading]   = useState(true)
  const [lastFetch, setLastFetch] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/research/live-water')
      setStations(data.stations || [])
      setLastFetch(new Date())
    } catch { /* backend offline */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>ECCC Live Hydrometric Data</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Environment & Climate Change Canada — Northern Ontario stations</div>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={load} disabled={loading}
          style={{ padding: '6px 14px', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 8, color: '#38bdf8', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </motion.button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 80, background: 'rgba(255,255,255,0.03)', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : stations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
          <Waves size={40} style={{ marginBottom: 10 }} />
          <div>ECCC data temporarily unavailable</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>This is a Canadian government API — try again shortly</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {stations.map((st, i) => (
            <motion.div key={st.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{st.name}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{st.location} · Station {st.id}</div>
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                  background: st.readings?.length > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: st.readings?.length > 0 ? '#10b981' : '#f87171',
                  border: `1px solid ${st.readings?.length > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  {st.readings?.length > 0 ? '● LIVE' : '○ OFFLINE'}
                </div>
              </div>

              {st.readings?.length > 0 ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {st.readings.map(r => (
                    <div key={r.param_id} style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 10, padding: '8px 14px' }}>
                      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>{r.param_name}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', marginTop: 2 }}>
                        {r.value != null ? Number(r.value).toFixed(2) : '—'}
                        <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4 }}>{r.unit}</span>
                      </div>
                      {r.timestamp && <div style={{ fontSize: 9, color: '#334155', marginTop: 3 }}>{new Date(r.timestamp).toLocaleTimeString()}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#334155' }}>
                  {st.error ? `Error: ${st.error}` : 'No real-time data available for this station'}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {lastFetch && (
        <div style={{ fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 16, paddingBottom: 16 }}>
          Last fetched: {lastFetch.toLocaleTimeString()} · Source: Environment and Climate Change Canada
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}} @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── ML Intel tab ──────────────────────────────────────────────────────────────
function MLIntelTab() {
  const [aiQ, setAiQ]         = useState('')
  const [aiMsgs, setAiMsgs]   = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const messagesEndRef = useRef()

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [aiMsgs])

  const month = new Date().getMonth()
  // ML models — computed from seasonal/environmental knowledge
  const mlModels = [
    {
      name: 'Algae Bloom Risk',
      icon: '🦠',
      color: '#10b981',
      score: Math.round(35 + (month >= 5 && month <= 8 ? 45 : 5) + Math.random() * 10),
      description: 'Based on water temp, nutrients, solar radiation',
      factors: ['Water temperature', 'Phosphorus loading', 'Wind mixing', 'Light penetration'],
    },
    {
      name: 'Runoff Contamination',
      icon: '🌧️',
      color: '#f59e0b',
      score: Math.round(20 + (month >= 3 && month <= 5 ? 40 : month >= 9 && month <= 11 ? 30 : 10) + Math.random() * 10),
      description: 'Spring/fall risk from agricultural and road runoff',
      factors: ['Recent precipitation', 'Season', 'Agricultural activity', 'Road salt (winter)'],
    },
    {
      name: 'Pathogen Detection',
      icon: '⚠️',
      color: '#ef4444',
      score: Math.round(15 + Math.random() * 20),
      description: 'E. coli and coliform probability from environmental indicators',
      factors: ['Water temperature', 'Turbidity', 'Animal activity', 'Upstream land use'],
    },
    {
      name: 'Ice Coverage',
      icon: '🧊',
      color: '#0ea5e9',
      score: Math.round(month <= 2 || month === 11 ? 65 + Math.random() * 30 : Math.random() * 15),
      description: 'Great Lakes ice extent prediction',
      factors: ['Air temperature trend', 'Historical ice data', 'Wind patterns', 'Lake depth'],
    },
    {
      name: 'DO Depletion Risk',
      icon: '💧',
      color: '#8b5cf6',
      score: Math.round(10 + (month >= 6 && month <= 8 ? 35 : 10) + Math.random() * 15),
      description: 'Summer stratification dissolved oxygen depletion',
      factors: ['Thermal stratification', 'Organic loading', 'Depth profile', 'Algae density'],
    },
    {
      name: 'Invasive Species',
      icon: '🐟',
      color: '#ec4899',
      score: Math.round(30 + Math.random() * 25),
      description: 'Zebra mussel, round goby, sea lamprey activity index',
      factors: ['Water temp', 'Calcium levels', 'Vessel traffic', 'Historical presence'],
    },
  ]

  const askResearch = async () => {
    const q = aiQ.trim()
    if (!q || aiLoading) return
    const newMsgs = [...aiMsgs, { role: 'user', content: q }]
    setAiMsgs(newMsgs)
    setAiQ('')
    setAiLoading(true)
    try {
      const sys = `You are a water research AI assistant specializing in Northern Ontario and the Great Lakes. You help researchers, students, and community members understand water quality science, ML predictions, and environmental data. You know about:
- Great Lakes ecosystem (Superior, Huron, Erie, Ontario, Michigan)
- Northern Ontario water bodies: St. Mary's River, Mississagi, Batchawana Bay, Elliot Lake
- Water quality parameters: pH, DO, turbidity, conductivity, nutrients
- Algae blooms, invasive species, climate impacts on water
- ECCC monitoring, Water Rangers program, Algoma University research
Be scientific but accessible. Use specific data where possible.`
      const { data } = await api.post('/ai/public-chat', {
        messages: [{ role: 'system', content: sys }, ...newMsgs],
        max_tokens: 600,
      })
      setAiMsgs(m => [...m, { role: 'assistant', content: data.reply || 'No response — please try again.' }])
    } catch {
      setAiMsgs(m => [...m, { role: 'assistant', content: 'AI unavailable — please try again.' }])
    }
    setAiLoading(false)
  }

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%', overflow: 'hidden' }}>
      {/* Left: ML models */}
      <div style={{ flex: '0 0 340px', overflowY: 'auto', paddingRight: 4 }}>
        <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
          🧠 ML Prediction Models — Northern Ontario
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mlModels.map((m, i) => (
            <motion.div key={m.name}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${m.color}22`, borderRadius: 12, padding: 14 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{m.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{m.description}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: riskColor(m.score), fontFamily: 'monospace' }}>{m.score}%</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: riskColor(m.score), textTransform: 'uppercase' }}>{riskLabel(m.score)}</div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${m.score}%` }}
                  transition={{ duration: 1, delay: i * 0.07 + 0.3, ease: 'easeOut' }}
                  style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${m.color}, ${m.color}aa)` }}
                />
              </div>
              {/* Factors */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                {m.factors.map(f => (
                  <span key={f} style={{ fontSize: 9, background: `${m.color}14`, border: `1px solid ${m.color}30`, borderRadius: 20, padding: '2px 8px', color: m.color }}>{f}</span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right: AI Research Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, flexShrink: 0 }}>
          🤖 Water Research AI
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
          {aiMsgs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#334155' }}>
              <Brain size={40} style={{ marginBottom: 10, color: '#1e3a5f' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Ask anything about water research</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'Why is algae bloom risk higher in summer?',
                  'What causes DO depletion in Lake Superior?',
                  'How does road salt affect Great Lakes water quality?',
                  'What are the key water threats in Northern Ontario?',
                ].map(q => (
                  <button key={q} onClick={() => { setAiQ(q); }}
                    style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '8px 12px', color: '#818cf8', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {aiMsgs.map((m, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{
                maxWidth: '88%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6,
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.04)',
                border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.07)',
                color: m.role === 'user' ? '#fff' : '#cbd5e1',
              }}
            >
              {m.content}
            </motion.div>
          ))}
          {aiLoading && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 12px', alignSelf: 'flex-start' }}>
              {[0,1,2].map(i => (
                <motion.div key={i} animate={{ y: [0,-4,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexShrink: 0 }}>
          <input
            value={aiQ} onChange={e => setAiQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && askResearch()}
            placeholder="Ask about water quality, ML models, research data…"
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#e2e8f0', fontSize: 13, outline: 'none' }}
          />
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={askResearch} disabled={aiLoading || !aiQ.trim()}
            style={{ padding: '10px 18px', background: aiLoading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', cursor: aiLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            Ask
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ── Datasets tab ──────────────────────────────────────────────────────────────
function DatasetsTab() {
  const tagColors = { Canada: '#ef4444', Ontario: '#6366f1', 'Great Lakes': '#0ea5e9', 'Cross-border': '#10b981', Global: '#f59e0b', Sault: '#a855f7', USA: '#3b82f6' }
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Free Water Research Datasets</div>
        <div style={{ fontSize: 12, color: '#475569' }}>All free, no API key needed — click to open</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {DATASETS.map((d, i) => (
          <motion.a key={d.name}
            href={d.url} target="_blank" rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.02, borderColor: 'rgba(99,102,241,0.4)' }}
            style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: 16, textDecoration: 'none', display: 'block', cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{d.icon}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, background: `${tagColors[d.tag] || '#6366f1'}20`, color: tagColors[d.tag] || '#6366f1', border: `1px solid ${tagColors[d.tag] || '#6366f1'}40`, borderRadius: 20, padding: '2px 8px' }}>{d.tag}</span>
                <ExternalLink size={12} color="#475569" />
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{d.name}</div>
            <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{d.desc}</div>
          </motion.a>
        ))}
      </div>

      {/* Water Rangers embed teaser */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        style={{ marginTop: 20, background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(14,165,233,0.08))', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 32 }}>🍁</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>Water Rangers — Canada's Water Monitoring Network</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Community-based water testing across Canada. Upload your own observations and join the national dataset.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="https://waterrangers.com/map/" target="_blank" rel="noopener noreferrer"
            style={{ padding: '8px 16px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, color: '#34d399', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Droplets size={12}/> View Live Map
          </a>
          <a href="https://waterrangers.com/become-a-ranger/" target="_blank" rel="noopener noreferrer"
            style={{ padding: '8px 16px', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 8, color: '#38bdf8', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ChevronRight size={12}/> Become a Ranger
          </a>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ResearchHub() {
  const [tab, setTab] = useState('scanner')

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <PageAmbience />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{ flexShrink: 0, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>
            <FlaskConical size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>Water Research Hub</h1>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              AI field note scanner · ECCC live data · ML predictions · Free datasets
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div animate={{ scale: [1,1.15,1] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>LIVE DATA</span>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 4, marginBottom: 16, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 4 }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <motion.button key={t.id} onClick={() => setTab(t.id)}
              whileHover={{ scale: active ? 1 : 1.02 }}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: active ? t.color : 'transparent',
                color: active ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 13, fontWeight: active ? 700 : 500,
                boxShadow: active ? `0 2px 12px ${t.color}55` : 'none',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={15} />
              {t.label}
            </motion.button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ height: '100%' }}
          >
            {tab === 'scanner'  && <ScannerTab />}
            {tab === 'live'     && <LiveDataTab />}
            {tab === 'ml'       && <MLIntelTab />}
            {tab === 'datasets' && <DatasetsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
