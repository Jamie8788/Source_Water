import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { X, Volume2, VolumeX, MessageCircle, Gamepad2 } from 'lucide-react'

// ── ALL Nibi poses ───────────────────────────────────────────────────────────
const NIBI_POSES = {
  idle:      '/mascot-images/nibi_idle.webp',
  wave:      '/mascot-images/nibi_wave.webp',
  talking:   '/mascot-images/nibi_talking.webp',
  thinking:  '/mascot-images/nibi_thinking.webp',
  happy:     '/mascot-images/nibi_happy.webp',
  confident: '/mascot-images/nibi_confident.webp',
  blush:     '/mascot-images/nibi_blush.webp',
  labcoat:   '/mascot-images/nibi_labcoat.webp',
  pointing:  '/mascot-images/nibi_pointing.webp',
  openarms:  '/mascot-images/nibi_openarms.webp',
  jumping:   '/mascot-images/nibi_jumping.webp',
  tablet:    '/mascot-images/nibi_tablet.webp',
  trophy:    '/mascot-images/nibi_trophy.webp',
  action:    '/mascot-images/nibi_action.webp',
  strong:    '/mascot-images/nibi_strong.webp',
  walking:   '/mascot-images/nibi_walking.webp',
  love:      '/mascot-images/nibi_love.webp',
  rainy:     '/mascot-images/nibi_rainy.webp',
  guide:     '/mascot-images/nibi_guide.webp',
  pure:      '/mascot-images/nibi_pure.webp',
  spinning:  '/mascot-images/nibi_spinning.webp',
}

// ── Page → pose sets (cycles through these) ──────────────────────────────────
const PAGE_POSES = {
  '/dashboard':  ['confident', 'tablet', 'pointing', 'guide', 'happy'],
  '/map':        ['thinking', 'pointing', 'labcoat', 'action', 'openarms'],
  '/social':     ['happy', 'wave', 'love', 'openarms', 'talking'],
  '/quiz':       ['confident', 'trophy', 'strong', 'jumping', 'action'],
  '/games':      ['jumping', 'happy', 'spinning', 'action', 'trophy', 'strong'],
  '/resources':  ['labcoat', 'tablet', 'guide', 'thinking', 'pointing'],
  '/analysis':   ['labcoat', 'tablet', 'confident', 'thinking', 'guide'],
  '/alerts':     ['action', 'pointing', 'strong', 'rainy', 'thinking'],
  '/weather':    ['rainy', 'pure', 'thinking', 'idle', 'walking'],
}
const DEFAULT_POSES = ['idle', 'wave', 'happy', 'confident', 'pointing', 'openarms']

// ── Mood videos (chroma-key, same as Ask Water) ─────────────────────────────
const MOOD_VIDEOS = {
  idle:     '/mascot-animations/Water_Mascot_Shy-to-Love.mp4',
  wave:     '/mascot-animations/Water_Mascot_Waving.mp4',
  thinking: '/mascot-animations/Water_Mascot_Curiosity.mp4',
  talking:  '/mascot-animations/Water_Mascot_Talking_Assistant.mp4',
  confident:'/mascot-animations/Water_Mascot_Confident-to-Assistant.mp4',
}

const PAGE_MESSAGES = {
  '/dashboard':  ['Welcome back! Your water data is looking fresh today! 💧', 'Check out the latest observations from your community!', 'Did you know? Lake Superior holds 10% of the world\'s fresh surface water!'],
  '/ask-water':  ['Ask me anything about water quality! I\'m here to help. 🤖', 'I can explain complex water science in simple terms!', 'Try asking about pH levels, dissolved oxygen, or Northern Ontario lakes!'],
  '/map':        ['Explore 5 monitoring sites across Northern Ontario!', 'Click anywhere on the map to submit an observation!', 'Each water sample you submit helps protect our watersheds!'],
  '/social':     ['Connect with your water community! Every voice matters. 💬', 'Share your water observations and insights with others!', 'Engaged communities protect their water sources best!'],
  '/quiz':       ['Test your water knowledge! Learning makes us all stronger! 📚', 'Each quiz completed earns you XP points! Keep going!', 'You can earn badges by completing all 5 quiz topics!'],
  '/games':      ['Let\'s play and learn about water together! 🎮', 'Try the Boat Cleanup game — steer your boat to collect pollution!', 'Every game helps you understand real water science!'],
  '/resources':  ['Explore our water quality knowledge base! 📖', 'Share resources with your community stewards!', 'Check out the Water Rangers program at waterrangers.ca!'],
  '/analysis':   ['Upload any CSV or Excel file for instant AI analysis! 📊', 'I can help interpret complex water quality parameters!', 'Try uploading a Water Rangers export to see insights!'],
  '/alerts':     ['Stay informed about water quality alerts for your region! 🚨', 'Timely alerts help communities protect their health!', 'You can subscribe to alert notifications in your profile.'],
  '/weather':    ['Weather affects water quality! Rainfall increases turbidity. 🌤️', 'Check conditions before planning a field sampling trip!', 'Heavy rain events can cause runoff — great time to monitor!'],
}

