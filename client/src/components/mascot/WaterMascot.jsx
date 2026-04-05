import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { X, Volume2, VolumeX, MessageCircle } from 'lucide-react'

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

export default function WaterMascot() {
  const location = useLocation()
  const [minimized, setMinimized] = useState(false)
  const [msg, setMsg] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [blink, setBlink] = useState(false)
  const [breath, setBreath] = useState(1)
  const [wave, setWave] = useState(0)
  const [showBubbles, setShowBubbles] = useState(false)
  const synthRef = useRef(null)
  const tRef = useRef(0)

  // Breathing + wave animation loop
  useEffect(() => {
    let raf
    const animate = () => {
      tRef.current += 0.03
      setBreath(1 + Math.sin(tRef.current) * 0.035)
      setWave(Math.sin(tRef.current * 0.7) * 4)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Blink
  useEffect(() => {
    const t = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 180)
    }, 2800 + Math.random() * 2000)
    return () => clearInterval(t)
  }, [])

  // Page message
  useEffect(() => {
    const msgs = PAGE_MESSAGES[location.pathname] || ['Hi! I\'m Water, your guide to clean water! 💧']
    const m = msgs[Math.floor(Math.random() * msgs.length)]
    setMsg(m)
    setShowBubbles(true)
    setTimeout(() => setShowBubbles(false), 2000)
  }, [location.pathname])

  const speak = (text) => {
    if (!ttsEnabled || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.88
    utt.pitch = 1.25
    utt.volume = 0.85

    // Pick female voice
    const voices = window.speechSynthesis.getVoices()
    const femaleVoice = voices.find(v =>
      v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Victoria') ||
      v.name.includes('Zira') || v.name.includes('Hazel') || v.name.includes('female') ||
      (v.name.includes('Google') && v.name.includes('US') && v.gender !== 'male') ||
      v.name.includes('Susan') || v.name.includes('Monica') || v.name.includes('Microsoft Zira')
    ) || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
      || voices.find(v => v.lang === 'en-US' || v.lang === 'en-CA')

    if (femaleVoice) utt.voice = femaleVoice
    utt.onstart = () => setSpeaking(true)
    utt.onend = () => setSpeaking(false)
    synthRef.current = utt
    window.speechSynthesis.speak(utt)
  }

  useEffect(() => {
    if (msg && ttsEnabled && !minimized) {
      const t = setTimeout(() => speak(msg), 300)
      return () => clearTimeout(t)
    }
  }, [msg, ttsEnabled, minimized])

  // Body scale (breathing)
  const bs = breath

  if (minimized) {
    return (
      <button onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform"
        style={{ background: 'linear-gradient(135deg, #38bdf8, #14b8a6)', transform: `scale(${bs})` }}>
        <span className="text-3xl">💧</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 select-none">
      {/* Speech bubble */}
      {msg && (
        <div className="bg-white rounded-2xl rounded-br-sm shadow-xl border border-ocean-100 p-4 max-w-xs relative"
          style={{ animation: 'fadeInUp 0.4s ease' }}>
          <p className="text-gray-700 text-sm leading-relaxed">{msg}</p>
          <div className="absolute -bottom-2 right-5 w-4 h-4 bg-white border-r border-b border-ocean-100 transform rotate-45" />

          {/* Mini bubbles */}
          {showBubbles && [0,1,2].map(i => (
            <div key={i} className="absolute rounded-full border border-ocean-300"
              style={{ width: 6+i*4, height: 6+i*4, bottom: -20-i*12, right: 20+i*8,
                animation: `bubbleFloat ${0.8+i*0.3}s ease-out forwards`, opacity: 0.6 }} />
          ))}
        </div>
      )}

      {/* Mascot */}
      <div className="flex items-end gap-2">
        {/* Controls */}
        <div className="flex flex-col gap-1">
          <button onClick={() => { setTtsEnabled(t => !t); if (ttsEnabled) window.speechSynthesis?.cancel() }}
            className="p-2 rounded-full bg-white shadow-md hover:bg-gray-50 transition-all hover:scale-110"
            title={ttsEnabled ? 'Mute Water' : 'Enable Water\'s voice'}>
            {ttsEnabled ? <Volume2 className="w-3.5 h-3.5 text-ocean-500" /> : <VolumeX className="w-3.5 h-3.5 text-gray-400" />}
          </button>
          <button onClick={() => { const msgs = PAGE_MESSAGES[location.pathname] || ['💧']; const m = msgs[Math.floor(Math.random()*msgs.length)]; setMsg(m); speak(m) }}
            className="p-2 rounded-full bg-white shadow-md hover:bg-gray-50 transition-all hover:scale-110" title="Get a tip">
            <MessageCircle className="w-3.5 h-3.5 text-teal-500" />
          </button>
          <button onClick={() => setMinimized(true)}
            className="p-2 rounded-full bg-white shadow-md hover:bg-gray-50 transition-all hover:scale-110" title="Minimize">
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>

        {/* SVG mascot */}
        <svg width="80" height="92" viewBox="0 0 80 92"
          className="cursor-pointer drop-shadow-2xl"
          style={{ transform: `scale(${bs}) translateY(${wave}px)`, transition: 'transform 0.05s linear' }}
          onClick={() => { const msgs = PAGE_MESSAGES[location.pathname] || ['💧']; const m = msgs[Math.floor(Math.random()*msgs.length)]; setMsg(m); speak(m) }}>
          <defs>
            <radialGradient id="wbody" cx="38%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="60%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#0369a1" />
            </radialGradient>
            <radialGradient id="wshine" cx="30%" cy="25%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <radialGradient id="wcheek" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(251,113,133,0.5)" />
              <stop offset="100%" stopColor="rgba(251,113,133,0)" />
            </radialGradient>
            <filter id="wglow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Glow ring */}
          <ellipse cx="40" cy="82" rx="22" ry="6" fill="rgba(14,165,233,0.2)" />

          {/* Drop body */}
          <path d="M40 5 C40 5 12 35 12 56 C12 72 25 84 40 84 C55 84 68 72 68 56 C68 35 40 5 40 5Z"
            fill="url(#wbody)" filter="url(#wglow)" />

          {/* Shine */}
          <ellipse cx="30" cy="34" rx="11" ry="15" fill="url(#wshine)" transform="rotate(-18 30 34)" />

          {/* Inner water ripple */}
          <ellipse cx="40" cy="65" rx="16" ry="5" fill="rgba(255,255,255,0.12)" />
          <ellipse cx="40" cy="72" rx="10" ry="3" fill="rgba(255,255,255,0.08)" />

          {/* Eyes */}
          <ellipse cx="31" cy="52" rx="7.5" ry={blink ? 1 : 8} fill="white" />
          <ellipse cx="49" cy="52" rx="7.5" ry={blink ? 1 : 8} fill="white" />
          {!blink && <>
            <circle cx="32.5" cy="53" r="4.5" fill="#0c4a6e" />
            <circle cx="50.5" cy="53" r="4.5" fill="#0c4a6e" />
            <circle cx="34" cy="51" r="1.8" fill="white" />
            <circle cx="52" cy="51" r="1.8" fill="white" />
            {/* Pupils animate */}
            <circle cx="33" cy="54" r="1" fill="#1e40af" />
            <circle cx="51" cy="54" r="1" fill="#1e40af" />
          </>}

          {/* Cheeks */}
          <ellipse cx="22" cy="60" rx="7" ry="4" fill="url(#wcheek)" />
          <ellipse cx="58" cy="60" rx="7" ry="4" fill="url(#wcheek)" />

          {/* Mouth */}
          <path d={speaking ? 'M30 66 Q40 73 50 66' : 'M30 66 Q40 71 50 66'}
            stroke="#0c4a6e" strokeWidth="2.5" fill="none" strokeLinecap="round" />

          {/* Speaking rings */}
          {speaking && [1,2,3].map(i => (
            <circle key={i} cx="40" cy="40" r={10+i*8} fill="none"
              stroke="rgba(56,189,248,0.3)" strokeWidth="1.5"
              style={{ animation: `ping ${0.8+i*0.2}s ease-out infinite`, animationDelay: i*0.15+'s' }} />
          ))}

          {/* Crown/hat decoration */}
          <path d="M26 20 L32 10 L40 18 L48 10 L54 20" stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes bubbleFloat { 0% { transform:translateY(0); opacity:0.6 } 100% { transform:translateY(-40px); opacity:0 } }
        @keyframes ping { 0% { transform:scale(0.8); opacity:0.6 } 100% { transform:scale(1.4); opacity:0 } }
      `}</style>
    </div>
  )
}
