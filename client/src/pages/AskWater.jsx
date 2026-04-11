/**
 * AskWater — Epic AI voice chat with Nibi (full 3D mascot).
 * Voice input: Web Speech API (SpeechRecognition)
 * Voice output: Web Speech Synthesis API
 * AI: existing /api/ai/public-chat (Groq / Pollinations, no new cost)
 * 3D: Existing NibiMascot3D (React Three Fiber + custom shaders)
 * Zero new paid APIs. Zero backend changes.
 */
import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Send, Trash2, Volume2, VolumeX, Sparkles, Droplets } from 'lucide-react'
import NibiMascot3D from '../components/NibiMascot3D'
import api from '../utils/api'

// ── Suggestions ───────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  '💧 Safe pH for drinking water?',
  '🌊 Tell me about Lake Superior',
  '🦠 How do algae blooms form?',
  '🧪 How to test water quality?',
  '🌡️ Temperature & dissolved oxygen?',
  '🏭 Mining & water pollution',
  '🌿 Protecting local watersheds',
  '🐟 How fish react to water quality',
]

const GREETING = "Hey there! I'm Nibi — your personal water quality expert! 💧 Ask me anything about water, lakes, ecosystems, or Northern Ontario. You can type or tap the mic and just talk to me!"

// Status → 3D Nibi mood
const MOOD_MAP = { idle: 'idle', listening: 'wave', thinking: 'thinking', speaking: 'happy', error: 'blush' }

// ── Animated particle background ──────────────────────────────────────────────
function ParticleBG() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)
    const ctx = canvas.getContext('2d')
    const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#14b8a6', '#3b82f6', '#a78bfa']
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.2 + 0.4,
      vy: Math.random() * 0.35 + 0.08,
      vx: (Math.random() - 0.5) * 0.18,
      opacity: Math.random() * 0.45 + 0.08,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      twinkle: Math.random() * Math.PI * 2,
    }))
    let raf
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        p.twinkle += 0.02
        const alpha = p.opacity * (0.7 + 0.3 * Math.sin(p.twinkle))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = alpha
        ctx.fill()
        p.y -= p.vy
        p.x += p.vx
        if (p.y < -8) { p.y = canvas.height + 8; p.x = Math.random() * canvas.width }
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return (
    <canvas ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />
  )
}

// ── Scan-line overlay (sci-fi aesthetic) ──────────────────────────────────────
function ScanLines() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
      background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)',
    }} />
  )
}

// ── Waveform bars ─────────────────────────────────────────────────────────────
function Waveform({ data, status }) {
  const color1 = status === 'listening' ? '#60a5fa' : status === 'speaking' ? '#34d399' : '#a78bfa'
  const color2 = status === 'listening' ? '#818cf8' : status === 'speaking' ? '#6ee7b7' : '#c4b5fd'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, height: 52, padding: '0 8px' }}>
      {data.map((h, i) => (
        <motion.div key={i} animate={{ height: Math.max(3, h) }}
          transition={{ duration: 0.06, ease: 'easeOut' }}
          style={{
            width: 3.5, borderRadius: 2,
            background: `linear-gradient(to top, ${color1}, ${color2})`,
            opacity: status === 'idle' ? 0.18 : 0.85,
            minHeight: 3,
            boxShadow: status !== 'idle' ? `0 0 6px ${color1}60` : 'none',
          }} />
      ))}
    </div>
  )
}