// ── Mini Game: Catch the Drops ────────────────────────────────────────────────
function DropGame({ onClose }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({ drops: [], score: 0, bucketX: 180, lives: 3, t: 0, over: false })
  const keysRef = useRef({})
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [over, setOver] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = 360, H = 320
    let raf
    const st = stateRef.current

    const spawnDrop = () => {
      st.drops.push({
        x: 20 + Math.random() * (W - 40),
        y: -10,
        vy: 1.2 + Math.random() * 1.5 + st.score * 0.015,
        r: 6 + Math.random() * 8,
        hue: 190 + Math.random() * 40,
        caught: false,
      })
    }

    let spawnT = 0
    const loop = () => {
      if (st.over) return
      st.t++
      spawnT++
      if (spawnT > Math.max(28, 55 - st.score * 0.4)) { spawnDrop(); spawnT = 0 }
      if (keysRef.current['ArrowLeft'] || keysRef.current['a']) st.bucketX = Math.max(30, st.bucketX - 4)
      if (keysRef.current['ArrowRight'] || keysRef.current['d']) st.bucketX = Math.min(W - 30, st.bucketX + 4)

      ctx.clearRect(0, 0, W, H)
      // bg
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#0f172a'); bg.addColorStop(1, '#0c4a6e')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
      // stars
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.2 + ((i * 137 + st.t * 0.1) % 1) * 0.3})`
        ctx.beginPath(); ctx.arc(((i * 73) % W), ((i * 53) % (H * 0.7)), 1, 0, Math.PI * 2); ctx.fill()
      }
      // drops
      for (let i = st.drops.length - 1; i >= 0; i--) {
        const d = st.drops[i]
        d.y += d.vy
        const grad = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.4, d.r * 0.1, d.x, d.y, d.r)
        grad.addColorStop(0, `hsla(${d.hue},90%,85%,0.9)`)
        grad.addColorStop(1, `hsla(${d.hue},80%,55%,0.7)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(d.x, d.y - d.r * 1.5)
        ctx.bezierCurveTo(d.x + d.r * 0.8, d.y - d.r * 0.4, d.x + d.r, d.y + d.r * 0.6, d.x, d.y + d.r)
        ctx.bezierCurveTo(d.x - d.r, d.y + d.r * 0.6, d.x - d.r * 0.8, d.y - d.r * 0.4, d.x, d.y - d.r * 1.5)
        ctx.fill()
        // caught?
        if (d.y + d.r > H - 40 && Math.abs(d.x - st.bucketX) < 38) {
          st.score++; setScore(st.score)
          st.drops.splice(i, 1); continue
        }
        if (d.y > H + 10) {
          st.lives--; setLives(st.lives)
          st.drops.splice(i, 1)
          if (st.lives <= 0) { st.over = true; setOver(true) }
        }
      }
      // bucket
      const bx = st.bucketX
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.moveTo(bx - 35, H - 30)
      ctx.lineTo(bx + 35, H - 30)
      ctx.lineTo(bx + 28, H - 8)
      ctx.lineTo(bx - 28, H - 8)
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.beginPath(); ctx.ellipse(bx, H - 30, 35, 5, 0, 0, Math.PI * 2); ctx.fill()
      // HUD
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'left'
      ctx.fillText(`Score: ${st.score}`, 12, 22)
      ctx.textAlign = 'right'
      ctx.fillText(`❤️ ${st.lives}`, W - 12, 22)

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onKey = (e) => { keysRef.current[e.key] = e.type === 'keydown' }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    // Touch / click
    const onTouch = (e) => {
      const rect = canvas.getBoundingClientRect()
      const cx = (e.touches?.[0] || e).clientX - rect.left
      st.bucketX = Math.max(30, Math.min(W - 30, cx))
    }
    canvas.addEventListener('touchmove', onTouch)
    canvas.addEventListener('mousemove', onTouch)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [])

  const restart = () => {
    const st = stateRef.current
    st.drops = []; st.score = 0; st.bucketX = 180; st.lives = 3; st.t = 0; st.over = false
    setScore(0); setLives(3); setOver(false)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[200] bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="relative rounded-3xl overflow-hidden shadow-2xl border"
        style={{ background: '#0f172a', borderColor: '#38bdf8' }}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <span className="text-white font-bold text-sm">💧 Catch the Drops!</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-sky-300">← → or A/D to move</span>
            <button onClick={onClose} className="text-white/60 hover:text-white transition"><X className="w-4 h-4"/></button>
          </div>
        </div>
        <canvas ref={canvasRef} width={360} height={320} style={{ display: 'block' }}/>
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-3xl">
            <p className="text-4xl mb-2">💧</p>
            <p className="text-white font-black text-2xl mb-1">Game Over!</p>
            <p className="text-sky-300 text-lg mb-4">Score: {score}</p>
            <button onClick={restart} className="px-6 py-2 rounded-full text-white font-bold text-sm hover:scale-105 transition"
              style={{ background: 'linear-gradient(135deg,#38bdf8,#14b8a6)' }}>Play Again</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sparkle burst on click ───────────────────────────────────────────────────
function Sparkle({ x, y, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 800); return () => clearTimeout(t) }, [])
  return (
    <div className="fixed pointer-events-none" style={{ left: x - 30, top: y - 30, width: 60, height: 60, zIndex: 9999 }}>
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2
        const dist = 22 + Math.random() * 12
        return (
          <div key={i} className="absolute rounded-full"
            style={{
              width: 5 + Math.random() * 5, height: 5 + Math.random() * 5,
              left: 30, top: 30,
              background: ['#38bdf8','#14b8a6','#818cf8','#2dd4bf','white'][i % 5],
              animation: `sparkleOut 0.7s ease-out forwards`,
              '--tx': `${Math.cos(angle) * dist}px`,
              '--ty': `${Math.sin(angle) * dist}px`,
              animationDelay: `${i * 0.02}s`,
            }}/>
        )
      })}
      <style>{`
        @keyframes sparkleOut {
          0%   { transform: translate(0,0) scale(1); opacity: 1 }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0 }
        }
      `}</style>
    </div>
  )
}

// ── Main WaterMascot ─────────────────────────────────────────────────────────
export default function WaterMascot() {
  const location = useLocation()
  const [minimized, setMinimized] = useState(false)
  const [msg, setMsg] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [showBubbles, setShowBubbles] = useState(false)
  const [showGame, setShowGame] = useState(false)
  const [sparkles, setSparkles] = useState([])
  const [bounce, setBounce] = useState(false)
  const [clickCount, setClickCount] = useState(0)
  const [pose, setPose] = useState('idle')
  const [pos, setPos] = useState({ x: null, y: null })
  const synthRef = useRef(null)
  const tRef = useRef(0)
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 })
  const containerRef = useRef(null)

  const videoCanvasRef = useRef(null)
  const videoRef = useRef(null)
  const videoRafRef = useRef(null)
  const [videoReady, setVideoReady] = useState(false)

  // Determine pose from state: speaking > bounce > page default > cycle
  useEffect(() => {
    if (speaking) { setPose('talking'); return }
    if (bounce) { setPose('wave'); return }
    const poses = PAGE_POSES[location.pathname] || DEFAULT_POSES
    setPose(poses[0])
  }, [speaking, bounce, location.pathname])

  // Pose cycling — every 3-5 seconds, cycle through page-specific poses
  useEffect(() => {
    if (speaking || bounce) return
    const poses = PAGE_POSES[location.pathname] || DEFAULT_POSES
    let idx = 0
    const cycle = setInterval(() => {
      idx = (idx + 1) % poses.length
      setPose(poses[idx])
    }, 3000 + Math.random() * 2000)
    return () => clearInterval(cycle)
  }, [location.pathname, speaking, bounce])

  // Canvas chroma-key video (removes white bg from MP4, like Ask Water)
  useEffect(() => {
    const videoKey = speaking ? 'talking' : bounce ? 'wave' : null
    const videoSrc = videoKey ? MOOD_VIDEOS[videoKey] : null
    if (!videoSrc || !videoCanvasRef.current) { setVideoReady(false); return }

    const canvas = videoCanvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const video = document.createElement('video')
    video.src = videoSrc
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    videoRef.current = video

    const renderFrame = () => {
      if (video.paused || video.ended) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = img.data
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 235 && d[i+1] > 235 && d[i+2] > 235) d[i+3] = 0
        else if (d[i] > 215 && d[i+1] > 215 && d[i+2] > 215) {
          d[i+3] = Math.round(((255-(d[i]+d[i+1]+d[i+2])/3)/40)*255)
        }
      }
      ctx.putImageData(img, 0, 0)
      videoRafRef.current = requestAnimationFrame(renderFrame)
    }

    video.addEventListener('canplay', () => {
      setVideoReady(true)
      video.play().catch(() => {})
    })
    video.addEventListener('play', renderFrame)
    video.load()

    return () => {
      cancelAnimationFrame(videoRafRef.current)
      video.pause(); video.src = ''; video.load()
      videoRef.current = null; setVideoReady(false)
    }
  }, [speaking, bounce])

  // Page message
  useEffect(() => {
    const msgs = PAGE_MESSAGES[location.pathname] || ['Hi! I\'m Water, your guide to clean water! 💧']
    const m = msgs[Math.floor(Math.random() * msgs.length)]
    setMsg(m)
    setShowBubbles(true)
    setTimeout(() => setShowBubbles(false), 2000)
  }, [location.pathname])

  const speak = useCallback((text) => {
    if (!ttsEnabled || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 1.05; utt.pitch = 1.8; utt.volume = 0.9
    const voices = window.speechSynthesis.getVoices()
    // Prefer kid/young female voices: Ana (Edge), Samantha (Mac), Zira (Win)
    const kidVoice = voices.find(v => /\bana\b/i.test(v.name))
      || voices.find(v => /samantha|victoria/i.test(v.name))
      || voices.find(v => /zira|hazel/i.test(v.name))
      || voices.find(v => v.name.includes('Google') && v.name.includes('US') && /female/i.test(v.name))
      || voices.find(v => v.lang?.startsWith('en') && /female/i.test(v.name))
      || voices.find(v => v.lang === 'en-US' || v.lang === 'en-CA')
    if (kidVoice) utt.voice = kidVoice
    utt.onstart = () => setSpeaking(true)
    utt.onend = () => setSpeaking(false)
    synthRef.current = utt
    window.speechSynthesis.speak(utt)
  }, [ttsEnabled])

  useEffect(() => {
    if (msg && ttsEnabled && !minimized) {
      const t = setTimeout(() => speak(msg), 300)
      return () => clearTimeout(t)
    }
  }, [msg, ttsEnabled, minimized])

  // Drag logic
  const onMouseDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x ?? (window.innerWidth - (rect?.width || 200) - 24),
      origY: pos.y ?? (window.innerHeight - (rect?.height || 200) - 24),
    }
    const onMove = (ev) => {
      if (!dragRef.current.dragging) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      const W = window.innerWidth, H = window.innerHeight
      const rw = rect?.width || 180, rh = rect?.height || 200
      setPos({
        x: Math.max(0, Math.min(W - rw, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(H - rh, dragRef.current.origY + dy)),
      })
    }
    const onUp = (ev) => {
      const moved = Math.abs(ev.clientX - dragRef.current.startX) + Math.abs(ev.clientY - dragRef.current.startY)
      dragRef.current.dragging = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // If barely moved, treat as click
      if (moved < 5) handleClick(ev)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleClick = (e) => {
    const msgs = PAGE_MESSAGES[location.pathname] || ['💧']
    const m = msgs[Math.floor(Math.random() * msgs.length)]
    setMsg(m)
    speak(m)
    setBounce(true)
    setTimeout(() => setBounce(false), 500)
    const newCount = clickCount + 1
    setClickCount(newCount)
    // Add sparkles at click position
    setSparkles(prev => [...prev, { id: Date.now(), x: e.clientX, y: e.clientY }])
    // Every 5 clicks, trigger game
    if (newCount % 5 === 0) {
      setTimeout(() => setShowGame(true), 200)
    }
  }

  const posStyle = pos.x !== null
    ? { position: 'fixed', left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
    : { position: 'fixed', bottom: 24, right: 24 }

  if (minimized) {
    return (
      <button onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #38bdf8, #14b8a6)', animation: 'mascotGlow 2.5s ease-in-out infinite' }}>
        <img src="/mascot-images/nibi_idle.webp" alt="Nibi" style={{ width: 48, height: 48, objectFit: 'contain' }} />
      </button>
    )
  }

  return (
    <>
      {sparkles.map(s => (
        <Sparkle key={s.id} x={s.x} y={s.y} onDone={() => setSparkles(prev => prev.filter(p => p.id !== s.id))}/>
      ))}
      {showGame && <DropGame onClose={() => setShowGame(false)}/>}

      <div ref={containerRef}
        className="z-50 flex flex-col items-end gap-3 select-none"
        style={{ ...posStyle, cursor: dragRef.current.dragging ? 'grabbing' : 'grab' }}>

        {/* Hint: click count to game */}
        {clickCount > 0 && clickCount % 5 !== 0 && (
          <div className="text-xs text-center px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>
            {5 - (clickCount % 5)} clicks to game 🎮
          </div>
        )}

        {/* Speech bubble */}
        {msg && (
          <div className="bg-white rounded-2xl rounded-br-sm shadow-xl border border-ocean-100 p-4 max-w-xs relative"
            style={{ animation: 'fadeInUp 0.4s ease' }}>
            <p className="text-gray-700 text-sm leading-relaxed">{msg}</p>
            <div className="absolute -bottom-2 right-5 w-4 h-4 bg-white border-r border-b border-ocean-100 transform rotate-45"/>
            {showBubbles && [0,1,2].map(i => (
              <div key={i} className="absolute rounded-full border border-ocean-300"
                style={{ width: 6+i*4, height: 6+i*4, bottom: -20-i*12, right: 20+i*8,
                  animation: `bubbleFloat ${0.8+i*0.3}s ease-out forwards`, opacity: 0.6 }}/>
            ))}
          </div>
        )}

        {/* Mascot */}
        <div className="flex items-end gap-2">
          {/* Controls */}
          <div className="flex flex-col gap-1">
            <button onClick={() => { setTtsEnabled(t => !t); if (ttsEnabled) window.speechSynthesis?.cancel() }}
              className="p-2 rounded-full bg-white shadow-md hover:bg-gray-50 transition-all hover:scale-110"
              title={ttsEnabled ? 'Mute Water' : 'Enable voice'}>
              {ttsEnabled ? <Volume2 className="w-3.5 h-3.5 text-ocean-500"/> : <VolumeX className="w-3.5 h-3.5 text-gray-400"/>}
            </button>
            <button onClick={() => { const msgs = PAGE_MESSAGES[location.pathname] || ['💧']; const m = msgs[Math.floor(Math.random()*msgs.length)]; setMsg(m); speak(m) }}
              className="p-2 rounded-full bg-white shadow-md hover:bg-gray-50 transition-all hover:scale-110" title="Get a tip">
              <MessageCircle className="w-3.5 h-3.5 text-teal-500"/>
            </button>
            <button onClick={() => setShowGame(true)}
              className="p-2 rounded-full bg-white shadow-md hover:bg-sky-50 transition-all hover:scale-110" title="Play Catch the Drops!">
              <Gamepad2 className="w-3.5 h-3.5 text-sky-500"/>
            </button>
            <button onClick={() => setMinimized(true)}
              className="p-2 rounded-full bg-white shadow-md hover:bg-gray-50 transition-all hover:scale-110" title="Minimize">
              <X className="w-3.5 h-3.5 text-gray-400"/>
            </button>
          </div>

          {/* Nibi mascot — multi-pose animated character */}
          <div
            style={{
              width: 130,
              height: 160,
              position: 'relative',
              cursor: 'grab',
            }}
            onMouseDown={onMouseDown}
            onTouchStart={(e) => {
              const t = e.touches[0]
              handleClick({ clientX: t.clientX, clientY: t.clientY })
            }}>

            {/* Glow aura behind Nibi */}
            <div style={{
              position: 'absolute',
              width: '80%', height: '60%',
              top: '20%', left: '10%',
              borderRadius: '50%',
              background: speaking
                ? 'radial-gradient(ellipse, rgba(52,211,153,.35) 0%, transparent 70%)'
                : bounce
                  ? 'radial-gradient(ellipse, rgba(56,189,248,.4) 0%, transparent 70%)'
                  : 'radial-gradient(ellipse, rgba(99,102,241,.2) 0%, transparent 70%)',
              filter: 'blur(12px)',
              animation: 'mascotGlow 2.5s ease-in-out infinite',
              transition: 'background 0.5s ease',
              pointerEvents: 'none',
            }}/>

            {/* Chroma-key video canvas — shows when speaking/waving */}
            <canvas
              ref={videoCanvasRef}
              width={260}
              height={340}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                position: 'absolute',
                inset: 0,
                zIndex: 2,
                opacity: videoReady ? 1 : 0,
                transition: 'opacity 0.35s ease',
                pointerEvents: 'none',
              }}
            />

            {/* Static pose image — cycles through all poses, hides when video plays */}
            <img
              key={pose}
              src={NIBI_POSES[pose] || NIBI_POSES.idle}
              alt="Nibi the water mascot"
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
                userSelect: 'none',
                position: 'relative',
                zIndex: 1,
                opacity: videoReady ? 0 : 1,
                animation: 'mascotFloat 3s ease-in-out infinite, mascotFadeIn 0.35s ease-out',
                filter: bounce
                  ? 'drop-shadow(0 0 16px rgba(56,189,248,0.7))'
                  : speaking
                    ? 'drop-shadow(0 0 10px rgba(52,211,153,0.5))'
                    : 'drop-shadow(0 4px 12px rgba(0,0,0,0.35))',
                transform: bounce ? 'scale(1.12) translateY(-10px)' : undefined,
                transition: 'filter 0.3s ease, transform 0.2s cubic-bezier(0.34,1.8,0.64,1), opacity 0.35s ease',
              }}
            />

            {/* Speaking ripple rings */}
            {speaking && [1,2,3].map(i => (
              <div key={i} style={{
                position: 'absolute',
                top: '30%', left: '50%',
                width: 30 + i * 20, height: 30 + i * 20,
                marginLeft: -(15 + i * 10), marginTop: -(15 + i * 10),
                borderRadius: '50%',
                border: '2px solid rgba(52,211,153,0.35)',
                animation: `ping ${0.8 + i * 0.2}s ease-out infinite`,
                animationDelay: `${i * 0.15}s`,
                pointerEvents: 'none',
                zIndex: 3,
              }}/>
            ))}

            {/* Ground shadow */}
            <div style={{
              position: 'absolute',
              bottom: 2, left: '20%', width: '60%', height: 8,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.2)',
              filter: 'blur(4px)',
              zIndex: 0,
            }}/>
          </div>
        </div>

        {/* Drag hint */}
        <div className="text-center text-xs" style={{ color: 'rgba(100,116,139,0.7)', fontSize: 9 }}>
          drag me · click for tips · 🎮
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes bubbleFloat { 0% { transform:translateY(0); opacity:0.6 } 100% { transform:translateY(-40px); opacity:0 } }
        @keyframes ping { 0% { transform:scale(0.8); opacity:0.6 } 100% { transform:scale(1.4); opacity:0 } }
        @keyframes mascotFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes mascotFadeIn {
          from { opacity: 0.3; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes mascotGlow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </>
  )
}