// ── Chat bubble ────────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.34, 1.2, 0.64, 1] }}
      style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end' }}
    >
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#6366f1,#14b8a6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
          boxShadow: '0 0 12px rgba(99,102,241,0.4)',
        }}>💧</div>
      )}
      <div style={{
        maxWidth: '82%', padding: '11px 15px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser
          ? 'linear-gradient(135deg, #6366f1, #4338ca)'
          : 'rgba(255,255,255,0.055)',
        border: isUser ? 'none' : '1px solid rgba(255,255,255,0.09)',
        backdropFilter: 'blur(12px)',
        color: 'rgba(255,255,255,0.93)',
        fontSize: 13.5, lineHeight: 1.68,
        boxShadow: isUser
          ? '0 4px 20px rgba(99,102,241,0.35)'
          : '0 2px 12px rgba(0,0,0,0.25)',
      }}>
        {msg.content}
        {msg.model && (
          <div style={{ fontSize: 10, marginTop: 5, opacity: 0.3, letterSpacing: '0.03em' }}>
            via {msg.model.split('/').pop()}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AskWater() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }])
  const [input, setInput]       = useState('')
  const [status, setStatus]     = useState('idle')
  const [voiceOn, setVoiceOn]   = useState(true)
  const [waveData, setWaveData] = useState(new Array(28).fill(3))
  const [interim, setInterim]   = useState('')

  const recRef      = useRef(null)
  const isListRef   = useRef(false)
  const analyserRef = useRef(null)
  const streamRef   = useRef(null)
  const rafRef      = useRef(null)
  const bottomRef   = useRef(null)

  const mood = MOOD_MAP[status] ?? 'idle'

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, status])

  // ── Greet with voice on mount ──────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { if (voiceOn) speakText(GREETING) }, 1200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Waveform draw loop ─────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'listening' || !analyserRef.current) {
      setWaveData(new Array(28).fill(3))
      return
    }
    const draw = () => {
      if (!analyserRef.current) return
      const data = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(data)
      const bars = Array.from({ length: 28 }, (_, i) => {
        const v = data[Math.floor(i * data.length / 28)] / 255
        return Math.max(3, v * 58)
      })
      setWaveData(bars)
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [status])

  // ── Speech synthesis ───────────────────────────────────────────────────────
  const speakText = useCallback((text) => {
    if (!voiceOn || typeof window === 'undefined') return
    window.speechSynthesis.cancel()
    const clean = text.replace(/[*_`#[\]]/g, '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 400)
    const utter = new SpeechSynthesisUtterance(clean)
    utter.rate = 0.92; utter.pitch = 1.12; utter.volume = 0.95
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      return voices.find(v => /samantha|karen|victoria|allison|zira/i.test(v.name))
        || voices.find(v => v.lang?.startsWith('en') && !v.localService)
        || voices.find(v => v.lang?.startsWith('en'))
    }
    const v = pickVoice()
    if (v) utter.voice = v
    else if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => { const v2 = pickVoice(); if (v2) utter.voice = v2 }
    }
    utter.onstart = () => setStatus('speaking')
    utter.onend = () => setStatus('idle')
    utter.onerror = () => setStatus('idle')
    window.speechSynthesis.speak(utter)
    setStatus('speaking')
  }, [voiceOn])

  // ── Send message to AI ─────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const msg = text?.trim()
    if (!msg || status === 'thinking') return
    setInput('')
    setInterim('')
    window.speechSynthesis.cancel()
    const newHistory = [...messages, { role: 'user', content: msg }]
    setMessages(newHistory)
    setStatus('thinking')
    try {
      const apiMsgs = [
        {
          role: 'system',
          content: 'You are Nibi, an adorable animated water-drop character and water quality expert for SOURCE Water, a community monitoring platform in Northern Ontario (managed by NORDIK Institute at Algoma University). Answer in 2-4 friendly sentences. Be warm, encouraging, and educational. No markdown formatting. Occasionally use relevant water emojis. If unsure, say so honestly.',
        },
        ...newHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
      ]
      const { data } = await api.post('/ai/public-chat', { messages: apiMsgs })
      const reply = data.reply?.trim() || "Hmm, I'm having a moment! Try asking again? 💧"
      setMessages(prev => [...prev, { role: 'assistant', content: reply, model: data.model }])
      speakText(reply)
    } catch {
      const err = "My water pipes got clogged! Please try again in a moment. 💧"
      setMessages(prev => [...prev, { role: 'assistant', content: err }])
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }, [messages, speakText, status])

  // ── Voice input ────────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (isListRef.current) return
    window.speechSynthesis.cancel()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
    } catch { /* waveform unavailable, voice still works */ }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice input needs Chrome or Edge.'); return }
    const rec = new SR()
    rec.lang = 'en-CA'
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = (e) => {
      let final = '', inter = []
      for (const r of e.results) {
        if (r.isFinal) final += r[0].transcript
        else inter.push(r[0].transcript)
      }
      setInterim(inter.join(' '))
      if (final) { stopListening(); sendMessage(final) }
    }
    rec.onerror = () => { stopListening(); setStatus('idle') }
    rec.onend   = () => { if (isListRef.current) stopListening() }
    recRef.current = rec
    isListRef.current = true
    setStatus('listening')
    try { rec.start() } catch { stopListening() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendMessage])

  const stopListening = useCallback(() => {
    isListRef.current = false
    recRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    analyserRef.current = null
    cancelAnimationFrame(rafRef.current)
    setInterim('')
    setWaveData(new Array(28).fill(3))
    setStatus(s => s === 'listening' ? 'idle' : s)
  }, [])

  const toggleListen = () => { status === 'listening' ? stopListening() : startListening() }

  const toggleVoice = () => setVoiceOn(v => { if (v) window.speechSynthesis.cancel(); return !v })

  const clearChat = () => {
    window.speechSynthesis.cancel()
    stopListening()
    setMessages([{ role: 'assistant', content: GREETING }])
    setStatus('idle')
    if (voiceOn) setTimeout(() => speakText(GREETING), 300)
  }

  // Cleanup on unmount
  useEffect(() => () => {
    window.speechSynthesis.cancel()
    recRef.current?.abort()
    streamRef.current?.getTracks().forEach(t => t.stop())
    cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Status text + colour ───────────────────────────────────────────────────
  const statusLabel = { idle: 'Tap mic to speak or type below', listening: interim || 'Listening…', thinking: 'Thinking…', speaking: 'Speaking…', error: 'Oops! Try again.' }[status] ?? ''
  const statusColor = { idle: 'rgba(255,255,255,0.35)', listening: '#60a5fa', thinking: '#a78bfa', speaking: '#34d399', error: '#f87171' }[status]
  const glowColor   = { idle: 'rgba(99,102,241,0.1)', listening: 'rgba(96,165,250,0.18)', thinking: 'rgba(167,139,250,0.18)', speaking: 'rgba(52,211,153,0.16)', error: 'rgba(248,113,113,0.14)' }[status]

  return (
    <div style={{
      minHeight: 'calc(100vh - 130px)',
      background: 'linear-gradient(145deg, #08021e 0%, #04091a 45%, #020c18 100%)',
      borderRadius: 20, position: 'relative', overflow: 'hidden',
      display: 'flex', gap: 0,
    }}>
      <ParticleBG />
      <ScanLines />

      {/* ── LEFT PANEL: Nibi + controls ── */}
      <div style={{
        width: '38%', minWidth: 260, maxWidth: 400,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '28px 20px 24px',
        position: 'relative', zIndex: 2,
        borderRight: '1px solid rgba(99,102,241,0.12)',
      }}>

        {/* Ambient glow behind Nibi */}
        <motion.div
          animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.06, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: 380, height: 380, borderRadius: '50%',
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
            pointerEvents: 'none', transition: 'background 0.6s ease',
          }}
        />

        {/* 3D Nibi */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <Suspense fallback={<div style={{ width: 320, height: 430, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontSize: 13 }}>Loading Nibi…</div>}>
            <NibiMascot3D mood={mood} size={320} orbitControls={false} />
          </Suspense>
        </div>

        {/* Status label */}
        <AnimatePresence mode="wait">
          <motion.p key={statusLabel}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            style={{ color: statusColor, fontSize: 12.5, fontWeight: 600, textAlign: 'center', margin: '-8px 0 10px', minHeight: 18, maxWidth: 220, letterSpacing: '0.02em', lineHeight: 1.4 }}>
            {statusLabel}
          </motion.p>
        </AnimatePresence>

        {/* Waveform */}
        <Waveform data={waveData} status={status} />

        {/* Mic button */}
        <div style={{ position: 'relative', marginTop: 8 }}>
          {/* Pulse rings */}
          {status === 'listening' && [0, 1, 2].map(i => (
            <motion.div key={i}
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.45, ease: 'easeOut' }}
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '2px solid rgba(239,68,68,0.5)', pointerEvents: 'none',
              }}
            />
          ))}
          {status === 'speaking' && [0, 1].map(i => (
            <motion.div key={i}
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '2px solid rgba(52,211,153,0.5)', pointerEvents: 'none',
              }}
            />
          ))}

          <motion.button
            onClick={toggleListen}
            disabled={status === 'thinking' || status === 'speaking'}
            whileHover={status !== 'thinking' && status !== 'speaking' ? { scale: 1.09 } : {}}
            whileTap={status !== 'thinking' && status !== 'speaking' ? { scale: 0.91 } : {}}
            style={{
              width: 80, height: 80, borderRadius: '50%', border: 'none',
              cursor: status === 'thinking' || status === 'speaking' ? 'not-allowed' : 'pointer',
              background: status === 'listening'
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : status === 'thinking'
                ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                : status === 'speaking'
                ? 'linear-gradient(135deg, #059669, #047857)'
                : 'linear-gradient(135deg, #6366f1, #4338ca)',
              boxShadow: status === 'listening'
                ? '0 0 0 6px rgba(239,68,68,0.15), 0 8px 40px rgba(239,68,68,0.45)'
                : status === 'speaking'
                ? '0 0 0 6px rgba(52,211,153,0.15), 0 8px 40px rgba(52,211,153,0.35)'
                : '0 0 0 6px rgba(99,102,241,0.15), 0 8px 40px rgba(99,102,241,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.3s ease, box-shadow 0.3s ease',
            }}
          >
            {status === 'listening'  ? <MicOff size={30} color="white" /> :
             status === 'thinking'   ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}><Droplets size={28} color="white" /></motion.div> :
             status === 'speaking'   ? <Volume2 size={28} color="white" /> :
             <Mic size={30} color="white" />}
          </motion.button>
        </div>

        {/* Voice + Clear buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={toggleVoice}
            style={{ background: voiceOn ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${voiceOn ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.09)'}`, borderRadius: 10, padding: '7px 13px', cursor: 'pointer', color: voiceOn ? '#c4b5fd' : 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}>
            {voiceOn ? <Volume2 size={13}/> : <VolumeX size={13}/>}
            {voiceOn ? 'Voice On' : 'Voice Off'}
          </button>
          <button onClick={clearChat}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '7px 13px', cursor: 'pointer', color: 'rgba(255,255,255,0.28)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={13}/> Clear
          </button>
        </div>

        {/* Tip */}
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 14, maxWidth: 200, lineHeight: 1.5 }}>
          Tap the mic and just talk, or type your question
        </p>
      </div>

      {/* ── RIGHT PANEL: Chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px 20px', position: 'relative', zIndex: 2, minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexShrink: 0 }}>
          <Sparkles size={17} color="#a78bfa" />
          <h1 style={{ fontSize: 17, fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.01em' }}>Ask Nibi</h1>
          <span style={{ fontSize: 11, padding: '3px 9px', background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.32)', borderRadius: 20, color: '#c4b5fd', fontWeight: 700, letterSpacing: '0.04em' }}>
            WATER AI
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
            Free · No account needed
          </span>
        </div>

        {/* Suggestion chips — only on first message */}
        {messages.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14, flexShrink: 0 }}>
            {SUGGESTIONS.map(s => (
              <motion.button key={s}
                onClick={() => sendMessage(s.replace(/^[^\s]+ /, ''))}
                whileHover={{ scale: 1.04, borderColor: 'rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.12)' }}
                whileTap={{ scale: 0.96 }}
                style={{ fontSize: 12, padding: '6px 13px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontWeight: 500, transition: 'all 0.15s' }}>
                {s}
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* Messages area */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 11, paddingRight: 4, paddingBottom: 6 }}>
          <AnimatePresence initial={false}>
            {messages.map((m, i) => <Bubble key={i} msg={m} />)}
          </AnimatePresence>

          {/* Thinking indicator */}
          <AnimatePresence>
            {status === 'thinking' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, boxShadow: '0 0 12px rgba(99,102,241,0.4)', flexShrink: 0 }}>💧</div>
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '18px 18px 18px 4px', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <motion.div key={i}
                      animate={{ y: [0, -7, 0] }}
                      transition={{ duration: 0.65, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                      style={{ width: 7, height: 7, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 6px #a78bfa' }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              placeholder="Ask about water quality, lakes, ecosystems…"
              style={{
                width: '100%', padding: '11px 16px',
                background: 'rgba(255,255,255,0.055)',
                border: '1px solid rgba(99,102,241,0.28)',
                borderRadius: 13, color: 'rgba(255,255,255,0.9)',
                fontSize: 13.5, outline: 'none',
                boxSizing: 'border-box',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,0.05)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(99,102,241,0.28)'; e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
            />
          </div>
          <motion.button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || status === 'thinking'}
            whileHover={input.trim() ? { scale: 1.06 } : {}}
            whileTap={input.trim() ? { scale: 0.94 } : {}}
            style={{
              padding: '11px 18px', borderRadius: 13, border: 'none',
              background: input.trim()
                ? 'linear-gradient(135deg, #6366f1, #4338ca)'
                : 'rgba(255,255,255,0.06)',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              opacity: input.trim() ? 1 : 0.4,
              color: 'white', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: input.trim() ? '0 4px 20px rgba(99,102,241,0.35)' : 'none',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            <Send size={16} />
          </motion.button>
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        input::placeholder { color: rgba(255,255,255,0.25); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.5); }
      `}</style>
    </div>
  )
}
